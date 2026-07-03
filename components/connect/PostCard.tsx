'use client';

/**
 * PostCard - one feed post (Phase 3 - Feed).
 *
 * Renders all five post kinds - `text`, `photo`, `video`, `document`, `voice` -
 * with an author header (avatar + name + ERP-linked badge + relative time), the
 * body, a media block, hashtag / intent pills, and a footer. The footer's React
 * button is a wired optimistic toggle; the comment count is shown (the thread
 * lands in Wave 4); WhatsApp opens a `wa.me` share. `memo`'d - a feed re-render
 * must not re-render every card.
 *
 * JIT shared component (Phase 3). Rendered in isolation on `/design-system`.
 */

import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { App as AntApp, Dropdown, Image, type MenuProps } from 'antd';
import {
  Heart,
  MessageCircle,
  FileText,
  // Sparkles - only used by the disabled discovery "why am I seeing this" chip
  // below (DISABLED 2026-06-16, owner request). Re-add when re-enabling that chip.
  // Sparkles,
  MoreHorizontal,
  EyeOff,
  Eye,
  Ban,
  Share2,
  Copy,
  Mail,
  Send,
  Repeat2,
  Quote,
  Bookmark,
  BookmarkCheck,
  Pencil,
  Trash2,
  Play,
  Rocket,
  Flag,
} from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import ConnectAvatar from '@/components/connect/ConnectAvatar';
import TrustBadgeRow from './TrustBadgeRow';
// Per-item "Sample" disclosure pill, shown on seeded demo content (post.isDemo,
// denormalized at create from the author's User.isDemo). One source of truth with
// the feed/search demo down-rank (backend demo-rank.ts).
import SampleBadge from './SampleBadge';
import PhotoCarousel from './PhotoCarousel';
import PublicPostView from './PublicPostView';
// Renders the body with @mentions as clickable chips (deleted tags fall back to
// plain text). Shared with PublicPostView, PostComments, ActivityCommentList.
import MentionText from './MentionText';
// Right-sized CDN variants for grid cells; full URL stays in the lightbox.
import { imageVariant } from '@/lib/media/imageUrl';
import {
  noDownloadAudioProps,
  noDownloadImageProps,
  noDownloadVideoProps,
} from '@/lib/connect/media-guard';
import {
  addNegativeSignal,
  removeNegativeSignal,
  deletePost,
  reactToPost,
  repostPost,
  savePost,
  unreactFromPost,
  unrepostPost,
  unsavePost,
} from '@/features/connect/feed.actions';
import type {
  HydratedFeedItem,
  NegativeSignalKind,
  PostMedia,
  PostMediaLayout,
} from '@/features/connect/feed.types';
import PostComments from '@/features/connect/feed/PostComments';
import QuoteRepostModal from '@/features/connect/feed/QuoteRepostModal';
import EditPostModal from '@/features/connect/feed/EditPostModal';
import { ReportContentModal } from '@/components/connect/ReportContentModal';
import { usePostRealtime, type PostActivityEvent } from '@/features/connect/feed/useConnectSocket';
// Product analytics (PostHog/GA4 via the typed catalog). Feed impression /
// click / video-play / boost-CTA emits below piggyback EXISTING triggers (the
// onSeen observer, the existing click handlers, the video onPlay, the boost
// push) and never replace them. Keyless-safe: trackEvent/recordFeedImpression
// no-op without env keys. Links: lib/analytics-events.ts.
import {
  trackEvent,
  recordFeedImpression,
  ConnectEvents,
  type FeedFeedbackKind,
} from '@/lib/analytics-events';

interface PostCardProps {
  post: HydratedFeedItem;
  /** The signed-in viewer - drives the comment-delete controls in the thread. */
  viewerId: string;
  /** Whether the viewer has completed Connect onboarding. When false, write
   *  actions (react, comment) redirect to `/connect/onboarding`. */
  onboarded: boolean;
  /** Open the comment thread on mount - the post-detail permalink sets this so
   *  the thread shows immediately. Defaults to collapsed (the feed list). */
  defaultShowComments?: boolean;
  /** "Show me less" callback - fired after a negative signal is recorded so the
   *  feed list can drop the post (or all of a muted author's posts) from its
   *  cache instantly. Omitted on surfaces with no list to prune (e.g. the
   *  post-detail permalink), where the menu still records the signal silently. */
  onNegativeSignal?: (kind: NegativeSignalKind, post: HydratedFeedItem) => void;
  /** Reverse a negative signal's LIST effect (Phase 7d). Mirrors
   *  `onNegativeSignal`: hide restores the placeholder->card, mute refetches the
   *  author's posts. Fired by an Undo (or a failed hide). not-interested needs
   *  no list effect (the post never left). */
  onNegativeUndo?: (kind: NegativeSignalKind, post: HydratedFeedItem) => void;
  /** When set, this card is a SPONSORED post (Phase 7d). The overflow menu then
   *  shows ONLY "Hide" (no not-interested / mute / author controls); hiding it
   *  calls `onSponsoredHide` with this campaign id so the ad side suppresses the
   *  campaign for this viewer. */
  sponsoredCampaignId?: string;
  /** Fired when the viewer hides a sponsored card - the parent (PromotedAdCard)
   *  records the campaign suppression and removes the card. */
  onSponsoredHide?: (campaignId: string) => void;
  /** Fired after a save toggles, with the new saved state. The Saved page uses
   *  it to prune a post the viewer just un-saved; the feed omits it (toggling a
   *  save there just flips the bookmark, the post stays put). */
  onSaveChange?: (saved: boolean, post: HydratedFeedItem) => void;
  /** Fired after the author deletes this post, so the feed / saved list prunes
   *  it from cache. Omitted where there is no list (the permalink navigates away). */
  onDeleted?: (post: HydratedFeedItem) => void;
  /** Fired once when the card has dwelled in the viewport (≥ half visible for
   *  ~1s) - the feed list batches these into a view-impression call. Omitted on
   *  surfaces that do not count impressions (e.g. the post-detail permalink). */
  onSeen?: (postId: string) => void;
  /** Above-the-fold hint. The feed list sets this on the FIRST post only so its
   *  first image paints eagerly (good LCP); every other post image lazy-loads.
   *  Defaults to false. */
  priority?: boolean;
  /** The post's position (row index) in the feed. Forwarded by FeedList for the
   *  feed-impression analytics event. Optional: surfaces with no feed ordering
   *  (e.g. the permalink) omit it and it falls back to 0. */
  position?: number;
  /** The active feed tab (e.g. 'foryou' / 'following'). Forwarded by FeedList
   *  for the feed-impression analytics event. Optional: defaults to 'unknown'. */
  feedTab?: string;
}

