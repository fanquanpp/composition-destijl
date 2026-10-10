/**
 * COMPOSITION — a De Stijl platformer.
 *
 * Entry point. Owns the renderer, the fixed-step loop and the state machine.
 *
 * The loop is a classic accumulator: simulation advances in fixed 1/120 s steps
 * so physics feel is identical on every machine, while rendering, particles and
 * the camera run once per frame at whatever rate the display offers.
 *
 * States: boot → menu ⇄ levels/howto/credits/settings, menu → intro → playing
 * ⇄ paused, playing → clear → (next level | victory), playing → gameover.
 */
import * as THREE from 'three';
import { PALETTE, SIM, PLAYER, SCORE, LEVEL_ORDER } from './config.js';
import { Input } from './core/input.js';
import { AudioEngine } from './core/audio.js';
import { AssetLibrary } from './core/assets.js';
import { Particles } from './game/particles.js';
import { GameCamera } from './game/camera.js';
import { Player } from './game/player.js';
import { Level } from './game/level.js';
import { Hud, formatTime } from './game/hud.js';
import { Screens } from './game/screens.js';
import { Save } from './game/save.js';
import { LEVELS, getLevel, levelIndex } from './game/levels.js';
import { t, tSource, setLocale, resolveLocale, onLocaleChange, LOCALES, localeName } from './core/i18n.js';

const STATE = {
  BOOT: 'boot',
  MENU: 'menu',
  INTRO: 'intro',
  PLAYING: 'playing',
  PAUSED: 'paused',
  CLEAR: 'clear',
  GAMEOVER: 'gameover',
  VICTORY: 'victory',
};

const INTRO_SECONDS = 1.5;
const LIVES = 3;

/** Per-run counters for the level currently loaded. */
class Session {
  constructor() {
    this.resetRun();
  }

  resetRun() {
    this.score = 0;
    this.lives = LIVES;
    this.totalCoins = 0;
    this.totalDeaths = 0;
    this.startLevelStats();
  }

  /** Resets the per-attempt counters (everything that is not carried across levels). */
  startLevelStats() {
    this.coins = 0;
    this.hearts = PLAYER.maxHearts;
    this.time = 0;
    this.deaths = 0;
    this.checkpointIndex = -1;
  }

  addScore(n) { this.score += n; }

  /** @returns {number} hearts remaining */
  loseHeart() {
    this.hearts = Math.max(0, this.hearts - 1);
    return this.hearts;
  }

  onDeath() {
    this.deaths++;
    this.totalDeaths++;
    this.lives--;
  }

  respawn() {
    this.hearts = PLAYER.maxHearts;
  }

  setCheckpoint(index) {
    this.checkpointIndex = Math.max(this.checkpointIndex, index);
  }
}

class Game {
  constructor() {
    this.canvas = document.getElementById('scene');
    this.bootEl = document.getElementById('boot');
    this.bootFill = document.getElementById('boot-fill');
    this.bootStatus = document.getElementById('boot-status');

    this.state = STATE.BOOT;
    this.session = new Session();
    this.save = new Save();
    this.accumulator = 0;
    this.lastTime = 0;
    this.introTimer = 0;
    this.raf = 0;

    this._initRenderer();
    this._initSystems();
    this._bindGlobalEvents();
  }

  // ---- setup ---------------------------------------------------------------

  _initRenderer() {
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      powerPreference: 'high-performance',
      stencil: false,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.setClearColor(PALETTE.paper, 1);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(PALETTE.paper);

    this.camera = new GameCamera(window.innerWidth / Math.max(1, window.innerHeight));
    this._resize();
  }

  _initSystems() {
    this.input = new Input(window);
    this.audio = new AudioEngine();
    this.assets = new AssetLibrary();
    this.particles = new Particles(this.scene);
    this.player = new Player();
    this.scene.add(this.player.mesh);
    // the rope is drawn in world space, so it is not parented to the player
    this.scene.add(this.player.grapple.mesh);
    this.hud = new Hud(document.getElementById('hud'));
    this.screens = new Screens(document.getElementById('screens'), (action, data) => this.onAction(action, data));

    /** shared context handed to every entity update */
    this.ctx = {
      input: this.input,
      audio: this.audio,
      particles: this.particles,
      camera: this.camera,
      hud: this.hud,
      session: this.session,
      player: this.player,
      level: null,
      time: 0,
      onGoal: () => this.onGoalReached(),
    };

    this.level = null;
    this.currentLevelId = LEVEL_ORDER[0];
  }

