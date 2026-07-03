/**
 * Shop Floor - Floor map tab.
 *
 * What: renders one FLOOR of a Location as an SVG plan. A Location is the
 * physical site (Machines → Locations); the floors inside it come from the
 * Setup wizard (ShopFloorConfig) ∪ the machines' floorTag values - the same
 * field the Machines page shows in its Floor column. Machines are drawn with
 * their stage illustration + live status dot (open downtime = breakdown),
 * the work-order routes as animated arrows, the current step badge under
 * each machine, and people (Setup-linked members + step assignees).
 *
 * Links: machines/locations from the machines module, downtime Phase 22,
 * people from team, floors/people-links from work-orders ShopFloorConfig,
 * routes from work-orders via lib/shop-floor/cpm.ts. Clicks open the shared
 * DetailDrawer; ⚙ Setup opens the SetupWizard (page-owned).
 *
 * Watch: scene is an SVG markup string - interaction via data-open /
 * data-drag attributes. Drag positions are localStorage view-state keyed per
 * workspace + location + floor.
 */

'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { SettingOutlined } from '@ant-design/icons';
import { DsButton, DsSelect, DsOption } from '@/components/ui';
import type { Machine, TeamMember } from '@/types';
import { cpmCalc, scopeSteps, stepWages, type CpmStep } from '@/lib/shop-floor/cpm';
import { art, machineArtKind, STAGE, svgEsc, fmtINR, type StageKey } from '@/lib/shop-floor/stages';
import {
  configForLocation,
  floorsOfLocation,
  loadFloorLayout,
  saveFloorLayout,
  machineFloor,
  machineFloorState,
  locationById,
  orderById,
  mid,
  lid,
  type DetailTarget,
  type FloorLayout,
  type ShopFloorData,
} from './shared';
import { useSvgCanvas } from './useSvgCanvas';
import { CanvasZoomBar } from './CanvasZoomBar';

interface FloorViewProps {
  data: ShopFloorData;
  wsId: string;
  filter: string; // 'ALL' | work-order id
  curLocationId: string | null;
  onLocationChange: (id: string) => void;
  unlocked: boolean;
  canManage: boolean;
  onOpenDetail: (t: DetailTarget) => void;
  onOpenSetup: () => void;
}

interface XYPos {
  x: number;
  y: number;
}

const eqFloor = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

