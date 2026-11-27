import { getPool, num } from '../db.js'

export type Dashboard = {
  confirmed: number
  pending: number
  checkins: number
  availableSeats: number
  revenueCents: number
  refunded: number
}

export async function getDashboard(eventId: string): Promise<Dashboard | null> {
  const event = await getPool().query<{ capacity: number; status: string }>(
    'SELECT capacity, status FROM events WHERE id = $1',
    [eventId],
  )
  const current = event.rows[0]
  if (!current) return null
  const counts = await getPool().query<{
    confirmed: number
    pending: number
    checkins: number
    refunded: number
    revenue_cents: string
  }>(
    `SELECT
       COUNT(*) FILTER (WHERE status = 'confirmed')::int AS confirmed,
       COUNT(*) FILTER (WHERE status = 'pending')::int AS pending,
       COUNT(*) FILTER (WHERE status = 'confirmed' AND checked_in)::int AS checkins,
       COUNT(*) FILTER (WHERE status = 'refunded')::int AS refunded,
       COALESCE(SUM(price_cents) FILTER (WHERE status = 'confirmed'), 0)::bigint AS revenue_cents
     FROM tickets
     WHERE event_id = $1`,
    [eventId],
  )
  const row = counts.rows[0]
  const confirmed = num(row?.confirmed ?? 0)
  const pending = num(row?.pending ?? 0)
  const availableSeats = current.status === 'cancelled' ? 0 : Math.max(0, num(current.capacity) - confirmed - pending)
  return {
    confirmed,
    pending,
    checkins: num(row?.checkins ?? 0),
    availableSeats,
    revenueCents: num(row?.revenue_cents ?? 0),
    refunded: num(row?.refunded ?? 0),
  }
}
