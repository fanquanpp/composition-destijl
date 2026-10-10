/**
 * Asset loading. Everything here is optional by design: if an image or a sound
 * is missing the game still runs (procedural visuals / synthesised audio take
 * over), so the project works even when assets/ has not been populated yet.
 */
import * as THREE from 'three';

/** The Mondrian canvases, downloaded from Wikimedia Commons (public domain). */
const IMAGES = {
  noIv:          'assets/textures/mondrian-composition-no-iv.jpg',
  yellowBlueRed: 'assets/textures/mondrian-composition-yellow-blue-red.jpg',
  roodGeelBlauw: 'assets/textures/mondrian-compositie-rood-geel-blauw.jpg',
  composition1929: 'assets/textures/mondrian-composition-1929.jpg',
  noIii:         'assets/textures/mondrian-composition-no-iii.jpg',
};

/** CC0 sound effects, downloaded from OpenGameArt. */
const SOUNDS = {
  jump:        'assets/audio/jump.wav',
  doubleJump:  'assets/audio/double-jump.wav',
  land:        'assets/audio/land.wav',
  dash:        'assets/audio/dash.wav',
  coin:        'assets/audio/coin.wav',
  stomp:       'assets/audio/stomp.wav',
  enemyPop:    'assets/audio/enemy-pop.wav',
  checkpoint:  'assets/audio/checkpoint.wav',
  hurt:        'assets/audio/hurt.wav',
  death:       'assets/audio/death.wav',
  levelClear:  'assets/audio/level-clear.wav',
  victory:     'assets/audio/victory.wav',
  uiSelect:    'assets/audio/ui-select.wav',
  uiMove:      'assets/audio/ui-move.wav',
  // grapple + impact sounds, from two more CC0 packs (see assets/CREDITS.md)
  grappleFire:    'assets/audio/grapple-fire.wav',
  grappleRelease: 'assets/audio/grapple-release.wav',
  grappleHit:     'assets/audio/grapple-hit.ogg',
  crumble:        'assets/audio/crumble.ogg',
  landHeavy:      'assets/audio/land-heavy.ogg',
};

export class AssetLibrary {
  constructor() {
    this.textures = new Map();
    this.samples = new Map();
    /** names that failed to load, surfaced in the console for debugging */
    this.missing = [];
  }

  getTexture(name) { return this.textures.get(name) ?? null; }

  /**
   * @param {object} opts
   * @param {(done:number,total:number,label:string)=>void} [opts.onProgress]
   * @param {AudioContext} [opts.audioContext] used to decode sound effects
   */
  async loadAll({ onProgress = () => {}, audioContext = null } = {}) {
    const tasks = [];
    for (const [name, url] of Object.entries(IMAGES)) {
      tasks.push({ name, kind: 'image', run: () => this._loadTexture(name, url) });
    }
    if (audioContext) {
      for (const [name, url] of Object.entries(SOUNDS)) {
        tasks.push({ name, kind: 'sound', run: () => this._loadSample(name, url, audioContext) });
      }
    }

    let done = 0;
    onProgress(0, tasks.length, 'starting');
    // small batches: browsers cap concurrent connections per host
    const BATCH = 6;
    for (let i = 0; i < tasks.length; i += BATCH) {
      const batch = tasks.slice(i, i + BATCH);
      await Promise.all(batch.map(async (t) => {
        try {
          await t.run();
        } catch (err) {
          this.missing.push(t.name);
          console.warn(`[assets] ${t.kind} "${t.name}" unavailable (${err.message}) — falling back`);
        } finally {
          done++;
          onProgress(done, tasks.length, t.name);
        }
      }));
    }
    return this;
  }

  _loadTexture(name, url) {
    return new Promise((resolve, reject) => {
      const loader = new THREE.TextureLoader();
      loader.load(
        url,
        (tex) => {
          tex.colorSpace = THREE.SRGBColorSpace;
          tex.anisotropy = 4;
          tex.wrapS = THREE.ClampToEdgeWrapping;
          tex.wrapT = THREE.ClampToEdgeWrapping;
          this.textures.set(name, tex);
          resolve(tex);
        },
        undefined,
        () => reject(new Error(`could not load ${url}`)),
      );
    });
  }

  async _loadSample(name, url, ctx) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const raw = await res.arrayBuffer();
    if (raw.byteLength < 64) throw new Error('empty audio');
    const buffer = await ctx.decodeAudioData(raw);
    this.samples.set(name, buffer);
    return buffer;
  }
}
