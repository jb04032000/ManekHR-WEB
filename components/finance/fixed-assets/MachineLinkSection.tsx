'use client';
import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import { AutoComplete, Alert, Typography, message } from 'antd';
import { LinkOutlined, DisconnectOutlined } from '@ant-design/icons';
import DsButton from '@/components/ui/DsButton';
import { linkMachine, unlinkMachine } from '@/lib/actions/finance-fixed-assets.actions';
import { useWorkspaceStore } from '@/lib/store';

interface Machine {
  _id: string;
  name: string;
  machineCode?: string;
  status?: string;
}

interface MachineLinkSectionProps {
  assetId: string;
  firmId: string;
  currentMachineId?: string;
  currentMachine?: Machine | null;
  onChange: () => void;
}

export default function MachineLinkSection({
  assetId,
  firmId,
  currentMachineId,
  currentMachine,
  onChange,
}: MachineLinkSectionProps) {
  const t = useTranslations('finance.fixedAssets.actions.machine');
  const wsId = useWorkspaceStore((s) => s.currentWorkspace?._id ?? '');
  const [loading, setLoading] = useState(false);
  const [conflictError, setConflictError] = useState<string | null>(null);
  const [machineSearch, setMachineSearch] = useState('');

  const handleUnlink = async () => {
    setLoading(true);
    try {
      await unlinkMachine(wsId, firmId, assetId);
      message.success(t('unlinked'));
      onChange();
    } catch {
      message.error(t('unlinkFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleLink = async (machineId: string) => {
    if (!machineId) return;
    setConflictError(null);
    setLoading(true);
    try {
      await linkMachine(wsId, firmId, assetId, machineId);
      message.success(t('linked'));
      setMachineSearch('');
      onChange();
    } catch (err: unknown) {
      const anyErr = err as { response?: { data?: { message?: string } } };
      const msg = anyErr?.response?.data?.message ?? t('linkFailed');
      setConflictError(msg);
    } finally {
      setLoading(false);
    }
  };

  if (currentMachineId && currentMachine) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '8px 12px',
            background: 'var(--cr-surface-2)',
            borderRadius: 8,
            border: '1px solid var(--cr-border-light)',
          }}
        >
          <div>
            <Typography.Text strong>{currentMachine.name}</Typography.Text>
            {currentMachine.machineCode && (
              <Typography.Text type="secondary" style={{ marginLeft: 8, fontSize: 12 }}>
                {currentMachine.machineCode}
              </Typography.Text>
            )}
            {currentMachine.status && (
              <Typography.Text type="secondary" style={{ marginLeft: 8, fontSize: 12 }}>
                ({currentMachine.status})
              </Typography.Text>
            )}
          </div>
          <DsButton
            dsVariant="ghost"
            dsSize="sm"
            icon={<DisconnectOutlined />}
            loading={loading}
            onClick={handleUnlink}
          >
            {t('unlink')}
          </DsButton>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {conflictError && (
        <Alert
          type="error"
          title={conflictError}
          showIcon
          closable
          onClose={() => setConflictError(null)}
        />
      )}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <AutoComplete
          style={{ flex: 1 }}
          placeholder={t('searchPlaceholder')}
          value={machineSearch}
          onChange={setMachineSearch}
          // Options are populated externally; for now accept any typed ID
          options={[]}
          onSelect={(val) => handleLink(val)}
          allowClear
        />
        <DsButton
          dsVariant="primary"
          dsSize="sm"
          icon={<LinkOutlined />}
          loading={loading}
          onClick={() => handleLink(machineSearch)}
          disabled={!machineSearch}
        >
          {t('link')}
        </DsButton>
      </div>
      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
        {t('helper')}
      </Typography.Text>
    </div>
  );
}
