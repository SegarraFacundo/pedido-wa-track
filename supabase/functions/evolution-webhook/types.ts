// ==================== INTERFACES ====================

// ==================== ORDER STATE FLOW ====================
// Flujo simplificado con estados claros y validación de transiciones

export type OrderState = 
  | "idle"                    // Sin pedido activo, usuario puede explorar
  | "browsing"                // Viendo negocios disponibles
  | "shopping"                // Agregando productos al carrito (merge de viewing_menu, adding_items, reviewing_cart)
  | "needs_address"           // Necesita proporcionar dirección de entrega
  | "checkout"                // Seleccionando método de pago
  | "order_pending_cash"      // Pedido creado, esperando pago en efectivo al delivery
  | "order_pending_transfer"  // Pedido creado, esperando comprobante de transferencia
  | "order_pending_mp"        // Pedido creado, esperando confirmación de MercadoPago
  | "order_confirmed"         // Pedido confirmado con pago validado
  | "order_completed"         // Pedido entregado exitosamente
  | "order_cancelled";        // Pedido cancelado

// Valid state transitions
export const STATE_TRANSITIONS: Record<OrderState, OrderState[]> = {
  idle: ["browsing", "shopping"],
  browsing: ["idle", "shopping"],
  shopping: ["idle", "browsing", "needs_address", "order_cancelled"],
  needs_address: ["shopping", "checkout", "order_cancelled"],
  checkout: ["shopping", "needs_address", "order_pending_cash", "order_pending_transfer", "order_pending_mp", "order_cancelled"],
  order_pending_cash: ["order_confirmed", "order_cancelled"],
  order_pending_transfer: ["order_confirmed", "order_cancelled"],
  order_pending_mp: ["order_confirmed", "order_cancelled"],
  order_confirmed: ["order_completed", "order_cancelled"],
  order_completed: ["idle"],
  order_cancelled: ["idle"]
};

// Validate if a state transition is allowed
export function canTransitionTo(from: OrderState | undefined, to: OrderState): boolean {
  if (!from) return to === "idle" || to === "browsing";
  
  const allowedTransitions = STATE_TRANSITIONS[from];
  return allowedTransitions?.includes(to) ?? false;
}

// Helper to get pending state based on payment method
export function getPendingStateForPayment(paymentMethod: string): OrderState {
  const normalized = paymentMethod.toLowerCase();
  
  if (normalized.includes("efectivo")) return "order_pending_cash";
  if (normalized.includes("transferencia")) return "order_pending_transfer";
  if (normalized.includes("mercadopago") || normalized.includes("mercado pago")) return "order_pending_mp";
  
  // Default to transfer if unknown
  return "order_pending_transfer";
}

export interface CartItem {
  product_id: string;
  product_name: string;
  quantity: number;
  price: number;
}

export interface ConversationContext {
  phone: string;
  cart: CartItem[];
  order_state?: OrderState;
  selected_vendor_id?: string;
  selected_vendor_name?: string;
  delivery_address?: string;
  payment_method?: string;
  payment_receipt_url?: string;
  pending_order_id?: string;
  last_order_id?: string;
  user_latitude?: number;
  user_longitude?: number;
  pending_location_decision?: boolean;
  pending_vendor_change?: {
    new_vendor_id: string;
    new_vendor_name: string;
  };
  payment_methods_fetched?: boolean;
  available_payment_methods?: string[];
  delivery_type?: 'delivery' | 'pickup';  // Nuevo: tipo de entrega elegido
  vendor_allows_pickup?: boolean;          // Nuevo: si el vendor acepta retiro
  pickup_instructions?: string;            // Nuevo: instrucciones de retiro
  available_vendors_map?: Array<{          // Nuevo: mapeo de vendors disponibles (no mostrar IDs al usuario)
    index: number;                         // Número en la lista (1, 2, 3...)
    name: string;                          // Nombre del negocio
    vendor_id: string;                     // UUID interno (nunca mostrado al usuario)
  }>;
  resumen_mostrado?: boolean;              // Nuevo: indica si ya se mostró el resumen final del pedido
  conversation_history: Array<{ role: "user" | "assistant" | "system"; content: string }>;
}
