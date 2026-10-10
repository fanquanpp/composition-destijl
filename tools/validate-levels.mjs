#!/usr/bin/env node
/**
 * Level checker. Run: node tools/validate-levels.mjs [levelId]
 *
 * Hard errors (exit 1): geometry that is malformed or self-contradictory —
 * unknown colours, overlapping solid rectangles, entities buried inside blocks,
 * missing spawn/goal, content outside the declared bounds, or a goal that the
 * player provably cannot reach.
 *
 * Reachability: a graph over standing surfaces, using the real player constants
 * from src/config.js. Moving platforms contribute a node for every position
 * along their path, springs grant a boosted jump, and gaps that only close with
 * a dash are marked as such. An edge exists when the jump envelope allows it AND
 * a sampled parabolic arc between the two surfaces is not blocked.
 *
 * It also prints an ASCII map, which is the fastest way to actually see a level.
 */
import { LEVELS, getLevel, normalizeLevel } from '../src/game/levels.js';
import { PLAYER } from '../src/config.js';

const G = PLAYER.gravity;
const V_JUMP = PLAYER.jumpSpeed;
const V_DOUBLE = PLAYER.doubleJumpSpeed;
const RUN = PLAYER.runSpeed;
const PW = PLAYER.width;
const PH = PLAYER.height;

const MAX_RISE = (V_JUMP * V_JUMP) / (2 * G);
const MAX_RISE_DOUBLE = MAX_RISE + (V_DOUBLE * V_DOUBLE) / (2 * G);
const MAX_GAP = (2 * V_JUMP / G) * RUN;
const SPRING_RISE = (27 * 27) / (2 * G); // SPRING.power in config.js
/** extra horizontal reach a dash buys, minus a safety margin */
const DASH_BONUS = PLAYER.dashSpeed * PLAYER.dashTime * 0.75;

const errors = [];
const warnings = [];

// ---------------------------------------------------------------------------
// geometry
// ---------------------------------------------------------------------------

function solidRects(lv) {
  return lv.solids.map(([x, y, w, h, color]) => ({ x, y, w, h, color }));
}

function standableRects(lv) {
  const out = solidRects(lv).map((r) => ({ ...r, kind: 'solid' }));
  for (const [x, y, w] of lv.oneWays) out.push({ x, y, w, h: 0.3, kind: 'oneWay' });
  for (const c of lv.crumbles) out.push({ x: c[0], y: c[1], w: c[2], h: 0.35, kind: 'crumble' });
  for (const m of lv.movers) out.push({ x: m.x, y: m.y, w: m.w, h: 0.4, kind: 'mover' });
  for (const [x, y] of lv.springs) out.push({ x, y, w: 1, h: 0.35, kind: 'spring' });
  // Rhythm platforms are only solid part of the time. Reachability assumes the
  // player can wait for one, so they are treated as always present — that is the
  // generous reading, and a route that needs one is still a route.
  for (const [x, y, w] of lv.rhythms) out.push({ x, y, w, h: 0.4, kind: 'rhythm' });
  return out;
}

function makeCollider(lv) {
  const solids = solidRects(lv);
  const deadly = [
    ...lv.lava.map(([x, y, w, h]) => ({ x, y, w, h })),
    ...lv.spikes.map(([x, y, n]) => ({ x, y, w: n, h: 0.6 })),
  ];
  return {
    blocked(cx, feetY) {
      const l = cx - PW / 2, r = cx + PW / 2, b = feetY, t = feetY + PH;
      for (const s of solids) {
        if (r > s.x && l < s.x + s.w && t > s.y && b < s.y + s.h) return true;
      }
      return false;
    },
    deadly(cx, feetY) {
      const l = cx - PW / 2, r = cx + PW / 2, b = feetY, t = feetY + PH;
      for (const s of deadly) {
        if (r > s.x && l < s.x + s.w && t > s.y + 0.05 && b < s.y + s.h) return true;
      }
      return false;
    },
  };
}

