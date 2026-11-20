import { useState } from "react";
import { Link, Outlet, useNavigate } from "react-router-dom";
import { ShoppingCart, User, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent } from "@/components/ui/dialog";
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
import lapachoLogo from "@/assets/lapacho-logo.png";

export function CustomerLayout() {
  const localePath = useLocalePath();
  const navigate = useNavigate();
  const { count } = useCart();
  const { isAuthenticated, isGuest, user, signInWithGoogle, signOut } = useCustomerAuth();
  const [loginOpen, setLoginOpen] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);

  const accountLabel = isGuest ? "Invitado" : user?.email ?? "Mi cuenta";

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
                {isAuthenticated ? (
                  <>
                    <DropdownMenuItem disabled className="opacity-100">
                      <span className="truncate text-sm font-medium">{accountLabel}</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => navigate(localePath("/mis-pedidos"))}>
                      Mis pedidos
                    </DropdownMenuItem>
                    {isGuest && (
                      <DropdownMenuItem onClick={() => signInWithGoogle()}>
                        Entrar con Google
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem onClick={() => setSupportOpen(true)}>Ayuda y soporte</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => signOut()}>
                      <LogOut className="mr-2 h-4 w-4" />
                      Cerrar sesión
                    </DropdownMenuItem>
                  </>
                ) : (
                  <>
                    <DropdownMenuItem onClick={() => setLoginOpen(true)}>Ingresar</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setSupportOpen(true)}>Ayuda y soporte</DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-4">
        <Outlet />
      </main>

      <Dialog open={loginOpen} onOpenChange={setLoginOpen}>
        <DialogContent className="max-w-sm border-0 bg-transparent p-0 shadow-none">
          <CustomerLogin onDone={() => setLoginOpen(false)} />
        </DialogContent>
      </Dialog>

      <SupportDialog open={supportOpen} onOpenChange={setSupportOpen} />
      <PWAInstallPrompt userType="cliente" />
    </div>
  );
}
