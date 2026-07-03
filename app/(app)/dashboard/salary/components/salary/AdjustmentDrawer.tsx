'use client';

import { useRef } from 'react';
import { Form, Select, InputNumber, Input, Row, Col, Button, Dropdown, Tooltip } from 'antd';
import type { FormInstance } from 'antd';
import type { MenuProps } from 'antd';
import { InboxOutlined, LockOutlined, MoreOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useTranslations } from 'next-intl';
import { DsDrawer, DsTag, FileUpload } from '@/components/ui';
import type {
  SalaryRecord,
  SalaryAdjustment,
  CreateSalaryAdjustmentPayload,
} from '../../types/salary-page.types';
import { useCurrencyFormatter } from '@/features/salary/hooks/useCurrencyFormatter';
import {
  formatPayrollDayValue,
  formatAdjustmentCategory,
  getAdjustmentActorName,
} from '../../utils/salary-page.utils';
import {
  ADDITION_CATEGORY_OPTIONS,
  DEDUCTION_CATEGORY_OPTIONS,
} from '../../constants/salary-page.constants';

interface AdjustmentSummary {
  creditedDays: number;
  payableDays: number;
  baseSalary: number;
  baseEarned: number;
  additions: number;
  deductions: number;
  netSalary: number;
  paidAmount: number;
  isOverpaid: boolean;
  overpaidAmount: number;
  overpaidCause: 'deduction' | 'advance';
  remaining: number;
}

interface AdjustmentDrawerProps {
  open: boolean;
  record: SalaryRecord | null;
  form: FormInstance;
  adjustmentSummary: AdjustmentSummary | null;
  adjustmentHistory: SalaryAdjustment[];
  adjustmentsLoading: boolean;
  adjustmentSaving: boolean;
  adjustmentProof: string | File | null;
  setAdjustmentProof: (v: string | File | null) => void;
  adjustmentCorrectionSource: SalaryAdjustment | null;
  canCreateAdjustments: boolean;
  canReverseAdjustments: boolean;
  onClose: () => void;
  onSubmit: (vals: CreateSalaryAdjustmentPayload) => void;
  onReverse: (adjustment: SalaryAdjustment, intent: 'reverse' | 'reverse_and_correct') => void;
  onDuplicate: (adjustment: SalaryAdjustment) => void;
  onResetComposer: () => void;
  onFillDeductionForRemaining: () => void;
  formatPayrollDayValue: (val: number) => string;
  formatAdjustmentCategory: (val: string) => string;
  getAdjustmentActorName: (val: string | { name?: string }) => string;
}

