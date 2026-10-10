/**
 * The world: builds meshes and entities from a level definition, and owns the
 * fixed-step update order. Getting that order right is what makes moving
 * platforms carry the player correctly:
 *
 *   1. movers advance and publish their delta
 *   2. anything standing on a mover is shifted by that delta
 *   3. the collision caches are rebuilt
 *   4. the player simulates
 *   5. enemies simulate, then contacts are resolved
 *   6. other entities (coins, springs, checkpoints, the goal) react
 */
import * as THREE from 'three';
import { PALETTE, STYLE } from '../config.js';
import { makeBlock, disposeTree, Z } from '../render/style.js';
import { Backdrop } from '../render/background.js';
import { normalizeLevel } from './levels.js';
import { tSource } from '../core/i18n.js';
import { Coin, Spikes, Lava, Spring, Mover, Crumble, Checkpoint, Goal, RhythmPlatform, ToneBar } from './entities.js';
import { makeEnemy, resolveEnemyContact } from './enemies.js';
import { overlaps } from './collision.js';

const COLOR = {
  white: PALETTE.white,
  red: PALETTE.red,
  blue: PALETTE.blue,
  yellow: PALETTE.yellow,
};

export class Level {
  /**
   * @param {THREE.Scene} scene
   * @param {object} definition a raw entry from levels.js
   * @param {import('../core/assets.js').AssetLibrary} assets
   */
  constructor(scene, definition, assets) {
    this.scene = scene;
    this.def = normalizeLevel(definition);
    this.assets = assets;

    this.id = this.def.id;
    this.name = this.def.name;
    this.numeral = this.def.numeral;
    this.subtitle = this.def.subtitle;
    this.targetTime = this.def.targetTime;
    this.width = this.def.bounds.w;
    this.height = this.def.bounds.h;
    this.killY = -4;

    this.root = new THREE.Group();
    this.root.name = `level:${this.id}`;
    scene.add(this.root);

    this._buildBackdrop();
    this._buildTerrain();
    this._buildEntities();

    this._solidCache = [];
    this._oneWayCache = [];
    this._rebuildCaches();

    this.triggersFired = new Set();
  }

  // ---- construction --------------------------------------------------------

  _buildBackdrop() {
    const paintings = (this.def.paintings ?? []).map((p) => ({
      texture: this.assets?.getTexture(p.key) ?? null,
      x: p.x, y: p.y, w: p.w, h: p.h,
    }));
    this.backdrop = new Backdrop(this.scene, {
      seed: this.def.seed,
      levelWidth: this.width,
      levelHeight: this.height,
      paintings,
    });
  }

  _buildTerrain() {
    this.solids = [];
    for (const [x, y, w, h, color] of this.def.solids) {
      const body = { x, y, w, h };
      const mesh = makeBlock(w, h, {
        color: COLOR[color] ?? PALETTE.white,
        outline: STYLE.outline,
        depth: STYLE.depth,
        z: Z.terrain,
      });
      mesh.position.set(x + w / 2, y + h / 2, 0);
      this.root.add(mesh);
      this.solids.push({ ...body, mesh });
    }

    this.oneWays = [];
    for (const [x, y, w] of this.def.oneWays) {
      const body = { x, y, w, h: 0.3 };
      const mesh = makeBlock(w, 0.3, {
        color: PALETTE.white, outline: STYLE.outline * 0.8, depth: 0.85, z: Z.terrain,
      });
      mesh.position.set(x + w / 2, y + 0.15, 0);
      this.root.add(mesh);
      this.oneWays.push({ ...body, mesh });
    }
  }

  _buildEntities() {
    const add = (entity) => { this.root.add(entity.mesh); return entity; };

    this.coins = this.def.coins.map(([x, y]) => add(new Coin(x, y)));
    this.spikes = this.def.spikes.map(([x, y, n]) => add(new Spikes(x, y, n)));
    this.lava = this.def.lava.map(([x, y, w, h]) => add(new Lava(x, y, w, h)));
    this.springs = this.def.springs.map(([x, y]) => add(new Spring(x, y)));
    this.movers = this.def.movers.map((m) => add(new Mover(m)));
    this.crumbles = this.def.crumbles.map(([x, y, w]) => add(new Crumble(x, y, w)));
    this.rhythms = this.def.rhythms.map(([x, y, w, phase]) => add(new RhythmPlatform({ x, y, w, phase })));
    // tone bars are declared as rows: [x, surfaceY, count]
    this.toneBars = this.def.toneBars.flatMap(([x, y, count]) =>
      Array.from({ length: count }, (_, i) => add(new ToneBar({ x: x + i, y, w: 1, index: i }))));
    this.checkpoints = this.def.checkpoints.map(([x, y], i) => add(new Checkpoint(x, y, i)));
    this.goal = add(new Goal(this.def.goal[0], this.def.goal[1]));
    this.enemies = this.def.enemies.map((spec) => {
      const e = makeEnemy(spec);
      this.root.add(e.mesh);
      e.spec = spec;
      return e;
    });

    this.hazardRects = [
      ...this.spikes.map((s) => ({ ...s.body, kind: 'spike' })),
      ...this.lava.map((l) => ({ ...l.body, kind: 'lava' })),
    ];
  }

