// Employee ID-card PDF generator.
//
// What it does: renders printable VERTICAL ID cards (58x88mm, 9 per A4 page,
// cut-guide borders). Each card shows: an owner-uploaded background image as a
// light watermark, the company logo + name in a branded header, the employee
// profile photo (or initials fallback), full name, designation, employee code,
// blood group, work location, emergency contact, and the company address.
//
// Cross-module links:
//   • Member fields come from `TeamMember` (employeeCode, name, designation,
//     bloodGroup, emergencyContact*, location, avatar).
//   • Branding: company logo via `branding.pdfHeaderLogo ?? branding.logo`;
//     the light card background via `branding.idCardBackground` (owner upload in
//     BrandingSection). Brand colour from the `--cr-primary` CSS var.
//   • Company address = `Workspace.address` (single source of truth) passed via
//     IdCardOptions.companyAddress.
//   • Called from the member detail header (single) and the team list bulk bar
//     (selected members).
//
// Watch: the spec is "city name only" for work location. `location` is a
// free-text field, so we take the first comma-separated segment. jspdf is
// lazy-imported to keep it out of SSR; images load best-effort (a failed image
// degrades to initials / no watermark, the card still renders).

import { loadImageAsBase64 } from './imageUtils';

export interface IdCardMember {
  name: string;
  employeeCode?: string | null;
  designation?: string | null;
  bloodGroup?: string | null;
  emergencyContactName?: string | null;
  emergencyContactNumber?: string | null;
  /** Free-text work location; only the city segment is printed. */
  location?: string | null;
  avatar?: string | null;
}

export interface IdCardOptions {
  workspaceName: string;
  logoUrl?: string | null;
  /** Owner-uploaded background image (branding.idCardBackground) — light watermark. */
  backgroundUrl?: string | null;
  /** Company postal address (Workspace.address) printed in the card footer. */
  companyAddress?: string | null;
}