export function AdjustmentDrawer({
  open,
  record,
  form,
  adjustmentSummary,
  adjustmentHistory,
  adjustmentsLoading,
  adjustmentSaving,
  adjustmentProof,
  setAdjustmentProof,
  adjustmentCorrectionSource,
  canCreateAdjustments,
  canReverseAdjustments,
  onClose,
  onSubmit,
  onReverse,
  onDuplicate,
  onResetComposer,
  onFillDeductionForRemaining,
  formatPayrollDayValue: fmtPayrollDayValue,
  formatAdjustmentCategory: fmtAdjCategory,
  getAdjustmentActorName: fmtAdjActorName,
}: AdjustmentDrawerProps) {
  const t = useTranslations('salary.adjustmentDrawer');
  const selectedAdjustmentType = Form.useWatch('type', form);
  const currencyFmt = useCurrencyFormatter();
  const formatCurrencyFull = currencyFmt.full;
  const isRecordLocked = Boolean(record?.isLocked);
  const canMutateAdjustments = canCreateAdjustments && !isRecordLocked;
  const lockedAdjustmentsMessage = t('composer.lockedMessage');
  const addAdjustmentSectionRef = useRef<HTMLDivElement>(null);
  const handleFillDeductionClick = () => {
    if (!canMutateAdjustments) {
      return;
    }

    onFillDeductionForRemaining();

    if (typeof window !== 'undefined') {
      window.requestAnimationFrame(() => {
        addAdjustmentSectionRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        });
      });
    }
  };

  return (
    <DsDrawer
      open={open}
      onClose={onClose}
      title={t('title', { name: record?.teamMember?.name ?? '' })}
    >
      {record && (
        <div className="flex flex-col gap-4">
          <div
            className="rounded-[14px] border p-4"
            style={{
              borderColor: 'var(--cr-border)',
              background: 'var(--cr-surface-secondary, var(--cr-bg))',
            }}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="m-0 text-[12px] font-semibold tracking-wide text-subtle uppercase">
                  {dayjs(`${record.year}-${String(record.month).padStart(2, '0')}-01`).format(
                    'MMMM YYYY',
                  )}
                </p>
                <p className="m-0 mt-1 text-[18px] font-bold text-heading">
                  {record.teamMember?.name || t('employeeFallback')}
                </p>
                <p className="m-0 mt-1 text-[12px] text-subtle">
                  {adjustmentSummary
                    ? t('creditedPayableDays', {
                        credited: fmtPayrollDayValue(adjustmentSummary.creditedDays),
                        payable: fmtPayrollDayValue(adjustmentSummary.payableDays),
                      })
                    : t('salarySummaryFallback')}
                </p>
              </div>
              {!record._id && <DsTag status="pending">{t('notGeneratedYet')}</DsTag>}
            </div>
            {adjustmentSummary && (
              <div className="mt-4 flex flex-col gap-4">
                <div
                  className="rounded-[12px] border p-3"
                  style={{ borderColor: 'var(--cr-border)', background: 'var(--cr-surface, #fff)' }}
                >
                  <p className="m-0 mb-2 text-[11px] font-semibold tracking-wide text-subtle uppercase">
                    {t('payrollComputation.heading')}
                  </p>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-[13px]">
                      <span className="text-subtle">
                        {t('payrollComputation.monthlyBaseSalary')}
                      </span>
                      <span className="font-semibold text-heading">
                        {formatCurrencyFull(adjustmentSummary.baseSalary)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[13px]">
                      <span className="text-subtle">
                        {t('payrollComputation.earnedFromAttendance')}
                      </span>
                      <span className="font-semibold text-heading">
                        {formatCurrencyFull(adjustmentSummary.baseEarned)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[13px]">
                      <span className="text-[var(--cr-success)]">
                        {t('payrollComputation.additions')}
                      </span>
                      <span className="font-semibold text-[var(--cr-success)]">
                        {formatCurrencyFull(adjustmentSummary.additions)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[13px]">
                      <span className="text-[var(--cr-error)]">
                        {t('payrollComputation.deductions')}
                      </span>
                      <span className="font-semibold text-[var(--cr-error)]">
                        {formatCurrencyFull(adjustmentSummary.deductions)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between border-t pt-2">
                      <span className="text-[13px] font-semibold text-heading">
                        {t('payrollComputation.netSalaryPayable')}
                      </span>
                      <span className="text-[18px] font-bold text-heading">
                        {formatCurrencyFull(adjustmentSummary.netSalary)}
                      </span>
                    </div>
                  </div>
                </div>

                <div
                  className="rounded-[12px] border p-3"
                  style={{ borderColor: 'var(--cr-border)', background: 'var(--cr-surface, #fff)' }}
                >
                  <p className="m-0 mb-2 text-[11px] font-semibold tracking-wide text-subtle uppercase">
                    {t('paymentSettlement.heading')}
                  </p>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-[13px]">
                      <span className="text-subtle">{t('paymentSettlement.paidSoFar')}</span>
                      <span className="font-semibold text-[var(--cr-success)]">
                        {formatCurrencyFull(adjustmentSummary.paidAmount)}
                      </span>
                    </div>
                    {adjustmentSummary.isOverpaid ? (
                      <div className="flex items-center justify-between text-[13px]">
                        <span className="text-[var(--cr-warning-700)]">
                          {adjustmentSummary.overpaidCause === 'deduction'
                            ? t('paymentSettlement.recoveryDue')
                            : t('paymentSettlement.advanceExcessPaid')}
                        </span>
                        <span className="font-semibold text-[var(--cr-warning-700)]">
                          {formatCurrencyFull(adjustmentSummary.overpaidAmount)}
                        </span>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center justify-between text-[13px]">
                          <span className="text-subtle">
                            {t('paymentSettlement.balanceRemaining')}
                          </span>
                          <span className="font-semibold text-heading">
                            {formatCurrencyFull(adjustmentSummary.remaining)}
                          </span>
                        </div>
                        {adjustmentSummary.remaining > 0 && (
                          <div className="flex items-center justify-between gap-3 text-[12px]">
                            <span className="text-subtle">
                              {t('paymentSettlement.notPayingInFull')}
                            </span>
                            <Button
                              size="small"
                              onClick={handleFillDeductionClick}
                              disabled={!canMutateAdjustments}
                              style={{ flexShrink: 0 }}
                            >
                              {t('paymentSettlement.fillDeduction')}
                            </Button>
                          </div>
                        )}
                      </>
                    )}
                    <div
                      className="rounded-[10px] px-3 py-2 text-[12px]"
                      style={{
                        background: adjustmentSummary.isOverpaid
                          ? 'var(--cr-warning-50)'
                          : 'var(--cr-info-50)',
                        color: adjustmentSummary.isOverpaid
                          ? 'var(--cr-warning-700)'
                          : 'var(--cr-info-700)',
                      }}
                    >
                      {adjustmentSummary.isOverpaid
                        ? adjustmentSummary.overpaidCause === 'deduction'
                          ? t('paymentSettlement.overpaidDeductionInfo')
                          : t('paymentSettlement.overpaidAdvanceInfo')
                        : t('paymentSettlement.balanceInfo')}
                    </div>
                  </div>
                </div>

                <div
                  className="rounded-[10px] px-3 py-2 text-[12px]"
                  style={{ background: 'var(--cr-bg)', color: 'var(--cr-text-4)' }}
                >
                  {t('paymentLedgerNote')}
                </div>
              </div>
            )}
            {!record._id && (
              <div
                className="mt-4 rounded-[10px] px-3 py-2 text-[12px]"
                style={{ background: 'var(--cr-warning-50)', color: 'var(--cr-warning-700)' }}
              >
                {t('notGeneratedNote')}
              </div>
            )}
          </div>

          <div
            ref={addAdjustmentSectionRef}
            className="rounded-[14px] border p-4"
            style={{ borderColor: 'var(--cr-border)' }}
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="m-0 text-[15px] font-semibold text-heading">
                  {t('composer.heading')}
                </p>
                <p className="m-0 text-[12px] text-subtle">{t('composer.description')}</p>
              </div>
              <div className="flex items-center gap-2">
                {isRecordLocked && <DsTag status="pending">{t('composer.lockedTag')}</DsTag>}
                {!canCreateAdjustments && (
                  <DsTag status="pending">{t('composer.upgradeRequiredTag')}</DsTag>
                )}
              </div>
            </div>

            {isRecordLocked && (
              <div
                className="mb-4 rounded-[12px] px-3 py-3 text-[12px]"
                style={{
                  background: 'var(--cr-warning-50)',
                  border: '1px solid var(--cr-warning-500)',
                  color: 'var(--cr-warning-700)',
                }}
              >
                {lockedAdjustmentsMessage}
              </div>
            )}

            {adjustmentCorrectionSource && (
              <div
                className="mb-4 rounded-[12px] px-3 py-3"
                style={{
                  background: 'var(--cr-info-50)',
                  border: '1px solid var(--cr-primary-border)',
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="m-0 text-[13px] font-semibold text-heading">
                      {t('composer.correctionDraftHeading')}
                    </p>
                    <p className="m-0 mt-1 text-[12px] text-subtle">
                      {t('composer.correctionDraftDescription', {
                        title: adjustmentCorrectionSource.reasonTitle,
                      })}
                    </p>
                  </div>
                  <Button size="small" onClick={onResetComposer} disabled={adjustmentSaving}>
                    {t('composer.clearButton')}
                  </Button>
                </div>
              </div>
            )}

            <Form
              form={form}
              layout="vertical"
              requiredMark={false}
              onFinish={onSubmit}
              initialValues={{
                type: 'addition',
                category: ADDITION_CATEGORY_OPTIONS[0],
              }}
              onValuesChange={(changedValues) => {
                if (changedValues.type) {
                  const categories =
                    changedValues.type === 'addition'
                      ? ADDITION_CATEGORY_OPTIONS
                      : DEDUCTION_CATEGORY_OPTIONS;
                  form.setFieldValue('category', categories[0]);
                }
              }}
            >
              <Row gutter={12}>
                <Col xs={24} md={12}>
                  <Form.Item
                    name="type"
                    label={t('composer.typeLabel')}
                    rules={[{ required: true, message: t('composer.typeRequired') }]}
                  >
                    <Select
                      options={[
                        { label: t('composer.typeAddition'), value: 'addition' },
                        { label: t('composer.typeDeduction'), value: 'deduction' },
                      ]}
                      disabled={!canMutateAdjustments}
                    />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item
                    name="category"
                    label={t('composer.categoryLabel')}
                    rules={[{ required: true, message: t('composer.categoryRequired') }]}
                  >
                    <Select
                      options={(selectedAdjustmentType === 'addition'
                        ? ADDITION_CATEGORY_OPTIONS
                        : DEDUCTION_CATEGORY_OPTIONS
                      ).map((value) => ({
                        label: fmtAdjCategory(value),
                        value,
                      }))}
                      disabled={!canMutateAdjustments}
                    />
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={12}>
                <Col xs={24} md={12}>
                  <Form.Item
                    name="amount"
                    label={t('composer.amountLabel')}
                    rules={[{ required: true, message: t('composer.amountRequired') }]}
                  >
                    <InputNumber
                      className="w-full"
                      min={0}
                      prefix={currencyFmt.symbol}
                      disabled={!canMutateAdjustments}
                    />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item
                    name="reasonTitle"
                    label={t('composer.shortReasonLabel')}
                    rules={[{ required: true, message: t('composer.shortReasonRequired') }]}
                  >
                    <Input
                      placeholder={t('composer.shortReasonPlaceholder')}
                      disabled={!canMutateAdjustments}
                    />
                  </Form.Item>
                </Col>
              </Row>
              <Form.Item name="note" label={t('composer.noteLabel')}>
                <Input.TextArea
                  rows={3}
                  placeholder={t('composer.notePlaceholder')}
                  disabled={!canMutateAdjustments}
                />
              </Form.Item>
              <div className="mb-4">
                <p className="mb-2 text-[13px] font-medium text-heading">
                  {t('composer.proofAttachmentLabel')}
                </p>
                <FileUpload
                  category="proofs"
                  value={adjustmentProof ?? undefined}
                  onChange={(value) => setAdjustmentProof(value)}
                  disabled={!canMutateAdjustments}
                />
              </div>
              <div className="flex justify-end">
                <Button
                  type="primary"
                  loading={adjustmentSaving}
                  onClick={() => form.submit()}
                  disabled={!canMutateAdjustments}
                >
                  {adjustmentCorrectionSource
                    ? t('composer.saveCorrectedButton')
                    : t('composer.saveAdjustmentButton')}
                </Button>
              </div>
            </Form>
          </div>

          <div className="rounded-[14px] border p-4" style={{ borderColor: 'var(--cr-border)' }}>
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="m-0 text-[15px] font-semibold text-heading">{t('history.heading')}</p>
                <p className="m-0 text-[12px] text-subtle">{t('history.description')}</p>
              </div>
              {adjustmentHistory.length > 0 && (
                <DsTag status="paid">
                  {t('history.entriesTag', { count: adjustmentHistory.length })}
                </DsTag>
              )}
            </div>

            {adjustmentsLoading ? (
              <div className="py-10 text-center text-subtle">{t('history.loading')}</div>
            ) : adjustmentHistory.length === 0 ? (
              <div className="py-10 text-center text-subtle">
                <InboxOutlined className="mb-2 block text-[34px]" />
                <p className="m-0 text-[14px] font-semibold text-secondary">
                  {t('history.emptyTitle')}
                </p>
                <p className="m-0 text-[12px]">{t('history.emptyBody')}</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {adjustmentHistory.map((adjustment) => {
                  const isReversed = adjustment.status === 'reversed';
                  const isSystemGeneratedAdjustment =
                    adjustment.source === 'payment_recording' || adjustment.source === 'system';
                  const reverseDisabledReason = isRecordLocked
                    ? lockedAdjustmentsMessage
                    : isSystemGeneratedAdjustment
                      ? t('history.menuReverseDisabledTooltip')
                      : null;
                  const correctionLink =
                    adjustment.correctionOfAdjustmentId &&
                    typeof adjustment.correctionOfAdjustmentId !== 'string'
                      ? adjustment.correctionOfAdjustmentId
                      : null;
                  const hasAttachments = (adjustment.attachments?.length ?? 0) > 0;
                  const actionItems: MenuProps['items'] = [
                    ...(!isReversed && canReverseAdjustments
                      ? [
                          reverseDisabledReason
                            ? ({
                                key: 'reverse-disabled',
                                label: (
                                  <Tooltip title={reverseDisabledReason}>
                                    <span className="inline-flex items-center gap-1 text-subtle">
                                      <LockOutlined /> {t('history.menuReverse')}
                                    </span>
                                  </Tooltip>
                                ),
                                disabled: true,
                              } satisfies NonNullable<MenuProps['items']>[number])
                            : ({
                                key: 'reverse',
                                label: t('history.menuReverse'),
                                danger: true,
                              } satisfies NonNullable<MenuProps['items']>[number]),
                        ]
                      : []),
                    ...(canMutateAdjustments
                      ? [
                          {
                            key: 'duplicate',
                            label: t('history.menuDuplicate'),
                          } satisfies NonNullable<MenuProps['items']>[number],
                        ]
                      : []),
                    ...(hasAttachments
                      ? [
                          {
                            key: 'proof',
                            label:
                              (adjustment.attachments?.length ?? 0) > 1
                                ? t('history.menuViewProofMultiple', {
                                    count: adjustment.attachments?.length ?? 0,
                                  })
                                : t('history.menuViewProofSingle'),
                          } satisfies NonNullable<MenuProps['items']>[number],
                        ]
                      : []),
                  ];
                  return (
                    <div
                      key={adjustment._id}
                      className="rounded-[12px] border p-3"
                      style={{
                        borderColor: 'var(--cr-border)',
                        background: isReversed ? 'var(--cr-bg)' : 'var(--cr-surface, #fff)',
                        opacity: isReversed ? 0.78 : 1,
                      }}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className="rounded-full px-2 py-0.5 text-[11px] font-bold"
                              style={{
                                background:
                                  adjustment.type === 'addition'
                                    ? 'var(--cr-success-50)'
                                    : 'var(--cr-danger-50)',
                                color:
                                  adjustment.type === 'addition'
                                    ? 'var(--cr-success-700)'
                                    : 'var(--cr-danger-700)',
                              }}
                            >
                              {adjustment.type === 'addition'
                                ? t('history.badgeAddition')
                                : t('history.badgeDeduction')}
                            </span>
                            <span className="text-[11px] font-semibold text-subtle">
                              {fmtAdjCategory(adjustment.category)}
                            </span>
                            {isReversed && (
                              <span
                                className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
                                style={{
                                  background: 'var(--cr-border)',
                                  color: 'var(--cr-text-4)',
                                }}
                              >
                                {t('history.badgeReversed')}
                              </span>
                            )}
                            {adjustment.source === 'payment_recording' && (
                              <Tooltip title={t('history.badgePaymentLinkedTooltip')}>
                                <span
                                  className="cursor-help rounded-full px-1.5 py-0.5 text-[10px] font-semibold"
                                  style={{
                                    background: 'var(--cr-info-50)',
                                    color: 'var(--cr-info-700)',
                                  }}
                                >
                                  {t('history.badgePaymentLinked')}
                                </span>
                              </Tooltip>
                            )}
                            {adjustment.source === 'system' && (
                              <Tooltip title={t('history.badgeSystemTooltip')}>
                                <span
                                  className="cursor-help rounded-full px-1.5 py-0.5 text-[10px] font-semibold"
                                  style={{
                                    background: 'var(--cr-warning-50)',
                                    color: 'var(--cr-warning-700)',
                                  }}
                                >
                                  {t('history.badgeSystem')}
                                </span>
                              </Tooltip>
                            )}
                          </div>
                          <p className="m-0 mt-2 text-[15px] font-semibold text-heading">
                            {adjustment.reasonTitle}
                          </p>
                          {adjustment.note && (
                            <p className="m-0 mt-1 text-[12px] text-subtle">{adjustment.note}</p>
                          )}
                        </div>
                        <div className="flex flex-shrink-0 items-start gap-2">
                          <div className="text-right">
                            <p
                              className="m-0 text-[16px] font-bold"
                              style={{
                                color:
                                  adjustment.type === 'addition'
                                    ? 'var(--cr-success)'
                                    : 'var(--cr-error)',
                              }}
                            >
                              {adjustment.type === 'addition' ? '+' : '-'}
                              {formatCurrencyFull(adjustment.amount)}
                            </p>
                            <p className="m-0 mt-1 text-[11px] text-subtle">
                              {adjustment.createdAt
                                ? dayjs(adjustment.createdAt).format('DD MMM YYYY, hh:mm A')
                                : t('history.justNow')}
                            </p>
                          </div>
                          {actionItems.length > 0 && (
                            <Dropdown
                              trigger={['click']}
                              placement="bottomRight"
                              menu={{
                                items: actionItems,
                                onClick: ({ key }) => {
                                  if (key === 'reverse') {
                                    onReverse(adjustment, 'reverse');
                                    return;
                                  }
                                  if (key === 'duplicate') {
                                    onDuplicate(adjustment);
                                    return;
                                  }
                                  if (key === 'proof' && adjustment.attachments?.[0]) {
                                    window.open(
                                      adjustment.attachments[0],
                                      '_blank',
                                      'noopener,noreferrer',
                                    );
                                  }
                                },
                              }}
                            >
                              <Button
                                size="small"
                                icon={<MoreOutlined />}
                                aria-label={t('history.actionsAriaLabel', {
                                  title: adjustment.reasonTitle,
                                })}
                              />
                            </Dropdown>
                          )}
                        </div>
                      </div>

                      <div className="mt-3 flex flex-wrap items-center gap-3 text-[12px] text-subtle">
                        <span>
                          {t('history.createdBy', {
                            name: fmtAdjActorName(
                              adjustment.createdBy as string | { name?: string },
                            ),
                          })}
                        </span>
                        {hasAttachments && (
                          <span>
                            {t('history.attachmentCount', {
                              count: adjustment.attachments?.length ?? 0,
                            })}
                          </span>
                        )}
                      </div>

                      {hasAttachments && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {adjustment.attachments?.map((attachment, index) => (
                            <a
                              key={`${adjustment._id}-${index}`}
                              href={attachment}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[12px] font-medium"
                              style={{ color: 'var(--cr-primary)' }}
                            >
                              {adjustment.attachments && adjustment.attachments.length > 1
                                ? t('history.viewProofIndexed', { index: index + 1 })
                                : t('history.viewProof')}
                            </a>
                          ))}
                        </div>
                      )}

                      {correctionLink && (
                        <div
                          className="mt-3 rounded-[10px] px-3 py-2 text-[12px]"
                          style={{
                            background: 'var(--cr-success-50)',
                            color: 'var(--cr-success-700)',
                          }}
                        >
                          {t('history.correctionLinked', { title: correctionLink.reasonTitle })}
                        </div>
                      )}

                      {isReversed && (
                        <div
                          className="mt-3 rounded-[10px] px-3 py-2 text-[12px]"
                          style={{
                            background: 'var(--cr-border-light)',
                            color: 'var(--cr-text-4)',
                          }}
                        >
                          {t('history.reversedBy', {
                            name: fmtAdjActorName(
                              adjustment.reversedBy as string | { name?: string },
                            ),
                          })}
                          {adjustment.reversedAt
                            ? t('history.reversedOn', {
                                date: dayjs(adjustment.reversedAt).format('DD MMM YYYY, hh:mm A'),
                              })
                            : ''}
                          {adjustment.reversalReason ? ` - ${adjustment.reversalReason}` : ''}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </DsDrawer>
  );
}
