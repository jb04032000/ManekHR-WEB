'use client';
/**
 * Warning banner shown when same draft is detected open in another tab (BroadcastChannel).
 * Per F-02 UI-SPEC: bg var(--cr-warning-50), border-bottom 1px var(--cr-warning-50), WarningOutlined var(--cr-warning-700).
 */
import { WarningOutlined } from '@ant-design/icons';
import DsButton from '@/components/ui/DsButton';

interface ConcurrentEditBannerProps {
  visible: boolean;
  onDismiss: () => void;
}

export function ConcurrentEditBanner({ visible, onDismiss }: ConcurrentEditBannerProps) {
  if (!visible) return null;

  return (
    <div
      style={{
        width: '100%',
        background: 'var(--cr-warning-50)',
        borderBottom: '1px solid var(--cr-warning-50)',
        padding: '8px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
      }}
    >
      <WarningOutlined style={{ color: 'var(--cr-warning-700)', fontSize: 14 }} />
      <span style={{ flex: 1, fontSize: 13, color: 'var(--cr-warning-700)' }}>
        This draft is open in another tab. Edits here may conflict.
      </span>
      <DsButton dsVariant="ghost" dsSize="sm" onClick={onDismiss}>
        Dismiss
      </DsButton>
    </div>
  );
}