/** Clip duration seconds → `m:ss`. */
function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function PostCard({
  post,
  viewerId,
  onboarded,
  defaultShowComments = false,
  onNegativeSignal,
  onNegativeUndo,
  sponsoredCampaignId,
  onSponsoredHide,
  onSaveChange,
  onDeleted,
  onSeen,
  priority = false,
  position,
  feedTab,
}: PostCardProps) {
  const t = useTranslations('connect.feed.post');
  const tReport = useTranslations('connect.report');
  const format = useFormatter();
  const router = useRouter();
  const { message, modal } = AntApp.useApp();

  const [showComments, setShowComments] = useState(defaultShowComments);

  // Viewport-impression tracker - fire `onSeen` once the card has been at least
  // half visible for ~1s (a real read, not a fast scroll-past). Self-disconnects
  // after firing so each card reports at most once.
  const articleRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    // The observer now serves two consumers off the SAME dwell trigger: the
    // billing/view-count path (onSeen, unchanged) AND the product-analytics feed
    // impression (recordFeedImpression, additive + sampled + de-duped internally).
    // Run when either is meaningful: onSeen present, or a feedTab/position is
    // supplied (a real feed row) so the analytics impression still fires on
    // surfaces that do not count views.
    const wantsAnalytics = feedTab !== undefined || position !== undefined;
    if (!onSeen && !wantsAnalytics) return;
    const el = articleRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    let dwell: ReturnType<typeof setTimeout> | null = null;
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
          if (!dwell)
            dwell = setTimeout(() => {
              onSeen?.(post._id);
              // Feed-impression product event on the same dwell trigger; the
              // catalog handles once-per-session dedupe + sampling itself.
              recordFeedImpression({
                postId: post._id,
                position: position ?? 0,
                tab: feedTab ?? 'unknown',
              });
              observer.disconnect();
            }, 1000);
        } else if (dwell) {
          clearTimeout(dwell);
          dwell = null;
        }
      },
      { threshold: [0, 0.5, 1] },
    );
    observer.observe(el);
    return () => {
      if (dwell) clearTimeout(dwell);
      observer.disconnect();
    };
  }, [onSeen, post._id, position, feedTab]);

  // A page post is attributed to the company page (name / logo / public page),
  // not the person who wrote it. `companyPage` is resolved by the feed hydrator.
  const isPagePost = !!post.companyPage;
  const authorName = isPagePost
    ? post.companyPage!.name
    : (post.author?.name ?? t('fallbackAuthor'));
  // Both link to the in-app mirror so a signed-in member stays inside the
  // Connect shell: page posts -> `/connect/company/[slug]`, personal -> the
  // person profile. (The bare `/company` + `/u` routes are the logged-out/SEO
  // surfaces.)
  const authorHref = isPagePost
    ? `/connect/company/${post.companyPage!.slug}`
    : `/connect/u/${post.authorId}`;
  const authorAvatar = isPagePost
    ? post.companyPage!.logo || undefined
    : (post.author?.avatar ?? undefined);

  // The reaction toggle is optimistic - seeded from the server-loaded state.
  const [reacted, setReacted] = useState(post.viewerReacted);
  const [reactionCount, setReactionCount] = useState(post.reactionCount);
  const [commentCount, setCommentCount] = useState(post.commentCount);
  const [busy, setBusy] = useState(false);

  // Repost toggle - targets the ROOT (on a repost card the button reposts the
  // original). The count shows the root's tally (the embedded original's, when
  // this card is itself a repost); `viewerReposted` is already root-keyed by
  // the server.
  const repostRootId = post.repostOf ?? post._id;
  const [reposted, setReposted] = useState(post.viewerReposted);
  const [repostCount, setRepostCount] = useState(post.original?.repostCount ?? post.repostCount);
  const [repostBusy, setRepostBusy] = useState(false);
  const [quoteOpen, setQuoteOpen] = useState(false);
  // The post to quote - the ROOT (the embedded original on a repost card, else
  // this post). Falls back to this post if the original was deleted.
  const quoteTarget = post.original ?? post;

  // Save (bookmark) toggle - optimistic, seeded from the server-loaded state.
  const [saved, setSaved] = useState(post.viewerSaved);
  const [saveBusy, setSaveBusy] = useState(false);

  // Editable body + edited marker - local so an inline edit reflects without a
  // refetch (updated via `onSaved`). Seeded once, like the card's other
  // optimistic local state (reacted / reposted); the feed list keys each card by
  // `post._id`, so scrolling onto a different post remounts with a fresh seed.
  const [body, setBody] = useState(post.body);
  const [editedAt, setEditedAt] = useState<string | null>(post.editedAt ?? null);
  // Local layout mirror so an in-place edit (grid <-> carousel) reflects without a
  // refetch - seeded once, like body / editedAt (the feed list re-keys per post id).
  const [mediaLayout, setMediaLayout] = useState<PostMediaLayout>(post.mediaLayout ?? 'grid');
  // Hide the poster-first play badge once playback starts (a video post).
  const [videoStarted, setVideoStarted] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  // Report flow for OTHER people's posts (overflow menu -> moderation queue).
  const [reportOpen, setReportOpen] = useState(false);
  // Editable only by the author, and only a real post (a repost is a wrapper
  // around someone else's content - the backend rejects editing one too).
  const canEdit = viewerId === post.authorId && !post.repostOf;
  // Deletable by the author, including a repost wrapper (deleting it removes the
  // repost). The backend enforces author ownership.
  const canDelete = viewerId === post.authorId;

  // Realtime - live counts for everyone watching this post (Socket.IO). The
  // server values are authoritative, so they cleanly reconcile the optimistic
  // local reaction flip.
  const onActivity = useCallback((event: PostActivityEvent) => {
    setReactionCount(event.reactionCount);
    setCommentCount(event.commentCount);
  }, []);
  usePostRealtime(post._id, onActivity);

  const toggleReaction = useCallback(async () => {
    if (!onboarded) {
      router.push('/connect/onboarding');
      return;
    }
    if (busy) return;
    setBusy(true);
    const next = !reacted;
    // Optimistic flip.
    setReacted(next);
    setReactionCount((c) => c + (next ? 1 : -1));
    const res = next ? await reactToPost(post._id) : await unreactFromPost(post._id);
    setBusy(false);
    if (!res.ok) {
      // Revert on failure.
      setReacted(!next);
      setReactionCount((c) => c + (next ? -1 : 1));
      message.error(res.error || t('reactError'));
      return;
    }
    // Reconcile with the server's authoritative count.
    setReacted(res.data.reacted);
    setReactionCount(res.data.reactionCount);
  }, [onboarded, router, busy, reacted, post._id, message, t]);

  const toggleRepost = useCallback(async () => {
    if (!onboarded) {
      router.push('/connect/onboarding');
      return;
    }
    if (repostBusy) return;
    setRepostBusy(true);
    const next = !reposted;
    // Optimistic flip.
    setReposted(next);
    setRepostCount((c) => Math.max(0, c + (next ? 1 : -1)));
    const res = next ? await repostPost(repostRootId) : await unrepostPost(repostRootId);
    setRepostBusy(false);
    if (!res.ok) {
      setReposted(!next);
      setRepostCount((c) => Math.max(0, c + (next ? -1 : 1)));
      message.error(res.error || t('repost.error'));
      return;
    }
    message.success(next ? t('repost.done') : t('repost.undone'));
  }, [onboarded, router, repostBusy, reposted, repostRootId, message, t]);

  const toggleSave = useCallback(async () => {
    if (!onboarded) {
      router.push('/connect/onboarding');
      return;
    }
    if (saveBusy) return;
    setSaveBusy(true);
    const next = !saved;
    // Optimistic flip. Save the ROOT (the embedded original on a repost card,
    // else this post) so the bookmark points at the content, not the wrapper -
    // matches the backend's root-keyed save + the repost toggle.
    setSaved(next);
    const res = next ? await savePost(repostRootId) : await unsavePost(repostRootId);
    setSaveBusy(false);
    if (!res.ok) {
      setSaved(!next);
      message.error(res.error || t('save.error'));
      return;
    }
    message.success(next ? t('save.done') : t('save.undone'));
    onSaveChange?.(next, post);
  }, [onboarded, router, saveBusy, saved, repostRootId, post, message, t, onSaveChange]);

  const repostMenuItems = useMemo<MenuProps['items']>(
    () => [
      {
        key: 'repost',
        icon: <Repeat2 size={14} aria-hidden />,
        label: reposted ? t('repost.undo') : t('repost.label'),
        onClick: () => void toggleRepost(),
      },
      {
        key: 'quote',
        icon: <Quote size={14} aria-hidden />,
        label: t('repost.quote'),
        onClick: () => {
          if (!onboarded) {
            router.push('/connect/onboarding');
            return;
          }
          setQuoteOpen(true);
        },
      },
    ],
    [t, reposted, toggleRepost, onboarded, router],
  );

  // ── "Show me less" controls (Phase 7d) ──────────────────────────────────
  // hide + mute hard-exclude (both tabs); not-interested only DAMPENS For-You,
  // so the post is NOT removed - it just ranks lower later. Each control is
  // reversible: hide gets an inline placeholder (owned by FeedList), the other
  // two get a toast with Undo. Analytics: connect.feed.feedback {kind, action}.

  const recordFeedback = useCallback((kind: FeedFeedbackKind, action: 'add' | 'undo') => {
    trackEvent(ConnectEvents.feedFeedback, { kind, action });
  }, []);

  // Reverse a recorded signal; `listEffect` restores the list (mute refetches;
  // not-interested needs nothing since the post never left).
  const undoNegative = useCallback(
    async (kind: NegativeSignalKind, targetId: string, listEffect?: () => void) => {
      const res = await removeNegativeSignal(kind, targetId);
      if (!res.ok) {
        message.error(res.error || t('signalError'));
        return;
      }
      recordFeedback(kind, 'undo');
      listEffect?.();
      message.success(t('undone'));
    },
    [message, t, recordFeedback],
  );

  // A success toast carrying an inline Undo button (~6s so the reader can react).
  const showUndoToast = useCallback(
    (label: string, onUndo: () => void) => {
      const key = `fb-${post._id}-${label}`;
      message.open({
        type: 'success',
        key,
        duration: 6,
        content: (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 12 }}>
            {label}
            <button
              type="button"
              onClick={() => {
                message.destroy(key);
                onUndo();
              }}
              style={{
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                fontWeight: 700,
                color: 'var(--cr-primary)',
              }}
            >
              {t('undo')}
            </button>
          </span>
        ),
      });
    },
    [message, t, post._id],
  );

  // Not interested - now hides the post AND dampens For-You. Mirrors onHide:
  // FeedList optimistically swaps in the "Post hidden - Undo" placeholder (the
  // placeholder owns the undo), and the BE hard-excludes the post from both tabs
  // on refresh while keeping the "show me less like this" ranking signal. On API
  // failure, restore the card.
  const onNotInterested = useCallback(async () => {
    onNegativeSignal?.('not_interested', post);
    const res = await addNegativeSignal('not_interested', post._id);
    if (!res.ok) {
      message.error(res.error || t('signalError'));
      onNegativeUndo?.('not_interested', post);
      return;
    }
    recordFeedback('not_interested', 'add');
  }, [post, message, t, onNegativeSignal, onNegativeUndo, recordFeedback]);

  // Hide - instant: FeedList swaps in the "Post hidden - Undo" placeholder (the
  // placeholder owns the undo). On API failure, restore the card.
  const onHide = useCallback(async () => {
    onNegativeSignal?.('hide_post', post);
    const res = await addNegativeSignal('hide_post', post._id);
    if (!res.ok) {
      message.error(res.error || t('signalError'));
      onNegativeUndo?.('hide_post', post);
      return;
    }
    recordFeedback('hide_post', 'add');
  }, [post, message, t, onNegativeSignal, onNegativeUndo, recordFeedback]);

  // Mute - confirm with the 30-day scope, then drop the author's posts (+ Undo).
  const onMute = useCallback(() => {
    modal.confirm({
      title: t('mute.confirmTitle', { name: authorName }),
      content: t('mute.confirmBody', { name: authorName }),
      okText: t('mute.confirmOk'),
      cancelText: t('edit.cancel'),
      onOk: async () => {
        const res = await addNegativeSignal('mute_author', post.authorId);
        if (!res.ok) {
          message.error(res.error || t('signalError'));
          return;
        }
        recordFeedback('mute_author', 'add');
        onNegativeSignal?.('mute_author', post);
        showUndoToast(
          t('signalDone.mute_author', { name: authorName }),
          () =>
            void undoNegative('mute_author', post.authorId, () =>
              onNegativeUndo?.('mute_author', post),
            ),
        );
      },
    });
  }, [
    modal,
    t,
    authorName,
    post,
    message,
    recordFeedback,
    onNegativeSignal,
    onNegativeUndo,
    showUndoToast,
    undoNegative,
  ]);

  // Sponsored "Hide" - the only control on a promoted card. The parent records
  // the campaign suppression + removes the card.
  const onHideAd = useCallback(() => {
    if (sponsoredCampaignId) onSponsoredHide?.(sponsoredCampaignId);
  }, [sponsoredCampaignId, onSponsoredHide]);

  // Delete (author-only) - confirm first (destructive, no undo). On success the
  // feed / saved list prunes via `onDeleted`; a surface with no list (the
  // permalink) navigates back to the feed instead.
  const onDelete = useCallback(() => {
    modal.confirm({
      title: t('delete.confirmTitle'),
      content: t('delete.confirmBody'),
      okText: t('delete.confirmOk'),
      okButtonProps: { danger: true },
      cancelText: t('edit.cancel'),
      onOk: async () => {
        const res = await deletePost(post._id);
        if (!res.ok) {
          message.error(res.error || t('delete.error'));
          return;
        }
        message.success(t('delete.done'));
        if (onDeleted) onDeleted(post);
        else router.push('/connect/feed');
      },
    });
  }, [modal, t, post, message, onDeleted, router]);

  // The viewer's own post (incl. a page post the owner is viewing, since authorId
  // is the owning user). canDelete already equals this; named for clarity.
  const isOwnPost = canDelete;

  // Boost is offered ONLY on the author's own ORIGINAL post (canEdit already
  // excludes reposts + non-authors). A boost must target a PUBLIC post (backend
  // gate + the live `feed_promoted_post` placement), so on a non-public own post
  // the item is shown but DISABLED with an explanatory hint, rather than hidden -
  // the author sees the capability and learns why it is unavailable. Navigates to
  // the boost composer route /connect/boost/post/[id]; the route + backend
  // re-enforce author + public + no-duplicate. Links: app/connect/boost/post.
  const canBoost = canEdit; // own, original (non-repost) post
  const boostEnabled = canBoost && post.visibility === 'public';

  const moreMenuItems = useMemo<MenuProps['items']>(
    () =>
      // A SPONSORED card (Phase 7d) gets ONLY "Hide" - no not-interested / mute /
      // author controls, and never the author's own edit/delete (an ad is not the
      // viewer's post). Hiding it suppresses the campaign for this viewer.
      sponsoredCampaignId
        ? [
            {
              key: 'hide_ad',
              icon: <EyeOff size={14} aria-hidden />,
              label: t('menu.hideAd'),
              onClick: onHideAd,
            },
          ]
        : [
            // Author-only: edit your own (non-repost) post.
            ...(canEdit
              ? [
                  {
                    key: 'edit',
                    icon: <Pencil size={14} aria-hidden />,
                    label: t('edit.menuLabel'),
                    onClick: () => setEditOpen(true),
                  },
                ]
              : []),
            // Author-only: boost your own original post (disabled until it is public).
            ...(canBoost
              ? [
                  {
                    key: 'boost',
                    icon: <Rocket size={14} aria-hidden />,
                    label: t('boost.menuLabel'),
                    disabled: !boostEnabled,
                    // The hint surfaces WHY a non-public post cannot be boosted (AntD
                    // shows it as the item's native title tooltip).
                    title: boostEnabled ? undefined : t('boost.disabledHint'),
                    onClick: boostEnabled
                      ? () => {
                          // Boost CTA clicked (before the composer route opens). Additive
                          // analytics; mirrors the existing boost-composer navigation.
                          trackEvent(ConnectEvents.boostCtaClicked, { subject: 'post' });
                          router.push(`/connect/boost/post/${post._id}`);
                        }
                      : undefined,
                  },
                ]
              : []),
            ...(canDelete
              ? [
                  {
                    key: 'delete',
                    icon: <Trash2 size={14} aria-hidden />,
                    label: t('delete.menuLabel'),
                    danger: true,
                    onClick: () => void onDelete(),
                  },
                ]
              : []),
            // Viewer-side feed controls (hide / not-interested / mute) make sense ONLY
            // on OTHER people's posts. On your own post (e.g. the page owner on their
            // own page's Posts tab) they are meaningless, so hide them entirely - the
            // menu then shows just Edit / Delete. No divider needed: the two groups are
            // mutually exclusive (author items vs viewer controls).
            ...(isOwnPost
              ? []
              : [
                  {
                    key: 'hide_post',
                    icon: <EyeOff size={14} aria-hidden />,
                    label: t('menu.hidePost'),
                    onClick: () => void onHide(),
                  },
                  {
                    key: 'not_interested',
                    icon: <Ban size={14} aria-hidden />,
                    label: t('menu.notInterested'),
                    onClick: () => void onNotInterested(),
                  },
                  {
                    key: 'mute_author',
                    icon: <Ban size={14} aria-hidden />,
                    label: t('menu.muteAuthor', { name: authorName }),
                    danger: true,
                    onClick: () => onMute(),
                  },
                  // Report this post to the platform moderation queue.
                  {
                    key: 'report',
                    icon: <Flag size={14} aria-hidden />,
                    label: tReport('action'),
                    onClick: () => setReportOpen(true),
                  },
                ]),
          ],
    [
      t,
      tReport,
      authorName,
      sponsoredCampaignId,
      onHide,
      onNotInterested,
      onMute,
      onHideAd,
      canEdit,
      canDelete,
      canBoost,
      boostEnabled,
      isOwnPost,
      onDelete,
      router,
      post._id,
    ],
  );

  // ── Share ────────────────────────────────────────────────────────────────
  // The shareable target is the PUBLIC permalink (`/p/[id]`) - it unfurls an OG
  // card and resolves logged-out, so a forwarded link converts. The native
  // Web Share item is shown only when the browser supports it (mobile).
  // `useSyncExternalStore` reads that capability with a server snapshot of
  // `false`, so SSR + first client render agree (no hydration mismatch) before
  // flipping to the real value - the sanctioned API for a client-only value.
  const canShare = useSyncExternalStore(
    () => () => {},
    () => typeof navigator !== 'undefined' && typeof navigator.share === 'function',
    () => false,
  );

  const shareUrl = useMemo(() => {
    if (typeof window === 'undefined') return `/p/${post._id}`;
    return `${window.location.origin}/p/${post._id}`;
  }, [post._id]);

  const copyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      message.success(t('share.copied'));
    } catch {
      message.error(t('share.failed'));
    }
  }, [shareUrl, message, t]);

  const shareWhatsApp = useCallback(() => {
    const text = encodeURIComponent(t('share.whatsappMessage', { url: shareUrl }));
    window.open(`https://wa.me/?text=${text}`, '_blank', 'noopener,noreferrer');
  }, [shareUrl, t]);

  const shareEmail = useCallback(() => {
    const subject = encodeURIComponent(t('share.emailSubject'));
    const body = encodeURIComponent(t('share.emailBody', { url: shareUrl }));
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  }, [shareUrl, t]);

  const shareNative = useCallback(async () => {
    try {
      await navigator.share({ title: authorName, text: body.trim(), url: shareUrl });
    } catch {
      // User-cancelled or unsupported - silent (it is an optional convenience).
    }
  }, [authorName, body, shareUrl]);

  const shareMenuItems = useMemo<MenuProps['items']>(() => {
    const items: NonNullable<MenuProps['items']> = [
      {
        key: 'copy',
        icon: <Copy size={14} aria-hidden />,
        label: t('share.copy'),
        onClick: () => void copyLink(),
      },
      {
        key: 'whatsapp',
        icon: <Send size={14} aria-hidden />,
        label: t('share.whatsapp'),
        onClick: shareWhatsApp,
      },
      {
        key: 'email',
        icon: <Mail size={14} aria-hidden />,
        label: t('share.email'),
        onClick: shareEmail,
      },
    ];
    if (canShare) {
      items.push({
        key: 'native',
        icon: <Share2 size={14} aria-hidden />,
        label: t('share.native'),
        onClick: () => void shareNative(),
      });
    }
    return items;
  }, [t, canShare, copyLink, shareWhatsApp, shareEmail, shareNative]);

  return (
    <article
      ref={articleRef}
      style={{
        background: 'var(--cr-surface)',
        border: '1px solid var(--cr-border)',
        borderRadius: 'var(--cr-radius-lg)',
        overflow: 'hidden',
      }}
    >
      {/* Repost attribution - the header below shows the reposter; this strip
          names the action. The original renders embedded after the body. */}
      {post.repostOf && (
        <div
          className="inline-flex items-center gap-1.5"
          style={{
            padding: '10px 16px 0',
            fontSize: 12,
            fontWeight: 600,
            color: 'var(--cr-text-4)',
          }}
        >
          <Repeat2 size={13} aria-hidden />
          {t('repost.attribution')}
        </div>
      )}
      {/* DISABLED 2026-06-16 (owner request): the discovery "why am I seeing this"
          chip (Sparkles + reason label, e.g. "Trending") used to render on every
          non-in-network post. On the current low-network user base the For-You feed
          is dominated by discovery posts (origin !== 'in_network'), so this chip
          showed on almost every post and read as noise. Owner wants a promo label
          ONLY on boosted posts - that is the separate "Promoted" path in
          features/connect/feed/FeedAdCard.tsx, which is unaffected by this change.
          To re-enable, uncomment the block below (and the Sparkles import above).
      {post.origin && post.origin !== 'in_network' && post.reason && (
        <div
          className="inline-flex items-center gap-1.5"
          style={{
            padding: '8px 16px 0',
            fontSize: 11.5,
            fontWeight: 600,
            color: 'var(--cr-text-4)',
          }}
        >
          <Sparkles size={12} aria-hidden />
          {t(`reason.${post.reason}` as Parameters<typeof t>[0])}
        </div>
      )}
      */}
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px 0' }}>
        <Link
          href={authorHref}
          aria-label={authorName}
          className="no-underline"
          // Feed click -> profile. Additive analytics; navigation (the Link) is
          // untouched. Mirrors the existing author-avatar nav.
          onClick={() =>
            trackEvent(ConnectEvents.feedPostClick, { postId: post._id, target: 'profile' })
          }
        >
          {/* ConnectAvatar carries the author's "open to" ring/dot (status null =>
              bare DsAvatar, identical to before). Page posts attribute to a company
              page, not a person, so they have no person open-status. openStatus is
              hydrated on `post.author` via getPeople (PersonRef.openStatus). */}
          <ConnectAvatar
            name={authorName}
            src={authorAvatar}
            size={40}
            status={isPagePost ? null : (post.author?.openStatus ?? null)}
            style={isPagePost ? { borderRadius: 8 } : undefined}
          />
        </Link>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
            <Link
              href={authorHref}
              className="no-underline"
              // Single-line, ellipsis-truncating name (flex: 0 1 auto + minWidth 0)
              // so a long company/person name (e.g. "Mehta Embroidery Works")
              // truncates instead of wrapping to 2-3 lines next to the badges.
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: 'var(--cr-text)',
                minWidth: 0,
                flex: '0 1 auto',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
              // Feed click -> profile (author name). Additive analytics; the Link
              // navigation is untouched.
              onClick={() =>
                trackEvent(ConnectEvents.feedPostClick, { postId: post._id, target: 'profile' })
              }
            >
              {authorName}
            </Link>
            {/* Badges sit on the name's line and never shrink/wrap (flexShrink 0)
                - the name truncates to make room, not the badges. */}
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
              {isPagePost ? (
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: 'var(--cr-text-4)',
                    border: '1px solid var(--cr-border)',
                    borderRadius: 4,
                    padding: '0 5px',
                  }}
                >
                  {t('pageBadge')}
                </span>
              ) : (
                post.authorErpLinked && <TrustBadgeRow badges={['erp']} max={1} size="sm" />
              )}
              {post.isDemo && <SampleBadge size="sm" />}
            </span>
          </div>
          <div
            style={{
              fontSize: 12,
              color: 'var(--cr-text-4)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {!isPagePost && post.author?.headline ? `${post.author.headline} · ` : ''}
            {format.relativeTime(new Date(post.createdAt))}
            {editedAt && (
              <span
                title={format.dateTime(new Date(editedAt), {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })}
              >
                {' · '}
                {t('editedLabel')}
              </span>
            )}
          </div>
        </div>

        {/* "Show me less" overflow menu - hide / not-interested / mute author. */}
        <Dropdown menu={{ items: moreMenuItems }} trigger={['click']} placement="bottomRight">
          <button
            type="button"
            aria-label={t('more')}
            className="inline-flex items-center justify-center"
            style={{
              flexShrink: 0,
              width: 32,
              height: 32,
              border: 'none',
              borderRadius: 'var(--cr-radius-md)',
              background: 'transparent',
              cursor: 'pointer',
              color: 'var(--cr-text-4)',
            }}
          >
            <MoreHorizontal size={18} aria-hidden />
          </button>
        </Dropdown>
      </div>

      {/* Body (local state - reflects an inline edit without a refetch) */}
      {body.trim() && (
        <p
          style={{
            margin: '10px 16px 0',
            fontSize: 14,
            lineHeight: 1.55,
            color: 'var(--cr-text-2)',
            whiteSpace: 'pre-wrap',
          }}
        >
          {/* body is local state (inline-edit), mentions come from the post doc. */}
          <MentionText text={body} mentions={post.mentions} />
        </p>
      )}

      {/* Embedded ROOT original - a repost renders the original as a nested,
          read-only card (its own chrome) below the optional quote body. */}
      {post.original && (
        <div style={{ margin: '12px 16px 0' }}>
          <PublicPostView post={post.original} />
        </div>
      )}

      {/* Media */}
      {post.kind === 'voice' && post.audio ? (
        <div style={{ margin: '12px 16px 0' }}>
          <div
            style={{
              padding: 8,
              background: 'var(--cr-surface-2)',
              border: '1px solid var(--cr-border-light)',
              borderRadius: 'var(--cr-radius-lg)',
            }}
          >
            <audio
              controls
              // Hide the native controls download button + block right-click save
              // on the voice note. Shared with every Connect media player.
              {...noDownloadAudioProps}
              src={post.audio.url}
              style={{ width: '100%', height: 44 }}
              aria-label={t('voiceLabel', { duration: formatDuration(post.audio.durationSec) })}
            />
          </div>
          {post.audio.transcript && (
            <div
              style={{
                marginTop: 8,
                padding: 10,
                background: 'var(--cr-surface-2)',
                borderRadius: 'var(--cr-radius-md)',
                fontSize: 13,
                lineHeight: 1.5,
                color: 'var(--cr-text-3)',
              }}
            >
              <span style={{ fontWeight: 600 }}>{t('transcript')}</span> {post.audio.transcript}
            </div>
          )}
        </div>
      ) : post.kind === 'video' && post.media[0] ? (
        // Poster-first: paint the captured still immediately with
        // preload="metadata" (no full-video preload in the feed). The play badge
        // is a non-interactive cue over the poster that hides once playback
        // starts; the native controls drive actual playback (lightbox/expanded
        // path unchanged). posterUrl is absent on older posts -> plain <video>.
        <div style={{ position: 'relative', margin: '12px 0 0' }}>
          <video
            controls
            // Discourage saving the clip: hide the native download button +
            // PiP, and block the right-click "Save video as" menu. Not real DRM
            // (the bytes are still fetchable), just removes the easy download
            // affordances. Shared with every Connect media player.
            {...noDownloadVideoProps}
            preload="metadata"
            poster={post.media[0].posterUrl || undefined}
            src={post.media[0].url}
            // Feed click -> media. Additive analytics on a click into the video.
            onClick={() =>
              trackEvent(ConnectEvents.feedPostClick, { postId: post._id, target: 'media' })
            }
            onPlay={() => {
              setVideoStarted(true);
              // Video play (feed surface). Fires alongside the existing play-badge
              // toggle; the badge already flips once so this is effectively once.
              trackEvent(ConnectEvents.videoPlay, { surface: 'feed' });
            }}
            style={{ width: '100%', maxHeight: 460, background: '#000', display: 'block' }}
          />
          {!videoStarted && (
            <div
              aria-hidden
              style={{
                position: 'absolute',
                inset: 0,
                display: 'grid',
                placeItems: 'center',
                pointerEvents: 'none',
              }}
            >
              <span
                style={{
                  width: 56,
                  height: 56,
                  display: 'grid',
                  placeItems: 'center',
                  borderRadius: 'var(--cr-radius-full)',
                  background: 'rgba(14,24,68,0.55)',
                  color: '#fff',
                }}
              >
                <Play size={26} aria-hidden style={{ marginInlineStart: 3 }} />
              </span>
            </div>
          )}
        </div>
      ) : post.kind === 'document' && post.media.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, margin: '12px 16px 0' }}>
          {post.media.map((doc, i) => (
            <a
              key={`${doc.url}-${i}`}
              href={doc.url}
              target="_blank"
              rel="noopener noreferrer"
              className="no-underline"
              // Feed click -> link (document / external). Additive analytics; the
              // anchor navigation is untouched.
              onClick={() =>
                trackEvent(ConnectEvents.feedPostClick, { postId: post._id, target: 'link' })
              }
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 12px',
                border: '1px solid var(--cr-border)',
                borderRadius: 'var(--cr-radius-md)',
                fontSize: 13,
                fontWeight: 600,
                color: 'var(--cr-text-2)',
              }}
            >
              <FileText size={16} aria-hidden />
              {doc.caption?.trim() || t('documentLabel')}
            </a>
          ))}
        </div>
      ) : post.kind === 'photo' && post.media.length > 0 ? (
        mediaLayout === 'carousel' && post.media.length >= 2 ? (
          <PhotoCarousel media={post.media} eagerFirst={priority} />
        ) : (
          <PostPhotoGrid
            media={post.media}
            altText={t('imageAlt')}
            moreLabel={(count) => t('moreImages', { count })}
            eagerFirst={priority}
          />
        )
      ) : null}

      {/* Hashtag + intent pills */}
      {(post.hashtags.length > 0 || post.tags.length > 0) && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, margin: '12px 16px 0' }}>
          {post.hashtags.map((tag) => (
            <span
              key={`h-${tag}`}
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: 'var(--cr-primary)',
                background: 'var(--cr-wash-indigo)',
                padding: '3px 9px',
                borderRadius: 'var(--cr-radius-full)',
              }}
            >
              #{tag}
            </span>
          ))}
          {post.tags.map((tag) => (
            <span
              key={`t-${tag}`}
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: 'var(--cr-text-4)',
                background: 'var(--cr-surface-2)',
                padding: '3px 9px',
                borderRadius: 'var(--cr-radius-full)',
              }}
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Footer - primary actions. Save is surfaced here (out of the overflow)
          for quick bookmarking. Like / Comment / Repost group left; the meta +
          Save + Share group right. Word labels collapse to icons on narrow
          widths; counts and tooltips stay so the row never overflows on mobile. */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          marginTop: 12,
          padding: '4px 6px',
          borderTop: '1px solid var(--cr-border-light)',
        }}
      >
        <button
          type="button"
          onClick={toggleReaction}
          aria-pressed={reacted}
          aria-label={t('reactAction')}
          title={t('reactAction')}
          className="inline-flex items-center gap-1.5 transition hover:bg-surface-2 active:scale-[0.97]"
          style={{
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            padding: '8px 12px',
            borderRadius: 'var(--cr-radius-md)',
            fontSize: 13,
            fontWeight: 600,
            color: reacted ? 'var(--cr-primary)' : 'var(--cr-text-4)',
          }}
        >
          <Heart
            size={16}
            aria-hidden
            fill={reacted ? 'currentColor' : 'none'}
            style={{
              transition: 'transform 0.15s ease',
              transform: reacted ? 'scale(1.12)' : 'scale(1)',
            }}
          />
          {reactionCount > 0 ? (
            reactionCount
          ) : (
            <span className="hidden sm:inline">{t('react')}</span>
          )}
        </button>

        <button
          type="button"
          onClick={() => {
            // Feed click -> comments. Additive analytics; the toggle/onboarding
            // redirect below is untouched.
            trackEvent(ConnectEvents.feedPostClick, { postId: post._id, target: 'comments' });
            if (!onboarded) {
              router.push('/connect/onboarding');
              return;
            }
            setShowComments((v) => !v);
          }}
          aria-expanded={showComments}
          aria-label={t('commentAction')}
          title={t('commentAction')}
          className="inline-flex items-center gap-1.5 transition hover:bg-surface-2 active:scale-[0.97]"
          style={{
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            padding: '8px 12px',
            borderRadius: 'var(--cr-radius-md)',
            fontSize: 13,
            fontWeight: 600,
            color: showComments ? 'var(--cr-primary)' : 'var(--cr-text-4)',
          }}
        >
          <MessageCircle size={16} aria-hidden />
          {commentCount > 0 ? (
            commentCount
          ) : (
            <span className="hidden sm:inline">{t('comment')}</span>
          )}
        </button>

        <Dropdown menu={{ items: repostMenuItems }} trigger={['click']} placement="top">
          <button
            type="button"
            aria-label={t('repost.action')}
            title={t('repost.action')}
            className="inline-flex items-center gap-1.5 transition hover:bg-surface-2 active:scale-[0.97]"
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: '8px 12px',
              borderRadius: 'var(--cr-radius-md)',
              fontSize: 13,
              fontWeight: 600,
              color: reposted ? 'var(--cr-primary)' : 'var(--cr-text-4)',
            }}
          >
            <Repeat2 size={16} aria-hidden />
            {repostCount > 0 ? (
              repostCount
            ) : (
              <span className="hidden sm:inline">{t('repost.label')}</span>
            )}
          </button>
        </Dropdown>

        {/* Right group - view count (author-only, desktop), Save toggle, Share.
            View count is private to the post's author (LinkedIn model): only the
            poster sees "N views"; everyone else sees nothing. `isOwnPost` is the
            author gate (viewer === authorId). The public/embedded mirror
            (PublicPostView) shows no count at all. Keep in sync with that file. */}
        <div style={{ marginInlineStart: 'auto', display: 'flex', alignItems: 'center', gap: 2 }}>
          {isOwnPost && post.viewCount > 0 && (
            <span
              className="hidden items-center gap-1.5 sm:inline-flex"
              style={{
                padding: '8px 10px',
                fontSize: 13,
                fontWeight: 600,
                color: 'var(--cr-text-4)',
              }}
            >
              <Eye size={16} aria-hidden />
              {t('views', { count: post.viewCount })}
            </span>
          )}

          <button
            type="button"
            onClick={() => void toggleSave()}
            disabled={saveBusy}
            aria-pressed={saved}
            aria-label={saved ? t('save.saved') : t('save.label')}
            title={saved ? t('save.saved') : t('save.label')}
            className="inline-flex items-center transition hover:bg-surface-2 active:scale-[0.97]"
            style={{
              background: 'transparent',
              border: 'none',
              cursor: saveBusy ? 'default' : 'pointer',
              padding: '8px 12px',
              borderRadius: 'var(--cr-radius-md)',
              color: saved ? 'var(--cr-primary)' : 'var(--cr-text-4)',
            }}
          >
            {saved ? (
              <BookmarkCheck size={16} aria-hidden fill="currentColor" />
            ) : (
              <Bookmark size={16} aria-hidden />
            )}
          </button>

          <Dropdown menu={{ items: shareMenuItems }} trigger={['click']} placement="bottomRight">
            <button
              type="button"
              aria-label={t('share.label')}
              title={t('share.label')}
              className="inline-flex items-center gap-1.5 transition hover:bg-surface-2 active:scale-[0.97]"
              style={{
                padding: '8px 12px',
                borderRadius: 'var(--cr-radius-md)',
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 600,
                color: 'var(--cr-text-4)',
              }}
            >
              <Share2 size={16} aria-hidden />
              <span className="hidden sm:inline">{t('share.label')}</span>
            </button>
          </Dropdown>
        </div>
      </div>

      {showComments && (
        <div style={{ borderTop: '1px solid var(--cr-border-light)' }}>
          <PostComments postId={post._id} viewerId={viewerId} onboarded={onboarded} />
        </div>
      )}

      {quoteOpen && (
        <QuoteRepostModal
          open={quoteOpen}
          original={quoteTarget}
          onCancel={() => setQuoteOpen(false)}
          onPosted={() => {
            setQuoteOpen(false);
            setRepostCount((c) => c + 1);
          }}
        />
      )}

      {editOpen && (
        <EditPostModal
          open={editOpen}
          post={{ ...post, body, editedAt, mediaLayout }}
          onCancel={() => setEditOpen(false)}
          onSaved={({ body: newBody, editedAt: newEditedAt, mediaLayout: newLayout }) => {
            setBody(newBody);
            setEditedAt(newEditedAt);
            if (newLayout) setMediaLayout(newLayout);
            setEditOpen(false);
          }}
        />
      )}

      {reportOpen && (
        <ReportContentModal
          open={reportOpen}
          onClose={() => setReportOpen(false)}
          target={{
            targetType: 'post',
            targetId: String(post._id),
            targetOwnerUserId: post.authorId ? String(post.authorId) : undefined,
            snapshot: (body ?? '').slice(0, 2000),
            targetUrl: `/p/${post._id}`,
          }}
        />
      )}
    </article>
  );
}

