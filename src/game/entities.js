/**
 * Interactive level objects. Each one owns its mesh, can be reset for a fresh
 * attempt, and is updated once per fixed simulation step.
 *
 * Every shape is built from flat rectangles with black frames (see
 * render/style.js) so nothing breaks the De Stijl grammar.
 */
import * as THREE from 'three';
import { PALETTE, PICKUP, MOVER, CRUMBLE, SPRING, RHYTHM, TONE, SCORE, STYLE } from '../config.js';
import { makeBlock, flat, MAT, Z, box } from '../render/style.js';
import { t } from '../core/i18n.js';

const EPS = 0.02;

// ---------------------------------------------------------------------------
// Coin — a spinning yellow square
// ---------------------------------------------------------------------------
export class Coin {
  constructor(x, y) {
    this.cx = x + 0.5;
    this.cy = y + 0.5;
    this.half = PICKUP.coin.size / 2;
    this.taken = false;
    this.phase = ((x * 7 + y * 13) % 100) / 100 * Math.PI * 2;

    this.mesh = makeBlock(PICKUP.coin.size, PICKUP.coin.size, {
      color: PALETTE.yellow, outline: 0.045, depth: 0.22, z: Z.entity,
    });
    this.mesh.position.set(this.cx, this.cy, 0);
  }

  get body() {
    return { x: this.cx - this.half, y: this.cy - this.half, w: this.half * 2, h: this.half * 2 };
  }

  reset() {
    this.taken = false;
    this.mesh.visible = true;
    this.mesh.scale.setScalar(1);
  }

  update(dt, ctx) {
    if (this.taken) return;
    this.mesh.rotation.y = Math.sin(ctx.time * PICKUP.coin.spin + this.phase) * 1.0;
    this.mesh.position.y = this.cy + Math.sin(ctx.time * 2.4 + this.phase) * 0.07;

    const p = ctx.player;
    if (!p.alive || p.invulnerable > 0) return;
    if (p.x < this.cx + this.half && p.x + p.w > this.cx - this.half
      && p.y < this.cy + this.half && p.y + p.h > this.cy - this.half) {
      this.taken = true;
      this.mesh.visible = false;
      ctx.audio.playVaried('coin', { volume: 0.5 });
      ctx.particles.burst('coin', this.cx, this.cy, 10);
      ctx.session.addScore(SCORE.coin);
      ctx.session.coins++;
      ctx.hud.pulse('coins');
    }
  }
}

// ---------------------------------------------------------------------------
// Spikes — black triangles you must jump over
// ---------------------------------------------------------------------------
export class Spikes {
  constructor(x, y, count) {
    this.x = x;
    this.y = y;
    this.w = count;
    this.h = 0.6;
    this.mesh = new THREE.Group();
    const geo = new THREE.CylinderGeometry(0, 0.44, 0.6, 3, 1);
    const mat = MAT.ink;
    for (let i = 0; i < count; i++) {
      const spike = new THREE.Mesh(geo, mat);
      spike.position.set(x + i + 0.5, y + 0.3, Z.entity);
      spike.rotation.y = Math.PI / 2;
      this.mesh.add(spike);
    }
    this.mesh.userData.disposeGeometry = geo;
  }

  reset() {}
  update() {}

  get body() { return { x: this.x, y: this.y, w: this.w, h: this.h }; }
}

// ---------------------------------------------------------------------------
// Lava — a deadly red plane with a slowly sliding surface line
// ---------------------------------------------------------------------------
export class Lava {
  constructor(x, y, w, h) {
    this.body = { x, y, w, h };
    this.mesh = new THREE.Group();
    this.mesh.add(box(w, h, 0.6, MAT.red, x + w / 2, y + h / 2, Z.terrain));
    this.mesh.add(box(w, 0.14, 0.66, MAT.ink, x + w / 2, y + h - 0.07, Z.terrain));
    // a few drifting yellow bars so the surface reads as moving
    this.bars = [];
    const count = Math.max(2, Math.round(w / 6));
    for (let i = 0; i < count; i++) {
      const bw = 1.2 + Math.random() * 2.4;
      const bar = box(bw, 0.22, 0.7, MAT.yellow, x + Math.random() * w, y + h - 0.12, Z.terrain);
      bar.userData.speed = 0.5 + Math.random() * 0.8;
      this.mesh.add(bar);
      this.bars.push(bar);
    }
  }

