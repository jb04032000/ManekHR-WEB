'use client';

// Phase 16 / FIN-15-04 - Locale toggle for invoice print preview.
// Native-script labels per UI-SPEC §Multi-language Print Preview.
import SegmentedToggle from '@/components/ui/SegmentedToggle';

export type PrintLocale = 'en' | 'gu' | 'hi';

interface LocaleToggleProps {
  value: PrintLocale;
  onChange: (locale: PrintLocale) => void;
  label?: string;
}

const OPTIONS = [
  { label: 'English', value: 'en' },
  { label: 'ગુજરાતી', value: 'gu' },
  { label: 'हिन्दी', value: 'hi' },
];

export function LocaleToggle({ value, onChange, label = 'Print language' }: LocaleToggleProps) {
  return (
    <div className="flex flex-col gap-2">
      <span
        className="text-[11px] font-semibold tracking-wider text-muted uppercase"
        style={{ fontFamily: 'var(--font-body)' }}
      >
        {label}
      </span>
      <SegmentedToggle
        options={OPTIONS}
        value={value}
        onChange={(v) => onChange(v as PrintLocale)}
      />
    </div>
  );
}

export default LocaleToggle;