function surfaceUnder(rects, cx, feetY, tol = 0.35) {
  let best = null;
  for (const r of rects) {
    if (cx + PW / 2 <= r.x + 0.02 || cx - PW / 2 >= r.x + r.w - 0.02) continue;
    const top = r.y + r.h;
    if (top <= feetY + 0.05 && top >= feetY - tol) {
      if (best === null || top > best) best = top;
    }
  }
  return best;
}

/** sampled parabolic arc between two surfaces; false if solid geometry is in the way */
function arcClear(collider, a, b, apexLift) {
  const rise = b.y - a.y;
  const n = 18;
  for (let i = 1; i < n; i++) {
    const t = i / n;
    const x = a.x + (b.x - a.x) * t;
    const y = a.y + rise * t + 4 * apexLift * t * (1 - t);
    if (collider.blocked(x, y)) return false;
  }
  return true;
}

/**
 * Is this surface inside a wall-jump chimney — a solid within reach on both
 * sides? Alternating wall jumps let the player climb arbitrarily far in such a
 * shaft, which the plain jump envelope cannot express, so chimney nodes get an
 * extended vertical edge. The `arcClear` check still applies.
 */
function isChimney(solids, n) {
  const probeY = n.y + 4.0; // look a few tiles up, above any doorway lintel
  const spanning = solids.filter((s) => s.y < probeY && s.y + s.h > probeY);
  const leftFace = n.x - PW / 2, rightFace = n.x + PW / 2;
  const hasLeft = spanning.some((s) => {
    const d = leftFace - (s.x + s.w);
    return d > -0.4 && d < 4.0;
  });
  const hasRight = spanning.some((s) => {
    const d = s.x - rightFace;
    return d > -0.4 && d < 4.0;
  });
  return hasLeft && hasRight;
}

/**
 * Walking: two surfaces at the same height connected by unbroken ground. This
 * must be free of any jump arc, otherwise a player strolling under a low ledge
 * would be modelled as arcing up into it.
 */
function isWalk(standables, a, b) {
  if (Math.abs(b.y - a.y) > 0.01) return false;
  const dx = Math.abs(b.x - a.x);
  if (dx > 2.5) return false;
  const steps = Math.max(2, Math.ceil(dx / 0.25));
  for (let i = 1; i < steps; i++) {
    const x = a.x + (b.x - a.x) * (i / steps);
    if (surfaceUnder(standables, x, a.y, 0.2) === null) return false;
  }
  return true;
}

/** Can the player get from surface a to surface b? */
function edge(collider, a, b) {
  const dx = Math.abs(b.x - a.x);
  const dy = b.y - a.y;
  const maxRise = a.spring ? SPRING_RISE : MAX_RISE_DOUBLE;
  if (dy > maxRise - 0.2) return { ok: false, why: `rise ${dy.toFixed(1)} > ${maxRise.toFixed(1)}` };

  let range;
  if (a.spring) {
    range = MAX_GAP * 1.5;
  } else if (dy > 0) {
    const v2 = V_JUMP * V_JUMP - 2 * G * dy;
    range = v2 <= 0 ? MAX_GAP * 1.6 : (2 * Math.sqrt(v2) / G) * RUN;
    if (dy > MAX_RISE) range = MAX_GAP * 1.25; // needs the air jump
  } else {
    range = MAX_GAP;
  }

  const apexLift = Math.min(dy > 0 ? dy + 1.6 : 1.6, Math.max(MAX_RISE, dy + 0.4), maxRise);
  const needed = dy > 0 ? range + 0.6 : range + 0.6;
  if (dx <= needed) {
    if (arcClear(collider, a, b, apexLift)) return { ok: true, dash: false };
  }
  if (dx <= needed + DASH_BONUS && dy <= 0.2) {
    // a dash can only help on roughly level ground
    if (arcClear(collider, a, b, Math.min(0.8, apexLift))) return { ok: true, dash: true };
  }
  return { ok: false, why: `gap ${dx.toFixed(1)} > ${needed.toFixed(1)}` };
}