  reset() {}
  update(dt) {
    for (const bar of this.bars) {
      bar.position.x += bar.userData.speed * dt;
      if (bar.position.x > this.body.x + this.body.w + 2) {
        bar.position.x = this.body.x - 2;
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Spring — a black base with a yellow plate that fires you upward
// ---------------------------------------------------------------------------
export class Spring {
  constructor(x, y) {
    this.x = x + 0.5;
    this.y = y;
    this.w = 0.9;
    this.cooldown = 0;
    this.squash = 0;

    this.mesh = new THREE.Group();
    this.base = box(0.9, 0.22, 0.8, MAT.ink, this.x, y + 0.11, Z.terrain);
    this.plate = makeBlock(0.86, 0.2, { color: PALETTE.yellow, outline: 0.05, depth: 0.86, z: Z.entity });
    this.plate.position.set(this.x, y + 0.3, 0);
    this.mesh.add(this.base, this.plate);
  }

  get top() { return this.y + 0.42; }
  get body() { return { x: this.x - 0.45, y: this.y, w: 0.9, h: 0.42 }; }

  reset() {
    this.cooldown = 0;
    this.squash = 0;
    this.plate.position.y = this.y + 0.3;
  }

  update(dt, ctx) {
    this.cooldown = Math.max(0, this.cooldown - dt);
    if (this.squash > 0) {
      this.squash = Math.max(0, this.squash - dt * 3.2);
      this.plate.position.y = this.y + 0.3 - this.squash * 0.22;
    }
    const p = ctx.player;
    if (!p.alive || this.cooldown > 0) return;
    if (p.vy > 0.5) return;
    const feet = p.y;
    if (p.x + p.w > this.x - 0.45 && p.x < this.x + 0.45 && feet <= this.top + 0.25 && feet >= this.top - 0.5) {
      p.launch(SPRING.power, 'spring');
      this.cooldown = SPRING.cooldown;
      this.squash = 1;
      ctx.audio.playVaried('jump', { volume: 0.7, spread: 0.05 });
      ctx.particles.burst('spring', this.x, this.top, 12);
      ctx.camera.addShake(0.12);
    }
  }
}

// ---------------------------------------------------------------------------
// Mover — a platform that travels along a path and carries whatever rides it
// ---------------------------------------------------------------------------
export class Mover {
  constructor({ x, y, w, axis, range = MOVER.defaultRange, phase = 0 }) {
    this.origin = { x, y };
    this.w = w;
    this.h = 0.4;
    this.axis = axis;
    this.range = range;
    this.speed = MOVER.speed;
    this.pause = MOVER.pauseTime;

    this.t = phase * range;         // distance travelled along the path
    this.dir = 1;
    this.waiting = 0;
    this.delta = { x: 0, y: 0 };
    this.body = { x, y, w, h: this.h };

    const color = axis === 'x' ? PALETTE.blue : PALETTE.red;
    this.mesh = makeBlock(w, this.h, { color: PALETTE.white, outline: STYLE.outline, depth: 1.0, z: Z.terrain });
    this.mesh.add(box(w * 0.86, 0.14, 0.06, flat(color), 0, this.h / 2 - 0.02, 0.53));
    this._apply();
  }

  reset() {
    this.t = 0;
    this.dir = 1;
    this.waiting = 0;
    this.delta.x = 0;
    this.delta.y = 0;
    this._apply();
  }

  _apply() {
    const x = this.origin.x + (this.axis === 'x' ? this.t : 0);
    const y = this.origin.y + (this.axis === 'y' ? this.t : 0);
    this.body.x = x;
    this.body.y = y;
    this.mesh.position.set(x + this.w / 2, y + this.h / 2, 0);
  }

  update(dt) {
    const before = { x: this.body.x, y: this.body.y };
    if (this.waiting > 0) {
      this.waiting -= dt;
    } else {
      this.t += this.dir * this.speed * dt;
      if (this.t >= this.range) { this.t = this.range; this.dir = -1; this.waiting = this.pause; }
      else if (this.t <= 0) { this.t = 0; this.dir = 1; this.waiting = this.pause; }
    }
    this._apply();
    this.delta.x = this.body.x - before.x;
    this.delta.y = this.body.y - before.y;
  }
}

// ---------------------------------------------------------------------------
// Crumble — a slab that shakes, drops away, and rebuilds itself
// ---------------------------------------------------------------------------
export class Crumble {
  constructor(x, y, w) {
    this.origin = { x, y, w };
    this.h = 0.35;
    this.body = { x, y, w, h: this.h };
    this.state = 'idle';
    this.timer = 0;
    this.offset = 0;

    this.mesh = makeBlock(w, this.h, { color: PALETTE.white, outline: STYLE.outline, depth: 0.9, z: Z.terrain });
    // a black fracture line down the middle, so it reads as unstable
    this.mesh.add(box(0.1, this.h * 0.8, 0.06, MAT.ink, 0, 0, 0.48));
    this._apply();
  }

  _apply() {
    this.mesh.position.set(this.origin.x + this.origin.w / 2, this.origin.y + this.h / 2 + this.offset, 0);
  }

  reset() {
    this.state = 'idle';
    this.timer = 0;
    this.offset = 0;
    this.body.x = this.origin.x;
    this.body.y = this.origin.y;
    this.body.w = this.origin.w;
    this.mesh.visible = true;
    this.mesh.scale.set(1, 1, 1);
    this._apply();
  }

  update(dt, ctx) {
    const p = ctx.player;
    switch (this.state) {
      case 'idle': {
        const standing = p.alive && p.grounded
          && p.x + p.w > this.body.x + 0.02 && p.x < this.body.x + this.body.w - 0.02
          && Math.abs(p.y - (this.body.y + this.h)) < 0.12;
        if (standing) {
          this.state = 'shaking';
          this.timer = CRUMBLE.fuse;
        }
        break;
      }
      case 'shaking': {
        this.timer -= dt;
        this.mesh.position.x = this.origin.x + this.origin.w / 2 + Math.sin(ctx.time * 60) * 0.05;
        if (this.timer <= 0) {
          this.state = 'gone';
          this.timer = CRUMBLE.respawnTime;
          this.mesh.visible = false;
          this.body.w = 0; // stop colliding
          ctx.particles.burst('land', this.body.x + this.origin.w / 2, this.body.y, 12);
          ctx.audio.playVaried('crumble', { volume: 0.6 });
          ctx.camera.addShake(0.1);
        }
        break;
      }
      case 'gone': {
        this.timer -= dt;
        if (this.timer <= 0) {
          this.state = 'rebuilding';
          this.timer = 0.3;
          this.mesh.visible = true;
          this.body.w = this.origin.w;
        }
        break;
      }
      case 'rebuilding': {
        this.timer -= dt;
        const k = 1 - Math.max(0, this.timer) / 0.3;
        this.mesh.scale.set(1, Math.max(0.05, k), 1);
        if (this.timer <= 0) {
          this.state = 'idle';
          this.mesh.scale.set(1, 1, 1);
          this._apply();
        }
        break;
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Checkpoint — a post and a flag that turns red once claimed
// ---------------------------------------------------------------------------
export class Checkpoint {
  constructor(x, y, index) {
    this.index = index;
    this.x = x + 0.5;
    this.y = y;
    this.active = false;

    this.mesh = new THREE.Group();
    this.mesh.add(box(0.14, 2.4, 0.5, MAT.ink, this.x, y + 1.2, Z.terrain));
    this.flag = makeBlock(1.0, 0.72, { color: PALETTE.white, outline: 0.05, depth: 0.28, z: Z.entity });
    this.flag.position.set(this.x + 0.6, y + 2.0, 0);
    this.mesh.add(this.flag);
  }

  reset() {
    this.active = false;
    this._paint(PALETTE.white);
  }

  _paint(color) {
    this.flag.children.forEach((child, i) => {
      if (i > 0) child.material = flat(color); // child 0 is the black frame
    });
  }

  update(dt, ctx) {
    if (this.active) return;
    const p = ctx.player;
    if (!p.alive) return;
    if (p.x + p.w > this.x - 0.5 && p.x < this.x + 1.1 && p.y + p.h > this.y && p.y < this.y + 2.6) {
      this.active = true;
      this._paint(PALETTE.red);
      ctx.audio.play('checkpoint', { volume: 0.6 });
      ctx.particles.burst('confetti', this.x + 0.6, this.y + 2.0, 14);
      ctx.session.addScore(SCORE.checkpoint);
      ctx.session.setCheckpoint(this.index);
      ctx.hud.toast(t('toast.checkpoint'));
    }
  }
}

// ---------------------------------------------------------------------------
// Goal — the De Stijl doorway that ends the level
// ---------------------------------------------------------------------------
export class Goal {
  constructor(x, y) {
    this.x = x + 0.5;
    this.y = y;
    this.reached = false;

    this.mesh = new THREE.Group();
    // outer black frame
    this.mesh.add(box(2.6, 3.4, 0.3, MAT.ink, this.x, y + 1.7, Z.terrain - 0.1));
    this.mesh.add(box(2.2, 3.0, 0.34, MAT.white, this.x, y + 1.6, Z.terrain - 0.06));
    // a small composition inside: the three colours and a black line
    this.mesh.add(box(0.9, 1.2, 0.4, MAT.red, this.x - 0.55, y + 2.05, Z.terrain));
    this.mesh.add(box(1.1, 0.75, 0.4, MAT.blue, this.x + 0.5, y + 2.3, Z.terrain));
    this.mesh.add(box(1.1, 0.9, 0.4, MAT.yellow, this.x + 0.5, y + 1.15, Z.terrain));
    this.mesh.add(box(0.16, 3.0, 0.44, MAT.ink, this.x + 0.02, y + 1.6, Z.terrain + 0.02));
    this.mesh.add(box(2.2, 0.16, 0.44, MAT.ink, this.x, y + 1.72, Z.terrain + 0.02));
  }

  reset() { this.reached = false; }

  update(dt, ctx) {
    // a slow breath so the goal reads as alive without breaking the flat look
    const pulse = 1 + Math.sin(ctx.time * 2.1) * 0.012;
    this.mesh.scale.set(pulse, pulse, 1);
    if (this.reached) return;
    const p = ctx.player;
    if (!p.alive) return;
    if (p.x + p.w > this.x - 1.2 && p.x < this.x + 1.2 && p.y + p.h > this.y && p.y < this.y + 3.4) {
      this.reached = true;
      ctx.particles.confettiAt(this.x, this.y + 1.8, 40, 5);
      ctx.onGoal();
    }
  }
}

// ---------------------------------------------------------------------------
// Rhythm platform — solid on the beat, blinks a countdown, vanishes, returns
// ---------------------------------------------------------------------------
/**
 * The cycle is measured in *musical beats* of the generated score, not in
 * seconds, so every rhythm platform in a level steps to the same clock the
 * music does (see REFERENCE-REPOS.md — the idea comes from speed-rouge's
 * timed bridge, the beat sync is new).
 *
 * The warning is deliberately redundant: the slab turns yellow *and* a row of
 * bars disappears one at a time *and* it starts shaking. Colour alone would be
 * invisible to a colour-blind player, and sound alone to a deaf one.
 */
export class RhythmPlatform {
  constructor({ x, y, w, phase = 0 }) {
    this.origin = { x, y, w };
    this.h = 0.4;
    this.body = { x, y, w, h: this.h };
    this.phase = phase;
    this.state = 'solid';
    this.solid = true;

    this.mesh = new THREE.Group();

    this.solidGroup = new THREE.Group();
    this.face = makeBlock(w, this.h, {
      color: PALETTE.white, outline: STYLE.outline, depth: 1.0, z: Z.terrain,
    });
    this.solidGroup.add(this.face);

    // the stripe carries the state colour, so the slab reads at a glance
    this.stripe = box(w * 0.88, 0.14, 0.06, flat(PALETTE.blue), 0, this.h / 2 - 0.05, 0.53);
    this.solidGroup.add(this.stripe);

    // the countdown: bars that vanish one per fraction of the warning
    this.bars = [];
    const bw = Math.min(0.3, w / (RHYTHM.countdownBars * 1.7));
    for (let i = 0; i < RHYTHM.countdownBars; i++) {
      const bar = box(bw, 0.19, 0.08, MAT.ink,
        (i - (RHYTHM.countdownBars - 1) / 2) * bw * 1.7, -0.03, 0.55);
      bar.visible = false;
      this.solidGroup.add(bar);
      this.bars.push(bar);
    }
    this.mesh.add(this.solidGroup);

    // while gone, a hollow outline marks where it will come back
    this.ghost = box(w + STYLE.outline * 2, this.h + STYLE.outline * 2, 0.14, MAT.ink, 0, 0, Z.terrain - 0.12);
    this.ghost.visible = false;
    this.mesh.add(this.ghost);

    this._place();
  }

  _place(offsetY = 0) {
    this.mesh.position.set(this.origin.x + this.origin.w / 2, this.origin.y + this.h / 2 + offsetY, 0);
  }

  _paint(faceColor, stripeColor) {
    this.face.children[1].material = flat(faceColor);
    this.stripe.material = flat(stripeColor);
  }

  reset() {
    this.state = 'solid';
    this.solid = true;
    this.body.x = this.origin.x;
    this.body.y = this.origin.y;
    this.body.w = this.origin.w;
    this.solidGroup.visible = true;
    this.ghost.visible = false;
    this._paint(PALETTE.white, PALETTE.blue);
    for (const b of this.bars) b.visible = false;
    this._place();
  }

  update(dt, ctx) {
    const cycle = RHYTHM.solidBeats + RHYTHM.warnBeats + RHYTHM.goneBeats;
    const clock = ctx.audio.beatClock();
    const t = (((clock.beat + this.phase) % cycle) + cycle) % cycle;
    const goneStart = RHYTHM.solidBeats + RHYTHM.warnBeats;

    const state = t < RHYTHM.solidBeats ? 'solid' : (t < goneStart ? 'warning' : 'gone');
    if (state !== this.state) {
      this._onStateChange(state, ctx);
      this.state = state;
    }

    // only the collision body changes; the origin never moves
    this.solid = state !== 'gone';
    this.body.w = this.solid ? this.origin.w : 0;

    if (state === 'solid') {
      this.solidGroup.visible = true;
      this.ghost.visible = false;
      this._paint(PALETTE.white, PALETTE.blue);
      for (const b of this.bars) b.visible = false;
      this._place();
    } else if (state === 'warning') {
      const warnT = (t - RHYTHM.solidBeats) / RHYTHM.warnBeats;
      const blink = Math.floor(warnT * 6) % 2 === 0;
      this.solidGroup.visible = true;
      this.ghost.visible = false;
      this._paint(PALETTE.yellow, blink ? PALETTE.red : PALETTE.black);
      const left = Math.ceil((1 - warnT) * RHYTHM.countdownBars);
      this.bars.forEach((b, i) => { b.visible = i < left; });
      this._place(Math.sin(ctx.time * 46) * 0.025);
    } else {
      this.solidGroup.visible = false;
      this.ghost.visible = true;
      this._place();
    }
  }

  _onStateChange(state, ctx) {
    const p = ctx.player;
    const d = Math.hypot(p.centerX - (this.origin.x + this.origin.w / 2), p.centerY - this.origin.y);
    const vol = RHYTHM.tickVolume * Math.max(0, 1 - d / 24);
    if (state === 'warning') {
      if (vol > 0.02) ctx.audio.playVaried('rhythmWarn', { volume: vol, spread: 0.04 });
    } else if (state === 'solid') {
      if (vol > 0.02) ctx.audio.playVaried('rhythmTick', { volume: vol, spread: 0.04 });
      ctx.particles.burst('dust', this.origin.x + this.origin.w / 2, this.origin.y + 0.4, 6, { scale: 0.6 });
    } else {
      ctx.particles.burst('dust', this.origin.x + this.origin.w / 2, this.origin.y + 0.3, 10, { spread: 3.0, scale: 0.7 });
    }
  }
}

// ---------------------------------------------------------------------------
// Tone bar — a surface pad that plays a note when you land on it
// ---------------------------------------------------------------------------
/**
 * Lifted from speed-rouge's piano tiles. The pitch is taken from the chord the
 * score is currently playing, so a row of these plays an arpeggio that is always
 * in key, and the same bar plays a different note as the harmony moves.
 *
 * The bar is a *trigger*, not a collider: it is mounted flush on an existing
 * surface, so it can never create a step to trip over or a gap to fall through.
 */
export class ToneBar {
  constructor({ x, y, w, index = 0 }) {
    this.x = x;
    this.y = y;          // the surface top this pad sits on
    this.w = w;
    this.index = index;
    this.cool = 0;
    this.press = 0;

    this.mesh = new THREE.Group();
    const color = [PALETTE.red, PALETTE.yellow, PALETTE.blue, PALETTE.white][index % 4];
    this.plate = makeBlock(w - 0.1, 0.46, {
      color, outline: 0.05, depth: 0.2, z: 0.56,
    });
    this.baseY = y - 0.24;
    this.plate.position.set(x + w / 2, this.baseY, 0);
    this.mesh.add(this.plate);
  }

  reset() {
    this.cool = 0;
    this.press = 0;
    this.plate.position.y = this.baseY;
    this.plate.scale.set(1, 1, 1);
  }

  update(dt, ctx) {
    this.cool = Math.max(0, this.cool - dt);
    if (this.press > 0) {
      this.press = Math.max(0, this.press - dt * 5.5);
      this.plate.position.y = this.baseY - this.press * 0.075;
      this.plate.scale.set(1, 1 - this.press * 0.3, 1);
    }

    const p = ctx.player;
    if (!p.alive || this.cool > 0 || !p.grounded) return;
    const onTop = Math.abs(p.y - this.y) < 0.16
      && p.x + p.w > this.x + 0.05 && p.x < this.x + this.w - 0.05;
    if (!onTop) return;

    this.cool = TONE.retrigger;
    this.press = 1;
    const chord = ctx.audio.currentChord();
    const semitones = chord[this.index % chord.length] + 12;
    ctx.audio.playPitched('toneBell', semitones, { volume: TONE.volume });
    ctx.particles.burst('jump', p.centerX, this.y + 0.12, 5, {
      angle: Math.PI / 2, spread: 1.4, scale: 0.55,
    });
  }
}
