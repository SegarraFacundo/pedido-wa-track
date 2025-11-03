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
  user_latitude?: number;
  user_longitude?: number;
  pending_location_decision?: boolean;  // Nueva: indica si hay ubicación pendiente de decisión
  conversation_history: Array<{role: "user" | "assistant" | "system"; content: string}>;
}

// ==================== GESTIÓN DE CONTEXTO ====================

async function getContext(phone: string, supabase: any): Promise<ConversationContext> {
  const { data } = await supabase
    .from('user_sessions')
    .select('*')
    .eq('phone', phone)
    .maybeSingle();

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
        conversation_history: saved.conversation_history || []
      };
    } catch (e) {
      console.error('Error parsing context:', e);
    }
  }

  return {
    phone,
    cart: [],
    user_latitude: userLatitude,
    user_longitude: userLongitude,
    pending_location_decision: false,
    conversation_history: []
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
    conversation_history: context.conversation_history
  };

  console.log('💾 Saving context:', {
    phone: context.phone,
    cartItems: context.cart.length,
    cartPreview: context.cart.map(i => `${i.product_name} x${i.quantity}`).join(', ') || 'empty',
    vendorId: context.selected_vendor_id
  });

  await supabase
    .from('user_sessions')
    .upsert({
      phone: context.phone,
      previous_state: 'AI_CONVERSATION',
      last_bot_message: JSON.stringify(contextData),
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
      description: "Muestra la lista completa de negocios/locales disponibles. USA ESTA HERRAMIENTA cuando el cliente diga: 'mostrame los negocios', 'qué negocios hay', 'ver locales', 'locales disponibles', 'que locales hacen delivery', etc. Filtra por ubicación automáticamente si el usuario tiene coordenadas guardadas.",
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
      description: "Permite al cliente hablar directamente con el vendedor. Usa el negocio que el cliente tiene seleccionado en el contexto actual.",
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
  },
  {
    type: "function",
    function: {
      name: "registrar_calificacion",
      description: "Registra la calificación y opinión del cliente sobre su pedido. Permite calificar delivery, atención y producto por separado del 1 al 5, además de agregar comentarios opcionales.",
      parameters: {
        type: "object",
        properties: {
          delivery_rating: {
            type: "number",
            description: "Calificación del tiempo de entrega (1-5 estrellas). Opcional."
          },
          service_rating: {
            type: "number",
            description: "Calificación de la atención del vendedor (1-5 estrellas). Opcional."
          },
          product_rating: {
            type: "number",
            description: "Calificación de la calidad del producto (1-5 estrellas). Opcional."
          },
          comment: {
            type: "string",
            description: "Comentario o observación adicional del cliente. Opcional."
          },
          customer_name: {
            type: "string",
            description: "Nombre del cliente (opcional, si no se proporciona se usa el teléfono)"
          }
        },
        required: []
      }
    }
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
            description: "Nombre para identificar la dirección (ej: 'Casa', 'Trabajo', 'Oficina')"
          }
        },
        required: ["nombre"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "usar_direccion_temporal",
      description: "Marca la ubicación actual como temporal. Se usará solo para este pedido y se eliminará automáticamente al finalizar."
    }
  },
  {
    type: "function",
    function: {
      name: "listar_direcciones",
      description: "Muestra todas las direcciones guardadas por el cliente."
    }
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
            description: "Nombre de la dirección a borrar (ej: 'Casa')"
          }
        },
        required: ["nombre"]
      }
    }
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
            description: "Nombre actual de la dirección"
          },
          nombre_nuevo: {
            type: "string",
            description: "Nuevo nombre para la dirección"
          }
        },
        required: ["nombre_viejo", "nombre_nuevo"]
      }
    }
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
            description: "Nombre de la dirección guardada (ej: 'Casa')"
          }
        },
        required: ["nombre"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "eliminar_todas_direcciones",
      description: "Elimina todas las direcciones guardadas del cliente."
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
        // Si el usuario tiene ubicación, usar función de filtrado por radio
        if (context.user_latitude && context.user_longitude) {
          console.log(`📍 User has location, filtering by delivery radius`);
          
          // Primero obtener vendors en rango
          const { data: vendorsInRange, error: rangeError } = await supabase
            .rpc('get_vendors_in_range', {
              user_lat: context.user_latitude,
              user_lon: context.user_longitude
            });
          
          if (rangeError) {
            console.error('Error getting vendors in range:', rangeError);
          }
          
          if (!vendorsInRange || vendorsInRange.length === 0) {
            return `😔 No encontré negocios que hagan delivery a tu ubicación con "${args.consulta}".\n\n💡 Tip: Si te moviste de zona, podés compartir tu nueva ubicación usando el botón 📍 de WhatsApp.`;
          }
          
          // Filtrar solo los vendor IDs que están en rango
          const vendorIdsInRange = vendorsInRange.map((v: any) => v.vendor_id);
          
          // Buscar productos solo en esos vendors
          const { data: searchResults, error: searchError } = await supabase.functions.invoke('search-products', {
            body: { 
              searchQuery: args.consulta,
              vendorIds: vendorIdsInRange  // Filtrar por vendors en rango
            }
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
            resultado += `   Rating: ${r.vendor.average_rating || 'N/A'}⭐\n`;
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
          const { data, error } = await supabase.functions.invoke('search-products', {
            body: { searchQuery: args.consulta }
          });

          console.log('Search products result:', JSON.stringify(data, null, 2));

          if (error || !data?.found) {
            return `No encontré negocios abiertos con "${args.consulta}".\n\n💡 Tip: Si compartís tu ubicación 📍, te puedo mostrar solo los negocios que hacen delivery a tu zona.`;
          }

          // Formatear resultados
          let resultado = `Encontré ${data.totalVendors} negocios con ${data.totalProducts} productos:\n\n⚠️ *Nota:* Sin tu ubicación, te muestro todos los negocios. Para ver solo los que te entregan, compartí tu ubicación 📍.\n\n`;
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
      }

      case "ver_locales_abiertos": {
        // Obtener hora actual en Argentina
        const now = new Date();
        const argentinaTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/Argentina/Buenos_Aires' }));
        const currentDay = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][argentinaTime.getDay()];
        const currentTime = argentinaTime.toTimeString().slice(0, 5); // HH:MM formato

        console.log(`🕒 Buscando locales abiertos - Día: ${currentDay}, Hora: ${currentTime}`);

        // Si el usuario tiene ubicación, filtrar por radio
        if (context.user_latitude && context.user_longitude) {
          console.log(`📍 User has location, filtering by delivery radius`);
          
          const { data: vendorsInRange, error: rangeError } = await supabase
            .rpc('get_vendors_in_range', {
              user_lat: context.user_latitude,
              user_lon: context.user_longitude
            });
          
          console.log(`📊 Vendors in range:`, JSON.stringify(vendorsInRange, null, 2));
          
          if (rangeError) {
            console.error('Error getting vendors in range:', rangeError);
            return 'Hubo un error al buscar negocios cerca tuyo. Por favor intenta de nuevo.';
          }
          
          if (!vendorsInRange || vendorsInRange.length === 0) {
            return `😔 No hay negocios que hagan delivery a tu ubicación${args.categoria ? ` de tipo "${args.categoria}"` : ''}.\n\n💡 Podés:\n- Buscar en otra categoría\n- Actualizar tu ubicación si te moviste 📍`;
          }
          
          // Filtrar por categoría si se especifica
          let filteredVendors = vendorsInRange;
          if (args.categoria) {
            // Necesitamos obtener la categoría de cada vendor
            const vendorIds = vendorsInRange.map((v: any) => v.vendor_id);
            const { data: vendorDetails } = await supabase
              .from('vendors')
              .select('id, category')
              .in('id', vendorIds);
            
            const vendorCategories = new Map(vendorDetails?.map((v: any) => [v.id, v.category]) || []);
            filteredVendors = vendorsInRange.filter((v: any) => 
              vendorCategories.get(v.vendor_id) === args.categoria
            );
          }
          
          // Separar abiertos y cerrados, pero MOSTRAR AMBOS
          const openVendors = filteredVendors.filter((v: any) => v.is_open);
          const closedVendors = filteredVendors.filter((v: any) => !v.is_open);
          
          if (filteredVendors.length === 0) {
            return args.categoria
              ? `No hay negocios de tipo "${args.categoria}" que lleguen a tu zona. 😔`
              : 'No hay negocios que lleguen a tu zona en este momento. 😔';
          }
          
          // Obtener detalles completos de vendors
          const vendorIds = filteredVendors.map((v: any) => v.vendor_id);
          
          const { data: fullVendors } = await supabase
            .from('vendors')
            .select('id, name, category, address, opening_time, closing_time, average_rating, total_reviews')
            .in('id', vendorIds);
          
          console.log(`📋 Full vendors from DB:`, JSON.stringify(fullVendors, null, 2));
          
          const vendorMap = new Map(fullVendors?.map((v: any) => [v.id, v]) || []);
          
          // Formatear resultados - PRIMERO abiertos, DESPUÉS cerrados
          let resultado = `¡Aquí tenés ${filteredVendors.length} ${filteredVendors.length === 1 ? 'negocio' : 'negocios'} que hacen delivery a tu zona! 🚗\n\n`;
          
          console.log(`📝 Starting to format results. Open: ${openVendors.length}, Closed: ${closedVendors.length}`);
          
          if (openVendors.length > 0) {
            resultado += `🟢 *ABIERTOS AHORA* (${openVendors.length}):\n\n`;
            openVendors.forEach((v: any, i: number) => {
              const vendor = vendorMap.get(v.vendor_id);
              console.log(`🔍 Processing vendor ${i + 1}:`, {
                vendor_id: v.vendor_id,
                vendor_name: v.vendor_name,
                distance_km: v.distance_km,
                vendorFromDB: vendor ? {
                  id: vendor.id,
                  name: vendor.name,
                  address: vendor.address
                } : 'NOT FOUND'
              });
              
              if (!vendor) {
                // Mostrar info básica aunque no tengamos detalles completos
                resultado += `${i + 1}. ${v.vendor_name} 📦\n`;
                resultado += `   📍 A ${v.distance_km.toFixed(1)} km de distancia\n`;
                resultado += `   ID: ${v.vendor_id}\n\n`;
                return;
              }
              
              resultado += `${i + 1}. ${vendor.name}\n`;
              resultado += `   📍 ${vendor.address} - A ${v.distance_km.toFixed(1)} km\n`;
              resultado += `   ID: ${vendor.id}\n`;
              if (vendor.opening_time && vendor.closing_time) {
                resultado += `   ⏰ Horario: ${vendor.opening_time.substring(0,5)} - ${vendor.closing_time.substring(0,5)}\n`;
              }
              if (vendor.average_rating && vendor.total_reviews) {
                resultado += `   ⭐ Rating: ${vendor.average_rating.toFixed(1)} (${vendor.total_reviews} reseñas)\n`;
              }
              resultado += `\n`;
            });
          }
          
          if (closedVendors.length > 0) {
            resultado += `🔴 *CERRADOS* (${closedVendors.length}):\n\n`;
            closedVendors.forEach((v: any, i: number) => {
              const vendor = vendorMap.get(v.vendor_id);
              
              if (!vendor) {
                // Mostrar info básica aunque no tengamos detalles completos
                resultado += `${i + 1}. ${v.vendor_name} 🔒\n`;
                resultado += `   📍 A ${v.distance_km.toFixed(1)} km de distancia\n`;
                resultado += `   ID: ${v.vendor_id}\n\n`;
                return;
              }
              
              resultado += `${i + 1}. ${vendor.name} 🔒\n`;
              resultado += `   📍 ${vendor.address} - A ${v.distance_km.toFixed(1)} km\n`;
              resultado += `   ID: ${vendor.id}\n`;
              if (vendor.opening_time && vendor.closing_time) {
                resultado += `   ⏰ Horario: ${vendor.opening_time.substring(0,5)} - ${vendor.closing_time.substring(0,5)}\n`;
              }
              if (vendor.average_rating && vendor.total_reviews) {
                resultado += `   ⭐ Rating: ${vendor.average_rating.toFixed(1)} (${vendor.total_reviews} reseñas)\n`;
              }
              resultado += `\n`;
            });
          }
          
          resultado += `\n💡 Para ver el menú de alguno, decime el nombre o ID del negocio.`;
          
          return resultado;
        } else {
          // Sin ubicación, búsqueda normal pero informar
          let query = supabase
            .from('vendors')
            .select('id, name, category, address, opening_time, closing_time, days_open, average_rating, total_reviews, latitude, longitude, delivery_radius_km')
            .eq('is_active', true)
            .eq('payment_status', 'active');

          // Filtrar por categoría si se especifica
          if (args.categoria) {
            query = query.eq('category', args.categoria);
          }

          const { data: vendors, error } = await query;

          if (error || !vendors || vendors.length === 0) {
            return args.categoria 
              ? `No encontré negocios de tipo "${args.categoria}" disponibles.\n\n💡 Tip: Compartí tu ubicación 📍 para ver solo los que te entregan.`
              : 'No hay negocios disponibles en este momento.\n\n💡 Tip: Compartí tu ubicación 📍 para ver solo los que te entregan.';
          }

          // Filtrar locales que están abiertos ahora
          const openVendors = vendors.filter(vendor => {
            if (!vendor.days_open || !vendor.days_open.includes(currentDay)) {
              return false;
            }
            if (!vendor.opening_time || !vendor.closing_time) {
              return false;
            }
            return currentTime >= vendor.opening_time && currentTime <= vendor.closing_time;
          });

          if (openVendors.length === 0) {
            return args.categoria
              ? `No hay negocios de tipo "${args.categoria}" abiertos en este momento. 😔\n\n💡 Tip: Compartí tu ubicación 📍 para ver solo los que te entregan.`
              : 'No hay negocios abiertos en este momento. 😔\n\n💡 Tip: Compartí tu ubicación 📍 para ver solo los que te entregan.';
          }

          // Formatear resultados
          let resultado = `🟢 Encontré ${openVendors.length} ${openVendors.length === 1 ? 'negocio abierto' : 'negocios abiertos'}:\n\n⚠️ *Sin ubicación:* Te muestro todos. Para ver solo los que te entregan, compartí tu ubicación 📍\n\n`;
          openVendors.forEach((v: any, i: number) => {
            resultado += `${i + 1}. ${v.name} (${v.category})\n`;
            resultado += `   ID: ${v.id}\n`;
            resultado += `   📍 ${v.address}\n`;
            resultado += `   ⏰ Horario: ${v.opening_time} - ${v.closing_time}\n`;
            if (v.average_rating) {
              resultado += `   ⭐ Rating: ${v.average_rating} (${v.total_reviews || 0} reseñas)\n`;
            }
            if (v.latitude && v.longitude && v.delivery_radius_km) {
              resultado += `   🚗 Radio de cobertura: ${v.delivery_radius_km} km\n`;
            }
            resultado += `\n`;
          });

          return resultado;
        }
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
        
        console.log('🛒 agregar_al_carrito called:', {
          vendor_id: args.vendor_id,
          items: items.map(i => `${i.product_name} x${i.quantity}`),
          currentCart: context.cart.length
        });
        
        // CRITICAL: Resolver vendor_id si no es un UUID válido
        let vendorId = args.vendor_id;
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        
        if (!uuidRegex.test(vendorId)) {
          console.log(`⚠️ Invalid vendor_id format: "${vendorId}", attempting to find by name`);
          
          // Limpiar el input
          const cleanedName = vendorId
            .replace(/-/g, ' ')
            .replace(/_/g, ' ')
            .trim();
          
          const { data: vendor } = await supabase
            .from('vendors')
            .select('id, name')
            .ilike('name', `%${cleanedName}%`)
            .maybeSingle();
          
          if (vendor) {
            vendorId = vendor.id;
            console.log(`✅ Found vendor by name: ${vendor.name} (${vendorId})`);
          } else {
            return `No encontré el negocio "${args.vendor_id}". Por favor usá el ID correcto del menú.`;
          }
        }
        
        // Si hay items en el carrito pero son de otro negocio, vaciar el carrito
        if (context.cart.length > 0 && context.selected_vendor_id && vendorId !== context.selected_vendor_id) {
          context.cart = [];
          console.log('🗑️ Carrito vaciado porque cambiaste de negocio');
        }
        
        // Actualizar el vendor seleccionado con el UUID correcto
        context.selected_vendor_id = vendorId;
        
        // Obtener nombre del vendor
        if (!context.selected_vendor_name || context.selected_vendor_id !== vendorId) {
          const { data: vendor } = await supabase
            .from('vendors')
            .select('name')
            .eq('id', vendorId)
            .single();
          if (vendor) {
            context.selected_vendor_name = vendor.name;
            console.log(`✅ Vendor set: ${vendor.name} (${vendorId})`);
          }
        }

        // ⚠️ VALIDACIÓN CRÍTICA: Verificar que TODOS los productos existan en la BD
        const productIds = items.map(item => item.product_id);
        const { data: existingProducts, error: productError } = await supabase
          .from('products')
          .select('id, name, price, vendor_id')
          .eq('vendor_id', vendorId)
          .eq('is_available', true)
          .in('id', productIds);

        if (productError) {
          console.error('Error validating products:', productError);
          return 'Hubo un error al validar los productos. Intentá de nuevo.';
        }

        // Verificar que todos los productos existan
        const invalidItems = items.filter(item => 
          !existingProducts?.some(p => p.id === item.product_id)
        );

        if (invalidItems.length > 0) {
          const invalidNames = invalidItems.map(i => i.product_name).join(', ');
          return `❌ Los siguientes productos NO existen en el menú de ${context.selected_vendor_name}: ${invalidNames}.\n\nPor favor, primero mirá el menú con "ver menú de ${context.selected_vendor_name}" y elegí productos que realmente existen.`;
        }

        // Verificar precios correctos
        for (const item of items) {
          const dbProduct = existingProducts?.find(p => p.id === item.product_id);
          if (dbProduct && Math.abs(Number(dbProduct.price) - item.price) > 0.01) {
            console.warn(`Price mismatch for ${item.product_name}: expected ${dbProduct.price}, got ${item.price}`);
            item.price = Number(dbProduct.price); // Corregir precio
          }
        }
        
        // Agregar productos validados al carrito
        items.forEach(item => {
          const existing = context.cart.find(c => c.product_id === item.product_id);
          if (existing) {
            existing.quantity += item.quantity;
          } else {
            context.cart.push(item);
          }
        });

        const total = context.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        
        console.log('✅ Cart updated:', {
          totalItems: context.cart.length,
          items: context.cart.map(i => `${i.product_name} x${i.quantity}`),
          total
        });
        
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
        console.log('🛒 crear_pedido called with context:', {
          cartLength: context.cart.length,
          cartPreview: context.cart.map(i => `${i.product_name} x${i.quantity}`).join(', '),
          vendorId: context.selected_vendor_id,
          vendorName: context.selected_vendor_name,
          address: args.direccion,
          paymentMethod: args.metodo_pago,
          userLocation: context.user_latitude ? `${context.user_latitude},${context.user_longitude}` : 'none'
        });

        if (context.cart.length === 0) {
          return 'No podés crear un pedido con el carrito vacío. ¿Querés que te muestre productos disponibles?';
        }

        if (!context.selected_vendor_id) {
          console.error('❌ No vendor_id in context!');
          return 'Error: No hay negocio seleccionado. Por favor elegí un negocio antes de hacer el pedido.';
        }

        // 📍 VALIDACIÓN DE UBICACIÓN Y COBERTURA
        if (context.user_latitude && context.user_longitude) {
          // Usuario tiene ubicación, validar cobertura
          const { data: vendor } = await supabase
            .from('vendors')
            .select('id, name, latitude, longitude, delivery_radius_km, address')
            .eq('id', context.selected_vendor_id)
            .single();

          if (vendor?.latitude && vendor?.longitude && vendor?.delivery_radius_km) {
            // Calcular distancia
            const { data: distanceResult, error: distError } = await supabase
              .rpc('calculate_distance', {
                lat1: context.user_latitude,
                lon1: context.user_longitude,
                lat2: vendor.latitude,
                lon2: vendor.longitude
              });

            if (!distError && distanceResult !== null) {
              console.log(`📏 Distance: ${distanceResult}km, Max: ${vendor.delivery_radius_km}km`);
              
              if (distanceResult > vendor.delivery_radius_km) {
                return `😔 Lo siento, ${vendor.name} no hace delivery a tu ubicación.\n\n📍 Tu ubicación está a ${distanceResult.toFixed(1)} km del local.\n🚗 Radio de cobertura: ${vendor.delivery_radius_km} km\n\n💡 Podés buscar otros negocios más cercanos o actualizar tu ubicación.`;
              }
            }
          }

          // Si llegamos acá, está dentro del radio o no se pudo validar
          // Usar la dirección de la ubicación guardada si no se especificó una
          if (!args.direccion || args.direccion.trim() === '') {
            // Si tiene location_name o location_address guardados, usarlos
            const { data: session } = await supabase
              .from('user_sessions')
              .select('location_name, location_address')
              .eq('phone', context.phone)
              .maybeSingle();

            if (session?.location_address) {
              args.direccion = session.location_address;
              console.log(`✅ Using saved location address: ${args.direccion}`);
            } else if (session?.location_name) {
              args.direccion = session.location_name;
              console.log(`✅ Using saved location name: ${args.direccion}`);
            } else {
              args.direccion = `Lat: ${context.user_latitude.toFixed(6)}, Lon: ${context.user_longitude.toFixed(6)}`;
              console.log(`✅ Using coordinates as address: ${args.direccion}`);
            }
          }
        } else {
          // Sin ubicación, pedir que la comparta
          if (!args.direccion || args.direccion.trim() === '') {
            return `📍 Para confirmar tu pedido, necesito que compartas tu ubicación.\n\n👉 Tocá el clip 📎 en WhatsApp y elegí "Ubicación"\n\nAsí puedo verificar que ${context.selected_vendor_name} hace delivery a tu zona. 🚗`;
          }
        }

        // 🚫 Verificar si el usuario ya tiene un pedido activo
        const { data: activeOrder } = await supabase
          .from('orders')
          .select('id, status, vendor_id')
          .eq('customer_phone', context.phone)
          .in('status', ['pending', 'confirmed', 'preparing', 'ready', 'delivering'])
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (activeOrder) {
          const { data: vendor } = await supabase
            .from('vendors')
            .select('name')
            .eq('id', activeOrder.vendor_id)
            .single();
          
          return `⚠️ Ya tenés un pedido en curso (#${activeOrder.id.substring(0, 8)}) con ${vendor?.name || 'un negocio'} en estado "${activeOrder.status}".\n\nPor favor esperá a que se complete o cancele ese pedido antes de hacer uno nuevo.`;
        }

        // Validar que la dirección y método de pago estén presentes
        if (!args.direccion || args.direccion.trim() === '') {
          return 'Por favor indicá tu dirección de entrega.';
        }

        if (!args.metodo_pago) {
          return 'Por favor seleccioná un método de pago (efectivo, transferencia o mercadopago).';
        }

        context.delivery_address = args.direccion;
        context.payment_method = args.metodo_pago;

        const total = context.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

        console.log('📤 Inserting order:', {
          vendor_id: context.selected_vendor_id,
          customer_phone: context.phone,
          items_count: context.cart.length,
          total,
          address: context.delivery_address,
          payment_method: context.payment_method
        });

        const { data: order, error } = await supabase
          .from('orders')
          .insert({
            vendor_id: context.selected_vendor_id,
            customer_name: context.phone,
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
          console.error('❌ Error creating order:', error);
          console.error('Error details:', JSON.stringify(error, null, 2));
          return `Hubo un error al crear el pedido: ${error.message}. Por favor intentá de nuevo o contactá con el vendedor.`;
        }

        console.log('✅ Order created successfully:', order.id);

        context.pending_order_id = order.id;
        
        // 🗑️ Eliminar direcciones temporales después de crear el pedido
        try {
          const { error: deleteError } = await supabase
            .from('saved_addresses')
            .delete()
            .eq('phone', context.phone)
            .eq('is_temporary', true);
          
          if (deleteError) {
            console.error('Error deleting temporary addresses:', deleteError);
          } else {
            console.log('🧹 Temporary addresses cleaned up');
          }
        } catch (cleanupError) {
          console.error('Error in cleanup process:', cleanupError);
        }
        
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
        console.log('🔄 Switching to vendor chat mode');
        
        // Usar vendor_id del contexto si está disponible
        let vendorId = context.selected_vendor_id;
        
        if (!vendorId) {
          return 'Primero necesito que selecciones un negocio. Podés buscar productos o locales para elegir con quién querés hablar.';
        }
        
        // Validar que sea un UUID válido
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(vendorId)) {
          console.log(`⚠️ Invalid vendor_id format: "${vendorId}", attempting to find by name`);
          
          // Intentar buscar por nombre si no es UUID
          const { data: foundVendor } = await supabase
            .from('vendors')
            .select('id, name')
            .ilike('name', `%${vendorId}%`)
            .maybeSingle();
          
          if (foundVendor) {
            vendorId = foundVendor.id;
            context.selected_vendor_id = foundVendor.id; // Actualizar contexto con UUID correcto
            console.log(`✅ Found vendor by name: ${foundVendor.name} (${foundVendor.id})`);
          } else {
            return 'No pude encontrar el negocio seleccionado. Por favor buscá locales o productos de nuevo.';
          }
        }
        
        // Obtener información del vendedor
        const { data: vendor, error: vendorError } = await supabase
          .from('vendors')
          .select('phone, whatsapp_number, name')
          .eq('id', vendorId)
          .single();
        
        if (vendorError || !vendor) {
          console.error('Error getting vendor:', vendorError);
          return 'Hubo un problema al conectar con el negocio. Por favor intentá de nuevo.';
        }
        
        const vendorPhone = vendor.whatsapp_number || vendor.phone;
        
        // Actualizar sesión del usuario
        const { error } = await supabase
          .from('user_sessions')
          .upsert({
            phone: context.phone,
            assigned_vendor_phone: vendorPhone,
            in_vendor_chat: true,
            updated_at: new Date().toISOString()
          }, { onConflict: 'phone' });

        if (error) {
          console.error('Error updating session:', error);
        }

        let mensaje = `👤 *Conectando con ${vendor.name}*\n\n`;
        mensaje += 'Un representante del negocio te atenderá en breve. Los mensajes que envíes ahora irán directamente al vendedor.\n\n';
        mensaje += 'Para volver al bot automático, el vendedor puede reactivarlo desde su panel.';
        
        return mensaje;
      }

      case "registrar_calificacion": {
        // Validar que tengamos al menos una calificación o comentario
        if (!args.delivery_rating && !args.service_rating && !args.product_rating && !args.comment) {
          return 'Por favor proporciona al menos una calificación (delivery, atención o producto) o un comentario.';
        }

        // Buscar el pedido más reciente del cliente
        const { data: recentOrder } = await supabase
          .from('orders')
          .select('id, vendor_id')
          .eq('customer_phone', context.phone)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!recentOrder) {
          return 'No encontré ningún pedido reciente para calificar. Intenta de nuevo después de realizar un pedido.';
        }

        // Calcular rating general (promedio de los ratings proporcionados)
        const ratings = [
          args.delivery_rating,
          args.service_rating,
          args.product_rating
        ].filter(r => r !== null && r !== undefined);
        
        const averageRating = ratings.length > 0
          ? Math.round(ratings.reduce((a: number, b: number) => a + b, 0) / ratings.length)
          : null;

        // Insertar review
        const { error } = await supabase
          .from('vendor_reviews')
          .insert({
            vendor_id: recentOrder.vendor_id,
            order_id: recentOrder.id,
            customer_phone: context.phone,
            customer_name: args.customer_name || context.phone,
            rating: averageRating,
            delivery_rating: args.delivery_rating,
            service_rating: args.service_rating,
            product_rating: args.product_rating,
            comment: args.comment
          });

        if (error) {
          console.error('Error saving review:', error);
          return 'Hubo un error al guardar tu calificación. Por favor intenta de nuevo.';
        }

        let respuesta = '⭐ *¡Gracias por tu calificación!*\n\n';
        respuesta += '📊 *Tu calificación:*\n';
        if (args.delivery_rating) respuesta += `🚚 Tiempo de entrega: ${args.delivery_rating}/5\n`;
        if (args.service_rating) respuesta += `👥 Atención: ${args.service_rating}/5\n`;
        if (args.product_rating) respuesta += `📦 Producto: ${args.product_rating}/5\n`;
        if (args.comment) respuesta += `\n💬 Comentario: "${args.comment}"\n`;
        respuesta += '\nTu opinión nos ayuda a mejorar. ¡Gracias por confiar en nosotros! 😊';

        return respuesta;
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
        if (!context.user_latitude || !context.user_longitude) {
          return '⚠️ No tengo tu ubicación guardada. Por favor compartí tu ubicación usando el botón 📍 de WhatsApp primero.';
        }

        // Validar nombre
        const nombre = args.nombre.trim();
        if (!nombre || nombre.length < 2) {
          return 'Por favor elegí un nombre más descriptivo para tu dirección (mínimo 2 caracteres).';
        }

        // Buscar si ya existe una dirección con ese nombre
        const { data: existing } = await supabase
          .from('saved_addresses')
          .select('id')
          .eq('phone', context.phone)
          .eq('name', nombre)
          .maybeSingle();

        if (existing) {
          return `Ya tenés una dirección guardada con el nombre "${nombre}". Podés borrarla primero o usar otro nombre.`;
        }

        // Guardar dirección
        const { error } = await supabase
          .from('saved_addresses')
          .insert({
            phone: context.phone,
            name: nombre,
            address: context.delivery_address || 'Ubicación guardada',
            latitude: context.user_latitude,
            longitude: context.user_longitude,
            is_temporary: false
          });

        if (error) {
          console.error('Error saving address:', error);
          return 'Hubo un problema al guardar tu dirección. Intentá de nuevo.';
        }

        return `✅ Listo, guardé tu dirección como "${nombre}" 📍\n\nLa próxima vez podés decir *"Enviar a ${nombre}"* para usarla rápido. 😊`;
      }

      case "usar_direccion_temporal": {
        if (!context.user_latitude || !context.user_longitude) {
          return '⚠️ No tengo tu ubicación guardada. Por favor compartí tu ubicación usando el botón 📍 de WhatsApp primero.';
        }

        // Marcar como temporal
        context.pending_location_decision = false;
        
        return `Perfecto 👍 Usaré esta ubicación solo para este pedido.\n\n⚠️ *Importante:* Esta dirección se eliminará automáticamente al finalizar el pedido.\n\n¿Qué te gustaría pedir? 😊`;
      }

      case "listar_direcciones": {
        const { data: addresses, error } = await supabase
          .from('saved_addresses')
          .select('*')
          .eq('phone', context.phone)
          .eq('is_temporary', false)
          .order('created_at', { ascending: false });

        if (error) {
          console.error('Error fetching addresses:', error);
          return 'Hubo un problema al obtener tus direcciones. Intentá de nuevo.';
        }

        if (!addresses || addresses.length === 0) {
          return '📍 No tenés direcciones guardadas todavía.\n\nPodés compartir tu ubicación 📍 y guardarla con un nombre (ej: "Casa", "Trabajo") para usarla en futuros pedidos. 😊';
        }

        let resultado = `📍 *Tus direcciones guardadas:*\n\n`;
        addresses.forEach((addr: any, i: number) => {
          resultado += `${i + 1}. 🏠 *${addr.name}*\n`;
          resultado += `   ${addr.address}\n`;
          resultado += `   _Guardada el ${new Date(addr.created_at).toLocaleDateString('es-AR')}_\n\n`;
        });
        resultado += `💡 Podés decir *"Enviar a ${addresses[0].name}"* para usar una dirección o *"Borrar ${addresses[0].name}"* para eliminarla.`;

        return resultado;
      }

      case "borrar_direccion": {
        const nombre = args.nombre.trim();
        
        const { data: address } = await supabase
          .from('saved_addresses')
          .select('id')
          .eq('phone', context.phone)
          .eq('name', nombre)
          .eq('is_temporary', false)
          .maybeSingle();

        if (!address) {
          return `No encontré una dirección llamada "${nombre}".\n\nPodés ver tus direcciones diciendo "Mis direcciones". 📍`;
        }

        const { error } = await supabase
          .from('saved_addresses')
          .delete()
          .eq('id', address.id);

        if (error) {
          console.error('Error deleting address:', error);
          return 'Hubo un problema al borrar la dirección. Intentá de nuevo.';
        }

        return `✅ Listo, eliminé la dirección "${nombre}". 🗑️`;
      }

      case "renombrar_direccion": {
        const nombreViejo = args.nombre_viejo.trim();
        const nombreNuevo = args.nombre_nuevo.trim();

        if (!nombreNuevo || nombreNuevo.length < 2) {
          return 'Por favor elegí un nombre más descriptivo (mínimo 2 caracteres).';
        }

        // Buscar dirección a renombrar
        const { data: address } = await supabase
          .from('saved_addresses')
          .select('id')
          .eq('phone', context.phone)
          .eq('name', nombreViejo)
          .eq('is_temporary', false)
          .maybeSingle();

        if (!address) {
          return `No encontré una dirección llamada "${nombreViejo}".\n\nPodés ver tus direcciones diciendo "Mis direcciones". 📍`;
        }

        // Verificar que el nuevo nombre no exista
        const { data: existing } = await supabase
          .from('saved_addresses')
          .select('id')
          .eq('phone', context.phone)
          .eq('name', nombreNuevo)
          .maybeSingle();

        if (existing) {
          return `Ya tenés una dirección con el nombre "${nombreNuevo}". Elegí otro nombre. 😊`;
        }

        // Renombrar
        const { error } = await supabase
          .from('saved_addresses')
          .update({ name: nombreNuevo })
          .eq('id', address.id);

        if (error) {
          console.error('Error renaming address:', error);
          return 'Hubo un problema al renombrar la dirección. Intentá de nuevo.';
        }

        return `✅ Listo, renombré "${nombreViejo}" a "${nombreNuevo}". 📝`;
      }

      case "usar_direccion_guardada": {
        const nombre = args.nombre.trim();
        
        const { data: address, error } = await supabase
          .from('saved_addresses')
          .select('*')
          .eq('phone', context.phone)
          .eq('name', nombre)
          .eq('is_temporary', false)
          .maybeSingle();

        if (error || !address) {
          return `No encontré una dirección llamada "${nombre}".\n\nPodés ver tus direcciones diciendo "Mis direcciones" 📍 o compartir una nueva ubicación.`;
        }

        // Actualizar contexto con la dirección guardada
        context.user_latitude = parseFloat(address.latitude);
        context.user_longitude = parseFloat(address.longitude);
        context.delivery_address = address.address;

        // Actualizar en user_sessions
        await supabase
          .from('user_sessions')
          .upsert({
            phone: context.phone,
            user_latitude: context.user_latitude,
            user_longitude: context.user_longitude,
            updated_at: new Date().toISOString()
          }, { onConflict: 'phone' });

        return `📍 Perfecto, voy a usar tu dirección "${nombre}".\n\n${address.address}\n\n¿Qué te gustaría pedir? 😊`;
      }

      case "eliminar_todas_direcciones": {
        const { error } = await supabase
          .from('saved_addresses')
          .delete()
          .eq('phone', context.phone)
          .eq('is_temporary', false);

        if (error) {
          console.error('Error deleting all addresses:', error);
          return 'Hubo un problema al eliminar tus direcciones. Intentá de nuevo.';
        }

        return `✅ Listo, eliminé todas tus ubicaciones guardadas. 💬\n\nPodés compartir tu ubicación 📍 cuando quieras hacer un nuevo pedido.`;
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
      cartPreview: context.cart.map(i => `${i.product_name} x${i.quantity}`).join(', ') || 'empty',
      vendor: context.selected_vendor_name,
      vendorId: context.selected_vendor_id,
      historyLength: context.conversation_history.length,
      hasLocation: !!(context.user_latitude && context.user_longitude)
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
${context.user_latitude && context.user_longitude ? `- ✅ Usuario tiene ubicación guardada (lat: ${context.user_latitude}, lng: ${context.user_longitude})` : '- ⚠️ Usuario NO compartió su ubicación aún'}

📍 UBICACIÓN Y FILTRADO:
${context.user_latitude && context.user_longitude 
  ? '- El usuario YA compartió su ubicación → Solo verá negocios que entregan en su zona'
  : '- El usuario NO compartió ubicación → Verá todos los negocios, pero es recomendable pedirle que la comparta'
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
- NUNCA agregues productos inventados o que no existen en el menú
- Si el cliente pide algo que NO está en el menú → Decile que NO lo tenés y mostrá alternativas del menú
- Ejemplos de lo que NO hacer:
  ❌ Cliente: "quiero cerveza" → NO agregues "cerveza artesanal" si no está en el menú
  ❌ Cliente: "quiero whisky" → NO agregues "whisky" si no está en el menú
  ✅ Cliente: "quiero cerveza" → "Lamentablemente no tenemos whisky/cerveza en este momento. ¿Te puedo mostrar lo que sí tenemos?"
- SIEMPRE mostrá el menú antes de agregar productos al carrito
- Los product_id que uses en agregar_al_carrito DEBEN ser los mismos que mostraste en ver_menu_negocio

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
${context.user_latitude && context.user_longitude 
  ? '- ✅ El usuario YA tiene ubicación → crear_pedido la usará automáticamente'
  : '- ⚠️ IMPORTANTE: Si el usuario NO tiene ubicación, ANTES de crear el pedido decile:\n  "📍 Para confirmar tu pedido, compartí tu ubicación tocando el clip 📎 en WhatsApp y eligiendo Ubicación"\n  NO aceptes direcciones escritas si no tiene ubicación - necesitamos validar cobertura'
}
- Una vez que tengas ubicación, crear_pedido validará si el negocio hace delivery a su zona
- Si está fuera de cobertura, el sistema le avisará automáticamente

📍 GESTIÓN DE DIRECCIONES GUARDADAS (NUEVO):
- Cuando el usuario comparta una ubicación 📍, preguntale SIEMPRE:
  "Recibí tu ubicación 📍 [dirección si está disponible]
   ¿Querés usarla solo para este pedido o guardarla para la próxima?
   
   Escribí:
   • TEMP — usar solo para este pedido (se eliminará automáticamente)
   • GUARDAR [nombre] — guardarla con un nombre (ej: Casa, Trabajo)"

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
        temperature: 0.3,
        max_tokens: 800
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
