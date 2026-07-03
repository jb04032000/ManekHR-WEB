/**
 * Shop Floor - shared detail drawer (machine / person / order / step).
 *
 * What: one right-hand drawer for everything clickable on the floor and the
 * networks. Machine: live status (+ open downtime), quick status change and
 * location move via the EXISTING machines module actions, steps served.
 * Person: their steps + earned wages from logged entries. Order: value /
 * wages / progress / critical path + edit/archive. Step: full CPM/PERT
 * numbers, the manual entry log and the ＋ Log entry form.
 *
 * Links: machine mutations → machines.actions updateMachine (no parallel
 * machine store); step/order mutations → work-orders.actions via page
 * callbacks. Entry "who" is the authenticated user (BE snapshots the name).
 *
 * Watch: AntD v6 - Drawer uses `size`, not `width`.
 */

'use client';

import { useMemo, useState } from 'react';
import { Drawer, Input, InputNumber, Popconfirm } from 'antd';
import { DsButton, DsSelect, DsOption, DsTag } from '@/components/ui';
import type { CreateWorkOrderStepEntryPayload, MachineStatus } from '@/types';
import { cpmCalc, scopeSteps, stepQty, stepWages } from '@/lib/shop-floor/cpm';
import { fmtINR, isStageKey, STAGE } from '@/lib/shop-floor/stages';
import {
  FLOOR_STATE_LABEL,
  floorsOfLocation,
  fmtTs,
  lid,
  locationById,
  machineById,
  machineFloor,
  machineFloorState,
  memberById,
  mid,
  orderById,
  UNASSIGNED_FLOOR,
  type DetailTarget,
  type ShopFloorData,
} from './shared';

interface DetailDrawerProps {
  target: DetailTarget | null;
  data: ShopFloorData;
  canManage: boolean;
  busy: boolean;
  onClose: () => void;
  onOpenDetail: (t: DetailTarget) => void;
  // step actions
  onEditStep: (orderId: string, stepId: string) => void;
  onDeleteStep: (orderId: string, stepId: string) => void;
  onAddEntry: (
    orderId: string,
    stepId: string,
    payload: CreateWorkOrderStepEntryPayload,
  ) => Promise<void>;
  onDeleteEntry: (orderId: string, stepId: string, entryId: string) => void;
  // order actions
  onEditOrder: (orderId: string) => void;
  onDeleteOrder: (orderId: string) => void;
  onShowInProcess: (orderId: string) => void;
  // machine actions (existing machines module)
  onMachineStatus: (machineId: string, status: MachineStatus) => void;
  onMachineMove: (machineId: string, locationId: string) => void;
  /** Set the machine's floor within its location (Machine.floorTag). */
  onMachineFloorTag: (machineId: string, floorTag: string) => void;
}

function Row({ k, v }: { k: React.ReactNode; v: React.ReactNode }) {
  return (
    <div className="sf-d-row">
      <span>{k}</span>
      <b>{v}</b>
    </div>
  );
}

