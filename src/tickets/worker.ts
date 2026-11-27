import { getPool } from '../db.js'

/** Aplica respostas vencidas. Só muda ingresso que ainda está pendente. */
export async function processDueTickets(): Promise<number> {
  const due = await getPool().query<{ id: string; event_id: string }>(
    `SELECT id, event_id FROM tickets
     WHERE status = 'pending' AND gateway_due_at <= clock_timestamp()
     ORDER BY gateway_due_at
     LIMIT 50`,
  )
  let applied = 0
  for (const row of due.rows) {
    if (await applyGateway(row.id, row.event_id)) applied += 1
  }
  return applied
}

async function applyGateway(ticketId: string, eventId: string): Promise<boolean> {
  const client = await getPool().connect()
  try {
    await client.query('BEGIN')
    await client.query(`SET LOCAL lock_timeout = '15s'`)
    await client.query(`SELECT id FROM events WHERE id = $1 FOR UPDATE`, [eventId])
    const ticket = await client.query<{ status: string; gateway_outcome: 'approved' | 'declined' }>(
      `SELECT status, gateway_outcome FROM tickets WHERE id = $1 FOR UPDATE`,
      [ticketId],
    )
    const current = ticket.rows[0]
    if (!current || current.status !== 'pending') {
      await client.query('COMMIT')
      return false
    }
    const next = current.gateway_outcome === 'approved' ? 'confirmed' : 'declined'
    const updated = await client.query(
      `UPDATE tickets SET status = $2 WHERE id = $1 AND status = 'pending'`,
      [ticketId, next],
    )
    await client.query('COMMIT')
    return (updated.rowCount ?? 0) > 0
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

export function startGatewayWorker(intervalMs = 200): () => void {
  let stopped = false
  let timer: NodeJS.Timeout
  const tick = () => {
    processDueTickets()
      .catch((error) => {
        console.error(error)
      })
      .finally(() => {
        if (!stopped) timer = setTimeout(tick, intervalMs)
      })
  }
  timer = setTimeout(tick, intervalMs)
  return () => {
    stopped = true
    clearTimeout(timer)
  }
}
