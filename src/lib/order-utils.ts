import { Order, OrderItem, OrderStatus, PaymentMethod } from '@/types/order';

/**
 * Formats raw order data from Supabase into the application's Order interface.
 */
export const formatOrder = (data: any): Order => ({
  id: data.id,
  customerName: data.customer_name,
  customerPhone: data.customer_phone,
  vendorId: data.vendor_id,
  vendorName: data.vendor?.name || '',
  items: (Array.isArray(data.items) ? data.items : []).map((item: any) => ({
    id: item.product_id || item.id,
    name: item.product_name || item.name,
    quantity: item.quantity,
    price: Number(item.price),
    notes: item.notes
  })),
  total: Number(data.total),
  status: data.status as OrderStatus,
  address: data.address,
  coordinates: data.coordinates ? (data.coordinates as any) : undefined,
  estimatedDelivery: data.estimated_delivery ? new Date(data.estimated_delivery) : undefined,
  createdAt: new Date(data.created_at),
  updatedAt: new Date(data.updated_at),
  notes: data.notes,
  deliveryPersonName: data.delivery_person_name,
  deliveryPersonPhone: data.delivery_person_phone,
  payment_receipt_url: data.payment_receipt_url,
  address_is_manual: data.address_is_manual || false,
  payment_status: data.payment_status,
  payment_method: data.payment_method as PaymentMethod | undefined,
  paid_at: data.paid_at ? new Date(data.paid_at) : undefined,
  delivery_type: (data.delivery_type as 'delivery' | 'pickup') || 'delivery',
  customerNameMasked: maskName(data.customer_name),
  customerPhoneMasked: maskPhone(data.customer_phone),
  addressSimplified: simplifyAddress(data.address)
});

/**
 * Masks a phone number showing only the last 4 digits.
 */
export const maskPhone = (phone?: string): string => {
  if (!phone) return '****';
  return '****' + phone.slice(-4);
};

/**
 * Masks a name showing only the first 3 characters.
 */
export const maskName = (name?: string): string => {
  if (!name) return '***';
  return name.substring(0, 3) + '***';
};

/**
 * Simplifies an address by taking only the first part before a comma.
 */
export const simplifyAddress = (address?: string): string => {
  if (!address) return '';
  return address.split(',')[0];
};
