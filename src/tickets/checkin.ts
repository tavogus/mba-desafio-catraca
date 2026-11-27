import { getPool } from '../db.js'
import { CHECKIN, type CheckinMessage } from './messages.js'

export async function checkIn(
  organizerId: string,
  eventId: string,
  rawCode: string,
): Promise<{ ok: true; message: CheckinMessage } | { ok: false; error: 'not_found' }> {
  const code = rawCode.trim().toUpperCase()
  const client = await getPool().connect()
  try {
    await client.query('BEGIN')
    await client.query(`SET LOCAL lock_timeout = '15s'`)
    const owner = await client.query<{ organizer_id: string }>('SELECT organizer_id FROM events WHERE id = $1', [eventId])
    if (!owner.rows[0] || owner.rows[0].organizer_id !== organizerId) {
      await client.query('ROLLBACK')
      return { ok: false, error: 'not_found' }
    }
    const event = await client.query<{ status: string }>(`SELECT status FROM events WHERE id = $1 FOR UPDATE`, [eventId])
    const ticket = code
      ? await client.query<{ id: string; event_id: string; status: string; checked_in: boolean }>(
          `SELECT id, event_id, status, checked_in FROM tickets WHERE code = $1 FOR UPDATE`,
          [code],
        )
      : { rows: [] as Array<{ id: string; event_id: string; status: string; checked_in: boolean }> }
    const row = ticket.rows[0]
    let message: CheckinMessage
    if (!row || row.event_id !== eventId) message = CHECKIN.invalid
    else if (event.rows[0]?.status === 'cancelled') message = CHECKIN.cancelled
    else if (row.status !== 'confirmed') message = CHECKIN.unconfirmed
    else if (row.checked_in) message = CHECKIN.used
    else {
      await client.query(
        `UPDATE tickets SET checked_in = true, checked_in_at = clock_timestamp()
         WHERE id = $1 AND checked_in = false AND status = 'confirmed'`,
        [row.id],
      )
      message = CHECKIN.released
    }
    await client.query('COMMIT')
    return { ok: true, message }
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
