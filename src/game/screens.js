/**
 * Menus and overlay screens. One screen is visible at a time and is described by
 * a plain data object, so main.js never touches markup.
 *
 * Navigation: mouse/touch clicks, or the keyboard — up/down to move the
 * highlight, enter/space to activate, escape to go back. The highlight is a
 * CSS class rather than DOM focus, so the arrow keys do not scroll anything.
 */
import { t, LOCALES, localeName } from '../core/i18n.js';

const TITLE_PAINTING = 'assets/textures/mondrian-composition-no-iv.jpg';

const COMPOSITIONS = [
  'linear-gradient(var(--black),var(--black)) 0 100%/100% var(--line) no-repeat,linear-gradient(var(--red),var(--red)) 0 0/26% 100% no-repeat,linear-gradient(var(--black),var(--black)) 26% 0/var(--line) 100% no-repeat,linear-gradient(var(--yellow),var(--yellow)) 64% 0/var(--line) 100% no-repeat,var(--white)',
  'linear-gradient(var(--black),var(--black)) 0 100%/100% var(--line) no-repeat,linear-gradient(var(--blue),var(--blue)) 0 0/18% 100% no-repeat,linear-gradient(var(--black),var(--black)) 18% 0/var(--line) 100% no-repeat,linear-gradient(var(--yellow),var(--yellow)) 46% 0/9% 100% no-repeat,linear-gradient(var(--black),var(--black)) 55% 0/var(--line) 100% no-repeat,var(--white)',
  'linear-gradient(var(--black),var(--black)) 0 100%/100% var(--line) no-repeat,linear-gradient(var(--yellow),var(--yellow)) 0 0/34% 100% no-repeat,linear-gradient(var(--black),var(--black)) 34% 0/var(--line) 100% no-repeat,linear-gradient(var(--red),var(--red)) 72% 0/var(--line) 100% no-repeat,var(--white)',
];

/** Three pips, filled by tier. Shape carries the information, so the medal
 *  still reads without relying on colour. */
function medalPips(medal) {
  const tier = medal === 'gold' ? 3 : medal === 'silver' ? 2 : medal === 'bronze' ? 1 : 0;
  const pips = [0, 1, 2].map((i) => `<span class="pip${i < tier ? ' on' : ''}"></span>`).join('');
  const label = medal ? t(`levels.medal.${medal}`) : t('levels.medal.none');
  return `<div class="medal">${pips}<span class="medal-label">${label}</span></div>`;
}

const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

function panel({ band = '', body = '', foot = '', wide = false }) {
  return `<div class="screen"><div class="panel${wide ? ' panel-wide' : ''}">
    <div class="panel-band"${band ? ` style="background:${band}"` : ''}></div>
    <div class="panel-body">${body}</div>
    ${foot ? `<div class="panel-foot">${foot}</div>` : ''}
  </div></div>`;
}

const btn = (action, label, { variant = '', key = '', payload = '', primary = false } = {}) =>
  `<button class="btn ${variant}" data-action="${action}"${primary ? ' data-primary="true"' : ''}${payload ? ` data-payload="${escapeHtml(payload)}"` : ''}>
    <span>${label}</span>${key ? `<span class="btn-key">${key}</span>` : ''}
  </button>`;

export class Screens {
  constructor(root, onAction) {
    this.root = root;
    this.onAction = onAction;
    this.name = null;
    this.data = null;
    this.focusIndex = 0;
    this.buttons = [];

    this.root.addEventListener('click', (e) => {
      const el = e.target.closest('[data-action]');
      if (!el) return;
      const { action, payload } = el.dataset;
      this.onAction(action, payload ? { payload, index: el.dataset.index } : { index: el.dataset.index });
    });

    this.root.addEventListener('input', (e) => {
      const el = e.target.closest('[data-setting]');
      if (!el) return;
      this.onAction('setting', { key: el.dataset.setting, value: Number(el.value) / 100 });
    });
  }

  get isActive() { return this.name !== null; }

  hide() {
    this.name = null;
    this.data = null;
    this.buttons = [];
    this.root.classList.remove('is-active');
    this.root.innerHTML = '';
  }

  show(name, data = {}) {
    const html = this._build(name, data);
    if (html === null) { this.hide(); return; }
    this.name = name;
    this.data = data;
    this.root.innerHTML = html;
    this.root.classList.add('is-active');
    this.buttons = [...this.root.querySelectorAll('.btn, .card')].filter((b) => !b.disabled && !b.classList.contains('is-locked'));
    this.focusIndex = Math.max(0, this.buttons.findIndex((b) => b.dataset.primary === 'true'));
    if (this.focusIndex < 0) this.focusIndex = 0;
    this._applyFocus();
  }

  // ---- keyboard navigation -------------------------------------------------

