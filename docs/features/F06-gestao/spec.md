# F06 — Spec

## Decisão

A página `/organizador/eventos/{id}` passa a mostrar painel, check-in e cancelamento sem mudar a URL que F02 já entregou. Os números vêm de `getDashboard`. O check-in chama `checkIn` e redireciona com a mensagem na query, filtrada pela lista fechada de R10. Cancelar chama `cancelPublishedEvent`.

Textos visíveis, cada um numa linha só:

- Confirmados, Pendentes, Check-ins, Vagas disponíveis, Receita, Estornados
- Receita no formato `R$ 350,00`
- Check-in: os cinco textos exatos de R10
- Evento cancelado também fica na página no lugar de confiar só no resultado do formulário

Evento cancelado desabilita o formulário e esconde "Salvar alterações" e "Publicar". O POST de edição continua recusado no servidor. Outro organizador, participante e visitante não recebem o nome nem o código.
