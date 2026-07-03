import { applyWatermark, deriveWatermark } from './watermark';
import { addCopyStamp } from './multiCopy';
import type { ThemeId, PrintableVoucher, FirmProfile, PartyProfile, PrintOptions } from './types';

export type { ThemeId, PrintOptions } from './types';
export type { WatermarkText, FirmProfile, PartyProfile, PrintableVoucher } from './types';

type ThemeRenderer = (
  voucher: PrintableVoucher,
  firm: FirmProfile,
  party: PartyProfile,
  opts: PrintOptions,
) => Promise<unknown>;

const RENDERERS: Record<ThemeId, () => Promise<ThemeRenderer>> = {
  'a4-theme1': () => import('./themes/a4-theme1').then((m) => m.renderA4Theme1),
  'a4-theme2': () => import('./themes/a4-theme2').then((m) => m.renderA4Theme2),
  'a4-theme3-vyapar': () => import('./themes/a4-theme3-vyapar').then((m) => m.renderA4Theme3Vyapar),
  'thermal-2inch': () => import('./themes/thermal-2inch').then((m) => m.renderThermal2inch),
  'thermal-3inch': () => import('./themes/thermal-3inch').then((m) => m.renderThermal3inch),
  'job-work-challan': () => import('./themes/job-work-challan').then((m) => m.renderJobWorkChallan),
};

/**
 * Generate a single PDF doc (first copy only).
 * For multi-copy use generatePdfPerCopy.
 */
export async function generatePdf(
  theme: ThemeId,
  voucher: PrintableVoucher,
  firm: FirmProfile,
  party: PartyProfile,
  opts: Partial<PrintOptions>,
): Promise<unknown> {
  const renderer = await RENDERERS[theme]();
  const isThermal = theme === 'thermal-2inch' || theme === 'thermal-3inch';
  const copies = isThermal ? ['Original' as const] : (opts.copies ?? ['Original' as const]);
  const watermark = deriveWatermark(voucher, opts.watermark);
  const printOpts: PrintOptions = {
    theme,
    copies,
    watermark,
    qrBase64: opts.qrBase64,
    irpQrBase64: opts.irpQrBase64,
  };
  const doc = await renderer(voucher, firm, party, printOpts);
  addCopyStamp(doc as Parameters<typeof addCopyStamp>[0], copies[0]);
  if (watermark) applyWatermark(doc as Parameters<typeof applyWatermark>[0], watermark);
  return doc;
}

/**
 * Generate one PDF document per copy (CGST Rule 48 multi-copy compliance).
 * Returns an array of { label, doc } for each copy selected.
 */
export async function generatePdfPerCopy(
  theme: ThemeId,
  voucher: PrintableVoucher,
  firm: FirmProfile,
  party: PartyProfile,
  opts: Partial<PrintOptions>,
): Promise<{ label: 'Original' | 'Duplicate' | 'Triplicate'; doc: unknown }[]> {
  const renderer = await RENDERERS[theme]();
  const isThermal = theme === 'thermal-2inch' || theme === 'thermal-3inch';
  const copies = isThermal
    ? (['Original'] as ('Original' | 'Duplicate' | 'Triplicate')[])
    : (opts.copies ?? (['Original'] as ('Original' | 'Duplicate' | 'Triplicate')[]));
  const watermark = deriveWatermark(voucher, opts.watermark);
  const out: { label: 'Original' | 'Duplicate' | 'Triplicate'; doc: unknown }[] = [];

  for (const label of copies) {
    const printOpts: PrintOptions = {
      theme,
      copies,
      watermark,
      qrBase64: opts.qrBase64,
      irpQrBase64: opts.irpQrBase64,
    };
    const doc = await renderer(voucher, firm, party, printOpts);
    addCopyStamp(doc as Parameters<typeof addCopyStamp>[0], label);
    if (watermark) applyWatermark(doc as Parameters<typeof applyWatermark>[0], watermark);
    out.push({ label, doc });
  }

  return out;
}
