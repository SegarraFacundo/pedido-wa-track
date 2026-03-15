import { Link } from "react-router-dom";
import { ArrowLeft, Leaf } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";

export default function Privacidad() {
  const { t } = useTranslation();

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

      <main className="container mx-auto px-4 py-12 max-w-3xl">
        <h1 className="text-3xl md:text-4xl font-bold mb-8">{t('privacidad.title')}</h1>
        
        <div className="prose prose-gray max-w-none space-y-6 text-muted-foreground">
          <p className="text-sm">{t('common.lastUpdate')}</p>

          <section>
            <h2 className="text-xl font-semibold text-foreground mt-8 mb-4">{t('privacidad.s1_title')}</h2>
            <p>{t('privacidad.s1_text')}</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mt-8 mb-4">{t('privacidad.s2_title')}</h2>
            <p>{t('privacidad.s2_intro')}</p>
            
            <h3 className="text-lg font-medium text-foreground mt-4 mb-2">{t('privacidad.s2_personal_title')}</h3>
            <ul className="list-disc pl-6 space-y-2">
              {(t('privacidad.s2_personal_items', { returnObjects: true }) as string[]).map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>

            <h3 className="text-lg font-medium text-foreground mt-4 mb-2">{t('privacidad.s2_usage_title')}</h3>
            <ul className="list-disc pl-6 space-y-2">
              {(t('privacidad.s2_usage_items', { returnObjects: true }) as string[]).map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mt-8 mb-4">{t('privacidad.s3_title')}</h2>
            <p>{t('privacidad.s3_intro')}</p>
            <ul className="list-disc pl-6 space-y-2 mt-2">
              {(t('privacidad.s3_items', { returnObjects: true }) as string[]).map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mt-8 mb-4">{t('privacidad.s4_title')}</h2>
            <p>{t('privacidad.s4_intro')}</p>
            <ul className="list-disc pl-6 space-y-2 mt-2">
              <li><strong className="text-foreground">{t('privacidad.s4_business')}</strong> {t('privacidad.s4_business_desc')}</li>
              <li><strong className="text-foreground">{t('privacidad.s4_providers')}</strong> {t('privacidad.s4_providers_desc')}</li>
              <li><strong className="text-foreground">{t('privacidad.s4_authorities')}</strong> {t('privacidad.s4_authorities_desc')}</li>
            </ul>
            <p className="mt-4">{t('privacidad.s4_no_sell')}</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mt-8 mb-4">{t('privacidad.s5_title')}</h2>
            <p>{t('privacidad.s5_text')}</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mt-8 mb-4">{t('privacidad.s6_title')}</h2>
            <p>{t('privacidad.s6_text')}</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mt-8 mb-4">{t('privacidad.s7_title')}</h2>
            <p>{t('privacidad.s7_intro')}</p>
            <ul className="list-disc pl-6 space-y-2 mt-2">
              {(t('privacidad.s7_items', { returnObjects: true }) as string[]).map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
            <p className="mt-4">{t('privacidad.s7_exercise')}</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mt-8 mb-4">{t('privacidad.s8_title')}</h2>
            <p>{t('privacidad.s8_text')}</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mt-8 mb-4">{t('privacidad.s9_title')}</h2>
            <p>{t('privacidad.s9_text')}</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mt-8 mb-4">{t('privacidad.s10_title')}</h2>
            <p>{t('privacidad.s10_text')}</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mt-8 mb-4">{t('privacidad.s11_title')}</h2>
            <p>{t('privacidad.s11_text')}</p>
            <p className="mt-2">
              <strong className="text-foreground">Email:</strong> {t('common.contactEmail')}
            </p>
          </section>
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