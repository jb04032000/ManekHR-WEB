/**
 * Which product surface a shortcut applies to.
 *  - `all` (default) - truly app-wide; bound and listed on every product.
 *  - `erp` - bound + listed only on /dashboard/* (the ERP module-nav chords
 *    route into the ERP shell where the workspace gate would bounce a
 *    workspace-less Connect-only user).
 *  - `connect` - bound + listed only on /connect/* (e.g. a chord whose
 *    target page only makes sense from Connect).
 *  - `account` - bound + listed only on /account/* (the product-neutral
 *    account-settings surface; reserved - currently every account chord is
 *    `all` so it stays reachable from any product).
 *
 * The field also accepts a `readonly` array of surfaces - useful for chords
 * that belong on more than one but not all (the product-switchers `g>e` and
 * `g>c` are visible on the OTHER two products, never on the target itself).
 */
export type ShortcutSurface = 'all' | 'erp' | 'connect' | 'account';

export interface ShortcutDef {
  /**
   * `react-hotkeys-hook` v5 key string. Combos use `+` (e.g. `mod+k`,
   * `shift+/`), sequences use `>` (e.g. `g>s` = press g, then s).
   * Space-separated tokens are NOT a sequence in v5.
   */
  keys: string;
  /** Human-readable description shown in the shortcuts drawer. */
  label: string;
  /** `global` for app-wide bindings, otherwise the module key (e.g. `team`). */
  scope: 'global' | string;
  /**
   * Action to run on key press. Either a navigable pathname (string) or an
   * arbitrary handler. The string variant is invoked via Next.js router by
   * the KeyboardShortcutProvider; the function variant runs as-is.
   */
  action: string | (() => void);
  /**
   * Allow this shortcut to fire while the user is typing inside form tags
   * (input/textarea/select/contenteditable). Defaults to false. Set true
   * for shortcuts whose intent is "do this with what I'm typing" - e.g.
   * Cmd+S to save, where blocking inside inputs would feel broken.
   */
  enableInForms?: boolean;
  /**
   * `react-hotkeys-hook`: when true, match by `event.key` (typed character)
   * instead of `event.code` (physical key). Defaults to false. Set true ONLY
   * for bindings whose token is a printable char that differs from its
   * physical key code (e.g. `?` produced by Shift+/, `/` itself). For modifier
   * combos like `mod+s`, leave false - `useKey: true` loses strict modifier
   * gating in v5 and the binding will fire on bare `s` inside form tags when
   * `enableInForms` is also true.
   */
  useKey?: boolean;
  /**
   * Which product surface(s) this chord applies to (see `ShortcutSurface`).
   * Defaults to `all`. Drives BOTH the cheat-sheet display + the provider
   * binding - a chord with `surface: 'erp'` is never bound on /connect/*
   * (so it cannot fire there) and never listed in the Connect cheat-sheet.
   * Accepts an array for chords that belong on more than one product but
   * not all (the cross-product switchers are visible on the OTHER products,
   * never on their own target).
   */
  surface?: ShortcutSurface | readonly ShortcutSurface[];
}

/**
 * Window event dispatched when the global `shift+?` hotkey fires. The
 * `KeyboardShortcutsButton` listens for this and opens its drawer. Single
 * surface for shortcut help - no duplicate Modal lives in the provider.
 */
export const SHORTCUTS_OPEN_EVENT = 'cr:open-shortcuts';

/**
 * Translate `react-hotkeys-hook` tokens to user-facing glyphs. `mod` is the
 * portable binding (Ctrl on Win/Linux, ⌘ on Mac) - render the platform
 * equivalent so the cheat-sheet matches what the user actually presses.
 * Single canonical formatter consumed by the shortcuts drawer.
 */
export function displayPart(part: string): string {
  const lower = part.toLowerCase();
  const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
  if (lower === 'mod') return isMac ? '⌘' : 'Ctrl';
  if (lower === 'shift') return isMac ? '⇧' : 'Shift';
  if (lower === 'alt') return isMac ? '⌥' : 'Alt';
  if (lower === 'meta') return isMac ? '⌘' : 'Win';
  return part.length === 1 ? part.toUpperCase() : part;
}

