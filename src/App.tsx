import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
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
import Terminos from "./pages/Terminos";
import Privacidad from "./pages/Privacidad";
import Contacto from "./pages/Contacto";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
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
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </SubdomainRouter>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
