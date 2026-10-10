/**
 * Grapple hook — the one mechanic borrowed from iifor/doodleshooter's design
 * (see REFERENCE-REPOS.md; that repo ships no assets and no licence, so only the
 * idea was taken, and this is an independent implementation).
 *
 * Hold the button to reel in, release to keep your momentum. The rope is a
 * *velocity* constraint rather than a position constraint: when it is taut the
 * outward radial component of velocity is removed, so the player swings like a
 * pendulum and can never be shoved through geometry — the normal collision step
 * still has the final say on where they end up.
 *
 * Visually the rope is a row of small black dashes with a yellow-cored hook: a
 * line, which is all De Stijl allows.
 */
import * as THREE from 'three';
import { PALETTE, GRAPPLE } from '../config.js';
import { flat, MAT, Z, box } from '../render/style.js';
import { overlaps } from './collision.js';

const STATE = { IDLE: 'idle', FIRING: 'firing', ATTACHED: 'attached', RETRACT: 'retract' };

const ROPE_Z = Z.player + 0.45;

export class Grapple {
  constructor() {
    this.state = STATE.IDLE;
    this.origin = { x: 0, y: 0 };
    this.tip = { x: 0, y: 0 };
    this.anchor = { x: 0, y: 0 };
    this.aim = { x: 1, y: 0 };
    this.length = 0;
    this.cooldown = 0;
    this.retractT = 0;
    this.attachedAt = 0;

    this._buildMesh();
  }

  _buildMesh() {
    this.mesh = new THREE.Group();
    this.mesh.name = 'grapple';

    this.dashes = [];
    for (let i = 0; i < GRAPPLE.ropeDashes; i++) {
      const dash = box(0.36, 0.13, 0.2, MAT.ink, 0, 0, ROPE_Z);
      dash.visible = false;
      this.mesh.add(dash);
      this.dashes.push(dash);
    }

    this.head = new THREE.Group();
    this.head.add(box(0.32, 0.32, 0.22, MAT.ink, 0, 0, ROPE_Z + 0.05));
    this.head.add(box(0.15, 0.15, 0.26, flat(PALETTE.yellow), 0, 0, ROPE_Z + 0.08));
    this.head.visible = false;
    this.mesh.add(this.head);
  }

  // ---- state ---------------------------------------------------------------

  get attached() { return this.state === STATE.ATTACHED; }
  get busy() { return this.state !== STATE.IDLE; }
  /** 0 when ready, 1 when fully on cooldown — drives the HUD indicator. */
  get cooldownRatio() { return this.cooldown / GRAPPLE.cooldown; }

  reset() {
    this.state = STATE.IDLE;
    this.cooldown = 0;
    this.retractT = 0;
    this.length = 0;
    this._hide();
  }

  _hide() {
    for (const d of this.dashes) d.visible = false;
    this.head.visible = false;
  }

  // ---- per-step ------------------------------------------------------------

  /** Runs before the player integrates, so the pull lands in the same step. */
  update(dt, ctx, player) {
    this.cooldown = Math.max(0, this.cooldown - dt);

    switch (this.state) {
      case STATE.IDLE:
        if (ctx.input.takePress('grapple') && this.cooldown <= 0 && player.alive) this._fire(ctx, player);
        break;

      case STATE.FIRING:
        this._advanceHook(dt, ctx, player);
        break;

      case STATE.ATTACHED:
        this._reel(dt, ctx, player);
        break;

      case STATE.RETRACT:
        this.retractT -= dt;
        if (this.retractT <= 0) this.state = STATE.IDLE;
        break;

      default: break;
    }

    this._syncVisuals(player);
  }

  _fire(ctx, player) {
    this.origin.x = player.centerX;
    this.origin.y = player.centerY;
    this.tip.x = this.origin.x;
    this.tip.y = this.origin.y;

    // aim at the cursor when there is one, otherwise up and forward
    const p = ctx.input.pointer;
    let ax, ay;
    if (p.has) {
      const world = ctx.camera.screenToWorld(p.x, p.y);
      ax = world.x - this.origin.x;
      ay = world.y - this.origin.y;
    } else {
      ax = player.facing * 0.92;
      ay = 0.6;
    }
    const len = Math.hypot(ax, ay) || 1;
    this.aim.x = ax / len;
    this.aim.y = ay / len;

    this.state = STATE.FIRING;
    ctx.audio.playVaried('grappleFire', { volume: 0.5, spread: 0.1 });
    ctx.particles.burst('dash', this.origin.x, this.origin.y, 5, {
      angle: Math.atan2(this.aim.y, this.aim.x), spread: 0.6, scale: 0.7,
    });
  }

