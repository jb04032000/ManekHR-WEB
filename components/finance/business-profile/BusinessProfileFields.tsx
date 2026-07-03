'use client';

// Reusable business-profile field groups, shared by the onboarding wizard
// (app/dashboard/finance/firms/new) and the canonical Business Profile settings
// page. Each group renders AntD <Form.Item>s and must be mounted inside a parent
// <Form>. Nested names (e.g. ['address','line1']) map onto the structured Firm
// fields. Info icons use Form.Item's built-in `tooltip` prop, kept to the few
// places a textile-SMB owner genuinely benefits from an explanation.

import { Button, Form, Input, Select, Space } from 'antd';
import { GST_STATE_CODES } from '@/lib/billing/gst-states';

export const BUSINESS_TYPE_OPTIONS = [
  { value: 'trading', label: 'Trading' },
  { value: 'manufacturing', label: 'Manufacturing' },
  { value: 'service', label: 'Service' },
  { value: 'composition', label: 'Composition (Section 10)' },
];

const STATE_OPTIONS = GST_STATE_CODES.map((s) => ({
  value: s.code,
  label: `${s.name} (${s.code})`,
}));

// GSTIN format: 2 state digits + 10-char PAN + entity digit + 'Z' + checksum.
const GSTIN_PATTERN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const PAN_PATTERN = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

export function IdentityFields({
  onFetchGstin,
  gstinLoading,
}: {
  onFetchGstin?: () => void;
  gstinLoading?: boolean;
}) {
  return (
    <>
      <Form.Item
        label="Business name"
        name="firmName"
        rules={[{ required: true, message: 'Business name is required' }]}
        tooltip="Your registered legal or trade name. It prints on every invoice and voucher."
      >
        <Input placeholder="e.g. Ramesh Textiles Pvt Ltd" />
      </Form.Item>

      <Form.Item
        label="GSTIN"
        tooltip="15-character GST number. Fetch auto-fills your legal name; the first two digits set your state for tax."
      >
        <Space.Compact style={{ width: '100%' }}>
          <Form.Item
            name="gstin"
            noStyle
            rules={[{ pattern: GSTIN_PATTERN, message: 'Enter a valid 15-character GSTIN' }]}
          >
            <Input
              placeholder="24AABCR1234R1ZX"
              maxLength={15}
              style={{ textTransform: 'uppercase' }}
            />
          </Form.Item>
          {onFetchGstin && (
            <Button loading={gstinLoading} onClick={onFetchGstin}>
              Fetch details
            </Button>
          )}
        </Space.Compact>
      </Form.Item>

      <Form.Item
        label="Business type"
        name="businessType"
        rules={[{ required: true, message: 'Select a business type' }]}
        tooltip="Composition dealers issue a Bill of Supply (no tax shown). Others issue regular tax invoices."
      >
        <Select options={BUSINESS_TYPE_OPTIONS} placeholder="Select business type" />
      </Form.Item>

      <Form.Item
        label="PAN"
        name="pan"
        tooltip="10-character PAN of the business. Used on statutory documents and TDS."
        rules={[{ pattern: PAN_PATTERN, message: 'Enter a valid 10-character PAN' }]}
      >
        <Input placeholder="AABCR1234R" maxLength={10} style={{ textTransform: 'uppercase' }} />
      </Form.Item>
    </>
  );
}

export function AddressFields() {
  return (
    <>
      <Form.Item label="Address line 1" name={['address', 'line1']}>
        <Input placeholder="Building, street" />
      </Form.Item>
      <Form.Item label="Address line 2" name={['address', 'line2']}>
        <Input placeholder="Area, landmark (optional)" />
      </Form.Item>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <Form.Item label="City" name={['address', 'city']}>
          <Input placeholder="City" />
        </Form.Item>
        <Form.Item
          label="Pincode"
          name={['address', 'pincode']}
          rules={[{ pattern: /^[0-9]{6}$/, message: 'Enter a 6-digit pincode' }]}
        >
          <Input placeholder="380001" maxLength={6} />
        </Form.Item>
      </div>
      <Form.Item
        label="State"
        name={['address', 'stateCode']}
        tooltip="Your principal place of business. Drives CGST+SGST (same state) vs IGST (other state) on invoices."
      >
        <Select
          showSearch
          optionFilterProp="label"
          options={STATE_OPTIONS}
          placeholder="Select state"
          allowClear
        />
      </Form.Item>
    </>
  );
}

export function ContactFields() {
  return (
    <>
      <Form.Item label="Phone" name="contactPhone">
        <Input placeholder="Business contact number" maxLength={20} />
      </Form.Item>
      <Form.Item
        label="Email"
        name="contactEmail"
        rules={[{ type: 'email', message: 'Enter a valid email' }]}
      >
        <Input placeholder="contact@business.com" />
      </Form.Item>
      <Form.Item label="Website" name="website">
        <Input placeholder="https://... (optional)" />
      </Form.Item>
    </>
  );
}
