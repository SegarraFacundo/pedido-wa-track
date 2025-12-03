import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Download, Sun, Moon, ArrowLeft, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

interface LogoVariant {
  name: string;
  description: string;
  lightSvg: string;
  darkSvg: string;
  width: number;
  height: number;
}

const logoVariants: LogoVariant[] = [
  {
    name: "Logo Icon",
    description: "Solo el ícono de la hoja",
    lightSvg: "/brand/logo-icon-light.svg",
    darkSvg: "/brand/logo-icon-dark.svg",
    width: 512,
    height: 512,
  },
  {
    name: "Logo + Texto",
    description: "Ícono con el nombre Lapacho",
    lightSvg: "/brand/logo-text-light.svg",
    darkSvg: "/brand/logo-text-dark.svg",
    width: 400,
    height: 100,
  },
  {
    name: "Logo Completo",
    description: "Ícono, nombre y slogan",
    lightSvg: "/brand/logo-full-light.svg",
    darkSvg: "/brand/logo-full-dark.svg",
    width: 400,
    height: 120,
  },
  {
    name: "Wordmark",
    description: "Solo el texto Lapacho",
    lightSvg: "/brand/wordmark-light.svg",
    darkSvg: "/brand/wordmark-dark.svg",
    width: 300,
    height: 80,
  },
];

const pngSizes = [64, 128, 256, 512, 1024];

