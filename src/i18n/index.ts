import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import es from './locales/es.json';
import en from './locales/en.json';
import pt from './locales/pt.json';
import ja from './locales/ja.json';

// Read saved language from localStorage, default to 'es'
const savedLang = typeof window !== 'undefined' 
  ? localStorage.getItem('i18n_lang') || 'es' 
  : 'es';

i18n
  .use(initReactI18next)
  .init({
    resources: {
      es: { translation: es },
      en: { translation: en },
      pt: { translation: pt },
      ja: { translation: ja },
    },
    lng: savedLang,
    fallbackLng: 'es',
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;
