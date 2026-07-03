/**
 * MiniProfileCard - left-rail card showing the viewer's identity, headline,
 * and a quick "View profile" link. Mirrors the LinkedIn / X pattern of
 * anchoring the left rail with personal context.
 *
 * Composition:
 *  - Top: banner block (gradient by default; honors `profile.banner` URL
 *    when set). Acts as the brand-tinted color band.
 *  - Mid: `DsAvatar` offset overlapping the banner/content split (LinkedIn
 *    pattern). Bordered to read against the banner.
 *  - Bottom: name (bold), headline (muted, two-line clamp), then a
 *    "View profile" link routing to `/connect/profile`.
 *
 * The card owns its own chrome (no wrapping `<RailPanel>` - banner-overlap
 * needs a bespoke surface). Sits as a direct child of `<Rail side="left">`.
 *
 * Accessibility: the whole card is wrapped in a single `<Link>` so screen
 * readers / keyboard users get one focusable target. The View-profile text
 * inside doubles as the visual cue.
 */
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import ConnectAvatar, { type ConnectOpenStatus } from '@/components/connect/ConnectAvatar';

export interface MiniProfileCardProps {
  /** Display name from the User record. */
  name: string;
  /** Avatar URL - falls back to initials inside `DsAvatar`. */
  avatar: string | null;
  /** Connect headline. Empty/null → falls back to a generic prompt. */
  headline?: string | null;
  /** Connect banner URL. Empty/null → brand gradient. */
  banner?: string | null;
  /**
   * "open to" ring status. NOT yet wired: this left-rail card renders the
   * viewer's OWN identity from page props, not the `getPeopleByIds` people
   * path, so callers pass null today. Plumb a real value when available.
   * Forward-compatible.
   */
  status?: ConnectOpenStatus;
}

export default function MiniProfileCard({
  name,
  avatar,
  headline,
  banner,
  status = null,
}: MiniProfileCardProps) {
  const t = useTranslations('connect.feed.miniProfile');

  const trimmedHeadline = headline?.trim();
  const headlineText = trimmedHeadline && trimmedHeadline.length > 0 ? trimmedHeadline : null;

  return (
    <Link
      href="/connect/profile"
      aria-label={t('aria', { name })}
      className="no-underline"
      style={{
        display: 'block',
        background: 'var(--cr-surface)',
        border: '1px solid var(--cr-border)',
        borderRadius: 'var(--cr-radius-lg)',
        overflow: 'hidden',
        // No padding on the card itself - the banner needs to bleed to the
        // top edges; content below has its own padding.
      }}
    >
      {/* Banner. Honor a profile.banner URL when set; else a brand gradient.
          Fixed 56 px tall - enough for the avatar to land cleanly across
          its top half. */}
      <div
        aria-hidden
        style={{
          height: 56,
          background: banner
            ? `url(${banner}) center / cover no-repeat`
            : 'linear-gradient(135deg, var(--cr-primary) 0%, var(--cr-primary-700) 100%)',
        }}
      />

      {/* Content block - avatar offset upward so it overlaps the banner. */}
      <div style={{ padding: '0 var(--cr-space-md) var(--cr-space-md)' }}>
        <div
          style={{
            marginTop: -24,
            display: 'flex',
            justifyContent: 'flex-start',
            // The avatar needs a solid ring so it reads against the banner.
            // DsAvatar doesn't take a border prop - wrap it.
          }}
        >
          <span
            style={{
              padding: 2,
              background: 'var(--cr-surface)',
              borderRadius: '50%',
              lineHeight: 0,
            }}
          >
            {/* openStatus not yet plumbed for this own-identity rail card; null = bare avatar. */}
            <ConnectAvatar name={name} src={avatar ?? undefined} size={56} status={status} />
          </span>
        </div>

        <p
          style={{
            margin: 'var(--cr-space-sm) 0 0',
            fontSize: 15,
            fontWeight: 700,
            color: 'var(--cr-text)',
            lineHeight: 1.3,
            display: '-webkit-box',
            WebkitLineClamp: 1,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {name}
        </p>

        {headlineText ? (
          <p
            style={{
              margin: '2px 0 0',
              fontSize: 12.5,
              lineHeight: 1.4,
              color: 'var(--cr-text-4)',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {headlineText}
          </p>
        ) : (
          <p
            style={{
              margin: '2px 0 0',
              fontSize: 12.5,
              lineHeight: 1.4,
              color: 'var(--cr-primary)',
              fontWeight: 600,
            }}
          >
            {t('addHeadline')}
          </p>
        )}

        <span
          style={{
            display: 'block',
            marginTop: 'var(--cr-space-sm)',
            paddingTop: 'var(--cr-space-sm)',
            borderTop: '1px solid var(--cr-border-light)',
            fontSize: 12.5,
            fontWeight: 600,
            color: 'var(--cr-primary)',
          }}
        >
          {t('viewProfile')}
        </span>
      </div>
    </Link>
  );
}
