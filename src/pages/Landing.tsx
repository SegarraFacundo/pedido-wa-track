import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import {
  Leaf,
  ArrowRight,
  Store,
  ShoppingBag,
  MapPin,
  Bell,
  Wallet,
  Clock,
  Search,
  TrendingUp,
  LayoutDashboard,
  ShieldCheck,
  Star,
  Instagram,
} from "lucide-react";
import lapachoLogo from "@/assets/lapacho-logo.png";

// Contacto comercial para negocios que quieren sumarse (no es el bot de pedidos).
const BUSINESS_WA = "5493464448309";
const businessHref = `https://wa.me/${BUSINESS_WA}?text=${encodeURIComponent(
  "Hola! Quiero sumar mi negocio a Lapacho.",
)}`;

const clientPerks = [
  { icon: MapPin, title: "Todo en un lugar", desc: "Comida, farmacia, mercado, viveros y más negocios de tu ciudad." },
  { icon: Clock, title: "Pedí en segundos", desc: "Elegí, armá el carrito y listo. Sin llamadas ni audios eternos." },
  { icon: Bell, title: "Seguimiento en vivo", desc: "Mirá en tiempo real cómo avanza tu pedido, hasta la puerta." },
  { icon: Wallet, title: "Pagá como quieras", desc: "Efectivo, transferencia o MercadoPago. Vos elegís." },
];

const businessPerks = [
  { icon: TrendingUp, title: "Más ventas", desc: "Aparecé ante todos los clientes de tu zona que ya están pidiendo." },
  { icon: LayoutDashboard, title: "Panel simple", desc: "Recibí y gestioná tus pedidos desde un panel claro, sin caos." },
  { icon: ShieldCheck, title: "Cero errores", desc: "Pedidos claros, con productos y cantidades exactas. Menos reclamos." },
  { icon: Star, title: "Destacate", desc: "Publicá promociones y conseguí un lugar destacado para vender más." },
];

