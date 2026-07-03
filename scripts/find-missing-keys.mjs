#!/usr/bin/env node
/**
 * Audits `t('key')` call sites against en.json and reports keys that
 * resolve to non-leaf (object) values or missing values - both render as
 * the literal key path at runtime (e.g. "attendance.daily" appearing on screen).
 *
 * Scope: any directory passed via argv. Defaults to app/ + components/.
 *
 * Detects two failure modes:
 *   1. Path missing entirely (typo / forgot to add key).
 *   2. Path resolves to an object instead of a string (namespace collision
 *      or someone tried to render a sub-tree).
 *
 * Skips dynamic keys (template literals, variables).
 */
import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const SCAN_DIRS = process.argv.length > 2 ? process.argv.slice(2) : ['app', 'components', 'lib'];
const MESSAGES = path.join(ROOT, 'app/messages/en.json');

const messages = JSON.parse(fs.readFileSync(MESSAGES, 'utf8'));

// ── Walk files ────────────────────────────────────────────────────────────────

const findings = [];
for (const dir of SCAN_DIRS) {
  walk(path.join(ROOT, dir));
}

if (findings.length === 0) {
  console.log('✓ No missing / non-leaf t() keys found.');
  process.exit(0);
}

// Group by file
const byFile = new Map();
for (const f of findings) {
  if (!byFile.has(f.file)) byFile.set(f.file, []);
  byFile.get(f.file).push(f);
}

let n = 0;
for (const [file, list] of byFile) {
  console.log(`\n${path.relative(ROOT, file)}`);
  for (const f of list) {
    console.log(`  L${f.line}  ${f.kind.padEnd(13)} ${f.key}`);
    n++;
  }
}
console.log(`\nTotal: ${n} issue(s) across ${byFile.size} file(s)`);
process.exit(1);

// ─────────────────────────────────────────────────────────────────────────────

function walk(dir) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name === '.next' || e.name === '__tests__') continue;
      walk(p);
      continue;
    }
    if (!/\.(tsx?|jsx?)$/.test(e.name)) continue;
    audit(p);
  }
}

function audit(file) {
  const text = fs.readFileSync(file, 'utf8');
  // Find useTranslations('NS') hooks + their variable name (default `t`).
  // Pattern: const NAME = useTranslations('NS')
  const hookRe = /const\s+(\w+)\s*=\s*useTranslations\(\s*['"]([^'"]+)['"]\s*\)/g;
  /** name → namespace */
  const nsMap = new Map();
  let m;
  while ((m = hookRe.exec(text))) {
    nsMap.set(m[1], m[2]);
  }
  if (nsMap.size === 0) return;

  // Find every t-fn call site for known hook vars.
  // Pattern: NAME(['"]KEY['"]) - only string-literal first arg.
  for (const [tName, ns] of nsMap) {
    const callRe = new RegExp(`\\b${tName}\\(\\s*['"]([^'"\`]+)['"]`, 'g');
    let c;
    while ((c = callRe.exec(text))) {
      const sub = c[1];
      // Skip if key contains template-literal markers (already filtered) or interpolation
      const full = `${ns}.${sub}`;
      const resolved = resolve(messages, full.split('.'));
      const line = text.slice(0, c.index).split('\n').length;
      if (resolved === undefined) {
        findings.push({ file, line, kind: 'MISSING', key: full });
      } else if (typeof resolved === 'object') {
        findings.push({ file, line, kind: 'NON-LEAF', key: full });
      }
    }
  }
}

function resolve(node, parts) {
  let cur = node;
  for (const p of parts) {
    if (cur === null || typeof cur !== 'object') return undefined;
    cur = cur[p];
  }
  return cur;
}
