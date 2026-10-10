#!/usr/bin/env python3
"""
Subset the CJK font down to the characters this game actually uses.

WHY: the full Noto Sans SC is ~17.7 MB. That is fine on disk and fatal on a
network — a 17 MB font is slow to fetch and, on an unreliable link, simply never
arrives, at which point every Chinese glyph silently falls back to a system
font. The game uses ~740 CJK characters, so a subset is ~99% smaller.

WHY NOT A HAND-PICKED SUBSET: a subset only breaks in one way — a character
someone added later is missing, and it fails *silently*, producing two typefaces
in one sentence. So the character set is derived from the source tree, and
`tools/check-font.mjs` re-derives it and fails the build if the shipped font can
no longer cover the text. Adding Chinese text therefore means re-running
`npm run assets`, and forgetting is caught rather than shipped.

Run directly:  python tools/subset-font.py [--full path/to/full.ttf]
"""
import io
import json
import os
import re
import sys
import glob

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FULL_CANDIDATES = [
    os.path.join(ROOT, 'tools', '.cache', 'notosanssc-variable.ttf'),
    os.path.join(ROOT, 'assets', 'fonts', 'NotoSansSC-Variable.ttf'),
]
OUT_WOFF2 = os.path.join(ROOT, 'assets', 'fonts', 'NotoSansSC-Subset.woff2')
OUT_TTF = os.path.join(ROOT, 'assets', 'fonts', 'NotoSansSC-Subset.ttf')
MANIFEST = os.path.join(ROOT, 'assets', 'fonts', 'glyph-coverage.json')

# Files whose text the font must be able to render — the UI only.
# The markdown docs are deliberately excluded: they are read on GitHub with
# GitHub's own fonts, they never reach this font, and they contain emoji that
# Noto Sans SC does not have (emoji need a colour emoji font), which would make
# the coverage check report misses that cannot ever matter.
SOURCE_GLOBS = [
    'src/**/*.js',
    'index.html',
    'styles.css',
]

# Ranges included wholesale, so the subset has a principled margin rather than a
# guessed list of "common" characters:
#   0020-007E  printable ASCII (the whole Latin UI)
#   00B7       middle dot, used in the UI
#   2010-2027  dashes, quotes, ellipsis
#   2030-205E  more punctuation
#   3000-303F  CJK symbols and punctuation (、。《》「」etc.)
#   FF00-FFEF  fullwidth forms
MARGIN_RANGES = [(0x20, 0x7E), (0xB7, 0xB7), (0x2010, 0x2027), (0x2030, 0x205E),
                 (0x3000, 0x303F), (0xFF00, 0xFFEF)]


def collect_characters():
    """Every character the source tree can put on screen."""
    chars = set()
    files = []
    for pattern in SOURCE_GLOBS:
        files.extend(glob.glob(os.path.join(ROOT, pattern), recursive=True))
    for path in sorted(set(files)):
        try:
            chars |= set(io.open(path, encoding='utf-8').read())
        except Exception as err:
            print('  ! could not read %s (%s)' % (path, err))
    for lo, hi in MARGIN_RANGES:
        chars |= {chr(c) for c in range(lo, hi + 1)}
    # control characters are not glyphs
    return {c for c in chars if ord(c) >= 0x20}, sorted(set(files))


def find_full_font():
    for p in FULL_CANDIDATES:
        if os.path.isfile(p) and os.path.getsize(p) > 1_000_000:
            return p
    return None


def main():
    try:
        from fontTools import subset
        from fontTools.ttLib import TTFont
    except ImportError:
        print('  ! fontTools not installed — skipping subset '
              '(pip install fonttools brotli)')
        return 2

    src = find_full_font()
    if not src:
        print('  ! full Noto Sans SC not found in tools/.cache or assets/fonts')
        return 2

    chars, files = collect_characters()
    text = ''.join(sorted(chars))
    cjk = [c for c in chars if '\u4e00' <= c <= '\u9fff']
    print('  scanned %d text files -> %d unique characters (%d CJK)'
          % (len(files), len(chars), len(cjk)))

    options = subset.Options()
    options.layout_features = ['*']   # keep every OpenType feature
    options.name_IDs = ['*']          # keep the family/style names intact
    options.notdef_outline = True
    options.recalc_bounds = True
    options.drop_tables = []
    options.hinting = True

    font = subset.load_font(src, options)
    subsetter = subset.Subsetter(options=options)
    subsetter.populate(text=text)
    subsetter.subset(font)

    # keep the variable weight axis so headings can still be heavy
    has_axis = 'fvar' in font

    wrote = []
    try:
        font.flavor = 'woff2'
        font.save(OUT_WOFF2)
        wrote.append(OUT_WOFF2)
    except Exception as err:
        print('  ! woff2 output failed (%s) — falling back to TTF' % err)
        font.flavor = None
        font.save(OUT_TTF)
        wrote.append(OUT_TTF)

    # Record what the subset can ACTUALLY render, read back from its own cmap.
    # The requested set includes margin ranges, and the source font does not
    # cover every codepoint in them — recording the request would make the
    # coverage lint report phantom misses.
    covered = set()
    try:
        reloaded = TTFont(wrote[0])
        covered = {chr(cp) for cp in reloaded.getBestCmap()}
    except Exception as err:
        print('  ! could not re-read the subset (%s)' % err)

    dropped = sorted(set(chars) - covered)
    if dropped:
        print('  note: %d requested codepoints are absent from the source font '
              'itself (e.g. %s)' % (len(dropped), ' '.join(dropped[:8])))

    json.dump({
        'generated_by': 'tools/subset-font.py',
        'source_font': os.path.basename(src),
        'variable_axis_kept': has_axis,
        'count': len(covered),
        'characters': ''.join(sorted(covered)),
    }, io.open(MANIFEST, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)

    full_mb = os.path.getsize(src) / 1048576
    for w in wrote:
        print('  -> %s  (%.1f MB full -> %.0f KB subset, %.1f%% smaller)'
              % (os.path.relpath(w, ROOT), full_mb,
                 os.path.getsize(w) / 1024,
                 100 * (1 - os.path.getsize(w) / os.path.getsize(src))))
    print('  -> %s' % os.path.relpath(MANIFEST, ROOT))
    return 0


if __name__ == '__main__':
    sys.exit(main())
