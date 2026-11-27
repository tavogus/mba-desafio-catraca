import type { User } from '../auth/session.js'
import { esc } from './html.js'

export function layout(options: { title: string; user: User | null; body: string }): string {
  const { user } = options
  const links = [`<a href="/">Vitrine</a>`]
  if (user?.role === 'participant') links.push(`<a href="/meus-ingressos">Meus ingressos</a>`)
  if (user?.role === 'organizer') links.push(`<a href="/organizador">Meus eventos</a>`)
  if (user) {
    links.push(`<span>${esc(user.name)}</span>`)
    links.push(`<form method="post" action="/sair"><button type="submit">Sair</button></form>`)
  } else {
    links.push(`<a href="/entrar">Entrar</a>`)
    links.push(`<a href="/cadastro">Criar conta</a>`)
  }
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(options.title)} · Catraca</title>
  <style>
    :root { color-scheme: light; }
    body { margin: 0; font: 16px/1.5 system-ui, sans-serif; background: #f6f3ee; color: #1f1a17; }
    header, main { max-width: 880px; margin: 0 auto; padding: 1rem 1.25rem; }
    header { display: flex; justify-content: space-between; gap: 1rem; align-items: center; flex-wrap: wrap; }
    nav { display: flex; gap: 0.75rem; align-items: center; flex-wrap: wrap; }
    a { color: #0f6e56; }
    h1 { font-size: 1.7rem; line-height: 1.2; margin-bottom: 0.4rem; }
    label { display: block; margin: 0.8rem 0; font-weight: 600; }
    input { display: block; width: min(100%, 28rem); margin-top: 0.3rem; padding: 0.55rem 0.65rem; font: inherit; box-sizing: border-box; }
    button, .button { font: inherit; padding: 0.5rem 0.85rem; background: #0f6e56; color: white; border: 0; border-radius: 6px; cursor: pointer; text-decoration: none; display: inline-block; }
    button.secondary { background: transparent; color: #0f6e56; }
    nav button { background: transparent; color: #0f6e56; padding: 0; }
    .card { background: white; border: 1px solid #e4ddd4; border-radius: 12px; padding: 1rem 1.1rem; margin: 0.8rem 0; }
    .error { color: #9f1239; font-weight: 600; }
    .notice { background: #e7f5ef; padding: 0.7rem 0.85rem; border-radius: 8px; }
    .metric { font-size: 1.15rem; margin: 0.2rem 0; }
    form.inline { display: inline; }
    fieldset { border: 0; padding: 0; margin: 0; }
    fieldset:disabled { opacity: 0.7; }
    table { width: 100%; border-collapse: collapse; background: white; }
    th, td { text-align: left; padding: 0.55rem 0.4rem; border-bottom: 1px solid #e4ddd4; vertical-align: top; }
    code { font-size: 1.05rem; }
  </style>
</head>
<body>
  <header>
    <a href="/"><strong>Catraca</strong></a>
    <nav>${links.join('')}</nav>
  </header>
  <main>${options.body}</main>
</body>
</html>`
}
