import Link from 'next/link';
import ConnectAvatar, { type ConnectOpenStatus } from '@/components/connect/ConnectAvatar';

/**
 * ProfileMiniCard - a compact identity card for a page rail (the small profile
 * summary LinkedIn shows beside the activity / post-detail columns). Avatar +
 * name + headline, linking to the full profile. Server component (presentational
 * only). Built from data the page already has, so it adds no fetch.
 */
interface ProfileMiniCardProps {
  name: string;
  /** Profile URL (own `/connect/profile` or a public `/u/[slug]`). */
  href: string;
  avatarUrl?: string;
  headline?: string;
  /**
   * "open to" ring status. NOT yet wired: this rail card is built from
   * page-local props (an activity-page subject / own profile), not the
   * `getPeopleByIds` people path, so callers pass null today. Plumb a real
   * value when the page resolves it. Forward-compatible.
   */
  status?: ConnectOpenStatus;
}

export default function ProfileMiniCard({
  name,
  href,
  avatarUrl,
  headline,
  status = null,
}: ProfileMiniCardProps) {
  return (
    <section
      className="flex flex-col items-center gap-2 rounded-lg p-4 text-center"
      style={{ border: '1px solid var(--cr-border)', background: 'var(--cr-surface)' }}
    >
      <Link href={href} aria-label={name} className="no-underline">
        {/* openStatus not yet plumbed for this rail surface; null = bare avatar. */}
        <ConnectAvatar name={name} src={avatarUrl} size={56} status={status} />
      </Link>
      <div className="min-w-0">
        <Link
          href={href}
          className="block truncate text-[15px] font-bold no-underline"
          style={{ color: 'var(--cr-text)' }}
        >
          {name}
        </Link>
        {headline ? (
          <p
            className="m-0 mt-0.5 text-[12.5px]"
            style={{
              color: 'var(--cr-text-3)',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {headline}
          </p>
        ) : null}
      </div>
    </section>
  );
}
