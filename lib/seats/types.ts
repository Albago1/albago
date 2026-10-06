// Seat sales (phase 43): AlbaGo selling its own stock of real seats for an
// event ticketed elsewhere (Eventim). The rules live in the SQL RPCs
// (docs/seeds/phase-43-seat-sales.sql); these types mirror their JSON.

export type SeatSaleMode = 'draft' | 'waitlist' | 'live' | 'closed'

export const SEAT_SALE_MODES: SeatSaleMode[] = ['draft', 'waitlist', 'live', 'closed']

export type ReservationStatus =
  | 'held'
  | 'paid'
  | 'transfer_sent'
  | 'delivered'
  | 'cancelled'
  | 'expired'
  | 'refunded'

export type PaymentMethod =
  | 'bank_transfer'
  | 'cash'
  | 'card'
  | 'paypal'
  | 'stripe'
  | 'other'

export const PAYMENT_METHODS: PaymentMethod[] = [
  'bank_transfer',
  'cash',
  'card',
  'paypal',
  'stripe',
  'other',
]

/** One seat as snapshotted on a reservation. */
export type SeatRef = {
  area: string
  block: string
  row: string
  seat: number
}

/** seat_sale_public() — safe for anonymous visitors. */
export type PublicSeatCategory = {
  code: string
  label: string
  price_cents: number
  face_value_cents: number | null
  available: number
  /** Biggest group that can still sit side by side (capped by max_per_order). */
  max_together: number
}

export type PublicSeatSale = {
  mode: SeatSaleMode
  currency: string
  max_per_order: number
  hold_minutes: number
  deliver_by: string | null
  seller_name: string | null
  public_note: string | null
  categories: PublicSeatCategory[]
}

/** seat_reserve() / seat_admin_manual_sale() result. */
export type ReservationResult = {
  id: string
  reference: string
  status: ReservationStatus
  category: string
  category_label: string
  quantity: number
  total_cents: number
  currency: string
  seats: SeatRef[]
  expires_at: string | null
}

/** A seat_reservations row (buyer reads own via RLS; admins read all). */
export type SeatReservationRow = {
  id: string
  event_id: string
  user_id: string | null
  source: 'online' | 'manual'
  reference: string
  status: ReservationStatus
  category: string
  category_label: string
  quantity: number
  unit_price_cents: number
  total_cents: number
  currency: string
  buyer_name: string
  buyer_email: string
  eventim_email: string
  phone: string | null
  note: string | null
  seats: SeatRef[]
  payment_method: PaymentMethod | null
  payment_ref: string | null
  admin_note: string | null
  expires_at: string | null
  paid_at: string | null
  transfer_sent_at: string | null
  delivered_at: string | null
  cancelled_at: string | null
  refunded_at: string | null
  created_at: string
}

export type SeatSaleRow = {
  event_id: string
  mode: SeatSaleMode
  currency: string
  hold_minutes: number
  max_per_order: number
  deliver_by: string | null
  seller_name: string | null
  public_note: string | null
  show_face_value: boolean
}

export type SeatCategoryRow = {
  event_id: string
  code: string
  label: string
  face_value_cents: number | null
  price_cents: number | null
  sort_order: number
}

export type SeatStockRow = {
  id: string
  event_id: string
  category: string
  area: string
  block: string
  row_label: string
  seat_number: number
  withdrawn: boolean
  reservation_id: string | null
}

export type SeatWaitlistRow = {
  id: string
  name: string
  email: string
  phone: string | null
  category: string | null
  quantity: number
  city: string | null
  created_at: string
}

/** Admin-only reservation actions, mirrored 1:1 by seat_admin_update(). */
export type AdminReservationAction =
  | 'mark_paid'
  | 'extend_hold'
  | 'transfer_sent'
  | 'undo_transfer'
  | 'delivered'
  | 'cancel'
  | 'refund'
  | 'release_seats'
  | 'note'

export const ADMIN_RESERVATION_ACTIONS: AdminReservationAction[] = [
  'mark_paid',
  'extend_hold',
  'transfer_sent',
  'undo_transfer',
  'delivered',
  'cancel',
  'refund',
  'release_seats',
  'note',
]
