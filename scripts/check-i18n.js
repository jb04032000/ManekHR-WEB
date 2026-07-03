#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-var-requires */
// CrewRoster Polish Initiative - Phase 1A i18n catalog completeness gate.
// Fails the build (exit 1) if any key in en.json is missing in gu / gu-en / hi-en.
// Locales aligned with crewroster-web/app/i18n.ts SUPPORTED_LOCALES.

const en = require('../app/messages/en.json');
const gu = require('../app/messages/gu.json');
const guEn = require('../app/messages/gu-en.json');
const hiEn = require('../app/messages/hi-en.json');

const NON_DEFAULT_LOCALES = [
  ['gu', gu],
  ['gu-en', guEn],
  ['hi-en', hiEn],
];

function flatten(o, p = '') {
  return Object.entries(o).flatMap(([k, v]) =>
    typeof v === 'object' && v !== null ? flatten(v, p + k + '.') : [p + k],
  );
}

function get(o, k) {
  return k.split('.').reduce((a, p) => (a == null ? a : a[p]), o);
}

const enKeys = flatten(en);
const missing = enKeys.flatMap((k) =>
  NON_DEFAULT_LOCALES.flatMap(([code, bundle]) => (get(bundle, k) == null ? [`${code}:${k}`] : [])),
);

// Connect Engineering Standards #18 - human-written copy. No em-dashes (—) in
// Connect user-facing strings: an em-dash reads as an AI-writing tell. Rewrite
// the sentence with a period / comma / colon instead. Scoped to the
// connect.* and connectMode.* namespaces (ERP copy is out of scope here).
// Checked before the completeness gate so it is never masked by missing keys.
const CONNECT_NS = /^(connect|connectMode)\./;
const ALL_LOCALES = [['en', en], ...NON_DEFAULT_LOCALES];
const emDash = ALL_LOCALES.flatMap(([code, bundle]) =>
  flatten(bundle)
    .filter((k) => CONNECT_NS.test(k))
    .flatMap((k) => {
      const v = get(bundle, k);
      return typeof v === 'string' && v.includes('—') ? [`${code}:${k}`] : [];
    }),
);

if (emDash.length) {
  console.error('Em-dash (—) in Connect copy, rewrite as plain sentences:');
  emDash.forEach((m) => console.error('  ' + m));
  process.exit(1);
}

if (missing.length) {
  console.error('Missing i18n keys:');
  missing.forEach((m) => console.error('  ' + m));
  process.exit(1);
}

console.log(
  `OK - ${enKeys.length} keys present in en + ${NON_DEFAULT_LOCALES.map(([c]) => c).join(
    ' / ',
  )} catalogs.`,
);
