# Catraca

Ingressos para shows em bar, workshops e meetups. O produto sobe inteiro com um comando, já com a seed carregada.

## Como rodar

Pré-requisitos: Docker e Docker Compose. O Node fica dentro do container; a máquina do avaliador não precisa instalar dependências.

```bash
./scripts/up.sh
./scripts/down.sh
./scripts/gates.sh
```

`./scripts/up.sh` constrói as imagens, sobe o Postgres e a aplicação, aplica as migrations e carrega a seed. `./scripts/down.sh` encerra os containers do projeto. `./scripts/gates.sh` sobe o banco se precisar e roda a suíte automatizada. Derrubar e subir de novo é idempotente, inclusive na seed.

O modo padrão, o que o avaliador usa, simula o gateway de pagamento. Não há chave de pagamento.

## Endereços

| | |
| --- | --- |
| Produto (`$WEB`) | http://localhost:3000 |
| API de parceiros (`$API`) | http://localhost:3000 |

A API mora no mesmo processo. As rotas são `$API/api/partner/...`.

## Credenciais

A seed cria estas contas toda vez que a aplicação sobe. Rodar de novo não duplica.

| Quem | E-mail | Senha |
| --- | --- | --- |
| Organizador A | ana.organizadora@catraca.local | organizadora-a-senha |
| Organizador B | bruno.organizador@catraca.local | organizador-b-senha |
| Participante | clara.participante@catraca.local | participante-senha |

Chave de parceiro, no cabeçalho `X-Api-Key`: `catraca_partner_key_local`

## Mapa dos artefatos

| Artefato | Onde |
| --- | --- |
| PRD | [docs/prd.md](docs/prd.md) |
| Estado do projeto | [docs/state.json](docs/state.json) |
| F01 Identidade | [docs/features/F01-identidade](docs/features/F01-identidade) |
| F02 Eventos | [docs/features/F02-eventos](docs/features/F02-eventos) |
| F03 Ingressos | [docs/features/F03-ingressos](docs/features/F03-ingressos) |
| F04 API de parceiros | [docs/features/F04-parceiros](docs/features/F04-parceiros) |
| F05 Vitrine | [docs/features/F05-vitrine](docs/features/F05-vitrine) |
| F06 Gestão | [docs/features/F06-gestao](docs/features/F06-gestao) |
| Porta de entrada dos agentes | [AGENTS.md](AGENTS.md) |

Cada pasta de feature tem `spec.md`, `plan.md`, `contract.md` e `reports/`.

### Wave paralela

A wave 4 (F04, F05 e F06) foi implementada em branches separadas e integrada por pull requests:

- (links dos PRs entram aqui depois do merge)

## Decisões

**Stack.** Node.js 22, TypeScript e Fastify num processo só, com Postgres 16. A página e a API de parceiros compartilham o domínio, então lotação, painel, check-in e cancelamento não divergem por canal. O Postgres roda no container porque a máquina do avaliador só garante Node, Docker e Git, e a regra de lotação sob concorrência precisa de trava de linha.

**R07.** Cada compra abre uma transação, trava a linha do evento com `SELECT … FOR UPDATE`, conta ingressos `pending` e `confirmed` e só então insere. Sem vaga, a transação termina sem criar ingresso. O pool tem 40 conexões para a rajada de 30 não ficar presa esperando conexão enquanto segura a trava. A prova está na suíte: cinco rajadas pelo domínio e duas rajadas HTTP, cada uma com exatamente 5 respostas 202 e 25 respostas 409.

**Gateway.** A compra grava o ingresso `pending` com o desfecho já decidido (`gateway_outcome`) e `gateway_due_at = clock_timestamp() + atraso`. A resposta HTTP sai nesse momento. Um worker no processo aplica o desfecho só com `UPDATE … WHERE status = 'pending'`. Cancelar o evento tira os ingressos de `pending` e `confirmed` na mesma transação que trava a linha do evento, então uma resposta tardia não reescreve status. O atraso é sorteado em [2 s, 4,5 s] ou [30 s, 38 s], dentro das janelas do brief e com folga para “até 5 segundos”, “ainda pendente antes de 30 segundos” e “resolvido aos 45 segundos”. `GATEWAY_DELAY_FACTOR=1` é o padrão do `docker-compose`. Os gates usam `0` para não esperar o relógio. Não existe gateway real.

**Avaliação.** Quem implementa uma feature não é quem a avalia. Cada relatório em `docs/features/*/reports/` vem de um agente com contexto novo, contra o contrato, e não é editado depois do commit que o criou.

## Regras de entrega

Um projeto por repositório. Os pull requests da wave paralela permanecem visíveis no GitHub; as branches podem ser apagadas depois do merge.
