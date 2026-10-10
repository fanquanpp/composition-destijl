/**
 * Keyboard, gamepad and touch input, flattened into named actions.
 *
 * Two kinds of query:
 *   isDown(action)     — held state, for movement
 *   takePress(action)  — edge-triggered, returns true once per press
 *
 * takePress is intentionally "sticky": a press that happens between simulation
 * steps stays queued until something consumes it, which is what makes the
 * player's jump buffer work across frames.
 */

const BINDINGS = {
  left:    ['ArrowLeft', 'KeyA'],
  right:   ['ArrowRight', 'KeyD'],
  up:      ['ArrowUp', 'KeyW'],
  down:    ['ArrowDown', 'KeyS'],
  jump:    ['Space', 'ArrowUp', 'KeyW', 'KeyZ', 'KeyJ'],
  dash:    ['ShiftLeft', 'ShiftRight', 'KeyX', 'KeyK'],
  grapple: ['KeyF', 'KeyQ'],
  pause:   ['Escape', 'KeyP'],
  restart: ['KeyR'],
  mute:    ['KeyM'],
  confirm: ['Enter', 'NumpadEnter'],
  back:    ['Escape', 'Backspace'],
  debug:   ['Backquote'],
  // Menu actions are deliberately separate from the gameplay ones: arrows must
  // never activate a menu item, and space must never move the highlight.
  menuUp:      ['ArrowUp', 'KeyW'],
  menuDown:    ['ArrowDown', 'KeyS'],
  menuConfirm: ['Space', 'Enter', 'NumpadEnter'],
  menuBack:    ['Escape', 'Backspace'],
};

/** codes that would otherwise scroll or trigger browser shortcuts */
const SWALLOW = new Set(['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab', 'Backspace']);

const GAMEPAD = {
  jump: [0, 3],      // A / Y
  dash: [1, 2],      // B / X
  grapple: [4, 5],   // LB / RB
  pause: [9, 8],     // start / select
  restart: [10],     // L3
};

const STICK_DEADZONE = 0.28;
const TRIGGER_DEADZONE = 0.4;

export class Input {
  constructor(target = window) {
    this.keys = new Set();
    this.pressed = new Set();       // queued edge events
    this.gamepadButtons = new Set();
    this.padPressed = new Set();
    this.touchState = new Map();    // action -> bool
    this.touchPressed = new Set();
    this.enabled = true;
    this.lastDevice = 'keyboard';
    this._listeners = [];
    /** aim state for the grapple: normalised device coords in [-1, 1], y up */
    this.pointer = { x: 0, y: 0, has: false, down: false };

    this._onKeyDown = (e) => {
      if (SWALLOW.has(e.code) && !e.metaKey && !e.ctrlKey) e.preventDefault();
      if (e.repeat) return;
      this.keys.add(e.code);
      for (const action in BINDINGS) {
        if (BINDINGS[action].includes(e.code)) {
          this.pressed.add(action);
          if (action === 'jump' || action === 'dash') this.lastDevice = 'keyboard';
        }
      }
    };
    this._onKeyUp = (e) => { this.keys.delete(e.code); };
    this._onBlur = () => {
      this.keys.clear();
      this.gamepadButtons.clear();
      this.touchState.clear();
      this.pointer.down = false;
    };

    target.addEventListener('keydown', this._onKeyDown, { passive: false });
    target.addEventListener('keyup', this._onKeyUp);
    target.addEventListener('blur', this._onBlur);
    this._listeners.push([target, 'keydown', this._onKeyDown], [target, 'keyup', this._onKeyUp], [target, 'blur', this._onBlur]);

    // pointer: used both for grapple aim and for the right mouse button
    this._onPointerMove = (e) => {
      this.pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
      this.pointer.y = -((e.clientY / window.innerHeight) * 2 - 1);
      this.pointer.has = true;
    };
    this._onPointerDown = (e) => {
      if (e.button !== 2) return;
      e.preventDefault();
      this.pointer.down = true;
      this.pressed.add('grapple');
      this.lastDevice = 'mouse';
    };
    this._onPointerUp = (e) => { if (e.button === 2) this.pointer.down = false; };
    this._onContextMenu = (e) => e.preventDefault();

    window.addEventListener('pointermove', this._onPointerMove);
    window.addEventListener('pointerdown', this._onPointerDown);
    window.addEventListener('pointerup', this._onPointerUp);
    window.addEventListener('contextmenu', this._onContextMenu);
    this._listeners.push(
      [window, 'pointermove', this._onPointerMove],
      [window, 'pointerdown', this._onPointerDown],
      [window, 'pointerup', this._onPointerUp],
      [window, 'contextmenu', this._onContextMenu],
    );

    this._buildTouchControls();
  }

  destroy() {
    for (const [t, type, fn] of this._listeners) t.removeEventListener(type, fn);
    this._listeners.length = 0;
    this.touchEl?.remove();
  }

