# AGENTS.md

Porta de entrada de quem for implementar, avaliar ou corrigir a Catraca. Leia este arquivo antes de editar código.

## Comandos

Na raiz do repositório:

```bash
./scripts/up.sh      # sobe Postgres + aplicação, migra e carrega a seed
./scripts/down.sh    # encerra tudo o que a subida iniciou
./scripts/gates.sh   # roda os testes automatizados
```

O modo padrão da subida usa o gateway simulado (`GATEWAY_DELAY_FACTOR=1`). Os gates passam `GATEWAY_DELAY_FACTOR=0` e um banco separado (`catraca_test`). Não use chave de pagamento: não existe gateway real.

## Regras do projeto

- As regras de negócio são R01–R13 no [brief do PRD](docs/prd.md). Critério de aceite cita a regra. Não invente comportamento fora do PRD.
- Ocupação é ingresso `pending` + `confirmed`. Vaga disponível é lotação menos ocupação; evento cancelado tem zero. Compra sem vaga não cria ingresso.
- A compra responde sem esperar o gateway. Resposta tardia do gateway só altera ingresso que ainda está `pending`.
- Cancelar evento publicado é irreversível e liquida os ingressos na mesma transação da trava do evento.
- Check-in segue a ordem do PRD, da primeira condição verdadeira.
- Organizador só vê e opera os próprios eventos. Participante e visitante não recebem dados da gestão.
- A API de parceiros tem contrato fixo: campos, status HTTP e códigos de erro. Toda rota exige `X-Api-Key`.
- Não registre cartão em log. Não altere um relatório de avaliação depois que ele foi commitado.
- A wave 4 (F04, F05, F06) não compartilha arquivo. API em `src/partner`, vitrine em `src/storefront`, gestão em `src/organizer`.

## Mapa dos artefatos

| Artefato | Caminho |
| --- | --- |
| PRD | `docs/prd.md` |
| Estado | `docs/state.json` |
| Features | `docs/features/F01-identidade` … `F06-gestao` |
| Spec, plano, contrato | dentro da pasta da feature |
| Relatórios | `docs/features/<feature>/reports/` |
| Código | `src/` |
| Testes | `tests/` |
| Migrations | `migrations/` |
| Subida, descida, gates | `scripts/up.sh`, `scripts/down.sh`, `scripts/gates.sh` |

Credenciais da seed e endereços estão no [README](README.md).
