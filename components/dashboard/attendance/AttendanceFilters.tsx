'use client';
import { Input, Select, Button, Tooltip } from 'antd';
import { CloseCircleOutlined, LockOutlined } from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import type { TeamMember, ShiftInfo } from '@/types';

const { Option } = Select;

export interface AttendanceFiltersProps {
  search: string;
  onSearchChange: (s: string) => void;
  selectedShifts: string[];
  onShiftChange: (ids: string[]) => void;
  selectedRoles: string[];
  onRoleChange: (roles: string[]) => void;
  shifts: ShiftInfo[];
  roles: string[];
  hasActiveFilters: boolean;
  onClearAll: () => void;
  canAdvancedFilters: boolean;
  /** Pass members only if you need the filter to derive roles on the fly - optional */
  members?: TeamMember[];
}

export function AttendanceFilters({
  search,
  onSearchChange,
  selectedShifts,
  onShiftChange,
  selectedRoles,
  onRoleChange,
  shifts,
  roles,
  hasActiveFilters,
  onClearAll,
  canAdvancedFilters,
}: AttendanceFiltersProps) {
  const t = useTranslations('attendance');

  // Filter bar stacks to full-width controls on phones (was a non-wrapping row of
  // fixed 280/260/260px controls that overflowed ~860px at 390px); row+wrap from sm.
  return (
    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
      {/* Search - bounded width on sm+ via a wrapper div. AntD's affix-wrapper (added
          by allowClear) forces width:100%, so `sm:w-[280px]` on the Input itself gets
          overridden and it eats the whole row, pushing the filters to a second line.
          The plain wrapper caps the width reliably so search + filters share one row on
          wide screens; full width when stacked on phones. */}
      <div className="w-full sm:w-[280px]">
        <Input
          data-shortcut="attendance-search"
          placeholder={t('searchPlaceholder')}
          aria-label={t('searchPlaceholder')}
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          allowClear
          className="w-full"
          style={{ height: 38 }}
          size="middle"
        />
      </div>

      <Tooltip title={!canAdvancedFilters ? 'Upgrade to unlock shift filters' : undefined}>
        <Select
          mode="multiple"
          size="middle"
          maxTagCount="responsive"
          maxTagPlaceholder={(omittedValues) => `+${omittedValues.length}`}
          placeholder={t('filterByShift')}
          aria-label={t('filterByShift')}
          value={selectedShifts}
          onChange={onShiftChange}
          style={{ height: 38 }}
          disabled={!canAdvancedFilters}
          suffixIcon={!canAdvancedFilters ? <LockOutlined /> : undefined}
          className="attendance-filter-select w-full sm:w-[260px]"
          optionFilterProp="children"
        >
          {shifts.map((s) => (
            <Option key={s.id} value={s.id}>
              {s.name}
            </Option>
          ))}
        </Select>
      </Tooltip>

      <Tooltip title={!canAdvancedFilters ? 'Upgrade to unlock role filters' : undefined}>
        <Select
          mode="multiple"
          size="middle"
          maxTagCount="responsive"
          maxTagPlaceholder={(omittedValues) => `+${omittedValues.length}`}
          placeholder={t('filterByRole')}
          aria-label={t('filterByRole')}
          value={selectedRoles}
          onChange={onRoleChange}
          style={{ height: 38 }}
          disabled={!canAdvancedFilters}
          suffixIcon={!canAdvancedFilters ? <LockOutlined /> : undefined}
          className="attendance-filter-select w-full sm:w-[260px]"
        >
          {roles.map((r) => (
            <Option key={r} value={r}>
              {r}
            </Option>
          ))}
        </Select>
      </Tooltip>

      <Button
        type="text"
        icon={<CloseCircleOutlined />}
        onClick={onClearAll}
        disabled={!hasActiveFilters}
        style={{ color: hasActiveFilters ? 'var(--cr-error)' : '#ccc' }}
        className="flex items-center gap-1 whitespace-nowrap"
      >
        {t('clearAllFilters')}
      </Button>
    </div>
  );
}
