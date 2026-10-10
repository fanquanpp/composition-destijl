/**
 * The visual grammar of the project: flat, unlit planes with a thick black
 * frame. Everything in the world is built from one unit box, scaled, so the
 * whole scene uses a single geometry and a handful of materials.
 *
 * A "block" is two boxes: a black frame and a coloured face sitting just in
 * front of it. The frame is slightly larger in x/y and slightly thinner in z,
 * so it reads as a crisp drawn line rather than a 3D bevel — and where two
 * blocks meet, their frames merge into one black grid line, which is exactly
 * what a De Stijl canvas looks like.
 */
import * as THREE from 'three';
import { PALETTE, STYLE } from '../config.js';

/** One shared unit cube; every mesh scales it. */
export const UNIT_BOX = new THREE.BoxGeometry(1, 1, 1);

const cache = new Map();

/** Flat unlit material, cached per colour. */
export function flat(color) {
  let m = cache.get(color);
  if (!m) {
    m = new THREE.MeshBasicMaterial({ color, toneMapped: false });
    cache.set(color, m);
  }
  return m;
}

/** Named materials for the palette. */
export const MAT = {
  white:  flat(PALETTE.white),
  paper:  flat(PALETTE.paper),
  black:  flat(PALETTE.black),
  ink:    flat(PALETTE.ink),
  red:    flat(PALETTE.red),
  blue:   flat(PALETTE.blue),
  yellow: flat(PALETTE.yellow),
};

/** z-layers. Larger z is closer to the camera (which sits at +z). */
export const Z = {
  sky:      -34,
  far:      -20,
  mid:      -11,
  near:     -5,
  terrain:   0,
  entity:    0.55,
  player:    0.8,
  particle:  1.3,
};

export function box(w, h, d, material, x = 0, y = 0, z = 0) {
  const mesh = new THREE.Mesh(UNIT_BOX, material);
  mesh.scale.set(w, h, d);
  mesh.position.set(x, y, z);
  return mesh;
}

/**
 * A flat rectangle with a black frame: the fundamental unit of the whole look.
 *
 * @param {number} w width in world units
 * @param {number} h height in world units
 * @param {object} [opts]
 * @param {number} [opts.color] face colour
 * @param {number} [opts.outline] frame thickness per side (0 disables the frame)
 * @param {number} [opts.depth] z thickness
 * @param {number} [opts.z] z centre
 * @param {boolean} [opts.frameBehind] put the frame behind (default) or in front
 */
export function makeBlock(w, h, opts = {}) {
  const {
    color = PALETTE.white,
    outline = STYLE.outline,
    depth = STYLE.depth,
    z = Z.terrain,
    frameBehind = true,
  } = opts;

  const group = new THREE.Group();
  if (outline > 0) {
    const fw = w + outline * 2;
    const fh = h + outline * 2;
    const fd = depth - 0.06;
    const frame = box(fw, fh, Math.max(0.05, fd), MAT.ink, 0, 0, frameBehind ? -0.02 : 0.02);
    group.add(frame);
  }
  group.add(box(w, h, depth, flat(color), 0, 0, 0));
  return group;
}

/**
 * A rectangular painting: black frame, white mat, image plane.
 * Used for the downloaded Mondrian canvases hung in the world and in menus.
 */
export function makePainting(texture, w, h, opts = {}) {
  const { border = 0.09, mat = 0.14, z = Z.mid } = opts;
  const group = new THREE.Group();
  const outer = box(w + (border + mat) * 2, h + (border + mat) * 2, 0.14, MAT.ink, 0, 0, z);
  const inner = box(w + mat * 2, h + mat * 2, 0.18, MAT.white, 0, 0, z + 0.03);
  group.add(outer, inner);

  if (texture) {
    const geo = new THREE.PlaneGeometry(w, h);
    const material = new THREE.MeshBasicMaterial({ map: texture, toneMapped: false });
    const face = new THREE.Mesh(geo, material);
    face.position.set(0, 0, z + 0.12);
    group.add(face);
    group.userData.textureMaterial = material;
  } else {
    // no texture: fall back to a hand-laid composition so a frame is never empty
    const cols = [PALETTE.red, PALETTE.blue, PALETTE.yellow, PALETTE.white];
    for (let i = 0; i < 4; i++) {
      const bw = w * (0.24 + (i % 2) * 0.2);
      const bh = h * (0.3 + (i % 3) * 0.18);
      const px = -w / 2 + w * (0.16 + i * 0.22);
      const py = -h / 2 + h * (0.22 + (i % 2) * 0.4);
      group.add(box(bw, bh, 0.04, flat(cols[i]), px, py, z + 0.12));
    }
  }
  return group;
}

/** Frees GPU resources for a subtree, skipping shared geometry/materials. */
export function disposeTree(root) {
  root.traverse((obj) => {
    if (obj.isMesh) {
      if (obj.geometry && obj.geometry !== UNIT_BOX) obj.geometry.dispose();
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      for (const m of mats) {
        if (!m || [...cache.values()].includes(m)) continue;
        if (m.map) m.map.dispose();
        m.dispose();
      }
    }
  });
}

/** A small deterministic PRNG so decorations are stable across reloads. */
export function makeRng(seed) {
  let s = seed >>> 0 || 1;
  return function rng() {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}
