export type OrderStatus = 
  | 'pending'
  | 'confirmed'
  | 'preparing'
  | 'ready'
  | 'delivering'
  | 'delivered'
  | 'cancelled';

export interface OrderItem {
  id: string;
  name: string;
  quantity: number;
  price: number;
  notes?: string;
}

export interface Order {
  id: string;
  customerName: string;
  customerPhone: string;
  vendorId: string;
  vendorName: string;
  items: OrderItem[];
  total: number;
  status: OrderStatus;
  address: string;
  coordinates?: {
    lat: number;
    lng: number;
  };
  estimatedDelivery?: Date;
  createdAt: Date;
  updatedAt: Date;
  notes?: string;
  deliveryPersonName?: string;
  deliveryPersonPhone?: string;
  payment_receipt_url?: string;
  address_is_manual?: boolean;  // Nueva: indica si la dirección fue ingresada manualmente
  // Masked fields for vendor view
  customerNameMasked?: string;
  customerPhoneMasked?: string;
  addressSimplified?: string;
}

export interface Vendor {
  id: string;
  name: string;
  category: 'restaurant' | 'pharmacy' | 'market' | 'other';
  phone: string;
  whatsappNumber?: string;
  address: string;
  isActive: boolean;
  rating: number;
  totalOrders: number;
  joinedAt: Date;
  image?: string;
  openingTime?: string;
  closingTime?: string;
  daysOpen?: string[];
  availableProducts?: any[];
}

export interface Message {
  id: string;
  orderId: string;
  sender: 'customer' | 'vendor' | 'system';
  content: string;
  timestamp: Date;
  isRead: boolean;
}