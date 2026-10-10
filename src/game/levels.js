/**
 * Level data. Pure data — no three.js, no DOM — so `tools/validate-levels.mjs`
 * can import this file in Node and check it.
 *
 * COORDINATES
 *   x grows to the right, y grows up, both in tiles.
 *   Rectangles: [x, y, w, h, color] — (x, y) is the BOTTOM-LEFT corner.
 *   Entities:   [x, y] — feet at (x + 0.5, y); coins are centred at (x + 0.5, y + 0.5).
 *
 * VOCABULARY
 *   solids      solid rectangles; `color` is 'white' | 'red' | 'blue' | 'yellow'
 *   oneWays     [x, y, w] thin platforms you can jump up through and land on
 *   movers      {x, y, w, axis, range, phase?} platforms that travel `range` tiles
 *   crumbles    [x, y, w] slabs that fall away a moment after you stand on them
 *   springs     [x, y] jump pads; `power` is in tiles of height
 *   spikes      [x, y, count] deadly spikes pointing up
 *   lava        [x, y, w, h] deadly rectangle
 *   coins       [x, y] collectible
 *   enemies     {type: 'walker'|'flyer'|'spiker', x, y, dir?}
 *   checkpoints [x, y]
 *   spawn       [x, y]
 *   goal        [x, y]
 *   triggers    {x, text} — fires a HUD message when the player passes this x
 *   paintings   {key, x, y, w, h} — a downloaded Mondrian canvas hung in the backdrop
 */

const line = (x, y, n, dx = 1, dy = 0) => Array.from({ length: n }, (_, i) => [x + i * dx, y + i * dy]);
/** a shallow arc of coins, good for marking a jump */
const arc = (x, y, n, height = 2) =>
  Array.from({ length: n }, (_, i) => [x + i, y + Math.round(Math.sin(((i + 0.5) / n) * Math.PI) * height)]);

// ===========================================================================
// I — PRIMARY FORMS
// Teaches: running, jumping, the double jump, stomping, springs, one-ways,
// moving platforms, spikes, lava, checkpoints.
// ===========================================================================
const LEVEL_1 = {
  id: 'level-1',
  numeral: 'I',
  name: 'PRIMARY FORMS',
  subtitle: 'white ground, three colours, one line at a time',
  theme: 'level1',
  seed: 1101,
  targetTime: 105,
  bounds: { w: 90, h: 22 },

  spawn: [2, 2],
  goal: [87, 2],
  checkpoints: [[40, 4], [68, 2]],

  solids: [
    [0, 0, 14, 2, 'white'],    // A — opening ground
    [18, 0, 10, 2, 'white'],   // B
    [32, 0, 14, 2, 'white'],   // C
    [38, 2, 8, 2, 'yellow'],   // C — raised slab, the level's colour accent
    [53, 0, 10, 2, 'white'],   // D
    [57, 4, 6, 2, 'white'],    // D — upper storey
    [67, 0, 10, 2, 'white'],   // E
    [77, 0, 13, 2, 'white'],   // F — finale ground
    [12, 2, 2, 3, 'red'],      // red step at the lip of the first pit
    [21, 5, 4, 1, 'red'],      // ledge above B
    [83, 2, 2, 3, 'blue'],     // blue step guarding the goal
  ],

  oneWays: [
    [55, 3, 3],   // up to D's upper storey
    [64, 3, 4],   // bridge over the third pit
    [70, 3, 3],   // stepping stones on E
  ],

  movers: [
    { x: 47, y: 4, w: 3, axis: 'x', range: 4 },        // crosses the lava between C and D
    { x: 60, y: 8, w: 3, axis: 'y', range: 4, phase: 0.5 },
  ],

  crumbles: [
    [15, 4, 2],   // risky shortcut over the first pit
  ],

  rhythms: [
    [28, 3, 4, 0],   // steps to the music, over the empty pit at x28-31
  ],

  toneBars: [
    [78, 2, 5],      // a run of pads on the final ground — they play in key
  ],

  springs: [
    [19, 2],      // launches you to the red ledge and the coin arc above B
  ],

  spikes: [
    [33, 2, 3],
    [72, 2, 2],
  ],

  lava: [
    [14, 0, 4, 1],
    [46, 0, 7, 1],
    [63, 0, 4, 1],
  ],

  coins: [
    ...arc(4, 3, 5, 2),
    ...line(19, 3, 2),
    ...arc(22, 7, 3, 1),
    ...arc(39, 6, 5, 2),
    ...line(48, 7, 3),
    ...arc(53, 4, 4, 2),
    ...line(60, 10, 3, 0, 1),
    ...arc(68, 4, 4, 2),
    ...line(78, 3, 4),
    ...arc(84, 7, 4, 2),
  ],

  enemies: [
    { type: 'walker', x: 10, y: 2, dir: -1 },
    { type: 'walker', x: 25, y: 2, dir: 1 },
    { type: 'flyer',  x: 42, y: 9 },
    { type: 'walker', x: 58, y: 2, dir: 1 },
    { type: 'walker', x: 69, y: 2, dir: -1 },
    { type: 'spiker', x: 80, y: 2, dir: 1 },
  ],

  triggers: [
    { x: 1,  text: 'MOVE WITH A / D — JUMP WITH SPACE' },
    { x: 18, text: 'HOLD JUMP TO GO HIGHER — TAP AGAIN IN MID-AIR' },
    { x: 26, text: 'THAT SLAB BLINKS ON THE BEAT — TIME IT, OR JUMP THE PIT' },
    { x: 33, text: 'STOMP FROM ABOVE — SPIKES AND LAVA HURT' },
    { x: 46, text: 'RIDE THE PLATFORM' },
    { x: 76, text: 'THE YELLOW PADS PLAY A NOTE — THE BEAT IS THE LEVEL' },
    { x: 67, text: 'CHECKPOINT — YOU RESPAWN HERE' },
    { x: 80, text: 'REACH THE COMPOSITION' },
  ],

  paintings: [
    { key: 'yellowBlueRed', x: 30, y: 17, w: 6.4, h: 6.8 },
  ],
};

