// Shared shapes for the admin API. These mirror what the Express /api/admin
// endpoints return. Runtime validation still lives on the server — these types
// are compile-time help only.

export type OrderStatus =
  | "new" | "processing" | "ready" | "completed" | "cancelled" | "review"
  | "shipped" | "delivered" | "issue"; // legacy values kept for old rows

export type PaymentStatus =
  | "pending" | "paid" | "failed" | "refunded" | "partial_refund" | "offline"
  | "cod_pending" | "cod_collected" | "cod_not_delivered" | "cod_awaiting_remittance" | "cod";

export type ShippingStatus =
  | "not_ready" | "ready_courier" | "handed" | "transit" | "delivered"
  | "failed" | "returning" | "returned";

export interface OrderItem {
  id: string;
  title: string;
  qty: number;
  price: number | null;
  image?: string;
  sku?: string;
}

export interface OrderCustomer {
  firstname?: string;
  lastname?: string;
  email?: string;
  mobile?: string;
  phone?: string;
  street?: string;
  streetNumber?: string;
  postal?: string;
  city?: string;
  prefecture?: string;
  country?: string;
  countryCode?: string;
  floor?: string;
  locationType?: string;
  courier?: string;
  docType?: "invoice" | "receipt";
  company?: string;
  afm?: string;
  doy?: string;
  activity?: string;
  notes?: string;
}

export interface OrderEvent {
  at?: string;
  actor?: string;
  type?: "status" | "payment" | "shipping" | "tracking" | "courier" | "assignee" | "notes";
  from?: string;
  to?: string;
}

export interface OrderGift {
  isGift?: boolean;
  wrap?: boolean;
  message?: boolean;
  messageText?: string;
  box?: boolean;
  boxType?: string;
  shipOther?: boolean;
  recipient?: string;
}

export interface Order {
  id: string;
  number: string;
  status: OrderStatus;
  payment: string; // "cod" | "stripe"
  paymentStatus: PaymentStatus;
  shippingStatus: ShippingStatus;
  tracking: string;
  courier: string;
  assignee: string;
  notes: string;
  events: OrderEvent[];
  coupon: string;
  discount: number;
  total: number;
  customer: OrderCustomer;
  gift: OrderGift | null;
  items: OrderItem[];
  createdAt: string;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export interface OrderTabCounts {
  all?: number;
  active?: number;
  new?: number;
  card_paid?: number;
  cod?: number;
  processing?: number;
  ready?: number;
  transit?: number;
  delivered?: number;
  review?: number;
  cancelled?: number;
}

export interface OrdersResponse {
  ok: boolean;
  orders: Order[];
  pagination: Pagination | null;
  counts: OrderTabCounts;
}
