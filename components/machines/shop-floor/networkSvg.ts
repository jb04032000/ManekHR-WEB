/**
 * Shop Floor - shared CPM/PERT network drawing.
 *
 * What: lays the step DAG out in topological columns and renders it as an
 * SVG markup string. mode 'cpm' annotates ES/EF/LS/LF + critical flags;
 * mode 'pert' annotates O/M/P and tₑ/σ². Used by CpmView and PertView so the
 * two networks always look identical.
 *
 * Links: input comes from lib/shop-floor/cpm.ts; node clicks are delegated
 * via data-open="step:<orderId>:<stepId>" (handled by the host view).
 */

import type { CpmResult } from '@/lib/shop-floor/cpm';
import { art, STAGE, svgEsc, isStageKey } from '@/lib/shop-floor/stages';
import type { ShopFloorData } from './shared';
import { orderById } from './shared';

const W2 = 196;
const H2 = 158;
const GX2 = 70;
const GY2 = 32;
const PAD = 32;

export function netSvg(
  r: CpmResult,
  data: ShopFloorData,
  idSuffix: string,
  mode: 'cpm' | 'pert',
): { svg: string; W: number; H: number } {
  const cols: Record<number, CpmResult['ps']> = {};
  r.ps.forEach((p) => {
    (cols[p.lvl] = cols[p.lvl] || []).push(p);
  });
  Object.values(cols).forEach((c) => c.sort((a, b) => a.es - b.es));
  const maxRows = Math.max(1, ...Object.values(cols).map((c) => c.length));
  const xy: Record<string, { x: number; y: number }> = {};
  Object.entries(cols).forEach(([l, c]) => {
    const off = ((maxRows - c.length) * (H2 + GY2)) / 2;
    c.forEach((p, i) => {
      xy[p.id] = { x: PAD + Number(l) * (W2 + GX2), y: PAD + off + i * (H2 + GY2) };
    });
  });
  const W = PAD * 2 + (Math.max(...r.ps.map((p) => p.lvl)) + 1) * (W2 + GX2) - GX2;
  const H = PAD * 2 + maxRows * (H2 + GY2) - GY2 + 18;

  let e = '';
  let n = '';
  r.ps.forEach((p) =>
    p.deps.forEach((d) => {
      const a = xy[d];
      const b = xy[p.id];
      if (!a || !b) return;
      const crit = p.crit && r.byId[d]?.crit;
      const x1 = a.x + W2;
      const y1 = a.y + H2 / 2;
      const x2 = b.x;
      const y2 = b.y + H2 / 2;
      const mx = (x1 + x2) / 2;
      e += `<path class="sf-edge sf-edge-still ${crit ? 'sf-edge-crit' : ''}" stroke="${crit ? 'var(--cr-error)' : 'var(--cr-text-5)'}" marker-end="url(#sfm${idSuffix})" d="M${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}"/>`;
    }),
  );
  r.ps.forEach((p) => {
    const g = xy[p.id];
    const c = orderById(data, p.orderId)?.colorHex || '#888';
    const code = orderById(data, p.orderId)?.code ?? '';
    const st = STAGE[isStageKey(p.stage) ? p.stage : 'packing'];
    const top =
      mode === 'cpm'
        ? `<text class="sf-nm-num" x="12" y="17">ES ${p.es.toFixed(1)}</text><text class="sf-nm-num" x="${W2 - 12}" y="17" text-anchor="end">EF ${p.ef.toFixed(1)}</text>`
        : `<text class="sf-nm-num" x="${W2 / 2}" y="17" text-anchor="middle">O ${p.optimisticHrs} · M ${p.likelyHrs} · P ${p.pessimisticHrs}</text>`;
    const bot =
      mode === 'cpm'
        ? `<text class="sf-nm-num" x="12" y="${H2 - 9}" opacity=".75">LS ${p.ls.toFixed(1)}</text><text class="sf-nm-num" x="${W2 - 12}" y="${H2 - 9}" text-anchor="end" opacity=".75">LF ${p.lf.toFixed(1)}</text>
          ${p.crit ? `<text class="sf-nm-tag" x="${W2 / 2}" y="${H2 - 9}" fill="var(--cr-error)">★ critical</text>` : ''}`
        : `<text class="sf-nm-num" x="${W2 / 2}" y="${H2 - 9}" text-anchor="middle">tₑ ${p.te.toFixed(1)}h · σ² ${p.vr.toFixed(2)}</text>`;
    n += `<g class="sf-pnode ${p.crit ? 'sf-pnode-crit' : ''}" data-open="step:${p.orderId}:${p.id}" transform="translate(${g.x},${g.y})">
      <rect class="sf-plat" width="${W2}" height="${H2}" rx="14"/>${top}
      <g transform="translate(${W2 / 2 - 46},26) scale(.4)">${art(p.stage, c)}</g>
      <text class="sf-nm-title" x="${W2 / 2}" y="104" font-size="11.5">${svgEsc(p.name.length > 22 ? p.name.slice(0, 21) + '…' : p.name)}</text>
      <text class="sf-nm-sub" x="${W2 / 2}" y="119">${st.label} · ${svgEsc(code)}${mode === 'cpm' ? ' · slack ' + p.slack.toFixed(1) + 'h' : ''}</text>${bot}</g>`;
  });
  return {
    svg: `<defs><marker id="sfm${idSuffix}" markerWidth="9" markerHeight="9" refX="7.5" refY="4.5" orient="auto"><path d="M0 0 L9 4.5 L0 9 Z" fill="context-stroke"/></marker></defs>${e}${n}`,
    W,
    H,
  };
}
