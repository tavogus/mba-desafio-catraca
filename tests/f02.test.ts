import { describe, expect, test } from 'vitest'
import { listEventsOnSale } from '../src/events/service.js'
import { shiftDateTimeLocal } from '../src/time.js'
import { createDraft, eventFields, loginOrganizerA, loginOrganizerB, loginParticipant, useApp } from './helpers.js'

const ctx = useApp()

async function postEvent(cookie: string, fields: Record<string, string>) {
  return ctx.app.inject({
    method: 'POST',
    url: '/organizador/eventos',
    headers: { cookie, 'content-type': 'application/x-www-form-urlencoded' },
    payload: new URLSearchParams(fields).toString(),
  })
}

describe('F02 eventos', () => {
  test('rejeita data passada ao criar e ao editar (R01)', async () => {
    const cookie = await loginOrganizerA(ctx.app)
    const rejected = await postEvent(cookie, eventFields({ startsAt: shiftDateTimeLocal(-2), name: 'Ontem à noite' }))
    expect(rejected.statusCode).toBe(400)
    expect(rejected.body).toContain('A data de início precisa estar no futuro.')
    const list = await ctx.app.inject({ method: 'GET', url: '/organizador', headers: { cookie } })
    expect(list.body).not.toContain('Ontem à noite')

    const eventId = await createDraft(ctx.app, cookie, { name: 'Data válida' })
    const edited = await ctx.app.inject({
      method: 'POST',
      url: `/organizador/eventos/${eventId}`,
      headers: { cookie, 'content-type': 'application/x-www-form-urlencoded' },
      payload: new URLSearchParams(eventFields({ name: 'Data válida', startsAt: shiftDateTimeLocal(-2) })).toString(),
    })
    expect(edited.statusCode).toBe(400)
    expect(edited.body).toContain('A data de início precisa estar no futuro.')
    const page = await ctx.app.inject({ method: 'GET', url: `/organizador/eventos/${eventId}`, headers: { cookie } })
    expect(page.body).toContain('Data válida')
  })

  test('evento nasce rascunho e publicação o coloca à venda (R02)', async () => {
    const cookie = await loginOrganizerA(ctx.app)
    const eventId = await createDraft(ctx.app, cookie, { name: 'Rascunho Jazz' })
    expect((await listEventsOnSale()).map((event) => event.id)).not.toContain(eventId)
    const draftPage = await ctx.app.inject({ method: 'GET', url: `/organizador/eventos/${eventId}`, headers: { cookie } })
    expect(draftPage.body).toContain('Rascunho')
    expect(draftPage.body).toContain('Publicar')

    const published = await ctx.app.inject({
      method: 'POST',
      url: `/organizador/eventos/${eventId}/publicar`,
      headers: { cookie },
    })
    expect(published.statusCode).toBe(303)
    const onSale = await listEventsOnSale()
    expect(onSale.map((event) => event.id)).toContain(eventId)
  })

  test('rejeita lotação e preço inválidos (R01, R03)', async () => {
    const cookie = await loginOrganizerA(ctx.app)
    const zeroSeats = await postEvent(cookie, eventFields({ capacity: '0', name: 'Sem lugar' }))
    expect(zeroSeats.statusCode).toBe(400)
    expect(zeroSeats.body).toContain('A lotação precisa ser um inteiro maior ou igual a 1.')
    const fraction = await postEvent(cookie, eventFields({ capacity: '1.5', name: 'Meio lugar' }))
    expect(fraction.statusCode).toBe(400)
    const free = await postEvent(cookie, eventFields({ price: '0', name: 'De graça' }))
    expect(free.statusCode).toBe(400)
    expect(free.body).toContain('O preço precisa ser maior que zero.')
  })

  test('aumento de lotação e mudança de preço são aceitos (R03)', async () => {
    const cookie = await loginOrganizerA(ctx.app)
    const eventId = await createDraft(ctx.app, cookie, { capacity: '2', price: '100,00', name: 'Preço móvel' })
    const edited = await ctx.app.inject({
      method: 'POST',
      url: `/organizador/eventos/${eventId}`,
      headers: { cookie, 'content-type': 'application/x-www-form-urlencoded' },
      payload: new URLSearchParams(eventFields({ name: 'Preço móvel', capacity: '8', price: 'R$ 150,00' })).toString(),
    })
    expect(edited.statusCode).toBe(303)
    const page = await ctx.app.inject({ method: 'GET', url: `/organizador/eventos/${eventId}`, headers: { cookie } })
    expect(page.body).toContain('value="8"')
    expect(page.body).toContain('value="150,00"')
  })

  test('outro organizador não vê o evento (R13)', async () => {
    const cookieA = await loginOrganizerA(ctx.app)
    const eventId = await createDraft(ctx.app, cookieA, { name: 'Show só da Ana' })
    const cookieB = await loginOrganizerB(ctx.app)
    const list = await ctx.app.inject({ method: 'GET', url: '/organizador', headers: { cookie: cookieB } })
    expect(list.body).not.toContain('Show só da Ana')
    const direct = await ctx.app.inject({
      method: 'GET',
      url: `/organizador/eventos/${eventId}`,
      headers: { cookie: cookieB },
    })
    expect(direct.statusCode).toBe(404)
    expect(direct.body).not.toContain('Show só da Ana')
    expect(direct.body).not.toContain('Porão da Vila')
  })

  test('participante não abre a gestão (R13)', async () => {
    const organizer = await loginOrganizerA(ctx.app)
    const eventId = await createDraft(ctx.app, organizer, { name: 'Área fechada' })
    const participant = await loginParticipant(ctx.app)
    const direct = await ctx.app.inject({
      method: 'GET',
      url: `/organizador/eventos/${eventId}`,
      headers: { cookie: participant },
    })
    expect(direct.statusCode).toBe(403)
    expect(direct.body).not.toContain('Área fechada')
  })

  test('nome do evento é escapado', async () => {
    const cookie = await loginOrganizerA(ctx.app)
    const eventId = await createDraft(ctx.app, cookie, { name: '<b>Jazz</b>' })
    const page = await ctx.app.inject({ method: 'GET', url: `/organizador/eventos/${eventId}`, headers: { cookie } })
    expect(page.body).toContain('&lt;b&gt;Jazz&lt;/b&gt;')
    expect(page.body).not.toContain('<b>Jazz</b>')
  })
})
