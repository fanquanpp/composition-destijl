/**
 * Axis-separated AABB collision. Bodies are {x, y, w, h} with (x, y) at the
 * BOTTOM-LEFT corner and y pointing up.
 *
 * Movement is resolved one axis at a time, which is the classic platformer
 * approach: it never leaves the body inside geometry, it gives you the contact
 * flags you need for coyote time and wall jumps, and at a 1/120 s step the
 * per-step displacement (max ~0.25 units) is far too small to tunnel.
 */

export function overlaps(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export function overlapsX(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x;
}

/** Move along x, then push out of anything solid. Returns what was hit. */
export function moveX(level, body, dx) {
  body.x += dx;
  const hit = { left: false, right: false };
  if (dx === 0) return hit;
  for (const s of level.solidBodies()) {
    if (!overlaps(body, s)) continue;
    if (dx > 0) { body.x = s.x - body.w; hit.right = true; }
    else { body.x = s.x + s.w; hit.left = true; }
  }
  return hit;
}

/**
 * Move along y, then push out. `prevBottom` is the body's bottom edge before
 * the move — one-way platforms only catch a body that was above them.
 */
export function moveY(level, body, dy, prevBottom) {
  body.y += dy;
  const hit = { ground: false, ceiling: false };
  for (const s of level.solidBodies()) {
    if (!overlaps(body, s)) continue;
    if (dy < 0) { body.y = s.y + s.h; hit.ground = true; }
    else if (dy > 0) { body.y = s.y - body.h; hit.ceiling = true; }
  }
  if (dy < 0) {
    for (const p of level.oneWayBodies()) {
      if (!overlapsX(body, p)) continue;
      const top = p.y + p.h;
      if (prevBottom >= top - 0.03 && body.y < top) {
        body.y = top;
        hit.ground = true;
      }
    }
  }
  return hit;
}

/** Is there any solid/one-way surface within `tol` below (x, y)? */
export function groundBelow(level, x, y, tol = 0.12) {
  const probe = { x: x - 0.05, y: y - tol, w: 0.1, h: tol };
  for (const s of level.solidBodies()) if (overlaps(probe, s)) return true;
  for (const p of level.oneWayBodies()) if (overlaps(probe, p)) return true;
  return false;
}

/** Is there solid geometry at (x, y)? Used for enemy ledge detection. */
export function solidAt(level, x, y) {
  const probe = { x, y, w: 0.001, h: 0.001 };
  for (const s of level.solidBodies()) if (overlaps(probe, s)) return true;
  for (const p of level.oneWayBodies()) if (overlaps(probe, p)) return true;
  return false;
}
