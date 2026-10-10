/**
 * Audio: Web Audio playback of the downloaded CC0 samples, a synthesiser
 * fallback for any sample that is missing, and a small generative score.
 *
 * The score is deliberately mechanical — a strict 16-step grid, four voices,
 * one chord per bar, and only the harmony changes between levels. Repetition as
 * structure, which is the musical equivalent of a Mondrian grid.
 */
import { AUDIO } from '../config.js';

const SEMITONES = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** "A2" / "C#4" / "Eb3" -> Hz */
function noteToMidi(name) {
  const m = /^([A-G])([#b]?)(-?\d)$/.exec(name);
  if (!m) return 69;
  let semi = SEMITONES[m[1]];
  if (m[2] === '#') semi += 1;
  else if (m[2] === 'b') semi -= 1;
  return (Number(m[3]) + 1) * 12 + semi;
}

function noteToFreq(name) {
  return 440 * Math.pow(2, (noteToMidi(name) - 69) / 12);
}

/**
 * Four bars each, one chord per bar, written as [bass, ...chord tones].
 * The game cross-fades nothing — it just switches progression between levels.
 */
const THEMES = {
  title: {
    bpm: 86,
    bars: [
      { bass: 'A1', chord: ['A3', 'C4', 'E4'] },
      { bass: 'F1', chord: ['F3', 'A3', 'C4'] },
      { bass: 'C2', chord: ['C4', 'E4', 'G4'] },
      { bass: 'G1', chord: ['G3', 'B3', 'D4'] },
    ],
  },
  level1: {
    bpm: 104,
    bars: [
      { bass: 'D2', chord: ['D4', 'F4', 'A4'] },
      { bass: 'A1', chord: ['A3', 'C4', 'E4'] },
      { bass: 'B1', chord: ['B3', 'D4', 'F4'] },
      { bass: 'G1', chord: ['G3', 'B3', 'D4'] },
    ],
  },
  level2: {
    bpm: 112,
    bars: [
      { bass: 'E2', chord: ['E4', 'G4', 'B4'] },
      { bass: 'C2', chord: ['C4', 'E4', 'G4'] },
      { bass: 'G1', chord: ['G3', 'B3', 'D4'] },
      { bass: 'D2', chord: ['D4', 'F4', 'A4'] },
    ],
  },
  level3: {
    bpm: 120,
    bars: [
      { bass: 'C2', chord: ['C4', 'Eb4', 'G4'] },
      { bass: 'Ab1', chord: ['Ab3', 'C4', 'Eb4'] },
      { bass: 'Eb2', chord: ['Eb4', 'G4', 'Bb4'] },
      { bass: 'Bb1', chord: ['Bb3', 'D4', 'F4'] },
    ],
  },
  victory: {
    bpm: 96,
    bars: [
      { bass: 'F2', chord: ['F4', 'A4', 'C5'] },
      { bass: 'C2', chord: ['C4', 'E4', 'G4'] },
      { bass: 'G1', chord: ['G3', 'B3', 'D4'] },
      { bass: 'C2', chord: ['C4', 'E4', 'G4'] },
    ],
  },
};

/** Fixed 16-step patterns. Never varied — the grid is the identity. */
const PATTERN = {
  bass:  [0, 3, 8, 11],
  kick:  [0, 8],
  snare: [4, 12],
  hat:   [2, 6, 10, 14],
  arp:   [0, 2, 4, 6, 8, 10, 12, 14],
};

/** Synth recipes used when a sample is unavailable, keyed by sample name. */
const SYNTH = {
  jump:        'sweep:330:760:0.15:square:0.20',
  doubleJump:  'sweep:500:1010:0.17:triangle:0.18',
  land:        'noise:0.09:0.18:900:lowpass',
  dash:        'noise:0.17:0.16:2400:highpass',
  coin:        'arp:1318,1975:0.055:0.14',
  stomp:       'sweep:430:110:0.13:square:0.22',
  enemyPop:    'noise:0.22:0.22:1300:bandpass',
  checkpoint:  'arp:523,659,784,1046:0.075:0.13',
  hurt:        'sweep:420:90:0.32:sawtooth:0.22',
  death:       'sweep:320:55:0.75:sawtooth:0.24',
  levelClear:  'arp:523,659,784,1046,1318:0.09:0.15',
  victory:     'arp:523,659,784,1046,1318,1568:0.11:0.16',
  uiSelect:    'arp:880:0.0:0.13',
  uiMove:      'arp:660:0.0:0.09',
  grappleFire:    'noise:0.14:0.15:1900:highpass',
  grappleRelease: 'noise:0.10:0.11:2600:highpass',
  grappleHit:     'noise:0.11:0.20:1500:bandpass',
  crumble:        'noise:0.36:0.22:700:lowpass',
  landHeavy:      'noise:0.20:0.24:480:lowpass',
  // the metronome the rhythm platforms step to, and its warning
  rhythmTick:     'noise:0.045:0.30:3400:highpass',
  rhythmWarn:     'sweep:1180:620:0.11:triangle:0.22',
};

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.musicBus = null;
    this.sfxBus = null;
    this.samples = new Map();
    this.noiseBuffer = null;

    this.musicVolume = AUDIO.defaultMusic;
    this.sfxVolume = AUDIO.defaultSfx;
    this.muted = false;

    this.theme = null;
    this.themeName = null;
    this.playing = false;
    this._step = 0;
    this._nextStepTime = 0;
    this._musicOrigin = null;
    this._clockSource = null;
    this._fallbackBpm = 104;
    this._timer = null;
    this._started = false;
  }

  // ---- lifecycle -----------------------------------------------------------

  init() {
    if (this.ctx) return this.ctx;
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) {
      console.warn('[audio] Web Audio unavailable — running silent');
      return null;
    }
    this.ctx = new Ctor();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 1;
    this.master.connect(this.ctx.destination);

    this.musicBus = this.ctx.createGain();
    this.musicBus.gain.value = this.musicVolume;
    this.musicBus.connect(this.master);

    this.sfxBus = this.ctx.createGain();
    this.sfxBus.gain.value = this.sfxVolume;
    this.sfxBus.connect(this.master);

    const len = Math.floor(this.ctx.sampleRate * 1.0);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    this.noiseBuffer = buf;
    return this.ctx;
  }

  /** Browsers keep the context suspended until a gesture; call on first input. */
  resume() {
    if (!this.ctx) this.init();
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
  }

  setSamples(map) { this.samples = map; }

  setMusicVolume(v) {
    this.musicVolume = Math.max(0, Math.min(1, v));
    if (this.musicBus) this.musicBus.gain.value = this.musicVolume;
  }

  setSfxVolume(v) {
    this.sfxVolume = Math.max(0, Math.min(1, v));
    if (this.sfxBus) this.sfxBus.gain.value = this.sfxVolume;
  }

  setMuted(m) {
    this.muted = !!m;
    if (this.master) this.master.gain.value = this.muted ? 0 : 1;
  }

  get ready() { return !!(this.ctx && this.ctx.state === 'running'); }

  /**
   * Musical position, measured in 16th-note steps since the score started.
   * Anything that wants to move *with* the music asks for this.
   *
   * The clock is anchored to the audio clock when it is running and to the wall
   * clock otherwise, so rhythm mechanics keep stepping even when audio is
   * unavailable or still waiting for a user gesture — they just stop being
   * sample-accurate, which nobody can tell for a blinking platform.
   */
  beatClock() {
    const bpm = this.theme?.bpm ?? this._fallbackBpm;
    const stepDur = 60 / bpm / 4;
    const running = this.ready;
    const source = running ? 'audio' : 'wall';
    const now = running ? this.ctx.currentTime : performance.now() / 1000;
    if (this._musicOrigin === null || this._clockSource !== source) {
      this._musicOrigin = now;
      this._clockSource = source;
    }
    const step = (now - this._musicOrigin) / stepDur;
    return { step, beat: step / 4, bpm, stepDur };
  }

  /**
   * Semitone offsets (from C4) of the chord sounding right now. Anything that
   * wants to play *in key* asks for this — the tone bars do, which is why
   * running across them is always consonant with the score underneath.
   */
  currentChord() {
    const theme = this.theme ?? THEMES.level1;
    const bars = theme.bars;
    const bar = Math.floor(this.beatClock().step / 16) % bars.length;
    return bars[bar].chord.map((n) => noteToMidi(n) - 60);
  }

  /**
   * Play a sound re-pitched by semitones. With no sample loaded it synthesises a
   * struck tone instead, so the tone bars still sing when assets are absent.
   */
  playPitched(name, semitones, opts = {}) {
    const rate = Math.pow(2, semitones / 12);
    if (this.samples.get(name) || !this.ctx) {
      this.play(name, { ...opts, rate });
      return;
    }
    if (!this.ready || this.muted) return;
    const vol = opts.volume ?? 0.4;
    const freq = 523.25 * rate; // the absolute pitch is arbitrary; intervals are not
    const t = this.ctx.currentTime;
    this._blip(t, freq, 0.5, vol * 0.5, 'triangle');
    this._blip(t, freq * 2.01, 0.28, vol * 0.18, 'sine');
  }

  // ---- one-shot sound effects ---------------------------------------------

  /**
   * @param {string} name key in SOUNDS
   * @param {{volume?:number, rate?:number}} [opts]
   */
  play(name, opts = {}) {
    if (!this.ctx || this.muted) return;
    if (this.ctx.state === 'suspended') return; // no gesture yet
    const vol = opts.volume ?? 1;
    const sample = this.samples.get(name);
    if (sample) {
      const src = this.ctx.createBufferSource();
      src.buffer = sample;
      src.playbackRate.value = opts.rate ?? 1;
      const g = this.ctx.createGain();
      g.gain.value = vol;
      src.connect(g).connect(this.sfxBus);
      src.start();
      return;
    }
    this._playSynth(name, vol);
  }

  /** Deliberately jittered variants so repeated sounds don't fatigue the ear. */
  playVaried(name, { volume = 1, spread = 0.06 } = {}) {
    this.play(name, { volume, rate: 1 + (Math.random() * 2 - 1) * spread });
  }

  _playSynth(name, volume = 1) {
    const recipe = SYNTH[name];
    const t = this.ctx.currentTime;
    if (!recipe) { this._blip(t, 700, 0.06, 0.1 * volume); return; }
    const [kind, ...rest] = recipe.split(':');
    if (kind === 'sweep') {
      const [from, to, dur, type, gain] = rest;
      this._sweep(t, { from: +from, to: +to, dur: +dur, type, gain: +gain * volume });
    } else if (kind === 'noise') {
      const [dur, gain, freq, type] = rest;
      this._noise(t, { dur: +dur, gain: +gain * volume, freq: +freq, type });
    } else if (kind === 'arp') {
      const [notes, spacing, gain] = rest;
      notes.split(',').forEach((f, i) => this._blip(t + i * (+spacing), +f, 0.16, +gain * volume));
    }
  }

  // ---- primitive voices ----------------------------------------------------

  _blip(time, freq, dur, gain, type = 'square') {
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, time);
    g.gain.setValueAtTime(0, time);
    g.gain.linearRampToValueAtTime(gain, time + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
    osc.connect(g).connect(this.sfxBus);
    osc.start(time);
    osc.stop(time + dur + 0.02);
  }

  _sweep(time, { from, to, dur, type = 'square', gain = 0.15 }) {
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, time);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), time + dur);
    g.gain.setValueAtTime(0, time);
    g.gain.linearRampToValueAtTime(gain, time + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
    osc.connect(g).connect(this.sfxBus);
    osc.start(time);
    osc.stop(time + dur + 0.03);
  }

  _noise(time, { dur, gain, freq, type = 'highpass', bus = null }) {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filt = this.ctx.createBiquadFilter();
    filt.type = type;
    filt.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, time);
    g.gain.linearRampToValueAtTime(gain, time + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
    src.connect(filt).connect(g).connect(bus ?? this.sfxBus);
    src.start(time);
    src.stop(time + dur + 0.02);
  }

  _musicTone(time, freq, dur, gain, type = 'square') {
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, time);
    g.gain.setValueAtTime(0, time);
    g.gain.linearRampToValueAtTime(gain, time + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
    osc.connect(g).connect(this.musicBus);
    osc.start(time);
    osc.stop(time + dur + 0.03);
  }

  _musicKick(time, gain = 0.5) {
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(130, time);
    osc.frequency.exponentialRampToValueAtTime(42, time + 0.13);
    g.gain.setValueAtTime(gain, time);
    g.gain.exponentialRampToValueAtTime(0.0001, time + 0.18);
    osc.connect(g).connect(this.musicBus);
    osc.start(time);
    osc.stop(time + 0.22);
  }

  // ---- generative score ----------------------------------------------------

  startMusic(themeName) {
    this.init();
    if (!this.ctx) return;
    if (this.playing && this.themeName === themeName) return;
    this.theme = THEMES[themeName] ?? THEMES.level1;
    this.themeName = themeName;
    if (this.playing) return; // keep the clock running, just swap harmony
    this.playing = true;
    this._step = 0;
    this._nextStepTime = this.ctx.currentTime + 0.08;
    // anchor the musical clock to the moment the score starts
    this._musicOrigin = null;
    this._tick();
    this._timer = setInterval(() => this._tick(), AUDIO.schedulerInterval * 1000);
  }

  stopMusic() {
    this.playing = false;
    this.theme = null;
    this.themeName = null;
    this._musicOrigin = null;
    if (this._timer) clearInterval(this._timer);
    this._timer = null;
  }

  /** Called every schedulerInterval; schedules any steps falling inside the window. */
  _tick() {
    if (!this.playing || !this.ctx || !this.theme) return;
    if (this.ctx.state !== 'running') return;
    const stepDur = 60 / this.theme.bpm / 4; // 16th notes
    const horizon = this.ctx.currentTime + AUDIO.schedulerAhead;
    let guard = 0;
    while (this._nextStepTime < horizon && guard++ < 64) {
      this._scheduleStep(this._step, this._nextStepTime);
      this._nextStepTime += stepDur;
      this._step++;
    }
  }

  _scheduleStep(step, time) {
    const s = step % 16;
    const bars = this.theme.bars;
    const bar = bars[Math.floor(step / 16) % bars.length];
    const chord = bar.chord.map(noteToFreq);
    const bass = noteToFreq(bar.bass);
    const stepDur = 60 / this.theme.bpm / 4;

    if (PATTERN.bass.includes(s)) {
      this._musicTone(time, bass * (s === 11 ? 1.5 : 1), stepDur * 2.2, 0.24, 'square');
    }
    if (PATTERN.kick.includes(s)) this._musicKick(time, 0.5);
    if (PATTERN.snare.includes(s)) this._noise(time, { dur: 0.12, gain: 0.16, freq: 1700, type: 'bandpass', bus: this.musicBus });
    if (PATTERN.hat.includes(s)) this._noise(time, { dur: 0.045, gain: 0.055, freq: 7000, type: 'highpass', bus: this.musicBus });
    if (PATTERN.arp.includes(s)) {
      const i = PATTERN.arp.indexOf(s);
      // up then down through the triad: a strict geometric figure
      const shape = [0, 1, 2, 1, 2, 1, 0, 1];
      const note = chord[shape[i % shape.length] % chord.length];
      this._musicTone(time, note * 2, stepDur * 1.5, 0.075, 'triangle');
    }
  }
}
