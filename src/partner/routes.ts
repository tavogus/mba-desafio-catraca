import type { FastifyInstance } from 'fastify'
import { listEventsOnSale } from '../events/service.js'
import { purchaseTicket } from '../tickets/purchase.js'
import { getTicketById } from '../tickets/queries.js'
import { formatStartsAtIso } from '../time.js'

export async function registerPartnerRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/partner/events', async (_req, reply) => {
    const events = await listEventsOnSale()
    return reply.header('cache-control', 'no-store').send(
      events.map((event) => ({
        id: event.id,
        name: event.name,
        startsAt: formatStartsAtIso(event.startsAt),
        priceCents: event.priceCents,
        availableSeats: event.availableSeats,
      })),
    )
  })

  app.post('/api/partner/events/:eventId/purchases', async (req, reply) => {
    const eventId = (req.params as { eventId: string }).eventId
    const body = readObject(req.body)
    if (!body) return reply.code(422).send({ error: 'invalid_request' })
    const { buyerEmail, cardNumber } = body
    if (typeof buyerEmail !== 'string' || typeof cardNumber !== 'string') {
      return reply.code(422).send({ error: 'invalid_request' })
    }
    const result = await purchaseTicket({
      eventId,
      buyerEmail,
      cardNumber,
      channel: 'partner',
      participantId: null,
    })
    if (!result.ok) {
      if (result.error === 'invalid_request') return reply.code(422).send({ error: 'invalid_request' })
      if (result.error === 'event_not_available') return reply.code(404).send({ error: 'event_not_available' })
      return reply.code(409).send({ error: 'sold_out' })
    }
    return reply.code(202).header('cache-control', 'no-store').send({
      ticketId: result.ticket.id,
      code: result.ticket.code,
      status: result.ticket.status,
    })
  })

  app.get('/api/partner/tickets/:ticketId', async (req, reply) => {
    const ticketId = (req.params as { ticketId: string }).ticketId
    const ticket = await getTicketById(ticketId)
    if (!ticket) return reply.code(404).send({ error: 'ticket_not_found' })
    return reply.header('cache-control', 'no-store').send({
      ticketId: ticket.id,
      code: ticket.code,
      eventId: ticket.eventId,
      status: ticket.status,
      checkedIn: ticket.checkedIn,
    })
  })
}

function readObject(body: unknown): Record<string, unknown> | null {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null
  return body as Record<string, unknown>
}
