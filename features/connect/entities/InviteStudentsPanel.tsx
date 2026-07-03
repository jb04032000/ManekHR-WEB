'use client';

/**
 * InviteStudentsPanel - the institute manage console's "Invite students" bulk flow
 * (Institutes Phase 2, Feature 3).
 *
 * What it does: a multi-line phone box (paste numbers, one per line or comma-
 * separated) feeding a single bulk submit. On success it shows created / skipped /
 * invalid counts and, for each created invite, a "Send on WhatsApp" button built
 * with WhatsAppCTA.buildWhatsAppHref(mobile, prefillText) - a friendly invite that
 * names the institute and carries a join link (window.location.origin). A small
 * stat header shows the institute's first-touch roll-up (students joined from
 * invites + invites pending). The form IS the empty state (the CTA itself), so it
 * is also the deep-link target of every "Invite students" CTA elsewhere.
 *
 * Cross-module links: actions -> company-page.actions (bulkInviteStudents +
 * getStudentInviteSummary, both SSR-seedable; summary is also re-fetched after a
 * submit so the header reflects the new pending count). WhatsApp hand-off reuses
 * components/connect/WhatsAppCTA.buildWhatsAppHref (no bespoke wa.me logic).
 *
 * Keep in sync with: the BE BulkInviteResult + PageInviteSummary shapes
 * (entities.types) and the ManageCompanyPageScreen 'students' tab that mounts this
 * (the tab key matches the W2 invite CTA deep-link). Owner-only: the manage route
 * 404s non-owners, so no extra in-component auth.
 */

import { useCallback, useMemo, useState } from 'react';
import { App as AntApp, Card, Input, Statistic } from 'antd';
import { useTranslations } from 'next-intl';
import WhatsAppCTA from '@/components/connect/WhatsAppCTA';
import DsButton from '@/components/ui/DsButton';
import { bulkInviteStudents, getStudentInviteSummary } from './company-page.actions';
import type { BulkInviteResult, PageInviteSummary } from './entities.types';

const MAX_PHONES = 200;

interface Props {
  /** This institute page's id - the route param for the invite endpoints. */
  pageId: string;
  /** The institute's display name - woven into the WhatsApp invite prefill. */
  pageName: string;
  /** The first-touch invite roll-up, SSR-seeded by the manage route loader. */
  initialSummary: PageInviteSummary;
}

/**
 * Split a pasted blob into clean phone strings: any newline / comma / semicolon /
 * whitespace separates entries; we trim, drop empties, and de-dupe. The BE does
 * the real validation (invalid count), so this only normalizes the paste.
 */
export function parsePhones(raw: string): string[] {
  const parts = raw
    .split(/[\n,;]+/)
    .map((p) => p.trim())
    .filter(Boolean);
  return Array.from(new Set(parts));
}

