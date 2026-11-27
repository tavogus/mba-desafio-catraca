# F01 — Spec

## Decisão

Sessão opaca no Postgres, cookie `catraca_session` assinado, httpOnly, SameSite=Lax, 7 dias. Senha com scrypt. O cadastro só insere `role = participant`. Organizador e chave de parceiro nascem em `seed()` e o `ON CONFLICT` torna a seed idempotente.

A guarda `requireOrganizer` roda antes de ler o evento. Sem sessão, redireciona para `/entrar`. Com sessão de participante, responde 403 com o texto "Acesso restrito a organizadores" e sem dados do evento.

## Modelo

`users` (id, name, email, password_hash, role), `sessions`, `partner_keys`. E-mail guardado em minúsculas.

## Credenciais

Definidas uma vez em `src/auth/session.ts` (`SEED`) e copiadas no README.
