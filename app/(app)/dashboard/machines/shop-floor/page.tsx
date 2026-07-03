'use client';

/**
 * Shop Floor Control - /dashboard/machines/shop-floor.
 *
 * What: the live control board for a production unit. One screen with seven
 * tabs (Floor map, Process builder, Schedule, CPM, PERT, Daily Log, Guide),
 * order filter chips and derived KPIs. Progress is hand-logged (no sensors).
 *
 * Single source of truth: machines/locations come from the machines module,
 * people from the team module, breakdowns from Phase 22 downtime, and the
 * orders + process-step DAG from the work-orders backend (this page's only
 * new collection). Everything rendered here is DERIVED from those - there is
 * no duplicate store. Mutations call the existing server actions and replace
 * the returned document in state.
 *
 * Links: components/machines/shop-floor/* (views), lib/shop-floor/* (CPM
 * engine + stage art), lib/actions/work-orders.actions.ts,
 * machines/team/downtime actions. Sidebar entry + nav permission live in
 * components/layout/Sidebar.tsx and lib/constants/nav-permissions.ts.
 *
 * Watch: gates mirror app/dashboard/machines/page.tsx (subscription module
 * `machines` + RBAC machines.view; writes additionally need the
 * machines_basic sub-feature, BE re-checks on every route).
 */

import { useCallback, useEffect, useMemo, useState, startTransition } from 'react';
import { Skeleton, Tabs, message } from 'antd';
import {
  ApartmentOutlined,
  LockOutlined,
  PlusOutlined,
  SettingOutlined,
  UnlockOutlined,
} from '@ant-design/icons';
import { DsButton, DsCard, DsEmptyState, DsPageHeader } from '@/components/ui';
import { useWorkspaceStore, useSubscriptionStore } from '@/lib/store';
import { useMyPermissions } from '@/hooks/useMyPermissions';
import { ModuleLockedPage } from '@/components/subscription/ModuleLockedPage';
import { parseApiError } from '@/lib/utils';
import {
  listMachines,
  listLocations,
  listTeam,
  updateMachine,
  listShopFloorConfigs,
  upsertShopFloorConfig,
  listWorkOrders,
  createWorkOrder,
  updateWorkOrder,
  deleteWorkOrder,
  addWorkOrderStep,
  updateWorkOrderStep,
  deleteWorkOrderStep,
  addWorkOrderStepEntry,
  deleteWorkOrderStepEntry,
} from '@/lib/actions';
import { listDowntimeForWorkspace } from '@/lib/actions/machines.actions';
import type {
  CreateWorkOrderPayload,
  CreateWorkOrderStepEntryPayload,
  CreateWorkOrderStepPayload,
  DowntimeEntry,
  Location,
  Machine,
  MachineStatus,
  ShopFloorConfig,
  TeamMember,
  UpdateWorkOrderPayload,
  WorkOrder,
} from '@/types';
import { cpmCalc, scopeSteps, stepQty, stepWages } from '@/lib/shop-floor/cpm';
import { fmtINR, machineArtKind, ROUTE_ORDER, STAGE, type StageKey } from '@/lib/shop-floor/stages';
import {
  lid,
  mid,
  type DetailTarget,
  type ShopFloorData,
} from '@/components/machines/shop-floor/shared';
import { FloorView } from '@/components/machines/shop-floor/FloorView';
import { ProcessView } from '@/components/machines/shop-floor/ProcessView';
import { ScheduleView } from '@/components/machines/shop-floor/ScheduleView';
import { CpmView } from '@/components/machines/shop-floor/CpmView';
import { PertView } from '@/components/machines/shop-floor/PertView';
import { DailyLogView } from '@/components/machines/shop-floor/DailyLogView';
import { DetailDrawer } from '@/components/machines/shop-floor/DetailDrawer';
import { StepModal } from '@/components/machines/shop-floor/StepModal';
import { OrderModal } from '@/components/machines/shop-floor/OrderModal';
import { SetupWizard, type SetupApplyPayload } from '@/components/machines/shop-floor/SetupWizard';

/** Page-scoped styles (sf- prefix) - SVG scene classes + light-theme chrome.
 *  Inline <style> because the scenes are markup strings (CSS Modules would
 *  hash the class names away). */
