'use client';

import Link from 'next/link';
import { Alert, Button } from 'antd';
import { ArrowUpOutlined } from '@ant-design/icons';
import { useTranslations } from 'next-intl';

// Capped-report notice. Shows "Showing N of TOTAL members - upgrade to see
// everyone" above a member list/report when the workspace is over its plan's
// member limit and the backend trimmed the response.
//
// Cross-module links:
//  - Fed by the optional `memberCap` field on the Team list response
//    (TeamListResponse.memberCap in types/index.ts), surfaced on the Team page
//    (app/dashboard/team/page.tsx). The cap FILTER is enforced server-side; this
//    is the user-facing notice only.
//  - CTA links to the in-app plans hub (/account/subscription/plans), the same
//    route the sidebar Upgrade button and trial banners use.
//
// Keep in sync with: the backend Team list `memberCap` shape and the i18n block
// `dashboard.upgrade.cap.*` (all four locales). Renders nothing when not capped,
// so it is always safe to drop in above a list.

const PLANS_ROUTE = '/account/subscription/plans';

export interface MemberCapNoticeProps {
  /** True only when the workspace is over its plan member limit (post-grace). */
  capped: boolean;
  /** How many members the trimmed response actually returned. */
  visibleCount: number;
  /** How many members exist in total (before the cap trim). */
  totalCount: number;
  /** The plan's member limit. */
  limit: number;
  className?: string;
}

export function MemberCapNotice({
  capped,
  visibleCount,
  totalCount,
  limit,
  className,
}: MemberCapNoticeProps) {
  const t = useTranslations('dashboard.upgrade');

  // Not capped -> render nothing (safe to always mount above a list).
  if (!capped) return null;

  return (
    <Alert
      type="warning"
      showIcon
      className={className}
      title={t('cap.title', { visibleCount, totalCount, limit })}
      description={t('cap.body')}
      action={
        <Link href={PLANS_ROUTE} className="no-underline">
          <Button size="small" type="primary" icon={<ArrowUpOutlined />} className="cr-cta-gold">
            {t('cta')}
          </Button>
        </Link>
      }
    />
  );
}

export default MemberCapNotice;
