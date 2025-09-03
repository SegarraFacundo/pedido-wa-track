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
}

export interface Vendor {
  id: string;
  name: string;
  category: 'restaurant' | 'pharmacy' | 'market' | 'other';
  phone: string;
  address: string;
  isActive: boolean;
  rating: number;
  totalOrders: number;
  joinedAt: Date;
  image?: string;
}

export interface Message {
  id: string;
  orderId: string;
  sender: 'customer' | 'vendor' | 'system';
  content: string;
  timestamp: Date;
  isRead: boolean;
}