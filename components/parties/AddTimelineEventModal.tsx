'use client';
/**
 * AddTimelineEventModal - Phase 17 / D-20.
 * Manual entry: call.logged | email.logged | note.added.
 */

import { useState } from 'react';
import { Modal, Form, Input, Radio, Collapse, message } from 'antd';
import { useTranslations } from 'next-intl';
import { partyTimelineApi } from '@/lib/api/modules/parties.api';

type ManualType = 'call.logged' | 'email.logged' | 'note.added';

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  wsId: string;
  partyId: string;
}

export default function AddTimelineEventModal({ open, onClose, onSaved, wsId, partyId }: Props) {
  const t = useTranslations('party-intelligence.timeline');
  const [form] = Form.useForm<{ type: ManualType; summary: string; meta?: string }>();
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      let parsedMeta: Record<string, unknown> | undefined;
      if (values.meta && values.meta.trim()) {
        try {
          parsedMeta = JSON.parse(values.meta) as Record<string, unknown>;
        } catch {
          message.error('Meta must be valid JSON');
          setSaving(false);
          return;
        }
      }
      await partyTimelineApi.createTimelineEvent(wsId, partyId, {
        type: values.type,
        summary: values.summary,
        meta: parsedMeta,
      });
      message.success('Entry added');
      onSaved();
      onClose();
      form.resetFields();
    } catch (e: unknown) {
      const err = e as { message?: string };
      if (err?.message) message.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      onOk={handleSubmit}
      title={t('addNote')}
      confirmLoading={saving}
      destroyOnHidden
    >
      <Form form={form} layout="vertical" initialValues={{ type: 'note.added' }}>
        <Form.Item label="Type" name="type" rules={[{ required: true }]}>
          <Radio.Group>
            <Radio value="call.logged">{t('addCall')}</Radio>
            <Radio value="email.logged">{t('addEmail')}</Radio>
            <Radio value="note.added">{t('addNote')}</Radio>
          </Radio.Group>
        </Form.Item>
        <Form.Item
          label="Summary"
          name="summary"
          rules={[
            { required: true, message: 'Summary is required' },
            { max: 500, message: 'Max 500 characters' },
          ]}
        >
          <Input.TextArea rows={3} maxLength={500} showCount />
        </Form.Item>
        <Collapse
          ghost
          items={[
            {
              key: 'adv',
              label: 'Advanced',
              children: (
                <Form.Item label="Meta (JSON)" name="meta">
                  <Input.TextArea rows={3} placeholder='{"key": "value"}' />
                </Form.Item>
              ),
            },
          ]}
        />
      </Form>
    </Modal>
  );
}
