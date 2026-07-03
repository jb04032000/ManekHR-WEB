'use client';

import { useEffect, useMemo, useState, startTransition } from 'react';
import { Alert, Button, Form, Input, InputNumber, Modal, Radio, Spin, message } from 'antd';
import type {
  TeamMember,
  TaxDeclaration,
  TdsPreviewResponse,
  UpsertTaxDeclarationPayload,
} from '@/types';
import { useWorkspaceStore } from '@/lib/store';
import { salaryApi } from '@/lib/api';
import { parseApiError } from '@/lib/utils';
import { useCurrencyFormatter } from '@/features/salary/hooks/useCurrencyFormatter';

const { TextArea } = Input;

interface Props {
  open: boolean;
  onClose: () => void;
  workspaceId: string;
  member: TeamMember;
  month: number;
  year: number;
}

type TaxDeclarationFormValues = UpsertTaxDeclarationPayload;

const buildDefaultValues = (member: TeamMember): TaxDeclarationFormValues => ({
  financialYear: 0,
  taxRegime: member.taxRegime === 'old' ? 'old' : 'new',
  hraExemption: 0,
  deduction80C: 0,
  deduction80D: 0,
  deduction80G: 0,
  deduction80CCD1B: 0,
  deduction80TTA: 0,
  otherDeductions: 0,
  previousEmployerGross: 0,
  previousEmployerTds: 0,
  notes: '',
});

const buildDeclarationValues = (
  member: TeamMember,
  financialYear: number,
  declaration: TaxDeclaration | null,
): TaxDeclarationFormValues => {
  const defaults = buildDefaultValues(member);

  if (!declaration) {
    return {
      ...defaults,
      financialYear,
    };
  }

  return {
    financialYear,
    taxRegime: declaration.taxRegime || defaults.taxRegime,
    hraExemption: declaration.hraExemption ?? 0,
    deduction80C: declaration.deduction80C ?? 0,
    deduction80D: declaration.deduction80D ?? 0,
    deduction80G: declaration.deduction80G ?? 0,
    deduction80CCD1B: declaration.deduction80CCD1B ?? 0,
    deduction80TTA: declaration.deduction80TTA ?? 0,
    otherDeductions: declaration.otherDeductions ?? 0,
    previousEmployerGross: declaration.previousEmployerGross ?? 0,
    previousEmployerTds: declaration.previousEmployerTds ?? 0,
    notes: declaration.notes ?? '',
  };
};

const getFinancialYear = (month: number, year: number, fyStartMonth = 4): number =>
  month >= fyStartMonth ? year : year - 1;

const getFyLabel = (financialYear: number): string =>
  `${financialYear}-${String(financialYear + 1).slice(2)}`;

const numberInputProps = {
  className: 'w-full',
  min: 0,
  controls: false,
} as const;