const SF_STYLES = `
.sf-root .sf-canvas-wrap{position:relative;background:var(--cr-bg);border:1px solid var(--cr-border);border-radius:12px;overflow:hidden}
.sf-root .sf-canvas-wrap svg{display:block;width:100%;touch-action:none;cursor:grab}
.sf-root .sf-canvas-wrap svg.sf-dragging{cursor:grabbing}
.sf-root.sf-unlocked .sf-canvas-wrap svg [data-drag]{cursor:move}
.sf-zoombar{position:absolute;right:10px;top:10px;display:flex;flex-direction:column;gap:5px;z-index:5}
.sf-zoombar button{width:32px;height:32px;border-radius:9px;border:1px solid var(--cr-border);background:var(--cr-surface);color:var(--cr-text-2);font-size:15px;font-weight:800;cursor:pointer}
.sf-zoombar button:hover{border-color:var(--cr-primary);color:var(--cr-primary)}
.sf-root svg text{font-family:inherit}
.sf-zone{font-size:12px;letter-spacing:2.5px;fill:var(--cr-text-4);text-transform:uppercase}
.sf-mg,.sf-og,.sf-badge,.sf-pnode{cursor:pointer;transition:opacity .35s}
.sf-mg:hover .sf-hover-ring,.sf-og:hover .sf-hover-ring{opacity:.55}
.sf-hover-ring{opacity:0;transition:.2s}
.sf-dimmed{opacity:.15}
.sf-m-name{font-size:14px;font-weight:700;fill:var(--cr-text)}
.sf-m-meta{font-size:11px;fill:var(--cr-text-3)}
.sf-op-name{font-size:12.5px;font-weight:700;fill:var(--cr-text);text-anchor:middle}
.sf-op-meta{font-size:10px;fill:var(--cr-text-3);text-anchor:middle}
.sf-sdot{animation:sfPulse 1.6s infinite}
.sf-bring{animation:sfBlink 1.1s infinite}
.sf-badge rect{fill:var(--cr-surface)}
.sf-badge text{font-size:10.5px;font-weight:700}
.sf-edge{fill:none;stroke-width:2.4;opacity:.85;stroke-dasharray:7 7;animation:sfFlow 1.15s linear infinite;cursor:pointer}
.sf-edge:hover{stroke-width:4}
.sf-edge-crit{stroke-width:3.2;filter:drop-shadow(0 0 5px rgba(220,38,38,.45))}
.sf-edge-still{animation:none;stroke-dasharray:none;opacity:.6}
.sf-plat{fill:var(--cr-surface);stroke:var(--cr-border);stroke-width:1.5}
.sf-pnode:hover .sf-plat{stroke-width:2.6}
.sf-pnode-crit .sf-plat{stroke:var(--cr-error);stroke-width:2.4;filter:drop-shadow(0 0 7px rgba(220,38,38,.30))}
.sf-pnode-done .sf-plat{stroke:var(--cr-success)}
.sf-pnode-src .sf-plat{stroke:#D97706;stroke-width:3;filter:drop-shadow(0 0 8px rgba(217,119,6,.45))}
.sf-nm-title{font-size:13px;font-weight:700;fill:var(--cr-text);text-anchor:middle}
.sf-nm-sub{font-size:10px;fill:var(--cr-text-3);text-anchor:middle}
.sf-nm-num{font-size:10px;font-variant-numeric:tabular-nums;font-weight:700;fill:var(--cr-text-2)}
.sf-nm-tag{font-size:9px;letter-spacing:1.2px;text-transform:uppercase;font-weight:700;text-anchor:middle}
.sf-port{cursor:crosshair}
.sf-port circle{stroke-width:2;transition:.15s}
.sf-port:hover circle{r:9}
.sf-port text{font-size:9px;fill:#fff;font-weight:800;text-anchor:middle;pointer-events:none}
.sf-start-chip{font-size:9px;letter-spacing:1px;fill:var(--cr-success);font-weight:800}
.sf-empty{padding:60px 20px;text-align:center;color:var(--cr-text-3);font-size:13.5px;line-height:1.7;background:var(--cr-bg);border:1px solid var(--cr-border);border-radius:12px}
.sf-flabel{font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:var(--cr-text-3);margin-right:2px;font-weight:700}
.sf-fpill{background:var(--cr-surface);border:1.5px solid var(--cr-border);color:var(--cr-text-3);padding:7px 16px;border-radius:999px;cursor:pointer;font-weight:700;font-size:13px;display:flex;align-items:center;gap:8px}
.sf-fpill-on{color:var(--cr-text);border-color:#0D9488;background:rgba(13,148,136,.08)}
.sf-fc{font-size:10.5px;color:var(--cr-text-4);font-variant-numeric:tabular-nums}
.sf-hint{font-size:11px;color:var(--cr-text-4);margin-left:auto;padding-right:6px}
.sf-chip{border:1.5px solid var(--cr-border);background:var(--cr-surface);color:var(--cr-text);padding:7px 15px;border-radius:999px;cursor:pointer;font-size:13px;font-weight:600;display:inline-flex;align-items:center;gap:8px;transition:.25s}
.sf-chip:hover{transform:translateY(-1px)}
.sf-chip-on{border-color:currentColor;box-shadow:0 0 0 1px currentColor inset}
.sf-chip .sf-dot{width:10px;height:10px;border-radius:3px;flex-shrink:0}
.sf-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px}
.sf-kpi{background:var(--cr-surface);border:1px solid var(--cr-border);border-radius:12px;padding:12px 14px 10px;position:relative;overflow:hidden;box-shadow:var(--cr-shadow-sm)}
.sf-kpi::before{content:'';position:absolute;left:0;top:0;bottom:0;width:3px;background:var(--sf-accent,#D97706)}
.sf-kpi-label{font-size:10px;letter-spacing:1.3px;text-transform:uppercase;color:var(--cr-text-3);margin-bottom:5px;font-weight:700}
.sf-kpi-value{font-variant-numeric:tabular-nums;font-weight:700;font-size:20px;color:var(--cr-text)}
.sf-proc-grid{display:grid;grid-template-columns:132px 1fr;gap:8px}
.sf-stencil{background:var(--cr-bg);border:1px solid var(--cr-border);border-radius:12px;padding:8px 6px;overflow-y:auto;max-height:66vh}
.sf-st-label{font-size:9px;letter-spacing:1.5px;text-transform:uppercase;color:var(--cr-text-3);text-align:center;margin:2px 0 8px;font-weight:700}
.sf-sttile{width:100%;background:var(--cr-surface);border:1px solid var(--cr-border);border-radius:10px;padding:6px 4px 5px;margin-bottom:6px;cursor:pointer;text-align:center;color:var(--cr-text)}
.sf-sttile:hover{border-color:var(--cr-primary)}
.sf-sttile:disabled{opacity:.5;cursor:not-allowed}
.sf-sttile svg{width:84px;height:46px;display:block;margin:0 auto}
.sf-sttile .sf-tl{font-size:9.5px;font-weight:700;display:block}
.sf-sttile .sf-tc{font-size:8.5px;color:var(--cr-text-4);font-variant-numeric:tabular-nums}
.sf-cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px}
.sf-card{background:var(--cr-surface);border:1px solid var(--cr-border);border-radius:12px;padding:12px 14px;box-shadow:var(--cr-shadow-sm)}
.sf-card small{display:block;color:var(--cr-text-4);font-size:10.5px;margin-top:4px;line-height:1.45}
.sf-card-label{font-size:10px;letter-spacing:1.3px;text-transform:uppercase;color:var(--cr-text-3);margin-bottom:5px;font-weight:700}
.sf-card-value{font-variant-numeric:tabular-nums;font-weight:700;font-size:20px;color:var(--cr-text)}
.sf-sched{padding:14px 10px;overflow-x:auto;background:var(--cr-surface);border:1px solid var(--cr-border);border-radius:12px}
.sf-s-head{display:grid;grid-template-columns:180px 1fr;font-size:10.5px;color:var(--cr-text-3);margin-bottom:6px;min-width:680px}
.sf-s-hours{position:relative;height:18px}
.sf-s-hours span{position:absolute;transform:translateX(-50%);font-variant-numeric:tabular-nums;font-size:9.5px}
.sf-s-dayl{color:#D97706;font-weight:700}
.sf-s-row{display:grid;grid-template-columns:180px 1fr;align-items:center;margin-bottom:9px;min-width:680px}
.sf-s-label{font-size:12.5px;font-weight:700;padding-right:10px;color:var(--cr-text)}
.sf-s-label small{display:block;color:var(--cr-text-3);font-weight:500;font-size:10.5px}
.sf-s-track{position:relative;height:36px;background:var(--cr-bg);border:1px solid var(--cr-border);border-radius:9px;overflow:hidden}
.sf-s-grid{position:absolute;top:0;bottom:0;width:1px;background:var(--cr-border-light)}
.sf-s-grid-day{background:var(--cr-border);width:2px}
.sf-s-blk{position:absolute;top:5px;bottom:5px;border-radius:6px;font-size:10px;font-weight:700;color:#fff;display:flex;align-items:center;justify-content:center;overflow:hidden;cursor:pointer;white-space:nowrap;border:1px solid rgba(0,0,0,.15);text-shadow:0 1px 1px rgba(0,0,0,.25)}
.sf-s-blk-crit{box-shadow:0 0 0 1.6px var(--cr-error) inset}
.sf-legend{display:flex;gap:16px;flex-wrap:wrap;margin-top:12px;padding:0 6px;font-size:11.5px;color:var(--cr-text-3)}
.sf-legend i{display:inline-block;width:13px;height:13px;border-radius:4px;margin-right:6px;vertical-align:-2px}
.sf-ztable{width:100%;border-collapse:collapse;font-size:11.5px}
.sf-ztable th{font-size:9.5px;letter-spacing:1px;text-transform:uppercase;color:var(--cr-text-3);text-align:left;padding:7px 8px;border-bottom:1px solid var(--cr-border)}
.sf-ztable td{padding:7px 8px;border-bottom:1px dashed var(--cr-border-light);font-variant-numeric:tabular-nums;color:var(--cr-text-2)}
.sf-ztable td:first-child{font-weight:600;color:var(--cr-text)}
.sf-ztable tr:hover td{background:var(--cr-bg)}
.sf-row-crit td{color:var(--cr-error)}
.sf-row-crit td:first-child::before{content:'★ ';color:var(--cr-error)}
.sf-log-day{font-weight:800;font-size:15px;margin:14px 4px 8px;color:var(--cr-text)}
.sf-log-card{display:grid;grid-template-columns:84px 1fr auto;gap:12px;align-items:center;background:var(--cr-surface);border:1px solid var(--cr-border);border-left-width:4px;border-radius:11px;padding:10px 14px;margin-bottom:8px;cursor:pointer;box-shadow:var(--cr-shadow-sm)}
.sf-log-time{font-variant-numeric:tabular-nums;font-size:12px;color:var(--cr-text-3)}
.sf-log-main{font-size:13px;color:var(--cr-text)}
.sf-log-main small{display:block;color:var(--cr-text-3);font-size:11px;margin-top:2px}
.sf-log-qty{font-variant-numeric:tabular-nums;font-weight:700;text-align:right;font-size:13px}
.sf-d-row{display:flex;justify-content:space-between;align-items:center;font-size:13px;padding:8px 2px;border-bottom:1px dashed var(--cr-border);gap:8px;color:var(--cr-text-2)}
.sf-d-row b{font-variant-numeric:tabular-nums;font-weight:700;color:var(--cr-text)}
.sf-d-sub{font-size:10px;letter-spacing:1.4px;text-transform:uppercase;color:var(--cr-text-3);margin:16px 0 6px;font-weight:700}
.sf-note{font-size:11px;color:var(--cr-text-3);margin-top:6px;line-height:1.5}
.sf-warn-box{background:var(--cr-warning-bg);color:var(--cr-warning-700,#92400E);border:1px solid var(--cr-warning,#D97706);border-radius:9px;padding:8px 10px;font-size:12px;margin-bottom:8px}
.sf-logitem{background:var(--cr-bg);border:1px solid var(--cr-border);border-radius:9px;padding:8px 10px;margin-bottom:7px;font-size:12px}
.sf-logitem-h{display:flex;justify-content:space-between;gap:8px;align-items:baseline}
.sf-logitem-ts{font-variant-numeric:tabular-nums;font-size:10px;color:var(--cr-text-4)}
.sf-logitem-q{font-variant-numeric:tabular-nums;color:#0D9488;font-size:11.5px;margin-top:3px;font-weight:600}
.sf-logform{background:var(--cr-bg);border:1px dashed var(--cr-border);border-radius:10px;padding:10px;margin-top:8px}
.sf-x{background:none;border:1px solid var(--cr-border);color:var(--cr-error);border-radius:7px;padding:0 6px;cursor:pointer;font-size:11px}
.sf-x:hover{border-color:var(--cr-error)}
.sf-pickrow{display:flex;gap:6px;flex-wrap:wrap}
.sf-pick{background:var(--cr-bg);border:1.5px solid var(--cr-border);color:var(--cr-text-2);border-radius:999px;padding:6px 13px;font-size:12px;font-weight:600;cursor:pointer}
.sf-pick-on{border-color:#0D9488;color:#0D9488;background:rgba(13,148,136,.08)}
.sf-pick-dis{opacity:.55;cursor:not-allowed}
.sf-swatch{width:26px;height:26px;border-radius:8px;border:1px solid var(--cr-border);cursor:pointer}
.sf-stage-tiles{display:grid;grid-template-columns:repeat(4,1fr);gap:7px}
.sf-sti{background:var(--cr-bg);border:1.5px solid var(--cr-border);border-radius:10px;padding:6px 2px 4px;cursor:pointer;text-align:center;color:var(--cr-text)}
.sf-sti svg{width:62px;height:36px}
.sf-sti span{display:block;font-size:9px;font-weight:700}
.sf-sti-on{border-color:#D97706;background:rgba(217,119,6,.08)}
.sf-modal-label{font-size:11px;color:var(--cr-text-3);margin:11px 0 5px;letter-spacing:.6px;text-transform:uppercase;font-weight:600}
.sf-guide{padding:18px 22px;max-width:920px;margin:0 auto;line-height:1.6;background:var(--cr-surface);border:1px solid var(--cr-border);border-radius:12px}
.sf-guide h2{font-weight:800;font-size:22px;margin:24px 0 6px;color:var(--cr-text)}
.sf-guide h2:first-child{margin-top:6px}
.sf-guide h3{font-weight:700;font-size:15px;margin:20px 0 6px;color:#D97706}
.sf-guide p{color:var(--cr-text-2);font-size:14px;margin-bottom:10px}
.sf-guide ul{margin:6px 0 12px 4px;list-style:none;padding:0}
.sf-guide li{position:relative;padding-left:24px;margin-bottom:8px;font-size:14px;color:var(--cr-text-2)}
.sf-guide li::before{content:'';position:absolute;left:4px;top:8px;width:8px;height:8px;border-radius:2px;background:#D97706}
.sf-usecards{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;margin:12px 0}
.sf-uc{background:var(--cr-bg);border:1px solid var(--cr-border);border-radius:12px;padding:14px}
.sf-uc .sf-uc-t{font-weight:800;font-size:13.5px;margin-bottom:5px;color:var(--cr-text)}
.sf-uc p{font-size:12.5px;margin:0;color:var(--cr-text-3)}
.sf-canvas-wrap:fullscreen{background:var(--cr-bg);border:none;border-radius:0}
.sf-canvas-wrap:fullscreen svg{height:100vh !important;width:100vw}
.sf-wiz-dots{display:flex;gap:6px;margin:4px 0 14px}
.sf-wiz-dots i{width:26px;height:4px;border-radius:99px;background:var(--cr-border)}
.sf-wiz-dots i.sf-on{background:#D97706}
.sf-floor-cfg{background:var(--cr-bg);border:1px solid var(--cr-border);border-radius:12px;padding:12px 14px;margin-bottom:10px}
.sf-floor-cfg-title{font-weight:800;font-size:14.5px;display:flex;align-items:center;gap:8px;color:var(--cr-text)}
.sf-floor-cfg-pin{width:9px;height:9px;border-radius:3px;background:#0D9488}
@keyframes sfPulse{0%,100%{opacity:1}50%{opacity:.3}}
@keyframes sfBlink{0%,100%{stroke-opacity:.9}50%{stroke-opacity:.12}}
@keyframes sfFlow{to{stroke-dashoffset:-14}}
@media (prefers-reduced-motion:reduce){.sf-edge,.sf-sdot,.sf-bring{animation:none}}
@media (max-width:760px){.sf-proc-grid{grid-template-columns:1fr}.sf-stencil{display:flex;max-height:none;overflow-x:auto}.sf-sttile{min-width:96px;margin:0 4px 0 0}.sf-log-card{grid-template-columns:64px 1fr}.sf-log-qty{grid-column:2;text-align:left}}
`;

