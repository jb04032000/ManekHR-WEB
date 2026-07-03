'use client';

/**
 * KeyboardShortcutsButton - the ERP breadcrumb-row trigger for the keyboard
 * shortcuts cheat-sheet. Clicking it (or pressing the global `Shift+?`) opens
 * the `KeyboardShortcutsDrawer`, which this button mounts alongside itself.
 *
 * Connect has no breadcrumb row - it mounts `KeyboardShortcutsDrawer` directly
 * from its sidebar instead. Both routes share the one drawer component.
 */

import { Tooltip } from 'antd';
import { ThunderboltOutlined } from '@ant-design/icons';
import {
  hasShortcutsForModule,
  SHORTCUTS_OPEN_EVENT,
} from '@/lib/constants/keyboard-shortcuts.registry';
import KeyboardShortcutsDrawer from './KeyboardShortcutsDrawer';

export interface KeyboardShortcutsButtonProps {
  module: string;
}

export function KeyboardShortcutsButton({ module }: KeyboardShortcutsButtonProps) {
  if (!hasShortcutsForModule(module)) return null;

  const tooltip = 'Keyboard shortcuts';

  return (
    <>
      <Tooltip title={tooltip}>
        {/* Hidden entirely below md: keyboard shortcuts need a physical keyboard,
            so the trigger is pointless on phones and just crowds the breadcrumb
            action cluster. The `KeyboardShortcutsDrawer` (portaled to body) stays
            mounted, so the global Shift+? shortcut still works where a keyboard
            exists. Shown as icon + label from md up. */}
        <button
          type="button"
          onClick={() => window.dispatchEvent(new Event(SHORTCUTS_OPEN_EVENT))}
          aria-label={tooltip}
          className="hidden cursor-pointer items-center gap-1 border-0 bg-transparent p-0 text-xs font-medium text-gray-700 transition-colors hover:text-blue-700 md:flex"
        >
          <ThunderboltOutlined />
          <span>Shortcuts</span>
        </button>
      </Tooltip>

      <KeyboardShortcutsDrawer module={module} />
    </>
  );
}

export default KeyboardShortcutsButton;
