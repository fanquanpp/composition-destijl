/**
 * Enemies. Three behaviours, all built from the same flat-block vocabulary:
 *
 *   walker  blue square, patrols, turns at walls, ledges and hazards. Stompable.
 *   flyer   yellow square, drifts along a sine path through the air. Stompable.
 *   spiker  black-and-red square with spikes on top. NOT stompable — it has to
 *           be avoided, or dashed past.
 *
 * Contact resolution (stomp vs. hurt) lives here so the rule is written once.
 */
import * as THREE from 'three';
import { PALETTE, ENEMY, PLAYER } from '../config.js';
import { makeBlock, flat, MAT, Z, box } from '../render/style.js';
import { moveX, groundBelow, overlaps } from './collision.js';

const DEATH_TIME = 0.36;

class EnemyBase {
  constructor(kind, x, y, dir) {
    const cfg = ENEMY[kind];
    this.kind = kind;
    this.cfg = cfg;
    this.w = cfg.width;
    this.h = cfg.height;
    this.body = { x: x + 0.5 - this.w / 2, y, w: this.w, h: this.h };
    this.dir = dir ?? -1;
    this.alive = true;
    this.dying = 0;
    this.mesh = new THREE.Group();
    this.squash = 1;
    this.deathTilt = 0;
  }

  get centerX() { return this.body.x + this.w / 2; }
  get centerY() { return this.body.y + this.h / 2; }

  reset(x, y, dir) {
    this.body.x = x + 0.5 - this.w / 2;
    this.body.y = y;
    this.dir = dir ?? this.dir;
    this.alive = true;
    this.dying = 0;
    this.squash = 1;
    this.deathTilt = 0;
    this.mesh.visible = true;
    this.mesh.rotation.z = 0;
    this._sync();
  }

  _sync() {
    this.mesh.position.set(this.centerX, this.body.y, 0);
  }

  /** Flat-squash death, then the level reaps it. */
  kill(ctx, cause = 'stomp') {
    if (!this.alive) return;
    this.alive = false;
    this.dying = DEATH_TIME;
    this.squash = 0.12;
    this.mesh.scale.set(1.25, 0.12, 1);
    ctx.particles.burst('pop', this.centerX, this.body.y + this.h / 2, 14);
    ctx.audio.playVaried('enemyPop', { volume: 0.55 });
    ctx.camera.addShake(0.16);
    ctx.session.addScore(this.cfg.score);
  }

  updateDeath(dt) {
    this.dying -= dt;
    if (this.dying <= 0) this.mesh.visible = false;
  }
}

// ---------------------------------------------------------------------------

class Walker extends EnemyBase {
  constructor(x, y, dir) {
    super('walker', x, y, dir);
    this.speed = ENEMY.walker.speed;

    this.mesh.add(makeBlock(this.w, this.h, { color: PALETTE.blue, outline: 0.06, depth: 0.7, z: Z.entity }));
    this.eyes = new THREE.Group();
    for (const dx of [-0.16, 0.16]) {
      this.eyes.add(box(0.15, 0.15, 0.08, MAT.white, dx, 0.12, 0.37));
      this.eyes.add(box(0.07, 0.07, 0.1, MAT.ink, dx, 0.12, 0.41));
    }
    this.mesh.add(this.eyes);
    this._sync();
  }

  update(dt, ctx) {
    if (!this.alive) { this.updateDeath(dt); return; }
    const hit = moveX(ctx.level, this.body, this.dir * this.speed * dt);
    const frontX = this.dir > 0 ? this.body.x + this.w + 0.18 : this.body.x - 0.18;
    const footY = this.body.y - 0.16;

    const wall = this.dir > 0 ? hit.right : hit.left;
    const ledge = !groundBelow(ctx.level, frontX, this.body.y, 0.3);
    const hazard = ctx.level.deadlyAt(frontX, this.body.y + 0.1) || ctx.level.deadlyAt(frontX, footY);

    if (wall || ledge || hazard) {
      this.dir *= -1;
      this.eyes.position.x = this.dir * 0.04;
    }
    this._sync();
    this.mesh.rotation.z = Math.sin(ctx.time * 9 + this.centerX) * 0.035;
  }
}

// ---------------------------------------------------------------------------