// ---------------------------------------------------------------------------
// map
// ---------------------------------------------------------------------------

function renderMap(lv) {
  const w = lv.bounds.w, h = lv.bounds.h;
  const grid = Array.from({ length: h }, () => Array(w).fill(' '));
  const put = (x, y, ch) => {
    const c = Math.round(x), r = h - 1 - Math.round(y);
    if (r >= 0 && r < h && c >= 0 && c < w) grid[r][c] = ch;
  };
  for (const [x, y, rw, rh, color] of lv.solids) {
    const ch = color === 'white' ? '#' : color === 'red' ? 'R' : color === 'blue' ? 'B' : 'Y';
    for (let i = 0; i < rw; i++) for (let j = 0; j < rh; j++) put(x + i, y + j, ch);
  }
  for (const [x, y, rw] of lv.oneWays) for (let i = 0; i < rw; i++) put(x + i, y, '=');
  for (const [x, y, rw] of lv.crumbles) for (let i = 0; i < rw; i++) put(x + i, y, 'x');
  for (const [x, y, rw, rh] of lv.lava) for (let i = 0; i < rw; i++) for (let j = 0; j < rh; j++) put(x + i, y + j, '~');
  for (const [x, y, n] of lv.spikes) for (let i = 0; i < n; i++) put(x + i, y, '^');
  for (const [x, y, w] of lv.rhythms) for (let i = 0; i < w; i++) put(x + i, y, '%');
  for (const [x, y, n] of lv.toneBars) for (let i = 0; i < n; i++) put(x + i, y, '"');
  for (const [x, y] of lv.springs) put(x, y, 'S');
  for (const m of lv.movers) {
    for (let i = 0; i < m.w; i++) put(m.x + i, m.y, m.axis === 'x' ? '-' : '|');
    if (m.axis === 'x') for (let i = 0; i < m.range; i++) put(m.x + m.w + i, m.y, '.');
    else for (let i = 1; i <= m.range; i++) put(m.x, m.y + i, "'");
  }
  for (const [x, y] of lv.coins) put(x, y, 'o');
  for (const [x, y] of lv.checkpoints) put(x, y, 'K');
  for (const e of lv.enemies) put(e.x, e.y, e.type === 'walker' ? 'w' : e.type === 'flyer' ? 'f' : 's');
  put(lv.spawn[0], lv.spawn[1], 'P');
  put(lv.goal[0], lv.goal[1], 'G');
  return grid.map((r) => r.join(''));
}

// ---------------------------------------------------------------------------

