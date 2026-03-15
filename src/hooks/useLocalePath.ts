import { useParams } from 'react-router-dom';

export function useLocalePath() {
  const { locale } = useParams<{ locale: string }>();
  const prefix = locale ? `/${locale}` : '';

  return (path: string) => {
    if (path.startsWith('/')) {
      return `${prefix}${path}`;
    }
    return `${prefix}/${path}`;
  };
}
