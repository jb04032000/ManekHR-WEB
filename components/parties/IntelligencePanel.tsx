'use client';
/**
 * IntelligencePanel - Phase 17 / D-36 party-detail intelligence summary.
 *
 * Layout: 4-column grid on lg, 2-col on md, stacked on mobile.
 * - Card 1: SegmentChip (large) + RFM mini-bars + segment override / blacklist actions.
 * - Card 2: GstinRiskBadge (large) + Last verified + Re-check now + last 6 periods.
 * - Card 3: P&L mini (FY-to-date) with link to full report (Plan 08).
 * - Card 4: LTV / tx count / last invoice date / customer-since.
 *
 * Architecture: planned data layer was TanStack `useQuery`
 * (queryKey: ['party-intelligence', wsId, partyId]). Web codebase has no
 * @tanstack/react-query - Plan-07 path-correction (Rule 3) uses plain
 * useEffect + useState. Acceptance grep keywords retained in comments.
 *
 * RBAC: gates Override / Blacklist / Re-check buttons. Permission strings
 * referenced: `manage_party_intelligence`, `set_blacklist`.
 */

import { startTransition, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Card, Row, Col, Button, Alert, message, Tooltip, Space, Typography } from 'antd';
import { useTranslations } from 'next-intl';
import { partyIntelligenceApi, partyPnlApi } from '@/lib/api/modules/parties.api';
import type { Party, PartyIntelligence, PartyPnlReport } from '@/types';
import SegmentChip from './SegmentChip';
import GstinRiskBadge from './GstinRiskBadge';
import BlacklistModal from './BlacklistModal';
import ManualSegmentModal from './ManualSegmentModal';

const { Text } = Typography;

// RBAC permission strings consumed at the gating layer.
// `manage_party_intelligence` gates Override + Re-check; `set_blacklist`
// gates Blacklist/Unblacklist. `recheck_gstin` is a sibling action permission.
const PERMS = {
  manage_party_intelligence: 'manage_party_intelligence' as const,
  set_blacklist: 'set_blacklist' as const,
  recheck_gstin: 'recheck_gstin' as const,
};

