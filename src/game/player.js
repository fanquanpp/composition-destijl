/**
 * The player. A red square with a black frame, and a movement model with the
 * usual modern-platformer affordances:
 *
 *   - acceleration-based running, faster to stop than to start
 *   - variable jump height (release early to cut the rise)
 *   - coyote time and a jump buffer, so the controls forgive a few frames
 *   - a double jump, refreshed by wall jumps
 *   - wall slide and wall jump, which is how the chimneys are climbed
 *   - a short invulnerable dash
 *
 * The player object IS the collision body: it has x, y, w, h with (x, y) at the
 * bottom-left, so it can be handed straight to collision.js and to overlaps().
 */
import * as THREE from 'three';
import { PALETTE, PLAYER, GRAPPLE } from '../config.js';
import { flat, MAT, Z, box } from '../render/style.js';
import { moveX, moveY } from './collision.js';
import { Grapple } from './grapple.js';

const approach = (current, target, maxDelta) => {
  if (current < target) return Math.min(current + maxDelta, target);
  if (current > target) return Math.max(current - maxDelta, target);
  return current;
};

export class Player {
  constructor() {
    this.w = PLAYER.width;
    this.h = PLAYER.height;

    this.mesh = new THREE.Group();
    this.bodyGroup = new THREE.Group(); // origin sits at the feet, so squash is grounded
    this.mesh.add(this.bodyGroup);
    this._buildMesh();

    /** the rope lives in world space, so its mesh is added to the scene by main.js */
    this.grapple = new Grapple();

    this.reset(0, 0);
  }

  _buildMesh() {
    const w = this.w, h = this.h;
    const cy = h / 2;
    // black frame + red face, the same construction as every block in the world
    this.bodyGroup.add(box(w + 0.11, h + 0.11, 0.62, MAT.ink, 0, cy, Z.player - 0.02));
    this.bodyGroup.add(box(w, h, 0.7, flat(PALETTE.red), 0, cy, Z.player));
    // a yellow detail square and a black grid line, so the player is a
    // composition in miniature rather than a plain red box
    this.bodyGroup.add(box(w * 0.42, h * 0.3, 0.08, flat(PALETTE.yellow), -w * 0.2, h * 0.32, Z.player + 0.36));
    this.bodyGroup.add(box(0.09, h * 0.62, 0.08, MAT.ink, w * 0.26, cy, Z.player + 0.36));

    this.eyes = new THREE.Group();
    for (const dx of [-0.15, 0.13]) {
      this.eyes.add(box(0.16, 0.2, 0.08, MAT.white, dx, h * 0.74, Z.player + 0.36));
      this.eyes.add(box(0.08, 0.1, 0.1, MAT.ink, dx + 0.02, h * 0.74, Z.player + 0.4));
    }
    this.bodyGroup.add(this.eyes);
  }

  // ---- state ---------------------------------------------------------------

  reset(x, y) {
    if (this.grapple) this.grapple.reset();
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.grounded = false;
    // Spawn points are on the ground by construction, so grant coyote time
    // immediately: otherwise a jump pressed on the very first frame after a
    // respawn burns the air jump instead of doing a ground jump.
    this.coyote = PLAYER.coyoteTime;
    this.jumpBuffer = 0;
    this.airJumps = PLAYER.maxAirJumps;
    this.wallDir = 0;
    this.wallSlide = 0;
    this.wallJumpLock = 0;
    this.dashTime = 0;
    this.dashCooldown = 0;
    this.dashDir = 1;
    this.invulnerable = 0;
    this.alive = true;
    this.deadTimer = 0;
    this.facing = 1;
    this.jumpHeld = false;
    this.jumpCutUsed = false;
    this.gravityScale = 1;
    this.squashX = 1;
    this.squashY = 1;
    this.tilt = 0;
    this.spawn = { x, y };
    this.mesh.visible = true;
    this.mesh.rotation.z = 0;
    this.bodyGroup.scale.set(1, 1, 1);
    this._syncMesh();
  }

  get centerX() { return this.x + this.w / 2; }
  get centerY() { return this.y + this.h / 2; }
  get dashing() { return this.dashTime > 0; }

  _syncMesh() {
    this.mesh.position.set(this.x + this.w / 2, this.y, 0);
  }

  // ---- external effects ----------------------------------------------------

