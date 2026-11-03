export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  image: string;
  category: string;
  isOutOfStock?: boolean;
}

export interface Restaurant {
  id: string;
  name: string;
  image: string;
  rating: number;
  deliveryTime: string;
  deliveryFee: number;
  categories: string[];
  menu: Product[];
  location: [number, number];
  address?: string;
  addressReference?: string;
  phone?: string;
  whatsapp?: string;
  isOpen?: boolean;
  openingDays?: string[];
  openingTime?: string; // e.g. "08:00"
  closingTime?: string; // e.g. "22:00"
  securityPin?: string;
  ownerEmail?: string;
  ownerEmails?: string[];
  ownerId?: string;
  isAdminCreated?: boolean;
  isApproved?: boolean;
  payAtLocal?: boolean;
  isHidden?: boolean;
}

export interface CartItem {
  product: Product;
  quantity: number;
  restaurantId: string;
  notes?: string;
}

export type OrderStatus = 'recibido' | 'preparacion' | 'camino' | 'entregado' | 'cancelado';
export type PaymentMethod = 'efectivo';

export interface Order {
  id: string;
  shortId: string; // 4 digits
  longId: string;  // 10 digits
  items: {
    name: string;
    price: number;
    quantity: number;
    notes?: string;
  }[]; 
  subtotal: number;
  deliveryFee: number;
  discount: number;
  couponCode?: string;
  total: number;
  status: OrderStatus;
  paymentMethod?: PaymentMethod;
  deliveryCode?: string;
  timestamp: Date;       // Hora de entrada
  assignedAt?: Date;      // Hora de asignación
  deliveredAt?: Date;     // Hora de entrega
  totalTimeMinutes?: number;
  restaurantName: string;
  userId: string;
  userName?: string;
  userPhone?: string;
  userWhatsapp?: string;
  deliveryAddress: string;
  deliveryReference?: string;
  deliveryGPS?: { lat: number, lng: number };
  restaurantId: string;
  restaurantAddress?: string;
  restaurantAddressReference?: string;
  restaurantPhone?: string;
  restaurantWhatsapp?: string;
  restaurantLocation?: [number, number];
  payAtLocal?: boolean;
  notes?: string;
  riderId?: string;
  riderName?: string;
  riderPhone?: string;
  riderEmail?: string;
  releaseRequested?: boolean;
  releaseRequestedAt?: Date;
  review?: {
    rating: number;
    comment: string;
    timestamp: Date;
  };
}

export interface Message {
  id: string;
  text: string;
  senderId: string;
  senderName: string;
  timestamp: Date;
}

export interface FavoriteAddress {
  id: string;
  label: string; // "Casa", "Trabajo"
  address: string;
}

export interface User {
  uid?: string;
  name: string;
  email: string;
  address: string;
  phone: string;
  whatsapp?: string;
  isLoggedIn: boolean;
  role: 'client' | 'admin' | 'rider' | 'super_admin';
  isSuperAdmin?: boolean;
  isVerifiedRider?: boolean;
  favorites?: FavoriteAddress[];
  favoriteRestaurants?: string[];
  theme?: 'light' | 'dark';
  restaurantId?: string; // For admins
  ownedRestaurantIds?: string[]; // Multiple restaurants owned by this user
  lat?: number;
  lng?: number;
  autoAccept?: boolean;
  vehicleInfo?: {
    type: string;
    plate: string;
    model: string;
  }; // For riders
  availability?: boolean; // For riders
  riderStatus?: 'repartiendo' | 'no repartiendo' | 'en pausa';
  shiftStartTime?: Date;
  totalMinutesWorked?: number;
  balance?: number;
  connectionHours?: number;
  performanceRate?: number;
  completedOrdersCount?: number;
  acceptanceRate?: number;
  level?: number;
  xp?: number;
  earningsHistory?: { date: string, amount: number }[];
  facePhotoUrl?: string;
  faceVerified?: boolean;
  faceVerifiedAt?: string | Date;
  faceBiometricId?: string;
}
