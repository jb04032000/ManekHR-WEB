'use client';

/**
 * RFQ detail, rebuilt 2026-06-10 to the owner prototype. Two faces:
 *  - Buyer (owns the RFQ): the request card + the compare list of received
 *    quotes (decline / shortlist / accept), and a close control.
 *  - Seller (anyone else): the request card + the structured quote composer
 *    (rate calculator, includes, validity, samples, quote-as) with a live
 *    "Where your price sits" bar, buyer track-record card, and win tips.
 * Every signal is REAL: the price bar uses the buyer's stated budget + the
 * anonymized live-quote spread (BE getRfq quoteStats); the buyer card counts
 * come from this board's own data (rfqsPosted / rfqsAwarded). No fabricated
 * ratings / reply times / verification badges, and NO WhatsApp handoff - the
 * in-app Inbox opens once a quote is accepted (mediator model).
 *
 * Cross-module links:
 * - app/connect/rfq/[id]/page.tsx resolves buyer identity (network getPeople)
 *   + the seller's storefronts and passes them in.
 * - QuoteComposer streams its live total up via onTotalChange -> the bar.
 * - StartConversationButton (inbox) appears on accepted quotes only.
 */

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { message } from 'antd';
import {
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  Clock,
  FileText,
  Image as ImageIcon,
  IndianRupee,
  Layers,
  MapPin,
  Send,
  ShieldCheck,
  Truck,
  Zap,
} from 'lucide-react';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import DsButton from '@/components/ui/DsButton';
import { ConnectPage, ConnectRightRail, RailPanel } from '@/components/connect';
import useAnnouncer from '@/components/connect/useAnnouncer';
import { parseApiError } from '@/lib/utils';
import QuoteCard from './QuoteCard';
import QuoteComposer from './QuoteComposer';
import StartConversationButton from '@/features/connect/inbox/StartConversationButton';
import PromotedListingAdCard, {
  type PromotedListingResolved,
} from '@/features/connect/marketplace/PromotedListingAdCard';
// Mobile inline ad: the ConnectRightRail (boost + Google slot) is hidden below
// xl, so render the same inventory in the content column for phone/tablet.
import MobileAdInline from '@/features/connect/ads/MobileAdInline';
import { categoryLabel } from '../search.types';
import { ConnectEvents, trackEvent } from '@/lib/analytics-events';
import type { Storefront } from '../entities/entities.types';
import type { RfqBuyerRef } from './useBoardBuyers';
import {
  acceptQuote,
  closeRfq,
  declineQuote,
  shortlistQuote,
  submitQuote,
  withdrawQuote,
} from './rfq.actions';
import type { RfqDetail, Quote, CreateQuotePayload } from './rfq.types';

dayjs.extend(relativeTime);

function rupees(n: number): string {
  return `₹${n.toLocaleString('en-IN')}`;
}

const CLOSING_SOON_DAYS = 3;

interface Props {
  rfq: RfqDetail;
  isBuyer: boolean;
  /** Buyer view: all quotes on the RFQ. Empty for sellers. */
  quotes: Quote[];
  /** Seller view: the caller's own quote on this RFQ, if any. */
  myQuote: Quote | null;
  /** The buyer's resolved identity (name + avatar via getPeople). */
  buyer?: RfqBuyerRef | null;
  /** Seller view: the viewer's storefronts for the quote-as picker. */
  storefronts?: Storefront[];
  /** First-party promoted listing for the right rail (own ad engine; null = none). */
  promoted?: PromotedListingResolved | null;
  /** Validated board URL (tab + filters) the viewer arrived from. When present,
   *  "Back to board" returns to this exact origin instead of a history guess -
   *  fixes Back landing on a fixed tab. Resolved/whitelisted in the route. */
  backHref?: string;
}

