'use client';
// Finance Reports hub (menu of all reports, tabbed by category + search + favorites).
// i18n via finance.reports.hub.* for page chrome; report card titles/descriptions stay as
// the ALL_REPORTS data structure (content data, not chrome). Cross-link: opens each report
// route under reports/*; uses DsPageHeader for the page title.
import { useState, useEffect } from 'react';
import { Tabs, Input, Tag, Alert } from 'antd';
import {
  BarChartOutlined,
  AuditOutlined,
  ContactsOutlined,
  InboxOutlined,
  ToolOutlined,
  BankOutlined,
  DashboardOutlined,
  TeamOutlined,
  PlusCircleOutlined,
  StarFilled,
} from '@ant-design/icons';
import { useRouter, useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ReportCard, type ReportDef } from '@/components/finance/reports/ReportCard';
import { DsPageHeader } from '@/components/ui';
import Link from 'next/link';

// ─── Report Definitions ─────────────────────────────────────────────────────

const ALL_REPORTS: ReportDef[] = [
  // Statutory Financial (7)
  {
    id: 'R-01',
    title: 'Trial Balance',
    description: 'Account-wise debit/credit closing balances. Verifies double-entry invariant.',
    href: 'reports/financial-statements/trial-balance',
    isNew: false,
  },
  {
    id: 'R-02',
    title: 'Profit & Loss',
    description: 'Gross Profit and Net Profit from Trading + P&L account. IND AS format.',
    href: 'reports/financial-statements/profit-loss',
    isNew: false,
  },
  {
    id: 'R-03',
    title: 'P&L - Month-wise Comparison',
    description: '12-month side-by-side P&L. Spot seasonal trends and loss months.',
    href: 'reports/financial-statements/profit-loss-comparison',
    isNew: false,
  },
  {
    id: 'R-04',
    title: 'Balance Sheet',
    description: 'Schedule III vertical format. Assets = Liabilities + Capital verification.',
    href: 'reports/financial-statements/balance-sheet',
    isNew: false,
  },
  {
    id: 'R-05',
    title: 'Cash Flow Statement',
    description: 'Operating, Investing, and Financing activities. Ind AS 7 indirect method.',
    href: 'reports/financial-statements/cash-flow',
    isNew: false,
  },
  {
    id: 'R-06',
    title: 'Ratio Analysis',
    description: 'GP%, NP%, Current Ratio, Debt-Equity. Benchmarks vs industry.',
    href: 'reports/financial-statements/ratio-analysis',
    isNew: false,
  },
  {
    id: 'R-07',
    title: 'EBITDA Summary',
    description:
      'Earnings before interest, tax, depreciation, and amortisation with monthly trend.',
    href: 'reports/financial-statements/ebitda',
    isNew: true,
  },

  // GST Registers (11)
  {
    id: 'R-08',
    title: 'GSTR-1 Output Register',
    description: 'B2B, B2C, HSN, and CN/DN sections - ready for GST portal upload.',
    href: 'reports/gst-registers/gstr1',
    isNew: false,
  },
  {
    id: 'R-09',
    title: 'GSTR-3B Summary',
    description: 'Auto-computed GSTR-3B with ITC matching. File-ready.',
    href: 'reports/gst-registers/gstr3b',
    isNew: false,
  },
  {
    id: 'R-10',
    title: 'GST Output Tax Register',
    description: 'Month-wise and HSN-wise output tax breakup.',
    href: 'reports/gst-registers/output-register',
    isNew: false,
  },
  {
    id: 'R-11',
    title: 'GST Input Register',
    description: 'Purchase ITC register - invoice-wise IGST, CGST, SGST.',
    href: 'reports/gst-registers/input-register',
    isNew: false,
  },
  {
    id: 'R-12',
    title: 'GSTR-2B ITC Register',
    description: 'ITC from GSTR-2B - reconcile with purchase register.',
    href: 'reports/gst-registers/itc-reconciliation',
    isNew: false,
  },
  {
    id: 'R-13',
    title: 'ITC Reconciliation',
    description: 'Books ITC vs GSTR-2B delta - flag mismatches instantly.',
    href: 'reports/gst-registers/itc-reconciliation',
    isNew: false,
  },
  {
    id: 'R-14',
    title: 'Capital Goods ITC Schedule',
    description: '60-month ITC release schedule per capital asset (Section 16(3)).',
    href: 'reports/gst-registers/capital-goods-itc',
    isNew: true,
  },
  {
    id: 'R-15',
    title: 'E-Invoice Register',
    description: 'IRN, QR code, and cancel status per invoice.',
    href: 'reports/gst-registers/einvoice-register',
    isNew: false,
  },
  {
    id: 'R-16',
    title: 'E-Way Bill Register',
    description: 'EWB number, validity, vehicle, and status tracker.',
    href: 'reports/gst-registers/ewb-register',
    isNew: false,
  },
  {
    id: 'R-17',
    title: 'HSN/SAC Summary',
    description: 'HSN-wise supply summary for GSTR-1 table 12.',
    href: 'reports/gst-registers/output-register',
    isNew: false,
  },
  {
    id: 'R-18',
    title: 'Late-Fee Income Register',
    description: 'Late fee charged to customers - income by party.',
    href: 'reports/gst-registers/late-fee-register',
    isNew: true,
  },

  // Party & Ledger (14)
  {
    id: 'R-19',
    title: 'Party Statement',
    description: 'Running balance per party with drill-to-voucher. Opening + closing summary.',
    href: 'reports/party-ledger/party-statement',
    isNew: false,
  },
  {
    id: 'R-20',
    title: 'Account Ledger',
    description: 'Full ledger for any Chart of Accounts entry.',
    href: 'reports/party-ledger/account-ledger',
    isNew: false,
  },
  {
    id: 'R-21',
    title: 'Daybook',
    description: 'All vouchers in date range - chronological journal view.',
    href: 'reports/party-ledger/daybook',
    isNew: false,
  },
  {
    id: 'R-22',
    title: 'Receivables Aging',
    description: 'Customer outstanding buckets: current, 0-30, 31-60, 61-90, 90+ days.',
    href: 'reports/party-ledger/receivables-aging',
    isNew: false,
  },
  {
    id: 'R-23',
    title: 'Payables Aging',
    description: 'Vendor outstanding buckets - mirror of receivables aging.',
    href: 'reports/party-ledger/payables-aging',
    isNew: false,
  },
  {
    id: 'R-24',
    title: 'Party-wise P&L',
    description: 'Profitability per customer or vendor - sales minus purchases net.',
    href: 'reports/party-ledger/party-wise-pl',
    isNew: true,
  },
  {
    id: 'R-25',
    title: 'Broker Commission Register',
    description: 'Commission payable per broker, linked to invoices.',
    href: 'reports/party-ledger/broker-commission',
    isNew: true,
  },
  {
    id: 'R-26',
    title: 'Sales Register',
    description: 'Voucher-wise sales list with GST and net amount.',
    href: 'reports/party-ledger/registers',
    isNew: false,
  },
  {
    id: 'R-27',
    title: 'Purchase Register',
    description: 'Voucher-wise purchase list with ITC.',
    href: 'reports/party-ledger/registers',
    isNew: false,
  },
  {
    id: 'R-28',
    title: 'Payment Receipts Register',
    description: 'All inward payments received from customers.',
    href: 'reports/party-ledger/registers',
    isNew: false,
  },
  {
    id: 'R-29',
    title: 'Payment Outward Register',
    description: 'All outward payments made to vendors.',
    href: 'reports/party-ledger/registers',
    isNew: false,
  },
  {
    id: 'R-30',
    title: 'Cheque Register',
    description: 'Cheques issued and received with clearing status.',
    href: 'reports/party-ledger/registers',
    isNew: false,
  },
  {
    id: 'R-31',
    title: 'Contra Voucher Register',
    description: 'Cash-bank and bank-bank transfer journal.',
    href: 'reports/party-ledger/registers',
    isNew: false,
  },
  {
    id: 'R-32',
    title: 'Journal Register',
    description: 'All manual journal entries in date range.',
    href: 'reports/party-ledger/registers',
    isNew: false,
  },

  // Inventory (8)
  {
    id: 'R-33',
    title: 'Stock Summary',
    description: 'Current stock qty and value - all items, all godowns.',
    href: 'inventory/stock-summary',
    isNew: false,
  },
  {
    id: 'R-34',
    title: 'Item Ledger',
    description: 'Movement history per item - all inward, outward, and transfer entries.',
    href: 'reports/inventory/item-ledger',
    isNew: false,
  },
  {
    id: 'R-35',
    title: 'Item-wise Profitability',
    description: 'Revenue, COGS, and gross margin per item. Sort by highest profit contributor.',
    href: 'reports/inventory/item-profitability',
    isNew: false,
  },
  {
    id: 'R-36',
    title: 'Godown-wise Stock',
    description: 'Stock balance per godown / warehouse location.',
    href: 'reports/inventory/godown-stock',
    isNew: false,
  },
  {
    id: 'R-37',
    title: 'Reorder Alert',
    description: 'Items below reorder quantity - procurement action needed.',
    href: 'inventory/stock-summary',
    isNew: false,
  },
  {
    id: 'R-38',
    title: 'Batch / Lot Expiry',
    description: 'Batches expiring within the next 30-90 days.',
    href: 'inventory/stock-summary',
    isNew: false,
  },
  {
    id: 'R-39',
    title: 'Wastage Register',
    description: 'Reason-wise wastage entries with qty and value.',
    href: 'reports/inventory/wastage-register',
    isNew: false,
  },
  {
    id: 'R-40',
    title: 'Stock Transfer Register',
    description: 'Inter-godown stock movement history.',
    href: 'inventory/stock-summary',
    isNew: false,
  },

  // Manufacturing & Job-Work (6)
  {
    id: 'R-41',
    title: 'Manufacturing Voucher Register',
    description: 'All production vouchers with BOM and output cost.',
    href: 'reports/manufacturing/mv-register',
    isNew: false,
  },
  {
    id: 'R-42',
    title: 'BOM Cost Analysis',
    description: 'Standard vs actual cost per manufacturing run.',
    href: 'reports/manufacturing/mv-register',
    isNew: false,
  },
  {
    id: 'R-43',
    title: 'Job-Work Pending',
    description: 'Material sent to karigar not yet returned - overdue highlight.',
    href: 'reports/manufacturing/job-work-pending',
    isNew: false,
  },
  // PAUSED 2026-05-14 - Karigar Productivity report card hidden from reports index while Karigar feature is paused on web. Standalone route at reports/manufacturing/karigar-productivity remains live. Revive by uncommenting.
  // { id: 'R-44', title: 'Karigar Productivity', description: 'Output qty, defect rate, and efficiency per karigar.', href: 'reports/manufacturing/karigar-productivity', isNew: true },
  {
    id: 'R-45',
    title: 'Machine Output',
    description: 'Production qty per machine with utilization %.',
    href: 'reports/manufacturing/machine-output',
    isNew: true,
  },
  {
    id: 'R-46',
    title: 'ITC-04 Register',
    description: 'Job-work material movement register for GST ITC-04 filing.',
    href: 'reports/manufacturing/mv-register',
    isNew: false,
  },

  // Fixed Assets (2)
  {
    id: 'R-47',
    title: 'Fixed Asset Register',
    description: 'All assets with cost, accumulated depreciation, and Net Book Value.',
    href: 'reports/fixed-assets',
    isNew: false,
  },
  {
    id: 'R-48',
    title: 'Depreciation Schedule',
    description: 'Year-wise depreciation per asset - opening NBV, depr for year, closing NBV.',
    href: 'reports/fixed-assets',
    isNew: false,
  },
];

