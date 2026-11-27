import type { Queryable } from './db.js'

export async function countOccupied(db: Queryable, eventId: string): Promise<number> {
  const res = await db.query<{ n: number }>(
    `SELECT COUNT(*)::int AS n FROM tickets WHERE event_id = $1 AND status IN ('pending', 'confirmed')`,
    [eventId],
  )
  return Number(res.rows[0]?.n ?? 0)
}
