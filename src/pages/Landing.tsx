import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Store, Headphones, Shield, Zap, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import lapachoLogo from "@/assets/lapacho-logo.png";
import lapachoIcon from "@/assets/lapacho-icon.png";

export default function Landing() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-subtle">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm shadow-sm border-b sticky top-0 z-40">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 justify-center md:justify-start flex-1 md:flex-initial">
              <img src={lapachoIcon} alt="Lapacho" className="h-8 md:hidden" />
              <img src={lapachoLogo} alt="Lapacho Logo" className="h-12 hidden md:block" />
              <span className="text-xl font-bold md:hidden">Lapacho</span>
            </div>
            <div className="flex items-center gap-4">
              <Button variant="ghost" onClick={() => navigate('/soporte')}>
                Soporte
              </Button>
              <Button variant="outline" onClick={() => navigate('/plataforma')}>
                <Store className="h-4 w-4 mr-2" />
                Acceso Vendedores
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-20 text-center">
        <div className="max-w-4xl mx-auto">
          <img src={lapachoLogo} alt="Lapacho" className="h-32 mx-auto mb-6" />
          <h1 className="text-5xl md:text-6xl font-bold mb-6 bg-gradient-primary bg-clip-text text-transparent">
            Conectamos tu negocio con tus clientes
          </h1>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Plataforma de delivery local que integra WhatsApp Business para gestionar pedidos,
            entregas y pagos de forma simple y eficiente.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" className="text-lg px-8" onClick={() => navigate('/vendor-auth')}>
              Registrar mi Negocio
            </Button>
            <Button size="lg" variant="outline" className="text-lg px-8">
              Hacer un Pedido
            </Button>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="container mx-auto px-4 py-20">
        <h2 className="text-3xl font-bold text-center mb-12">¿Por qué elegir Lapacho?</h2>
        <div className="grid md:grid-cols-3 gap-8">
          <Card className="border-t-4 border-primary">
            <CardHeader>
              <Zap className="h-12 w-12 text-primary mb-4" />
              <CardTitle>Rápido y Eficiente</CardTitle>
              <CardDescription>
                Gestión automatizada de pedidos con tiempos de entrega de 30-45 minutos
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="border-t-4 border-primary">
            <CardHeader>
              <Users className="h-12 w-12 text-primary mb-4" />
              <CardTitle>WhatsApp Business</CardTitle>
              <CardDescription>
                Bot inteligente que procesa pedidos y mantiene comunicación directa con tus clientes
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="border-t-4 border-primary">
            <CardHeader>
              <Shield className="h-12 w-12 text-primary mb-4" />
              <CardTitle>Seguro y Confiable</CardTitle>
              <CardDescription>
                Sistema de pagos integrado y soporte técnico disponible para vendedores y clientes
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </section>

      {/* For Vendors */}
      <section className="bg-white py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <Store className="h-16 w-16 text-primary mx-auto mb-6" />
            <h2 className="text-3xl font-bold mb-6">Para Vendedores</h2>
            <p className="text-lg text-muted-foreground mb-8">
              Administra tu negocio desde una plataforma completa con:
            </p>
            <div className="grid md:grid-cols-2 gap-6 text-left">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">📊 Panel de Control</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Visualiza pedidos en tiempo real, gestiona productos y controla tus ventas
                  </p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">💬 Chat Directo</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Comunícate con tus clientes directamente desde la plataforma
                  </p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">📱 Notificaciones</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Recibe alertas instantáneas de nuevos pedidos por WhatsApp
                  </p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">📈 Reportes</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Analiza el rendimiento de tu negocio con estadísticas detalladas
                  </p>
                </CardContent>
              </Card>
            </div>
            <Button size="lg" className="mt-8" onClick={() => navigate('/vendor-auth')}>
              Comenzar Ahora
            </Button>
          </div>
        </div>
      </section>

      {/* Support Section */}
      <section className="container mx-auto px-4 py-20 text-center">
        <Headphones className="h-16 w-16 text-primary mx-auto mb-6" />
        <h2 className="text-3xl font-bold mb-6">¿Necesitas ayuda?</h2>
        <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
          Nuestro equipo de soporte está disponible para ayudarte con cualquier consulta
        </p>
        <Button size="lg" variant="outline" onClick={() => navigate('/soporte')}>
          Contactar Soporte
        </Button>
      </section>

      {/* Footer */}
      <footer className="bg-card border-t py-12">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <img src={lapachoLogo} alt="Lapacho" className="h-10 mb-4" />
              <p className="text-sm text-muted-foreground">
                Plataforma de delivery local que conecta negocios con clientes
              </p>
            </div>
            
            <div>
              <h3 className="font-semibold mb-4">Plataforma</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="/plataforma" className="hover:text-primary">Dashboard</a></li>
                <li><a href="/vendor-auth" className="hover:text-primary">Registrarse</a></li>
              </ul>
            </div>
            
            <div>
              <h3 className="font-semibold mb-4">Soporte</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="/soporte" className="hover:text-primary">Centro de Ayuda</a></li>
                <li><a href="/ayuda" className="hover:text-primary">FAQ</a></li>
              </ul>
            </div>
            
            <div>
              <h3 className="font-semibold mb-4">Legal</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-primary">Términos</a></li>
                <li><a href="#" className="hover:text-primary">Privacidad</a></li>
              </ul>
            </div>
          </div>
          
          <div className="mt-12 pt-8 border-t text-center text-sm text-muted-foreground">
            <p>© 2025 Lapacho. Todos los derechos reservados.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
