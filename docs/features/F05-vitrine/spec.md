# F05 — Spec

## Decisão

A vitrine é HTML servido pelo mesmo processo. `GET /` lista `listEventsOnSale`. `GET /eventos/{id}` só existe para evento publicado; rascunho e cancelado respondem 404 sem o nome.

Com vaga e participante logado, o formulário pede o cartão de 16 dígitos. Sem vaga, o formulário some e a página diz "Ingressos esgotados". Um POST sem vaga devolve a mesma frase. Visitante que tenta comprar vai para `/entrar` e nenhum ingresso é criado.

"Meus ingressos" lista compras do `participant_id` com o nome do evento, `Status: ` mais o rótulo (pendente, confirmado, recusado, cancelado, estornado) e `Código: `. Compra de parceiro não aparece aí, porque não tem participante. `Cache-Control: no-store` faz o reload ver o status novo.
