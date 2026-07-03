/**
 * Human-readable labels for company-page panel values.
 *
 * Specialization tags reuse `categoryLabel` (the same map the marketplace +
 * directory use). Languages are free-text tags that are often stored as ISO
 * codes (e.g. `gu`, `hi`); `languageLabel` turns those into proper names via the
 * built-in `Intl.DisplayNames` (localized to the reader where possible), and
 * passes through anything that is already a name. No hardcoded language strings.
 */

/** App locale -> a BCP-47 base the platform's `Intl` can resolve. The Latin
 *  pseudo-locales (gu-en / hi-en) read Latin script, so English names suit them;
 *  native `gu` gets Gujarati-script names. */
function intlBaseFor(appLocale: string): string {
  return appLocale === 'gu' ? 'gu' : 'en';
}

const displayNamesCache = new Map<string, Intl.DisplayNames>();

function displayNamesFor(appLocale: string): Intl.DisplayNames | null {
  const base = intlBaseFor(appLocale);
  if (!displayNamesCache.has(base)) {
    try {
      displayNamesCache.set(base, new Intl.DisplayNames([base], { type: 'language' }));
    } catch {
      return null;
    }
  }
  return displayNamesCache.get(base) ?? null;
}

/** Title-case a slug / raw token ("job-work" -> "Job Work"). */
function titleCase(value: string): string {
  return value
    .replace(/[-_]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * A display name for one language value. ISO codes ('gu', 'hi') resolve to a
 * proper name; an already-typed name ('Gujarati') passes through. Unknown /
 * invalid input degrades to a title-cased version of the raw value.
 */
export function languageLabel(value: string, appLocale: string): string {
  const v = value.trim();
  if (!v) return v;
  const dn = displayNamesFor(appLocale);
  if (dn) {
    try {
      const resolved = dn.of(v.toLowerCase());
      // `Intl.DisplayNames` echoes the input back for an unknown code; only use
      // the result when it actually mapped to a different, human name.
      if (resolved && resolved.toLowerCase() !== v.toLowerCase()) return resolved;
    } catch {
      /* invalid language tag (e.g. a free-text name) -> fall through to titleCase */
    }
  }
  return titleCase(v);
}
