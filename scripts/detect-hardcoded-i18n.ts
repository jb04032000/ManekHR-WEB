#!/usr/bin/env tsx
/**
 * detect-hardcoded-i18n - CrewRoster Polish Initiative Phase 1A.
 *
 * Discovery script. Reports hardcoded English strings in JSX/TSX source.
 * Phase 1A: discovery only - exit 0 always (informational baseline).
 * Phase 1C: pass `--ci` to enforce zero hardcoded literals → exit 1 if any.
 *
 * Companion to eslint-plugin-i18next/no-literal-string (currently 'off';
 * flips to 'warn' then 'error' across Phase 1C).
 *
 * Heuristic (regex; no AST parser to keep deps minimal):
 *   1. JSX text nodes between tags  (>Save</Button> → "Save")
 *   2. JSX attribute string literals on UI-text attributes
 *      (title= placeholder= label= description= tooltip= aria-label=
 *       alt= text= helpText=)
 *   3. Skip strings inside t('...'), formatMessage('...'), translate('...')
 *   4. Skip lowercase-dotted key references, route paths, single chars,
 *      numerics, hex, urls
 *
 * Usage:
 *   pnpm detect:hardcoded-i18n              # CLI table
 *   pnpm detect:hardcoded-i18n -- --json    # JSON to stdout
 *   pnpm detect:hardcoded-i18n -- --report-file .tmp/hardcoded.json
 *   pnpm detect:hardcoded-i18n -- --ci      # exit 1 if any found
 */
import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..');
const SCAN_DIRS = ['app', 'components'];
const SKIP_DIRS = new Set(['node_modules', '.next', '.tmp', 'messages', '__tests__', 'scripts']);
const SKIP_FILES = new Set(['app/i18n.ts']);
const FILE_EXTS = ['.ts', '.tsx'];

const UI_TEXT_ATTRS = new Set([
  'title',
  'placeholder',
  'label',
  'description',
  'tooltip',
  'aria-label',
  'alt',
  'text',
  'helpText',
]);

interface Finding {
  file: string;
  line: number;
  kind: 'jsx-text' | 'jsx-attr';
  attr?: string;
  snippet: string;
}

function shouldSkipFile(rel: string, name: string): boolean {
  if (SKIP_FILES.has(rel)) return true;
  if (name.endsWith('.spec.ts') || name.endsWith('.spec.tsx')) return true;
  if (name.endsWith('.test.ts') || name.endsWith('.test.tsx')) return true;
  return false;
}

function walk(dir: string, out: string[]): void {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (SKIP_DIRS.has(e.name) || e.name.startsWith('.')) continue;
      walk(full, out);
    } else if (e.isFile()) {
      if (!FILE_EXTS.some((ext) => e.name.endsWith(ext))) continue;
      const rel = path.relative(ROOT, full).replace(/\\/g, '/');
      if (shouldSkipFile(rel, e.name)) continue;
      out.push(full);
    }
  }
}

function looksLikeKey(s: string): boolean {
  if (/^[a-z][a-z0-9_-]*(?:\.[a-z0-9_-]+)+$/i.test(s)) return true;
  return false;
}

