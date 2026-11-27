# F06 — Contrato

## Pré-requisitos

Organizador A e B da seed. `./scripts/gates.sh` ou o produto no ar.

## Itens

| Item | Como verificar | Esperado |
| --- | --- | --- |
| F06-I1 | `tests/f06.test.ts` "reúne edição" | painel, check-in, salvar e cancelar na mesma URL; publicado não mostra Publicar |
| F06-I2 | "mensagens exatas" | Ingresso inválido para este evento, Ingresso não confirmado, Entrada liberada, Ingresso já utilizado; Check-ins: 1 |
| F06-I3 | "liquida os ingressos" | Evento cancelado, sem Salvar e sem Publicar; estornados 1; receita R$ 0,00; edição rejeitada; gateway tardio não muda cancelled |
| F06-I4 | "cenário do fluxo" | Confirmados: 3, Pendentes: 0, Check-ins: 0, Vagas disponíveis: 0, Receita: R$ 350,00, Estornados: 0 |
| F06-I5 | "não veem o evento" | organizador B, participante e visitante sem o nome e sem o código |
| F06-I6 | "data passada e lotação" | data passada rejeitada; lotação 0 rejeitada; lotação igual à ocupação aceita |

## Mapeamento

| Critério | Item |
| --- | --- |
| F06-AC1 | F06-I1 |
| F06-AC2 | F06-I2 |
| F06-AC3 | F06-I3 |
| F06-AC4 | F06-I4 |
| F06-AC5 | F06-I5 |
| XF-09 | F06-I5 |
| XF-10 | F06-I6 |
| XF-11 | F06-I2, F06-I3, F06-I4 |