export function FloorView({
  data,
  wsId,
  filter,
  curLocationId,
  onLocationChange,
  unlocked,
  canManage,
  onOpenDetail,
  onOpenSetup,
}: FloorViewProps) {
  const [layout, setLayout] = useState<FloorLayout>({ machines: {}, people: {} });
  const [curFloor, setCurFloor] = useState<string | null>(null);

  // Reset the floor pill when the location changes (render-time adjustment).
  const [prevLoc, setPrevLoc] = useState(curLocationId);
  if (prevLoc !== curLocationId) {
    setPrevLoc(curLocationId);
    setCurFloor(null);
  }

  const floors = useMemo(() => floorsOfLocation(data, curLocationId), [data, curLocationId]);
  const effFloor = useMemo(() => {
    if (!floors.length) return null;
    if (curFloor && floors.some((f) => eqFloor(f, curFloor))) return curFloor;
    return floors[0];
  }, [floors, curFloor]);

  /** localStorage layout bucket - per location + floor. */
  const layoutKeyId = curLocationId ? `${curLocationId}::${effFloor ?? 'all'}` : null;

  useEffect(() => {
    // localStorage must be read post-mount (render-time read would cause a
    // hydration mismatch on the SVG transforms) - effect is the right home.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (wsId && layoutKeyId) setLayout(loadFloorLayout(wsId, layoutKeyId));
  }, [wsId, layoutKeyId]);

  const locMachines = useMemo(
    () => data.machines.filter((m) => m.locationId === curLocationId),
    [data.machines, curLocationId],
  );
  const floorMachines = useMemo(
    () => (effFloor ? locMachines.filter((m) => eqFloor(machineFloor(m), effFloor)) : locMachines),
    [locMachines, effFloor],
  );

  const cpm = useMemo(() => cpmCalc(scopeSteps(data.orders, filter)), [data.orders, filter]);
  const allSteps = useMemo(() => cpmCalc(scopeSteps(data.orders, 'ALL')), [data.orders]);

  const stepsOfMachine = useCallback(
    (machineId: string): CpmStep[] => allSteps.ps.filter((s) => s.machineIds.includes(machineId)),
    [allSteps],
  );

  // ── Auto layout: machines grouped into zones by illustration kind ────────
  const positions = useMemo(() => {
    const pos: {
      machines: Record<string, XYPos>;
      people: Record<string, XYPos>;
      zones: { label: string; x: number; y: number }[];
      height: number;
    } = { machines: {}, people: {}, zones: [], height: 560 };

    const byKind = new Map<StageKey, Machine[]>();
    for (const m of floorMachines) {
      const k = machineArtKind(m.type);
      const list = byKind.get(k);
      if (list) list.push(m);
      else byKind.set(k, [m]);
    }
    let y = 96;
    for (const [kind, list] of byKind) {
      pos.zones.push({ label: `${STAGE[kind].label} zone`, x: 96, y: y - 34 });
      list.forEach((m, i) => {
        pos.machines[mid(m)] = { x: 120 + (i % 4) * 320, y: y + Math.floor(i / 4) * 230 };
      });
      y += Math.ceil(list.length / 4) * 230 + 40;
    }
    // Drag overrides win over the auto grid.
    for (const m of floorMachines) {
      const o = layout.machines[mid(m)];
      if (o) pos.machines[mid(m)] = o;
    }

    // People on this floor: step assignees anchored to their machines here,
    // plus Setup-linked members (benched if they have no machine anchor).
    const floorIds = new Set(floorMachines.map(mid));
    const placed: { x: number; y: number; bench: boolean }[] = [];
    const seen = new Set<string>();
    const place = (memberId: string, anchors: XYPos[]) => {
      if (seen.has(memberId)) return;
      seen.add(memberId);
      const o = layout.people[memberId];
      if (o) {
        pos.people[memberId] = o;
        placed.push({ ...o, bench: false });
        return;
      }
      let x: number;
      let yy: number;
      if (anchors.length) {
        x = anchors.reduce((t, q) => t + q.x + 115, 0) / anchors.length;
        yy = Math.max(...anchors.map((q) => q.y)) + 225;
      } else {
        x = 150 + placed.filter((q) => q.bench).length * 150;
        yy = y + 40;
      }
      while (placed.some((q) => Math.abs(q.x - x) < 115 && Math.abs(q.y - yy) < 60)) x += 125;
      placed.push({ x, y: yy, bench: anchors.length === 0 });
      pos.people[memberId] = { x, y: yy };
    };

    for (const s of allSteps.ps) {
      if (!s.assigneeId) continue;
      const machinesHere = s.machineIds.filter((id) => floorIds.has(id));
      if (!machinesHere.length) continue;
      place(s.assigneeId, machinesHere.map((id) => pos.machines[id]).filter(Boolean));
    }
    const cfg = configForLocation(data, curLocationId);
    for (const p of cfg?.people ?? []) {
      if (effFloor && !eqFloor(p.floor, effFloor)) continue;
      place(p.teamMemberId, []);
    }
    pos.height = Math.max(y + 200, 560);
    return pos;
  }, [floorMachines, layout, allSteps, data, curLocationId, effFloor]);

  const positionsRef = useRef(positions);
  useEffect(() => {
    positionsRef.current = positions;
  }, [positions]);

  const canvas = useSvgCanvas({
    unlocked,
    getPos: (key) => {
      const [type, id] = key.split(':');
      const p =
        type === 'machine' ? positionsRef.current.machines[id] : positionsRef.current.people[id];
      return p ?? null;
    },
    onDragMove: (key, x, y) => {
      const [type, id] = key.split(':');
      setLayout((prev) => ({
        ...prev,
        [type === 'machine' ? 'machines' : 'people']: {
          ...(type === 'machine' ? prev.machines : prev.people),
          [id]: { x, y },
        },
      }));
    },
    onDragEnd: () => {
      if (wsId && layoutKeyId) {
        // setLayout above already holds the final position - persist it.
        setLayout((prev) => {
          saveFloorLayout(wsId, layoutKeyId, prev);
          return prev;
        });
      }
    },
  });

  const { svgRef, viewBox, onPointerDown, setBase } = canvas;
  const wrapRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    setBase(1460, positions.height);
  }, [setBase, positions.height]);

  // ── Scene markup ──────────────────────────────────────────────────────────
  const scene = useMemo(() => {
    if (!floorMachines.length) return null;

    const orderHex = (orderId: string) => orderById(data, orderId)?.colorHex || '#888';
    let edges = '';
    let ms = '';
    let ops = '';
    let badges = '';

    const floorIds = new Set(floorMachines.map(mid));
    const machinePlace = (id: string) => {
      const m = data.machines.find((mm) => mid(mm) === id);
      if (!m) return 'elsewhere';
      if (m.locationId !== curLocationId)
        return locationById(data, m.locationId)?.name ?? 'other location';
      return machineFloor(m);
    };

    // Route arrows: dep step → step, drawn where machines sit on this floor.
    for (const s of cpm.ps) {
      for (const d of s.deps) {
        const ds = cpm.byId[d];
        if (!ds) continue;
        const fromM = ds.machineIds.find((id) => floorIds.has(id));
        const toM = s.machineIds.find((id) => floorIds.has(id));
        const hex = orderHex(s.orderId);
        const crit = s.crit && ds.crit;
        if (fromM && toM) {
          const a = positions.machines[fromM];
          const b = positions.machines[toM];
          if (!a || !b) continue;
          const x1 = a.x + 115;
          const y1 = a.y + 72;
          const x2 = b.x + 115;
          const y2 = b.y + 72;
          const mx = (x1 + x2) / 2;
          edges += `<path class="sf-edge ${crit ? 'sf-edge-crit' : ''}" data-skip-pan="1" data-open="step:${s.orderId}:${s.id}" stroke="${hex}" marker-end="url(#sfar)" d="M${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}"><title>${svgEsc(ds.name)} → ${svgEsc(s.name)}</title></path>`;
        } else if (fromM && s.machineIds.length && !toM) {
          const a = positions.machines[fromM];
          if (!a) continue;
          edges += `<path class="sf-edge sf-edge-still" stroke="${hex}" marker-end="url(#sfar)" d="M${a.x + 230} ${a.y + 72} h70"/>
            <text x="${a.x + 308}" y="${a.y + 76}" font-size="11" fill="${hex}">→ ${svgEsc(machinePlace(s.machineIds[0]))}</text>`;
        } else if (toM && ds.machineIds.length && !fromM) {
          const b = positions.machines[toM];
          if (!b) continue;
          edges += `<path class="sf-edge sf-edge-still" stroke="${hex}" marker-end="url(#sfar)" d="M${b.x - 72} ${b.y + 72} h64"/>
            <text x="${b.x - 76}" y="${b.y + 76}" font-size="11" fill="${hex}" text-anchor="end">${svgEsc(machinePlace(ds.machineIds[0]))} →</text>`;
        }
      }
    }

    for (const m of floorMachines) {
      const id = mid(m);
      const p = positions.machines[id];
      if (!p) continue;
      const served = stepsOfMachine(id);
      const visible = served.filter((s) => filter === 'ALL' || s.orderId === filter);
      const dim =
        filter !== 'ALL' && served.length > 0 && !served.some((s) => s.orderId === filter);
      const kind = machineArtKind(m.type);
      const accent = visible.length ? orderHex(visible[0].orderId) : STAGE[kind].accent;
      const state = machineFloorState(data, m);
      const meta =
        state === 'breakdown'
          ? '⚠ breakdown - downtime open'
          : state === 'maintenance'
            ? 'under maintenance'
            : state === 'retired'
              ? 'retired'
              : visible.length
                ? `serving ${visible.length} step${visible.length > 1 ? 's' : ''}`
                : 'idle - no step assigned';
      const dot =
        state === 'breakdown'
          ? `<circle cx="216" cy="10" r="7" fill="none" stroke="var(--cr-error)" stroke-width="3" class="sf-bring"/><circle cx="216" cy="10" r="3" fill="var(--cr-error)"/>`
          : state === 'active'
            ? `<circle cx="216" cy="10" r="4.5" fill="var(--cr-success)" class="sf-sdot"/>`
            : `<circle cx="216" cy="10" r="4.5" fill="${state === 'maintenance' ? 'var(--cr-warning)' : 'var(--cr-text-5)'}"/>`;
      ms += `<g class="sf-mg ${dim ? 'sf-dimmed' : ''}" data-drag="machine:${id}" data-open="machine:${id}" transform="translate(${p.x},${p.y})">
        <rect class="sf-hover-ring" x="-10" y="-10" width="250" height="208" rx="14" fill="none" stroke="${accent}" stroke-width="2"/>
        ${art(kind, accent)}${dot}
        <text class="sf-m-name" y="170">${svgEsc(m.name)}${m.machineCode ? ' · ' + svgEsc(m.machineCode) : ''}</text>
        <text class="sf-m-meta" y="186">${svgEsc(meta)}</text></g>`;

      const act = visible.find((s) => s.progress < 100) || visible[0];
      if (act && !dim) {
        const hex = orderHex(act.orderId);
        const txt = `${act.name} · ${act.progress}%${visible.length > 1 ? '  +' + (visible.length - 1) : ''}`;
        const w = txt.length * 6.6 + 18;
        badges += `<g class="sf-badge" data-open="step:${act.orderId}:${act.id}" transform="translate(${p.x + 115 - w / 2},${p.y + 192})">
          <rect width="${w}" height="20" rx="10" stroke="${hex}"/>
          <text x="${w / 2}" y="14" text-anchor="middle" fill="${hex}">${svgEsc(txt)}</text></g>`;
      }
    }

    // People - Setup-linked members + step assignees, order colours + wages.
    for (const [memberId, g] of Object.entries(positions.people)) {
      const person: TeamMember | undefined = data.team.find((t) => t.id === memberId);
      if (!person) continue;
      const theirSteps = allSteps.ps.filter((s) => s.assigneeId === memberId);
      const orderIds = [...new Set(theirSteps.map((s) => s.orderId))];
      const dimmed = filter !== 'ALL' && orderIds.length > 0 && !orderIds.includes(filter);
      const c1 = orderIds.length ? orderHex(orderIds[0]) : '#94A3B8';
      const c2 = orderIds[1] ? orderHex(orderIds[1]) : c1;
      const earned = theirSteps.reduce((t, s) => t + stepWages(s), 0);
      const machineNames = [
        ...new Set(
          theirSteps
            .flatMap((s) => s.machineIds)
            .map((idx) => data.machines.find((m) => mid(m) === idx)?.machineCode || '')
            .filter(Boolean),
        ),
      ];
      const metaLine = theirSteps.length
        ? `${fmtINR(earned)} · ${machineNames.join('+') || person.designation || 'hand work'}`
        : person.designation || 'no step assigned yet';
      ops += `<g class="sf-og ${dimmed ? 'sf-dimmed' : ''}" data-drag="person:${memberId}" data-open="person:${memberId}" transform="translate(${g.x},${g.y})">
        <circle class="sf-hover-ring" r="48" cy="22" fill="none" stroke="${c1}" stroke-width="2"/>
        <circle cx="0" cy="0" r="13" fill="#D9B48C"/>
        <path d="M-18 46 q0 -27 18 -27 q18 0 18 27 z" fill="${c1}"/>
        <path d="M0 19 q18 0 18 27 h-18 z" fill="${c2}"/>
        <text class="sf-op-name" y="66">${svgEsc(person.name)}</text>
        <text class="sf-op-meta" y="81">${svgEsc(metaLine)}</text></g>`;
    }

    const zones = positions.zones
      .map((z) => `<text class="sf-zone" x="${z.x}" y="${z.y}">${svgEsc(z.label)}</text>`)
      .join('');

    return `<defs><marker id="sfar" markerWidth="9" markerHeight="9" refX="7.5" refY="4.5" orient="auto"><path d="M0 0 L9 4.5 L0 9 Z" fill="context-stroke"/></marker></defs>${zones}${edges}${ms}${badges}${ops}`;
  }, [floorMachines, positions, cpm, allSteps, data, filter, stepsOfMachine, curLocationId]);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      const el = (e.target as Element).closest('[data-open]');
      if (!el) return;
      const [kind, a, b] = el.getAttribute('data-open')!.split(':');
      if (kind === 'machine') onOpenDetail({ kind: 'machine', id: a });
      if (kind === 'person') onOpenDetail({ kind: 'person', id: a });
      if (kind === 'step') onOpenDetail({ kind: 'step', orderId: a, stepId: b });
    },
    [onOpenDetail],
  );

  const curLocation = curLocationId ? locationById(data, curLocationId) : undefined;

  return (
    <div>
      {/* Location (physical site) + floor pills + Setup */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          flexWrap: 'wrap',
          padding: '4px 4px 12px',
        }}
      >
        {data.locations.length > 1 && (
          <DsSelect
            aria-label="Location"
            style={{ width: 180 }}
            value={curLocationId ?? undefined}
            onChange={(v) => onLocationChange(v as string)}
          >
            {data.locations.map((l) => (
              <DsOption key={lid(l)} value={lid(l)}>
                {l.name}
              </DsOption>
            ))}
          </DsSelect>
        )}
        <span className="sf-flabel">Floors</span>
        {floors.length === 0 ? (
          <button type="button" className="sf-fpill sf-fpill-on">
            {curLocation?.name ?? 'All'}
            <span className="sf-fc">{locMachines.length} machines</span>
          </button>
        ) : (
          floors.map((f) => {
            const mc = locMachines.filter((m) => eqFloor(machineFloor(m), f)).length;
            const active = effFloor != null && eqFloor(f, effFloor);
            return (
              <button
                key={f}
                type="button"
                className={`sf-fpill ${active ? 'sf-fpill-on' : ''}`}
                onClick={() => setCurFloor(f)}
              >
                {f}
                <span className="sf-fc">{mc} machines</span>
              </button>
            );
          })
        )}
        {canManage && (
          <DsButton
            dsVariant="secondary"
            dsSize="sm"
            icon={<SettingOutlined />}
            onClick={onOpenSetup}
          >
            Setup
          </DsButton>
        )}
        <span className="sf-hint">
          arrows = order route on this floor · badge under a machine = its current step
        </span>
      </div>

      <div className="sf-canvas-wrap" ref={wrapRef}>
        <CanvasZoomBar canvas={canvas} fullscreenTarget={wrapRef} />
        {scene ? (
          <svg
            ref={svgRef}
            viewBox={viewBox}
            style={{ height: '62vh' }}
            role="img"
            aria-label="Shop floor map"
            onPointerDown={onPointerDown}
            onClick={handleClick}
            dangerouslySetInnerHTML={{ __html: scene }}
          />
        ) : (
          <div className="sf-empty">
            {data.locations.length === 0 ? (
              <>
                No locations yet.
                <br />
                Add your unit in{' '}
                <Link href="/dashboard/machines/locations">Machines → Locations</Link>, then run{' '}
                <b>⚙ Setup</b> here to define its floors.
              </>
            ) : locMachines.length === 0 ? (
              <>
                <b>{curLocation?.name ?? 'This location'}</b> has no machines yet.
                <br />
                Add machines in <Link href="/dashboard/machines/new">
                  Machines → Add Machine
                </Link>{' '}
                (pick this location), then run <b>⚙ Setup</b> to arrange them on floors and link
                your people.
                {canManage && (
                  <div style={{ marginTop: 14 }}>
                    <DsButton dsVariant="primary" icon={<SettingOutlined />} onClick={onOpenSetup}>
                      ⚙ Set up floors &amp; people
                    </DsButton>
                  </div>
                )}
              </>
            ) : (
              <>
                No machines on <b>{effFloor}</b> yet.
                <br />
                Use <b>⚙ Setup</b> to assign machines to this floor.
                {canManage && (
                  <div style={{ marginTop: 14 }}>
                    <DsButton dsVariant="primary" icon={<SettingOutlined />} onClick={onOpenSetup}>
                      Open Setup
                    </DsButton>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
