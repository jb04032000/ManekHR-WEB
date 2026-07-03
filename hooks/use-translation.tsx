'use client';
import { createContext, useContext, ReactNode } from 'react';
import { useTranslations as useNextIntl } from 'next-intl';

type TranslateFunction = (key: string, options?: Record<string, string | number>) => string;

const TranslationContext = createContext<TranslateFunction>(() => '');

export function TranslationProvider({ children }: { children: ReactNode }) {
  return (
    <TranslationContext.Provider value={useNextIntl()}>
      {children}
    </TranslationContext.Provider>
  );
}

export function useTranslation(): TranslateFunction {
  return useContext(TranslationContext);
}
