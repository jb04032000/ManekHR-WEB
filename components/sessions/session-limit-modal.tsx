'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button, Tag, Spin, message } from 'antd';
import { MobileOutlined, LaptopOutlined, DeleteOutlined } from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import { DsModal, InfoTooltip } from '@/components/ui';
import { getActiveSessions, deleteSession as deleteSessionAction } from '@/lib/actions';
import { fmt } from '@/lib/utils';
import type { SessionInfo } from '@/lib/api/modules/sessions.api';

interface SessionLimitModalProps {
  open: boolean;
  onClose: () => void;
  onTerminateAndLogin: (sessionId: string) => void;
  // When the modal opens from the unauthenticated login path (BE returned 403
  // SESSION_LIMIT_REACHED), the caller already has the session list embedded
  // in that 403 response - pass it here to skip the auth-protected fetch that
  // would otherwise 401 (and previously surfaced as a 500 from the server
  // action). When omitted, the modal falls back to fetching for callers that
  // are already authenticated (e.g. /dashboard/settings/devices).
  initialSessions?: SessionInfo[];
}

export default function SessionLimitModal({
  open,
  onClose,
  onTerminateAndLogin,
  initialSessions,
}: SessionLimitModalProps) {
  const t = useTranslations('auth');
  const [sessions, setSessions] = useState<SessionInfo[]>(initialSessions ?? []);
  const [loading, setLoading] = useState(!initialSessions);
  const [msgApi, contextHolder] = message.useMessage();

  const loadSessions = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getActiveSessions();
      setSessions(data);
    } catch {
      msgApi.error(t('sessionLimit.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [msgApi, t]);

  useEffect(() => {
    if (!open) return;
    // Defer prop-to-state sync + the data fetch into a microtask so neither
    // setState fires synchronously inside the effect body (avoids the
    // react-hooks/set-state-in-effect cascading-render warning). The
    // unauth-login branch supplies sessions on the caller's 403 response;
    // the auth branch fetches via getActiveSessions.
    let cancelled = false;
    Promise.resolve().then(() => {
      if (cancelled) return;
      if (initialSessions !== undefined) {
        setSessions(initialSessions);
        setLoading(false);
      } else {
        void loadSessions();
      }
    });
    return () => {
      cancelled = true;
    };
  }, [open, initialSessions, loadSessions]);

  const handleTerminate = async (sessionId: string) => {
    // Unauth path (caller supplied initialSessions): delegate the whole
    // terminate-then-login dance to the parent, which has the credentials and
    // hits the @Public /auth/terminate-and-login endpoint atomically. The
    // legacy authenticated path (modal opened from /dashboard/settings/devices
    // with no initialSessions) still uses deleteSession + onTerminateAndLogin
    // since the caller there is already logged in.
    if (initialSessions !== undefined) {
      onTerminateAndLogin(sessionId);
      return;
    }
    try {
      await deleteSessionAction(sessionId);
      msgApi.success(t('sessionLimit.terminated'));
      onTerminateAndLogin(sessionId);
    } catch {
      msgApi.error(t('sessionLimit.terminateFailed'));
    }
  };

  const getPlatformIcon = (platform: string) => {
    return platform === 'mobile' ? <MobileOutlined /> : <LaptopOutlined />;
  };

  return (
    <>
      {contextHolder}
      <DsModal
        title={
          <span className="flex items-center gap-2">
            {t('sessionLimit.title')}
            <InfoTooltip
              text={t('sessionLimit.tooltipText')}
              body={<p className="text-sm leading-relaxed">{t('sessionLimit.tooltipBody')}</p>}
            />
          </span>
        }
        open={open}
        onCancel={onClose}
        footer={[
          <Button key="cancel" onClick={onClose}>
            {t('sessionLimit.cancel')}
          </Button>,
        ]}
        width={600}
      >
        <p className="mb-4">{t('sessionLimit.intro')}</p>
        {loading ? (
          <div className="flex justify-center py-10">
            <Spin />
          </div>
        ) : sessions.length === 0 ? (
          <p className="py-6 text-center text-muted">{t('sessionLimit.empty')}</p>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-3 p-0">
            {sessions.map((session) => (
              <li
                key={session.id}
                className="flex items-start gap-4 rounded-lg border border-border-light bg-surface px-4 py-3"
              >
                <div className="text-xl text-muted">{getPlatformIcon(session.platform)}</div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-heading">
                      {session.deviceName || t('sessionLimit.unknownDevice')}
                    </span>
                    <Tag color={session.platform === 'mobile' ? 'blue' : 'default'}>
                      {session.platform}
                    </Tag>
                  </div>
                  <div className="mt-1 text-sm text-muted">
                    <div>
                      {t('sessionLimit.lastActive')}: {fmt(session.lastActiveAt)}
                    </div>
                    {session.location && (
                      <div>
                        {t('sessionLimit.location')}: {session.location}
                      </div>
                    )}
                    {session.ipAddress && (
                      <div>
                        {t('sessionLimit.ipAddress')}: {session.ipAddress}
                      </div>
                    )}
                  </div>
                </div>
                <Button
                  type="text"
                  danger
                  icon={<DeleteOutlined />}
                  onClick={() => handleTerminate(session.id)}
                >
                  {t('sessionLimit.terminateButton')}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </DsModal>
    </>
  );
}
