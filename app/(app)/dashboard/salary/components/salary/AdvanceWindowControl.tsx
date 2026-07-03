'use client';
// Owner control for the advance-request window. Writes PayrollConfig.disbursementRules
// .advanceRequestPolicy via DisbursementRulesPanel -> updateDisbursementRules.
// Links: backend advance-request-window.util.ts (same modes), AdvanceRequestDrawer (worker view).
import { InputNumber, Radio } from 'antd';
import { useTranslations } from 'next-intl';

export interface AdvanceWindowPolicy {
  mode: 'any_day' | 'window' | 'fixed_day';
  fixedDay?: number;
  windowStartDay?: number;
  windowEndDay?: number;
}

export function AdvanceWindowControl({
  value,
  disabled,
  onChange,
}: {
  value: AdvanceWindowPolicy;
  disabled: boolean;
  onChange: (p: AdvanceWindowPolicy) => void;
}) {
  const t = useTranslations('salarySettings');
  const mode = value.mode ?? 'any_day';
  const anyDayLabel = t('advanceWindow.anyDay', { defaultValue: 'Any day of the month' });
  const fixedDayLabel = t('advanceWindow.fixedDay', { defaultValue: 'A single day' });
  const windowLabel = t('advanceWindow.window', { defaultValue: 'A range of days' });

  return (
    <div>
      <Radio.Group
        value={mode}
        disabled={disabled}
        onChange={(e) => {
          const m = e.target.value as AdvanceWindowPolicy['mode'];
          if (m === 'any_day') onChange({ mode: 'any_day' });
          else if (m === 'fixed_day')
            onChange({ mode: 'fixed_day', fixedDay: value.fixedDay ?? 21 });
          else
            onChange({
              mode: 'window',
              windowStartDay: value.windowStartDay ?? 21,
              windowEndDay: value.windowEndDay ?? 23,
            });
        }}
      >
        <Radio value="any_day">{anyDayLabel}</Radio>
        <Radio value="fixed_day">{fixedDayLabel}</Radio>
        {/* aria-label on the radio input so getByLabelText works in tests. */}
        <Radio value="window" aria-label={windowLabel}>
          {windowLabel}
        </Radio>
      </Radio.Group>
      {mode === 'fixed_day' && (
        <div className="mt-3">
          <InputNumber
            min={1}
            max={28}
            disabled={disabled}
            value={value.fixedDay ?? 21}
            aria-label={fixedDayLabel}
            suffix={t('disbursement.salaryDateSuffix', { defaultValue: 'of month' })}
            onChange={(v) => onChange({ mode: 'fixed_day', fixedDay: v ?? 21 })}
          />
        </div>
      )}
      {mode === 'window' && (
        <div className="mt-3 flex items-center gap-2">
          <InputNumber
            min={1}
            max={31}
            disabled={disabled}
            value={value.windowStartDay ?? 21}
            aria-label={t('advanceWindow.startDay', { defaultValue: 'From day' })}
            onChange={(v) =>
              onChange({
                mode: 'window',
                windowStartDay: v ?? 1,
                windowEndDay: value.windowEndDay ?? 23,
              })
            }
          />
          <span>{t('advanceWindow.to', { defaultValue: 'to' })}</span>
          <InputNumber
            min={1}
            max={31}
            disabled={disabled}
            value={value.windowEndDay ?? 23}
            aria-label={t('advanceWindow.endDay', { defaultValue: 'to day' })}
            onChange={(v) =>
              onChange({
                mode: 'window',
                windowStartDay: value.windowStartDay ?? 21,
                windowEndDay: v ?? 31,
              })
            }
          />
        </div>
      )}
    </div>
  );
}
