import { Order, Vendor, Message } from "@/types/order";

export const mockVendors: Vendor[] = [
  {
    id: "v1",
    name: "Burger Palace",
    category: "restaurant",
    phone: "+54 11 4567-8901",
    address: "Av. Corrientes 1234, CABA",
    isActive: true,
    rating: 4.5,
    totalOrders: 156,
    joinedAt: new Date("2024-01-15"),
    image: "/burger-palace.jpg"
  },
  {
    id: "v2",
    name: "Farmacia San Martín",
    category: "pharmacy",
    phone: "+54 11 4567-8902",
    address: "Av. San Martín 567, CABA",
    isActive: true,
    rating: 4.8,
    totalOrders: 89,
    joinedAt: new Date("2024-02-20")
  },
  {
    id: "v3",
    name: "Super Fresh Market",
    category: "market",
    phone: "+54 11 4567-8903",
    address: "Av. Rivadavia 890, CABA",
    isActive: false,
    rating: 4.2,
    totalOrders: 234,
    joinedAt: new Date("2024-01-01")
  },
  {
    id: "v4",
    name: "Pizza Express",
    category: "restaurant",
    phone: "+54 11 4567-8904",
    address: "Av. Belgrano 345, CABA",
    isActive: true,
    rating: 4.6,
    totalOrders: 198,
    joinedAt: new Date("2024-03-10")
  }
];

export const mockOrders: Order[] = [
  {
    id: "ord-001",
    customerName: "María González",
    customerPhone: "+54 11 5555-0001",
    vendorId: "v1",
    vendorName: "Burger Palace",
    items: [
      { id: "i1", name: "Hamburguesa Clásica", quantity: 2, price: 2500 },
      { id: "i2", name: "Papas Fritas", quantity: 1, price: 1200 },
      { id: "i3", name: "Coca Cola 500ml", quantity: 2, price: 800 }
    ],
    total: 7900,
    status: "preparing",
    address: "Av. Santa Fe 2345, Piso 3, CABA",
    coordinates: { lat: -34.5956, lng: -58.4087 },
    estimatedDelivery: new Date(Date.now() + 30 * 60000),
    createdAt: new Date(Date.now() - 15 * 60000),
    updatedAt: new Date(Date.now() - 5 * 60000),
    notes: "Sin cebolla en las hamburguesas"
  },
  {
    id: "ord-002",
    customerName: "Juan Pérez",
    customerPhone: "+54 11 5555-0002",
    vendorId: "v2",
    vendorName: "Farmacia San Martín",
    items: [
      { id: "i4", name: "Ibuprofeno 600mg", quantity: 1, price: 1500 },
      { id: "i5", name: "Vitamina C", quantity: 2, price: 2200 }
    ],
    total: 5900,
    status: "delivering",
    address: "Av. Corrientes 4567, CABA",
    coordinates: { lat: -34.6037, lng: -58.3816 },
    estimatedDelivery: new Date(Date.now() + 20 * 60000),
    createdAt: new Date(Date.now() - 45 * 60000),
    updatedAt: new Date(Date.now() - 10 * 60000),
    deliveryPersonName: "Carlos Mendez",
    deliveryPersonPhone: "+54 11 5555-9999"
  },
  {
    id: "ord-003",
    customerName: "Ana Rodríguez",
    customerPhone: "+54 11 5555-0003",
    vendorId: "v4",
    vendorName: "Pizza Express",
    items: [
      { id: "i6", name: "Pizza Muzzarella Grande", quantity: 1, price: 4500 },
      { id: "i7", name: "Pizza Napolitana Grande", quantity: 1, price: 5200 }
    ],
    total: 9700,
    status: "pending",
    address: "Av. Belgrano 789, CABA",
    createdAt: new Date(Date.now() - 5 * 60000),
    updatedAt: new Date(Date.now() - 5 * 60000)
  },
  {
    id: "ord-004",
    customerName: "Luis Martínez",
    customerPhone: "+54 11 5555-0004",
    vendorId: "v1",
    vendorName: "Burger Palace",
    items: [
      { id: "i8", name: "Hamburguesa Doble", quantity: 1, price: 3500 },
      { id: "i9", name: "Onion Rings", quantity: 1, price: 1800 }
    ],
    total: 5300,
    status: "delivered",
    address: "Av. Cabildo 1234, CABA",
    createdAt: new Date(Date.now() - 120 * 60000),
    updatedAt: new Date(Date.now() - 60 * 60000)
  }
];

export const mockMessages: Message[] = [
  {
    id: "msg-001",
    orderId: "ord-001",
    sender: "system",
    content: "Pedido confirmado por el vendedor",
    timestamp: new Date(Date.now() - 14 * 60000),
    isRead: true
  },
  {
    id: "msg-002",
    orderId: "ord-001",
    sender: "vendor",
    content: "Hola María! Tu pedido ya está siendo preparado. Las hamburguesas van sin cebolla como pediste 👍",
    timestamp: new Date(Date.now() - 10 * 60000),
    isRead: true
  },
  {
    id: "msg-003",
    orderId: "ord-001",
    sender: "customer",
    content: "Perfecto! Cuánto tiempo aproximadamente?",
    timestamp: new Date(Date.now() - 8 * 60000),
    isRead: true
  },
  {
    id: "msg-004",
    orderId: "ord-001",
    sender: "vendor",
    content: "Entre 25-30 minutos estará listo para envío",
    timestamp: new Date(Date.now() - 7 * 60000),
    isRead: false
  },
  {
    id: "msg-005",
    orderId: "ord-002",
    sender: "system",
    content: "Tu pedido está en camino",
    timestamp: new Date(Date.now() - 10 * 60000),
    isRead: true
  },
  {
    id: "msg-006",
    orderId: "ord-002",
    sender: "customer",
    content: "Gracias! Estoy esperando",
    timestamp: new Date(Date.now() - 5 * 60000),
    isRead: true
  }
];