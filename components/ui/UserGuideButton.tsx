'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Drawer, Tooltip } from 'antd';
import { BookOutlined, ArrowRightOutlined } from '@ant-design/icons';
import { MODULE_GUIDES } from '@/lib/constants/module-guides';

export interface UserGuideButtonProps {
  /** Module key - used to title the drawer + look up the MODULE_GUIDES entry. */
  module: string;
  /** Optional human-readable label shown in the drawer title. Defaults to capitalized module. */
  moduleLabel?: string;
}

export function UserGuideButton({ module, moduleLabel }: UserGuideButtonProps) {
  const [open, setOpen] = useState(false);
  const guide = MODULE_GUIDES[module];
  const label = guide?.title ?? moduleLabel ?? module.charAt(0).toUpperCase() + module.slice(1);
  const tooltip = `Open ${label} user guide`;

  return (
    <>
      <Tooltip title={tooltip}>
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={tooltip}
          className="flex cursor-pointer items-center gap-1 border-0 bg-transparent p-0 text-xs font-medium text-gray-700 transition-colors hover:text-blue-700"
        >
          <BookOutlined />
          {/* Icon-only on mobile to keep the breadcrumb-row action cluster compact. */}
          <span className="hidden md:inline">User Guide</span>
        </button>
      </Tooltip>

      <Drawer
        title={
          <div className="flex items-center gap-2">
            <BookOutlined style={{ color: 'var(--cr-primary)' }} />
            <span className="font-display font-bold">{label} User Guide</span>
          </div>
        }
        open={open}
        onClose={() => setOpen(false)}
        size="default"
      >
        {guide ? (
          <div className="space-y-6">
            <p className="m-0 text-sm leading-relaxed text-gray-700">{guide.intro}</p>

            <div className="space-y-4">
              {guide.sections.map((s) => (
                <div key={s.heading}>
                  <h3 className="m-0 mb-1 text-[13px] font-bold text-heading">{s.heading}</h3>
                  <p className="m-0 text-[13px] leading-relaxed text-gray-700">{s.body}</p>
                </div>
              ))}
            </div>

            {guide.related.length > 0 && (
              <div>
                <h3 className="m-0 mb-2 text-xs font-semibold tracking-[0.16em] text-subtle uppercase">
                  Works with
                </h3>
                <div className="space-y-2">
                  {guide.related.map((r) => (
                    <Link
                      key={r.href}
                      href={r.href}
                      onClick={() => setOpen(false)}
                      className="block rounded-lg border border-[var(--cr-border-light)] px-3 py-2.5 transition-colors hover:border-[var(--cr-primary)] hover:bg-primary-light"
                    >
                      <span className="flex items-center gap-1.5 text-[13px] font-semibold text-heading">
                        {r.label}
                        <ArrowRightOutlined style={{ fontSize: 11 }} />
                      </span>
                      <span className="mt-0.5 block text-[12px] leading-snug text-subtle">
                        {r.why}
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-sm leading-relaxed text-gray-700">
            Documentation coming soon. The {label} user guide will render here once authored.
          </div>
        )}
      </Drawer>
    </>
  );
}

export default UserGuideButton;
