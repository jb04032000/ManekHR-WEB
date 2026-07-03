import React from 'react';

/**
 * RupeeOutlined - renders the ₹ (INR) symbol as an anticon-compatible glyph.
 * Drop-in replacement for AntD's DollarOutlined/DollarCircleOutlined across the app.
 * Cross-module: used across app/dashboard/salary/**, components/dashboard/**, finance, sidebar, etc.
 * Keep in sync: useCurrencyFormatter / formatCurrency already default the text symbol to ₹.
 */
export function RupeeOutlined({
  className,
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <span
      className={`anticon${className ? ' ' + className : ''}`}
      style={{ fontWeight: 600, ...style }}
      aria-label="rupee"
      role="img"
    >
      ₹
    </span>
  );
}
