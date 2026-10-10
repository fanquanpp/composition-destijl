#!/usr/bin/env node
/**
 * Downloads every third-party asset the game needs into vendor/ and assets/,
 * then writes assets/CREDITS.md from the same manifest.
 *
 * Usage:  node tools/fetch-assets.mjs [--force]
 *
 * Everything it pulls is either MIT, SIL OFL 1.1, CC0 or public domain, so the
 * resulting project can be redistributed. Files already present are skipped
 * unless --force is passed. The zip cache lives in tools/.cache/.
 */
import { mkdir, writeFile, readFile, rm, stat, copyFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CACHE = join(ROOT, 'tools', '.cache');
const FORCE = process.argv.includes('--force');
const UA = 'composition-destijl/1.0 (asset fetch; node)';

const THREE_VERSION = '0.186.1';
const JSDE = (p) => `https://cdn.jsdelivr.net/npm/three@${THREE_VERSION}/${p}`;
const GF = (p) => `https://cdn.jsdelivr.net/gh/google/fonts@main/${p}`;
const WM = (p) => `https://upload.wikimedia.org/wikipedia/commons/${p}`;

/** @type {{url:string,dest:string,kind:string,min:number,credit:string,license:string}[]} */
const FILES = [
  // ---- three.js core (MIT) -------------------------------------------------
  { url: JSDE('build/three.module.js'), dest: 'vendor/three/three.module.js', kind: 'js', min: 200000,
    credit: 'three.js ' + THREE_VERSION + ' — https://threejs.org', license: 'MIT' },
  { url: JSDE('build/three.core.js'), dest: 'vendor/three/three.core.js', kind: 'js', min: 200000,
    credit: 'three.js ' + THREE_VERSION + ' — https://threejs.org', license: 'MIT' },
  { url: JSDE('LICENSE'), dest: 'vendor/three/LICENSE', kind: 'text', min: 500,
    credit: 'three.js license', license: 'MIT' },

  // ---- typefaces (SIL OFL 1.1) --------------------------------------------
  { url: GF('ofl/archivoblack/ArchivoBlack-Regular.ttf'), dest: 'assets/fonts/ArchivoBlack-Regular.ttf', kind: 'binary', min: 50000,
    credit: 'Archivo Black by Omnibus-Type', license: 'SIL OFL 1.1' },
  { url: GF('ofl/jost/Jost%5Bwght%5D.ttf'), dest: 'assets/fonts/Jost-Variable.ttf', kind: 'binary', min: 80000,
    credit: 'Jost* by indestructible type*', license: 'SIL OFL 1.1' },
  { url: GF('ofl/spacemono/SpaceMono-Regular.ttf'), dest: 'assets/fonts/SpaceMono-Regular.ttf', kind: 'binary', min: 50000,
    credit: 'Space Mono by Colophon Foundry', license: 'SIL OFL 1.1' },
  { url: GF('ofl/spacemono/SpaceMono-Bold.ttf'), dest: 'assets/fonts/SpaceMono-Bold.ttf', kind: 'binary', min: 50000,
    credit: 'Space Mono by Colophon Foundry', license: 'SIL OFL 1.1' },
  {
    // CJK. The Latin faces have no Chinese glyphs at all, so this is not
    // optional once the UI can be Chinese.
    //
    // It downloads to the CACHE, not to assets/: the full face is 16.9 MB, which
    // is unusably slow over a network and simply never arrives on a flaky link.
    // The step below subsets it down to the characters the UI uses (~173 KB) and
    // only that ships. tools/check-font.mjs fails the build if the subset ever
    // stops covering the text.
    url: GF('ofl/notosanssc/NotoSansSC%5Bwght%5D.ttf'),
    dest: 'tools/.cache/notosanssc-variable.ttf', kind: 'binary', min: 1000000,
    credit: 'Noto Sans SC by Google / Adobe (subset to the UI character set)', license: 'SIL OFL 1.1',
  },
  { url: GF('ofl/notosanssc/OFL.txt'), dest: 'assets/fonts/OFL-NotoSansSC.txt', kind: 'text', min: 3000,
    credit: 'Noto Sans SC license', license: 'SIL OFL 1.1' },

  { url: GF('ofl/archivoblack/OFL.txt'), dest: 'assets/fonts/OFL-ArchivoBlack.txt', kind: 'text', min: 3000,
    credit: 'Archivo Black license', license: 'SIL OFL 1.1' },
  { url: GF('ofl/jost/OFL.txt'), dest: 'assets/fonts/OFL-Jost.txt', kind: 'text', min: 3000,
    credit: 'Jost* license', license: 'SIL OFL 1.1' },
  { url: GF('ofl/spacemono/OFL.txt'), dest: 'assets/fonts/OFL-SpaceMono.txt', kind: 'text', min: 3000,
    credit: 'Space Mono license', license: 'SIL OFL 1.1' },

  // ---- paintings: Piet Mondrian, public domain ----------------------------
  // Wikimedia only pre-renders certain thumbnail widths; 1280px is safe for both
  // of these, and `alt` is the full-resolution original if the thumb ever 400s.
  { url: WM('thumb/6/66/Composition_No_IV%2C_by_Piet_Mondriaan.jpg/1280px-Composition_No_IV%2C_by_Piet_Mondriaan.jpg'),
    alt: WM('6/66/Composition_No_IV%2C_by_Piet_Mondriaan.jpg'),
    dest: 'assets/textures/mondrian-composition-no-iv.jpg', kind: 'binary', min: 20000,
    credit: 'Piet Mondrian, "Composition No. IV" (Compositie 6, 1914). Wikimedia Commons: File:Composition No IV, by Piet Mondriaan.jpg',
    license: 'Public domain (PD-Art)' },
  { url: WM('a/ab/Composition-with-red-yellow-and-blue.jpg'),
    dest: 'assets/textures/mondrian-composition-yellow-blue-red.jpg', kind: 'binary', min: 20000,
    credit: 'Piet Mondrian, "Composition with Yellow, Blue and Red" (1942, Tate T00648). Wikimedia Commons: File:Composition-with-red-yellow-and-blue.jpg',
    license: 'Public domain (PD-Art)' },
  { url: WM('c/c7/Mondrian%2C_Compositie_met_rood%2C_geel_en_blauw_1937-42.jpg'),
    dest: 'assets/textures/mondrian-compositie-rood-geel-blauw.jpg', kind: 'binary', min: 15000,
    credit: 'Piet Mondrian, "Compositie met rood, geel en blauw" (1937–42). Wikimedia Commons: File:Mondrian, Compositie met rood, geel en blauw 1937-42.jpg',
    license: 'Public domain (PD-Art)' },
  { url: WM('c/cd/Mondrian_-_Composition%2C_1929%2C_53.1347.jpg'),
    dest: 'assets/textures/mondrian-composition-1929.jpg', kind: 'binary', min: 20000,
    credit: 'Piet Mondrian, "Composition" (1929). Wikimedia Commons: File:Mondrian - Composition, 1929, 53.1347.jpg',
    license: 'Public domain (PD-Art)' },
  { url: WM('thumb/b/bd/Mondrian_-_Composition_%28no._III%29_blanc-jaune_Composition_with_Red%2C_Yellow%2C_and_Blue%2C_1935-1942.jpg/1280px-Mondrian_-_Composition_%28no._III%29_blanc-jaune_Composition_with_Red%2C_Yellow%2C_and_Blue%2C_1935-1942.jpg'),
    alt: WM('b/bd/Mondrian_-_Composition_%28no._III%29_blanc-jaune_Composition_with_Red%2C_Yellow%2C_and_Blue%2C_1935-1942.jpg'),
    dest: 'assets/textures/mondrian-composition-no-iii.jpg', kind: 'binary', min: 20000,
    credit: 'Piet Mondrian, "Composition (No. III) blanc-jaune" (1935–42). Wikimedia Commons: File:Mondrian - Composition (no. III) blanc-jaune …',
    license: 'Public domain (PD-Art)' },
];

// ---- sound effects: CC0 packs from OpenGameArt -----------------------------
const OGA = 'https://opengameart.org/sites/default/files/';
/**
 * Each entry is one archive plus the handful of files we actually want out of
 * it, mapped to the name the game asks for. Add a pack by adding an entry here;
 * everything else (fetch, unzip, credit, verify) follows automatically.
 */
const SFX_PACKS = [
  {
    url: OGA + '8-bit%20Sound%20Effects%20Pack%20001.zip',
    cache: 'sfx-pack-001.zip',
    credit: 'Deva, "8-bit Sound Effect Pack (Vol. 001)" — https://opengameart.org/content/8-bit-sound-effect-pack-vol-001',
    license: 'CC0 1.0',
    map: {
      'Jump 1.wav': 'jump.wav',
      'Fly 1.wav': 'double-jump.wav',
      'Noise Select 1.wav': 'dash.wav',
      'Coin 1.wav': 'coin.wav',
      'Hit 2.wav': 'stomp.wav',
      'Explosion 1.wav': 'enemy-pop.wav',
      'Powerup 1.wav': 'checkpoint.wav',
      'Wrong 1.wav': 'hurt.wav',
      'Wrong 3.wav': 'death.wav',
      'Exit 1.wav': 'level-clear.wav',
      'Exit 3.wav': 'victory.wav',
      'Select 1.wav': 'ui-select.wav',
      'Noise Select 2.wav': 'ui-move.wav',
    },
  },
  {
    // whooshes for the grapple
    url: OGA + 'swishes.zip',
    cache: 'swishes.zip',
    credit: 'artisticdude, "Swishes Sound Pack" — https://opengameart.org/content/swishes-sound-pack',
    license: 'CC0 1.0',
    map: {
      'swishes/swish-2.wav': 'grapple-fire.wav',
      'swishes/swish-7.wav': 'grapple-release.wav',
    },
  },
  {
    // impacts: the hook biting, a crumbling slab, a heavy landing
    url: OGA + 'sfx_breaking_and_falling.zip',
    cache: 'sfx-breaking-falling.zip',
    credit: 'rubberduck, "75 CC0 breaking / falling / hit SFX" — https://opengameart.org/content/75-cc0-breaking-falling-hit-sfx',
    license: 'CC0 1.0',
    map: {
      'bfh1_metal_hit_02.ogg': 'grapple-hit.ogg',
      'bfh1_rock_breaking_01.ogg': 'crumble.ogg',
      'bfh1_rock_falling_04.ogg': 'land-heavy.ogg',
    },
  },
];

/** Some submissions are a bare file rather than an archive. */
const SFX_SINGLES = [
  {
    url: OGA + 'jumpland.wav',
    cache: 'jumpland.wav',
    dest: 'land.wav',
    credit: 'qhobbes, "Jump Landing Sound" — https://opengameart.org/content/jump-landing-sound',
    license: 'CC0 1.0',
  },
  {
    // the metronome the rhythm platforms step to
    url: OGA + 'tick.ogg',
    cache: 'tick.ogg',
    dest: 'rhythm-tick.ogg',
    credit: 'cemkalyoncu, "Tick and Tock" — https://opengameart.org/content/tick-and-tock',
    license: 'CC0 1.0',
  },
  {
    url: OGA + 'Timetick.ogg',
    cache: 'timetick.ogg',
    dest: 'rhythm-warn.ogg',
    credit: 'IgnasD, "Clock Tick" — https://opengameart.org/content/clock-tick-0',
    license: 'CC0 1.0',
  },
  {
    // one clean pitched strike, re-pitched at runtime to play a scale
    url: OGA + 'pleasing-bell.ogg',
    cache: 'pleasing-bell.ogg',
    dest: 'tone-bell.ogg',
    credit: 'BjarneK_92, "Pleasing Bell Sound Effect" — https://opengameart.org/content/pleasing-bell-sound-effect',
    license: 'CC0 1.0',
  },
];

const bytes = (n) => (n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1048576).toFixed(2)} MB`);

async function exists(p) {
  try { await stat(p); return true; } catch { return false; }
}

async function download(url, tries = 4) {
  let lastErr;
  for (let i = 1; i <= tries; i++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: '*/*' }, redirect: 'follow' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length === 0) throw new Error('empty response');
      return buf;
    } catch (err) {
      lastErr = err;
      process.stdout.write(`  retry ${i}/${tries} (${err.message}) … `);
      await new Promise((r) => setTimeout(r, 700 * i));
    }
  }
  throw new Error(`failed to fetch ${url}: ${lastErr?.message}`);
}

/** Minimal ZIP reader — central directory + inflateRaw. Enough for asset packs. */
function unzip(buf) {
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0 && i > Math.max(0, buf.length - 66000); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('zip: end-of-central-directory not found (truncated download?)');
  const count = buf.readUInt16LE(eocd + 10);
  let off = buf.readUInt32LE(eocd + 16);
  const entries = new Map();
  for (let i = 0; i < count; i++) {
    if (buf.readUInt32LE(off) !== 0x02014b50) break;
    const method = buf.readUInt16LE(off + 10);
    const compSize = buf.readUInt32LE(off + 20);
    const nameLen = buf.readUInt16LE(off + 28);
    const extraLen = buf.readUInt16LE(off + 30);
    const commentLen = buf.readUInt16LE(off + 32);
    const localOff = buf.readUInt32LE(off + 42);
    const name = buf.toString('utf8', off + 46, off + 46 + nameLen);
    const lNameLen = buf.readUInt16LE(localOff + 26);
    const lExtraLen = buf.readUInt16LE(localOff + 28);
    const dataStart = localOff + 30 + lNameLen + lExtraLen;
    const raw = buf.subarray(dataStart, dataStart + compSize);
    entries.set(name, method === 0 ? Buffer.from(raw) : zlib.inflateRawSync(raw));
    off += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

async function fetchCached(url, cacheName) {
  const cachePath = join(CACHE, cacheName);
  if (!FORCE && (await exists(cachePath))) {
    return { buf: await readFile(cachePath), fromCache: true };
  }
  const buf = await download(url);
  await writeFile(cachePath, buf);
  return { buf, fromCache: false };
}

async function main() {
  await mkdir(CACHE, { recursive: true });
  const credits = [];
  let downloaded = 0, skipped = 0, failed = 0;

  console.log(`\n  composition-destijl · asset fetch\n  root: ${ROOT}\n`);

  for (const f of FILES) {
    const dest = join(ROOT, f.dest);
    if (!FORCE && (await exists(dest)) && (await stat(dest)).size >= f.min) {
      console.log(`  =  ${f.dest}  (present)`);
      skipped++;
      credits.push(f);
      continue;
    }
    await mkdir(dirname(dest), { recursive: true });
    process.stdout.write(`  ↓  ${f.dest} … `);
    try {
      let buf;
      try {
        buf = await download(f.url, f.alt ? 2 : 4);
      } catch (err) {
        if (!f.alt) throw err;
        process.stdout.write(`(thumb failed, trying original) … `);
        buf = await download(f.alt, 3);
      }
      if (buf.length < f.min) throw new Error(`suspiciously small (${bytes(buf.length)} < ${bytes(f.min)})`);
      if (f.kind === 'binary' && f.dest.endsWith('.ttf') && buf.readUInt32BE(0) !== 0x00010000 && buf.readUInt32BE(0) !== 0x74727565) {
        throw new Error('not a TrueType file');
      }
      if (f.kind === 'binary' && f.dest.endsWith('.jpg') && buf.readUInt16BE(0) !== 0xffd8) {
        throw new Error('not a JPEG');
      }
      await writeFile(dest, buf);
      console.log(bytes(buf.length));
      downloaded++;
      credits.push(f);
    } catch (err) {
      console.log(`FAILED — ${err.message}`);
      failed++;
    }
  }

  // ---- CJK subset ----------------------------------------------------------
  // Subsetting needs fontTools, which is a Python package. If it is missing we
  // ship the full face instead of failing: a large font is worse than a small
  // one, but a missing font is worse than both.
  const fullFont = join(ROOT, 'tools/.cache/notosanssc-variable.ttf');
  if (await exists(fullFont)) {
    const res = spawnSync('python', [join('tools', 'subset-font.py')], { cwd: ROOT, encoding: 'utf8' });
    if (res.status === 0) {
      process.stdout.write(res.stdout.replace(/^/gm, '  '));
    } else {
      console.log('  ! CJK subsetting unavailable — falling back to the full 16.9 MB face');
      const reason = (res.stderr || '').trim().split(String.fromCharCode(10)).filter(Boolean).pop();
      if (reason) console.log('    ' + reason);
      console.log('    (install fonttools + brotli, then re-run, to get the ~173 KB subset)');
      await copyFile(fullFont, join(ROOT, 'assets/fonts/NotoSansSC-Variable.ttf'));
    }
  }

  // ---- painting optimisation ------------------------------------------------
  // The Mondrian JPEGs come off Wikimedia at whatever resolution the source has,
  // far more than the backdrop ever samples, and gzip cannot shrink a JPEG. This
  // re-encodes them down to a sane size (see tools/optimize-textures.py). Needs
  // Pillow; if it is missing the full-size files simply ship, as with the font.
  const texRes = spawnSync('python', [join('tools', 'optimize-textures.py')], { cwd: ROOT, encoding: 'utf8' });
  if (texRes.status === 0 && texRes.stdout) {
    process.stdout.write(texRes.stdout.replace(/^/gm, '  '));
  } else {
    console.log('  ! painting optimisation skipped — shipping the full-size JPEGs');
    const reason = (texRes.stderr || '').trim().split(String.fromCharCode(10)).filter(Boolean).pop();
    if (reason) console.log('    ' + reason);
  }

  // ---- sound effects -------------------------------------------------------
  const audioCredits = [];
  await mkdir(join(ROOT, 'assets/audio'), { recursive: true });

  for (const pack of SFX_PACKS) {
    try {
      const { buf } = await fetchCached(pack.url, pack.cache);
      const entries = unzip(buf);
      for (const [entry, outName] of Object.entries(pack.map)) {
        const data = entries.get(entry);
        if (!data) {
          console.log(`  !  ${pack.cache}: no entry named "${entry}"`);
          failed++;
          continue;
        }
        await writeFile(join(ROOT, 'assets/audio', outName), data);
        console.log(`  ↓  assets/audio/${outName}  (${bytes(data.length)})`);
        downloaded++;
      }
      audioCredits.push(pack);
    } catch (err) {
      console.log(`  !  ${pack.cache} failed: ${err.message}`);
      failed++;
    }
  }

  for (const single of SFX_SINGLES) {
    try {
      const { buf } = await fetchCached(single.url, single.cache);
      await writeFile(join(ROOT, 'assets/audio', single.dest), buf);
      console.log(`  ↓  assets/audio/${single.dest}  (${bytes(buf.length)})`);
      downloaded++;
      audioCredits.push(single);
    } catch (err) {
      console.log(`  !  ${single.dest} failed: ${err.message}`);
      failed++;
    }
  }

  // ---- credits -------------------------------------------------------------
  const byLicense = new Map();
  for (const c of credits) {
    if (!byLicense.has(c.license)) byLicense.set(c.license, new Set());
    byLicense.get(c.license).add(c.credit);
  }
  const lines = [
    '# Third-party assets',
    '',
    'Generated by `tools/fetch-assets.mjs` — every file below was downloaded from its',
    'original public source. Re-run `node tools/fetch-assets.mjs --force` to refresh.',
    '',
    `Fetched: ${downloaded} · already present: ${skipped} · failed: ${failed}`,
    '',
  ];
  for (const [license, items] of byLicense) {
    lines.push(`## ${license}`, '');
    for (const it of items) lines.push(`- ${it}`);
    lines.push('');
  }
  lines.push('## CC0 1.0', '');
  for (const a of audioCredits) lines.push(`- ${a.credit}`);
  lines.push(
    '',
    '## What is *not* third-party',
    '',
    'All level geometry, the player, enemies, collectibles, hazards, particles,',
    'background compositions, the UI and the procedural audio fallback are generated',
    'at runtime by this project\'s own code. Only the files listed above are external.',
    '',
  );
  await writeFile(join(ROOT, 'assets/CREDITS.md'), lines.join('\n'));
  console.log(`\n  wrote assets/CREDITS.md\n  done — ${downloaded} downloaded, ${skipped} present, ${failed} failed\n`);
  if (failed) process.exitCode = 1;
}

main().catch((err) => { console.error(err); process.exit(1); });
