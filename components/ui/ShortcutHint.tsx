'use client';

/**
 * ShortcutHint - inline kbd-styled keyboard-chord renderer for tooltips.
 *
 * Used inside AntD `Tooltip` titles so a user hovering a sidebar nav item
 * or header button discovers the shortcut bound to it.
 *
 * Rendering convention (matches Linear / Notion / GitHub):
 *  - Combo keys (pressed together - `mod+s`): joined by a faint `+`
 *    between kbds, e.g. `⌘ + S`.
 *  - Sequence keys (pressed in order - `g>f`): rendered as one subtle pill
 *    containing both letters with a thin space, e.g. `G F`. Earlier we
 *    tried two heavy bordered kbds with an arrow between them - too loud
 *    visually inside a small dark tooltip and read as two unrelated keys.
 *    The single-pill, low-emphasis form mirrors the Linear convention.
 *
 * Styled for AntD's dark-default Tooltip background - white border + low-
 * alpha white fill. If you need it on a light surface, render a separate
 * variant rather than overloading this component.
 */

import { displayPart } from '@/lib/constants/keyboard-shortcuts.registry';

interface ShortcutHintProps {
  /** A `react-hotkeys-hook`-style chord - e.g. `g>f`, `mod+s`, `shift+?`. */
  keys: string;
}

export default function ShortcutHint({ keys }: ShortcutHintProps) {
  // Pure sequence (no combos) - render as ONE pill with letters joined by
  // a literal `+`, e.g. `G+C`. Per owner-direct request: one tooltip pill,
  // letters connected, no decorative arrow / separator.
  const isPureSequence = keys.includes('>') && !keys.includes('+');
  if (isPureSequence) {
    const joined = keys
      .split('>')
      .map((p) => displayPart(p))
      .join('+');
    return (
      <span className="ml-2 inline-flex items-center">
        <kbd className="inline-block rounded bg-white/15 px-1.5 py-0.5 font-mono text-[10px] leading-none text-white/90">
          {joined}
        </kbd>
      </span>
    );
  }

  // Combo path (with or without an outer sequence - e.g. `g>shift+/`).
  // Two-level nesting: chunks split on `>`, combos within a chunk on `+`.
  const chunks = keys.split('>');
  return (
    <span className="ml-2 inline-flex items-center gap-1">
      {chunks.map((chunk, ci) => (
        <span key={`${keys}-${ci}`} className="inline-flex items-center gap-0.5">
          {ci > 0 && (
            <span className="px-0.5 text-[10px] leading-none opacity-60" aria-hidden>
              →
            </span>
          )}
          {chunk.split('+').map((part, pi) => (
            <span key={`${chunk}-${pi}`} className="inline-flex items-center gap-0.5">
              {pi > 0 && (
                <span className="text-[10px] leading-none opacity-60" aria-hidden>
                  +
                </span>
              )}
              <kbd className="inline-block rounded bg-white/15 px-1 py-0.5 font-mono text-[10px] leading-none text-white/90">
                {displayPart(part)}
              </kbd>
            </span>
          ))}
        </span>
      ))}
    </span>
  );
}