  /** Marches the hook head outward in small sub-steps so it cannot skip a slab. */
  _advanceHook(dt, ctx, player) {
    let remaining = GRAPPLE.fireSpeed * dt;
    const MAX_STEP = 0.22;

    while (remaining > 0 && this.state === STATE.FIRING) {
      const step = Math.min(MAX_STEP, remaining);
      remaining -= step;
      this.tip.x += this.aim.x * step;
      this.tip.y += this.aim.y * step;

      if (this._hookHits(ctx)) {
        this.state = STATE.ATTACHED;
        this.anchor.x = this.tip.x;
        this.anchor.y = this.tip.y;
        const dist = Math.hypot(this.anchor.x - player.centerX, this.anchor.y - player.centerY);
        this.length = Math.max(GRAPPLE.minLength, dist);
        this.attachedAt = ctx.time;
        ctx.audio.playVaried('grappleHit', { volume: 0.55, spread: 0.08 });
        ctx.particles.burst('land', this.anchor.x, this.anchor.y, 9, { scale: 0.65 });
        ctx.camera.addShake(0.1);
        return;
      }

      const travelled = Math.hypot(this.tip.x - this.origin.x, this.tip.y - this.origin.y);
      if (travelled >= GRAPPLE.maxRange) {
        this.state = STATE.RETRACT;
        this.retractT = GRAPPLE.retractTime;
        return;
      }
    }
  }

  _hookHits(ctx) {
    const r = GRAPPLE.tipRadius;
    const probe = { x: this.tip.x - r, y: this.tip.y - r, w: r * 2, h: r * 2 };
    for (const s of ctx.level.solidBodies()) if (overlaps(probe, s)) return true;
    return false;
  }

  _reel(dt, ctx, player) {
    const held = ctx.input.isDown('grapple');
    const cx = player.centerX;
    const cy = player.centerY;
    const dx = this.anchor.x - cx;
    const dy = this.anchor.y - cy;
    const dist = Math.hypot(dx, dy) || 0.0001;
    const nx = dx / dist;
    const ny = dy / dist;

    if (held) this.length = Math.max(GRAPPLE.minLength, this.length - GRAPPLE.reelSpeed * dt);

    // pull: full strength while reeling, a gentle tug otherwise
    const pull = GRAPPLE.reelAccel * (held ? 1 : 0.3);
    player.vx += nx * pull * dt;
    player.vy += ny * pull * dt;

    // taut rope: kill the outward radial velocity
    const radial = player.vx * nx + player.vy * ny;
    if (dist >= this.length - 0.02 && radial > 0) {
      player.vx -= radial * nx;
      player.vy -= radial * ny;
    }

    // damp the inward component too, so it settles into a swing instead of
    // ping-ponging along the rope
    const inward = player.vx * nx + player.vy * ny;
    if (inward < 0) {
      const k = 1 - Math.exp(-GRAPPLE.radialDamping * dt);
      player.vx -= inward * nx * k;
      player.vy -= inward * ny * k;
    }

    const speed = Math.hypot(player.vx, player.vy);
    if (speed > GRAPPLE.maxReelSpeed) {
      const s = GRAPPLE.maxReelSpeed / speed;
      player.vx *= s;
      player.vy *= s;
    }

    if (!held || dist < GRAPPLE.releaseDistance) this._release(ctx);
  }

  _release(ctx) {
    this.state = STATE.IDLE;
    this.cooldown = GRAPPLE.cooldown;
    this._hide();
    ctx.audio.playVaried('grappleRelease', { volume: 0.4, spread: 0.12 });
  }

  // ---- visuals -------------------------------------------------------------

  _syncVisuals(player) {
    if (this.state === STATE.IDLE) { this._hide(); return; }

    const fromX = player.centerX + player.facing * 0.18;
    const fromY = player.centerY + 0.12;
    const to = this.state === STATE.ATTACHED ? this.anchor : this.tip;
    const dx = to.x - fromX;
    const dy = to.y - fromY;
    const dist = Math.hypot(dx, dy);
    const angle = Math.atan2(dy, dx);

    this.head.visible = true;
    this.head.position.set(to.x, to.y, 0);
    this.head.rotation.z = angle;

    const n = this.dashes.length;
    for (let i = 0; i < n; i++) {
      const dash = this.dashes[i];
      const t = (i + 1) / (n + 1);
      dash.visible = dist > 0.75;
      dash.position.set(fromX + dx * t, fromY + dy * t, 0);
      dash.rotation.z = angle;
      // dashes thin out toward the hook, which reads as a rope under tension
      const shrink = 1 - t * 0.35;
      dash.scale.set(0.36 * shrink, 0.13, 0.2);
    }
  }
}
