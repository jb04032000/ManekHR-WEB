// ASSUMPTIONS:
// - Holiday type from @/types has a `date` field (string)
// - member.weeklyOff is string[] of day abbreviations like ['Sat', 'Sun'] (ddd format)
// - holiday.name is optional fallback to 'Holiday'

import dayjs from 'dayjs';
import type { TeamMember, Holiday } from '@/types';
import type { ExportBrandingOptions } from '@/lib/exportFields/types';
import { loadImageAsBase64 } from './imageUtils';

interface AttendancePdfOptions {
  members: TeamMember[];
  monthlyRecords: Record<string, Record<string, string>>;
  month?: number;
  year?: number;
  fromDate?: string;
  toDate?: string;
  title: string;
  filename: string;
  branding?: ExportBrandingOptions;
  showExportDate?: boolean;
  holidays?: Holiday[];
}

const S_SHORT: Record<string, string> = {
  present: 'P',
  absent: 'A',
  half_day: 'H',
  late: 'L',
  on_leave: 'OL',
  holiday: 'Ho',
  week_off: 'W',
  unmarked: '-',
};

const STATUS_COLORS: Record<
  string,
  { fill: [number, number, number]; text: [number, number, number] }
> = {
  present: { fill: [220, 252, 231], text: [22, 163, 74] },
  absent: { fill: [254, 226, 226], text: [220, 38, 38] },
  half_day: { fill: [254, 243, 199], text: [217, 119, 6] },
  late: { fill: [219, 234, 254], text: [37, 99, 235] },
  on_leave: { fill: [237, 233, 254], text: [124, 58, 237] },
  holiday: { fill: [237, 233, 254], text: [124, 58, 237] },
  week_off: { fill: [241, 245, 249], text: [148, 163, 184] },
  unmarked: { fill: [255, 255, 255], text: [209, 213, 219] },
};

const WEEKEND_COLORS = {
  fill: [241, 245, 249] as [number, number, number],
  text: [100, 116, 139] as [number, number, number],
};

function renderPageHeader(
  doc: JsPdfInstance,
  title: string,
  pageNumber: number,
  marginX: number,
  r: number,
  g: number,
  b: number,
  pageWidth: number,
): void {
  if (pageNumber <= 1) return;
  (doc as any).setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(25, 25, 25);
  doc.text(title, marginX, 8);
  doc.setFillColor(r, g, b);
  doc.rect(marginX, 10, pageWidth - 2 * marginX, 0.4, 'F');
}

function renderPageDecorations(
  doc: JsPdfInstance,
  hookData: { pageNumber: number },
  pageWidth: number,
  pageHeight: number,
  marginX: number,
  r: number,
  g: number,
  b: number,
  watermarkBase64: string | null,
  branding?: ExportBrandingOptions,
  title?: string,
): void {
  const currentPage = hookData.pageNumber;
  const totalPages = doc.getNumberOfPages();

  if (title) {
    renderPageHeader(doc, title, currentPage, marginX, r, g, b, pageWidth);
  }

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

  const footerLineY = pageHeight - 8;

  doc.setFillColor(248, 249, 250);
  doc.rect(0, footerLineY - 1, pageWidth, 9, 'F');

  doc.setDrawColor(r, g, b);
  doc.setLineWidth(0.4);
  doc.line(0, footerLineY - 1, pageWidth, footerLineY - 1);

  if (branding?.includeFooter && branding.footerText) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 100, 100);
    doc.text(branding.footerText, marginX, footerLineY + 4, {
      maxWidth: pageWidth * 0.65,
    });
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(100, 100, 100);
  doc.text(`Page ${currentPage} of ${totalPages}`, pageWidth - marginX, footerLineY + 4, {
    align: 'right',
  });
}

type JsPdfInstance = InstanceType<typeof import('jspdf').jsPDF>;