function checkLevel(def) {
  const lv = normalizeLevel(def);
  const E = (m) => errors.push(`[${lv.id}] ${m}`);
  const W = (m) => warnings.push(`[${lv.id}] ${m}`);
  const localErrors = [], localWarnings = [];

  // ---- structural --------------------------------------------------------
  const validColors = new Set(['white', 'red', 'blue', 'yellow']);
  lv.solids.forEach(([x, y, w, h, color], i) => {
    if (!validColors.has(color)) localErrors.push(`solids[${i}] unknown colour "${color}"`);
    if (w <= 0 || h <= 0) localErrors.push(`solids[${i}] non-positive size ${w}x${h}`);
  });

  const solids = solidRects(lv);
  for (let i = 0; i < solids.length; i++) {
    for (let j = i + 1; j < solids.length; j++) {
      const a = solids[i], b = solids[j];
      if (a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y) {
        localErrors.push(`solids[${i}][${a.x},${a.y},${a.w},${a.h}] overlaps solids[${j}][${b.x},${b.y},${b.w},${b.h}]`
          + ' — coplanar faces will z-fight');
      }
    }
  }

  const collider = makeCollider(lv);
  const standables = standableRects(lv);
  const buried = (x, y, label) => {
    if (collider.blocked(x + 0.5, y)) localErrors.push(`${label} at (${x}, ${y}) is buried inside a solid block`);
  };
  buried(lv.spawn[0], lv.spawn[1], 'spawn');
  buried(lv.goal[0], lv.goal[1], 'goal');
  for (const [x, y] of lv.checkpoints) buried(x, y, 'checkpoint');
  for (const e of lv.enemies) buried(e.x, e.y, `${e.type} enemy`);
  for (const [x, y] of lv.coins) if (collider.blocked(x + 0.5, y)) localWarnings.push(`coin at (${x}, ${y}) is inside a block`);

  if (surfaceUnder(standables, lv.spawn[0] + 0.5, lv.spawn[1], 0.4) === null) {
    localErrors.push(`spawn at (${lv.spawn[0]}, ${lv.spawn[1]}) has no ground under it`);
  }
  if (surfaceUnder(standables, lv.goal[0] + 0.5, lv.goal[1], 0.4) === null) {
    localErrors.push(`goal at (${lv.goal[0]}, ${lv.goal[1]}) has no ground under it`);
  }
  for (const [x, y] of lv.checkpoints) {
    if (surfaceUnder(standables, x + 0.5, y, 0.4) === null) localErrors.push(`checkpoint at (${x}, ${y}) has no ground under it`);
  }
  for (const [x, y] of lv.springs) {
    if (surfaceUnder(standables, x + 0.5, y, 0.4) === null) localWarnings.push(`spring at (${x}, ${y}) floats`);
  }
  // A timed platform you cannot jump off is a trap: the player lands on it, the
  // beat turns it off, and they fall with no way out. Require headroom.
  const HEADROOM = PH + 1.2;
  // Anything that can actually stop a jump. One-way platforms are excluded on
  // purpose: they are passable from below, so they never trap you.
  const blockers = [
    ...solids,
    ...lv.crumbles.map(([x, y, w]) => ({ x, y, w, h: 0.35, tag: 'crumble' })),
    ...lv.movers.map((m) => (m.axis === 'x'
      ? { x: m.x, y: m.y, w: m.w + m.range, h: 0.4, tag: 'mover' }
      : { x: m.x, y: m.y, w: m.w, h: 0.4 + m.range, tag: 'mover' })),
    ...lv.rhythms.map(([x, y, w]) => ({ x, y, w, h: 0.4, tag: 'rhythm' })),
  ];
  lv.rhythms.forEach(([x, y, w], i) => {
    const top = y + 0.4;
    for (const b of blockers) {
      if (b.x === x && b.y === y && b.tag === 'rhythm') continue; // itself
      if (b.x >= x + w || b.x + b.w <= x) continue;               // no horizontal overlap
      const gap = b.y - top;
      if (gap > -0.05 && gap < HEADROOM) {
        localWarnings.push(`rhythm platform #${i} at (${x}, ${y}) has only ${gap.toFixed(1)} tiles of `
          + `headroom below a ${b.tag} at [${b.x},${b.y},${b.w},${b.h}] — you could land on it but not jump off`);
      }
    }
  });

  // tone bars are surface pads, so they must be flush with a real surface
  for (const [x, y, count] of lv.toneBars) {
    for (let i = 0; i < count; i++) {
      if (surfaceUnder(standables, x + i + 0.5, y, 0.45) === null) {
        localWarnings.push(`tone bar at (${x + i}, ${y}) has no surface to sit on`);
      }
    }
  }
  for (const e of lv.enemies) {
    if (collider.deadly(e.x + 0.5, e.y)) localWarnings.push(`${e.type} at (${e.x}, ${e.y}) stands in lava/spikes`);
  }

  const maxX = Math.max(...solids.map((s) => s.x + s.w), ...lv.oneWays.map(([x, , w]) => x + w),
    ...lv.movers.map((m) => m.x + m.w + (m.axis === 'x' ? m.range : 0)), ...lv.lava.map(([x, , w]) => x + w), lv.goal[0] + 1);
  const maxY = Math.max(...solids.map((s) => s.y + s.h), ...lv.oneWays.map(([, y]) => y + 1),
    ...lv.movers.map((m) => m.y + (m.axis === 'y' ? m.range : 0) + 1), lv.goal[1] + 1);
  if (maxX > lv.bounds.w) localErrors.push(`content reaches x=${maxX} but bounds.w=${lv.bounds.w}`);
  if (maxY > lv.bounds.h) localErrors.push(`content reaches y=${maxY} but bounds.h=${lv.bounds.h}`);

  // ---- nodes -------------------------------------------------------------
  const nodes = [];
  const push = (x, y, kind) => {
    const cx = Math.round(x * 2) / 2;
    if (collider.blocked(cx, y) || collider.deadly(cx, y)) return;
    nodes.push({ x: cx, y, kind });
  };
  for (const r of standables) {
    if (r.kind === 'mover') continue; // handled below, one node per path position
    const top = r.y + r.h;
    for (let x = r.x + 0.5; x < r.x + r.w; x += 0.5) push(x, top, r.kind);
  }
  for (const m of lv.movers) {
    if (m.axis === 'x') {
      for (let x = m.x + 0.5; x < m.x + m.w + m.range; x += 0.5) push(x, m.y + 0.4, 'mover');
    } else {
      for (let k = 0; k <= m.range * 2; k++) {
        for (let i = 0; i < m.w; i++) push(m.x + 0.5 + i, m.y + 0.4 + k * 0.5, 'mover');
      }
    }
  }
  // springs boost whatever node sits on them, and chimneys allow wall-jump climbs
  for (const n of nodes) {
    n.spring = lv.springs.some(([sx, sy]) => Math.abs(n.x - (sx + 0.5)) <= 1.0 && Math.abs(n.y - (sy + 0.35)) <= 0.5);
    n.chimney = isChimney(solids, n);
  }

  const key = (n) => `${n.x.toFixed(1)}:${n.y.toFixed(1)}`;
  const start = nodes.reduce((best, n) => {
    const d = Math.hypot(n.x - (lv.spawn[0] + 0.5), n.y - lv.spawn[1]);
    return d < best.d ? { d, n } : best;
  }, { d: Infinity, n: null }).n;

  const visited = new Map();
  const dashEdges = new Set();
  const chimneyEdges = new Set();
  const queue = start ? [start] : [];
  while (queue.length) {
    const a = queue.pop();
    if (visited.has(key(a))) continue;
    visited.set(key(a), a);
    for (const b of nodes) {
      if (visited.has(key(b))) continue;
      if (Math.abs(b.x - a.x) > MAX_GAP + DASH_BONUS + 2) continue;
      const walk = isWalk(standables, a, b);
      let r = walk ? { ok: true, dash: false } : edge(collider, a, b);
      if (!r.ok && a.chimney && b.y > a.y + 1.5 && Math.abs(b.x - a.x) <= 4.6 && b.y - a.y <= 13) {
        // alternating wall jumps up a shaft
        if (arcClear(collider, a, b, Math.max(5, b.y - a.y))) r = { ok: true, dash: false, chimney: true };
      }
      if (!r.ok) continue;
      if (r.dash) dashEdges.add(`${a.x.toFixed(1)},${a.y.toFixed(1)}->${b.x.toFixed(1)},${b.y.toFixed(1)}`);
      if (r.chimney) chimneyEdges.add(`${a.x.toFixed(1)},${a.y.toFixed(1)}->${b.x.toFixed(1)},${b.y.toFixed(1)}`);
      queue.push(b);
    }
  }

  const reachable = (x, y, tol) => [...visited.values()].some((n) => Math.hypot(n.x - (x + 0.5), n.y - y) <= tol);
  /** reachable while airborne: near a standing surface horizontally, within jump height */
  const airborne = (x, y, dx = 6.5, up = 4.5, down = 3.5) =>
    [...visited.values()].some((n) => {
      // springs and wall-jump chimneys reach much higher than a plain jump
      const reachUp = n.spring ? SPRING_RISE + 1.2 : (n.chimney ? 13 : up);
      return Math.abs(n.x - (x + 0.5)) <= dx && n.y - y <= down && y - n.y <= reachUp;
    });

  if (!reachable(lv.goal[0], lv.goal[1], 1.8)) localErrors.push(`goal at (${lv.goal[0]}, ${lv.goal[1]}) is NOT reachable from the spawn`);
  for (const [x, y] of lv.checkpoints) {
    if (!reachable(x, y, 1.8)) localWarnings.push(`checkpoint at (${x}, ${y}) looks unreachable`);
  }
  const badCoins = lv.coins.filter(([x, y]) => !airborne(x, y));
  if (badCoins.length) {
    localWarnings.push(`${badCoins.length}/${lv.coins.length} coins out of jump range: ${badCoins.slice(0, 10).map((c) => `(${c})`).join(' ')}${badCoins.length > 10 ? ' …' : ''}`);
  }
  for (const e of lv.enemies) {
    if (!airborne(e.x, e.y, 7.5, 6.0, 4.0)) localWarnings.push(`${e.type} at (${e.x}, ${e.y}) is in a region the player never visits`);
  }

  errors.push(...localErrors);
  warnings.push(...localWarnings);

  return {
    lv, localErrors, localWarnings, map: renderMap(lv),
    reached: visited.size, total: nodes.length, dashEdges, chimneyEdges,
  };
}