export function TaxDeclarationModal({ open, onClose, workspaceId, member, month, year }: Props) {
  const [form] = Form.useForm<TaxDeclarationFormValues>();
  const [msgApi, contextHolder] = message.useMessage();
  const currentWorkspaceId = useWorkspaceStore((state) => state.currentWorkspaceId);
  const currentWorkspace = useWorkspaceStore((state) => state.currentWorkspace);
  const currencyFmt = useCurrencyFormatter();
  const [loadingDeclaration, setLoadingDeclaration] = useState(false);
  const [saving, setSaving] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [preview, setPreview] = useState<TdsPreviewResponse | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  const fiscalYearStartMonth =
    currentWorkspaceId === workspaceId ? currentWorkspace?.fiscalYearStartMonth || 4 : 4;
  const financialYear = useMemo(
    () => getFinancialYear(month, year, fiscalYearStartMonth),
    [fiscalYearStartMonth, month, year],
  );
  const financialYearLabel = useMemo(() => getFyLabel(financialYear), [financialYear]);
  const memberId = member.id;
  const selectedRegime =
    Form.useWatch('taxRegime', form) || (member.taxRegime === 'old' ? 'old' : 'new');

  const applyDeclarationToForm = (declaration: TaxDeclaration | null) => {
    form.setFieldsValue(buildDeclarationValues(member, financialYear, declaration));
    startTransition(() => {
      setIsDirty(false);
    });
  };

  const loadDeclaration = async () => {
    startTransition(() => {
      setLoadingDeclaration(true);
    });
    try {
      const declaration = await salaryApi.getTaxDeclaration(workspaceId, memberId, financialYear);
      applyDeclarationToForm(declaration);
    } catch (error) {
      msgApi.error(parseApiError(error) || 'Failed to load tax declaration');
      applyDeclarationToForm(null);
    } finally {
      setLoadingDeclaration(false);
    }
  };

  const loadPreview = async () => {
    setPreviewLoading(true);
    try {
      const result = await salaryApi.getTdsPreview(workspaceId, memberId, month, year);
      setPreview(result);
    } catch (error) {
      msgApi.error(parseApiError(error) || 'Failed to load TDS preview');
    } finally {
      setPreviewLoading(false);
    }
  };

  useEffect(() => {
    if (!open) {
      form.resetFields();
      startTransition(() => {
        setPreview(null);
        setIsDirty(false);
      });
      return;
    }

    startTransition(() => {
      setPreview(null);
    });
    applyDeclarationToForm(null);
    void loadDeclaration();
  }, [financialYear, form, member, memberId, open, workspaceId]);

  const handlePreview = async () => {
    if (isDirty) {
      msgApi.info(
        'Preview uses the latest saved declaration. Save current edits to refresh the estimate.',
      );
    }

    await loadPreview();
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);

      await salaryApi.upsertTaxDeclaration(workspaceId, memberId, {
        ...values,
        financialYear,
      });

      msgApi.success('Tax declaration saved');
      setIsDirty(false);
      await loadPreview();
    } catch (error) {
      if (error && typeof error === 'object' && 'errorFields' in error) {
        return;
      }

      msgApi.error(parseApiError(error) || 'Failed to save tax declaration');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      {contextHolder}
      <Modal
        open={open}
        onCancel={onClose}
        width={760}
        destroyOnHidden
        title={`Tax Declaration - ${member.name}`}
        footer={[
          <Button key="cancel" onClick={onClose}>
            Cancel
          </Button>,
          <Button key="preview" onClick={() => void handlePreview()} loading={previewLoading}>
            Preview TDS
          </Button>,
          <Button key="save" type="primary" onClick={() => void handleSave()} loading={saving}>
            Save Declaration
          </Button>,
        ]}
      >
        <div className="space-y-5">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="m-0 text-[11px] font-semibold tracking-[0.18em] text-slate-600 uppercase">
              Financial Year
            </p>
            <p className="m-0 mt-1 text-[18px] font-bold text-heading">FY {financialYearLabel}</p>
            <p className="m-0 mt-1 text-sm text-subtle">
              Monthly preview uses the selected payroll month ({month}/{year}) and the workspace
              fiscal year start month.
            </p>
          </div>

          {!member.pan?.trim() && (
            <Alert
              type="warning"
              showIcon
              title="PAN not available"
              description="TDS will still be computed. The backend applies a 20% flat rate under Section 206AA when PAN is missing."
            />
          )}

          {preview && (
            <Alert
              type="info"
              showIcon
              title={`Estimated monthly TDS: ${currencyFmt.full(preview.estimatedMonthlyTds)}`}
              description={`FY ${getFyLabel(preview.financialYear)} • ${preview.regime === 'new' ? 'New Regime' : 'Old Regime'}${preview.hasPan ? '' : ' • PAN not available'}`}
            />
          )}

          {loadingDeclaration ? (
            <div className="flex min-h-[260px] items-center justify-center">
              <Spin />
            </div>
          ) : (
            <Form<TaxDeclarationFormValues>
              form={form}
              layout="vertical"
              requiredMark={false}
              onValuesChange={() => setIsDirty(true)}
            >
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <p className="m-0 text-base font-semibold text-heading">Tax Regime</p>
                <p className="m-0 mt-1 text-sm text-subtle">
                  New Regime: {currencyFmt.symbol}75,000 standard deduction, lower slabs, no
                  80C/80D. Old Regime: {currencyFmt.symbol}
                  50,000 standard deduction, allows 80C/80D/HRA exemptions.
                </p>
                <Form.Item
                  className="mt-4 mb-0"
                  name="taxRegime"
                  rules={[{ required: true, message: 'Select a tax regime' }]}
                >
                  <Radio.Group optionType="button" buttonStyle="solid">
                    <Radio.Button value="new">New Regime</Radio.Button>
                    <Radio.Button value="old">Old Regime</Radio.Button>
                  </Radio.Group>
                </Form.Item>
              </div>

              {selectedRegime === 'old' && (
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="m-0 text-base font-semibold text-heading">HRA Exemption</p>
                  <p className="m-0 mt-1 text-sm text-subtle">
                    Enter the computed exempt HRA amount (min of: HRA received, 50%/40% of basic,
                    rent paid - 10% of basic).
                  </p>
                  <Form.Item
                    className="mt-4 mb-0"
                    name="hraExemption"
                    label="HRA Exemption Amount (₹)"
                  >
                    <InputNumber {...numberInputProps} prefix={currencyFmt.symbol} />
                  </Form.Item>
                </div>
              )}

              {selectedRegime === 'old' && (
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="m-0 text-base font-semibold text-heading">
                    Chapter VI-A Deductions
                  </p>
                  <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                    <Form.Item name="deduction80C" label="80C - PF, ELSS, LIC, etc.">
                      <InputNumber {...numberInputProps} prefix={currencyFmt.symbol} max={150000} />
                    </Form.Item>
                    <Form.Item name="deduction80D" label="80D - Health Insurance Premiums">
                      <InputNumber {...numberInputProps} prefix={currencyFmt.symbol} />
                    </Form.Item>
                    <Form.Item name="deduction80CCD1B" label="80CCD(1B) - NPS Additional">
                      <InputNumber {...numberInputProps} prefix={currencyFmt.symbol} max={50000} />
                    </Form.Item>
                    <Form.Item name="deduction80G" label="80G - Donations">
                      <InputNumber {...numberInputProps} prefix={currencyFmt.symbol} />
                    </Form.Item>
                    <Form.Item name="deduction80TTA" label="80TTA - Savings Interest">
                      <InputNumber {...numberInputProps} prefix={currencyFmt.symbol} max={10000} />
                    </Form.Item>
                    <Form.Item name="otherDeductions" label="Other Deductions">
                      <InputNumber {...numberInputProps} prefix={currencyFmt.symbol} />
                    </Form.Item>
                  </div>
                </div>
              )}

              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <p className="m-0 text-base font-semibold text-heading">
                  Previous Employer (Form 12B)
                </p>
                <p className="m-0 mt-1 text-sm text-subtle">
                  Fill this if employee joined mid financial year from another employer.
                </p>
                <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                  <Form.Item
                    name="previousEmployerGross"
                    label="Previous Employer Gross Salary (₹)"
                  >
                    <InputNumber {...numberInputProps} prefix={currencyFmt.symbol} />
                  </Form.Item>
                  <Form.Item
                    name="previousEmployerTds"
                    label="TDS Deducted by Previous Employer (₹)"
                  >
                    <InputNumber {...numberInputProps} prefix={currencyFmt.symbol} />
                  </Form.Item>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <p className="m-0 text-base font-semibold text-heading">Notes</p>
                <Form.Item className="mt-4 mb-0" name="notes" label="Notes">
                  <TextArea
                    rows={4}
                    placeholder="Add admin notes for this financial year declaration"
                  />
                </Form.Item>
              </div>
            </Form>
          )}
        </div>
      </Modal>
    </>
  );
}
