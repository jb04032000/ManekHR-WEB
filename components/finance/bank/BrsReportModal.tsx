'use client';

import React, { useEffect, useState, startTransition } from 'react';
import { Modal, Button, Space, Typography, Spin, Alert, Table, Collapse } from 'antd';
import dayjs from 'dayjs';
import { financeBankReconciliationApi } from '@/lib/api/modules/finance-bank-reconciliation.api';
import type { BrsReport } from '@/types';

const { Text, Title } = Typography;

interface BrsReportModalProps {
  open: boolean;
  sessionId: string;
  wsId: string;
  firmId: string;
  bankAccountId: string;
  onClose: () => void;
}

function formatRupees(paise: number): string {
  const rupees = paise / 100;
  return (
    '₹' + rupees.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  );
}

export default function BrsReportModal({
  open,
  sessionId,
  wsId,
  firmId,
  bankAccountId,
  onClose,
}: BrsReportModalProps) {
  const [report, setReport] = useState<BrsReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !sessionId || !wsId || !firmId) return;
    startTransition(() => {
      setLoading(true);
      setError(null);
    });
    financeBankReconciliationApi
      .report(wsId, firmId, bankAccountId, sessionId)
      .then((r) => setReport(r))
      .catch(() => setError('Failed to load BRS report. Please try again.'))
      .finally(() => setLoading(false));
  }, [open, sessionId, wsId, firmId, bankAccountId]);

  const handleExportPdf = async () => {
    if (!report) return;
    const { jsPDF } = await import('jspdf');
    const autoTable = (await import('jspdf-autotable')).default;

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('Bank Reconciliation Statement', 14, 20);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`${report.bankAccountName} • ${report.bankAccountNumberMasked}`, 14, 28);
    doc.text(
      `As at: ${dayjs(report.periodTo).format('DD MMM YYYY')} • FY: ${report.financialYear}`,
      14,
      34,
    );

    // Main BRS summary table
    const summaryRows: (string | number)[][] = [
      [
        'Balance as per Bank Statement (closing)',
        formatRupees(report.statementClosingBalancePaise),
      ],
      ['', ''],
      ['ADD:', ''],
      ...report.addItems.map((item) => [` ${item.label}`, formatRupees(item.amountPaise)]),
      ['ADD Subtotal', formatRupees(report.addSubtotalPaise)],
      ['', ''],
      ['LESS:', ''],
      ...report.lessItems.map((item) => [` ${item.label}`, formatRupees(item.amountPaise)]),
      ['LESS Subtotal', formatRupees(report.lessSubtotalPaise)],
      ['', ''],
      ['Balance as per Cash Book (computed)', formatRupees(report.computedCashBookBalancePaise)],
      ['Balance as per Cash Book (per ledger)', formatRupees(report.ledgerCashBookBalancePaise)],
      ['Difference', formatRupees(report.differencePaise)],
    ];

    autoTable(doc, {
      startY: 42,
      head: [['Description', 'Amount']],
      body: summaryRows,
      theme: 'striped',
      headStyles: { fillColor: [0, 122, 255] },
      columnStyles: { 1: { halign: 'right' } },
    });

    const currentY =
      (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable?.finalY ?? 100;

    // Outstanding cheques table
    if (report.outstandingCheques.length > 0) {
      doc.text('Outstanding Cheques', 14, currentY + 10);
      autoTable(doc, {
        startY: currentY + 14,
        head: [['Voucher #', 'Date', 'Amount']],
        body: report.outstandingCheques.map((c) => [
          c.voucherNumber,
          dayjs(c.entryDate).format('DD MMM YYYY'),
          formatRupees(c.amountPaise),
        ]),
        theme: 'grid',
        columnStyles: { 2: { halign: 'right' } },
      });
    }

    // Footer
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.text(
        `Generated: ${dayjs().format('DD MMM YYYY HH:mm')} - Page ${i} of ${pageCount}`,
        14,
        doc.internal.pageSize.height - 10,
      );
    }

    doc.save(`BRS_${report.bankAccountName}_${dayjs(report.periodTo).format('YYYY-MM')}.pdf`);
  };

  const handleExportExcel = async () => {
    if (!report) return;
    const XLSX = await import('xlsx');

    const wb = XLSX.utils.book_new();

    // BRS Summary sheet
    const summaryData = [
      ['Description', 'Amount (₹)'],
      ['Balance as per Bank Statement (closing)', report.statementClosingBalancePaise / 100],
      ['ADD Items', ''],
      ...report.addItems.map((item) => [item.label, item.amountPaise / 100]),
      ['ADD Subtotal', report.addSubtotalPaise / 100],
      ['LESS Items', ''],
      ...report.lessItems.map((item) => [item.label, item.amountPaise / 100]),
      ['LESS Subtotal', report.lessSubtotalPaise / 100],
      ['Balance as per Cash Book (computed)', report.computedCashBookBalancePaise / 100],
      ['Balance as per Cash Book (per ledger)', report.ledgerCashBookBalancePaise / 100],
      ['Difference', report.differencePaise / 100],
    ];
    const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, wsSummary, 'BRS Summary');

    // Outstanding Cheques sheet
    if (report.outstandingCheques.length > 0) {
      const chequesData = [
        ['Voucher #', 'Date', 'Amount (₹)'],
        ...report.outstandingCheques.map((c) => [
          c.voucherNumber,
          dayjs(c.entryDate).format('DD MMM YYYY'),
          c.amountPaise / 100,
        ]),
      ];
      const wsCheques = XLSX.utils.aoa_to_sheet(chequesData);
      XLSX.utils.book_append_sheet(wb, wsCheques, 'Outstanding Cheques');
    }

    // Deposits in Transit sheet
    if (report.depositsInTransit.length > 0) {
      const depositsData = [
        ['Voucher #', 'Date', 'Amount (₹)'],
        ...report.depositsInTransit.map((d) => [
          d.voucherNumber,
          dayjs(d.entryDate).format('DD MMM YYYY'),
          d.amountPaise / 100,
        ]),
      ];
      const wsDeposits = XLSX.utils.aoa_to_sheet(depositsData);
      XLSX.utils.book_append_sheet(wb, wsDeposits, 'Deposits in Transit');
    }

    // Bank Charges sheet
    if (report.bankChargesNotInBooks.length > 0) {
      const chargesData = [
        ['Row ID', 'Date', 'Narration', 'Amount (₹)'],
        ...report.bankChargesNotInBooks.map((c) => [
          c.rowId,
          dayjs(c.txnDate).format('DD MMM YYYY'),
          c.narration,
          c.amountPaise / 100,
        ]),
      ];
      const wsCharges = XLSX.utils.aoa_to_sheet(chargesData);
      XLSX.utils.book_append_sheet(wb, wsCharges, 'Bank Charges');
    }

    XLSX.writeFile(
      wb,
      `BRS_${report.bankAccountName}_${dayjs(report.periodTo).format('YYYY-MM')}.xlsx`,
    );
  };

  const handlePrint = () => {
    window.print();
  };

  const outstandingChequesColumns = [
    { title: 'Voucher #', dataIndex: 'voucherNumber', key: 'voucherNumber' },
    {
      title: 'Date',
      dataIndex: 'entryDate',
      key: 'entryDate',
      render: (v: string) => dayjs(v).format('DD MMM YYYY'),
    },
    {
      title: 'Amount',
      dataIndex: 'amountPaise',
      key: 'amountPaise',
      render: (v: number) => formatRupees(v),
      align: 'right' as const,
    },
  ];

  const depositsColumns = [
    { title: 'Voucher #', dataIndex: 'voucherNumber', key: 'voucherNumber' },
    {
      title: 'Date',
      dataIndex: 'entryDate',
      key: 'entryDate',
      render: (v: string) => dayjs(v).format('DD MMM YYYY'),
    },
    {
      title: 'Amount',
      dataIndex: 'amountPaise',
      key: 'amountPaise',
      render: (v: number) => formatRupees(v),
      align: 'right' as const,
    },
  ];

  const chargesColumns = [
    {
      title: 'Date',
      dataIndex: 'txnDate',
      key: 'txnDate',
      render: (v: string) => dayjs(v).format('DD MMM YYYY'),
    },
    { title: 'Narration', dataIndex: 'narration', key: 'narration', ellipsis: true },
    {
      title: 'Amount',
      dataIndex: 'amountPaise',
      key: 'amountPaise',
      render: (v: number) => formatRupees(v),
      align: 'right' as const,
    },
  ];

  return (
    <Modal
      open={open}
      onCancel={onClose}
      title="Bank Reconciliation Statement"
      width="90vw"
      style={{ top: 24 }}
      footer={null}
    >
      {loading && (
        <div style={{ textAlign: 'center', padding: 48 }}>
          <Spin size="large" />
        </div>
      )}

      {error && <Alert type="error" title={error} style={{ marginBottom: 16 }} />}

      {report && !loading && (
        <div>
          {/* Sub-header */}
          <div
            style={{
              background: 'var(--cr-surface-2)',
              borderRadius: 'var(--cr-radius-md)',
              padding: '12px 16px',
              marginBottom: 24,
            }}
          >
            <Text>
              <strong>{report.bankAccountName}</strong>
              {' • '}
              {report.bankAccountNumberMasked}
              {' • As at: '}
              {dayjs(report.periodTo).format('DD MMM YYYY')}
              {' • FY: '}
              {report.financialYear}
            </Text>
          </div>

          {/* Main BRS Table */}
          <div style={{ marginBottom: 24 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                <tr style={{ borderBottom: '1px solid var(--cr-border)' }}>
                  <td style={{ padding: '8px 0', color: 'var(--cr-text)' }}>
                    Balance as per Bank Statement (closing)
                  </td>
                  <td style={{ padding: '8px 0', textAlign: 'right', fontWeight: 600 }}>
                    {formatRupees(report.statementClosingBalancePaise)}
                  </td>
                </tr>

                {/* ADD section */}
                <tr>
                  <td
                    colSpan={2}
                    style={{
                      padding: '8px 0 4px',
                      fontWeight: 700,
                      color: 'var(--cr-text-2)',
                      fontSize: 12,
                      textTransform: 'uppercase',
                    }}
                  >
                    ADD:
                  </td>
                </tr>
                {report.addItems.map((item, i) => (
                  <tr key={i}>
                    <td style={{ padding: '4px 0 4px 16px', color: 'var(--cr-text-2)' }}>
                      {item.label}
                    </td>
                    <td style={{ padding: '4px 0', textAlign: 'right' }}>
                      {formatRupees(item.amountPaise)}
                    </td>
                  </tr>
                ))}
                <tr
                  style={{
                    borderBottom: '1px solid var(--cr-border)',
                    borderTop: '1px solid var(--cr-border)',
                  }}
                >
                  <td style={{ padding: '6px 0 6px 16px', fontWeight: 600 }}>ADD Subtotal</td>
                  <td style={{ padding: '6px 0', textAlign: 'right', fontWeight: 600 }}>
                    {formatRupees(report.addSubtotalPaise)}
                  </td>
                </tr>

                {/* LESS section */}
                <tr>
                  <td
                    colSpan={2}
                    style={{
                      padding: '8px 0 4px',
                      fontWeight: 700,
                      color: 'var(--cr-text-2)',
                      fontSize: 12,
                      textTransform: 'uppercase',
                    }}
                  >
                    LESS:
                  </td>
                </tr>
                {report.lessItems.map((item, i) => (
                  <tr key={i}>
                    <td style={{ padding: '4px 0 4px 16px', color: 'var(--cr-text-2)' }}>
                      {item.label}
                    </td>
                    <td style={{ padding: '4px 0', textAlign: 'right' }}>
                      {formatRupees(item.amountPaise)}
                    </td>
                  </tr>
                ))}
                <tr
                  style={{
                    borderBottom: '2px solid var(--cr-border)',
                    borderTop: '1px solid var(--cr-border)',
                  }}
                >
                  <td style={{ padding: '6px 0 6px 16px', fontWeight: 600 }}>LESS Subtotal</td>
                  <td style={{ padding: '6px 0', textAlign: 'right', fontWeight: 600 }}>
                    {formatRupees(report.lessSubtotalPaise)}
                  </td>
                </tr>

                {/* Computed/Ledger/Diff */}
                <tr>
                  <td style={{ padding: '8px 0', color: 'var(--cr-text)' }}>
                    Balance as per Cash Book (computed)
                  </td>
                  <td style={{ padding: '8px 0', textAlign: 'right', fontWeight: 600 }}>
                    {formatRupees(report.computedCashBookBalancePaise)}
                  </td>
                </tr>
                <tr>
                  <td style={{ padding: '8px 0', color: 'var(--cr-text)' }}>
                    Balance as per Cash Book (per ledger)
                  </td>
                  <td style={{ padding: '8px 0', textAlign: 'right', fontWeight: 600 }}>
                    {formatRupees(report.ledgerCashBookBalancePaise)}
                  </td>
                </tr>
                <tr style={{ borderTop: '2px solid var(--cr-border)' }}>
                  <td style={{ padding: '10px 0', fontWeight: 700, fontSize: 15 }}>Difference</td>
                  <td
                    style={{
                      padding: '10px 0',
                      textAlign: 'right',
                      fontWeight: 700,
                      fontSize: 15,
                      color: report.differencePaise === 0 ? 'var(--cr-success)' : 'var(--cr-error)',
                    }}
                  >
                    {formatRupees(report.differencePaise)}
                    {' - '}
                    {report.isFullyReconciled
                      ? 'Fully Reconciled'
                      : `${report.outstandingCheques.length + report.depositsInTransit.length} rows unmatched`}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Itemised detail (collapsible) */}
          <Collapse
            ghost
            style={{ marginBottom: 24 }}
            items={[
              ...(report.outstandingCheques.length > 0
                ? [
                    {
                      key: 'cheques',
                      label: `Outstanding Cheques (${report.outstandingCheques.length})`,
                      children: (
                        <Table
                          size="small"
                          dataSource={report.outstandingCheques}
                          columns={outstandingChequesColumns}
                          rowKey="voucherNumber"
                          pagination={false}
                        />
                      ),
                    },
                  ]
                : []),
              ...(report.depositsInTransit.length > 0
                ? [
                    {
                      key: 'deposits',
                      label: `Deposits in Transit (${report.depositsInTransit.length})`,
                      children: (
                        <Table
                          size="small"
                          dataSource={report.depositsInTransit}
                          columns={depositsColumns}
                          rowKey="voucherNumber"
                          pagination={false}
                        />
                      ),
                    },
                  ]
                : []),
              ...(report.bankChargesNotInBooks.length > 0
                ? [
                    {
                      key: 'charges',
                      label: `Bank Charges Not in Books (${report.bankChargesNotInBooks.length})`,
                      children: (
                        <Table
                          size="small"
                          dataSource={report.bankChargesNotInBooks}
                          columns={chargesColumns}
                          rowKey="rowId"
                          pagination={false}
                        />
                      ),
                    },
                  ]
                : []),
            ]}
          />

          {/* Actions row */}
          <Space>
            <Button onClick={handleExportPdf} type="primary">
              Export PDF
            </Button>
            <Button onClick={handleExportExcel}>Export Excel</Button>
            <Button onClick={handlePrint}>Print</Button>
          </Space>
        </div>
      )}
    </Modal>
  );
}
