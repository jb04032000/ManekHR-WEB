'use client';

import { useState } from 'react';
import {
  Alert,
  Button,
  Checkbox,
  Form,
  InputNumber,
  Modal,
  Select,
  Table,
  Tag,
  Tooltip,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { InfoCircleOutlined, PlayCircleOutlined, SearchOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useTranslations } from 'next-intl';
import { formatCurrencyFull } from '@/lib/utils';
import type { BonusPreviewRow, TeamMember } from '@/types';

const CURRENT_YEAR = dayjs().year();
const FY_OPTIONS = Array.from({ length: 6 }, (_, i) => {
  const y = CURRENT_YEAR - i;
  return { value: y, label: `FY ${y}-${String(y + 1).slice(2)}` };
});

const MONTH_OPTIONS = Array.from({ length: 12 }, (_, i) => ({
  value: i + 1,
  label: dayjs().month(i).format('MMMM'),
}));

const YEAR_OPTIONS = Array.from({ length: 5 }, (_, i) => ({
  value: CURRENT_YEAR - i,
  label: String(CURRENT_YEAR - i),
}));

interface Props {
  loading: boolean;
  previewRows: BonusPreviewRow[];
  previewFy: number | null;
  memberMap: Map<string, TeamMember>;
  onPreview: (opts: {
    financialYear: number;
    percent: number;
    disbursedMonth: number;
    disbursedYear: number;
  }) => void;
  onRun: (opts: {
    financialYear: number;
    disbursedMonth: number;
    disbursedYear: number;
    note?: string;
  }) => void;
}

export function StatutoryBonusTab({
  loading,
  previewRows,
  previewFy,
  memberMap,
  onPreview,
  onRun,
}: Props) {
  const t = useTranslations('salary.bonus');

  const [fy, setFy] = useState<number>(CURRENT_YEAR - (dayjs().month() >= 3 ? 0 : 1));
  const [percent, setPercent] = useState<number>(8.33);
  const [disbursedMonth, setDisbursedMonth] = useState<number>(11); // November default
  const [disbursedYear, setDisbursedYear] = useState<number>(CURRENT_YEAR);
  const [runModalOpen, setRunModalOpen] = useState(false);
  const [runNote, setRunNote] = useState('');

  const eligibleRows = previewRows.filter((r) => r.eligible);
  const ineligibleRows = previewRows.filter((r) => !r.eligible);
  const totalAmount = eligibleRows.reduce((s, r) => s + r.bonusAmount, 0);

  const columns: ColumnsType<BonusPreviewRow> = [
    {
      title: t('colEmployee'),
      key: 'employee',
      render: (_: unknown, row: BonusPreviewRow) => {
        const member = memberMap.get(row.teamMemberId);
        return (
          <div>
            <p className="m-0 text-[14px] font-medium text-heading">
              {member?.name ?? row.memberName ?? row.teamMemberId}
            </p>
            {member?.designation && (
              <p className="m-0 text-[12px] text-subtle">{member.designation}</p>
            )}
          </div>
        );
      },
    },
    {
      title: t('colEligible'),
      key: 'eligible',
      render: (_: unknown, row: BonusPreviewRow) =>
        row.eligible ? (
          <Tag color="success">{t('eligible')}</Tag>
        ) : (
          <Tooltip title={row.reason}>
            <Tag color="default">{t('notEligible')}</Tag>
          </Tooltip>
        ),
    },
    {
      title: (
        <span className="flex items-center gap-1">
          {t('colLastWage')}
          <Tooltip title={t('lastWageTooltip')}>
            <InfoCircleOutlined className="text-[11px] text-subtle" />
          </Tooltip>
        </span>
      ),
      dataIndex: 'lastMonthlyWage',
      key: 'lastMonthlyWage',
      align: 'right',
      render: (v: number) => <span className="tabular-nums">{formatCurrencyFull(v)}</span>,
    },
    {
      title: (
        <span className="flex items-center gap-1">
          {t('colCalcWage')}
          <Tooltip title={t('calcWageTooltip')}>
            <InfoCircleOutlined className="text-[11px] text-subtle" />
          </Tooltip>
        </span>
      ),
      dataIndex: 'calcWage',
      key: 'calcWage',
      align: 'right',
      render: (v: number, row: BonusPreviewRow) =>
        row.eligible ? (
          <span className="tabular-nums">{formatCurrencyFull(v)}</span>
        ) : (
          <span className="text-subtle">-</span>
        ),
    },
    {
      title: t('colMonthsWorked'),
      dataIndex: 'monthsWorked',
      key: 'monthsWorked',
      align: 'center',
      render: (v: number, row: BonusPreviewRow) =>
        row.eligible ? (
          <span className="font-medium tabular-nums">{v}</span>
        ) : (
          <span className="text-subtle">-</span>
        ),
    },
    {
      title: t('colPercent'),
      dataIndex: 'applicablePercent',
      key: 'applicablePercent',
      align: 'right',
      render: (v: number, row: BonusPreviewRow) =>
        row.eligible ? (
          <span className="tabular-nums">{v.toFixed(2)}%</span>
        ) : (
          <span className="text-subtle">-</span>
        ),
    },
    {
      title: (
        <span className="flex items-center gap-1">
          {t('colBonusAmount')}
          <Tooltip title={t('festivalCreditTooltip')}>
            <InfoCircleOutlined className="text-[11px] text-subtle" />
          </Tooltip>
        </span>
      ),
      key: 'bonusAmount',
      align: 'right',
      render: (_: unknown, row: BonusPreviewRow) => {
        if (!row.eligible) return <span className="text-subtle">-</span>;
        return (
          <div className="text-right">
            <span className="font-semibold text-heading tabular-nums">
              {formatCurrencyFull(row.bonusAmount)}
            </span>
            {row.existingFestivalBonusAmount !== null && (
              <p className="m-0 text-[11px] text-blue-600">
                {t('festivalCredit', {
                  amount: formatCurrencyFull(row.existingFestivalBonusAmount),
                })}
              </p>
            )}
          </div>
        );
      },
    },
    {
      title: t('colReason'),
      dataIndex: 'reason',
      key: 'reason',
      render: (v: string, row: BonusPreviewRow) =>
        !row.eligible ? (
          <span className="text-[12px] text-subtle">{v}</span>
        ) : (
          <span className="text-[12px] text-subtle">-</span>
        ),
    },
  ];

  return (
    <div className="py-4">
      {/* Eligibility rules info box */}
      <Alert
        title={t('eligibilityTitle')}
        description={t('eligibilityDesc')}
        type="info"
        showIcon
        className="mb-5"
        style={{ borderRadius: 10 }}
      />

      {/* Preview controls */}
      <div className="mb-5 flex flex-wrap items-end gap-3">
        <Form.Item label={t('fieldFy')} className="mb-0">
          <Select
            value={fy}
            onChange={(v: number) => setFy(v)}
            options={FY_OPTIONS}
            style={{ width: 150 }}
          />
        </Form.Item>

        <Form.Item
          label={
            <span className="flex items-center gap-1">
              {t('fieldPercent')}
              <Tooltip title={t('percentTooltip')}>
                <InfoCircleOutlined className="text-[11px] text-subtle" />
              </Tooltip>
            </span>
          }
          className="mb-0"
        >
          <InputNumber
            min={8.33}
            max={20}
            step={0.01}
            precision={2}
            value={percent}
            onChange={(v) => setPercent(v ?? 8.33)}
            suffix="%"
            style={{ width: 120 }}
          />
        </Form.Item>

        <Form.Item label={t('fieldDisbursedMonth')} className="mb-0">
          <Select
            value={disbursedMonth}
            onChange={(v: number) => setDisbursedMonth(v)}
            options={MONTH_OPTIONS}
            style={{ width: 140 }}
          />
        </Form.Item>

        <Form.Item label={t('fieldDisbursedYear')} className="mb-0">
          <Select
            value={disbursedYear}
            onChange={(v: number) => setDisbursedYear(v)}
            options={YEAR_OPTIONS}
            style={{ width: 110 }}
          />
        </Form.Item>

        <Button
          icon={<SearchOutlined />}
          onClick={() => onPreview({ financialYear: fy, percent, disbursedMonth, disbursedYear })}
          loading={loading}
        >
          {t('previewBtn')}
        </Button>

        {previewRows.length > 0 && (
          <Button
            type="primary"
            icon={<PlayCircleOutlined />}
            onClick={() => setRunModalOpen(true)}
            disabled={eligibleRows.length === 0}
          >
            {t('runBtn')}
          </Button>
        )}
      </div>

      {/* Summary row */}
      {previewFy !== null && previewRows.length > 0 && (
        <div
          className="mb-4 flex flex-wrap gap-4 rounded-xl border p-4"
          style={{ borderColor: 'var(--cr-border)', background: 'var(--cr-surface)' }}
        >
          <div>
            <p className="m-0 text-[12px] text-subtle">{t('summaryFy')}</p>
            <p className="m-0 text-[15px] font-semibold">
              {`FY ${previewFy}-${String(previewFy + 1).slice(2)}`}
            </p>
          </div>
          <div>
            <p className="m-0 text-[12px] text-subtle">{t('summaryEligible')}</p>
            <p className="m-0 text-[15px] font-semibold">{eligibleRows.length}</p>
          </div>
          <div>
            <p className="m-0 text-[12px] text-subtle">{t('summaryIneligible')}</p>
            <p className="m-0 text-[15px] font-semibold">{ineligibleRows.length}</p>
          </div>
          <div>
            <p className="m-0 text-[12px] text-subtle">{t('summaryTotal')}</p>
            <p className="m-0 text-[15px] font-semibold text-heading">
              {formatCurrencyFull(totalAmount)}
            </p>
          </div>
        </div>
      )}

      {/* Preview table */}
      {previewRows.length > 0 && (
        <Table<BonusPreviewRow>
          rowKey="teamMemberId"
          size="middle"
          loading={loading}
          columns={columns}
          dataSource={previewRows}
          pagination={false}
          scroll={{ x: 'max-content' }}
          locale={{ emptyText: t('emptyPreview') }}
          rowClassName={(row) => (row.eligible ? '' : 'opacity-60')}
        />
      )}

      {previewRows.length === 0 && !loading && (
        <div className="flex flex-col items-center justify-center py-12 text-subtle">
          <p className="m-0 text-[14px]">{t('previewHint')}</p>
        </div>
      )}

      {/* Run confirm modal */}
      <Modal
        open={runModalOpen}
        title={t('runModalTitle')}
        onCancel={() => setRunModalOpen(false)}
        onOk={() => {
          onRun({ financialYear: fy, disbursedMonth, disbursedYear, note: runNote || undefined });
          setRunModalOpen(false);
          setRunNote('');
        }}
        okText={t('runConfirmBtn')}
        okButtonProps={{ type: 'primary' }}
        destroyOnHidden
      >
        <p className="text-[14px]">
          {t('runModalDesc', {
            count: eligibleRows.length,
            fy: `FY ${fy}-${String(fy + 1).slice(2)}`,
            total: formatCurrencyFull(totalAmount),
          })}
        </p>
        <Alert
          title={t('runIdempotentTitle')}
          description={t('runIdempotentDesc')}
          type="success"
          showIcon
          className="mb-4"
          style={{ borderRadius: 8 }}
        />
        <Form.Item label={t('runNoteLabel')} className="mb-0">
          <InputNumber style={{ display: 'none' }} value={0} onChange={() => undefined} />
          {/* Use a plain input for the note */}
          <input
            className="ant-input"
            placeholder={t('runNotePlaceholder')}
            value={runNote}
            onChange={(e) => setRunNote(e.target.value)}
            style={{
              width: '100%',
              padding: '4px 11px',
              border: '1px solid #d9d9d9',
              borderRadius: 6,
            }}
          />
        </Form.Item>
      </Modal>
    </div>
  );
}
