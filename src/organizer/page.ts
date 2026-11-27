import type { User } from '../auth/session.js'
import type { EventRecord } from '../events/service.js'
import { EVENT_STATUS_LABEL } from '../events/service.js'
import { centsToInput } from '../money.js'
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
  const publish =
    event.status === 'draft'
      ? `<form method="post" action="/organizador/eventos/${esc(event.id)}/publicar"><button type="submit">Publicar</button></form>`
      : ''
  return layout({
    title: event.name,
    user: input.user,
    body: `<h1>${esc(event.name)}</h1>
      <p>Situação: ${esc(EVENT_STATUS_LABEL[event.status])}</p>
      <p>${esc(formatWhen(event.startsAt))} · ${esc(event.venue)}</p>
      ${input.notice ? `<p class="notice">${esc(input.notice)}</p>` : ''}
      ${input.error ? `<p class="error">${esc(input.error)}</p>` : ''}
      ${input.checkinMessage ? `<p>${esc(input.checkinMessage)}</p>` : ''}
      <form method="post" action="/organizador/eventos/${esc(event.id)}">
        ${field('Nome', 'name', event.name)}
        ${field('Início', 'startsAt', dateTimeLocalInSaoPaulo(event.startsAt), 'datetime-local')}
        ${field('Local', 'venue', event.venue)}
        ${field('Lotação', 'capacity', String(event.capacity))}
        ${field('Preço (R$)', 'price', centsToInput(event.priceCents))}
        <button type="submit">Salvar alterações</button>
      </form>
      ${publish}`,
  })
}
