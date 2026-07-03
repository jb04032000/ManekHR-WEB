'use client';
import { useEffect, useMemo, useState, startTransition } from 'react';
import { Radio, Checkbox, Select, Spin } from 'antd';
import DsButton from '@/components/ui/DsButton';
import { generatePdfPerCopy } from '@/lib/finance/print';
import { deriveCopyLabels } from '@/lib/finance/print/multiCopy';
import { financeSalesApi } from '@/lib/api/modules/finance-sales.api';
import { useWorkspaceStore } from '@/lib/store';
import type {
  ThemeId,
  PrintableVoucher,
  FirmProfile,
  PartyProfile,
  WatermarkText,
} from '@/lib/finance/print/types';

interface Props {
  voucher: PrintableVoucher;
  firm: FirmProfile;
  party: PartyProfile;
  voucherType: 'sale_invoice' | 'quotation' | 'sale_order' | 'proforma' | 'delivery_challan';
  firmId: string;
}

const ALL_THEMES: { id: ThemeId; label: string; isThermal?: boolean }[] = [
  { id: 'a4-theme1', label: 'A4 - Classic GST (Theme 1)' },
  { id: 'a4-theme2', label: 'A4 - Modern Minimal (Theme 2)' },
  { id: 'a4-theme3-vyapar', label: 'A4 - GST (Vyapar parity)' },
  { id: 'thermal-2inch', label: 'Thermal 2-inch', isThermal: true },
  { id: 'thermal-3inch', label: 'Thermal 3-inch', isThermal: true },
  { id: 'job-work-challan', label: 'Job-Work Challan' },
];

