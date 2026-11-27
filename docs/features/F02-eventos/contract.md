# F02 — Contrato

## Pré-requisitos

Os de F01. Organizador A e B existem na seed.

## Itens

| Item | Como verificar | Esperado |
| --- | --- | --- |
| F02-I1 | `npx vitest run tests/f02.test.ts -t "data passada"` | criação e edição rejeitadas com "A data de início precisa estar no futuro." |
| F02-I2 | `npx vitest run tests/f02.test.ts -t "nasce rascunho"` | rascunho fora de `listEventsOnSale`; depois de publicar, dentro |
| F02-I3 | `npx vitest run tests/f02.test.ts -t "lotação e preço inválidos"` | lotação 0, fração e preço zero rejeitados |
| F02-I4 | `npx vitest run tests/f02.test.ts -t "aumento de lotação"` | lotação 8 e preço 150,00 gravados |
| F02-I5 | `npx vitest run tests/f02.test.ts -t "outro organizador"` | lista e URL direta sem o nome do evento; HTTP 404 |
| F02-I6 | `npx vitest run tests/f03.test.ts -t "lotação não fica abaixo"` | reduzir abaixo da ocupação falha; aumentar passa |
| F02-I7 | `npx vitest run tests/f03.test.ts -t "preço vigente"` | ingresso antigo permanece em 10000 centavos |

## Mapeamento

| Critério | Item |
| --- | --- |
| F02-AC1 | F02-I1, F02-I3 |
| F02-AC2 | F02-I2 |
| F02-AC3 | F02-I3, F02-I4, F02-I6, F02-I7 |
| F02-AC4 | F02-I5 |
| XF-01 | F02-I5 e `tests/f02.test.ts` "participante não abre a gestão" |
| XF-02 | F02-I7 e `tests/f03.test.ts` "compra nasce pendente" |
| XF-10 | `tests/f06.test.ts` "data passada e lotação" |