function looksTechnical(s: string): boolean {
  const t = s.trim();
  if (!t) return true;
  if (t.length < 2) return true;
  if (/^\d+$/.test(t)) return true;
  if (/^[#0-9A-Fa-f]+$/.test(t) && t.startsWith('#')) return true;
  if (/^https?:\/\//.test(t)) return true;
  if (/^\//.test(t) && !/\s/.test(t)) return true;
  if (/^[A-Z_][A-Z0-9_]*$/.test(t)) return true;
  if (!/[A-Za-z]/.test(t)) return true;
  if (looksLikeKey(t)) return true;
  return false;
}

const T_CALL = /\b(?:t|formatMessage|translate)\s*\(\s*['"`]([^'"`]+)['"`]/g;

function tCallSpans(text: string): Array<[number, number]> {
  const spans: Array<[number, number]> = [];
  let m: RegExpExecArray | null;
  while ((m = T_CALL.exec(text)) !== null) {
    spans.push([m.index, m.index + m[0].length]);
  }
  T_CALL.lastIndex = 0;
  return spans;
}

function inSpan(idx: number, spans: Array<[number, number]>): boolean {
  for (const [s, e] of spans) if (idx >= s && idx <= e) return true;
  return false;
}

function lineOf(text: string, idx: number): number {
  return text.substring(0, idx).split('\n').length;
}

const JSX_TEXT = />([^<>{}\n]*?[A-Za-z][^<>{}\n]*?)</g;
const JSX_ATTR = /(\b[a-zA-Z-]+)\s*=\s*['"]([^'"]*[A-Za-z][^'"]*)['"]/g;

function scanFile(filePath: string): Finding[] {
  const text = fs.readFileSync(filePath, 'utf-8');
  const rel = path.relative(ROOT, filePath).replace(/\\/g, '/');
  const findings: Finding[] = [];
  const spans = tCallSpans(text);

  let m: RegExpExecArray | null;

  while ((m = JSX_TEXT.exec(text)) !== null) {
    const snippet = m[1].trim();
    if (looksTechnical(snippet)) continue;
    if (inSpan(m.index, spans)) continue;
    findings.push({
      file: rel,
      line: lineOf(text, m.index),
      kind: 'jsx-text',
      snippet,
    });
  }
  JSX_TEXT.lastIndex = 0;

  while ((m = JSX_ATTR.exec(text)) !== null) {
    const attr = m[1];
    const val = m[2];
    if (!UI_TEXT_ATTRS.has(attr)) continue;
    if (looksTechnical(val)) continue;
    if (inSpan(m.index, spans)) continue;
    findings.push({
      file: rel,
      line: lineOf(text, m.index),
      kind: 'jsx-attr',
      attr,
      snippet: val.trim(),
    });
  }
  JSX_ATTR.lastIndex = 0;

  return findings;
}

function aggregate(findings: Finding[]): {
  total: number;
  byFile: Array<{ file: string; count: number }>;
  byKind: Record<string, number>;
} {
  const fileMap = new Map<string, number>();
  const kindMap: Record<string, number> = {};
  for (const f of findings) {
    fileMap.set(f.file, (fileMap.get(f.file) || 0) + 1);
    kindMap[f.kind] = (kindMap[f.kind] || 0) + 1;
  }
  const byFile = Array.from(fileMap, ([file, count]) => ({ file, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 25);
  return { total: findings.length, byFile, byKind: kindMap };
}

function printTable(findings: Finding[]): void {
  const summary = aggregate(findings);
  console.log(`\n=== detect-hardcoded-i18n ===\n`);
  console.log(`Total findings: ${summary.total}`);
  console.log(`By kind:`, summary.byKind);
  console.log(`\nTop files:`);
  for (const f of summary.byFile) {
    console.log(`  ${String(f.count).padStart(4)}  ${f.file}`);
  }
  console.log(`\n(Run with --json or --report-file <path> for full detail.)`);
}

function main(): void {
  const args = process.argv.slice(2);
  const wantJson = args.includes('--json');
  const ci = args.includes('--ci');
  const reportIdx = args.indexOf('--report-file');
  const reportFile = reportIdx >= 0 ? args[reportIdx + 1] : undefined;

  const files: string[] = [];
  for (const d of SCAN_DIRS) {
    walk(path.join(ROOT, d), files);
  }

  const all: Finding[] = [];
  for (const f of files) {
    all.push(...scanFile(f));
  }

  if (reportFile) {
    const out = JSON.stringify({ generatedAt: new Date().toISOString(), findings: all }, null, 2);
    fs.mkdirSync(path.dirname(reportFile), { recursive: true });
    fs.writeFileSync(reportFile, out);
    console.log(`Wrote ${all.length} findings to ${reportFile}`);
  }

  if (wantJson) {
    console.log(JSON.stringify(all, null, 2));
  } else {
    printTable(all);
  }

  if (ci && all.length > 0) {
    console.error(`\n❌ --ci: ${all.length} hardcoded strings found. Failing.`);
    process.exit(1);
  }
  process.exit(0);
}

main();
