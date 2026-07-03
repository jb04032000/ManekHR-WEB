'use client';
/**
 * RfmTuningCard - D-09 RFM threshold tuning form.
 *
 * Form with 5 numeric inputs (newWindowDays, vipRfmFloor, dormantMin,
 * dormantMax, churnedCutoff) + Save + Reset to defaults.
 *
 * RBAC: requires `manage_party_intelligence` (umbrella permission also
 * accepts `edit_rfm_thresholds` if a finer-grain key exists). Server-side
 * @RequirePermissions enforces; UI gate is defence-in-depth.
 */

import { useEffect, useState } from 'react';
import { Card, Form, InputNumber, Button, Space, message, Tooltip } from 'antd';
import { useTranslations } from 'next-intl';
import { partyIntelligenceSettingsApi } from '@/lib/api/modules/party-intelligence-settings.api';
import type { WorkspaceSettingsPartyIntelligence } from '@/types';

const DEFAULTS = {
  newWindowDays: 60,
  vipRfmFloor: 4,
  dormantMin: 91,
  dormantMax: 365,
  churnedCutoff: 365,
} as const;

interface Props {
  wsId: string;
  initial?: WorkspaceSettingsPartyIntelligence['rfmTuning'];
  permissions?: Set<string>;
  onSaved?: (next: WorkspaceSettingsPartyIntelligence) => void;
}

export default function RfmTuningCard({ wsId, initial, permissions, onSaved }: Props) {
  const t = useTranslations('party-intelligence.settings');
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);

  // RBAC permission keys consumed: manage_party_intelligence, edit_rfm_thresholds
  const canEdit =
    !permissions ||
    permissions.has('manage_party_intelligence') ||
    permissions.has('edit_rfm_thresholds');

  useEffect(() => {
    form.setFieldsValue({ ...DEFAULTS, ...(initial ?? {}) });
  }, [form, initial]);

  const handleSave = async (vals: Record<string, number>) => {
    if (!canEdit) {
      message.warning('Permission required');
      return;
    }
    setSaving(true);
    try {
      const next = await partyIntelligenceSettingsApi.updateSettings(wsId, {
        rfmTuning: {
          newWindowDays: vals.newWindowDays,
          vipRfmFloor: vals.vipRfmFloor,
          dormantMin: vals.dormantMin,
          dormantMax: vals.dormantMax,
          churnedCutoff: vals.churnedCutoff,
        },
      });
      message.success(t('rfmTuning') + ' saved');
      onSaved?.(next);
    } catch (e: unknown) {
      const err = e as { message?: string };
      message.error(err?.message ?? 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    form.setFieldsValue(DEFAULTS);
  };

  return (
    <Card title={t('rfmTuning')} size="small">
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSave}
        disabled={!canEdit}
        initialValues={DEFAULTS}
      >
        <Form.Item
          label="NEW window (days)"
          name="newWindowDays"
          tooltip="Parties created within this window are segmented as NEW"
          rules={[{ required: true, type: 'number', min: 1, max: 365 }]}
        >
          <InputNumber min={1} max={365} style={{ width: '100%' }} />
        </Form.Item>

        <Form.Item
          label="VIP RFM floor (1-5)"
          name="vipRfmFloor"
          tooltip="Minimum sum of R+F+M scores required for VIP segment"
          rules={[{ required: true, type: 'number', min: 1, max: 5 }]}
        >
          <InputNumber min={1} max={5} style={{ width: '100%' }} />
        </Form.Item>

        <Form.Item
          label="DORMANT range - min (days)"
          name="dormantMin"
          rules={[{ required: true, type: 'number', min: 1, max: 3650 }]}
        >
          <InputNumber min={1} max={3650} style={{ width: '100%' }} />
        </Form.Item>

        <Form.Item
          label="DORMANT range - max (days)"
          name="dormantMax"
          rules={[{ required: true, type: 'number', min: 1, max: 3650 }]}
        >
          <InputNumber min={1} max={3650} style={{ width: '100%' }} />
        </Form.Item>

        <Form.Item
          label="CHURNED cutoff (days)"
          name="churnedCutoff"
          tooltip="Parties with no activity beyond this cutoff are CHURNED"
          rules={[{ required: true, type: 'number', min: 1, max: 3650 }]}
        >
          <InputNumber min={1} max={3650} style={{ width: '100%' }} />
        </Form.Item>

        <Space>
          <Tooltip title={canEdit ? '' : 'Permission required'}>
            <Button type="primary" htmlType="submit" loading={saving} disabled={!canEdit}>
              Save
            </Button>
          </Tooltip>
          <Button onClick={handleReset} disabled={!canEdit}>
            Reset to defaults
          </Button>
        </Space>
      </Form>
    </Card>
  );
}
