import { getPool } from '../db.js'

export async function cancelPublishedEvent(
  organizerId: string,
  eventId: string,
): Promise<{ ok: true } | { ok: false; error: 'not_found' | 'not_published' }> {
  const client = await getPool().connect()
  try {
    await client.query('BEGIN')
    await client.query(`SET LOCAL lock_timeout = '15s'`)
    const locked = await client.query<{ organizer_id: string; status: string }>(
      `SELECT organizer_id, status FROM events WHERE id = $1 FOR UPDATE`,
      [eventId],
    )
    const event = locked.rows[0]
    if (!event || event.organizer_id !== organizerId) {
      await client.query('ROLLBACK')
      return { ok: false, error: 'not_found' }
    }
    if (event.status !== 'published') {
      await client.query('ROLLBACK')
      return { ok: false, error: 'not_published' }
    }
    await client.query(`UPDATE events SET status = 'cancelled', updated_at = now() WHERE id = $1`, [eventId])
    await client.query(`UPDATE tickets SET status = 'cancelled' WHERE event_id = $1 AND status = 'pending'`, [eventId])
    await client.query(`UPDATE tickets SET status = 'refunded' WHERE event_id = $1 AND status = 'confirmed'`, [eventId])
    await client.query('COMMIT')
    return { ok: true }
  } catch (error) {
    try {
      await client.query('ROLLBACK')
    } catch {
      // ignore
    }
    throw error
  } finally {
    client.release()
  }
}
