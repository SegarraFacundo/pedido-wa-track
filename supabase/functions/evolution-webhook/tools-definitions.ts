import type OpenAI from "npm:openai@4.77.3";

// ==================== DEFINICIONES DE HERRAMIENTAS ====================

export const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
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
        "Muestra la lista completa de negocios/locales disponibles. USA ESTA HERRAMIENTA cuando el cliente diga: 'mostrame los negocios', 'qué negocios hay', 'ver locales', 'locales disponibles', 'que locales hacen delivery', etc.",
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
      description: `Obtiene el menú de UN SOLO negocio específico con todos sus productos y precios.
      TAMBIÉN muestra si el negocio acepta RETIRO EN LOCAL (pickup).

🚨 REGLAS CRÍTICAS:
- SOLO llamar UNA VEZ por turno - NUNCA llamar múltiples veces en paralelo
- Si el usuario dice "ver menús" o "mostrame los negocios" → Usá ver_locales_abiertos, NO esta herramienta
- Solo usar cuando el usuario YA ELIGIÓ un negocio específico
      
✅ PODÉS USAR:
- Número de la lista (ej: "1", "2", "3")
- Nombre del negocio (parcial o completo, ej: "heladería", "pizzeria don luigi")
- El sistema normaliza acentos automáticamente (heladeria = Heladería)

❌ PROHIBIDO: Llamar esta herramienta 2+ veces para mostrar varios menús juntos`,
      parameters: {
        type: "object",
        properties: {
          vendor_id: {
            type: "string",
            description: "Número de la lista O nombre del negocio (parcial o completo)",
          },
        },
        required: ["vendor_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "modificar_carrito_completo",
      description: "Reemplaza el carrito completo con los productos especificados. USAR SOLO cuando el usuario dice 'me equivoqué', 'quiero cambiar todo' o hace correcciones significativas. Más eficiente que agregar/quitar productos uno por uno.",
      parameters: {
        type: "object",
        properties: {
          items: {
            type: "array",
            description: "Array de productos con sus cantidades finales (no incrementales)",
            items: {
              type: "object",
              properties: {
                product_name: {
                  type: "string",
                  description: "Nombre del producto (ej: 'coca cola', 'alfajor')",
                },
                quantity: {
                  type: "number",
                  description: "Cantidad TOTAL deseada (no cuánto agregar/quitar)",
                },
              },
              required: ["product_name", "quantity"],
            },
          },
        },
        required: ["items"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "agregar_al_carrito",
      description:
        `Agrega productos al carrito del cliente.

🚨 REGLAS OBLIGATORIAS:
1. SOLO usar productos que aparecieron en el último ver_menu_negocio
2. Si el producto NO estaba en el menú mostrado → RECHAZAR y pedir que elija del menú
3. El product_name debe ser EXACTO al nombre que apareció en el menú
4. NO inventes productos ni busques en otros negocios
5. Si hay duda → Volver a llamar ver_menu_negocio

Ejemplo CORRECTO:
- Bot muestra menú: "1. Pizza Pepperoni - $45.000"
- Usuario: "dame una pizza pepperoni"
- Bot: agregar_al_carrito({ product_name: "Pizza Pepperoni" })

Ejemplo INCORRECTO:
- Bot muestra menú de Pizzería (NO tiene alfajores)
- Usuario: "agregale un alfajor"
- Bot: ❌ NO debe llamar agregar_al_carrito
- Bot: ✅ Debe responder: "Alfajor no está en el menú de esta pizzería"`,
      parameters: {
        type: "object",
        properties: {
          vendor_id: {
            type: "string",
            description: "ID del negocio (UUID). Opcional si ya hay un negocio en el contexto.",
          },
          items: {
            type: "array",
            items: {
              type: "object",
              properties: {
                product_id: {
                  type: "string",
                  description: "Nombre del producto tal como aparece en el menú (la función lo buscará automáticamente por nombre)"
                },
                product_name: { 
                  type: "string",
                  description: "Nombre del producto tal como aparece en el menú"
                },
                quantity: { 
                  type: "number",
                  description: "Cantidad solicitada por el cliente"
                },
                price: { 
                  type: "number",
                  description: "Precio unitario del producto tal como aparece en el menú"
                },
              },
              required: ["product_id", "product_name", "quantity", "price"],
            },
          },
        },
        required: ["items"],
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
      name: "mostrar_resumen_pedido",
      description: `⚠️ OBLIGATORIO ANTES DE crear_pedido. Muestra resumen completo del pedido para confirmación final.
      
USAR CUANDO:
- Usuario dice "listo", "confirmar", "eso es todo", "hacer el pedido"
- Después de que el usuario eligió método de pago
- SIEMPRE antes de llamar a crear_pedido

MUESTRA:
- Todos los productos del carrito con cantidades y precios
- Tipo de entrega (delivery/pickup)
- Dirección de entrega (solo si es delivery)
- Método de pago seleccionado
- Total con/sin costo de envío
- Pregunta final: "¿Confirmás el pedido?"

🚨 REGLA CRÍTICA: NUNCA llamar crear_pedido sin antes mostrar este resumen.`,
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
      name: "seleccionar_tipo_entrega",
      description: `Permite al cliente elegir entre DELIVERY o RETIRO EN LOCAL.
        Solo disponible si el negocio acepta retiro (allows_pickup = true).
        
        CUÁNDO USAR:
        - Cuando el usuario está listo para confirmar el pedido
        - ANTES de pedir la dirección de entrega
        - Si el negocio tiene allows_pickup = true
        
        IMPORTANTE:
        - Si elige "delivery": pedir dirección y calcular costo de envío
        - Si elige "pickup": NO pedir dirección, indicar que retira en el local`,
      parameters: {
        type: "object",
        properties: {
          tipo: {
            type: "string",
            enum: ["delivery", "pickup"],
            description: "Tipo de entrega: 'delivery' (envío a domicilio) o 'pickup' (retiro en local)"
          }
        },
        required: ["tipo"]
      }
    },
  },
  {
    type: "function",
    function: {
      name: "quitar_producto_carrito",
      description: "Quita UNA UNIDAD de un producto del carrito. Si el producto tiene múltiples unidades, solo decrementa la cantidad. Si tiene 1 unidad, lo remueve completamente. Puedes usar el nombre del producto o su ID.",
      parameters: {
        type: "object",
        properties: {
          product_id: {
            type: "string",
            description: "ID o NOMBRE del producto a quitar (ej: 'alfajor', 'coca cola', o el UUID completo)",
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
      description: "Consulta el estado actual de un pedido. Si no se proporciona order_id, usa automáticamente el último pedido del usuario del contexto.",
      parameters: {
        type: "object",
        properties: {
          order_id: {
            type: "string",
            description: "ID del pedido a consultar (opcional - si no se proporciona, usa el último pedido del contexto)",
          },
        },
        required: [],
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
            description: "UUID del negocio (opcional). Debe ser un UUID, no el nombre. Si no se especifica, usa el negocio del contexto actual.",
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
      description: "⚠️ Cancela un pedido. Si no se proporciona order_id, cancela el último pedido del usuario. SIEMPRE requerir y registrar el motivo de cancelación detallado.",
      parameters: {
        type: "object",
        properties: {
          order_id: {
            type: "string",
            description: "ID del pedido a cancelar (opcional - si no se proporciona, usa el último pedido del usuario. También acepta IDs parciales de 8 caracteres como 'a29eecaa')",
          },
          motivo: {
            type: "string",
            description: "Motivo detallado de la cancelación (OBLIGATORIO, mínimo 10 caracteres)",
          },
        },
        required: ["motivo"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "ver_metodos_pago",
      description: "⚠️ OBLIGATORIO: Obtiene los métodos de pago REALES habilitados por el vendedor seleccionado. DEBES llamar esta herramienta ANTES de pedir al usuario que elija un método de pago. NO asumas que todos los métodos están disponibles. SOLO muestra al usuario las opciones que esta herramienta devuelva.",
      parameters: {
        type: "object",
        properties: {},
        required: [],
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
            description: "Asunto o descripción breve del problema",
          },
          descripcion: {
            type: "string",
            description: "Descripción detallada del problema o consulta",
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
      name: "calificar_plataforma",
      description:
        "Registra una reseña sobre la plataforma Lapacho en general. Permite al cliente calificar su experiencia general con el servicio de Lapacho (1-5 estrellas) y agregar comentarios opcionales.",
      parameters: {
        type: "object",
        properties: {
          rating: {
            type: "number",
            description: "Calificación general de la plataforma Lapacho (1-5 estrellas). REQUERIDO.",
          },
          comment: {
            type: "string",
            description: "Comentario o sugerencia sobre la plataforma. Opcional.",
          },
          customer_name: {
            type: "string",
            description: "Nombre del cliente (opcional, si no se proporciona se usa el teléfono)",
          },
        },
        required: ["rating"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "confirmar_direccion_entrega",
      description: `IMPORTANTE: Usa esta herramienta cuando el cliente proporciona una dirección de entrega para el pedido.
      
Ejemplos de uso:
- "Lavalle 1985"
- "Calle Falsa 123"
- "Av. San Martín 456"
- "Mi dirección es Sarmiento 789"

Esta herramienta guarda la dirección en el contexto del pedido actual.`,
      parameters: {
        type: "object",
        properties: {
          direccion: {
            type: "string",
            description: "La dirección de entrega proporcionada por el cliente",
          },
        },
        required: ["direccion"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "seleccionar_metodo_pago",
      description: `Guarda el método de pago elegido por el cliente.
    
USAR CUANDO:
- El cliente dice "efectivo", "transferencia", "mercadopago", "mp"
- El cliente responde con número ("1", "2", "3") después de ver las opciones de pago
- El cliente confirma un método de pago específico

IMPORTANTE: 
- Solo acepta métodos que estén en available_payment_methods del contexto
- Normaliza automáticamente variaciones como "mp" → "mercadopago"
- Después de guardar, el bot debe continuar con mostrar_resumen_pedido`,
      parameters: {
        type: "object",
        properties: {
          metodo: {
            type: "string",
            enum: ["efectivo", "transferencia", "mercadopago"],
            description: "Método de pago elegido (efectivo, transferencia, mercadopago)"
          }
        },
        required: ["metodo"]
      }
    }
  },
];