export default function InviteStudentsPanel({ pageId, pageName, initialSummary }: Props) {
  const t = useTranslations('connect.companyPageAdmin');
  const { message } = AntApp.useApp();

  const [raw, setRaw] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<BulkInviteResult | null>(null);
  const [summary, setSummary] = useState<PageInviteSummary>(initialSummary);

  const phones = useMemo(() => parsePhones(raw), [raw]);
  const tooMany = phones.length > MAX_PHONES;

  /** The friendly WhatsApp invite body: names the institute + carries the join
   *  link (origin-based, so it works on whatever host the app runs on).
   *
   *  Join-link target: the canonical signed-out Connect entry,
   *  `/auth?redirect=/connect/feed` (mirrors `app/connect/layout.tsx`, which
   *  routes a signed-out Connect visitor exactly there). A signed-out student
   *  signs up and lands in the feed; a signed-in one is forwarded straight to
   *  the feed by `/auth`. We do NOT point at `/connect/invite/{token}` (no such
   *  route exists) or the ERP `/invite/{token}` accept flow (that consumes a
   *  workspace-bridge token, not a Connect student-invite token).
   *
   *  Why the token is NOT consumed by a landing page: first-touch referral
   *  attribution is event-driven + mobile-based in the BE
   *  (InstituteReferralService credits the earliest `invited` non-expired invite
   *  for the new user's mobile on first Connect onboarding). No BE endpoint
   *  reads the raw token back, so there is nothing to "preview" or "claim" on a
   *  landing page. The token rides as a harmless `it=` (invite-token) query
   *  param on a REAL route for link uniqueness / future analytics only; the
   *  credit happens automatically by mobile match regardless. Keep in sync with
   *  ConnectPageInviteService + InstituteReferralService (crewroster-backend). */
  const prefillText = useCallback(
    (token: string): string => {
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      const joinLink = `${origin}/auth?redirect=${encodeURIComponent(
        '/connect/feed',
      )}&it=${encodeURIComponent(token)}`;
      return t('invite.waPrefill', { institute: pageName, link: joinLink });
    },
    [pageName, t],
  );

  const submit = useCallback(async () => {
    if (phones.length === 0 || tooMany) return;
    setSubmitting(true);
    const res = await bulkInviteStudents(pageId, phones);
    if (!res.ok) {
      setSubmitting(false);
      message.error(res.error || t('invite.actionError'));
      return;
    }
    setResult(res.data);
    setRaw('');
    message.success(t('invite.created', { count: res.data.created }));
    // Re-pull the summary so the header reflects the new pending invites.
    const sumRes = await getStudentInviteSummary(pageId);
    if (sumRes.ok) setSummary(sumRes.data);
    setSubmitting(false);
  }, [message, pageId, phones, t, tooMany]);

  return (
    <section className="flex flex-col gap-5">
      <div>
        <h2 className="m-0 text-[16px] font-bold" style={{ color: 'var(--cr-text)' }}>
          {t('invite.title')}
        </h2>
        <p className="m-0 mt-0.5 text-[12.5px]" style={{ color: 'var(--cr-text-4)' }}>
          {t('invite.subtitle')}
        </p>
      </div>

      {/* First-touch invite roll-up. Real, BE-computed numbers (no fabrication). */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Card size="small" styles={{ body: { padding: 'var(--cr-space-md)' } }}>
          <Statistic title={t('invite.statJoined')} value={summary.joinedCount} />
        </Card>
        <Card size="small" styles={{ body: { padding: 'var(--cr-space-md)' } }}>
          <Statistic title={t('invite.statPending')} value={summary.pendingCount} />
        </Card>
      </div>

      <div
        className="flex flex-col gap-3 p-4"
        style={{
          border: '1px solid var(--cr-border)',
          borderRadius: 'var(--cr-radius-lg)',
          background: 'var(--cr-surface)',
        }}
      >
        <label
          htmlFor="cn-invite-phones"
          className="text-[12.5px] font-semibold"
          style={{ color: 'var(--cr-text-2)' }}
        >
          {t('invite.phonesLabel')}
        </label>
        <Input.TextArea
          id="cn-invite-phones"
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          placeholder={t('invite.phonesPlaceholder')}
          autoSize={{ minRows: 4, maxRows: 12 }}
          aria-describedby="cn-invite-help"
          status={tooMany ? 'error' : undefined}
        />
        <p id="cn-invite-help" className="m-0 text-[12px]" style={{ color: 'var(--cr-text-4)' }}>
          {tooMany ? t('invite.tooMany', { max: MAX_PHONES }) : t('invite.phonesHelp')}
        </p>
        <div className="flex items-center justify-between gap-3">
          <span className="text-[12px]" style={{ color: 'var(--cr-text-4)' }}>
            {t('invite.parsedCount', { count: phones.length })}
          </span>
          <DsButton
            dsVariant="primary"
            onClick={() => void submit()}
            loading={submitting}
            disabled={phones.length === 0 || tooMany}
          >
            {t('invite.submit')}
          </DsButton>
        </div>
      </div>

      {/* Per-submit result: counts + a WhatsApp hand-off per created invite. */}
      {result && (
        <div
          className="flex flex-col gap-3 p-4"
          style={{
            border: '1px solid var(--cr-border)',
            borderRadius: 'var(--cr-radius-lg)',
            background: 'var(--cr-surface)',
          }}
        >
          <p className="m-0 text-[13px]" style={{ color: 'var(--cr-text-2)' }}>
            {t('invite.resultSummary', {
              created: result.created,
              skipped: result.skipped,
              invalid: result.invalid,
            })}
          </p>

          {result.invites.length > 0 ? (
            <>
              <p className="m-0 text-[12.5px]" style={{ color: 'var(--cr-text-4)' }}>
                {t('invite.sendHint')}
              </p>
              <ul
                aria-label={t('invite.sendListAria')}
                className="m-0 flex list-none flex-col p-0"
                style={{ gap: 'var(--cr-space-xs)' }}
              >
                {result.invites.map((inv) => (
                  <li
                    key={inv.token}
                    className="flex items-center justify-between gap-3 py-2"
                    style={{ borderTop: '1px solid var(--cr-border-light)' }}
                  >
                    <span className="text-[13px]" style={{ color: 'var(--cr-text-2)' }}>
                      {inv.mobile}
                    </span>
                    {/* Reuses WhatsAppCTA (buildWhatsAppHref under the hood: strips
                        non-digits + url-encodes). A real external anchor with
                        target=_blank, NOT a DsButton (DsButton href client-routes,
                        which would break a wa.me link). */}
                    <WhatsAppCTA phone={inv.mobile} prefill={prefillText(inv.token)} size="small">
                      {t('invite.sendWhatsApp')}
                    </WhatsAppCTA>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="m-0 text-[12.5px]" style={{ color: 'var(--cr-text-4)' }}>
              {t('invite.noNewInvites')}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
