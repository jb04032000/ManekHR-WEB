'use client';

import { ReactNode, useMemo } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useHotkeys } from 'react-hotkeys-hook';
import {
  getModuleFromPath,
  getShortcutsForModule,
  type ShortcutDef,
} from '@/lib/constants/keyboard-shortcuts.registry';

interface KeyboardShortcutProviderProps {
  children: ReactNode;
}

function ShortcutBinding({
  shortcut,
  onTrigger,
}: {
  shortcut: ShortcutDef;
  onTrigger: (s: ShortcutDef) => void;
}) {
  useHotkeys(
    shortcut.keys,
    (e) => {
      e.preventDefault();
      onTrigger(shortcut);
    },
    // `useKey` defaults to false so combos like `mod+s` match the physical
    // `KeyS` code AND require Ctrl/⌘ - without that gate, `useKey:true` lets
    // bare `s` fire the binding inside form tags when `enableInForms` is on.
    // Punctuation bindings whose token differs from their physical code
    // (e.g. `shift+?`, `/`) opt into `useKey:true` per-shortcut.
    // `enableInForms` opts a binding into firing while the user is typing
    // (Cmd+S to save). Default stays false so `n` / `/` etc. don't intercept
    // characters being typed into a search field.
    {
      enableOnFormTags: shortcut.enableInForms ?? false,
      preventDefault: true,
      useKey: shortcut.useKey ?? false,
    },
    [shortcut],
  );
  return null;
}

/**
 * Cancellable window event dispatched before a shortcut-triggered route push.
 * Pages with an unsaved-changes guard listen for this event and call
 * `preventDefault()` to suppress the immediate navigation, then trigger their
 * own confirm-leave dialog (and ultimately `router.push` from their own
 * handler). This is the keyboard-shortcut counterpart to the anchor-click +
 * popstate interception already wired into those page guards. Without it,
 * `g>h` / `g>d` / `g>t` shortcuts navigate away from a dirty form silently.
 */
export const SHORTCUT_BEFORE_NAV_EVENT = 'cr:beforenav';

export function KeyboardShortcutProvider({ children }: KeyboardShortcutProviderProps) {
  const router = useRouter();
  const pathname = usePathname() ?? '';

  const handleTrigger = (s: ShortcutDef) => {
    if (typeof s.action === 'function') {
      s.action();
      return;
    }
    // Give pages a chance to intercept (e.g. dirty-form guard). If any listener
    // preventDefaults, that listener owns the eventual router.push after its
    // confirm dialog resolves. dispatchEvent returns false when default was
    // prevented on a cancellable event.
    const proceed = window.dispatchEvent(
      new CustomEvent(SHORTCUT_BEFORE_NAV_EVENT, {
        detail: { href: s.action },
        cancelable: true,
      }),
    );
    if (proceed) {
      router.push(s.action);
    }
  };

  // Active bindings = the chords `getShortcutsForModule` resolves for the
  // current route. Single source of truth shared with the cheat-sheet drawer
  // so the listed shortcuts and the actually-bound shortcuts never drift -
  // including the `surface` filter that hides ERP-only chords on Connect.
  const activeShortcuts = useMemo<ShortcutDef[]>(
    () => getShortcutsForModule(getModuleFromPath(pathname)),
    [pathname],
  );

  return (
    <>
      {activeShortcuts.map((s) => (
        <ShortcutBinding key={`${s.scope}-${s.keys}`} shortcut={s} onTrigger={handleTrigger} />
      ))}
      {children}
    </>
  );
}

export default KeyboardShortcutProvider;
