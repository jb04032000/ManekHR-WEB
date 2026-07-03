/**
 * Shop Floor - Process tab (Visio-style route builder).
 *
 * What: per work order, shows a stencil rail (one tile per stage) and the
 * step DAG as draggable node cards. Click a stencil → open the step modal
 * pre-set to that stage; click ▸ out-port then ◂ in-port → link steps; click
 * an arrow → unlink. Node layout columns come from the CPM topological depth
 * unless a step has a persisted posX/posY.
 *
 * Links: steps/deps live on the WorkOrder (work-orders.actions). Node drag
 * positions persist on the step itself (posX/posY) so the whole team shares
 * one arrangement. CPM criticality (red outline) comes from
 * lib/shop-floor/cpm.ts.
 *
 * Watch: linking validates cycles client-side (wouldCycle) before calling
 * the BE, which re-validates (WORK_ORDER_STEP_CYCLE).
 */

'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Modal } from 'antd';
import { DsSelect, DsOption, DsButton } from '@/components/ui';
import type { WorkOrder } from '@/types';
import { cpmCalc, scopeSteps, wouldCycle } from '@/lib/shop-floor/cpm';
import { art, artIcon, STAGE, STENCIL_ORDER, svgEsc, type StageKey } from '@/lib/shop-floor/stages';
import { machineArtKind } from '@/lib/shop-floor/stages';
import { memberById, mid, orderById, type DetailTarget, type ShopFloorData } from './shared';
import { useSvgCanvas } from './useSvgCanvas';
import { CanvasZoomBar } from './CanvasZoomBar';

const NW = 252;
const NH = 212;
const GX = 92;
const GY = 44;
const PAD = 40;

interface ProcessViewProps {
  data: ShopFloorData;
  curOrderId: string | null;
  onOrderChange: (id: string) => void;
  unlocked: boolean;
  canManage: boolean;
  onOpenDetail: (t: DetailTarget) => void;
  onOpenStepModal: (orderId: string, stepId?: string, presetStage?: StageKey) => void;
  onLink: (orderId: string, srcId: string, dstId: string) => Promise<void>;
  onUnlink: (orderId: string, stepId: string, depId: string) => Promise<void>;
  onMoveStep: (orderId: string, stepId: string, x: number, y: number) => Promise<void>;
  onStandardRoute: (orderId: string) => Promise<void>;
}

