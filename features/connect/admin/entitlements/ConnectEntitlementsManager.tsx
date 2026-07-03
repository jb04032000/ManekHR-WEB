'use client';

import { useCallback, useState } from 'react';
import { App, Button, Card, Empty, Input, List, Spin, Tag } from 'antd';
import { SearchOutlined, UserOutlined } from '@ant-design/icons';
import { getAdminUsers } from '@/lib/actions/admin.actions';
import {
  getConnectEntitlements,
  setConnectEntitlementsOverride,
  clearConnectEntitlementsOverride,
} from './entitlements.actions';
import { ConnectEntitlementsPanel } from './ConnectEntitlementsPanel';
import type { AdminConnectEntitlementsView, ConnectAllowances } from './entitlements.types';

/**
 * Admin "Custom limits" screen: find any person, then view their Plan defaults vs
 * Override vs Effective Connect limits + usage and set/clear per-user overrides.
 *
 * Client-driven (search + fetch on demand) so the route stays cheap; every
 * mutation returns the refreshed view from the server, which we feed straight
 * back into the panel. Linked to: entitlements.actions.ts, ConnectEntitlementsPanel.
 */

interface UserHit {
  _id: string;
  name?: string;
  email?: string;
  mobile?: string;
}

function errorText(e: unknown): string {
  const data = (e as { response?: { data?: { message?: string; error?: { message?: string } } } })
    ?.response?.data;
  return data?.error?.message || data?.message || (e as Error)?.message || 'Something went wrong.';
}

export default function ConnectEntitlementsManager() {
  const { message } = App.useApp();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UserHit[] | null>(null);
  const [searching, setSearching] = useState(false);

  const [view, setView] = useState<AdminConnectEntitlementsView | null>(null);
  const [loadingView, setLoadingView] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const search = useCallback(
    async (q: string) => {
      const term = q.trim();
      if (!term) {
        setResults(null);
        return;
      }
      setSearching(true);
      try {
        const res = await getAdminUsers({ search: term, limit: 10 });
        setResults((res?.data ?? []) as UserHit[]);
      } catch (e) {
        message.error(errorText(e));
        setResults([]);
      } finally {
        setSearching(false);
      }
    },
    [message],
  );

  const loadUser = useCallback(async (userId: string) => {
    setLoadingView(true);
    setLoadError(null);
    setView(null);
    try {
      const v = await getConnectEntitlements(userId);
      setView(v);
    } catch (e) {
      setLoadError(errorText(e));
    } finally {
      setLoadingView(false);
    }
  }, []);

  const handleSave = useCallback(
    async (override: Partial<ConnectAllowances>) => {
      if (!view) return;
      setSaving(true);
      try {
        const v = await setConnectEntitlementsOverride(view.user.id, override);
        setView(v);
        message.success('Limits updated.');
      } catch (e) {
        message.error(errorText(e));
      } finally {
        setSaving(false);
      }
    },
    [view, message],
  );

  const handleClear = useCallback(async () => {
    if (!view) return;
    setSaving(true);
    try {
      const v = await clearConnectEntitlementsOverride(view.user.id);
      setView(v);
      message.success('Overrides cleared.');
    } catch (e) {
      message.error(errorText(e));
    } finally {
      setSaving(false);
    }
  }, [view, message]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Card styles={{ body: { padding: 16 } }}>
        <div style={{ maxWidth: 460 }}>
          <Input.Search
            placeholder="Search a person by name, email, or mobile"
            allowClear
            enterButton={<SearchOutlined />}
            loading={searching}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onSearch={search}
          />
        </div>

        {results && (
          <div style={{ marginTop: 12 }}>
            {results.length === 0 ? (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="No people match that search."
              />
            ) : (
              <List
                size="small"
                dataSource={results}
                renderItem={(u) => (
                  <List.Item
                    actions={[
                      <Button key="view" type="link" onClick={() => loadUser(u._id)}>
                        View limits
                      </Button>,
                    ]}
                  >
                    <List.Item.Meta
                      avatar={<UserOutlined />}
                      title={u.name || u.email || u.mobile || u._id}
                      description={[u.email, u.mobile].filter(Boolean).join(' · ') || u._id}
                    />
                  </List.Item>
                )}
              />
            )}
          </div>
        )}
      </Card>

      {loadingView && (
        <Card styles={{ body: { padding: 48 } }}>
          <div style={{ textAlign: 'center' }}>
            <Spin />
          </div>
        </Card>
      )}

      {loadError && !loadingView && (
        <Card styles={{ body: { padding: 24 } }}>
          <Empty description={<span>Could not load this person&apos;s limits. {loadError}</span>}>
            {view === null && (
              <Button onClick={() => results && results.length > 0 && loadUser(results[0]._id)}>
                Retry
              </Button>
            )}
          </Empty>
        </Card>
      )}

      {view && !loadingView && (
        <Card
          title={
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontWeight: 600 }}>
                {view.user.name || view.user.email || view.user.id}
              </span>
              {view.plan?.name && <Tag color="gold">{view.plan.name}</Tag>}
              {view.plan?.status && <Tag>{view.plan.status}</Tag>}
            </div>
          }
          styles={{ body: { padding: 16 } }}
        >
          <ConnectEntitlementsPanel
            view={view}
            saving={saving}
            onSave={handleSave}
            onClear={handleClear}
          />
        </Card>
      )}
    </div>
  );
}
