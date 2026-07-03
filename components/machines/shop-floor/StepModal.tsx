/**
 * Shop Floor - add / edit step modal.
 *
 * What: the Visio companion dialog - pick the stage (illustrated tiles),
 * name the step, attach machines (2+ = parallel ∥), pick the assignee
 * (team member), pick "comes after" dependencies (cycle-checked), set the
 * O/M/P three-point time estimate, wage ₹/pc and progress.
 *
 * Links: saves through work-orders.actions (addWorkOrderStep /
 * updateWorkOrderStep - wired by the page). Machines come from the machines
 * module, assignees from the team module - no local copies.
 *
 * Watch: form state lives in the inner <StepForm>, which `destroyOnHidden`
 * unmounts on close - every open mounts fresh from props (no reset effects).
 * Machine suggestions are filtered by machineArtKind(type) matching the
 * stage; "show all" reveals the rest because machine types are free text.
 */

'use client';

import { useMemo, useState } from 'react';
import { Input, InputNumber, Modal } from 'antd';
import { DsButton, DsSelect, DsOption } from '@/components/ui';
import type { CreateWorkOrderStepPayload, WorkOrder, WorkOrderStep } from '@/types';
import {
  artIcon,
  machineArtKind,
  STAGE,
  STENCIL_ORDER,
  type StageKey,
  isStageKey,
} from '@/lib/shop-floor/stages';
import { wouldCycle } from '@/lib/shop-floor/cpm';
import { locationById, mid, orderById, type ShopFloorData } from './shared';

interface StepModalProps {
  open: boolean;
  data: ShopFloorData;
  orderId: string | null;
  /** Present = edit mode. */
  editStepId?: string | null;
  presetStage?: StageKey;
  saving: boolean;
  onCancel: () => void;
  onSave: (payload: CreateWorkOrderStepPayload, editStepId?: string | null) => void;
}

export function StepModal({
  open,
  data,
  orderId,
  editStepId,
  presetStage,
  saving,
  onCancel,
  onSave,
}: StepModalProps) {
  const order = orderId ? orderById(data, orderId) : undefined;
  const editStep: WorkOrderStep | undefined = editStepId
    ? order?.steps.find((s) => s.id === editStepId)
    : undefined;

  return (
    <Modal
      open={open}
      onCancel={onCancel}
      footer={null}
      width={560}
      destroyOnHidden
      // The step form is tall (stage tiles + machines + deps + estimates).
      // Cap the body height and scroll it INTERNALLY so a small viewport
      // scrolls the form, not the whole page. top keeps the card pinned so
      // its header/footer stay on-screen while the body scrolls.
      style={{ top: 24 }}
      styles={{ body: { maxHeight: 'calc(100vh - 140px)', overflowY: 'auto' } }}
      title={
        <span>
          {editStep ? '✎ Edit step' : '＋ Step'}{' '}
          <span style={{ color: 'var(--cr-text-4)', fontSize: 12, fontWeight: 400 }}>
            · {order ? `${order.code} - ${order.partyName}` : ''}
          </span>
        </span>
      }
    >
      {order && (
        <StepForm
          data={data}
          order={order}
          editStep={editStep}
          editStepId={editStepId ?? null}
          presetStage={presetStage}
          saving={saving}
          onSave={onSave}
        />
      )}
    </Modal>
  );
}

