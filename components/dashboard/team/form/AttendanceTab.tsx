'use client';

import { useState, useEffect } from 'react';
import { Tabs } from 'antd';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import ThisMonthSection from '@/components/dashboard/team/attendance/sections/ThisMonthSection';
import RegularizationsSection from '@/components/dashboard/team/attendance/sections/RegularizationsSection';
import type { TeamMember } from '@/types';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface AttendanceTabProps {
  wsId: string;
  memberId: string;
  isOwnRecord: boolean;
  canViewAll: boolean;
  /** Full TeamMember record. When provided, managers get inline mark/edit on day rows. */
  member?: TeamMember;
}

// ── Section keys ───────────────────────────────────────────────────────────────

type AttendanceSectionKey = 'thismonth' | 'regularizations';

const KNOWN_SECTIONS: AttendanceSectionKey[] = ['thismonth', 'regularizations'];

function resolveSection(raw: string | null | undefined): AttendanceSectionKey {
  if (!raw) return 'thismonth';
  return KNOWN_SECTIONS.includes(raw as AttendanceSectionKey)
    ? (raw as AttendanceSectionKey)
    : 'thismonth';
}

// ── AttendanceTab (workspace shell) ───────────────────────────────────────────

export default function AttendanceTab({
  wsId,
  memberId,
  isOwnRecord,
  canViewAll,
  member,
}: AttendanceTabProps) {
  const t = useTranslations('team');
  const router = useRouter();
  const searchParams = useSearchParams();

  const urlSection = searchParams?.get('section');
  const [activeSection, setActiveSection] = useState<AttendanceSectionKey>(
    resolveSection(urlSection),
  );

  // Keep URL ?section= in sync when active section changes.
  useEffect(() => {
    const current = searchParams?.get('section');
    if (current === activeSection) return;
    const sp = new URLSearchParams(searchParams?.toString() ?? '');
    sp.set('section', activeSection);
    router.replace(`?${sp.toString()}`, { scroll: false });
  }, [activeSection]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Section bodies (only built sections are registered here) ─────────────────
  // Sections NOT in this map are filtered out of the sub-nav at runtime.
  const SECTION_COMPONENTS: Partial<Record<AttendanceSectionKey, React.ReactNode>> = {
    thismonth: (
      <ThisMonthSection
        wsId={wsId}
        memberId={memberId}
        isOwnRecord={isOwnRecord}
        canViewAll={canViewAll}
        member={member}
      />
    ),
    regularizations: (
      <RegularizationsSection
        wsId={wsId}
        memberId={memberId}
        isOwnRecord={isOwnRecord}
        canViewAll={canViewAll}
        member={member}
      />
    ),
  };

  // Sub-nav items: only sections that have a built body component.
  const tabItems = (Object.keys(SECTION_COMPONENTS) as AttendanceSectionKey[]).map((key) => ({
    key,
    label: t(`attendanceWorkspace.section.${key}` as Parameters<typeof t>[0]),
    children: SECTION_COMPONENTS[key],
  }));

  // Guard: if active section is not yet built, fall back to thismonth.
  const visibleKeys = tabItems.map((item) => item.key);
  const effectiveSection = visibleKeys.includes(activeSection) ? activeSection : 'thismonth';

  return (
    <Tabs
      activeKey={effectiveSection}
      onChange={(key) => setActiveSection(key as AttendanceSectionKey)}
      items={tabItems}
      size="small"
    />
  );
}
