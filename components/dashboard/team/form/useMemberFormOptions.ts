'use client';
import { useMemo } from 'react';
import { useTranslations } from 'next-intl';

export type EmploymentTypeValue = 'full_time' | 'part_time' | 'contract' | 'intern' | 'consultant';

export type MaritalStatusValue = 'single' | 'married' | 'divorced' | 'widowed';

export interface WeekDayOption {
  label: string;
  value: string;
  name: string;
}

export interface ShiftDayOption {
  label: string;
  value: number;
  name: string;
}

export function useMemberFormOptions() {
  const t = useTranslations('team');

  const employmentTypeOptions = useMemo<{ label: string; value: EmploymentTypeValue }[]>(
    () => [
      { label: t('optEmpFullTime'), value: 'full_time' },
      { label: t('optEmpPartTime'), value: 'part_time' },
      { label: t('optEmpContract'), value: 'contract' },
      { label: t('optEmpIntern'), value: 'intern' },
      { label: t('optEmpConsultant'), value: 'consultant' },
    ],
    [t],
  );

  const maritalStatusOptions = useMemo<{ label: string; value: MaritalStatusValue }[]>(
    () => [
      { label: t('optMaritalSingle'), value: 'single' },
      { label: t('optMaritalMarried'), value: 'married' },
      { label: t('optMaritalDivorced'), value: 'divorced' },
      { label: t('optMaritalWidowed'), value: 'widowed' },
    ],
    [t],
  );

  const weekDays = useMemo<WeekDayOption[]>(
    () => [
      { label: t('weekDayLetterSun'), value: '0', name: t('weekDayShortSun') },
      { label: t('weekDayLetterMon'), value: '1', name: t('weekDayShortMon') },
      { label: t('weekDayLetterTue'), value: '2', name: t('weekDayShortTue') },
      { label: t('weekDayLetterWed'), value: '3', name: t('weekDayShortWed') },
      { label: t('weekDayLetterThu'), value: '4', name: t('weekDayShortThu') },
      { label: t('weekDayLetterFri'), value: '5', name: t('weekDayShortFri') },
      { label: t('weekDayLetterSat'), value: '6', name: t('weekDayShortSat') },
    ],
    [t],
  );

  const shiftDays = useMemo<ShiftDayOption[]>(
    () => [
      { label: t('weekDayLetterSun'), value: 0, name: t('weekDayShortSun') },
      { label: t('weekDayLetterMon'), value: 1, name: t('weekDayShortMon') },
      { label: t('weekDayLetterTue'), value: 2, name: t('weekDayShortTue') },
      { label: t('weekDayLetterWed'), value: 3, name: t('weekDayShortWed') },
      { label: t('weekDayLetterThu'), value: 4, name: t('weekDayShortThu') },
      { label: t('weekDayLetterFri'), value: 5, name: t('weekDayShortFri') },
      { label: t('weekDayLetterSat'), value: 6, name: t('weekDayShortSat') },
    ],
    [t],
  );

  const formatServiceDuration = useMemo(
    () =>
      (years = 0, months = 0) =>
        t('formatServiceDuration', { years, months }),
    [t],
  );

  return {
    employmentTypeOptions,
    maritalStatusOptions,
    weekDays,
    shiftDays,
    formatServiceDuration,
  };
}