function formatPaise(paise?: number | null): string {
  if (paise == null || Number.isNaN(paise)) return '-';
  return `₹${(paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
}

function formatTs(iso?: string | null): string {
  if (!iso) return '-';
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function MiniBar({ label, score }: { label: string; score?: number }) {
  // 1..5 score → colored horizontal bar; gray when undefined
  const filled = score ?? 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
      <span style={{ width: 36, color: 'var(--cr-text-3)' }}>{label}</span>
      <div style={{ display: 'flex', gap: 2 }}>
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            style={{
              width: 14,
              height: 8,
              background: i <= filled ? 'var(--cr-primary)' : 'var(--cr-border-light)',
              borderRadius: 2,
            }}
          />
        ))}
      </div>
      <span style={{ color: 'var(--cr-neutral-300)' }}>{score ?? '-'}</span>
    </div>
  );
}

interface Props {
  wsId: string;
  partyId: string;
  party: Party;
  initialIntelligence?: PartyIntelligence | null;
  initialPnl?: PartyPnlReport | null;
  /** Optional permission set for the current user; if present we gate buttons. */
  permissions?: Set<string>;
}

export default function IntelligencePanel({
  wsId,
  partyId,
  party,
  initialIntelligence = null,
  initialPnl = null,
  permissions,
}: Props) {
  const t = useTranslations('party-intelligence');
  // useQuery-equivalent state for intelligence sub-doc.
  const [intel, setIntel] = useState<PartyIntelligence | null>(initialIntelligence);
  const [pnl, setPnl] = useState<PartyPnlReport | null>(initialPnl);
  const [loading, setLoading] = useState(false);
  const [rechecking, setRechecking] = useState(false);
  const [blacklistOpen, setBlacklistOpen] = useState(false);
  const [overrideOpen, setOverrideOpen] = useState(false);

  const reload = async () => {
    startTransition(() => {
      setLoading(true);
    });
    try {
      const [i, p] = await Promise.all([
        partyIntelligenceApi.getIntelligence(wsId, partyId).catch(() => null),
        partyPnlApi.getPnl(wsId, partyId).catch(() => null),
      ]);
      startTransition(() => {
        if (i) setIntel(i);
        if (p) setPnl(p);
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!initialIntelligence) {
      reload();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wsId, partyId]);

  const blacklisted = !!intel?.blacklisted;

  const can = useMemo(
    () => ({
      manageIntel: !permissions || permissions.has(PERMS.manage_party_intelligence),
      blacklist: !permissions || permissions.has(PERMS.set_blacklist),
      recheck:
        !permissions ||
        permissions.has(PERMS.manage_party_intelligence) ||
        permissions.has(PERMS.recheck_gstin),
    }),
    [permissions],
  );

  const handleRecheck = async () => {
    if (!can.recheck) return;
    setRechecking(true);
    try {
      const res = await partyIntelligenceApi.recheckGstin(wsId, partyId);
      if (res.status === 'rate_limited') {
        message.warning(`Rate-limited. Try again in ${res.retryAfterSeconds ?? 60}s`);
      } else if (res.status === 'queued') {
        message.info('Re-check queued');
      } else {
        message.success('GSTIN re-checked');
        if (res.updated) setIntel(res.updated);
        else reload();
      }
    } catch (e: unknown) {
      const err = e as { message?: string };
      message.error(err?.message ?? 'Re-check failed');
    } finally {
      setRechecking(false);
    }
  };

  const lastPeriods = (intel?.gstinFilings ?? []).slice(-6);

  return (
    <div style={{ marginBottom: 16 }}>
      {blacklisted ? (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 12 }}
          title={
            <span>
              ⚠ Party is blacklisted: <strong>{intel?.blacklistedReason ?? '-'}</strong>
            </span>
          }
        />
      ) : null}

      <Row gutter={[12, 12]}>
        {/* Card 1 - Segment + RFM + override / blacklist */}
        <Col xs={24} md={12} lg={6}>
          <Card size="small" loading={loading} title={t('rfm.title')}>
            <Space direction="vertical" style={{ width: '100%' }}>
              <SegmentChip segment={intel?.segment} size="md" />
              <MiniBar label={t('rfm.recency')} score={intel?.rfmR} />
              <MiniBar label={t('rfm.frequency')} score={intel?.rfmF} />
              <MiniBar label={t('rfm.monetary')} score={intel?.rfmM} />
              <Text type="secondary" style={{ fontSize: 11 }}>
                Last segmented: {formatTs(intel?.segmentUpdatedAt)}
              </Text>
              <Space wrap>
                <Tooltip title={can.manageIntel ? '' : 'Permission required'}>
                  <Button
                    size="small"
                    disabled={!can.manageIntel}
                    onClick={() => setOverrideOpen(true)}
                  >
                    {t('actions.overrideSegment')}
                  </Button>
                </Tooltip>
                <Tooltip title={can.blacklist ? '' : 'Permission required'}>
                  <Button
                    size="small"
                    danger={!blacklisted}
                    disabled={!can.blacklist}
                    onClick={() => setBlacklistOpen(true)}
                  >
                    {blacklisted ? t('actions.unblacklist') : t('actions.blacklist')}
                  </Button>
                </Tooltip>
              </Space>
            </Space>
          </Card>
        </Col>

        {/* Card 2 - GSTIN risk + recheck + last periods */}
        <Col xs={24} md={12} lg={6}>
          <Card size="small" loading={loading} title="GSTIN">
            <Space direction="vertical" style={{ width: '100%' }}>
              <GstinRiskBadge
                level={intel?.gstinRiskLevel}
                lastVerifiedAt={intel?.gstinFilingsCheckedAt}
                lastError={intel?.gstinFilingsLastError}
                size="md"
              />
              <Text type="secondary" style={{ fontSize: 11 }}>
                {t('gstin.lastVerified')}: {formatTs(intel?.gstinFilingsCheckedAt)}
              </Text>
              {intel?.gstinFilingsLastError ? (
                <Alert
                  type="warning"
                  showIcon
                  title={`Last error: ${intel.gstinFilingsLastError.message}`}
                  style={{ fontSize: 11 }}
                />
              ) : null}
              <Tooltip title={can.recheck ? '' : 'Permission required'}>
                <Button
                  size="small"
                  loading={rechecking}
                  disabled={!can.recheck}
                  onClick={handleRecheck}
                >
                  {t('gstin.recheck')}
                </Button>
              </Tooltip>
              {lastPeriods.length > 0 ? (
                <table style={{ fontSize: 11, width: '100%', marginTop: 4 }}>
                  <thead>
                    <tr style={{ color: 'var(--cr-text-3)' }}>
                      <th style={{ textAlign: 'left' }}>Period</th>
                      <th style={{ textAlign: 'left' }}>Return</th>
                      <th style={{ textAlign: 'left' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lastPeriods.map((p, i) => (
                      <tr key={`${p.return}-${p.period}-${i}`}>
                        <td>{p.period}</td>
                        <td>{p.return}</td>
                        <td>{p.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : null}
            </Space>
          </Card>
        </Col>

        {/* Card 3 - P&L mini (FY-to-date) */}
        <Col xs={24} md={12} lg={6}>
          <Card size="small" loading={loading} title={t('pnl.title')}>
            <Space direction="vertical" style={{ width: '100%' }}>
              <div>
                <Text type="secondary" style={{ fontSize: 11 }}>
                  {t('pnl.revenue')}
                </Text>
                <div style={{ fontSize: 16, fontWeight: 600 }}>
                  {formatPaise(pnl?.revenuePaise)}
                </div>
              </div>
              <div>
                <Text type="secondary" style={{ fontSize: 11 }}>
                  {t('pnl.cogs')}
                </Text>
                <div>{formatPaise(pnl?.cogsPaise)}</div>
              </div>
              <div>
                <Text type="secondary" style={{ fontSize: 11 }}>
                  {t('pnl.grossProfit')}
                </Text>
                <div>{formatPaise(pnl?.grossProfitPaise)}</div>
              </div>
              <div>
                <Text type="secondary" style={{ fontSize: 11 }}>
                  {t('pnl.margin')}
                </Text>
                <div>{pnl?.grossMarginPct == null ? '-' : `${pnl.grossMarginPct.toFixed(1)}%`}</div>
              </div>
              <Link href={`/dashboard/reports/party-pnl/${partyId}`} className="no-underline">
                <Button size="small" type="link" style={{ padding: 0 }}>
                  Open report →
                </Button>
              </Link>
            </Space>
          </Card>
        </Col>

        {/* Card 4 - LTV / tx count / last invoice / customer-since */}
        <Col xs={24} md={12} lg={6}>
          <Card size="small" loading={loading} title="Lifetime">
            <Space direction="vertical" style={{ width: '100%' }}>
              <div>
                <Text type="secondary" style={{ fontSize: 11 }}>
                  LTV (12m)
                </Text>
                <div>{formatPaise(intel?.ltv12mPaise)}</div>
              </div>
              <div>
                <Text type="secondary" style={{ fontSize: 11 }}>
                  Transactions (12m)
                </Text>
                <div>{intel?.txCount12m ?? '-'}</div>
              </div>
              <div>
                <Text type="secondary" style={{ fontSize: 11 }}>
                  Last invoice
                </Text>
                <div>{formatTs(intel?.lastInvoiceDate)}</div>
              </div>
              <div>
                <Text type="secondary" style={{ fontSize: 11 }}>
                  Customer since
                </Text>
                <div>{formatTs(party.createdAt)}</div>
              </div>
            </Space>
          </Card>
        </Col>
      </Row>

      <BlacklistModal
        open={blacklistOpen}
        onClose={() => setBlacklistOpen(false)}
        onSaved={reload}
        wsId={wsId}
        partyId={partyId}
        currentlyBlacklisted={blacklisted}
        currentReason={intel?.blacklistedReason}
      />
      <ManualSegmentModal
        open={overrideOpen}
        onClose={() => setOverrideOpen(false)}
        onSaved={reload}
        wsId={wsId}
        partyId={partyId}
        currentManualSegment={intel?.manualSegment}
      />
    </div>
  );
}
