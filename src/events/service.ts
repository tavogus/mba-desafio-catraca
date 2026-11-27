import { getPool, num } from '../db.js'
import { newId } from '../ids.js'
import { parseCapacity, parseReaisToCents } from '../money.js'
import { countOccupied } from '../occupancy.js'
import { isFutureInstant, parseSaoPauloDateTimeLocal } from '../time.js'

export const EVENT_MESSAGES = {
  name: 'Informe o nome do evento.',
  venue: 'Informe o local.',
  date: 'Informe a data e a hora de início.',
  future: 'A data de início precisa estar no futuro.',
  capacity: 'A lotação precisa ser um inteiro maior ou igual a 1.',
  capacityFloor: 'A lotação não pode ser menor que as vagas ocupadas.',
  price: 'O preço precisa ser maior que zero.',
  cancelled: 'Evento cancelado não pode ser editado.',
  notFound: 'Evento não encontrado.',
  notDraft: 'Só um rascunho pode ser publicado.',
  forbidden: 'Acesso restrito a organizadores.',
} as const

export const EVENT_STATUS_LABEL = {
  draft: 'Rascunho',
  published: 'Publicado',
  cancelled: 'Cancelado',
} as const

export type EventStatus = keyof typeof EVENT_STATUS_LABEL

export type EventRecord = {
  id: string
  organizerId: string
  name: string
  startsAt: Date
  venue: string
  capacity: number
  priceCents: number
  status: EventStatus
}

export type SaleEvent = EventRecord & { availableSeats: number }

export type EventInput = {
  name: string
  startsAt: string
  venue: string
  capacity: string
  price: string
}

type ParsedEvent = {
  name: string
  startsAt: Date
  venue: string
  capacity: number
  priceCents: number
}

type Row = {
  id: string
  organizer_id: string
  name: string
  starts_at: Date
  venue: string
  capacity: number
  price_cents: number
  status: EventStatus
}

function mapEvent(row: Row): EventRecord {
  return {
    id: row.id,
    organizerId: row.organizer_id,
    name: row.name,
    startsAt: row.starts_at,
    venue: row.venue,
    capacity: num(row.capacity),
    priceCents: num(row.price_cents),
    status: row.status,
  }
}

export function parseEventInput(input: EventInput, now = new Date()): { ok: true; value: ParsedEvent } | { ok: false; message: string } {
  const name = input.name.trim()
  const venue = input.venue.trim()
  if (!name || name.length > 120) return { ok: false, message: EVENT_MESSAGES.name }
  if (!venue || venue.length > 160) return { ok: false, message: EVENT_MESSAGES.venue }
  const startsAt = parseSaoPauloDateTimeLocal(input.startsAt)
  if (!startsAt) return { ok: false, message: EVENT_MESSAGES.date }
  if (!isFutureInstant(startsAt, now)) return { ok: false, message: EVENT_MESSAGES.future }
  const capacity = parseCapacity(input.capacity)
  if (capacity === null) return { ok: false, message: EVENT_MESSAGES.capacity }
  const priceCents = parseReaisToCents(input.price)
  if (priceCents === null) return { ok: false, message: EVENT_MESSAGES.price }
  return { ok: true, value: { name, venue, startsAt, capacity, priceCents } }
}

async function isOrganizer(organizerId: string): Promise<boolean> {
  const res = await getPool().query<{ role: string }>('SELECT role FROM users WHERE id = $1', [organizerId])
  return res.rows[0]?.role === 'organizer'
}

export async function createEvent(
  organizerId: string,
  input: EventInput,
): Promise<{ ok: true; event: EventRecord } | { ok: false; message: string }> {
  if (!(await isOrganizer(organizerId))) return { ok: false, message: EVENT_MESSAGES.forbidden }
  const parsed = parseEventInput(input)
  if (!parsed.ok) return parsed
  const id = newId('evt')
  const res = await getPool().query<Row>(
    `INSERT INTO events (id, organizer_id, name, starts_at, venue, capacity, price_cents, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'draft')
     RETURNING id, organizer_id, name, starts_at, venue, capacity, price_cents, status`,
    [id, organizerId, parsed.value.name, parsed.value.startsAt, parsed.value.venue, parsed.value.capacity, parsed.value.priceCents],
  )
  return { ok: true, event: mapEvent(res.rows[0]) }
}

