'use client';

import { useState } from 'react';
import { Card, Button, Modal, Form, InputNumber, Input, message } from 'antd';
import { TeamOutlined, ArrowRightOutlined } from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import { submitCustomPlanRequest } from '@/lib/actions';
import { parseApiError } from '@/lib/utils';

/**
 * Custom Plan card + request form for the in-app Plans hub
 * (app/account/subscription/plans). Shown AFTER the four self-serve plan cards
 * for users whose needs don't fit them ("none of these fit? we'll tailor one").
 *
 * What it does: collects team size, companies/factories, a contact mobile, and a
 * free-text note, then submits a lead via submitCustomPlanRequest (POST
 * subscriptions/custom-plan-request). NO plan/subscription is created -- pure lead
 * capture; an admin triages it in /admin/custom-plan-requests and calls the user
 * on the captured mobile.
 *
 * Cross-module links: lib/actions submitCustomPlanRequest -> the BE
 * CustomPlanRequestsController. i18n under subscription.customPlan.* (all four
 * locales). Mobile validation pattern mirrors the BE DTO so FE/BE agree.
 */
const MOBILE_PATTERN = /^[+]?\d[\d\s()-]{6,19}$/;

export function CustomPlanCard() {
  const t = useTranslations('subscription.customPlan');
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm();
  const [msgApi, ctx] = message.useMessage();

  const handleSubmit = async () => {
    let values: {
      teamMembers: number;
      companiesOrFactories?: number | null;
      mobile: string;
      note?: string;
    };
    try {
      values = await form.validateFields();
    } catch {
      return; // AntD renders inline field errors; nothing else to do.
    }
    setSubmitting(true);
    try {
      await submitCustomPlanRequest({
        teamMembers: Number(values.teamMembers),
        companiesOrFactories:
          values.companiesOrFactories != null ? Number(values.companiesOrFactories) : undefined,
        mobile: String(values.mobile).trim(),
        note: values.note?.trim() || undefined,
      });
      msgApi.success(t('success'));
      setOpen(false);
      form.resetFields();
    } catch (e) {
      msgApi.error(parseApiError(e) || t('error'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      {ctx}
      {/* Dashed gold border distinguishes this "tailored" option from the solid
          self-serve plan cards while staying on-brand. */}
      <Card className="rounded-2xl border-[1.5px] border-dashed border-[var(--cr-gold-400)] bg-[var(--cr-gold-100)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3.5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/70">
              <TeamOutlined
                className="text-xl"
                style={{ color: 'var(--cr-gold-700)' }}
                aria-hidden
              />
            </div>
            <div>
              <p className="m-0 font-display text-base font-bold text-heading">{t('cardTitle')}</p>
              <p className="m-0 mt-0.5 max-w-prose text-sm text-muted">{t('cardDesc')}</p>
            </div>
          </div>
          <Button
            type="primary"
            size="large"
            className="cr-cta-gold"
            icon={<ArrowRightOutlined />}
            onClick={() => setOpen(true)}
          >
            {t('cardCta')}
          </Button>
        </div>
      </Card>

      <Modal
        open={open}
        onCancel={() => setOpen(false)}
        onOk={handleSubmit}
        title={<span className="font-display font-bold">{t('modalTitle')}</span>}
        okText={t('submit')}
        cancelText={t('cancel')}
        okButtonProps={{ loading: submitting, size: 'large' }}
        cancelButtonProps={{ size: 'large' }}
        destroyOnHidden
        centered
        width={460}
        styles={{ body: { maxHeight: '65vh', overflowY: 'auto' } }}
      >
        <p className="mt-0 mb-4 text-sm text-muted">{t('modalDesc')}</p>
        <Form form={form} layout="vertical">
          <Form.Item
            name="teamMembers"
            label={t('teamMembersLabel')}
            rules={[{ required: true, message: t('teamMembersRequired') }]}
          >
            <InputNumber size="large" min={1} max={1000000} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="companiesOrFactories" label={t('companiesLabel')}>
            <InputNumber
              size="large"
              min={0}
              max={100000}
              style={{ width: '100%' }}
              placeholder={t('companiesPlaceholder')}
            />
          </Form.Item>
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

export default CustomPlanCard;
