// Sem vaga, a frase Ingressos esgotados substitui o formulário de compra.
import type { FastifyInstance } from 'fastify'
import { currentUser } from '../auth/guard.js'
import type { User } from '../auth/session.js'
import { getPublicEvent, listEventsOnSale, type SaleEvent } from '../events/service.js'
import { redirect, sendHtml } from '../http.js'
import { formatReais } from '../money.js'
import { purchaseTicket } from '../tickets/purchase.js'
import { TICKET_STATUS_LABEL } from '../tickets/messages.js'
import { listTicketsForParticipant } from '../tickets/queries.js'
import { formatWhen } from '../time.js'
import { esc } from '../web/html.js'
import { layout } from '../web/layout.js'

function eventCard(event: SaleEvent): string {
  const availability = event.availableSeats > 0 ? `${event.availableSeats} vagas disponíveis` : 'Ingressos esgotados'
  return `<article class="card">
    <h2><a href="/eventos/${esc(event.id)}">${esc(event.name)}</a></h2>
    <p>${esc(formatWhen(event.startsAt))} · ${esc(event.venue)}</p>
    <p>${esc(formatReais(event.priceCents))}</p>
    <p>${availability}</p>
  </article>`
}

function eventPage(user: User | null, event: SaleEvent, error: string | null): string {
  const soldOut = event.availableSeats === 0
  let action = ''
  if (soldOut) {
    action = '<p>Ingressos esgotados</p>'
  } else if (!user) {
    action = `<p><a href="/entrar?next=${encodeURIComponent(`/eventos/${event.id}`)}">Entrar para comprar</a></p>`
  } else if (user.role !== 'participant') {
    action = '<p>A compra é feita com uma conta de participante.</p>'
  } else {
    action = `<form method="post" action="/eventos/${esc(event.id)}/comprar">
      <label>Número do cartão
        <input name="cardNumber" inputmode="numeric" autocomplete="off" maxlength="16" required>
      </label>
      <p>16 dígitos, sem espaços.</p>
      <button type="submit">Comprar ingresso</button>
    </form>`
  }
  return layout({
    title: event.name,
    user,
    body: `<article class="card">
      <h1>${esc(event.name)}</h1>
      <p>${esc(formatWhen(event.startsAt))} · ${esc(event.venue)}</p>
      <p>${esc(formatReais(event.priceCents))}</p>
      ${error ? `<p class="error">${esc(error)}</p>` : ''}
      ${action}
    </article>`,
  })
}

export async function registerStorefrontRoutes(app: FastifyInstance): Promise<void> {
  app.get('/', async (req, reply) => {
    const user = await currentUser(req)
    const events = await listEventsOnSale()
    const cards = events.length ? events.map(eventCard).join('') : '<p>Nenhum evento à venda no momento.</p>'
    return sendHtml(
      reply,
      layout({
        title: 'Vitrine',
        user,
        body: `<h1>Vitrine</h1>${cards}`,
      }),
    )
  })

  app.get('/eventos/:eventId', async (req, reply) => {
    const user = await currentUser(req)
    const eventId = (req.params as { eventId: string }).eventId
    const event = await getPublicEvent(eventId)
    if (!event) {
      return sendHtml(reply, layout({ title: 'Evento não encontrado', user, body: '<h1>Evento não encontrado</h1>' }), 404)
    }
    return sendHtml(reply, eventPage(user, event, null))
  })

  app.post('/eventos/:eventId/comprar', async (req, reply) => {
    const user = await currentUser(req)
    const eventId = (req.params as { eventId: string }).eventId
    if (!user) return redirect(reply, `/entrar?next=${encodeURIComponent(`/eventos/${eventId}`)}`)
    const event = await getPublicEvent(eventId)
    if (!event) {
      return sendHtml(reply, layout({ title: 'Evento não encontrado', user, body: '<h1>Evento não encontrado</h1>' }), 404)
    }
    if (user.role !== 'participant') {
      return sendHtml(reply, eventPage(user, event, 'A compra é feita com uma conta de participante.'), 403)
    }
    const cardNumber = text(req.body, 'cardNumber')
    const result = await purchaseTicket({
      eventId,
      buyerEmail: user.email,
      cardNumber,
      channel: 'storefront',
      participantId: user.id,
    })
    if (!result.ok && result.error === 'invalid_request') {
      const fresh = (await getPublicEvent(eventId)) ?? event
      return sendHtml(reply, eventPage(user, fresh, 'Informe um cartão com 16 dígitos.'), 400)
    }
    if (!result.ok && result.error === 'sold_out') {
      const fresh = (await getPublicEvent(eventId)) ?? { ...event, availableSeats: 0 }
      return sendHtml(reply, eventPage(user, fresh, null), 409)
    }
    if (!result.ok) {
      return sendHtml(reply, layout({ title: 'Evento não encontrado', user, body: '<h1>Evento não encontrado</h1>' }), 404)
    }
    return redirect(reply, '/meus-ingressos')
  })

  app.get('/meus-ingressos', async (req, reply) => {
    const user = await currentUser(req)
    if (!user) return redirect(reply, '/entrar?next=/meus-ingressos')
    const tickets = user.role === 'participant' ? await listTicketsForParticipant(user.id) : []
    const items = tickets.length
      ? tickets
          .map((ticket) => {
            const label = TICKET_STATUS_LABEL[ticket.status] ?? ticket.status
            return `<article class="card">
              <h2>${esc(ticket.eventName ?? '')}</h2>
              <p>Status: ${esc(label)}</p>
              <p>Código: ${esc(ticket.code)}</p>
            </article>`
          })
          .join('')
      : '<p>Você ainda não tem ingressos.</p>'
    return sendHtml(reply, layout({ title: 'Meus ingressos', user, body: `<h1>Meus ingressos</h1>${items}` }))
  })
}

function text(body: unknown, key: string): string {
  if (!body || typeof body !== 'object') return ''
  const value = (body as Record<string, unknown>)[key]
  return typeof value === 'string' ? value : ''
}
