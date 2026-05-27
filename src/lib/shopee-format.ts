const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const pct = new Intl.NumberFormat('pt-BR', { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 })
const num = new Intl.NumberFormat('pt-BR')
const pct2 = new Intl.NumberFormat('pt-BR', { style: 'percent', minimumFractionDigits: 2, maximumFractionDigits: 2 })

export function fmtBRL(v: number | null | undefined): string {
  if (v == null || isNaN(v)) return 'R$ 0,00'
  return brl.format(v)
}

export function fmtPct(v: number | null | undefined, decimals: 1 | 2 = 1): string {
  if (v == null || isNaN(v)) return '0,0%'
  return decimals === 2 ? pct2.format(v) : pct.format(v)
}

export function fmtInt(v: number | null | undefined): string {
  if (v == null || isNaN(v)) return '0'
  return num.format(v)
}

export function fmtDateRange(start: string | null, end: string | null): string {
  if (!start) return ''
  if (!end || start === end) return start
  return `${start} ~ ${end}`
}
