'use client';
import { useState, useEffect } from 'react';
import { App, Card, Form, InputNumber, Select, Skeleton } from 'antd';
import { useTranslations } from 'next-intl';
import { useWorkspace } from '@/hooks/useWorkspace';
import { useMyPermissions } from '@/hooks/useMyPermissions';
import {
  regularizationApi,
  getRegularizationErrorMessage,
} from '@/lib/api/modules/regularization.api';
import { teamApi } from '@/lib/api/modules/team.api';
import DsButton from '@/components/ui/DsButton';
import { DsEmptyState, InfoTooltip } from '@/components/ui';
import { FeatureGate } from '@/components/subscription/FeatureGate';
import type { TeamMember, RegularizationConfig, PaginatedResponse } from '@/types';

/**
 * Extracted from app/dashboard/attendance/settings/regularization/page.tsx
 * into a panel component for use in the unified tabbed settings page.
 */
export function RegularizationSettingsPanel() {
  const t = useTranslations('attendance.regularizationSettings');
  const tx = useTranslations('attendance.regularizationSettingsExtras');
  const tDenied = useTranslations('attendance.anomalies');
  const { message } = App.useApp();
  const { currentWorkspaceId: wsId } = useWorkspace();
  // RBAC gate - the BE regularization settings endpoints require
  // attendance.manage_regularizations (scope-agnostic, workspace-level config).
  const { canPath, data: perms, loading: permsLoading } = useMyPermissions();
  const canManage = !!perms?.isOwner || canPath('regularization.settings.manage');
  const [form] = Form.useForm<RegularizationConfig>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [members, setMembers] = useState<TeamMember[]>([]);

  useEffect(() => {
    // Do not fetch workspace config until RBAC clears it.
    if (!wsId || permsLoading || !canManage) return;
    Promise.all([regularizationApi.getSettings(wsId), teamApi.list(wsId)])
      .then(([cfg, result]) => {
        form.setFieldsValue(cfg);
        const memberList = Array.isArray(result)
          ? result
          : ((result as PaginatedResponse<TeamMember>).data ?? []);
        setMembers(memberList);
      })
      .catch((err) => {
        message.error(getRegularizationErrorMessage(err));
      })
      .finally(() => setLoading(false));
  }, [wsId, form, permsLoading, canManage]);

  const onSave = async () => {
    if (!wsId) return;
    try {
      const values = await form.validateFields();
      setSaving(true);
      await regularizationApi.updateSettings(wsId, values);
      message.success(t('alerts.saved'));
    } catch (err: unknown) {
      const anyErr = err as { response?: unknown };
      if (anyErr?.response !== undefined) {
        message.error(getRegularizationErrorMessage(err));
      }
      // Form validation errors are shown inline by Ant Design
    } finally {
      setSaving(false);
    }
  };

  if (permsLoading) {
    return (
      <div className="max-w-[42rem]">
        <Card>
          <Skeleton active paragraph={{ rows: 5 }} />
        </Card>
      </div>
    );
  }

  if (!canManage) {
    return (
      <div className="max-w-[42rem]">
        <DsEmptyState
          icon="🔒"
          title={tDenied('accessDenied.title')}
          sub={tDenied('accessDenied.message')}
        />
      </div>
    );
  }

  return (
    <FeatureGate module="regularization" subFeature="approve" as="h1">
      <div className="max-w-[42rem]">
        <Card>
          {/* The Form stays mounted even while loading so the `useForm`
            instance is always connected to a <Form> element - the fetch's
            `setFieldsValue` runs before `loading` flips false, and an
            unmounted Form would trigger antd's "not connected" warning. */}
          <Form form={form} layout="vertical" requiredMark="optional">
            {loading ? (
              <Skeleton active paragraph={{ rows: 5 }} />
            ) : (
              <>
                {/* Number of Approval Levels */}
                <Form.Item
                  name="approvalLevels"
                  label={
                    <span className="flex items-center gap-1">
                      {t('form.approvalLevels')}
                      <InfoTooltip text={t('tooltips.approvalLevels')} />
                    </span>
                  }
                  rules={[
                    {
                      required: true,
                      type: 'number',
                      min: 1,
                      max: 3,
                      message: 'Enter a value between 1 and 3',
                    },
                  ]}
                >
                  <InputNumber min={1} max={3} style={{ width: '100%' }} size="large" />
                </Form.Item>

                {/* Maximum Lookback Period */}
                <Form.Item
                  name="maxDaysBack"
                  label={
                    <span className="flex items-center gap-1">
                      {t('form.maxDaysBack')}
                      <InfoTooltip text={t('tooltips.maxDaysBack')} />
                    </span>
                  }
                  rules={[
                    {
                      required: true,
                      type: 'number',
                      min: 1,
                      max: 90,
                      message: 'Enter a value between 1 and 90',
                    },
                  ]}
                >
                  <InputNumber
                    min={1}
                    max={90}
                    size="large"
                    suffix={<span className="text-faint">days</span>}
                    style={{ width: '100%' }}
                  />
                </Form.Item>

                {/* Fallback Approver */}
                <Form.Item
                  name="fallbackApprover"
                  label={
                    <span className="flex items-center gap-1">
                      {t('form.fallbackApprover')}
                      <InfoTooltip text={t('tooltips.fallbackApprover')} />
                    </span>
                  }
                >
                  <Select
                    allowClear
                    showSearch
                    size="large"
                    placeholder={tx('fallbackApproverPlaceholder')}
                    optionFilterProp="label"
                    options={members
                      .filter((m) => m.linkedUserId)
                      .map((m) => ({ label: m.name, value: m.linkedUserId! }))}
                  />
                </Form.Item>

                {/* Maximum Attachments */}
                <Form.Item
                  name="maxAttachmentsPerRequest"
                  label={
                    <span className="flex items-center gap-1">
                      {t('form.maxAttachments')}
                      <InfoTooltip text={t('tooltips.maxAttachments')} />
                    </span>
                  }
                  rules={[
                    {
                      required: true,
                      type: 'number',
                      min: 0,
                      max: 10,
                      message: 'Enter a value between 0 and 10',
                    },
                  ]}
                >
                  <InputNumber
                    min={0}
                    max={10}
                    size="large"
                    suffix={<span className="text-faint">files</span>}
                    style={{ width: '100%' }}
                  />
                </Form.Item>

                <Form.Item className="mt-2 !mb-0">
                  <DsButton
                    dsVariant="primary"
                    dsSize="lg"
                    onClick={onSave}
                    loading={saving}
                    disabled={saving}
                  >
                    Save Settings
                  </DsButton>
                </Form.Item>
              </>
            )}
          </Form>
        </Card>
      </div>
    </FeatureGate>
  );
}