const REPORT_BY_ID = Object.fromEntries(ALL_REPORTS.map((r) => [r.id, r]));

interface CategoryDef {
  key: string;
  label: string;
  icon: React.ReactNode;
  color: string;
  tint: string;
  reportIds: string[];
}

const REPORT_CATEGORIES: CategoryDef[] = [
  {
    key: 'statutory',
    label: 'Statutory (7)',
    icon: <BarChartOutlined />,
    color: 'var(--cr-primary)',
    tint: 'var(--cr-primary-light)',
    reportIds: ['R-01', 'R-02', 'R-03', 'R-04', 'R-05', 'R-06', 'R-07'],
  },
  {
    key: 'gst',
    label: 'GST (11)',
    icon: <AuditOutlined />,
    color: 'var(--cr-indigo-400)',
    tint: 'var(--cr-indigo-50)',
    reportIds: [
      'R-08',
      'R-09',
      'R-10',
      'R-11',
      'R-12',
      'R-13',
      'R-14',
      'R-15',
      'R-16',
      'R-17',
      'R-18',
    ],
  },
  {
    key: 'party-ledger',
    label: 'Party & Ledger (14)',
    icon: <ContactsOutlined />,
    color: 'var(--cr-warning-500)',
    tint: 'var(--cr-warning-50)',
    reportIds: [
      'R-19',
      'R-20',
      'R-21',
      'R-22',
      'R-23',
      'R-24',
      'R-25',
      'R-26',
      'R-27',
      'R-28',
      'R-29',
      'R-30',
      'R-31',
      'R-32',
    ],
  },
  {
    key: 'inventory',
    label: 'Inventory (8)',
    icon: <InboxOutlined />,
    color: 'var(--cr-success-500)',
    tint: 'var(--cr-success-50)',
    reportIds: ['R-33', 'R-34', 'R-35', 'R-36', 'R-37', 'R-38', 'R-39', 'R-40'],
  },
  {
    key: 'manufacturing',
    label: 'Manufacturing & Job-Work (6)',
    icon: <ToolOutlined />,
    color: 'var(--cr-warning-500)',
    tint: 'var(--cr-warning-50)',
    reportIds: ['R-41', 'R-42', 'R-43', 'R-44', 'R-45', 'R-46'],
  },
  {
    key: 'fixed-assets',
    label: 'Fixed Assets (2)',
    icon: <BankOutlined />,
    color: 'var(--cr-info-500)',
    tint: 'var(--cr-info-50)',
    reportIds: ['R-47', 'R-48'],
  },
  {
    key: 'dashboard',
    label: 'Dashboard',
    icon: <DashboardOutlined />,
    color: 'var(--cr-primary)',
    tint: 'var(--cr-primary-light)',
    reportIds: [],
  },
  {
    key: 'payroll',
    label: 'Payroll (linked)',
    icon: <TeamOutlined />,
    color: 'var(--cr-success-500)',
    tint: 'var(--cr-success-50)',
    reportIds: [],
  },
  {
    key: 'custom',
    label: 'Custom (coming soon)',
    icon: <PlusCircleOutlined />,
    color: 'var(--cr-text-3)',
    tint: 'var(--cr-bg)',
    reportIds: [],
  },
];

