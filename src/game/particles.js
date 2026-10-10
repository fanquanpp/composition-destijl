/**
 * Particle pool. Every particle is a flat square in a palette colour — no
 * textures, no sprites, no blending tricks, which keeps the whole game on the
 * same visual grammar as the blocks.
 *
 * The pool is preallocated and recycled, so bursts never allocate during play.
 */
import * as THREE from 'three';
import { PALETTE } from '../config.js';
import { UNIT_BOX, MAT, flat, Z } from '../render/style.js';

const MAX = 220;

const PRESETS = {
  dust:   { colors: [PALETTE.white, PALETTE.paper], size: [0.08, 0.2], speed: [1.5, 4], up: [0.5, 2.4], life: [0.25, 0.5], gravity: 6 },
  land:   { colors: [PALETTE.white, PALETTE.black], size: [0.08, 0.24], speed: [3, 8], up: [0.4, 1.6], life: [0.2, 0.45], gravity: 12 },
  jump:   { colors: [PALETTE.white], size: [0.07, 0.16], speed: [1.2, 3.4], up: [0.6, 2.2], life: [0.18, 0.36], gravity: 5 },
  coin:   { colors: [PALETTE.yellow, PALETTE.white], size: [0.06, 0.16], speed: [3, 9], up: [3, 8], life: [0.3, 0.6], gravity: 20 },
  stomp:  { colors: [PALETTE.blue, PALETTE.white, PALETTE.black], size: [0.08, 0.22], speed: [4, 10], up: [2, 7], life: [0.25, 0.55], gravity: 22 },
  pop:    { colors: [PALETTE.red, PALETTE.yellow, PALETTE.blue, PALETTE.white], size: [0.1, 0.3], speed: [5, 13], up: [3, 10], life: [0.35, 0.8], gravity: 26 },
  hurt:   { colors: [PALETTE.red, PALETTE.black], size: [0.08, 0.2], speed: [4, 9], up: [2, 6], life: [0.25, 0.5], gravity: 18 },
  dash:   { colors: [PALETTE.white, PALETTE.blue], size: [0.06, 0.2], speed: [2, 6], up: [-1, 1], life: [0.15, 0.35], gravity: 0 },
  spring: { colors: [PALETTE.yellow, PALETTE.white], size: [0.07, 0.18], speed: [2, 6], up: [4, 10], life: [0.2, 0.45], gravity: 16 },
  confetti: { colors: [PALETTE.red, PALETTE.yellow, PALETTE.blue, PALETTE.white, PALETTE.black], size: [0.1, 0.34], speed: [4, 14], up: [4, 12], life: [0.6, 1.4], gravity: 14 },
};

const rand = (a, b) => a + Math.random() * (b - a);

export class Particles {
  constructor(scene) {
    this.scene = scene;
    this.pool = [];
    this.group = new THREE.Group();
    this.group.name = 'particles';
    scene.add(this.group);

    for (let i = 0; i < MAX; i++) {
      const mesh = new THREE.Mesh(UNIT_BOX, MAT.white);
      mesh.visible = false;
      mesh.position.z = Z.particle;
      this.group.add(mesh);
      this.pool.push({ mesh, life: 0, maxLife: 1, vx: 0, vy: 0, size: 0.1, gravity: 0, spin: 0, active: false });
    }
    this.cursor = 0;
    this.active = 0;
    /** set from the accessibility setting: fewer, quieter particles */
    this.reduced = false;
  }

  /**
   * @param {string} preset key in PRESETS
   * @param {number} x @param {number} y
   * @param {number} [count]
   * @param {{angle?:number, spread?:number, scale?:number}} [opts]
   */
  burst(preset, x, y, count = 8, opts = {}) {
    const p = PRESETS[preset] ?? PRESETS.dust;
    if (this.reduced) count = Math.max(1, Math.round(count * 0.35));
    const { angle = 0, spread = Math.PI * 2, scale = 1 } = opts;
    for (let i = 0; i < count; i++) {
      const particle = this.pool[this.cursor];
      this.cursor = (this.cursor + 1) % MAX;
      const a = angle + (Math.random() - 0.5) * spread;
      const speed = rand(p.speed[0], p.speed[1]) * scale;
      const size = rand(p.size[0], p.size[1]) * scale;
      particle.active = true;
      particle.life = 0;
      particle.maxLife = rand(p.life[0], p.life[1]);
      particle.vx = Math.cos(a) * speed;
      particle.vy = Math.sin(a) * speed + rand(p.up[0], p.up[1]) * scale;
      particle.size = size;
      particle.gravity = p.gravity;
      particle.spin = rand(-6, 6);
      particle.mesh.material = flat(p.colors[Math.floor(Math.random() * p.colors.length) % p.colors.length]);
      particle.mesh.scale.set(size, size, 0.12);
      particle.mesh.position.set(x, y, Z.particle);
      particle.mesh.rotation.z = Math.random() * Math.PI;
      particle.mesh.visible = true;
    }
    this.active = Math.min(MAX, this.active + count);
  }

  /** A ring of squares, for level-clear flourishes. */
  confettiAt(x, y, count = 40, radius = 6) {
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2;
      this.burst('confetti', x + Math.cos(a) * radius * 0.2, y + Math.sin(a) * radius * 0.2, 1, {
        angle: a, spread: 0.9, scale: 1.1,
      });
    }
  }

  update(dt) {
    let live = 0;
    for (const p of this.pool) {
      if (!p.active) continue;
      p.life += dt;
      if (p.life >= p.maxLife) {
        p.active = false;
        p.mesh.visible = false;
        continue;
      }
      live++;
      p.vy -= p.gravity * dt;
      p.vx *= 1 - 1.6 * dt;
      p.mesh.position.x += p.vx * dt;
      p.mesh.position.y += p.vy * dt;
      p.mesh.rotation.z += p.spin * dt;
      // shrink to nothing over the last part of the life
      const k = 1 - (p.life / p.maxLife) ** 1.6;
      p.mesh.scale.set(p.size * k, p.size * k, 0.12);
    }
    this.active = live;
  }

  clear() {
    for (const p of this.pool) {
      p.active = false;
      p.mesh.visible = false;
    }
    this.active = 0;
  }
}
