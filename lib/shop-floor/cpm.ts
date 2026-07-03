/**
 * Shop Floor CPM / PERT engine - pure functions, no React.
 *
 * What: computes the critical path (ES/EF/LS/LF/slack), PERT three-point
 * expected durations (tₑ = (O+4M+P)/6), variance, and topological depth for
 * the steps of one or all work orders. Every Shop Floor view (floor arrows,
 * process layout, schedule gantt, CPM table, PERT probability) derives from
 * this one calculation so they can never disagree.
 *
 * Links: input is the normalized SfStep model produced from the backend
 * WorkOrder documents (lib/actions/work-orders.actions.ts → types/index.ts
 * WorkOrder). Consumed by components/machines/shop-floor/*.
 *
 * Watch: deps reference step ids within the SAME work order; cycle safety is
 * enforced server-side AND via wouldCycle() before linking in the UI. The
 * forward/backward passes are fixed-point loops capped at 500 iterations.
 */

import type { WorkOrder, WorkOrderStep } from '@/types';

/** A step annotated with its parent order id - the unit every view consumes. */
export interface SfStep extends WorkOrderStep {
  orderId: string;
}

export interface CpmStep extends SfStep {
  /** PERT expected duration (O+4M+P)/6, hours. */
  te: number;
  /** PERT variance ((P−O)/6)². */
  vr: number;
  es: number;
  ef: number;
  ls: number;
  lf: number;
  slack: number;
  crit: boolean;
  /** Topological column for network layouts. */
  lvl: number;
}

export interface CpmResult {
  ps: CpmStep[];
  /** Critical-path duration, hours. */
  dur: number;
  /** √Σ variance over critical steps - PERT risk window. */
  sigma: number;
  byId: Record<string, CpmStep>;
}

/** Flatten orders into the SfStep working set, optionally scoped to one order. */
export function scopeSteps(orders: WorkOrder[], filter: string): SfStep[] {
  const out: SfStep[] = [];
  for (const o of orders) {
    if (filter !== 'ALL' && o.id !== filter) continue;
    for (const s of o.steps) out.push({ ...s, orderId: o.id });
  }
  return out;
}

export function stepQty(s: WorkOrderStep): number {
  return (s.entries ?? []).reduce((t, e) => t + (e.qty ?? 0), 0);
}

export function stepWages(s: WorkOrderStep): number {
  return stepQty(s) * (s.wageRate || 0);
}

export function cpmCalc(steps: SfStep[]): CpmResult {
  const ps: CpmStep[] = steps.map((s) => ({
    ...s,
    te: (s.optimisticHrs + 4 * s.likelyHrs + s.pessimisticHrs) / 6,
    vr: Math.pow((s.pessimisticHrs - s.optimisticHrs) / 6, 2),
    es: 0,
    ef: 0,
    ls: 0,
    lf: 0,
    slack: 0,
    crit: false,
    lvl: 0,
  }));
  const byId: Record<string, CpmStep> = Object.fromEntries(ps.map((p) => [p.id, p]));

  // Forward pass (fixed point - order-independent, handles any dep ordering).
  ps.forEach((p) => {
    p.es = 0;
    p.ef = p.te;
  });
  let changed = true;
  let guard = 0;
  while (changed && guard++ < 500) {
    changed = false;
    for (const p of ps) {
      const validDeps = p.deps.filter((d) => byId[d]);
      const es = validDeps.length ? Math.max(0, ...validDeps.map((d) => byId[d].ef)) : 0;
      if (Math.abs(es - p.es) > 1e-9) {
        p.es = es;
        p.ef = es + p.te;
        changed = true;
      }
    }
  }
  const dur = ps.length ? Math.max(...ps.map((p) => p.ef)) : 0;

  // Backward pass.
  ps.forEach((p) => {
    p.lf = dur;
    p.ls = dur - p.te;
  });
  changed = true;
  guard = 0;
  while (changed && guard++ < 500) {
    changed = false;
    for (const p of ps) {
      const succ = ps.filter((q) => q.deps.includes(p.id));
      const lf = succ.length ? Math.min(...succ.map((q) => q.ls)) : dur;
      if (Math.abs(lf - p.lf) > 1e-9) {
        p.lf = lf;
        p.ls = lf - p.te;
        changed = true;
      }
    }
  }
  ps.forEach((p) => {
    p.slack = p.ls - p.es;
    p.crit = p.slack < 0.005;
  });
  const sigma = Math.sqrt(ps.filter((p) => p.crit).reduce((t, p) => t + p.vr, 0));

  // Topological depth → network column.
  const lvl: Record<string, number> = {};
  const seen: Record<string, boolean> = {};
  const depth = (id: string): number => {
    if (lvl[id] !== undefined) return lvl[id];
    const p = byId[id];
    if (!p || seen[id]) return 0;
    seen[id] = true;
    const ds = p.deps.filter((d) => byId[d]);
    lvl[id] = ds.length ? Math.max(...ds.map(depth)) + 1 : 0;
    return lvl[id];
  };
  ps.forEach((p) => {
    p.lvl = depth(p.id);
  });

  return { ps, dur, sigma, byId };
}

/** Standard normal CDF (Abramowitz–Stegun) - PERT finish-by probability. */
export function normCdf(z: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp((-z * z) / 2);
  const pr =
    d * t * (0.3194815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return z > 0 ? 1 - pr : pr;
}

/**
 * Would linking `dstId` to depend on `srcId` create a cycle? Walks the dep
 * chain upward from src looking for dst. Mirrors the BE WORK_ORDER_STEP_CYCLE
 * validation so users get instant feedback instead of a 400.
 */
export function wouldCycle(steps: WorkOrderStep[], srcId: string, dstId: string): boolean {
  const byId = new Map(steps.map((s) => [s.id, s]));
  const seen = new Set<string>();
  const stack = [srcId];
  while (stack.length) {
    const id = stack.pop()!;
    if (id === dstId) return true;
    if (seen.has(id)) continue;
    seen.add(id);
    const s = byId.get(id);
    if (s) stack.push(...s.deps);
  }
  return false;
}