  /** Fired by springs; bypasses the jump buffer entirely. */
  launch(power, source = 'spring') {
    this.vy = power;
    this.grounded = false;
    this.coyote = 0;
    this.jumpBuffer = 0;
    this.jumpCutUsed = true; // springs are not cut short by releasing jump
    this.airJumps = PLAYER.maxAirJumps;
    this.squashX = 0.72;
    this.squashY = 1.34;
  }

  /** Upward impulse from stomping an enemy. */
  bounce(power) {
    this.vy = power;
    this.grounded = false;
    this.coyote = 0;
    this.jumpCutUsed = true;
    this.airJumps = PLAYER.maxAirJumps;
    this.squashX = 0.78;
    this.squashY = 1.26;
  }

  hurt(ctx, dirX = 1) {
    if (!this.alive || this.invulnerable > 0) return;
    // the last heart is fatal
    if (ctx.session.loseHeart() <= 0) {
      this.die(ctx);
      return;
    }
    this.invulnerable = PLAYER.invulnTime;
    this.vx = -dirX * PLAYER.knockbackX;
    this.vy = PLAYER.knockbackY;
    this.grounded = false;
    this.dashTime = 0;
    this.squashX = 1.3;
    this.squashY = 0.72;
    ctx.audio.playVaried('hurt', { volume: 0.7 });
    ctx.particles.burst('hurt', this.centerX, this.centerY, 12);
    ctx.camera.addShake(0.4);
  }

  die(ctx) {
    if (!this.alive) return;
    this.alive = false;
    this.deadTimer = PLAYER.deathPause;
    this.vy = 16;
    this.vx = 0;
    this.dashTime = 0;
    this.grapple.reset();
    ctx.audio.play('death', { volume: 0.75 });
    ctx.particles.burst('pop', this.centerX, this.centerY, 22);
    ctx.camera.addShake(0.7);
    ctx.session.onDeath();
  }

  // ---- simulation ---------------------------------------------------------

  update(dt, ctx) {
    if (!this.alive) {
      this._updateDead(dt, ctx);
      return;
    }

    const input = ctx.input;
    const ax = input.axisX();
    const jumpDown = input.isDown('jump');
    this.jumpHeld = jumpDown;

    // --- timers
    this.coyote -= dt;
    this.jumpBuffer -= dt;
    this.wallJumpLock -= dt;
    this.dashCooldown -= dt;
    if (this.invulnerable > 0) this.invulnerable -= dt;
    if (input.takePress('jump')) this.jumpBuffer = PLAYER.jumpBuffer;

    // --- dash
    if (input.takePress('dash') && this.dashCooldown <= 0 && this.dashTime <= 0) {
      this.dashDir = ax !== 0 ? Math.sign(ax) : this.facing;
      this.dashTime = PLAYER.dashTime;
      this.dashCooldown = PLAYER.dashCooldown;
      this.vy = 0;
      this.facing = this.dashDir;
      ctx.audio.playVaried('dash', { volume: 0.45 });
      ctx.particles.burst('dash', this.centerX, this.centerY, 9, {
        angle: this.dashDir > 0 ? Math.PI : 0, spread: 1.1,
      });
    }

    if (this.dashTime > 0) {
      this.dashTime -= dt;
      this.vx = this.dashDir * PLAYER.dashSpeed;
      this.vy = 0;
      this.gravityScale = 0;
      if (Math.random() < 0.6) {
        ctx.particles.burst('dash', this.centerX, this.centerY, 1, { spread: 0.6 });
      }
    } else {
      this.gravityScale = 1;
      if (this.wallJumpLock <= 0) this._steer(dt, ax);
      if (ax !== 0) this.facing = Math.sign(ax);
    }

    // --- wall contact
    const probeY = this.y + this.h * 0.28;
    const probeH = this.h * 0.5;
    const wallLeft = ctx.level.solidAtRect(this.x - 0.16, probeY, 0.16, probeH);
    const wallRight = ctx.level.solidAtRect(this.x + this.w, probeY, 0.16, probeH);
    const pressedInto = (wallLeft && ax < 0) || (wallRight && ax > 0);
    this.wallSlide = 0;
    if (!this.grounded && this.vy < 0 && pressedInto && this.dashTime <= 0) {
      this.wallDir = wallLeft ? -1 : 1;
      this.wallSlide = 1;
      if (this.vy < -PLAYER.wallSlideSpeed) this.vy = -PLAYER.wallSlideSpeed;
      if (Math.random() < 0.35) {
        ctx.particles.burst('dust', wallLeft ? this.x : this.x + this.w, this.centerY, 1, { spread: 1.0, scale: 0.8 });
      }
    } else if (this.grounded || !(wallLeft || wallRight)) {
      this.wallDir = 0;
    }

    // --- gravity, shaped rather than constant
    const ropeGravity = this.grapple.attached ? GRAPPLE.gravityScale : 1;
    this.vy -= PLAYER.gravity * this._gravityScaleFor(jumpDown) * this.gravityScale * ropeGravity * dt;
    if (this.vy < -PLAYER.maxFallSpeed) this.vy = -PLAYER.maxFallSpeed;
    // stick to the ground so the contact is re-detected every step
    if (this.grounded && this.vy <= 0 && this.dashTime <= 0) this.vy = -1.5;

    // --- jumps
    if (this.jumpBuffer > 0) this._tryJump(ctx, ax);

    // --- variable height
    if (!jumpDown && this.vy > 0 && !this.jumpCutUsed) {
      this.vy *= PLAYER.jumpCut;
      this.jumpCutUsed = true;
    }

    // --- grapple: applies its pull and rope constraint to this step's velocity
    if (ctx.level.def.grapple) this.grapple.update(dt, ctx, this);
    else if (this.grapple.busy) this.grapple.reset();

    // --- integrate
    const prevBottom = this.y;
    const hitX = moveX(ctx.level, this, this.vx * dt);
    if (hitX.left || hitX.right) {
      if (this.dashTime > 0) { this.dashTime = 0; ctx.camera.addShake(0.15); }
      this.vx = 0;
    }
    const hitY = moveY(ctx.level, this, this.vy * dt, prevBottom);

    if (hitY.ground) {
      if (!this.grounded) this._onLand(ctx);
      this.grounded = true;
      this.coyote = PLAYER.coyoteTime;
      this.airJumps = PLAYER.maxAirJumps;
      this.vy = 0;
    } else {
      if (this.grounded) this.coyote = PLAYER.coyoteTime; // walked off an edge
      this.grounded = false;
    }
    if (hitY.ceiling && this.vy > 0) this.vy = 0;

    // --- hazards and the void
    const hazard = ctx.level.hazardAt(this.centerX, this.y + 0.06);
    if (hazard) {
      if (hazard.kind === 'lava') this.die(ctx);
      else this.hurt(ctx, this.vx >= 0 ? -1 : 1);
    }
    if (this.y + this.h < ctx.level.killY) this.die(ctx);

    this._visual(dt, ctx);
  }

