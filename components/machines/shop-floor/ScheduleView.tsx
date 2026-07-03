/**
 * Shop Floor - Schedule tab (machine-lane gantt).
 *
 * What: maps the CPM earliest start/finish of every step onto shift-hour
 * lanes - one lane per machine plus one "Hand stages" lane for manual steps.
 * Blocks carry the work-order colour; critical steps get the red inset ring.
 * Pure HTML/CSS (no canvas) - derived 100% from the CPM result, there is no
 * separate timeline dataset.
 *
 * Links: cpm from lib/shop-floor/cpm.ts; clicking a block opens the step in
 * the shared DetailDrawer.
 */

'use client';

import { useMemo } from 'react';
import { cpmCalc, scopeSteps } from '@/lib/shop-floor/cpm';
import {
  hhmm,
  locationById,
  mid,
  orderById,
  type DetailTarget,
  type ShopFloorData,
} from './shared';
import { machineArtKind, STAGE } from '@/lib/shop-floor/stages';

/** Default working window (hrs) - only affects axis day markers, not CPM. */
const SHIFT_START = 9;
const SHIFT_END = 18;

export function ScheduleView({
  data,
  filter,
  onOpenDetail,
}: {
  data: ShopFloorData;
  filter: string;
  onOpenDetail: (t: DetailTarget) => void;
}) {
  const r = useMemo(() => cpmCalc(scopeSteps(data.orders, filter)), [data.orders, filter]);

  if (!r.ps.length) {
    return (
      <div className="sf-empty">
        No steps in this view yet - build the route in the Process tab.
      </div>
    );
  }

  const dayLen = SHIFT_END - SHIFT_START;
  const dur = Math.max(r.dur, dayLen);
  const X = (t: number) => (t / dur) * 100;

  const hours: { left: number; label: string; day: boolean }[] = [];
  for (let t = 0; t <= dur; t += 1) {
    if (t % dayLen === 0)
      hours.push({ left: X(t), label: `Day ${Math.floor(t / dayLen) + 1}`, day: true });
    else if (t % 2 === 0 && dur < 40)
      hours.push({ left: X(t), label: hhmm(SHIFT_START + (t % dayLen)), day: false });
  }

  const lanes = data.machines
    .slice()
    .sort((a, b) => (a.locationId + a.name).localeCompare(b.locationId + b.name))
    .map((m) => ({
      key: mid(m),
      label: m.machineCode || m.name,
      sub: `${STAGE[machineArtKind(m.type)].label} · ${locationById(data, m.locationId)?.name ?? ''}`,
      blocks: r.ps.filter((s) => s.machineIds.includes(mid(m))),
    }))
    .filter((l) => l.blocks.length > 0);
  // Manual (no-machine) steps get ONE LANE PER ORDER - a single shared lane
  // makes concurrent orders overlap and hide each other.
  const manualLanes = data.orders
    .filter((o) => filter === 'ALL' || o.id === filter)
    .map((o) => ({
      key: `manual-${o.id}`,
      label: `Hand stages · ${o.code}`,
      sub: o.partyName,
      blocks: r.ps.filter((s) => s.orderId === o.id && !s.machineIds.length),
    }))
    .filter((l) => l.blocks.length > 0);

  const grid: number[] = [];
  for (let t = 1; t < dur; t++) grid.push(t);

  const renderLane = (label: string, sub: string, blocks: typeof r.ps, key: string) => (
    <div className="sf-s-row" key={key}>
      <div className="sf-s-label">
        {label} <small>{sub}</small>
      </div>
      <div className="sf-s-track">
        {grid.map((t) => (
          <div
            key={t}
            className={`sf-s-grid ${t % dayLen === 0 ? 'sf-s-grid-day' : ''}`}
            style={{ left: `${X(t)}%` }}
          />
        ))}
        {blocks.map((s) => {
          const o = orderById(data, s.orderId);
          const w = X(s.ef) - X(s.es);
          const faded = filter !== 'ALL' && s.orderId !== filter;
          return (
            <div
              key={s.id}
              className={`sf-s-blk ${s.crit ? 'sf-s-blk-crit' : ''}`}
              style={{
                left: `${X(s.es)}%`,
                width: `${w}%`,
                background: o?.colorHex || '#777',
                opacity: faded ? 0.15 : 1,
              }}
              title={`${s.name} · ${s.es.toFixed(1)}–${s.ef.toFixed(1)}h · ${o?.code ?? ''}`}
              onClick={() => onOpenDetail({ kind: 'step', orderId: s.orderId, stepId: s.id })}
            >
              {w > 6 ? s.name : ''}
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="sf-sched">
      <div className="sf-s-head">
        <div />
        <div className="sf-s-hours">
          {hours.map((h, i) => (
            <span key={i} className={h.day ? 'sf-s-dayl' : ''} style={{ left: `${h.left}%` }}>
              {h.label}
            </span>
          ))}
        </div>
      </div>
      {lanes.map((l) => renderLane(l.label, l.sub, l.blocks, l.key))}
      {manualLanes.map((l) => renderLane(l.label, l.sub, l.blocks, l.key))}
      <div className="sf-legend">
        {data.orders.map((o) => (
          <span key={o.id}>
            <i style={{ background: o.colorHex }} />
            {o.code} - {o.partyName}
          </span>
        ))}
        <span>
          <i
            style={{
              background: 'var(--cr-surface-2)',
              boxShadow: '0 0 0 1.6px var(--cr-error) inset',
            }}
          />
          critical step
        </span>
        <span>schedule = CPM earliest start/finish mapped onto {dayLen}-hour shifts</span>
      </div>
    </div>
  );
}
