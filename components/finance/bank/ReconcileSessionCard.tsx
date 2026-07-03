'use client';
import React from 'react';
import { Card, Tag, Progress, Button, Typography } from 'antd';
import { ArrowRightOutlined } from '@ant-design/icons';
import Link from 'next/link';
import dayjs from 'dayjs';
import type { ReconciliationSession } from '@/types';

interface Props {
  session: ReconciliationSession;
  bankAccountName: string;
  bankAccountNumberMasked: string;
  wsId: string;
  firmId: string;
  bankAccountId: string;
}

const STATUS_TAG_COLOR: Record<string, string> = {
  draft: 'blue', // "Imported" - info color per UI-SPEC
  in_progress: 'gold', // var(--cr-warning) per UI-SPEC
  completed: 'green', // var(--cr-success) per UI-SPEC
  locked: 'default',
};

const STATUS_LABEL: Record<string, string> = {
  draft: 'Imported',
  in_progress: 'In Progress',
  completed: 'Reconciled',
  locked: 'Locked',
};

export default function ReconcileSessionCard({
  session,
  bankAccountName,
  bankAccountNumberMasked,
  wsId,
  firmId,
  bankAccountId,
}: Props) {
  const total = session.totalMatchedCount + session.totalUnmatchedCount;
  const matchPct = total > 0 ? Math.round((session.totalMatchedCount / total) * 100) : 0;
  const diffPaise = session.differenceExplained;
  const diffColor = diffPaise === 0 ? 'var(--cr-success)' : 'var(--cr-error)';

  const fmt = (paise: number) =>
    `₹${(paise / 100).toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  const href = `/dashboard/finance/bank-accounts/${bankAccountId}/reconcile/${session._id}`;

  return (
    <Card size="small" className="card-hover" style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {/* Header row: session name + status tag */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography.Title
            level={5}
            style={{ margin: 0, fontFamily: 'var(--font-display)', fontWeight: 700 }}
          >
            {session.sessionName}
          </Typography.Title>
          <Tag color={STATUS_TAG_COLOR[session.status]}>
            {STATUS_LABEL[session.status] ?? session.status}
          </Tag>
        </div>

        {/* Bank account context */}
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          {bankAccountName}
          {bankAccountNumberMasked ? ` • ${bankAccountNumberMasked}` : ''}
        </Typography.Text>

        {/* Match progress */}
        <div>
          <Typography.Text style={{ fontSize: 12 }}>
            {session.totalMatchedCount} / {total} matched ({matchPct}%)
          </Typography.Text>
          <Progress
            percent={matchPct}
            showInfo={false}
            strokeColor="var(--cr-primary)"
            size="small"
          />
        </div>

        {/* Balance row */}
        <div style={{ display: 'flex', gap: 16, fontSize: 12 }}>
          <span>
            Statement: <strong>{fmt(session.statementClosingBalancePaise)}</strong>
          </span>
          <span>
            Book: <strong>{fmt(session.bookBalancePaise)}</strong>
          </span>
          <span>
            Diff: <strong style={{ color: diffColor }}>{fmt(diffPaise)}</strong>
          </span>
        </div>

        {/* Footer: created date + open button */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: 4,
          }}
        >
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            Created {dayjs(session.createdAt).format('DD MMM YYYY')}
          </Typography.Text>
          <Link href={href}>
            <Button size="small" type="default" icon={<ArrowRightOutlined />} iconPlacement="end">
              Open
            </Button>
          </Link>
        </div>
      </div>
    </Card>
  );
}
