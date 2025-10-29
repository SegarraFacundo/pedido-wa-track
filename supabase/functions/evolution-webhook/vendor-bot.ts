import OpenAI from "https://esm.sh/openai@4.77.3";

// ==================== UTILIDADES ====================

function normalizeArgentinePhone(phone: string): string {
  let cleaned = phone.replace(/@s\.whatsapp\.net$/i, '');
  cleaned = cleaned.replace(/[\s\-\(\)\+]/g, '');
  cleaned = cleaned.replace(/[^\d]/g, '');
  
  if (cleaned.startsWith('549') && cleaned.length === 13) return cleaned;
  if (cleaned.startsWith('54') && !cleaned.startsWith('549') && cleaned.length === 12) {
    return '549' + cleaned.substring(2);
  }
  if (cleaned.startsWith('9') && cleaned.length === 11) return '54' + cleaned;
  if (!cleaned.startsWith('54') && cleaned.length === 10) return '549' + cleaned;
  if (cleaned.length > 13) return normalizeArgentinePhone(cleaned.slice(-13));
  
  return cleaned;
}

// ==================== INTERFACES ====================

interface CartItem {
  product_id: string;
  product_name: string;
  quantity: number;
  price: number;
}

interface ConversationContext {
  phone: string;
  cart: CartItem[];
  selected_vendor_id?: string;
  selected_vendor_name?: string;
  delivery_address?: string;
  payment_method?: string;
  payment_receipt_url?: string;
  pending_order_id?: string;
  conversation_history: Array<{role: "user" | "assistant" | "system"; content: string}>;
}

// ==================== GESTIÓN DE CONTEXTO ====================

async function getContext(phone: string, supabase: any): Promise<ConversationContext> {
  const { data } = await supabase
    .from('user_sessions')
    .select('*')
    .eq('phone', phone)
    .maybeSingle();

  if (data?.last_bot_message) {
    try {
      const saved = JSON.parse(data.last_bot_message);
      return {
        phone,
        cart: saved.cart || [],
        selected_vendor_id: saved.selected_vendor_id,
        selected_vendor_name: saved.selected_vendor_name,
        delivery_address: saved.delivery_address,
        payment_method: saved.payment_method,
        payment_receipt_url: saved.payment_receipt_url,
        pending_order_id: saved.pending_order_id,
        conversation_history: saved.conversation_history || []
      };
    } catch (e) {
      console.error('Error parsing context:', e);
    }
  }

  return {
    phone,
    cart: [],
    conversation_history: []
  };
}

async function saveContext(context: ConversationContext, supabase: any): Promise<void> {
  // Mantener solo últimas 20 interacciones para no saturar
  if (context.conversation_history.length > 20) {
    context.conversation_history = context.conversation_history.slice(-20);
  }

  await supabase
    .from('user_sessions')
    .upsert({
      phone: context.phone,
      previous_state: 'AI_CONVERSATION',
      last_bot_message: JSON.stringify({
        cart: context.cart,
        selected_vendor_id: context.selected_vendor_id,
        selected_vendor_name: context.selected_vendor_name,
        delivery_address: context.delivery_address,
        payment_method: context.payment_method,
        payment_receipt_url: context.payment_receipt_url,
        pending_order_id: context.pending_order_id,
        conversation_history: context.conversation_history
      }),
      updated_at: new Date().toISOString()
    }, { onConflict: 'phone' });
}

// ==================== DEFINICIÓN DE HERRAMIENTAS ====================

