'use client';
import { startTransition, useEffect, useState } from 'react';
import { Button, DatePicker, Form, Popconfirm, Space, Switch, message } from 'antd';
import dayjs from 'dayjs';
import { useTranslations } from 'next-intl';
import type { PieceRateConfig, PieceRateUnit, PerMachineRateOverride, TeamMember } from '@/types';
import { setPieceRateConfig, clearPieceRateConfig } from '@/lib/actions/salary.actions';
import { UnitSelect } from './PieceRateConfigTab/UnitSelect';
import { RateInput } from './PieceRateConfigTab/RateInput';
import { PerMachineOverrideTable } from './PieceRateConfigTab/PerMachineOverrideTable';

type Machine = { _id: string; machineCode: string };

export function PieceRateConfigTab({
  wsId,
  member,
  machines,
  onSaved,
  disabled,
}: {
  wsId: string;
  member: TeamMember;
  machines: Machine[];
  onSaved: () => void;
  disabled?: boolean;
}) {
  const t = useTranslations();
  const cfg = (member as TeamMember & { pieceRateConfig?: PieceRateConfig }).pieceRateConfig;

  const [unit, setUnit] = useState<PieceRateUnit>(cfg?.unit ?? 'per_piece');
  const [defaultRate, setDefaultRate] = useState<number>(cfg?.defaultRate ?? 0);
  const [hasBase, setHasBase] = useState<boolean>(
    (cfg?.basePortion ?? 0) > 0 || cfg?.unit === 'blended',
  );
  const [basePortion, setBasePortion] = useState<number>(cfg?.basePortion ?? 0);
  const [effectiveFrom, setEffectiveFrom] = useState<dayjs.Dayjs>(
    cfg?.effectiveFrom ? dayjs(cfg.effectiveFrom) : dayjs(),
  );
  const [overrides, setOverrides] = useState<PerMachineRateOverride[]>(
    cfg?.perMachineOverrides ?? [],
  );
  const [saving, setSaving] = useState(false);
  const [clearing, setClearing] = useState(false);

  useEffect(() => {
    if (unit !== 'blended') {
      startTransition(() => {
        setHasBase(false);
        setBasePortion(0);
      });
    }
  }, [unit]);

  const parseError = (e: unknown): { code: string; message: string } => {
    const fallback = (e as Error)?.message ?? 'Operation failed';
    try {
      const parsed = JSON.parse(fallback);
      return {
        code: parsed.code ?? '',
        message: parsed.message ?? fallback,
      };
    } catch {
      return { code: '', message: fallback };
    }
  };

  const surfaceError = (e: unknown, defaultMsg: string) => {
    const { code, message: msg } = parseError(e);
    if (code) {
      try {
        message.error(t(`salary.piece_rate.errors.${code}`));
        return;
      } catch {
        // fall through to plain msg
      }
    }
    message.error(msg || defaultMsg);
  };

  const handleSave = async () => {
    if (!defaultRate || defaultRate <= 0) {
      message.error(t('salary.piece_rate.errors.RATE_REQUIRED'));
      return;
    }
    // Client-side dedupe check for per-machine overrides.
    const seen = new Set<string>();
    for (const o of overrides) {
      if (!o.machineId) continue;
      if (seen.has(o.machineId)) {
        message.error(t('salary.piece_rate.errors.DUPLICATE_MACHINE_OVERRIDE'));
        return;
      }
      seen.add(o.machineId);
    }
    setSaving(true);
    try {
      await setPieceRateConfig(wsId, member.id, {
        unit,
        defaultRate,
        basePortion: unit === 'blended' && hasBase ? basePortion : 0,
        perMachineOverrides: overrides.filter((o) => o.machineId),
        effectiveFrom: effectiveFrom.toISOString(),
        includeStitchUnit: true,
      });
      message.success(t('salary.piece_rate.config.saved'));
      onSaved();
    } catch (e) {
      surfaceError(e, 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleClear = async () => {
    setClearing(true);
    try {
      await clearPieceRateConfig(wsId, member.id, 'monthly');
      message.success(t('salary.piece_rate.config.saved'));
      onSaved();
    } catch (e) {
      surfaceError(e, 'Clear failed');
    } finally {
      setClearing(false);
    }
  };

  return (
    <Form layout="vertical" disabled={disabled}>
      <Form.Item label={t('salary.piece_rate.config.unit')}>
        <UnitSelect value={unit} onChange={setUnit} disabled={disabled} />
      </Form.Item>

      <Form.Item
        label={t('salary.piece_rate.config.defaultRate')}
        help={t('salary.piece_rate.config.defaultRateHelp')}
      >
        <RateInput
          value={defaultRate}
          onChange={(v) => setDefaultRate(v ?? 0)}
          disabled={disabled}
        />
      </Form.Item>

      {unit === 'blended' && (
        <>
          <Form.Item>
            <Space>
              <Switch checked={hasBase} onChange={setHasBase} disabled={disabled} />
              <span>{t('salary.piece_rate.config.basePortion')}</span>
            </Space>
          </Form.Item>
          {hasBase && (
            <Form.Item
              label={t('salary.piece_rate.config.basePortion')}
              help={t('salary.piece_rate.config.basePortionHelp')}
            >
              <RateInput
                value={basePortion}
                onChange={(v) => setBasePortion(v ?? 0)}
                disabled={disabled}
              />
            </Form.Item>
          )}
        </>
      )}

      <Form.Item label={t('salary.piece_rate.config.effectiveFrom')}>
        <DatePicker
          value={effectiveFrom}
          onChange={(d) => setEffectiveFrom(d ?? dayjs())}
          disabledDate={(d) => d.isAfter(dayjs(), 'day')}
          disabled={disabled}
        />
      </Form.Item>

      <Form.Item label={t('salary.piece_rate.config.perMachineOverrides.label')}>
        <PerMachineOverrideTable
          rows={overrides}
          onChange={setOverrides}
          machines={machines}
          max={50}
          disabled={disabled}
        />
      </Form.Item>

      <Space>
        <Button type="primary" loading={saving} onClick={handleSave} disabled={disabled}>
          {t('salary.piece_rate.config.save')}
        </Button>
        {cfg && (
          <Popconfirm
            title={t('salary.piece_rate.config.clearConfirm')}
            onConfirm={handleClear}
            okButtonProps={{ loading: clearing }}
            disabled={disabled}
          >
            <Button danger disabled={disabled}>
              {t('salary.piece_rate.config.clear')}
            </Button>
          </Popconfirm>
        )}
      </Space>
    </Form>
  );
}