function getCategoryForReport(reportId: string): CategoryDef {
  const cat = REPORT_CATEGORIES.find((c) => c.reportIds.includes(reportId));
  return cat ?? REPORT_CATEGORIES[0];
}

// ─── Reports Hub Page ────────────────────────────────────────────────────────

export default function ReportsHubPage() {
  const router = useRouter();
  const params = useParams();
  const firmId = params.firmId as string;
  const t = useTranslations('finance.reports');

  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('statutory');
  const [favorites, setFavorites] = useState<string[]>([]);
  const [recentReports, setRecentReports] = useState<ReportDef[]>([]);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const favStr = localStorage.getItem('finance-report-favorites');
      // eslint-disable-next-line react-hooks/set-state-in-effect -- post-mount localStorage hydration; avoided lazy useState initializer to keep SSR markup deterministic.
      if (favStr) setFavorites(JSON.parse(favStr));
    } catch {
      // malformed JSON - reset silently
    }
    try {
      const recentStr = localStorage.getItem('finance-report-recent');

      if (recentStr) setRecentReports(JSON.parse(recentStr));
    } catch {
      // malformed JSON - reset silently
    }
  }, []);

  // Open a specific category tab when arrived via a category redirect
  // (e.g. /reports/gst-registers redirects here as /reports?cat=gst). This is
  // what makes deep breadcrumb category links land on the right tab instead of
  // a 404 page.
  useEffect(() => {
    const cat = new URLSearchParams(window.location.search).get('cat');
    // eslint-disable-next-line react-hooks/set-state-in-effect -- post-mount URL read; initial SSR markup must stay deterministic on the default tab.
    if (cat && REPORT_CATEGORIES.some((c) => c.key === cat)) setActiveTab(cat);
  }, []);

  const toggleFavorite = (id: string) => {
    const updated = favorites.includes(id) ? favorites.filter((f) => f !== id) : [...favorites, id];
    setFavorites(updated);
    try {
      localStorage.setItem('finance-report-favorites', JSON.stringify(updated));
    } catch {
      // storage full - no-op
    }
  };

  const handleOpenReport = (report: ReportDef) => {
    const updated = [report, ...recentReports.filter((r) => r.id !== report.id)].slice(0, 5);
    setRecentReports(updated);
    try {
      localStorage.setItem('finance-report-recent', JSON.stringify(updated));
    } catch {
      // storage full - no-op
    }
    router.push(`/dashboard/finance/firms/${firmId}/${report.href}`);
  };

  // Search filtering - across all categories
  const searchResults = searchQuery.trim()
    ? ALL_REPORTS.filter(
        (r) =>
          r.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          r.description.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : [];

  const favoritedReports = favorites.map((id) => REPORT_BY_ID[id]).filter(Boolean);

  // Tab items
  const tabItems = REPORT_CATEGORIES.map((cat) => ({
    key: cat.key,
    label: (
      <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
        <span style={{ color: cat.color }}>{cat.icon}</span>
        {cat.label}
      </span>
    ),
    children: (
      <CategoryTabContent
        cat={cat}
        favorites={favorites}
        onFavoriteToggle={toggleFavorite}
        onOpen={handleOpenReport}
      />
    ),
  }));

  return (
    <div style={{ padding: 'var(--cr-space-lg)', minHeight: '100vh', background: 'var(--cr-bg)' }}>
      <DsPageHeader
        title={t('hub.title')}
        icon={<BarChartOutlined />}
        style={{ marginBottom: 'var(--cr-space-lg)' }}
        right={
          <Input.Search
            placeholder={t('hub.searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onSearch={(v) => setSearchQuery(v)}
            allowClear
            style={{ width: 300 }}
            aria-label={t('hub.searchAria')}
          />
        }
      />

      {/* Search results - flat grid across all categories */}
      {searchQuery.trim() ? (
        <div>
          <div className="cr-label" style={{ marginBottom: 'var(--cr-space-sm)' }}>
            {t('hub.resultsFor', { count: searchResults.length, query: searchQuery })}
          </div>
          {searchResults.length === 0 ? (
            <div
              style={{
                paddingTop: 'var(--cr-space-2xl)',
                paddingBottom: 'var(--cr-space-2xl)',
                textAlign: 'center',
                color: 'var(--cr-text-3)',
                fontSize: 14,
              }}
            >
              {t('hub.noResults')}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-md md:grid-cols-2 xl:grid-cols-3">
              {searchResults.map((report) => {
                const cat = getCategoryForReport(report.id);
                return (
                  <ReportCard
                    key={report.id}
                    report={report}
                    categoryColor={cat.color}
                    categoryTint={cat.tint}
                    categoryIcon={cat.icon}
                    categoryKey={cat.key}
                    categoryLabel={cat.label}
                    isFavorited={favorites.includes(report.id)}
                    onFavoriteToggle={toggleFavorite}
                    onOpen={handleOpenReport}
                  />
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <>
          {/* Recently Viewed */}
          {recentReports.length > 0 && (
            <div style={{ marginBottom: 'var(--cr-space-lg)' }}>
              <div className="cr-label" style={{ marginBottom: 'var(--cr-space-sm)' }}>
                {t('hub.recentlyViewed')}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--cr-space-sm)' }}>
                {recentReports.map((report) => {
                  const cat = getCategoryForReport(report.id);
                  return (
                    <Tag
                      key={report.id}
                      style={{
                        cursor: 'pointer',
                        borderColor: cat.color,
                        color: cat.color,
                        background: cat.tint,
                        fontSize: 13,
                        padding: '4px 10px',
                      }}
                      onClick={() => handleOpenReport(report)}
                    >
                      {report.title}
                    </Tag>
                  );
                })}
              </div>
            </div>
          )}

          {/* Favorites */}
          {favoritedReports.length > 0 && (
            <div style={{ marginBottom: 'var(--cr-space-lg)' }}>
              <div
                className="cr-label"
                style={{
                  marginBottom: 'var(--cr-space-sm)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <StarFilled style={{ color: 'var(--cr-warning-500)' }} />
                {t('hub.favorites')}
              </div>
              <div className="grid grid-cols-2 gap-sm md:grid-cols-4">
                {favoritedReports.map((report) => {
                  const cat = getCategoryForReport(report.id);
                  return (
                    <ReportCard
                      key={report.id}
                      report={report}
                      categoryColor={cat.color}
                      categoryTint={cat.tint}
                      categoryIcon={cat.icon}
                      categoryKey={cat.key}
                      categoryLabel={cat.label}
                      isFavorited
                      onFavoriteToggle={toggleFavorite}
                      onOpen={handleOpenReport}
                    />
                  );
                })}
              </div>
            </div>
          )}

          {/* All Reports - tabbed by category */}
          <Tabs
            type="card"
            activeKey={activeTab}
            onChange={setActiveTab}
            items={tabItems}
            style={{
              marginTop:
                favoritedReports.length === 0 && recentReports.length === 0 ? 0 : undefined,
            }}
          />
        </>
      )}
    </div>
  );
}

// ─── Category Tab Content ────────────────────────────────────────────────────

interface CategoryTabContentProps {
  cat: CategoryDef;
  favorites: string[];
  onFavoriteToggle: (id: string) => void;
  onOpen: (report: ReportDef) => void;
}

function CategoryTabContent({ cat, favorites, onFavoriteToggle, onOpen }: CategoryTabContentProps) {
  const t = useTranslations('finance.reports');
  if (cat.key === 'dashboard') {
    return (
      <div style={{ paddingTop: 'var(--cr-space-md)' }}>
        <Alert
          type="info"
          showIcon
          title={t('hub.dashboardTitle')}
          description={
            <>
              {t('hub.dashboardBody')}{' '}
              <Link href="/dashboard/finance" style={{ color: 'var(--cr-primary)' }}>
                {t('hub.dashboardLink')}
              </Link>
            </>
          }
        />
      </div>
    );
  }

  if (cat.key === 'payroll') {
    return (
      <div style={{ paddingTop: 'var(--cr-space-md)' }}>
        <Alert
          type="info"
          showIcon
          title={t('hub.payrollTitle')}
          description={
            <>
              {t('hub.payrollBody')}{' '}
              <Link href="/dashboard/salary" style={{ color: 'var(--cr-primary)' }}>
                {t('hub.payrollLink')}
              </Link>
            </>
          }
        />
      </div>
    );
  }

  if (cat.key === 'custom') {
    return (
      <div
        style={{
          paddingTop: 'var(--cr-space-md)',
          paddingBottom: 'var(--cr-space-2xl)',
          textAlign: 'center',
          color: 'var(--cr-text-3)',
          fontSize: 14,
        }}
      >
        {t('hub.customSoon')}
      </div>
    );
  }

  const reports = cat.reportIds.map((id) => REPORT_BY_ID[id]).filter(Boolean);

  if (reports.length === 0) {
    return (
      <div
        style={{
          paddingTop: 'var(--cr-space-md)',
          paddingBottom: 'var(--cr-space-2xl)',
          textAlign: 'center',
          color: 'var(--cr-text-3)',
          fontSize: 14,
        }}
      >
        {t('hub.noReportsInCategory')}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-md pt-md md:grid-cols-2 xl:grid-cols-3">
      {reports.map((report) => (
        <ReportCard
          key={report.id}
          report={report}
          categoryColor={cat.color}
          categoryTint={cat.tint}
          categoryIcon={cat.icon}
          categoryKey={cat.key}
          categoryLabel={cat.label}
          isFavorited={favorites.includes(report.id)}
          onFavoriteToggle={onFavoriteToggle}
          onOpen={onOpen}
        />
      ))}
    </div>
  );
}
