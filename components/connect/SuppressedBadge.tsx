'use client';

/**
 * "Hidden" badge for an owner's item that is currently suppressed from public
 * view by the over-limit `hide_newest` policy (grandfathering). The owner still
 * sees + edits the item; this badge + tooltip explain why the public can't see
 * it and that nothing was deleted. Under the default `freeze` policy no item is
 * ever suppressed, so this badge never renders in practice.
 *
 * Render it on the owner's item rows (products / storefronts / company pages /
 * jobs) when the management list marks an item `suppressed: true`.
 *
 * Links: backend ConnectOverLimitService (computes the suppressed set);
 * i18n connect.overLimit.suppressedBadge / suppressedTooltip.
 */

import { Tag, Tooltip } from 'antd';
import { EyeInvisibleOutlined } from '@ant-design/icons';
import { useTranslations } from 'next-intl';

export function SuppressedBadge({ className }: { className?: string }) {
  const t = useTranslations('connect.overLimit');
  return (
    <Tooltip title={t('suppressedTooltip')}>
      <Tag className={className} color="warning" icon={<EyeInvisibleOutlined />}>
        {t('suppressedBadge')}
      </Tag>
    </Tooltip>
  );
}