export const GLOBAL_SHORTCUTS: ShortcutDef[] = [
  // ── Truly app-wide (surface: 'all', the default) - both products. ─────────
  {
    keys: 'shift+?',
    label: 'Open shortcuts list',
    scope: 'global',
    action: () => {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event(SHORTCUTS_OPEN_EVENT));
      }
    },
    useKey: true,
  },
  // Sidebar toggle - VSCode / Cursor convention. Provider runs with
  // `enableOnFormTags: false` so this won't fire while typing in inputs
  // (bold-in-input still works inside contenteditable / Antd form tags).
  // Click-by-data-attr instead of holding a setter ref so the registry
  // stays decoupled from layout state.
  {
    keys: 'mod+b',
    label: 'Toggle sidebar',
    scope: 'global',
    action: () => {
      const btn = document.querySelector<HTMLButtonElement>('[data-shortcut="sidebar-toggle"]');
      btn?.click();
    },
  },
  // Save / advance - Cmd+S on Mac, Ctrl+S on Win/Linux. Pages opt-in by
  // tagging their primary action button with `data-shortcut="save"`.
  // Disabled buttons match the selector but `.click()` no-ops on them, so
  // the gating naturally inherits each button's own disabled rules
  // (e.g. detail-page Save is disabled when !isDirty). `enableInForms`
  // is true: users press Cmd+S while typing in fields and expect to save
  // what they typed; gating it to outside-the-form would feel broken.
  {
    keys: 'mod+s',
    label: 'Save / continue',
    scope: 'global',
    enableInForms: true,
    action: () => {
      const btn = document.querySelector<HTMLButtonElement>('[data-shortcut="save"]');
      btn?.click();
    },
  },
  // Fullscreen toggle - mirrors browser F11 but bound through our header
  // button so `aria-pressed` + Tooltip stay in sync. Click-by-data-attr
  // keeps the registry decoupled from layout state.
  {
    keys: 'mod+shift+f',
    label: 'Toggle fullscreen',
    scope: 'global',
    action: () => {
      const btn = document.querySelector<HTMLButtonElement>('[data-shortcut="fullscreen-toggle"]');
      btn?.click();
    },
  },

  // ── Cross-product switchers ───────────────────────────────────────────────
  // Each fires from the OTHER products - switchers are bound/listed on every
  // surface EXCEPT the target itself. Mirrors the sidebar ModeSwitcher.
  {
    keys: 'g>e',
    label: 'Switch to ERP',
    scope: 'global',
    surface: ['connect', 'account'],
    action: '/dashboard',
  },
  {
    keys: 'g>c',
    label: 'Switch to Connect',
    scope: 'global',
    surface: ['erp', 'account'],
    action: '/connect/feed',
  },

  // ── ERP-only navigation chords (surface: 'erp') ───────────────────────────
  // These route into the ERP shell, where the workspace gate would bounce a
  // workspace-less Connect-only user back to setup-workspace. Bound + listed
  // only on /dashboard/* so they neither break for Connect users nor clutter
  // the Connect cheat-sheet.
  { keys: 'g>h', label: 'Go home', scope: 'global', surface: 'erp', action: '/' },
  {
    keys: 'g>d',
    label: 'Go to dashboard',
    scope: 'global',
    surface: 'erp',
    action: '/dashboard',
  },
  {
    keys: 'g>t',
    label: 'Go to team',
    scope: 'global',
    surface: 'erp',
    action: '/dashboard/team',
  },
  {
    keys: 'g>a',
    label: 'Go to attendance',
    scope: 'global',
    surface: 'erp',
    action: '/dashboard/attendance',
  },
  {
    keys: 'g>l',
    label: 'Go to leave',
    scope: 'global',
    surface: 'erp',
    action: '/dashboard/leave',
  },
  {
    keys: 'g>w',
    label: 'Go to workspace settings',
    scope: 'global',
    surface: 'erp',
    action: '/dashboard/workspace',
  },
  // Account-level routes live at /account/* (product-neutral surface). They
  // are reachable from every product - Connect users, ERP users, and account
  // pages themselves all benefit - so surface defaults to `all` (omitted).
  { keys: 'g>s', label: 'Go to account settings', scope: 'global', action: '/account' },
  {
    keys: 'g>k',
    label: 'Go to security settings',
    scope: 'global',
    action: '/account/security',
  },
  { keys: 'g>v', label: 'Go to devices', scope: 'global', action: '/account/devices' },
  { keys: 'g>b', label: 'Go to billing', scope: 'global', action: '/account/billing' },
];

