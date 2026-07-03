'use client';
import { useState } from 'react';
import { App, Modal, Form, Input } from 'antd';
import { useTranslations } from 'next-intl';
import { voidAttendanceEvent } from '@/lib/actions/attendance.actions';

interface Props {
  open: boolean;
  onClose: () => void;
  wsId: string;
  eventId: string;
  eventDescription?: string; // e.g. "CHECK_IN at 09:32"
  onSuccess: () => void;
}

export function VoidEventModal({
  open,
  onClose,
  wsId,
  eventId,
  eventDescription,
  onSuccess,
}: Props) {
  const t = useTranslations('attendance.voidEventModal');
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);

  const handleOk = async () => {
    const v = await form.validateFields();
    setSubmitting(true);
    try {
      await voidAttendanceEvent(wsId, eventId, v.reason.trim());
      message.success(t('successToast'));
      form.resetFields();
      onSuccess();
      onClose();
    } catch (e: unknown) {
      const errMsg = e instanceof Error ? e.message : t('failToast');
      message.error(errMsg);
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
      title={t('title')}
      open={open}
      onOk={handleOk}
      onCancel={handleCancel}
      confirmLoading={submitting}
      okText={t('okText')}
      okButtonProps={{ danger: true }}
    >
      {eventDescription && <p style={{ marginBottom: 12, color: '#666' }}>{eventDescription}</p>}
      <Form form={form} layout="vertical">
        <Form.Item
          name="reason"
          label={t('reasonLabel')}
          rules={[
            { required: true, message: t('validationReasonRequired') },
            { min: 3, message: t('validationReasonMin') },
            { max: 280, message: t('validationReasonMax') },
          ]}
        >
          <Input.TextArea rows={3} maxLength={280} showCount />
        </Form.Item>
      </Form>
    </Modal>
  );
}
