import { getPool } from '../db.js'
import { newCode, newId } from '../ids.js'
import { gatewayPlan } from './gateway.js'
import { isValidCard, isValidEmail, normalizeEmail } from '../validate.js'

export type PurchaseError = 'invalid_request' | 'event_not_available' | 'sold_out'

export type PurchaseInput = {
  eventId: string
  buyerEmail: string
  cardNumber: string
  channel: 'storefront' | 'partner'
  participantId: string | null
}

export type PurchaseResult =
  | { ok: true; ticket: { id: string; code: string; status: 'pending' } }
  | { ok: false; error: PurchaseError }

function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && (error as { code: string }).code === '23505'
}

export async function purchaseTicket(input: PurchaseInput): Promise<PurchaseResult> {
  const email = normalizeEmail(input.buyerEmail)
  const cardNumber = input.cardNumber.trim()
  if (!isValidEmail(email) || !isValidCard(cardNumber)) return { ok: false, error: 'invalid_request' }
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await insertPending(input, email, cardNumber)
    } catch (error) {
      if (isUniqueViolation(error) && attempt < 2) continue
      throw error
    }
  }
  throw new Error('Não foi possível gerar um código único de ingresso')
}

async function insertPending(input: PurchaseInput, email: string, cardNumber: string): Promise<PurchaseResult> {
  const plan = gatewayPlan(cardNumber)
  const client = await getPool().connect()
  try {
    await client.query('BEGIN')
    await client.query(`SET LOCAL lock_timeout = '15s'`)
    // R07: a trava da linha do evento serializa as compras. A contagem e o
    // insert acontecem antes do commit, e o gateway só roda depois.
    const locked = await client.query<{ status: string; capacity: number; price_cents: number }>(
      `SELECT status, capacity, price_cents FROM events WHERE id = $1 FOR UPDATE`,
      [input.eventId],
    )
    const event = locked.rows[0]
    if (!event || event.status !== 'published') {
      await client.query('ROLLBACK')
      return { ok: false, error: 'event_not_available' }
    }
    const occupied = await client.query<{ n: number }>(
      `SELECT COUNT(*)::int AS n FROM tickets WHERE event_id = $1 AND status IN ('pending', 'confirmed')`,
      [input.eventId],
    )
    if (Number(occupied.rows[0]?.n ?? 0) >= Number(event.capacity)) {
      await client.query('ROLLBACK')
      return { ok: false, error: 'sold_out' }
    }
    const ticketId = newId('tkt')
    const code = newCode()
    await client.query(
      `INSERT INTO tickets (
         id, event_id, participant_id, buyer_email, code, status, price_cents,
         channel, gateway_outcome, gateway_due_at
       ) VALUES (
         $1, $2, $3, $4, $5, 'pending', $6, $7, $8,
         clock_timestamp() + ($9::int * interval '1 millisecond')
       )`,
      [ticketId, input.eventId, input.participantId, email, code, event.price_cents, input.channel, plan.outcome, plan.delayMs],
    )
    await client.query('COMMIT')
    return { ok: true, ticket: { id: ticketId, code, status: 'pending' } }
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