  // ---- collision queries ---------------------------------------------------

  _rebuildCaches() {
    this._solidCache.length = 0;
    for (const s of this.solids) this._solidCache.push(s);
    for (const m of this.movers) this._solidCache.push(m.body);
    for (const c of this.crumbles) if (c.body.w > 0) this._solidCache.push(c.body);
    for (const r of this.rhythms) if (r.solid) this._solidCache.push(r.body);

    this._oneWayCache.length = 0;
    for (const o of this.oneWays) this._oneWayCache.push(o);
  }

  solidBodies() { return this._solidCache; }
  oneWayBodies() { return this._oneWayCache; }

  solidAtRect(x, y, w, h) {
    const probe = { x, y, w, h };
    for (const s of this._solidCache) if (overlaps(probe, s)) return true;
    return false;
  }

  /** Hazard under a point, used by enemies. Returns the hazard or null. */
  deadlyAt(x, y) {
    const probe = { x: x - 0.1, y: y - 0.1, w: 0.2, h: 0.2 };
    for (const hz of this.hazardRects) if (overlaps(probe, hz)) return hz;
    return null;
  }

  /** Hazard touching the player's feet — spikes hurt, lava kills. */
  hazardAt(cx, feetY) {
    const probe = { x: cx - 0.3, y: feetY, w: 0.6, h: 0.26 };
    for (const hz of this.hazardRects) if (overlaps(probe, hz)) return hz;
    return null;
  }

  /** Is (x, y) inside a solid? Used for enemy ledge checks in some cases. */
  spawnPoint() {
    return { x: this.def.spawn[0] + 0.5 - 0.39, y: this.def.spawn[1] };
  }

  checkpointPoint(index) {
    const cp = this.def.checkpoints[index];
    if (!cp) return this.spawnPoint();
    return { x: cp[0] + 0.5 - 0.39, y: cp[1] };
  }

  // ---- lifecycle -----------------------------------------------------------

  reset() {
    for (const c of this.coins) c.reset();
    for (const s of this.spikes) s.reset();
    for (const l of this.lava) l.reset();
    for (const s of this.springs) s.reset();
    for (const m of this.movers) m.reset();
    for (const c of this.crumbles) c.reset();
    for (const r of this.rhythms) r.reset();
    for (const t of this.toneBars) t.reset();
    for (const c of this.checkpoints) c.reset();
    for (const e of this.enemies) e.reset(e.spec.x, e.spec.y, e.spec.dir);
    this.goal.reset();
    this.triggersFired.clear();
    this._rebuildCaches();
  }

  dispose() {
    this.scene.remove(this.root);
    disposeTree(this.root);
    this.backdrop.dispose();
  }

  // ---- per-step ------------------------------------------------------------

  update(dt, ctx) {
    // 1. movers first, so their delta can be applied to riders
    for (const m of this.movers) m.update(dt);
    // 2. rhythm platforms next: they decide whether they exist this beat, and
    //    the collision caches below have to see that decision
    for (const r of this.rhythms) r.update(dt, ctx);
    // 3. carry whatever is standing on a mover
    this._carryRiders(ctx.player, dt);
    // 4. refresh collision caches against the new platform positions
    this._rebuildCaches();
    // 5. player
    ctx.player.update(dt, ctx);
    // 6. enemies, then contact resolution
    for (const e of this.enemies) e.update(dt, ctx);
    for (const e of this.enemies) resolveEnemyContact(e, ctx);
    // 7. everything else
    for (const c of this.coins) c.update(dt, ctx);
    for (const t of this.toneBars) t.update(dt, ctx);
    for (const s of this.springs) s.update(dt, ctx);
    for (const c of this.crumbles) c.update(dt, ctx);
    for (const c of this.checkpoints) c.update(dt, ctx);
    for (const l of this.lava) l.update(dt, ctx);
    this.goal.update(dt, ctx);

    this._checkTriggers(ctx);
  }

  /** Visual-only updates, run once per rendered frame (not per sim step). */
  updateVisuals(dt, ctx) {
    this.backdrop.update(ctx.camera.camera.position.x, ctx.camera.camera.position.y);
  }

  _carryRiders(player, dt) {
    for (const m of this.movers) {
      if (m.delta.x === 0 && m.delta.y === 0) continue;
      const top = m.body.y + m.body.h;
      const riding = player.alive
        && player.x + player.w > m.body.x + 0.02
        && player.x < m.body.x + m.body.w - 0.02
        && Math.abs(player.y - top) < 0.14
        && player.vy <= 0.1;
      if (riding) {
        player.x += m.delta.x;
        player.y += m.delta.y;
        if (m.delta.y > 0 && player.vy < 0) player.vy = 0;
      }
    }
  }

  _checkTriggers(ctx) {
    const px = ctx.player.centerX;
    // keyed by index, not by x: two triggers may legitimately share a position
    this.def.triggers.forEach((t, i) => {
      if (this.triggersFired.has(i)) return;
      if (px >= t.x) {
        this.triggersFired.add(i);
        ctx.hud.toast(tSource(t.text));
      }
    });
  }
}
