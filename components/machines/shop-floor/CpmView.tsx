/**
 * Shop Floor - CPM tab (critical path method).
 *
 * What: summary cards (duration, critical step count, the path itself), the
 * network diagram (shared netSvg) and the full ES/EF/LS/LF/slack table -
 * all derived from the same cpmCalc result every other tab uses.
 *
 * Links: lib/shop-floor/cpm.ts + networkSvg.ts; node/row clicks open the
 * step in the shared DetailDrawer.
 */

'use client';

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { DsCard } from '@/components/ui';
import { cpmCalc, scopeSteps } from '@/lib/shop-floor/cpm';
import { netSvg } from './networkSvg';
import { orderById, type DetailTarget, type ShopFloorData } from './shared';
import { useSvgCanvas } from './useSvgCanvas';
import { CanvasZoomBar } from './CanvasZoomBar';

export function CpmView({
  data,
  filter,
  onOpenDetail,
}: {
  data: ShopFloorData;
  filter: string;
  onOpenDetail: (t: DetailTarget) => void;
}) {
  const r = useMemo(() => cpmCalc(scopeSteps(data.orders, filter)), [data.orders, filter]);
  const net = useMemo(() => (r.ps.length ? netSvg(r, data, 'c', 'cpm') : null), [r, data]);

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

  const crit = r.ps.filter((p) => p.crit).sort((a, b) => a.es - b.es);
  const scopeLabel = filter === 'ALL' ? 'All orders' : (orderById(data, filter)?.code ?? 'Order');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="sf-cards">
        <div className="sf-card">
          <div className="sf-card-label">Scope</div>
          <div className="sf-card-value" style={{ fontSize: 15 }}>
            {scopeLabel}
          </div>
          <small>pick an order chip on top to focus</small>
        </div>
        <div className="sf-card">
          <div className="sf-card-label">Project duration</div>
          <div className="sf-card-value" style={{ color: 'var(--cr-error)' }}>
            {r.dur.toFixed(1)} hr
          </div>
          <small>length of the critical path</small>
        </div>
        <div className="sf-card">
          <div className="sf-card-label">Critical steps</div>
          <div className="sf-card-value">{crit.length}</div>
          <small>zero slack - any delay slips delivery</small>
        </div>
        <div className="sf-card">
          <div className="sf-card-label">Critical path</div>
          <div
            className="sf-card-value"
            style={{ fontSize: 12, lineHeight: 1.6, fontFamily: 'inherit' }}
          >
            {crit.length
              ? crit.map((p, i) => (
                  <span key={p.id}>
                    {i > 0 && ' → '}
                    {p.name}{' '}
                    <span style={{ color: 'var(--cr-text-4)' }}>
                      ({orderById(data, p.orderId)?.code ?? ''})
                    </span>
                  </span>
                ))
              : '-'}
          </div>
        </div>
      </div>

      <div className="sf-canvas-wrap" ref={wrapRef}>
        <CanvasZoomBar canvas={canvas} fullscreenTarget={wrapRef} />
        <svg
          ref={svgRef}
          viewBox={viewBox}
          style={{ height: '52vh' }}
          role="img"
          aria-label="CPM network"
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
                <th>tₑ</th>
                <th>ES</th>
                <th>EF</th>
                <th>LS</th>
                <th>LF</th>
                <th>Slack</th>
                <th>Prog</th>
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
                    <td>{p.te.toFixed(1)}</td>
                    <td>{p.es.toFixed(1)}</td>
                    <td>{p.ef.toFixed(1)}</td>
                    <td>{p.ls.toFixed(1)}</td>
                    <td>{p.lf.toFixed(1)}</td>
                    <td>{p.slack.toFixed(1)}</td>
                    <td>{p.progress}%</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </DsCard>
    </div>
  );
}
