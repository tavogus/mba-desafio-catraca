# F03 — Plano

1. Tabela `tickets` com status, código único, preço da compra e prazo do gateway.
2. Compra transacional com `FOR UPDATE`.
3. Worker que só promove `pending`.
4. Cancelamento, check-in e painel no mesmo domínio.
5. Testes de ocupação, recusa, rajada repetida, preço, liquidação e janela de atraso, incluindo um cartão rápido no relógio real.
