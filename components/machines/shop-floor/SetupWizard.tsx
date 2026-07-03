/**
 * Shop Floor - ⚙ Setup wizard (floors per location, machines + people links).
 *
 * What: the two-step configurator from the reference board, adapted to LINK
 * existing records instead of creating new ones. Step 1: pick the location
 * (physical site) and name its floors. Step 2: per floor, tap which of the
 * location's machines sit there and which team members work there.
 *
 * Links: applying the wizard (page-owned handler) PATCHes each changed
 * machine's floorTag via machines.actions updateMachine (the same field the
 * Machines page shows/groups by) and PUTs the ShopFloorConfig
 * (work-orders.actions upsertShopFloorConfig) for floors + people links.
 * Machines/team are created in their own modules - the wizard only links.
 *
 * Watch: form state lives in the inner <WizardForm>; `destroyOnHidden`
 * remounts it fresh per open. A machine/person belongs to at most one floor
 * (tapping it on another floor moves it).
 */

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Input, InputNumber, Modal } from 'antd';
import { DsButton, DsSelect, DsOption } from '@/components/ui';
import { machineArtKind, STAGE } from '@/lib/shop-floor/stages';
import {
  configForLocation,
  machineFloor,
  mid,
  lid,
  UNASSIGNED_FLOOR,
  type ShopFloorData,
} from './shared';

export interface SetupApplyPayload {
  locationId: string;
  /** Ordered floor names. */
  floors: string[];
  /** machineId → floor name ('' = unassigned). Covers ALL location machines. */
  machineFloors: Record<string, string>;
  /** teamMemberId → floor name (only assigned members). */
  peopleFloors: Record<string, string>;
}

interface SetupWizardProps {
  open: boolean;
  data: ShopFloorData;
  defaultLocationId: string | null;
  saving: boolean;
  onCancel: () => void;
  onApply: (payload: SetupApplyPayload) => void;
}

const DEFAULT_FLOOR_NAMES = [
  'Ground Floor',
  'First Floor',
  'Second Floor',
  'Third Floor',
  'Fourth Floor',
  'Fifth Floor',
  'Sixth Floor',
  'Seventh Floor',
];

export function SetupWizard({
  open,
  data,
  defaultLocationId,
  saving,
  onCancel,
  onApply,
}: SetupWizardProps) {
  return (
    <Modal
      open={open}
      onCancel={onCancel}
      footer={null}
      width={640}
      destroyOnHidden
      // Multi-step wizard - scroll the step body internally, not the page.
      style={{ top: 24 }}
      styles={{ body: { maxHeight: 'calc(100vh - 140px)', overflowY: 'auto' } }}
      title="⚙ Set up your unit"
    >
      <WizardForm
        data={data}
        defaultLocationId={defaultLocationId}
        saving={saving}
        onApply={onApply}
      />
    </Modal>
  );
}