const steps = [
  { icon: Search, title: "Elegí un negocio", desc: "Entrá y mirá los negocios abiertos cerca tuyo." },
  { icon: ShoppingBag, title: "Armá tu pedido", desc: "Agregá productos al carrito y elegí entrega o retiro." },
  { icon: Wallet, title: "Pagá a tu manera", desc: "Efectivo, transferencia o MercadoPago." },
  { icon: Bell, title: "Seguilo en vivo", desc: "Recibí avisos: confirmado, en preparación y en camino." },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-sm">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <img src={lapachoLogo} alt="Lapacho" className="h-7" />
            <span className="hidden pb-0.5 text-sm text-muted-foreground sm:block">Simple por naturaleza.</span>
          </div>
          <nav className="flex items-center gap-3">
            <Link to="/contacto" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
              Contacto
            </Link>
            <Button asChild size="sm">
              <Link to="/tienda">Ver negocios</Link>
            </Button>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="relative flex min-h-[82vh] items-center overflow-hidden py-20 md:py-28">
        <div className="absolute inset-0 z-0">
          <video
            autoPlay
            loop
            muted
            playsInline
            className="h-full w-full object-cover"
            poster="/images/hero-poster.jpg"
          >
            <source src="/videos/hero-lapacho.mp4" type="video/mp4" />
          </video>
          <div className="absolute inset-0 bg-gradient-to-b from-background/80 via-background/70 to-background/90" />
        </div>

        <div className="container relative z-10 mx-auto px-4">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/15 px-4 py-2 text-sm font-medium text-primary backdrop-blur-sm">
              <Leaf className="h-4 w-4" />
              Tu ciudad, en una sola app
            </div>
            <h1 className="mb-6 text-4xl font-bold leading-tight text-foreground drop-shadow-sm md:text-5xl lg:text-6xl">
              Los negocios de tu ciudad,{" "}
              <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                a un pedido de distancia
              </span>
            </h1>
            <p className="mx-auto mb-10 max-w-2xl text-lg text-muted-foreground md:text-xl">
              Comida, farmacia, mercado y más. Elegí, pedí y seguí tu pedido en tiempo real.
              Rápido, simple y sin llamadas.
            </p>
            <div className="flex flex-col justify-center gap-4 sm:flex-row">
              <Button asChild size="lg" className="px-8 text-base">
                <Link to="/tienda">
                  Pedí ahora <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="bg-background/50 px-8 text-base backdrop-blur-sm">
                <a href={businessHref} target="_blank" rel="noopener noreferrer">
                  <Store className="mr-2 h-4 w-4" /> Sumá tu negocio
                </a>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* ¿Qué es Lapacho? */}
      <section className="py-20 md:py-24">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="mb-6 text-3xl font-bold md:text-4xl">Pedir nunca fue tan simple</h2>
            <p className="text-lg leading-relaxed text-muted-foreground">
              Lapacho es la app donde encontrás los negocios de tu ciudad y hacés tu pedido en segundos.
              Elegís qué querés, pagás como más te guste y seguís tu pedido hasta la puerta.
            </p>
            <p className="mt-4 text-lg font-medium text-foreground">
              Todo en un solo lugar, sin vueltas.
            </p>
          </div>
        </div>
      </section>

      {/* Cómo funciona */}
      <section className="bg-accent/40 py-20 md:py-24">
        <div className="container mx-auto px-4">
          <h2 className="mb-14 text-center text-3xl font-bold md:text-4xl">¿Cómo funciona?</h2>
          <div className="mx-auto grid max-w-5xl gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((s, i) => (
              <div key={s.title} className="relative rounded-2xl bg-card p-6 shadow-md">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-primary to-secondary text-primary-foreground">
                  <s.icon className="h-6 w-6" />
                </div>
                <span className="absolute right-5 top-5 text-3xl font-bold text-primary/15">{i + 1}</span>
                <h3 className="mb-1 font-semibold">{s.title}</h3>
                <p className="text-sm text-muted-foreground">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Ventajas para clientes */}
      <section className="py-20 md:py-24">
        <div className="container mx-auto px-4">
          <div className="mx-auto mb-14 max-w-2xl text-center">
            <span className="text-sm font-semibold uppercase tracking-wide text-primary">Para vos</span>
            <h2 className="mt-2 text-3xl font-bold md:text-4xl">¿Por qué pedir con Lapacho?</h2>
          </div>
          <div className="mx-auto grid max-w-5xl gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {clientPerks.map((p) => (
              <div key={p.title} className="rounded-2xl border bg-card p-6 text-center transition hover:shadow-lg">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                  <p.icon className="h-7 w-7 text-primary" />
                </div>
                <h3 className="mb-1 font-semibold">{p.title}</h3>
                <p className="text-sm text-muted-foreground">{p.desc}</p>
              </div>
            ))}
          </div>
          <div className="mt-10 text-center">
            <Button asChild size="lg" className="px-8">
              <Link to="/tienda">
                Ver negocios <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Ventajas para negocios */}
      <section className="bg-foreground py-20 text-background md:py-24">
        <div className="container mx-auto px-4">
          <div className="mx-auto mb-14 max-w-2xl text-center">
            <span className="text-sm font-semibold uppercase tracking-wide text-primary">Para tu negocio</span>
            <h2 className="mt-2 text-3xl font-bold md:text-4xl">Vendé más, con menos lío</h2>
            <p className="mt-4 text-background/70">
              Sumá tu negocio a Lapacho y llegá a los clientes de tu zona que ya están pidiendo.
            </p>
          </div>
          <div className="mx-auto grid max-w-5xl gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {businessPerks.map((p) => (
              <div key={p.title} className="rounded-2xl bg-background/5 p-6 ring-1 ring-background/10">
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/20">
                  <p.icon className="h-7 w-7 text-primary" />
                </div>
                <h3 className="mb-1 font-semibold">{p.title}</h3>
                <p className="text-sm text-background/70">{p.desc}</p>
              </div>
            ))}
          </div>
          <div className="mt-10 text-center">
            <Button asChild size="lg" variant="secondary" className="px-8">
              <a href={businessHref} target="_blank" rel="noopener noreferrer">
                <Store className="mr-2 h-4 w-4" /> Sumá tu negocio
              </a>
            </Button>
          </div>
        </div>
      </section>

      {/* CTA Final */}
      <section className="bg-gradient-to-br from-primary to-secondary py-20 text-primary-foreground md:py-24">
        <div className="container mx-auto px-4 text-center">
          <h2 className="mb-4 text-3xl font-bold md:text-4xl">¿Listo para pedir?</h2>
          <p className="mx-auto mb-8 max-w-xl text-lg opacity-90">
            Los negocios de tu ciudad te están esperando. Entrá y hacé tu primer pedido.
          </p>
          <Button asChild size="lg" variant="secondary" className="px-8 text-base">
            <Link to="/tienda">
              Entrar a la tienda <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-foreground py-12 text-background">
        <div className="container mx-auto px-4">
          <div className="flex flex-col items-center justify-between gap-8 md:flex-row">
            <div className="text-center md:text-left">
              <div className="mb-2 flex items-center justify-center gap-2 md:justify-start">
                <Leaf className="h-6 w-6 text-primary" />
                <span className="text-xl font-semibold text-primary">Lapacho</span>
              </div>
              <p className="text-sm opacity-70">Simple por naturaleza.</p>
            </div>

            <div className="flex flex-col items-center gap-4 text-sm sm:flex-row sm:gap-8">
              <Link to="/terminos" className="opacity-70 transition-opacity hover:opacity-100">
                Términos y Condiciones
              </Link>
              <Link to="/privacidad" className="opacity-70 transition-opacity hover:opacity-100">
                Política de Privacidad
              </Link>
              <a href="mailto:contacto@lapacho.ar" className="opacity-70 transition-opacity hover:opacity-100">
                contacto@lapacho.ar
              </a>
              <a
                href="https://www.instagram.com/lapacho.ar/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 opacity-70 transition-opacity hover:opacity-100"
              >
                <Instagram className="h-4 w-4" />
                @lapacho.ar
              </a>
            </div>
          </div>

          <div className="mt-8 border-t border-background/20 pt-8 text-center text-sm opacity-60">
            <p>© 2026 Lapacho. Todos los derechos reservados.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
