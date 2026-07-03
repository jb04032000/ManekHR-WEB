'use client';

import { ReactNode } from 'react';
import { Button, Space } from 'antd';
import Link from 'next/link';

interface EmptyStateLayoutProps {
  icon: ReactNode;
  title: string;
  description: string;
  actions?: {
    label: string;
    onClick?: () => void;
    href?: string;
    type?: 'primary' | 'default';
    icon?: ReactNode;
    className?: string;
  }[];
  iconBgColor?: string;
  iconSize?: 'sm' | 'md' | 'lg';
  maxWidth?: string;
  /** Heading level for title. Default `h1` (page-level empty states). Use `h2` when embedded in a page that already has an H1. */
  as?: 'h1' | 'h2';
}

export function EmptyStateLayout({
  icon,
  title,
  description,
  actions,
  iconBgColor = 'bg-gray-100',
  iconSize = 'md',
  maxWidth = '28rem',
  as = 'h1',
}: EmptyStateLayoutProps) {
  const Heading = as;
  const iconSizeClasses = {
    sm: 'w-12 h-12 text-2xl',
    md: 'w-16 h-16 text-3xl',
    lg: 'w-24 h-24 text-4xl',
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-8">
      <div
        className={`${iconSizeClasses[iconSize]} rounded-full ${iconBgColor} flex items-center justify-center mb-6`}
      >
        {icon}
      </div>
      <Heading
        className="text-2xl font-bold text-center mb-2"
        style={{ wordBreak: 'normal' }}
      >
        {title}
      </Heading>
      <p
        className="text-center mb-8 text-gray-700"
        style={{
          maxWidth,
          wordBreak: 'normal',
          whiteSpace: 'normal',
        }}
      >
        {description}
      </p>
      {actions && actions.length > 0 && (
        <Space size="middle">
          {actions.map((action, index) => {
            if (action.href) {
              return (
                <Link key={index} href={action.href}>
                  <Button
                    type={action.type || 'default'}
                    icon={action.icon}
                    className={action.className}
                  >
                    {action.label}
                  </Button>
                </Link>
              );
            }

            return (
              <Button
                key={index}
                type={action.type || 'default'}
                icon={action.icon}
                className={action.className}
                onClick={action.onClick}
              >
                {action.label}
              </Button>
            );
          })}
        </Space>
      )}
    </div>
  );
}
