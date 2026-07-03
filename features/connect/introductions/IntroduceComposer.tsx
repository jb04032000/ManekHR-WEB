'use client';

/**
 * IntroduceComposer - the "Introduce two people" modal (Broker Introductions,
 * Slice 2). A broker picks two of their connections, says who is the buyer and
 * who is the seller, adds an optional note, and sends. Both parties must then
 * confirm before the introduction goes live (the anti-gaming heart of the
 * feature - the broker cannot fabricate a confirmed introduction).
 *
 * Cross-module links:
 *  - copies the AntD v6 Modal + Form.useForm pattern from
 *    features/connect/jobs/JobComposer.tsx (open/destroyOnHidden/body scroll).
 *  - `people` are the broker's connections, hydrated by the page from
 *    network.actions `listConnections` + `getPeople`. The pickers use them.
 *  - calls createIntroduction (introductions.actions) then onCreated so the
 *    parent re-fetches the "Introductions I made" list.
 *
 * Watch: the BE runs the real guards (broker gate, both-parties-live, distinct
 * phones, dedup); the client validation here is the friendly first pass only.
 */

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { App as AntApp, Modal, Form, Input, Select } from 'antd';
import DsButton from '@/components/ui/DsButton';
import { createIntroduction } from './introductions.actions';
import type { IntroductionRole } from './introductions.types';

/** A pickable person - the broker's connection, name-hydrated by the page. */
export interface IntroducePerson {
  userId: string;
  name: string;
  avatar?: string | null;
}

interface FormValues {
  partyAUserId?: string;
  partyBUserId?: string;
  /** Which of the two picked people is the BUYER (the other is the seller). */
  buyerUserId?: string;
  note?: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  /** The broker's connections, offered in both pickers. */
  people: IntroducePerson[];
  /** Called after a successful create so the parent can refresh its list. */
  onCreated: () => void;
}

const NOTE_MAX = 500;

export default function IntroduceComposer({ open, onClose, people, onCreated }: Props) {
  const t = useTranslations('connect.introductions');
  const { message } = AntApp.useApp();
  const [form] = Form.useForm<FormValues>();
  const [submitting, setSubmitting] = useState(false);

  // Both pickers read the same connection list; the buyer/seller picker only
  // offers the two people actually picked (watched so it updates live).
  const partyA = Form.useWatch('partyAUserId', form);
  const partyB = Form.useWatch('partyBUserId', form);

  const personOptions = people.map((p) => ({ value: p.userId, label: p.name }));
  // The buyer-role picker is limited to the two chosen parties.
  const roleOptions = [partyA, partyB]
    .filter((id): id is string => !!id)
    .map((id) => ({ value: id, label: people.find((p) => p.userId === id)?.name ?? id }));

  const handleFinish = async (v: FormValues) => {
    if (!v.partyAUserId || !v.partyBUserId) return;
    if (v.partyAUserId === v.partyBUserId) {
      message.warning(t('sameParty'));
      return;
    }
    if (!v.buyerUserId) {
      message.warning(t('roleRequired'));
      return;
    }
    // roleOfA describes partyA: if partyA is the chosen buyer, roleOfA='buyer',
    // else 'seller' (the BE derives the canonical roleOfLow from this).
    const roleOfA: IntroductionRole = v.buyerUserId === v.partyAUserId ? 'buyer' : 'seller';

    setSubmitting(true);
    const res = await createIntroduction({
      partyAUserId: v.partyAUserId,
      partyBUserId: v.partyBUserId,
      roleOfA,
      note: v.note?.trim() || undefined,
    });
    setSubmitting(false);
    if (!res.ok) {
      message.error(res.error);
      return;
    }
    message.success(t('createSuccess'));
    form.resetFields();
    onCreated();
    onClose();
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      title={t('composerTitle')}
      footer={null}
      destroyOnHidden
      centered
      styles={{ body: { maxHeight: '70vh', overflowY: 'auto' } }}
    >
      <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--cr-text-3)' }}>
        {t('composerSubtitle')}
      </p>
      <Form form={form} layout="vertical" colon={false} onFinish={handleFinish} preserve={false}>
        <Form.Item
          label={t('partyALabel')}
          name="partyAUserId"
          rules={[{ required: true, message: t('partyRequired') }]}
        >
          <Select
            showSearch
            optionFilterProp="label"
            placeholder={t('partyPlaceholder')}
            options={personOptions}
            notFoundContent={t('noConnections')}
          />
        </Form.Item>

        <Form.Item
          label={t('partyBLabel')}
          name="partyBUserId"
          rules={[
            { required: true, message: t('partyRequired') },
            {
              validator: (_, value) =>
                value && value === partyA
                  ? Promise.reject(new Error(t('sameParty')))
                  : Promise.resolve(),
            },
          ]}
        >
          <Select
            showSearch
            optionFilterProp="label"
            placeholder={t('partyPlaceholder')}
            options={personOptions}
            notFoundContent={t('noConnections')}
          />
        </Form.Item>

        {/* Who is the buyer (the other is the seller). Offered only once both
            parties are picked, so the choice always maps to a real party. */}
        <Form.Item
          label={t('buyerLabel')}
          name="buyerUserId"
          extra={t('buyerHelp')}
          rules={[{ required: true, message: t('roleRequired') }]}
        >
          <Select
            placeholder={t('buyerPlaceholder')}
            options={roleOptions}
            disabled={roleOptions.length < 2}
          />
        </Form.Item>

        <Form.Item label={t('noteLabel')} name="note">
          <Input.TextArea
            rows={3}
            maxLength={NOTE_MAX}
            showCount
            placeholder={t('notePlaceholder')}
          />
        </Form.Item>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
          <DsButton dsVariant="ghost" onClick={onClose} disabled={submitting}>
            {t('cancel')}
          </DsButton>
          <DsButton dsVariant="primary" htmlType="submit" loading={submitting}>
            {t('send')}
          </DsButton>
        </div>
      </Form>
    </Modal>
  );
}
