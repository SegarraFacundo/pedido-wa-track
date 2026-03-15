import { Card } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { MessageCircle, ShoppingCart, Phone, Clock, MapPin, CreditCard, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";
import lapachoLogo from "@/assets/lapacho-logo.png";

const Ayuda = () => {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <header className="bg-white shadow-sm border-b sticky top-0 z-40">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img src={lapachoLogo} alt="Lapacho Logo" className="h-12" />
            </div>
            <Button variant="outline" asChild>
              <a href="/">{t('common.backHome')}</a>
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <Card className="p-8 mb-8 border-t-4 border-primary">
          <div className="text-center mb-6">
            <MessageCircle className="h-16 w-16 text-primary mx-auto mb-4" />
            <h2 className="text-3xl font-bold mb-4">{t('ayuda.welcomeTitle')}</h2>
            <p className="text-muted-foreground text-lg">{t('ayuda.welcomeDesc')}</p>
          </div>
        </Card>

        <Card className="p-6 mb-8 bg-primary/5">
          <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Phone className="h-5 w-5 text-primary" />
            {t('ayuda.quickStartTitle')}
          </h3>
          <ol className="space-y-3 text-muted-foreground">
            {(t('ayuda.quickStartSteps', { returnObjects: true }) as string[]).map((step, i) => (
              <li key={i} className="flex gap-3">
                <span className="font-bold text-primary">{i + 1}.</span>
                <span dangerouslySetInnerHTML={{ __html: step }} />
              </li>
            ))}
          </ol>
        </Card>

        <Card className="p-6 mb-8">
          <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <HelpCircle className="h-5 w-5 text-primary" />
            {t('ayuda.faqTitle')}
          </h3>
          
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="item-1">
              <AccordionTrigger>{t('ayuda.faq.order_q')}</AccordionTrigger>
              <AccordionContent className="text-muted-foreground space-y-2">
                <p>{t('ayuda.faq.order_a_intro')}</p>
                <ul className="list-disc list-inside ml-4 space-y-1">
                  {(t('ayuda.faq.order_a_items', { returnObjects: true }) as string[]).map((item, i) => (
                    <li key={i} dangerouslySetInnerHTML={{ __html: item }} />
                  ))}
                </ul>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-2">
              <AccordionTrigger>{t('ayuda.faq.commands_q')}</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                <ul className="space-y-2">
                  {(t('ayuda.faq.commands_items', { returnObjects: true }) as string[]).map((item, i) => (
                    <li key={i} dangerouslySetInnerHTML={{ __html: item }} />
                  ))}
                </ul>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-3">
              <AccordionTrigger>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  {t('ayuda.faq.delivery_q')}
                </div>
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                <p>{t('ayuda.faq.delivery_a_intro')}</p>
                <ul className="list-disc list-inside ml-4 mt-2 space-y-1">
                  {(t('ayuda.faq.delivery_a_items', { returnObjects: true }) as string[]).map((item, i) => (
                    <li key={i} dangerouslySetInnerHTML={{ __html: item }} />
                  ))}
                </ul>
                <p className="mt-2">{t('ayuda.faq.delivery_a_note')}</p>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-4">
              <AccordionTrigger>
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  {t('ayuda.faq.zones_q')}
                </div>
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                <p>{t('ayuda.faq.zones_a')}</p>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-5">
              <AccordionTrigger>
                <div className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4" />
                  {t('ayuda.faq.payment_q')}
                </div>
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                <p>{t('ayuda.faq.payment_a_intro')}</p>
                <ul className="list-disc list-inside ml-4 mt-2 space-y-1">
                  {(t('ayuda.faq.payment_a_items', { returnObjects: true }) as string[]).map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
                <p className="mt-2">{t('ayuda.faq.payment_a_note')}</p>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-6">
              <AccordionTrigger>{t('ayuda.faq.cancel_q')}</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                <p dangerouslySetInnerHTML={{ __html: t('ayuda.faq.cancel_a1') }} />
                <p className="mt-2" dangerouslySetInnerHTML={{ __html: t('ayuda.faq.cancel_a2') }} />
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-7">
              <AccordionTrigger>{t('ayuda.faq.human_q')}</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                <p>{t('ayuda.faq.human_a_intro')}</p>
                <ul className="list-disc list-inside ml-4 mt-2 space-y-1">
                  {(t('ayuda.faq.human_a_items', { returnObjects: true }) as string[]).map((item, i) => (
                    <li key={i} dangerouslySetInnerHTML={{ __html: item }} />
                  ))}
                </ul>
                <p className="mt-2" dangerouslySetInnerHTML={{ __html: t('ayuda.faq.human_a_note') }} />
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-8">
              <AccordionTrigger>
                <div className="flex items-center gap-2">
                  <ShoppingCart className="h-4 w-4" />
                  {t('ayuda.faq.natural_q')}
                </div>
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                <p>{t('ayuda.faq.natural_a_intro')}</p>
                <ul className="list-disc list-inside ml-4 mt-2 space-y-1">
                  {(t('ayuda.faq.natural_a_items', { returnObjects: true }) as string[]).map((item, i) => (
                    <li key={i}>"{item}"</li>
                  ))}
                </ul>
                <p className="mt-2">{t('ayuda.faq.natural_a_note')}</p>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </Card>

        <Card className="p-6 bg-primary/5">
          <h3 className="text-xl font-semibold mb-4">{t('ayuda.moreHelpTitle')}</h3>
          <p className="text-muted-foreground mb-4">{t('ayuda.moreHelpDesc')}</p>
          <div className="space-y-2 text-muted-foreground">
            <p className="flex items-center gap-2">
              <MessageCircle className="h-4 w-4 text-primary" />
              WhatsApp: <strong>+14155238886</strong>
            </p>
            <p className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-primary" />
              <span dangerouslySetInnerHTML={{ __html: t('ayuda.assistanceHint') }} />
            </p>
          </div>
        </Card>
      </main>
    </div>
  );
};

export default Ayuda;