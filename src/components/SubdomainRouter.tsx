import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const SubdomainRouter = ({ children }: { children: React.ReactNode }) => {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const hostname = window.location.hostname;
    const parts = hostname.split('.');
    
    // Detectar subdominio (debe tener al menos 3 partes: subdominio.dominio.tld)
    let subdomain = '';
    if (parts.length >= 3) {
      subdomain = parts[0];
    } else if (parts.length === 2 && parts[0] !== 'lapacho') {
      // Para desarrollo local como plataforma.localhost
      subdomain = parts[0];
    }

    // Redirigir según el subdominio
    switch (subdomain) {
      case 'admin':
        // Si no está en /admin-auth, /admin o /brand-assets, redirigir
        if (location.pathname !== '/admin-auth' && location.pathname !== '/admin' && location.pathname !== '/brand-assets') {
          navigate('/admin-auth');
        }
        break;
      case 'soporte':
        // Si no está en /soporte o /soporte-auth, redirigir
        // (permitir /soporte-auth evita el loop: /soporte manda a /soporte-auth cuando no hay sesión válida)
        if (location.pathname !== '/soporte' && location.pathname !== '/soporte-auth') {
          navigate('/soporte');
        }
        break;
      case 'repartidor':
        // Permitir /repartidor y /repartidor-auth (mismo criterio que soporte, sin loop).
        if (location.pathname !== '/repartidor' && location.pathname !== '/repartidor-auth') {
          navigate('/repartidor');
        }
        break;
      case 'plataforma':
        // Si no está en /vendor-auth o /vendor-dashboard, redirigir
        if (location.pathname !== '/vendor-auth' && location.pathname !== '/vendor-dashboard') {
          navigate('/vendor-auth');
        }
        break;
      // lapacho.ar (sin subdominio) - sin restricciones
      default:
        // Si intenta acceder a /brand-assets desde otro subdominio, redirigir
        if (location.pathname === '/brand-assets') {
          navigate('/');
        }
        break;
    }
  }, [navigate, location]);

  return <>{children}</>;
};

export default SubdomainRouter;