// ===========================================================================
// II — THE GRID
// Teaches: wall slides and wall jumps, crumbling platforms, flyers and
// spikers, the dash, long gaps.
// ===========================================================================
const LEVEL_2 = {
  id: 'level-2',
  numeral: 'II',
  name: 'THE GRID',
  subtitle: 'vertical lines, and the space between them',
  theme: 'level2',
  seed: 2202,
  targetTime: 140,
  bounds: { w: 104, h: 28 },

  spawn: [2, 2],
  goal: [101, 2],
  checkpoints: [[38, 2], [58, 12], [84, 2]],

  solids: [
    [0, 0, 16, 2, 'white'],     // A
    [16, 2, 2, 3, 'red'],       // red stepping block at the pit lip
    [24, 0, 12, 2, 'white'],    // B
    [36, 0, 8, 2, 'white'],     // shaft — floor (walk in at ground level)
    [36, 4, 2, 8, 'blue'],      // shaft — left wall, open below y4 so you can enter
    [42, 4, 2, 8, 'blue'],      // shaft — right wall
    [36, 12, 2, 1, 'yellow'],   // a ledge on the left wall's top; the climb exits
                                // over the right wall, so the shaft stays open
    [58, 10, 10, 2, 'white'],   // C
    [84, 0, 6, 2, 'white'],     // D1
    [94, 0, 10, 2, 'white'],    // D2
  ],

  oneWays: [
    [68, 9, 4],   // descent from C (the middle link is now a rhythm platform)
    [78, 5, 4],
    [92, 6, 3],   // optional stepping stone over the last gap
  ],

  movers: [
    { x: 19, y: 5, w: 3, axis: 'x', range: 3 },
    { x: 82, y: 6, w: 3, axis: 'y', range: 4, phase: 0.35 },
  ],

  crumbles: [
    [46, 12, 2],  // the run across the lava, level with the shaft cap
    [50, 13, 2],
    [54, 12, 2],
  ],

  rhythms: [
    [73, 7, 4, 1.5],   // the middle link of the descent, half a cycle out of phase
    [90, 3, 4, 0],     // a timed crossing of the last lava gap
  ],

  toneBars: [
    [28, 2, 5],        // on B, between the spikes and the spring
  ],

  springs: [
    [34, 2],
  ],

  spikes: [
    [26, 2, 2],
    [99, 2, 2],
  ],

  lava: [
    [18, 0, 6, 1],
    [46, 0, 12, 1],
    [90, 0, 4, 1],
  ],

  coins: [
    ...arc(5, 3, 5, 2),
    ...line(20, 7, 3),
    ...line(27, 4, 2),
    ...line(34, 4, 2, 0, 1),
    ...arc(38, 4, 4, 3),      // up the inside of the shaft
    ...line(38, 8, 4, 0, 1),
    ...arc(47, 14, 3, 1),     // above the crumbling run
    ...line(51, 15, 3),
    ...arc(59, 13, 4, 2),
    ...line(69, 11, 3),
    ...line(79, 7, 3),
    ...arc(85, 4, 4, 2),
    ...line(93, 7, 3),
    ...arc(95, 3, 4, 2),
  ],

  enemies: [
    { type: 'walker', x: 8, y: 2, dir: 1 },
    { type: 'flyer',  x: 30, y: 7 },
    { type: 'walker', x: 60, y: 12, dir: -1 },
    { type: 'flyer',  x: 64, y: 16 },
    { type: 'spiker', x: 87, y: 2, dir: -1 },
    { type: 'walker', x: 98, y: 2, dir: -1 },
    { type: 'flyer',  x: 75, y: 9 },
  ],

  triggers: [
    { x: 1,  text: 'THE GRID — HOLD TOWARD A WALL TO SLIDE' },
    { x: 36, text: 'JUMP OFF A WALL TO CLIMB THE SHAFT' },
    { x: 46, text: 'THESE BLOCKS FALL AWAY — KEEP MOVING' },
    { x: 88, text: 'THAT SLAB BLINKS ON THE BEAT — IT WILL NOT WAIT' },
    { x: 62, text: 'SHIFT / X TO DASH THROUGH A GAP' },
    { x: 88, text: 'DASH, THEN DOUBLE JUMP' },
  ],

  paintings: [
    { key: 'composition1929', x: 30, y: 19, w: 6.0, h: 6.0 },
    { key: 'roodGeelBlauw',   x: 70, y: 21, w: 5.6, h: 5.9 },
  ],
};

