'use client';

// Phase 16 / FIN-15-04 - Multi-language print preview iframe.
// Re-fetches PDF with ?locale={code} when toggle changes; matches backend
// Noto Sans / Noto Sans Gujarati / Noto Sans Devanagari fonts so on-screen
// rendering matches paper output.
import { startTransition, useEffect, useRef, useState } from 'react';
import DsButton from '@/components/ui/DsButton';
import { LocaleToggle, type PrintLocale } from './LocaleToggle';

export type PrintDocumentType = 'sale-invoice' | 'credit-note' | 'purchase' | 'debit-note';

interface PrintPreviewIframeProps {
  documentType: PrintDocumentType;
  documentId: string;
  /** Used to build proxy URL (kept same-origin per T-16-08-03). */
  wsId: string;
  firmId: string;
  defaultLocale?: PrintLocale;
  onPrint?: () => void;
  onDownload?: () => void;
}

function fontFamilyFor(locale: PrintLocale): string {
  switch (locale) {
    case 'gu':
      return 'Noto Sans Gujarati';
    case 'hi':
      return 'Noto Sans Devanagari';
    default:
      return 'Noto Sans';
  }
}

function languageNameFor(locale: PrintLocale): string {
  switch (locale) {
    case 'gu':
      return 'Gujarati';
    case 'hi':
      return 'Hindi';
    default:
      return 'English';
  }
}

export function PrintPreviewIframe({
  documentType,
  documentId,
  wsId,
  firmId,
  defaultLocale = 'en',
  onPrint,
  onDownload,
}: PrintPreviewIframeProps) {
  const [locale, setLocale] = useState<PrintLocale>(defaultLocale);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  // Same-origin proxy keeps cookies/JWT in flow (mitigates T-16-08-03).
  const baseSrc = `/api/finance/${documentType}/${documentId}/print?wsId=${encodeURIComponent(
    wsId,
  )}&firmId=${encodeURIComponent(firmId)}&locale=${locale}`;
  const previewSrc = `${baseSrc}#toolbar=0`;

  useEffect(() => {
    startTransition(() => {
      setLoading(true);
      setError(null);
    });
  }, [locale]);

  function handlePrint() {
    iframeRef.current?.contentWindow?.print();
    onPrint?.();
  }

  function handleDownload() {
    window.location.assign(baseSrc);
    onDownload?.();
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 bg-page py-2">
        <LocaleToggle value={locale} onChange={setLocale} />
        <div className="flex gap-2">
          <DsButton onClick={handlePrint}>Print PDF</DsButton>
          <DsButton dsVariant="ghost" onClick={handleDownload}>
            Download PDF
          </DsButton>
        </div>
      </div>

      {loading && !error && (
        <div className="animate-pulse rounded bg-surface p-4 text-sm text-muted">
          Rendering preview with {fontFamilyFor(locale)}…
        </div>
      )}

      {error && (
        <div className="flex items-center justify-between gap-3 rounded bg-warning-bg p-4">
          <span className="text-sm">
            Couldn&apos;t load fonts for {languageNameFor(locale)}. Falling back to English.
          </span>
          <DsButton dsSize="sm" onClick={() => setLocale('en')}>
            Reload preview
          </DsButton>
        </div>
      )}

      <iframe
        ref={iframeRef}
        id="print-iframe"
        title="Invoice preview"
        src={previewSrc}
        onLoad={() => setLoading(false)}
        onError={() => {
          setLoading(false);
          setError('font-load-failure');
        }}
        className="w-full rounded border border-border bg-surface"
        style={{ height: '80vh' }}
      />

      <style jsx>{`
        @media (max-width: 767px) {
          iframe#print-iframe {
            height: 60vh !important;
          }
        }
      `}</style>
    </div>
  );
}

export default PrintPreviewIframe;
