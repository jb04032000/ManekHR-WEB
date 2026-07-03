'use client';
// TODO(url-sync): Consider syncing the active tab to a URL query param (?tab=pendingForMe)
// in a future iteration for deep-linking support. Skipped for v1.
import { useState, useEffect, useCallback } from 'react';
import { App, Tabs } from 'antd';
import { FileTextOutlined } from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import { useWorkspaceStore } from '@/lib/store';
import { DsPageHeader } from '@/components/ui';
import { InfoTooltip } from '@/components/ui/InfoTooltip';
import {
  regularizationApi,
  getRegularizationErrorMessage,
} from '@/lib/api/modules/regularization.api';
import { FeatureGate } from '@/components/subscription/FeatureGate';
import { RegularizationList } from '@/components/dashboard/attendance/RegularizationList';
import { RegularizationApproveModal } from '@/components/dashboard/attendance/RegularizationApproveModal';
import type { RegularizationRequest } from '@/types';

export default function RegularizationsPage() {
  const t = useTranslations('attendance.regularizationsList');
  const wsId = useWorkspaceStore((s) => s.currentWorkspace?._id);
  const { message: msgApi } = App.useApp();
  const [activeTab, setActiveTab] = useState<'pendingForMe' | 'myRequests' | 'all'>('pendingForMe');
  const [rows, setRows] = useState<RegularizationRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<RegularizationRequest | null>(null);

  const load = useCallback(async () => {
    if (!wsId) return;
    setLoading(true);
    try {
      let data: RegularizationRequest[] = [];
      if (activeTab === 'pendingForMe') data = await regularizationApi.listPendingForMe(wsId);
      else if (activeTab === 'myRequests') data = await regularizationApi.listMyRequests(wsId);
      else data = await regularizationApi.listAll(wsId);
      setRows(data);
    } catch (err) {
      void msgApi.error(getRegularizationErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [wsId, activeTab, msgApi]);

  // Inline-async-IIFE w/ cancel flag. The `load` useCallback stays available
  // for explicit handler refresh (post-approve, post-reject).
  useEffect(() => {
    if (!wsId) return;
    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        let data: RegularizationRequest[] = [];
        if (activeTab === 'pendingForMe') data = await regularizationApi.listPendingForMe(wsId);
        else if (activeTab === 'myRequests') data = await regularizationApi.listMyRequests(wsId);
        else data = await regularizationApi.listAll(wsId);
        if (!cancelled) setRows(data);
      } catch (err) {
        if (!cancelled) void msgApi.error(getRegularizationErrorMessage(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [wsId, activeTab, msgApi]);

  return (
    <FeatureGate module="regularization" subFeature="request" as="h1">
      <div className="p-6">
        <DsPageHeader
          title={t('pageTitle')}
          icon={<FileTextOutlined />}
          right={<InfoTooltip text={t('headerExplainer')} body={t('headerExplainerBody')} />}
        />
        <Tabs
          activeKey={activeTab}
          onChange={(k) => setActiveTab(k as 'pendingForMe' | 'myRequests' | 'all')}
          items={[
            {
              key: 'pendingForMe',
              label: `Pending for me${rows.length && activeTab === 'pendingForMe' ? ` (${rows.length})` : ''}`,
            },
            { key: 'myRequests', label: 'My requests' },
            { key: 'all', label: 'All requests' },
          ]}
        />
        <RegularizationList
          rows={rows}
          loading={loading}
          mode={activeTab}
          emptyText={
            activeTab === 'pendingForMe'
              ? 'No requests awaiting your decision.'
              : activeTab === 'myRequests'
                ? 'You have not raised any regularizations yet.'
                : 'No regularizations in this workspace.'
          }
          onRowClick={(r) => {
            if (activeTab === 'pendingForMe') setSelected(r);
          }}
        />
        {selected && (
          <RegularizationApproveModal
            open={!!selected}
            request={selected}
            onClose={() => {
              setSelected(null);
              void load();
            }}
          />
        )}
      </div>
    </FeatureGate>
  );
}
