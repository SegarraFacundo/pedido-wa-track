import { useEffect } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';

const SubdomainRouter = ({ children }: { children: React.ReactNode }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { locale } = useParams<{ locale: string }>();

  useEffect(() => {
    const hostname = window.location.hostname;
    const parts = hostname.split('.');
    
    let subdomain = '';
    if (parts.length >= 3) {
      subdomain = parts[0];
    } else if (parts.length === 2 && parts[0] !== 'lapacho') {
      subdomain = parts[0];
    }

    const prefix = locale ? `/${locale}` : '';

    switch (subdomain) {
      case 'admin':
        if (location.pathname !== `${prefix}/admin-auth` && location.pathname !== `${prefix}/admin` && location.pathname !== `${prefix}/brand-assets`) {
          navigate(`${prefix}/admin-auth`);
        }
        break;
      case 'soporte':
        if (location.pathname !== `${prefix}/soporte`) {
          navigate(`${prefix}/soporte`);
        }
        break;
      case 'plataforma':
        if (location.pathname !== `${prefix}/vendor-auth` && location.pathname !== `${prefix}/vendor-dashboard`) {
          navigate(`${prefix}/vendor-auth`);
        }
        break;
      default:
        if (location.pathname === `${prefix}/brand-assets`) {
          navigate(`${prefix}/`);
        }
        break;
    }
  }, [navigate, location, locale]);

  return <>{children}</>;
};

export default SubdomainRouter;