/** "Surat, Gujarat 395007" -> "Surat". Empty in -> ''. */
export function cityFromLocation(location?: string | null): string {
  if (!location) return '';
  const first = location.split(',')[0]?.trim() ?? '';
  return first;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function brandRgb(): [number, number, number] {
  const raw =
    (typeof document !== 'undefined' &&
      getComputedStyle(document.documentElement).getPropertyValue('--cr-primary').trim()) ||
    '#3730a3';
  const clean = raw.replace('#', '');
  if (clean.length < 6) return [55, 48, 163];
  return [
    parseInt(clean.substring(0, 2), 16),
    parseInt(clean.substring(2, 4), 16),
    parseInt(clean.substring(4, 6), 16),
  ];
}

/**
 * Generate the cards PDF and trigger a download. Photos / logo / background
 * load best-effort: a failed image just falls back (initials block, shifted
 * header, no watermark) and the card still renders.
 */
export async function generateIdCardsPdf(
  members: IdCardMember[],
  options: IdCardOptions,
): Promise<void> {
  if (members.length === 0) return;
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });

  const [br, bg, bb] = brandRgb();

  // Shared images (logo + background) load once; photos load per-member.
  const logoBase64 = options.logoUrl ? await loadImageAsBase64(options.logoUrl) : null;
  const backgroundBase64 = options.backgroundUrl
    ? await loadImageAsBase64(options.backgroundUrl)
    : null;
  const photos = await Promise.all(
    members.map((m) => (m.avatar ? loadImageAsBase64(m.avatar) : Promise.resolve(null))),
  );

  // ── Page / grid geometry (mm) — vertical cards, 3 x 3 per A4 page ────────
  const CARD_W = 58;
  const CARD_H = 88;
  const COLS = 3;
  const ROWS = 3;
  const PER_PAGE = COLS * ROWS;
  const GAP_X = 8;
  const GAP_Y = 6;
  const MARGIN_X = (210 - (COLS * CARD_W + (COLS - 1) * GAP_X)) / 2;
  const MARGIN_Y = (297 - (ROWS * CARD_H + (ROWS - 1) * GAP_Y)) / 2;

  const truncate = (text: string, maxW: number, size: number): string => {
    doc.setFontSize(size);
    if (doc.getTextWidth(text) <= maxW) return text;
    let t = text;
    while (t.length > 1 && doc.getTextWidth(`${t}…`) > maxW) t = t.slice(0, -1);
    return `${t}…`;
  };

  // Draw an image scaled to FIT inside a box (preserve aspect ratio), centered.
  const drawFitted = (
    data: string,
    boxX: number,
    boxY: number,
    boxW: number,
    boxH: number,
  ): void => {
    try {
      const props = doc.getImageProperties(data);
      const aspect = props.width / props.height;
      let w = boxW;
      let h = boxW / aspect;
      if (h > boxH) {
        h = boxH;
        w = boxH * aspect;
      }
      const ix = boxX + (boxW - w) / 2;
      const iy = boxY + (boxH - h) / 2;
      doc.addImage(data, ix, iy, w, h, undefined, 'FAST');
    } catch {
      /* ignore bad image */
    }
  };

  // Draw the FRONT of one card at (x, y). `photo` is the pre-loaded avatar
  // base64 (or null → initials fallback).
  const drawCardFront = (m: IdCardMember, photo: string | null, x: number, y: number): void => {
    // ── Background watermark (light) — owner-uploaded, behind everything ───
    if (backgroundBase64) {
      const gs = new (
        doc as unknown as { GState: new (opts: { opacity: number }) => unknown }
      ).GState({ opacity: 0.08 });
      doc.saveGraphicsState();
      doc.setGState(gs);
      drawFitted(backgroundBase64, x + 4, y + 18, CARD_W - 8, CARD_H - 26);
      doc.restoreGraphicsState();
    }

    // Card frame (cut guide).
    doc.setDrawColor(210, 210, 210);
    doc.setLineWidth(0.2);
    doc.roundedRect(x, y, CARD_W, CARD_H, 2, 2, 'S');

    // ── Header band (brand) ───────────────────────────────────────────────
    const HEADER_H = 15;
    doc.setFillColor(br, bg, bb);
    doc.roundedRect(x, y, CARD_W, HEADER_H, 2, 2, 'F');
    doc.rect(x, y + HEADER_H - 3, CARD_W, 3, 'F'); // square off lower header corners

    let nameX = x + 5;
    if (logoBase64) {
      // White rounded chip behind the logo so coloured/transparent logos read
      // against the brand band; logo is aspect-fitted (never squished).
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(x + 3.5, y + 3, 11, 11, 1.5, 1.5, 'F');
      drawFitted(logoBase64, x + 4, y + 3.5, 10, 10);
      nameX = x + 17;
    }
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.text(truncate(options.workspaceName, CARD_W - (nameX - x) - 4, 8.5), nameX, y + 8);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5.2);
    doc.text('EMPLOYEE IDENTITY CARD', nameX, y + 12);

    // ── Photo (centered) ──────────────────────────────────────────────────
    const PHOTO_W = 24;
    const PHOTO_H = 28;
    const PHOTO_X = x + (CARD_W - PHOTO_W) / 2;
    const PHOTO_Y = y + HEADER_H + 3;
    let photoDrawn = false;
    if (photo) {
      try {
        doc.addImage(photo, PHOTO_X, PHOTO_Y, PHOTO_W, PHOTO_H, undefined, 'FAST');
        photoDrawn = true;
      } catch {
        photoDrawn = false;
      }
    }
    if (!photoDrawn) {
      doc.setFillColor(238, 240, 248);
      doc.rect(PHOTO_X, PHOTO_Y, PHOTO_W, PHOTO_H, 'F');
      doc.setTextColor(br, bg, bb);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(20);
      doc.text(initials(m.name), PHOTO_X + PHOTO_W / 2, PHOTO_Y + PHOTO_H / 2 + 3, {
        align: 'center',
      });
    }
    doc.setDrawColor(210, 210, 210);
    doc.setLineWidth(0.3);
    doc.rect(PHOTO_X, PHOTO_Y, PHOTO_W, PHOTO_H, 'S');

    // ── Name + designation (centered) ─────────────────────────────────────
    const cardCx = x + CARD_W / 2;
    const nameY = PHOTO_Y + PHOTO_H + 5;
    doc.setTextColor(20, 20, 20);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(truncate(m.name, CARD_W - 8, 11), cardCx, nameY, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(90, 90, 90);
    doc.text(truncate(m.designation || '-', CARD_W - 8, 8), cardCx, nameY + 4.5, {
      align: 'center',
    });

    // ── Detail rows (label left, value right) ─────────────────────────────
    const lx = x + 5;
    const rx = x + CARD_W - 5;
    let dy = nameY + 8.5;
    doc.setDrawColor(228, 228, 228);
    doc.setLineWidth(0.2);
    doc.line(lx, dy - 2.5, rx, dy - 2.5);

    const detailRow = (label: string, value: string) => {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.3);
      doc.setTextColor(140, 140, 140);
      doc.text(label.toUpperCase(), lx, dy);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(25, 25, 25);
      // Value right-aligned; truncate to the space left of the label.
      const labelW = (() => {
        doc.setFontSize(6.3);
        return doc.getTextWidth(label.toUpperCase());
      })();
      const valueMaxW = CARD_W - 10 - labelW - 2;
      doc.setFontSize(8);
      doc.text(truncate(value || '-', valueMaxW, 8), rx, dy, { align: 'right' });
      dy += 4.5;
    };

    detailRow('Emp Code', m.employeeCode || '-');
    detailRow('Blood Group', m.bloodGroup || '-');
    detailRow('Location', cityFromLocation(m.location) || '-');
    // Emergency contact name and number on their OWN separate rows (per spec),
    // rather than combined on a single line.
    detailRow('Emergency', m.emergencyContactName || '-');
    detailRow('Emergency No', m.emergencyContactNumber || '-');

    // ── Footer: company address ───────────────────────────────────────────
    const address = (options.companyAddress || '').replace(/\s+/g, ' ').trim();
    if (address) {
      const footerTop = y + CARD_H - 7.5;
      doc.setDrawColor(228, 228, 228);
      doc.setLineWidth(0.2);
      doc.line(lx, footerTop, rx, footerTop);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(5.6);
      doc.setTextColor(110, 110, 110);
      const lines = doc.splitTextToSize(address, CARD_W - 8).slice(0, 2);
      doc.text(lines, cardCx, footerTop + 3, { align: 'center' });
    }
  };

  // Standard card rules printed on the BACK. Identical for every employee.
  const BACK_RULES = [
    `This card is the property of ${options.workspaceName}.`,
    'Non-transferable; for official identification only.',
    'Carry and display it while on company premises.',
    'Report loss or theft to HR / Admin immediately.',
    'Misuse may lead to disciplinary action.',
    'Return this card on transfer or end of employment.',
  ];

  // Draw the BACK of one card at (x, y): usage / return / standard rules +
  // a return-to address block and signature line.
  const drawCardBack = (x: number, y: number): void => {
    // Light watermark to match the front.
    if (backgroundBase64) {
      const gs = new (
        doc as unknown as { GState: new (opts: { opacity: number }) => unknown }
      ).GState({ opacity: 0.06 });
      doc.saveGraphicsState();
      doc.setGState(gs);
      drawFitted(backgroundBase64, x + 4, y + 16, CARD_W - 8, CARD_H - 24);
      doc.restoreGraphicsState();
    }

    // Frame (cut guide).
    doc.setDrawColor(210, 210, 210);
    doc.setLineWidth(0.2);
    doc.roundedRect(x, y, CARD_W, CARD_H, 2, 2, 'S');

    // Header band.
    const HEADER_H = 10;
    doc.setFillColor(br, bg, bb);
    doc.roundedRect(x, y, CARD_W, HEADER_H, 2, 2, 'F');
    doc.rect(x, y + HEADER_H - 3, CARD_W, 3, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.text('TERMS OF USE', x + CARD_W / 2, y + 6.5, { align: 'center' });

    // Rules list (bulleted, wrapped).
    const tx = x + 6;
    const textW = CARD_W - 10;
    let by = y + HEADER_H + 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5.6);
    doc.setTextColor(45, 45, 45);
    BACK_RULES.forEach((rule) => {
      doc.setFillColor(br, bg, bb);
      doc.circle(x + 4, by - 1.1, 0.5, 'F');
      const lines = doc.splitTextToSize(rule, textW);
      doc.text(lines, tx, by);
      by += lines.length * 2.7 + 1.5;
    });

    // Return-to block.
    by += 1.5;
    doc.setDrawColor(228, 228, 228);
    doc.setLineWidth(0.2);
    doc.line(x + 4, by, x + CARD_W - 4, by);
    by += 3.5;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(5.6);
    doc.setTextColor(120, 120, 120);
    doc.text('IF FOUND, PLEASE RETURN TO', x + 4, by);
    by += 3.2;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(25, 25, 25);
    doc.text(truncate(options.workspaceName, CARD_W - 8, 6.5), x + 4, by);
    const address = (options.companyAddress || '').replace(/\s+/g, ' ').trim();
    if (address) {
      by += 3;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(5.4);
      doc.setTextColor(110, 110, 110);
      const aLines = doc.splitTextToSize(address, CARD_W - 8).slice(0, 3);
      doc.text(aLines, x + 4, by);
    }

    // Signature line near the bottom.
    const sigY = y + CARD_H - 7;
    doc.setDrawColor(160, 160, 160);
    doc.setLineWidth(0.2);
    doc.line(x + CARD_W - 28, sigY, x + CARD_W - 4, sigY);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5);
    doc.setTextColor(120, 120, 120);
    doc.text('Authorised Signatory', x + CARD_W - 4, sigY + 2.6, { align: 'right' });
  };

  // ── Render pages: for each sheet of up to 9 cards emit a FRONT page then a
  // BACK page. Front/back interleaved per sheet is the correct order for duplex
  // (long-edge) printing; the back grid mirrors columns so each back lands
  // behind its own front after the flip. -> double-sided ID cards.
  const pageCount = Math.ceil(members.length / PER_PAGE);
  for (let p = 0; p < pageCount; p++) {
    if (p > 0) doc.addPage(); // first front page uses the initial doc page
    for (let slot = 0; slot < PER_PAGE; slot++) {
      const i = p * PER_PAGE + slot;
      if (i >= members.length) break;
      const col = slot % COLS;
      const row = Math.floor(slot / COLS);
      const x = MARGIN_X + col * (CARD_W + GAP_X);
      const y = MARGIN_Y + row * (CARD_H + GAP_Y);
      drawCardFront(members[i], photos[i], x, y);
    }
    // Back side for this sheet.
    doc.addPage();
    for (let slot = 0; slot < PER_PAGE; slot++) {
      const i = p * PER_PAGE + slot;
      if (i >= members.length) break;
      const col = slot % COLS;
      const row = Math.floor(slot / COLS);
      const mirroredCol = COLS - 1 - col; // duplex long-edge flip alignment
      const x = MARGIN_X + mirroredCol * (CARD_W + GAP_X);
      const y = MARGIN_Y + row * (CARD_H + GAP_Y);
      drawCardBack(x, y);
    }
  }

  const filename =
    members.length === 1
      ? `id_card_${members[0].name.replace(/\s+/g, '_').toLowerCase()}.pdf`
      : `manekhr_id_cards_${members.length}.pdf`;
  doc.save(filename);
}
