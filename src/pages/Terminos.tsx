import { Link } from "react-router-dom";
import { ArrowLeft, Leaf } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Terminos() {
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
        <h1 className="text-3xl md:text-4xl font-bold mb-8">Términos y Condiciones</h1>
        
        <div className="prose prose-gray max-w-none space-y-6 text-muted-foreground">
          <p className="text-sm">Última actualización: Enero 2025</p>

          <section>
            <h2 className="text-xl font-semibold text-foreground mt-8 mb-4">1. Aceptación de los Términos</h2>
            <p>
              Al acceder y utilizar el servicio de Lapacho ("el Servicio"), usted acepta estar sujeto a estos Términos y Condiciones. 
              Si no está de acuerdo con alguna parte de estos términos, no podrá acceder al Servicio.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mt-8 mb-4">2. Descripción del Servicio</h2>
            <p>
              Lapacho es un asistente automatizado que facilita la toma de pedidos a través de WhatsApp para negocios locales. 
              El Servicio actúa como intermediario tecnológico entre los clientes y los negocios adheridos.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mt-8 mb-4">3. Uso del Servicio</h2>
            <p>El usuario se compromete a:</p>
            <ul className="list-disc pl-6 space-y-2 mt-2">
              <li>Proporcionar información veraz y actualizada</li>
              <li>No utilizar el Servicio para fines ilegales o no autorizados</li>
              <li>No interferir con el funcionamiento normal del Servicio</li>
              <li>Respetar los derechos de propiedad intelectual de Lapacho</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mt-8 mb-4">4. Responsabilidades de los Negocios</h2>
            <p>Los negocios que utilizan Lapacho son responsables de:</p>
            <ul className="list-disc pl-6 space-y-2 mt-2">
              <li>Mantener actualizado su catálogo de productos y precios</li>
              <li>Cumplir con los pedidos recibidos a través de la plataforma</li>
              <li>Garantizar la calidad de sus productos y servicios</li>
              <li>Cumplir con las normativas locales aplicables a su actividad</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mt-8 mb-4">5. Limitación de Responsabilidad</h2>
            <p>
              Lapacho actúa únicamente como intermediario tecnológico. No somos responsables por:
            </p>
            <ul className="list-disc pl-6 space-y-2 mt-2">
              <li>La calidad, seguridad o legalidad de los productos ofrecidos por los negocios</li>
              <li>El cumplimiento de los pedidos por parte de los negocios</li>
              <li>Disputas entre clientes y negocios</li>
              <li>Interrupciones del servicio por causas ajenas a nuestro control</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mt-8 mb-4">6. Propiedad Intelectual</h2>
            <p>
              Todo el contenido del Servicio, incluyendo pero no limitado a textos, gráficos, logotipos, iconos, 
              imágenes y software, es propiedad de Lapacho o sus licenciantes y está protegido por las leyes de 
              propiedad intelectual aplicables.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mt-8 mb-4">7. Modificaciones</h2>
            <p>
              Nos reservamos el derecho de modificar estos Términos y Condiciones en cualquier momento. 
              Las modificaciones entrarán en vigor desde su publicación en el sitio web. 
              El uso continuado del Servicio implica la aceptación de los términos modificados.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mt-8 mb-4">8. Terminación</h2>
            <p>
              Podemos suspender o terminar su acceso al Servicio en cualquier momento, sin previo aviso, 
              si consideramos que ha violado estos Términos y Condiciones o por cualquier otra razón que 
              consideremos apropiada.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mt-8 mb-4">9. Ley Aplicable</h2>
            <p>
              Estos Términos y Condiciones se regirán e interpretarán de acuerdo con las leyes de la República Argentina, 
              sin tener en cuenta sus disposiciones sobre conflictos de leyes.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mt-8 mb-4">10. Contacto</h2>
            <p>
              Si tiene preguntas sobre estos Términos y Condiciones, puede contactarnos en:
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
