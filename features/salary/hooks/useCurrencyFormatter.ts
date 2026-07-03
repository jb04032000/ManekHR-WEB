import { useMemo } from 'react';
import { usePayrollConfigStore } from '../store/usePayrollConfigStore';
import { formatCurrency, formatCurrencyFull } from '@/lib/utils';

export function useCurrencyFormatter() {
  const config = usePayrollConfigStore((s) => s.config?.display);

  const symbol = config?.currencySymbol || '₹';
  const locale = config?.currencyLocale || 'en-IN';

  const fmt = useMemo(
    () => ({
      currency: (amount: number) => formatCurrency(amount, symbol, locale),
      full: (amount: number) => formatCurrencyFull(amount, symbol, locale),
      symbol,
      locale,
      inline: (amount: number) =>
        `${symbol}${Number(amount ?? 0).toLocaleString(locale)}`,
    }),
    [locale, symbol],
  );

  return fmt;
}
