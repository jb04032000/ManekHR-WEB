'use client';

/**
 * AddReasonModal - owner-facing modal to add a custom downtime reason code
 * (Plan 22-11 / D-02 / D-14).
 *
 * Collects only `label` + `category`. The backend auto-generates the kebab
 * `key` slug on PATCH (D-02 - keys are immutable post-create). Submission
 * delegates to the parent (DowntimeReasonsSettings) which appends the new
 * code to its local catalogue copy and ships everything in one PATCH.
 */

import { Form, Input, Select } from 'antd';
import { useTranslations } from 'next-intl';
import { DsButton, DsModal } from '@/components/ui';
import type { ReasonCategory } from '@/types';

export interface AddReasonModalProps {
  open: boolean;
  onClose: () => void;
  onAdd: (code: { label: string; category: ReasonCategory }) => void;
}

interface FormValues {
  label: string;
  category: ReasonCategory;
}

export function AddReasonModal({ open, onClose, onAdd }: AddReasonModalProps) {
  const t = useTranslations('machines-downtime');
  const [form] = Form.useForm<FormValues>();

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      onAdd({ label: values.label.trim(), category: values.category });
      form.resetFields();
      onClose();
    } catch {
      // antd shows field-level errors; nothing to do here.
    }
  };

  const handleCancel = () => {
    form.resetFields();
    onClose();
  };

  return (
    <DsModal
      open={open}
      onCancel={handleCancel}
      title={t('settings.addModal.title')}
      destroyOnHidden
      scrollable={false}
      footer={
        <div className="flex items-center justify-end gap-2">
          <DsButton dsVariant="ghost" onClick={handleCancel}>
            {t('drawer.actions.cancel')}
          </DsButton>
          <DsButton dsVariant="primary" onClick={handleSubmit}>
            {t('settings.addModal.submit')}
          </DsButton>
        </div>
      }
    >
      <Form
        form={form}
        layout="vertical"
        requiredMark={false}
        initialValues={{ category: 'mechanical' as ReasonCategory }}
      >
        <Form.Item
          label={t('settings.addModal.labelField')}
          name="label"
          rules={[{ required: true, message: t('settings.addModal.labelField') }, { max: 120 }]}
        >
          <Input maxLength={120} autoFocus size="large" />
        </Form.Item>

        <Form.Item
          label={t('settings.addModal.categoryField')}
          name="category"
          extra={t('settings.addModal.categoryHint')}
          rules={[{ required: true }]}
        >
          <Select
            size="large"
            options={[
              { value: 'mechanical', label: t('reasons.category.mechanical') },
              { value: 'operational', label: t('reasons.category.operational') },
            ]}
          />
        </Form.Item>
      </Form>
    </DsModal>
  );
}

export default AddReasonModal;
