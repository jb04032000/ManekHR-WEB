'use client';
import type { ReactNode } from 'react';
import { Tag } from 'antd';
import { useTranslations } from 'next-intl';

export interface MemberProfileRailItem {
  key: string;
  label: string;
  icon: ReactNode;
  description?: string;
  badge?: number;
}

interface Props {
  items: MemberProfileRailItem[];
  activeKey: string;
  onChange: (key: string) => void;
}

export default function MemberProfileRail({ items, activeKey, onChange }: Props) {
  const t = useTranslations('team');
  return (
    <nav
      aria-label={t('railAriaLabel')}
      className="flex flex-col gap-1 rounded-xl border border-gray-200 bg-white p-2 shadow-sm"
    >
      {items.map((item) => {
        const isActive = item.key === activeKey;
        return (
          <button
            key={item.key}
            type="button"
            onClick={() => onChange(item.key)}
            className={
              isActive
                ? 'group flex cursor-pointer items-start gap-3 rounded-lg border-l-[3px] border-blue-600 bg-blue-50 px-3 py-2.5 text-left text-blue-700 transition-colors'
                : 'group flex cursor-pointer items-start gap-3 rounded-lg border-l-[3px] border-transparent px-3 py-2.5 text-left text-gray-600 transition-colors hover:bg-gray-50 hover:text-gray-900'
            }
          >
            <span
              className={
                isActive
                  ? 'mt-0.5 flex-shrink-0 text-blue-700'
                  : 'mt-0.5 flex-shrink-0 text-faint group-hover:text-gray-600'
              }
              style={{ fontSize: 16 }}
            >
              {item.icon}
            </span>
            <div className="flex min-w-0 flex-1 flex-col">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-sm font-semibold">{item.label}</span>
                {typeof item.badge === 'number' && item.badge > 0 && (
                  <Tag color="blue" className="m-0 text-[10px] leading-4">
                    {item.badge}
                  </Tag>
                )}
              </div>
              {item.description && (
                <span className="mt-0.5 truncate text-[11px] text-faint">{item.description}</span>
              )}
            </div>
          </button>
        );
      })}
    </nav>
  );
}
