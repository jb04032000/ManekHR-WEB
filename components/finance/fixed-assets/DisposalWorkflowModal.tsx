'use client';
import React, { useState, useEffect, startTransition } from 'react';
import {
  Steps,
  Form,
  Select,
  DatePicker,
  Input,
  InputNumber,
  Typography,
  Descriptions,
  message,
} from 'antd';
import dayjs from 'dayjs';
import { useTranslations } from 'next-intl';
import { DsModal } from '@/components/ui/DsModal';
import DsButton from '@/components/ui/DsButton';
import ItcReversalAlert from './ItcReversalAlert';
import { previewDisposal, disposeAsset } from '@/lib/actions/finance-fixed-assets.actions';
import { listAccounts } from '@/lib/actions/finance.actions';
import {
  buildCashBankAccountOptions,
  type CashBankAccountOption,
} from '@/lib/finance/cash-bank-accounts';
import { useWorkspaceStore } from '@/lib/store';
import { formatCurrencyFull } from '@/lib/utils';
import type { FixedAsset, DisposalPreview } from '@/types';

interface DisposalWorkflowModalProps {
  asset: FixedAsset;
  open: boolean;
  onClose: () => void;
  onComplete: () => void;
}

const formatPaise = (v: number) => formatCurrencyFull(v / 100);

