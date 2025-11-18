import { OrderStatus } from '@/types/order';

export type PaymentMethod = 'efectivo' | 'transferencia' | 'mercadopago';

export interface ValidationResult {
  allowed: boolean;
  reason?: string;
}

/**
 * Valida si se puede marcar un pedido como pagado según el método de pago y estado actual
 */
export function canMarkAsPaid(
  currentOrderStatus: OrderStatus,
  paymentMethod: string
): ValidationResult {
  
  // MercadoPago: ya está pagado automáticamente
  if (paymentMethod === 'mercadopago') {
    return { 
      allowed: false, 
      reason: 'MercadoPago confirma el pago automáticamente' 
    };
  }
  
  // Efectivo: solo al entregar o entregado
  if (paymentMethod === 'efectivo') {
    if (['delivering', 'delivered'].includes(currentOrderStatus)) {
      return { allowed: true };
    }
    return { 
      allowed: false, 
      reason: 'El pago en efectivo se confirma al momento de la entrega' 
    };
  }
  
  // Transferencia: en cualquier momento antes de delivered
  if (paymentMethod === 'transferencia') {
    if (currentOrderStatus !== 'delivered') {
      return { allowed: true };
    }
    return { 
      allowed: false, 
      reason: 'Ya no se puede modificar un pedido entregado' 
    };
  }
  
  return { allowed: true };
}

/**
 * Valida si se puede marcar un pedido como no pagado según el método de pago y estado actual
 */
export function canMarkAsUnpaid(
  currentOrderStatus: OrderStatus,
  paymentMethod: string
): ValidationResult {
  
  // MercadoPago: nunca se puede cambiar
  if (paymentMethod === 'mercadopago') {
    return { 
      allowed: false, 
      reason: 'No se puede modificar pagos de MercadoPago' 
    };
  }
  
  // Si ya está entregado: BLOQUEADO
  if (currentOrderStatus === 'delivered') {
    return { 
      allowed: false, 
      reason: 'No se puede marcar como no pagado un pedido ya entregado. Contactá a soporte si hay un problema.' 
    };
  }
  
  // Otros casos: permitir con confirmación
  return { allowed: true };
}

/**
 * Obtiene el ícono correspondiente al método de pago
 */
export function getPaymentMethodIcon(paymentMethod: string): string {
  switch (paymentMethod.toLowerCase()) {
    case 'efectivo':
      return '💵';
    case 'transferencia':
      return '🏦';
    case 'mercadopago':
      return '💳';
    default:
      return '💰';
  }
}

/**
 * Verifica si un método de pago es automático (no modificable manualmente)
 */
export function isAutomaticPaymentMethod(paymentMethod: string): boolean {
  return paymentMethod === 'mercadopago';
}
