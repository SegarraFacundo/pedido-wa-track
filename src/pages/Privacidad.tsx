import { Link } from "react-router-dom";
import { ArrowLeft, Leaf } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Privacidad() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
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
                Volver
              </Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="container mx-auto px-4 py-12 max-w-3xl">
        <h1 className="text-3xl md:text-4xl font-bold mb-8">Política de Privacidad</h1>
        
        <div className="prose prose-gray max-w-none space-y-6 text-muted-foreground">
          <p className="text-sm">Última actualización: Enero 2025</p>

          <section>
            <h2 className="text-xl font-semibold text-foreground mt-8 mb-4">1. Introducción</h2>
            <p>
              En Lapacho nos comprometemos a proteger su privacidad. Esta Política de Privacidad explica cómo 
              recopilamos, usamos, divulgamos y protegemos su información cuando utiliza nuestro servicio.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mt-8 mb-4">2. Información que Recopilamos</h2>
            <p>Podemos recopilar los siguientes tipos de información:</p>
            
            <h3 className="text-lg font-medium text-foreground mt-4 mb-2">2.1 Información Personal</h3>
            <ul className="list-disc pl-6 space-y-2">
              <li>Nombre y apellido</li>
              <li>Número de teléfono (WhatsApp)</li>
              <li>Dirección de entrega</li>
              <li>Dirección de correo electrónico (opcional)</li>
            </ul>

            <h3 className="text-lg font-medium text-foreground mt-4 mb-2">2.2 Información de Uso</h3>
            <ul className="list-disc pl-6 space-y-2">
              <li>Historial de pedidos</li>
              <li>Preferencias de productos</li>
              <li>Interacciones con el bot de WhatsApp</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mt-8 mb-4">3. Uso de la Información</h2>
            <p>Utilizamos la información recopilada para:</p>
            <ul className="list-disc pl-6 space-y-2 mt-2">
              <li>Procesar y gestionar sus pedidos</li>
              <li>Comunicarnos con usted sobre el estado de sus pedidos</li>
              <li>Mejorar nuestro servicio y experiencia del usuario</li>
              <li>Enviar notificaciones relevantes sobre su pedido</li>
              <li>Prevenir actividades fraudulentas</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mt-8 mb-4">4. Compartición de Información</h2>
            <p>Podemos compartir su información con:</p>
            <ul className="list-disc pl-6 space-y-2 mt-2">
              <li><strong className="text-foreground">Negocios:</strong> Compartimos la información necesaria para la preparación y entrega de su pedido</li>
              <li><strong className="text-foreground">Proveedores de servicios:</strong> Terceros que nos ayudan a operar el servicio</li>
              <li><strong className="text-foreground">Autoridades:</strong> Cuando sea requerido por ley o para proteger nuestros derechos</li>
            </ul>
            <p className="mt-4">
              No vendemos ni alquilamos su información personal a terceros para fines de marketing.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mt-8 mb-4">5. Seguridad de los Datos</h2>
            <p>
              Implementamos medidas de seguridad técnicas y organizativas apropiadas para proteger su información 
              personal contra el acceso no autorizado, la alteración, divulgación o destrucción.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mt-8 mb-4">6. Retención de Datos</h2>
            <p>
              Conservamos su información personal durante el tiempo necesario para cumplir con los fines descritos 
              en esta política, a menos que la ley requiera o permita un período de retención más largo.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mt-8 mb-4">7. Sus Derechos</h2>
            <p>Usted tiene derecho a:</p>
            <ul className="list-disc pl-6 space-y-2 mt-2">
              <li>Acceder a su información personal</li>
              <li>Rectificar datos inexactos</li>
              <li>Solicitar la eliminación de sus datos</li>
              <li>Oponerse al procesamiento de sus datos</li>
              <li>Solicitar la portabilidad de sus datos</li>
            </ul>
            <p className="mt-4">
              Para ejercer estos derechos, contáctenos a través de contacto@lapacho.ar
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mt-8 mb-4">8. Cookies y Tecnologías Similares</h2>
            <p>
              Nuestro sitio web puede utilizar cookies y tecnologías similares para mejorar su experiencia. 
              Puede configurar su navegador para rechazar cookies, aunque esto puede afectar algunas funcionalidades.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mt-8 mb-4">9. Menores de Edad</h2>
            <p>
              Nuestro servicio no está dirigido a menores de 18 años. No recopilamos intencionalmente información 
              personal de menores. Si descubrimos que hemos recopilado información de un menor, tomaremos medidas 
              para eliminar esa información.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mt-8 mb-4">10. Cambios en esta Política</h2>
            <p>
              Podemos actualizar esta Política de Privacidad periódicamente. Le notificaremos sobre cambios 
              significativos publicando la nueva política en nuestro sitio web y actualizando la fecha de 
              "última actualización".
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mt-8 mb-4">11. Contacto</h2>
            <p>
              Si tiene preguntas o inquietudes sobre esta Política de Privacidad, puede contactarnos en:
            </p>
            <p className="mt-2">
              <strong className="text-foreground">Email:</strong> contacto@lapacho.ar
            </p>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t py-8 mt-12">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>© 2025 Lapacho. Todos los derechos reservados.</p>
        </div>
      </footer>
    </div>
  );
}
