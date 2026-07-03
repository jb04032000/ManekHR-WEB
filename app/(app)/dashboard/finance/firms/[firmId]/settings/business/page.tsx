'use client';

// Canonical Business Profile editor (design 2026-06-02 D4). Single source of
// truth for the firm's legal/tax identity, principal address, contact, and
// accounting preferences. Reuses the same field groups as the onboarding wizard
// (BusinessProfileFields). Workspace settings links here instead of hosting a
// duplicate editor. Chrome mirrors the finance branding settings page.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  App,
  Button,
  DatePicker,
  Form,
  InputNumber,
  Radio,
  Result,
  Skeleton,
  Space,
  Switch,
  Divider,
} from 'antd';
import { IdcardOutlined, SaveOutlined, LockOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useTranslations } from 'next-intl';
import { useWorkspaceStore } from '@/lib/store';
import { Can } from '@/components/rbac/Can';
import { DsPageHeader } from '@/components/ui';
import { getFirm, updateFirm, gstinLookup, setFirmBooksLock } from '@/lib/actions/finance.actions';
import { gstStateName } from '@/lib/billing/gst-states';
import {
  IdentityFields,
  AddressFields,
  ContactFields,
} from '@/components/finance/business-profile/BusinessProfileFields';
import { parseApiError } from '@/lib/utils';
import type { Firm } from '@/types';

function SectionHeading({
  label,
  heading,
  hint,
}: {
  label: string;
  heading: string;
  hint: string;
}) {
  return (
    <div className="mb-4 space-y-1">
      <div className="text-xs font-semibold tracking-[0.18em] text-subtle uppercase">{label}</div>
      <h2 className="m-0 text-lg font-bold text-heading">{heading}</h2>
      <p className="m-0 text-sm text-subtle">{hint}</p>
    </div>
  );
}

