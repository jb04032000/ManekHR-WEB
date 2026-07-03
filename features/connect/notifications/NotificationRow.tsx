'use client';

/**
 * NotificationRow - one notification card for the center. Renders grouped actor
 * faces ("+N"), a category tag, an opportunistic context line (only from known
 * metadata, never fabricated), a per-row primary action button (deep link), the
 * unread dot, and the delete affordance. Pure presentation: the parent
 * (NotificationsScreen) resolves actors + handles click/delete.
 * Cross-links: presentation helpers in notification-presentation.ts.
 */

import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { Bell, Building2, Trash2 } from 'lucide-react';
import dayjs from 'dayjs';
import type { NotificationItem } from './notifications.actions';
import type { PersonRef } from '@/features/connect/network.types';
import { primaryAction, tagKeyOf } from './notification-presentation';

interface NotificationRowProps {
  item: NotificationItem;
  /** The latest actor (avatar+name) if resolved. */
  actor?: PersonRef;
  /** Up to 3 resolved actors for the stacked faces (batched rows). */
  faces?: PersonRef[];
  onOpen: (item: NotificationItem) => void;
  onDelete: (id: string) => void;
}

/** Context line from known metadata only. Returns '' when nothing is known. */
function contextLine(item: NotificationItem): string {
  const m = (item.metadata ?? {}) as Record<string, unknown>;
  const parts: string[] = [];
  if (typeof m.location === 'string') parts.push(m.location);
  if (typeof m.applicantCount === 'number') parts.push(`${m.applicantCount} applicants`);
  if (typeof m.mutualCount === 'number') parts.push(`${m.mutualCount} mutual`);
  return parts.join('  ·  ');
}

export default function NotificationRow({
  item,
  actor,
  faces,
  onOpen,
  onDelete,
}: NotificationRowProps) {
  const t = useTranslations('connect.notifications');
  const router = useRouter();
  const action = primaryAction(item);
  const count = item.aggregatedCount ?? 1;
  const lead = actor
    ? count > 1
      ? `${actor.name} ${t('andOthers', { count: count - 1 })}`
      : actor.name
    : item.title;
  const ctx = contextLine(item);
  const stack = (faces && faces.length > 0 ? faces : actor ? [actor] : []).slice(0, 3);

  return (
    <li className="group relative">
      <button
        type="button"
        onClick={() => onOpen(item)}
        className="w-full cursor-pointer rounded-[var(--cr-radius-lg)] border border-border bg-surface px-4 py-3 text-left transition-colors hover:bg-surface-2"
        style={{
          background: item.isRead ? 'var(--cr-surface)' : 'var(--cr-primary-light)',
          borderLeft: item.isRead ? undefined : '3px solid var(--cr-primary)',
        }}
      >
        <div className="flex items-start gap-3">
          {/* Faces: stacked avatars + "+N" for batched rows; glyph fallback. */}
          {stack.length > 0 ? (
            <span className="flex shrink-0 -space-x-2" aria-hidden>
              {stack.map((p, i) => (
                <span
                  key={p.userId}
                  className="h-9 w-9 overflow-hidden rounded-full border-2 bg-cover bg-center"
                  style={{
                    borderColor: 'var(--cr-surface)',
                    zIndex: stack.length - i,
                    ...(p.avatar
                      ? { backgroundImage: `url(${p.avatar})` }
                      : { background: 'var(--cr-primary-light)' }),
                  }}
                >
                  {!p.avatar && (
                    <span
                      className="flex h-full w-full items-center justify-center text-[13px] font-semibold"
                      style={{ color: 'var(--cr-primary)' }}
                    >
                      {p.name.charAt(0).toUpperCase()}
                    </span>
                  )}
                </span>
              ))}
              {count > stack.length && (
                <span
                  className="flex h-9 w-9 items-center justify-center rounded-full border-2 text-[11px] font-bold"
                  style={{
                    borderColor: 'var(--cr-surface)',
                    background: 'var(--cr-surface-2)',
                    color: 'var(--cr-text-3)',
                  }}
                >
                  +{count - stack.length}
                </span>
              )}
            </span>
          ) : (
            <span
              aria-hidden
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
              style={{ background: 'var(--cr-surface-2)', color: 'var(--cr-primary)' }}
            >
              {item.category?.startsWith('connect.') ? <Bell size={16} /> : <Building2 size={16} />}
            </span>
          )}

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p
                className={`m-0 min-w-0 flex-1 truncate text-[14px] text-heading ${
                  item.isRead ? 'font-semibold' : 'font-bold'
                }`}
              >
                {lead}
              </p>
              <span
                className="shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-semibold"
                style={{ background: 'var(--cr-primary-light)', color: 'var(--cr-primary)' }}
              >
                {t(`tag.${tagKeyOf(item)}` as Parameters<typeof t>[0])}
              </span>
              {!item.isRead && (
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ background: 'var(--cr-primary)' }}
                  aria-label={t('filters.unread')}
                />
              )}
            </div>
            <p className="m-0 mt-1 text-[13px] leading-relaxed text-muted">{item.message}</p>
            {ctx && <p className="m-0 mt-1 text-[12px] text-subtle">{ctx}</p>}
            <div className="mt-1.5 flex items-center gap-3">
              <span className="text-[11px] text-subtle">{dayjs(item.createdAt).fromNow()}</span>
              {action && (
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation();
                    void onOpen(item);
                    router.push(action.href);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      e.stopPropagation();
                      // Parity with mouse click: keyboard activation also marks read.
                      void onOpen(item);
                      router.push(action.href);
                    }
                  }}
                  className="cursor-pointer rounded-md border px-2.5 py-1 text-[12px] font-semibold transition-colors"
                  style={{ borderColor: 'var(--cr-border)', color: 'var(--cr-primary)' }}
                >
                  {t(action.labelKey as Parameters<typeof t>[0])}
                </span>
              )}
            </div>
          </div>
        </div>
      </button>
      <button
        type="button"
        onClick={() => onDelete(item._id)}
        aria-label={t('delete')}
        title={t('delete')}
        className="hover:bg-surface-3 absolute top-2 right-2 flex h-7 w-7 cursor-pointer items-center justify-center rounded-md border-none bg-transparent text-subtle opacity-0 transition-opacity group-hover:opacity-100 hover:text-error focus-visible:opacity-100"
      >
        <Trash2 size={14} aria-hidden />
      </button>
    </li>
  );
}
