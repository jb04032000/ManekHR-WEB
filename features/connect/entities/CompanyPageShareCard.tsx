'use client';

import { useEffect, useState } from 'react';
import { QRCodeCanvas, QRCodeSVG } from 'qrcode.react';
import { Modal } from 'antd';
import { useTranslations } from 'next-intl';
import { Check, Copy, Download, Mail, Share2 } from 'lucide-react';

const QR_DOWNLOAD_ID = 'cn-company-qr-download';

/**
 * CompanyPageShareCard - the manage console's share block, India-first: WhatsApp
 * is the dominant action (big button + helper), the QR is secondary (small, tap
 * to enlarge) with copy-link + a high-res QR download exposed inline. The full
 * dialog (tap the QR) carries the enlarged QR + native share. Mirrors the shipped
 * StorefrontShareCard so both consoles share one share vocabulary.
 *
 * The absolute URL is built from the live origin (client-only) so it works on
 * any deploy host without a configured base URL. A hidden 1024px canvas backs
 * the PNG download so the saved QR is crisp enough for print / packaging.
 */
export default function CompanyPageShareCard({
  slug,
  name,
  onShared,
}: {
  slug: string;
  name: string;
  /** Fired when the owner acts on a share (WhatsApp / copy / native) - lets the
   *  host mark the "share your link" setup step done. */
  onShared?: () => void;
}) {
  const t = useTranslations('connect.companyPageAdmin');
  const [origin, setOrigin] = useState('');
  const [canNativeShare, setCanNativeShare] = useState(false);
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // Client-only values (unknown during SSR): set once after hydration.
    /* eslint-disable react-hooks/set-state-in-effect */
    setOrigin(window.location.origin);
    setCanNativeShare(typeof navigator !== 'undefined' && typeof navigator.share === 'function');
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  const url = origin ? `${origin}/company/${slug}` : '';
  const shareText = t('shareWaText', { name });
  const waHref = url ? `https://wa.me/?text=${encodeURIComponent(`${shareText} ${url}`)}` : '#';
  const mailHref = url
    ? `mailto:?subject=${encodeURIComponent(name)}&body=${encodeURIComponent(`${shareText} ${url}`)}`
    : '#';

  const copy = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      onShared?.();
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard blocked - no-op */
    }
  };

  const downloadQr = () => {
    const canvas = document.getElementById(QR_DOWNLOAD_ID) as HTMLCanvasElement | null;
    if (!canvas) return;
    const link = document.createElement('a');
    link.href = canvas.toDataURL('image/png');
    link.download = `${slug}-qr.png`;
    link.click();
  };

  const nativeShare = async () => {
    if (!url) return;
    try {
      await navigator.share?.({ title: name, text: shareText, url });
      onShared?.();
    } catch {
      /* user dismissed - no-op */
    }
  };

  return (
    <>
      {/* Hidden hi-res canvas backing the PNG download (print quality). */}
      {url && (
        <div aria-hidden style={{ position: 'absolute', left: -9999, top: 0 }}>
          {/* 1024px PNG so the saved QR is crisp at print sizes (~3.4in @ 300dpi). */}
          <QRCodeCanvas id={QR_DOWNLOAD_ID} value={url} size={1024} />
        </div>
      )}

      <div className="flex flex-col">
        <div className="flex flex-col gap-2.5 p-4">
          {/* The public address - the thing being shared, read-only, with copy. */}
          <div
            className="flex items-center gap-2 rounded-md px-3 py-2"
            style={{ background: 'var(--cr-surface-2)', border: '1px solid var(--cr-border)' }}
          >
            <span
              className="min-w-0 flex-1 truncate font-mono text-[11.5px]"
              style={{ color: 'var(--cr-text-3)' }}
            >
              {url || `/company/${slug}`}
            </span>
            <button
              type="button"
              onClick={copy}
              aria-label={copied ? t('linkCopied') : t('copyLink')}
              className="shrink-0 rounded-sm p-1"
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: copied ? 'var(--cr-success)' : 'var(--cr-text-4)',
              }}
            >
              {copied ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />}
            </button>
          </div>

          {/* WhatsApp - the dominant action. */}
          <a
            href={waHref}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => onShared?.()}
            className="flex items-center justify-center gap-2 rounded-md px-4 py-2.5 text-[14px] font-semibold text-white no-underline"
            style={{ background: '#25D366' }}
          >
            {t('shareWhatsapp')}
          </a>
          <p
            className="m-0 text-center text-[12px] leading-snug"
            style={{ color: 'var(--cr-text-4)' }}
          >
            {t('shareWhatsappHelp')}
          </p>

          {/* Copy / Email / More - secondary share routes. */}
          <div
            className="grid gap-2"
            style={{ gridTemplateColumns: canNativeShare ? '1fr 1fr 1fr' : '1fr 1fr' }}
          >
            <button type="button" onClick={copy} className="cn-quiet-btn justify-center">
              {copied ? <Check size={13} aria-hidden /> : <Copy size={13} aria-hidden />}
              {copied ? t('copied') : t('copyShort')}
            </button>
            <a
              href={mailHref}
              onClick={() => onShared?.()}
              className="cn-quiet-btn justify-center no-underline"
            >
              <Mail size={13} aria-hidden /> {t('shareEmail')}
            </a>
            {canNativeShare && (
              <button type="button" onClick={nativeShare} className="cn-quiet-btn justify-center">
                <Share2 size={13} aria-hidden /> {t('shareMore')}
              </button>
            )}
          </div>
        </div>

        {/* QR for packaging - framed for print use (labels / flyers / cards). */}
        <div
          className="flex items-center gap-3 p-4"
          style={{ borderTop: '1px solid var(--cr-border-light)' }}
        >
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label={t('shareTitle')}
            className="shrink-0 rounded-md p-1"
            style={{ border: '1px solid var(--cr-border)', background: '#fff', cursor: 'pointer' }}
          >
            {url ? (
              <QRCodeSVG value={url} size={64} title={t('shareQrAlt')} />
            ) : (
              <span style={{ display: 'block', width: 64, height: 64 }} aria-hidden />
            )}
          </button>
          <div className="min-w-0 flex-1">
            <p className="m-0 text-[13px] font-semibold" style={{ color: 'var(--cr-text)' }}>
              {t('qrPackagingTitle')}
            </p>
            <button
              type="button"
              onClick={downloadQr}
              className="mt-0.5 inline-flex items-center gap-1 text-[12.5px] font-semibold"
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--cr-primary)',
                padding: 0,
              }}
            >
              <Download size={13} aria-hidden /> {t('qrDownload')}
            </button>
            <p
              className="m-0 mt-0.5 text-[11px] leading-snug"
              style={{ color: 'var(--cr-text-4)' }}
            >
              {t('qrPackagingHint')}
            </p>
          </div>
        </div>
      </div>

      <Modal
        open={open}
        onCancel={() => setOpen(false)}
        title={t('shareTitle')}
        footer={null}
        width={380}
        destroyOnHidden
        centered
      >
        <div className="flex flex-col items-center gap-3 pb-1">
          {url && (
            <span
              className="rounded-lg p-2"
              style={{ border: '1px solid var(--cr-border)', background: '#fff' }}
            >
              <QRCodeSVG value={url} size={196} title={t('shareQrAlt')} />
            </span>
          )}
          <code
            className="block max-w-full truncate text-[12.5px]"
            style={{ color: 'var(--cr-text-4)' }}
          >
            {url}
          </code>
          <div className="grid w-full gap-2" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <a
              href={waHref}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => onShared?.()}
              className="inline-flex items-center justify-center rounded-md px-3 py-1.5 text-[12.5px] font-semibold text-white no-underline"
              style={{ background: '#25D366' }}
            >
              {t('shareWhatsapp')}
            </a>
            <button type="button" onClick={copy} className="cn-quiet-btn justify-center">
              {copied ? <Check size={13} aria-hidden /> : <Copy size={13} aria-hidden />}
              {copied ? t('copied') : t('copyLink')}
            </button>
            <button type="button" onClick={downloadQr} className="cn-quiet-btn justify-center">
              <Download size={13} aria-hidden /> {t('shareDownloadQr')}
            </button>
            {canNativeShare && (
              <button type="button" onClick={nativeShare} className="cn-quiet-btn justify-center">
                <Share2 size={13} aria-hidden /> {t('shareNative')}
              </button>
            )}
          </div>
        </div>
      </Modal>
    </>
  );
}
