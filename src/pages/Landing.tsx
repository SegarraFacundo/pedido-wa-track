import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  MessageSquare, 
  Clock, 
  ShieldCheck, 
  Smartphone, 
  Zap, 
  Bell,
  CheckCircle2,
  ArrowRight,
  Leaf,
  Instagram
} from "lucide-react";

export default function Landing() {
  const { t } = useTranslation();

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

  const handlePedirClick = () => {
    const whatsappNumber = '5493464515971';
    const message = encodeURIComponent('Hola! Quiero hacer un pedido');
    window.open(`https://wa.me/${whatsappNumber}?text=${message}`, '_blank');
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-end gap-6">
            <div className="flex items-center gap-2 group cursor-pointer">
              <Leaf className="h-6 w-6 text-primary transition-transform origin-bottom group-hover:animate-leaf-sway" />
              <span className="text-xl font-semibold text-primary">Lapacho</span>
            </div>
            <span className="text-muted-foreground text-sm hidden sm:block pb-0.5">{t('landing.tagline')}</span>
          </div>
          <nav className="flex items-center gap-2 sm:gap-4">
            <Link to="/contacto" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              {t('landing.contact')}
            </Link>
            <Button variant="outline" size="sm" onClick={handleProbarClick}>
              {t('landing.try_lapacho')}
            </Button>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden py-20 md:py-32 min-h-[80vh] flex items-center">
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
          <div className="absolute inset-0 bg-gradient-to-b from-background/70 via-background/60 to-background/80" />
        </div>
        
        <div className="relative z-10 container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 bg-primary/20 text-primary-foreground backdrop-blur-sm px-4 py-2 rounded-full text-sm mb-8 border border-primary/30">
              <Leaf className="h-4 w-4" />
              {t('landing.tagline')}
            </div>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-foreground mb-6 leading-tight drop-shadow-sm">
              {t('landing.hero_title')}
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground mb-10 max-w-2xl mx-auto">
              {t('landing.hero_subtitle')}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" className="text-base px-8" onClick={handlePedirClick}>
                {t('landing.cta_order')}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Button size="lg" variant="outline" className="text-base px-8 bg-background/50 backdrop-blur-sm" onClick={handleProbarClick}>
                {t('landing.cta_business')}
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* ¿Qué es Lapacho? */}
      <section className="py-20 md:py-24">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl md:text-4xl font-bold mb-6">{t('landing.what_is_title')}</h2>
            <p className="text-lg text-muted-foreground leading-relaxed">
              {t('landing.what_is_p1')}
            </p>
            <p className="text-lg text-muted-foreground leading-relaxed mt-4">
              {t('landing.what_is_p2')}
            </p>
            <p className="text-lg text-foreground font-medium mt-4">
              {t('landing.what_is_p3')}
            </p>
          </div>
        </div>
      </section>

      {/* Beneficios para Negocios */}
      <section className="py-20 md:py-24 bg-muted/50">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">{t('landing.benefits_business_title')}</h2>
          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            <Card className="border-0 shadow-md hover:shadow-lg transition-shadow">
              <CardContent className="p-8">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-6">
                  <MessageSquare className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-4">{t('landing.simplicity_title')}</h3>
                <ul className="space-y-2 text-muted-foreground">
                  {['simplicity_1', 'simplicity_2', 'simplicity_3', 'simplicity_4'].map(key => (
                    <li key={key} className="flex items-start gap-2">
                      <CheckCircle2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                      <span>{t(`landing.${key}`)}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-md hover:shadow-lg transition-shadow">
              <CardContent className="p-8">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-6">
                  <Clock className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-4">{t('landing.time_title')}</h3>
                <ul className="space-y-2 text-muted-foreground">
                  {['time_1', 'time_2', 'time_3', 'time_4'].map(key => (
                    <li key={key} className="flex items-start gap-2">
                      <CheckCircle2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                      <span>{t(`landing.${key}`)}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-md hover:shadow-lg transition-shadow">
              <CardContent className="p-8">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-6">
                  <ShieldCheck className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-4">{t('landing.errors_title')}</h3>
                <ul className="space-y-2 text-muted-foreground">
                  {['errors_1', 'errors_2', 'errors_3', 'errors_4'].map(key => (
                    <li key={key} className="flex items-start gap-2">
                      <CheckCircle2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                      <span>{t(`landing.${key}`)}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Beneficios para Clientes */}
      <section className="py-20 md:py-24">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">{t('landing.benefits_clients_title')}</h2>
          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Smartphone className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2">{t('landing.client_1_title')}</h3>
              <p className="text-muted-foreground">{t('landing.client_1_desc')}</p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Zap className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2">{t('landing.client_2_title')}</h3>
              <p className="text-muted-foreground">{t('landing.client_2_desc')}</p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Bell className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2">{t('landing.client_3_title')}</h3>
              <p className="text-muted-foreground">{t('landing.client_3_desc')}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Cómo funciona */}
      <section className="py-20 md:py-24 bg-muted/50">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-16">{t('landing.how_it_works_title')}</h2>
          <div className="max-w-3xl mx-auto">
            <div className="space-y-0">
              {[1, 2, 3, 4, 5, 6].map((step, index) => (
                <div key={step} className="flex items-start gap-4">
                  <div className="flex flex-col items-center">
                    <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-semibold shrink-0">
                      {step}
                    </div>
                    {index < 5 && (
                      <div className="w-0.5 h-12 bg-primary/30" />
                    )}
                  </div>
                  <div className="pt-2 pb-12">
                    <p className="text-lg">{t(`landing.step_${step}`)}</p>
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
            {t('landing.cta_final_title')}
          </h2>
          <p className="text-lg opacity-90 mb-8 max-w-xl mx-auto">
            {t('landing.cta_final_subtitle')}
          </p>
          <Button 
            size="lg" 
            variant="secondary" 
            className="text-base px-8"
            onClick={handleProbarClick}
          >
            {t('landing.try_lapacho')}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-foreground text-background py-12">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center gap-8">
            <div className="text-center md:text-left">
              <div className="flex items-center justify-center md:justify-start gap-2 mb-2 group cursor-pointer">
                <Leaf className="h-6 w-6 text-primary transition-transform origin-bottom group-hover:animate-leaf-sway" />
                <span className="text-xl font-semibold text-primary">Lapacho</span>
              </div>
              <p className="text-sm opacity-70">{t('landing.tagline')}</p>
            </div>
            
            <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-8 text-sm">
              <Link to="/terminos" className="opacity-70 hover:opacity-100 transition-opacity">
                {t('landing.footer_terms')}
              </Link>
              <Link to="/privacidad" className="opacity-70 hover:opacity-100 transition-opacity">
                {t('landing.footer_privacy')}
              </Link>
              <a href="mailto:contacto@lapacho.ar" className="opacity-70 hover:opacity-100 transition-opacity">
                contacto@lapacho.ar
              </a>
              <a 
                href="https://www.instagram.com/lapacho.ar/" 
                target="_blank" 
                rel="noopener noreferrer"
                className="opacity-70 hover:opacity-100 transition-opacity flex items-center gap-1"
              >
                <Instagram className="h-4 w-4" />
                @lapacho.ar
              </a>
            </div>
          </div>
          
          <div className="mt-8 pt-8 border-t border-background/20 text-center text-sm opacity-60">
            <p>{t('landing.footer_rights')}</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
