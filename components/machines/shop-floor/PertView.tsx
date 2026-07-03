/**
 * Shop Floor - PERT tab (three-point estimates + delivery probability).
 *
 * What: expected duration tₑ, σ risk window, an interactive "P(finish ≤
 * target)" calculator with the normal-curve drawing, the PERT-annotated
 * network and the O/M/P table. Same cpmCalc input as every other tab.
 *
 * Links: lib/shop-floor/cpm.ts (cpmCalc + normCdf) + networkSvg.ts.
 */

'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { InputNumber } from 'antd';
import { DsCard } from '@/components/ui';
import { cpmCalc, normCdf, scopeSteps } from '@/lib/shop-floor/cpm';
import { netSvg } from './networkSvg';
import { orderById, type DetailTarget, type ShopFloorData } from './shared';
import { useSvgCanvas } from './useSvgCanvas';
import { CanvasZoomBar } from './CanvasZoomBar';

export function PertView({
  data,
  filter,
  onOpenDetail,
}: {
  data: ShopFloorData;
  filter: string;
  onOpenDetail: (t: DetailTarget) => void;
}) {
  const r = useMemo(() => cpmCalc(scopeSteps(data.orders, filter)), [data.orders, filter]);
  const net = useMemo(() => (r.ps.length ? netSvg(r, data, 'p', 'pert') : null), [r, data]);
  const [target, setTarget] = useState<number | null>(null);

  // Default target tracks the scope until the user edits it.
  const effTarget = target ?? Math.ceil(r.dur + r.sigma);

  const canvas = useSvgCanvas();
  const { svgRef, viewBox, onPointerDown, setBase } = canvas;
  const wrapRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (net) setBase(net.W, net.H);
  }, [setBase, net]);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      const el = (e.target as Element).closest('[data-open]');
      if (!el) return;
      const [, orderId, stepId] = el.getAttribute('data-open')!.split(':');
      onOpenDetail({ kind: 'step', orderId, stepId });
    },
    [onOpenDetail],
  );

  if (!r.ps.length) {
    return <div className="sf-empty">No steps yet - build the route in the Process tab.</div>;
  }

  const prob =
    r.sigma < 1e-9 ? (effTarget >= r.dur ? 100 : 0) : normCdf((effTarget - r.dur) / r.sigma) * 100;
  const probColor =
    prob >= 80 ? 'var(--cr-success)' : prob >= 50 ? 'var(--cr-warning)' : 'var(--cr-error)';

  // Normal curve drawing (320×90 box).
  const curve = (() => {
    if (r.sigma < 1e-9) return null;
    const W = 320;
    const H = 90;
    const lo = r.dur - 3.2 * r.sigma;
    const hi = r.dur + 3.2 * r.sigma;
    const X = (v: number) => ((v - lo) / (hi - lo)) * W;
    const Y = (z: number) => H - 8 - Math.exp((-z * z) / 2) * 64;
    let pts = '';
    let fill = '';
    for (let i = 0; i <= 80; i++) {
      const v = lo + ((hi - lo) * i) / 80;
      const z = (v - r.dur) / r.sigma;
      pts += `${X(v).toFixed(1)},${Y(z).toFixed(1)} `;
      if (v <= effTarget) fill += `${X(v).toFixed(1)},${Y(z).toFixed(1)} `;
    }
    const tx = Math.max(0, Math.min(W, X(effTarget)));
    return { W, H, pts, fill, tx, mx: X(r.dur) };
  })();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="sf-cards">
        <div className="sf-card">
          <div className="sf-card-label">Scope</div>
          <div className="sf-card-value" style={{ fontSize: 15 }}>
            {filter === 'ALL' ? 'All orders' : (orderById(data, filter)?.code ?? 'Order')}
          </div>
          <small>three-point estimate per step</small>
        </div>
        <div className="sf-card">
          <div className="sf-card-label">Expected tₑ</div>
          <div className="sf-card-value">{r.dur.toFixed(1)} hr</div>
          <small>(O + 4M + P) ÷ 6 along critical path</small>
        </div>
        <div className="sf-card">
          <div className="sf-card-label">Std deviation σ</div>
          <div className="sf-card-value">±{r.sigma.toFixed(2)} hr</div>
          <small>√Σσ² of critical steps - the risk window</small>
        </div>
        <div className="sf-card">
          <div className="sf-card-label">Likely range</div>
          <div className="sf-card-value" style={{ fontSize: 15 }}>
            {(r.dur - r.sigma).toFixed(1)}–{(r.dur + r.sigma).toFixed(1)} hr
          </div>
          <small>≈ 68% of finishes land here</small>
        </div>
      </div>

      <DsCard>
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div>
            <div className="sf-card-label">Target duration (hrs)</div>
            <InputNumber
              aria-label="Target duration in hours"
              min={0}
              step={0.5}
              value={effTarget}
              onChange={(v) => setTarget(typeof v === 'number' ? v : null)}
            />
          </div>
          <div>
            <div className="sf-card-label">P(finish ≤ target)</div>
            <div
              style={{
                fontSize: 22,
                fontWeight: 700,
                fontVariantNumeric: 'tabular-nums',
                color: probColor,
              }}
            >
              {prob.toFixed(1)}%
            </div>
          </div>
          <div style={{ flex: 1, minWidth: 240 }}>
            <div className="sf-card-label">Probability curve</div>
            {curve ? (
              <svg
                viewBox={`0 0 ${curve.W} ${curve.H}`}
                style={{ width: '100%', maxWidth: 360, height: 90 }}
                aria-hidden
              >
                <polyline
                  points={`${0},${curve.H - 8} ${curve.fill} ${curve.tx},${curve.H - 8}`}
                  fill="var(--cr-success)"
                  opacity={0.25}
                />
                <polyline points={curve.pts} fill="none" stroke="#0D9488" strokeWidth={2} />
                <line
                  x1={curve.mx}
                  y1={14}
                  x2={curve.mx}
                  y2={curve.H - 8}
                  stroke="var(--cr-text-4)"
                  strokeDasharray="3 3"
                />
                <text x={curve.mx} y={12} textAnchor="middle" fontSize={8} fill="var(--cr-text-4)">
                  tₑ
                </text>
                <line
                  x1={curve.tx}
                  y1={6}
                  x2={curve.tx}
                  y2={curve.H - 8}
                  stroke="#D97706"
                  strokeWidth={1.6}
                />
                <text x={curve.tx} y={6} textAnchor="middle" fontSize={8} fill="#D97706">
                  T
                </text>
                <line
                  x1={0}
                  y1={curve.H - 8}
                  x2={curve.W}
                  y2={curve.H - 8}
                  stroke="var(--cr-border)"
                />
              </svg>
            ) : (
              <div style={{ color: 'var(--cr-text-4)', fontSize: 12 }}>
                σ = 0 (single fixed path)
              </div>
            )}
          </div>
          <div
            style={{ flexBasis: '100%', fontSize: 11, color: 'var(--cr-text-3)', lineHeight: 1.5 }}
          >
            Z = (Target − tₑ) ÷ σ on the normal curve. Check this before committing a delivery date
            to the party.
          </div>
        </div>
      </DsCard>

      <div className="sf-canvas-wrap" ref={wrapRef}>
        <CanvasZoomBar canvas={canvas} fullscreenTarget={wrapRef} />
        <svg
          ref={svgRef}
          viewBox={viewBox}
          style={{ height: '52vh' }}
          role="img"
          aria-label="PERT network"
          onPointerDown={onPointerDown}
          onClick={handleClick}
          dangerouslySetInnerHTML={{ __html: net?.svg ?? '' }}
        />
      </div>

      <DsCard noPad>
        <div style={{ overflowX: 'auto', padding: '8px 10px' }}>
          <table className="sf-ztable">
            <thead>
              <tr>
                <th>Step</th>
                <th>Order</th>
                <th>O</th>
                <th>M</th>
                <th>P</th>
                <th>tₑ</th>
                <th>σ²</th>
                <th>σ</th>
              </tr>
            </thead>
            <tbody>
              {r.ps
                .slice()
                .sort((a, b) => a.es - b.es)
                .map((p) => (
                  <tr
                    key={p.id}
                    className={p.crit ? 'sf-row-crit' : ''}
                    style={{ cursor: 'pointer' }}
                    onClick={() => onOpenDetail({ kind: 'step', orderId: p.orderId, stepId: p.id })}
                  >
                    <td>{p.name}</td>
                    <td>{orderById(data, p.orderId)?.code ?? ''}</td>
                    <td>{p.optimisticHrs}</td>
                    <td>{p.likelyHrs}</td>
                    <td>{p.pessimisticHrs}</td>
                    <td>{p.te.toFixed(2)}</td>
                    <td>{p.vr.toFixed(3)}</td>
                    <td>{Math.sqrt(p.vr).toFixed(2)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </DsCard>
    </div>
  );
}
