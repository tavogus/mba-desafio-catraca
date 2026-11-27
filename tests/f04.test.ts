import { describe, expect, test } from 'vitest'
import { SEED } from '../src/auth/session.js'
import { getPool } from '../src/db.js'
import { cancelPublishedEvent } from '../src/tickets/cancel.js'
import { processDueTickets } from '../src/tickets/worker.js'
import { formatStartsAtIso, parseSaoPauloDateTimeLocal } from '../src/time.js'
import { createDraft, createPublished, loginOrganizerA, useApp } from './helpers.js'

const ctx = useApp()
const key = SEED.partnerApiKey

function api(method: string, url: string, extra: { key?: string | null; payload?: string } = {}) {
  const headers: Record<string, string> = {}
  if (extra.key !== null) headers['x-api-key'] = extra.key ?? key
  if (extra.payload !== undefined) headers['content-type'] = 'application/json'
  return ctx.app.inject({ method: method as 'GET', url, headers, payload: extra.payload })
}

describe('F04 API de parceiros', () => {
  test('listagem segue o contrato e omite rascunho', async () => {
    const cookie = await loginOrganizerA(ctx.app)
    await createDraft(ctx.app, cookie, { name: 'Rascunho escondido' })
    const eventId = await createPublished(ctx.app, cookie, {
      name: 'Jazz no Porão',
      startsAt: '2028-06-15T21:00',
      price: '100,00',
      capacity: '2',
    })
    const res = await api('GET', '/api/partner/events')
    expect(res.statusCode).toBe(200)
    const body = res.json() as Array<Record<string, unknown>>
    expect(body.map((event) => event.name)).not.toContain('Rascunho escondido')
    const event = body.find((item) => item.id === eventId)
    const startsAt = parseSaoPauloDateTimeLocal('2028-06-15T21:00')
    expect(event).toEqual({
      id: eventId,
      name: 'Jazz no Porão',
      startsAt: formatStartsAtIso(startsAt as Date),
      priceCents: 10000,
      availableSeats: 2,
    })
    expect(event?.startsAt).toBe('2028-06-15T21:00:00-03:00')
  })

  test('compra 202 pending e a ordem de erros HTTP', async () => {
    const cookie = await loginOrganizerA(ctx.app)
    const eventId = await createPublished(ctx.app, cookie, { capacity: '1', name: 'Uma vaga' })
    const badJson = await api('POST', `/api/partner/events/${eventId}/purchases`, { payload: '{' })
    expect(badJson.statusCode).toBe(422)
    expect(badJson.json()).toEqual({ error: 'invalid_request' })

    const missingField = await api('POST', `/api/partner/events/${eventId}/purchases`, {
      payload: JSON.stringify({ buyerEmail: 'ana@example.com' }),
    })
    expect(missingField.statusCode).toBe(422)
    expect(missingField.json()).toEqual({ error: 'invalid_request' })

    const badCard = await api('POST', '/api/partner/events/evt_nao_existe/purchases', {
      payload: JSON.stringify({ buyerEmail: 'ana@example.com', cardNumber: '123' }),
    })
    expect(badCard.statusCode).toBe(422)
    expect(badCard.json()).toEqual({ error: 'invalid_request' })

    const missingEvent = await api('POST', '/api/partner/events/evt_nao_existe/purchases', {
      payload: JSON.stringify({ buyerEmail: 'ana@example.com', cardNumber: '4000000000000001' }),
    })
    expect(missingEvent.statusCode).toBe(404)
    expect(missingEvent.json()).toEqual({ error: 'event_not_available' })

    const draftId = await createDraft(ctx.app, cookie, { name: 'Ainda não' })
    const draft = await api('POST', `/api/partner/events/${draftId}/purchases`, {
      payload: JSON.stringify({ buyerEmail: 'ana@example.com', cardNumber: '4000000000000001' }),
    })
    expect(draft.statusCode).toBe(404)
    expect(draft.json()).toEqual({ error: 'event_not_available' })

    const bought = await api('POST', `/api/partner/events/${eventId}/purchases`, {
      payload: JSON.stringify({ buyerEmail: 'ana@example.com', cardNumber: '4000000000000001' }),
    })
    expect(bought.statusCode).toBe(202)
    expect(bought.json()).toMatchObject({ status: 'pending' })
    const created = bought.json() as { ticketId: string; code: string; status: string }
    expect(created.ticketId.startsWith('tkt_')).toBe(true)
    expect(created.code).toMatch(/^[A-Z2-9]{8}$/)

    const soldOut = await api('POST', `/api/partner/events/${eventId}/purchases`, {
      payload: JSON.stringify({ buyerEmail: 'b@example.com', cardNumber: '4000000000000001' }),
    })
    expect(soldOut.statusCode).toBe(409)
    expect(soldOut.json()).toEqual({ error: 'sold_out' })

    await cancelPublishedEvent(SEED.organizerA.id, eventId)
    const cancelled = await api('POST', `/api/partner/events/${eventId}/purchases`, {
      payload: JSON.stringify({ buyerEmail: 'c@example.com', cardNumber: '4000000000000001' }),
    })
    expect(cancelled.statusCode).toBe(404)
    expect(cancelled.json()).toEqual({ error: 'event_not_available' })
    const listed = (await api('GET', '/api/partner/events')).json() as Array<{ id: string }>
    expect(listed.map((event) => event.id)).not.toContain(eventId)
  })

  test('consulta do ingresso e 404', async () => {
    const cookie = await loginOrganizerA(ctx.app)
    const eventId = await createPublished(ctx.app, cookie, { capacity: '2' })
    const bought = await api('POST', `/api/partner/events/${eventId}/purchases`, {
      payload: JSON.stringify({ buyerEmail: 'ana@example.com', cardNumber: '4000000000000001' }),
    })
    const { ticketId, code } = bought.json() as { ticketId: string; code: string }
    const pending = await api('GET', `/api/partner/tickets/${ticketId}`)
    expect(pending.statusCode).toBe(200)
    expect(pending.json()).toEqual({ ticketId, code, eventId, status: 'pending', checkedIn: false })
    await processDueTickets()
    const confirmed = await api('GET', `/api/partner/tickets/${ticketId}`)
    expect(confirmed.json()).toEqual({ ticketId, code, eventId, status: 'confirmed', checkedIn: false })
    const missing = await api('GET', '/api/partner/tickets/tkt_nao_existe')
    expect(missing.statusCode).toBe(404)
    expect(missing.json()).toEqual({ error: 'ticket_not_found' })
  })

  test('401 sem chave e com chave errada nas três rotas', async () => {
    const urls = [
      ['GET', '/api/partner/events'],
      ['POST', '/api/partner/events/evt_x/purchases'],
      ['GET', '/api/partner/tickets/tkt_x'],
    ] as const
    for (const [method, url] of urls) {
      const missing = await api(method, url, { key: null, payload: method === 'POST' ? '{' : undefined })
      const wrong = await api(method, url, { key: 'chave-errada', payload: method === 'POST' ? '{' : undefined })
      expect(missing.statusCode, url).toBe(401)
      expect(missing.json()).toEqual({ error: 'unauthorized' })
      expect(wrong.statusCode, url).toBe(401)
      expect(wrong.json()).toEqual({ error: 'unauthorized' })
    }
  })

  test('rajada HTTP de 30 compras resulta em 5 vendas', async () => {
    const cookie = await loginOrganizerA(ctx.app)
    for (const name of ['E4', 'E5']) {
      const eventId = await createPublished(ctx.app, cookie, { capacity: '5', name, price: '10,00' })
      const responses = await Promise.all(
        Array.from({ length: 30 }, (_, index) =>
          api('POST', `/api/partner/events/${eventId}/purchases`, {
            payload: JSON.stringify({ buyerEmail: `carga${index}@example.com`, cardNumber: '4000000000000001' }),
          }),
        ),
      )
      const codes = responses.map((response) => response.statusCode).sort()
      expect(codes.filter((code) => code === 202)).toHaveLength(5)
      expect(codes.filter((code) => code === 409)).toHaveLength(25)
      const rows = await getPool().query<{ n: number }>('SELECT COUNT(*)::int AS n FROM tickets WHERE event_id = $1', [eventId])
      expect(Number(rows.rows[0]?.n)).toBe(5)
    }
  })
})
