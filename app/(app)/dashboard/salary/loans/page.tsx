'use client';

import { useCallback, useEffect, useRef, useState, startTransition } from 'react';
import { BankOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import { App, Button, Select, Skeleton, Table, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { useTranslations } from 'next-intl';
import { useShallow } from 'zustand/react/shallow';
import { DsPageHeader, StatTile } from '@/components/ui';
// Branded horizontal scrollbar for the loans table on mobile (native bar hidden
// via `.salary-table-wrap` in globals.css). Same as the payroll tables.
import { TableCustomScrollbar } from '@/components/ui/TableCustomScrollbar';
import { CreateLoanDrawer } from '@/components/dashboard/loans/CreateLoanDrawer';
import { LoanDetailDrawer } from '@/components/dashboard/loans/LoanDetailDrawer';
// Owner-side queue of employee-originated 0% loan requests (Task 5). Mounted above
// the loans table; approve materializes a real EmployerLoan, so it refreshes both
// the queue and this page's loans list. Links: LoanRequestsQueue.tsx.
import { LoanRequestsQueue } from '@/components/dashboard/loans/LoanRequestsQueue';
import { Can } from '@/components/rbac/Can';
import { useSalaryFeatures } from '@/features/salary/hooks/useSalaryFeatures';
import { salaryApi } from '@/lib/api';
import { teamApi } from '@/lib/api/modules/team.api';
import { formatCurrencyFull, parseApiError } from '@/lib/utils';
import { useWorkspaceStore } from '@/lib/store';
import type { EmployerLoan, LoanStatus, LoanType, TeamMember } from '@/types';

const LOAN_STATUS_COLOR: Record<LoanStatus, string> = {
  draft: 'default',
  pending_approval: 'warning',
  active: 'processing',
  paused: 'orange',
  completed: 'success',
  written_off: 'error',
  reversed: 'error',
};

const LOAN_TYPE_KEYS: LoanType[] = [
  'personal',
  'medical',
  'housing',
  'vehicle',
  'education',
  'other',
];

const LOAN_STATUS_KEYS: LoanStatus[] = [
  'draft',
  'pending_approval',
  'active',
  'paused',
  'completed',
  'written_off',
  'reversed',
];

function formatInterestLabel(type: string, rate: number): string {
  if (type === 'zero') return '0%';
  const typeLabel = type === 'flat' ? 'Flat' : 'Red. Bal.';
  return `${typeLabel} ${rate}% p.a.`;
}

export default function LoansPage() {
  const t = useTranslations('salary.loans');
  const { message } = App.useApp();
  const { loanManagement } = useSalaryFeatures();
  // Wrapper for the loans table so <TableCustomScrollbar> can drive a branded
  // horizontal bar; the columns overflow a phone width.
  const tableWrapRef = useRef<HTMLDivElement>(null);

  const { currentWorkspaceId, isHydrated } = useWorkspaceStore(
    useShallow((s) => ({
      currentWorkspaceId: s.currentWorkspaceId,
      isHydrated: s.isHydrated,
    })),
  );

  const [loans, setLoans] = useState<EmployerLoan[]>([]);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [detailLoanId, setDetailLoanId] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<LoanType | undefined>(undefined);
  const [filterStatus, setFilterStatus] = useState<LoanStatus | undefined>(undefined);

  const loadData = useCallback(async () => {
    if (!currentWorkspaceId) return;
    setLoading(true);
    try {
      const [dashboard, memberData] = await Promise.all([
        salaryApi.getLoanDashboard(currentWorkspaceId, {
          loanType: filterType,
          status: filterStatus,
        }),
        teamApi.list(currentWorkspaceId, { limit: 1000 }),
      ]);
      // teamApi.list returns TeamMember[] | PaginatedResponse<TeamMember>
      const memberList: TeamMember[] = Array.isArray(memberData)
        ? memberData
        : ((memberData as { data: TeamMember[] }).data ?? []);
      startTransition(() => {
        setLoans(dashboard.loans);
        setMembers(memberList);
      });
    } catch (e) {
      message.error(parseApiError(e) || t('loadError'));
    } finally {
      setLoading(false);
    }
  }, [currentWorkspaceId, filterType, filterStatus, message, t]);

  useEffect(() => {
    if (isHydrated && currentWorkspaceId) {
      void loadData();
    }
  }, [isHydrated, currentWorkspaceId, loadData]);

  const memberMap = new Map(members.map((m) => [m.id, m]));

  // Dashboard stats derived from loaded loans
  const activeLoans = loans.filter((l) => l.status === 'active' || l.status === 'paused');
  const pendingApproval = loans.filter((l) => l.status === 'pending_approval');
  const totalOutstanding = activeLoans.reduce((sum, l) => sum + (l.remainingAmount ?? 0), 0);

  const columns: ColumnsType<EmployerLoan> = [
    {
      title: t('colEmployee'),
      key: 'employee',
      render: (_: unknown, row: EmployerLoan) => {
        const member = memberMap.get(row.teamMemberId);
        return (
          <div>
            <p className="m-0 text-[14px] font-medium text-heading">
              {member?.name ?? row.teamMemberId}
            </p>
            {member?.designation && (
              <p className="m-0 text-[12px] text-subtle">{member.designation}</p>
            )}
          </div>
        );
      },
    },
    {
      title: t('colLoanType'),
      dataIndex: 'loanType',
      key: 'loanType',
      render: (lt: LoanType) => t(`loanType.${lt}`),
    },
    {
      title: t('colPrincipal'),
      dataIndex: 'principalAmount',
      key: 'principalAmount',
      align: 'right',
      render: (v: number) => (
        <span className="font-medium tabular-nums">{formatCurrencyFull(v)}</span>
      ),
    },
    {
      title: t('colInterest'),
      key: 'interest',
      align: 'center',
      render: (_: unknown, row: EmployerLoan) => (
        <span className="text-[13px] text-subtle">
          {formatInterestLabel(row.interestType, row.annualInterestRate)}
        </span>
      ),
    },
    {
      title: t('colEmi'),
      dataIndex: 'emiAmount',
      key: 'emiAmount',
      align: 'right',
      render: (v: number) => (
        <span className="text-[13px] tabular-nums">{formatCurrencyFull(v)}</span>
      ),
    },
    {
      title: t('colOutstanding'),
      dataIndex: 'remainingAmount',
      key: 'remainingAmount',
      align: 'right',
      render: (v: number) => (
        <span className="text-[13px] font-medium tabular-nums">{formatCurrencyFull(v)}</span>
      ),
    },
    {
      title: t('colDisbursedOn'),
      dataIndex: 'disbursementDate',
      key: 'disbursementDate',
      render: (d: string) => dayjs(d).format('DD MMM YYYY'),
    },
    {
      title: t('colStatus'),
      dataIndex: 'status',
      key: 'status',
      render: (s: LoanStatus) => (
        <Tag color={LOAN_STATUS_COLOR[s] ?? 'default'}>{t(`loanStatus.${s}`)}</Tag>
      ),
    },
    {
      title: '',
      key: 'actions',
      width: 70,
      render: (_: unknown, row: EmployerLoan) => (
        <Button size="small" onClick={() => setDetailLoanId(row._id)}>
          {t('viewBtn')}
        </Button>
      ),
    },
  ];

  if (!isHydrated) {
    return (
      <div>
        <Skeleton active paragraph={{ rows: 6 }} />
      </div>
    );
  }

  return (
    // No own padding - the salary layout + dashboard shell already provide the
    // page gutter (matches Payments / Run Payroll). The old `p-6` here doubled
    // the left/right gutter, boxing the content in. Vertical rhythm comes from
    // the child sections' own `mb-*`.
    <div>
      <DsPageHeader
        title={t('pageTitle')}
        sub={t('pageSubtitle')}
        icon={<BankOutlined />}
        right={
          <div className="flex items-center gap-2">
            <Button
              icon={<ReloadOutlined />}
              onClick={() => void loadData()}
              loading={loading}
              aria-label={t('refreshBtn')}
            />
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
              {t('newLoanBtn')}
            </Button>
          </div>
        }
      />

      {/* KPI tiles */}
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile
          label={t('statActiveLoans')}
          value={String(activeLoans.length)}
          hint={t('statActiveLoansHint')}
          emphasis
        />
        <StatTile
          label={t('statOutstanding')}
          value={formatCurrencyFull(totalOutstanding)}
          hint={t('statOutstandingHint')}
        />
        <StatTile
          label={t('statPendingApproval')}
          value={String(pendingApproval.length)}
          hint={t('statPendingApprovalHint')}
          tone={pendingApproval.length > 0 ? 'danger' : 'neutral'}
        />
        <StatTile
          label={t('statTotalLoans')}
          value={String(loans.length)}
          hint={t('statTotalLoansHint')}
        />
      </div>

      {/* Loan requests queue: owner reviews employee-originated 0% loan requests.
          Gated on salary.edit@all + the loanManagement feature (matches the BE
          owner routes). Approving materializes a real loan -> refresh this list. */}
      {currentWorkspaceId && loanManagement.enabled && (
        <Can module="salary" action="edit" scope="all">
          <LoanRequestsQueue
            workspaceId={currentWorkspaceId}
            onLoanCreated={() => void loadData()}
          />
        </Can>
      )}

      {/* Filters. Full-width (stacked) on mobile so each select uses the row
          instead of sitting at a fixed 160/180px with dead space; sm+ restores
          the inline fixed-width cluster. */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Select
          allowClear
          placeholder={t('filterByType')}
          className="w-full sm:w-40"
          value={filterType}
          onChange={(v: LoanType | undefined) => setFilterType(v)}
          options={[...LOAN_TYPE_KEYS.map((lt) => ({ value: lt, label: t(`loanType.${lt}`) }))]}
        />
        <Select
          allowClear
          placeholder={t('filterByStatus')}
          className="w-full sm:w-[180px]"
          value={filterStatus}
          onChange={(v: LoanStatus | undefined) => setFilterStatus(v)}
          options={[...LOAN_STATUS_KEYS.map((ls) => ({ value: ls, label: t(`loanStatus.${ls}`) }))]}
        />
      </div>

      {/* Loans table. salary-table-wrap + TableCustomScrollbar gives a branded
          horizontal bar so the overflowing columns scroll cleanly on mobile
          (native bar hidden). No desktop change - the table already fits there. */}
      <div
        ref={tableWrapRef}
        className="salary-table-wrap overflow-hidden rounded-xl"
        style={{ border: '1px solid var(--cr-border)' }}
      >
        <Table<EmployerLoan>
          rowKey="_id"
          size="middle"
          loading={loading}
          columns={columns}
          dataSource={loans}
          pagination={{
            pageSize: 20,
            showSizeChanger: false,
            showTotal: (total) => t('paginationTotal', { total }),
          }}
          locale={{ emptyText: t('emptyLoans') }}
          scroll={{ x: 'max-content' }}
        />
        <TableCustomScrollbar containerRef={tableWrapRef} />
      </div>

      {/* Create Loan Drawer */}
      {currentWorkspaceId && (
        <CreateLoanDrawer
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          workspaceId={currentWorkspaceId}
          members={members.map((m) => ({
            id: m.id,
            name: m.name,
            designation: m.designation,
          }))}
          onCreated={() => {
            setCreateOpen(false);
            void loadData();
          }}
        />
      )}

      {/* Loan Detail Drawer */}
      {currentWorkspaceId && (
        <LoanDetailDrawer
          open={detailLoanId !== null}
          loanId={detailLoanId}
          workspaceId={currentWorkspaceId}
          memberName={
            detailLoanId
              ? (memberMap.get(loans.find((l) => l._id === detailLoanId)?.teamMemberId ?? '')
                  ?.name ?? undefined)
              : undefined
          }
          onClose={() => setDetailLoanId(null)}
          onMutated={() => void loadData()}
        />
      )}
    </div>
  );
}