/**
 * The photo grid for a `photo` post - up to 4 tiles, "+N" on overflow. Each
 * tile is an AntD `Image` inside a `PreviewGroup`, so a click opens the built-in
 * lightbox (zoom / rotate / prev-next / keyboard, focus-trapped). Photos past
 * the visible 4 are registered (hidden) in the same group, so they stay
 * reachable via the in-lightbox navigation from the "+N" tile.
 */
function PostPhotoGrid({
  media,
  altText,
  moreLabel,
  eagerFirst = false,
}: {
  media: PostMedia[];
  altText: string;
  moreLabel: (count: number) => string;
  /** When true, the first tile paints eagerly (above-the-fold first post). */
  eagerFirst?: boolean;
}) {
  const shown = media.slice(0, 4);
  const overflow = media.length - shown.length;
  return (
    <Image.PreviewGroup>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: shown.length === 1 ? '1fr' : '1fr 1fr',
          gap: 2,
          marginTop: 12,
        }}
      >
        {shown.map((item, i) => (
          <div
            key={`${item.url}-${i}`}
            style={{
              position: 'relative',
              overflow: 'hidden',
              aspectRatio: shown.length === 1 ? '16 / 10' : '1 / 1',
            }}
          >
            <Image
              // Grid cell fetches a ~600px variant; the lightbox (preview.src)
              // keeps the full-res original so zoom stays sharp.
              src={imageVariant(item.url, { w: 600 })}
              preview={{ src: item.url }}
              alt={item.caption?.trim() || altText}
              // Block right-click "Save image as" + drag-save on the photo.
              {...noDownloadImageProps}
              width="100%"
              height="100%"
              loading={eagerFirst && i === 0 ? 'eager' : 'lazy'}
              decoding="async"
              style={{ objectFit: 'cover', display: 'block' }}
              styles={{ root: { width: '100%', height: '100%', display: 'block' } }}
            />
            {overflow > 0 && i === shown.length - 1 && (
              <div
                aria-hidden
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'grid',
                  placeItems: 'center',
                  background: 'rgba(14,24,68,0.55)',
                  color: '#fff',
                  fontSize: 22,
                  fontWeight: 700,
                  pointerEvents: 'none',
                }}
              >
                {moreLabel(overflow)}
              </div>
            )}
          </div>
        ))}
      </div>
      {/* Overflow photos past the visible 4 - not laid out, but registered in
          the PreviewGroup so the lightbox can navigate to them. */}
      {media.slice(4).map((item, i) => (
        <Image
          key={`overflow-${item.url}-${i}`}
          // Hidden, lightbox-only: keep the full URL so zoom stays sharp.
          src={item.url}
          alt={item.caption?.trim() || altText}
          // Block right-click "Save image as" + drag-save in the lightbox.
          {...noDownloadImageProps}
          loading="lazy"
          decoding="async"
          style={{ display: 'none' }}
          styles={{ root: { display: 'none' } }}
        />
      ))}
    </Image.PreviewGroup>
  );
}

export default memo(PostCard);
