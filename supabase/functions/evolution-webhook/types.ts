// ==================== INTERFACES ====================

export type OrderState = 
  | "idle"              // Sin pedido activo
  | "browsing"          // Viendo negocios/buscando
  | "viewing_menu"      // Viendo menú específico
  | "adding_items"      // Agregando productos al carrito
  | "reviewing_cart"    // Revisando carrito antes de confirmar
  | "collecting_address"// Pidiendo dirección
  | "collecting_payment"// Pidiendo método de pago
  | "confirming_order"  // Confirmación final
  | "confirming_vendor_change" // Confirmando cambio de negocio con carrito activo
  | "order_placed";     // Pedido creado exitosamente

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
  conversation_history: Array<{ role: "user" | "assistant" | "system"; content: string }>;
}
