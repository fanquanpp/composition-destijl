#!/usr/bin/env python3
"""
Painting optimiser.

The five Mondrian canvases arrive from Wikimedia at whatever resolution the
source file happens to have. That is 1.4 MB, and it is the one asset class gzip
cannot help with: JPEG is already compressed, so every byte is paid in full on
every visit. The game hangs each painting at most 8 world units tall inside a
16.5-unit view, so most of those pixels are never sampled.

This re-encodes each painting so its longest edge is at most MAX_EDGE pixels, at
QUALITY. It is idempotent: an image already inside the bound is left byte-for-byte
alone, so re-running costs nothing and never re-compresses an already-lossy file.

    python tools/optimize-textures.py

Runs as the last step of `npm run assets` (see tools/fetch-assets.mjs). Needs
Pillow; if it is missing the step is skipped and the full-size JPEGs ship, which
is slower but never broken — the same trade the CJK subset step makes.
"""
import sys
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    print("  ! Pillow not installed — shipping the full-size paintings")
    print("    (pip install pillow, then re-run, to shrink them)")
    sys.exit(0)

ROOT = Path(__file__).resolve().parent.parent
TEXTURES = ROOT / "assets" / "textures"

# Comfortably above the largest on-screen size at 4K (8/16.5 * 2160 ≈ 1050 px),
# so the downscale is invisible but the payload drops by about a third.
MAX_EDGE = 1024
QUALITY = 82


def optimize(path):
    """Returns (before, after, (w, h)) or None if the image was already small."""
    before = path.stat().st_size
    with Image.open(path) as im:
        im = im.convert("RGB")
        longest = max(im.size)
        if longest <= MAX_EDGE:
            return None
        scale = MAX_EDGE / longest
        size = (max(1, round(im.width * scale)), max(1, round(im.height * scale)))
        im = im.resize(size, Image.LANCZOS)
    # the resized copy is detached from the file handle, so saving over the
    # original is safe even on Windows
    im.save(path, "JPEG", quality=QUALITY, optimize=True, progressive=True)
    return before, path.stat().st_size, size


def main():
    if not TEXTURES.is_dir():
        print(f"  ! no {TEXTURES} — nothing to optimise")
        return 0

    total_before = total_after = 0
    changed = 0
    for path in sorted(TEXTURES.glob("*.jpg")):
        result = optimize(path)
        if result is None:
            print(f"  =  {path.name}  (already within {MAX_EDGE}px)")
            size = path.stat().st_size
            total_before += size
            total_after += size
            continue
        before, after, size = result
        total_before += before
        total_after += after
        changed += 1
        print(f"  v  {path.name}  {before // 1024} KB -> {after // 1024} KB  ({size[0]}x{size[1]})")

    if changed:
        saved = total_before - total_after
        print(f"  optimised {changed} painting(s), saved {saved // 1024} KB")
    else:
        print("  paintings already optimised")
    return 0


if __name__ == "__main__":
    sys.exit(main())
