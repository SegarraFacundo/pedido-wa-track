import type OpenAI from "https://esm.sh/openai@4.77.3";

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
      description: `Obtiene el menú completo de un negocio específico con todos sus productos y precios.
      
⚠️ IMPORTANTE: USA EL ID EXACTO (UUID) que devuelve ver_locales_abiertos.
NO inventes IDs en formato snake_case. Si el usuario menciona un negocio pero no tenés 
su ID exacto, primero llamá a ver_locales_abiertos para obtener la lista con IDs reales.`,
      parameters: {
        type: "object",
        properties: {
          vendor_id: {
            type: "string",
            description: "ID del negocio (UUID) - usar el ID exacto de ver_locales_abiertos",
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
        "Agrega uno o más productos al carrito del cliente. ⚠️ CRÍTICO: SOLO usar si ya llamaste a ver_menu_negocio antes para mostrar el menú REAL. Si no hay selected_vendor_id en el contexto, PRIMERO debes llamar ver_menu_negocio. Usa el nombre exacto del producto tal como aparece en el menú mostrado.",
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
      name: "usar_direccion_guardada",
      description: "Selecciona una dirección guardada para usarla en el pedido actual.",
      parameters: {
        type: "object",
        properties: {
          nombre: {
            type: "string",
            description: "Nombre de la dirección guardada a usar (ej: 'Casa')",
          },
        },
        required: ["nombre"],
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
