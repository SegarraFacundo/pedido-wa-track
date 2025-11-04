import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function maskPhone(phone: string): string {
  if (!phone) return '';
  
  // Si es un número de teléfono argentino (ej: 5493464448309)
  // Muestra: 549346****8309 (primeros 6 dígitos + asteriscos + últimos 4)
  if (phone.length >= 10) {
    const start = phone.substring(0, 6);
    const end = phone.substring(phone.length - 4);
    const middle = '*'.repeat(Math.min(4, phone.length - 10));
    return `${start}${middle}${end}`;
  }
  
  // Para números más cortos, mostrar solo los últimos 4 dígitos
  return `****${phone.substring(phone.length - 4)}`;
}
