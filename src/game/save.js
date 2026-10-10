/**
 * Persistence: progress and settings in localStorage.
 *
 * Progress is deliberately additive — a level is unlocked once the previous one
 * is cleared, and best score / best time are kept per level so the level select
 * has something to show. Corrupt or older saves are discarded rather than
 * migrated, because there is nothing here worth rescuing.
 */
import { STORAGE_KEY, AUDIO, MEDALS, LEVEL_ORDER } from '../config.js';

/** Respect the OS setting on first run; after that the player's choice wins. */
const prefersReducedMotion = () =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

const DEFAULTS = () => ({
  version: 1,
  unlocked: [LEVEL_ORDER[0]],
  cleared: {},
  best: {},
  settings: {
    music: AUDIO.defaultMusic,
    sfx: AUDIO.defaultSfx,
    muted: false,
    reducedMotion: prefersReducedMotion(),
    // 'auto' follows the browser's language; 'en' / 'zh' pin it
    locale: 'auto',
  },
});

export class Save {
  constructor(storage = (typeof localStorage !== 'undefined' ? localStorage : null)) {
    this.storage = storage;
    this.data = DEFAULTS();
    this.load();
  }

  load() {
    if (!this.storage) return;
    try {
      const raw = this.storage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!parsed || parsed.version !== 1) return;
      const base = DEFAULTS();
      this.data = {
        ...base,
        ...parsed,
        settings: { ...base.settings, ...(parsed.settings ?? {}) },
      };
    } catch (err) {
      console.warn('[save] discarding unreadable save:', err.message);
      this.data = DEFAULTS();
    }
  }

  persist() {
    if (!this.storage) return;
    try {
      this.storage.setItem(STORAGE_KEY, JSON.stringify(this.data));
    } catch (err) {
      console.warn('[save] could not persist:', err.message);
    }
  }

  // ---- progress ------------------------------------------------------------

  isUnlocked(id) { return this.data.unlocked.includes(id); }

  isCleared(id) { return !!this.data.cleared[id]; }

  best(id) { return this.data.best[id] ?? null; }

  unlock(id) {
    if (!this.data.unlocked.includes(id)) {
      this.data.unlocked.push(id);
      this.persist();
    }
  }

  /** Records a clear and unlocks the next level. Returns true if it was better. */
  recordClear(id, { score = 0, time = 0, coins = 0, deaths = 0 } = {}) {
    const prev = this.data.best[id];
    const improved = !prev || score > prev.score;
    // Best score, best time, best coin count and fewest deaths are tracked
    // independently — a fast run and a thorough run are different achievements,
    // and a medal should not be lost because a slower run scored higher.
    const betterTime = !prev || !prev.time || (time > 0 && time < prev.time);
    this.data.best[id] = {
      score: Math.max(score, prev?.score ?? 0),
      time: betterTime ? time : prev.time,
      coins: Math.max(coins, prev?.coins ?? 0),
      deaths: prev ? Math.min(deaths, prev.deaths ?? deaths) : deaths,
    };
    this.data.cleared[id] = true;

    const index = LEVEL_ORDER.indexOf(id);
    const next = LEVEL_ORDER[index + 1];
    if (next) this.unlock(next);
    this.persist();
    return improved;
  }

  /**
   * Medal earned for a clear time, or null. Thresholds are fractions of the
   * level's own target time, so a level that is meant to be long is not judged
   * against a short one.
   */
  medalFor(level, time) {
    if (!time || !level?.targetTime) return null;
    const t = level.targetTime;
    if (time <= t * MEDALS.gold) return 'gold';
    if (time <= t * MEDALS.silver) return 'silver';
    if (time <= t * MEDALS.bronze) return 'bronze';
    return null;
  }

  /** Best medal earned on a level so far. */
  bestMedal(level) {
    const b = this.best(level.id);
    return b ? this.medalFor(level, b.time) : null;
  }

  totalScore() {
    return Object.values(this.data.best).reduce((sum, b) => sum + (b.score ?? 0), 0);
  }

  clearProgress() {
    const settings = this.data.settings;
    this.data = DEFAULTS();
    this.data.settings = settings;
    this.persist();
  }

  // ---- settings ------------------------------------------------------------

  get settings() { return this.data.settings; }

  updateSettings(partial) {
    this.data.settings = { ...this.data.settings, ...partial };
    // keep the flag the systems read in sync with what is persisted
    this.data.settings.reducedMotion = !!this.data.settings.reducedMotion;
    this.persist();
    return this.data.settings;
  }
}
