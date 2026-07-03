'use client';

// Breadcrumb-row "Feedback" trigger. Keeps the same chip; opens the upgraded
// FeedbackPanel in a Popover (desktop) / bottom Drawer (mobile). The page name
// (pageLabel) comes from TopHeader's currentTitle for the "This page" chip.
// Links to: FeedbackPanel.tsx, HeaderRightActions.tsx.
import { useState, useSyncExternalStore } from 'react';
import { Popover, Drawer, Tooltip } from 'antd';
import { MessageOutlined } from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import { track } from '@/lib/analytics';
import FeedbackPanel from './FeedbackPanel';

export interface FeedbackButtonProps {
  module: string;
  pageLabel?: string;
}

const MOBILE_Q = '(max-width: 767.98px)';
function subMobile(notify: () => void) {
  if (typeof window === 'undefined') return () => undefined;
  const mq = window.matchMedia(MOBILE_Q);
  mq.addEventListener('change', notify);
  return () => mq.removeEventListener('change', notify);
}
function getMobile() {
  return typeof window !== 'undefined' && window.matchMedia(MOBILE_Q).matches;
}

export function FeedbackButton({ module, pageLabel }: FeedbackButtonProps) {
  const t = useTranslations('feedback');
  const [open, setOpen] = useState(false);
  const isMobile = useSyncExternalStore(subMobile, getMobile, () => false);

  const openPanel = () => {
    setOpen(true);
    track('feedback.open', { module });
  };
  const close = () => setOpen(false);

  const trigger = (
    <Tooltip title={t('title')}>
      <button
        type="button"
        onClick={openPanel}
        aria-label={t('title')}
        className="flex cursor-pointer items-center gap-1 border-0 bg-transparent p-0 text-xs font-medium text-gray-700 transition-colors hover:text-blue-700"
      >
        <MessageOutlined />
        {/* Icon-only on mobile to keep the breadcrumb-row action cluster compact. */}
        <span className="hidden md:inline">{t('trigger')}</span>
      </button>
    </Tooltip>
  );

  if (isMobile) {
    return (
      <>
        {trigger}
        <Drawer
          open={open}
          onClose={close}
          placement="bottom"
          // Bottom sheet fits its content height (via .feedback-drawer-wrapper in
          // globals.css: height auto, capped at 92dvh, body scrolls if it grows).
          // AntD's fixed `size` height left a large dead zone under the short form
          // on phones. `fullWidth` makes the panel fill the drawer width so it
          // doesn't leave a right gutter (desktop Popover keeps the fixed 340px).
          classNames={{ wrapper: 'feedback-drawer-wrapper' }}
          styles={{ body: { overflowY: 'auto' } }}
          destroyOnHidden
          title={t('title')}
        >
          <FeedbackPanel module={module} pageLabel={pageLabel} onDone={close} fullWidth />
        </Drawer>
      </>
    );
  }

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        if (!o) close();
      }}
      trigger="click"
      placement="bottomRight"
      title={t('title')}
      // destroyOnHidden unmounts the panel on close so it always reopens clean
      // (no stale text / photos). See CLAUDE.md "Modal / Drawer behaviour".
      destroyOnHidden
      content={<FeedbackPanel module={module} pageLabel={pageLabel} onDone={close} />}
    >
      {trigger}
    </Popover>
  );
}

export default FeedbackButton;
