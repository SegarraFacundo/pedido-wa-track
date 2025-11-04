import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function maskPhone(phone: string): string {
  if (!phone) return '';
  
  // Ocultar completamente excepto los últimos 4 dígitos
  if (phone.length >= 4) {
    return `****${phone.substring(phone.length - 4)}`;
  }
  
  // Para números muy cortos, solo asteriscos
  return '****';
}
