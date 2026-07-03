'use client';

/**
 * Phase 25 / Plan 25-12 - Global filter bar.
 *
 * Date range + machine/location/shift multi-selects. Apply / Reset actions.
 * Options come in as props - caller (page) is responsible for fetching the
 * machine/location/shift catalogues.
 */
import { useState, useEffect, startTransition } from 'react';
import { DatePicker, Select, Button } from 'antd';
import type { Dayjs } from 'dayjs';
import dayjs from 'dayjs';
import { useTranslations } from 'next-intl';
import DsCard from '@/components/ui/DsCard';
import type { UtilisationFilterQuery } from '@/types';

const { RangePicker } = DatePicker;

interface OptionShape {
  id: string;
  name: string;
}

interface GlobalFilterBarProps {
  value: UtilisationFilterQuery;
  onChange: (q: UtilisationFilterQuery) => void;
  machineOptions: OptionShape[];
  locationOptions: OptionShape[];
  shiftOptions: OptionShape[];
}

export function GlobalFilterBar({
  value,
  onChange,
  machineOptions,
  locationOptions,
  shiftOptions,
}: GlobalFilterBarProps) {
  const t = useTranslations('dashboard-production-utilisation');

  // Local draft state - only commit on Apply
  const [draftFrom, setDraftFrom] = useState<string | undefined>(value.from);
  const [draftTo, setDraftTo] = useState<string | undefined>(value.to);
  const [draftMachineIds, setDraftMachineIds] = useState<string[]>(value.machineIds ?? []);
  const [draftLocationIds, setDraftLocationIds] = useState<string[]>(value.locationIds ?? []);
  const [draftShiftIds, setDraftShiftIds] = useState<string[]>(value.shiftIds ?? []);

  useEffect(() => {
    startTransition(() => {
      setDraftFrom(value.from);
      setDraftTo(value.to);
      setDraftMachineIds(value.machineIds ?? []);
      setDraftLocationIds(value.locationIds ?? []);
      setDraftShiftIds(value.shiftIds ?? []);
    });
  }, [value]);

  const handleApply = () => {
    onChange({
      from: draftFrom,
      to: draftTo,
      machineIds: draftMachineIds.length > 0 ? draftMachineIds : undefined,
      locationIds: draftLocationIds.length > 0 ? draftLocationIds : undefined,
      shiftIds: draftShiftIds.length > 0 ? draftShiftIds : undefined,
    });
  };

  const handleReset = () => {
    setDraftFrom(undefined);
    setDraftTo(undefined);
    setDraftMachineIds([]);
    setDraftLocationIds([]);
    setDraftShiftIds([]);
    onChange({});
  };

  const rangeValue: [Dayjs | null, Dayjs | null] | null =
    draftFrom || draftTo
      ? [draftFrom ? dayjs(draftFrom) : null, draftTo ? dayjs(draftTo) : null]
      : null;

  const toOpts = (arr: OptionShape[]) => arr.map((o) => ({ label: o.name, value: o.id }));

  return (
    <DsCard>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 12,
          alignItems: 'end',
        }}
      >
        <div>
          <label
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: 'var(--cr-text-3)',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              display: 'block',
              marginBottom: 4,
            }}
          >
            {t('filter.dateRange')}
          </label>
          <RangePicker
            style={{ width: '100%' }}
            value={rangeValue as [Dayjs, Dayjs] | null}
            onChange={(vals) => {
              setDraftFrom(vals?.[0]?.format('YYYY-MM-DD'));
              setDraftTo(vals?.[1]?.format('YYYY-MM-DD'));
            }}
            allowClear
          />
        </div>

        <div>
          <label
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: 'var(--cr-text-3)',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              display: 'block',
              marginBottom: 4,
            }}
          >
            {t('filter.machines')}
          </label>
          <Select
            mode="multiple"
            allowClear
            placeholder={t('filter.allMachines')}
            value={draftMachineIds}
            onChange={setDraftMachineIds}
            options={toOpts(machineOptions)}
            style={{ width: '100%' }}
            maxTagCount="responsive"
          />
        </div>

        <div>
          <label
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: 'var(--cr-text-3)',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              display: 'block',
              marginBottom: 4,
            }}
          >
            {t('filter.locations')}
          </label>
          <Select
            mode="multiple"
            allowClear
            placeholder={t('filter.allLocations')}
            value={draftLocationIds}
            onChange={setDraftLocationIds}
            options={toOpts(locationOptions)}
            style={{ width: '100%' }}
            maxTagCount="responsive"
          />
        </div>

        <div>
          <label
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: 'var(--cr-text-3)',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              display: 'block',
              marginBottom: 4,
            }}
          >
            {t('filter.shifts')}
          </label>
          <Select
            mode="multiple"
            allowClear
            placeholder={t('filter.allShifts')}
            value={draftShiftIds}
            onChange={setDraftShiftIds}
            options={toOpts(shiftOptions)}
            style={{ width: '100%' }}
            maxTagCount="responsive"
          />
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Button onClick={handleReset}>{t('filter.reset')}</Button>
          <Button type="primary" onClick={handleApply}>
            {t('filter.apply')}
          </Button>
        </div>
      </div>
    </DsCard>
  );
}

export default GlobalFilterBar;
