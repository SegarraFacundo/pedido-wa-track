import type { ConversationContext } from "./types.ts";

// Prompt reducido y determinista - la lógica de validación vive en código, no en texto
export function buildSystemPrompt(context: ConversationContext): string {
  const currentState = context.order_state || "idle";
  const totalCarrito = context.cart.reduce((s, i) => s + i.price * i.quantity, 0);
  
  // Contexto mínimo necesario para que el LLM sepa dónde está parado
  const stateInfo = [
    `ESTADO: ${currentState}`,
    context.selected_vendor_name ? `NEGOCIO: ${context.selected_vendor_name}` : null,
    context.cart.length > 0 ? `CARRITO: ${context.cart.map(i => `${i.quantity}x ${i.product_name}`).join(', ')} ($${totalCarrito})` : `CARRITO: vacío`,
    context.delivery_type ? `ENTREGA: ${context.delivery_type === 'pickup' ? 'RETIRO EN LOCAL' : 'DELIVERY'}` : null,
    context.delivery_address ? `DIRECCIÓN: ${context.delivery_address}` : null,
    context.payment_method ? `PAGO: ${context.payment_method}` : null,
    context.pending_order_id ? `PEDIDO ACTIVO: #${context.pending_order_id.substring(0, 8)}` : null,
  ].filter(Boolean).join('\n');

  // Instrucciones específicas por estado (solo el relevante)
  const stateInstructions = getStateInstructions(currentState, context);

  const lang = context.language || 'es';
  const langInstructions = getLangInstructions(lang);

  return `${langInstructions}

${stateInfo}

${stateInstructions}

REGLAS FIJAS:
- NUNCA inventes datos. Si no sabés algo, usá las herramientas disponibles.
- NUNCA reformatees lo que devuelven las herramientas. Copialo textual.
- NUNCA uses Markdown [texto](url). Los links ya vienen formateados.
- Si el usuario habla de algo ajeno a pedidos: si hay pedido activo ofrecé "estado/cancelar"; si no hay pedido activo ofrecé ver locales.
- Si se queja del servicio del bot → Disculpate y ofrecé ayuda concreta.
- context.cart es la ÚNICA fuente de verdad del carrito. NUNCA uses el historial.`;
}

function getStateInstructions(state: string, context: ConversationContext): string {
  switch (state) {
    case "idle":
      return `Usá buscar_productos o ver_locales_abiertos. NUNCA respondas sobre productos sin llamar una herramienta.`;

    case "browsing":
      return `El usuario está explorando. Si elige un negocio (número o nombre) → ver_menu_negocio. Si busca un producto → buscar_productos. NUNCA inventes resultados.`;

    case "shopping":
      return `Comprando en ${context.selected_vendor_name || "un negocio"}.
- Números ("1", "2") = productos del menú, NO negocios.
- SOLO agregá productos que aparecieron en ver_menu_negocio.
- Si dice "confirmar/listo" → el sistema lo maneja automáticamente.
- Si quiere otro negocio, lo dirá explícitamente.`;

    case "needs_address":
      return `Necesito la dirección de entrega. Todo lo que escriba el usuario (excepto "cancelar") se trata como dirección.`;

    case "checkout":
      return `Elegir método de pago. Métodos disponibles: ${context.available_payment_methods?.join(', ') || 'ninguno cargado'}. Números = opción de la lista.`;

    case "order_pending_cash":
      return `Pedido #${context.pending_order_id?.substring(0, 8) || 'N/A'} creado (pago efectivo). Si pregunta estado → ver_estado_pedido. Si quiere cancelar → preguntar motivo. NO crear otro pedido.`;

    case "order_pending_transfer":
      return `Pedido creado. Esperando confirmación de transferencia (sí/no). El sistema lo maneja automáticamente.`;

    case "order_pending_mp":
      return `Pedido creado. Si pide link de pago, el sistema lo genera. NO inventes links.`;

    case "order_confirmed":
      return `Pedido confirmado, en preparación. Si pregunta estado → ver_estado_pedido.`;

    case "order_completed":
      return `Pedido entregado. Preguntá si todo estuvo bien, sugerí dejar reseña.`;

    case "order_cancelled":
      return `Pedido cancelado. Preguntá si quiere hacer un nuevo pedido.`;

    default:
      return "";
  }
}
