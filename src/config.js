/**
 * Central tuning + palette. Every magic number the game feels with lives here so
 * the feel can be adjusted without hunting through systems.
 */

/** De Stijl palette. Mondrian's own approximations, not web primaries. */
export const PALETTE = {
  white:  0xffffff,
  paper:  0xf2efe6, // warm off-white used for the sky plane
  black:  0x0d0d0d,
  red:    0xd40920,
  blue:   0x0b4ea2,
  yellow: 0xf7d117,
  ink:    0x141414,
};

/** Simulation runs on a fixed step; rendering interpolates nothing (it's cheap). */
export const SIM = {
  fixedStep: 1 / 120,
  maxStepsPerFrame: 6,
  maxFrameTime: 1 / 15, // clamp so a tab-switch can't fast-forward the world
};

/** Geometry thickness constants for the De Stijl look. */
export const STYLE = {
  /** how far the black frame sticks out past a coloured block, per side */
  outline: 0.055,
  /** gameplay depth (z thickness) of a solid block */
  depth: 1.0,
  /** z of the gameplay plane */
  z: 0,
};

export const PLAYER = {
  width: 0.78,
  height: 0.98,

  runSpeed: 9.6,
  groundAccel: 82,
  groundDecel: 96,
  airAccel: 48,
  airDecel: 16,

  jumpSpeed: 20.4,
  /** velocity kept when the jump key is released early (variable jump height) */
  jumpCut: 0.42,
  /** grace period after walking off a ledge during which a jump still works */
  coyoteTime: 0.10,
  /** a jump pressed this long before landing still fires on landing */
  jumpBuffer: 0.13,

  doubleJumpSpeed: 17.4,
  maxAirJumps: 1,

  wallSlideSpeed: 5.6,
  wallJumpX: 11.6,
  wallJumpY: 18.8,
  /** time after a wall jump during which horizontal input is ignored */
  wallJumpLock: 0.16,

  dashSpeed: 27,
  dashTime: 0.15,
  dashCooldown: 0.42,

  stompBounce: 15.5,
  stompBounceHeld: 20.6,

  maxHearts: 3,
  invulnTime: 1.7,
  knockbackX: 7.5,
  knockbackY: 9.5,

  /** physics feel */
  gravity: 62,
  maxFallSpeed: 36,
  /** seconds the death animation plays before the level resets */
  deathPause: 0.45,

  // --- jump-arc shaping -----------------------------------------------------
  // The shape of the arc, not just its height, is what makes a jump feel good.
  // Borrowed in spirit from the movement model in speed-rouge (see
  // REFERENCE-REPOS.md): float at the top, fall fast, never lose momentum you
  // earned from a dash, a spring or the rope.
  /** gravity multiplier while rising with the button held */
  riseHold: 0.82,
  /** gravity multiplier within `apexWindow` of the top — this is the hang time */
  apexHang: 0.78,
  /** vertical speed below which a rising jump counts as being "at the apex" */
  apexWindow: 2.6,
  /** falling is heavier than rising, which is what makes a jump feel crisp */
  fallMultiplier: 1.28,
  /**
   * Fall gravity tapers toward terminal velocity as (1 - (v/maxFall)^2) instead
   * of hard-clamping, so the descent eases into its limit rather than hitting a
   * wall of drag.
   */
  fallTaper: 1.0,
  /**
   * Above run speed and still holding the same direction, input only *bleeds*
   * speed away at this rate instead of pulling back to run speed. This is what
   * lets a dash or a rope release carry you, rather than being erased the moment
   * you touch the stick.
   */
  overSpeedBleed: 0.55,
  /**
   * Air control scales from full authority at a standstill to this fraction at
   * run speed: slow means responsive, fast means committed.
   */
  airControlHigh: 0.45,
};

export const ENEMY = {
  walker: {
    width: 0.8, height: 0.8,
    speed: 2.7,
    color: 'blue',
    stompable: true,
    score: 50,
  },
  flyer: {
    width: 0.72, height: 0.72,
    speed: 1.9,
    amplitude: 1.6,
    period: 2.4,
    color: 'yellow',
    stompable: true,
    score: 75,
  },
  spiker: {
    width: 0.86, height: 0.86,
    speed: 1.7,
    color: 'black',
    stompable: false,
    score: 100,
  },
};

export const PICKUP = {
  coin: { size: 0.44, score: 10, spin: 3.2 },
};

export const MOVER = {
  /** travel distance in tiles when a level entry omits `range` */
  defaultRange: 3,
  speed: 2.6,
  /** seconds to wait at each end of the path */
  pauseTime: 0.55,
};

export const CRUMBLE = {
  /** seconds of warning shake before the block gives way */
  fuse: 0.7,
  respawnTime: 3.2,
};

