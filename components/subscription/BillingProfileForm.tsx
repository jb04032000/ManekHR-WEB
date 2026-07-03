'use client';

import { useEffect, useState } from 'react';
import { Card, Form, Input, Select, Button, Alert, Spin, message } from 'antd';
import { ShopOutlined, IdcardOutlined } from '@ant-design/icons';
import { getBillingProfile, updateBillingProfile } from '@/lib/actions';
import { parseApiError } from '@/lib/utils';
import type { BillingProfile } from '@/types';
import { GST_STATE_CODES } from '@/lib/billing/gst-states';

const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
const PINCODE_RE = /^[1-9][0-9]{5}$/;

interface Props {
  /** When set, calls back on save without showing the surrounding card. */
  embedded?: boolean;
  /** Hide the heading + description. Used inside checkout modal. */
  hideHeader?: boolean;
  onSaved?: (profile: BillingProfile) => void;
}

export function BillingProfileForm({ embedded, hideHeader, onSaved }: Props) {
  const [form] = Form.useForm<BillingProfile>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [initialProfile, setInitialProfile] = useState<BillingProfile | null>(null);
  const [msgApi, ctx] = message.useMessage();

  useEffect(() => {
    let cancelled = false;
    getBillingProfile()
      .then((profile) => {
        if (cancelled) return;
        setInitialProfile(profile ?? null);
      })
      .catch(() => {
        // No profile yet - leave blank.
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  const handleGstinChange = (value: string) => {
    const upper = value.toUpperCase();
    form.setFieldValue('gstin', upper);
    if (upper.length >= 2 && /^[0-9]{2}/.test(upper)) {
      const derivedCode = upper.slice(0, 2);
      const current = form.getFieldValue('stateCode');
      if (!current) form.setFieldValue('stateCode', derivedCode);
    }
  };

  const handleSubmit = async (values: BillingProfile) => {
    setSaving(true);
    try {
      const cleaned: BillingProfile = Object.fromEntries(
        Object.entries(values).filter(([, v]) => v !== undefined && v !== ''),
      ) as BillingProfile;
      const saved = await updateBillingProfile(cleaned);
      msgApi.success('Billing profile saved');
      onSaved?.(saved);
    } catch (e) {
      msgApi.error(parseApiError(e));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <Spin />
      </div>
    );
  }

  const inner = (
    <>
      {ctx}
      {!hideHeader && (
        <div className="mb-4">
          <h3 className="m-0 mb-1 font-display text-lg font-bold text-heading">
            Billing Information
          </h3>
          <p className="m-0 text-sm text-muted">
            Used on every GST invoice. Fill GSTIN to get B2B input-credit invoices instead of B2C.
          </p>
        </div>
      )}

      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        autoComplete="off"
        initialValues={initialProfile ?? undefined}
      >
        <Alert
          type="info"
          showIcon
          className="mb-4"
          title="Per Indian GST law, the place-of-supply on every invoice is derived from your state code. Cross-state purchases attract IGST; within-state purchases attract CGST + SGST."
        />

        <div className="grid grid-cols-1 gap-x-4 md:grid-cols-2">
          <Form.Item
            label="GSTIN (optional)"
            name="gstin"
            rules={[
              {
                pattern: GSTIN_RE,
                message: 'Enter a valid 15-character GSTIN',
              },
            ]}
            extra="Leave blank for B2C consumer invoices."
          >
            <Input
              prefix={<IdcardOutlined className="text-muted" />}
              placeholder="22AAAAA0000A1Z5"
              maxLength={15}
              onChange={(e) => handleGstinChange(e.target.value)}
            />
          </Form.Item>

          <Form.Item label="Business / Trade Name" name="businessName" rules={[{ max: 120 }]}>
            <Input
              prefix={<ShopOutlined className="text-muted" />}
              placeholder="Acme Manufacturing Pvt Ltd"
            />
          </Form.Item>
        </div>

        <Form.Item label="Address Line 1" name="addressLine1" rules={[{ max: 120 }]}>
          <Input placeholder="Building / Plot / Street" />
        </Form.Item>

        <Form.Item label="Address Line 2" name="addressLine2" rules={[{ max: 120 }]}>
          <Input placeholder="Area / Landmark (optional)" />
        </Form.Item>

        <div className="grid grid-cols-1 gap-x-4 md:grid-cols-3">
          <Form.Item label="City" name="city" rules={[{ max: 60 }]}>
            <Input placeholder="Surat" />
          </Form.Item>

          <Form.Item label="State" name="state" rules={[{ max: 60 }]}>
            <Select
              showSearch
              allowClear
              placeholder="Select state"
              optionFilterProp="label"
              options={GST_STATE_CODES.map((s) => ({
                value: s.name,
                label: s.name,
                code: s.code,
              }))}
              onChange={(value) => {
                const match = GST_STATE_CODES.find((s) => s.name === value);
                if (match) form.setFieldValue('stateCode', match.code);
              }}
            />
          </Form.Item>

          <Form.Item
            label="State Code"
            name="stateCode"
            rules={[
              { len: 2, message: 'Must be 2 digits' },
              { pattern: /^[0-9]{2}$/, message: '2-digit GST state code' },
            ]}
            extra="Auto-filled from GSTIN or state."
          >
            <Input maxLength={2} placeholder="24" />
          </Form.Item>
        </div>

        <div className="grid grid-cols-1 gap-x-4 md:grid-cols-2">
          <Form.Item
            label="PIN Code"
            name="pincode"
            rules={[{ pattern: PINCODE_RE, message: '6-digit Indian PIN' }]}
          >
            <Input maxLength={6} placeholder="395001" />
          </Form.Item>

          <Form.Item label="Country" name="country" initialValue="India">
            <Input placeholder="India" disabled />
          </Form.Item>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="primary" htmlType="submit" loading={saving}>
            Save Billing Info
          </Button>
        </div>
      </Form>
    </>
  );

  if (embedded) return inner;

  return <Card className="rounded-2xl">{inner}</Card>;
}