class Flyer extends EnemyBase {
  constructor(x, y) {
    super('flyer', x, y);
    this.speed = ENEMY.flyer.speed;
    this.anchorX = x + 0.5;
    this.anchorY = y;
    this.phase = (x * 0.31 + y * 0.17) % (Math.PI * 2);
    this.range = 2.2;

    this.mesh.add(makeBlock(this.w, this.h, { color: PALETTE.yellow, outline: 0.06, depth: 0.7, z: Z.entity }));
    this.wings = new THREE.Group();
    for (const s of [-1, 1]) {
      const wing = box(0.5, 0.14, 0.12, MAT.ink, s * (this.w / 2 + 0.22), 0.14, 0);
      this.wings.add(wing);
    }
    this.mesh.add(this.wings);
    for (const dx of [-0.15, 0.15]) {
      this.mesh.add(box(0.14, 0.14, 0.08, MAT.ink, dx, 0.05, 0.37));
    }
    this._sync();
  }

  update(dt, ctx) {
    if (!this.alive) { this.updateDeath(dt); return; }
    const t = ctx.time + this.phase;
    this.body.x = this.anchorX + Math.sin(t * 0.55) * this.range - this.w / 2;
    this.body.y = this.anchorY + Math.sin(t * (Math.PI * 2 / ENEMY.flyer.period)) * ENEMY.flyer.amplitude;
    this.mesh.rotation.z = Math.sin(t * 1.4) * 0.12;
    this.wings.rotation.z = Math.sin(ctx.time * 12 + this.phase) * 0.5;
    this._sync();
  }
}

// ---------------------------------------------------------------------------

class Spiker extends EnemyBase {
  constructor(x, y, dir) {
    super('spiker', x, y, dir);
    this.speed = ENEMY.spiker.speed;

    this.mesh.add(makeBlock(this.w, this.h, { color: PALETTE.black, outline: 0.06, depth: 0.7, z: Z.entity }));
    this.mesh.add(box(this.w * 0.42, this.h * 0.42, 0.1, flat(PALETTE.red), 0, 0, 0.37));
    // spikes along the top edge
    const spikeGeo = new THREE.CylinderGeometry(0, 0.17, 0.3, 3, 1);
    for (let i = 0; i < 3; i++) {
      const s = new THREE.Mesh(spikeGeo, MAT.ink);
      s.position.set((i - 1) * 0.28, this.h / 2 + 0.13, Z.entity);
      s.rotation.y = Math.PI / 2;
      this.mesh.add(s);
    }
    this.mesh.userData.disposeGeometry = spikeGeo;
    this._sync();
  }

  update(dt, ctx) {
    if (!this.alive) { this.updateDeath(dt); return; }
    const hit = moveX(ctx.level, this.body, this.dir * this.speed * dt);
    const frontX = this.dir > 0 ? this.body.x + this.w + 0.18 : this.body.x - 0.18;
    const wall = this.dir > 0 ? hit.right : hit.left;
    const ledge = !groundBelow(ctx.level, frontX, this.body.y, 0.3);
    const hazard = ctx.level.deadlyAt(frontX, this.body.y + 0.1);
    if (wall || ledge || hazard) this.dir *= -1;
    this._sync();
    this.mesh.rotation.z = Math.sin(ctx.time * 7 + this.centerX) * 0.03;
  }
}

// ---------------------------------------------------------------------------

export function makeEnemy(spec) {
  switch (spec.type) {
    case 'flyer': return new Flyer(spec.x, spec.y);
    case 'spiker': return new Spiker(spec.x, spec.y, spec.dir);
    default: return new Walker(spec.x, spec.y, spec.dir);
  }
}

/**
 * Player/enemy contact. The rule: falling onto a stompable enemy kills it and
 * bounces the player; anything else costs a heart.
 */
export function resolveEnemyContact(enemy, ctx) {
  const p = ctx.player;
  if (!enemy.alive || !p.alive || p.invulnerable > 0 || p.dashing) return;
  if (!overlaps(p, enemy.body)) return;

  const stomping = p.vy < 0 && p.y > enemy.body.y + enemy.h * 0.35;
  if (stomping && enemy.cfg.stompable) {
    enemy.kill(ctx, 'stomp'); // kill() awards the score
    p.bounce(p.jumpHeld ? PLAYER.stompBounceHeld : PLAYER.stompBounce);
    ctx.particles.burst('stomp', enemy.centerX, enemy.centerY, 10);
    ctx.audio.playVaried('stomp', { volume: 0.65 });
    return;
  }
  if (stomping && !enemy.cfg.stompable) {
    // landing on a spiker hurts, and bounces you off it
    p.bounce(12);
    p.hurt(ctx, enemy.centerX < p.x + p.w / 2 ? 1 : -1);
    return;
  }
  p.hurt(ctx, enemy.centerX < p.x + p.w / 2 ? 1 : -1);
}
