import type { FastifyInstance } from 'fastify'
import { requireOrganizer } from '../auth/guard.js'
import { getEvent } from '../events/service.js'
import { redirect, sendHtml } from '../http.js'
import { renderEventManagement } from './page.js'
import { cancelPublishedEvent } from '../tickets/cancel.js'
import { checkIn } from '../tickets/checkin.js'
import { layout } from '../web/layout.js'

function text(body: unknown, key: string): string {
  if (!body || typeof body !== 'object') return ''
  const value = (body as Record<string, unknown>)[key]
  return typeof value === 'string' ? value : ''
}

function notFound(user: { id: string; name: string; email: string; role: 'organizer' | 'participant' }): string {
  return layout({ title: 'Evento não encontrado', user, body: '<h1>Evento não encontrado</h1>' })
}

export async function registerOrganizerRoutes(app: FastifyInstance): Promise<void> {
  app.post('/organizador/eventos/:eventId/checkin', async (req, reply) => {
    const user = await requireOrganizer(req, reply)
    if (!user) return
    const eventId = (req.params as { eventId: string }).eventId
    const result = await checkIn(user.id, eventId, text(req.body, 'code'))
    if (!result.ok) return sendHtml(reply, notFound(user), 404)
    return redirect(reply, `/organizador/eventos/${eventId}?checkin=${encodeURIComponent(result.message)}`)
  })

  app.post('/organizador/eventos/:eventId/cancelar', async (req, reply) => {
    const user = await requireOrganizer(req, reply)
    if (!user) return
    const eventId = (req.params as { eventId: string }).eventId
    const result = await cancelPublishedEvent(user.id, eventId)
    if (!result.ok && result.error === 'not_found') return sendHtml(reply, notFound(user), 404)
    if (!result.ok) {
      const event = await getEvent(eventId)
      if (!event || event.organizerId !== user.id) return sendHtml(reply, notFound(user), 404)
      return sendHtml(
        reply,
        await renderEventManagement({ user, event, error: 'Só um evento publicado pode ser cancelado.' }),
        400,
      )
    }
    return redirect(reply, `/organizador/eventos/${eventId}?aviso=cancelado`)
  })
}
