# F01 — Contrato

## Pré-requisitos

`./scripts/gates.sh` sobe o Postgres de teste e roda a suíte com `GATEWAY_DELAY_FACTOR=0`.

## Itens

| Item | Como verificar | Esperado |
| --- | --- | --- |
| F01-I1 | `npx vitest run tests/f01.test.ts -t "participante cria conta"` | passa |
| F01-I2 | `npx vitest run tests/f01.test.ts -t "organizador da seed"` | passa |
| F01-I3 | `npx vitest run tests/f01.test.ts -t "seed roda de novo"` | passa |
| F01-I4 | `npx vitest run tests/f01.test.ts -t "visitante e participante"` | passa; 303 para visitante e 403 para participante, sem dado de evento |

## Mapeamento

| Critério | Item |
| --- | --- |
| F01-AC1 | F01-I1 |
| F01-AC2 | F01-I2 |
| F01-AC3 | F01-I4 |
| XF-01 | F01-I4 e o teste de participante em `tests/f02.test.ts` |
