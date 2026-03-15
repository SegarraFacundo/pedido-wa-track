import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Landing from "./pages/Landing";
import Platform from "./pages/Platform";
import NotFound from "./pages/NotFound";
import VendorAuth from "./pages/VendorAuth";
import VendorDashboard from "./pages/VendorDashboard";
import Ayuda from "./pages/Ayuda";
import AdminAuth from "./pages/AdminAuth";
import Admin from "./pages/Admin";
import Soporte from "./pages/Soporte";
import SoporteAuth from "./pages/SoporteAuth";
import PaymentConfirmation from "./pages/PaymentConfirmation";
import SubdomainRouter from "./components/SubdomainRouter";
import LocaleRouter from "./components/LocaleRouter";
import Terminos from "./pages/Terminos";
import Privacidad from "./pages/Privacidad";
import Contacto from "./pages/Contacto";
import BrandAssets from "./pages/BrandAssets";
import ProductImage from "./pages/ProductImage";

const queryClient = new QueryClient();

function LocalizedRoutes() {
  return (
    <LocaleRouter>
      <SubdomainRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/plataforma" element={<Platform />} />
          <Route path="/vendor-auth" element={<VendorAuth />} />
          <Route path="/vendor-dashboard" element={<VendorDashboard />} />
          <Route path="/ayuda" element={<Ayuda />} />
          <Route path="/admin-auth" element={<AdminAuth />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/soporte-auth" element={<SoporteAuth />} />
          <Route path="/soporte" element={<Soporte />} />
          <Route path="/payment-confirmation" element={<PaymentConfirmation />} />
          <Route path="/terminos" element={<Terminos />} />
          <Route path="/privacidad" element={<Privacidad />} />
          <Route path="/contacto" element={<Contacto />} />
          <Route path="/brand-assets" element={<BrandAssets />} />
          <Route path="/p/:productId" element={<ProductImage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </SubdomainRouter>
    </LocaleRouter>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          {/* Redirect root to default locale */}
          <Route path="/" element={<RedirectToLocale />} />
          {/* All localized routes */}
          <Route path="/:locale/*" element={<LocalizedRoutes />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

function RedirectToLocale() {
  const saved = localStorage.getItem('i18n_lang') || 'es';
  const locales = ['es', 'en', 'pt', 'ja'];
  const locale = locales.includes(saved) ? saved : 'es';
  return <Navigate to={`/${locale}`} replace />;
}

export default App;
