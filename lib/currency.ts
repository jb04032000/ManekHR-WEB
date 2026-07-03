import { formatCurrencyFull } from './utils';

export interface CurrencyConfig {
  symbol: string;
  locale: string;
  code: string;
}

export const DEFAULT_CURRENCY: CurrencyConfig = {
  symbol: '₹',
  locale: 'en-IN',
  code: 'INR',
};

// Map non-ASCII currency symbols to ASCII-safe equivalents for PDF rendering.
// jsPDF's built-in fonts (Helvetica, Courier, Times) lack glyphs for ₹, ¥, €, etc.
const PDF_SYMBOL_MAP: Record<string, string> = {
  '₹': 'Rs.',
  '¥': 'Y',
  '₩': 'W',
  '₫': 'VND',
  '₦': 'NGN',
  '₱': 'PHP',
  '₴': 'UAH',
  '₸': 'KZT',
  '₺': 'TRY',
  '₼': 'AZN',
  '₽': 'RUB',
};

function getPdfSafeSymbol(symbol: string): string {
  return PDF_SYMBOL_MAP[symbol] ?? symbol;
}

export function makeCurrencyFormatter(
  config: CurrencyConfig = DEFAULT_CURRENCY,
) {
  return {
    full: (amount: number) =>
      formatCurrencyFull(amount, config.symbol, config.locale),
    compact: (amount: number) => {
      const val = Number(amount ?? 0);
      if (isNaN(val)) return `${config.symbol}0`;
      if (val >= 10_00_000) {
        return `${config.symbol}${(val / 10_00_000).toFixed(2)}L`;
      }
      if (val >= 1_000) {
        return `${config.symbol}${(val / 1_000).toFixed(1)}K`;
      }
      return `${config.symbol}${val.toLocaleString(config.locale)}`;
    },
    inline: (amount: number) =>
      `${config.symbol}${Number(amount ?? 0).toLocaleString(config.locale)}`,
    prefix: config.symbol,
  };
}

export function makePdfCurrencyFormatter(
  config: CurrencyConfig = DEFAULT_CURRENCY,
) {
  const safeSymbol = getPdfSafeSymbol(config.symbol);
  const space = safeSymbol.length > 1 ? ' ' : '';
  return {
    full: (amount: number) =>
      formatCurrencyFull(amount, safeSymbol + space, config.locale),
    compact: (amount: number) => {
      const val = Number(amount ?? 0);
      if (isNaN(val)) return `${safeSymbol}${space}0`;
      if (val >= 10_00_000) {
        return `${safeSymbol}${space}${(val / 10_00_000).toFixed(2)}L`;
      }
      if (val >= 1_000) {
        return `${safeSymbol}${space}${(val / 1_000).toFixed(1)}K`;
      }
      return `${safeSymbol}${space}${val.toLocaleString(config.locale)}`;
    },
    prefix: safeSymbol + space,
  };
}
