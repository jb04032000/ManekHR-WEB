'use client';

/**
 * Phase 16 / FIN-15-03 - Portal Access Token list (client component).
 *
 * Per UI-SPEC §Portal Access (Owner side):
 *   • Page header "Portal Access - {partyName}"
 *   • Primary CTA "Generate Token" → IssueTokenModal
 *   • Secondary CTA "Revoke all tokens" (only when ≥1 active token)
 *   • Empty state heading "No active tokens" + body copy
 *   • Per-token DsCard rows (NOT DsTable - token rows have rich meta)
 *   • Token-expiry color encoding (5 states: >30d, 7-30d, 0-7d, expired, revoked)
 *   • Optimistic UI on issue + revoke (server confirmation reconciles)
 *
 * Sub-feature gate: useFeatureAccess('finance', 'finance_advanced') -
 * locked => read-only with "Upgrade" pill (UI-SPEC §Color).
 *
 * The party context (name / phone / email) is loaded via `listParties`
 * filtered by the `firm` query param. The page link emitted from the
 * parties browser carries `?firm={firmId}` - see
 * `app/dashboard/finance/firms/[firmId]/parties/page.tsx` "Generate
 * portal link" action (Task 2).
 *
 * Threat-model (Plan 16-06c):
 *   T-16-06c-01 - Token URL never console.logged (only ShareModal renders
 *     it; clipboard write goes through navigator.clipboard).
 *   T-16-06c-03 - useFeatureAccess('finance','finance_advanced') gates UI;
 *     backend SubscriptionGuard authoritative.
 */
import { useEffect, useMemo, useState, startTransition } from 'react';
import { useSearchParams } from 'next/navigation';
import { Alert, Modal, Popconfirm, Spin, Tooltip, message } from 'antd';
import { useTranslations } from 'next-intl';
import { DsButton, DsCard, DsTag } from '@/components/ui';
import { useWorkspaceStore } from '@/lib/store';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import { listParties } from '@/lib/actions/finance.actions';
import { portalTokensApi } from '@/lib/api/modules/portal-tokens.api';
import type { Party, PortalToken, IssueTokenResult } from '@/types';
import IssueTokenModal from './IssueTokenModal';
import ShareModal from './ShareModal';

type ExpiryBucket = 'far' | 'warning' | 'critical' | 'expired' | 'revoked';

function bucketize(token: PortalToken): ExpiryBucket {
  if (token.revokedAt) return 'revoked';
  const now = Date.now();
  const exp = new Date(token.expiresAt).getTime();
  if (isNaN(exp)) return 'far';
  const days = (exp - now) / (1000 * 60 * 60 * 24);
  if (days < 0) return 'expired';
  if (days <= 7) return 'critical';
  if (days <= 30) return 'warning';
  return 'far';
}

