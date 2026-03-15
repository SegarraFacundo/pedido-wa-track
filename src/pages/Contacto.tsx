import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Leaf, Mail, MessageCircle, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";

export default function Contacto() {
  const { t } = useTranslation();
  const [formData, setFormData] = useState({
    nombre: "",
    email: "",
    mensaje: ""
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    toast({
      title: t('contacto.messageSentTitle'),
      description: t('contacto.messageSentDesc'),
    });
    
    setFormData({ nombre: "", email: "", mensaje: "" });
    setIsSubmitting(false);
  };

  const handleWhatsAppClick = () => {
    const whatsappNumber = '5493464448309';
    const message = encodeURIComponent('Hola, tengo una consulta sobre Lapacho');
    window.open(`https://wa.me/${whatsappNumber}?text=${message}`, '_blank');
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link to="/" className="flex items-center gap-3">
              <Leaf className="h-6 w-6 text-primary" />
              <span className="font-semibold">Lapacho</span>
            </Link>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/">
                <ArrowLeft className="h-4 w-4 mr-2" />
                {t('common.back')}
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-12 max-w-4xl">
        <div className="text-center mb-12">
          <h1 className="text-3xl md:text-4xl font-bold mb-4">{t('contacto.title')}</h1>
          <p className="text-lg text-muted-foreground max-w-xl mx-auto">
            {t('contacto.subtitle')}
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          <Card className="border-0 shadow-lg">
            <CardContent className="p-8">
              <h2 className="text-xl font-semibold mb-6">{t('contacto.formTitle')}</h2>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="nombre">{t('contacto.nameLabel')}</Label>
                  <Input
                    id="nombre"
                    type="text"
                    placeholder={t('contacto.namePlaceholder')}
                    value={formData.nombre}
                    onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">{t('contacto.emailLabel')}</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="tu@email.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="mensaje">{t('common.message')}</Label>
                  <Textarea
                    id="mensaje"
                    placeholder={t('contacto.messagePlaceholder')}
                    rows={5}
                    value={formData.mensaje}
                    onChange={(e) => setFormData({ ...formData, mensaje: e.target.value })}
                    required
                  />
                </div>

                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? (
                    t('common.sending')
                  ) : (
                    <>
                      {t('contacto.sendMessage')}
                      <Send className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow cursor-pointer" onClick={handleWhatsAppClick}>
              <CardContent className="p-8">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-full bg-whatsapp/10 flex items-center justify-center shrink-0">
                    <MessageCircle className="h-6 w-6 text-whatsapp" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold mb-1">{t('contacto.whatsappTitle')}</h3>
                    <p className="text-muted-foreground mb-2">{t('contacto.whatsappDesc')}</p>
                    <p className="text-primary font-medium">{t('contacto.openChat')}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg">
              <CardContent className="p-8">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Mail className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold mb-1">{t('contacto.emailTitle')}</h3>
                    <p className="text-muted-foreground mb-2">{t('contacto.emailDesc')}</p>
                    <a 
                      href="mailto:contacto@lapacho.ar" 
                      className="text-primary font-medium hover:underline"
                    >
                      contacto@lapacho.ar
                    </a>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="bg-muted/50 rounded-lg p-6 text-center">
              <p className="text-sm text-muted-foreground">{t('contacto.responseTime')}</p>
            </div>
          </div>
        </div>
      </main>

      <footer className="border-t py-8 mt-12">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>{t('common.rights')}</p>
        </div>
      </footer>
    </div>
  );
}