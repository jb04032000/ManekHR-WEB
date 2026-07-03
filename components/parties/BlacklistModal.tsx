'use client';
/**
 * BlacklistModal - Phase 17 / D-04. Switches between Blacklist and Unblacklist
 * modes based on `currentlyBlacklisted` prop.
 */

import { useState } from 'react';
import { Modal, Form, Input, message } from 'antd';
import { useTranslations } from 'next-intl';
import { partyIntelligenceApi } from '@/lib/api/modules/parties.api';

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  wsId: string;
  partyId: string;
  currentlyBlacklisted: boolean;
  currentReason?: string;
}

export default function BlacklistModal({
  open,
  onClose,
  onSaved,
  wsId,
  partyId,
  currentlyBlacklisted,
  currentReason,
}: Props) {
  const t = useTranslations('party-intelligence');
  const [form] = Form.useForm<{ reason: string }>();
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    setSaving(true);
    try {
      if (currentlyBlacklisted) {
        await partyIntelligenceApi.clearBlacklist(wsId, partyId);
        message.success('Removed from blacklist');
      } else {
        const values = await form.validateFields();
        await partyIntelligenceApi.setBlacklist(wsId, partyId, values.reason);
        message.success('Party blacklisted');
      }
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
      title={currentlyBlacklisted ? t('actions.unblacklist') : t('actions.blacklist')}
      confirmLoading={saving}
      okText={currentlyBlacklisted ? t('actions.unblacklist') : t('actions.blacklist')}
      destroyOnHidden
    >
      {currentlyBlacklisted ? (
        <div>
          <p>Remove this party from the blacklist?</p>
          {currentReason ? (
            <p style={{ color: 'var(--cr-text-3)' }}>Current reason: {currentReason}</p>
          ) : null}
        </div>
      ) : (
        <Form form={form} layout="vertical">
          <Form.Item
            label="Reason"
            name="reason"
            rules={[
              { required: true, message: 'Reason is required' },
              { max: 500, message: 'Max 500 characters' },
            ]}
          >
            <Input.TextArea rows={4} maxLength={500} showCount />
          </Form.Item>
        </Form>
      )}
    </Modal>
  );
}
