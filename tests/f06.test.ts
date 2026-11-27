import { describe, expect, test } from 'vitest'
import { SEED } from '../src/auth/session.js'
import { purchaseTicket } from '../src/tickets/purchase.js'
import { processDueTickets } from '../src/tickets/worker.js'
import { getPool } from '../src/db.js'
import { CHECKIN } from '../src/tickets/messages.js'
import { shiftDateTimeLocal } from '../src/time.js'
import {
  createPublished,
  eventFields,
  loginOrganizerA,
  loginOrganizerB,
  loginParticipant,
  useApp,
} from './helpers.js'

const ctx = useApp()

async function buy(eventId: string, cardNumber: string, email: string) {
  const result = await purchaseTicket({
    eventId,
    buyerEmail: email,
    cardNumber,
    channel: 'partner',
    participantId: null,
  })
  if (!result.ok) throw new Error(result.error)
  return result.ticket
}

describe('F06 gestão', () => {
  test('página de gestão reúne edição, painel, check-in e cancelamento', async () => {
    const cookie = await loginOrganizerA(ctx.app)
    const eventId = await createPublished(ctx.app, cookie, { name: 'Gestão completa', capacity: '4', price: '80,00' })
    const page = await ctx.app.inject({ method: 'GET', url: `/organizador/eventos/${eventId}`, headers: { cookie } })
    expect(page.statusCode).toBe(200)
    expect(page.body).toContain('Gestão completa')
    expect(page.body).toContain('Salvar alterações')
    expect(page.body).toContain('Painel')
    expect(page.body).toContain('Confirmados: 0')
    expect(page.body).toContain('Check-in')
    expect(page.body).toContain('Cancelar evento')
    expect(page.body).not.toContain('Publicar')
  })

  test('check-in na página usa as mensagens exatas', async () => {
    const cookie = await loginOrganizerA(ctx.app)
    const eventId = await createPublished(ctx.app, cookie, { capacity: '3', name: 'Porta da gestão' })
    const otherId = await createPublished(ctx.app, cookie, { capacity: '1', name: 'Outro show' })
    const pending = await buy(eventId, '4000000000000004', 'p@example.com')
    const confirmed = await buy(eventId, '4000000000000001', 'c@example.com')
    const other = await buy(otherId, '4000000000000001', 'o@example.com')
    await getPool().query(`UPDATE tickets SET gateway_due_at = clock_timestamp() + interval '2 hours' WHERE id = $1`, [pending.id])
    await processDueTickets()

    async function check(code: string) {
      const posted = await ctx.app.inject({
        method: 'POST',
        url: `/organizador/eventos/${eventId}/checkin`,
        headers: { cookie, 'content-type': 'application/x-www-form-urlencoded' },
        payload: new URLSearchParams({ code }).toString(),
      })
      expect(posted.statusCode).toBe(303)
      const page = await ctx.app.inject({
        method: 'GET',
        url: String(posted.headers.location),
        headers: { cookie },
      })
      return page.body
    }

    expect(await check('ZZZZZZZZ')).toContain(CHECKIN.invalid)
    expect(await check(other.code)).toContain(CHECKIN.invalid)
    expect(await check(pending.code)).toContain(CHECKIN.unconfirmed)
    expect(await check(confirmed.code)).toContain(CHECKIN.released)
    const used = await check(confirmed.code)
    expect(used).toContain(CHECKIN.used)
    expect(used).toContain('Check-ins: 1')
  })

  test('cancelar é irreversível e liquida os ingressos', async () => {
    const cookie = await loginOrganizerA(ctx.app)
    const eventId = await createPublished(ctx.app, cookie, { capacity: '5', price: '50,00', name: 'Show cancelado' })
    const slow = await buy(eventId, '4000000000000003', 'lento@example.com')
    const fast = await buy(eventId, '4000000000000001', 'rapido@example.com')
    await getPool().query(`UPDATE tickets SET gateway_due_at = clock_timestamp() + interval '1 hour' WHERE id = $1`, [slow.id])
    await processDueTickets()
    const cancelled = await ctx.app.inject({
      method: 'POST',
      url: `/organizador/eventos/${eventId}/cancelar`,
      headers: { cookie },
    })
    expect(cancelled.statusCode).toBe(303)
    const page = await ctx.app.inject({ method: 'GET', url: `/organizador/eventos/${eventId}`, headers: { cookie } })
    expect(page.body).toContain('Evento cancelado')
    expect(page.body).not.toContain('Salvar alterações')
    expect(page.body).not.toContain('Publicar')
    expect(page.body).toContain('Confirmados: 0')
    expect(page.body).toContain('Pendentes: 0')
    expect(page.body).toContain('Vagas disponíveis: 0')
    expect(page.body).toContain('Receita: R$ 0,00')
    expect(page.body).toContain('Estornados: 1')

    const statuses = await getPool().query<{ id: string; status: string }>('SELECT id, status FROM tickets WHERE event_id = $1', [eventId])
    expect(statuses.rows.find((row) => row.id === fast.id)?.status).toBe('refunded')
    expect(statuses.rows.find((row) => row.id === slow.id)?.status).toBe('cancelled')
    await getPool().query(`UPDATE tickets SET gateway_due_at = clock_timestamp() - interval '1 minute' WHERE id = $1`, [slow.id])
    await processDueTickets()
    const after = await getPool().query<{ status: string }>('SELECT status FROM tickets WHERE id = $1', [slow.id])
    expect(after.rows[0]?.status).toBe('cancelled')

    const edited = await ctx.app.inject({
      method: 'POST',
      url: `/organizador/eventos/${eventId}`,
      headers: { cookie, 'content-type': 'application/x-www-form-urlencoded' },
      payload: new URLSearchParams(eventFields({ name: 'Nome novo', capacity: '9', price: '10,00' })).toString(),
    })
    expect(edited.statusCode).toBe(400)
    expect(edited.body).toContain('Evento cancelado não pode ser editado.')
    expect(edited.body).toContain('Show cancelado')
    expect(edited.body).not.toContain('Nome novo')

    const checkin = await ctx.app.inject({
      method: 'POST',
      url: `/organizador/eventos/${eventId}/checkin`,
      headers: { cookie, 'content-type': 'application/x-www-form-urlencoded' },
      payload: new URLSearchParams({ code: fast.code }).toString(),
    })
    const checkPage = await ctx.app.inject({ method: 'GET', url: String(checkin.headers.location), headers: { cookie } })
    expect(checkPage.body).toContain('Evento cancelado')
  })

  test('painel da página bate com o cenário do fluxo', async () => {
    const cookie = await loginOrganizerA(ctx.app)
    const eventId = await createPublished(ctx.app, cookie, { capacity: '3', price: '100,00', name: 'Receita do painel' })
    await buy(eventId, '4000000000000001', 'a@example.com')
    await buy(eventId, '4000000000000001', 'b@example.com')
    await processDueTickets()
    await ctx.app.inject({
      method: 'POST',
      url: `/organizador/eventos/${eventId}`,
      headers: { cookie, 'content-type': 'application/x-www-form-urlencoded' },
      payload: new URLSearchParams(eventFields({ name: 'Receita do painel', capacity: '3', price: '150,00' })).toString(),
    })
    await buy(eventId, '4000000000000001', 'c@example.com')
    await processDueTickets()
    const page = await ctx.app.inject({ method: 'GET', url: `/organizador/eventos/${eventId}`, headers: { cookie } })
    expect(page.body).toContain('Confirmados: 3')
    expect(page.body).toContain('Pendentes: 0')
    expect(page.body).toContain('Check-ins: 0')
    expect(page.body).toContain('Vagas disponíveis: 0')
    expect(page.body).toContain('Receita: R$ 350,00')
    expect(page.body).toContain('Estornados: 0')
  })

  test('organizador alheio, participante e visitante não veem o evento', async () => {
    const cookieA = await loginOrganizerA(ctx.app)
    const eventId = await createPublished(ctx.app, cookieA, { name: 'Segredo da Ana', price: '100,00', capacity: '2' })
    const ticket = await buy(eventId, '4000000000000001', 'segredo@example.com')
    const cookieB = await loginOrganizerB(ctx.app)
    const list = await ctx.app.inject({ method: 'GET', url: '/organizador', headers: { cookie: cookieB } })
    expect(list.body).not.toContain('Segredo da Ana')
    const direct = await ctx.app.inject({ method: 'GET', url: `/organizador/eventos/${eventId}`, headers: { cookie: cookieB } })
    expect(direct.statusCode).toBe(404)
    expect(direct.body).not.toContain('Segredo da Ana')
    expect(direct.body).not.toContain(ticket.code)
    expect(direct.body).not.toContain('Receita')

    const participant = await loginParticipant(ctx.app)
    const asParticipant = await ctx.app.inject({
      method: 'GET',
      url: `/organizador/eventos/${eventId}`,
      headers: { cookie: participant },
    })
    expect(asParticipant.statusCode).toBe(403)
    expect(asParticipant.body).not.toContain('Segredo da Ana')

    const visitor = await ctx.app.inject({ method: 'GET', url: `/organizador/eventos/${eventId}` })
    expect(visitor.statusCode).toBe(303)
    expect(visitor.body).not.toContain('Segredo da Ana')

    const wrongDoor = await ctx.app.inject({
      method: 'POST',
      url: `/organizador/eventos/${eventId}/checkin`,
      headers: { cookie: cookieB, 'content-type': 'application/x-www-form-urlencoded' },
      payload: new URLSearchParams({ code: ticket.code }).toString(),
    })
    expect(wrongDoor.statusCode).toBe(404)
    expect(wrongDoor.body).not.toContain(ticket.code)
  })

  test('data passada e lotação insuficiente são rejeitadas na gestão', async () => {
    const cookie = await loginOrganizerA(ctx.app)
    const eventId = await createPublished(ctx.app, cookie, { capacity: '1', name: 'Piso da gestão' })
    await buy(eventId, '4000000000000001', 'ocupa@example.com')
    const past = await ctx.app.inject({
      method: 'POST',
      url: `/organizador/eventos/${eventId}`,
      headers: { cookie, 'content-type': 'application/x-www-form-urlencoded' },
      payload: new URLSearchParams(eventFields({ name: 'Piso da gestão', startsAt: shiftDateTimeLocal(-2), capacity: '1' })).toString(),
    })
    expect(past.statusCode).toBe(400)
    expect(past.body).toContain('A data de início precisa estar no futuro.')
    const shrink = await ctx.app.inject({
      method: 'POST',
      url: `/organizador/eventos/${eventId}`,
      headers: { cookie, 'content-type': 'application/x-www-form-urlencoded' },
      payload: new URLSearchParams(eventFields({ name: 'Piso da gestão', capacity: '0' })).toString(),
    })
    expect(shrink.body).toContain('A lotação precisa ser um inteiro maior ou igual a 1.')
    const floor = await ctx.app.inject({
      method: 'POST',
      url: `/organizador/eventos/${eventId}`,
      headers: { cookie, 'content-type': 'application/x-www-form-urlencoded' },
      payload: new URLSearchParams(eventFields({ name: 'Piso da gestão', capacity: '1' })).toString(),
    })
    expect(floor.statusCode).toBe(303)
  })
})