const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "buscar_productos",
      description: "Busca productos y negocios disponibles que coincidan con la consulta del cliente. Usa esto cuando el cliente busque un tipo de comida o producto.",
      parameters: {
        type: "object",
        properties: {
          consulta: {
            type: "string",
            description: "Término de búsqueda (ej: 'pizza', 'hamburguesa', 'helado')"
          }
        },
        required: ["consulta"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "ver_locales_abiertos",
      description: "Muestra todos los negocios que están actualmente abiertos según sus horarios de operación. Usa esto cuando el cliente quiera ver qué locales están disponibles ahora.",
      parameters: {
        type: "object",
        properties: {
          categoria: {
            type: "string",
            description: "Categoría opcional para filtrar (ej: 'restaurant', 'pharmacy', 'market'). Si no se especifica, muestra todos."
          }
        },
        required: []
      }
    }
  },
  {
    type: "function",
    function: {
      name: "ver_menu_negocio",
      description: "Obtiene el menú completo de un negocio específico con todos sus productos y precios",
      parameters: {
        type: "object",
        properties: {
          vendor_id: {
            type: "string",
            description: "ID del negocio"
          }
        },
        required: ["vendor_id"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "agregar_al_carrito",
      description: "Agrega uno o más productos al carrito del cliente. IMPORTANTE: Si el cliente pide productos de un negocio diferente al actual, primero notificale que se vaciará el carrito anterior.",
      parameters: {
        type: "object",
        properties: {
          vendor_id: {
            type: "string",
            description: "ID del negocio del que son los productos"
          },
          items: {
            type: "array",
            items: {
              type: "object",
              properties: {
                product_id: { type: "string" },
                product_name: { type: "string" },
                quantity: { type: "number" },
                price: { type: "number" }
              },
              required: ["product_id", "product_name", "quantity", "price"]
            }
          }
        },
        required: ["vendor_id", "items"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "ver_carrito",
      description: "Muestra el contenido actual del carrito con totales"
    }
  },
  {
    type: "function",
    function: {
      name: "vaciar_carrito",
      description: "Elimina todos los productos del carrito"
    }
  },
  {
    type: "function",
    function: {
      name: "quitar_producto_carrito",
      description: "Quita un producto específico del carrito",
      parameters: {
        type: "object",
        properties: {
          product_id: {
            type: "string",
            description: "ID del producto a quitar"
          }
        },
        required: ["product_id"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "crear_pedido",
      description: "Crea el pedido final con dirección y método de pago. Solo usar cuando el cliente confirme todo.",
      parameters: {
        type: "object",
        properties: {
          direccion: {
            type: "string",
            description: "Dirección de entrega completa"
          },
          metodo_pago: {
            type: "string",
            enum: ["efectivo", "transferencia", "mercadopago"],
            description: "Método de pago elegido"
          }
        },
        required: ["direccion", "metodo_pago"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "ver_estado_pedido",
      description: "Consulta el estado actual de un pedido",
      parameters: {
        type: "object",
        properties: {
          order_id: {
            type: "string",
            description: "ID del pedido a consultar"
          }
        },
        required: ["order_id"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "ver_ofertas",
      description: "Muestra las ofertas y promociones activas. Opcionalmente filtrar por negocio específico.",
      parameters: {
        type: "object",
        properties: {
          vendor_id: {
            type: "string",
            description: "ID del negocio (opcional). Si no se especifica, muestra todas las ofertas activas."
          }
        },
        required: []
      }
    }
  },
  {
    type: "function",
    function: {
      name: "cancelar_pedido",
      description: "Cancela un pedido. SIEMPRE requerir y registrar el motivo de cancelación.",
      parameters: {
        type: "object",
        properties: {
          order_id: {
            type: "string",
            description: "ID del pedido a cancelar"
          },
          motivo: {
            type: "string",
            description: "Motivo detallado de la cancelación (OBLIGATORIO)"
          }
        },
        required: ["order_id", "motivo"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "hablar_con_vendedor",
      description: "Permite al cliente hablar directamente con el vendedor, cortando la interacción con el bot.",
      parameters: {
        type: "object",
        properties: {
          order_id: {
            type: "string",
            description: "ID del pedido relacionado (opcional)"
          }
        },
        required: []
      }
    }
  },
  {
    type: "function",
    function: {
      name: "crear_ticket_soporte",
      description: "Crea un ticket de soporte para problemas técnicos o consultas que el bot no puede resolver.",
      parameters: {
        type: "object",
        properties: {
          asunto: {
            type: "string",
            description: "Asunto o título del problema"
          },
          descripcion: {
            type: "string",
            description: "Descripción detallada del problema"
          },
          prioridad: {
            type: "string",
            enum: ["baja", "normal", "alta", "urgente"],
            description: "Nivel de prioridad del ticket"
          }
        },
        required: ["asunto", "descripcion"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "mostrar_menu_ayuda",
      description: "Muestra un menú con todas las opciones y funcionalidades disponibles para el cliente. Usa esto cuando el cliente pida ayuda o quiera saber qué puede hacer."
    }
  }
];

// ==================== EJECUTORES DE HERRAMIENTAS ====================

async function ejecutarHerramienta(
  toolName: string,
  args: any,
  context: ConversationContext,
  supabase: any
): Promise<string> {
  console.log(`Ejecutando herramienta: ${toolName}`, args);

  try {
    switch (toolName) {
      case "buscar_productos": {
        const { data, error } = await supabase.functions.invoke('search-products', {
          body: { searchQuery: args.consulta }
        });

        console.log('Search products result:', JSON.stringify(data, null, 2));

        if (error || !data?.found) {
          return `No encontré negocios abiertos con "${args.consulta}". Podés buscar otra cosa.`;
        }

        // Formatear resultados para la IA (ahora agrupados por vendor)
        let resultado = `Encontré ${data.totalVendors} negocios con ${data.totalProducts} productos:\n\n`;
        data.results.forEach((r: any, i: number) => {
          resultado += `${i + 1}. ${r.vendor.name}\n`;
          resultado += `   ID: ${r.vendor.id}\n`;
          resultado += `   Rating: ${r.vendor.average_rating || 'N/A'}⭐\n`;
          resultado += `   Productos disponibles:\n`;
          r.products.forEach((p: any, j: number) => {
            resultado += `     ${j + 1}. ${p.name} - $${p.price}\n`;
            resultado += `        ID: ${p.id}\n`;
          });
          resultado += `\n`;
        });

        return resultado;
      }

      case "ver_locales_abiertos": {
        // Obtener hora actual en Argentina
        const now = new Date();
        const argentinaTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/Argentina/Buenos_Aires' }));
        const currentDay = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][argentinaTime.getDay()];
        const currentTime = argentinaTime.toTimeString().slice(0, 5); // HH:MM formato

        console.log(`🕒 Buscando locales abiertos - Día: ${currentDay}, Hora: ${currentTime}`);

        // Construir query
        let query = supabase
          .from('vendors')
          .select('id, name, category, address, opening_time, closing_time, days_open, average_rating, total_reviews')
          .eq('is_active', true)
          .eq('payment_status', 'active');

        // Filtrar por categoría si se especifica
        if (args.categoria) {
          query = query.eq('category', args.categoria);
        }

        const { data: vendors, error } = await query;

        if (error || !vendors || vendors.length === 0) {
          return args.categoria 
            ? `No encontré negocios de tipo "${args.categoria}" disponibles.`
            : 'No hay negocios disponibles en este momento.';
        }

        // Filtrar locales que están abiertos ahora
        const openVendors = vendors.filter(vendor => {
          // Verificar si el día actual está en los días abiertos
          if (!vendor.days_open || !vendor.days_open.includes(currentDay)) {
            return false;
          }

          // Verificar horario
          if (!vendor.opening_time || !vendor.closing_time) {
            return false;
          }

          // Comparar horarios
          return currentTime >= vendor.opening_time && currentTime <= vendor.closing_time;
        });

        if (openVendors.length === 0) {
          return args.categoria
            ? `No hay negocios de tipo "${args.categoria}" abiertos en este momento. 😔`
            : 'No hay negocios abiertos en este momento. 😔';
        }

        // Formatear resultados
        let resultado = `🟢 Encontré ${openVendors.length} ${openVendors.length === 1 ? 'negocio abierto' : 'negocios abiertos'}:\n\n`;
        openVendors.forEach((v: any, i: number) => {
          resultado += `${i + 1}. ${v.name} (${v.category})\n`;
          resultado += `   ID: ${v.id}\n`;
          resultado += `   📍 ${v.address}\n`;
          resultado += `   ⏰ Horario: ${v.opening_time} - ${v.closing_time}\n`;
          if (v.average_rating) {
            resultado += `   ⭐ Rating: ${v.average_rating} (${v.total_reviews || 0} reseñas)\n`;
          }
          resultado += `\n`;
        });

        return resultado;
      }

      case "ver_menu_negocio": {
        console.log(`🔍 ver_menu_negocio called with vendor_id: "${args.vendor_id}"`);
        
        // Primero intentar obtener el vendor (puede ser por ID o por nombre)
        let vendorId = args.vendor_id;
        let vendor: any = null;

        // Si parece un UUID, buscar directamente
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (uuidRegex.test(args.vendor_id)) {
          console.log(`✅ Detected UUID format, searching by ID`);
          const { data, error: vendorError } = await supabase
            .from('vendors')
            .select('id, name')
            .eq('id', args.vendor_id)
            .maybeSingle();
          
          if (vendorError) console.error('Error fetching vendor by ID:', vendorError);
          vendor = data;
          console.log(`Vendor found by ID:`, vendor);
        } else {
          // Si no es UUID, buscar por nombre (case insensitive)
          // Limpiar el input: convertir guiones a espacios, remover caracteres especiales
          const cleanedName = args.vendor_id
            .replace(/-/g, ' ')  // guiones a espacios
            .replace(/_/g, ' ')  // guiones bajos a espacios
            .trim();
          
          console.log(`🔤 Not UUID, searching by name. Original: "${args.vendor_id}", Cleaned: "${cleanedName}"`);
          
          const { data, error: vendorError } = await supabase
            .from('vendors')
            .select('id, name')
            .ilike('name', `%${cleanedName}%`)
            .maybeSingle();
          
          if (vendorError) console.error('Error fetching vendor by name:', vendorError);
          vendor = data;
          console.log(`Vendor found by name:`, vendor);
          if (vendor) vendorId = vendor.id;
        }

        if (!vendor) {
          console.log(`❌ Vendor not found for: "${args.vendor_id}"`);
          return 'No encontré ese negocio. Por favor usa el ID exacto que te mostré en la lista de locales abiertos.';
        }

        console.log(`✅ Using vendor_id: ${vendorId} (${vendor.name})`);

        // Ahora buscar productos con el vendor_id correcto
        const { data: products, error } = await supabase
          .from('products')
          .select('*')
          .eq('vendor_id', vendorId)
          .eq('is_available', true);

        console.log(`📦 Products query result:`, { count: products?.length || 0, error, vendorId });

        if (error || !products || products.length === 0) {
          console.log(`❌ No products found for vendor ${vendorId}`);
          return `No encontré productos disponibles para "${vendor.name}" en este momento.`;
        }

        // Guardar vendor seleccionado
        context.selected_vendor_id = vendorId;
        context.selected_vendor_name = vendor.name;
        
        console.log(`✅ Found ${products.length} products for ${vendor.name}`);

        let menu = `📋 *Menú de ${vendor.name}*\n\n`;
        products.forEach((p: any, i: number) => {
          menu += `${i + 1}. *${p.name}* - $${p.price}\n`;
          menu += `   ID: ${p.id}\n`;
          if (p.description) menu += `   📝 ${p.description}\n`;
          if (p.image) menu += `   🖼️ ${p.image}\n`;
          menu += `\n`;
        });
        
        // Mostrar ofertas del negocio si hay
        const { data: offers } = await supabase
          .from('vendor_offers')
          .select('*')
          .eq('vendor_id', vendorId)
          .eq('is_active', true)
          .gte('valid_until', new Date().toISOString());
        
        if (offers && offers.length > 0) {
          menu += `\n🎁 *Ofertas especiales:*\n\n`;
          offers.forEach((offer: any, i: number) => {
            menu += `${i + 1}. ${offer.title}\n`;
            menu += `   📝 ${offer.description}\n`;
            if (offer.discount_percentage) menu += `   💰 ${offer.discount_percentage}% OFF\n`;
            if (offer.original_price && offer.offer_price) {
              menu += `   💵 Antes: $${offer.original_price} → Ahora: $${offer.offer_price}\n`;
            }
            menu += `\n`;
          });
        }

        return menu;
      }

      case "agregar_al_carrito": {
        const items = args.items as CartItem[];
        
        // Si hay items en el carrito pero son de otro negocio, vaciar el carrito
        if (context.cart.length > 0 && context.selected_vendor_id && args.vendor_id !== context.selected_vendor_id) {
          context.cart = [];
          console.log('🗑️ Carrito vaciado porque cambiaste de negocio');
        }
        
        // CRITICAL: Actualizar el vendor seleccionado cuando se agrega al carrito
        if (args.vendor_id) {
          context.selected_vendor_id = args.vendor_id;
          
          // Obtener nombre del vendor si no lo tenemos
          if (!context.selected_vendor_name || context.selected_vendor_id !== args.vendor_id) {
            const { data: vendor } = await supabase
              .from('vendors')
              .select('name')
              .eq('id', args.vendor_id)
              .single();
            if (vendor) context.selected_vendor_name = vendor.name;
          }
        }
        
        items.forEach(item => {
          const existing = context.cart.find(c => c.product_id === item.product_id);
          if (existing) {
            existing.quantity += item.quantity;
          } else {
            context.cart.push(item);
          }
        });

        const total = context.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        return `✅ Agregado al carrito. Total actual: $${total}`;
      }

      case "ver_carrito": {
        if (context.cart.length === 0) {
          return 'El carrito está vacío.';
        }

        let carrito = '🛒 Tu carrito:\n\n';
        context.cart.forEach((item, i) => {
          carrito += `${i + 1}. ${item.product_name} x${item.quantity} - $${item.price * item.quantity}\n`;
        });

        const total = context.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        carrito += `\n💰 Total: $${total}`;

        return carrito;
      }

      case "vaciar_carrito": {
        context.cart = [];
        return '🗑️ Carrito vaciado';
      }

      case "quitar_producto_carrito": {
        const index = context.cart.findIndex(item => item.product_id === args.product_id);
        if (index !== -1) {
          const removed = context.cart.splice(index, 1)[0];
          return `Quité ${removed.product_name} del carrito`;
        }
        return 'Producto no encontrado en el carrito';
      }

      case "crear_pedido": {
        if (context.cart.length === 0) {
          return 'No podés crear un pedido con el carrito vacío';
        }

        if (!context.selected_vendor_id) {
          return 'Error: No hay negocio seleccionado';
        }

        context.delivery_address = args.direccion;
        context.payment_method = args.metodo_pago;

        const total = context.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

        const { data: order, error } = await supabase
          .from('orders')
          .insert({
            vendor_id: context.selected_vendor_id,
            customer_name: context.phone, // Usar teléfono como nombre por defecto
            customer_phone: context.phone,
            items: context.cart,
            total,
            status: 'pending',
            address: context.delivery_address,
            payment_method: context.payment_method
          })
          .select()
          .single();

        if (error) {
          console.error('Error creating order:', error);
          return 'Hubo un error al crear el pedido. Intentá de nuevo.';
        }

        context.pending_order_id = order.id;
        
        let confirmacion = `✅ ¡Pedido creado exitosamente!\n\n`;
        confirmacion += `📦 Pedido #${order.id.substring(0, 8)}\n`;
        confirmacion += `🏪 Negocio: ${context.selected_vendor_name}\n`;
        confirmacion += `💰 Total: $${total}\n`;
        confirmacion += `📍 Dirección: ${context.delivery_address}\n`;
        confirmacion += `💳 Pago: ${context.payment_method}\n\n`;

        if (context.payment_method === 'transferencia') {
          confirmacion += `Por favor enviá el comprobante de pago para confirmar el pedido.`;
        }

        // Limpiar carrito después de crear pedido
        context.cart = [];

        return confirmacion;
      }

      case "ver_estado_pedido": {
        const { data: order, error } = await supabase
          .from('orders')
          .select('*, vendors(name)')
          .eq('id', args.order_id)
          .single();

        if (error || !order) {
          return 'No encontré ese pedido';
        }

        const statusEmojis: any = {
          'pending': '⏳ Pendiente',
          'confirmed': '✅ Confirmado',
          'preparing': '👨‍🍳 En preparación',
          'ready': '🎉 Listo para entregar',
          'delivered': '✅ Entregado',
          'cancelled': '❌ Cancelado'
        };

        let estado = `📦 Estado del pedido #${order.id.substring(0, 8)}\n\n`;
        estado += `🏪 Negocio: ${order.vendors.name}\n`;
        estado += `📊 Estado: ${statusEmojis[order.status] || order.status}\n`;
        estado += `💰 Total: $${order.total}\n`;

        return estado;
      }

      
      case "ver_ofertas": {
        const nowIso: string = new Date().toISOString();
      
        let query = supabase
          .from('vendor_offers')
          .select('*, vendors(id, name, category)')
          .eq('is_active', true)
          .lte('valid_from', nowIso)
          .or(`valid_until.gte.${nowIso},valid_until.is.null`);

        // Filtrar por vendor si se especifica
        if (args.vendor_id) {
          query = query.eq('vendor_id', args.vendor_id);
        }

        const { data: offers, error } = await query;

        if (error || !offers || offers.length === 0) {
          return args.vendor_id
            ? 'Este negocio no tiene ofertas activas en este momento.'
            : 'No hay ofertas disponibles en este momento. 😔';
        }

        let resultado = `🎁 ${offers.length === 1 ? 'Oferta disponible' : `${offers.length} ofertas disponibles`}:\n\n`;
        
        offers.forEach((offer: any, i: number) => {
          resultado += `${i + 1}. ${offer.title}\n`;
          resultado += `   🏪 ${offer.vendors.name}\n`;
          resultado += `   📝 ${offer.description}\n`;
          
          if (offer.discount_percentage) {
            resultado += `   💰 ${offer.discount_percentage}% OFF\n`;
          }
          if (offer.original_price && offer.offer_price) {
            resultado += `   💵 Antes: $${offer.original_price} → Ahora: $${offer.offer_price}\n`;
          }
          
          const validUntil = new Date(offer.valid_until);
          resultado += `   ⏰ Válido hasta: ${validUntil.toLocaleDateString('es-AR')}\n`;
          resultado += `   ID Negocio: ${offer.vendor_id}\n`;
          resultado += `\n`;
        });

        return resultado;
      }

      case "cancelar_pedido": {
        if (!args.motivo || args.motivo.trim().length < 10) {
          return 'Por favor proporciona un motivo detallado para la cancelación (mínimo 10 caracteres).';
        }

        const { data: order, error: fetchError } = await supabase
          .from('orders')
          .select('*')
          .eq('id', args.order_id)
          .single();

        if (fetchError || !order) {
          return 'No encontré ese pedido.';
        }

        if (order.status === 'cancelled') {
          return 'Este pedido ya está cancelado.';
        }

        if (['delivered', 'ready'].includes(order.status)) {
          return 'No se puede cancelar un pedido que ya está listo o entregado. Contacta con soporte si necesitas ayuda.';
        }

        const { error: updateError } = await supabase
          .from('orders')
          .update({ status: 'cancelled' })
          .eq('id', args.order_id);

        if (updateError) {
          return 'Hubo un error al cancelar el pedido. Intenta de nuevo.';
        }

        // Registrar historial
        await supabase
          .from('order_status_history')
          .insert({
            order_id: args.order_id,
            status: 'cancelled',
            changed_by: 'customer',
            reason: args.motivo
          });

        return `✅ Pedido #${args.order_id.substring(0, 8)} cancelado.\n📝 Motivo: ${args.motivo}\n\nEl vendedor ha sido notificado.`;
      }

      case "hablar_con_vendedor": {
        // Marcar sesión como en chat directo con vendedor
        const { error } = await supabase
          .from('user_sessions')
          .update({ 
            in_vendor_chat: true,
            updated_at: new Date().toISOString()
          })
          .eq('phone', context.phone);

        if (error) {
          console.error('Error updating session:', error);
        }

        let mensaje = '👤 *Conectando con el vendedor*\n\n';
        mensaje += 'Un representante humano te atenderá en breve. Los mensajes que envíes ahora irán directamente al vendedor.\n\n';
        mensaje += 'Para volver al bot automático, el vendedor puede reactivarlo desde su panel.';
        
        return mensaje;
      }

      case "crear_ticket_soporte": {
        const prioridad = args.prioridad || 'normal';
        
        const { data: ticket, error } = await supabase
          .from('support_tickets')
          .insert({
            customer_phone: context.phone,
            customer_name: context.phone,
            subject: args.asunto,
            priority: prioridad === 'baja' ? 'low' : prioridad === 'alta' ? 'high' : prioridad === 'urgente' ? 'urgent' : 'normal',
            status: 'open'
          })
          .select()
          .single();

        if (error) {
          console.error('Error creating ticket:', error);
          return 'Hubo un error al crear el ticket. Intenta de nuevo o contacta directamente con soporte.';
        }

        // Crear mensaje inicial en el ticket
        await supabase
          .from('support_messages')
          .insert({
            ticket_id: ticket.id,
            sender_type: 'customer',
            message: args.descripcion
          });

        return `✅ *Ticket de soporte creado*\n\n📋 ID: #${ticket.id.substring(0, 8)}\n🏷️ Asunto: ${args.asunto}\n⚡ Prioridad: ${prioridad}\n\nNuestro equipo de soporte te contactará pronto. Recibirás actualizaciones por WhatsApp.`;
      }

      case "mostrar_menu_ayuda": {
        return `🤖 *MENÚ DE AYUDA - LAPACHO DELIVERY*

¿Qué podés hacer?

🔍 *BUSCAR Y PEDIR*
• Buscar productos (ej: "Quiero pizza")
• Ver locales abiertos ahora
• Ver ofertas y promociones
• Ver el menú de un negocio
• Hacer un pedido

🛒 *MI CARRITO*
• Ver mi carrito actual
• Agregar productos al carrito
• Quitar productos del carrito
• Vaciar el carrito

📦 *MIS PEDIDOS*
• Ver el estado de mi pedido
• Cancelar un pedido

💬 *SOPORTE*
• Hablar con un vendedor
• Crear un ticket de soporte

Escribí lo que necesites y te ayudo. ¡Es muy fácil! 😊`;
      }

      default:
        return `Herramienta ${toolName} no implementada`;
    }
  } catch (error) {
    console.error(`Error ejecutando ${toolName}:`, error);
    return `Error al ejecutar ${toolName}: ${error.message}`;
  }
}

// ==================== AGENTE PRINCIPAL ====================

export async function handleVendorBot(
  message: string,
  phone: string,
  supabase: any
): Promise<string> {
  const normalizedPhone = normalizeArgentinePhone(phone);
  console.log('🤖 AI Bot START - Phone:', normalizedPhone, 'Message:', message);

  try {
    // Cargar contexto
    const context = await getContext(normalizedPhone, supabase);
    console.log('📋 Context loaded:', {
      phone: context.phone,
      cartItems: context.cart.length,
      vendor: context.selected_vendor_name,
      historyLength: context.conversation_history.length
    });

    // Agregar mensaje del usuario al historial
    context.conversation_history.push({
      role: "user",
      content: message
    });

    // Inicializar OpenAI
    const openai = new OpenAI({
      apiKey: Deno.env.get("OPENAI_API_KEY")
    });

    // Prompt del sistema
    const systemPrompt = `Sos un vendedor de Lapacho, una plataforma de delivery por WhatsApp en Argentina.

Tu trabajo es ayudar a los clientes a hacer pedidos de forma natural y amigable.

INFORMACIÓN DEL CONTEXTO:
${context.selected_vendor_name ? `- Negocio actual: ${context.selected_vendor_name}` : ''}
${context.cart.length > 0 ? `- Carrito: ${context.cart.map(i => `${i.quantity}x ${i.product_name} ($${i.price})`).join(', ')} - Total: $${context.cart.reduce((s, i) => s + (i.price * i.quantity), 0)}` : '- Carrito vacío'}
${context.delivery_address ? `- Dirección: ${context.delivery_address}` : ''}
${context.payment_method ? `- Método de pago: ${context.payment_method}` : ''}
${context.pending_order_id ? `- Pedido pendiente: ${context.pending_order_id}` : ''}

REGLAS IMPORTANTES:
1. Hablá en argentino informal pero respetuoso (vos, querés, podés, etc)
2. Usá emojis para hacer la conversación más amigable
3. Sé breve y directo - máximo 4 líneas por mensaje
4. NUNCA inventes información sobre productos, precios o negocios
5. Si no sabés algo, decilo y preguntá
6. Cuando el cliente busque algo, usá la herramienta buscar_productos
7. Cuando el cliente quiera ver un menú completo, usá ver_menu_negocio
8. Cuando el cliente quiera agregar algo al carrito, usá agregar_al_carrito
9. Solo creá el pedido cuando el cliente CONFIRME explícitamente que quiere finalizar
10. Si el cliente pregunta por el estado de un pedido, usá ver_estado_pedido
11. Si el cliente pide ayuda o pregunta qué puede hacer, usá mostrar_menu_ayuda

FLUJO TÍPICO:
1. Cliente busca algo (pizza, hamburguesa, etc) → buscar_productos
2. Mostrás resultados y preguntás si quiere ver el menú de algún negocio
3. Cliente elige negocio → ver_menu_negocio
4. Cliente elige productos → agregar_al_carrito
5. Cuando el cliente quiera finalizar, preguntás dirección y forma de pago
6. Con toda la info confirmada → crear_pedido

IMPORTANTE: Siempre confirmá antes de crear un pedido. Preguntá dirección y método de pago solo cuando el cliente esté listo para finalizar.`;

    // Preparar mensajes para la API
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: "system", content: systemPrompt },
      ...context.conversation_history.slice(-15) // Últimos 15 mensajes para no saturar
    ];

    console.log('🔄 Calling OpenAI with', messages.length, 'messages...');

    let continueLoop = true;
    let finalResponse = '';
    let iterationCount = 0;
    const MAX_ITERATIONS = 5; // Prevenir loops infinitos

    // Loop de conversación con tool calling
    while (continueLoop && iterationCount < MAX_ITERATIONS) {
      iterationCount++;
      console.log(`🔁 Iteration ${iterationCount}...`);

      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: messages,
        tools: tools,
        temperature: 0.7,
        max_tokens: 500
      });

      const assistantMessage = completion.choices[0].message;
      console.log('🤖 AI response:', {
        hasContent: !!assistantMessage.content,
        hasToolCalls: !!assistantMessage.tool_calls,
        toolCallsCount: assistantMessage.tool_calls?.length || 0
      });

      // Si hay tool calls, ejecutarlos
      if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
        messages.push(assistantMessage);

        for (const toolCall of assistantMessage.tool_calls) {
          const toolName = toolCall.function.name;
          const toolArgs = JSON.parse(toolCall.function.arguments);
          console.log(`🔧 Executing tool: ${toolName}`, toolArgs);

          const toolResult = await ejecutarHerramienta(toolName, toolArgs, context, supabase);
          console.log(`✅ Tool result preview:`, toolResult.slice(0, 100));

          messages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: toolResult
          });
        }

        // Continuar el loop para que la IA procese los resultados
        continue;
      }

      // Si no hay tool calls, es la respuesta final
      finalResponse = assistantMessage.content || 'Perdón, no entendí. ¿Podés repetir?';
      console.log('✅ Final response ready:', finalResponse.slice(0, 100));
      continueLoop = false;
    }

    if (iterationCount >= MAX_ITERATIONS) {
      console.warn('⚠️ Max iterations reached, forcing response');
      finalResponse = 'Disculpá, tuve un problema procesando tu mensaje. ¿Podés intentar de nuevo?';
    }

    // Agregar respuesta del asistente al historial
    context.conversation_history.push({
      role: "assistant",
      content: finalResponse
    });

    // Guardar contexto actualizado
    await saveContext(context, supabase);
    console.log('💾 Context saved successfully');

    console.log('🤖 AI Bot END - Returning response');
    return finalResponse;

  } catch (error) {
    console.error('❌ AI Bot ERROR:', error);
    console.error('Error details:', {
      name: error.name,
      message: error.message,
      stack: error.stack
    });
    return 'Disculpá, tuve un problema técnico. Por favor intentá de nuevo en un momento.';
  }
}
