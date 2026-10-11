/**
 * The backdrop: four flat planes of rectangles at different depths, moved at
 * different rates as the camera pans. With an orthographic camera there is no
 * perspective, so parallax has to be faked — each layer is offset by
 * `camera * (1 - closeness)`, where closeness 0 is infinitely far (pinned to the
 * screen) and 1 moves with the world.
 *
 * Each layer is a generated Mondrian composition: white ground, a few primary
 * rectangles, thick black lines. It is deterministic per level seed.
 */
import * as THREE from 'three';
import { PALETTE } from '../config.js';
import { makeBlock, makePainting, makeRng, disposeTree, MAT, Z, box, flat } from './style.js';

/**
 * The backdrop is a *faded print* of the palette: every colour is mixed most of
 * the way toward the paper ground, so the composition reads as a distant canvas
 * while the terrain keeps the full-strength primaries and pure black frames.
 * Without this the background rectangles look like solid walls the player ought
 * to be able to stand on.
 *
 * The fade is not the same on every plane. It deepens with distance — the far
 * band is washed almost to paper, the near band keeps enough body to read as its
 * own surface. That aerial perspective is the one depth cue that survives a
 * still frame; motion parallax vanishes the instant the camera stops, so without
 * it the three planes collapse into a single flat mosaic.
 */
const PAPER = new THREE.Color(PALETTE.paper);
const fade = (hex, amount) => new THREE.Color(hex).lerp(PAPER, Math.min(1, amount)).getHex();

/** Fade at the mid plane; LAYER_HAZE below scales it per plane. */
const BASE_FADE = { white: 0.55, red: 0.72, yellow: 0.70, blue: 0.72, black: 0.74 };
/** Further back fades more, nearer keeps more. This is the aerial perspective. */
const LAYER_HAZE = { far: 1.16, mid: 1.0, near: 0.76 };

/** The faded palette for one depth plane. */
function paletteFor(haze) {
  const p = {};
  for (const [key, amount] of Object.entries(BASE_FADE)) p[key] = fade(PALETTE[key], amount * haze);
  return p;
}

/** Vertical size of a backdrop band, in world units — kept near the view height
 *  so shapes read as composition rather than architecture, whatever the level. */
const BAND_H = 13;

/**
 * Layer definitions. `closeness` is how much the plane slides on screen: 0 is
 * pinned to the screen (infinitely far), 1 moves with the world. The spread
 * between the three planes is what the parallax reads as depth, so they are kept
 * well apart.
 */
const LAYERS = [
  { name: 'far',  z: Z.far,  closeness: 0.10, colorChance: 0.26, scale: 1.9, outline: 0.10, depth: 0.24, bars: 3 },
  { name: 'mid',  z: Z.mid,  closeness: 0.30, colorChance: 0.34, scale: 1.35, outline: 0.12, depth: 0.3, bars: 4 },
  { name: 'near', z: Z.near, closeness: 0.62, colorChance: 0.40, scale: 0.95, outline: 0.14, depth: 0.36, bars: 2 },
].map((layer) => {
  const p = paletteFor(LAYER_HAZE[layer.name]);
  return {
    ...layer,
    // flat() caches per colour, so these stay shared and survive disposeTree
    accents: [p.red, p.yellow, p.blue],
    white: p.white,
    line: flat(p.black),
  };
});

function pick(rng, arr) { return arr[Math.floor(rng() * arr.length) % arr.length]; }

/** Lays out one band of rectangles across `span` world units. */
function composeBand(rng, span, layer) {
  const group = new THREE.Group();
  const unit = 4.2 * layer.scale;
  let x = -span / 2;
  let guard = 0;
  while (x < span / 2 && guard++ < 400) {
    const w = unit * (0.7 + rng() * 1.5);
    const h = BAND_H * (0.22 + rng() * 0.5);
    const y = (rng() * 2 - 1) * BAND_H * 0.55;
    const isColor = rng() < layer.colorChance;
    const block = makeBlock(w, h, {
      color: isColor ? pick(rng, layer.accents) : layer.white,
      outline: layer.outline,
      depth: layer.depth,
      z: 0,
    });
    block.position.set(x + w / 2, y, 0);
    group.add(block);
    x += w + 0.5 + rng() * 1.8;
  }

  // long bars running through the band — the grid made explicit
  for (let i = 0; i < layer.bars; i++) {
    const vertical = rng() < 0.55;
    const bx = (rng() * 2 - 1) * span * 0.42;
    const by = (rng() * 2 - 1) * BAND_H * 0.6;
    const bw = vertical ? 0.22 : span * (0.35 + rng() * 0.5);
    const bh = vertical ? BAND_H * (0.4 + rng() * 0.7) : 0.22;
    group.add(box(bw, bh, layer.depth * 1.1, layer.line, bx, by, 0.02));
  }
  return group;
}

export class Backdrop {
  /**
   * @param {THREE.Scene} scene
   * @param {object} opts
   * @param {number} opts.seed
   * @param {number} opts.levelWidth in world units
   * @param {number} opts.levelHeight
   * @param {Array<{texture:THREE.Texture|null,x:number,y:number,w:number,h:number}>} [opts.paintings]
   */
  constructor(scene, { seed = 1, levelWidth = 100, levelHeight = 30, paintings = [] } = {}) {
    this.scene = scene;
    this.root = new THREE.Group();
    this.root.name = 'backdrop';
    scene.add(this.root);

    const rng = makeRng(seed * 7919 + 13);
    const span = levelWidth + 130;
    this.centerX = levelWidth / 2;
    this.centerY = Math.max(levelHeight / 2, 8);

    // sky: one enormous paper plane, pinned to the screen
    this.sky = new THREE.Group();
    const skyW = span + 400;
    const skyH = 260;
    this.sky.add(box(skyW, skyH, 0.2, MAT.paper, 0, 0, 0));
    this.sky.position.set(this.centerX, this.centerY, Z.sky);
    this.root.add(this.sky);

    this.layers = LAYERS.map((def) => {
      const band = composeBand(rng, span, def);
      const holder = new THREE.Group();
      holder.add(band);
      holder.position.set(this.centerX, this.centerY, def.z);
      holder.userData.closeness = def.closeness;
      this.root.add(holder);
      return holder;
    });

    // downloaded Mondrian canvases, hung on their own plane between the mid and
    // near bands. They are the most detailed things in the backdrop, so giving
    // them a parallax rate of their own makes them the legible anchor of that
    // distance: they slide against the band behind them as the camera moves
    if (paintings.length) {
      const gallery = new THREE.Group();
      gallery.position.set(this.centerX, this.centerY, Z.mid + 1.2);
      gallery.userData.closeness = 0.46;
      for (const p of paintings) {
        const frame = makePainting(p.texture, p.w ?? 5.2, p.h ?? 5.2, { z: 0 });
        frame.position.set(p.x - this.centerX, p.y - this.centerY, 0);
        gallery.add(frame);
      }
      this.root.add(gallery);
      this.layers.push(gallery);
    }
  }

  /** @param {number} camX @param {number} camY */
  update(camX, camY) {
    for (const layer of this.layers) {
      const f = layer.userData.closeness;
      layer.position.x = this.centerX + (camX - this.centerX) * (1 - f);
      // vertical parallax is halved: it reads as depth without feeling queasy
      layer.position.y = this.centerY + (camY - this.centerY) * (1 - f * 0.5);
    }
  }

  dispose() {
    this.scene.remove(this.root);
    // frees the per-painting plane geometries and texture materials; the shared
    // unit box and cached flat materials are left alone by disposeTree
    disposeTree(this.root);
  }
}
