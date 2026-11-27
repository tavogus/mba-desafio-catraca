# F02 — Spec

## Decisão

Evento nasce `draft`. `published` entra na listagem à venda. `cancelled` sai dela e recusa edição. O início é interpretado como horário de America/Sao_Paulo (`-03:00`), sem horário de verão.

A edição trava a linha do evento, conta a ocupação (`pending` + `confirmed`) e só grava se a nova lotação for maior ou igual a essa conta. O preço é coluna do evento; o ingresso guarda o próprio `price_cents` na compra, então mudança de preço não reescreve venda antiga.

A URL de gestão é `/organizador/eventos/{id}`. Dono errado recebe 404 sem nome, local, preço ou código.

## Validação

Nome e local obrigatórios, lotação inteira de 1 a 100000, preço em reais maior que zero (`100`, `100,00`, `100.00` ou `R$ 150,00`), início estritamente futuro.
