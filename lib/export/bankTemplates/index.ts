import type { BankTemplateId } from '@/types';
import type { BankTemplate } from './types';
import { genericTemplate } from './generic';
import { hdfcTemplate } from './hdfc';
import { iciciTemplate } from './icici';
import { sbiTemplate } from './sbi';
import { axisTemplate } from './axis';
import { kotakTemplate } from './kotak';
import { yesTemplate } from './yes';
import { idfcTemplate } from './idfc';
import { indusindTemplate } from './indusind';

export const BANK_TEMPLATES: BankTemplate[] = [
  genericTemplate,
  hdfcTemplate,
  iciciTemplate,
  sbiTemplate,
  axisTemplate,
  kotakTemplate,
  yesTemplate,
  idfcTemplate,
  indusindTemplate,
];

const templateMap = new Map<BankTemplateId, BankTemplate>(
  BANK_TEMPLATES.map((t) => [t.id, t]),
);

export function getTemplate(id: BankTemplateId): BankTemplate {
  return templateMap.get(id) ?? genericTemplate;
}

export type { BankTemplate } from './types';
