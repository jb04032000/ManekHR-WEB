'use client';

import { useState } from 'react';
import { Modal, Form, Input, InputNumber, Alert, message } from 'antd';
import { useTranslations } from 'next-intl';
import { submitPlanInterestRequest } from '@/lib/actions';
import { parseApiError } from '@/lib/utils';
import type { PlanWithBilling } from '@/types';

/**
 * "Request a callback" popup for the in-app Plans hub
 * (app/account/subscription/plans). Opened when a user clicks Subscribe on a
 * predefined PAID plan while online payments are off: instead of a dead checkout,
 * we capture a callback mobile so the team reaches out, then show a "we'll contact
 * you" confirmation.
 *
 * What it does: collects a contact mobile (required), optional team size, and an
 * optional note, then submits a lead via submitPlanInterestRequest (POST
 * subscriptions/custom-plan-request/plan-interest). NO subscription is created --
 * pure lead capture, flagged kind='plan' so the admin sees it alongside the
 * custom-plan leads in /admin/custom-plan-requests.
 *
 * Cross-module links: lib/actions submitPlanInterestRequest -> the BE
 * CustomPlanRequestsController.createPlanInterest. Controlled by the parent
 * (plans page) via the `plan` prop (non-null = open). When payments go live
 * (env.paymentsEnabled), the page bypasses this modal and routes to the real
 * checkout instead, so this stays dormant. Mobile pattern mirrors the BE DTO.
 */
const MOBILE_PATTERN = /^[+]?\d[\d\s()-]{6,19}$/;

export function PlanContactModal({
  plan,
  onClose,
}: {
  /** The plan whose Subscribe was clicked; non-null = modal open. */
  plan: PlanWithBilling | null;
  onClose: () => void;
}) {
  const t = useTranslations('subscription.planContact');
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm();
  const [msgApi, ctx] = message.useMessage();

  const handleSubmit = async () => {
    if (!plan) return;
    let values: { mobile: string; teamMembers?: number | null; note?: string };
    try {
      values = await form.validateFields();
    } catch {
      return; // AntD renders inline field errors; nothing else to do.
    }
    setSubmitting(true);
    try {
      await submitPlanInterestRequest({
        planId: plan._id,
        planTier: plan.tier,
        planName: plan.name,
        mobile: String(values.mobile).trim(),
        teamMembers: values.teamMembers != null ? Number(values.teamMembers) : undefined,
        note: values.note?.trim() || undefined,
      });
      msgApi.success(t('success'));
      form.resetFields();
      onClose();
    } catch (e) {
      msgApi.error(parseApiError(e) || t('error'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      {ctx}
      <Modal
        open={plan != null}
        onCancel={() => {
          form.resetFields();
          onClose();
        }}
        onOk={handleSubmit}
        title={
          <span className="font-display font-bold">{t('title', { plan: plan?.name ?? '' })}</span>
        }
        okText={t('submit')}
        cancelText={t('cancel')}
        okButtonProps={{ loading: submitting, size: 'large' }}
        cancelButtonProps={{ size: 'large' }}
        destroyOnHidden
        centered
        width={460}
        styles={{ body: { maxHeight: '65vh', overflowY: 'auto' } }}
      >
        {/* Honest framing: buying online isn't live yet, so we take a number and
            the team sets them up. */}
        <Alert
          type="info"
          showIcon
          className="mb-4"
          title={t('noticeTitle')}
          description={t('noticeBody')}
        />
        <Form form={form} layout="vertical">
          <Form.Item
            name="mobile"
            label={t('mobileLabel')}
            rules={[
              { required: true, message: t('mobileRequired') },
              { pattern: MOBILE_PATTERN, message: t('mobileInvalid') },
            ]}
          >
            <Input size="large" inputMode="tel" placeholder={t('mobilePlaceholder')} />
          </Form.Item>
          <Form.Item name="teamMembers" label={t('teamMembersLabel')}>
            <InputNumber
              size="large"
              min={1}
              max={1000000}
              style={{ width: '100%' }}
              placeholder={t('teamMembersPlaceholder')}
            />
          </Form.Item>
          <Form.Item name="note" label={t('noteLabel')}>
            <Input.TextArea
              rows={3}
              maxLength={1000}
              showCount
              placeholder={t('notePlaceholder')}
            />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}

export default PlanContactModal;
