'use client';

import type { ReactNode } from 'react';
import { FeedbackButton } from './FeedbackButton';
import { KeyboardShortcutsButton } from './KeyboardShortcutsButton';
import { PlanFeaturesButton } from './PlanFeaturesButton';
import { UserGuideButton } from './UserGuideButton';

export interface HeaderRightActionsProps {
  module: string;
  /** Optional human-readable label used by atoms that title themselves (e.g. UserGuide). */
  moduleLabel?: string;
  /** Human page name for the feedback panel's "This page" chip (from TopHeader currentTitle). */
  pageLabel?: string;
  /** Hide individual atoms when not applicable. */
  hide?: {
    plan?: boolean;
    guide?: boolean;
    shortcuts?: boolean;
    feedback?: boolean;
  };
  /** Slot for module-specific extras (Export, primary CTA). Rendered first. */
  extras?: ReactNode;
}

export function HeaderRightActions({
  module,
  moduleLabel,
  pageLabel,
  hide,
  extras,
}: HeaderRightActionsProps) {
  return (
    <div className="flex items-center gap-3">
      {extras}
      {!hide?.shortcuts && <KeyboardShortcutsButton module={module} />}
      {!hide?.guide && <UserGuideButton module={module} moduleLabel={moduleLabel} />}
      {!hide?.plan && <PlanFeaturesButton module={module} />}
      {!hide?.feedback && <FeedbackButton module={module} pageLabel={pageLabel} />}
    </div>
  );
}

export default HeaderRightActions;
