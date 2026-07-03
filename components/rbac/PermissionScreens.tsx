'use client';

import { Button, Result } from 'antd';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';

/**
 * RBAC re-architecture F1 (design §5) - fail-closed permission screens.
 *
 * Rendered by `DashboardLayout` once the auth / app-lock gates clear:
 *  - `<PermissionsErrorScreen>` - `/me/permissions` failed to load. Full
 *    screen; the dashboard shell must never render on an unresolved
 *    permission state (a fail-open render-through was the audited bug).
 *  - `<ForbiddenScreen>` - permissions resolved but do not grant the
 *    current route. Rendered inside the content area so the sidebar stays
 *    and the user can navigate to a route they can access.
 */

export function PermissionsErrorScreen({ onRetry }: { onRetry: () => void }) {
  const t = useTranslations();
  return (
    <div className="flex min-h-screen items-center justify-center bg-page">
      <Result
        status="warning"
        title={t('permissions.loadErrorTitle')}
        subTitle={t('permissions.loadErrorBody')}
        extra={
          <Button type="primary" onClick={onRetry}>
            {t('permissions.retry')}
          </Button>
        }
      />
    </div>
  );
}

export function ForbiddenScreen() {
  const t = useTranslations();
  const router = useRouter();
  return (
    <Result
      status="403"
      title={t('permissions.forbiddenTitle')}
      subTitle={t('permissions.forbiddenBody')}
      extra={
        <Button type="primary" onClick={() => router.push('/dashboard')}>
          {t('permissions.backToDashboard')}
        </Button>
      }
    />
  );
}
