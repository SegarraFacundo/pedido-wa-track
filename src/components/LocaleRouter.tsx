import { useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const SUPPORTED_LOCALES = ['es', 'en', 'pt', 'ja'];
const DEFAULT_LOCALE = 'es';

export { SUPPORTED_LOCALES, DEFAULT_LOCALE };

export default function LocaleRouter({ children }: { children: React.ReactNode }) {
  const { locale } = useParams<{ locale: string }>();
  const { i18n } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (locale && SUPPORTED_LOCALES.includes(locale)) {
      if (i18n.language !== locale) {
        i18n.changeLanguage(locale);
        localStorage.setItem('i18n_lang', locale);
      }
      document.documentElement.lang = locale;
    }
  }, [locale, i18n]);

  // If no locale in URL, redirect to saved/default locale
  useEffect(() => {
    if (!locale) {
      const saved = localStorage.getItem('i18n_lang') || DEFAULT_LOCALE;
      const validLocale = SUPPORTED_LOCALES.includes(saved) ? saved : DEFAULT_LOCALE;
      navigate(`/${validLocale}${location.pathname}${location.search}${location.hash}`, { replace: true });
    }
  }, [locale, navigate, location.pathname, location.search, location.hash]);

  if (!locale) return null; // Will redirect

  return <>{children}</>;
}