export default function RfqDetailScreen({
  rfq: initialRfq,
  isBuyer,
  quotes,
  myQuote,
  buyer,
  storefronts = [],
  promoted = null,
  backHref,
}: Props) {
  const t = useTranslations('connect.rfq');
  const tInbox = useTranslations('connect.inbox');
  const tCat = useTranslations('connect.search.listing.category');
  const router = useRouter();
  const [msgApi, ctx] = message.useMessage();
  const { announce, announcer } = useAnnouncer();

  const [rfq, setRfq] = useState(initialRfq);
  const [quoteList, setQuoteList] = useState(quotes);
  const [mine, setMine] = useState<Quote | null>(myQuote);
  const [busy, setBusy] = useState(false);
  // The composer's live total drives the price-bar marker before submitting.
  const [liveTotal, setLiveTotal] = useState<number | null>(myQuote?.price ?? null);

  // Additive funnel telemetry: rfqViewed once per RFQ open (top of the seller
  // quote funnel). Empty deps + stable initialRfq._id = fires once on mount.
  // Keyless-safe sink, carries only the rfqId.
  useEffect(() => {
    trackEvent(ConnectEvents.rfqViewed, { rfqId: initialRfq._id });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const notifySuccess = (text: string) => {
    void msgApi.success(text);
    announce(text);
  };
  const notifyError = (text: string) => {
    msgApi.error(text);
    announce(text, { assertive: true });
  };

  const isOpen = rfq.status === 'open';

  const budget =
    rfq.budgetMin != null && rfq.budgetMax != null
      ? `${rupees(rfq.budgetMin)} - ${rupees(rfq.budgetMax)}`
      : rfq.budgetMin != null
        ? rupees(rfq.budgetMin)
        : rfq.budgetMax != null
          ? rupees(rfq.budgetMax)
          : null;
  const location = [rfq.location?.district, rfq.location?.city, rfq.location?.state]
    .filter(Boolean)
    .join(', ');

  // Closes-in label from the real neededBy (mirrors RfqCard).
  const daysLeft =
    isOpen && rfq.neededBy
      ? dayjs(rfq.neededBy).startOf('day').diff(dayjs().startOf('day'), 'day')
      : null;
  const closingSoon = daysLeft != null && daysLeft >= 0 && daysLeft <= CLOSING_SOON_DAYS;
  const closesLabel =
    daysLeft == null || daysLeft < 0
      ? null
      : daysLeft === 0
        ? t('closesToday')
        : daysLeft === 1
          ? t('closesTomorrow')
          : t('closesInDays', { count: daysLeft });

  const statusTone = closingSoon
    ? { bg: 'var(--cr-warning-bg)', fg: 'var(--cr-warning)', label: t('closingSoon') }
    : rfq.status === 'open'
      ? { bg: 'var(--cr-success-bg)', fg: 'var(--cr-success)', label: t('status.open') }
      : rfq.status === 'awarded'
        ? { bg: 'var(--cr-primary-light)', fg: 'var(--cr-primary)', label: t('status.awarded') }
        : { bg: 'var(--cr-surface-3)', fg: 'var(--cr-text-4)', label: t('status.closed') };

  // Human reference code derived from REAL fields (created year + id tail) -
  // a stable handle for phone/WhatsApp conversations about the request.
  const refCode = `RFQ-${dayjs(rfq.createdAt ?? undefined).format('YYYY')}-${rfq._id.slice(-4).toUpperCase()}`;

  // ── price-positioning scale (seller rail) ─────────────────────────
  // Built ONLY from real numbers: buyer budget bounds + the anonymized live
  // quote spread + the seller's own in-progress total. Hidden when none exist.
  const bar = useMemo(() => {
    const { low, high, count } = rfq.quoteStats;
    const points = [rfq.budgetMin, rfq.budgetMax, low, high, liveTotal].filter(
      (n): n is number => n != null && n > 0,
    );
    if (points.length === 0) return null;
    const min = Math.min(...points);
    const max = Math.max(...points);
    const pad = Math.max((max - min) * 0.15, max * 0.05);
    const lo = Math.max(0, min - pad);
    const hi = max + pad;
    const pct = (n: number) => Math.max(0, Math.min(100, ((n - lo) / (hi - lo)) * 100));
    return {
      scaleLo: lo,
      scaleHi: hi,
      pct,
      budget:
        rfq.budgetMin != null || rfq.budgetMax != null
          ? { from: pct(rfq.budgetMin ?? lo), to: pct(rfq.budgetMax ?? hi) }
          : null,
      spread: low != null && high != null ? { from: pct(low), to: pct(high) } : null,
      you: liveTotal != null ? pct(liveTotal) : null,
      count,
      low,
      high,
    };
  }, [rfq.quoteStats, rfq.budgetMin, rfq.budgetMax, liveTotal]);

  // ── buyer actions (unchanged mechanics) ────────────────────────────
  const handleClose = async () => {
    setBusy(true);
    try {
      const res = await closeRfq(rfq._id);
      if (!res.ok) return notifyError(res.error);
      setRfq((r) => ({ ...r, status: res.data.status }));
      notifySuccess(t('closedSuccess'));
    } catch (e) {
      msgApi.error(parseApiError(e));
    } finally {
      setBusy(false);
    }
  };

  const handleAccept = async (quoteId: string) => {
    setBusy(true);
    try {
      const res = await acceptQuote(quoteId);
      if (!res.ok) return notifyError(res.error);
      setRfq((r) => ({ ...r, status: 'awarded' }));
      setQuoteList((list) =>
        list.map((q) =>
          q._id === quoteId ? { ...q, status: 'accepted' } : { ...q, status: 'declined' },
        ),
      );
      notifySuccess(t('acceptedSuccess'));
    } catch (e) {
      msgApi.error(parseApiError(e));
    } finally {
      setBusy(false);
    }
  };

  /** Buyer marks a finalist (sent -> shortlisted). */
  const handleShortlist = async (quoteId: string) => {
    setBusy(true);
    try {
      const res = await shortlistQuote(quoteId);
      if (!res.ok) return notifyError(res.error);
      setQuoteList((list) =>
        list.map((q) => (q._id === quoteId ? { ...q, status: 'shortlisted' } : q)),
      );
      notifySuccess(t('shortlistedSuccess'));
    } catch (e) {
      msgApi.error(parseApiError(e));
    } finally {
      setBusy(false);
    }
  };

  /** Buyer declines a live quote (sent/shortlisted -> declined). */
  const handleDecline = async (quoteId: string) => {
    setBusy(true);
    try {
      const res = await declineQuote(quoteId);
      if (!res.ok) return notifyError(res.error);
      setQuoteList((list) =>
        list.map((q) => (q._id === quoteId ? { ...q, status: 'declined' } : q)),
      );
      notifySuccess(t('declinedSuccess'));
    } catch (e) {
      msgApi.error(parseApiError(e));
    } finally {
      setBusy(false);
    }
  };

  const handleSubmitQuote = async (payload: CreateQuotePayload) => {
    setBusy(true);
    try {
      const res = await submitQuote(rfq._id, payload);
      if (!res.ok) return notifyError(res.error);
      // Optimistic local update keeps the user's place (no route refresh).
      setMine(res.data);
      notifySuccess(t('quoteSentSuccess'));
    } catch (e) {
      msgApi.error(parseApiError(e));
    } finally {
      setBusy(false);
    }
  };

  const handleWithdraw = async () => {
    if (!mine) return;
    setBusy(true);
    try {
      const res = await withdrawQuote(mine._id);
      if (!res.ok) return notifyError(res.error);
      setMine(res.data);
      notifySuccess(t('withdrawnSuccess'));
    } catch (e) {
      msgApi.error(parseApiError(e));
    } finally {
      setBusy(false);
    }
  };

  const buyerInitial = buyer?.name?.trim()?.charAt(0)?.toUpperCase() || '?';

  // History-aware back (canonical pattern, mirrors JobDetailScreen.goBack):
  // real back when there is in-app history; the board when opened directly or
  // from an external link (a shared URL), so back never leaves the app.
  const goBack = () => {
    // Origin board URL carried in via `?from=` (validated in the route): push
    // straight to it so the exact tab + filters are restored. history.back()
    // alone landed on a fixed tab because the board mirrors tab state via
    // history.replaceState, which the App Router cache does not track.
    if (backHref) {
      router.push(backHref);
      return;
    }
    let cameFromExternal = false;
    try {
      const ref = document.referrer;
      cameFromExternal = ref !== '' && new URL(ref).origin !== window.location.origin;
    } catch {
      cameFromExternal = false;
    }
    if (window.history.length > 1 && !cameFromExternal) router.back();
    else router.push('/connect/rfq');
  };

  // One key-fact cell of the request card's facts strip.
  const fact = (icon: React.ReactNode, label: string, value: React.ReactNode) => (
    <div className="p-3" style={{ background: 'var(--cr-surface)' }}>
      <div
        className="flex items-center gap-1.5 text-[10px] font-bold tracking-wide uppercase"
        style={{ color: 'var(--cr-text-5)' }}
      >
        {icon} {label}
      </div>
      <div
        className="mt-1 text-[13.5px] leading-snug font-bold"
        style={{ color: 'var(--cr-text)', fontVariantNumeric: 'tabular-nums' }}
      >
        {value}
      </div>
    </div>
  );

  return (
    <ConnectPage className="flex gap-5">
      <main className="min-w-0 flex-1">
        {ctx}
        {announcer}

        {/* Back: the platform's plain history-aware control, above the header
            (same anatomy as the jobs detail page). */}
        <button
          type="button"
          onClick={goBack}
          className="mb-2 inline-flex w-fit cursor-pointer items-center gap-1 border-0 bg-transparent p-0 text-[13px]"
          style={{ color: 'var(--cr-primary)' }}
        >
          <ChevronLeft size={15} aria-hidden /> {t('backToBoard')}
        </button>

        <div className="mb-3">
          <h1 className="m-0 text-[20px] font-bold" style={{ color: 'var(--cr-text)' }}>
            {isBuyer ? t('detail.buyerTitle') : t('detail.sellerTitle')}
          </h1>
          <p className="m-0 mt-0.5 text-[12.5px]" style={{ color: 'var(--cr-text-4)' }}>
            {isBuyer ? t('detail.buyerLede') : t('detail.sellerLede')}
          </p>
        </div>

        {/* ── request card ── */}
        <section
          className="overflow-hidden"
          style={{
            background: 'var(--cr-surface)',
            border: '1px solid var(--cr-border)',
            borderRadius: 'var(--cr-radius-lg)',
          }}
        >
          {/* top strip: status / category / ref code / deadline */}
          <div
            className="flex flex-wrap items-center gap-2 border-b px-4 py-2.5"
            style={{ background: 'var(--cr-surface-2)', borderColor: 'var(--cr-divider)' }}
          >
            <span
              className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold"
              style={{ background: statusTone.bg, color: statusTone.fg }}
            >
              {statusTone.label}
            </span>
            <span
              className="rounded-full px-2.5 py-0.5 text-[11px] font-bold"
              style={{ background: 'var(--cr-accent-light)', color: 'var(--cr-gold-700)' }}
            >
              {categoryLabel(rfq.category, tCat)}
            </span>
            <span
              className="font-mono text-[11px]"
              style={{ color: 'var(--cr-text-4)' }}
              title={t('detail.refCode')}
            >
              {refCode}
            </span>
            {closesLabel && (
              <span
                className="ms-auto inline-flex items-center gap-1.5 text-[12px] font-semibold"
                style={{ color: closingSoon ? 'var(--cr-warning)' : 'var(--cr-text-3)' }}
              >
                <Clock size={13} aria-hidden /> {closesLabel}
              </span>
            )}
          </div>

          <div className="p-4 sm:p-5">
            <h2
              className="m-0 text-[20px] leading-snug font-bold"
              style={{ color: 'var(--cr-text)' }}
            >
              {rfq.title}
            </h2>

            {/* buyer row (resolved identity; persons carry no badges) */}
            {buyer && (
              <div className="mt-2.5 flex items-center gap-2.5">
                {buyer.avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element -- small avatar, remote URL
                  <img
                    src={buyer.avatar}
                    alt=""
                    aria-hidden
                    className="h-9 w-9 shrink-0 rounded-[var(--cr-radius-md)] object-cover"
                  />
                ) : (
                  <span
                    aria-hidden
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-[var(--cr-radius-md)] text-[13px] font-bold"
                    style={{ background: 'var(--cr-primary-light)', color: 'var(--cr-primary)' }}
                  >
                    {buyerInitial}
                  </span>
                )}
                <div className="min-w-0">
                  <div className="text-[13px] font-bold" style={{ color: 'var(--cr-text)' }}>
                    {buyer.name}
                  </div>
                  <div
                    className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11.5px]"
                    style={{ color: 'var(--cr-text-4)' }}
                  >
                    {location && (
                      <span className="inline-flex items-center gap-1">
                        <MapPin size={11} aria-hidden /> {location}
                      </span>
                    )}
                    {rfq.createdAt && (
                      <span>{t('postedAgo', { when: dayjs(rfq.createdAt).fromNow() })}</span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* key-facts strip */}
            <div
              className="mt-4 grid grid-cols-2 gap-px overflow-hidden sm:grid-cols-4"
              style={{
                background: 'var(--cr-divider)',
                border: '1px solid var(--cr-divider)',
                borderRadius: 'var(--cr-radius-md)',
              }}
            >
              {fact(
                <Layers size={12} aria-hidden />,
                t('detail.factQuantity'),
                rfq.quantity != null ? (
                  <>
                    {rfq.quantity}{' '}
                    <small
                      className="text-[11px] font-semibold"
                      style={{ color: 'var(--cr-text-4)' }}
                    >
                      {/* Localized bare unit noun (connect.rfq.unit.<slug>). */}
                      {rfq.unit ? t(`unit.${rfq.unit}`) : ''}
                    </small>
                  </>
                ) : (
                  '-'
                ),
              )}
              {fact(
                <IndianRupee size={12} aria-hidden />,
                t('budgetTerm'),
                <span style={{ color: budget ? 'var(--cr-primary)' : undefined }}>
                  {budget ?? t('negotiable')}
                </span>,
              )}
              {fact(
                <Truck size={12} aria-hidden />,
                t('detail.factDeliverTo'),
                rfq.location?.district || rfq.location?.city || '-',
              )}
              {fact(
                <CalendarDays size={12} aria-hidden />,
                t('neededByTerm'),
                rfq.neededBy ? dayjs(rfq.neededBy).format('D MMM YYYY') : '-',
              )}
            </div>

            {/* requirement */}
            {rfq.description && (
              <div className="mt-4">
                <h3
                  className="m-0 mb-1.5 text-[11px] font-bold tracking-wide uppercase"
                  style={{ color: 'var(--cr-text-5)' }}
                >
                  {t('detail.requirement')}
                </h3>
                <p
                  className="m-0 text-[13.5px] leading-relaxed whitespace-pre-wrap"
                  style={{ color: 'var(--cr-text-2)' }}
                >
                  {rfq.description}
                </p>
              </div>
            )}

            {isBuyer && isOpen && (
              <div className="mt-4 flex justify-end">
                <DsButton dsVariant="ghost" onClick={handleClose} loading={busy}>
                  {t('closeRequest')}
                </DsButton>
              </div>
            )}
          </div>
        </section>

        {/* ── Buyer: compare quotes ── */}
        {isBuyer && (
          <section className="mt-5">
            <h2 className="m-0 mb-3 text-[16px] font-bold" style={{ color: 'var(--cr-text)' }}>
              {t('quotesHeading', { count: quoteList.length })}
            </h2>
            {quoteList.length === 0 ? (
              <p className="m-0 text-[13px]" style={{ color: 'var(--cr-text-4)' }}>
                {t('noQuotesYet')}
              </p>
            ) : (
              <ul className="m-0 grid list-none gap-3 p-0">
                {quoteList.map((q) => (
                  <li key={q._id}>
                    <QuoteCard
                      quote={q}
                      actions={
                        isOpen && (q.status === 'sent' || q.status === 'shortlisted') ? (
                          <>
                            <DsButton
                              dsVariant="ghost"
                              onClick={() => handleDecline(q._id)}
                              loading={busy}
                            >
                              {t('declineQuote')}
                            </DsButton>
                            {q.status === 'sent' && (
                              <DsButton
                                dsVariant="secondary"
                                onClick={() => handleShortlist(q._id)}
                                loading={busy}
                              >
                                {t('shortlistQuote')}
                              </DsButton>
                            )}
                            <DsButton
                              dsVariant="primary"
                              onClick={() => handleAccept(q._id)}
                              loading={busy}
                            >
                              {t('acceptQuote')}
                            </DsButton>
                          </>
                        ) : q.status === 'accepted' ? (
                          <StartConversationButton
                            recipientUserId={q.sellerUserId}
                            context={{ type: 'Quote', id: q._id }}
                            label={tInbox('start.messageSeller')}
                          />
                        ) : undefined
                      }
                    />
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {/* ── Seller: your quote ── */}
        {!isBuyer && (
          <section
            className="mt-5 overflow-hidden"
            style={{
              background: 'var(--cr-surface)',
              border: '1px solid var(--cr-border)',
              borderRadius: 'var(--cr-radius-lg)',
            }}
          >
            <div
              className="flex items-center gap-3 border-b px-4 py-3"
              style={{ borderColor: 'var(--cr-divider)' }}
            >
              <span
                aria-hidden
                className="grid h-9 w-9 shrink-0 place-items-center rounded-[var(--cr-radius-md)]"
                style={{ background: 'var(--cr-primary)', color: '#fff' }}
              >
                <Send size={17} aria-hidden />
              </span>
              <div className="min-w-0">
                <h2 className="m-0 text-[15px] font-bold" style={{ color: 'var(--cr-text)' }}>
                  {mine ? t('yourQuoteHeading') : t('quoteHeading')}
                </h2>
                {buyer && (
                  <p className="m-0 mt-0.5 text-[11.5px]" style={{ color: 'var(--cr-text-4)' }}>
                    {t('detail.sentTo', { name: buyer.name })}
                  </p>
                )}
              </div>
            </div>

            <div className="p-4 sm:p-5">
              {!isOpen && !mine ? (
                <p className="m-0 text-[13px]" style={{ color: 'var(--cr-text-4)' }}>
                  {t('rfqNotOpen')}
                </p>
              ) : (
                <>
                  {mine && (
                    <div className="mb-4">
                      <QuoteCard
                        quote={mine}
                        actions={
                          mine.status === 'sent' || mine.status === 'shortlisted' ? (
                            <DsButton dsVariant="ghost" onClick={handleWithdraw} loading={busy}>
                              {t('withdrawQuote')}
                            </DsButton>
                          ) : mine.status === 'accepted' ? (
                            <StartConversationButton
                              recipientUserId={rfq.buyerUserId}
                              context={{ type: 'Quote', id: mine._id }}
                              label={tInbox('start.messageBuyer')}
                            />
                          ) : undefined
                        }
                      />
                      {mine.status === 'withdrawn' && (
                        <p className="mt-2 mb-0 text-[13px]" style={{ color: 'var(--cr-text-4)' }}>
                          {t('quoteWithdrawnHint')}
                        </p>
                      )}
                    </div>
                  )}
                  {isOpen && mine?.status !== 'accepted' && (
                    <QuoteComposer
                      rfq={rfq}
                      initial={mine?.status === 'withdrawn' ? null : mine}
                      storefronts={storefronts}
                      submitting={busy}
                      onSubmit={handleSubmitQuote}
                      onTotalChange={setLiveTotal}
                    />
                  )}
                </>
              )}
            </div>
          </section>
        )}

        {/* Mobile-only ad (same boost + Google slot as the rail, which is hidden below xl). */}
        <MobileAdInline promoted={promoted} />
      </main>

      <ConnectRightRail>
        {/* First-party promoted listing (own ad engine, placement rfq_detail).
            The Google AdSlots ride ConnectRightRail itself (connect.right.*). */}
        {promoted && <PromotedListingAdCard {...promoted} />}

        {/* ── price positioning (seller, real numbers only) ── */}
        {!isBuyer && bar && (
          <RailPanel title={t('priceBar.title')}>
            <p className="m-0 mb-3 text-[11px]" style={{ color: 'var(--cr-text-4)' }}>
              {t('priceBar.quotesSoFar', { count: bar.count })}
            </p>
            <div
              className="relative mt-7 mb-2 h-2 rounded-full"
              style={{ background: 'var(--cr-surface-3)' }}
            >
              {bar.budget && (
                <span
                  className="absolute top-0 bottom-0 rounded-full"
                  style={{
                    left: `${bar.budget.from}%`,
                    right: `${100 - bar.budget.to}%`,
                    background: 'var(--cr-success-bg)',
                  }}
                />
              )}
              {bar.spread && (
                <span
                  className="absolute top-1/2 h-[3px] -translate-y-1/2"
                  style={{
                    left: `${bar.spread.from}%`,
                    right: `${100 - bar.spread.to}%`,
                    background: 'var(--cr-primary-border)',
                  }}
                />
              )}
              {bar.you != null && liveTotal != null && (
                <span
                  className="absolute -top-6 flex -translate-x-1/2 flex-col items-center"
                  style={{ left: `${bar.you}%` }}
                >
                  <span
                    className="text-[9.5px] font-extrabold tracking-wide whitespace-nowrap uppercase"
                    style={{ color: 'var(--cr-primary)' }}
                  >
                    {t('priceBar.you', { price: rupees(liveTotal) })}
                  </span>
                  <span className="h-7 w-0.5" style={{ background: 'var(--cr-primary)' }} />
                </span>
              )}
            </div>
            <div
              className="flex justify-between text-[10.5px]"
              style={{ color: 'var(--cr-text-5)', fontVariantNumeric: 'tabular-nums' }}
            >
              <span>{rupees(Math.round(bar.scaleLo))}</span>
              <span>{rupees(Math.round(bar.scaleHi))}</span>
            </div>
            <div
              className="mt-3 flex flex-col gap-1.5 text-[11.5px]"
              style={{ color: 'var(--cr-text-3)' }}
            >
              {bar.budget && budget && (
                <span className="flex items-center gap-2">
                  <span
                    aria-hidden
                    className="h-2 w-3 shrink-0 rounded-sm"
                    style={{ background: 'var(--cr-success-bg)' }}
                  />
                  {t('priceBar.budgetLegend')} <b style={{ color: 'var(--cr-text-2)' }}>{budget}</b>
                </span>
              )}
              {bar.spread && bar.low != null && bar.high != null && (
                <span className="flex items-center gap-2">
                  <span
                    aria-hidden
                    className="h-2 w-3 shrink-0 rounded-sm"
                    style={{ background: 'var(--cr-primary-border)' }}
                  />
                  {t('priceBar.spreadLegend')}{' '}
                  <b style={{ color: 'var(--cr-text-2)' }}>
                    {bar.low === bar.high
                      ? rupees(bar.low)
                      : `${rupees(bar.low)} - ${rupees(bar.high)}`}
                  </b>
                </span>
              )}
            </div>
          </RailPanel>
        )}

        {/* ── buyer track record (real counts from this board) ── */}
        {buyer && (
          <RailPanel title={t('detail.aboutBuyer')}>
            <div className="flex items-center gap-2.5">
              {buyer.avatar ? (
                // eslint-disable-next-line @next/next/no-img-element -- small avatar, remote URL
                <img
                  src={buyer.avatar}
                  alt=""
                  aria-hidden
                  className="h-9 w-9 shrink-0 rounded-[var(--cr-radius-md)] object-cover"
                />
              ) : (
                <span
                  aria-hidden
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-[var(--cr-radius-md)] text-[13px] font-bold"
                  style={{ background: 'var(--cr-primary-light)', color: 'var(--cr-primary)' }}
                >
                  {buyerInitial}
                </span>
              )}
              <div className="min-w-0">
                <div className="truncate text-[13px] font-bold" style={{ color: 'var(--cr-text)' }}>
                  {buyer.name}
                </div>
                {location && (
                  <div className="text-[11.5px]" style={{ color: 'var(--cr-text-4)' }}>
                    {location}
                  </div>
                )}
              </div>
            </div>
            <div
              className="mt-3 grid grid-cols-2 gap-px overflow-hidden"
              style={{
                background: 'var(--cr-divider)',
                border: '1px solid var(--cr-divider)',
                borderRadius: 'var(--cr-radius-md)',
              }}
            >
              <div className="p-2.5 text-center" style={{ background: 'var(--cr-surface)' }}>
                <b
                  className="block text-[15px] font-extrabold"
                  style={{ color: 'var(--cr-primary)', fontVariantNumeric: 'tabular-nums' }}
                >
                  {rfq.buyerStats.rfqsPosted}
                </b>
                <span className="text-[10px]" style={{ color: 'var(--cr-text-4)' }}>
                  {t('detail.rfqsPosted')}
                </span>
              </div>
              <div className="p-2.5 text-center" style={{ background: 'var(--cr-surface)' }}>
                <b
                  className="block text-[15px] font-extrabold"
                  style={{ color: 'var(--cr-primary)', fontVariantNumeric: 'tabular-nums' }}
                >
                  {rfq.buyerStats.rfqsAwarded}
                </b>
                <span className="text-[10px]" style={{ color: 'var(--cr-text-4)' }}>
                  {t('detail.dealsAwarded')}
                </span>
              </div>
            </div>
          </RailPanel>
        )}

        {/* ── win tips (seller; advice copy, not data) ── */}
        {!isBuyer && (
          <RailPanel title={t('tips.title')}>
            <div className="flex flex-col">
              {(
                [
                  { icon: <Zap size={14} aria-hidden />, key: 'early' },
                  { icon: <ImageIcon size={14} aria-hidden />, key: 'proof' },
                  { icon: <ShieldCheck size={14} aria-hidden />, key: 'sample' },
                ] as const
              ).map(({ icon, key }, i) => (
                <div
                  key={key}
                  className="flex gap-2 py-2 text-[12px] leading-relaxed"
                  style={{
                    color: 'var(--cr-text-3)',
                    borderTop: i > 0 ? '1px solid var(--cr-divider)' : undefined,
                  }}
                >
                  <span className="mt-0.5 shrink-0" style={{ color: 'var(--cr-gold-700)' }}>
                    {icon}
                  </span>
                  <span>
                    <b style={{ color: 'var(--cr-text)' }}>{t(`tips.${key}Title`)}</b>{' '}
                    {t(`tips.${key}Body`)}
                  </span>
                </div>
              ))}
            </div>
          </RailPanel>
        )}

        {isBuyer && (
          <RailPanel title={t('rail.title')}>
            <p className="m-0 text-[12.5px] leading-relaxed" style={{ color: 'var(--cr-text-4)' }}>
              {t('rail.body')}
            </p>
          </RailPanel>
        )}

        {/* quotes-so-far context for the seller, under the tips. */}
        {!isBuyer && rfq.quoteStats.count > 0 && (
          <RailPanel title={t('detail.competitionTitle')}>
            <p
              className="m-0 flex items-center gap-2 text-[12.5px]"
              style={{ color: 'var(--cr-text-3)' }}
            >
              <FileText size={14} aria-hidden style={{ color: 'var(--cr-primary)' }} />
              {t('detail.competitionBody', { count: rfq.quoteStats.count })}
            </p>
            {closesLabel && (
              <p
                className="m-0 mt-1.5 flex items-center gap-2 text-[12.5px]"
                style={{ color: closingSoon ? 'var(--cr-warning)' : 'var(--cr-text-3)' }}
              >
                <CalendarClock size={14} aria-hidden /> {closesLabel}
              </p>
            )}
            <p
              className="m-0 mt-1.5 flex items-center gap-2 text-[12.5px]"
              style={{ color: 'var(--cr-text-3)' }}
            >
              <CheckCircle2 size={14} aria-hidden style={{ color: 'var(--cr-success)' }} />
              {t('detail.phoneNote')}
            </p>
          </RailPanel>
        )}
      </ConnectRightRail>
    </ConnectPage>
  );
}
