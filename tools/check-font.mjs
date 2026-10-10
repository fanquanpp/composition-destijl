#!/usr/bin/env node
/**
 * Font coverage lint.
 *
 * The UI ships a SUBSET of Noto Sans SC (173 KB) rather than the full 16.9 MB
 * face, because the full one is unusably slow to fetch and on an unreliable
 * link never arrives at all. A subset has exactly one failure mode, and it is a
 * silent one: a character someone adds later is not in the font, so the browser
 * quietly substitutes a system face and one sentence ends up in two typefaces.
 *
 * This re-derives the character set from the UI sources and fails if the shipped
 * font can no longer cover it. So adding Chinese text means re-running
 * `npm run assets`, and forgetting is caught here instead of shipped.
 *
 *   node tools/check-font.mjs
 */
import { readFile, access } from 'node:fs/promises';
import { glob } from 'node:fs/promises';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** The files whose text the font has to render. Must match tools/subset-font.py. */
const UI_GLOBS = ['src/**/*.js', 'index.html', 'styles.css'];

const MANIFEST = join(ROOT, 'assets/fonts/glyph-coverage.json');
const SUBSET = join(ROOT, 'assets/fonts/NotoSansSC-Subset.woff2');
const FALLBACK = join(ROOT, 'assets/fonts/NotoSansSC-Variable.ttf');

async function collectUiCharacters() {
  const chars = new Set();
  const files = [];
  for (const pattern of UI_GLOBS) {
    for await (const entry of glob(pattern, { cwd: ROOT })) files.push(entry);
  }
  for (const rel of files.sort()) {
    const text = await readFile(join(ROOT, rel), 'utf8');
    for (const ch of text) chars.add(ch);
  }
  return { chars: [...chars].filter((c) => c.codePointAt(0) >= 0x20), files };
}

const exists = async (p) => { try { await access(p); return true; } catch { return false; } };

async function main() {
  const problems = [];

  const hasSubset = await exists(SUBSET);
  const hasFallback = await exists(FALLBACK);
  if (!hasSubset && !hasFallback) {
    console.log('  ✗ no CJK font found (neither the subset nor the full face)');
    console.log('    run: npm run assets');
    process.exit(1);
  }

  if (!hasSubset) {
    // The full face is a legitimate fallback (it is what the pipeline produces
    // when fontTools is unavailable), but it is 16.9 MB and will be slow.
    console.log('  ! shipping the FULL 16.9 MB face — fontTools was unavailable when');
    console.log('    assets were built. Chinese will render, but the download is ~99x');
    console.log('    larger than it needs to be. Install fonttools + brotli and re-run');
    console.log('    `npm run assets` to get the 173 KB subset.');
    process.exit(0);
  }

  if (!(await exists(MANIFEST))) {
    console.log('  ✗ the subset is present but glyph-coverage.json is missing, so its');
    console.log('    coverage cannot be verified. Re-run: npm run assets');
    process.exit(1);
  }

  const manifest = JSON.parse(await readFile(MANIFEST, 'utf8'));
  const covered = new Set(manifest.characters);
  const { chars, files } = await collectUiCharacters();

  const missing = chars.filter((c) => !covered.has(c));

  const describe = (c) => {
    const cp = c.codePointAt(0).toString(16).toUpperCase().padStart(4, '0');
    return `'${c}' (U+${cp})`;
  };

  if (missing.length) {
    console.log(`  ✗ ${missing.length} character(s) used by the UI are not in the CJK subset:`);
    console.log('      ' + missing.slice(0, 24).map(describe).join('  '));
    if (missing.length > 24) console.log(`      … and ${missing.length - 24} more`);
    console.log('    The browser would silently substitute a system font for these,');
    console.log('    putting two typefaces in one sentence. Rebuild the subset:');
    console.log('      npm run assets');
    problems.push('font coverage');
  }

  if (problems.length) process.exit(1);

  const kb = (await readFile(SUBSET)).length / 1024;
  console.log(`  ✓ CJK subset covers all ${chars.length} characters used across `
    + `${files.length} UI files (${kb.toFixed(0)} KB, ${manifest.count} glyphs)`);
}

main().catch((err) => { console.error(err); process.exit(1); });
