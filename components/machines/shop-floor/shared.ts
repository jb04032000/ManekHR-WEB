/**
 * Shop Floor - shared client model + helpers.
 *
 * What: the assembled data bundle every Shop Floor view consumes (work
 * orders + machines + locations + team + open downtime), lookup helpers,
 * the machine status palette, and the localStorage layout store for
 * floor-canvas drag positions.
 *
 * Links: data comes from existing modules (machines / locations / team /
 * downtime server actions) plus work-orders.actions - the page never owns a
 * second copy of those records. Machine/person drag positions are cosmetic
 * view-state only, so they live in localStorage (per workspace + location);
 * step positions persist on the WorkOrderStep itself (posX/posY).
 *
 * Watch: machine ids appear as `id` or `_id` depending on serializer - use
 * mid()/lid() everywhere instead of touching the raw field.
 */

import type {
  DowntimeEntry,
  Location,
  Machine,
  ShopFloorConfig,
  TeamMember,
  WorkOrder,
} from '@/types';

export interface ShopFloorData {
  orders: WorkOrder[];
  machines: Machine[];
  locations: Location[];
  team: TeamMember[];
  /** machineId → its currently-open downtime entry (breakdown indicator). */
  openDowntime: Map<string, DowntimeEntry>;
  /** Per-location floor setup (floors + people links) from the Setup wizard. */
  configs: ShopFloorConfig[];
}

/** Pseudo-floor pill for machines of a location with no floorTag set. */
export const UNASSIGNED_FLOOR = 'Unassigned';

export function configForLocation(
  data: ShopFloorData,
  locationId: string | null,
): ShopFloorConfig | undefined {
  if (!locationId) return undefined;
  return data.configs.find((c) => c.locationId === locationId);
}

/** A machine's floor within its location - trimmed floorTag or Unassigned. */
export function machineFloor(m: Machine): string {
  return m.floorTag?.trim() || UNASSIGNED_FLOOR;
}

/**
 * Floors of a location = Setup-wizard floors ∪ floorTags found on its
 * machines (case-insensitive union, config order first), plus an Unassigned
 * bucket when tagged + untagged machines coexist. Empty array = no floor
 * split (the view shows the whole location as one floor).
 */
export function floorsOfLocation(data: ShopFloorData, locationId: string | null): string[] {
  if (!locationId) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (name: string) => {
    const k = name.trim().toLowerCase();
    if (!k || seen.has(k)) return;
    seen.add(k);
    out.push(name.trim());
  };
  for (const f of configForLocation(data, locationId)?.floors ?? []) push(f.name);
  const locMachines = data.machines.filter((m) => m.locationId === locationId);
  for (const m of locMachines) if (m.floorTag?.trim()) push(m.floorTag);
  if (out.length && locMachines.some((m) => !m.floorTag?.trim())) push(UNASSIGNED_FLOOR);
  return out;
}

/** Detail-drawer target - one drawer, four record kinds. */
export type DetailTarget =
  | { kind: 'machine'; id: string }
  | { kind: 'person'; id: string }
  | { kind: 'order'; id: string }
  | { kind: 'step'; orderId: string; stepId: string };

export const mid = (m: Machine): string => m.id ?? m._id ?? '';
export const lid = (l: Location): string => l._id ?? l.id ?? '';

export function machineById(data: ShopFloorData, id: string): Machine | undefined {
  return data.machines.find((m) => mid(m) === id);
}
export function locationById(data: ShopFloorData, id: string): Location | undefined {
  return data.locations.find((l) => lid(l) === id);
}
export function memberById(data: ShopFloorData, id: string): TeamMember | undefined {
  return data.team.find((t) => t.id === id);
}
export function orderById(data: ShopFloorData, id: string): WorkOrder | undefined {
  return data.orders.find((o) => o.id === id);
}

/** Live state of a machine on the floor: open downtime trumps status. */
export type FloorMachineState = 'breakdown' | 'active' | 'idle' | 'maintenance' | 'retired';

export function machineFloorState(data: ShopFloorData, m: Machine): FloorMachineState {
  if (data.openDowntime.has(mid(m))) return 'breakdown';
  return m.status;
}

export const FLOOR_STATE_LABEL: Record<FloorMachineState, string> = {
  breakdown: 'Breakdown',
  active: 'Running',
  idle: 'Idle',
  maintenance: 'Maintenance',
  retired: 'Retired',
};

/** Dot colours on the light theme - keep in sync with DsTag status colours. */
export const FLOOR_STATE_COLOR: Record<FloorMachineState, string> = {
  breakdown: 'var(--cr-error)',
  active: 'var(--cr-success)',
  idle: 'var(--cr-text-4)',
  maintenance: 'var(--cr-warning)',
  retired: 'var(--cr-text-5)',
};

// ── Floor layout persistence (cosmetic drag positions, localStorage) ───────
export interface XY {
  x: number;
  y: number;
}
export interface FloorLayout {
  machines: Record<string, XY>;
  people: Record<string, XY>;
}

const layoutKey = (wsId: string, locId: string) => `manekhr.sf.layout.${wsId}.${locId}`;

export function loadFloorLayout(wsId: string, locId: string): FloorLayout {
  if (typeof window === 'undefined') return { machines: {}, people: {} };
  try {
    const raw = window.localStorage.getItem(layoutKey(wsId, locId));
    if (!raw) return { machines: {}, people: {} };
    const parsed = JSON.parse(raw) as Partial<FloorLayout>;
    return { machines: parsed.machines ?? {}, people: parsed.people ?? {} };
  } catch {
    return { machines: {}, people: {} };
  }
}

export function saveFloorLayout(wsId: string, locId: string, layout: FloorLayout): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(layoutKey(wsId, locId), JSON.stringify(layout));
  } catch {
    // storage full / private mode - drag positions just won't persist.
  }
}

/** Timestamp formatter for entry logs (en-IN, short). */
export function fmtTs(ts: string): string {
  const d = new Date(ts);
  return isNaN(d.getTime())
    ? ts
    : d.toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      });
}

/** Hours → "HH:MM" clock label for the schedule axis. */
export function hhmm(t: number): string {
  return (
    String(Math.floor(t)).padStart(2, '0') + ':' + String(Math.round((t % 1) * 60)).padStart(2, '0')
  );
}
