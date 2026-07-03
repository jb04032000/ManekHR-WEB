import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
import i18next from 'eslint-plugin-i18next';

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  i18next.configs['flat/recommended'],
  {
    rules: {
      // Phase 0 floor. Flips to 'warn' during Phase 1C hardcoded-string migration,
      // then to 'error' after migration finishes.
      'i18next/no-literal-string': 'off',

      // Phase 0 tightening. Module sweep fixes violations per module.
      '@typescript-eslint/no-explicit-any': 'warn',
      'no-console': ['warn', { allow: ['warn', 'error', 'info'] }],

      // Activated after Phase 0.7 web env loader migration completed.
      // Forces all process.env access through lib/env.ts.
      'no-restricted-syntax': [
        'warn',
        {
          selector: 'MemberExpression[object.object.name="process"][object.property.name="env"]',
          message: 'Do not access process.env directly - import the typed `env` from @/lib/env.',
        },
        {
          // A Next <Link> wrapping a <DsButton> renders an invalid, nested
          // <a><button> (two tab stops, confusing screen-reader output, WCAG
          // 4.1.2 / 1.3.1). Pass `href` to DsButton so it renders a single
          // accessible anchor styled as the button.
          selector:
            'JSXElement[openingElement.name.name="Link"] > JSXElement[openingElement.name.name="DsButton"]',
          message:
            'Do not nest <DsButton> inside a Next <Link>: it renders an invalid <a><button>. Pass href to DsButton instead so the CTA is a single accessible anchor.',
        },
      ],
    },
  },
  {
    // Files allowed to read process.env directly: env loader, build configs,
    // Sentry instrumentation, scripts.
    files: [
      'lib/env.ts',
      'next.config.*',
      '*.config.*',
      'instrumentation.ts',
      'instrumentation-client.ts',
      'sentry.*.config.*',
      'scripts/**',
      // Wave 4.13 (2026-05-10) - E2E tests legitimately consume process.env
      // for fixture provisioning (E2E_OWNER_*, MONGO_URI, etc.). The typed
      // `env` loader is for app runtime; tests run outside that scope.
      'tests/e2e/**',
      'playwright.config.*',
    ],
    rules: {
      'no-restricted-syntax': 'off',
    },
  },
  {
    // Payroll surface guard: ban AntD v6-deprecated component props at ERROR level
    // so they cannot silently recur (they emit a console warning on every render).
    // Re-declares the process.env selector because no-restricted-syntax is a single
    // rule and a later config block REPLACES (not merges) the earlier selector list.
    // See crewroster-web/CLAUDE.md "AntD API conventions" for the full banned table.
    files: [
      'app/dashboard/salary/**/*.{ts,tsx}',
      'components/dashboard/loans/**/*.{ts,tsx}',
      'features/salary/**/*.{ts,tsx}',
      'components/dashboard/team/salary/**/*.{ts,tsx}',
      'components/dashboard/team/attendance/**/*.{ts,tsx}',
    ],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: 'MemberExpression[object.object.name="process"][object.property.name="env"]',
          message: 'Do not access process.env directly - import the typed `env` from @/lib/env.',
        },
        {
          selector:
            "JSXOpeningElement[name.name='Drawer'] > JSXAttribute[name.name=/^(width|height)$/]",
          message: 'AntD v6: <Drawer> `width`/`height` are deprecated. Use `size={n}` instead.',
        },
        {
          selector:
            "JSXOpeningElement[name.name='InputNumber'] > JSXAttribute[name.name=/^addon(After|Before)$/]",
          message:
            'AntD v6: <InputNumber> `addonAfter`/`addonBefore` are deprecated. Use `suffix`/`prefix` (or <Space.Compact>).',
        },
        {
          selector:
            "JSXOpeningElement[name.name=/^(Modal|Drawer)$/] > JSXAttribute[name.name='destroyOnClose']",
          message: 'AntD v6: `destroyOnClose` is deprecated. Use `destroyOnHidden`.',
        },
        {
          selector:
            'JSXOpeningElement[name.name=/^(Tooltip|Popover)$/] > JSXAttribute[name.name=/^(overlayStyle|overlayClassName|overlayInnerStyle)$/]',
          message:
            'AntD v6: `overlayStyle`/`overlayClassName`/`overlayInnerStyle` are deprecated. Use `styles`/`classNames`.',
        },
        {
          selector:
            'JSXAttribute[name.name=/^(popupStyle|popupClassName|dropdownStyle|dropdownClassName)$/]',
          message:
            'AntD v6: `popupStyle`/`popupClassName` (and `dropdownStyle`/`dropdownClassName`) are deprecated. Use `styles={{ popup: { root } }}` / `classNames={{ popup: { root } }}`.',
        },
      ],
    },
  },
  globalIgnores([
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
    'scripts/**',
    // Static assets served as-is by Next (icons, robots, og images, and the
    // hand-written PWA service worker public/sw.js, which uses service-worker
    // globals like `self`/`caches`/`clients` that the app lint config rejects).
    'public/**',
    // Generated upload-policy mirror - machine-emitted from the backend single
    // source of truth (see lib/upload-policies.helpers.ts header). Never linted
    // or hand-edited; regenerated via `npm run sync:upload-policies`.
    'lib/upload-policies.ts',
    // Connect design-handoff reference - wireframe sketches (undefined
    // prototype components), not application code. Kept as design source of
    // truth; never linted or built.
    'docs/connect/source/**',
  ]),
]);

export default eslintConfig;