function formatDate(iso?: string): string {
  if (!iso) return '-';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// View-only portal (owner decision 2026-06-06, feedback_no_payments_in_billing):
// no 'pay' scope. Maps a scope to its i18n key under finance.portal.access;
// unknown/legacy scopes fall back to the raw string in render.
const SCOPE_LABEL_KEY: Record<string, string> = {
  statement: 'scopeStatement',
  invoices: 'scopeInvoices',
  receipts: 'scopeReceipts',
};

export default function TokenList({ partyId }: { partyId: string }) {
  const t = useTranslations('finance.portal');
  const { currentWorkspace } = useWorkspaceStore();
  const wsId = currentWorkspace?._id ?? '';
  const searchParams = useSearchParams();
  const firmIdHint = searchParams?.get('firm') ?? '';

  const access = useFeatureAccess('finance', 'finance_advanced');
  const isLocked = access.isLocked;

  const [party, setParty] = useState<Party | null>(null);
  const [tokens, setTokens] = useState<PortalToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [issueOpen, setIssueOpen] = useState(false);
  const [shareTarget, setShareTarget] = useState<{
    jti: string;
    url: string;
  } | null>(null);
  const [bulkRevokeOpen, setBulkRevokeOpen] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [renderNow] = useState(() => Date.now());

  // Load party + tokens
  useEffect(() => {
    if (!wsId || !firmIdHint || !partyId) {
      startTransition(() => {
        setLoading(false);
      });
      return;
    }
    let cancelled = false;
    startTransition(() => {
      setLoading(true);
    });
    Promise.all([
      listParties(wsId, firmIdHint).then(
        (r) => (r?.items ?? []).find((p) => p._id === partyId) ?? null,
      ),
      portalTokensApi.list(wsId, partyId),
    ])
      .then(([p, t]) => {
        if (cancelled) return;
        setParty(p);
        setTokens(t ?? []);
      })
      .catch(() => {
        if (cancelled) return;
        message.error(t('access.loadTokensError'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [wsId, firmIdHint, partyId]);

  const activeTokens = useMemo(
    () => tokens.filter((t) => !t.revokedAt && new Date(t.expiresAt).getTime() > renderNow),
    [tokens, renderNow],
  );

  const partyName = party?.name ?? t('access.partyFallback');

  function refreshTokens() {
    if (!wsId || !partyId) return;
    portalTokensApi
      .list(wsId, partyId)
      .then((t) => setTokens(t ?? []))
      .catch(() => {});
  }

  async function handleIssued(result: IssueTokenResult) {
    setIssueOpen(false);
    // Optimistic: prepend a synthesized row; reconciled by refresh.
    setShareTarget({ jti: result.jti, url: result.url });
    refreshTokens();
  }

  async function handleRevoke(jti: string) {
    // Optimistic
    setTokens((prev) =>
      prev.map((t) => (t.jti === jti ? { ...t, revokedAt: new Date().toISOString() } : t)),
    );
    try {
      await portalTokensApi.revoke(wsId, partyId, jti);
      message.success(t('access.revokeSuccess'));
    } catch {
      message.error(t('access.revokeError'));
    } finally {
      refreshTokens();
    }
  }

  async function handleBulkRevoke() {
    setBulkBusy(true);
    try {
      await portalTokensApi.revokeAll(wsId, partyId);
      message.success(t('access.bulkRevokeSuccess'));
      setBulkRevokeOpen(false);
      refreshTokens();
    } catch {
      message.error(t('access.bulkRevokeError'));
    } finally {
      setBulkBusy(false);
    }
  }

  // ---------- Render ----------

  if (!firmIdHint) {
    return (
      <Alert
        type="warning"
        showIcon
        title={t('access.missingFirmTitle')}
        description={t('access.missingFirmBody')}
      />
    );
  }

  return (
    <div>
      {/* Page header */}
      <div style={{ marginBottom: 32 /* xl */ }}>
        <h1
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 22,
            fontWeight: 700,
            lineHeight: 1.2,
            margin: 0,
            color: 'var(--cr-text)',
          }}
        >
          {t('access.headerTitle', { partyName })}
        </h1>
        <p
          style={{
            margin: '8px 0 0',
            fontSize: 14,
            color: 'var(--cr-text-3)',
            lineHeight: 1.5,
          }}
        >
          {t('access.headerSubtitle')}
        </p>
      </div>

      {isLocked && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          title={t('access.upgradeTitle')}
          description={t('access.upgradeBody')}
        />
      )}

      {/* Action bar */}
      <div
        style={{
          display: 'flex',
          gap: 8,
          alignItems: 'center',
          marginBottom: 16 /* md */,
        }}
      >
        <DsButton type="primary" disabled={isLocked} onClick={() => setIssueOpen(true)}>
          {t('access.generateToken')}
        </DsButton>
        {activeTokens.length > 0 && (
          <DsButton danger disabled={isLocked} onClick={() => setBulkRevokeOpen(true)}>
            {t('access.revokeAll')}
          </DsButton>
        )}
      </div>

      {loading ? (
        <div style={{ padding: 48, textAlign: 'center' }}>
          <Spin />
        </div>
      ) : tokens.length === 0 ? (
        <DsCard>
          <div style={{ padding: 32, textAlign: 'center' }}>
            <h3
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 18,
                fontWeight: 600,
                margin: 0,
                color: 'var(--cr-text)',
              }}
            >
              {t('access.emptyHeading')}
            </h3>
            <p
              style={{
                margin: '8px 0 0',
                fontSize: 14,
                color: 'var(--cr-text-3)',
                lineHeight: 1.5,
              }}
            >
              {t('access.emptyBody')}
            </p>
          </div>
        </DsCard>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {tokens.map((token) => (
            <TokenRow
              key={token.jti}
              token={token}
              isLocked={isLocked}
              onRevoke={() => handleRevoke(token.jti)}
            />
          ))}
        </div>
      )}

      {issueOpen && (
        <IssueTokenModal
          open={issueOpen}
          partyId={partyId}
          partyName={partyName}
          onCancel={() => setIssueOpen(false)}
          onIssued={handleIssued}
        />
      )}

      {shareTarget && party && (
        <ShareModal
          open={!!shareTarget}
          jti={shareTarget.jti}
          url={shareTarget.url}
          party={party}
          onClose={() => setShareTarget(null)}
        />
      )}

      <Modal
        open={bulkRevokeOpen}
        title={t('access.bulkRevokeTitle', { count: activeTokens.length })}
        onOk={handleBulkRevoke}
        onCancel={() => setBulkRevokeOpen(false)}
        okText={t('access.bulkRevokeOk')}
        okButtonProps={{ danger: true, loading: bulkBusy }}
      >
        <p>{t('access.bulkRevokeBody', { partyName })}</p>
      </Modal>
    </div>
  );
}

function TokenRow({
  token,
  isLocked,
  onRevoke,
}: {
  token: PortalToken;
  isLocked: boolean;
  onRevoke: () => void;
}) {
  const t = useTranslations('finance.portal');
  const bucket = bucketize(token);
  const expiryStyle = expiryStyleFor(bucket);

  return (
    <DsCard>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr)) auto',
          gap: 16,
          alignItems: 'center',
          padding: 4,
        }}
      >
        <Meta label={t('access.metaIssued')} value={formatDate(token.issuedAt)} />
        <Meta
          label={t('access.metaExpires')}
          value={
            <span style={{ color: expiryStyle.color, fontWeight: 500 }}>
              {bucket === 'expired' ? (
                <span style={{ textDecoration: 'line-through' }}>
                  {formatDate(token.expiresAt)}
                </span>
              ) : (
                formatDate(token.expiresAt)
              )}
              {bucket === 'critical' && (
                <span
                  aria-hidden
                  style={{
                    display: 'inline-block',
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: 'var(--cr-error)',
                    marginLeft: 6,
                    verticalAlign: 'middle',
                  }}
                />
              )}
            </span>
          }
          chip={expiryStyle.chip}
        />
        <Meta label={t('access.metaLastAccessed')} value={formatDate(token.lastAccessedAt)} />
        <Meta label={t('access.metaViews')} value={String(token.accessCount ?? 0)} />
        <Meta
          label={t('access.metaScope')}
          value={
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {(token.scope ?? []).map((s) => (
                <DsTag key={s}>{SCOPE_LABEL_KEY[s] ? t(`access.${SCOPE_LABEL_KEY[s]}`) : s}</DsTag>
              ))}
            </div>
          }
        />
        <div style={{ textAlign: 'right' }}>
          {token.revokedAt ? (
            <DsTag>{t('access.statusRevoked')}</DsTag>
          ) : bucket === 'expired' ? (
            <DsTag>{t('access.statusExpired')}</DsTag>
          ) : (
            <Popconfirm
              title={t('access.revokeConfirmTitle')}
              description={<span>{t('access.revokeConfirmBody')}</span>}
              okText={t('access.revokeConfirmOk')}
              okButtonProps={{ danger: true }}
              onConfirm={onRevoke}
              disabled={isLocked}
            >
              <DsButton danger dsSize="sm" disabled={isLocked}>
                {t('access.revoke')}
              </DsButton>
            </Popconfirm>
          )}
        </div>
      </div>
    </DsCard>
  );
}