export async function generateAttendancePdf(options: AttendancePdfOptions): Promise<void> {
  const { jsPDF } = await import('jspdf');
  const autoTable = (await import('jspdf-autotable')).default;

  const {
    members,
    monthlyRecords,
    month,
    year,
    fromDate,
    toDate,
    title,
    filename,
    branding,
    showExportDate = true,
    holidays = [],
  } = options;

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

  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 10;

  let iterStart: dayjs.Dayjs;
  let iterEnd: dayjs.Dayjs;

  if (fromDate && toDate) {
    iterStart = dayjs(fromDate).startOf('day');
    iterEnd = dayjs(toDate).startOf('day');
  } else {
    iterStart = dayjs()
      .month((month ?? 1) - 1)
      .year(year ?? dayjs().year())
      .startOf('month');
    iterEnd = iterStart.endOf('month').startOf('day');
  }

  const dates: dayjs.Dayjs[] = [];
  let cur = iterStart;
  while (!cur.isAfter(iterEnd)) {
    dates.push(cur);
    cur = cur.add(1, 'day');
  }

  const dayHeaders: string[] = dates.map((d) => `${d.date()}\n${d.format('ddd')}`);
  const dayIsWeekend: boolean[] = dates.map((d) => d.day() === 0 || d.day() === 6);

  const holidayDates = new Set<string>(holidays.map((h) => dayjs(h.date).format('YYYY-MM-DD')));
  const holidayNameMap = new Map<string, string>(
    holidays.map((h) => [dayjs(h.date).format('YYYY-MM-DD'), h.name ?? 'Holiday']),
  );

  let cursorY = 10;

  if (headerLogoBase64) {
    cursorY = 1;
    const aspectRatio = await new Promise<number>((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img.naturalWidth / img.naturalHeight);
      img.onerror = () => resolve(3);
      img.src = headerLogoBase64!;
    });

    const maxLogoW = pageWidth * 0.85;
    let displayW = maxLogoW;
    let displayH = displayW / aspectRatio;
    const maxLogoH = 30;
    if (displayH > maxLogoH) {
      displayH = maxLogoH;
      displayW = displayH * aspectRatio;
    }

    const logoX = (pageWidth - displayW) / 2;
    const logoY = cursorY;

    doc.addImage(headerLogoBase64, 'PNG', logoX, logoY, displayW, displayH, undefined, 'FAST');

    cursorY = logoY + displayH + 2;

    doc.setFillColor(r, g, b);
    doc.rect(marginX, cursorY, pageWidth - 2 * marginX, 0.5, 'F');

    cursorY += 7;
  }

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

  const isRangeMode = fromDate && toDate;

  if (isRangeMode) {
    const monthGroups = new Map<string, dayjs.Dayjs[]>();
    for (const d of dates) {
      const key = d.format('YYYY-MM');
      if (!monthGroups.has(key)) monthGroups.set(key, []);
      monthGroups.get(key)!.push(d);
    }

    let tableStartY = cursorY;

    for (const [, monthDates] of monthGroups) {
      if (monthGroups.size > 1) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(r, g, b);
        doc.text(monthDates[0].format('MMMM YYYY'), marginX, tableStartY + 4);
        tableStartY += 7;
      }

      const monthDayHeaders = monthDates.map((d) => `${d.date()}\n${d.format('ddd')}`);
      const monthDayIsWeekend = monthDates.map((d) => d.day() === 0 || d.day() === 6);

      const headRow = ['Employee Name', ...monthDayHeaders, 'Summary'];

      const bodyRows = members.map((m) => {
        const memberRecords = monthlyRecords[m.id] ?? {};
        const joinDate = m.dateOfJoining ? dayjs(m.dateOfJoining).startOf('day') : null;
        const weeklyOffSet = new Set(m.weeklyOff ?? []);

        const cells: (string | { content: string; styles?: object })[] = [m.name];
        let pCount = 0,
          aCount = 0,
          hCount = 0,
          olCount = 0,
          hoCount = 0,
          woCount = 0;

        for (let idx = 0; idx < monthDates.length; idx++) {
          const d = monthDates[idx];
          const dateKey = d.format('YYYY-MM-DD');
          const dayAbbrev = d.format('ddd');
          const isWeekend = monthDayIsWeekend[idx];

          const isPreJoining = joinDate !== null && d.isBefore(joinDate);
          if (isPreJoining) {
            cells.push({
              content: '·',
              styles: {
                fillColor: [243, 244, 246],
                textColor: [209, 213, 219],
                halign: 'center',
                fontStyle: 'normal',
              },
            });
            continue;
          }

          const hasAttendanceRecord = dateKey in memberRecords;
          const isHoliday = holidayDates.has(dateKey);

          if (isHoliday && !hasAttendanceRecord) {
            hoCount++;
            cells.push({
              content: 'Ho',
              styles: {
                fillColor: STATUS_COLORS.holiday.fill,
                textColor: STATUS_COLORS.holiday.text,
                halign: 'center',
                fontStyle: 'bold',
              },
            });
            continue;
          }

          const isWeeklyOff = weeklyOffSet.has(dayAbbrev) && !hasAttendanceRecord;
          if (isWeeklyOff) {
            woCount++;
            cells.push({
              content: 'W',
              styles: {
                fillColor: STATUS_COLORS.week_off.fill,
                textColor: STATUS_COLORS.week_off.text,
                halign: 'center',
                fontStyle: 'bold',
              },
            });
            continue;
          }

          const status = memberRecords[dateKey] ?? 'unmarked';
          const short = S_SHORT[status] ?? '-';

          if (status === 'present' || status === 'late') pCount++;
          else if (status === 'absent') aCount++;
          else if (status === 'half_day') hCount++;
          else if (status === 'on_leave') olCount++;

          const colors = STATUS_COLORS[status] ?? STATUS_COLORS.unmarked;
          cells.push({
            content: short,
            styles: {
              fillColor: isWeekend ? WEEKEND_COLORS.fill : colors.fill,
              textColor: isWeekend ? WEEKEND_COLORS.text : colors.text,
              halign: 'center',
              fontStyle: 'bold',
            },
          });
        }

        const parts = [`${pCount}P`, `${aCount}A`, `${hCount}H`];
        if (hoCount > 0) parts.push(`${hoCount}Ho`);
        if (woCount > 0) parts.push(`${woCount}W`);
        const summary = parts.join(' / ');

        cells.push({ content: summary, styles: { halign: 'center', fontStyle: 'bold' } });
        return cells;
      });

      autoTable(doc, {
        startY: tableStartY,
        head: [headRow],
        body: bodyRows,
        tableWidth: 'auto',
        headStyles: {
          fillColor: [r, g, b],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          fontSize: 7,
          halign: 'center',
          cellPadding: { top: 2, bottom: 2, left: 1, right: 1 },
        },
        bodyStyles: {
          fontSize: 7,
          textColor: [40, 40, 40],
          cellPadding: { top: 2, bottom: 2, left: 1, right: 1 },
          font: 'helvetica',
          fontStyle: 'normal',
        },
        columnStyles: {
          0: { cellWidth: 35, halign: 'left' },
        },
        margin: { left: marginX, right: marginX, bottom: 12 },
        styles: {
          overflow: 'linebreak',
          lineColor: [215, 218, 224],
          lineWidth: 0.1,
        },
        didDrawPage: (hookData) => {
          renderPageDecorations(
            doc,
            hookData,
            pageWidth,
            pageHeight,
            marginX,
            r,
            g,
            b,
            watermarkBase64,
            branding,
            title,
          );
        },
      });

      tableStartY =
        (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
    }
  } else {
    const headRow = ['Employee Name', ...dayHeaders, 'Summary'];

    const bodyRows = members.map((member) => {
      const memberRecords = monthlyRecords[member.id] ?? {};
      const joinDate = member.dateOfJoining ? dayjs(member.dateOfJoining).startOf('day') : null;
      const weeklyOffSet = new Set(member.weeklyOff ?? []);

      const cells: (string | { content: string; styles?: object })[] = [member.name];
      let pCount = 0,
        aCount = 0,
        hCount = 0,
        olCount = 0,
        hoCount = 0,
        woCount = 0;

      for (let idx = 0; idx < dates.length; idx++) {
        const d = dates[idx];
        const dateKey = d.format('YYYY-MM-DD');
        const dayAbbrev = d.format('ddd');
        const isWeekend = dayIsWeekend[idx];

        const isPreJoining = joinDate !== null && d.isBefore(joinDate);
        if (isPreJoining) {
          cells.push({
            content: '·',
            styles: {
              fillColor: [243, 244, 246] as [number, number, number],
              textColor: [209, 213, 219] as [number, number, number],
              halign: 'center' as const,
              fontStyle: 'normal' as const,
            },
          });
          continue;
        }

        const hasAttendanceRecord = dateKey in memberRecords;
        const isHoliday = holidayDates.has(dateKey);

        if (isHoliday && !hasAttendanceRecord) {
          hoCount++;
          cells.push({
            content: 'Ho',
            styles: {
              fillColor: STATUS_COLORS.holiday.fill,
              textColor: STATUS_COLORS.holiday.text,
              halign: 'center',
              fontStyle: 'bold',
            },
          });
          continue;
        }

        const isWeeklyOff = weeklyOffSet.has(dayAbbrev) && !hasAttendanceRecord;
        if (isWeeklyOff) {
          woCount++;
          cells.push({
            content: 'W',
            styles: {
              fillColor: STATUS_COLORS.week_off.fill,
              textColor: STATUS_COLORS.week_off.text,
              halign: 'center',
              fontStyle: 'bold',
            },
          });
          continue;
        }

        const status = memberRecords[dateKey] ?? 'unmarked';
        const short = S_SHORT[status] ?? '-';

        if (status === 'present' || status === 'late') pCount++;
        else if (status === 'absent') aCount++;
        else if (status === 'half_day') hCount++;
        else if (status === 'on_leave') olCount++;

        const colors = STATUS_COLORS[status] ?? STATUS_COLORS.unmarked;
        cells.push({
          content: short,
          styles: {
            fillColor: isWeekend ? WEEKEND_COLORS.fill : colors.fill,
            textColor: isWeekend ? WEEKEND_COLORS.text : colors.text,
            halign: 'center',
            fontStyle: 'bold',
          },
        });
      }

      const parts = [`${pCount}P`, `${aCount}A`, `${hCount}H`];
      if (hoCount > 0) parts.push(`${hoCount}Ho`);
      if (woCount > 0) parts.push(`${woCount}W`);
      const summary = parts.join(' / ');

      cells.push({
        content: summary,
        styles: { halign: 'center', fontStyle: 'bold' },
      });

      return cells;
    });

    autoTable(doc, {
      startY: cursorY,
      head: [headRow],
      body: bodyRows,
      tableWidth: 'auto',
      headStyles: {
        fillColor: [r, g, b],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 7,
        halign: 'center',
        cellPadding: { top: 2, bottom: 2, left: 1, right: 1 },
      },
      bodyStyles: {
        fontSize: 7,
        textColor: [40, 40, 40],
        cellPadding: { top: 2, bottom: 2, left: 1, right: 1 },
        font: 'helvetica',
        fontStyle: 'normal',
      },
      columnStyles: {
        0: { cellWidth: 35, halign: 'left' },
      },
      margin: { left: marginX, right: marginX, bottom: 8 },
      styles: {
        overflow: 'linebreak',
        lineColor: [215, 218, 224],
        lineWidth: 0.1,
      },
      didDrawPage: (hookData) => {
        renderPageDecorations(
          doc,
          hookData,
          pageWidth,
          pageHeight,
          marginX,
          r,
          g,
          b,
          watermarkBase64,
          branding,
          title,
        );
      },
    });
  }

  const dateStr = dayjs().format('YYYY-MM-DD');
  doc.save(`${filename}_export_${dateStr}.pdf`);
}
