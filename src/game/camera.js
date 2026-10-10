/**
 * Orthographic follow camera. The whole game is flat planes seen head-on, so an
 * orthographic projection is both the honest choice for the style and the right
 * one for platforming: a jump arc on screen is exactly the jump arc in the
 * simulation, with no perspective to misjudge.
 *
 * Depth comes from the parallax layers in render/background.js instead.
 */
import * as THREE from 'three';
import { CAMERA } from '../config.js';

export class GameCamera {
  constructor(aspect = 16 / 9) {
    this.camera = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.1, 400);
    this.camera.position.set(0, 0, 60);
    this.baseViewHeight = CAMERA.viewHeight;
    this.viewHeight = CAMERA.viewHeight;
    this.target = new THREE.Vector2(0, 0);
    this.lookahead = new THREE.Vector2(0, 0);
    this.shake = 0;
    this.shakeSeed = Math.random() * 1000;
    this.zoom = 1;
    /** set from the accessibility setting: kills shake and the speed zoom */
    this.reducedMotion = false;
    this.resize(aspect);
  }

  resize(aspect) {
    this.aspect = aspect;
    const halfH = this.viewHeight / 2;
    const halfW = halfH * aspect;
    this.halfW = halfW;
    this.halfH = halfH;
    this.camera.left = -halfW;
    this.camera.right = halfW;
    this.camera.top = halfH;
    this.camera.bottom = -halfH;
    this.camera.updateProjectionMatrix();
  }

  /**
   * Normalised device coords (-1..1, y up) to a world position on the gameplay
   * plane. Used to turn the mouse cursor into a grapple aim direction.
   */
  screenToWorld(nx, ny) {
    return {
      x: this.camera.position.x + nx * this.halfW,
      y: this.camera.position.y + ny * this.halfH,
    };
  }

  /** Snap instantly, used when a level loads or the player respawns. */
  snapTo(x, y, level) {
    this.lookahead.set(0, 0);
    this.target.set(x, y);
    this._apply(level, 1);
  }

  addShake(amount) {
    if (this.reducedMotion) return;
    this.shake = Math.min(1.2, this.shake + amount);
  }

  /** Applies a zoom factor by rebuilding the orthographic frustum. */
  setZoom(k) {
    const vh = this.baseViewHeight * k;
    if (Math.abs(vh - this.viewHeight) < 0.002) return;
    this.viewHeight = vh;
    this.resize(this.aspect);
  }

  /**
   * @param {{x:number,y:number,vx:number,vy:number}} focus player-like target
   */
  update(dt, focus, level) {
    const wantX = focus.x + THREE.MathUtils.clamp(focus.vx * CAMERA.lookaheadX, -CAMERA.maxLookaheadX, CAMERA.maxLookaheadX);
    const wantY = focus.y + THREE.MathUtils.clamp(focus.vy * CAMERA.lookaheadY, -CAMERA.maxLookaheadY, CAMERA.maxLookaheadY);
    const k = 1 - Math.exp(-CAMERA.smoothing * dt);
    this.target.x += (wantX - this.target.x) * k;
    this.target.y += (wantY - this.target.y) * k;
    this.shake = Math.max(0, this.shake - CAMERA.shakeDecay * dt);

    // speed widens the view a little: it makes velocity legible and buys a
    // moment of reaction time during a dash or a swing
    if (this.reducedMotion) {
      this.setZoom(1);
    } else {
      const speed = Math.hypot(focus.vx, focus.vy);
      const want = CAMERA.zoomAtRest
        + (CAMERA.zoomAtSpeed - CAMERA.zoomAtRest) * Math.min(1, speed / CAMERA.zoomSpeed);
      this.zoom += (want - this.zoom) * (1 - Math.exp(-CAMERA.zoomSmoothing * dt));
      this.setZoom(this.zoom);
    }

    this._apply(level, dt);
  }

  _apply(level, dt) {
    let x = this.target.x;
    let y = this.target.y;

    if (level) {
      const pad = CAMERA.boundsPadding;
      const w = level.width;
      const h = level.height;
      if (w > this.halfW * 2) {
        x = THREE.MathUtils.clamp(x, this.halfW - pad, w - this.halfW + pad);
      } else {
        x = w / 2;
      }
      if (h > this.halfH * 2) {
        y = THREE.MathUtils.clamp(y, this.halfH - pad, h - this.halfH + pad);
      } else {
        y = Math.max(h / 2, this.halfH - pad);
      }
    }

    if (this.shake > 0.001) {
      const s = this.shake * this.shake * 0.55;
      const t = performance.now() * 0.001 + this.shakeSeed;
      x += Math.sin(t * 47.3) * s;
      y += Math.cos(t * 39.1) * s;
    }

    this.camera.position.set(x, y, 60);
  }
}
