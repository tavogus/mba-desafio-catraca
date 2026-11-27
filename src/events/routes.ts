import type { FastifyInstance } from 'fastify'
import { requireOrganizer } from '../auth/guard.js'
import type { User } from '../auth/session.js'
import {
  EVENT_STATUS_LABEL,
  createEvent,
  getEvent,
  listEventsForOrganizer,
  publishEvent,
  updateEvent,
  type EventInput,
  type EventRecord,
} from '../events/service.js'
import { redirect, sendHtml } from '../http.js'
import { formatReais } from '../money.js'
import { CHECKIN_MESSAGES } from '../tickets/messages.js'
import { formatWhen } from '../time.js'
import { esc, field } from '../web/html.js'
import { layout } from '../web/layout.js'
import { renderEventManagement } from '../organizer/page.js'

const NOTICES: Record<string, string> = {
  publicado: 'Evento publicado.',
  atualizado: 'Alterações salvas.',
  cancelado: 'O evento foi cancelado e não aceita mais vendas.',
}

function text(body: unknown, key: string): string {
  if (!body || typeof body !== 'object') return ''
  const value = (body as Record<string, unknown>)[key]
  return typeof value === 'string' ? value : ''
}

function readInput(body: unknown): EventInput {
  return {
    name: text(body, 'name'),
    startsAt: text(body, 'startsAt'),
    venue: text(body, 'venue'),
    capacity: text(body, 'capacity'),
    price: text(body, 'price'),
  }
}

function queryValue(query: unknown, key: string): string | null {
  if (!query || typeof query !== 'object') return null
  const value = (query as Record<string, unknown>)[key]
  return typeof value === 'string' ? value : null
}

function createPage(user: User, error: string | null, input: EventInput): string {
  return layout({
    title: 'Novo evento',
    user,
    body: `<h1>Novo evento</h1>
      <p>O evento nasce como rascunho. Ele só entra na vitrine depois de publicado.</p>
      ${error ? `<p class="error">${esc(error)}</p>` : ''}
      <form method="post" action="/organizador/eventos">
        ${field('Nome', 'name', input.name)}
        ${field('Início', 'startsAt', input.startsAt, 'datetime-local')}
        ${field('Local', 'venue', input.venue)}
        ${field('Lotação', 'capacity', input.capacity)}
        ${field('Preço (R$)', 'price', input.price)}
        <button type="submit">Criar rascunho</button>
      </form>`,
  })
}

function listPage(user: User, events: EventRecord[]): string {
  const rows = events
    .map(
      (event) => `<tr>
        <td>${esc(event.name)}</td>
        <td>${esc(formatWhen(event.startsAt))}</td>
        <td>${esc(event.venue)}</td>
        <td>${esc(EVENT_STATUS_LABEL[event.status])}</td>
        <td>${event.capacity}</td>
        <td>${esc(formatReais(event.priceCents))}</td>
        <td><a href="/organizador/eventos/${esc(event.id)}">Gerir</a></td>
      </tr>`,
    )
    .join('')
  const table = events.length
    ? `<table>
        <thead><tr><th>Nome</th><th>Início</th><th>Local</th><th>Situação</th><th>Lotação</th><th>Preço</th><th></th></tr></thead>
        <tbody>${rows}</tbody>
      </table>`
    : '<p>Nenhum evento ainda.</p>'
  return layout({
    title: 'Meus eventos',
    user,
    body: `<h1>Meus eventos</h1>
      <p><a class="button" href="/organizador/eventos/novo">Novo evento</a></p>
      ${table}`,
  })
}

async function management(
  user: User,
  event: EventRecord,
  extras: { error?: string | null; checkinMessage?: string | null; notice?: string | null },
): Promise<string> {
  return renderEventManagement({ user, event, ...extras })
}

export async function registerEventRoutes(app: FastifyInstance): Promise<void> {
  app.get('/organizador', async (req, reply) => {
    const user = await requireOrganizer(req, reply)
    if (!user) return
    const events = await listEventsForOrganizer(user.id)
    return sendHtml(reply, listPage(user, events))
  })

  app.get('/organizador/eventos/novo', async (req, reply) => {
    const user = await requireOrganizer(req, reply)
    if (!user) return
    return sendHtml(reply, createPage(user, null, { name: '', startsAt: '', venue: '', capacity: '', price: '' }))
  })

  app.post('/organizador/eventos', async (req, reply) => {
    const user = await requireOrganizer(req, reply)
    if (!user) return
    const input = readInput(req.body)
    const created = await createEvent(user.id, input)
    if (!created.ok) return sendHtml(reply, createPage(user, created.message, input), 400)
    return redirect(reply, `/organizador/eventos/${created.event.id}`)
  })

  app.get('/organizador/eventos/:eventId', async (req, reply) => {
    const user = await requireOrganizer(req, reply)
    if (!user) return
    const eventId = (req.params as { eventId: string }).eventId
    const event = await getEvent(eventId)
    if (!event || event.organizerId !== user.id) {
      return sendHtml(
        reply,
        layout({ title: 'Evento não encontrado', user, body: '<h1>Evento não encontrado</h1>' }),
        404,
      )
    }
    const checkinRaw = queryValue(req.query, 'checkin')
    const noticeKey = queryValue(req.query, 'aviso')
    return sendHtml(
      reply,
      await management(user, event, {
        checkinMessage: checkinRaw && CHECKIN_MESSAGES.has(checkinRaw) ? checkinRaw : null,
        notice: noticeKey ? (NOTICES[noticeKey] ?? null) : null,
      }),
    )
  })

  app.post('/organizador/eventos/:eventId', async (req, reply) => {
    const user = await requireOrganizer(req, reply)
    if (!user) return
    const eventId = (req.params as { eventId: string }).eventId
    const updated = await updateEvent(user.id, eventId, readInput(req.body))
    if (!updated.ok && updated.missing) {
      return sendHtml(
        reply,
        layout({ title: 'Evento não encontrado', user, body: '<h1>Evento não encontrado</h1>' }),
        404,
      )
    }
    if (!updated.ok) {
      const event = await getEvent(eventId)
      if (!event || event.organizerId !== user.id) {
        return sendHtml(
          reply,
          layout({ title: 'Evento não encontrado', user, body: '<h1>Evento não encontrado</h1>' }),
          404,
        )
      }
      return sendHtml(reply, await management(user, event, { error: updated.message }), 400)
    }
    return redirect(reply, `/organizador/eventos/${eventId}?aviso=atualizado`)
  })

  app.post('/organizador/eventos/:eventId/publicar', async (req, reply) => {
    const user = await requireOrganizer(req, reply)
    if (!user) return
    const eventId = (req.params as { eventId: string }).eventId
    const published = await publishEvent(user.id, eventId)
    if (!published.ok && published.missing) {
      return sendHtml(
        reply,
        layout({ title: 'Evento não encontrado', user, body: '<h1>Evento não encontrado</h1>' }),
        404,
      )
    }
    if (!published.ok) {
      const event = await getEvent(eventId)
      if (!event || event.organizerId !== user.id) {
        return sendHtml(
          reply,
          layout({ title: 'Evento não encontrado', user, body: '<h1>Evento não encontrado</h1>' }),
          404,
        )
      }
      return sendHtml(reply, await management(user, event, { error: published.message }), 400)
    }
    return redirect(reply, `/organizador/eventos/${eventId}?aviso=publicado`)
  })
}
