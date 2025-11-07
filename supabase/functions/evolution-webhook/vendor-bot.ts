import OpenAI from "https://esm.sh/openai@4.77.3";

// ==================== UTILIDADES ====================

function normalizeArgentinePhone(phone: string): string {
  let cleaned = phone.replace(/@s\.whatsapp\.net$/i, "");
  cleaned = cleaned.replace(/[\s\-\(\)\+]/g, "");
  cleaned = cleaned.replace(/[^\d]/g, "");

  if (cleaned.startsWith("549") && cleaned.length === 13) return cleaned;
  if (cleaned.startsWith("54") && !cleaned.startsWith("549") && cleaned.length === 12) {
    return "549" + cleaned.substring(2);
  }
  if (cleaned.startsWith("9") && cleaned.length === 11) return "54" + cleaned;
  if (!cleaned.startsWith("54") && cleaned.length === 10) return "549" + cleaned;
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
  user_latitude?: number;
  user_longitude?: number;
  pending_location_decision?: boolean; // Nueva: indica si hay ubicación pendiente de decisión
  conversation_history: Array<{ role: "user" | "assistant" | "system"; content: string }>;
}

// ==================== GESTIÓN DE CONTEXTO ====================

async function getContext(phone: string, supabase: any): Promise<ConversationContext> {
  const { data } = await supabase.from("user_sessions").select("*").eq("phone", phone).maybeSingle();

  // Obtener ubicación del usuario si existe
  const userLatitude = data?.user_latitude;
  const userLongitude = data?.user_longitude;

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
        user_latitude: userLatitude,
        user_longitude: userLongitude,
        pending_location_decision: saved.pending_location_decision || false,
        conversation_history: saved.conversation_history || [],
      };
    } catch (e) {
      console.error("Error parsing context:", e);
    }
  }

  return {
    phone,
    cart: [],
    user_latitude: userLatitude,
    user_longitude: userLongitude,
    pending_location_decision: false,
    conversation_history: [],
  };
}

async function saveContext(context: ConversationContext, supabase: any): Promise<void> {
  // Mantener solo últimas 20 interacciones para no saturar
  if (context.conversation_history.length > 20) {
    context.conversation_history = context.conversation_history.slice(-20);
  }

  const contextData = {
    cart: context.cart,
    selected_vendor_id: context.selected_vendor_id,
    selected_vendor_name: context.selected_vendor_name,
    delivery_address: context.delivery_address,
    payment_method: context.payment_method,
    payment_receipt_url: context.payment_receipt_url,
    pending_order_id: context.pending_order_id,
    pending_location_decision: context.pending_location_decision || false,
    conversation_history: context.conversation_history,
  };

  console.log("💾 Saving context:", {
    phone: context.phone,
    cartItems: context.cart.length,
    cartPreview: context.cart.map((i) => `${i.product_name} x${i.quantity}`).join(", ") || "empty",
    vendorId: context.selected_vendor_id,
  });

  await supabase.from("user_sessions").upsert(
    {
      phone: context.phone,
      previous_state: "AI_CONVERSATION",
      last_bot_message: JSON.stringify(contextData),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "phone" },
  );
}

// ==================== DEFINICIÓN DE HERRAMIENTAS ====================

