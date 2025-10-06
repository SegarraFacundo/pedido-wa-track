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

    // Solo redirigir si estamos en la ruta raíz
    if (location.pathname === '/') {
      switch (subdomain) {
        case 'admin':
          navigate('/admin-auth');
          break;
        case 'soporte':
          navigate('/soporte');
          break;
        case 'plataforma':
          navigate('/vendor-auth');
          break;
        // lapacho.ar (sin subdominio) se queda en /
        default:
          break;
      }
    }
  }, [navigate, location]);

  return <>{children}</>;
};

export default SubdomainRouter;
