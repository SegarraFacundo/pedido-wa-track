import { Link } from "react-router-dom";
import { ArrowLeft, Leaf } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";
import { useLocalePath } from "@/hooks/useLocalePath";

export default function Terminos() {
  const { t } = useTranslation();
  const lp = useLocalePath();

  const renderSection = (titleKey: string, textKey?: string, introKey?: string, itemsKey?: string) => (
    <section>
      <h2 className="text-xl font-semibold text-foreground mt-8 mb-4">{t(titleKey)}</h2>
      {textKey && <p>{t(textKey)}</p>}
      {introKey && <p>{t(introKey)}</p>}
      {itemsKey && (
        <ul className="list-disc pl-6 space-y-2 mt-2">
          {(t(itemsKey, { returnObjects: true }) as string[]).map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      )}
    </section>
  );

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
        <h1 className="text-3xl md:text-4xl font-bold mb-8">{t('terminos.title')}</h1>
        
        <div className="prose prose-gray max-w-none space-y-6 text-muted-foreground">
          <p className="text-sm">{t('common.lastUpdate')}</p>

          {renderSection('terminos.s1_title', 'terminos.s1_text')}
          {renderSection('terminos.s2_title', 'terminos.s2_text')}
          {renderSection('terminos.s3_title', undefined, 'terminos.s3_intro', 'terminos.s3_items')}
          {renderSection('terminos.s4_title', undefined, 'terminos.s4_intro', 'terminos.s4_items')}
          {renderSection('terminos.s5_title', undefined, 'terminos.s5_intro', 'terminos.s5_items')}
          {renderSection('terminos.s6_title', 'terminos.s6_text')}
          {renderSection('terminos.s7_title', 'terminos.s7_text')}
          {renderSection('terminos.s8_title', 'terminos.s8_text')}
          {renderSection('terminos.s9_title', 'terminos.s9_text')}

          <section>
            <h2 className="text-xl font-semibold text-foreground mt-8 mb-4">{t('terminos.s10_title')}</h2>
            <p>{t('terminos.s10_text')}</p>
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