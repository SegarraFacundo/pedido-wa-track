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

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/plataforma" element={<Platform />} />
          <Route path="/vendor-auth" element={<VendorAuth />} />
          <Route path="/vendor-dashboard" element={<VendorDashboard />} />
          <Route path="/ayuda" element={<Ayuda />} />
          <Route path="/admin-auth" element={<AdminAuth />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/soporte" element={<Soporte />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
