// Gráfico de colunas em SVG, com 1 ou 2 séries. Toque, mouse ou teclado mostram o valor; sempre acompanha tabela.
// cols: [{ rotulo, dica, valores: [a, b?] }]   series: [{ nome, cor: 'a' | 'b' }]
import { esc } from './ui.js';

export function colunas(cols, { series, formato = String, aria = 'Gráfico' } = {}) {
  const ns = series.length, W = 640, H = 180, pe = 22, topo = 14;
  const max = Math.max(...cols.flatMap(c => c.valores), 0);
  if (!max) return '<p class="sub">Ainda não há dados neste período.</p>';
  const passo = W / cols.length;
  const larg = Math.max(3, Math.min(28, (passo - (cols.length > 14 ? 4 : 10) - (ns - 1) * 2) / ns));
  const cada = cols.length > 14 ? Math.ceil(cols.length / 6) : cols.length > 8 ? 2 : 1;
  const barra = (v, x, cls) => {
    if (!v) return '';
    const h = Math.max(3, (v / max) * (H - pe - topo)), y = H - pe - h, r = Math.min(4, larg / 2, h);
    return `<path class="gr-barra gr-${cls}" d="M${x},${H - pe}V${y + r}Q${x},${y} ${x + r},${y}H${x + larg - r}Q${x + larg},${y} ${x + larg},${y + r}V${H - pe}Z"/>`;
  };
  return `${ns > 1 ? `<div class="gr-legenda">${series.map(s => `<span><i class="gr-${s.cor}"></i>${esc(s.nome)}</span>`).join('')}</div>` : ''}
  <div class="graf gr" role="img" aria-label="${esc(aria)}" data-cols='${esc(JSON.stringify(cols.map(c => ({ d: c.dica, v: c.valores.map(formato) }))))}' data-series='${esc(JSON.stringify(series.map(s => s.nome)))}'>
    <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">
      <line class="graf-base" x1="0" x2="${W}" y1="${H - pe}" y2="${H - pe}"/>
      ${cols.map((c, i) => {
        const x0 = i * passo + (passo - (larg * ns + (ns - 1) * 2)) / 2;
        return `<g class="graf-col" data-i="${i}" tabindex="0">${c.valores.map((v, k) => barra(v, x0 + k * (larg + 2), series[k].cor)).join('')}<rect class="graf-alvo" x="${i * passo}" y="0" width="${passo}" height="${H - pe}"/></g>`;
      }).join('')}
    </svg>
    <div class="graf-eixo">${cols.map((c, i) => `<span>${i % cada === 0 || i === cols.length - 1 ? esc(c.rotulo) : ''}</span>`).join('')}</div>
    <span class="graf-pico" style="left:0;transform:none">máx. ${esc(formato(max))}</span>
    <div class="graf-dica" hidden></div>
  </div>
  <details class="graf-tabela"><summary>Ver em tabela</summary><table><tbody>
    ${ns > 1 ? `<tr><td></td>${series.map(s => `<td class="valor">${esc(s.nome)}</td>`).join('')}</tr>` : ''}
    ${cols.filter(c => c.valores.some(Boolean)).map(c => `<tr><td>${esc(c.dica)}</td>${c.valores.map(v => `<td class="valor">${esc(formato(v))}</td>`).join('')}</tr>`).join('')}
  </tbody></table></details>`;
}

// Liga as dicas de todos os gráficos dentro de `el`.
export function ligarDicas(el) {
  el.querySelectorAll('.gr').forEach(graf => {
    const cols = JSON.parse(graf.dataset.cols), series = JSON.parse(graf.dataset.series);
    const dica = graf.querySelector('.graf-dica');
    const mostrar = g => {
      const c = cols[+g.dataset.i];
      dica.innerHTML = (series.length > 1 ? c.v.map((v, k) => `<b>${esc(series[k])}: ${esc(v)}</b>`).join('') : `<b>${esc(c.v[0])}</b>`) + `<span>${esc(c.d)}</span>`;
      dica.hidden = false;
      dica.style.left = `clamp(80px, ${((+g.dataset.i + .5) / cols.length) * 100}%, calc(100% - 80px))`;
      graf.querySelectorAll('.graf-col').forEach(x => x.classList.toggle('foco', x === g));
    };
    graf.querySelectorAll('.graf-col').forEach(g => {
      g.addEventListener('pointerenter', () => mostrar(g));
      g.addEventListener('click', () => mostrar(g));
      g.addEventListener('focus', () => mostrar(g));
    });
    graf.addEventListener('pointerleave', () => { dica.hidden = true; graf.querySelectorAll('.graf-col').forEach(x => x.classList.remove('foco')); });
  });
}
