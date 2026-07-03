'use client';

import { useEffect, useState } from 'react';
import {
  Modal,
  Form,
  Input,
  InputNumber,
  Select,
  Switch,
  DatePicker,
  Button,
  Alert,
  message,
} from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import { adminCreateCoupon, adminUpdateCoupon } from '@/lib/actions';
import { parseApiError } from '@/lib/utils';
import type {
  Coupon,
  CouponType,
  AdminCreateCouponPayload,
  AdminUpdateCouponPayload,
  BillingCycle,
} from '@/types';
import { getAdminPlans } from '@/lib/actions';
import type { Plan } from '@/types';

interface FormValues {
  code: string;
  description?: string;
  discountType: CouponType;
  valueOrPaise: number;
  validFrom?: Dayjs;
  validUntil?: Dayjs;
  maxRedemptions?: number;
  maxRedemptionsPerUser?: number;
  isFirstTimeOnly: boolean;
  isStackable: boolean;
  applicablePlanIds?: string[];
  applicableBillingCycles?: BillingCycle[];
  autoApplyCampaignKey?: string;
  isActive: boolean;
}

interface Props {
  open: boolean;
  coupon: Coupon | null;
  onCancel: () => void;
  onSaved: (coupon: Coupon) => void;
  /**
   * Plan ids to pre-fill into `applicablePlanIds` in CREATE mode (e.g. the
   * Connect plans, so a discount opened from the Connect promotions console is
   * scoped to Connect by default). Ignored in edit mode. The admin can still
   * change the selection.
   */
  defaultPlanIds?: string[];
}

const COUPON_CODE_RE = /^[A-Z0-9_-]{3,32}$/;

/**
 * Create OR edit a coupon. When `coupon` is null, runs in create mode
 * (code field editable). When set, runs in edit mode (code is locked
 * because the BE schema's unique index keys on code).
 */