export function DetailDrawer(props: DetailDrawerProps) {
  const { target, data, canManage, busy, onClose, onOpenDetail } = props;

  // ＋ Log entry form state (step drawer only).
  const [eQty, setEQty] = useState<number | null>(null);
  const [eProg, setEProg] = useState<number | null>(null);
  const [eNote, setENote] = useState('');

  const title = useMemo(() => {
    if (!target) return '';
    if (target.kind === 'machine') return machineById(data, target.id)?.name ?? 'Machine';
    if (target.kind === 'person') return memberById(data, target.id)?.name ?? 'Team member';
    if (target.kind === 'order') {
      const o = orderById(data, target.id);
      return o ? `${o.code} - ${o.partyName}` : 'Order';
    }
    const o = orderById(data, target.orderId);
    return o?.steps.find((s) => s.id === target.stepId)?.name ?? 'Step';
  }, [target, data]);

  let body: React.ReactNode = null;

  if (target?.kind === 'machine') {
    const m = machineById(data, target.id);
    if (m) {
      const id = mid(m);
      const state = machineFloorState(data, m);
      const dt = data.openDowntime.get(id);
      const served = scopeSteps(data.orders, 'ALL').filter((s) => s.machineIds.includes(id));
      body = (
        <>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
            <DsTag
              status={state === 'breakdown' ? 'absent' : m.status}
              label={FLOOR_STATE_LABEL[state]}
            />
            <DsTag label={locationById(data, m.locationId)?.name ?? '-'} />
            {m.machineCode && <DsTag label={m.machineCode} />}
          </div>
          {dt && (
            <div className="sf-warn-box">
              ⚠ Downtime open since {fmtTs(dt.startAt)} - {dt.reasonLabelSnapshot}. Close it from
              the machine page to mark this machine running again.
            </div>
          )}
          <div className="sf-d-sub">Steps served (from process)</div>
          {served.length ? (
            served.map((s) => (
              <div
                key={s.id}
                className="sf-d-row"
                style={{ cursor: 'pointer' }}
                onClick={() => onOpenDetail({ kind: 'step', orderId: s.orderId, stepId: s.id })}
              >
                <span>
                  {s.name} · {orderById(data, s.orderId)?.code}
                </span>
                <b style={{ color: orderById(data, s.orderId)?.colorHex }}>{s.progress}%</b>
              </div>
            ))
          ) : (
            <div className="sf-note">
              Not attached to any step - add it to a step in the Process tab.
            </div>
          )}
          {canManage && (
            <>
              <div className="sf-d-sub">Manage (machines module)</div>
              <Row
                k="Status"
                v={
                  <DsSelect
                    aria-label="Machine status"
                    size="small"
                    style={{ width: 150 }}
                    value={m.status}
                    onChange={(v) => props.onMachineStatus(id, v as MachineStatus)}
                  >
                    <DsOption value="active">Active</DsOption>
                    <DsOption value="idle">Idle</DsOption>
                    <DsOption value="maintenance">Maintenance</DsOption>
                  </DsSelect>
                }
              />
              {(() => {
                // Floor select - floors of this machine's location (Setup
                // wizard ∪ floorTags). Writes Machine.floorTag.
                const floors = floorsOfLocation(data, m.locationId).filter(
                  (f) => f !== UNASSIGNED_FLOOR,
                );
                const cur = machineFloor(m);
                return floors.length ? (
                  <Row
                    k="Floor"
                    v={
                      <DsSelect
                        aria-label="Machine floor"
                        size="small"
                        style={{ width: 170 }}
                        value={cur === UNASSIGNED_FLOOR ? '' : cur}
                        onChange={(v) => props.onMachineFloorTag(id, v as string)}
                      >
                        <DsOption value="">- unassigned</DsOption>
                        {floors.map((f) => (
                          <DsOption key={f} value={f}>
                            {f}
                          </DsOption>
                        ))}
                      </DsSelect>
                    }
                  />
                ) : null;
              })()}
              <Row
                k="Move to location"
                v={
                  <DsSelect
                    aria-label="Move machine to location"
                    size="small"
                    style={{ width: 170 }}
                    value={m.locationId}
                    onChange={(v) => props.onMachineMove(id, v as string)}
                  >
                    {data.locations.map((l) => (
                      <DsOption key={lid(l)} value={lid(l)}>
                        {l.name}
                      </DsOption>
                    ))}
                  </DsSelect>
                }
              />
            </>
          )}
          <DsButton
            dsVariant="secondary"
            block
            style={{ marginTop: 14 }}
            href={`/dashboard/machines/${id}`}
          >
            Open machine page - logs, downtime, maintenance
          </DsButton>
        </>
      );
    }
  }

  if (target?.kind === 'person') {
    const t = memberById(data, target.id);
    if (t) {
      const steps = scopeSteps(data.orders, 'ALL').filter((s) => s.assigneeId === t.id);
      const earned = steps.reduce((acc, s) => acc + stepWages(s), 0);
      body = (
        <>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
            {t.designation && <DsTag label={t.designation} />}
            <DsTag
              status={t.isActive ? 'active' : 'inactive'}
              label={t.isActive ? 'Active' : 'Inactive'}
            />
          </div>
          {steps.length > 0 && (
            <>
              <div className="sf-d-sub">Works on</div>
              {steps.map((s) => (
                <div
                  key={s.id}
                  className="sf-d-row"
                  style={{ cursor: 'pointer' }}
                  onClick={() => onOpenDetail({ kind: 'step', orderId: s.orderId, stepId: s.id })}
                >
                  <span>
                    {s.name} · {orderById(data, s.orderId)?.code}
                  </span>
                  <b>{fmtINR(stepWages(s))}</b>
                </div>
              ))}
            </>
          )}
          <Row k={<b>Earned (from logged qty)</b>} v={fmtINR(earned)} />
          <DsButton dsVariant="secondary" block style={{ marginTop: 14 }} href="/dashboard/team">
            Open in Team
          </DsButton>
        </>
      );
    }
  }

  if (target?.kind === 'order') {
    const o = orderById(data, target.id);
    if (o) {
      const r = cpmCalc(scopeSteps([o], 'ALL'));
      const wages = o.steps.reduce((t, s) => t + stepWages(s), 0);
      const prog = o.steps.length
        ? o.steps.reduce((t, s) => t + s.progress, 0) / o.steps.length
        : 0;
      body = (
        <>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
            <DsTag
              label={`${o.productType || 'custom'} · ${o.qty} pcs · ₹${o.ratePerUnit}/u`}
              style={{ color: o.colorHex, borderColor: o.colorHex }}
            />
            <DsTag status={o.status === 'active' ? 'active' : 'inactive'} label={o.status} />
          </div>
          <Row k="Order value" v={fmtINR(o.qty * o.ratePerUnit)} />
          <Row k="Wages so far" v={fmtINR(wages)} />
          <Row k="Progress" v={<span style={{ color: o.colorHex }}>{prog.toFixed(0)}%</span>} />
          <Row k="Steps in route" v={o.steps.length} />
          <Row k="Critical path" v={`${r.dur.toFixed(1)} hr`} />
          <DsButton
            dsVariant="secondary"
            block
            style={{ marginTop: 14 }}
            onClick={() => props.onShowInProcess(o.id)}
          >
            ✎ Open route in Process
          </DsButton>
          {canManage && (
            <>
              <DsButton
                dsVariant="secondary"
                block
                style={{ marginTop: 8 }}
                onClick={() => props.onEditOrder(o.id)}
              >
                Edit order details
              </DsButton>
              <Popconfirm
                title={`Delete ${o.code} and its steps?`}
                description="Logged entries on its steps are removed with it."
                okText="Delete"
                okButtonProps={{ danger: true }}
                onConfirm={() => props.onDeleteOrder(o.id)}
              >
                <DsButton
                  dsVariant="ghost"
                  block
                  style={{ marginTop: 8, color: 'var(--cr-error)' }}
                >
                  🗑 Delete order
                </DsButton>
              </Popconfirm>
            </>
          )}
        </>
      );
    }
  }

  if (target?.kind === 'step') {
    const o = orderById(data, target.orderId);
    const s = o?.steps.find((x) => x.id === target.stepId);
    if (o && s) {
      const r = cpmCalc(scopeSteps([o], 'ALL'));
      const c = r.byId[s.id];
      const st = STAGE[isStageKey(s.stage) ? s.stage : 'packing'];
      const machines = s.machineIds
        .map((idx) => {
          const m = data.machines.find((mm) => mid(mm) === idx);
          return m ? m.machineCode || m.name : null;
        })
        .filter(Boolean)
        .join(' ∥ ');
      const depNames =
        s.deps
          .map((d) => o.steps.find((x) => x.id === d)?.name)
          .filter(Boolean)
          .join(', ') || 'Start (no dependency)';
      const entries = (s.entries ?? []).slice().reverse();
      body = (
        <>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
            <DsTag label={o.code} style={{ color: o.colorHex, borderColor: o.colorHex }} />
            <DsTag label={st.label} style={{ color: st.accent, borderColor: st.accent }} />
            {c?.crit && <DsTag status="absent" label="★ critical" />}
          </div>
          <Row k="Machine(s)" v={machines || 'manual'} />
          <Row k="Karigar" v={s.assigneeId ? (memberById(data, s.assigneeId)?.name ?? '-') : '-'} />
          <Row
            k="Depends on"
            v={<span style={{ fontSize: 11, textAlign: 'right' }}>{depNames}</span>}
          />
          <Row
            k="O / M / P (hrs)"
            v={`${s.optimisticHrs} / ${s.likelyHrs} / ${s.pessimisticHrs}`}
          />
          <Row k="Wage rate" v={`₹${s.wageRate}/pc`} />
          {c && (
            <>
              <Row
                k="tₑ · ES→EF"
                v={`${c.te.toFixed(1)}h · ${c.es.toFixed(1)}→${c.ef.toFixed(1)}`}
              />
              <Row
                k="Slack"
                v={
                  <span style={{ color: c.crit ? 'var(--cr-error)' : 'var(--cr-success)' }}>
                    {c.slack.toFixed(1)} hr
                  </span>
                }
              />
            </>
          )}
          <Row k="Qty logged / wages" v={`${stepQty(s)} pcs · ${fmtINR(stepWages(s))}`} />
          <Row
            k="Progress"
            v={
              <span style={{ color: s.progress >= 100 ? 'var(--cr-success)' : o.colorHex }}>
                {s.progress}%
              </span>
            }
          />

          <div className="sf-d-sub">Entry log - manual (no sensors)</div>
          {entries.length ? (
            entries.map((e) => (
              <div key={e.id} className="sf-logitem">
                <div className="sf-logitem-h">
                  <span style={{ fontWeight: 700 }}>{e.byName || 'someone'}</span>
                  <span className="sf-logitem-ts">
                    {fmtTs(e.at)}{' '}
                    {canManage && (
                      <Popconfirm
                        title="Remove this entry?"
                        okText="Remove"
                        okButtonProps={{ danger: true }}
                        onConfirm={() => props.onDeleteEntry(o.id, s.id, e.id)}
                      >
                        <button type="button" className="sf-x" aria-label="Delete entry">
                          ✕
                        </button>
                      </Popconfirm>
                    )}
                  </span>
                </div>
                <div className="sf-logitem-q">
                  {e.qty != null ? `${e.qty} pcs` : ''}{' '}
                  {e.progress != null ? `· ${e.progress}%` : ''}
                </div>
                {e.note && (
                  <div className="sf-note" style={{ margin: '2px 0 0' }}>
                    {e.note}
                  </div>
                )}
              </div>
            ))
          ) : (
            <div className="sf-note">No entries yet.</div>
          )}

          {canManage && (
            <div className="sf-logform">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div>
                  <div className="sf-modal-label">Qty done (pcs)</div>
                  <InputNumber
                    aria-label="Qty done"
                    min={0}
                    value={eQty}
                    onChange={(v) => setEQty(v ?? null)}
                    style={{ width: '100%' }}
                    placeholder="e.g. 40"
                  />
                </div>
                <div>
                  <div className="sf-modal-label">Progress %</div>
                  <InputNumber
                    aria-label="Progress percent"
                    min={0}
                    max={100}
                    value={eProg ?? s.progress}
                    onChange={(v) => setEProg(v ?? null)}
                    style={{ width: '100%' }}
                  />
                </div>
              </div>
              <div className="sf-modal-label">Note (optional)</div>
              <Input
                value={eNote}
                maxLength={200}
                placeholder="thread change, 30 min idle…"
                onChange={(e) => setENote(e.target.value)}
              />
              <DsButton
                dsVariant="primary"
                block
                loading={busy}
                style={{ marginTop: 10 }}
                onClick={async () => {
                  await props.onAddEntry(o.id, s.id, {
                    qty: eQty,
                    progress: eProg ?? s.progress,
                    note: eNote.trim() || undefined,
                  });
                  setEQty(null);
                  setEProg(null);
                  setENote('');
                }}
              >
                ＋ Log entry - logged as you
              </DsButton>
            </div>
          )}

          {canManage && (
            <>
              <DsButton
                dsVariant="secondary"
                block
                style={{ marginTop: 12 }}
                onClick={() => props.onEditStep(o.id, s.id)}
              >
                ✎ Edit this step
              </DsButton>
              <Popconfirm
                title="Delete this step?"
                description="Its entries are removed and other steps' links to it are detached."
                okText="Delete"
                okButtonProps={{ danger: true }}
                onConfirm={() => props.onDeleteStep(o.id, s.id)}
              >
                <DsButton
                  dsVariant="ghost"
                  block
                  style={{ marginTop: 8, color: 'var(--cr-error)' }}
                >
                  🗑 Delete step
                </DsButton>
              </Popconfirm>
            </>
          )}
        </>
      );
    }
  }

  return (
    <Drawer open={!!target} onClose={onClose} size={440} title={title} destroyOnHidden>
      {body}
    </Drawer>
  );
}