export async function updateEvent(
  organizerId: string,
  eventId: string,
  input: EventInput,
): Promise<{ ok: true; event: EventRecord } | { ok: false; message: string; missing?: boolean }> {
  const parsed = parseEventInput(input)
  const client = await getPool().connect()
  try {
    await client.query('BEGIN')
    await client.query(`SET LOCAL lock_timeout = '15s'`)
    const locked = await client.query<Row>(
      `SELECT id, organizer_id, name, starts_at, venue, capacity, price_cents, status
       FROM events WHERE id = $1 FOR UPDATE`,
      [eventId],
    )
    const current = locked.rows[0]
    if (!current || current.organizer_id !== organizerId) {
      await client.query('ROLLBACK')
      return { ok: false, message: EVENT_MESSAGES.notFound, missing: true }
    }
    if (current.status === 'cancelled') {
      await client.query('ROLLBACK')
      return { ok: false, message: EVENT_MESSAGES.cancelled }
    }
    if (!parsed.ok) {
      await client.query('ROLLBACK')
      return parsed
    }
    const occupied = await countOccupied(client, eventId)
    if (parsed.value.capacity < occupied) {
      await client.query('ROLLBACK')
      return { ok: false, message: EVENT_MESSAGES.capacityFloor }
    }
    const res = await client.query<Row>(
      `UPDATE events
       SET name = $3, starts_at = $4, venue = $5, capacity = $6, price_cents = $7, updated_at = now()
       WHERE id = $1 AND organizer_id = $2
       RETURNING id, organizer_id, name, starts_at, venue, capacity, price_cents, status`,
      [eventId, organizerId, parsed.value.name, parsed.value.startsAt, parsed.value.venue, parsed.value.capacity, parsed.value.priceCents],
    )
    await client.query('COMMIT')
    return { ok: true, event: mapEvent(res.rows[0]) }
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

export async function publishEvent(
  organizerId: string,
  eventId: string,
): Promise<{ ok: true } | { ok: false; message: string; missing?: boolean }> {
  const res = await getPool().query(
    `UPDATE events SET status = 'published', updated_at = now()
     WHERE id = $1 AND organizer_id = $2 AND status = 'draft'`,
    [eventId, organizerId],
  )
  if ((res.rowCount ?? 0) > 0) return { ok: true }
  const existing = await getEvent(eventId)
  if (!existing || existing.organizerId !== organizerId) return { ok: false, message: EVENT_MESSAGES.notFound, missing: true }
  return { ok: false, message: EVENT_MESSAGES.notDraft }
}

export async function getEvent(eventId: string): Promise<EventRecord | null> {
  const res = await getPool().query<Row>(
    `SELECT id, organizer_id, name, starts_at, venue, capacity, price_cents, status FROM events WHERE id = $1`,
    [eventId],
  )
  return res.rows[0] ? mapEvent(res.rows[0]) : null
}

export async function listEventsForOrganizer(organizerId: string): Promise<EventRecord[]> {
  const res = await getPool().query<Row>(
    `SELECT id, organizer_id, name, starts_at, venue, capacity, price_cents, status
     FROM events WHERE organizer_id = $1
     ORDER BY starts_at ASC, id ASC`,
    [organizerId],
  )
  return res.rows.map(mapEvent)
}

export async function listEventsOnSale(): Promise<SaleEvent[]> {
  const res = await getPool().query<Row & { occupied: number }>(
    `SELECT e.id, e.organizer_id, e.name, e.starts_at, e.venue, e.capacity, e.price_cents, e.status,
       (SELECT COUNT(*)::int FROM tickets t
        WHERE t.event_id = e.id AND t.status IN ('pending', 'confirmed')) AS occupied
     FROM events e
     WHERE e.status = 'published'
     ORDER BY e.starts_at ASC, e.id ASC`,
  )
  return res.rows.map((row) => {
    const event = mapEvent(row)
    return { ...event, availableSeats: Math.max(0, event.capacity - num(row.occupied)) }
  })
}

export async function getPublicEvent(eventId: string): Promise<SaleEvent | null> {
  const event = await getEvent(eventId)
  if (!event || event.status !== 'published') return null
  const occupied = await countOccupied(getPool(), eventId)
  return { ...event, availableSeats: Math.max(0, event.capacity - occupied) }
}
