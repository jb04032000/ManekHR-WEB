'use client';
import { Card, Tag } from 'antd';
import { StarOutlined, StarFilled } from '@ant-design/icons';
import DsButton from '@/components/ui/DsButton';

export interface ReportDef {
  id: string;
  title: string;
  description: string;
  href: string;
  isNew: boolean;
}

interface ReportCardProps {
  report: ReportDef;
  categoryColor: string;
  categoryTint: string;
  categoryIcon: React.ReactNode;
  categoryKey: string;
  categoryLabel: string;
  isFavorited: boolean;
  onFavoriteToggle: (id: string) => void;
  onOpen: (report: ReportDef) => void;
}

export function ReportCard({
  report,
  categoryColor,
  categoryTint,
  categoryIcon,
  categoryLabel,
  isFavorited,
  onFavoriteToggle,
  onOpen,
}: ReportCardProps) {
  return (
    <Card
      className="card-hover"
      style={{
        border: '1px solid var(--cr-border)',
        borderRadius: 'var(--cr-radius-xl)',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
      }}
      styles={{
        body: {
          padding: 'var(--cr-space-md)',
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          gap: 'var(--cr-space-sm)',
        },
      }}
    >
      {/* Header row: icon + title */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--cr-space-sm)' }}>
        <div
          style={{
            width: 40,
            height: 40,
            minWidth: 40,
            background: categoryTint,
            borderRadius: 'var(--cr-radius-md)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 18,
            color: categoryColor,
          }}
        >
          {categoryIcon}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 700,
              fontSize: 14,
              color: 'var(--cr-text)',
              lineHeight: 1.2,
            }}
          >
            {report.title}
          </div>
        </div>
      </div>

      {/* Description */}
      <p
        style={{
          fontSize: 14,
          color: 'var(--cr-text-3)',
          margin: 0,
          lineHeight: 1.5,
          WebkitLineClamp: 2,
          display: '-webkit-box',
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
          flex: 1,
        }}
      >
        {report.description}
      </p>

      {/* Badge row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
        <Tag
          style={{
            color: categoryColor,
            borderColor: categoryColor,
            background: categoryTint,
            fontSize: 11,
            margin: 0,
          }}
        >
          {categoryLabel}
        </Tag>
        {report.isNew && (
          <Tag color="blue" style={{ fontSize: 11, margin: 0 }}>
            New
          </Tag>
        )}
      </div>

      {/* Footer: favorite toggle + open button */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginTop: 'auto',
          paddingTop: 4,
        }}
      >
        <button
          onClick={() => onFavoriteToggle(report.id)}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 4,
            display: 'flex',
            alignItems: 'center',
            fontSize: 18,
            color: isFavorited ? 'var(--cr-warning-500)' : 'var(--cr-text-3)',
          }}
          aria-label={isFavorited ? 'Remove from favorites' : 'Add to favorites'}
          title={isFavorited ? 'Remove from favorites' : 'Add to favorites'}
        >
          {isFavorited ? <StarFilled /> : <StarOutlined />}
        </button>

        <DsButton dsVariant="primary" dsSize="sm" onClick={() => onOpen(report)}>
          Open Report
        </DsButton>
      </div>
    </Card>
  );
}
