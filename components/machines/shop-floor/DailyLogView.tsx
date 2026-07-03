/**
 * Shop Floor - Daily Log tab.
 *
 * What: every manual step entry (who logged, qty, progress, note) across the
 * scoped orders, newest first, grouped by day. This is the honest no-sensor
 * audit trail - wages and progress everywhere derive from these entries.
 *
 * Links: entries live inside WorkOrderStep.entries (work-orders module);
 * clicking a card opens that step in the shared DetailDrawer.
 */

'use client';

import { useMemo } from 'react';
import { scopeSteps } from '@/lib/shop-floor/cpm';
import { fmtTs, orderById, type DetailTarget, type ShopFloorData } from './shared';

interface FlatEntry {
  id: string;
  orderId: string;
  orderCode: string;
  hex: string;
  stepId: string;
  stepName: string;
  by: string;
  qty: number | null;
  progress: number | null;
  note?: string;
  at: string;
}

export function DailyLogView({
  data,
  filter,
  onOpenDetail,
}: {
  data: ShopFloorData;
  filter: string;
  onOpenDetail: (t: DetailTarget) => void;
}) {
  const days = useMemo(() => {
    const entries: FlatEntry[] = [];
    for (const s of scopeSteps(data.orders, filter)) {
      const o = orderById(data, s.orderId);
      for (const e of s.entries ?? []) {
        entries.push({
          id: e.id,
          orderId: s.orderId,
          orderCode: o?.code ?? '',
          hex: o?.colorHex ?? '#888',
          stepId: s.id,
          stepName: s.name,
          by: e.byName || 'someone',
          qty: e.qty,
          progress: e.progress,
          note: e.note,
          at: e.at,
        });
      }
    }
    entries.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
    const byDay = new Map<string, FlatEntry[]>();
    for (const e of entries) {
      const d = new Date(e.at);
      const k = isNaN(d.getTime())
        ? e.at
        : d.toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short' });
      const list = byDay.get(k);
      if (list) list.push(e);
      else byDay.set(k, [e]);
    }
    return [...byDay.entries()];
  }, [data, filter]);

  if (!days.length) {
    return (
      <div className="sf-empty">
        No manual entries yet.
        <br />
        Open any step → <b>＋ Log entry</b> to record qty, progress and who entered it.
      </div>
    );
  }

  return (
    <div style={{ padding: '4px 2px' }}>
      {days.map(([day, list]) => (
        <div key={day}>
          <div className="sf-log-day">{day}</div>
          {list.map((e) => (
            <div
              key={e.id}
              className="sf-log-card"
              style={{ borderLeftColor: e.hex }}
              onClick={() => onOpenDetail({ kind: 'step', orderId: e.orderId, stepId: e.stepId })}
            >
              <div className="sf-log-time">{fmtTs(e.at).split(',').pop()?.trim()}</div>
              <div className="sf-log-main">
                <b>{e.stepName}</b> · {e.orderCode}
                <small>
                  by {e.by}
                  {e.note ? ` - ${e.note}` : ''}
                </small>
              </div>
              <div className="sf-log-qty" style={{ color: e.hex }}>
                {e.qty != null ? `${e.qty} pcs` : ''}
                <br />
                <span style={{ color: 'var(--cr-text-4)', fontSize: 11 }}>
                  {e.progress != null ? `${e.progress}%` : ''}
                </span>
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