/** PERT presets for the one-click standard route (hrs O/M/P per stage). */
const ROUTE_TIMES: Partial<Record<StageKey, [number, number, number]>> = {
  inward: [1, 1.5, 3],
  design: [1, 2, 4],
  marking: [1, 2, 4],
  embroidery: [8, 10, 14],
  cutting: [2, 3, 5],
  sewing: [6, 8, 12],
  finishing: [1, 2, 3],
  qc: [1, 1.5, 3],
  dispatch: [0.5, 1, 1.5],
};
const ROUTE_SKIP: StageKey[] = ['handwork', 'washing', 'packing'];

export default function ShopFloorPage() {
  const { currentWorkspaceId } = useWorkspaceStore();
  const { entitlements, isHydrated } = useSubscriptionStore();
  const { loading: permissionsLoading, can: canPermission } = useMyPermissions();
  const [msgApi, ctx] = message.useMessage();

  const [machines, setMachines] = useState<Machine[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [orders, setOrders] = useState<WorkOrder[]>([]);
  const [openDowntime, setOpenDowntime] = useState<Map<string, DowntimeEntry>>(new Map());
  const [configs, setConfigs] = useState<ShopFloorConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [setupOpen, setSetupOpen] = useState(false);

  const [filter, setFilter] = useState<string>('ALL');
  const [tab, setTab] = useState('floor');
  const [unlocked, setUnlocked] = useState(false);
  const [curLocationId, setCurLocationId] = useState<string | null>(null);
  const [curOrderId, setCurOrderId] = useState<string | null>(null);
  const [detail, setDetail] = useState<DetailTarget | null>(null);
  const [busy, setBusy] = useState(false);

  const [orderModal, setOrderModal] = useState<{ open: boolean; editId: string | null }>({
    open: false,
    editId: null,
  });
  const [stepModal, setStepModal] = useState<{
    open: boolean;
    orderId: string | null;
    editStepId: string | null;
    presetStage?: StageKey;
  }>({ open: false, orderId: null, editStepId: null });

  const machinesModuleAccess = entitlements?.moduleAccess?.find((m) => m.module === 'machines');
  const hasAccess = machinesModuleAccess?.enabled ?? false;
  // Same write gate as the machines list page (machines_basic sub-feature);
  // the backend re-checks RBAC on every work-order route.
  const canManage =
    hasAccess &&
    machinesModuleAccess?.subFeatures?.find((sf) => sf.key === 'machines_basic')?.access !==
      'locked';

  const load = useCallback(async () => {
    if (!currentWorkspaceId || !hasAccess) return;
    startTransition(() => setLoading(true));
    try {
      // Each fetch is fail-soft: one failing source (e.g. work orders) must
      // never blank the floors/machines/people the wizard depends on. Core
      // refs (machines/locations/team) surface their error via msgApi.
      const [m, l, t, wo, dt, cfg] = await Promise.all([
        listMachines(currentWorkspaceId),
        listLocations(currentWorkspaceId),
        listTeam(currentWorkspaceId, { status: 'active', limit: 500 }),
        listWorkOrders(currentWorkspaceId).catch(() => [] as WorkOrder[]),
        listDowntimeForWorkspace(currentWorkspaceId, { status: 'open', limit: 500 }).catch(() => ({
          items: [],
          total: 0,
        })),
        listShopFloorConfigs(currentWorkspaceId).catch(() => [] as ShopFloorConfig[]),
      ]);
      startTransition(() => {
        setMachines(m);
        setLocations(l);
        setTeam(t.members ?? []);
        setOrders(wo);
        setConfigs(cfg);
        const map = new Map<string, DowntimeEntry>();
        for (const e of dt.items ?? []) if (!e.endAt) map.set(e.machineId, e);
        setOpenDowntime(map);
        setCurLocationId((prev) => prev ?? (l[0] ? lid(l[0]) : null));
        setCurOrderId((prev) => prev ?? wo[0]?.id ?? null);
      });
    } catch (e) {
      msgApi.error(parseApiError(e));
    } finally {
      setLoading(false);
    }
  }, [currentWorkspaceId, hasAccess, msgApi]);

  useEffect(() => {
    load();
  }, [load]);

  const data: ShopFloorData = useMemo(
    () => ({ orders, machines, locations, team, openDowntime, configs }),
    [orders, machines, locations, team, openDowntime, configs],
  );

  // ── KPIs (all derived) ────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const scopedOrders = filter === 'ALL' ? orders : orders.filter((o) => o.id === filter);
    const steps = scopeSteps(orders, filter);
    const value = scopedOrders.reduce((t, o) => t + o.qty * o.ratePerUnit, 0);
    const wages = steps.reduce((t, s) => t + stepWages(s), 0);
    const done = steps.reduce((t, s) => t + stepQty(s), 0);
    const prog = steps.length ? steps.reduce((t, s) => t + s.progress, 0) / steps.length : 0;
    const up = machines.filter((m) => m.status === 'active' && !openDowntime.has(mid(m))).length;
    const total = machines.filter((m) => m.status !== 'retired').length;
    const cp = cpmCalc(steps).dur;
    return { value, wages, done, prog, up, total, cp };
  }, [orders, machines, openDowntime, filter]);

  const accent =
    filter === 'ALL' ? '#D97706' : (orders.find((o) => o.id === filter)?.colorHex ?? '#D97706');

  // ── Mutation plumbing - every call returns the full order; swap it in ─────
  const replaceOrder = useCallback((updated: WorkOrder) => {
    setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
  }, []);

  const mutate = useCallback(
    async (op: () => Promise<WorkOrder>, ok?: string) => {
      if (!currentWorkspaceId) return;
      setBusy(true);
      try {
        replaceOrder(await op());
        if (ok) msgApi.success(ok);
      } catch (e) {
        msgApi.error(parseApiError(e));
      } finally {
        setBusy(false);
      }
    },
    [currentWorkspaceId, replaceOrder, msgApi],
  );

  const wsId = currentWorkspaceId ?? '';

  const handleSaveOrder = async (
    payload: CreateWorkOrderPayload & UpdateWorkOrderPayload,
    editId?: string | null,
  ) => {
    if (!wsId) return;
    setBusy(true);
    try {
      if (editId) {
        replaceOrder(await updateWorkOrder(wsId, editId, payload));
        msgApi.success('Order updated');
      } else {
        const created = await createWorkOrder(wsId, payload);
        setOrders((prev) => [...prev, created]);
        setCurOrderId(created.id);
        msgApi.success(`${created.code} added - build its route in Process`);
      }
      setOrderModal({ open: false, editId: null });
    } catch (e) {
      msgApi.error(parseApiError(e));
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteOrder = async (orderId: string) => {
    if (!wsId) return;
    try {
      await deleteWorkOrder(wsId, orderId);
      setOrders((prev) => prev.filter((o) => o.id !== orderId));
      if (filter === orderId) setFilter('ALL');
      if (curOrderId === orderId) setCurOrderId(null);
      setDetail(null);
      msgApi.success('Order deleted');
    } catch (e) {
      msgApi.error(parseApiError(e));
    }
  };

  const handleSaveStep = async (
    payload: CreateWorkOrderStepPayload,
    editStepId?: string | null,
  ) => {
    const orderId = stepModal.orderId;
    if (!orderId) return;
    await mutate(
      () =>
        editStepId
          ? updateWorkOrderStep(wsId, orderId, editStepId, payload)
          : addWorkOrderStep(wsId, orderId, payload),
      editStepId ? 'Step updated' : 'Step added - flow, CPM, PERT & floor all updated',
    );
    setStepModal({ open: false, orderId: null, editStepId: null });
  };

  const handleLink = async (orderId: string, srcId: string, dstId: string) => {
    const order = orders.find((o) => o.id === orderId);
    const dst = order?.steps.find((s) => s.id === dstId);
    if (!dst) return;
    await mutate(() => updateWorkOrderStep(wsId, orderId, dstId, { deps: [...dst.deps, srcId] }));
  };

  const handleUnlink = async (orderId: string, stepId: string, depId: string) => {
    const order = orders.find((o) => o.id === orderId);
    const step = order?.steps.find((s) => s.id === stepId);
    if (!step) return;
    await mutate(() =>
      updateWorkOrderStep(wsId, orderId, stepId, { deps: step.deps.filter((d) => d !== depId) }),
    );
  };

  const handleMoveStep = async (orderId: string, stepId: string, x: number, y: number) => {
    // Position-only patch; failure is non-fatal (layout snaps back on reload).
    try {
      replaceOrder(await updateWorkOrderStep(wsId, orderId, stepId, { posX: x, posY: y }));
    } catch {
      /* keep the optimistic position for this session */
    }
  };

  const handleStandardRoute = async (orderId: string) => {
    if (!wsId) return;
    setBusy(true);
    try {
      let prev: string | null = null;
      let latest: WorkOrder | null = null;
      for (const k of ROUTE_ORDER) {
        if (ROUTE_SKIP.includes(k)) continue;
        const st = STAGE[k];
        const machineIds = st.station
          ? machines
              .filter((m) => m.status !== 'retired' && machineArtKind(m.type) === k)
              .slice(0, k === 'embroidery' ? 2 : 1)
              .map(mid)
          : [];
        if (st.station && !machineIds.length) continue;
        const [o, m, p] = ROUTE_TIMES[k] ?? [1, 2, 4];
        latest = await addWorkOrderStep(wsId, orderId, {
          name: st.label,
          stage: k,
          machineIds,
          deps: prev ? [prev] : [],
          optimisticHrs: o,
          likelyHrs: m,
          pessimisticHrs: p,
          wageRate: st.rate,
        });
        prev = latest.steps[latest.steps.length - 1]?.id ?? null;
      }
      if (latest) replaceOrder(latest);
      msgApi.success('Standard route laid - adjust it step by step');
    } catch (e) {
      msgApi.error(parseApiError(e));
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteStep = (orderId: string, stepId: string) => {
    setDetail(null);
    void mutate(() => deleteWorkOrderStep(wsId, orderId, stepId), 'Step deleted');
  };

  const handleAddEntry = async (
    orderId: string,
    stepId: string,
    payload: CreateWorkOrderStepEntryPayload,
  ) => {
    await mutate(() => addWorkOrderStepEntry(wsId, orderId, stepId, payload), 'Entry logged');
  };

  const handleDeleteEntry = (orderId: string, stepId: string, entryId: string) => {
    void mutate(() => deleteWorkOrderStepEntry(wsId, orderId, stepId, entryId));
  };

  const handleMachineStatus = async (machineId: string, status: MachineStatus) => {
    if (!wsId) return;
    try {
      await updateMachine(wsId, machineId, { status });
      setMachines((prev) => prev.map((m) => (mid(m) === machineId ? { ...m, status } : m)));
      msgApi.success('Machine status updated');
    } catch (e) {
      msgApi.error(parseApiError(e));
    }
  };

  /**
   * Apply the ⚙ Setup wizard: PATCH changed machines' floorTag (machines
   * module stays the single source for machine→floor) and upsert the
   * ShopFloorConfig (floors + people links), then refresh both.
   */
  const handleApplySetup = async (payload: SetupApplyPayload) => {
    if (!wsId) return;
    setBusy(true);
    try {
      const changed = Object.entries(payload.machineFloors).filter(([machineId, floor]) => {
        const m = machines.find((mm) => mid(mm) === machineId);
        return m && (m.floorTag?.trim() ?? '') !== floor;
      });
      for (const [machineId, floor] of changed) {
        await updateMachine(wsId, machineId, { floorTag: floor });
      }
      await upsertShopFloorConfig(wsId, {
        locationId: payload.locationId,
        floors: payload.floors.map((name) => ({ name })),
        people: Object.entries(payload.peopleFloors).map(([teamMemberId, floor]) => ({
          teamMemberId,
          floor,
        })),
      });
      const [m, cfg] = await Promise.all([listMachines(wsId), listShopFloorConfigs(wsId)]);
      setMachines(m);
      setConfigs(cfg);
      setCurLocationId(payload.locationId);
      setSetupOpen(false);
      msgApi.success('Floors saved - machines and people are placed');
    } catch (e) {
      msgApi.error(parseApiError(e));
    } finally {
      setBusy(false);
    }
  };

  const handleMachineMove = async (machineId: string, locationId: string) => {
    if (!wsId) return;
    try {
      await updateMachine(wsId, machineId, { locationId });
      setMachines((prev) => prev.map((m) => (mid(m) === machineId ? { ...m, locationId } : m)));
      msgApi.success('Machine moved');
    } catch (e) {
      msgApi.error(parseApiError(e));
    }
  };

  /** Floor within the location - writes Machine.floorTag (machines module). */
  const handleMachineFloorTag = async (machineId: string, floorTag: string) => {
    if (!wsId) return;
    try {
      await updateMachine(wsId, machineId, { floorTag });
      setMachines((prev) => prev.map((m) => (mid(m) === machineId ? { ...m, floorTag } : m)));
      msgApi.success('Machine floor updated');
    } catch (e) {
      msgApi.error(parseApiError(e));
    }
  };

  // ── Gates (mirrors machines list page) ────────────────────────────────────
  if (!isHydrated) return <Skeleton active paragraph={{ rows: 10 }} />;
  if (!hasAccess) return <ModuleLockedPage module="machines" />;
  if (permissionsLoading) return <Skeleton active paragraph={{ rows: 10 }} />;
  if (!canPermission('machines', 'view')) {
    return (
      <DsCard>
        <DsEmptyState
          title="Access Denied"
          sub="You do not have permission to view machines. Contact your workspace owner to request access."
        />
      </DsCard>
    );
  }

  const tabItems = [
    {
      key: 'floor',
      label: '🏭 Floor',
      children: (
        <FloorView
          data={data}
          wsId={wsId}
          filter={filter}
          curLocationId={curLocationId}
          onLocationChange={setCurLocationId}
          unlocked={unlocked}
          canManage={canManage}
          onOpenDetail={setDetail}
          onOpenSetup={() => setSetupOpen(true)}
        />
      ),
    },
    {
      key: 'process',
      label: '🔀 Process',
      children: (
        <ProcessView
          data={data}
          curOrderId={curOrderId}
          onOrderChange={setCurOrderId}
          unlocked={unlocked}
          canManage={canManage}
          onOpenDetail={setDetail}
          onOpenStepModal={(orderId, stepId, presetStage) =>
            setStepModal({ open: true, orderId, editStepId: stepId ?? null, presetStage })
          }
          onLink={handleLink}
          onUnlink={handleUnlink}
          onMoveStep={handleMoveStep}
          onStandardRoute={handleStandardRoute}
        />
      ),
    },
    {
      key: 'sched',
      label: '📊 Schedule',
      children: <ScheduleView data={data} filter={filter} onOpenDetail={setDetail} />,
    },
    {
      key: 'cpm',
      label: '🕸 CPM',
      children: <CpmView data={data} filter={filter} onOpenDetail={setDetail} />,
    },
    {
      key: 'pert',
      label: '🎲 PERT',
      children: <PertView data={data} filter={filter} onOpenDetail={setDetail} />,
    },
    {
      key: 'log',
      label: '📋 Daily Log',
      children: <DailyLogView data={data} filter={filter} onOpenDetail={setDetail} />,
    },
    {
      key: 'guide',
      label: 'ℹ️ Guide',
      children: (
        <div className="sf-guide">
          <h2>What Shop Floor is for</h2>
          <p>
            A live control board for a unit running machines across one or more floors. There are{' '}
            <b>no sensors</b> - a supervisor logs quantity and progress by hand on each step, and
            that one record drives everything: the floor map, the process flow, the schedule, CPM,
            PERT, wages and the daily log. Machines, floors (locations) and people are the same
            records you manage in the Machines and Team modules - change them there and this board
            updates.
          </p>
          <div className="sf-usecards">
            <div className="sf-uc">
              <div className="sf-uc-t">🏭 Floor + live process</div>
              <p>
                Each floor shows its machines with status (breakdown comes from open downtime), the
                running step under each machine, and the order routes drawn as arrows.
              </p>
            </div>
            <div className="sf-uc">
              <div className="sf-uc-t">🔀 Visio-style builder</div>
              <p>
                Click a stencil to drop a step. Click the orange ▸ out-port then a teal ◂ in-port to
                wire steps. Click an arrow to unlink.
              </p>
            </div>
            <div className="sf-uc">
              <div className="sf-uc-t">🎯 Series &amp; parallel</div>
              <p>
                No “comes after” = a parallel START. Two steps after the same step run in parallel.
                2+ machines on one step run it in parallel (∥).
              </p>
            </div>
            <div className="sf-uc">
              <div className="sf-uc-t">🕸 CPM &amp; 🎲 PERT</div>
              <p>
                Critical path, slack, expected duration, σ and a finish-by-date probability - all
                from the same route.
              </p>
            </div>
            <div className="sf-uc">
              <div className="sf-uc-t">📋 Honest manual log</div>
              <p>
                Every entry records who logged it (you), how much and when. Wages and progress are
                computed from those entries.
              </p>
            </div>
            <div className="sf-uc">
              <div className="sf-uc-t">🔓 Move &amp; zoom freely</div>
              <p>
                Scroll to zoom, drag to pan. Unlock layout to drag machines, people and step cards
                to match your real floor.
              </p>
            </div>
          </div>
          <h2>How to use it</h2>
          <h3>1 · Set up floors &amp; machines (once)</h3>
          <ul>
            <li>
              Floors are your <b>Locations</b> (Machines → Locations); machines are managed in{' '}
              <b>Machines</b>. People come from <b>Team</b>.
            </li>
          </ul>
          <h3>2 · Add an order and build its route</h3>
          <ul>
            <li>＋ Order (top right) → open the Process tab → ✨ Standard route or stencils.</li>
            <li>In the step dialog pick stage, machines, the karigar and the O/M/P estimate.</li>
          </ul>
          <h3>3 · Log work daily</h3>
          <ul>
            <li>
              Click any step → ＋ Log entry: qty done, progress %, a note. It is timestamped under
              your name and updates every view.
            </li>
          </ul>
          <h3>4 · Plan &amp; protect dates</h3>
          <ul>
            <li>
              Schedule maps the route on shift hours; CPM shows the critical path; PERT gives a
              probability for any target date. Filter everything with the order chips on top.
            </li>
          </ul>
        </div>
      ),
    },
  ];

  return (
    <>
      {ctx}
      <style dangerouslySetInnerHTML={{ __html: SF_STYLES }} />
      <div
        className={`sf-root ${unlocked ? 'sf-unlocked' : ''}`}
        style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
      >
        <DsPageHeader
          title="Shop Floor"
          sub="One source of truth - floors, machines, people, orders and hand-logged progress."
          icon={<ApartmentOutlined />}
          right={
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {canManage && (
                <DsButton
                  dsVariant="ghost"
                  icon={<SettingOutlined />}
                  onClick={() => setSetupOpen(true)}
                >
                  Setup
                </DsButton>
              )}
              <DsButton
                dsVariant={unlocked ? 'secondary' : 'ghost'}
                icon={unlocked ? <UnlockOutlined /> : <LockOutlined />}
                onClick={() => setUnlocked((v) => !v)}
              >
                {unlocked ? 'Layout unlocked - drag things' : 'Layout locked'}
              </DsButton>
              {canManage && (
                <DsButton
                  dsVariant="primary"
                  icon={<PlusOutlined />}
                  onClick={() => setOrderModal({ open: true, editId: null })}
                >
                  Order
                </DsButton>
              )}
            </div>
          }
        />

        {/* Order filter chips */}
        <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
          <button
            type="button"
            className={`sf-chip ${filter === 'ALL' ? 'sf-chip-on' : ''}`}
            style={{ color: 'var(--cr-text)' }}
            onClick={() => setFilter('ALL')}
          >
            <span
              className="sf-dot"
              style={{ background: 'linear-gradient(90deg,#D97706,#0D9488,#DB2777)' }}
            />
            All Orders
          </button>
          {orders.map((o) => (
            <button
              key={o.id}
              type="button"
              className={`sf-chip ${filter === o.id ? 'sf-chip-on' : ''}`}
              style={{ color: o.colorHex }}
              onClick={() => {
                setFilter(o.id);
                setCurOrderId(o.id);
                setDetail({ kind: 'order', id: o.id });
              }}
            >
              <span className="sf-dot" style={{ background: o.colorHex }} />
              {o.code} - {o.partyName}
            </button>
          ))}
        </div>

        {/* Derived KPIs */}
        <div className="sf-kpis" style={{ ['--sf-accent' as string]: accent }}>
          {(
            [
              ['Order Value', fmtINR(kpis.value)],
              ['Wages (logged)', fmtINR(kpis.wages)],
              ['Qty Logged', `${kpis.done} pcs`],
              ['Progress', `${kpis.prog.toFixed(0)}%`],
              ['Machines Up', `${kpis.up} / ${kpis.total}`],
              ['Critical Path', `${kpis.cp.toFixed(1)} hr`],
            ] as const
          ).map(([label, value]) => (
            <div key={label} className="sf-kpi">
              <div className="sf-kpi-label">{label}</div>
              <div className="sf-kpi-value">{value}</div>
            </div>
          ))}
        </div>

        {loading ? (
          <Skeleton active paragraph={{ rows: 10 }} />
        ) : (
          <Tabs activeKey={tab} onChange={setTab} items={tabItems} />
        )}
      </div>

      <DetailDrawer
        target={detail}
        data={data}
        canManage={canManage}
        busy={busy}
        onClose={() => setDetail(null)}
        onOpenDetail={setDetail}
        onEditStep={(orderId, stepId) => {
          setDetail(null);
          setStepModal({ open: true, orderId, editStepId: stepId });
        }}
        onDeleteStep={handleDeleteStep}
        onAddEntry={handleAddEntry}
        onDeleteEntry={handleDeleteEntry}
        onEditOrder={(orderId) => {
          setDetail(null);
          setOrderModal({ open: true, editId: orderId });
        }}
        onDeleteOrder={handleDeleteOrder}
        onShowInProcess={(orderId) => {
          setCurOrderId(orderId);
          setDetail(null);
          setTab('process');
        }}
        onMachineStatus={handleMachineStatus}
        onMachineMove={handleMachineMove}
        onMachineFloorTag={handleMachineFloorTag}
      />

      <OrderModal
        open={orderModal.open}
        editOrder={
          orderModal.editId ? (orders.find((o) => o.id === orderModal.editId) ?? null) : null
        }
        saving={busy}
        onCancel={() => setOrderModal({ open: false, editId: null })}
        onSave={handleSaveOrder}
      />

      <SetupWizard
        open={setupOpen}
        data={data}
        defaultLocationId={curLocationId}
        saving={busy}
        onCancel={() => setSetupOpen(false)}
        onApply={handleApplySetup}
      />

      <StepModal
        open={stepModal.open}
        data={data}
        orderId={stepModal.orderId}
        editStepId={stepModal.editStepId}
        presetStage={stepModal.presetStage}
        saving={busy}
        onCancel={() => setStepModal({ open: false, orderId: null, editStepId: null })}
        onSave={handleSaveStep}
      />
    </>
  );
}
