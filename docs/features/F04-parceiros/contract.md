# F04 — Contrato

## Pré-requisitos

Aplicação no ar (`./scripts/up.sh`) ou a suíte (`./scripts/gates.sh`). Chave: `catraca_partner_key_local`.

## Itens

| Item | Como verificar | Esperado |
| --- | --- | --- |
| F04-I1 | `tests/f04.test.ts` "listagem segue o contrato" | um evento com priceCents 10000, availableSeats 2, startsAt `2028-06-15T21:00:00-03:00`; rascunho ausente |
| F04-I2 | "ordem de erros HTTP" | 422, 404 e 409 nessa ordem; 202 com status pending |
| F04-I3 | "consulta do ingresso" | pending, depois confirmed e checkedIn false; id inexistente 404 `ticket_not_found` |
| F04-I4 | "401 sem chave" | as três rotas, sem cabeçalho e com chave errada, 401 `unauthorized`, inclusive com JSON inválido |
| F04-I5 | "rajada HTTP" | dois eventos, cada um com 5 respostas 202 e 25 respostas 409 |

Exemplo manual:

```bash
curl -s -H "X-Api-Key: catraca_partner_key_local" http://localhost:3000/api/partner/events
```

## Mapeamento

| Critério | Item |
| --- | --- |
| F04-AC1 | F04-I1 |
| F04-AC2 | F04-I2 |
| F04-AC3 | F04-I3 |
| F04-AC4 | F04-I4 |
| XF-03 | F04-I4 |
| XF-04 | F04-I2 |
| XF-05 | F04-I3, F04-I5 |
