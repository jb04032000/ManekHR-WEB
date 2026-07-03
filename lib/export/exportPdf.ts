import type { ExportOptions } from '@/lib/exportFields/types';
import { loadImageAsBase64 } from './imageUtils';
import dayjs from 'dayjs';

export async function generatePdf<T>(options: ExportOptions<T>): Promise<void> {
  const { jsPDF } = await import('jspdf');
  const autoTable = (await import('jspdf-autotable')).default;

  const {
    data,
    fields,
    selectedFieldKeys,
    filename,
    title,
    branding,
    showExportDate = true,
  } = options;

  const selectedFields = fields.filter((f) => selectedFieldKeys.includes(f.key));

  // ── Brand color ──────────────────────────────────────────────────
  const rawColor = getComputedStyle(document.documentElement)
    .getPropertyValue('--cr-primary')
    .trim();
  const brandHex = rawColor || 'var(--cr-indigo-400)';
  const hexToRgb = (hex: string): [number, number, number] => {
    const clean = hex.replace('#', '');
    return [
      parseInt(clean.substring(0, 2), 16),
      parseInt(clean.substring(2, 4), 16),
      parseInt(clean.substring(4, 6), 16),
    ];
  };
  const [r, g, b] = hexToRgb(brandHex);

  // ── Pre-load branding images ─────────────────────────────────────
  let headerLogoBase64: string | null = null;
  let watermarkBase64: string | null = null;
  if (branding) {
    [headerLogoBase64, watermarkBase64] = await Promise.all([
      branding.includeHeaderLogo && branding.headerLogoUrl
        ? loadImageAsBase64(branding.headerLogoUrl)
        : Promise.resolve(null),
      branding.includeWatermark && branding.watermarkLogoUrl
        ? loadImageAsBase64(branding.watermarkLogoUrl)
        : Promise.resolve(null),
    ]);
  }

  // ── Document setup ───────────────────────────────────────────────
  const autoOrientation = selectedFields.length >= 8 ? 'landscape' : 'portrait';
  const resolvedOrientation =
    !options.orientation || options.orientation === 'auto' ? autoOrientation : options.orientation;
  const isLandscape = resolvedOrientation === 'landscape';
  const doc = new jsPDF({
    orientation: resolvedOrientation,
    unit: 'mm',
    format: 'a4',
  });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 14;

  let cursorY = 10;

  // ── Letterhead zone (only if logo exists) ────────────────────────
  if (headerLogoBase64) {
    cursorY = 1;
    // Get natural image dimensions to preserve aspect ratio
    const aspectRatio = await new Promise<number>((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img.naturalWidth / img.naturalHeight);
      img.onerror = () => resolve(3); // fallback aspect ratio
      img.src = headerLogoBase64!;
    });

    // Max display width for letterhead logo - scale by width instead of height
    const maxLogoW = pageWidth * 0.85; // 85% of page width

    // Compute display dimensions preserving aspect ratio based on width
    let displayW = maxLogoW;
    let displayH = displayW / aspectRatio;

    // Optional: cap height if needed
    const maxLogoH = 30; // Allow up to 30mm height
    if (displayH > maxLogoH) {
      displayH = maxLogoH;
      displayW = displayH * aspectRatio;
    }

    // Center logo horizontally
    const logoX = (pageWidth - displayW) / 2;
    const logoY = cursorY;

    doc.addImage(headerLogoBase64, 'PNG', logoX, logoY, displayW, displayH, undefined, 'FAST');

    cursorY = logoY + displayH + 2;

    // Thin brand accent line below logo
    doc.setFillColor(r, g, b);
    doc.rect(marginX, cursorY, pageWidth - 2 * marginX, 0.5, 'F');

    cursorY += 7;
  }

  // ── Document title row ───────────────────────────────────────────
  // Title left, export date right - clean dark text, no background
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(25, 25, 25);
  doc.text(title, marginX, cursorY);

  if (showExportDate) {
    const exportedAt = dayjs().format('DD MMM YYYY, hh:mm A');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text(`Exported: ${exportedAt}`, pageWidth - marginX, cursorY, {
      align: 'right',
    });
  }

  cursorY += 7;

  // ── Data table ───────────────────────────────────────────────────
  const tableHead = [selectedFields.map((f) => f.label)];
  const tableBody = data.map((row) =>
    selectedFields.map((f) => {
      const rawValue = f.getValue(row);
      const finalValue = f.pdfValue ? f.pdfValue(row) : rawValue;
      return String(finalValue ?? '');
    }),
  );

  const tableWidth = isLandscape ? 'auto' : pageWidth - 2 * marginX;
  const marginXAdjusted = marginX;
  const hasFooter = !!(branding?.includeFooter && branding.footerText);
  const footerReserved = 8;

  autoTable(doc, {
    startY: cursorY,
    head: tableHead,
    body: tableBody,
    tableWidth,
    headStyles: {
      fillColor: [r, g, b],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
      halign: 'left',
      cellPadding: { top: 3.5, bottom: 3.5, left: 4, right: 4 },
    },
    bodyStyles: {
      fontSize: 7.5,
      textColor: [40, 40, 40],
      cellPadding: { top: 3, bottom: 3, left: 4, right: 4 },
      font: 'helvetica',
      fontStyle: 'normal',
    },
    alternateRowStyles: {
      fillColor: [246, 248, 251],
    },
    columnStyles: {},
    margin: {
      left: marginXAdjusted,
      right: marginXAdjusted,
      bottom: footerReserved,
    },
    styles: {
      overflow: 'linebreak',
      lineColor: [215, 218, 224],
      lineWidth: 0.15,
    },
    didParseCell: (hookData) => {
      if (hookData.section !== 'body') return;
      const field = selectedFields[hookData.column.index];
      if (!field?.pdf?.getCellColors) return;
      const colors = field.pdf.getCellColors(hookData.cell.raw as string | number);
      if (!colors) return;
      if (colors.fill) hookData.cell.styles.fillColor = colors.fill;
      if (colors.text) hookData.cell.styles.textColor = colors.text;
    },
    didDrawPage: (hookData) => {
      const currentPage = hookData.pageNumber;
      const totalPages = doc.getNumberOfPages();

      // ── Watermark ────────────────────────────────────────────────
      if (watermarkBase64) {
        const wmProps = doc.getImageProperties(watermarkBase64);
        const wmAspect = wmProps.width / wmProps.height;
        const wmSize = Math.min(pageWidth, pageHeight) * 0.45;
        const wmW = wmAspect >= 1 ? wmSize : wmSize * wmAspect;
        const wmH = wmAspect >= 1 ? wmSize / wmAspect : wmSize;
        const wmX = (pageWidth - wmW) / 2;
        const wmY = (pageHeight - wmH) / 2;
        const gs = new (
          doc as unknown as { GState: new (opts: { opacity: number }) => unknown }
        ).GState({ opacity: 0.08 });
        doc.saveGraphicsState();
        doc.setGState(gs);
        doc.addImage(watermarkBase64, 'PNG', wmX, wmY, wmW, wmH);
        doc.restoreGraphicsState();
      }

      // ── Footer ───────────────────────────────────────────────────
      const footerLineY = pageHeight - footerReserved;

      // Footer background strip
      doc.setFillColor(248, 249, 250);
      doc.rect(0, footerLineY - 1, pageWidth, footerReserved + 1, 'F');

      // Footer top border line
      doc.setDrawColor(r, g, b);
      doc.setLineWidth(0.4);
      doc.line(0, footerLineY - 1, pageWidth, footerLineY - 1);

      if (hasFooter) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.5);
        doc.setTextColor(100, 100, 100);
        doc.text(branding!.footerText!, marginX, footerLineY + 4, {
          maxWidth: pageWidth * 0.65,
        });
      }

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(100, 100, 100);
      doc.text(`Page ${currentPage} of ${totalPages}`, pageWidth - marginX, footerLineY + 4, {
        align: 'right',
      });
    },
  });

  // ── Download ─────────────────────────────────────────────────────
  const dateStr = dayjs().format('YYYY-MM-DD');
  doc.save(`${filename}_export_${dateStr}.pdf`);
}