export function CouponEditor({ open, coupon, onCancel, onSaved, defaultPlanIds }: Props) {
  const [form] = Form.useForm<FormValues>();
  const [submitting, setSubmitting] = useState(false);
  const [msgApi, ctx] = message.useMessage();
  const isEdit = !!coupon;

  useEffect(() => {
    if (!open) return;
    if (coupon) {
      form.setFieldsValue({
        code: coupon.code,
        description: coupon.description,
        discountType: coupon.discountType,
        valueOrPaise: coupon.valueOrPaise,
        validFrom: coupon.validFrom ? dayjs(coupon.validFrom) : undefined,
        validUntil: coupon.validUntil ? dayjs(coupon.validUntil) : undefined,
        maxRedemptions: coupon.maxRedemptions ?? undefined,
        maxRedemptionsPerUser: coupon.maxRedemptionsPerUser ?? undefined,
        isFirstTimeOnly: coupon.isFirstTimeOnly,
        isStackable: coupon.isStackable,
        applicablePlanIds: coupon.applicablePlanIds,
        applicableBillingCycles: coupon.applicableBillingCycles as BillingCycle[],
        autoApplyCampaignKey: coupon.autoApplyCampaignKey,
        isActive: coupon.isActive,
      });
    } else {
      form.resetFields();
      form.setFieldsValue({
        discountType: 'percentage',
        isFirstTimeOnly: false,
        isStackable: false,
        isActive: true,
        ...(defaultPlanIds && defaultPlanIds.length > 0
          ? { applicablePlanIds: defaultPlanIds }
          : {}),
      });
    }
  }, [open, coupon, form, defaultPlanIds]);

  const handleSubmit = async () => {
    const values = await form.validateFields();
    setSubmitting(true);
    try {
      const payload = {
        ...(isEdit ? {} : { code: values.code }),
        description: values.description,
        discountType: values.discountType,
        valueOrPaise: values.valueOrPaise,
        validFrom: values.validFrom?.toISOString(),
        validUntil: values.validUntil?.toISOString(),
        maxRedemptions: values.maxRedemptions,
        maxRedemptionsPerUser: values.maxRedemptionsPerUser,
        isFirstTimeOnly: values.isFirstTimeOnly,
        isStackable: values.isStackable,
        applicablePlanIds: values.applicablePlanIds ?? [],
        applicableBillingCycles: values.applicableBillingCycles ?? [],
        autoApplyCampaignKey: values.autoApplyCampaignKey,
        isActive: values.isActive,
      };
      const saved = isEdit
        ? await adminUpdateCoupon(coupon!._id, payload as AdminUpdateCouponPayload)
        : await adminCreateCoupon(payload as AdminCreateCouponPayload);
      msgApi.success(isEdit ? 'Coupon updated' : 'Coupon created');
      onSaved(saved);
    } catch (e) {
      msgApi.error(parseApiError(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onCancel={onCancel}
      footer={null}
      width={620}
      destroyOnHidden
      title={
        <span className="font-display font-bold">
          {isEdit ? `Edit coupon ${coupon?.code}` : 'New coupon'}
        </span>
      }
    >
      {ctx}

      <Form form={form} layout="vertical" onFinish={handleSubmit}>
        <div className="grid grid-cols-1 gap-x-4 md:grid-cols-2">
          <Form.Item
            label="Code"
            name="code"
            rules={[
              { required: !isEdit, message: 'Required' },
              {
                pattern: COUPON_CODE_RE,
                message: '3–32 chars, A–Z 0–9 _ -',
              },
            ]}
          >
            <Input
              maxLength={32}
              placeholder="LAUNCH20"
              disabled={isEdit}
              onChange={(e) => form.setFieldValue('code', e.target.value.toUpperCase())}
            />
          </Form.Item>

          <Form.Item label="Active" name="isActive" valuePropName="checked">
            <Switch />
          </Form.Item>
        </div>

        <Form.Item label="Description" name="description" rules={[{ max: 280 }]}>
          <Input.TextArea rows={2} maxLength={280} showCount />
        </Form.Item>

        <div className="grid grid-cols-1 gap-x-4 md:grid-cols-2">
          <Form.Item label="Discount type" name="discountType" rules={[{ required: true }]}>
            <Select
              options={[
                { value: 'percentage', label: 'Percentage (% off)' },
                { value: 'fixed_amount', label: 'Fixed amount (₹ off)' },
                { value: 'fixed_price', label: 'Fixed price (final ₹)' },
              ]}
            />
          </Form.Item>

          <Form.Item noStyle shouldUpdate={(p, n) => p.discountType !== n.discountType}>
            {({ getFieldValue }) => {
              const t: CouponType = getFieldValue('discountType');
              return (
                <Form.Item
                  label={
                    t === 'percentage'
                      ? 'Percent (1–100)'
                      : t === 'fixed_amount'
                        ? 'Discount amount (paise)'
                        : 'Final price (paise)'
                  }
                  name="valueOrPaise"
                  rules={[{ required: true, message: 'Required' }]}
                >
                  <InputNumber
                    min={1}
                    max={t === 'percentage' ? 100 : undefined}
                    className="w-full"
                  />
                </Form.Item>
              );
            }}
          </Form.Item>
        </div>

        <div className="grid grid-cols-1 gap-x-4 md:grid-cols-2">
          <Form.Item label="Valid from" name="validFrom">
            <DatePicker className="w-full" />
          </Form.Item>
          <Form.Item label="Valid until" name="validUntil">
            <DatePicker className="w-full" />
          </Form.Item>
        </div>

        <div className="grid grid-cols-1 gap-x-4 md:grid-cols-2">
          <Form.Item
            label="Max total redemptions"
            name="maxRedemptions"
            extra="Leave blank for unlimited"
          >
            <InputNumber min={1} className="w-full" />
          </Form.Item>
          <Form.Item
            label="Max per user"
            name="maxRedemptionsPerUser"
            extra="Leave blank for unlimited; default 1"
          >
            <InputNumber min={1} className="w-full" />
          </Form.Item>
        </div>

        <Form.Item
          label="Restrict to plans"
          name="applicablePlanIds"
          extra="Leave empty to apply to every catalogue plan"
        >
          <PlansMultiPicker />
        </Form.Item>

        <Form.Item
          label="Restrict to billing cycles"
          name="applicableBillingCycles"
          extra="Leave empty to apply to all cycles"
        >
          <Select
            mode="multiple"
            allowClear
            options={[
              { value: 'monthly', label: 'Monthly' },
              { value: 'yearly', label: 'Yearly' },
            ]}
          />
        </Form.Item>

        <div className="grid grid-cols-1 gap-x-4 md:grid-cols-2">
          <Form.Item
            label="First-time customers only"
            name="isFirstTimeOnly"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>
          <Form.Item
            label="Stackable with other coupons"
            name="isStackable"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>
        </div>

        <Form.Item
          label="Auto-apply campaign key"
          name="autoApplyCampaignKey"
          extra="Marketing URL ?promo=<key> auto-applies this coupon"
        >
          <Input maxLength={64} placeholder="LAUNCH2026" />
        </Form.Item>

        <Alert
          type="info"
          showIcon
          className="mb-3"
          title="Per-user / global caps are enforced atomically by the BE coupon engine. First-time-only blocks any user with prior captured payments."
        />

        <div className="flex justify-end gap-2">
          <Button onClick={onCancel}>Cancel</Button>
          <Button type="primary" htmlType="submit" loading={submitting}>
            {isEdit ? 'Save changes' : 'Create coupon'}
          </Button>
        </div>
      </Form>
    </Modal>
  );
}

function PlansMultiPicker(props: { value?: string[]; onChange?: (ids: string[]) => void }) {
  const [plans, setPlans] = useState<Plan[]>([]);
  useEffect(() => {
    let cancelled = false;
    getAdminPlans()
      .then((p) => !cancelled && setPlans(p ?? []))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);
  return (
    <Select
      mode="multiple"
      allowClear
      placeholder="All plans"
      value={props.value}
      onChange={(v) => props.onChange?.(v as string[])}
      optionFilterProp="label"
      showSearch
      options={plans.map((p) => ({
        value: p._id,
        label: `${p.name} - ${p.tier}`,
      }))}
    />
  );
}