export const MODULE_SHORTCUTS: Record<string, ShortcutDef[]> = {
  // Connect runs as a separate product surface with its own sidebar and routes.
  // Its navigation chords intentionally live HERE, not in GLOBAL_SHORTCUTS: a
  // GLOBAL chord fires app-wide and lists in the ERP cheat-sheet, but a /connect
  // route only makes sense from Connect. Scoping them to the `connect` module
  // binds them on /connect/* only and keeps the ERP shortcut list uncluttered.
  connect: [
    { keys: 'g>f', label: 'Go to feed', scope: 'connect', action: '/connect/feed' },
    { keys: 'g>n', label: 'Go to my network', scope: 'connect', action: '/connect/network' },
    { keys: 'g>p', label: 'Go to my profile', scope: 'connect', action: '/connect/profile' },
    {
      keys: '/',
      label: 'Focus search',
      scope: 'connect',
      useKey: true,
      action: () => {
        const el = document.querySelector<HTMLInputElement>('[data-shortcut="connect-search"]');
        el?.focus();
        el?.select?.();
      },
    },
  ],
  // Module entries hold context-sensitive ACTION shortcuts only (single-key
  // operations on page elements). Navigation chords live in GLOBAL_SHORTCUTS
  // so they fire from anywhere.
  team: [
    {
      keys: 'n',
      label: 'New team member',
      scope: 'team',
      action: () => {
        const btn = document.querySelector<HTMLButtonElement>('[data-shortcut="team-add"]');
        btn?.click();
      },
    },
    {
      keys: '/',
      label: 'Focus search',
      scope: 'team',
      useKey: true,
      action: () => {
        const el = document.querySelector<HTMLInputElement>('[data-shortcut="team-search"]');
        el?.focus();
        el?.select?.();
      },
    },
    {
      keys: 'f',
      label: 'Cycle filter chip',
      scope: 'team',
      action: () => {
        const chips = Array.from(
          document.querySelectorAll<HTMLButtonElement>('[data-shortcut="team-filter-chip"]'),
        );
        if (chips.length === 0) return;
        const idx = chips.findIndex((c) => c.getAttribute('aria-pressed') === 'true');
        const next = chips[(idx + 1) % chips.length];
        next?.click();
      },
    },
  ],
  attendance: [
    {
      keys: 'n',
      label: 'New policy',
      scope: 'attendance',
      action: () => {
        const btn = document.querySelector<HTMLButtonElement>('[data-shortcut="new-policy"]');
        btn?.click();
      },
    },
    {
      keys: '/',
      label: 'Focus search',
      scope: 'attendance',
      useKey: true,
      action: () => {
        const el = document.querySelector<HTMLInputElement>('[data-shortcut="attendance-search"]');
        el?.focus();
        el?.select?.();
      },
    },
  ],
  leave: [
    {
      keys: 'n',
      label: 'New leave type',
      scope: 'leave',
      action: () => {
        const btn = document.querySelector<HTMLButtonElement>('[data-shortcut="new-leave-type"]');
        btn?.click();
      },
    },
  ],
};

/**
 * The active product surface for a given module key.
 *  - `'connect'` module ⇒ Connect surface.
 *  - `'account'` module ⇒ Account surface (product-neutral settings).
 *  - any other module (team, attendance, … plus the catch-all `'dashboard'`)
 *    ⇒ ERP surface.
 * Drives the surface filter below.
 */
function moduleSurface(module: string): 'erp' | 'connect' | 'account' {
  if (module === 'connect') return 'connect';
  if (module === 'account') return 'account';
  return 'erp';
}

export function getShortcutsForModule(module: string): ShortcutDef[] {
  const product = moduleSurface(module);
  const all = [...GLOBAL_SHORTCUTS, ...(MODULE_SHORTCUTS[module] ?? [])];
  // A chord with no `surface` is treated as `'all'` (the documented default)
  // and is kept on every product. A scalar surface keeps the chord only on
  // that one product. An array of surfaces keeps it on each listed product
  // (the cross-product switchers `g>e` and `g>c` use this - visible on every
  // surface EXCEPT their own target).
  return all.filter((s) => {
    const surf = s.surface ?? 'all';
    const list: readonly ShortcutSurface[] = Array.isArray(surf) ? surf : [surf];
    return list.includes('all') || list.includes(product);
  });
}

export function hasShortcutsForModule(module: string): boolean {
  // Globals always exist (`Shift+?`, `g>h`, `g>d`, navigation chords) so the
  // cheat-sheet drawer is meaningful on every dashboard route - even if a
  // module has no context-specific actions yet.
  return GLOBAL_SHORTCUTS.length > 0 || (MODULE_SHORTCUTS[module]?.length ?? 0) > 0;
}

