'use client';
/**
 * Phase 16 / FIN-15-03 - Portal Access (owner side) page shell.
 *
 * Renders the interactive token list (`TokenList`, client component);
 * IssueTokenModal + ShareModal are spawned from there. The dynamic `[id]`
 * segment is the partyId.
 *
 * RBAC gate (ADR-001 finance gap #5): the portal-access page (party portal
 * token issuance) had no permission gate. Show a skeleton while permissions
 * resolve, then wrap the body in `<Can module="finance" action="view">` -
 * owners short-circuit, a member without finance.view gets the
 * Access-Denied surface.
 */
import { useParams } from 'next/navigation';
import { Alert, Skeleton } from 'antd';
import { useTranslations } from 'next-intl';
import { useMyPermissions } from '@/hooks/useMyPermissions';
import { Can } from '@/components/rbac/Can';
import TokenList from './TokenList';

export default function PortalAccessPage() {
  const t = useTranslations('finance.portal');
  const params = useParams<{ id: string }>();
  const partyId = params?.id ?? '';
  const { loading: permissionsLoading } = useMyPermissions();

  if (permissionsLoading) {
    return <Skeleton active style={{ padding: 24 }} aria-label={t('access.permissionsLoading')} />;
  }

  return (
    <Can
      module="finance"
      action="view"
      fallback={
        <div className="flex min-h-[400px] flex-col items-center justify-center gap-4 p-6">
          <Alert
            type="error"
            showIcon
            title={t('access.accessDeniedTitle')}
            description={t('access.accessDeniedBody')}
            style={{ maxWidth: 480 }}
          />
        </div>
      }
    >
      <div style={{ padding: 24, maxWidth: 1100 }}>
        <TokenList partyId={partyId} />
      </div>
    </Can>
  );
}
