'use client';
import { useState } from 'react';
import { App, Card, Switch } from 'antd';
import { useTranslations } from 'next-intl';
import { useWorkspaceStore } from '@/lib/store';
import { workspacesApi } from '@/lib/api/modules/workspaces.api';
import { parseApiError } from '@/lib/utils';
import DsButton from '@/components/ui/DsButton';

/**
 * Access Control Initiative §8 Part B - workspace self-service policy.
 *
 * Owner-facing toggles that gate the employee self-service surfaces. The
 * matching `selfServiceConfig` lives on the Workspace document and is
 * persisted through the generic workspace `PATCH` (workspaces.edit gated).
 *
 * Extracted from app/dashboard/attendance/settings/self-service/page.tsx
 * into a panel component for use in the unified tabbed settings page.
 */
export function SelfServiceSettingsPanel() {
  const t = useTranslations('attendance.selfServiceSettings');
  const { message } = App.useApp();
  const { currentWorkspaceId, currentWorkspace } = useWorkspaceStore();
  const [selfPunch, setSelfPunch] = useState(
    () => !!currentWorkspace?.selfServiceConfig?.selfPunch,
  );
  const [selfLeaveApply, setSelfLeaveApply] = useState(
    () => !!currentWorkspace?.selfServiceConfig?.selfLeaveApply,
  );
  const [saving, setSaving] = useState(false);

  const onSave = async () => {
    if (!currentWorkspaceId) return;
    setSaving(true);
    try {
      await workspacesApi.update(currentWorkspaceId, {
        selfServiceConfig: {
          selfPunch,
          selfLeaveApply,
        },
      });
      message.success(t('saved'));
    } catch (e) {
      message.error(parseApiError(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-[42rem]">
      <Card>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="m-0 text-[14px] font-semibold text-gray-900">{t('selfPunchLabel')}</p>
            <p className="mt-1 mb-0 text-[13px] text-gray-700">{t('selfPunchHint')}</p>
          </div>
          <Switch checked={selfPunch} onChange={setSelfPunch} aria-label={t('selfPunchLabel')} />
        </div>

        <div
          className="mt-5 flex items-start justify-between gap-4 border-0 border-t border-solid pt-5"
          style={{ borderColor: 'var(--cr-border-light)' }}
        >
          <div className="min-w-0">
            <p className="m-0 text-[14px] font-semibold text-gray-900">
              {t('selfLeaveApplyLabel')}
            </p>
            <p className="mt-1 mb-0 text-[13px] text-gray-700">{t('selfLeaveApplyHint')}</p>
          </div>
          <Switch
            checked={selfLeaveApply}
            onChange={setSelfLeaveApply}
            aria-label={t('selfLeaveApplyLabel')}
          />
        </div>

        <div className="mt-6">
          <DsButton
            dsVariant="primary"
            dsSize="lg"
            onClick={onSave}
            loading={saving}
            disabled={saving}
          >
            {t('save')}
          </DsButton>
        </div>
      </Card>
    </div>
  );
}
