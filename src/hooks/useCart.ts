import { useCallback, useEffect, useState } from "react";
import { CartItem, CustomerCart, EMPTY_CART } from "@/types/cart";

const STORAGE_KEY = "lapacho_cart";
const EVENT = "lapacho-cart-change";

function read(): CustomerCart {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_CART;
    const parsed = JSON.parse(raw);
    return {
      vendor_id: parsed.vendor_id ?? null,
      vendor_name: parsed.vendor_name ?? null,
      items: Array.isArray(parsed.items) ? parsed.items : [],
    };
  } catch {
    return EMPTY_CART;
  }
}

function write(cart: CustomerCart) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
  } catch {
    /* modo privado / storage bloqueado: el carrito vive sólo en memoria este render */
  }
  window.dispatchEvent(new Event(EVENT));
}

/**
 * Carrito del cliente. Fuente de verdad: localStorage (permite navegar y armar el
 * pedido sin login). Se sincroniza entre componentes con un evento propio.
 * Atado a UN negocio: agregar de otro negocio pide confirmar para vaciar.
 */
export function useCart() {
  const [cart, setCart] = useState<CustomerCart>(read);

  useEffect(() => {
    const sync = () => setCart(read());
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  /** Devuelve false si hay ítems de otro negocio (hay que vaciar primero con replaceVendor). */
  const addItem = useCallback(
    (vendorId: string, vendorName: string, item: CartItem): boolean => {
      const current = read();
      if (current.vendor_id && current.vendor_id !== vendorId && current.items.length > 0) {
        return false;
      }
      const items = [...current.items];
      const idx = items.findIndex((i) => i.product_id === item.product_id);
      if (idx >= 0) {
        items[idx] = { ...items[idx], quantity: items[idx].quantity + item.quantity };
      } else {
        items.push({ ...item });
      }
      write({ vendor_id: vendorId, vendor_name: vendorName, items });
      return true;
    },
    [],
  );

  /** Vacía y empieza un carrito nuevo con este ítem (cuando el cliente cambia de negocio). */
  const replaceVendor = useCallback(
    (vendorId: string, vendorName: string, item: CartItem) => {
      write({ vendor_id: vendorId, vendor_name: vendorName, items: [{ ...item }] });
    },
    [],
  );

  const setQuantity = useCallback((productId: string, quantity: number) => {
    const current = read();
    let items = current.items.map((i) =>
      i.product_id === productId ? { ...i, quantity } : i,
    );
    items = items.filter((i) => i.quantity > 0);
    write(items.length ? { ...current, items } : EMPTY_CART);
  }, []);

  const removeItem = useCallback((productId: string) => {
    const current = read();
    const items = current.items.filter((i) => i.product_id !== productId);
    write(items.length ? { ...current, items } : EMPTY_CART);
  }, []);

  const clear = useCallback(() => write(EMPTY_CART), []);

  const count = cart.items.reduce((n, i) => n + i.quantity, 0);
  const subtotal = cart.items.reduce((s, i) => s + i.price * i.quantity, 0);

  return { cart, count, subtotal, addItem, replaceVendor, setQuantity, removeItem, clear };
}
