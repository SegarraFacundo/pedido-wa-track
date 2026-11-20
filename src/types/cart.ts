export interface CartItem {
  product_id: string;
  name: string;
  price: number;
  quantity: number;
}

/** Un carrito activo, atado a un único negocio (igual que el modelo del bot). */
export interface CustomerCart {
  vendor_id: string | null;
  vendor_name: string | null;
  items: CartItem[];
}

export const EMPTY_CART: CustomerCart = { vendor_id: null, vendor_name: null, items: [] };
