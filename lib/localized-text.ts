import type { LocalizedText } from '@/types';

/**
 * Resolve a per-locale text value for the active locale, with a two-step
 * fallback: requested locale -> canonical `en` -> the static i18n default.
 *
 * Used by the plan cards to render the admin-editable tagline + feature bullets
 * (components/marketing/ErpPricingTable.tsx + app/(app)/account/subscription/
 * plans/PlanCard.tsx). When an admin leaves a locale (or the whole field) blank,
 * the card falls back to the existing static `t('plans.<tier>.*')` copy so
 * nothing ever renders empty.
 *
 * Blank ('') and null locale values are treated as absent (the `||` chain skips
 * them), so a partially-translated field still resolves to en, then the default.
 */
export function pickLocalized(
  value: LocalizedText | undefined | null,
  locale: string,
  staticFallback: string,
): string {
  return value?.[locale as keyof LocalizedText] || value?.en || staticFallback;
}
