'use client';

import { ReactNode, useState } from 'react';
import { Drawer, Popover, Tooltip } from 'antd';
import { InfoCircleOutlined } from '@ant-design/icons';

export type InfoTooltipVariant = 'tooltip' | 'popover' | 'drawer';

export interface InfoTooltipProps {
  /** Short tooltip body shown on hover/focus. */
  text: string;
  /**
   * Optional richer content. By default opens in a `popover` (small floating
   * panel beside the icon). Use `variant: 'drawer'` only for long-form
   * documentation that wouldn't fit naturally in a popover (typically more
   * than ~3 short paragraphs or any embedded media). Per polish-rules tier:
   * - `tooltip` (no body): one-line label / hint
   * - `popover` (default w/ body): 1–3 short paragraphs of inline help
   * - `drawer`: long-form docs, embedded media, lists with action buttons
   */
  body?: ReactNode;
  /** Explicit variant override. Defaults to `tooltip` if no body, else `popover`. */
  variant?: InfoTooltipVariant;
  /** Override the default info icon. */
  icon?: ReactNode;
  /** Class applied to the icon trigger. */
  iconClassName?: string;
  /** Accessible label for screen readers. Defaults to `text`. */
  ariaLabel?: string;
}

export function InfoTooltip({
  text,
  body,
  variant,
  icon,
  iconClassName,
  ariaLabel,
}: InfoTooltipProps) {
  const [open, setOpen] = useState(false);
  const resolvedVariant: InfoTooltipVariant = variant ?? (body ? 'popover' : 'tooltip');
  const isInteractive = resolvedVariant === 'popover' || resolvedVariant === 'drawer';
  const triggerLabel = ariaLabel ?? text;
  const iconNode = icon ?? <InfoCircleOutlined />;

  const triggerButton = (
    <button
      type="button"
      aria-label={triggerLabel}
      onClick={resolvedVariant === 'drawer' ? () => setOpen(true) : undefined}
      className={`inline-flex items-center justify-center rounded border-0 bg-transparent p-0 text-muted hover:text-primary focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none ${
        isInteractive ? 'cursor-pointer' : 'cursor-default'
      } ${iconClassName ?? ''}`}
    >
      {iconNode}
    </button>
  );

  if (resolvedVariant === 'popover' && body) {
    return (
      <Popover
        title={text}
        content={<div className="max-w-[320px]">{body}</div>}
        trigger={['hover', 'focus', 'click']}
        placement="rightTop"
      >
        {triggerButton}
      </Popover>
    );
  }

  if (resolvedVariant === 'drawer' && body) {
    return (
      <>
        <Tooltip title={text}>{triggerButton}</Tooltip>
        <Drawer
          title={text}
          open={open}
          onClose={() => setOpen(false)}
          placement="right"
          size="default"
        >
          {body}
        </Drawer>
      </>
    );
  }

  return <Tooltip title={text}>{triggerButton}</Tooltip>;
}

export default InfoTooltip;
