'use client';

/**
 * The seller's quote form on an RFQ detail, rebuilt 2026-06-10 to the owner
 * prototype: a rate x quantity calculator with a live total + within-budget
 * feedback, a "what's included" checklist, lead time + offer validity, the
 * message, optional work-sample photos, and a "quote as" storefront picker.
 * Submitting again updates the same quote (BE upserts on {rfqId, sellerUserId}).
 * `price` (the TOTAL) stays the canonical compare number; rate/quantity is the
 * breakdown behind it. No WhatsApp handoff - conversations happen in the
 * in-app Inbox once the buyer accepts (mediator model).
 *
 * Cross-module links:
 * - components/connect/MediaUploadGrid (shared R2 uploader; category
 *   `connect-portfolio` - the BE upload policy already covers it).
 * - features/connect/entities/storefront.actions.listMyStorefronts feeds the
 *   `storefronts` prop (page.tsx fetches; empty = picker hidden).
 * - onTotalChange streams the live total up so RfqDetailScreen's
 *   "Where your price sits" bar tracks the typed rate in real time.
 */

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Checkbox, Form, Input, InputNumber, Select } from 'antd';
import { AlertTriangle, CheckCircle2, Store } from 'lucide-react';
import DsButton from '@/components/ui/DsButton';
import MediaUploadGrid from '@/components/connect/MediaUploadGrid';
import type { Storefront } from '../entities/entities.types';
import { QUOTE_INCLUDE_PRESETS, type Rfq, type Quote, type CreateQuotePayload } from './rfq.types';
import { ConnectEvents, trackEvent } from '@/lib/analytics-events';

function rupees(n: number): string {
  return `₹${n.toLocaleString('en-IN')}`;
}

interface FormValues {
  rate?: number;
  rateQuantity?: number;
  price?: number;
  includes?: string[];
  leadTimeDays?: number;
  validityDays?: number | 'open';
  message?: string;
  storefrontId?: string;
}

interface Props {
  rfq: Rfq;
  initial?: Quote | null;
  /** The seller's own storefronts ("quote as"); empty hides the picker. */
  storefronts?: Storefront[];
  submitting: boolean;
  onSubmit: (payload: CreateQuotePayload) => void;
  /** Streams the live computed total (null when incomplete) to the price bar. */
  onTotalChange?: (total: number | null) => void;
}

