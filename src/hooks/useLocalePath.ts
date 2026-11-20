// La app ya no usa prefijo de idioma en las rutas. Este hook queda como shim
// (passthrough) para las pantallas del cliente: devuelve la ruta tal cual.
export function useLocalePath() {
  return (path: string) => (path.startsWith("/") ? path : `/${path}`);
}
