/**
 * The heads-up display: a Mondrian strip along the top edge — five rectangles
 * separated by black lines, with the level plate in red and the coin swatch in
 * yellow.
 *
 * All markup is built in `_render()`, which means a language change is a
 * re-render plus re-applying the last known values. That is why every setter
 * caches its input instead of only writing to the DOM.
 */
import { t } from '../core/i18n.js';

const pad = (n, width = 2) => String(n).padStart(width, '0');

export function formatTime(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${pad(s % 60)}`;
}

/** [keys to show, i18n key for the label] */
const HINT_ROWS = [
  [['A', 'D'], 'hud.move'],
  [['Space'], 'hud.jump'],
  [['Shift'], 'hud.dash'],
  [['Esc'], 'hud.pause'],
  [['M'], 'hud.mute'],
];

export class Hud {
  constructor(root) {
    this.root = root;
    this._state = {
      numeral: '—',
      levelName: '',
      coins: 0,
      coinTotal: 0,
      score: 0,
      time: 0,
      lives: 3,
      hearts: 0,
      maxHearts: 3,
    };
    this._heartsShown = -1;
    this._lastTime = '';
    this._hintTimer = null;
    this._render();
    this.hide();
  }

  _render() {
    this.root.innerHTML = `
      <div class="hud-bar">
        <div class="hud-plate">
          <span class="hud-label">${t('hud.level')}</span>
          <span class="hud-value" data-level>—</span>
        </div>
        <div class="hud-cell" data-cell="coins">
          <span class="swatch yellow"></span>
          <div class="hud-stack">
            <span class="hud-label">${t('hud.coins')}</span>
            <span class="hud-value" data-coins>0/0</span>
          </div>
        </div>
        <div class="hud-cell" data-cell="score">
          <span class="swatch blue"></span>
          <div class="hud-stack">
            <span class="hud-label">${t('hud.score')}</span>
            <span class="hud-value" data-score>0</span>
          </div>
        </div>
        <div class="hud-cell grow" data-cell="time">
          <div class="hud-stack">
            <span class="hud-label">${t('hud.time')}</span>
            <span class="hud-value" data-time>0:00</span>
          </div>
        </div>
        <div class="hud-cell" data-cell="lives">
          <div class="hud-stack">
            <span class="hud-label">${t('hud.lives')}</span>
            <span class="hud-value" data-lives>3</span>
          </div>
        </div>
        <div class="hud-cell" data-cell="hearts">
          <span class="swatch red"></span>
          <div class="hearts" data-hearts></div>
        </div>
      </div>
      <div class="hud-hint" data-hint>
        ${HINT_ROWS.map(([keys, key]) =>
          `<span>${keys.map((k) => `<kbd>${k}</kbd>`).join('')} ${t(key)}</span>`).join('')}
      </div>`;

    this.el = {
      level: this.root.querySelector('[data-level]'),
      coins: this.root.querySelector('[data-coins]'),
      score: this.root.querySelector('[data-score]'),
      time: this.root.querySelector('[data-time]'),
      lives: this.root.querySelector('[data-lives]'),
      hearts: this.root.querySelector('[data-hearts]'),
      hint: this.root.querySelector('[data-hint]'),
      cells: {
        coins: this.root.querySelector('[data-cell="coins"]'),
        score: this.root.querySelector('[data-cell="score"]'),
        time: this.root.querySelector('[data-cell="time"]'),
        lives: this.root.querySelector('[data-cell="lives"]'),
        hearts: this.root.querySelector('[data-cell="hearts"]'),
      },
    };

    // the DOM was replaced, so the cached-render guards must be reset and every
    // value pushed back in
    this._heartsShown = -1;
    this._lastTime = '';
    this._reapply();
  }

  /** Re-renders in the current language. Called when the locale changes. */
  refreshLabels() {
    this._render();
  }

  _reapply() {
    const s = this._state;
    this.el.level.textContent = s.numeral;
    this.el.level.title = s.levelName ?? '';
    this.el.coins.textContent = `${s.coins}/${s.coinTotal}`;
    this.el.score.textContent = s.score.toLocaleString('en-US');
    this.el.lives.textContent = String(Math.max(0, s.lives));
    this.setHearts(s.hearts, s.maxHearts);
    this.setTimer(s.time);
  }

  show() { this.root.classList.remove('hidden'); }
  hide() { this.root.classList.add('hidden'); }

  setLevel(numeral, name) {
    this._state.numeral = numeral;
    this._state.levelName = name ?? '';
    this.el.level.textContent = numeral;
    this.el.level.title = this._state.levelName;
  }

  setCoins(collected, total) {
    this._state.coins = collected;
    this._state.coinTotal = total;
    this.el.coins.textContent = `${collected}/${total}`;
  }

  setScore(score) {
    this._state.score = score;
    this.el.score.textContent = score.toLocaleString('en-US');
  }

  setLives(lives) {
    this._state.lives = lives;
    this.el.lives.textContent = String(Math.max(0, lives));
  }

  setHearts(hearts, max) {
    this._state.hearts = hearts;
    this._state.maxHearts = max;
    if (hearts === this._heartsShown && this.el.hearts.childElementCount === max) return;
    this._heartsShown = hearts;
    this.el.hearts.innerHTML = Array.from({ length: max }, (_, i) =>
      `<span class="heart${i < hearts ? '' : ' empty'}"></span>`).join('');
  }

  setTimer(seconds) {
    this._state.time = seconds;
    const text = formatTime(seconds);
    if (text === this._lastTime) return;
    this._lastTime = text;
    this.el.time.textContent = text;
  }

  /** Brief highlight on a HUD cell, e.g. when a coin is collected. */
  pulse(cell) {
    const el = this.el.cells[cell];
    if (!el) return;
    el.classList.remove('hud-flash');
    void el.offsetWidth; // restart the animation
    el.classList.add('hud-flash');
  }

  toast(text) {
    // only one message at a time — two triggers firing on the same step would
    // otherwise stack exactly on top of each other and read as gibberish
    for (const old of this.root.querySelectorAll('.hud-toast')) old.remove();
    const el = document.createElement('div');
    el.className = 'hud-toast';
    el.textContent = text;
    this.root.appendChild(el);
    setTimeout(() => el.remove(), 1600);
  }

  /** The control hint retires itself a few seconds into the first level. */
  scheduleHintFade(delay = 9000) {
    clearTimeout(this._hintTimer);
    this.el.hint.classList.remove('is-fading');
    this._hintTimer = setTimeout(() => this.el.hint.classList.add('is-fading'), delay);
  }

  clearHintTimer() { clearTimeout(this._hintTimer); }
}
