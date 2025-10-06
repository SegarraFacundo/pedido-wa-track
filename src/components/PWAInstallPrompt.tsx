import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Download, X } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface PWAInstallPromptProps {
  userType?: 'vendor' | 'soporte' | 'admin';
}

export function PWAInstallPrompt({ userType = 'vendor' }: PWAInstallPromptProps) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    console.log(`Usuario ${outcome === 'accepted' ? 'aceptó' : 'rechazó'} la instalación`);
    
    setDeferredPrompt(null);
    setShowPrompt(false);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    // Volver a mostrar después de 7 días
    localStorage.setItem('pwa-dismissed', Date.now().toString());
  };

  // No mostrar si ya está instalado o si fue rechazado recientemente
  useEffect(() => {
    const dismissed = localStorage.getItem('pwa-dismissed');
    if (dismissed) {
      const dismissedTime = parseInt(dismissed);
      const sevenDays = 7 * 24 * 60 * 60 * 1000;
      if (Date.now() - dismissedTime < sevenDays) {
        setShowPrompt(false);
      }
    }

    // Detectar si ya está instalado
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setShowPrompt(false);
    }
  }, []);

  if (!showPrompt || !deferredPrompt) return null;

  const titles = {
    vendor: 'Instala la App de Vendedor',
    soporte: 'Instala la App de Soporte',
    admin: 'Instala la App de Admin'
  };

  const descriptions = {
    vendor: 'Accede rápidamente a tus pedidos y productos',
    soporte: 'Gestiona tickets de soporte desde tu celular',
    admin: 'Controla toda la plataforma desde tu dispositivo'
  };

  return (
    <Card className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 p-4 shadow-lg z-50 border-primary">
      <div className="flex items-start gap-3">
        <Download className="h-6 w-6 text-primary flex-shrink-0 mt-1" />
        <div className="flex-1">
          <h3 className="font-semibold mb-1">{titles[userType]}</h3>
          <p className="text-sm text-muted-foreground mb-3">
            {descriptions[userType]}
          </p>
          <div className="flex gap-2">
            <Button onClick={handleInstall} size="sm" className="flex-1">
              Instalar
            </Button>
            <Button onClick={handleDismiss} size="sm" variant="ghost">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
