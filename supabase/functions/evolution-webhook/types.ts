// ==================== INTERFACES ====================

export interface CartItem {
  product_id: string;
  product_name: string;
  quantity: number;
  price: number;
}

export interface ConversationContext {
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
  pending_location_decision?: boolean;
  conversation_history: Array<{ role: "user" | "assistant" | "system"; content: string }>;
}