  /**
   * Horizontal steering.
   *
   * The interesting case is over-speed: if the player is already moving faster
   * than run speed in the direction they are holding, we bleed the excess away
   * slowly instead of pulling back to run speed. Without this, touching the
   * stick after a dash deletes the dash.
   *
   * Air acceleration also scales with speed: full authority near a standstill,
   * `airControlHigh` of it at run speed. Slow means responsive, fast means
   * committed.
   */
  _steer(dt, ax) {
    const target = ax * PLAYER.runSpeed;
    const sameWay = ax !== 0 && Math.sign(this.vx) === Math.sign(target);
    if (sameWay && Math.abs(this.vx) > Math.abs(target)) {
      this.vx = approach(this.vx, target, PLAYER.overSpeedBleed * PLAYER.gravity * dt);
      return;
    }
    let accel;
    if (this.grounded) {
      accel = ax !== 0 ? PLAYER.groundAccel : PLAYER.groundDecel;
    } else if (ax !== 0) {
      const ratio = Math.min(1, Math.abs(this.vx) / PLAYER.runSpeed);
      accel = PLAYER.airAccel * (1 + (PLAYER.airControlHigh - 1) * ratio);
    } else {
      accel = PLAYER.airDecel;
    }
    this.vx = approach(this.vx, target, accel * dt);
  }

  /**
   * Gravity multiplier for this step. Three regimes:
   *   rising, button held   -> riseHold, so holding the button is worth something
   *   rising, near the apex -> apexHang, the float at the top of a good jump
   *   falling               -> fallMultiplier, tapering toward terminal velocity
   *                             as (1 - (v/maxFall)^2) rather than hard-clamping,
   *                             so the descent eases into its limit
   */
  _gravityScaleFor(jumpDown) {
    if (this.vy > 0) {
      let k = Math.abs(this.vy) < PLAYER.apexWindow ? PLAYER.apexHang : 1;
      if (jumpDown) k *= PLAYER.riseHold;
      return k;
    }
    const t = Math.min(1, Math.abs(this.vy) / PLAYER.maxFallSpeed);
    return PLAYER.fallMultiplier * (1 - t * t * PLAYER.fallTaper);
  }