export default function QuoteComposer({
  rfq,
  initial,
  storefronts = [],
  submitting,
  onSubmit,
  onTotalChange,
}: Props) {
  const t = useTranslations('connect.rfq');
  const [form] = Form.useForm<FormValues>();
  // Work-sample URLs live outside the Form (MediaUploadGrid is uncontrolled).
  const [sampleUrls, setSampleUrls] = useState<string[]>(initial?.sampleUrls ?? []);

  // Additive funnel telemetry: rfqQuoteStarted when the composer mounts (the
  // composer rendering = the seller opened the quote flow). Once per mount.
  // Keyless-safe sink, carries only the rfqId.
  useEffect(() => {
    trackEvent(ConnectEvents.rfqQuoteStarted, { rfqId: rfq._id });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Per-unit mode when the request states a quantity; lump-sum total otherwise.
  const perUnit = rfq.quantity != null && rfq.quantity > 0;
  // The bare unit noun, localized (connect.rfq.unit.<slug>); generic fallback
  // when the buyer set a quantity without a unit.
  const unitLabel = rfq.unit ? t(`unit.${rfq.unit}`) : t('units');

  const initialValues: FormValues = initial
    ? {
        rate: initial.rate ?? undefined,
        rateQuantity: initial.rateQuantity ?? rfq.quantity ?? undefined,
        price: initial.rate != null ? undefined : initial.price,
        includes: initial.includes ?? [],
        leadTimeDays: initial.leadTimeDays ?? undefined,
        validityDays: initial.validityDays ?? 'open',
        message: initial.message || undefined,
        storefrontId: initial.storefrontId ?? undefined,
      }
    : {
        rateQuantity: rfq.quantity ?? undefined,
        includes: ['approval-sample'],
        validityDays: 7,
      };

  // Live total: rate x quantity in per-unit mode, the raw price otherwise.
  const values = Form.useWatch([], form) as FormValues | undefined;
  const total = useMemo(() => {
    const v = values ?? initialValues;
    if (perUnit) {
      const r = v.rate;
      const q = v.rateQuantity;
      return r != null && q != null && r > 0 && q > 0 ? Math.round(r * q) : null;
    }
    return v.price != null && v.price > 0 ? Math.round(v.price) : null;
    // initialValues is stable for the mount; values drives recomputes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values, perUnit]);

  // Budget feedback: only when the buyer stated a budget (else "Negotiable").
  const feedback = useMemo(() => {
    if (total == null) return null;
    const lo = rfq.budgetMin;
    const hi = rfq.budgetMax;
    if (lo == null && hi == null) return null;
    if (hi != null && total > hi)
      return { tone: 'over' as const, text: t('calc.overBudget', { max: rupees(hi) }) };
    if (lo != null && total < lo) return { tone: 'good' as const, text: t('calc.underBudget') };
    return { tone: 'good' as const, text: t('calc.withinBudget') };
  }, [total, rfq.budgetMin, rfq.budgetMax, t]);

  const handleFinish = (v: FormValues) => {
    if (total == null) return;
    const payload: CreateQuotePayload = { price: total };
    if (perUnit && v.rate != null) {
      payload.rate = v.rate;
      payload.rateQuantity = v.rateQuantity ?? rfq.quantity ?? undefined;
    }
    if (v.includes?.length) payload.includes = v.includes;
    if (v.validityDays != null && v.validityDays !== 'open') payload.validityDays = v.validityDays;
    if (sampleUrls.length) payload.sampleUrls = sampleUrls.slice(0, 5);
    if (v.leadTimeDays != null) payload.leadTimeDays = v.leadTimeDays;
    if (v.message?.trim()) payload.message = v.message.trim();
    if (v.storefrontId) payload.storefrontId = v.storefrontId;
    // Additive funnel telemetry: rfqQuoteSubmitted as the quote is actually
    // submitted (payload built, valid total). Does not change submit logic.
    trackEvent(ConnectEvents.rfqQuoteSubmitted, { rfqId: rfq._id });
    onSubmit(payload);
  };

  return (
    <Form
      form={form}
      layout="vertical"
      colon={false}
      initialValues={initialValues}
      onFinish={handleFinish}
      onValuesChange={() => {
        // Defer one tick so useWatch has the fresh values, then stream the total.
        setTimeout(() => {
          const v = form.getFieldsValue();
          const next = perUnit
            ? v.rate != null && v.rateQuantity != null && v.rate > 0 && v.rateQuantity > 0
              ? Math.round(v.rate * v.rateQuantity)
              : null
            : v.price != null && v.price > 0
              ? Math.round(v.price)
              : null;
          onTotalChange?.(next);
        }, 0);
      }}
    >
      {/* Price calculator block (tinted, the form's anchor). */}
      <div
        style={{
          border: '1px solid var(--cr-primary-border)',
          background: 'var(--cr-primary-light)',
          borderRadius: 'var(--cr-radius-lg)',
          padding: 14,
          marginBottom: 16,
        }}
      >
        {perUnit ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <Form.Item
              label={t('calc.rateLabel')}
              name="rate"
              rules={[{ required: true, message: t('priceRequired') }]}
              className="!mb-0"
            >
              <InputNumber
                min={0}
                style={{ width: '100%' }}
                prefix="₹"
                suffix={`/ ${unitLabel}`}
                placeholder="0"
              />
            </Form.Item>
            <Form.Item
              label={t('calc.quantityLabel')}
              name="rateQuantity"
              rules={[{ required: true, message: t('calc.quantityRequired') }]}
              className="!mb-0"
            >
              <InputNumber min={1} style={{ width: '100%' }} suffix={unitLabel} />
            </Form.Item>
          </div>
        ) : (
          <Form.Item
            label={t('priceLabel')}
            name="price"
            rules={[{ required: true, message: t('priceRequired') }]}
            className="!mb-0"
          >
            <InputNumber min={0} style={{ width: '100%' }} prefix="₹" placeholder="0" />
          </Form.Item>
        )}

        <div
          className="mt-3 flex items-baseline justify-between border-t border-dashed pt-3"
          style={{ borderColor: 'var(--cr-primary-border)' }}
        >
          <span className="text-[12px] font-semibold" style={{ color: 'var(--cr-text-3)' }}>
            {t('calc.totalLabel')}
          </span>
          <span
            className="text-[24px] font-extrabold"
            style={{ color: 'var(--cr-primary)', fontVariantNumeric: 'tabular-nums' }}
          >
            {total != null ? rupees(total) : '-'}
          </span>
        </div>
        {feedback && (
          <div
            className="mt-2 flex items-center gap-1.5 text-[11.5px] font-semibold"
            style={{
              color: feedback.tone === 'over' ? 'var(--cr-warning)' : 'var(--cr-success)',
            }}
          >
            {feedback.tone === 'over' ? (
              <AlertTriangle size={13} aria-hidden />
            ) : (
              <CheckCircle2 size={13} aria-hidden />
            )}
            {feedback.text}
          </div>
        )}
      </div>

      {/* What's included - preset checkboxes stored as slugs. */}
      <Form.Item label={t('includes.label')} name="includes">
        <Checkbox.Group
          options={QUOTE_INCLUDE_PRESETS.map((slug) => ({
            label: t(`includes.${slug}`),
            value: slug,
          }))}
          className="grid grid-cols-1 gap-1.5 sm:grid-cols-2"
        />
      </Form.Item>

      <div className="grid gap-3 sm:grid-cols-2">
        <Form.Item label={t('leadTimeLabel')} name="leadTimeDays">
          <InputNumber
            min={0}
            style={{ width: '100%' }}
            suffix={t('calc.leadTimeSuffix')}
            placeholder="0"
          />
        </Form.Item>
        <Form.Item label={t('validity.label')} name="validityDays">
          <Select
            options={[
              { value: 3, label: t('validity.days', { count: 3 }) },
              { value: 7, label: t('validity.days', { count: 7 }) },
              { value: 15, label: t('validity.days', { count: 15 }) },
              { value: 'open', label: t('validity.tillClosed') },
            ]}
          />
        </Form.Item>
      </div>

      <Form.Item
        label={t('quoteMessageLabel')}
        name="message"
        rules={[{ max: 2000 }]}
        extra={t('calc.messageHint')}
      >
        <Input.TextArea
          rows={4}
          maxLength={2000}
          showCount
          placeholder={t('quoteMessagePlaceholder')}
        />
      </Form.Item>

      {/* Work samples - proof of similar work (shared R2 uploader, max 5). */}
      <Form.Item label={t('samples.label')} extra={t('samples.hint')}>
        <MediaUploadGrid
          mediaKind="image"
          max={5}
          category="connect-portfolio"
          initialUrls={initial?.sampleUrls ?? []}
          onChange={setSampleUrls}
        />
      </Form.Item>

      {/* Quote as - only when the seller has storefronts (existing BE field
          that the old form never collected). */}
      {storefronts.length > 0 && (
        <Form.Item label={t('quoteAs.label')} name="storefrontId" extra={t('quoteAs.hint')}>
          <Select
            allowClear
            placeholder={t('quoteAs.placeholder')}
            options={storefronts.map((s) => ({ value: s._id, label: s.name }))}
            suffixIcon={<Store size={14} aria-hidden />}
          />
        </Form.Item>
      )}

      <div className="flex items-center justify-end gap-2">
        <DsButton dsVariant="primary" htmlType="submit" loading={submitting}>
          {initial ? t('updateQuote') : t('sendQuote')}
        </DsButton>
      </div>
      <p className="mt-3 mb-0 text-[11px] leading-relaxed" style={{ color: 'var(--cr-text-4)' }}>
        {t('calc.disclosure')}
      </p>
    </Form>
  );
}
