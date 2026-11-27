# F03 — Spec

## Compra

`purchaseTicket` valida e-mail e cartão de 16 dígitos antes de abrir transação. Dentro dela: `SELECT … FOR UPDATE` na linha do evento, contagem de `pending` + `confirmed`, insert só se couber. Sem vaga, rollback e `sold_out`, sem linha nova. O pool tem 40 conexões para a rajada de 30 esperar a trava, não uma conexão.

O preço copiado é o `price_cents` do evento na hora do insert. O desfecho do gateway (`approved` ou `declined`) e o atraso são gravados junto. `gateway_due_at` usa o relógio do Postgres.

## Gateway

Finais 0001 e 0003 aprovam. 0002, 0004 e o resto recusam. Atraso sorteado em [2000, 4500] ms ou [30000, 38000] ms, dentro das janelas de 2–5 s e 30–40 s. `GATEWAY_DELAY_FACTOR` escala o atraso; o compose deixa em 1 e os gates em 0.

O worker faz `UPDATE … WHERE status = 'pending'` depois de travar o evento. Cancelado ou estornado não volta atrás.

## Cancelamento, check-in, painel

Cancelar trava o evento, exige `published`, marca o evento `cancelled`, `pending` vira `cancelled` e `confirmed` vira `refunded`.

Check-in trava o evento do organizador e aplica a primeira condição verdadeira de R10. Código comparado em maiúsculas.

Receita é a soma de `price_cents` dos `confirmed`. Check-ins são `confirmed` com `checked_in`. Vagas de evento cancelado são zero.
