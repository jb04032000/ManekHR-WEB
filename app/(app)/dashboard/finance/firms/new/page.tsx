'use client';

import { startTransition, useEffect, useMemo, useState } from 'react';
import {
  Steps,
  Form,
  DatePicker,
  Button,
  Space,
  message,
  InputNumber,
  Radio,
  Divider,
  Skeleton,
} from 'antd';
import dayjs from 'dayjs';
import { useRouter } from 'next/navigation';
import { useWorkspaceStore } from '@/lib/store';
import { getCurrentFirm, updateFirmWizardStep, gstinLookup } from '@/lib/actions/finance.actions';
import { gstStateName } from '@/lib/billing/gst-states';
import {
  IdentityFields,
  AddressFields,
  ContactFields,
} from '@/components/finance/business-profile/BusinessProfileFields';
import type { Firm } from '@/types';

// Business-Setup Wizard. The Firm is auto-created 1:1 with the workspace, so this
// flow only completes/edits the existing firm's profile. It is the guided
// first-run path; ongoing edits live on the finance Business Profile settings
// page, which reuses the same field groups (BusinessProfileFields). Each step
// saves through the per-step-whitelisted wizard endpoint, so only known fields
// are persisted (address/contact now persist; arbitrary fields are ignored).
//
// All three step forms stay mounted (display-toggled) so values survive Back/Next
// and every useForm instance is connected to a live Form. Initial values come
// from the loaded firm via `initialValues` (not setFieldsValue) so we never poke
// an unmounted form.

