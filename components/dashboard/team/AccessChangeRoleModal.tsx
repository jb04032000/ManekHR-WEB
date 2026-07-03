'use client';

import { useEffect, useState } from 'react';
import { Form, Modal, Select } from 'antd';
import { useTranslations } from 'next-intl';
import type { Role } from '@/types';

interface Props {
  open: boolean;
  roles: Role[];
  currentRoleId?: string;
  onCancel: () => void;
  onConfirm: (newRoleId: string) => Promise<void>;
}

/**
 * Focused role-change modal - single Select bound to workspace roles.
 *
 * The submit button stays disabled until the user picks a different role
 * (no-op submissions are pointless and would just rev a denylist TTL).
 */
export default function AccessChangeRoleModal({
  open,
  roles,
  currentRoleId,
  onCancel,
  onConfirm,
}: Props) {
  const t = useTranslations();
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [selected, setSelected] = useState<string | undefined>(currentRoleId);

  // On open, sync the controlled selection + form value to the current
  // role. Mirrors the lazy-loader pattern used elsewhere in this module
  // (see [memberId]/page.tsx top-of-file eslint-disable comment).
  useEffect(() => {
    if (open) {
       
      setSelected(currentRoleId);
      form.setFieldsValue({ rbacRoleId: currentRoleId });
    }
  }, [open, currentRoleId, form]);

  async function handleOk() {
    const values = await form.validateFields();
    if (!values.rbacRoleId || values.rbacRoleId === currentRoleId) return;
    setSubmitting(true);
    try {
      await onConfirm(values.rbacRoleId);
    } catch {
      // Parent surfaces the toast.
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      title={t('team.accessChangeRoleModalTitle')}
      // Block all dismiss paths while an inflight API call is running.
      // Matches AccessResendModal hardening (P1.8-revert.15) - no
      // half-cancelled state where the user closes the modal but the
      // request still mutates.
      onCancel={submitting ? undefined : onCancel}
      onOk={() => void handleOk()}
      okText={t('team.accessChangeRoleOk')}
      cancelText={t('common.cancel')}
      okButtonProps={{
        loading: submitting,
        disabled: !selected || selected === currentRoleId,
      }}
      cancelButtonProps={{ disabled: submitting }}
      closable={!submitting}
      mask={{ closable: !submitting }}
      keyboard={!submitting}
    >
      <Form form={form} layout="vertical" requiredMark={false}>
        <Form.Item
          label={t('team.accessChangeRoleLabel')}
          name="rbacRoleId"
          rules={[{ required: true, message: t('team.accessChangeRoleRequired') }]}
        >
          <Select
            placeholder={t('team.accessChangeRolePlaceholder')}
            onChange={(v) => setSelected(v)}
            options={roles.map((r) => ({
              value: r._id,
              label: r.name,
            }))}
          />
        </Form.Item>
      </Form>
    </Modal>
  );
}