function BusinessProfileEditor() {
  const t = useTranslations('finance.financeSettings.business');
  const { message } = App.useApp();
  const params = useParams<{ firmId: string }>();
  const firmId = params?.firmId ?? '';
  const wsId = useWorkspaceStore((s) => s.currentWorkspace?._id ?? '');

  const [form] = Form.useForm();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [gstinLoading, setGstinLoading] = useState(false);
  const [firm, setFirm] = useState<Firm | null>(null);
  // D21 period-lock control. Separate from the main profile form because it uses the dedicated
  // /books-lock endpoint (the generic firm PATCH whitelist would strip booksLockedUptoDate).
  const [lockDate, setLockDate] = useState<dayjs.Dayjs | null>(null);
  const [lockSaving, setLockSaving] = useState(false);

  useEffect(() => {
    setLockDate(firm?.booksLockedUptoDate ? dayjs(firm.booksLockedUptoDate) : null);
  }, [firm]);

  useEffect(() => {
    if (!wsId || !firmId) return;
    let active = true;
    setLoading(true);
    setLoadError(false);
    getFirm(wsId, firmId)
      .then((f: Firm) => {
        if (active) setFirm(f);
      })
      .catch(() => {
        if (active) setLoadError(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [wsId, firmId]);

  const initialValues = useMemo(
    () => ({
      firmName: firm?.firmName,
      businessType: firm?.businessType,
      gstin: firm?.gstin,
      pan: firm?.pan,
      address: {
        line1: firm?.address?.line1,
        line2: firm?.address?.line2,
        city: firm?.address?.city,
        stateCode: firm?.address?.stateCode ?? firm?.gstin?.slice(0, 2),
        pincode: firm?.address?.pincode,
      },
      contactPhone: firm?.contactPhone,
      contactEmail: firm?.contactEmail,
      website: firm?.website,
      fyStartMonth: firm?.fyStartMonth ?? 4,
      accountsBooksBeginDate: firm?.accountsBooksBeginDate
        ? dayjs(firm.accountsBooksBeginDate)
        : undefined,
      aato: firm?.aato || undefined,
      roundingPolicy: firm?.roundingPolicy ?? 'half_up',
      inventoryValuationMethod: firm?.inventoryValuationMethod ?? 'moving_average',
      lateFeePct: firm?.lateFeePct ?? 18,
      qtyDecimalPlaces: firm?.qtyDecimalPlaces ?? 2,
      primaryRole: firm?.primaryRole ?? 'owner',
      defaultPrintLocale: firm?.defaultPrintLocale ?? 'en',
      qrmpScheme: firm?.qrmpScheme ?? false,
      allowNegativeStock: firm?.allowNegativeStock ?? false,
      // Maker-checker (approval) toggle for sale invoices. Flat form field; merged back into
      // the firm.makerCheckerEnabled object on save so the other voucher flags are preserved.
      makerCheckerSaleInvoice: firm?.makerCheckerEnabled?.sale_invoice ?? false,
    }),
    [firm],
  );

  const handleGstinFetch = useCallback(async () => {
    const gstin = form.getFieldValue('gstin') as string | undefined;
    if (!gstin) {
      message.warning(t('enterGstinFirst'));
      return;
    }
    setGstinLoading(true);
    try {
      const info = await gstinLookup(wsId, gstin, firmId);
      form.setFieldsValue({
        firmName: info.legalName,
        address: {
          ...form.getFieldValue('address'),
          stateCode: info.stateCode ?? gstin.slice(0, 2),
        },
      });
      setDirty(true);
      message.success(t('gstinFetched', { name: info.legalName }));
    } catch (e: unknown) {
      const err = e as { message?: string };
      message.error(err?.message ?? t('gstinFailed'));
    } finally {
      setGstinLoading(false);
    }
  }, [form, wsId, firmId, message, t]);

  const handleSave = useCallback(
    async (values: Record<string, unknown>) => {
      if (!wsId || !firmId) return;
      setSaving(true);
      try {
        const addr = (values.address ?? {}) as Record<string, string | undefined>;
        const booksBegin = values.accountsBooksBeginDate as dayjs.Dayjs | undefined;
        // Merge the flat maker-checker toggle back into the firm.makerCheckerEnabled object so
        // a $set does not clobber the other voucher-type flags.
        const { makerCheckerSaleInvoice, ...rest } = values as Record<string, unknown>;
        const payload = {
          ...rest,
          address: { ...addr, state: gstStateName(addr.stateCode) },
          accountsBooksBeginDate: booksBegin ? booksBegin.toISOString() : undefined,
          makerCheckerEnabled: {
            ...(firm?.makerCheckerEnabled ?? {}),
            sale_invoice: Boolean(makerCheckerSaleInvoice),
          },
        } as Partial<Firm>;
        const updated = await updateFirm(wsId, firmId, payload);
        setFirm(updated);
        setDirty(false);
        message.success(t('saved'));
      } catch (error) {
        message.error(parseApiError(error) || t('saveFailed'));
      } finally {
        setSaving(false);
      }
    },
    [wsId, firmId, message, t],
  );

  const applyLock = useCallback(async () => {
    if (!wsId || !firmId || !lockDate) return;
    setLockSaving(true);
    try {
      const updated = await setFirmBooksLock(wsId, firmId, lockDate.toISOString());
      setFirm(updated);
      message.success(t('booksLockSaved'));
    } catch (error) {
      message.error(parseApiError(error) || t('saveFailed'));
    } finally {
      setLockSaving(false);
    }
  }, [wsId, firmId, lockDate, message, t]);

  const clearLock = useCallback(async () => {
    if (!wsId || !firmId) return;
    setLockSaving(true);
    try {
      const updated = await setFirmBooksLock(wsId, firmId, null);
      setFirm(updated);
      setLockDate(null);
      message.success(t('booksLockCleared'));
    } catch (error) {
      message.error(parseApiError(error) || t('saveFailed'));
    } finally {
      setLockSaving(false);
    }
  }, [wsId, firmId, message, t]);

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-6 md:px-6">
        <Skeleton active paragraph={{ rows: 2 }} />
        <div className="mt-8 space-y-8">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} active paragraph={{ rows: 4 }} />
          ))}
        </div>
      </div>
    );
  }

  if (loadError || !firm) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-10 md:px-6">
        <Result
          status="warning"
          title={t('loadErrorTitle')}
          subTitle={t('loadErrorSubtitle')}
          extra={
            <Button type="primary" onClick={() => window.location.reload()}>
              {t('retry')}
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 md:px-6">
      <DsPageHeader
        icon={<IdcardOutlined />}
        title={t('pageTitle')}
        sub={t('pageDescription', { firm: firm.firmName })}
      />

      <Form
        form={form}
        layout="vertical"
        onFinish={handleSave}
        requiredMark="optional"
        initialValues={initialValues}
        onValuesChange={() => setDirty(true)}
      >
        <section className="mb-8">
          <SectionHeading
            label={t('identitySectionLabel')}
            heading={t('identityHeading')}
            hint={t('identityHint')}
          />
          <IdentityFields onFetchGstin={handleGstinFetch} gstinLoading={gstinLoading} />
        </section>

        <section className="mb-8">
          <SectionHeading
            label={t('addressSectionLabel')}
            heading={t('addressHeading')}
            hint={t('addressHint')}
          />
          <AddressFields />
        </section>

        <section className="mb-8">
          <SectionHeading
            label={t('contactSectionLabel')}
            heading={t('contactHeading')}
            hint={t('contactHint')}
          />
          <ContactFields />
        </section>

        <section className="mb-8">
          <SectionHeading
            label={t('accountingSectionLabel')}
            heading={t('accountingHeading')}
            hint={t('accountingHint')}
          />
          <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
            <Form.Item
              label={t('fyStartMonth')}
              name="fyStartMonth"
              tooltip={t('fyStartMonthTooltip')}
            >
              <InputNumber min={1} max={12} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item
              label={t('booksBeginDate')}
              name="accountsBooksBeginDate"
              tooltip={t('booksBeginTooltip')}
            >
              <DatePicker style={{ width: '100%' }} placeholder={t('booksBeginPlaceholder')} />
            </Form.Item>
            <Form.Item label={t('aato')} name="aato" tooltip={t('aatoTooltip')}>
              <InputNumber min={0} style={{ width: '100%' }} placeholder={t('aatoPlaceholder')} />
            </Form.Item>
            <Form.Item label={t('lateFeePct')} name="lateFeePct">
              <InputNumber min={0} max={100} step={0.5} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item label={t('qtyDecimalPlaces')} name="qtyDecimalPlaces">
              <InputNumber min={0} max={6} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item label={t('defaultPrintLocale')} name="defaultPrintLocale">
              <Radio.Group>
                <Radio value="en">{t('localeEnglish')}</Radio>
                <Radio value="gu">{t('localeGujarati')}</Radio>
                <Radio value="hi">{t('localeHindi')}</Radio>
              </Radio.Group>
            </Form.Item>
          </div>
          <Form.Item
            label={t('roundingPolicy')}
            name="roundingPolicy"
            tooltip={t('roundingPolicyTooltip')}
          >
            <Radio.Group>
              <Radio value="half_up">{t('roundingStandard')}</Radio>
              <Radio value="round_off_to_rupee">{t('roundingRupee')}</Radio>
            </Radio.Group>
          </Form.Item>
          <Form.Item
            label={t('inventoryValuation')}
            name="inventoryValuationMethod"
            tooltip={t('inventoryValuationTooltip')}
          >
            <Radio.Group>
              <Radio value="moving_average">{t('movingAverage')}</Radio>
              <Radio value="fifo">{t('fifo')}</Radio>
            </Radio.Group>
          </Form.Item>
          <Form.Item label={t('primaryRole')} name="primaryRole">
            <Radio.Group>
              <Radio value="owner">{t('roleOwner')}</Radio>
              <Radio value="manager">{t('roleManager')}</Radio>
              <Radio value="accountant">{t('roleAccountant')}</Radio>
            </Radio.Group>
          </Form.Item>
          <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
            <Form.Item
              label={t('qrmpScheme')}
              name="qrmpScheme"
              valuePropName="checked"
              tooltip={t('qrmpTooltip')}
            >
              <Switch />
            </Form.Item>
            <Form.Item
              label={t('allowNegativeStock')}
              name="allowNegativeStock"
              valuePropName="checked"
              tooltip={t('allowNegativeStockTooltip')}
            >
              <Switch />
            </Form.Item>
          </div>
        </section>

        <section className="mb-8">
          <SectionHeading
            label={t('controlsSectionLabel')}
            heading={t('controlsHeading')}
            hint={t('controlsHint')}
          />
          <Form.Item
            label={t('requireApproval')}
            name="makerCheckerSaleInvoice"
            valuePropName="checked"
            tooltip={t('requireApprovalTooltip')}
          >
            <Switch />
          </Form.Item>

          {/* D21 period lock: blocks postings/edits dated on or before the chosen date (e.g.
              after a month's GSTR is filed). Uses the dedicated /books-lock endpoint, saved
              independently of the profile form above. */}
          <div className="mt-6">
            <div className="mb-1 text-sm font-medium text-heading">{t('booksLock')}</div>
            <p className="mb-2 text-[12px] text-subtle">{t('booksLockHint')}</p>
            <Space wrap>
              <DatePicker
                value={lockDate}
                onChange={setLockDate}
                placeholder={t('booksLockPlaceholder')}
              />
              <Button onClick={applyLock} loading={lockSaving} disabled={!lockDate}>
                {t('booksLockApply')}
              </Button>
              {firm.booksLockedUptoDate ? (
                <Button danger onClick={clearLock} loading={lockSaving}>
                  {t('booksLockClear')}
                </Button>
              ) : null}
            </Space>
            {firm.booksLockedUptoDate ? (
              <div className="mt-2 text-[12px] text-subtle">
                {t('booksLockCurrent', {
                  date: dayjs(firm.booksLockedUptoDate).format('DD MMM YYYY'),
                })}
              </div>
            ) : null}
          </div>
        </section>

        <Divider />
        <div className="flex items-center gap-3">
          <Button
            type="primary"
            icon={<SaveOutlined />}
            htmlType="submit"
            loading={saving}
            disabled={!dirty}
          >
            {t('save')}
          </Button>
          {dirty ? (
            <span className="text-[12px] text-amber-700">{t('unsaved')}</span>
          ) : (
            <span className="text-[12px] text-subtle">{t('allSaved')}</span>
          )}
        </div>
      </Form>
    </div>
  );
}

function ManagersOnly() {
  const t = useTranslations('finance.financeSettings.business');
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 md:px-6">
      <Result
        icon={<LockOutlined style={{ color: 'var(--cr-text-4)' }} />}
        title={t('noAccessTitle')}
        subTitle={t('noAccessSubtitle')}
      />
    </div>
  );
}

export default function FirmBusinessProfilePage() {
  return (
    <Can
      path="finance.settings.manage"
      scope="all"
      fallback={<ManagersOnly />}
      showFallbackOnLoading
    >
      <BusinessProfileEditor />
    </Can>
  );
}