  _bindGlobalEvents() {
    window.addEventListener('resize', () => this._resize());
    window.addEventListener('blur', () => { if (this.state === STATE.PLAYING) this.pause(); });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.state === STATE.PLAYING) this.pause();
    });
    // audio can only start after a gesture
    const unlock = () => {
      this.audio.resume();
      if (this.audio.playing) this.audio.startMusic(this.audio.themeName);
    };
    window.addEventListener('pointerdown', unlock, { once: false });
    window.addEventListener('keydown', unlock, { once: false });
  }

  _resize() {
    const w = window.innerWidth;
    const h = Math.max(1, window.innerHeight);
    this.renderer.setSize(w, h, false);
    this.camera.resize(w / h);
  }

  // ---- boot ----------------------------------------------------------------

  /** Text that lives in index.html rather than in a template. */
  _applyStaticText() {
    document.title = t('doc.title');
    document.querySelector('meta[name="description"]')?.setAttribute('content', t('doc.description'));
    const sub = document.querySelector('.boot-sub');
    if (sub) sub.textContent = t('boot.subtitle');
  }

  /** Re-renders whichever screen is up, so a language change is instant. */
  _refreshScreen() {
    const name = this.screens.name;
    if (!name) return;
    if (name === 'title') this.showTitle();
    else if (name === 'levels') this.showLevels();
    else if (name === 'settings') this.showSettings();
    else if (name === 'howto') this.showHowTo();
    else if (name === 'credits') this.showCredits();
    else if (name === 'intro') this._showIntro();
    else if (name === 'pause') this._showPause();
    else if (name === 'levelclear' && this._lastClear) this.screens.show('levelclear', this._lastClear);
    else if (name === 'gameover') this._showGameOver();
    else if (name === 'victory') this.showVictory();
  }

  /** Pushes the persisted settings into the systems that read them. */
  _applySettings() {
    const s = this.save.settings;
    this.audio.setMusicVolume(s.music);
    this.audio.setSfxVolume(s.sfx);
    this.audio.setMuted(s.muted);
    this.camera.reducedMotion = !!s.reducedMotion;
    this.particles.reduced = !!s.reducedMotion;
  }

  async boot() {
    this.audio.init();
    this._applySettings();

    // the language has to be settled before anything renders text
    setLocale(this.save.settings.locale);
    this._applyStaticText();
    onLocaleChange(() => {
      this._applyStaticText();
      this.hud.refreshLabels();
      this._refreshScreen();
    });

    await this.assets.loadAll({
      audioContext: this.audio.ctx,
      onProgress: (done, total, label) => {
        const pct = total ? Math.round((done / total) * 100) : 0;
        this.bootFill.style.width = `${pct}%`;
        this.bootStatus.textContent = done >= total ? t('boot.ready') : t('boot.loading', { label });
      },
    });
    this.audio.setSamples(this.assets.samples);

    // build the first level so the title screen has the real world behind it
    this.loadLevel(LEVEL_ORDER[0]);
    this.camera.snapTo(this.player.centerX, this.player.centerY, this.level);

    this.bootEl.classList.add('is-hidden');
    setTimeout(() => this.bootEl.classList.add('is-gone'), 400);

    this.showTitle();
    this.lastTime = performance.now();
    this.raf = requestAnimationFrame((t) => this.loop(t));
  }

  // ---- level lifecycle -----------------------------------------------------

  loadLevel(id) {
    if (this.level) this.level.dispose();
    const def = getLevel(id);
    this.level = new Level(this.scene, def, this.assets);
    this.ctx.level = this.level;
    this.currentLevelId = id;

    const spawn = this.level.spawnPoint();
    this.player.reset(spawn.x, spawn.y);
    this.particles.clear();
    this.accumulator = 0;
  }

  /** Respawn at the last checkpoint (or the spawn) after losing a life. */
  respawnPlayer() {
    const point = this.session.checkpointIndex >= 0
      ? this.level.checkpointPoint(this.session.checkpointIndex)
      : this.level.spawnPoint();
    this.player.reset(point.x, point.y);
    this.session.respawn();
    this.camera.snapTo(this.player.centerX, this.player.centerY, this.level);
  }

  startLevel(id, { freshRun = false } = {}) {
    if (freshRun) this.session.resetRun();
    else if (!this.session.lives) this.session.lives = LIVES;
    this.session.startLevelStats();

    this.loadLevel(id);
    this.hud.show();
    this.hud.setLevel(this.level.numeral, tSource(this.level.name));
    this.hud.setCoins(0, this.level.coins.length);
    this.hud.setScore(this.session.score);
    this.hud.setLives(this.session.lives);
    this.hud.setHearts(this.session.hearts, PLAYER.maxHearts);
    this.hud.setTimer(0);

    this.state = STATE.INTRO;
    this.introTimer = INTRO_SECONDS;
    this.input.flush();
    this._showIntro();
    this.audio.startMusic(this.level.theme ?? 'level1');
  }

  _showIntro() {
    this.screens.show('intro', {
      numeral: this.level.numeral,
      name: tSource(this.level.name),
      subtitle: tSource(this.level.subtitle),
      coins: this.level.coins.length,
      band: levelIndex(this.currentLevelId),
    });
  }

  beginPlay() {
    this.state = STATE.PLAYING;
    this.screens.hide();
    this.input.flush();
    this.hud.scheduleHintFade();
    this.audio.startMusic(this.level.theme ?? 'level1');
  }

  restartLevel() {
    this.startLevel(this.currentLevelId);
  }

  // ---- state transitions ---------------------------------------------------

  showTitle() {
    this.state = STATE.MENU;
    this.screens.show('title', {
      hasSave: this.save.data.unlocked.length > 1 || Object.keys(this.save.data.cleared).length > 0,
      totalScore: this.save.totalScore(),
    });
    this.hud.hide();
    this.audio.startMusic('title');
  }

  showLevels() {
    this.state = STATE.MENU;
    this.screens.show('levels', {
      levels: LEVELS.map((l) => ({
        id: l.id,
        numeral: l.numeral,
        name: tSource(l.name),
        unlocked: this.save.isUnlocked(l.id),
        cleared: this.save.isCleared(l.id),
        best: this.save.best(l.id),
        bestTime: this.save.best(l.id)?.time ? formatTime(this.save.best(l.id).time) : null,
        medal: this.save.bestMedal(l),
        targetTime: l.targetTime,
        coinTotal: (l.coins ?? []).length,
      })),
    });
  }

  showSettings() {
    this.state = STATE.MENU;
    const s = this.save.settings;
    this.screens.show('settings', {
      music: s.music, sfx: s.sfx, muted: s.muted, reducedMotion: s.reducedMotion,
      localeSetting: s.locale ?? 'auto', localeResolved: this._resolvedLocale(),
    });
  }

  _resolvedLocale() {
    return resolveLocale(this.save.settings.locale ?? 'auto');
  }

  showCredits() {
    this.state = STATE.MENU;
    this.screens.show('credits', { missing: this.assets.missing });
  }

  showHowTo() {
    this.state = STATE.MENU;
    this.screens.show('howto', {});
  }

  pause() {
    if (this.state !== STATE.PLAYING) return;
    this.state = STATE.PAUSED;
    this.input.flush();
    this._showPause();
  }

  _showPause() {
    this.screens.show('pause', {
      numeral: this.level.numeral,
      name: tSource(this.level.name),
      time: formatTime(this.session.time),
      score: this.session.score,
      coins: this.session.coins,
      coinTotal: this.level.coins.length,
    });
  }

  resume() {
    this.state = STATE.PLAYING;
    this.screens.hide();
    this.input.flush();
  }

  /** The next playable level: the first unlocked one that is not yet cleared. */
  nextUncleared() {
    for (const id of LEVEL_ORDER) {
      if (this.save.isUnlocked(id) && !this.save.isCleared(id)) return id;
    }
    return LEVEL_ORDER[LEVEL_ORDER.length - 1];
  }

  onGoalReached() {
    if (this.state !== STATE.PLAYING) return;
    this.state = STATE.CLEAR;
    const session = this.session;
    const level = this.level;

    const timeBonus = Math.max(0, Math.round(level.targetTime - session.time)) * SCORE.timeBonusPerSecond;
    const flawless = session.deaths === 0 ? SCORE.flawless : 0;
    session.addScore(timeBonus + SCORE.levelClear + flawless);

    const index = levelIndex(level.id);
    const isLast = index === LEVELS.length - 1;
    const improved = this.save.recordClear(level.id, {
      score: session.score,
      time: session.time,
      coins: session.coins,
      deaths: session.deaths,
    });
    const medal = this.save.medalFor(level, session.time);

    this.audio.play('levelClear', { volume: 0.8 });
    this.particles.confettiAt(this.player.centerX, this.player.centerY + 1.5, 40, 7);
    this.camera.addShake(0.2);

    this._lastClear = {
      numeral: level.numeral,
      name: tSource(level.name),
      improved,
      isLast,
      medal,
      total: session.score,
      rows: [
        [t('clear.row.coins'), `${session.coins} / ${level.coins.length}`],
        [t('clear.row.time'), formatTime(session.time)],
        [t('clear.row.target'), `${level.targetTime}s`],
        [t('clear.row.medal'), medal ? t(`levels.medal.${medal}`) : '—'],
        [t('clear.row.timeBonus'), `+${timeBonus}`],
        [t('clear.row.clear'), `+${SCORE.levelClear}`],
        [t('clear.row.flawless'), flawless ? `+${flawless}` : '—'],
      ],
    };
    this.screens.show('levelclear', this._lastClear);
  }

  showGameOver() {
    this.state = STATE.GAMEOVER;
    this.audio.stopMusic();
    this.audio.play('death', { volume: 0.8 });
    this._showGameOver();
  }

  _showGameOver() {
    this.screens.show('gameover', {
      numeral: this.level.numeral,
      name: tSource(this.level.name),
      score: this.session.score,
      coins: this.session.coins,
      coinTotal: this.level.coins.length,
    });
  }

  showVictory() {
    this.state = STATE.VICTORY;
    this.audio.startMusic('victory');
    const best = LEVELS.map((l) => this.save.best(l.id)).filter(Boolean);
    const totalCoins = best.reduce((n, b) => n + (b.coins ?? 0), 0);
    const coinTotal = LEVELS.reduce((n, l) => n + (l.coins ?? []).length, 0);
    this.screens.show('victory', {
      rows: LEVELS.map((l) => {
        const b = this.save.best(l.id);
        return [`${l.numeral}. ${tSource(l.name)}`, b ? b.score.toLocaleString('en-US') : '—'];
      }),
      total: this.save.totalScore(),
      coins: totalCoins,
      coinTotal,
      deaths: this.session.totalDeaths,
    });
  }

  // ---- actions from menus --------------------------------------------------

  onAction(action, data = {}) {
    switch (action) {
      case 'play':
        this.audio.play('uiSelect', { volume: 0.5 });
        this.startLevel(this.nextUncleared(), { freshRun: true });
        break;
      case 'levels':
        this.audio.play('uiSelect', { volume: 0.5 });
        this.showLevels();
        break;
      case 'select':
        this.audio.play('uiSelect', { volume: 0.5 });
        this.startLevel(data.payload ?? data.index, { freshRun: true });
        break;
      case 'locked':
        this.audio.play('uiMove', { volume: 0.5 });
        this.hud.toast(t('toast.locked'));
        break;
      case 'howto': this.showHowTo(); break;
      case 'credits': this.showCredits(); break;
      case 'settings': this.showSettings(); break;
      case 'start':
        this.audio.play('uiSelect', { volume: 0.5 });
        this.beginPlay();
        break;
      case 'resume': this.resume(); break;
      case 'restart':
        this.audio.play('uiSelect', { volume: 0.5 });
        this.session.lives = LIVES;
        this.restartLevel();
        break;
      case 'replay':
        this.audio.play('uiSelect', { volume: 0.5 });
        this.session.lives = LIVES;
        this.restartLevel();
        break;
      case 'next': {
        this.audio.play('uiSelect', { volume: 0.5 });
        const index = levelIndex(this.currentLevelId);
        const next = LEVEL_ORDER[index + 1] ?? LEVEL_ORDER[0];
        this.startLevel(next);
        break;
      }
      case 'finish':
        this.audio.play('victory', { volume: 0.8 });
        this.showVictory();
        break;
      case 'title':
        this.audio.play('uiSelect', { volume: 0.5 });
        this.showTitle();
        break;
      case 'back':
        this.audio.play('uiMove', { volume: 0.5 });
        if (this.state === STATE.PAUSED) this.resume();
        else this.showTitle();
        break;
      case 'toggleMute': {
        const muted = !this.save.settings.muted;
        this.save.updateSettings({ muted });
        this.audio.setMuted(muted);
        this.showSettings();
        break;
      }
      case 'toggleMotion': {
        const reducedMotion = !this.save.settings.reducedMotion;
        this.save.updateSettings({ reducedMotion });
        this._applySettings();
        this.hud.toast(reducedMotion ? t('toast.motionReduced') : t('toast.motionFull'));
        this.showSettings();
        break;
      }
      case 'cycleLanguage': {
        const order = LOCALES.map((l) => l.code);
        const at = order.indexOf(this.save.settings.locale ?? 'auto');
        const next = order[(at + 1) % order.length];
        this.save.updateSettings({ locale: next });
        setLocale(next);
        const label = LOCALES.find((l) => l.code === next)?.label ?? 'Auto';
        this.hud.toast(t('toast.language', { name: label === 'Auto' ? localeName(this._resolvedLocale()) : label }));
        this.showSettings();
        break;
      }
      case 'clearProgress':
        this.save.clearProgress();
        this.hud.toast(t('toast.progressCleared'));
        this.showSettings();
        break;
      case 'setting': {
        const partial = { [data.key]: data.value };
        this.save.updateSettings(partial);
        if (data.key === 'music') this.audio.setMusicVolume(data.value);
        if (data.key === 'sfx') this.audio.setSfxVolume(data.value);
        // update the readout next to the slider without rebuilding the screen
        const out = this.screens.root.querySelector(`input[data-setting="${data.key}"]`)?.nextElementSibling;
        if (out) out.textContent = `${Math.round(data.value * 100)}%`;
        break;
      }
      default: break;
    }
  }

  /** Escape/back handling differs per state. */
  handleBack() {
    switch (this.state) {
      case STATE.PAUSED: this.resume(); break;
      case STATE.PLAYING: this.pause(); break;
      case STATE.INTRO: this.beginPlay(); break;
      case STATE.MENU:
        if (this.screens.name !== 'title') this.showTitle();
        break;
      default: break;
    }
  }

  // ---- the loop ------------------------------------------------------------

  loop(now) {
    this.raf = requestAnimationFrame((t) => this.loop(t));
    const frame = Math.min((now - this.lastTime) / 1000, SIM.maxFrameTime);
    this.lastTime = now;
    this.ctx.time += frame;

    this._handleMenuInput();

    if (this.state === STATE.PLAYING) {
      this.accumulator += frame;
      let steps = 0;
      while (this.accumulator >= SIM.fixedStep && steps < SIM.maxStepsPerFrame) {
        this.session.time += SIM.fixedStep;
        this.level.update(SIM.fixedStep, this.ctx);
        this._checkDeath();
        this.accumulator -= SIM.fixedStep;
        steps++;
        if (this.state !== STATE.PLAYING) break; // a transition happened mid-frame
      }
      if (steps >= SIM.maxStepsPerFrame) this.accumulator = 0;
    } else if (this.state === STATE.INTRO) {
      this.introTimer -= frame;
      if (this.introTimer <= 0) this.beginPlay();
    }

    // per-frame, not per-step: these are presentation only
    this.particles.update(frame);
    this.camera.update(frame, this.player, this.level);
    if (this.level) this.level.updateVisuals(frame, this.ctx);
    this._updateHud();

    this.renderer.render(this.scene, this.camera.camera);
  }

  _handleMenuInput() {
    const input = this.input;

    if (input.takePress('mute')) {
      const muted = !this.save.settings.muted;
      this.save.updateSettings({ muted });
      this.audio.setMuted(muted);
      if (this.screens.name === 'settings') this.showSettings();
      this.hud.toast(muted ? t('toast.soundOff') : t('toast.soundOn'));
    }

    if (this.state === STATE.PLAYING) {
      if (input.takePress('pause')) { this.pause(); return; }
      if (input.takePress('restart')) { this.restartLevel(); return; }
      return;
    }

    if (input.takePress('pause') || input.takePress('menuBack')) {
      this.handleBack();
      return;
    }

    if (this.screens.isActive) {
      if (input.takePress('menuUp')) this.screens.moveFocus(-1);
      if (input.takePress('menuDown')) this.screens.moveFocus(1);
      if (input.takePress('menuConfirm')) this.screens.activate();
    } else if (this.state === STATE.INTRO) {
      if (input.takePress('menuConfirm')) this.beginPlay();
    }
  }

  _checkDeath() {
    if (this.player.alive || this.player.deadTimer > 0) return;
    if (this.session.lives <= 0) {
      this.showGameOver();
      return;
    }
    this.respawnPlayer();
    this.hud.setLives(this.session.lives);
    this.hud.setHearts(this.session.hearts, PLAYER.maxHearts);
  }

  _updateHud() {
    if (this.state === STATE.BOOT || this.state === STATE.MENU || this.state === STATE.VICTORY) return;
    this.hud.setScore(this.session.score);
    this.hud.setCoins(this.session.coins, this.level.coins.length);
    this.hud.setHearts(this.session.hearts, PLAYER.maxHearts);
    this.hud.setLives(this.session.lives);
    this.hud.setTimer(this.session.time);
  }
}

// ---------------------------------------------------------------------------

const game = new Game();
game.boot().catch((err) => {
  console.error(err);
  const status = document.getElementById('boot-status');
  if (status) status.textContent = t('boot.failed', { msg: err.message });
});

// exposed for debugging from the console
window.__composition = game;
