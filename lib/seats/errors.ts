// Seat-sale RPCs RAISE machine-readable codes; routes translate them into
// stable JSON + HTTP status. Anything unknown is a 500 so real failures never
// masquerade as polite user-facing states.

const SEAT_RPC_ERRORS: Record<string, number> = {
  auth_required: 401,
  forbidden: 403,
  sale_not_found: 404,
  reservation_not_found: 404,
  bad_quantity: 400,
  bad_details: 400,
  bad_action: 400,
  sales_closed: 409,
  user_cap_reached: 409,
  category_not_on_sale: 409,
  not_together: 409,
  sold_out: 409,
  bad_transition: 409,
  hold_expired: 409,
  seats_taken: 409,
  mixed_categories: 409,
}

export function seatRpcError(message: string): { code: string; status: number } | null {
  const status = SEAT_RPC_ERRORS[message]
  return status ? { code: message, status } : null
}

export const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Trimmed string or null; never longer than max. */
export function cleanText(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed ? trimmed.slice(0, max) : null
}