  moveFocus(delta) {
    if (!this.buttons.length) return;
    this.focusIndex = (this.focusIndex + delta + this.buttons.length) % this.buttons.length;
    this._applyFocus();
  }

  activate() {
    const el = this.buttons[this.focusIndex];
    if (el) el.click();
  }

  _applyFocus() {
    this.buttons.forEach((b, i) => b.classList.toggle('is-focus', i === this.focusIndex));
  }

  // ---- builders ------------------------------------------------------------

  _build(name, data) {
    switch (name) {
      case 'title': return this._title(data);
      case 'levels': return this._levels(data);
      case 'howto': return this._howto();
      case 'credits': return this._credits(data);
      case 'settings': return this._settings(data);
      case 'intro': return this._intro(data);
      case 'pause': return this._pause(data);
      case 'levelclear': return this._levelClear(data);
      case 'gameover': return this._gameOver(data);
      case 'victory': return this._victory(data);
      default: return null;
    }
  }

  _title({ hasSave, totalScore }) {
    return panel({
      wide: true,
      body: `
        <div class="title-layout">
          <div class="title-hero">
            <p class="eyebrow">${t('title.eyebrow')}</p>
            <h1>Compo<em>sition</em></h1>
            <p class="panel-lede">${t('title.lede')}</p>
            <div class="title-meta">
              <span class="chip red">${t('title.chip.levels')}</span>
              <span class="chip blue">${t('title.chip.moves')}</span>
              <span class="chip yellow">${t('title.chip.input')}</span>
              ${hasSave ? `<span class="chip">${t('title.chip.best', { n: totalScore.toLocaleString('en-US') })}</span>` : ''}
            </div>
            <div class="menu">
              ${btn('play', hasSave ? t('title.continue') : t('title.play'), { variant: 'btn-primary', key: 'Enter', primary: true })}
              ${btn('levels', t('title.levels'), { key: '' })}
              ${btn('howto', t('title.howto'))}
              ${btn('settings', t('title.settings'))}
              ${btn('credits', t('title.credits'))}
            </div>
          </div>
          <div>
            <div class="painting">
              <img src="${TITLE_PAINTING}" alt="Piet Mondrian, Composition No. IV (1914)">
            </div>
            <p class="eyebrow" style="margin-top:12px">${t('title.caption')}</p>
          </div>
        </div>`,
    });
  }

  _levels({ levels }) {
    const cards = levels.map((l, i) => {
      const locked = !l.unlocked;
      const band = COMPOSITIONS[i % COMPOSITIONS.length];
      return `<button class="card${locked ? ' is-locked' : ''}" data-action="${locked ? 'locked' : 'select'}" data-index="${l.id}" ${locked ? 'disabled' : ''}>
        <div class="card-thumb" style="background:${band}"></div>
        <div class="card-body">
          <p class="card-num">Level ${l.numeral}</p>
          <p class="card-name">${escapeHtml(l.name)}</p>
          <div class="card-stat"><span>${t('levels.stat.score')}</span><span>${l.best ? l.best.score.toLocaleString('en-US') : '—'}</span></div>
          <div class="card-stat"><span>${t('levels.stat.time')}</span><span>${l.bestTime ?? '—'}</span></div>
          <div class="card-stat"><span>${t('levels.stat.coins')}</span><span>${l.best ? `${l.best.coins}/${l.coinTotal}` : `0/${l.coinTotal}`}</span></div>
          <div class="card-stat"><span>${t('levels.stat.target')}</span><span>${l.targetTime}s</span></div>
          ${medalPips(l.medal)}
          <span class="card-badge ${l.cleared ? 'done' : locked ? 'locked' : ''}">${l.cleared ? t('levels.badge.cleared') : locked ? t('levels.badge.locked') : t('levels.badge.play')}</span>
        </div>
      </button>`;
    }).join('');

    return panel({
      wide: true,
      band: COMPOSITIONS[1],
      body: `
        <p class="eyebrow">${t('levels.eyebrow')}</p>
        <h2 class="panel-title">${t('levels.title')}</h2>
        <p class="panel-lede">${t('levels.lede')}</p>
        <div class="cards">${cards}</div>`,
      foot: `${btn('back', t('levels.back'))} ${btn('howto', t('title.howto'))}`,
    });
  }

