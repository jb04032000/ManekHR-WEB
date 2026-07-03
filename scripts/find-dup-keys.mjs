#!/usr/bin/env node
/**
 * Walks i18n JSON files raw and reports duplicate keys at the same object
 * depth - JSON.parse silently drops earlier dups, so legit-looking files
 * can hide invisible collisions. (e.g. attendance.daily string at L1240
 * vs attendance.daily object at L1380.)
 *
 * Usage:
 *   node scripts/find-dup-keys.mjs                     # all locales
 *   node scripts/find-dup-keys.mjs en.json gu.json     # specific files
 */
import fs from 'fs';
import path from 'path';

const MESSAGES_DIR = path.resolve('app/messages');
const targets =
  process.argv.length > 2
    ? process.argv.slice(2)
    : fs.readdirSync(MESSAGES_DIR).filter((f) => f.endsWith('.json'));

let totalDups = 0;

for (const fname of targets) {
  const file = path.join(MESSAGES_DIR, fname);
  const text = fs.readFileSync(file, 'utf8');
  const dups = scan(text);
  if (dups.length === 0) {
    console.log(`✓ ${fname}: no duplicate keys`);
    continue;
  }
  console.log(`✗ ${fname}: ${dups.length} dup key(s)`);
  for (const d of dups) {
    console.log(`    ${d.path}  (first @ line ${d.firstLine}, dup @ line ${d.line})`);
    totalDups++;
  }
}

console.log(`\nTotal: ${totalDups} duplicate key(s) across ${targets.length} file(s)`);
process.exit(totalDups > 0 ? 1 : 0);

// ─────────────────────────────────────────────────────────────────────────────

/**
 * Stack-based JSON scanner that tracks current key path and records when a
 * key reappears at the same depth before the parent closes.
 */
function scan(text) {
  const dups = [];
  const stack = []; // each frame: { type: 'object'|'array', seen: Map<key, line>, key: string|number }
  let line = 1;
  let i = 0;
  const len = text.length;

  while (i < len) {
    const ch = text[i];
    if (ch === '\n') line++;

    if (ch === '"') {
      // read string token (handles escapes)
      let j = i + 1;
      while (j < len) {
        if (text[j] === '\\') {
          j += 2;
          continue;
        }
        if (text[j] === '"') break;
        if (text[j] === '\n') line++;
        j++;
      }
      const str = text.slice(i + 1, j);
      i = j + 1;
      // is this token a KEY (object context + waiting for key)?
      const top = stack[stack.length - 1];
      if (top && top.type === 'object' && top.awaitingKey) {
        if (top.seen.has(str)) {
          dups.push({
            path: pathOf(stack, str),
            firstLine: top.seen.get(str),
            line,
          });
        } else {
          top.seen.set(str, line);
        }
        top.lastKey = str;
        top.awaitingKey = false; // will await ":" then value
      }
      continue;
    }

    if (ch === '{') {
      stack.push({ type: 'object', seen: new Map(), awaitingKey: true, lastKey: null });
    } else if (ch === '}') {
      stack.pop();
      pendingAfterValue(stack);
    } else if (ch === '[') {
      stack.push({ type: 'array' });
    } else if (ch === ']') {
      stack.pop();
      pendingAfterValue(stack);
    } else if (ch === ':') {
      // value follows
    } else if (ch === ',') {
      const top = stack[stack.length - 1];
      if (top && top.type === 'object') top.awaitingKey = true;
    }
    i++;
  }
  return dups;
}

function pendingAfterValue() {
  // no-op - handled implicitly by awaitingKey reset on ','
}

function pathOf(stack, leaf) {
  const parts = stack.filter((f) => f.type === 'object' && f.lastKey).map((f) => f.lastKey);
  // last frame's lastKey is the parent of the dup key; we want path-of-parent then the leaf
  // but the leaf itself is the dup - easier: build from all but last frame's lastKey + leaf
  const parent = parts.slice(0, -1).join('.');
  return parent ? `${parent}.${leaf}` : leaf;
}