  // ---- queries -------------------------------------------------------------

  isDown(action) {
    if (!this.enabled) return false;
    if (action === 'grapple' && this.pointer.down) return true;
    if (this._touchDown(action)) return true;
    if (this._padDown(action)) return true;
    const codes = BINDINGS[action];
    if (!codes) return false;
    for (const c of codes) if (this.keys.has(c)) return true;
    return false;
  }

  /** true once per press; consumes the event */
  takePress(action) {
    if (!this.enabled) return false;
    if (this.touchPressed.delete(action)) return true;
    if (this.padPressed.delete(action)) return true;
    return this.pressed.delete(action);
  }

  /** peek without consuming — used by menus that run outside the sim loop */
  hasPress(action) {
    if (!this.enabled) return false;
    if (this.touchPressed.has(action) || this.padPressed.has(action)) return true;
    return this.pressed.has(action);
  }

  axisX() {
    if (!this.enabled) return 0;
    let v = 0;
    if (this.isDown('left')) v -= 1;
    if (this.isDown('right')) v += 1;
    const stick = this._stickX();
    if (Math.abs(stick) > Math.abs(v)) v = stick;
    return Math.max(-1, Math.min(1, v));
  }

  axisY() {
    if (!this.enabled) return 0;
    let v = 0;
    if (this.isDown('up')) v -= 1;
    if (this.isDown('down')) v += 1;
    const stick = this._stickY();
    if (Math.abs(stick) > Math.abs(v)) v = stick;
    return Math.max(-1, Math.min(1, v));
  }

  /** Drop all queued edges. Called on state transitions so a held key from the
   *  previous screen doesn't fire immediately in the next one. */
  flush() {
    this.pressed.clear();
    this.padPressed.clear();
    this.touchPressed.clear();
  }

  /**
   * Refresh devices that report by polling rather than by event. Must be called
   * once per animation frame, before anything reads input: a gamepad only exists
   * to the browser when it is asked, so skipping this leaves controllers dead.
   */
  poll() {
    this._pollGamepad();
  }

  // ---- gamepad -------------------------------------------------------------

  _pollGamepad() {
    if (!navigator.getGamepads) return;
    const pads = navigator.getGamepads();
    let pad = null;
    for (const p of pads) if (p && p.connected) { pad = p; break; }
    this.pad = pad;
    if (!pad) { this.gamepadButtons.clear(); return; }

    const now = new Set();
    for (const action in GAMEPAD) {
      for (const idx of GAMEPAD[action]) {
        const b = pad.buttons[idx];
        if (b && (b.pressed || b.value > TRIGGER_DEADZONE)) now.add(action);
      }
    }
    for (const action of now) if (!this.gamepadButtons.has(action)) this.padPressed.add(action);
    this.gamepadButtons = now;
    if (this.padPressed.size) this.lastDevice = 'gamepad';
  }

  _padDown(action) { return this.gamepadButtons.has(action); }

  _stickX() {
    const v = this.pad?.axes?.[0] ?? 0;
    return Math.abs(v) < STICK_DEADZONE ? 0 : v;
  }

  _stickY() {
    const v = this.pad?.axes?.[1] ?? 0;
    return Math.abs(v) < STICK_DEADZONE ? 0 : v;
  }

  // ---- touch ---------------------------------------------------------------

  get isTouch() {
    return typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0);
  }

  _touchDown(action) { return this.touchState.get(action) === true; }

  _buildTouchControls() {
    if (!this.isTouch) return;
    const el = document.createElement('div');
    el.className = 'touch-controls';
    el.innerHTML = `
      <div class="touch-pad">
        <button class="touch-btn" data-action="left" aria-label="Move left">◀</button>
        <button class="touch-btn" data-action="right" aria-label="Move right">▶</button>
      </div>
      <div class="touch-pad">
        <button class="touch-btn" data-action="dash" aria-label="Dash">DASH</button>
        <button class="touch-btn touch-jump" data-action="jump" aria-label="Jump">JUMP</button>
      </div>`;
    document.getElementById('hud')?.appendChild(el);
    this.touchEl = el;

    const set = (action, down, btn) => {
      if (down && !this.touchState.get(action)) this.touchPressed.add(action);
      this.touchState.set(action, down);
      btn.classList.toggle('is-down', down);
    };

    for (const btn of el.querySelectorAll('.touch-btn')) {
      const action = btn.dataset.action;
      const press = (e) => { e.preventDefault(); set(action, true, btn); this.lastDevice = 'touch'; };
      const release = (e) => { e.preventDefault(); set(action, false, btn); };
      btn.addEventListener('pointerdown', press);
      btn.addEventListener('pointerup', release);
      btn.addEventListener('pointercancel', release);
      btn.addEventListener('pointerleave', release);
      btn.addEventListener('contextmenu', (e) => e.preventDefault());
    }
  }
}