  _howto() {
    const rows = [
      [['A', 'D'], t('howto.move')],
      [['Space'], t('howto.jump')],
      [['Space'], t('howto.doubleJump')],
      [['Shift'], t('howto.dash')],
      [['Space'], t('howto.wall')],
      [['F', 'Q'], t('howto.grapple')],
      [['Esc'], t('howto.meta')],
    ];
    return panel({
      body: `
        <p class="eyebrow">${t('howto.eyebrow')}</p>
        <h2 class="panel-title">${t('howto.title')}</h2>
        <div class="controls">
          ${rows.map(([keys, desc]) => `
            <div class="keys">${keys.map((k) => `<kbd>${k}</kbd>`).join('')}</div>
            <div class="desc">${escapeHtml(desc)}</div>`).join('')}
        </div>
        <div class="rule"></div>
        <p class="panel-lede">${t('howto.rules')}</p>`,
      foot: `${btn('back', t('credits.back'))}`,
    });
  }

  _credits({ missing = [] } = {}) {
    const assets = [
      ['three.js', t('credits.what.three'), 'MIT'],
      ['Archivo Black', t('credits.what.archivo'), 'SIL OFL 1.1'],
      ['Jost*', t('credits.what.jost'), 'SIL OFL 1.1'],
      ['Space Mono', t('credits.what.mono'), 'SIL OFL 1.1'],
      ['Noto Sans SC', t('credits.what.noto'), 'SIL OFL 1.1'],
      ['Piet Mondrian', t('credits.what.mondrian'), t('credits.pd')],
      ['OpenGameArt', t('credits.what.deva'), 'CC0 1.0'],
      ['OpenGameArt', t('credits.what.otherAudio'), 'CC0 1.0'],
    ];
    return panel({
      band: COMPOSITIONS[2],
      body: `
        <p class="eyebrow">${t('credits.eyebrow')}</p>
        <h2 class="panel-title">${t('credits.title')}</h2>
        <p class="panel-lede">${t('credits.lede')}</p>
        <div class="mt">
          ${assets.map(([who, what, lic]) => `
            <div class="credit-line">
              <span class="who">${escapeHtml(who)}</span>
              <span class="what">${escapeHtml(what)}</span>
              <span class="lic">${escapeHtml(lic)}</span>
            </div>`).join('')}
        </div>
        ${missing.length ? `<div class="rule thin"></div>
          <p class="panel-lede">${t('credits.missing', {
            n: missing.length, list: missing.slice(0, 6).map(escapeHtml).join(', '),
          })}</p>` : ''}`,
      foot: `${btn('back', t('credits.back'))}`,
    });
  }

  _settings({ music, sfx, muted, reducedMotion = false, localeSetting = 'auto', localeResolved = 'en', showClear = true }) {
    const pct = (v) => Math.round(v * 100);
    const langLabel = LOCALES.find((l) => l.code === localeSetting)?.label ?? 'Auto';
    return panel({
      body: `
        <p class="eyebrow">${t('settings.eyebrow')}</p>
        <h2 class="panel-title">${t('settings.title')}</h2>
        <div class="setting">
          <label for="set-music">${t('settings.music')}</label>
          <input id="set-music" type="range" min="0" max="100" value="${pct(music)}" data-setting="music">
          <output>${pct(music)}%</output>
        </div>
        <div class="setting">
          <label for="set-sfx">${t('settings.sfx')}</label>
          <input id="set-sfx" type="range" min="0" max="100" value="${pct(sfx)}" data-setting="sfx">
          <output>${pct(sfx)}%</output>
        </div>
        <div class="setting">
          <label>${t('settings.muted')}</label>
          <span class="eyebrow">${muted ? t('settings.muted.on') : t('settings.muted.off')}</span>
          <output>${muted ? 'on' : 'off'}</output>
        </div>
        <div class="setting">
          <label>${t('settings.motion')}</label>
          <span class="eyebrow">${reducedMotion ? t('settings.motion.reduced') : t('settings.motion.full')}</span>
          <output>${reducedMotion ? t('settings.motion.value.reduced') : t('settings.motion.value.full')}</output>
        </div>
        <div class="setting">
          <label>${t('settings.language')}</label>
          <span class="eyebrow">${localeSetting === 'auto'
            ? t('settings.language.auto', { name: localeName(localeResolved) })
            : localeName(localeResolved)}</span>
          <output>${langLabel}</output>
        </div>
        ${showClear ? `<div class="rule"></div>
        <p class="panel-lede">${t('settings.clearNote')}</p>` : ''}`,
      foot: `${btn('toggleMute', muted ? t('settings.unmute') : t('settings.mute'))}
        ${btn('toggleMotion', reducedMotion ? t('settings.fullMotion') : t('settings.reduceMotion'))}
        ${btn('cycleLanguage', `${t('settings.language')}: ${langLabel}`)}
        ${btn('back', t('settings.back'))}
        ${showClear ? btn('clearProgress', t('settings.clear')) : ''}`,
    });
  }

