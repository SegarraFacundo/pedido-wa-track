import { useState } from "react";
import { Link, Outlet, useNavigate } from "react-router-dom";
import { ShoppingCart, User, LogOut, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useLocalePath } from "@/hooks/useLocalePath";
import { useCart } from "@/hooks/useCart";
import { useCustomerAuth } from "@/hooks/useCustomerAuth";
import { CustomerLogin } from "@/components/customer/CustomerLogin";
import { SupportDialog } from "@/components/customer/SupportDialog";
import { PWAInstallPrompt } from "@/components/PWAInstallPrompt";
import lapachoLogo from "@/assets/logo-text-light.svg";

export function CustomerLayout() {
  const localePath = useLocalePath();
  const navigate = useNavigate();
  const { count } = useCart();
  const { isAuthenticated, isGuest, user, loading, signOut } = useCustomerAuth();
  const [supportOpen, setSupportOpen] = useState(false);

  const accountLabel = user?.email ?? "Mi cuenta";

  // Login obligatorio: sin cuenta real (o con sesión anónima vieja) no se entra a la tienda.
  const needsLogin = !loading && (!isAuthenticated || isGuest);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (needsLogin) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-4">
        <CustomerLogin redirectTo={window.location.href} />
        <button
          onClick={() => setSupportOpen(true)}
          className="text-xs text-muted-foreground underline-offset-2 hover:underline"
        >
          ¿Necesitás ayuda?
        </button>
        <SupportDialog open={supportOpen} onOpenChange={setSupportOpen} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
          <Link to={localePath("/tienda")} className="flex items-center gap-2">
            <img src={lapachoLogo} alt="Lapacho" className="h-7" />
          </Link>

          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="relative"
              onClick={() => navigate(localePath("/carrito"))}
              aria-label="Carrito"
            >
              <ShoppingCart className="h-5 w-5" />
              {count > 0 && (
                <Badge className="absolute -right-1 -top-1 h-5 min-w-5 justify-center rounded-full px-1 text-xs">
                  {count}
                </Badge>
              )}
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Cuenta">
                  <User className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem disabled className="opacity-100">
                  <span className="truncate text-sm font-medium">{accountLabel}</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate(localePath("/mis-pedidos"))}>
                  Mis pedidos
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSupportOpen(true)}>Ayuda y soporte</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => signOut()}>
                  <LogOut className="mr-2 h-4 w-4" />
                  Cerrar sesión
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-4">
        <Outlet />
      </main>

      <SupportDialog open={supportOpen} onOpenChange={setSupportOpen} />
      <PWAInstallPrompt userType="cliente" />
    </div>
  );
}