const BrandAssets = () => {
  const navigate = useNavigate();
  const [downloading, setDownloading] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    checkAdminAccess();
  }, []);

  const checkAdminAccess = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        navigate('/admin-auth');
        return;
      }

      const { data: roles } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', session.user.id)
        .eq('role', 'admin')
        .single();

      if (!roles) {
        navigate('/admin');
        return;
      }
      
      setIsAdmin(true);
      setLoading(false);
    } catch (error) {
      console.error('Error checking admin access:', error);
      navigate('/admin-auth');
    }
  };

  const downloadSvg = (url: string, filename: string) => {
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadPng = async (svgUrl: string, filename: string, width: number, height: number, targetSize: number) => {
    setDownloading(`${filename}-${targetSize}`);
    
    try {
      const response = await fetch(svgUrl);
      const svgText = await response.text();
      
      const canvas = document.createElement("canvas");
      const scale = targetSize / Math.max(width, height);
      canvas.width = width * scale;
      canvas.height = height * scale;
      
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      
      const img = new Image();
      const svgBlob = new Blob([svgText], { type: "image/svg+xml;charset=utf-8" });
      const svgBlobUrl = URL.createObjectURL(svgBlob);
      
      img.onload = () => {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(svgBlobUrl);
        
        canvas.toBlob((blob) => {
          if (blob) {
            const link = document.createElement("a");
            link.href = URL.createObjectURL(blob);
            link.download = `${filename}-${targetSize}px.png`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(link.href);
          }
          setDownloading(null);
        }, "image/png");
      };
      
      img.src = svgBlobUrl;
    } catch (error) {
      console.error("Error downloading PNG:", error);
      setDownloading(null);
    }
  };

  const downloadAllAsZip = async () => {
    for (const variant of logoVariants) {
      const lightName = variant.lightSvg.split("/").pop()?.replace(".svg", "") || "";
      const darkName = variant.darkSvg.split("/").pop()?.replace(".svg", "") || "";
      downloadSvg(variant.lightSvg, `${lightName}.svg`);
      await new Promise(resolve => setTimeout(resolve, 300));
      downloadSvg(variant.darkSvg, `${darkName}.svg`);
      await new Promise(resolve => setTimeout(resolve, 300));
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link to="/admin" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="h-5 w-5" />
              <span>Volver al Admin</span>
            </Link>
            <h1 className="text-xl font-semibold text-foreground">Brand Assets</h1>
            <Button onClick={downloadAllAsZip} variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Descargar Todo (SVG)
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Brand Colors Section */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold mb-4 text-foreground">Colores de Marca</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="rounded-lg overflow-hidden border border-border">
              <div className="h-24 bg-[#E878A8]"></div>
              <div className="p-3 bg-card">
                <p className="font-medium text-foreground">Rosa Lapacho</p>
                <p className="text-sm text-muted-foreground">#E878A8</p>
              </div>
            </div>
            <div className="rounded-lg overflow-hidden border border-border">
              <div className="h-24 bg-[#D45A8A]"></div>
              <div className="p-3 bg-card">
                <p className="font-medium text-foreground">Rosa Oscuro</p>
                <p className="text-sm text-muted-foreground">#D45A8A</p>
              </div>
            </div>
            <div className="rounded-lg overflow-hidden border border-border">
              <div className="h-24 bg-[#1A1A1A]"></div>
              <div className="p-3 bg-card">
                <p className="font-medium text-foreground">Negro</p>
                <p className="text-sm text-muted-foreground">#1A1A1A</p>
              </div>
            </div>
            <div className="rounded-lg overflow-hidden border border-border">
              <div className="h-24 bg-white border-b border-border"></div>
              <div className="p-3 bg-card">
                <p className="font-medium text-foreground">Blanco</p>
                <p className="text-sm text-muted-foreground">#FFFFFF</p>
              </div>
            </div>
          </div>
        </section>

        {/* Logo Variants */}
        <section>
          <h2 className="text-2xl font-semibold mb-6 text-foreground">Variantes del Logo</h2>
          
          <div className="grid gap-8">
            {logoVariants.map((variant) => (
              <Card key={variant.name} className="overflow-hidden">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <div>
                      <span className="text-foreground">{variant.name}</span>
                      <p className="text-sm font-normal text-muted-foreground mt-1">{variant.description}</p>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Tabs defaultValue="light" className="w-full">
                    <TabsList className="mb-4">
                      <TabsTrigger value="light" className="gap-2">
                        <Sun className="h-4 w-4" />
                        Tema Claro
                      </TabsTrigger>
                      <TabsTrigger value="dark" className="gap-2">
                        <Moon className="h-4 w-4" />
                        Tema Oscuro
                      </TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="light">
                      <div className="space-y-4">
                        {/* Preview */}
                        <div className="bg-white border border-border rounded-lg p-8 flex items-center justify-center min-h-[200px]">
                          <img 
                            src={variant.lightSvg} 
                            alt={`${variant.name} - Tema Claro`}
                            className="max-w-full max-h-32 object-contain"
                          />
                        </div>
                        
                        {/* Download Options */}
                        <div className="flex flex-wrap gap-2">
                          <Button 
                            variant="default" 
                            size="sm"
                            onClick={() => downloadSvg(variant.lightSvg, `lapacho-${variant.name.toLowerCase().replace(/\s+/g, '-')}-light.svg`)}
                          >
                            <Download className="h-4 w-4 mr-2" />
                            SVG
                          </Button>
                          {pngSizes.map((size) => (
                            <Button
                              key={size}
                              variant="outline"
                              size="sm"
                              disabled={downloading === `${variant.name}-light-${size}`}
                              onClick={() => downloadPng(
                                variant.lightSvg,
                                `lapacho-${variant.name.toLowerCase().replace(/\s+/g, '-')}-light`,
                                variant.width,
                                variant.height,
                                size
                              )}
                            >
                              <Download className="h-4 w-4 mr-2" />
                              PNG {size}px
                            </Button>
                          ))}
                        </div>
                      </div>
                    </TabsContent>
                    
                    <TabsContent value="dark">
                      <div className="space-y-4">
                        {/* Preview */}
                        <div className="bg-[#1A1A1A] border border-border rounded-lg p-8 flex items-center justify-center min-h-[200px]">
                          <img 
                            src={variant.darkSvg} 
                            alt={`${variant.name} - Tema Oscuro`}
                            className="max-w-full max-h-32 object-contain"
                          />
                        </div>
                        
                        {/* Download Options */}
                        <div className="flex flex-wrap gap-2">
                          <Button 
                            variant="default" 
                            size="sm"
                            onClick={() => downloadSvg(variant.darkSvg, `lapacho-${variant.name.toLowerCase().replace(/\s+/g, '-')}-dark.svg`)}
                          >
                            <Download className="h-4 w-4 mr-2" />
                            SVG
                          </Button>
                          {pngSizes.map((size) => (
                            <Button
                              key={size}
                              variant="outline"
                              size="sm"
                              disabled={downloading === `${variant.name}-dark-${size}`}
                              onClick={() => downloadPng(
                                variant.darkSvg,
                                `lapacho-${variant.name.toLowerCase().replace(/\s+/g, '-')}-dark`,
                                variant.width,
                                variant.height,
                                size
                              )}
                            >
                              <Download className="h-4 w-4 mr-2" />
                              PNG {size}px
                            </Button>
                          ))}
                        </div>
                      </div>
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Usage Guidelines */}
        <section className="mt-12">
          <h2 className="text-2xl font-semibold mb-4 text-foreground">Guía de Uso</h2>
          <Card>
            <CardContent className="pt-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h3 className="font-semibold text-foreground mb-2">✓ Uso Correcto</h3>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Usar los colores oficiales de la marca</li>
                    <li>• Mantener proporciones originales</li>
                    <li>• Dejar espacio suficiente alrededor del logo</li>
                    <li>• Usar tema claro sobre fondos claros</li>
                    <li>• Usar tema oscuro sobre fondos oscuros</li>
                  </ul>
                </div>
                <div>
                  <h3 className="font-semibold text-foreground mb-2">✗ Evitar</h3>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Distorsionar o estirar el logo</li>
                    <li>• Cambiar los colores de la marca</li>
                    <li>• Agregar efectos como sombras o brillos</li>
                    <li>• Usar sobre fondos que reduzcan legibilidad</li>
                    <li>• Rotar o inclinar el logo</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  );
};

export default BrandAssets;