  _intro({ numeral, name, subtitle, coins, band = 0 }) {
    return panel({
      band: COMPOSITIONS[band % COMPOSITIONS.length],
      body: `
        <p class="eyebrow">${t('intro.level', { n: escapeHtml(numeral) })}</p>
        <h2 class="panel-title">${escapeHtml(name)}</h2>
        <p class="panel-lede">${escapeHtml(subtitle ?? '')}</p>
        <div class="rule"></div>
        <div class="row-between">
          <span class="eyebrow">${t('intro.coins', { n: coins })}</span>
          <span class="eyebrow">${t('intro.enter')}</span>
        </div>`,
      foot: `${btn('start', t('intro.start'), { variant: 'btn-primary', primary: true })}`,
    });
  }

  _pause({ numeral, name, time, score, coins, coinTotal }) {
    return panel({
      body: `
        <p class="eyebrow">${t('pause.eyebrow')}</p>
        <h2 class="panel-title">${t('pause.title', { n: escapeHtml(numeral), name: escapeHtml(name) })}</h2>
        <div class="kv mt">
          <div>${t('pause.time')}</div><div>${time}</div>
          <div>${t('pause.score')}</div><div>${score.toLocaleString('en-US')}</div>
          <div>${t('pause.coins')}</div><div>${coins}/${coinTotal}</div>
        </div>`,
      foot: `${btn('resume', t('pause.resume'), { variant: 'btn-primary', primary: true })}
        ${btn('restart', t('pause.restart'))}
        ${btn('settings', t('pause.settings'))}
        ${btn('levels', t('pause.levels'))}
        ${btn('title', t('pause.title2'))}`,
    });
  }

  _levelClear({ numeral, name, rows, total, isLast, improved, medal }) {
    return panel({
      band: COMPOSITIONS[0],
      body: `
        <p class="eyebrow">${improved
          ? t('clear.eyebrow.best', { n: escapeHtml(numeral) })
          : t('clear.eyebrow', { n: escapeHtml(numeral) })}</p>
        ${medal ? medalPips(medal) : ''}
        <h2 class="panel-title">${t('clear.title', { name: escapeHtml(name) })}</h2>
        <div class="kv mt">
          ${rows.map(([k, v]) => `<div>${escapeHtml(k)}</div><div>${escapeHtml(v)}</div>`).join('')}
          <div class="kv-total">${t('clear.total')}</div><div class="kv-total">${total.toLocaleString('en-US')}</div>
        </div>`,
      foot: `${isLast ? btn('finish', t('clear.finish'), { variant: 'btn-primary', primary: true }) : btn('next', t('clear.next'), { variant: 'btn-primary', primary: true })}
        ${btn('replay', t('clear.replay'))}
        ${btn('levels', t('clear.levels'))}`,
    });
  }

  _gameOver({ numeral, name, score, coins, coinTotal }) {
    return panel({
      band: 'linear-gradient(var(--black),var(--black)) 0 100%/100% var(--line) no-repeat,linear-gradient(var(--red),var(--red)) 0 0/100% 100% no-repeat',
      body: `
        <p class="eyebrow">${t('gameover.eyebrow')}</p>
        <h2 class="panel-title">${t('gameover.title', { n: escapeHtml(numeral) })}</h2>
        <p class="panel-lede">${t('gameover.lede')}</p>
        <div class="kv mt">
          <div>${t('pause.score')}</div><div>${score.toLocaleString('en-US')}</div>
          <div>${t('pause.coins')}</div><div>${coins}/${coinTotal}</div>
        </div>`,
      foot: `${btn('restart', t('gameover.retry'), { variant: 'btn-primary', primary: true })}
        ${btn('levels', t('gameover.levels'))}
        ${btn('title', t('gameover.title2'))}`,
    });
  }

  _victory({ rows, total, coinTotal, coins, deaths }) {
    return panel({
      wide: true,
      band: COMPOSITIONS[1],
      body: `
        <div class="title-layout">
          <div>
            <p class="eyebrow">${t('victory.eyebrow')}</p>
            <h2 class="panel-title">${t('victory.title')}</h2>
            <p class="panel-lede">${t('victory.lede')}</p>
            <div class="kv mt">
              ${rows.map(([k, v]) => `<div>${escapeHtml(k)}</div><div>${escapeHtml(v)}</div>`).join('')}
              <div class="kv-total">${t('victory.total')}</div><div class="kv-total">${total.toLocaleString('en-US')}</div>
            </div>
          </div>
          <div>
            <div class="painting">
              <img src="${TITLE_PAINTING}" alt="Piet Mondrian, Composition No. IV (1914)">
            </div>
            <p class="eyebrow" style="margin-top:12px">${t('victory.stats', { coins, total: coinTotal, deaths })}</p>
          </div>
        </div>`,
      foot: `${btn('levels', t('victory.levels'))} ${btn('title', t('victory.title2'))}`,
    });
  }
}
