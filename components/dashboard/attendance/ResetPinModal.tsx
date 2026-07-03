'use client';

import { useState } from 'react';
import { App, Modal, Form, Input } from 'antd';
import { useTranslations } from 'next-intl';
import { setMemberKioskPin } from '@/lib/actions/kiosk.actions';

interface Props {
  open: boolean;
  onClose: () => void;
  wsId: string;
  memberId: string;
  memberName: string;
  onSuccess: () => void;
}

export function ResetPinModal({ open, onClose, wsId, memberId, memberName, onSuccess }: Props) {
  const t = useTranslations('attendance.resetPin');
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);

  const handleOk = async () => {
    let values: { pin: string };
    try {
      values = await form.validateFields();
    } catch {
      return;
    }
    setSubmitting(true);
    try {
      await setMemberKioskPin(wsId, memberId, values.pin);
      message.success(t('successToast', { name: memberName }));
      form.resetFields();
      onSuccess();
      onClose();
    } catch (e: unknown) {
      const err = e as { message?: string } | null;
      message.error(err?.message ?? t('failToast'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = () => {
    form.resetFields();
    onClose();
  };

  return (
    <Modal
      title={t('titleFor', { name: memberName })}
      open={open}
      onOk={handleOk}
      onCancel={handleCancel}
      confirmLoading={submitting}
      okText={t('okText')}
      mask={{ closable: false }}
    >
      <Form form={form} layout="vertical">
        <Form.Item
          name="pin"
          label={t('pinLabel')}
          rules={[
            { required: true, message: t('validationRequired') },
            { pattern: /^\d{4}$/, message: t('validationFormat') },
          ]}
        >
          <Input.Password
            maxLength={4}
            inputMode="numeric"
            autoComplete="off"
            placeholder={t('pinPlaceholder')}
          />
        </Form.Item>
        <p style={{ color: '#666', fontSize: 12 }}>{t('disclaimer')}</p>
      </Form>
    </Modal>
  );
}
