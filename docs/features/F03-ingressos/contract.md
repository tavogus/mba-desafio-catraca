# F03 — Contrato

## Pré-requisitos

`./scripts/gates.sh`. O teste do relógio real usa fator 1 só dentro do próprio caso e devolve o fator 0 ao terminar.

## Itens

| Item | Como verificar | Esperado |
| --- | --- | --- |
| F03-I1 | `tests/f03.test.ts` "compra nasce pendente" | status pending, uma vaga a menos, resposta em menos de 1 s |
| F03-I2 | "aprovação confirma e recusa libera" | declined devolve a vaga; confirmed ocupa |
| F03-I3 | "não tem 16 dígitos" | zero ingressos |
| F03-I4 | "ordem dos erros da compra" | invalid_request, event_not_available, sold_out, e uma única linha no esgotado |
| F03-I5 | "30 compras simultâneas" | cinco rodadas, cada uma com 5 ok, 25 sold_out e 5 linhas |
| F03-I6 | "preço vigente" | 10000 e 15000; receita 25000 |
| F03-I7 | "lotação não fica abaixo" | capacidade permanece 2; subir para 3 passa |
| F03-I8 | "gateway tardio" | refunded e cancelled estáveis depois do worker; painel com estornados 1 e receita 0 |
| F03-I9 | "ordem das mensagens" | os cinco textos de R10, nessa precedência |
| F03-I10 | "painel bate" | confirmados 2, pendentes 1, check-ins 1, receita 25000 |
| F03-I11 | "janela do brief" | 0001 entre 2000 e 4500 ms; 0003 entre 30000 e 38000 ms |
| F03-I12 | "cartão rápido dentro de 8 segundos" | confirmed entre 1,5 s e 8 s |

## Mapeamento

| Critério | Item |
| --- | --- |
| F03-AC1 | F03-I1, F03-I8 |
| F03-AC2 | F03-I1 |
| F03-AC3 | F03-I4, F03-I5 |
| F03-AC4 | F03-I2, F03-I3, F03-I11, F03-I12 |
| F03-AC5 | F03-I9 |
| F03-AC6 | F03-I8 |
| F03-AC7 | F03-I9 |
| F03-AC8 | F03-I6, F03-I10 |
| XF-02 | F03-I4, F03-I6 |
| XF-05 | `tests/f04.test.ts` "consulta do ingresso" e "rajada HTTP" |
| XF-08 | `tests/f05.test.ts` "meus ingressos" |
| XF-11 | `tests/f06.test.ts` "mensagens exatas" e "liquida os ingressos" |
