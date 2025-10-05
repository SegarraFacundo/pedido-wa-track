import { Card } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { TreePine, MessageCircle, ShoppingCart, Phone, Clock, MapPin, CreditCard, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

const Ayuda = () => {
  return (
    <div className="min-h-screen bg-gradient-subtle">
      {/* Header */}
      <header className="bg-white shadow-sm border-b sticky top-0 z-40">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-primary rounded-lg flex items-center justify-center">
                <TreePine className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-primary bg-clip-text text-transparent">
                  Lapacho - Ayuda
                </h1>
                <p className="text-xs text-muted-foreground">Centro de Ayuda y Documentación</p>
              </div>
            </div>
            <Button variant="outline" asChild>
              <a href="/">Volver al Inicio</a>
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Intro Section */}
        <Card className="p-8 mb-8 border-t-4 border-primary">
          <div className="text-center mb-6">
            <MessageCircle className="h-16 w-16 text-primary mx-auto mb-4" />
            <h2 className="text-3xl font-bold mb-4">
              Bienvenido al Bot de WhatsApp de Lapacho
            </h2>
            <p className="text-muted-foreground text-lg">
              Tu asistente inteligente para realizar pedidos por WhatsApp de forma rápida y sencilla
            </p>
          </div>
        </Card>

        {/* Quick Start */}
        <Card className="p-6 mb-8 bg-primary/5">
          <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Phone className="h-5 w-5 text-primary" />
            Inicio Rápido
          </h3>
          <ol className="space-y-3 text-muted-foreground">
            <li className="flex gap-3">
              <span className="font-bold text-primary">1.</span>
              <span>Guarda nuestro número de WhatsApp en tus contactos: <strong>+14155238886</strong></span>
            </li>
            <li className="flex gap-3">
              <span className="font-bold text-primary">2.</span>
              <span>Envía el mensaje <strong>"join"</strong> para activar el bot (solo la primera vez)</span>
            </li>
            <li className="flex gap-3">
              <span className="font-bold text-primary">3.</span>
              <span>Escribe <strong>"menu"</strong> o <strong>"inicio"</strong> para ver las opciones disponibles</span>
            </li>
            <li className="flex gap-3">
              <span className="font-bold text-primary">4.</span>
              <span>¡Comienza a hacer pedidos!</span>
            </li>
          </ol>
        </Card>

        {/* FAQ Accordion */}
        <Card className="p-6 mb-8">
          <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <HelpCircle className="h-5 w-5 text-primary" />
            Preguntas Frecuentes
          </h3>
          
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="item-1">
              <AccordionTrigger>¿Cómo hago un pedido?</AccordionTrigger>
              <AccordionContent className="text-muted-foreground space-y-2">
                <p>Para hacer un pedido puedes:</p>
                <ul className="list-disc list-inside ml-4 space-y-1">
                  <li>Escribir <strong>"Hacer pedido"</strong> o elegir opción 3 del menú</li>
                  <li>El bot te mostrará los locales disponibles</li>
                  <li>Selecciona el local y los productos que desees</li>
                  <li>Confirma tu dirección de entrega</li>
                  <li>El bot procesará tu pedido y te dará un código de seguimiento</li>
                </ul>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-2">
              <AccordionTrigger>¿Cuáles son los comandos disponibles?</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                <ul className="space-y-2">
                  <li><strong>menu</strong> o <strong>inicio</strong> - Volver al menú principal</li>
                  <li><strong>ver locales</strong> - Lista de restaurantes y negocios disponibles</li>
                  <li><strong>estado</strong> - Consultar estado de tu pedido actual</li>
                  <li><strong>ayuda</strong> - Muestra esta documentación</li>
                  <li><strong>hablar con vendedor</strong> - Conecta con un humano</li>
                  <li><strong>volver</strong> o <strong>atrás</strong> - Retroceder un paso</li>
                  <li><strong>cancelar</strong> - Cancelar pedido actual y volver al inicio</li>
                </ul>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-3">
              <AccordionTrigger>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  ¿Cuánto tarda la entrega?
                </div>
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                <p>Los tiempos de entrega típicos son:</p>
                <ul className="list-disc list-inside ml-4 mt-2 space-y-1">
                  <li><strong>Restaurantes:</strong> 30-45 minutos</li>
                  <li><strong>Farmacias:</strong> 20-30 minutos</li>
                  <li><strong>Mercados:</strong> 45-60 minutos</li>
                </ul>
                <p className="mt-2">
                  El tiempo exacto depende de la distancia y la carga de pedidos. 
                  Recibirás actualizaciones en tiempo real sobre el estado de tu pedido.
                </p>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-4">
              <AccordionTrigger>
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  ¿A qué zonas hacen entregas?
                </div>
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                <p>
                  Actualmente realizamos entregas en toda la ciudad y zonas cercanas. 
                  El bot te indicará automáticamente si tu dirección está dentro del área de cobertura 
                  cuando realices tu pedido.
                </p>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-5">
              <AccordionTrigger>
                <div className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4" />
                  ¿Qué métodos de pago aceptan?
                </div>
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                <p>Aceptamos los siguientes métodos de pago:</p>
                <ul className="list-disc list-inside ml-4 mt-2 space-y-1">
                  <li>Efectivo (al recibir el pedido)</li>
                  <li>Transferencia bancaria</li>
                  <li>Mercado Pago</li>
                  <li>Tarjetas de crédito/débito (según el local)</li>
                </ul>
                <p className="mt-2">
                  El método de pago se coordina con el vendedor antes de confirmar el pedido.
                </p>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-6">
              <AccordionTrigger>¿Puedo modificar o cancelar un pedido?</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                <p>
                  Sí, puedes cancelar tu pedido escribiendo <strong>"cancelar"</strong> mientras 
                  esté en estado <strong>"Pendiente"</strong> o <strong>"Confirmado"</strong>.
                </p>
                <p className="mt-2">
                  Una vez que el pedido está <strong>"En preparación"</strong> o <strong>"En camino"</strong>, 
                  debes hablar con el vendedor para coordinar cambios escribiendo 
                  <strong>"hablar con vendedor"</strong>.
                </p>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-7">
              <AccordionTrigger>¿Cómo hablo con una persona real?</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                <p>
                  En cualquier momento puedes escribir frases como:
                </p>
                <ul className="list-disc list-inside ml-4 mt-2 space-y-1">
                  <li><strong>"hablar con vendedor"</strong></li>
                  <li><strong>"hablar con alguien"</strong></li>
                  <li><strong>"necesito asistencia"</strong></li>
                  <li><strong>"hablar con humano"</strong></li>
                </ul>
                <p className="mt-2">
                  Un vendedor continuará la conversación contigo. Para volver al bot, 
                  el vendedor puede escribir <strong>"sigue bot"</strong>.
                </p>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-8">
              <AccordionTrigger>
                <div className="flex items-center gap-2">
                  <ShoppingCart className="h-4 w-4" />
                  ¿El bot entiende pedidos en lenguaje natural?
                </div>
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                <p>
                  Sí, nuestro bot está diseñado para entender pedidos escritos naturalmente. 
                  Por ejemplo, puedes escribir:
                </p>
                <ul className="list-disc list-inside ml-4 mt-2 space-y-1">
                  <li>"Quiero una pizza grande de muzzarella"</li>
                  <li>"Necesito comprar paracetamol"</li>
                  <li>"Me traes un kilo de tomates"</li>
                </ul>
                <p className="mt-2">
                  El bot identificará el tipo de producto y te mostrará los locales disponibles.
                </p>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </Card>

        {/* Contact Section */}
        <Card className="p-6 bg-primary/5">
          <h3 className="text-xl font-semibold mb-4">¿Necesitas más ayuda?</h3>
          <p className="text-muted-foreground mb-4">
            Si tienes alguna pregunta que no está respondida aquí, no dudes en contactarnos:
          </p>
          <div className="space-y-2 text-muted-foreground">
            <p className="flex items-center gap-2">
              <MessageCircle className="h-4 w-4 text-primary" />
              WhatsApp: <strong>+14155238886</strong>
            </p>
            <p className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-primary" />
              Escribe <strong>"hablar con vendedor"</strong> en el chat para asistencia personalizada
            </p>
          </div>
        </Card>
      </main>
    </div>
  );
};

export default Ayuda;
