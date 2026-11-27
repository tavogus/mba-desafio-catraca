# F04 — Spec

## Decisão

As três rotas ficam no mesmo processo da vitrine e chamam `purchaseTicket`, `listEventsOnSale` e `getTicketById`. Não há checagem de vaga fora da transação da compra.

A autenticação é um hook `onRequest` em todo caminho `/api/partner`, antes do parse do JSON. Sem `X-Api-Key` válida a resposta é 401 `{"error":"unauthorized"}` mesmo com corpo quebrado.

Corpo que não é objeto, campo ausente, e-mail inválido ou cartão fora de 16 dígitos: 422 `invalid_request`. Evento ausente, rascunho ou cancelado: 404 `event_not_available`. Sem vaga: 409 `sold_out`. Sucesso: 202 com `ticketId`, `code`, `status: "pending"`.

`startsAt` sai como ISO com offset `-03:00`. O objeto do evento tem exatamente os cinco campos do contrato. O do ingresso, exatamente os cinco campos do contrato. Compra de parceiro grava `participant_id` nulo e `channel = partner`.
