'use client';

import { useState, useEffect } from 'react';
import { Tabs } from 'antd';
import { ArrowRightOutlined } from '@ant-design/icons';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import type { LedgerRecord, GratuityLedger } from '@/types';
import { buildMemberSalaryHref } from '@/features/employee-hub/memberFocusHref';
import { useWorkspaceStore } from '@/lib/store';
import { useSalarySectionAccess } from './useSalarySectionAccess';
import type { SalarySectionKey } from './salarySections';
import SummarySection from './sections/SummarySection';
import { PaySlipsSection } from './sections/PaySlipsSection';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface SalaryWorkspaceProps {
  memberId: string;
  memberName: string;
  memberEmail?: string;
  ledger: LedgerRecord | null;
  ledgerLoading: boolean;
  gratuityLedger: GratuityLedger | null;
  gratuityLoading: boolean;
  gratuityLoaded: boolean;
  canViewGratuityTracking: boolean;
  /**
   * Initial section key. Accepts both new SalarySectionKey values and the
   * legacy SalaryTab values ('history', 'payslips') for back-compat with
   * deep-links that still pass ?tab=ledger|payslips.
   */
  initialSection?: SalarySectionKey | 'history' | 'payslips';
  /** Called after a successful payment or reversal to trigger ledger refresh. */
  onLedgerChanged?: () => void;
}

// ── Back-compat resolver ───────────────────────────────────────────────────────

/**
 * Maps both current and legacy section identifiers to a canonical
 * SalarySectionKey. Legacy 'history' and 'payslips' both resolve to 'pay'
 * because that section now hosts both SalaryHistoryTab and PayslipsTab.
 */
function resolveSection(raw: string | null | undefined): SalarySectionKey {
  if (!raw) return 'summary';
  if (raw === 'history' || raw === 'payslips') return 'pay';
  // Treat any other string as a SalarySectionKey if recognisable, else fall back.
  const KNOWN: SalarySectionKey[] = [
    'summary',
    'pay',
    'structure',
    'advances',
    'loans',
    'commission',
    'bonus',
    'statutory',
    'gratuity',
    'fnf',
  ];
  return KNOWN.includes(raw as SalarySectionKey) ? (raw as SalarySectionKey) : 'summary';
}

// ── SalaryWorkspace ────────────────────────────────────────────────────────────

export default function SalaryWorkspace({
  memberId,
  memberName,
  memberEmail,
  ledger,
  ledgerLoading,
  gratuityLedger,
  gratuityLoading,
  gratuityLoaded,
  canViewGratuityTracking,
  initialSection,
  onLedgerChanged,
}: SalaryWorkspaceProps) {
  const t = useTranslations('team');
  const router = useRouter();
  const searchParams = useSearchParams();

  const workspaceId = useWorkspaceStore((s) => s.currentWorkspaceId) ?? '';

  const payrollHref = buildMemberSalaryHref(memberId);

  // Determine initial active section: URL param wins, then prop, then default.
  const urlSection = searchParams?.get('section');
  const seedSection = resolveSection(urlSection ?? initialSection);

  const [activeSection, setActiveSection] = useState<SalarySectionKey>(seedSection);

  // Keep URL ?section= in sync when active section changes.
  useEffect(() => {
    const current = searchParams?.get('section');
    if (current === activeSection) return;
    const sp = new URLSearchParams(searchParams?.toString() ?? '');
    sp.set('section', activeSection);
    router.replace(`?${sp.toString()}`, { scroll: false });
  }, [activeSection]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Section bodies (only built sections are registered here) ─────────────────
  // Sections NOT in this map will be filtered out of the sub-nav at runtime.
  // Add new keys here as their body components are built in later phases.
  const { sections, canAct } = useSalarySectionAccess();

  const SECTION_COMPONENTS: Partial<Record<SalarySectionKey, React.ReactNode>> = {
    summary: (
      <SummarySection
        memberId={memberId}
        memberName={memberName}
        ledger={ledger}
        ledgerLoading={ledgerLoading}
        canAct={canAct}
      />
    ),
    pay: (
      <PaySlipsSection
        memberId={memberId}
        memberName={memberName}
        memberEmail={memberEmail}
        ledger={ledger}
        ledgerLoading={ledgerLoading}
        gratuityLedger={gratuityLedger}
        gratuityLoading={gratuityLoading}
        gratuityLoaded={gratuityLoaded}
        canViewGratuityTracking={canViewGratuityTracking}
        canAct={canAct}
        workspaceId={workspaceId}
        onChanged={onLedgerChanged}
      />
    ),
  };

  // ── Sub-nav items: only sections that have a built body component ─────────────
  const navSections = sections.filter((s) => s.key in SECTION_COMPONENTS);

  const tabItems = navSections.map((s) => ({
    key: s.key,
    label: t(`salaryWorkspace.section.${s.labelKey}` as Parameters<typeof t>[0]),
    children: SECTION_COMPONENTS[s.key],
  }));

  // Guard: if active section is not visible (feature-gated), fall back to summary.
  const visibleKeys = navSections.map((s) => s.key);
  const effectiveSection = visibleKeys.includes(activeSection) ? activeSection : 'summary';

  return (
    <div className="flex flex-col gap-2">
      {/* Header: payroll deep-link */}
      <div className="flex justify-end">
        <Link
          href={payrollHref}
          className="inline-flex items-center gap-1 text-sm text-[var(--cr-primary,var(--cr-text-1))] hover:opacity-80"
        >
          {t('salaryTab.openInPayroll')}
          <ArrowRightOutlined className="text-xs" />
        </Link>
      </div>

      {/* Section sub-nav + body */}
      <Tabs
        activeKey={effectiveSection}
        onChange={(key) => setActiveSection(key as SalarySectionKey)}
        items={tabItems}
        size="small"
      />
    </div>
  );
}
