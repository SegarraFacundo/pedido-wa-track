// ============================================================
// Edge function: crear-pedido
// Crea un pedido desde la PWA del cliente (reemplaza al bot de WhatsApp).
// Porta la lógica de validación de evolution-webhook/tool-handlers.ts
// (handler "crear_pedido"), pero:
//   - toma input explícito de un cliente autenticado (phone auth)
//   - RECALCULA precios y total desde la DB (no confía en el cliente)
//   - ata el pedido a auth.users (orders.user_id)
//
// Auth: manual (verify_jwt = false en config.toml, igual que el resto).
// ============================================================
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CartItemInput {
  product_id: string;
  quantity: number;
}

interface CrearPedidoBody {
  vendor_id: string;
  items: CartItemInput[];
  delivery_type: "delivery" | "pickup";
  address?: string;
  payment_method: "efectivo" | "transferencia" | "mercadopago";
  customer_name?: string;
  // El teléfono se captura en el checkout (el login es Google/invitado, sin teléfono).
  customer_phone: string;
  coordinates?: { lat: number; lng: number } | null;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ── Auth: requiere cliente autenticado ──
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return json({ error: "Unauthorized" }, 401);
    }

    const userId = claimsData.claims.sub as string;

    // Cliente con service_role para toda la lógica de negocio.
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // ── Validación de input ──
    const body = (await req.json()) as CrearPedidoBody;
    const { vendor_id, items, delivery_type, payment_method } = body;

    if (!vendor_id || typeof vendor_id !== "string") {
      return json({ error: "vendor_id requerido" }, 400);
    }
    if (!Array.isArray(items) || items.length === 0) {
      return json({ error: "El carrito está vacío" }, 400);
    }
    if (delivery_type !== "delivery" && delivery_type !== "pickup") {
      return json({ error: "delivery_type inválido" }, 400);
    }
    if (!["efectivo", "transferencia", "mercadopago"].includes(payment_method)) {
      return json({ error: "Método de pago inválido" }, 400);
    }
    const customerPhone = (body.customer_phone || "").trim();
    if (!customerPhone) {
      return json({ error: "Falta el teléfono de contacto" }, 400);
    }

    // ── Vendor: existe, activo, config de entrega y pago ──
    const { data: vendor, error: vendorError } = await supabase
      .from("vendors")
      .select("id, name, is_active, address, delivery_fixed_price, allows_pickup, allows_delivery, payment_settings")
      .eq("id", vendor_id)
      .single();

    if (vendorError || !vendor) {
      return json({ error: "Negocio no encontrado" }, 404);
    }
    if (!vendor.is_active) {
      return json({ error: "El negocio no está disponible" }, 409);
    }

    if (delivery_type === "pickup" && vendor.allows_pickup === false) {
      return json({ error: "El negocio no acepta retiro en local" }, 409);
    }
    if (delivery_type === "delivery" && vendor.allows_delivery === false) {
      return json({ error: "El negocio no acepta delivery" }, 409);
    }

    // ── Productos: recalcular precio/stock desde la DB (no confiar en el cliente) ──
    const productIds = items.map((i) => i.product_id);
    const { data: products, error: productsError } = await supabase
      .from("products")
      .select("id, name, price, vendor_id, stock_enabled, stock_quantity")
      .in("id", productIds);

    if (productsError || !products) {
      return json({ error: "Error validando productos" }, 500);
    }

    const productMap = new Map(products.map((p) => [p.id, p]));
    const stockIssues: string[] = [];
    const orderItems: Array<{ product_id: string; product_name: string; quantity: number; price: number }> = [];
    let subtotal = 0;

    for (const item of items) {
      const p = productMap.get(item.product_id);
      if (!p) {
        return json({ error: `Producto no encontrado: ${item.product_id}` }, 400);
      }
      if (p.vendor_id !== vendor_id) {
        return json({ error: "Hay productos de otro negocio en el carrito" }, 400);
      }
      const qty = Math.max(1, Math.floor(Number(item.quantity) || 0));
      if (p.stock_enabled) {
        const available = p.stock_quantity || 0;
        if (qty > available) {
          stockIssues.push(
            available <= 0 ? `${p.name}: sin stock` : `${p.name}: pediste ${qty}, hay ${available}`,
          );
          continue;
        }
      }
      const price = Number(p.price);
      subtotal += price * qty;
      orderItems.push({ product_id: p.id, product_name: p.name, quantity: qty, price });
    }

    if (stockIssues.length > 0) {
      return json({ error: "Problemas de stock", stock_issues: stockIssues }, 409);
    }
    if (orderItems.length === 0) {
      return json({ error: "El carrito está vacío" }, 400);
    }

    // ── Entrega y dirección ──
    let deliveryCost = 0;
    let address: string;
    if (delivery_type === "pickup") {
      address = `RETIRO EN LOCAL: ${vendor.address || "dirección no disponible"}`;
      deliveryCost = 0;
    } else {
      if (!body.address || body.address.trim() === "") {
        return json({ error: "Falta la dirección de entrega" }, 400);
      }
      address = body.address.trim();
      deliveryCost = Math.round(Number(vendor.delivery_fixed_price) || 0);
    }

    // ── Método de pago habilitado por el vendedor ──
    const pSettings = (vendor.payment_settings || {}) as Record<string, any>;
    let metodoValido = false;
    if (payment_method === "efectivo" && pSettings.efectivo === true) metodoValido = true;
    else if (payment_method === "transferencia" && pSettings.transferencia?.activo === true) metodoValido = true;
    else if (payment_method === "mercadopago" && pSettings.mercadoPago?.activo === true) metodoValido = true;

    if (!metodoValido) {
      return json({ error: `El negocio no acepta ${payment_method}` }, 409);
    }

    // ── Anti-duplicados: mismo usuario + vendor en los últimos 60s ──
    const { data: activeOrders } = await supabase
      .from("orders")
      .select("id, vendor_id, created_at")
      .eq("user_id", userId)
      .eq("vendor_id", vendor_id)
      .in("status", ["pending", "confirmed", "preparing"])
      .gte("created_at", new Date(Date.now() - 60000).toISOString())
      .order("created_at", { ascending: false });

    if (activeOrders && activeOrders.length > 0) {
      return json({ error: "Pedido duplicado reciente", order_id: activeOrders[0].id, duplicate: true }, 409);
    }

    // ── Crear el pedido ──
    const total = subtotal + deliveryCost;
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert({
        vendor_id,
        user_id: userId,
        customer_name: body.customer_name || customerPhone,
        customer_phone: customerPhone,
        items: orderItems,
        total,
        status: "pending",
        address,
        payment_method,
        address_is_manual: true,
        delivery_type,
        coordinates: body.coordinates ?? null,
      })
      .select()
      .single();

    if (orderError || !order) {
      console.error("Error creando pedido:", orderError);
      return json({ error: "No se pudo crear el pedido" }, 500);
    }

    // Registro de pago
    await supabase.from("order_payments").insert({
      order_id: order.id,
      payment_method_name: payment_method,
      amount: total,
      status: "pending",
    });

    // Vaciar el carrito del cliente
    await supabase.from("carts").delete().eq("user_id", userId);

    // Notificar al vendedor
    try {
      await supabase.functions.invoke("notify-vendor", {
        body: { orderId: order.id, eventType: "new_order" },
      });
    } catch (e) {
      console.error("Error notificando al vendedor:", e);
    }

    // ── Respuesta según método de pago ──
    const result: Record<string, unknown> = {
      success: true,
      order_id: order.id,
      total,
      subtotal,
      delivery_cost: deliveryCost,
      delivery_type,
      payment_method,
    };

    if (payment_method === "transferencia") {
      const tr = pSettings.transferencia || {};
      result.transfer_data = { alias: tr.alias, cbu: tr.cbu, titular: tr.titular };
    } else if (payment_method === "mercadopago") {
      try {
        const { data: paymentData, error: paymentError } = await supabase.functions.invoke(
          "generate-payment-link",
          { body: { orderId: order.id } },
        );
        if (!paymentError && paymentData?.success && paymentData?.payment_link) {
          result.payment_link = paymentData.payment_link;
        } else {
          result.payment_link_error = true;
        }
      } catch (e) {
        console.error("Error generando link MP:", e);
        result.payment_link_error = true;
      }
    }

    return json(result, 201);
  } catch (e) {
    console.error("crear-pedido error:", e);
    return json({ error: "Error interno" }, 500);
  }
});
