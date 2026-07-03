'use client';

import { ReactNode } from 'react';

export interface SegmentedOption {
  value: string;
  label: string;
  icon?: ReactNode;
}

interface SegmentedToggleProps {
  options: SegmentedOption[];
  value: string | undefined;
  onChange: (value: string) => void;
  sectionLabel?: string;
  /** Read-only state - buttons become non-interactive + dimmed. A custom
   *  control does not inherit antd's `ConfigProvider componentDisabled`, so
   *  view-mode forms (e.g. the member-profile Work tab) must pass this
   *  explicitly. */
  disabled?: boolean;
  /**
   * Sizing mode.
   *  - `'full'` (default) - each option is `flex-1`, the control stretches to
   *    fill its parent. Use INSIDE form fields / modals / drawers where the
   *    segmented control is one row of a vertical form and the spread looks
   *    deliberate.
   *  - `'fit'` - intrinsic width (only as wide as the labels need). Use for
   *    FILTER / SUB-NAV pills sitting on a wide page surface (e.g. inside a
   *    `<ConnectPage>`) where a stretched 3-option pill would scan as wasted
   *    horizontal whitespace. This is the right choice for Connect's Network
   *    `Received / Sent / Archive` sub-filter and similar in-page filters.
   *
   * Default stays `'full'` to preserve existing form-context callers; new
   * filter-pill use sites should pass `'fit'` explicitly.
   */
  width?: 'full' | 'fit';
}

export default function SegmentedToggle({
  options,
  value,
  onChange,
  sectionLabel,
  disabled = false,
  width = 'full',
}: SegmentedToggleProps) {
  const activeValue = value ?? options[0]?.value;
  const isFit = width === 'fit';
  return (
    <div
      className={isFit ? 'inline-block' : undefined}
      style={disabled ? { opacity: 0.55 } : undefined}
    >
      {sectionLabel && (
        <p
          className="mb-2 text-[11px] font-semibold tracking-wider text-muted uppercase"
          style={{ fontFamily: 'var(--font-body)' }}
        >
          {sectionLabel}
        </p>
      )}
      <div
        className={`${isFit ? 'inline-flex' : 'flex'} overflow-hidden rounded-xl`}
        style={{ background: '#f3f4f6', padding: 3 }}
      >
        {options.map((opt) => {
          const active = activeValue === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              disabled={disabled}
              onClick={() => {
                if (!disabled) onChange(opt.value);
              }}
              className={`flex items-center justify-center gap-1.5 rounded-lg transition-all duration-150 ${
                isFit ? '' : 'flex-1'
              }`}
              style={{
                cursor: disabled ? 'not-allowed' : 'pointer',
                background: active ? 'var(--cr-surface)' : 'transparent',
                boxShadow: active
                  ? '0 1px 4px rgba(0,0,0,0.1), 0 0 0 1px rgba(0,0,0,0.04)'
                  : 'none',
                color: active ? 'var(--cr-primary)' : 'var(--cr-text-3)',
                fontWeight: active ? 600 : 500,
                fontSize: 13,
                height: 36,
                fontFamily: 'var(--font-body)',
                flexShrink: 0,
                // In `fit` mode each pill needs explicit horizontal padding so
                // it has breathing room around the label (no `flex-1` to fill
                // space for it). In `full` mode the equal-grow flex does it.
                paddingInline: isFit ? 18 : undefined,
              }}
            >
              {opt.icon && <span style={{ fontSize: 14 }}>{opt.icon}</span>}
              <span>{opt.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
