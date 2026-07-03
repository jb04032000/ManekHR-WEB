'use client';

import { ReactNode } from 'react';

interface DrawerLayoutProps {
  header: ReactNode;
  children: ReactNode;
}

export default function DrawerLayout({ header, children }: DrawerLayoutProps) {
  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Sticky Header - does NOT scroll */}
      {header}

      {/* Scrollable Body */}
      <div
        className="min-h-0 flex-1 overflow-y-auto"
        style={{
          fontFamily: 'var(--font-body)',
        }}
      >
        {children}
      </div>
    </div>
  );
}
