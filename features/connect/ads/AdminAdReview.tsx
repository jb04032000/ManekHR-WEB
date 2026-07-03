'use client';

/**
 * AdminAdReview - the minimal platform-admin ad review console (web Task 10).
 *
 * Internal admin tool: English-only copy + AntD design language, consistent
 * with the rest of app/admin/*. Three sections:
 *   1. Revenue tile (platform-wide total ad spend).
 *   2. Pending review queue: each creative shows its post preview + objective +
 *      budget, with Approve / Reject (reason required) actions. Approving or
 *      rejecting removes the card optimistically.
 *   3. Placement configuration: floor CPM + enabled toggle per slot.
 *
 * Auth: gated by AdminLayout (client isAdmin redirect) + the backend
 * IsAdminGuard. This component assumes an admin viewer.
 */

import { useCallback, useState } from 'react';
import { App, Button, Card, Empty, Input, InputNumber, Modal, Switch, Tag } from 'antd';
import { StatTile } from '@/components/ui/StatTile';
import PublicPostView from '@/components/connect/PublicPostView';
import { approveCreative, rejectCreative, updateAdPlacement } from './ads-admin.actions';
import AdminPricingEditor from './AdminPricingEditor';
import type {
  AdminLiveBoost,
  AdminPendingCreative,
  AdPlacementView,
  ConnectPricingView,
} from './ads.types';
import type { HydratedFeedItem } from '@/features/connect/feed.types';

interface ReviewItem {
  creative: AdminPendingCreative;
  post: HydratedFeedItem | null;
}

/** Friendly label per creative kind for the queue tag (instead of the raw enum). */
const KIND_LABEL: Record<string, string> = {
  promoted_post: 'Post',
  promoted_listing: 'Listing',
  promoted_job: 'Job',
  promoted_open_to_work: 'Open to work',
  promoted_hiring: 'Hiring',
  promoted_rfq: 'Quote request',
};

/**
 * Per-kind preview for a non-post creative: a short summary card showing what is
 * being promoted (BE-surfaced title) so the reviewer sees context without the
 * post-only fallback. Profile boosts link to the advertiser's own profile (the
 * ad unit), the rest name the listing / job / RFQ.
 */
function CreativePreview({ creative }: { creative: AdminPendingCreative }) {
  const owner = creative.campaign?.ownerUserId;
  let title: string | null = null;
  let href: string | null = null;
  switch (creative.kind) {
    case 'promoted_listing':
      title = creative.listingTitle ?? null;
      href = creative.listingRef ? `/connect/marketplace/listing/${creative.listingRef}` : null;
      break;
    case 'promoted_job':
      title = creative.jobTitle ?? null;
      break;
    case 'promoted_rfq':
      title = creative.rfqTitle ?? null;
      href = creative.rfqRef ? `/connect/rfq/${creative.rfqRef}` : null;
      break;
    case 'promoted_open_to_work':
    case 'promoted_hiring':
      title = "Advertiser's own profile";
      href = owner ? `/connect/u/${owner}` : null;
      break;
    default:
      title = null;
  }
  return (
    <div className="rounded-xl border border-subtle bg-subtle p-3">
      <div className="text-xs font-semibold text-muted">
        {KIND_LABEL[creative.kind] ?? creative.kind}
      </div>
      <div className="mt-0.5 text-sm font-semibold text-heading">
        {title ?? 'Preview unavailable'}
      </div>
      {href && (
        <a href={href} target="_blank" rel="noreferrer" className="text-link text-xs">
          Open in Connect ↗
        </a>
      )}
    </div>
  );
}

/**
 * The "what is being promoted" title for a live boost, by kind. Mirrors the
 * per-kind title logic in CreativePreview (listing / job / RFQ title, or the
 * advertiser's own profile for the two profile boosts), used in the take-down
 * row where a full post preview is unnecessary.
 */
function liveBoostTitle(b: AdminLiveBoost): string {
  switch (b.kind) {
    case 'promoted_listing':
      return b.listingTitle ?? 'Listing';
    case 'promoted_job':
      return b.jobTitle ?? 'Job';
    case 'promoted_rfq':
      return b.rfqTitle ?? 'Quote request';
    case 'promoted_open_to_work':
    case 'promoted_hiring':
      return "Advertiser's own profile";
    case 'promoted_post':
      return 'Boosted post';
    default:
      return KIND_LABEL[b.kind] ?? b.kind;
  }
}

