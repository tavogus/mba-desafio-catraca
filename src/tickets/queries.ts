import { getPool } from '../db.js'
import type { GatewayOutcome } from './gateway.js'

export type TicketStatus = 'pending' | 'confirmed' | 'declined' | 'cancelled' | 'refunded'

export type TicketRecord = {
  id: string
  eventId: string
  participantId: string | null
  buyerEmail: string
  code: string
  status: TicketStatus
  priceCents: number
  checkedIn: boolean
  channel: 'storefront' | 'partner'
  gatewayOutcome: GatewayOutcome
  eventName?: string
}

type Row = {
  id: string
  event_id: string
  participant_id: string | null
  buyer_email: string
  code: string
  status: TicketStatus
  price_cents: number
  checked_in: boolean
  channel: 'storefront' | 'partner'
  gateway_outcome: GatewayOutcome
  event_name?: string
}

function mapTicket(row: Row): TicketRecord {
  return {
    id: row.id,
    eventId: row.event_id,
    participantId: row.participant_id,
    buyerEmail: row.buyer_email,
    code: row.code,
    status: row.status,
    priceCents: Number(row.price_cents),
    checkedIn: row.checked_in,
    channel: row.channel,
    gatewayOutcome: row.gateway_outcome,
    eventName: row.event_name,
  }
}

export async function getTicketById(ticketId: string): Promise<TicketRecord | null> {
  const res = await getPool().query<Row>(
    `SELECT id, event_id, participant_id, buyer_email, code, status, price_cents, checked_in, channel, gateway_outcome
     FROM tickets WHERE id = $1`,
    [ticketId],
  )
  return res.rows[0] ? mapTicket(res.rows[0]) : null
}

export async function listTicketsForParticipant(participantId: string): Promise<TicketRecord[]> {
  const res = await getPool().query<Row>(
    `SELECT t.id, t.event_id, t.participant_id, t.buyer_email, t.code, t.status, t.price_cents,
            t.checked_in, t.channel, t.gateway_outcome, e.name AS event_name
     FROM tickets t
     JOIN events e ON e.id = t.event_id
     WHERE t.participant_id = $1
     ORDER BY t.created_at DESC, t.id DESC`,
    [participantId],
  )
  return res.rows.map(mapTicket)
}