// Path-prefix → module-key map. Consumed by KeyboardShortcutProvider (to bind
// the right MODULE_SHORTCUTS for the current route) AND by TopHeader (to
// derive the module slug for the breadcrumb-row HeaderRightActions mount).
// Single source of truth so the two never drift.
export const PATH_TO_MODULE_MAP: Record<string, string> = {
  // Connect is a separate product surface; any /connect/* route maps to the
  // single `connect` bucket so the provider binds MODULE_SHORTCUTS.connect.
  '/connect': 'connect',
  // Account is the product-neutral settings surface. Mapping it to its own
  // module name lets `moduleSurface` resolve `/account/*` to the `account`
  // product so the cheat-sheet filters out ERP-only chords there (g>t/a/w/h/d).
  '/account': 'account',
  '/dashboard/team': 'team',
  '/dashboard/attendance': 'attendance',
  '/dashboard/leave': 'leave',
  '/dashboard/salary': 'salary',
  '/dashboard/shifts': 'shifts',
  '/dashboard/holidays': 'holidays',
  '/dashboard/bills': 'bills',
  '/dashboard/roles': 'roles',
  '/dashboard/settings': 'settings',
  '/dashboard/profile': 'settings',
  '/dashboard/workspace': 'workspace-management',
  '/account/subscription': 'subscription',
  '/dashboard/finance': 'finance',
  '/dashboard/machines': 'machines',
  '/dashboard/maintenance': 'maintenance',
  '/dashboard/parties': 'parties',
  '/dashboard/production-utilisation': 'machines',
};

/**
 * Reverse lookup - find the chord keys whose action navigates to the given
 * path. Used by Tooltip hints on sidebar nav items so a user hovering a
 * link learns the chord that fires it. `undefined` when no chord binds to
 * that path. Function-action chords (e.g. `mod+b` toggle sidebar) are not
 * reachable here - for those, use the `FN_CHORDS` constants below.
 *
 * Pass `surface` (the product the hint renders on) to get the chord that is
 * actually pressable THERE. Without it the first match wins, which lets a
 * cross-product switcher shadow the real chord: `/connect/feed` is the action
 * of BOTH `g>c` ("Switch to Connect", bound on erp/account only) and the
 * Connect module chord `g>f`. On the Connect rail we must teach `g>f`, not the
 * inert `g>c`. The filter reuses the same `surface ?? 'all'` rule as
 * `getShortcutsForModule`, so a chord is returned only when bound on `surface`
 * (else `undefined`). Keep in sync with that filter.
 */
export function getChordKeysForPath(path: string, surface?: ShortcutSurface): string | undefined {
  const matches: ShortcutDef[] = [];
  for (const s of GLOBAL_SHORTCUTS) {
    if (typeof s.action === 'string' && s.action === path) matches.push(s);
  }
  for (const list of Object.values(MODULE_SHORTCUTS)) {
    for (const s of list) {
      if (typeof s.action === 'string' && s.action === path) matches.push(s);
    }
  }
  if (surface) {
    const onSurface = matches.find((s) => {
      const surf = s.surface ?? 'all';
      const list: readonly ShortcutSurface[] = Array.isArray(surf) ? surf : [surf];
      return list.includes('all') || list.includes(surface);
    });
    return onSurface?.keys;
  }
  // No surface given: keep the original first-match behaviour so any existing
  // surface-agnostic caller is unaffected.
  return matches[0]?.keys;
}

/**
 * Named chord constants for function-action bindings - surfaces them to
 * consumers (e.g. the TopHeader sidebar-toggle button's tooltip) without a
 * `data-shortcut` reverse lookup. If you change a chord here, update the
 * matching `GLOBAL_SHORTCUTS` entry too - single source of truth.
 */
export const FN_CHORDS = {
  toggleSidebar: 'mod+b',
  save: 'mod+s',
  toggleFullscreen: 'mod+shift+f',
  openShortcuts: 'shift+?',
} as const;

export function getModuleFromPath(pathname: string): string {
  // Longest prefix wins so `/dashboard/workspace/employee-code` resolves to
  // `workspace-management` rather than the dashboard root.
  const sorted = Object.keys(PATH_TO_MODULE_MAP).sort((a, b) => b.length - a.length);
  for (const prefix of sorted) {
    if (pathname === prefix || pathname.startsWith(prefix + '/')) {
      return PATH_TO_MODULE_MAP[prefix];
    }
  }
  return 'dashboard';
}