export function ProcessView({
  data,
  curOrderId,
  onOrderChange,
  unlocked,
  canManage,
  onOpenDetail,
  onOpenStepModal,
  onLink,
  onUnlink,
  onMoveStep,
  onStandardRoute,
}: ProcessViewProps) {
  const [pendingFrom, setPendingFrom] = useState<string | null>(null);
  /** Optimistic node positions while dragging (cleared when data refreshes). */
  const [dragPos, setDragPos] = useState<Record<string, { x: number; y: number }>>({});

  const order: WorkOrder | undefined = curOrderId ? orderById(data, curOrderId) : undefined;

  // Reset transient canvas state when the order or its data changes -
  // render-time adjustment (React's sanctioned derived-state pattern).
  const [resetKey, setResetKey] = useState<{ orderId: string | null; orders: WorkOrder[] }>({
    orderId: curOrderId,
    orders: data.orders,
  });
  if (resetKey.orderId !== curOrderId || resetKey.orders !== data.orders) {
    setResetKey({ orderId: curOrderId, orders: data.orders });
    setDragPos({});
    setPendingFrom(null);
  }

  const cpm = useMemo(
    () => cpmCalc(scopeSteps(data.orders, curOrderId ?? 'NONE')),
    [data.orders, curOrderId],
  );

  // Column layout from topological depth; persisted/drag positions override.
  const positions = useMemo(() => {
    const cols: Record<number, typeof cpm.ps> = {};
    cpm.ps.forEach((p) => {
      (cols[p.lvl] = cols[p.lvl] || []).push(p);
    });
    Object.values(cols).forEach((c) =>
      c.sort((a, b) => a.es - b.es || a.name.localeCompare(b.name)),
    );
    const maxRows = Math.max(1, ...Object.values(cols).map((c) => c.length));
    const out: Record<string, { x: number; y: number }> = {};
    Object.entries(cols).forEach(([lvl, c]) => {
      const off = ((maxRows - c.length) * (NH + GY)) / 2;
      c.forEach((p, i) => {
        out[p.id] = dragPos[p.id] ?? {
          x: p.posX ?? PAD + Number(lvl) * (NW + GX),
          y: p.posY ?? PAD + off + i * (NH + GY),
        };
      });
    });
    return out;
  }, [cpm, dragPos]);

  const positionsRef = useRef(positions);
  useEffect(() => {
    positionsRef.current = positions;
  }, [positions]);

  const canvas = useSvgCanvas({
    unlocked: unlocked && canManage,
    getPos: (key) => positionsRef.current[key.split(':')[1]] ?? null,
    onDragMove: (key, x, y) => {
      const stepId = key.split(':')[1];
      setDragPos((prev) => ({ ...prev, [stepId]: { x, y } }));
    },
    onDragEnd: (key, x, y) => {
      const stepId = key.split(':')[1];
      if (curOrderId) void onMoveStep(curOrderId, stepId, x, y);
    },
  });

  const dims = useMemo(() => {
    const xs = Object.values(positions);
    if (!xs.length) return { W: 1000, H: 300 };
    return {
      W: Math.max(Math.max(...xs.map((p) => p.x)) + NW + PAD, 900),
      H: Math.max(Math.max(...xs.map((p) => p.y)) + NH + PAD + 20, 420),
    };
  }, [positions]);

  const { svgRef, viewBox, onPointerDown, setBase } = canvas;
  const wrapRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    setBase(dims.W, dims.H);
  }, [setBase, dims.W, dims.H]);

  const scene = useMemo(() => {
    if (!order || !cpm.ps.length) return null;
    const hex = order.colorHex || '#888';
    let edges = '';
    let nodes = '';

    for (const s of cpm.ps) {
      for (const d of s.deps) {
        const a = positions[d];
        const b = positions[s.id];
        if (!a || !b) continue;
        const crit = s.crit && cpm.byId[d]?.crit;
        const x1 = a.x + NW;
        const y1 = a.y + NH / 2;
        const x2 = b.x;
        const y2 = b.y + NH / 2;
        const mx = (x1 + x2) / 2;
        edges += `<path class="sf-edge ${crit ? 'sf-edge-crit' : ''}" data-skip-pan="1" data-unlink="${s.id}:${d}" stroke="${crit ? 'var(--cr-error)' : 'var(--cr-text-5)'}" marker-end="url(#sfpar)"
          d="M${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}"><title>unlink: ${svgEsc(cpm.byId[d].name)} → ${svgEsc(s.name)}</title></path>`;
      }
    }

    for (const s of cpm.ps) {
      const g = positions[s.id];
      if (!g) continue;
      const st = STAGE[(s.stage in STAGE ? s.stage : 'packing') as StageKey];
      const assignee = s.assigneeId ? memberById(data, s.assigneeId)?.name : null;
      const machineNames = s.machineIds
        .map((idx) => {
          const m = data.machines.find((mm) => mid(mm) === idx);
          return m ? m.machineCode || m.name : null;
        })
        .filter(Boolean)
        .join(' ∥ ');
      const para = s.deps.length > 1 ? '∥ ' : '';
      const te = ((s.optimisticHrs + 4 * s.likelyHrs + s.pessimisticHrs) / 6).toFixed(1);
      nodes += `<g class="sf-pnode ${s.crit ? 'sf-pnode-crit' : ''} ${s.progress >= 100 ? 'sf-pnode-done' : ''} ${pendingFrom === s.id ? 'sf-pnode-src' : ''}" data-drag="step:${s.id}" data-open="step:${s.id}" transform="translate(${g.x},${g.y})">
        <rect class="sf-plat" width="${NW}" height="${NH}" rx="18"/>
        <text class="sf-nm-tag" x="${NW / 2}" y="20" fill="${st.accent}">${para}${st.label}${s.crit ? '  ★' : ''}</text>
        <g transform="translate(${NW / 2 - 69},26) scale(.6)" opacity="${s.progress >= 100 ? 0.55 : 1}">${art(s.stage, hex)}</g>
        <text class="sf-nm-title" x="${NW / 2}" y="135">${svgEsc(s.name.length > 26 ? s.name.slice(0, 25) + '…' : s.name)}</text>
        <text class="sf-nm-sub" x="${NW / 2}" y="151">${svgEsc((machineNames || 'manual') + (assignee ? '  ·  ' + assignee : ''))}</text>
        <text class="sf-nm-sub" x="${NW / 2}" y="165">tₑ ${te}h · slack ${s.slack.toFixed(1)}h</text>
        <rect x="24" y="175" width="${NW - 48}" height="7" rx="3.5" fill="var(--cr-surface-2)" stroke="var(--cr-border)"/>
        <rect x="24" y="175" width="${((NW - 48) * s.progress) / 100}" height="7" rx="3.5" fill="${s.progress >= 100 ? 'var(--cr-success)' : hex}"/>
        <text class="sf-nm-sub" x="${NW / 2}" y="198" fill="${s.progress >= 100 ? 'var(--cr-success)' : s.progress > 0 ? hex : 'var(--cr-text-4)'}">${s.progress >= 100 ? '✓ done' : s.progress > 0 ? s.progress + '% running' : 'pending'}</text>
        ${s.deps.length === 0 ? `<text class="sf-start-chip" x="10" y="-8">▶ START</text>` : ''}
        ${
          canManage
            ? `<g class="sf-port" data-skip-pan="1" data-port="in:${s.id}"><circle cx="0" cy="${NH / 2}" r="8" fill="#0D9488" stroke="#fff"/><text x="0" y="${NH / 2 + 3}">◂</text><title>in - click after a ▸ to link</title></g>
        <g class="sf-port" data-skip-pan="1" data-port="out:${s.id}"><circle cx="${NW}" cy="${NH / 2}" r="8" fill="#D97706" stroke="#fff"/><text x="${NW}" y="${NH / 2 + 3}">▸</text><title>out - click to start a link</title></g>`
            : ''
        }
      </g>`;
    }

    return `<defs><marker id="sfpar" markerWidth="9" markerHeight="9" refX="7.5" refY="4.5" orient="auto"><path d="M0 0 L9 4.5 L0 9 Z" fill="context-stroke"/></marker></defs>${edges}${nodes}`;
  }, [order, cpm, positions, data, pendingFrom, canManage]);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (!order) return;
      const t = e.target as Element;
      const port = t.closest('[data-port]');
      if (port && canManage) {
        const [dir, id] = port.getAttribute('data-port')!.split(':');
        if (dir === 'out') {
          setPendingFrom((p) => (p === id ? null : id));
        } else if (pendingFrom && pendingFrom !== id) {
          const dst = order.steps.find((s) => s.id === id);
          if (dst?.deps.includes(pendingFrom)) {
            setPendingFrom(null);
            return;
          }
          if (wouldCycle(order.steps, pendingFrom, id)) {
            Modal.warning({
              title: 'That link would create a loop',
              content: 'A step cannot (indirectly) depend on itself.',
            });
            setPendingFrom(null);
            return;
          }
          const src = pendingFrom;
          setPendingFrom(null);
          void onLink(order.id, src, id);
        } else {
          setPendingFrom(null);
        }
        return;
      }
      const edge = t.closest('[data-unlink]');
      if (edge && canManage) {
        const [stepId, depId] = edge.getAttribute('data-unlink')!.split(':');
        const dep = order.steps.find((s) => s.id === depId);
        const step = order.steps.find((s) => s.id === stepId);
        Modal.confirm({
          title: 'Unlink steps?',
          content: `“${dep?.name ?? ''}” → “${step?.name ?? ''}” will no longer be in sequence.`,
          okText: 'Unlink',
          okButtonProps: { danger: true },
          onOk: () => onUnlink(order.id, stepId, depId),
        });
        return;
      }
      const open = t.closest('[data-open]');
      if (open) {
        const id = open.getAttribute('data-open')!.split(':')[1];
        onOpenDetail({ kind: 'step', orderId: order.id, stepId: id });
        return;
      }
      // Background click cancels a pending link.
      if (pendingFrom) setPendingFrom(null);
    },
    [order, pendingFrom, canManage, onLink, onUnlink, onOpenDetail],
  );

  const hint = pendingFrom
    ? `linking from “${order?.steps.find((s) => s.id === pendingFrom)?.name ?? ''}” - click a ◂ in-port to finish (or click the background to cancel)`
    : 'Click a stencil to add a step · click ▸ then ◂ to link · click an arrow to unlink · unlock layout to drag';

  return (
    <div>
      <div
        style={{
          display: 'flex',
          gap: 8,
          flexWrap: 'wrap',
          alignItems: 'center',
          padding: '2px 4px 10px',
        }}
      >
        <span className="sf-flabel">Order</span>
        <DsSelect
          aria-label="Select work order"
          style={{ width: 260 }}
          value={curOrderId ?? undefined}
          placeholder="Pick an order"
          onChange={(v) => onOrderChange(v as string)}
        >
          {data.orders.map((o) => (
            <DsOption key={o.id} value={o.id}>
              {o.code} - {o.partyName}
            </DsOption>
          ))}
        </DsSelect>
        {canManage && (
          <>
            <DsButton
              dsVariant="secondary"
              dsSize="sm"
              disabled={!order}
              onClick={() => order && onOpenStepModal(order.id)}
            >
              ＋ Step
            </DsButton>
            <DsButton
              dsVariant="secondary"
              dsSize="sm"
              disabled={!order || order.steps.length > 0}
              title={
                order && order.steps.length > 0
                  ? 'This order already has steps - add or edit them individually'
                  : 'Lay the full standard route in one click'
              }
              onClick={() => order && onStandardRoute(order.id)}
            >
              ✨ Standard route
            </DsButton>
          </>
        )}
        <span className="sf-hint">{hint}</span>
      </div>

      <div className="sf-proc-grid">
        <div className="sf-stencil">
          <div className="sf-st-label">Stencils - click to add</div>
          {STENCIL_ORDER.map((k) => {
            const st = STAGE[k];
            const n = st.station
              ? data.machines.filter((m) => machineArtKind(m.type) === k).length
              : null;
            return (
              <button
                key={k}
                type="button"
                className="sf-sttile"
                disabled={!order || !canManage}
                onClick={() => order && onOpenStepModal(order.id, undefined, k)}
              >
                <span dangerouslySetInnerHTML={{ __html: artIcon(k, st.accent) }} />
                <span className="sf-tl">{st.label}</span>
                <span className="sf-tc">
                  {st.station ? `${n} machine${n === 1 ? '' : 's'}` : 'manual'}
                </span>
              </button>
            );
          })}
        </div>
        <div className="sf-canvas-wrap" ref={wrapRef}>
          <CanvasZoomBar canvas={canvas} fullscreenTarget={wrapRef} />
          {scene ? (
            <svg
              ref={svgRef}
              viewBox={viewBox}
              style={{ height: '60vh' }}
              role="img"
              aria-label="Process flow"
              onPointerDown={onPointerDown}
              onClick={handleClick}
              dangerouslySetInnerHTML={{ __html: scene }}
            />
          ) : (
            <div className="sf-empty">
              {!order ? (
                <>No work orders yet - create one with ＋ Order above.</>
              ) : (
                <>
                  No steps for this order yet.
                  <br />
                  Click a <b>stencil</b> on the left (Design Prep, Marking, Embroidery…) or use{' '}
                  <b>✨ Standard route</b>.
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
