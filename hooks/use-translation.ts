'use client';
import { useTranslations } from 'next-intl';

export function useTranslation() {
  const t = useTranslations();
  return (key: string, fallback?: string): string => {
    try {
      return t(key);
    } catch {
      return fallback || key;
    }
  };
}
