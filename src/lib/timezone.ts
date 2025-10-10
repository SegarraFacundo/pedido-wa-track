/**
 * Utilidades para manejo de zona horaria de Argentina
 * Todas las operaciones de fecha/hora deben usar estas funciones
 * para mantener consistencia en toda la aplicación.
 */

export const ARGENTINA_TIMEZONE = 'America/Argentina/Buenos_Aires';

/**
 * Obtiene la hora actual en formato HH:MM:SS en zona horaria de Argentina
 */
export const getCurrentTimeInArgentina = (): string => {
  const now = new Date();
  return now.toLocaleTimeString('en-US', {
    timeZone: ARGENTINA_TIMEZONE,
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
};

/**
 * Obtiene el día actual de la semana en formato lowercase en zona horaria de Argentina
 * @returns 'monday', 'tuesday', etc.
 */
export const getCurrentDayInArgentina = (): string => {
  const now = new Date();
  return now.toLocaleDateString('en-US', { 
    weekday: 'long', 
    timeZone: ARGENTINA_TIMEZONE 
  }).toLowerCase();
};

/**
 * Obtiene la hora actual en formato HH:MM en zona horaria de Argentina
 */
export const getCurrentTimeShortInArgentina = (): string => {
  const now = new Date();
  return now.toLocaleTimeString('en-US', {
    timeZone: ARGENTINA_TIMEZONE,
    hour12: false,
    hour: '2-digit',
    minute: '2-digit'
  });
};

/**
 * Obtiene la fecha y hora actual formateada para mostrar en zona horaria de Argentina
 */
export const getCurrentDateTimeInArgentina = (): string => {
  const now = new Date();
  return now.toLocaleString('es-AR', {
    timeZone: ARGENTINA_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
};

/**
 * Verifica si un negocio está abierto basado en sus horarios
 * @param daysOpen Array de días que el negocio abre (ej: ['monday', 'tuesday'])
 * @param openingTime Hora de apertura en formato HH:MM:SS o HH:MM
 * @param closingTime Hora de cierre en formato HH:MM:SS o HH:MM
 * @param is24Hours Si el negocio está abierto 24 horas
 * @returns true si está abierto, false si está cerrado
 */
export const isVendorOpen = (
  daysOpen: string[] | null | undefined,
  openingTime: string | null | undefined,
  closingTime: string | null | undefined,
  is24Hours: boolean = false
): boolean => {
  // Si está abierto 24 horas, siempre está abierto
  if (is24Hours) return true;

  // Si no tiene horarios definidos, asumir que está abierto
  if (!openingTime || !closingTime) return true;

  const currentDay = getCurrentDayInArgentina();
  const currentTime = getCurrentTimeInArgentina();

  // Verificar si hoy está abierto
  if (daysOpen && !daysOpen.includes(currentDay)) {
    return false;
  }

  // Normalizar horarios a HH:MM:SS para comparación
  const normalizedOpeningTime = openingTime.length === 5 ? `${openingTime}:00` : openingTime;
  const normalizedClosingTime = closingTime.length === 5 ? `${closingTime}:00` : closingTime;

  return currentTime >= normalizedOpeningTime && currentTime <= normalizedClosingTime;
};