/** Inner form - mounts fresh on every modal open (state from initializers). */
function StepForm({
  data,
  order,
  editStep,
  editStepId,
  presetStage,
  saving,
  onSave,
}: {
  data: ShopFloorData;
  order: WorkOrder;
  editStep?: WorkOrderStep;
  editStepId: string | null;
  presetStage?: StageKey;
  saving: boolean;
  onSave: (payload: CreateWorkOrderStepPayload, editStepId?: string | null) => void;
}) {
  const initialStage: StageKey = editStep
    ? isStageKey(editStep.stage)
      ? editStep.stage
      : 'embroidery'
    : (presetStage ?? 'embroidery');

  const [stage, setStage] = useState<StageKey>(initialStage);
  const [name, setName] = useState(editStep?.name ?? '');
  const [machineIds, setMachineIds] = useState<string[]>(editStep?.machineIds ?? []);
  const [assigneeId, setAssigneeId] = useState<string | null>(editStep?.assigneeId ?? null);
  const [deps, setDeps] = useState<string[]>(editStep?.deps ?? []);
  const [o, setO] = useState(editStep?.optimisticHrs ?? 1);
  const [m, setM] = useState(editStep?.likelyHrs ?? 2);
  const [p, setP] = useState(editStep?.pessimisticHrs ?? 4);
  const [wageRate, setWageRate] = useState(editStep?.wageRate ?? STAGE[initialStage].rate);
  const [progress, setProgress] = useState(editStep?.progress ?? 0);
  const [showAllMachines, setShowAllMachines] = useState(false);

  const stageMeta = STAGE[stage];

  const { suggested, others } = useMemo(() => {
    const usable = data.machines.filter((mm) => mm.status !== 'retired');
    return {
      suggested: usable.filter((mm) => machineArtKind(mm.type) === stage),
      others: usable.filter((mm) => machineArtKind(mm.type) !== stage),
    };
  }, [data.machines, stage]);

  const toggleMachine = (id: string) =>
    setMachineIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const toggleDep = (id: string) => {
    if (deps.includes(id)) {
      setDeps((prev) => prev.filter((x) => x !== id));
      return;
    }
    if (editStepId && wouldCycle(order.steps, id, editStepId)) {
      Modal.warning({
        title: 'That would make a loop',
        content: 'A step cannot depend on itself.',
      });
      return;
    }
    setDeps((prev) => [...prev, id]);
  };

  const handleSave = () => {
    const oo = o || 1;
    const mm = Math.max(m || oo, oo);
    const pp = Math.max(p || mm, mm);
    onSave(
      {
        name: name.trim() || stageMeta.label,
        stage,
        machineIds: stageMeta.station ? machineIds : [],
        assigneeId: assigneeId || null,
        deps,
        optimisticHrs: oo,
        likelyHrs: mm,
        pessimisticHrs: pp,
        wageRate: wageRate || 0,
        progress: Math.max(0, Math.min(100, progress || 0)),
      },
      editStepId,
    );
  };

  const depCandidates = order.steps.filter((s) => s.id !== editStepId);

  const machinePick = (mm: (typeof data.machines)[number]) => {
    const id = mid(mm);
    const on = machineIds.includes(id);
    return (
      <button
        key={id}
        type="button"
        className={`sf-pick ${on ? 'sf-pick-on' : ''}`}
        onClick={() => toggleMachine(id)}
      >
        {mm.machineCode || mm.name} · {locationById(data, mm.locationId)?.name ?? ''}
      </button>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div className="sf-modal-label">Stage - what happens here?</div>
      <div className="sf-stage-tiles">
        {STENCIL_ORDER.map((k) => (
          <button
            key={k}
            type="button"
            className={`sf-sti ${stage === k ? 'sf-sti-on' : ''}`}
            onClick={() => {
              setStage(k);
              setMachineIds([]);
              if (!editStep) setWageRate(STAGE[k].rate);
            }}
          >
            <span dangerouslySetInnerHTML={{ __html: artIcon(k, STAGE[k].accent, 62, 36) }} />
            <span>{STAGE[k].label}</span>
          </button>
        ))}
      </div>

      <div className="sf-modal-label">Step name</div>
      <Input
        value={name}
        placeholder={stageMeta.label}
        maxLength={80}
        onChange={(e) => setName(e.target.value)}
      />

      <div className="sf-modal-label">
        {stageMeta.station
          ? 'Machines - tap to attach (2+ = run in parallel ∥)'
          : 'Machines - this is a manual / hand stage (no machine)'}
      </div>
      {stageMeta.station ? (
        <div className="sf-pickrow">
          {suggested.map(machinePick)}
          {showAllMachines && others.map(machinePick)}
          {!suggested.length && !showAllMachines && (
            <span className="sf-pick sf-pick-dis">no {stageMeta.label} machine found by type</span>
          )}
          {others.length > 0 && (
            <button
              type="button"
              className="sf-pick"
              style={{ borderStyle: 'dashed' }}
              onClick={() => setShowAllMachines((v) => !v)}
            >
              {showAllMachines ? 'hide other machines' : `show all machines (${others.length})`}
            </button>
          )}
        </div>
      ) : (
        <div className="sf-pickrow">
          <span className="sf-pick sf-pick-dis">manual stage - no machine needed</span>
        </div>
      )}

      <div className="sf-modal-label">Karigar - who does the work?</div>
      <DsSelect
        aria-label="Assignee"
        allowClear
        showSearch
        optionFilterProp="children"
        placeholder="Pick a team member"
        value={assigneeId ?? undefined}
        onChange={(v) => setAssigneeId((v as string) ?? null)}
      >
        {data.team.map((t) => (
          <DsOption key={t.id} value={t.id}>
            {t.name}
            {t.designation ? ` · ${t.designation}` : ''}
          </DsOption>
        ))}
      </DsSelect>

      <div className="sf-modal-label">
        Comes after - tap previous step(s); none = parallel start ▶
      </div>
      <div className="sf-pickrow">
        {depCandidates.length ? (
          depCandidates.map((s) => (
            <button
              key={s.id}
              type="button"
              className={`sf-pick ${deps.includes(s.id) ? 'sf-pick-on' : ''}`}
              onClick={() => toggleDep(s.id)}
            >
              {s.name}
            </button>
          ))
        ) : (
          <span className="sf-pick sf-pick-dis">first step - it will be a START ▶</span>
        )}
      </div>

      <div className="sf-modal-label">
        Time estimate (hours) - Optimistic / Likely / Pessimistic
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
        <InputNumber
          aria-label="Optimistic hours"
          min={0.1}
          step={0.5}
          value={o}
          onChange={(v) => setO(v ?? 1)}
          style={{ width: '100%' }}
        />
        <InputNumber
          aria-label="Likely hours"
          min={0.1}
          step={0.5}
          value={m}
          onChange={(v) => setM(v ?? 2)}
          style={{ width: '100%' }}
        />
        <InputNumber
          aria-label="Pessimistic hours"
          min={0.1}
          step={0.5}
          value={p}
          onChange={(v) => setP(v ?? 4)}
          style={{ width: '100%' }}
        />
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        {(
          [
            ['quick · 1-2-4', 1, 2, 4],
            ['half-day · 4-6-9', 4, 6, 9],
            ['full-day · 8-10-14', 8, 10, 14],
          ] as const
        ).map(([label, a, b, c]) => (
          <button
            key={label}
            type="button"
            className="sf-pick"
            style={{ flex: 1, borderStyle: 'dashed' }}
            onClick={() => {
              setO(a);
              setM(b);
              setP(c);
            }}
          >
            {label}
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div>
          <div className="sf-modal-label">Wage ₹/pc</div>
          <InputNumber
            aria-label="Wage per piece"
            min={0}
            step={0.5}
            value={wageRate}
            onChange={(v) => setWageRate(v ?? 0)}
            style={{ width: '100%' }}
          />
        </div>
        <div>
          <div className="sf-modal-label">Progress %</div>
          <InputNumber
            aria-label="Progress percent"
            min={0}
            max={100}
            value={progress}
            onChange={(v) => setProgress(v ?? 0)}
            style={{ width: '100%' }}
          />
        </div>
      </div>

      <DsButton
        dsVariant="primary"
        loading={saving}
        onClick={handleSave}
        style={{ marginTop: 14 }}
        block
      >
        {editStep ? 'Save changes' : 'Add step - flow, CPM, PERT & floor all update'}
      </DsButton>
      <div style={{ fontSize: 11, color: 'var(--cr-text-3)', lineHeight: 1.5, marginTop: 6 }}>
        Series vs parallel comes from the links: a step with no “comes after” starts in parallel;
        two steps after the same step run in parallel; 2+ machines on one step run that step in
        parallel (∥). tₑ = (O+4M+P)÷6.
      </div>
    </div>
  );
}
