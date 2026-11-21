import { useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, Minus, Plus, ShoppingCart, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useLocalePath } from "@/hooks/useLocalePath";
import { useCart } from "@/hooks/useCart";

const money = (n: number) => "$ " + Math.round(n).toLocaleString("es-AR");

export default function Cart() {
  const navigate = useNavigate();
  const localePath = useLocalePath();
  const { cart, count, subtotal, setQuantity, removeItem, clear } = useCart();

  if (count === 0) {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-center">
        <ShoppingCart className="h-12 w-12 text-muted-foreground" />
        <div>
          <h1 className="text-lg font-semibold">Tu carrito está vacío</h1>
          <p className="text-sm text-muted-foreground">Sumá productos de algún negocio.</p>
        </div>
        <Button onClick={() => navigate(localePath("/tienda"))}>Ver negocios</Button>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-36">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm text-muted-foreground">
        <ArrowLeft className="h-4 w-4" /> Seguir pidiendo
      </button>

      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Tu pedido</h1>
        {cart.vendor_name && <span className="text-sm text-muted-foreground">{cart.vendor_name}</span>}
      </div>

      <div className="space-y-2">
        {cart.items.map((item) => (
          <Card key={item.product_id}>
            <CardContent className="flex items-center gap-3 p-3">
              <div className="min-w-0 flex-1">
                <h3 className="truncate font-medium">{item.name}</h3>
                <p className="text-sm text-muted-foreground">{money(item.price)} c/u</p>
              </div>
              <div className="flex items-center gap-2">
                <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => setQuantity(item.product_id, item.quantity - 1)}>
                  <Minus className="h-4 w-4" />
                </Button>
                <span className="w-5 text-center font-medium">{item.quantity}</span>
                <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => setQuantity(item.product_id, item.quantity + 1)}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="w-20 text-right font-semibold">{money(item.price * item.quantity)}</div>
              <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground" onClick={() => removeItem(item.product_id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <button
        onClick={clear}
        className="flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-destructive"
      >
        <Trash2 className="h-4 w-4" /> Vaciar carrito
      </button>

      {/* Barra inferior fija con el total y el CTA (patrón apps de delivery) */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 p-3 backdrop-blur">
        <div className="mx-auto max-w-3xl space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              Subtotal · {count} {count === 1 ? "producto" : "productos"}
            </span>
            <span className="font-semibold">{money(subtotal)}</span>
          </div>
          <Button className="w-full" size="lg" onClick={() => navigate(localePath("/checkout"))}>
            Continuar <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            El costo de envío se calcula en el siguiente paso.
          </p>
        </div>
      </div>
    </div>
  );
}
