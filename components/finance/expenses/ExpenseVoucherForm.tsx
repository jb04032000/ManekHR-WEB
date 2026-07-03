'use client';

import { useState, useTransition, useEffect } from 'react';
import {
  Form,
  Select,
  DatePicker,
  Input,
  Button,
  Card,
  Divider,
  Space,
  Typography,
  Segmented,
  message,
  Alert,
} from 'antd';
import { SaveOutlined, SendOutlined } from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import dayjs from 'dayjs';
import type { ExpenseVoucher, Account, Party, ExpensePaymentMode } from '@/types';
import { ExpenseLineTable, type ExpenseLineRow } from './ExpenseLineTable';
import { TdsPanel } from './TdsPanel';
import { createExpense, updateExpense, postExpense } from '@/lib/actions/finance-expenses.actions';

const { Title, Text } = Typography;

interface ExpenseVoucherFormProps {
  mode: 'create' | 'edit' | 'view';
  wsId: string;
  firmId: string;
  initialData?: ExpenseVoucher;
  accounts?: Account[];
  parties?: Party[];
}

function formatPaise(paise: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format((paise ?? 0) / 100);
}

export function ExpenseVoucherForm({
  mode,
  wsId,
  firmId,
  initialData,
  accounts = [],
  parties = [],
}: ExpenseVoucherFormProps) {
  const t = useTranslations('finance.purchases');
  const router = useRouter();
  const [form] = Form.useForm();
  const [isPending, startTransition] = useTransition();
  const [paymentMode, setPaymentMode] = useState<ExpensePaymentMode>(
    initialData?.paymentMode ?? 'bank',
  );
  const [lineItems, setLineItems] = useState<ExpenseLineRow[]>([]);
  const [savedVoucher, setSavedVoucher] = useState<ExpenseVoucher | undefined>(initialData);

  const isReadOnly =
    mode === 'view' || initialData?.state === 'posted' || initialData?.state === 'cancelled';

  // Keyboard shortcuts
  useEffect(() => {
    if (isReadOnly) return;
    function handler(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        handlePost();
      }
    }
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReadOnly, lineItems]);

  // Compute summary totals from line items
  const taxableValuePaise = lineItems.reduce((sum, l) => sum + (l.amountPaise ?? 0), 0);
  const totalGstPaise = lineItems.reduce(
    (sum, l) => sum + ((l.lineTotalPaise ?? 0) - (l.amountPaise ?? 0)),
    0,
  );
  const grandTotalPaise = taxableValuePaise + totalGstPaise;
  const tdsApplied = savedVoucher?.tdsApplied;
  const netPayablePaise = grandTotalPaise - (tdsApplied?.tdsPaise ?? 0);

  async function saveDraft() {
    const values = await form.validateFields();
    const dto = {
      voucherDate: values.voucherDate?.format('YYYY-MM-DD') ?? dayjs().format('YYYY-MM-DD'),
      partyId: values.partyId,
      paymentMode,
      cashRegisterId: values.cashRegisterId,
      bankAccountId: values.bankAccountId,
      chequeId: values.chequeId,
      utrReference: values.utrReference,
      isIntraState: true,
      narration: values.narration,
      lineItems: lineItems.map((l) => ({
        expenseAccountId: l.expenseAccountId,
        description: l.description,
        amountPaise: l.amountPaise,
        gstRate: l.gstRate,
        itcEligibility: l.itcEligibility,
        costCentre: l.costCentre,
      })),
    };

    startTransition(async () => {
      try {
        let result: ExpenseVoucher;
        if (mode === 'create' || !initialData?._id) {
          result = await createExpense(wsId, firmId, dto);
        } else {
          result = await updateExpense(wsId, firmId, initialData._id, dto);
        }
        setSavedVoucher(result);
        message.success(t('editor.expense.savedAsDraft'));
        if (mode === 'create') {
          router.push(`/dashboard/finance/expenses/${result._id}`);
        }
      } catch (e: any) {
        message.error(e?.message ?? t('editor.expense.saveFailed'));
      }
    });
  }

  async function handlePost() {
    if (!savedVoucher?._id && mode === 'create') {
      // Save first, then post
      const values = await form.validateFields();
      const dto = {
        voucherDate: values.voucherDate?.format('YYYY-MM-DD') ?? dayjs().format('YYYY-MM-DD'),
        partyId: values.partyId,
        paymentMode,
        cashRegisterId: values.cashRegisterId,
        bankAccountId: values.bankAccountId,
        chequeId: values.chequeId,
        utrReference: values.utrReference,
        isIntraState: true,
        narration: values.narration,
        lineItems: lineItems.map((l) => ({
          expenseAccountId: l.expenseAccountId,
          description: l.description,
          amountPaise: l.amountPaise,
          gstRate: l.gstRate,
          itcEligibility: l.itcEligibility,
          costCentre: l.costCentre,
        })),
      };
      startTransition(async () => {
        try {
          const draft = await createExpense(wsId, firmId, dto);
          const posted = await postExpense(wsId, firmId, draft._id);
          message.success(
            t('editor.expense.postedSuccessfully', { number: posted.voucherNumber ?? '' }),
          );
          router.push(`/dashboard/finance/expenses/${posted._id}`);
        } catch (e: any) {
          message.error(e?.message ?? t('editor.expense.postFailed'));
        }
      });
    } else {
      const id = savedVoucher?._id ?? initialData?._id;
      if (!id) return;
      startTransition(async () => {
        try {
          const posted = await postExpense(wsId, firmId, id);
          setSavedVoucher(posted);
          message.success(
            t('editor.expense.postedSuccessfully', { number: posted.voucherNumber ?? '' }),
          );
          router.push(`/dashboard/finance/expenses/${posted._id}`);
        } catch (e: any) {
          message.error(e?.message ?? t('editor.expense.postFailed'));
        }
      });
    }
  }

  const partyOptions = parties.map((p) => ({ value: p._id, label: p.name }));
  const accountOptions = accounts.map((a) => ({
    value: a._id,
    label: `${a.code} - ${a.name}`,
    code: a.code,
    name: a.name,
  }));

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: 24 }}>
      <Title level={1} style={{ marginBottom: 24, fontSize: 22 }}>
        {mode === 'create'
          ? t('editor.expense.newTitle')
          : mode === 'edit'
            ? t('editor.expense.editTitle')
            : t('editor.expense.viewTitle')}
        {savedVoucher?.voucherNumber && (
          <Text type="secondary" style={{ marginLeft: 12, fontSize: 14 }}>
            {savedVoucher.voucherNumber}
          </Text>
        )}
      </Title>

      <Form
        form={form}
        layout="vertical"
        initialValues={{
          voucherDate: initialData?.voucherDate ? dayjs(initialData.voucherDate) : dayjs(),
          partyId: initialData?.partyId,
          narration: initialData?.narration ?? '',
          cashRegisterId: initialData?.cashRegisterId,
          bankAccountId: initialData?.bankAccountId,
          utrReference: initialData?.utrReference,
        }}
        disabled={isReadOnly}
      >
        {/* Header row */}
        <Card size="small" style={{ marginBottom: 16 }}>
          <Space wrap style={{ width: '100%' }}>
            <Form.Item
              label={t('editor.expense.date')}
              name="voucherDate"
              style={{ marginBottom: 0, minWidth: 180 }}
            >
              <DatePicker style={{ width: '100%' }} disabled={isReadOnly} />
            </Form.Item>
            <Form.Item
              label={t('editor.expense.vendor')}
              name="partyId"
              style={{ marginBottom: 0, minWidth: 220 }}
            >
              <Select
                showSearch
                placeholder={t('editor.expense.selectVendorOptional')}
                options={partyOptions}
                filterOption={(inp, opt) =>
                  String(opt?.label ?? '')
                    .toLowerCase()
                    .includes(inp.toLowerCase())
                }
                allowClear
                disabled={isReadOnly}
              />
            </Form.Item>
          </Space>
        </Card>

        {/* Payment Mode */}
        {!isReadOnly && (
          <Card size="small" style={{ marginBottom: 16 }} title={t('editor.expense.paymentMethod')}>
            <Segmented
              options={[
                { label: t('editor.expense.cash'), value: 'cash' },
                { label: t('editor.expense.bank'), value: 'bank' },
                { label: t('editor.expense.cheque'), value: 'cheque' },
                { label: t('editor.expense.upi'), value: 'upi' },
              ]}
              value={paymentMode}
              onChange={(v) => setPaymentMode(String(v) as ExpensePaymentMode)}
            />
            <div style={{ marginTop: 12 }}>
              {paymentMode === 'cash' && (
                <Form.Item label={t('editor.expense.cashRegister')} name="cashRegisterId">
                  <Select placeholder={t('editor.expense.selectCashRegister')} allowClear />
                </Form.Item>
              )}
              {paymentMode === 'bank' && (
                <Space wrap>
                  <Form.Item label={t('editor.expense.bankAccount')} name="bankAccountId">
                    <Select
                      placeholder={t('editor.expense.selectBankAccount')}
                      allowClear
                      style={{ minWidth: 220 }}
                    />
                  </Form.Item>
                  <Form.Item label={t('editor.expense.utrReference')} name="utrReference">
                    <Input
                      placeholder={t('editor.expense.utrNumberPlaceholder')}
                      style={{ minWidth: 180 }}
                    />
                  </Form.Item>
                </Space>
              )}
              {paymentMode === 'cheque' && (
                <Space wrap>
                  <Form.Item label={t('editor.expense.bankAccount')} name="bankAccountId">
                    <Select
                      placeholder={t('editor.expense.selectBankAccount')}
                      allowClear
                      style={{ minWidth: 220 }}
                    />
                  </Form.Item>
                  <Form.Item label={t('editor.expense.chequeNo')} name="utrReference">
                    <Input
                      placeholder={t('editor.expense.chequeNumberPlaceholder')}
                      style={{ minWidth: 160 }}
                    />
                  </Form.Item>
                </Space>
              )}
              {paymentMode === 'upi' && (
                <Form.Item label={t('editor.expense.upiReference')} name="utrReference">
                  <Input
                    placeholder={t('editor.expense.upiPlaceholder')}
                    style={{ minWidth: 220 }}
                  />
                </Form.Item>
              )}
            </div>
          </Card>
        )}

        {/* Line Items */}
        <Card size="small" style={{ marginBottom: 16 }} title={t('editor.expense.expenseLines')}>
          <ExpenseLineTable
            value={lineItems}
            onChange={setLineItems}
            accounts={accounts}
            readOnly={isReadOnly}
          />
        </Card>

        {/* TDS panel (shown only if tdsApplied exists on saved voucher) */}
        {savedVoucher?.tdsApplied && (
          <TdsPanel tdsApplied={savedVoucher.tdsApplied} taxableValuePaise={taxableValuePaise} />
        )}

        {/* Summary footer */}
        <Card size="small" style={{ marginBottom: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
            <div>
              <Text type="secondary">{t('editor.expense.taxableValue')}</Text>
              <div>
                <Text strong>{formatPaise(taxableValuePaise)}</Text>
              </div>
            </div>
            <div>
              <Text type="secondary">{t('editor.expense.totalGst')}</Text>
              <div>
                <Text strong>{formatPaise(totalGstPaise)}</Text>
              </div>
            </div>
            <div>
              <Text type="secondary">{t('editor.expense.tdsDeducted')}</Text>
              <div>
                <Text strong style={{ color: 'var(--cr-danger-700)' }}>
                  {formatPaise(tdsApplied?.tdsPaise ?? 0)}
                </Text>
              </div>
            </div>
            <div>
              <Text type="secondary">{t('editor.expense.netPayable')}</Text>
              <div>
                <Text strong style={{ fontSize: 16 }}>
                  {formatPaise(netPayablePaise)}
                </Text>
              </div>
            </div>
          </div>
        </Card>

        {/* Narration */}
        <Form.Item
          label={t('editor.expense.narration')}
          name="narration"
          rules={[{ required: true, message: t('editor.expense.narrationRequired') }]}
        >
          <Input.TextArea
            rows={2}
            placeholder={t('editor.expense.narrationPlaceholder')}
            disabled={isReadOnly}
          />
        </Form.Item>

        {/* Action bar */}
        {!isReadOnly && (
          <Space>
            <Button icon={<SaveOutlined />} onClick={saveDraft} loading={isPending}>
              {t('editor.expense.saveDraft')}{' '}
              <Text type="secondary" style={{ fontSize: 11 }}>
                {t('editor.expense.saveDraftHint')}
              </Text>
            </Button>
            <Button type="primary" icon={<SendOutlined />} onClick={handlePost} loading={isPending}>
              {t('editor.expense.post')}{' '}
              <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)' }}>
                {t('editor.expense.postHint')}
              </Text>
            </Button>
          </Space>
        )}

        {isReadOnly && initialData?.state && (
          <Alert
            type={initialData.state === 'cancelled' ? 'error' : 'info'}
            title={t('editor.expense.readOnlyNotice', { state: initialData.state.toUpperCase() })}
            style={{ marginTop: 16 }}
          />
        )}
      </Form>
    </div>
  );
}