interface AdminAdReviewProps {
  items: ReviewItem[];
  /** LIVE boosts (active + paused) the admin can take down. */
  liveBoosts: AdminLiveBoost[];
  placements: AdPlacementView[];
  revenue: number;
  /** Null when the pricing read failed; the editor section then hides itself. */
  pricing: ConnectPricingView | null;
}

export default function AdminAdReview({
  items,
  liveBoosts: initialLiveBoosts,
  placements: initialPlacements,
  revenue,
  pricing,
}: AdminAdReviewProps) {
  const [queue, setQueue] = useState<ReviewItem[]>(items);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [placements, setPlacements] = useState<AdPlacementView[]>(initialPlacements);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  // Live-boost take-down (publish-then-moderate): the list, the creative being
  // taken down (drives the modal open state), the modal reason, and an in-flight
  // flag. Reuses the reject action; the BE withholds the fee + notifies.
  const [live, setLive] = useState<AdminLiveBoost[]>(initialLiveBoosts);
  const [takedownTarget, setTakedownTarget] = useState<AdminLiveBoost | null>(null);
  const [takedownReason, setTakedownReason] = useState('');
  const [takingDown, setTakingDown] = useState(false);
  const { message: msgApi } = App.useApp();

  const removeFromQueue = useCallback((creativeId: string) => {
    setQueue((q) => q.filter((it) => it.creative._id !== creativeId));
  }, []);

  const onApprove = useCallback(
    async (creativeId: string) => {
      setBusyId(creativeId);
      const res = await approveCreative(creativeId);
      setBusyId(null);
      if (res.ok) {
        msgApi.success('Creative approved. Campaign is now active.');
        removeFromQueue(creativeId);
      } else {
        msgApi.error(res.error);
      }
    },
    [msgApi, removeFromQueue],
  );

  const onConfirmReject = useCallback(
    async (creativeId: string) => {
      const trimmed = reason.trim();
      if (trimmed === '') return;
      setBusyId(creativeId);
      const res = await rejectCreative(creativeId, trimmed);
      setBusyId(null);
      if (res.ok) {
        msgApi.success('Creative rejected. Unspent budget released.');
        setRejectingId(null);
        setReason('');
        removeFromQueue(creativeId);
      } else {
        msgApi.error(res.error);
      }
    },
    [msgApi, reason, removeFromQueue],
  );

  // Open the take-down modal for a live boost (clean reason each time).
  const openTakedown = useCallback((boost: AdminLiveBoost) => {
    setTakedownTarget(boost);
    setTakedownReason('');
  }, []);

  const closeTakedown = useCallback(() => {
    setTakedownTarget(null);
    setTakedownReason('');
  }, []);

  // Confirm a take-down: reuses rejectCreative (BE withholds the review fee,
  // unlinks the creative, and notifies the advertiser for a live boost). On
  // success the row drops from the live list.
  const onConfirmTakedown = useCallback(async () => {
    if (!takedownTarget) return;
    const trimmed = takedownReason.trim();
    if (trimmed === '') return;
    setTakingDown(true);
    const res = await rejectCreative(takedownTarget._id, trimmed);
    setTakingDown(false);
    if (res.ok) {
      msgApi.success('Boost taken down. The advertiser was refunded the leftover minus the fee.');
      setLive((list) => list.filter((b) => b._id !== takedownTarget._id));
      closeTakedown();
    } else {
      msgApi.error(res.error);
    }
  }, [msgApi, takedownTarget, takedownReason, closeTakedown]);

  const onSavePlacement = useCallback(
    async (key: string) => {
      const current = placements.find((p) => p.key === key);
      if (!current) return;
      setSavingKey(key);
      const res = await updateAdPlacement(key, {
        floorCpm: current.floorCpm,
        enabled: current.enabled,
      });
      setSavingKey(null);
      if (res.ok) {
        msgApi.success(`Placement "${key}" updated.`);
        setPlacements((ps) => ps.map((p) => (p.key === key ? res.data : p)));
      } else {
        msgApi.error(res.error);
      }
    },
    [msgApi, placements],
  );

  const patchPlacement = useCallback((key: string, patch: Partial<AdPlacementView>) => {
    setPlacements((ps) => ps.map((p) => (p.key === key ? { ...p, ...patch } : p)));
  }, []);

  return (
    <>
      <div className="flex flex-col gap-6">
        <div>
          <h2 className="m-0 mb-1 font-display text-2xl font-extrabold text-heading">
            Connect Ads Review
          </h2>
          <p className="m-0 text-sm text-muted">
            Approve or reject boosted posts, configure placement floors, and track ad revenue.
          </p>
        </div>

        {/* Revenue */}
        <div style={{ maxWidth: 280 }}>
          <StatTile
            label="Total ad spend"
            value={`Rs ${revenue}`}
            hint="Platform-wide, all campaigns"
          />
        </div>

        {/* Review queue */}
        <section className="flex flex-col gap-3">
          <h3 className="m-0 text-lg font-semibold text-heading">
            Pending review{' '}
            {queue.length > 0 && <span className="text-muted">({queue.length})</span>}
          </h3>

          {queue.length === 0 ? (
            <Card className="rounded-2xl">
              <Empty description="No creatives pending review" />
            </Card>
          ) : (
            queue.map(({ creative, post }) => {
              const isBusy = busyId === creative._id;
              const isRejecting = rejectingId === creative._id;
              return (
                <Card key={creative._id} className="rounded-2xl">
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    {creative.campaign?.objective && (
                      <Tag color="blue">{creative.campaign.objective}</Tag>
                    )}
                    {creative.campaign && <Tag>Budget Rs {creative.campaign.totalBudget}</Tag>}
                    <Tag>{KIND_LABEL[creative.kind] ?? creative.kind}</Tag>
                  </div>

                  {/* Preview: a post renders the full post; every other kind shows
                      a per-kind summary card (listing / job / RFQ title, or the
                      advertiser's own profile for the two profile boosts). */}
                  {post ? <PublicPostView post={post} /> : <CreativePreview creative={creative} />}

                  {/* Actions */}
                  <div className="mt-4 flex flex-col gap-2">
                    {isRejecting ? (
                      <>
                        <label
                          htmlFor={`reject-reason-${creative._id}`}
                          className="text-sm font-semibold text-heading"
                        >
                          Rejection reason (shown to the advertiser)
                        </label>
                        <Input.TextArea
                          id={`reject-reason-${creative._id}`}
                          rows={2}
                          value={reason}
                          onChange={(e) => setReason(e.target.value)}
                          placeholder="e.g. Image violates content guidelines."
                        />
                        <div className="flex gap-2">
                          <Button
                            danger
                            type="primary"
                            loading={isBusy}
                            disabled={reason.trim() === ''}
                            onClick={() => void onConfirmReject(creative._id)}
                          >
                            Confirm reject
                          </Button>
                          <Button
                            onClick={() => {
                              setRejectingId(null);
                              setReason('');
                            }}
                          >
                            Cancel
                          </Button>
                        </div>
                      </>
                    ) : (
                      <div className="flex gap-2">
                        <Button
                          type="primary"
                          loading={isBusy}
                          onClick={() => void onApprove(creative._id)}
                        >
                          Approve
                        </Button>
                        <Button
                          danger
                          disabled={isBusy}
                          onClick={() => {
                            setRejectingId(creative._id);
                            setReason('');
                          }}
                        >
                          Reject
                        </Button>
                      </div>
                    )}
                  </div>
                </Card>
              );
            })
          )}
        </section>

        {/* Live boosts (publish-then-moderate): every active/paused campaign,
            each with a Take down action. Take down reuses the reject endpoint;
            the backend stops delivery, refunds the leftover minus the review
            fee, unlinks the creative, and notifies the advertiser. */}
        <section className="flex flex-col gap-3">
          <h3 className="m-0 text-lg font-semibold text-heading">
            Live boosts {live.length > 0 && <span className="text-muted">({live.length})</span>}
          </h3>
          <p className="m-0 -mt-1 text-xs text-muted">
            Boosts go live instantly. Take one down to stop it and refund the leftover budget minus
            the review fee.
          </p>

          {live.length === 0 ? (
            <Card className="rounded-2xl">
              <Empty description="No live boosts right now" />
            </Card>
          ) : (
            live.map((boost) => (
              <Card key={boost._id} className="rounded-2xl">
                <div className="flex flex-wrap items-center gap-4">
                  <div className="min-w-[200px] flex-1">
                    <div className="mb-1.5 flex flex-wrap items-center gap-2">
                      <Tag>{KIND_LABEL[boost.kind] ?? boost.kind}</Tag>
                      {boost.campaign?.objective && (
                        <Tag color="blue">{boost.campaign.objective}</Tag>
                      )}
                      {boost.spotlight && <Tag color="gold">Spotlight</Tag>}
                    </div>
                    <div className="text-sm font-semibold text-heading">
                      {liveBoostTitle(boost)}
                    </div>
                    {boost.campaign?.ownerUserId && (
                      <a
                        href={`/connect/u/${boost.campaign.ownerUserId}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-link text-xs"
                      >
                        Advertiser ↗
                      </a>
                    )}
                  </div>
                  {boost.campaign && (
                    <div className="text-xs text-muted">Budget Rs {boost.campaign.totalBudget}</div>
                  )}
                  <Button danger onClick={() => openTakedown(boost)}>
                    Take down
                  </Button>
                </div>
              </Card>
            ))
          )}
        </section>

        {/* Placements */}
        <section className="flex flex-col gap-3">
          <h3 className="m-0 text-lg font-semibold text-heading">Placements</h3>
          {placements.length === 0 ? (
            <Card className="rounded-2xl">
              <Empty description="No placement slots configured" />
            </Card>
          ) : (
            placements.map((p) => (
              <Card key={p.key} className="rounded-2xl">
                <div className="flex flex-wrap items-end gap-4">
                  <div className="min-w-[160px] flex-1">
                    <div className="font-semibold text-heading">{p.key}</div>
                    <div className="text-xs text-muted">Surface: {p.surface}</div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label htmlFor={`floor-${p.key}`} className="text-xs text-muted">
                      Floor CPM (credits)
                    </label>
                    <InputNumber
                      id={`floor-${p.key}`}
                      min={0}
                      value={p.floorCpm}
                      onChange={(v) =>
                        patchPlacement(p.key, { floorCpm: typeof v === 'number' ? v : 0 })
                      }
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-muted">Enabled</span>
                    <Switch
                      checked={p.enabled}
                      onChange={(v) => patchPlacement(p.key, { enabled: v })}
                      aria-label={`Enable placement ${p.key}`}
                    />
                  </div>
                  <Button
                    type="primary"
                    loading={savingKey === p.key}
                    onClick={() => void onSavePlacement(p.key)}
                  >
                    Save
                  </Button>
                </div>
              </Card>
            ))
          )}
        </section>

        {/* Pricing levers (boost bid / min budget / durations / top-up presets).
            Hidden if the read failed so the rest of the console still works. */}
        {pricing ? <AdminPricingEditor initial={pricing} /> : null}
      </div>

      {/* Take-down modal: required reason + a note that the leftover budget is
          refunded minus the review fee. destroyOnHidden resets the field every
          open (v6 API; never destroyOnClose). Confirm reuses rejectCreative. */}
      <Modal
        open={takedownTarget !== null}
        title="Take down this boost"
        okText="Take down"
        okType="danger"
        okButtonProps={{ disabled: takedownReason.trim() === '', loading: takingDown }}
        cancelButtonProps={{ disabled: takingDown }}
        confirmLoading={takingDown}
        onOk={() => void onConfirmTakedown()}
        onCancel={closeTakedown}
        destroyOnHidden
        centered
      >
        <p className="mt-0 mb-2 text-sm text-muted">
          The advertiser will be notified and will see this reason. The unspent budget is refunded
          minus the
          {pricing ? ` Rs ${pricing.moderationReviewFee}` : ''} review fee.
        </p>
        <label htmlFor="takedown-reason" className="mb-1 block text-sm font-semibold text-heading">
          Reason (shown to the advertiser)
        </label>
        <Input.TextArea
          id="takedown-reason"
          rows={3}
          value={takedownReason}
          onChange={(e) => setTakedownReason(e.target.value)}
          placeholder="e.g. Creative violates content guidelines."
        />
      </Modal>
    </>
  );
}
