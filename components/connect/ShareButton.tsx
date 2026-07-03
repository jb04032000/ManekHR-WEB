'use client';

/**
 * ShareButton - WhatsApp-first share affordance for public Connect entities.
 *
 * WhatsApp is the dominant share channel in the Surat textile market, so the
 * primary button is a wa.me deep link that pre-fills a short, plain, no-hype
 * message + the canonical URL. A secondary button is the generic fallback: the
 * OS-native share sheet (navigator.share) when the device supports it, else
 * copy-link. Every path fires the typed `connect.share` analytics event with the
 * surface + channel (no entity id / PII on the wire).
 *
 * Cross-module:
 *  - Pure URL/encoding helpers live in `lib/connect/share.ts` (waMeHref,
 *    nativeShareSupported) so they unit-test without React.
 *  - Prefilled message copy lives under the `connect.share` i18n namespace
 *    (all four locales) so the sharer's text matches their language.
 *  - Placed on: product/job/store/company/post public pages + the owner's own
 *    RFQ (share to attract quotes). `surface` selects the right message.
 *
 * Gotcha: pass an ABSOLUTE `url` (the page's canonical), not a relative path -
 * the recipient opens it cold. navigator.share rejects with AbortError when the
 * user dismisses the sheet; that is a non-event and is swallowed silently.
 */

import { useState } from 'react';
import { App, Button, Tooltip } from 'antd';
import { Check, Link2, MessageCircle, Share2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  ConnectEvents,
  trackEvent,
  type ShareChannel,
  type ShareSurface,
} from '@/lib/analytics-events';
import { nativeShareSupported, waMeHref } from '@/lib/connect/share';

interface ShareButtonProps {
  /** The entity type this button sits on - selects the prefilled message + the
   *  analytics `surface`. */
  surface: ShareSurface;
  /** The ABSOLUTE canonical URL of the entity (what the recipient opens). */
  url: string;
  /** The entity display name, woven into the prefilled WhatsApp text. */
  name: string;
  /** AntD button size (default 'middle'). The owner RFQ row uses 'small'. */
  size?: 'small' | 'middle' | 'large';
  /** Optional extra classes on the wrapping flex row. */
  className?: string;
}

export default function ShareButton({
  surface,
  url,
  name,
  size = 'middle',
  className,
}: ShareButtonProps) {
  const t = useTranslations('connect.share');
  const { message } = App.useApp();
  const [copied, setCopied] = useState(false);

  // Short, plain, no-hype prefilled message (localized). The URL is appended so
  // WhatsApp renders a link-preview card and copy/native paths carry context.
  const shareText = t(`text.${surface}`, { name, url });

  const fire = (channel: ShareChannel) => trackEvent(ConnectEvents.share, { surface, channel });

  const onWhatsApp = () => {
    fire('whatsapp');
    window.open(waMeHref(shareText), '_blank', 'noopener,noreferrer');
  };

  const onFallback = async () => {
    if (nativeShareSupported()) {
      try {
        await (navigator as Navigator).share({ title: name, text: shareText, url });
        fire('native');
      } catch {
        // User dismissed the native sheet (AbortError) or it failed - non-event.
      }
      return;
    }
    // No native sheet -> copy the canonical link.
    try {
      await navigator.clipboard.writeText(url);
      fire('copy');
      setCopied(true);
      message.success(t('copied'));
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      message.error(t('copyFailed'));
    }
  };

  const fallbackIsNative = nativeShareSupported();

  return (
    <div className={`flex items-center gap-2 ${className ?? ''}`}>
      <Button
        type="primary"
        size={size}
        onClick={onWhatsApp}
        icon={<MessageCircle size={16} aria-hidden />}
      >
        {t('whatsapp')}
      </Button>
      <Tooltip title={fallbackIsNative ? t('share') : t('copy')}>
        <Button
          size={size}
          onClick={onFallback}
          aria-label={fallbackIsNative ? t('share') : t('copy')}
          icon={
            fallbackIsNative ? (
              <Share2 size={16} aria-hidden />
            ) : copied ? (
              <Check size={16} aria-hidden />
            ) : (
              <Link2 size={16} aria-hidden />
            )
          }
        />
      </Tooltip>
    </div>
  );
}