// ---------------------------------------------------------------------------

const only = process.argv[2];
const list = only ? [getLevel(only)] : LEVELS;

for (const def of list) {
  const r = checkLevel(def);
  console.log(`\n${'='.repeat(100)}`);
  console.log(`${r.lv.numeral}. ${r.lv.name}  (${r.lv.id})   ${r.lv.bounds.w}x${r.lv.bounds.h}   target ${r.lv.targetTime}s`);
  console.log(`   solids ${r.lv.solids.length} · oneWays ${r.lv.oneWays.length} · movers ${r.lv.movers.length} · crumbles ${r.lv.crumbles.length}`
    + ` · rhythms ${r.lv.rhythms.length} · toneBars ${r.lv.toneBars.reduce((n, t) => n + t[2], 0)}`
    + ` · springs ${r.lv.springs.length} · coins ${r.lv.coins.length} · enemies ${r.lv.enemies.length} · lava ${r.lv.lava.length} · spikes ${r.lv.spikes.length}`);
  console.log(`   reachable surfaces: ${r.reached}/${r.total}   spawn (${r.lv.spawn})   goal (${r.lv.goal})`);
  if (r.dashEdges.size) console.log(`   dash-only jumps: ${r.dashEdges.size}   wall-jump climb edges: ${r.chimneyEdges.size}`);
  console.log(`\n${r.map.map((l, i) => `   ${String(r.lv.bounds.h - i - 1).padStart(2)} │${l}`).join('\n')}`);
  console.log(`      └${Array.from({ length: r.lv.bounds.w }, (_, i) => (i % 10 === 0 ? '┬' : '─')).join('')}`);
  console.log(`       ${Array.from({ length: r.lv.bounds.w }, (_, i) => (i % 10 === 0 ? String(Math.floor(i / 10) % 10) : ' ')).join('')}`);
  if (r.localErrors.length) {
    console.log('\n   ERRORS');
    for (const e of r.localErrors) console.log(`     ✗ ${e}`);
  }
  if (r.localWarnings.length) {
    console.log('\n   warnings');
    for (const w of r.localWarnings) console.log(`     ! ${w}`);
  }
}

console.log(`\n${'='.repeat(100)}`);
console.log(`${errors.length} error(s), ${warnings.length} warning(s)`);
console.log('legend  # white  R red  B blue  Y yellow   = one-way  x crumble  - . mover(x)  | \' mover(y)');
console.log('        S spring  ^ spike  ~ lava  o coin  P spawn  G goal  K checkpoint  w walker  f flyer  s spiker');
console.log('        % rhythm platform (timed)  " tone bar (plays a note)');
process.exit(errors.length ? 1 : 0);