const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "buscar_productos",
      description:
        "Busca productos y negocios disponibles que coincidan con la consulta del cliente. Usa esto cuando el cliente busque un tipo de comida o producto.",
      parameters: {
        type: "object",
        properties: {
          consulta: {
            type: "string",
            description: "Término de búsqueda (ej: 'pizza', 'hamburguesa', 'helado')",
          },
        },
        required: ["consulta"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "ver_locales_abiertos",
      description:
        "Muestra la lista completa de negocios/locales disponibles. USA ESTA HERRAMIENTA cuando el cliente diga: 'mostrame los negocios', 'qué negocios hay', 'ver locales', 'locales disponibles', 'que locales hacen delivery', etc. Filtra por ubicación automáticamente si el usuario tiene coordenadas guardadas.",
      parameters: {
        type: "object",
        properties: {
          categoria: {
            type: "string",
            description:
              "Categoría opcional para filtrar (ej: 'restaurant', 'pharmacy', 'market'). Si no se especifica, muestra todos.",
          },
        },
        required: [],
      },
    },
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
            description: "ID del negocio",
          },
        },
        required: ["vendor_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "agregar_al_carrito",
      description:
        "Agrega uno o más productos al carrito del cliente. IMPORTANTE: Si el cliente pide productos de un negocio diferente al actual, primero notificale que se vaciará el carrito anterior.",
      parameters: {
        type: "object",
        properties: {
          vendor_id: {
            type: "string",
            description: "ID del negocio del que son los productos",
          },
          items: {
            type: "array",
            items: {
              type: "object",
              properties: {
                product_id: { type: "string" },
                product_name: { type: "string" },
                quantity: { type: "number" },
                price: { type: "number" },
              },
              required: ["product_id", "product_name", "quantity", "price"],
            },
          },
        },
        required: ["vendor_id", "items"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "ver_carrito",
      description: "Muestra el contenido actual del carrito con totales",
    },
  },
  {
    type: "function",
    function: {
      name: "vaciar_carrito",
      description: "Elimina todos los productos del carrito",
    },
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
            description: "ID del producto a quitar",
          },
        },
        required: ["product_id"],
      },
    },
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
            description: "Dirección de entrega completa",
          },
          metodo_pago: {
            type: "string",
            enum: ["efectivo", "transferencia", "mercadopago"],
            description: "Método de pago elegido",
          },
        },
        required: ["direccion", "metodo_pago"],
      },
    },
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
            description: "ID del pedido a consultar",
          },
        },
        required: ["order_id"],
      },
    },
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
            description: "ID del negocio (opcional). Si no se especifica, muestra todas las ofertas activas.",
          },
        },
        required: [],
      },
    },
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
            description: "ID del pedido a cancelar",
          },
          motivo: {
            type: "string",
            description: "Motivo detallado de la cancelación (OBLIGATORIO)",
          },
        },
        required: ["order_id", "motivo"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "hablar_con_vendedor",
      description:
        "Permite al cliente hablar directamente con el vendedor. Usa el negocio que el cliente tiene seleccionado en el contexto actual.",
      parameters: {
        type: "object",
        properties: {
          order_id: {
            type: "string",
            description: "ID del pedido relacionado (opcional)",
          },
        },
        required: [],
      },
    },
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
            description: "Asunto o título del problema",
          },
          descripcion: {
            type: "string",
            description: "Descripción detallada del problema",
          },
          prioridad: {
            type: "string",
            enum: ["baja", "normal", "alta", "urgente"],
            description: "Nivel de prioridad del ticket",
          },
        },
        required: ["asunto", "descripcion"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "mostrar_menu_ayuda",
      description:
        "Muestra un menú con todas las opciones y funcionalidades disponibles para el cliente. Usa esto cuando el cliente pida ayuda o quiera saber qué puede hacer.",
    },
  },
  {
    type: "function",
    function: {
      name: "registrar_calificacion",
      description:
        "Registra la calificación y opinión del cliente sobre su pedido. Permite calificar delivery, atención y producto por separado del 1 al 5, además de agregar comentarios opcionales.",
      parameters: {
        type: "object",
        properties: {
          delivery_rating: {
            type: "number",
            description: "Calificación del tiempo de entrega (1-5 estrellas). Opcional.",
          },
          service_rating: {
            type: "number",
            description: "Calificación de la atención del vendedor (1-5 estrellas). Opcional.",
          },
          product_rating: {
            type: "number",
            description: "Calificación de la calidad del producto (1-5 estrellas). Opcional.",
          },
          comment: {
            type: "string",
            description: "Comentario o observación adicional del cliente. Opcional.",
          },
          customer_name: {
            type: "string",
            description: "Nombre del cliente (opcional, si no se proporciona se usa el teléfono)",
          },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "guardar_direccion",
      description: "Guarda la ubicación actual del usuario con un nombre específico para usarla en futuros pedidos.",
      parameters: {
        type: "object",
        properties: {
          nombre: {
            type: "string",
            description: "Nombre para identificar la dirección (ej: 'Casa', 'Trabajo', 'Oficina')",
          },
        },
        required: ["nombre"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "usar_direccion_temporal",
      description:
        "Marca la ubicación actual como temporal. Se usará solo para este pedido y se eliminará automáticamente al finalizar.",
    },
  },
  {
    type: "function",
    function: {
      name: "listar_direcciones",
      description: "Muestra todas las direcciones guardadas por el cliente.",
    },
  },
  {
    type: "function",
    function: {
      name: "borrar_direccion",
      description: "Elimina una dirección guardada específica.",
      parameters: {
        type: "object",
        properties: {
          nombre: {
            type: "string",
            description: "Nombre de la dirección a borrar (ej: 'Casa')",
          },
        },
        required: ["nombre"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "renombrar_direccion",
      description: "Cambia el nombre de una dirección guardada.",
      parameters: {
        type: "object",
        properties: {
          nombre_viejo: {
            type: "string",
            description: "Nombre actual de la dirección",
          },
          nombre_nuevo: {
            type: "string",
            description: "Nuevo nombre para la dirección",
          },
        },
        required: ["nombre_viejo", "nombre_nuevo"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "usar_direccion_guardada",
      description: "Carga una dirección guardada para usarla en el pedido actual.",
      parameters: {
        type: "object",
        properties: {
          nombre: {
            type: "string",
            description: "Nombre de la dirección guardada (ej: 'Casa')",
          },
        },
        required: ["nombre"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "eliminar_todas_direcciones",
      description: "Elimina todas las direcciones guardadas del cliente.",
    },
  },
  {
    type: "function",
    function: {
      name: "agregar_direccion_manual",
      description:
        "Permite al cliente escribir su dirección manualmente cuando no puede compartir ubicación GPS. ⚠️ Esta dirección NO será validada para radio de entrega.",
      parameters: {
        type: "object",
        properties: {
          direccion_completa: {
            type: "string",
            description: "Dirección completa escrita por el cliente (calle, número, ciudad, referencias)",
          },
          nombre: {
            type: "string",
            description:
              "Nombre para guardar la dirección (ej: 'Casa', 'Trabajo'). Opcional - si no se proporciona, se usa como temporal.",
          },
        },
        required: ["direccion_completa"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "calcular_costo_delivery",
      description:
        "Calcula el costo de delivery desde el negocio actual hasta la ubicación del cliente. Usa esto cuando el cliente pregunte cuánto sale el delivery.",
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
    },
  },
];

// ==================== EJECUTORES DE HERRAMIENTAS ====================

async function ejecutarHerramienta(
  toolName: string,
  args: any,
  context: ConversationContext,
  supabase: any,
): Promise<string> {
  console.log(`🔧 [TOOL CALL] ${toolName}`, JSON.stringify(args, null, 2));
  console.log(`Ejecutando herramienta: ${toolName}`, args);

  try {
    switch (toolName) {
      case "buscar_productos": {
        // Si el usuario tiene ubicación, usar función de filtrado por radio
        if (context.user_latitude && context.user_longitude) {
          console.log(`📍 User has location, filtering by delivery radius`);

          // Primero obtener vendors en rango
          const { data: vendorsInRange, error: rangeError } = await supabase.rpc("get_vendors_in_range", {
            user_lat: context.user_latitude,
            user_lon: context.user_longitude,
          });

          if (rangeError) {
            console.error("Error getting vendors in range:", rangeError);
          }

          if (!vendorsInRange || vendorsInRange.length === 0) {
            return `😔 No encontré negocios que hagan delivery a tu ubicación con "${args.consulta}".\n\n💡 Tip: Si te moviste de zona, podés compartir tu nueva ubicación usando el botón 📍 de WhatsApp.`;
          }

          // Filtrar solo los vendor IDs que están en rango
          const vendorIdsInRange = vendorsInRange.map((v: any) => v.vendor_id);

          // Buscar productos solo en esos vendors
          const { data: searchResults, error: searchError } = await supabase.functions.invoke("search-products", {
            body: {
              searchQuery: args.consulta,
              vendorIds: vendorIdsInRange, // Filtrar por vendors en rango
            },
          });

          if (searchError || !searchResults?.found) {
            return `No encontré productos de "${args.consulta}" en negocios que lleguen a tu zona.\n\nPodés buscar otra cosa o ver todos los locales disponibles diciendo "ver locales".`;
          }

          // Formatear resultados con distancia
          let resultado = `Encontré ${searchResults.totalVendors} negocios cerca tuyo con ${searchResults.totalProducts} productos:\n\n`;
          searchResults.results.forEach((r: any, i: number) => {
            const vendorDistance = vendorsInRange.find((v: any) => v.vendor_id === r.vendor.id);
            resultado += `${i + 1}. ${r.vendor.name}`;
            if (vendorDistance) {
              resultado += ` (${vendorDistance.distance_km.toFixed(1)} km)`;
            }
            resultado += `\n`;
            resultado += `   ID: ${r.vendor.id}\n`;
            resultado += `   Rating: ${r.vendor.average_rating || "N/A"}⭐\n`;
            resultado += `   Productos disponibles:\n`;
            r.products.forEach((p: any, j: number) => {
              resultado += `     ${j + 1}. ${p.name} - $${p.price}\n`;
              resultado += `        ID: ${p.id}\n`;
            });
            resultado += `\n`;
          });

          return resultado;
        } else {
          // Sin ubicación, búsqueda normal pero informar al usuario
          const { data, error } = await supabase.functions.invoke("search-products", {
            body: { searchQuery: args.consulta },
          });

          console.log("Search products result:", JSON.stringify(data, null, 2));

          if (error || !data?.found) {
            return `No encontré negocios abiertos con "${args.consulta}".\n\n💡 Tip: Si compartís tu ubicación 📍, te puedo mostrar solo los negocios que hacen delivery a tu zona.`;
          }

          // Formatear resultados
          let resultado = `Encontré ${data.totalVendors} negocios con ${data.totalProducts} productos:\n\n⚠️ *Nota:* Sin tu ubicación, te muestro todos los negocios. Para ver solo los que te entregan, compartí tu ubicación 📍.\n\n`;
          data.results.forEach((r: any, i: number) => {
            resultado += `${i + 1}. ${r.vendor.name}\n`;
            resultado += `   ID: ${r.vendor.id}\n`;
            resultado += `   Rating: ${r.vendor.average_rating || "N/A"}⭐\n`;
            resultado += `   Productos disponibles:\n`;
            r.products.forEach((p: any, j: number) => {
              resultado += `     ${j + 1}. ${p.name} - $${p.price}\n`;
              resultado += `        ID: ${p.id}\n`;
            });
            resultado += `\n`;
          });

          return resultado;
        }
      }

      case "ver_locales_abiertos": {
        // 🕒 Hora local en Argentina
        const now = new Date();
        const argentinaTime = new Date(
          now.toLocaleString("en-US", { timeZone: "America/Argentina/Buenos_Aires" })
        );
        const currentDay = [
          "sunday",
          "monday",
          "tuesday",
          "wednesday",
          "thursday",
          "friday",
          "saturday",
        ][argentinaTime.getDay()];
        console.log(`🕐 Día actual: ${currentDay}`);

        // 📍 Comprobamos si el usuario tiene ubicación
        if (!context.user_latitude || !context.user_longitude) {
          return "📍 Para ver negocios cercanos, primero compartí tu ubicación.";
        }

        // 🔎 Pedimos la lista de negocios dentro del radio de entrega
        const { data: vendorsInRange, error } = await supabase.rpc(
          "get_vendors_in_range",
          {
            user_lat: context.user_latitude,
            user_lon: context.user_longitude,
          }
        );

        if (error) {
          console.error("Error get_vendors_in_range:", error);
          return "⚠️ Ocurrió un error al buscar negocios cercanos. Intentalo nuevamente.";
        }

        if (!vendorsInRange || vendorsInRange.length === 0) {
          return "😔 No hay negocios que hagan delivery a tu ubicación en este momento.";
        }

        // 📋 Obtenemos todos los vendor_id para consultar horarios
        const vendorIds = vendorsInRange.map((v: any) => v.vendor_id);
        const { data: vendorHours, error: hoursError } = await supabase
          .from("vendor_hours")
          .select(
            "vendor_id, day_of_week, opening_time, closing_time, is_closed, is_open_24_hours"
          )
          .in("vendor_id", vendorIds)
          .eq("day_of_week", currentDay);

        if (hoursError) console.error("Error obteniendo horarios:", hoursError);

        // 🔁 Creamos un mapa vendor_id → horarios
        const hoursMap = new Map();
        vendorHours?.forEach((h) => {
          if (!hoursMap.has(h.vendor_id)) hoursMap.set(h.vendor_id, []);
          hoursMap.get(h.vendor_id).push(h);
        });

        // 🟢 y 🔴 Separar abiertos y cerrados
        const openVendors = vendorsInRange.filter((v: any) => v.is_open);
        const closedVendors = vendorsInRange.filter((v: any) => !v.is_open);

        let resultado = "¡Aquí tenés los negocios abiertos que hacen delivery a tu zona! 🚗\n\n";

        // 🟢 ABIERTOS
        if (openVendors.length > 0) {
          resultado += `🟢 *ABIERTOS AHORA* (${openVendors.length}):\n\n`;
          openVendors.forEach((v: any, i: number) => {
            resultado += `${i + 1}. *${v.vendor_name}*\n`;

            // Dirección y distancia
            const { data: vendorInfo } = supabase
              .from("vendors")
              .select("address, average_rating, total_reviews, opening_time, closing_time")
              .eq("id", v.vendor_id)
              .maybeSingle();

            resultado += `📍 ${v.address || "Dirección no disponible"} - A ${v.distance_km.toFixed(
              1
            )} km\n`;
            resultado += `ID: ${v.vendor_id}\n`;

            // Mostrar horario real desde vendor_hours
            const todayHours = hoursMap.get(v.vendor_id);
            if (todayHours && todayHours.length > 0) {
              const slots = todayHours
                .filter((h: any) => !h.is_closed)
                .map((h: any) =>
                  h.is_open_24_hours
                    ? "24 hs"
                    : `${h.opening_time.slice(0, 5)} - ${h.closing_time.slice(0, 5)}`
                );
              resultado += `⏰ Horario: ${slots.join(", ")}\n`;
            } else {
              resultado += `⏰ Horario: No disponible\n`;
            }

            // Rating si existe
            if (v.average_rating && v.total_reviews)
              resultado += `⭐ Rating: ${v.average_rating.toFixed(1)} (${v.total_reviews} reseñas)\n`;

            resultado += `\n`;
          });
        }

        // 🔴 CERRADOS
        if (closedVendors.length > 0) {
          resultado += `🔴 *CERRADOS* (${closedVendors.length}):\n\n`;
          closedVendors.forEach((v: any, i: number) => {
            resultado += `${i + 1}. *${v.vendor_name}* 🔒\n`;

            const { data: vendorInfo } = supabase
              .from("vendors")
              .select("address, average_rating, total_reviews, opening_time, closing_time")
              .eq("id", v.vendor_id)
              .maybeSingle();

            resultado += `📍 ${v.address || "Dirección no disponible"} - A ${v.distance_km.toFixed(
              1
            )} km\n`;
            resultado += `ID: ${v.vendor_id}\n`;

            // Mostrar horario real
            const todayHours = hoursMap.get(v.vendor_id);
            if (todayHours && todayHours.length > 0) {
              const slots = todayHours
                .filter((h: any) => !h.is_closed)
                .map((h: any) =>
                  h.is_open_24_hours
                    ? "24 hs"
                    : `${h.opening_time.slice(0, 5)} - ${h.closing_time.slice(0, 5)}`
                );
              resultado += `⏰ Horario: ${slots.join(", ")}\n`;
            } else {
              resultado += `⏰ Horario: No disponible\n`;
            }

            // Rating si existe
            if (v.average_rating && v.total_reviews)
              resultado += `⭐ Rating: ${v.average_rating.toFixed(1)} (${v.total_reviews} reseñas)\n`;

            resultado += `\n`;
          });
        }

        resultado +=
          "\n💬 Si querés hacer un pedido, decime el nombre o ID del negocio y qué te gustaría pedir. 😊";

        return resultado;
      }


      case "ver_menu_negocio": {
        console.log(`🔍 ver_menu_negocio called with vendor_id: "${args.vendor_id}"`);

        // 🔄 Limpiar contexto si el usuario cambia de negocio
        if (context.selected_vendor_id && context.selected_vendor_id !== args.vendor_id) {
          console.log("🔄 Nuevo negocio seleccionado, limpiando carrito y contexto anterior...");
          context.cart = [];
          context.selected_vendor_id = undefined;
          context.selected_vendor_name = undefined;
        }

        // Buscar vendor (por ID o nombre)
        let vendorId = args.vendor_id;
        let vendor: any = null;

        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (uuidRegex.test(args.vendor_id)) {
          const { data } = await supabase.from("vendors").select("id, name").eq("id", args.vendor_id).maybeSingle();
          vendor = data;
        } else {
          const cleanedName = args.vendor_id.replace(/[-_]/g, " ").trim();
          const { data } = await supabase
            .from("vendors")
            .select("id, name")
            .ilike("name", `%${cleanedName}%`)
            .maybeSingle();
          vendor = data;
          if (vendor) vendorId = vendor.id;
        }

        if (!vendor) {
          return "No encontré ese negocio. Por favor usá el ID exacto que te mostré en la lista de locales abiertos.";
        }

        console.log(`✅ Using vendor_id: ${vendor.id} (${vendor.name})`);

        // Guardar correctamente el negocio (siempre UUID real)
        context.selected_vendor_id = vendor.id;
        context.selected_vendor_name = vendor.name;
        context.cart = []; // Limpieza de carrito al abrir nuevo menú

        // Buscar productos del negocio
        const { data: products, error } = await supabase
          .from("products")
          .select("*")
          .eq("vendor_id", vendor.id)
          .eq("is_available", true);

        if (error || !products?.length) {
          return `No encontré productos disponibles para "${vendor.name}" en este momento.`;
        }

        let menu = `📋 *Menú de ${vendor.name}*\n\n`;
        for (const [i, p] of products.entries()) {
          menu += `${i + 1}. *${p.name}* - $${p.price}\n   ID: ${p.id}\n`;
          if (p.category) menu += `   🏷️ ${Array.isArray(p.category) ? p.category.join(", ") : p.category}\n`;
          if (p.description) menu += `   📝 ${p.description}\n`;
          menu += `\n`;
        }

        return menu;
      }

      case "agregar_al_carrito": {
        const items = args.items as CartItem[];
        console.log("🛒 agregar_al_carrito called:", items);

        // Normalizar vendor_id
        let vendorId = context.selected_vendor_id || args.vendor_id;
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

        if (!uuidRegex.test(vendorId)) {
          const cleanedName = vendorId.replace(/[-_]/g, " ").trim();
          const { data: vendor } = await supabase
            .from("vendors")
            .select("id, name")
            .ilike("name", `%${cleanedName}%`)
            .maybeSingle();
          if (!vendor) return `No encontré el negocio "${args.vendor_id}".`;
          vendorId = vendor.id;
        }

        // 🧹 Si el carrito es de otro negocio, vaciarlo
        if (context.cart.length > 0 && context.selected_vendor_id && vendorId !== context.selected_vendor_id) {
          console.log(`🗑️ Cambiaste de negocio: ${context.selected_vendor_id} → ${vendorId}. Vaciando carrito.`);
          context.cart = [];
          context.selected_vendor_id = vendorId;
          const { data: vendor } = await supabase.from("vendors").select("name").eq("id", vendorId).single();
          context.selected_vendor_name = vendor?.name || "Negocio";
        } else {
          context.selected_vendor_id = vendorId;
        }

        // Resolver productos
        const resolvedItems: CartItem[] = [];
        for (const item of items) {
          const query = uuidRegex.test(item.product_id)
            ? supabase.from("products").select("id, name, price").eq("id", item.product_id).maybeSingle()
            : supabase
              .from("products")
              .select("id, name, price")
              .ilike("name", `%${item.product_name}%`)
              .eq("vendor_id", vendorId)
              .maybeSingle();

          const { data: product } = await query;
          if (product) {
            resolvedItems.push({
              product_id: product.id,
              product_name: product.name,
              quantity: item.quantity,
              price: product.price,
            });
          }
        }

        if (!resolvedItems.length) {
          return "❌ No pude encontrar esos productos en el menú.";
        }

        // Agregar productos validados
        for (const item of resolvedItems) {
          const existing = context.cart.find((c) => c.product_id === item.product_id);
          if (existing) existing.quantity += item.quantity;
          else context.cart.push(item);
        }

        const total = context.cart.reduce((s, i) => s + i.price * i.quantity, 0);
        return `✅ Productos agregados al carrito de ${context.selected_vendor_name}.\n💰 Total actual: $${total}`;
      }

      case "ver_carrito": {
        if (context.cart.length === 0) {
          return "El carrito está vacío.";
        }

        let carrito = "🛒 Tu carrito:\n\n";
        context.cart.forEach((item, i) => {
          carrito += `${i + 1}. ${item.product_name} x${item.quantity} - $${item.price * item.quantity}\n`;
        });

        const total = context.cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
        carrito += `\n💰 Total: $${total}`;

        return carrito;
      }

      case "vaciar_carrito": {
        context.cart = [];
        return "🗑️ Carrito vaciado";
      }

      case "quitar_producto_carrito": {
        const index = context.cart.findIndex((item) => item.product_id === args.product_id);
        if (index !== -1) {
          const removed = context.cart.splice(index, 1)[0];
          return `Quité ${removed.product_name} del carrito`;
        }
        return "Producto no encontrado en el carrito";
      }

      case "crear_pedido": {
        console.log("🛒 crear_pedido called with context:", {
          cartLength: context.cart.length,
          cartPreview: context.cart.map((i) => `${i.product_name} x${i.quantity}`).join(", "),
          vendorId: context.selected_vendor_id,
          vendorName: context.selected_vendor_name,
          address: args.direccion,
          paymentMethod: args.metodo_pago,
          userLocation: context.user_latitude ? `${context.user_latitude},${context.user_longitude}` : "none",
        });

        if (context.cart.length === 0) {
          return "No podés crear un pedido con el carrito vacío. ¿Querés que te muestre productos disponibles?";
        }

        if (!context.selected_vendor_id) {
          console.error("❌ No vendor_id in context!");
          return "Error: No hay negocio seleccionado. Por favor elegí un negocio antes de hacer el pedido.";
        }

        // 📍 VALIDACIÓN DE UBICACIÓN Y COBERTURA
        let deliveryCost = 0;
        let deliveryDistance = 0;

        if (context.user_latitude && context.user_longitude) {
          // Usuario tiene ubicación, validar cobertura
          const { data: vendor } = await supabase
            .from("vendors")
            .select("id, name, latitude, longitude, delivery_radius_km, delivery_price_per_km, address")
            .eq("id", context.selected_vendor_id)
            .single();

          if (vendor?.latitude && vendor?.longitude && vendor?.delivery_radius_km) {
            // Calcular distancia
            const { data: distanceResult, error: distError } = await supabase.rpc("calculate_distance", {
              lat1: context.user_latitude,
              lon1: context.user_longitude,
              lat2: vendor.latitude,
              lon2: vendor.longitude,
            });

            if (!distError && distanceResult !== null) {
              deliveryDistance = distanceResult;
              console.log(`📏 Distance: ${distanceResult}km, Max: ${vendor.delivery_radius_km}km`);

              if (distanceResult > vendor.delivery_radius_km) {
                return `😔 Lo siento, ${vendor.name} no hace delivery a tu ubicación.\n\n📍 Tu ubicación está a ${distanceResult.toFixed(1)} km del local.\n🚗 Radio de cobertura: ${vendor.delivery_radius_km} km\n\n💡 Podés buscar otros negocios más cercanos o actualizar tu ubicación.`;
              }

              // Calcular costo de delivery si el vendor tiene precio configurado
              if (vendor.delivery_price_per_km && vendor.delivery_price_per_km > 0) {
                deliveryCost = Math.round(distanceResult * vendor.delivery_price_per_km);
                console.log(`🚚 Delivery cost: ${deliveryCost} $ (${distanceResult}km × ${vendor.delivery_price_per_km} $/km)`);
              }
            }
          }

          // ⚠️ CRÍTICO: SIEMPRE usar la dirección del contexto si existe
          // Esto evita que el AI use incorrectamente la dirección del vendor
          if (context.delivery_address) {
            args.direccion = context.delivery_address;
            console.log(`✅ Using saved context address (forced): ${args.direccion}`);
          } else if (!args.direccion || args.direccion.trim() === "") {
            args.direccion = `Lat: ${context.user_latitude.toFixed(6)}, Lon: ${context.user_longitude.toFixed(6)}`;
            console.log(`✅ Using coordinates as address: ${args.direccion}`);
          }
        } else {
          // Sin ubicación, pedir que la comparta
          if (!args.direccion || args.direccion.trim() === "") {
            return `📍 Para confirmar tu pedido, necesito que compartas tu ubicación.\n\n👉 Tocá el clip 📎 en WhatsApp y elegí "Ubicación"\n\nAsí puedo verificar que ${context.selected_vendor_name} hace delivery a tu zona. 🚗`;
          }
        }

        // 🚫 Verificar si el usuario ya tiene un pedido activo
        const { data: activeOrder } = await supabase
          .from("orders")
          .select("id, status, vendor_id")
          .eq("customer_phone", context.phone)
          .in("status", ["pending", "confirmed", "preparing", "ready", "delivering"])
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (activeOrder) {
          const { data: vendor } = await supabase
            .from("vendors")
            .select("name")
            .eq("id", activeOrder.vendor_id)
            .single();

          return `⚠️ Ya tenés un pedido en curso (#${activeOrder.id.substring(0, 8)}) con ${vendor?.name || "un negocio"} en estado "${activeOrder.status}".\n\nPor favor esperá a que se complete o cancele ese pedido antes de hacer uno nuevo.`;
        }

        // Validar que la dirección y método de pago estén presentes
        if (!args.direccion || args.direccion.trim() === "") {
          return "Por favor indicá tu dirección de entrega.";
        }

        if (!args.metodo_pago) {
          return "Por favor seleccioná un método de pago (efectivo, transferencia o mercadopago).";
        }

        context.delivery_address = args.direccion;
        context.payment_method = args.metodo_pago;

        const subtotal = context.cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
        const total = subtotal + deliveryCost;

        console.log("📤 Inserting order:", {
          vendor_id: context.selected_vendor_id,
          customer_phone: context.phone,
          items_count: context.cart.length,
          subtotal,
          delivery_cost: deliveryCost,
          delivery_distance: deliveryDistance,
          total,
          address: context.delivery_address,
          payment_method: context.payment_method,
        });

        const { data: order, error } = await supabase
          .from("orders")
          .insert({
            vendor_id: context.selected_vendor_id,
            customer_name: context.phone,
            customer_phone: context.phone,
            items: context.cart,
            total,
            status: "pending",
            address: context.delivery_address,
            payment_method: context.payment_method,
            address_is_manual: !context.user_latitude || context.user_latitude === 0, // Marca si es manual
          })
          .select()
          .single();

        if (error) {
          console.error("❌ Error creating order:", error);
          console.error("Error details:", JSON.stringify(error, null, 2));
          return `Hubo un error al crear el pedido: ${error.message}. Por favor intentá de nuevo o contactá con el vendedor.`;
        }

        console.log("✅ Order created successfully:", order.id);

        context.pending_order_id = order.id;

        // 📧 Notificar al vendedor sobre el nuevo pedido
        try {
          console.log("📨 Sending new order notification to vendor:", context.selected_vendor_id);
          const { data: notifyData, error: notifyError } = await supabase.functions.invoke("notify-vendor", {
            body: {
              orderId: order.id,
              eventType: "new_order",
            },
          });

          if (notifyError) {
            console.error("❌ Error notifying vendor:", notifyError);
          } else {
            console.log("✅ Vendor notification sent:", notifyData);
          }
        } catch (notifyErr) {
          console.error("💥 Exception notifying vendor:", notifyErr);
        }

        // 🗑️ Eliminar direcciones temporales después de crear el pedido
        try {
          const { error: deleteError } = await supabase
            .from("saved_addresses")
            .delete()
            .eq("phone", context.phone)
            .eq("is_temporary", true);

          if (deleteError) {
            console.error("Error deleting temporary addresses:", deleteError);
          } else {
            console.log("🧹 Temporary addresses cleaned up");
          }
        } catch (cleanupError) {
          console.error("Error in cleanup process:", cleanupError);
        }

        let confirmacion = `✅ ¡Pedido creado exitosamente!\n\n`;
        confirmacion += `📦 Pedido #${order.id.substring(0, 8)}\n`;
        confirmacion += `🏪 Negocio: ${context.selected_vendor_name}\n`;

        if (deliveryCost > 0) {
          confirmacion += `🛒 Subtotal: $ ${subtotal}\n`;
          confirmacion += `🚚 Delivery (${deliveryDistance.toFixed(1)} km): $ ${deliveryCost}\n`;
          confirmacion += `💰 Total: $ ${total}\n`;
        } else {
          confirmacion += `💰 Total: $ ${total}\n`;
        }

        confirmacion += `📍 Dirección: ${context.delivery_address}\n`;
        confirmacion += `💳 Pago: ${context.payment_method}\n\n`;

        if (context.payment_method === "transferencia") {
          confirmacion += `Por favor enviá el comprobante de pago para confirmar el pedido.`;
        }

        // Limpiar carrito después de crear pedido
        context.cart = [];

        return confirmacion;
      }

      case "ver_estado_pedido": {
        const { data: order, error } = await supabase
          .from("orders")
          .select("*, vendors(name)")
          .eq("id", args.order_id)
          .single();

        if (error || !order) {
          return "No encontré ese pedido";
        }

        const statusEmojis: any = {
          pending: "⏳ Pendiente",
          confirmed: "✅ Confirmado",
          preparing: "👨‍🍳 En preparación",
          ready: "🎉 Listo para entregar",
          delivered: "✅ Entregado",
          cancelled: "❌ Cancelado",
        };

        let estado = `📦 Estado del pedido #${order.id.substring(0, 8)}\n\n`;
        estado += `🏪 Negocio: ${order.vendors.name}\n`;
        estado += `📊 Estado: ${statusEmojis[order.status] || order.status}\n`;
        estado += `💰 Total: $${order.total}\n`;

        return estado;
      }

      case "ver_ofertas": {
        const nowIso: string = new Date().toISOString();

        // Si el usuario está en una conversación con un vendor específico, solo mostrar sus ofertas
        const targetVendorId = args.vendor_id || context.selected_vendor_id;

        let query = supabase
          .from("vendor_offers")
          .select("*, vendors(id, name, category, latitude, longitude, delivery_radius_km, is_active)")
          .eq("is_active", true)
          .lte("valid_from", nowIso)
          .or(`valid_until.gte.${nowIso},valid_until.is.null`);

        // Filtrar por vendor si hay uno en contexto o especificado
        if (targetVendorId) {
          query = query.eq("vendor_id", targetVendorId);
        }

        const { data: offers, error } = await query;

        if (error || !offers || offers.length === 0) {
          return targetVendorId
            ? "Este negocio no tiene ofertas activas en este momento."
            : "No hay ofertas disponibles en este momento. 😔";
        }

        // Filtrar ofertas por ubicación y horarios
        let filteredOffers = offers;

        if (!targetVendorId && context.user_latitude && context.user_longitude) {
          // Si no hay vendor específico pero sí ubicación, filtrar por alcance
          const { data: vendorsInRange } = await supabase.rpc("get_vendors_in_range", {
            user_lat: context.user_latitude,
            user_lon: context.user_longitude,
          });

          if (vendorsInRange && vendorsInRange.length > 0) {
            const openVendorIds = vendorsInRange.filter((v: any) => v.is_open).map((v: any) => v.vendor_id);

            filteredOffers = offers.filter((offer: any) => openVendorIds.includes(offer.vendor_id));
          } else {
            filteredOffers = [];
          }
        }

        if (filteredOffers.length === 0) {
          return "No hay ofertas disponibles de negocios que estén abiertos y te hagan delivery en este momento. 😔";
        }

        let resultado = `🎁 ${filteredOffers.length === 1 ? "Oferta disponible" : `${filteredOffers.length} ofertas disponibles`}:\n\n`;

        filteredOffers.forEach((offer: any, i: number) => {
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
          resultado += `   ⏰ Válido hasta: ${validUntil.toLocaleDateString("es-AR")}\n`;
          resultado += `   ID Negocio: ${offer.vendor_id}\n`;
          resultado += `\n`;
        });

        return resultado;
      }

      case "cancelar_pedido": {
        if (!args.motivo || args.motivo.trim().length < 10) {
          return "Por favor proporciona un motivo detallado para la cancelación (mínimo 10 caracteres).";
        }

        const { data: order, error: fetchError } = await supabase
          .from("orders")
          .select("*")
          .eq("id", args.order_id)
          .single();

        if (fetchError || !order) {
          return "No encontré ese pedido.";
        }

        if (order.status === "cancelled") {
          return "Este pedido ya está cancelado.";
        }

        if (["delivered", "ready"].includes(order.status)) {
          return "No se puede cancelar un pedido que ya está listo o entregado. Contacta con soporte si necesitas ayuda.";
        }

        const { error: updateError } = await supabase
          .from("orders")
          .update({ status: "cancelled" })
          .eq("id", args.order_id);

        if (updateError) {
          return "Hubo un error al cancelar el pedido. Intenta de nuevo.";
        }

        // Registrar historial
        await supabase.from("order_status_history").insert({
          order_id: args.order_id,
          status: "cancelled",
          changed_by: "customer",
          reason: args.motivo,
        });

        // 📧 Notificar al vendedor sobre la cancelación
        try {
          await supabase.functions.invoke("notify-vendor", {
            body: {
              orderId: args.order_id,
              eventType: "order_cancelled",
            },
          });
        } catch (notifyError) {
          console.error("Error notifying vendor about cancellation:", notifyError);
        }

        return `✅ Pedido #${args.order_id.substring(0, 8)} cancelado.\n📝 Motivo: ${args.motivo}\n\nEl vendedor ha sido notificado.`;
      }

      case "hablar_con_vendedor": {
        console.log("🔄 Switching to vendor chat mode");

        // Usar vendor_id del contexto si está disponible
        let vendorId = context.selected_vendor_id;

        if (!vendorId) {
          return "Primero necesito que selecciones un negocio. Podés buscar productos o locales para elegir con quién querés hablar.";
        }

        // Validar que sea un UUID válido
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(vendorId)) {
          console.log(`⚠️ Invalid vendor_id format: "${vendorId}", attempting to find by name`);

          // Intentar buscar por nombre si no es UUID
          const { data: foundVendor } = await supabase
            .from("vendors")
            .select("id, name")
            .ilike("name", `%${vendorId}%`)
            .maybeSingle();

          if (foundVendor) {
            vendorId = foundVendor.id;
            context.selected_vendor_id = foundVendor.id; // Actualizar contexto con UUID correcto
            console.log(`✅ Found vendor by name: ${foundVendor.name} (${foundVendor.id})`);
          } else {
            return "No pude encontrar el negocio seleccionado. Por favor buscá locales o productos de nuevo.";
          }
        }

        // Obtener información del vendedor
        const { data: vendor, error: vendorError } = await supabase
          .from("vendors")
          .select("phone, whatsapp_number, name")
          .eq("id", vendorId)
          .single();

        if (vendorError || !vendor) {
          console.error("Error getting vendor:", vendorError);
          return "Hubo un problema al conectar con el negocio. Por favor intentá de nuevo.";
        }

        const vendorPhone = vendor.whatsapp_number || vendor.phone;

        // Verificar si ya existe un chat activo para evitar duplicados
        const { data: existingChat } = await supabase
          .from("vendor_chats")
          .select("id")
          .eq("vendor_id", vendorId)
          .eq("customer_phone", context.phone)
          .eq("is_active", true)
          .maybeSingle();

        let chatId = existingChat?.id;

        // Si no existe un chat activo, crear uno nuevo
        if (!chatId) {
          const { data: newChat, error: chatError } = await supabase
            .from("vendor_chats")
            .insert({
              vendor_id: vendorId,
              customer_phone: context.phone,
              is_active: true,
            })
            .select("id")
            .single();

          if (chatError) {
            console.error("Error creating vendor chat:", chatError);
          } else {
            chatId = newChat.id;
            console.log("✅ Chat created with vendor:", { chatId, vendorId });

            // Crear mensaje inicial del sistema
            await supabase.from("chat_messages").insert({
              chat_id: chatId,
              sender_type: "bot",
              message: `Cliente ${context.phone} solicitó hablar con el vendedor`,
            });

            // 📧 Notificar al vendedor que un cliente quiere hablar
            try {
              console.log("📨 Notifying vendor about customer message request");
              const { data: notifyData, error: notifyError } = await supabase.functions.invoke("notify-vendor", {
                body: {
                  orderId: args.order_id || "no-order",
                  eventType: "customer_message",
                  vendorId: vendorId,
                },
              });

              if (notifyError) {
                console.error("❌ Error notifying vendor:", notifyError);
              } else {
                console.log("✅ Vendor notified about customer message");
              }
            } catch (notifyErr) {
              console.error("💥 Exception notifying vendor:", notifyErr);
            }
          }
        }

        // Actualizar sesión del usuario
        const { error } = await supabase.from("user_sessions").upsert(
          {
            phone: context.phone,
            assigned_vendor_phone: vendorPhone,
            in_vendor_chat: true,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "phone" },
        );

        if (error) {
          console.error("Error updating session:", error);
        }

        let mensaje = `👤 *Conectando con ${vendor.name}*\n\n`;
        mensaje +=
          "Un representante del negocio te atenderá en breve. Los mensajes que envíes ahora irán directamente al vendedor.\n\n";
        mensaje += "Para volver al bot automático, el vendedor puede reactivarlo desde su panel.";

        return mensaje;
      }

      case "registrar_calificacion": {
        // Validar que tengamos al menos una calificación o comentario
        if (!args.delivery_rating && !args.service_rating && !args.product_rating && !args.comment) {
          return "Por favor proporciona al menos una calificación (delivery, atención o producto) o un comentario.";
        }

        // Buscar el pedido más reciente del cliente
        const { data: recentOrder } = await supabase
          .from("orders")
          .select("id, vendor_id")
          .eq("customer_phone", context.phone)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!recentOrder) {
          return "No encontré ningún pedido reciente para calificar. Intenta de nuevo después de realizar un pedido.";
        }

        // Calcular rating general (promedio de los ratings proporcionados)
        const ratings = [args.delivery_rating, args.service_rating, args.product_rating].filter(
          (r) => r !== null && r !== undefined,
        );

        const averageRating =
          ratings.length > 0 ? Math.round(ratings.reduce((a: number, b: number) => a + b, 0) / ratings.length) : null;

        // Insertar review
        const { error } = await supabase.from("vendor_reviews").insert({
          vendor_id: recentOrder.vendor_id,
          order_id: recentOrder.id,
          customer_phone: context.phone,
          customer_name: args.customer_name || context.phone,
          rating: averageRating,
          delivery_rating: args.delivery_rating,
          service_rating: args.service_rating,
          product_rating: args.product_rating,
          comment: args.comment,
        });

        if (error) {
          console.error("Error saving review:", error);
          return "Hubo un error al guardar tu calificación. Por favor intenta de nuevo.";
        }

        let respuesta = "⭐ *¡Gracias por tu calificación!*\n\n";
        respuesta += "📊 *Tu calificación:*\n";
        if (args.delivery_rating) respuesta += `🚚 Tiempo de entrega: ${args.delivery_rating}/5\n`;
        if (args.service_rating) respuesta += `👥 Atención: ${args.service_rating}/5\n`;
        if (args.product_rating) respuesta += `📦 Producto: ${args.product_rating}/5\n`;
        if (args.comment) respuesta += `\n💬 Comentario: "${args.comment}"\n`;
        respuesta += "\nTu opinión nos ayuda a mejorar. ¡Gracias por confiar en nosotros! 😊";

        return respuesta;
      }

      case "crear_ticket_soporte": {
        const prioridad = args.prioridad || "normal";

        const { data: ticket, error } = await supabase
          .from("support_tickets")
          .insert({
            customer_phone: context.phone,
            customer_name: context.phone,
            subject: args.asunto,
            priority:
              prioridad === "baja"
                ? "low"
                : prioridad === "alta"
                  ? "high"
                  : prioridad === "urgente"
                    ? "urgent"
                    : "normal",
            status: "open",
          })
          .select()
          .single();

        if (error) {
          console.error("Error creating ticket:", error);
          return "Hubo un error al crear el ticket. Intenta de nuevo o contacta directamente con soporte.";
        }

        // Crear mensaje inicial en el ticket
        await supabase.from("support_messages").insert({
          ticket_id: ticket.id,
          sender_type: "customer",
          message: args.descripcion,
        });

        return `✅ *Ticket de soporte creado*\n\n📋 ID: #${ticket.id.substring(0, 8)}\n🏷️ Asunto: ${args.asunto}\n⚡ Prioridad: ${prioridad}\n\nNuestro equipo de soporte te contactará pronto. Los mensajes que envíes ahora irán directamente al equipo de soporte.\n\n💡 *Importante:* El bot se desactivará hasta que el equipo de soporte cierre tu ticket.`;
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

📍 *MIS DIRECCIONES*
• Guardar direcciones para pedidos futuros
• Ver mis direcciones guardadas
• Usar una dirección guardada
• Borrar o renombrar direcciones

💬 *SOPORTE*
• Hablar con un vendedor
• Crear un ticket de soporte

Escribí lo que necesites y te ayudo. ¡Es muy fácil! 😊`;
      }

      case "guardar_direccion": {
        // Primero intentar obtener las coordenadas del contexto
        let lat = context.user_latitude;
        let lng = context.user_longitude;
        let address = context.delivery_address;

        // Si no están en el contexto, buscar en la sesión más reciente
        if (!lat || !lng) {
          console.log("⚠️ Coordinates not in context, fetching from database...");
          const { data: session } = await supabase
            .from("user_sessions")
            .select("user_latitude, user_longitude, last_bot_message")
            .eq("phone", context.phone)
            .maybeSingle();

          if (session?.user_latitude && session?.user_longitude) {
            lat = session.user_latitude;
            lng = session.user_longitude;
            console.log(`✅ Found coordinates in session: ${lat}, ${lng}`);

            // Actualizar el contexto para futuras operaciones
            context.user_latitude = lat;
            context.user_longitude = lng;
          }
        }

        // Si aún no tenemos coordenadas, pedir que las comparta
        if (!lat || !lng) {
          return (
            'Parece que no tengo tu ubicación guardada. Necesito que compartas tu ubicación tocando el clip 📎 en WhatsApp y eligiendo "Ubicación". \n\nUna vez que lo hagas, podré guardarla como "' +
            args.nombre +
            '". 😊'
          );
        }

        // Validar nombre
        const nombre = args.nombre.trim();
        if (!nombre || nombre.length < 2) {
          return "Por favor elegí un nombre más descriptivo para tu dirección (mínimo 2 caracteres).";
        }

        // Buscar si ya existe una dirección con ese nombre
        const { data: existing } = await supabase
          .from("saved_addresses")
          .select("id")
          .eq("phone", context.phone)
          .eq("name", nombre)
          .maybeSingle();

        if (existing) {
          return `Ya tenés una dirección guardada con el nombre "${nombre}". Podés borrarla primero o usar otro nombre.`;
        }

        // Guardar dirección
        const { error } = await supabase.from("saved_addresses").insert({
          phone: context.phone,
          name: nombre,
          address: address || "Ubicación guardada",
          latitude: lat,
          longitude: lng,
          is_temporary: false,
        });

        if (error) {
          console.error("Error saving address:", error);
          return "Hubo un problema al guardar tu dirección. Intentá de nuevo.";
        }

        console.log(`✅ Address saved: ${nombre} at ${lat}, ${lng}`);
        return `✅ Listo, guardé tu dirección como "${nombre}" 📍\n\nLa próxima vez podés decir *"Enviar a ${nombre}"* para usarla rápido. 😊`;
      }

      case "usar_direccion_temporal": {
        if (!context.user_latitude || !context.user_longitude) {
          return "⚠️ No tengo tu ubicación guardada. Por favor compartí tu ubicación usando el botón 📍 de WhatsApp primero.";
        }

        // Marcar como temporal
        context.pending_location_decision = false;

        return `Perfecto 👍 Usaré esta ubicación solo para este pedido.\n\n⚠️ *Importante:* Esta dirección se eliminará automáticamente al finalizar el pedido.\n\n¿Qué te gustaría pedir? 😊`;
      }

      case "listar_direcciones": {
        const { data: addresses, error } = await supabase
          .from("saved_addresses")
          .select("*")
          .eq("phone", context.phone)
          .eq("is_temporary", false)
          .order("created_at", { ascending: false });

        if (error) {
          console.error("Error fetching addresses:", error);
          return "Hubo un problema al obtener tus direcciones. Intentá de nuevo.";
        }

        if (!addresses || addresses.length === 0) {
          return '📍 No tenés direcciones guardadas todavía.\n\nPodés compartir tu ubicación 📍 y guardarla con un nombre (ej: "Casa", "Trabajo") para usarla en futuros pedidos. 😊';
        }

        let resultado = `📍 *Tus direcciones guardadas:*\n\n`;
        addresses.forEach((addr: any, i: number) => {
          resultado += `${i + 1}. 🏠 *${addr.name}*\n`;
          resultado += `   ${addr.address}\n`;
          resultado += `   _Guardada el ${new Date(addr.created_at).toLocaleDateString("es-AR")}_\n\n`;
        });
        resultado += `💡 Podés decir *"Enviar a ${addresses[0].name}"* para usar una dirección o *"Borrar ${addresses[0].name}"* para eliminarla.`;

        return resultado;
      }

      case "borrar_direccion": {
        const nombre = args.nombre.trim();

        const { data: address } = await supabase
          .from("saved_addresses")
          .select("id")
          .eq("phone", context.phone)
          .eq("name", nombre)
          .eq("is_temporary", false)
          .maybeSingle();

        if (!address) {
          return `No encontré una dirección llamada "${nombre}".\n\nPodés ver tus direcciones diciendo "Mis direcciones". 📍`;
        }

        const { error } = await supabase.from("saved_addresses").delete().eq("id", address.id);

        if (error) {
          console.error("Error deleting address:", error);
          return "Hubo un problema al borrar la dirección. Intentá de nuevo.";
        }

        return `✅ Listo, eliminé la dirección "${nombre}". 🗑️`;
      }

      case "renombrar_direccion": {
        const nombreViejo = args.nombre_viejo.trim();
        const nombreNuevo = args.nombre_nuevo.trim();

        if (!nombreNuevo || nombreNuevo.length < 2) {
          return "Por favor elegí un nombre más descriptivo (mínimo 2 caracteres).";
        }

        // Buscar dirección a renombrar
        const { data: address } = await supabase
          .from("saved_addresses")
          .select("id")
          .eq("phone", context.phone)
          .eq("name", nombreViejo)
          .eq("is_temporary", false)
          .maybeSingle();

        if (!address) {
          return `No encontré una dirección llamada "${nombreViejo}".\n\nPodés ver tus direcciones diciendo "Mis direcciones". 📍`;
        }

        // Verificar que el nuevo nombre no exista
        const { data: existing } = await supabase
          .from("saved_addresses")
          .select("id")
          .eq("phone", context.phone)
          .eq("name", nombreNuevo)
          .maybeSingle();

        if (existing) {
          return `Ya tenés una dirección con el nombre "${nombreNuevo}". Elegí otro nombre. 😊`;
        }

        // Renombrar
        const { error } = await supabase.from("saved_addresses").update({ name: nombreNuevo }).eq("id", address.id);

        if (error) {
          console.error("Error renaming address:", error);
          return "Hubo un problema al renombrar la dirección. Intentá de nuevo.";
        }

        return `✅ Listo, renombré "${nombreViejo}" a "${nombreNuevo}". 📝`;
      }

      case "usar_direccion_guardada": {
        const nombre = args.nombre.trim();

        const { data: address, error } = await supabase
          .from("saved_addresses")
          .select("*")
          .eq("phone", context.phone)
          .eq("name", nombre)
          .eq("is_temporary", false)
          .maybeSingle();

        if (error || !address) {
          return `No encontré una dirección llamada "${nombre}".\n\nPodés ver tus direcciones diciendo "Mis direcciones" 📍 o compartir una nueva ubicación.`;
        }

        // Actualizar contexto con la dirección guardada
        context.user_latitude = parseFloat(address.latitude);
        context.user_longitude = parseFloat(address.longitude);
        context.delivery_address = address.address;

        // Actualizar en user_sessions
        await supabase.from("user_sessions").upsert(
          {
            phone: context.phone,
            user_latitude: context.user_latitude,
            user_longitude: context.user_longitude,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "phone" },
        );

        return `📍 Perfecto, voy a usar tu dirección "${nombre}".\n\n${address.address}\n\n¿Qué te gustaría pedir? 😊`;
      }

      case "eliminar_todas_direcciones": {
        const { error } = await supabase
          .from("saved_addresses")
          .delete()
          .eq("phone", context.phone)
          .eq("is_temporary", false);

        if (error) {
          console.error("Error deleting all addresses:", error);
          return "Hubo un problema al eliminar tus direcciones. Intentá de nuevo.";
        }

        return `✅ Listo, eliminé todas tus ubicaciones guardadas. 💬\n\nPodés compartir tu ubicación 📍 cuando quieras hacer un nuevo pedido.`;
      }

      case "agregar_direccion_manual": {
        const direccionCompleta = args.direccion_completa.trim();
        const nombre = args.nombre?.trim();

        if (!direccionCompleta || direccionCompleta.length < 10) {
          return "Por favor escribí una dirección más completa (calle, número, ciudad, referencias). Mínimo 10 caracteres.";
        }

        // Si tiene nombre, guardar de forma permanente
        if (nombre && nombre.length >= 2) {
          // Verificar si ya existe
          const { data: existing } = await supabase
            .from("saved_addresses")
            .select("id")
            .eq("phone", context.phone)
            .eq("name", nombre)
            .maybeSingle();

          if (existing) {
            return `Ya tenés una dirección guardada con el nombre "${nombre}". Podés borrarla primero o usar otro nombre.`;
          }

          // Guardar con coordenadas null e indicador manual
          const { error } = await supabase.from("saved_addresses").insert({
            phone: context.phone,
            name: nombre,
            address: direccionCompleta,
            latitude: 0, // Coordenadas en 0,0 indican entrada manual
            longitude: 0,
            is_temporary: false,
            is_manual_entry: true,
          });

          if (error) {
            console.error("Error saving manual address:", error);
            return "Hubo un problema al guardar tu dirección. Intentá de nuevo.";
          }

          return `✅ Dirección guardada como "${nombre}": ${direccionCompleta}\n\n⚠️ Importante: Esta dirección NO fue validada con GPS. El negocio verá que fue ingresada manualmente y confirmará si hace delivery ahí. 📍`;
        } else {
          // Sin nombre = temporal para este pedido
          context.delivery_address = direccionCompleta;
          context.user_latitude = 0; // Marca como manual
          context.user_longitude = 0;

          return `✅ Voy a usar esta dirección para tu pedido: ${direccionCompleta}\n\n⚠️ Esta dirección NO fue validada con GPS. El negocio confirmará si hace delivery ahí. 📍\n\n¿Qué método de pago preferís? (efectivo, transferencia o mercadopago)`;
        }
      }

      case "calcular_costo_delivery": {
        // Verificar que hay un negocio seleccionado
        if (!context.selected_vendor_id) {
          return "Primero tenés que elegir un negocio para saber el costo del delivery. ¿Querés que te muestre los locales disponibles?";
        }

        // Verificar que el cliente tiene ubicación
        if (!context.user_latitude || !context.user_longitude || context.user_latitude === 0) {
          return `📍 Para calcular el costo del delivery necesito que compartas tu ubicación.\n\n👉 Tocá el clip 📎 en WhatsApp y elegí "Ubicación"\n\nAsí puedo calcular la distancia desde ${context.selected_vendor_name || "el negocio"} hasta tu domicilio. 🚗`;
        }

        // Obtener información del vendor
        const { data: vendor, error: vendorError } = await supabase
          .from("vendors")
          .select("id, name, latitude, longitude, delivery_radius_km, delivery_price_per_km")
          .eq("id", context.selected_vendor_id)
          .single();

        if (vendorError || !vendor) {
          console.error("Error fetching vendor for delivery calc:", vendorError);
          return "Hubo un problema al obtener la información del negocio. Intentá de nuevo.";
        }

        // Verificar que el vendor tiene ubicación configurada
        if (!vendor.latitude || !vendor.longitude) {
          return `${vendor.name} todavía no configuró su ubicación exacta, por lo que no puedo calcular el costo del delivery automáticamente. Podés consultarle directamente al negocio.`;
        }

        // Calcular distancia
        const { data: distance, error: distError } = await supabase.rpc("calculate_distance", {
          lat1: context.user_latitude,
          lon1: context.user_longitude,
          lat2: vendor.latitude,
          lon2: vendor.longitude,
        });

        if (distError || distance === null) {
          console.error("Error calculating distance:", distError);
          return "Hubo un problema al calcular la distancia. Intentá de nuevo.";
        }

        // Verificar si está dentro del radio
        if (distance > vendor.delivery_radius_km) {
          return `😔 Lo siento, ${vendor.name} no hace delivery a tu ubicación.\n\n📍 Tu ubicación está a ${distance.toFixed(1)} km del local.\n🚗 Radio de cobertura: ${vendor.delivery_radius_km} km\n\n💡 Podés buscar otros negocios más cercanos.`;
        }

        // Calcular costo si el vendor tiene precio configurado
        if (!vendor.delivery_price_per_km || vendor.delivery_price_per_km <= 0) {
          return `✅ ¡${vendor.name} hace delivery a tu zona!\n\n📏 Distancia: ${distance.toFixed(1)} km\n\n💰 El delivery está incluido en el precio total sin costo adicional. 🎉`;
        }

        const deliveryCost = Math.round(distance * vendor.delivery_price_per_km);

        return `✅ ¡${vendor.name} hace delivery a tu zona!\n\n📏 Distancia: ${distance.toFixed(1)} km\n💰 Costo del delivery: $ ${deliveryCost}\n\n📌 Tarifa: $ ${vendor.delivery_price_per_km}/km\n\nEste monto se suma al total de tu pedido al confirmar. 🚚`;
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

export async function handleVendorBot(message: string, phone: string, supabase: any): Promise<string> {
  const normalizedPhone = normalizeArgentinePhone(phone);
  console.log("🤖 AI Bot START - Phone:", normalizedPhone, "Message:", message);

  try {
    // Cargar contexto
    const context = await getContext(normalizedPhone, supabase);
    console.log("📋 Context loaded:", {
      phone: context.phone,
      cartItems: context.cart.length,
      cartPreview: context.cart.map((i) => `${i.product_name} x${i.quantity}`).join(", ") || "empty",
      vendor: context.selected_vendor_name,
      vendorId: context.selected_vendor_id,
      historyLength: context.conversation_history.length,
      hasLocation: !!(context.user_latitude && context.user_longitude),
    });

    // Agregar mensaje del usuario al historial
    context.conversation_history.push({
      role: "user",
      content: message,
    });

    // Inicializar OpenAI
    const openai = new OpenAI({
      apiKey: Deno.env.get("OPENAI_API_KEY"),
    });

    // Prompt del sistema
    const systemPrompt = `Sos un vendedor de Lapacho, una plataforma de delivery por WhatsApp en Argentina.

Tu trabajo es ayudar a los clientes a hacer pedidos de forma natural y amigable.

INFORMACIÓN DEL CONTEXTO:
${context.selected_vendor_name ? `- Negocio actual: ${context.selected_vendor_name}` : ""}
${context.cart.length > 0 ? `- Carrito: ${context.cart.map((i) => `${i.quantity}x ${i.product_name} ($${i.price})`).join(", ")} - Total: $${context.cart.reduce((s, i) => s + i.price * i.quantity, 0)}` : "- Carrito vacío"}
${context.delivery_address ? `- Dirección: ${context.delivery_address}` : ""}
${context.payment_method ? `- Método de pago: ${context.payment_method}` : ""}
${context.pending_order_id ? `- Pedido pendiente: ${context.pending_order_id}` : ""}
${context.user_latitude && context.user_longitude ? `- ✅ Usuario tiene ubicación guardada (lat: ${context.user_latitude}, lng: ${context.user_longitude})` : "- ⚠️ Usuario NO compartió su ubicación aún"}

🚨 DATOS EN TIEMPO REAL (MÁXIMA PRIORIDAD):
⚠️ NUNCA ALMACENES NI MEMORICES INFORMACIÓN DE NEGOCIOS ⚠️
- Los negocios pueden cambiar HORARIOS, PRODUCTOS, PRECIOS y DISPONIBILIDAD en cualquier momento
- Un negocio puede estar SUSPENDIDO por falta de pago
- Los productos disponibles varían según STOCK actual
- El RADIO DE ENTREGA puede cambiar según ubicación del cliente
- SIEMPRE debes consultar las herramientas para obtener información actualizada
- NO supongas que un negocio que aparecía antes todavía está disponible
- NO memorices menús, precios o productos - todo cambia dinámicamente

📍 UBICACIÓN Y FILTRADO:
${context.user_latitude && context.user_longitude
        ? "- El usuario YA compartió su ubicación → Solo verá negocios que entregan en su zona"
        : "- El usuario NO compartió ubicación → Verá todos los negocios, pero es recomendable pedirle que la comparta"
      }
- Si el usuario pregunta por delivery o zona: explicale que puede compartir su ubicación usando el botón 📍 de WhatsApp
- Cuando el usuario busque locales o productos, automáticamente se filtrarán por su ubicación si la compartió
- Si el usuario está buscando y no tiene ubicación, sugerile compartirla para ver solo lo que está a su alcance
- ⚠️ CRÍTICO: Cuando muestres negocios, SIEMPRE incluí la distancia si la herramienta la proporciona. No la elimines ni la omitas al reformular el mensaje.

REGLAS CRÍTICAS SOBRE HERRAMIENTAS (MÁXIMA PRIORIDAD):
🚨 **PROHIBIDO MODIFICAR RESULTADOS DE HERRAMIENTAS** 🚨
Cuando una herramienta devuelve un resultado:
- **COPIÁ TODO EL TEXTO TAL CUAL ESTÁ**
- **NO CAMBIES NINGÚN DATO**: ni direcciones, ni distancias, ni precios, ni nombres
- **NO AGREGUES información** del contexto del usuario
- **NO RESUMAS** el resultado
- **NO REFORMULES** el formato

Ejemplo CORRECTO:
Herramienta devuelve: "1. Pizzería Don Luigi\n   📍 Av. España 1234 - A 0.5 km"
TU respuesta: "1. Pizzería Don Luigi\n   📍 Av. España 1234 - A 0.5 km"

Ejemplo INCORRECTO:
Herramienta devuelve: "1. Pizzería Don Luigi\n   📍 Av. España 1234 - A 0.5 km"
TU respuesta: "1. Pizzería Don Luigi\n   📍 LAVALLE 1582"  ❌ NUNCA HAGAS ESTO

REGLAS GENERALES:
1. Hablá en argentino informal pero respetuoso (vos, querés, podés, etc)
2. Usá emojis para hacer la conversación más amigable
3. Sé breve y directo - máximo 4 líneas por mensaje
4. ⚠️ NUNCA inventes productos, precios o información que no existe en la base de datos
5. Si no sabés algo, decilo y preguntá
6. Cuando el cliente busque algo, usá la herramienta buscar_productos
8. ⚠️ CRÍTICO - VER MENÚ: Si el cliente dice "ver menú", "mostrar menú" o similar SIN especificar un negocio:
   - Si NO hay negocio en el contexto → Preguntale "¿De cuál negocio querés ver el menú?"
   - Si YA hay negocio en el contexto → Podés usar ver_menu_negocio con ese negocio
   - NUNCA asumas automáticamente el primer negocio de una lista de búsqueda
9. Cuando uses ver_menu_negocio, hacelo UNA SOLA VEZ por conversación por negocio
10. SOLO podés agregar productos que aparecen en el menú que mostraste
11. Si el cliente pregunta por el estado de un pedido, usá ver_estado_pedido
12. Si el cliente pide ayuda o pregunta qué puede hacer, usá mostrar_menu_ayuda
13. Cuando el cliente quiera calificar su experiencia, usá registrar_calificacion
14. NUNCA muestres múltiples menús en una sola respuesta - solo UN menú a la vez

⚠️ PRODUCTOS Y CARRITO (CRÍTICO):
- SIEMPRE INTENTÁ AGREGAR AL CARRITO cuando el cliente pida productos
- Si el cliente ya vio el menú anteriormente en la conversación, PODÉS agregar productos sin volver a mostrarlo
- Usá el nombre del producto que el cliente menciona (ej: "agua mineral", "pizza pepperoni") - el sistema buscará el producto por nombre
- Si el cliente pide algo que NO existe → Decile que NO lo tenés y mostrá alternativas del menú
- Ejemplos:
  ✅ Cliente: "un agua mineral" → agregar_al_carrito con product_id="agua_mineral" (el sistema resolverá el UUID)
  ✅ Cliente: "pizza pepperoni" → agregar_al_carrito con product_id="pizza_pepperoni"
  ❌ Cliente: "quiero cerveza" (y no hay cerveza en menú) → "No tenemos cerveza, pero tengo otras bebidas..."

⚠️ CREAR PEDIDO vs HABLAR CON VENDEDOR:
- CREAR PEDIDO (crear_pedido): cuando el cliente confirma que TODO está correcto (carrito, dirección, pago)
  Ejemplos: "sí", "correcto", "confirmo", "dale", "está bien", "todo ok", "perfecto"
- HABLAR CON VENDEDOR (hablar_con_vendedor): SOLO cuando el cliente pide explícitamente hablar con el negocio
  Ejemplos: "quiero hablar con el vendedor", "necesito consultar algo", "tengo una duda para el negocio"
  
⚠️ IMPORTANTE: Si el carrito tiene productos, dirección y método de pago, y el cliente confirma → SIEMPRE usar crear_pedido

FLUJO OBLIGATORIO:
1. Cliente busca algo → buscar_productos o ver_locales_abiertos
2. Mostrás resultados con lista de negocios
3. Cliente debe ELEGIR un negocio específico (por nombre o ID)
4. SOLO DESPUÉS de que elija → ver_menu_negocio con el vendor_id correcto
5. Cliente elige productos DEL MENÚ → agregar_al_carrito (SOLO productos que mostraste)
6. Preguntás dirección y método de pago (ver sección 📍 UBICACIÓN abajo)
7. Confirmás datos → crear_pedido

⚠️ IMPORTANTE: NO uses ver_menu_negocio hasta que el cliente especifique cuál negocio quiere ver

📍 UBICACIÓN Y DIRECCIÓN:
${context.user_latitude && context.user_longitude && context.user_latitude !== 0
        ? "- ✅ El usuario YA tiene ubicación → crear_pedido la usará automáticamente"
        : '- ⚠️ El usuario NO tiene ubicación GPS. Opciones:\n  1. IDEAL: "📍 Compartí tu ubicación tocando el clip 📎 en WhatsApp" (valida radio)\n  2. ALTERNATIVA: Usar agregar_direccion_manual si el cliente no puede compartir GPS\n  ⚠️ Las direcciones manuales NO validan radio de entrega - el negocio debe confirmar'
      }
- Una vez que tengas ubicación GPS, crear_pedido validará si el negocio hace delivery a su zona
- Si está fuera de cobertura, el sistema le avisará automáticamente
- ⚠️ Direcciones manuales (sin GPS): El negocio verá una marca especial indicando que debe confirmar cobertura

📍 GESTIÓN DE DIRECCIONES GUARDADAS:
- Cuando el usuario comparta una ubicación 📍, preguntale SIEMPRE:
  "Recibí tu ubicación 📍 [dirección si está disponible]
   ¿Querés usarla solo para este pedido o guardarla para la próxima?
   
   Escribí:
   • TEMP — usar solo para este pedido (se eliminará automáticamente)
   • GUARDAR [nombre] — guardarla con un nombre (ej: Casa, Trabajo)"

- Si el cliente NO puede compartir ubicación GPS:
  • "Escribí tu dirección" → agregar_direccion_manual
  • Ejemplo: "Av. San Martín 1234, Rosario" sin nombre = temporal
  • Ejemplo: "Av. San Martín 1234, Rosario" + "Casa" = guardada

- El cliente puede decir cosas como:
  • "Enviar a Casa" → usar_direccion_guardada
  • "Mis direcciones" → listar_direcciones
  • "Borrar Casa" → borrar_direccion
  • "Renombrar Casa Oficina" → renombrar_direccion
  • "Eliminar mis direcciones" → eliminar_todas_direcciones

- Siempre confirmar acciones de forma natural y amigable
- Recordar que las ubicaciones temporales se eliminan automáticamente

CALIFICACIONES:
- Cuando un cliente quiera calificar, preguntale por separado:
  🚚 Tiempo de entrega (1-5)
  👥 Atención del vendedor (1-5)
  📦 Calidad del producto (1-5)
  💬 Comentario opcional
- Puede dar una o todas las calificaciones
- Siempre agradecé su opinión

💰 COSTO DE DELIVERY:
- Si el cliente pregunta "¿Cuánto me sale el delivery?", "¿Cuál es el costo de envío?" o similar → usar calcular_costo_delivery
- Esta herramienta calculará automáticamente el costo basado en la distancia
- Si el cliente NO tiene ubicación, pedile que la comparta primero
- Algunos negocios tienen delivery gratis (precio $ 0/km) y otros cobran por distancia
- El costo se suma al total del pedido al confirmar

IMPORTANTE: Siempre confirmá antes de crear un pedido. Preguntá dirección y método de pago solo cuando el cliente esté listo para finalizar.`;

    // Preparar mensajes para la API
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: "system", content: systemPrompt },
      ...context.conversation_history.slice(-15), // Últimos 15 mensajes para no saturar
    ];

    console.log("🔄 Calling OpenAI with", messages.length, "messages...");

    let continueLoop = true;
    let finalResponse = "";
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
        temperature: 0.3,
        max_tokens: 800,
      });

      const assistantMessage = completion.choices[0].message;
      console.log("🤖 AI response:", {
        hasContent: !!assistantMessage.content,
        hasToolCalls: !!assistantMessage.tool_calls,
        toolCallsCount: assistantMessage.tool_calls?.length || 0,
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
            content: toolResult,
          });
        }

        // Continuar el loop para que la IA procese los resultados
        continue;
      }

      // Si no hay tool calls, es la respuesta final
      console.log("❌ No tool calls - AI responding directly");
      console.log("   Message content:", assistantMessage.content?.slice(0, 200));
      finalResponse = assistantMessage.content || "Perdón, no entendí. ¿Podés repetir?";
      console.log("✅ Final response ready:", finalResponse.slice(0, 100));
      continueLoop = false;
    }

    if (iterationCount >= MAX_ITERATIONS) {
      console.warn("⚠️ Max iterations reached, forcing response");
      finalResponse = "Disculpá, tuve un problema procesando tu mensaje. ¿Podés intentar de nuevo?";
    }

    // Agregar respuesta del asistente al historial
    context.conversation_history.push({
      role: "assistant",
      content: finalResponse,
    });

    // Guardar contexto actualizado
    await saveContext(context, supabase);
    console.log("💾 Context saved successfully");

    console.log("🤖 AI Bot END - Returning response");
    return finalResponse;
  } catch (error) {
    console.error("❌ AI Bot ERROR:", error);
    console.error("Error details:", {
      name: error.name,
      message: error.message,
      stack: error.stack,
    });
    return "Disculpá, tuve un problema técnico. Por favor intentá de nuevo en un momento.";
  }
}