export default function DisposalWorkflowModal({
  asset,
  open,
  onClose,
  onComplete,
}: DisposalWorkflowModalProps) {
  const t = useTranslations('finance.fixedAssets.disposal');
  const wsId = useWorkspaceStore((s) => s.currentWorkspace?._id ?? '');
  const DISPOSAL_TYPES = [
    { value: 'sale', label: t('type.sale') },
    { value: 'scrap', label: t('type.scrap') },
    { value: 'writeoff', label: t('type.writeoff') },
  ];
  const [step, setStep] = useState(0);
  const [form] = Form.useForm();
  const [preview, setPreview] = useState<DisposalPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [itcAcknowledged, setItcAcknowledged] = useState(false);
  const [accountOptions, setAccountOptions] = useState<CashBankAccountOption[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(false);

  // Load the firm's real cash/bank chart-of-accounts entries for the proceeds
  // account picker. Never hardcode codes - they differ per firm's CoA.
  useEffect(() => {
    if (!open || !wsId || !asset.firmId) return;
    startTransition(() => {
      setAccountsLoading(true);
    });
    listAccounts(wsId, asset.firmId)
      .then((accounts) => setAccountOptions(buildCashBankAccountOptions(accounts)))
      .catch(() => setAccountOptions([]))
      .finally(() => setAccountsLoading(false));
  }, [open, wsId, asset.firmId]);

  const handleClose = () => {
    form.resetFields();
    setStep(0);
    setPreview(null);
    setItcAcknowledged(false);
    onClose();
  };

  const handleNext = async () => {
    if (step === 0) {
      // Validate form and fetch preview
      let values: {
        disposalType: string;
        disposalDate: dayjs.Dayjs;
        disposalProceedsPaise?: number;
        cashOrBankAccountCode?: string;
        narration?: string;
      };
      try {
        values = await form.validateFields();
      } catch {
        return;
      }
      setPreviewLoading(true);
      try {
        const proceeds = values.disposalProceedsPaise ?? 0;
        const dateStr = values.disposalDate.format('YYYY-MM-DD');
        const p = await previewDisposal(wsId, asset.firmId, asset._id, dateStr, proceeds * 100);
        setPreview(p);
        setItcAcknowledged(false);
        setStep(1);
      } catch {
        message.error(t('toast.previewFailed'));
      } finally {
        setPreviewLoading(false);
      }
    } else if (step === 1) {
      setStep(2);
    }
  };

  const handleConfirm = async () => {
    const values = form.getFieldsValue();
    setConfirmLoading(true);
    try {
      await disposeAsset(wsId, asset.firmId, asset._id, {
        disposalDate: (values.disposalDate as dayjs.Dayjs).format('YYYY-MM-DD'),
        disposalProceedsPaise: (values.disposalProceedsPaise ?? 0) * 100,
        cashOrBankAccountCode: values.cashOrBankAccountCode,
        disposalType: values.disposalType as 'sale' | 'scrap' | 'writeoff',
        narration: values.narration,
        acknowledgeItcReversal: itcAcknowledged,
      });
      message.success(t('toast.disposed'));
      handleClose();
      onComplete();
    } catch (err: unknown) {
      const anyErr = err as { response?: { data?: { message?: string } } };
      message.error(anyErr?.response?.data?.message ?? t('toast.disposalFailed'));
    } finally {
      setConfirmLoading(false);
    }
  };

  const itcApplicable = preview?.itcReversal?.applicable ?? false;
  const confirmDisabled = itcApplicable && !itcAcknowledged;

  const footer = (
    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
      <DsButton dsVariant="ghost" onClick={step === 0 ? handleClose : () => setStep(step - 1)}>
        {step === 0 ? t('buttons.cancel') : t('buttons.back')}
      </DsButton>
      <div style={{ display: 'flex', gap: 8 }}>
        {step < 2 ? (
          <DsButton dsVariant="primary" loading={previewLoading} onClick={handleNext}>
            {step === 0 ? t('buttons.preview') : t('buttons.reviewConfirm')}
          </DsButton>
        ) : (
          <DsButton
            dsVariant="primary"
            loading={confirmLoading}
            disabled={confirmDisabled}
            onClick={handleConfirm}
          >
            {t('buttons.confirmDisposal')}
          </DsButton>
        )}
      </div>
    </div>
  );

  return (
    <DsModal
      open={open}
      title={t('titleWithCode', { code: asset.assetCode })}
      onCancel={handleClose}
      footer={footer}
      width={640}
      destroyOnHidden
    >
      <Steps
        current={step}
        items={[
          { title: t('steps.details') },
          { title: t('steps.preview') },
          { title: t('steps.confirm') },
        ]}
        style={{ marginBottom: 24 }}
      />

      {/* Step 0: Form */}
      {step === 0 && (
        <Form form={form} layout="vertical">
          <Form.Item
            label={t('fields.disposalType')}
            name="disposalType"
            rules={[{ required: true, message: t('validation.selectType') }]}
          >
            <Select options={DISPOSAL_TYPES} placeholder={t('placeholders.selectType')} />
          </Form.Item>
          <Form.Item
            label={t('fields.disposalDate')}
            name="disposalDate"
            rules={[{ required: true, message: t('validation.selectDate') }]}
            initialValue={dayjs()}
          >
            <DatePicker style={{ width: '100%' }} disabledDate={(d) => d > dayjs()} />
          </Form.Item>
          <Form.Item noStyle shouldUpdate={(prev, curr) => prev.disposalType !== curr.disposalType}>
            {({ getFieldValue }) =>
              getFieldValue('disposalType') !== 'scrap' && (
                <>
                  <Form.Item
                    label={t('fields.proceeds')}
                    name="disposalProceedsPaise"
                    rules={[
                      {
                        required: getFieldValue('disposalType') === 'sale',
                        message: t('validation.enterProceeds'),
                      },
                    ]}
                  >
                    <InputNumber
                      style={{ width: '100%' }}
                      min={0}
                      precision={2}
                      prefix="₹"
                      placeholder="0.00"
                    />
                  </Form.Item>
                  <Form.Item
                    label={t('fields.cashBankAccount')}
                    name="cashOrBankAccountCode"
                    rules={[
                      {
                        required: (form.getFieldValue('disposalProceedsPaise') ?? 0) > 0,
                        message: t('validation.selectAccount'),
                      },
                    ]}
                  >
                    <Select
                      options={accountOptions}
                      loading={accountsLoading}
                      placeholder={t('placeholders.selectAccount')}
                      notFoundContent={
                        accountsLoading ? t('placeholders.loading') : t('placeholders.noAccounts')
                      }
                      allowClear
                    />
                  </Form.Item>
                </>
              )
            }
          </Form.Item>
          <Form.Item label={t('fields.narration')} name="narration">
            <Input.TextArea rows={2} placeholder={t('placeholders.narration')} />
          </Form.Item>
        </Form>
      )}

      {/* Step 1: Preview */}
      {step === 1 && preview && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Descriptions bordered size="small" column={2}>
            <Descriptions.Item label={t('preview.cost')}>
              {formatPaise(preview.costPaise)}
            </Descriptions.Item>
            <Descriptions.Item label={t('preview.accumulatedDepreciation')}>
              {formatPaise(preview.accumulatedDepreciationPaise)}
            </Descriptions.Item>
            <Descriptions.Item label={t('preview.partialMonthDepreciation')}>
              {formatPaise(preview.partialMonthDepreciationPaise)}
            </Descriptions.Item>
            <Descriptions.Item label={t('preview.nbvAtDisposal')}>
              {formatPaise(preview.nbvAtDisposalPaise)}
            </Descriptions.Item>
            <Descriptions.Item label={t('preview.proceeds')}>
              {formatPaise(preview.disposalProceedsPaise)}
            </Descriptions.Item>
            <Descriptions.Item label={t('preview.gainLoss')}>
              <Typography.Text type={preview.gainLossPaise >= 0 ? 'success' : 'danger'} strong>
                {preview.gainLossPaise >= 0 ? '+' : ''}
                {formatPaise(preview.gainLossPaise)}
              </Typography.Text>
            </Descriptions.Item>
          </Descriptions>

          {itcApplicable && (
            <ItcReversalAlert
              reversal={preview.itcReversal}
              acknowledged={itcAcknowledged}
              onAcknowledge={setItcAcknowledged}
            />
          )}
        </div>
      )}

      {/* Step 2: Confirm */}
      {step === 2 && preview && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Typography.Text>
            {t.rich('confirm.sentence', {
              code: asset.assetCode,
              name: asset.name,
              strong: (chunks) => <Typography.Text strong>{chunks}</Typography.Text>,
            })}
          </Typography.Text>
          <Descriptions bordered size="small" column={1}>
            <Descriptions.Item label={t('preview.nbvAtDisposal')}>
              {formatPaise(preview.nbvAtDisposalPaise)}
            </Descriptions.Item>
            <Descriptions.Item label={t('preview.proceeds')}>
              {formatPaise(preview.disposalProceedsPaise)}
            </Descriptions.Item>
            <Descriptions.Item label={t('preview.gainLoss')}>
              <Typography.Text type={preview.gainLossPaise >= 0 ? 'success' : 'danger'} strong>
                {preview.gainLossPaise >= 0 ? '+' : ''}
                {formatPaise(preview.gainLossPaise)}
              </Typography.Text>
            </Descriptions.Item>
          </Descriptions>
          {itcApplicable && !itcAcknowledged && (
            <Typography.Text type="danger">{t('confirm.mustAcknowledgeItc')}</Typography.Text>
          )}
        </div>
      )}
    </DsModal>
  );
}
