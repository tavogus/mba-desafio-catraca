# F05 — Contrato

## Pré-requisitos

`./scripts/gates.sh` ou o produto em http://localhost:3000. Participante da seed ou uma conta criada na hora.

## Itens

| Item | Como verificar | Esperado |
| --- | --- | --- |
| F05-I1 | `tests/f05.test.ts` "só publicado" | publicado na home; rascunho ausente; cancelado sai; URL de rascunho 404 sem o nome |
| F05-I2 | "meus ingressos" | redirect para /meus-ingressos; "Status: pendente" e código; depois do gateway, "Status: confirmado" |
| F05-I3 | "Ingressos esgotados" | a frase na página e na home, sem o botão comprar; segunda tentativa 409 e uma única linha |
| F05-I4 | "não compra sem entrar" | visitante vê o nome; POST volta para /entrar |

## Mapeamento

| Critério | Item |
| --- | --- |
| F05-AC1 | F05-I1 |
| F05-AC2 | F05-I2 |
| F05-AC3 | F05-I3 |
| XF-06 | F05-I4 |
| XF-07 | F05-I1 |
| XF-08 | F05-I2 |
