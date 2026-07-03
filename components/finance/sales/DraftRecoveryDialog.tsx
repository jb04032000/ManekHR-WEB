'use client';
/**
 * Non-dismissible modal shown when IndexedDB has a newer draft than server (crash recovery).
 * Per F-02 D-07. closable=false + maskClosable=false enforced.
 */
import { DsModal } from '@/components/ui/DsModal';
import DsButton from '@/components/ui/DsButton';
import { ClockCircleOutlined } from '@ant-design/icons';
import type { DraftRecord } from '@/lib/finance/draftStore';

function relativeTime(ms: number): string {
  const diff = Date.now() - ms;
  const minutes = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  return 'just now';
}

interface DraftRecoveryDialogProps {
  open: boolean;
  localDraft: DraftRecord;
  serverUpdatedAt: number | null;
  onResume: () => void;
  onDiscard: () => void;
}

export function DraftRecoveryDialog({
  open,
  localDraft,
  serverUpdatedAt: _serverUpdatedAt,
  onResume,
  onDiscard,
}: DraftRecoveryDialogProps) {
  return (
    <DsModal
      open={open}
      title={
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <ClockCircleOutlined style={{ color: 'var(--cr-primary)' }} />
          Resume your in-progress draft?
        </span>
      }
      closable={false}
      mask={{ closable: false }}
      width={480}
      footer={
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <DsButton dsVariant="ghost" dsSize="sm" onClick={onDiscard}>
            Discard
          </DsButton>
          <DsButton dsVariant="primary" dsSize="sm" onClick={onResume}>
            Resume Draft
          </DsButton>
        </div>
      }
    >
      <div
        style={{
          background: 'var(--cr-primary-light)',
          border: '1px solid var(--cr-primary-border)',
          borderRadius: 8,
          padding: 12,
          marginBottom: 12,
        }}
      >
        <p style={{ margin: 0, fontSize: 13, color: 'var(--cr-text-2)' }}>
          An unsaved draft was found from <strong>{relativeTime(localDraft.updatedAt)}</strong>.
        </p>
      </div>
      <p style={{ fontSize: 14, color: 'var(--cr-text-2)' }}>
        Resume editing to continue from where you left off, or discard to start fresh from the
        server version.
      </p>
    </DsModal>
  );
}
