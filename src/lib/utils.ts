import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function maskPhone(phone: string): string {
  if (!phone) return '';
  
  // Eliminar cualquier carácter que no sea número
  const cleanPhone = phone.replace(/\D/g, '');
  
  // Ocultar completamente excepto los últimos 4 dígitos
  if (cleanPhone.length >= 4) {
    return `****${cleanPhone.substring(cleanPhone.length - 4)}`;
  }
  
  // Para números muy cortos, solo asteriscos
  return '****';
}
