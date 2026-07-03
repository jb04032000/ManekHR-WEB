'use client';
import React, { useEffect, useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import {
  Form,
  Input,
  Select,
  DatePicker,
  InputNumber,
  Tabs,
  AutoComplete,
  message,
  Divider,
} from 'antd';
import dayjs from 'dayjs';
import DsButton from '@/components/ui/DsButton';
import {
  listAssetCategories,
  prefillFromPurchaseBill,
} from '@/lib/actions/finance-fixed-assets.actions';
import { listPurchaseBills } from '@/lib/actions/finance-purchases.actions';
import { useWorkspaceStore } from '@/lib/store';
import type { FixedAsset, AssetCategory, PurchaseBill } from '@/types';

interface FixedAssetFormProps {
  mode: 'create' | 'edit';
  firmId: string;
  initialValues?: Partial<FixedAsset>;
  onSubmit: (values: Partial<FixedAsset>) => Promise<void>;
  loading?: boolean;
}

export default function FixedAssetForm({
  mode,
  firmId,
  initialValues,
  onSubmit,
  loading,
}: FixedAssetFormProps) {
  const t = useTranslations('finance.fixedAssets.form');
  const wsId = useWorkspaceStore((s) => s.currentWorkspace?._id ?? '');
  const [form] = Form.useForm();

  const DEPRECIATION_METHOD_OPTIONS = [
    { value: 'slm', label: t('method.slm') },
    { value: 'wdv', label: t('method.wdv') },
  ];
  const FREQUENCY_OPTIONS = [
    { value: 'monthly', label: t('frequency.monthly') },
    { value: 'quarterly', label: t('frequency.quarterly') },
  ];
  const SHIFT_OPTIONS = [
    { value: 'single', label: t('shift.single') },
    { value: 'double', label: t('shift.double') },
    { value: 'triple', label: t('shift.triple') },
  ];
  const [categories, setCategories] = useState<AssetCategory[]>([]);
  const [billOptions, setBillOptions] = useState<
    { value: string; label: string; bill: PurchaseBill }[]
  >([]);
  const [billSearch, setBillSearch] = useState('');
  const [prefilling, setPrefilling] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Load categories on mount
  useEffect(() => {
    if (!wsId) return;
    listAssetCategories(wsId, firmId)
      .then((cats) => setCategories(Array.isArray(cats) ? cats : []))
      .catch(() => setCategories([]));
  }, [wsId, firmId]);

  // Populate initial values
  useEffect(() => {
    if (initialValues) {
      const patch: Record<string, unknown> = { ...initialValues };
      if (initialValues.purchaseDate) {
        patch.purchaseDate = dayjs(initialValues.purchaseDate);
      }
      if (initialValues.installationDate) {
        patch.installationDate = dayjs(initialValues.installationDate);
      }
      // Convert paise to rupees for display
      if (initialValues.costPaise) patch.costPaise = initialValues.costPaise / 100;
      if (initialValues.salvageValuePaise)
        patch.salvageValuePaise = initialValues.salvageValuePaise / 100;
      form.setFieldsValue(patch);
    } else {
      form.setFieldsValue({
        depreciationMethod: 'slm',
        depreciationFrequency: 'monthly',
        shiftType: 'single',
      });
    }
  }, [initialValues, form]);

  // Category select: auto-fill depreciation fields
  const handleCategoryChange = (catId: string) => {
    const cat = categories.find((c) => c._id === catId);
    if (!cat) return;
    form.setFieldsValue({
      depreciationMethod: cat.depreciationMethod,
      slmRateOverride: cat.slmRate,
      wdvRateOverride: cat.wdvRate,
      usefulLifeYears: cat.usefulLifeYears,
    });
    // Recompute salvage value if cost is set
    const costRupees = form.getFieldValue('costPaise') as number | undefined;
    if (costRupees) {
      form.setFieldValue(
        'salvageValuePaise',
        Math.round(costRupees * cat.residualValuePct * 100) / 100,
      );
    }
  };

  // Cost change: recompute salvage value
  const handleCostChange = (val: number | null) => {
    if (!val) return;
    const catId = form.getFieldValue('categoryId') as string | undefined;
    const cat = categories.find((c) => c._id === catId);
    if (cat) {
      form.setFieldValue('salvageValuePaise', Math.round(val * cat.residualValuePct * 100) / 100);
    }
  };

  // Purchase bill autocomplete: search bills
  const handleBillSearch = useCallback(
    async (text: string) => {
      if (!text || text.length < 2) return;
      try {
        const bills = await listPurchaseBills(wsId, firmId, { search: text, isCapitalGoods: true });
        const arr = Array.isArray(bills)
          ? bills
          : ((bills as { items?: PurchaseBill[] })?.items ?? []);
        setBillOptions(
          arr.map((b: PurchaseBill) => ({
            value: b._id,
            label: `${b.voucherNumber ?? b._id} - ${b.partySnapshot?.name ?? ''}`,
            bill: b,
          })),
        );
      } catch {
        setBillOptions([]);
      }
    },
    [wsId, firmId],
  );

  // PurchaseBill selected: prefill from bill
  const handleBillSelect = async (billId: string) => {
    setPrefilling(true);
    try {
      const prefilled = await prefillFromPurchaseBill(wsId, firmId, billId, 0);
      if (prefilled) {
        const patch: Record<string, unknown> = { ...prefilled };
        if (prefilled.purchaseDate) patch.purchaseDate = dayjs(prefilled.purchaseDate as string);
        if (prefilled.costPaise) patch.costPaise = (prefilled.costPaise as number) / 100;
        form.setFieldsValue(patch);
        message.success(t('prefillSuccess'));
      }
    } catch {
      message.warning(t('prefillFailed'));
    } finally {
      setPrefilling(false);
    }
  };

  const handleSubmit = async () => {
    let values: Record<string, unknown>;
    try {
      values = await form.validateFields();
    } catch {
      return;
    }

    // Convert display rupees back to paise
    const payload: Partial<FixedAsset> = {
      ...(values as Partial<FixedAsset>),
      costPaise: Math.round(((values.costPaise as number) ?? 0) * 100),
      salvageValuePaise: Math.round(((values.salvageValuePaise as number) ?? 0) * 100),
      purchaseDate: values.purchaseDate
        ? (values.purchaseDate as dayjs.Dayjs).format('YYYY-MM-DD')
        : undefined,
      installationDate: values.installationDate
        ? (values.installationDate as dayjs.Dayjs).format('YYYY-MM-DD')
        : undefined,
    };

    setSubmitting(true);
    try {
      await onSubmit(payload);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Form form={form} layout="vertical" style={{ maxWidth: 720 }}>
      <Tabs
        defaultActiveKey="basic"
        items={[
          {
            key: 'basic',
            label: t('tabs.basic'),
            children: (
              <>
                <Form.Item
                  label={t('fields.name')}
                  name="name"
                  rules={[{ required: true, message: t('validation.nameRequired') }]}
                >
                  <Input placeholder={t('placeholders.name')} />
                </Form.Item>
                <Form.Item
                  label={t('fields.category')}
                  name="categoryId"
                  rules={[{ required: true, message: t('validation.categoryRequired') }]}
                >
                  <Select
                    placeholder={t('placeholders.category')}
                    options={categories.map((c) => ({ value: c._id, label: c.name }))}
                    onChange={handleCategoryChange}
                    showSearch
                    filterOption={(input, opt) =>
                      String(opt?.label ?? '')
                        .toLowerCase()
                        .includes(input.toLowerCase())
                    }
                  />
                </Form.Item>
                <Form.Item
                  label={t('fields.purchaseDate')}
                  name="purchaseDate"
                  rules={[{ required: true, message: t('validation.purchaseDateRequired') }]}
                >
                  <DatePicker style={{ width: '100%' }} />
                </Form.Item>
                <Form.Item
                  label={t('fields.financialYear')}
                  name="financialYear"
                  rules={[{ required: true }]}
                >
                  <Input placeholder={t('placeholders.financialYear')} />
                </Form.Item>
                <Form.Item label={t('fields.serialNumber')} name="serialNumber">
                  <Input placeholder={t('placeholders.serialNumber')} />
                </Form.Item>
                <Form.Item label={t('fields.description')} name="description">
                  <Input.TextArea rows={2} placeholder={t('placeholders.description')} />
                </Form.Item>
                <Form.Item label={t('fields.installationDate')} name="installationDate">
                  <DatePicker style={{ width: '100%' }} />
                </Form.Item>
              </>
            ),
          },
          {
            key: 'valuation',
            label: t('tabs.valuation'),
            children: (
              <>
                <Form.Item
                  label={t('fields.cost')}
                  name="costPaise"
                  rules={[
                    { required: true, message: t('validation.costRequired') },
                    { type: 'number', min: 0.01, message: t('validation.costPositive') },
                  ]}
                >
                  <InputNumber
                    style={{ width: '100%' }}
                    min={0}
                    precision={2}
                    prefix="₹"
                    onChange={handleCostChange}
                  />
                </Form.Item>
                <Form.Item
                  label={t('fields.salvageValue')}
                  name="salvageValuePaise"
                  rules={[
                    ({ getFieldValue }) => ({
                      validator(_, value) {
                        const cost = getFieldValue('costPaise') as number;
                        if (value != null && cost != null && value >= cost) {
                          return Promise.reject(t('validation.salvageLessThanCost'));
                        }
                        return Promise.resolve();
                      },
                    }),
                  ]}
                >
                  <InputNumber style={{ width: '100%' }} min={0} precision={2} prefix="₹" />
                </Form.Item>
              </>
            ),
          },
          {
            key: 'depreciation',
            label: t('tabs.depreciation'),
            children: (
              <>
                <Form.Item
                  label={t('fields.method')}
                  name="depreciationMethod"
                  rules={[{ required: true }]}
                >
                  <Select options={DEPRECIATION_METHOD_OPTIONS} />
                </Form.Item>
                <Form.Item
                  label={t('fields.frequency')}
                  name="depreciationFrequency"
                  rules={[{ required: true }]}
                >
                  <Select options={FREQUENCY_OPTIONS} />
                </Form.Item>
                <Form.Item
                  label={t('fields.shiftType')}
                  name="shiftType"
                  rules={[{ required: true }]}
                >
                  <Select options={SHIFT_OPTIONS} />
                </Form.Item>
                <Form.Item
                  label={t('fields.usefulLife')}
                  name="usefulLifeYears"
                  rules={[
                    { required: true },
                    { type: 'number', min: 1, max: 100, message: t('validation.usefulLifeRange') },
                  ]}
                >
                  <InputNumber style={{ width: '100%' }} min={1} max={100} />
                </Form.Item>
                <Form.Item
                  label={t('fields.slmOverride')}
                  name="slmRateOverride"
                  rules={[{ type: 'number', min: 0, max: 1, message: t('validation.rateRange') }]}
                >
                  <InputNumber
                    style={{ width: '100%' }}
                    min={0}
                    max={1}
                    step={0.01}
                    precision={4}
                  />
                </Form.Item>
                <Form.Item
                  label={t('fields.wdvOverride')}
                  name="wdvRateOverride"
                  rules={[{ type: 'number', min: 0, max: 1, message: t('validation.rateRange') }]}
                >
                  <InputNumber
                    style={{ width: '100%' }}
                    min={0}
                    max={1}
                    step={0.01}
                    precision={4}
                  />
                </Form.Item>
              </>
            ),
          },
          {
            key: 'linkage',
            label: t('tabs.linkage'),
            children: (
              <>
                <Divider>{t('dividers.purchaseBill')}</Divider>
                <Form.Item label={t('fields.purchaseBill')} name="purchaseBillId">
                  <AutoComplete
                    placeholder={t('placeholders.purchaseBill')}
                    value={billSearch}
                    options={billOptions.map((o) => ({ value: o.value, label: o.label }))}
                    onSearch={(text) => {
                      setBillSearch(text);
                      handleBillSearch(text);
                    }}
                    onSelect={(val) => {
                      setBillSearch('');
                      handleBillSelect(val);
                    }}
                    allowClear
                  />
                </Form.Item>
                {prefilling && (
                  <div style={{ color: 'var(--cr-primary)', fontSize: 12 }}>{t('prefilling')}</div>
                )}
                <Divider>{t('dividers.machineItc')}</Divider>
                <Form.Item label={t('fields.machineId')} name="machineId">
                  <Input placeholder={t('placeholders.machineId')} />
                </Form.Item>
                <Form.Item label={t('fields.itcScheduleId')} name="itcScheduleId">
                  <Input placeholder={t('placeholders.itcScheduleId')} />
                </Form.Item>
              </>
            ),
          },
          {
            key: 'location',
            label: t('tabs.location'),
            children: (
              <>
                <Form.Item label={t('fields.locationId')} name="locationId">
                  <Input placeholder={t('placeholders.locationId')} />
                </Form.Item>
                <Form.Item label={t('fields.custodianMemberId')} name="custodianMemberId">
                  <Input placeholder={t('placeholders.custodianMemberId')} />
                </Form.Item>
                <Form.Item label={t('fields.notes')} name="notes">
                  <Input.TextArea rows={3} placeholder={t('placeholders.notes')} />
                </Form.Item>
              </>
            ),
          },
        ]}
      />

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
        <DsButton dsVariant="primary" loading={loading || submitting} onClick={handleSubmit}>
          {mode === 'create' ? t('submitCreate') : t('submitSave')}
        </DsButton>
      </div>
    </Form>
  );
}
