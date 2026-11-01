export function moeda(centavos) {
  const v = (Number(centavos) || 0) / 100;
  return 'R$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
export function lerNumero(texto) {
  const t = String(texto ?? '').trim();
  if (!t) return NaN;
  const limpo = t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t;
  return Number(limpo);
}
export function data(iso) {
  const [a, m, d] = String(iso).slice(0, 10).split('-');
  return `${d}/${m}/${a}`;
}
// Data de hoje no fuso do aparelho, como "2026-11-01".
export function hojeISO(agora = new Date()) {
  return new Date(agora.getTime() - agora.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}
export function soDigitos(texto) { return String(texto ?? '').replace(/\D/g, ''); }
export function telefoneWa(texto) {
  const d = soDigitos(texto);
  return d.startsWith('55') && d.length >= 12 ? d : '55' + d;
}
