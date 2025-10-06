import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const SubdomainRouter = ({ children }: { children: React.ReactNode }) => {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const hostname = window.location.hostname;
    const subdomain = hostname.split('.')[0];

    // Solo redirigir si estamos en la ruta raíz
    if (location.pathname === '/') {
      switch (subdomain) {
        case 'admin':
          navigate('/admin');
          break;
        case 'soporte':
          navigate('/soporte');
          break;
        case 'plataforma':
          navigate('/plataforma');
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