export const SPRING = {
  power: 27,
  cooldown: 0.18,
};

/**
 * Grapple hook. The one mechanic borrowed from iifor/doodleshooter's design
 * (see REFERENCE-REPOS.md): hold to reel in, release to keep your momentum.
 *
 * The rope is a velocity constraint, not a position constraint — when the rope
 * is taut the outward radial component of velocity is removed, so the player
 * swings instead of being teleported and can never be shoved into geometry.
 */
export const GRAPPLE = {
  /** how far the hook can reach, in tiles */
  maxRange: 16,
  /** how fast the hook head travels out, units per second */
  fireSpeed: 110,
  /** radius of the hook head's collision probe */
  tipRadius: 0.16,
  /** pull acceleration toward the anchor while attached, units/s^2 */
  reelAccel: 58,
  /** how fast holding the button shortens the rope, units per second */
  reelSpeed: 13,
  /** hard cap on speed gained from reeling */
  maxReelSpeed: 30,
  /** rope can never be shorter than this */
  minLength: 1.5,
  /** damping applied to the radial velocity while swinging */
  radialDamping: 2.2,
  /** extra gravity while attached, so a swing actually swings */
  gravityScale: 0.85,
  /** seconds before the hook can be fired again */
  cooldown: 0.25,
  /** detach automatically when this close to the anchor */
  releaseDistance: 1.3,
  /** rope is drawn as this many dashes */
  ropeDashes: 9,
  /** seconds the missed hook takes to retract */
  retractTime: 0.12,
};

/**
 * Rhythm platforms. A slab that is solid on the beat, blinks a warning, then
 * vanishes — and comes back. Lifted from the timed-bridge idea in speed-rouge
 * (see REFERENCE-REPOS.md), with two changes: the cycle is measured in *musical
 * beats* of the generated score rather than in seconds, so the whole level
 * breathes with the music; and the warning is shown as a shrinking row of bars,
 * not just as a colour, so it still reads for a colour-blind player.
 */
export const RHYTHM = {
  /** beats the slab is solid before it warns */
  solidBeats: 3,
  /** beats it blinks a countdown while still walkable */
  warnBeats: 1,
  /** beats it is gone */
  goneBeats: 1,
  /** bars in the countdown; they disappear one per fraction of the warning */
  countdownBars: 3,
  /** metronome tick volume at zero distance */
  tickVolume: 0.34,
};

/**
 * Tone bars: surface pads that play a pitch when you land on them. The scale is
 * a major pentatonic, so any order the player runs them in is consonant.
 */
export const TONE = {
  /** semitone offsets from the root, one per bar index (repeats up an octave) */
  scale: [0, 2, 4, 7, 9, 12, 14, 16],
  /** root note as a MIDI number — A4 */
  root: 69,
  /** seconds before the same bar can retrigger */
  retrigger: 0.22,
  volume: 0.42,
};

/** Medal thresholds, as a fraction of a level's target time. */
export const MEDALS = {
  gold: 0.70,
  silver: 1.00,
  bronze: 1.40,
};

export const CAMERA = {
  /** world units visible vertically */
  viewHeight: 16.5,
  /** how far ahead of the player the camera leads, per unit of velocity */
  lookaheadX: 0.30,
  lookaheadY: 0.22,
  maxLookaheadX: 3.4,
  maxLookaheadY: 2.2,
  /** exponential follow smoothing (higher = snappier) */
  smoothing: 7.5,
  /** extra room kept between the view edge and the level edge */
  boundsPadding: 1.2,
  /** screen shake decay */
  shakeDecay: 5.5,
  /**
   * The view widens a little as the player gets fast, which gives speed a
   * physical feel and buys reaction time during a dash or a swing. Expressed as
   * multipliers on viewHeight at zero speed and at dash speed.
   */
  zoomAtRest: 1.0,
  zoomAtSpeed: 1.12,
  /** the speed that produces zoomAtSpeed, in units/s */
  zoomSpeed: 26,
  zoomSmoothing: 3.2,
};

export const SCORE = {
  coin: PICKUP.coin.score,
  checkpoint: 25,
  /** bonus per whole second left on the clock when a level is cleared */
  timeBonusPerSecond: 4,
  levelClear: 250,
  /** no-death clear bonus */
  flawless: 500,
};

export const AUDIO = {
  defaultMusic: 0.42,
  defaultSfx: 0.72,
  /** seconds of lookahead for the generative music scheduler */
  schedulerAhead: 0.12,
  schedulerInterval: 0.04,
};

export const STORAGE_KEY = 'composition.destijl.save.v1';

/** Level order, used by menus and progression. */
export const LEVEL_ORDER = ['level-1', 'level-2', 'level-3'];
