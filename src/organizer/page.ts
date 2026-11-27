import type { User } from '../auth/session.js'
import type { EventRecord } from '../events/service.js'
import { EVENT_STATUS_LABEL } from '../events/service.js'
import { centsToInput, formatReais } from '../money.js'
import { getDashboard } from '../tickets/dashboard.js'
import { CHECKIN } from '../tickets/messages.js'
import { dateTimeLocalInSaoPaulo, formatWhen } from '../time.js'
import { esc, field } from '../web/html.js'
import { layout } from '../web/layout.js'

export async function renderEventManagement(input: {
  user: User
  event: EventRecord
  error?: string | null
  checkinMessage?: string | null
  notice?: string | null
}): Promise<string> {
  const { event } = input
  const dashboard = await getDashboard(event.id)
  const cancelled = event.status === 'cancelled'
  const metrics = dashboard
    ? `<section>
        <h2>Painel</h2>
        <p class="metric">Confirmados: ${dashboard.confirmed}</p>
        <p class="metric">Pendentes: ${dashboard.pending}</p>
        <p class="metric">Check-ins: ${dashboard.checkins}</p>
        <p class="metric">Vagas disponíveis: ${dashboard.availableSeats}</p>
        <p class="metric">Receita: ${esc(formatReais(dashboard.revenueCents))}</p>
        <p class="metric">Estornados: ${dashboard.refunded}</p>
      </section>`
    : ''
  const publish =
    event.status === 'draft'
      ? `<form method="post" action="/organizador/eventos/${esc(event.id)}/publicar"><button type="submit">Publicar</button></form>`
      : ''
  const cancel =
    event.status === 'published'
      ? `<form method="post" action="/organizador/eventos/${esc(event.id)}/cancelar"><button type="submit">Cancelar evento</button></form>`
      : ''
  const fields = `${field('Nome', 'name', event.name)}
        ${field('Início', 'startsAt', dateTimeLocalInSaoPaulo(event.startsAt), 'datetime-local')}
        ${field('Local', 'venue', event.venue)}
        ${field('Lotação', 'capacity', String(event.capacity))}
        ${field('Preço (R$)', 'price', centsToInput(event.priceCents))}`
  const editor = cancelled
    ? `<fieldset disabled>${fields}</fieldset>
       <p>Este evento foi cancelado e não pode ser editado nem republicado.</p>`
    : `<form method="post" action="/organizador/eventos/${esc(event.id)}">
        ${fields}
        <button type="submit">Salvar alterações</button>
      </form>`
  return layout({
    title: event.name,
    user: input.user,
    body: `<h1>${esc(event.name)}</h1>
      <p>Situação: ${esc(EVENT_STATUS_LABEL[event.status])}</p>
      <p>${esc(formatWhen(event.startsAt))} · ${esc(event.venue)}</p>
      ${input.notice ? `<p class="notice">${esc(input.notice)}</p>` : ''}
      ${input.error ? `<p class="error">${esc(input.error)}</p>` : ''}
      ${cancelled ? `<p>${esc(CHECKIN.cancelled)}</p>` : ''}
      ${metrics}
      <section>
        <h2>Check-in</h2>
        ${input.checkinMessage ? `<p id="checkin-result">${esc(input.checkinMessage)}</p>` : ''}
        <form method="post" action="/organizador/eventos/${esc(event.id)}/checkin">
          <label>Código do ingresso
            <input name="code" autocomplete="off" autocapitalize="characters" required>
          </label>
          <button type="submit">Confirmar entrada</button>
        </form>
      </section>
      <section>
        <h2>Editar evento</h2>
        ${editor}
        ${publish}
        ${cancel}
      </section>`,
  })
}
