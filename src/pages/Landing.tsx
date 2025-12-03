import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "react-router-dom";
import { 
  MessageSquare, 
  Clock, 
  ShieldCheck, 
  Smartphone, 
  Zap, 
  Bell,
  CheckCircle2,
  ArrowRight,
  Leaf
} from "lucide-react";
import lapachoLogo from '@/assets/lapacho-logo.png';

export default function Landing() {
  const handleProbarClick = () => {
    const whatsappNumber = '5493464448309';
    const message = encodeURIComponent('Hola, quiero probar Lapacho');
    window.open(`https://wa.me/${whatsappNumber}?text=${message}`, '_blank');
  };

  const handleDemoClick = () => {
    const whatsappNumber = '5493464448309';
    const message = encodeURIComponent('Hola, quiero ver una demo de Lapacho');
    window.open(`https://wa.me/${whatsappNumber}?text=${message}`, '_blank');
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={lapachoLogo} alt="Lapacho" className="h-8" />
            <span className="text-muted-foreground text-sm hidden sm:block">Simple por naturaleza.</span>
          </div>
          <nav className="flex items-center gap-2 sm:gap-4">
            <Link to="/contacto" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Contacto
            </Link>
            <Button variant="outline" size="sm" onClick={handleProbarClick}>
              Probar Lapacho
            </Button>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden py-20 md:py-32 min-h-[80vh] flex items-center">
        {/* Video de fondo */}
        <div className="absolute inset-0 z-0">
          <video 
            autoPlay 
            loop 
            muted 
            playsInline
            className="w-full h-full object-cover"
            poster="/images/hero-poster.jpg"
          >
            <source src="/videos/hero-lapacho.mp4" type="video/mp4" />
          </video>
          {/* Overlay para legibilidad */}
          <div className="absolute inset-0 bg-gradient-to-b from-background/70 via-background/60 to-background/80" />
        </div>
        
        <div className="relative z-10 container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 bg-primary/20 text-primary-foreground backdrop-blur-sm px-4 py-2 rounded-full text-sm mb-8 border border-primary/30">
              <Leaf className="h-4 w-4" />
              Simple por naturaleza.
            </div>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-foreground mb-6 leading-tight drop-shadow-sm">
              Lapacho – Simple por naturaleza.
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground mb-10 max-w-2xl mx-auto">
              Pedidos claros, rápidos y sin errores. Todo por WhatsApp.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" className="text-base px-8" onClick={handleProbarClick}>
                Probar Lapacho
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Button size="lg" variant="outline" className="text-base px-8 bg-background/50 backdrop-blur-sm" onClick={handleDemoClick}>
                Ver demo
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* ¿Qué es Lapacho? */}
      <section className="py-20 md:py-24">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl md:text-4xl font-bold mb-6">¿Qué es Lapacho?</h2>
            <p className="text-lg text-muted-foreground leading-relaxed">
              Lapacho es un asistente automatizado que toma pedidos por WhatsApp, los organiza y te los envía listos para preparar.
            </p>
            <p className="text-lg text-muted-foreground leading-relaxed mt-4">
              No necesitás instalar nada ni aprender nuevas herramientas.
            </p>
            <p className="text-lg text-foreground font-medium mt-4">
              Tu negocio trabaja igual, pero sin caos.
            </p>
          </div>
        </div>
      </section>

      {/* Beneficios para Negocios */}
      <section className="py-20 md:py-24 bg-muted/50">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">Beneficios para negocios</h2>
          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {/* Simplicidad total */}
            <Card className="border-0 shadow-md hover:shadow-lg transition-shadow">
              <CardContent className="p-8">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-6">
                  <MessageSquare className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-4">Simplicidad total</h3>
                <ul className="space-y-2 text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                    <span>Pedidos claros por WhatsApp</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                    <span>Sin audios eternos</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                    <span>Sin errores de interpretación</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                    <span>Sin cambiar tu forma de trabajar</span>
                  </li>
                </ul>
              </CardContent>
            </Card>

            {/* Ahorro de tiempo real */}
            <Card className="border-0 shadow-md hover:shadow-lg transition-shadow">
              <CardContent className="p-8">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-6">
                  <Clock className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-4">Ahorro de tiempo real</h3>
                <ul className="space-y-2 text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                    <span>El sistema arma el pedido completo</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                    <span>Atiende a muchos clientes a la vez</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                    <span>Menos chat, más productividad</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                    <span>Vos solo preparás el pedido</span>
                  </li>
                </ul>
              </CardContent>
            </Card>

            {/* Cero errores */}
            <Card className="border-0 shadow-md hover:shadow-lg transition-shadow">
              <CardContent className="p-8">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-6">
                  <ShieldCheck className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-4">Cero errores</h3>
                <ul className="space-y-2 text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                    <span>Productos correctos</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                    <span>Cantidades exactas</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                    <span>Dirección y pago confirmados</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                    <span>Menos reclamos y pérdida de plata</span>
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Beneficios para Clientes */}
      <section className="py-20 md:py-24">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">Beneficios para clientes</h2>
          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Smartphone className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Un solo número de WhatsApp</h3>
              <p className="text-muted-foreground">
                Todos los negocios en un mismo lugar, sin buscar teléfonos.
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Zap className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Pedido rápido y simple</h3>
              <p className="text-muted-foreground">
                El bot arma el pedido en segundos, sin complicaciones.
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Bell className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Seguimiento automático</h3>
              <p className="text-muted-foreground">
                Notificaciones: recibido, preparando, listo, en camino.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Cómo funciona */}
      <section className="py-20 md:py-24 bg-muted/50">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-16">Cómo funciona</h2>
          <div className="max-w-3xl mx-auto">
            <div className="space-y-0">
              {[
                { step: 1, text: "El cliente escribe al número de Lapacho" },
                { step: 2, text: "Selecciona negocio y productos" },
                { step: 3, text: "Lapacho arma el pedido completo" },
                { step: 4, text: "El negocio recibe el pedido en WhatsApp" },
                { step: 5, text: "Cambia el estado con un clic" },
                { step: 6, text: "El cliente recibe la notificación automática" },
              ].map((item, index, arr) => (
                <div key={item.step} className="flex items-start gap-4">
                  <div className="flex flex-col items-center">
                    <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-semibold shrink-0">
                      {item.step}
                    </div>
                    {index < arr.length - 1 && (
                      <div className="w-0.5 h-12 bg-primary/30" />
                    )}
                  </div>
                  <div className="pt-2 pb-12">
                    <p className="text-lg">{item.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA Final */}
      <section className="py-20 md:py-24 bg-primary text-primary-foreground">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Simplificá tu negocio desde hoy.
          </h2>
          <p className="text-lg opacity-90 mb-8 max-w-xl mx-auto">
            Menos chat. Menos errores. Más tiempo para crecer.
          </p>
          <Button 
            size="lg" 
            variant="secondary" 
            className="text-base px-8"
            onClick={handleProbarClick}
          >
            Probar Lapacho
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-foreground text-background py-12">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center gap-8">
            <div className="text-center md:text-left">
              <div className="flex items-center justify-center md:justify-start gap-3 mb-2">
                <Leaf className="h-6 w-6" />
                <span className="text-xl font-semibold">Lapacho</span>
              </div>
              <p className="text-sm opacity-70">Simple por naturaleza.</p>
            </div>
            
            <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-8 text-sm">
              <Link to="/terminos" className="opacity-70 hover:opacity-100 transition-opacity">
                Términos y Condiciones
              </Link>
              <Link to="/privacidad" className="opacity-70 hover:opacity-100 transition-opacity">
                Política de Privacidad
              </Link>
              <a href="mailto:contacto@lapacho.ar" className="opacity-70 hover:opacity-100 transition-opacity">
                contacto@lapacho.ar
              </a>
            </div>
          </div>
          
          <div className="mt-8 pt-8 border-t border-background/20 text-center text-sm opacity-60">
            <p>© 2025 Lapacho. Todos los derechos reservados.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
