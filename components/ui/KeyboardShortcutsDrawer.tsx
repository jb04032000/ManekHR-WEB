'use client';

/**
 * KeyboardShortcutsDrawer - the keyboard-shortcuts cheat-sheet.
 *
 * Drawer-only component: it carries no visible trigger. It opens on the
 * `SHORTCUTS_OPEN_EVENT` window event, dispatched by the global `Shift+?`
 * hotkey (KeyboardShortcutProvider) and by any shell's "Shortcuts" button.
 * Each shell mounts exactly one instance, passing its current module so the
 * sheet lists that module's context shortcuts alongside the globals:
 *  - ERP renders it via `KeyboardShortcutsButton` in the breadcrumb row;
 *  - Connect renders it directly from `ConnectModuleNav` (no breadcrumb row).
 */

import { useEffect, useState } from 'react';
import { Drawer, Tooltip } from 'antd';
import { ThunderboltOutlined, InfoCircleOutlined } from '@ant-design/icons';
import {
  displayPart,
  getShortcutsForModule,
  SHORTCUTS_OPEN_EVENT,
  type ShortcutDef,
} from '@/lib/constants/keyboard-shortcuts.registry';

export interface KeyboardShortcutsDrawerProps {
  /** Active module - selects which `MODULE_SHORTCUTS` entries to list. */
  module: string;
}

function renderKey(keys: string) {
  // v5 sequences use `>` (e.g. `g>s`), combos use `+` (e.g. `shift+?`).
  // Tokens are translated via shared `displayPart` so `mod` renders ⌘ on Mac
  // and `Ctrl` on Win/Linux - matches what the user actually presses.
  return keys.split('>').map((chunk, i) => (
    <span key={`${keys}-${i}`} className="inline-flex items-center gap-1">
      {chunk.split('+').map((part, j) => (
        <kbd
          key={`${chunk}-${j}`}
          className="rounded border border-neutral-200 bg-neutral-50 px-1.5 py-0.5 font-mono text-[11px] text-gray-800"
        >
          {displayPart(part)}
        </kbd>
      ))}
    </span>
  ));
}

// Tooltip phrase. Single-token chords (e.g. `shift+?`) read as "Press Shift + ?".
// Sequential chords (e.g. `g>s`) read as "Press g, then s". Uses shared
// `displayPart` so `mod` reads as ⌘/Ctrl per platform.
function formatChordTip(keys: string): string {
  const chunks = keys.split('>');
  if (chunks.length === 1) {
    const parts = chunks[0].split('+').map(displayPart);
    return `Press ${parts.join(' + ')}`;
  }
  const sequence = chunks.map((c) => c.split('+').map(displayPart).join(' + ')).join(', then ');
  return `Press ${sequence} (within ~1 second)`;
}

export function KeyboardShortcutsDrawer({ module }: KeyboardShortcutsDrawerProps) {
  const [open, setOpen] = useState(false);

  // Open from the global `shift+?` hotkey or any shell's "Shortcuts" button -
  // both dispatch `SHORTCUTS_OPEN_EVENT`, so this is the single help surface.
  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener(SHORTCUTS_OPEN_EVENT, handler);
    return () => window.removeEventListener(SHORTCUTS_OPEN_EVENT, handler);
  }, []);

  const shortcuts = getShortcutsForModule(module);
  const grouped: Record<string, ShortcutDef[]> = {};
  for (const s of shortcuts) {
    (grouped[s.scope] ??= []).push(s);
  }

  return (
    <Drawer
      title={
        <div className="flex items-center gap-2">
          <ThunderboltOutlined style={{ color: 'var(--cr-primary)' }} />
          <span className="font-display font-bold">Keyboard Shortcuts</span>
        </div>
      }
      open={open}
      onClose={() => setOpen(false)}
      size="default"
    >
      <div
        className="mb-4 flex items-start gap-2 rounded-md border px-3 py-2.5 text-[12px] leading-relaxed text-gray-700"
        style={{ borderColor: 'var(--cr-border)', background: 'var(--cr-surface-2)' }}
        role="note"
      >
        <InfoCircleOutlined
          style={{ color: 'var(--cr-primary)', fontSize: 14, marginTop: 2 }}
          aria-hidden="true"
        />
        <div>
          <strong className="text-gray-900">How to use:</strong> Most chords are <em>sequential</em>{' '}
          - press one key, release, then quickly press the next within ~1 second. Example:{' '}
          <span className="inline-flex items-center gap-1 align-middle">
            <kbd className="rounded border border-neutral-200 bg-neutral-50 px-1.5 py-0.5 font-mono text-[10px] text-gray-800">
              g
            </kbd>
            <kbd className="rounded border border-neutral-200 bg-neutral-50 px-1.5 py-0.5 font-mono text-[10px] text-gray-800">
              s
            </kbd>
          </span>{' '}
          means press <strong>g</strong>, then <strong>s</strong>. Combos joined with <code>+</code>{' '}
          are pressed together (e.g.{' '}
          <kbd className="rounded border border-neutral-200 bg-neutral-50 px-1.5 py-0.5 font-mono text-[10px] text-gray-800">
            Shift
          </kbd>
          <span className="mx-0.5">+</span>
          <kbd className="rounded border border-neutral-200 bg-neutral-50 px-1.5 py-0.5 font-mono text-[10px] text-gray-800">
            ?
          </kbd>
          ).
        </div>
      </div>
      <div className="flex flex-col gap-4">
        {Object.entries(grouped).map(([scope, list]) => (
          <div key={scope} className="flex flex-col gap-1">
            <div className="font-label text-[11px] text-gray-700">
              {scope === 'global' ? 'Global' : scope}
            </div>
            <div className="flex flex-col gap-1">
              {list.map((s) => (
                <Tooltip key={`${s.scope}-${s.keys}`} title={formatChordTip(s.keys)}>
                  <div className="flex items-center justify-between rounded-md bg-neutral-50 px-3 py-2">
                    <span className="text-sm text-gray-800">{s.label}</span>
                    <span className="flex items-center gap-1">{renderKey(s.keys)}</span>
                  </div>
                </Tooltip>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Drawer>
  );
}

export default KeyboardShortcutsDrawer;