function Meta({
  label,
  value,
  chip,
}: {
  label: string;
  value: React.ReactNode;
  chip?: { bg: string; color: string };
}) {
  return (
    <div>
      <div
        className="cr-label"
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          color: 'var(--cr-text-3)',
          marginBottom: 4,
        }}
      >
        {label.toUpperCase()}
      </div>
      <div style={{ fontSize: 14, color: 'var(--cr-text)' }}>
        {chip ? (
          <span
            style={{
              display: 'inline-block',
              padding: '2px 8px',
              borderRadius: 4,
              background: chip.bg,
              color: chip.color,
            }}
          >
            {value}
          </span>
        ) : (
          value
        )}
      </div>
    </div>
  );
}

function expiryStyleFor(bucket: ExpiryBucket): {
  color: string;
  chip?: { bg: string; color: string };
} {
  switch (bucket) {
    case 'far':
      return { color: 'var(--cr-text-3)' };
    case 'warning':
      return {
        color: 'var(--cr-warning)',
        chip: {
          bg: 'var(--cr-warning-bg)',
          color: 'var(--cr-warning)',
        },
      };
    case 'critical':
      return {
        color: 'var(--cr-error)',
        chip: {
          bg: 'var(--cr-error-bg)',
          color: 'var(--cr-error)',
        },
      };
    case 'expired':
      return {
        color: 'var(--cr-text-faint)',
        chip: {
          bg: 'var(--cr-error-bg)',
          color: 'var(--cr-text-faint)',
        },
      };
    case 'revoked':
      return {
        color: 'var(--cr-text-faint)',
        chip: {
          bg: 'var(--cr-surface-2)',
          color: 'var(--cr-text-faint)',
        },
      };
  }
}
