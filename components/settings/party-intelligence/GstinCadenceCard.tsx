'use client';
/**
 * GstinCadenceCard - gstinPollCadenceDays (1-30, default 7).
 *
 * Backend cron currently runs weekly (D-11). This setting is informational
 * for a future scheduling enhancement - help text documents that.
 */

import { useEffect, useState } from 'react';
import { Card, Form, InputNumber, Button, Space, message, Tooltip, Alert } from 'antd';
import { useTranslations } from 'next-intl';
import { partyIntelligenceSettingsApi } from '@/lib/api/modules/party-intelligence-settings.api';
import type { WorkspaceSettingsPartyIntelligence } from '@/types';

interface Props {
  wsId: string;
  initial?: number;
  permissions?: Set<string>;
  onSaved?: (next: WorkspaceSettingsPartyIntelligence) => void;
}

export default function GstinCadenceCard({ wsId, initial = 7, permissions, onSaved }: Props) {
  const t = useTranslations('party-intelligence.settings');
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);

  const canEdit = !permissions || permissions.has('manage_party_intelligence');

  useEffect(() => {
    form.setFieldsValue({ gstinPollCadenceDays: initial });
  }, [form, initial]);

  const handleSave = async (vals: { gstinPollCadenceDays: number }) => {
    if (!canEdit) {
      message.warning('Permission required');
      return;
    }
    setSaving(true);
    try {
      const next = await partyIntelligenceSettingsApi.updateSettings(wsId, {
        gstinPollCadenceDays: vals.gstinPollCadenceDays,
      });
      message.success('GSTIN cadence saved');
      onSaved?.(next);
    } catch (e: unknown) {
      const err = e as { message?: string };
      message.error(err?.message ?? 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card title={t('gstinCadence')} size="small">
      <Alert
        type="info"
        showIcon
        title="Cadence currently fixed at 7 days. Custom cadence support coming soon."
        style={{ marginBottom: 12 }}
      />
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSave}
        disabled={!canEdit}
        initialValues={{ gstinPollCadenceDays: initial }}
      >
        <Form.Item
          label="GSTIN poll cadence (days)"
          name="gstinPollCadenceDays"
          rules={[{ required: true, type: 'number', min: 1, max: 30 }]}
        >
          <InputNumber min={1} max={30} style={{ width: '100%' }} />
        </Form.Item>
        <Space>
          <Tooltip title={canEdit ? '' : 'Permission required'}>
            <Button type="primary" htmlType="submit" loading={saving} disabled={!canEdit}>
              Save
            </Button>
          </Tooltip>
        </Space>
      </Form>
    </Card>
  );
}