// ===========================================================================
// III — BROADWAY BOOGIE WOOGIE
// The finale: a lava sea, everything at once, a gallery of canvases overhead.
// ===========================================================================
const LEVEL_3 = {
  id: 'level-3',
  numeral: 'III',
  name: 'BOOGIE WOOGIE',
  subtitle: 'the grid breaks into rhythm',
  theme: 'level3',
  seed: 3303,
  targetTime: 170,
  bounds: { w: 124, h: 26 },

  spawn: [2, 4],
  goal: [120, 14],
  checkpoints: [[32, 15], [72, 17], [106, 15]],

  solids: [
    [0, 2, 14, 2, 'white'],     // start ledge
    [16, 4, 12, 1, 'white'],    // approach + chimney floor, one unbroken surface
    [22, 7, 2, 7, 'red'],       // chimney — left wall, held up at y7 so you walk in under it
    [28, 5, 2, 9, 'blue'],      // chimney — right wall, solid to the floor
    [32, 14, 6, 1, 'white'],    // the ledge you wall-jump out onto
    [50, 15, 6, 1, 'white'],
    [72, 16, 8, 1, 'blue'],     // long blue slab
    [96, 15, 6, 1, 'white'],
    [106, 14, 6, 1, 'white'],
    [116, 12, 8, 2, 'white'],   // final ground
  ],

  oneWays: [
    [8, 7, 4],
    [68, 20, 4],
    [100, 20, 4],
  ],

  movers: [
    { x: 40, y: 15, w: 3, axis: 'x', range: 6 },
    { x: 56, y: 19, w: 3, axis: 'y', range: 3, phase: 0.25 },
    { x: 82, y: 16, w: 4, axis: 'x', range: 8, phase: 0.5 },
  ],

  crumbles: [
    [58, 16, 2],
    [62, 17, 2],
    [66, 16, 2],
  ],

  rhythms: [
    // the low route across the grapple gap, for a player who would rather keep
    // time than aim a rope. The two are half a cycle apart, so one is usually up.
    [69, 16, 3, 0],
    [73, 16, 3, 2.5],
  ],

  toneBars: [
    [51, 16, 4],       // on the shelf past the chimney
  ],

  springs: [
    [34, 15],
    [98, 16],
  ],

  spikes: [
    [76, 17, 2],
    [118, 14, 2],
  ],

  lava: [
    [0, 0, 124, 1],   // the whole level floats over a lava sea
  ],

  coins: [
    ...arc(3, 5, 5, 2),
    ...line(8, 8, 4),
    ...arc(17, 6, 3, 1),
    ...line(25, 7, 4, 0, 1),
    ...line(34, 18, 3, 0, 1),
    ...line(41, 17, 4),
    ...arc(51, 18, 3, 1),
    ...line(56, 21, 3, 0, 1),
    ...arc(59, 18, 3, 1),
    ...line(68, 18, 3),
    ...arc(73, 19, 4, 2),
    ...line(83, 18, 4),
    ...arc(97, 18, 4, 2),
    ...line(101, 21, 2, 0, 1),
    ...arc(108, 17, 4, 2),
    ...line(117, 16, 3),
  ],

  enemies: [
    { type: 'walker', x: 5, y: 4, dir: 1 },
    { type: 'flyer',  x: 20, y: 10 },
    { type: 'spiker', x: 74, y: 17, dir: -1 },
    { type: 'flyer',  x: 66, y: 21 },
    { type: 'walker', x: 98, y: 16, dir: 1 },
    { type: 'flyer',  x: 104, y: 19 },
  ],

  triggers: [
    { x: 1,   text: 'BOOGIE WOOGIE — EVERYTHING AT ONCE' },
    { x: 21,  text: 'ALTERNATE WALL JUMPS TO CLIMB' },
    { x: 34,  text: 'THE SPRING THROWS YOU HIGH' },
    { x: 66,  text: 'TIME THE PADS, OR TAKE THE ROPE — BOTH WORK' },
    { x: 106, text: 'ONE LAST RUN' },
  ],

  paintings: [
    { key: 'noIii',  x: 20, y: 19, w: 6.6, h: 8.0 },
    { key: 'noIv',   x: 58, y: 22, w: 6.4, h: 8.4 },
    { key: 'yellowBlueRed', x: 100, y: 20, w: 7.0, h: 7.4 },
  ],
};

export const LEVELS = [LEVEL_1, LEVEL_2, LEVEL_3];

const LEVEL_BY_ID = Object.fromEntries(LEVELS.map((l) => [l.id, l]));

export function getLevel(id) {
  return LEVEL_BY_ID[id] ?? LEVELS[0];
}

export function levelIndex(id) {
  return LEVELS.findIndex((l) => l.id === id);
}

/** Normalises a level definition so consumers never have to guard for absent keys. */
export function normalizeLevel(def) {
  return {
    ...def,
    solids: def.solids ?? [],
    oneWays: def.oneWays ?? [],
    movers: def.movers ?? [],
    crumbles: def.crumbles ?? [],
    rhythms: def.rhythms ?? [],
    toneBars: def.toneBars ?? [],
    springs: def.springs ?? [],
    spikes: def.spikes ?? [],
    lava: def.lava ?? [],
    coins: def.coins ?? [],
    enemies: def.enemies ?? [],
    checkpoints: def.checkpoints ?? [],
    triggers: def.triggers ?? [],
    paintings: def.paintings ?? [],
  };
}

export { line, arc };