export function PrintTemplatePicker({ voucher, firm, party, voucherType, firmId }: Props) {
  const ws = useWorkspaceStore((s) => s.currentWorkspace);
  const lsKey = `z360_print_template_${voucherType}`;
  const [theme, setTheme] = useState<ThemeId>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem(lsKey) as ThemeId) ?? 'a4-theme1';
    }
    return 'a4-theme1';
  });
  const defaultCopies = useMemo(() => deriveCopyLabels(voucher), [voucher]);
  const [copies, setCopies] = useState<('Original' | 'Duplicate' | 'Triplicate')[]>(defaultCopies);
  const [watermark, setWatermark] = useState<WatermarkText>(null);
  const [pdfBlobs, setPdfBlobs] = useState<{ label: string; url: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [irpQrBase64, setIrpQrBase64] = useState<string | undefined>();
  // 1c: print language. en uses the in-browser jsPDF themes; gu/hi route through
  // the backend Noto-font PDF (complex-script shaping jsPDF can't do client-side).
  // D24: default the print language to the party's saved preference, falling back to the firm
  // default then 'en'. The per-party preferredLocale was previously ignored (always 'en'), so a
  // Gujarati customer's invoices printed in English unless changed by hand every time.
  const [lang, setLang] = useState<'en' | 'gu' | 'hi'>(
    () => party?.preferredLocale ?? firm?.defaultPrintLocale ?? 'en',
  );
  const useBackendPdf = lang !== 'en' && voucherType === 'sale_invoice' && !!ws?._id;

  // Persist last-used template
  useEffect(() => {
    localStorage.setItem(lsKey, theme);
  }, [theme, lsKey]);

  // Pre-fetch IRP e-Invoice QR for e-invoiced sale invoices (CGST Rule 48)
  useEffect(() => {
    const sv = voucher as unknown as Record<string, unknown>;
    const ei = sv.eInvoice as Record<string, unknown> | undefined;
    if (voucherType !== 'sale_invoice' || !ws?._id || !ei?.irn) return;
    financeSalesApi.invoices
      .irpQr(ws._id, firmId, voucher._id)
      .then((r) => setIrpQrBase64(r.qrDataUrl))
      .catch(() => {
        /* e-Invoice QR fetch failed - silently skip; invoice remains valid but QR absent */
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voucherType, ws?._id, firmId, voucher._id]);

  // Render PDF whenever inputs change - revoke old blob URLs first
  useEffect(() => {
    let cancelled = false;
    startTransition(() => {
      setLoading(true);
      // Cleanup prior blob URLs before generating new ones (T-F02-09-04 mitigation)
      setPdfBlobs((prev) => {
        prev.forEach((b) => URL.revokeObjectURL(b.url));
        return [];
      });
    });
    // gu/hi: render server-side (Noto fonts) and show that single PDF.
    if (useBackendPdf && ws?._id) {
      const backendTheme = theme === 'a4-theme2' ? 'modern' : 'classic';
      financeSalesApi.invoices
        .localizedPdf(ws._id, firmId, voucher._id, lang, backendTheme)
        .then((blob) => {
          if (cancelled) return;
          setPdfBlobs([{ label: 'Original', url: URL.createObjectURL(blob) }]);
        })
        .catch((e) => console.error('Localized PDF render failed:', e))
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
      return () => {
        cancelled = true;
      };
    }

    generatePdfPerCopy(theme, voucher, firm, party, { copies, watermark, irpQrBase64 })
      .then((out) => {
        if (cancelled) return;
        const blobs = out.map(({ label, doc }) => ({
          label,
          url: URL.createObjectURL((doc as { output: (type: string) => Blob }).output('blob')),
        }));
        setPdfBlobs(blobs);
      })
      .catch((e) => console.error('PDF render failed:', e))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme, copies, watermark, irpQrBase64, voucher._id, lang]);

  // Revoke blob URLs on unmount
  useEffect(() => {
    return () => {
      pdfBlobs.forEach((b) => URL.revokeObjectURL(b.url));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePrint = () => {
    const iframe = document.getElementById('print-preview-iframe') as HTMLIFrameElement | null;
    iframe?.contentWindow?.print();
  };

  const handleDownload = async () => {
    // gu/hi: download the already-rendered server PDF blob.
    if (useBackendPdf && pdfBlobs[0]) {
      const a = document.createElement('a');
      a.href = pdfBlobs[0].url;
      a.download = `invoice-${voucher.voucherNumber ?? voucher._id}-${lang}.pdf`;
      a.click();
      return;
    }
    const out = await generatePdfPerCopy(theme, voucher, firm, party, {
      copies,
      watermark,
      irpQrBase64,
    });
    out.forEach(({ label, doc }) => {
      const vt = (voucher as unknown as Record<string, unknown>).voucherType as string;
      (doc as { save: (name: string) => void }).save(
        `${vt ?? 'voucher'}-${voucher.voucherNumber ?? voucher._id}-${label}.pdf`,
      );
    });
  };

  const isThermal = theme === 'thermal-2inch' || theme === 'thermal-3inch';

  return (
    <div className="flex h-screen">
      {/* LEFT: 280px template selector panel */}
      <aside
        className="overflow-y-auto p-4"
        style={{
          width: 280,
          minWidth: 280,
          background: 'var(--cr-surface-2, var(--cr-bg))',
          borderRight: '1px solid var(--cr-border, var(--cr-border))',
        }}
      >
        <h3 className="mb-3 text-sm font-bold">Template</h3>
        <Radio.Group value={theme} onChange={(e) => setTheme(e.target.value as ThemeId)}>
          <div className="flex flex-col gap-2">
            {ALL_THEMES.map((t) => (
              <Radio key={t.id} value={t.id}>
                {t.label}
              </Radio>
            ))}
          </div>
        </Radio.Group>

        {/* 1c: print language - gu/hi render server-side with Noto fonts */}
        {voucherType === 'sale_invoice' && (
          <>
            <h3 className="mt-5 mb-2 text-sm font-bold">Language</h3>
            <Radio.Group
              value={lang}
              onChange={(e) => setLang(e.target.value as 'en' | 'gu' | 'hi')}
            >
              <div className="flex flex-col gap-2">
                <Radio value="en">English</Radio>
                <Radio value="gu">ગુજરાતી (Gujarati)</Radio>
                <Radio value="hi">हिंदी (Hindi)</Radio>
              </div>
            </Radio.Group>
            {useBackendPdf && (
              <p className="mt-1 text-[11px]" style={{ color: 'var(--cr-text-3)' }}>
                Rendered on the server with native fonts. Copies and watermark apply to English
                only.
              </p>
            )}
          </>
        )}

        {/* Copies - hidden for thermal themes */}
        {!isThermal && (
          <>
            <h3 className="mt-5 mb-2 text-sm font-bold">Copies</h3>
            <Checkbox.Group
              value={copies}
              onChange={(v) => setCopies(v as ('Original' | 'Duplicate' | 'Triplicate')[])}
              style={{ display: 'flex', flexDirection: 'column', gap: 4 }}
            >
              <Checkbox value="Original">Original</Checkbox>
              <Checkbox value="Duplicate">Duplicate</Checkbox>
              <Checkbox value="Triplicate">Triplicate</Checkbox>
            </Checkbox.Group>
          </>
        )}

        <h3 className="mt-5 mb-2 text-sm font-bold">Watermark</h3>
        <Select
          value={watermark ?? 'none'}
          onChange={(v) => setWatermark(v === 'none' ? null : (v as WatermarkText))}
          style={{ width: '100%' }}
          options={[
            { value: 'none', label: '(auto)' },
            { value: 'DRAFT', label: 'DRAFT' },
            { value: 'DUPLICATE', label: 'DUPLICATE' },
            { value: 'CONFIDENTIAL', label: 'CONFIDENTIAL' },
            { value: 'PAID', label: 'PAID' },
            { value: 'VOID', label: 'VOID' },
            { value: 'OVERDUE', label: 'OVERDUE' },
          ]}
        />

        <div className="mt-6 flex flex-col gap-2">
          <DsButton
            dsVariant="primary"
            onClick={handlePrint}
            disabled={loading || pdfBlobs.length === 0}
          >
            Print
          </DsButton>
          <DsButton
            dsVariant="ghost"
            onClick={handleDownload}
            disabled={loading || pdfBlobs.length === 0}
          >
            Save PDF
          </DsButton>
        </div>
      </aside>

      {/* RIGHT: PDF preview area */}
      <main className="flex-1 overflow-y-auto p-4" style={{ background: 'var(--cr-border-light)' }}>
        {loading ? (
          <div className="flex h-full items-center justify-center">
            <Spin size="large" />
          </div>
        ) : pdfBlobs.length === 0 ? (
          <div
            className="flex h-full items-center justify-center text-sm"
            style={{ color: 'var(--cr-text-3, var(--cr-text-5))' }}
          >
            Select a template to preview
          </div>
        ) : (
          pdfBlobs.map((b, i) => (
            <div key={i} className="mb-4">
              <div className="mb-1 text-xs" style={{ color: 'var(--cr-text-3, var(--cr-text-5))' }}>
                {b.label}
              </div>
              <iframe
                id={i === 0 ? 'print-preview-iframe' : undefined}
                src={b.url}
                className="w-full"
                style={{
                  height: isThermal ? 600 : 1050,
                  border: '1px solid #ccc',
                  backgroundColor: 'white',
                  borderRadius: 4,
                }}
              />
            </div>
          ))
        )}
      </main>
    </div>
  );
}