  _tryJump(ctx, ax) {
    if (this.grounded || this.coyote > 0) {
      this.vy = PLAYER.jumpSpeed;
      this.grounded = false;
      this.coyote = 0;
      this.jumpBuffer = 0;
      this.jumpCutUsed = false;
      this.squashX = 0.8;
      this.squashY = 1.24;
      ctx.audio.playVaried('jump', { volume: 0.55, spread: 0.07 });
      ctx.particles.burst('jump', this.centerX, this.y, 7, { angle: Math.PI / 2, spread: 1.8 });
      return;
    }
    if (this.wallDir !== 0) {
      this.vx = -this.wallDir * PLAYER.wallJumpX;
      this.vy = PLAYER.wallJumpY;
      this.wallJumpLock = PLAYER.wallJumpLock;
      this.wallDir = 0;
      this.jumpBuffer = 0;
      this.jumpCutUsed = false;
      this.airJumps = PLAYER.maxAirJumps; // wall jumps refresh the air jump
      this.facing = this.vx > 0 ? 1 : -1;
      this.squashX = 0.8;
      this.squashY = 1.24;
      ctx.audio.playVaried('jump', { volume: 0.55, spread: 0.07 });
      ctx.particles.burst('jump', this.centerX, this.centerY, 9, { spread: 2.2 });
      return;
    }
    if (this.airJumps > 0) {
      this.airJumps--;
      this.vy = PLAYER.doubleJumpSpeed;
      this.jumpBuffer = 0;
      this.jumpCutUsed = false;
      this.squashX = 0.78;
      this.squashY = 1.28;
      ctx.audio.playVaried('doubleJump', { volume: 0.5, spread: 0.08 });
      // a ring of squares under the feet
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        ctx.particles.burst('dash', this.centerX + Math.cos(a) * 0.3, this.centerY - 0.3, 1, { angle: a, spread: 0.4 });
      }
    }
  }

  _onLand(ctx) {
    const impact = Math.min(1, Math.abs(this.lastFallSpeed ?? 0) / 26);
    if (impact < 0.28) return;
    this.squashX = 1 + 0.3 * impact;
    this.squashY = 1 - 0.3 * impact;
    ctx.audio.playVaried(impact > 0.72 ? 'landHeavy' : 'land', { volume: 0.25 + 0.35 * impact });
    ctx.particles.burst('land', this.centerX, this.y, Math.round(4 + impact * 8), {
      angle: 0, spread: 3.2, scale: 0.7 + impact * 0.6,
    });
    if (impact > 0.7) ctx.camera.addShake(0.18 * impact);
  }

  _updateDead(dt, ctx) {
    this.deadTimer -= dt;
    this.vy -= PLAYER.gravity * 0.7 * dt;
    this.mesh.rotation.z += dt * 7;
    this.mesh.position.y += this.vy * dt;
    this.mesh.position.x += this.vx * dt;
  }

  _visual(dt, ctx) {
    // squash and stretch, springing back to neutral
    const k = 1 - Math.exp(-14 * dt);
    this.squashX += (1 - this.squashX) * k;
    this.squashY += (1 - this.squashY) * k;
    this.bodyGroup.scale.set(this.squashX, this.squashY, 1);

    // lean into the run, tilt into a wall slide, stretch while dashing
    let wantTilt = -this.vx * 0.012;
    if (this.wallSlide) wantTilt = this.wallDir * 0.16;
    if (this.dashTime > 0) {
      wantTilt = 0;
      this.bodyGroup.scale.set(this.squashX * 1.16, this.squashY * 0.86, 1);
    }
    if (!this.alive) wantTilt = 0;
    this.tilt += (wantTilt - this.tilt) * (1 - Math.exp(-12 * dt));
    this.bodyGroup.rotation.z = this.tilt;

    this.eyes.position.x = (this.facing > 0 ? 0.04 : -0.04) + this.facing * 0.03;
    this.mesh.visible = this.invulnerable > 0 ? (Math.floor(ctx.time * 18) % 2 === 0) : true;

    this.lastFallSpeed = this.vy;
    this._syncMesh();
  }
}
