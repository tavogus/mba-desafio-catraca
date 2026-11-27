export function esc(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

export function field(label: string, name: string, value: string, type = 'text'): string {
  return `<label>${esc(label)}
    <input name="${esc(name)}" type="${esc(type)}" value="${esc(value)}" required>
  </label>`
}