export default function BusinessSetupWizardPage() {
  const router = useRouter();
  const { currentWorkspace } = useWorkspaceStore();
  const wsId = currentWorkspace?._id ?? '';

  const [loading, setLoading] = useState(true);
  const [firm, setFirm] = useState<Firm | null>(null);
  const [current, setCurrent] = useState(0);
  const [step1Form] = Form.useForm();
  const [step2Form] = Form.useForm();
  const [step3Form] = Form.useForm();
  const [gstinLoading, setGstinLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Resolve the workspace's single firm and resume at the first incomplete step.
  useEffect(() => {
    if (!wsId) return;
    startTransition(() => {
      setLoading(true);
    });
    getCurrentFirm(wsId)
      .then((f) => {
        if (!f) {
          message.error('Business profile missing - contact support');
          router.replace('/dashboard/finance');
          return;
        }
        setFirm(f);
        const s = f.setupChecklistState;
        if (s?.step1Done && !s?.step2Done) setCurrent(1);
        else if (s?.step1Done && s?.step2Done && !s?.step3Done) setCurrent(2);
      })
      .finally(() => setLoading(false));
  }, [wsId, router]);

  const firmId = firm?._id ?? null;

  const step1Initial = useMemo(
    () => ({
      firmName: firm?.firmName,
      businessType: firm?.businessType,
      gstin: firm?.gstin,
      pan: firm?.pan,
      accountsBooksBeginDate: firm?.accountsBooksBeginDate
        ? dayjs(firm.accountsBooksBeginDate)
        : undefined,
    }),
    [firm],
  );

  const step2Initial = useMemo(
    () => ({
      address: {
        line1: firm?.address?.line1,
        line2: firm?.address?.line2,
        city: firm?.address?.city,
        // Default the state from the GSTIN's leading two digits when unset.
        stateCode: firm?.address?.stateCode ?? firm?.gstin?.slice(0, 2),
        pincode: firm?.address?.pincode,
      },
      contactPhone: firm?.contactPhone,
      contactEmail: firm?.contactEmail,
      website: firm?.website,
      aato: firm?.aato || undefined,
      inventoryValuationMethod: firm?.inventoryValuationMethod ?? 'moving_average',
      lateFeePct: firm?.lateFeePct ?? 18,
    }),
    [firm],
  );

  const step3Initial = useMemo(
    () => ({
      primaryRole: firm?.primaryRole ?? 'owner',
      roundingPolicy: firm?.roundingPolicy ?? 'half_up',
    }),
    [firm],
  );

  async function handleGstinFetch() {
    const gstin = step1Form.getFieldValue('gstin') as string | undefined;
    if (!gstin) {
      message.warning('Enter a GSTIN first');
      return;
    }
    setGstinLoading(true);
    try {
      const info = await gstinLookup(wsId, gstin, firmId ?? undefined);
      step1Form.setFieldsValue({ firmName: info.legalName });
      // Seed the step-2 state from the GSTIN so place-of-supply is correct.
      const code = info.stateCode ?? gstin.slice(0, 2);
      step2Form.setFieldsValue({
        address: { ...step2Form.getFieldValue('address'), stateCode: code },
      });
      message.success(`Fetched: ${info.legalName}`);
    } catch (e: unknown) {
      const err = e as { message?: string };
      message.error(err?.message ?? 'GSTIN lookup failed');
    } finally {
      setGstinLoading(false);
    }
  }

  async function handleStep1Finish(values: Record<string, unknown>) {
    if (!firmId) return;
    setSubmitting(true);
    try {
      const booksBegin = values.accountsBooksBeginDate as dayjs.Dayjs | undefined;
      await updateFirmWizardStep(wsId, firmId, 1, {
        firmName: values.firmName,
        businessType: values.businessType,
        gstin: values.gstin,
        pan: values.pan,
        accountsBooksBeginDate: booksBegin ? booksBegin.toISOString() : undefined,
      });
      setCurrent(1);
    } catch (e: unknown) {
      const err = e as { message?: string };
      message.error(err?.message ?? 'Failed to save step 1');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleStep2Finish(values: Record<string, unknown>, skipped = false) {
    if (!firmId) return;
    setSubmitting(true);
    try {
      if (!skipped) {
        const addr = (values.address ?? {}) as Record<string, string | undefined>;
        await updateFirmWizardStep(wsId, firmId, 2, {
          address: {
            ...addr,
            // Persist the human-readable state name alongside the code for print.
            state: gstStateName(addr.stateCode),
          },
          contactPhone: values.contactPhone,
          contactEmail: values.contactEmail,
          website: values.website,
          aato: values.aato,
          inventoryValuationMethod: values.inventoryValuationMethod,
          lateFeePct: values.lateFeePct,
        });
      } else {
        await updateFirmWizardStep(wsId, firmId, 2, {});
      }
      setCurrent(2);
    } catch (e: unknown) {
      const err = e as { message?: string };
      message.error(err?.message ?? 'Failed to save step 2');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleStep3Finish(values: Record<string, unknown>, skipped = false) {
    if (!firmId) {
      router.push('/dashboard/finance');
      return;
    }
    setSubmitting(true);
    try {
      await updateFirmWizardStep(wsId, firmId, 3, skipped ? {} : values);
      message.success('Business setup complete!');
      router.push('/dashboard/finance');
    } catch (e: unknown) {
      const err = e as { message?: string };
      message.error(err?.message ?? 'Failed to save step 3');
    } finally {
      setSubmitting(false);
    }
  }

  const stepItems = [
    { title: 'Business info' },
    { title: 'Address & contact' },
    { title: 'Preferences' },
  ];

  if (loading) {
    return (
      <div style={{ maxWidth: 720, margin: '32px auto', padding: '0 16px' }}>
        <Skeleton.Input active block style={{ height: 28, width: 260, marginBottom: 24 }} />
        <Skeleton active paragraph={{ rows: 1 }} />
        <div style={{ marginTop: 32 }}>
          <Skeleton active paragraph={{ rows: 6 }} />
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 720, margin: '32px auto', padding: '0 16px' }}>
      <h1 style={{ marginBottom: 4, fontSize: 22 }}>Complete business setup</h1>
      <p style={{ marginBottom: 24, color: 'var(--cr-text-3)' }}>
        A few details so your invoices are legally correct and look professional. You can change any
        of this later under Billing &amp; Accounts settings.
      </p>

      <Steps current={current} items={stepItems} style={{ marginBottom: 32 }} />

      {/* Step 1 - Business info */}
      <div style={{ display: current === 0 ? 'block' : 'none' }}>
        <Form
          form={step1Form}
          layout="vertical"
          onFinish={handleStep1Finish}
          requiredMark="optional"
          initialValues={step1Initial}
        >
          <IdentityFields onFetchGstin={handleGstinFetch} gstinLoading={gstinLoading} />
          <Form.Item
            label="Books begin date"
            name="accountsBooksBeginDate"
            tooltip="The date your accounting records start in manekhr. Transactions before this date are not tracked."
          >
            <DatePicker style={{ width: '100%' }} placeholder="When do your books start?" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={submitting}>
              Save &amp; continue
            </Button>
          </Form.Item>
        </Form>
      </div>

      {/* Step 2 - Address & contact + accounting defaults */}
      <div style={{ display: current === 1 ? 'block' : 'none' }}>
        <Form
          form={step2Form}
          layout="vertical"
          onFinish={(v) => handleStep2Finish(v)}
          requiredMark="optional"
          initialValues={step2Initial}
        >
          <AddressFields />
          <Divider style={{ margin: '8px 0 16px' }} />
          <ContactFields />
          <Divider style={{ margin: '8px 0 16px' }} />
          <Form.Item
            label="Annual turnover (in lakhs)"
            name="aato"
            tooltip="Last year's total turnover. Above Rs 5 crore (500 lakhs) e-invoicing becomes mandatory."
          >
            <InputNumber style={{ width: '100%' }} min={0} placeholder="0 = not set" />
          </Form.Item>
          <Form.Item
            label="Inventory valuation method"
            name="inventoryValuationMethod"
            tooltip="How stock value is calculated for cost of goods sold. Moving Average suits most textile SMBs."
          >
            <Radio.Group>
              <Radio value="moving_average">Moving Average</Radio>
              <Radio value="fifo">FIFO</Radio>
            </Radio.Group>
          </Form.Item>
          <Form.Item label="Default late fee %" name="lateFeePct">
            <InputNumber style={{ width: '100%' }} min={0} max={100} step={0.5} />
          </Form.Item>

          <Divider />
          <Space>
            <Button onClick={() => setCurrent(0)}>Back</Button>
            <Button type="primary" htmlType="submit" loading={submitting}>
              Save &amp; continue
            </Button>
            <Button type="text" onClick={() => handleStep2Finish(step2Form.getFieldsValue(), true)}>
              Skip for now
            </Button>
          </Space>
        </Form>
      </div>

      {/* Step 3 - Preferences */}
      <div style={{ display: current === 2 ? 'block' : 'none' }}>
        <Form
          form={step3Form}
          layout="vertical"
          onFinish={(v) => handleStep3Finish(v)}
          initialValues={step3Initial}
        >
          <Form.Item label="Your role in this business" name="primaryRole">
            <Radio.Group>
              <Radio value="owner">Owner</Radio>
              <Radio value="manager">Manager</Radio>
              <Radio value="accountant">Accountant</Radio>
            </Radio.Group>
          </Form.Item>
          <Form.Item
            label="Rounding policy"
            name="roundingPolicy"
            tooltip="How invoice totals are rounded. Round to Rupee shows whole-rupee totals (common on Indian invoices)."
          >
            <Radio.Group>
              <Radio value="half_up">Standard (round to nearest paise)</Radio>
              <Radio value="round_off_to_rupee">Round to rupee (Rs 10.55 to Rs 11)</Radio>
            </Radio.Group>
          </Form.Item>

          <Divider />
          <Space>
            <Button onClick={() => setCurrent(1)}>Back</Button>
            <Button type="primary" htmlType="submit" loading={submitting}>
              Finish setup
            </Button>
            <Button type="text" onClick={() => handleStep3Finish(step3Form.getFieldsValue(), true)}>
              Skip for now
            </Button>
          </Space>
        </Form>
      </div>
    </div>
  );
}