/** Inner form - mounts fresh on every modal open (state from initializers). */
function WizardForm({
  data,
  defaultLocationId,
  saving,
  onApply,
}: {
  data: ShopFloorData;
  defaultLocationId: string | null;
  saving: boolean;
  onApply: (payload: SetupApplyPayload) => void;
}) {
  const [step, setStep] = useState(0);
  const [locationId, setLocationId] = useState<string | null>(
    defaultLocationId ?? (data.locations[0] ? lid(data.locations[0]) : null),
  );

  // Floor names - prefill from existing config / floorTags for the location.
  const initialFloors = (() => {
    const cfg = configForLocation(data, locationId);
    const fromCfg = (cfg?.floors ?? []).map((f) => f.name);
    if (fromCfg.length) return fromCfg;
    const tags = [
      ...new Set(
        data.machines
          .filter((m) => m.locationId === locationId && m.floorTag?.trim())
          .map((m) => m.floorTag!.trim()),
      ),
    ];
    return tags.length ? tags : [DEFAULT_FLOOR_NAMES[0]];
  })();
  const [floorNames, setFloorNames] = useState<string[]>(initialFloors);

  // machineId → floor name ('' = unassigned); seeded from current floorTags.
  const [machineFloors, setMachineFloors] = useState<Record<string, string>>(() => {
    const out: Record<string, string> = {};
    for (const m of data.machines.filter((mm) => mm.locationId === locationId)) {
      const f = machineFloor(m);
      out[mid(m)] = f === UNASSIGNED_FLOOR ? '' : f;
    }
    return out;
  });

  // teamMemberId → floor name; seeded from existing config people links.
  const [peopleFloors, setPeopleFloors] = useState<Record<string, string>>(() => {
    const out: Record<string, string> = {};
    for (const p of configForLocation(data, locationId)?.people ?? []) {
      out[p.teamMemberId] = p.floor;
    }
    return out;
  });

  // Re-seed machine/people assignments when the location changes mid-wizard.
  const handleLocationChange = (next: string) => {
    setLocationId(next);
    const cfg = data.configs.find((c) => c.locationId === next);
    const fromCfg = (cfg?.floors ?? []).map((f) => f.name);
    const tags = [
      ...new Set(
        data.machines
          .filter((m) => m.locationId === next && m.floorTag?.trim())
          .map((m) => m.floorTag!.trim()),
      ),
    ];
    setFloorNames(fromCfg.length ? fromCfg : tags.length ? tags : [DEFAULT_FLOOR_NAMES[0]]);
    const mf: Record<string, string> = {};
    for (const m of data.machines.filter((mm) => mm.locationId === next)) {
      const f = machineFloor(m);
      mf[mid(m)] = f === UNASSIGNED_FLOOR ? '' : f;
    }
    setMachineFloors(mf);
    const pf: Record<string, string> = {};
    for (const p of cfg?.people ?? []) pf[p.teamMemberId] = p.floor;
    setPeopleFloors(pf);
  };

  const setFloorCount = (n: number) => {
    const count = Math.max(1, Math.min(8, n));
    setFloorNames((prev) => {
      const next = prev.slice(0, count);
      while (next.length < count) {
        next.push(DEFAULT_FLOOR_NAMES[next.length] ?? `Floor ${next.length + 1}`);
      }
      return next;
    });
  };

  const cleanFloors = floorNames.map((f) => f.trim()).filter(Boolean);
  const locMachines = data.machines.filter(
    (m) => m.locationId === locationId && m.status !== 'retired',
  );

  const toggleMachine = (machineId: string, floor: string) =>
    setMachineFloors((prev) => ({
      ...prev,
      [machineId]: prev[machineId] === floor ? '' : floor,
    }));
  const togglePerson = (memberId: string, floor: string) =>
    setPeopleFloors((prev) => {
      const next = { ...prev };
      if (next[memberId] === floor) delete next[memberId];
      else next[memberId] = floor;
      return next;
    });

  const apply = () => {
    if (!locationId || !cleanFloors.length) return;
    // Drop assignments pointing at removed/renamed floors.
    const valid = new Set(cleanFloors.map((f) => f.toLowerCase()));
    const mf: Record<string, string> = {};
    for (const [k, v] of Object.entries(machineFloors)) {
      mf[k] = v && valid.has(v.trim().toLowerCase()) ? v.trim() : '';
    }
    const pf: Record<string, string> = {};
    for (const [k, v] of Object.entries(peopleFloors)) {
      if (v && valid.has(v.trim().toLowerCase())) pf[k] = v.trim();
    }
    onApply({ locationId, floors: cleanFloors, machineFloors: mf, peopleFloors: pf });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div className="sf-wiz-dots">
        <i className={step >= 0 ? 'sf-on' : ''} />
        <i className={step >= 1 ? 'sf-on' : ''} />
      </div>

      {step === 0 && (
        <>
          {data.locations.length > 1 && (
            <>
              <div className="sf-modal-label">Location (physical site)</div>
              <DsSelect
                aria-label="Location"
                value={locationId ?? undefined}
                onChange={(v) => handleLocationChange(v as string)}
              >
                {data.locations.map((l) => (
                  <DsOption key={lid(l)} value={lid(l)}>
                    {l.name}
                  </DsOption>
                ))}
              </DsSelect>
            </>
          )}
          <div className="sf-modal-label">How many floors does this unit have?</div>
          <InputNumber
            aria-label="Number of floors"
            min={1}
            max={8}
            value={floorNames.length}
            onChange={(v) => setFloorCount(typeof v === 'number' ? v : 1)}
            style={{ width: 120 }}
          />
          <div className="sf-modal-label">Floor names</div>
          {floorNames.map((name, i) => (
            <Input
              key={i}
              value={name}
              maxLength={60}
              placeholder={`Floor ${i + 1} name`}
              style={{ marginBottom: 6 }}
              onChange={(e) =>
                setFloorNames((prev) => prev.map((f, j) => (j === i ? e.target.value : f)))
              }
            />
          ))}
          <div className="sf-note">
            Next you&apos;ll place the machines and people <b>for each floor separately</b>. Floors
            are saved on each machine&apos;s <b>Floor</b> field - the same one the Machines page
            shows.
          </div>
        </>
      )}

      {step === 1 && (
        <>
          {cleanFloors.map((floor) => (
            <div key={floor} className="sf-floor-cfg">
              <div className="sf-floor-cfg-title">
                <span className="sf-floor-cfg-pin" />
                {floor}
              </div>
              <div className="sf-d-sub" style={{ marginTop: 8 }}>
                Machines on this floor
              </div>
              <div className="sf-pickrow">
                {locMachines.length ? (
                  locMachines.map((m) => {
                    const id = mid(m);
                    const here = machineFloors[id] === floor;
                    const elsewhere = !here && !!machineFloors[id];
                    return (
                      <button
                        key={id}
                        type="button"
                        className={`sf-pick ${here ? 'sf-pick-on' : ''}`}
                        style={elsewhere ? { opacity: 0.55 } : undefined}
                        title={
                          elsewhere
                            ? `currently on ${machineFloors[id]} - tap to move here`
                            : undefined
                        }
                        onClick={() => toggleMachine(id, floor)}
                      >
                        {m.machineCode || m.name} · {STAGE[machineArtKind(m.type)].label}
                      </button>
                    );
                  })
                ) : (
                  <span className="sf-pick sf-pick-dis">
                    no machines at this location yet -{' '}
                    <Link href="/dashboard/machines/new">add machines</Link> first
                  </span>
                )}
              </div>
              <div className="sf-d-sub" style={{ marginTop: 10 }}>
                People on this floor
              </div>
              <div className="sf-pickrow">
                {data.team.length ? (
                  data.team.map((t) => {
                    const here = peopleFloors[t.id] === floor;
                    const elsewhere = !here && !!peopleFloors[t.id];
                    return (
                      <button
                        key={t.id}
                        type="button"
                        className={`sf-pick ${here ? 'sf-pick-on' : ''}`}
                        style={elsewhere ? { opacity: 0.55 } : undefined}
                        title={
                          elsewhere
                            ? `currently on ${peopleFloors[t.id]} - tap to move here`
                            : undefined
                        }
                        onClick={() => togglePerson(t.id, floor)}
                      >
                        {t.name}
                        {t.designation ? ` · ${t.designation}` : ''}
                      </button>
                    );
                  })
                ) : (
                  <span className="sf-pick sf-pick-dis">
                    no team members yet - add them in <Link href="/dashboard/team">Team</Link>
                  </span>
                )}
              </div>
            </div>
          ))}
          <div className="sf-note">
            Machines and people stay managed in their own modules - this only links them to floors.
            A machine or person can be on one floor at a time; tapping it on another floor moves it.
          </div>
        </>
      )}

      <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
        {step === 1 && (
          <DsButton dsVariant="secondary" style={{ flex: 1 }} onClick={() => setStep(0)}>
            Back
          </DsButton>
        )}
        <DsButton
          dsVariant="primary"
          style={{ flex: 1 }}
          loading={saving}
          disabled={!locationId || !cleanFloors.length}
          onClick={() => (step === 0 ? setStep(1) : apply())}
        >
          {step === 0 ? 'Next - place machines & people' : 'Finish setup'}
        </DsButton>
      </div>
    </div>
  );
}
