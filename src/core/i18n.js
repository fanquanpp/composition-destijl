/**
 * Localisation.
 *
 * Two lookups, deliberately:
 *
 *   t(key)          UI chrome — short, reused, stable keys ('hud.coins').
 *   tSource(text)   Content that lives in the data files (level names, the
 *                   in-world hint lines). Keyed by the English source string, so
 *                   the level data never has to know about locales and a missing
 *                   translation degrades to readable English rather than to a
 *                   raw key.
 *
 * Both fall back to English, then to the key itself. Nothing here throws on a
 * missing string, because a missing string should never be able to break the UI.
 */

/** Locale setting values. 'auto' follows the browser. */
export const LOCALES = [
  { code: 'auto', label: 'Auto' },
  { code: 'en', label: 'English' },
  { code: 'zh', label: '简体中文' },
];

const EN = {
  // ---- document ----------------------------------------------------------
  'doc.title': 'COMPOSITION — a De Stijl platformer',
  'doc.description': 'A platformer rendered as a De Stijl composition: primary colours, black grid lines, flat planes. Built with three.js.',

  // ---- boot --------------------------------------------------------------
  'boot.subtitle': 'a de stijl platformer',
  'boot.loading': 'loading {label}…',
  'boot.ready': 'ready',
  'boot.failed': 'failed to start: {msg}',

  // ---- hud ---------------------------------------------------------------
  'hud.level': 'Level',
  'hud.coins': 'Coins',
  'hud.score': 'Score',
  'hud.time': 'Time',
  'hud.lives': 'Lives',
  'hud.move': 'move',
  'hud.jump': 'jump / double jump',
  'hud.dash': 'dash',
  'hud.pause': 'pause',
  'hud.mute': 'mute',

  // ---- title screen ------------------------------------------------------
  'title.eyebrow': 'A platformer in primary colours',
  'title.lede': 'Three levels built from flat rectangles and black lines. Run, double jump, wall jump and dash through the grid — the whole world is a De Stijl canvas you can stand on.',
  'title.chip.levels': '3 levels',
  'title.chip.moves': 'wall jump + dash',
  'title.chip.input': 'keyboard · gamepad · touch',
  'title.chip.best': 'best total {n}',
  'title.play': 'Play',
  'title.continue': 'Continue',
  'title.levels': 'Level select',
  'title.howto': 'How to play',
  'title.settings': 'Settings',
  'title.credits': 'Credits',
  'title.caption': 'Piet Mondrian · Composition No. IV · public domain',

  // ---- level select ------------------------------------------------------
  'levels.eyebrow': 'Select a level',
  'levels.title': 'The <span class="accent">grid</span>',
  'levels.lede': 'Clearing a level unlocks the next. Scores, times and coin counts are kept per level. A medal is awarded for beating the target time — gold at 70% of it, silver at 100%, bronze at 140%.',
  'levels.stat.score': 'Best score',
  'levels.stat.time': 'Best time',
  'levels.stat.coins': 'Coins',
  'levels.stat.target': 'Target',
  'levels.medal.none': 'NO MEDAL',
  'levels.medal.gold': 'GOLD',
  'levels.medal.silver': 'SILVER',
  'levels.medal.bronze': 'BRONZE',
  'levels.badge.cleared': 'Cleared',
  'levels.badge.locked': 'Locked',
  'levels.badge.play': 'Play',
  'levels.back': 'Back to title',

  // ---- how to play -------------------------------------------------------
  'howto.eyebrow': 'Controls',
  'howto.title': 'How to <span class="accent">play</span>',
  'howto.move': 'Move left and right. Arrow keys work too.',
  'howto.jump': 'Jump. Hold for height, release early for a short hop.',
  'howto.doubleJump': 'Press again in mid-air for the double jump.',
  'howto.dash': 'Dash — a short burst that crosses wide gaps.',
  'howto.wall': 'Jump into a wall to slide, then jump again to climb it.',
  'howto.grapple': 'Fire the rope at the crosshair, then hold to reel in and swing. Release to keep your momentum. Level III only.',
  'howto.meta': 'Pause. R to restart the level, M to mute.',
  'howto.rules': '<strong>Stomp</strong> blue walkers and yellow flyers from above. <strong>Do not</strong> land on black spikers — they hurt from every direction. Spikes cost a heart; lava is instant death. Checkpoints are the white flags: touch one and it turns red. The white slabs with a blue stripe blink on the beat — time them. The coloured pads set into the floor play a note when you land.',

  // ---- credits -----------------------------------------------------------
  'credits.eyebrow': 'Credits',
  'credits.title': 'Built <span class="accent">from</span>',
  'credits.lede': 'Every block, character, background composition and menu in this game is generated at runtime from flat rectangles. The downloads below are the only third-party files — the full list with sources is in assets/CREDITS.md.',
  'credits.missing': 'Note: {n} optional asset(s) could not be loaded ({list}). The game substituted its procedural fallbacks.',
  'credits.back': 'Back',
  'credits.what.three': 'MIT — the renderer this is built on',
  'credits.what.archivo': 'Omnibus-Type — titles',
  'credits.what.jost': 'indestructible type* — interface text',
  'credits.what.mono': 'Colophon Foundry — numerals',
  'credits.what.noto': 'Google / Adobe — Chinese text',
  'credits.what.mondrian': 'Five canvases (1914–1942), via Wikimedia Commons',
  'credits.pd': 'Public domain',
  'credits.what.deva': '8-bit Sound Effect Pack Vol. 001, via OpenGameArt',
  'credits.what.otherAudio': 'Metronome, bell and impact samples, via OpenGameArt',

  // ---- settings ----------------------------------------------------------
  'settings.eyebrow': 'Settings',
  'settings.title': 'Options',
  'settings.music': 'Music',
  'settings.sfx': 'Effects',
  'settings.muted': 'Muted',
  'settings.muted.on': 'sound is off',
  'settings.muted.off': 'sound is on — press M anywhere',
  'settings.motion': 'Motion',
  'settings.motion.full': 'full — screen shake, speed zoom, full particles',
  'settings.motion.reduced': 'reduced — no screen shake, no speed zoom, fewer particles',
  'settings.motion.value.full': 'full',
  'settings.motion.value.reduced': 'low',
  'settings.language': 'Language',
  'settings.language.auto': 'follow the browser ({name})',
  'settings.unmute': 'Unmute',
  'settings.mute': 'Mute',
  'settings.fullMotion': 'Full motion',
  'settings.reduceMotion': 'Reduce motion',
  'settings.back': 'Back',
  'settings.clear': 'Clear progress',
  'settings.clearNote': 'Clearing progress erases unlocked levels and every best score. Settings are kept.',

  // ---- intro card --------------------------------------------------------
  'intro.level': 'Level {n}',
  'intro.coins': '{n} coins to find',
  'intro.enter': 'Enter to start',
  'intro.start': 'Start',

  // ---- pause -------------------------------------------------------------
  'pause.eyebrow': 'Paused',
  'pause.title': 'Level {n} — <span class="accent">{name}</span>',
  'pause.time': 'Time',
  'pause.score': 'Score',
  'pause.coins': 'Coins',
  'pause.resume': 'Resume',
  'pause.restart': 'Restart level',
  'pause.settings': 'Settings',
  'pause.levels': 'Level select',
  'pause.title2': 'Quit to title',

  // ---- level clear -------------------------------------------------------
  'clear.eyebrow': 'Level {n} complete',
  'clear.eyebrow.best': 'Level {n} complete — new best score',
  'clear.title': '{name} <span class="accent">solved</span>',
  'clear.row.coins': 'Coins collected',
  'clear.row.time': 'Time',
  'clear.row.target': 'Target',
  'clear.row.medal': 'Medal',
  'clear.row.timeBonus': 'Time bonus',
  'clear.row.clear': 'Level clear',
  'clear.row.flawless': 'No deaths',
  'clear.total': 'Total',
  'clear.next': 'Next level',
  'clear.finish': 'See the finale',
  'clear.replay': 'Replay',
  'clear.levels': 'Level select',

  // ---- game over ---------------------------------------------------------
  'gameover.eyebrow': 'Out of lives',
  'gameover.title': 'Level {n} — <span class="accent">unfinished</span>',
  'gameover.lede': 'The grid resets. Nothing is lost but the run.',
  'gameover.retry': 'Try again',
  'gameover.levels': 'Level select',
  'gameover.title2': 'Title',

  // ---- victory -----------------------------------------------------------
  'victory.eyebrow': 'All three levels cleared',
  'victory.title': 'The whole <span class="accent">composition</span>',
  'victory.lede': 'You have walked the grid end to end. Mondrian painted these rectangles for thirty years and never once used a diagonal; you spent an afternoon learning to respect them.',
  'victory.total': 'Grand total',
  'victory.stats': '{coins}/{total} coins · {deaths} deaths',
  'victory.levels': 'Level select',
  'victory.title2': 'Back to title',

  // ---- toasts ------------------------------------------------------------
  'toast.checkpoint': 'CHECKPOINT',
  'toast.locked': 'CLEAR THE PREVIOUS LEVEL FIRST',
  'toast.soundOff': 'SOUND OFF',
  'toast.soundOn': 'SOUND ON',
  'toast.progressCleared': 'PROGRESS CLEARED',
  'toast.motionReduced': 'MOTION REDUCED',
  'toast.motionFull': 'FULL MOTION',
  'toast.language': 'LANGUAGE: {name}',
};

const ZH = {
  'doc.title': 'COMPOSITION — 风格派平台跳跃游戏',
  'doc.description': '用 three.js 做的一款平台跳跃游戏，整个画面按风格派（De Stijl）规则构成：只有矩形与直线，只有红黄蓝三原色加黑白。',

  'boot.subtitle': '一款风格派平台跳跃游戏',
  'boot.loading': '正在加载 {label}…',
  'boot.ready': '就绪',
  'boot.failed': '启动失败：{msg}',

  'hud.level': '关卡',
  'hud.coins': '金币',
  'hud.score': '分数',
  'hud.time': '时间',
  'hud.lives': '生命',
  'hud.move': '移动',
  'hud.jump': '跳跃 / 二段跳',
  'hud.dash': '冲刺',
  'hud.pause': '暂停',
  'hud.mute': '静音',

  'title.eyebrow': '一款三原色平台跳跃游戏',
  'title.lede': '三个关卡，全部由平涂矩形和黑线构成。在网格里奔跑、二段跳、蹬墙跳、冲刺——整个世界就是一幅能站上去的风格派画作。',
  'title.chip.levels': '3 个关卡',
  'title.chip.moves': '蹬墙跳 + 冲刺',
  'title.chip.input': '键盘 · 手柄 · 触屏',
  'title.chip.best': '最佳总分 {n}',
  'title.play': '开始游戏',
  'title.continue': '继续游戏',
  'title.levels': '选择关卡',
  'title.howto': '玩法说明',
  'title.settings': '设置',
  'title.credits': '素材与致谢',
  'title.caption': '皮特·蒙德里安 ·《构成第四号》· 公有领域',

  'levels.eyebrow': '选择关卡',
  'levels.title': '关卡<span class="accent">网格</span>',
  'levels.lede': '通关后解锁下一关。每关分别记录分数、用时与金币数。低于目标时间即可获得奖牌——70% 以内金牌，100% 以内银牌，140% 以内铜牌。',
  'levels.stat.score': '最佳分数',
  'levels.stat.time': '最佳用时',
  'levels.stat.coins': '金币',
  'levels.stat.target': '目标时间',
  'levels.medal.none': '无奖牌',
  'levels.medal.gold': '金牌',
  'levels.medal.silver': '银牌',
  'levels.medal.bronze': '铜牌',
  'levels.badge.cleared': '已通关',
  'levels.badge.locked': '未解锁',
  'levels.badge.play': '开始',
  'levels.back': '返回标题',

  'howto.eyebrow': '操作',
  'howto.title': '怎么<span class="accent">玩</span>',
  'howto.move': '左右移动，方向键同样可用。',
  'howto.jump': '跳跃。按住跳得更高，早松手则是小跳。',
  'howto.doubleJump': '空中再按一次，二段跳。',
  'howto.dash': '冲刺——短距离爆发，可以跨过很宽的沟。',
  'howto.wall': '跳向墙面会贴住滑行，再跳一次就能蹬墙往上爬。',
  'howto.grapple': '朝准心射出抓钩，挂住后按住收绳摆荡，松手保留全部动量。仅第三关可用。',
  'howto.meta': '暂停。R 重开本关，M 静音。',
  'howto.rules': '从上方踩死蓝色方块与黄色飞行敌。<strong>不要</strong>踩黑色的带刺方块——它每一面都会伤到你。尖刺扣一颗心，岩浆直接死亡。白旗是存档点，碰一下会变红。带蓝色条纹的白色板会跟着节拍闪烁，要掐准时机。地面上那些彩色嵌块踩上去会响一个音。',

  'credits.eyebrow': '致谢',
  'credits.title': '由这些<span class="accent">构成</span>',
  'credits.lede': '游戏里的每一个方块、角色、背景构图与菜单，都是运行时用平涂矩形生成的。下面这些下载文件是仅有的第三方素材，完整来源清单见 assets/CREDITS.md。',
  'credits.missing': '注意：有 {n} 个可选素材未能加载（{list}），游戏已自动改用程序化替代方案。',
  'credits.back': '返回',
  'credits.what.three': 'MIT —— 本项目的渲染引擎',
  'credits.what.archivo': 'Omnibus-Type —— 标题字体',
  'credits.what.jost': 'indestructible type* —— 界面字体',
  'credits.what.mono': 'Colophon Foundry —— 数字字体',
  'credits.what.noto': 'Google / Adobe —— 中文字体',
  'credits.what.mondrian': '五幅画作（1914–1942），来自 Wikimedia Commons',
  'credits.pd': '公有领域',
  'credits.what.deva': '8-bit Sound Effect Pack Vol. 001，来自 OpenGameArt',
  'credits.what.otherAudio': '节拍器、铃音与撞击音效，来自 OpenGameArt',

  'settings.eyebrow': '设置',
  'settings.title': '选项',
  'settings.music': '音乐',
  'settings.sfx': '音效',
  'settings.muted': '静音',
  'settings.muted.on': '声音已关闭',
  'settings.muted.off': '声音已开启——任意界面按 M 可切换',
  'settings.motion': '动效',
  'settings.motion.full': '完整——屏幕震动、速度变焦、完整粒子',
  'settings.motion.reduced': '减少——关闭屏幕震动与速度变焦，粒子数量降低',
  'settings.motion.value.full': '完整',
  'settings.motion.value.reduced': '减少',
  'settings.language': '语言',
  'settings.language.auto': '跟随浏览器（{name}）',
  'settings.unmute': '取消静音',
  'settings.mute': '静音',
  'settings.fullMotion': '完整动效',
  'settings.reduceMotion': '减少动效',
  'settings.back': '返回',
  'settings.clear': '清除进度',
  'settings.clearNote': '清除进度会删掉已解锁的关卡和所有最佳成绩，设置会保留。',

  'intro.level': '第 {n} 关',
  'intro.coins': '{n} 枚金币',
  'intro.enter': '按 Enter 开始',
  'intro.start': '开始',

  'pause.eyebrow': '已暂停',
  'pause.title': '第 {n} 关 — <span class="accent">{name}</span>',
  'pause.time': '用时',
  'pause.score': '分数',
  'pause.coins': '金币',
  'pause.resume': '继续',
  'pause.restart': '重开本关',
  'pause.settings': '设置',
  'pause.levels': '选择关卡',
  'pause.title2': '退出到标题',

  'clear.eyebrow': '第 {n} 关完成',
  'clear.eyebrow.best': '第 {n} 关完成 — 新的最高分',
  'clear.title': '{name} <span class="accent">通关</span>',
  'clear.row.coins': '收集金币',
  'clear.row.time': '用时',
  'clear.row.target': '目标时间',
  'clear.row.medal': '奖牌',
  'clear.row.timeBonus': '时间奖励',
  'clear.row.clear': '通关奖励',
  'clear.row.flawless': '未死亡',
  'clear.total': '总计',
  'clear.next': '下一关',
  'clear.finish': '看结局',
  'clear.replay': '重玩',
  'clear.levels': '选择关卡',

  'gameover.eyebrow': '生命耗尽',
  'gameover.title': '第 {n} 关 — <span class="accent">未完成</span>',
  'gameover.lede': '网格重置。除了这一趟，什么都没丢。',
  'gameover.retry': '再试一次',
  'gameover.levels': '选择关卡',
  'gameover.title2': '标题',

  'victory.eyebrow': '三关全部通关',
  'victory.title': '整幅<span class="accent">构成</span>',
  'victory.lede': '你从网格的这一头走到了那一头。蒙德里安画了三十年这些矩形，一次都没有用过斜线；你用了一个下午学会尊重它们。',
  'victory.total': '总计',
  'victory.stats': '{coins}/{total} 枚金币 · 死亡 {deaths} 次',
  'victory.levels': '选择关卡',
  'victory.title2': '返回标题',

  'toast.checkpoint': '存档点',
  'toast.locked': '请先通关上一关',
  'toast.soundOff': '已静音',
  'toast.soundOn': '声音开启',
  'toast.progressCleared': '进度已清除',
  'toast.motionReduced': '已减少动效',
  'toast.motionFull': '完整动效',
  'toast.language': '语言：{name}',
};

/**
 * Content strings that live in the level data, keyed by their English source.
 * Anything absent here simply stays English.
 */
const SOURCE = {
  en: {},
  zh: {
    // level names + subtitles
    'PRIMARY FORMS': '原色构成',
    'white ground, three colours, one line at a time': '白底、三原色，一次一条线',
    'THE GRID': '网格',
    'vertical lines, and the space between them': '竖线，以及线之间的空隙',
    'BOOGIE WOOGIE': '布吉乌吉',
    'the grid breaks into rhythm': '网格碎成节奏',

    // in-world hints
    'MOVE WITH A / D — JUMP WITH SPACE': '用 A / D 移动 — 空格跳跃',
    'HOLD JUMP TO GO HIGHER — TAP AGAIN IN MID-AIR': '按住跳跃可以跳更高 — 空中再按一次是二段跳',
    'THAT SLAB BLINKS ON THE BEAT — TIME IT, OR JUMP THE PIT': '那块板跟着节拍闪烁 — 掐准时机，或者直接跳过坑',
    'STOMP FROM ABOVE — SPIKES AND LAVA HURT': '从上方踩死敌人 — 尖刺和岩浆会伤到你',
    'RIDE THE PLATFORM': '站上移动平台',
    'THE YELLOW PADS PLAY A NOTE — THE BEAT IS THE LEVEL': '黄色嵌块会发一个音 — 节拍就是这一关',
    'CHECKPOINT — YOU RESPAWN HERE': '存档点 — 死后从这里复活',
    'REACH THE COMPOSITION': '抵达那幅构成',
    'THE GRID — HOLD TOWARD A WALL TO SLIDE': '网格 — 朝墙面按住方向键可以贴墙滑行',
    'JUMP OFF A WALL TO CLIMB THE SHAFT': '蹬墙往上跳，爬出竖井',
    'THESE BLOCKS FALL AWAY — KEEP MOVING': '这些方块会塌 — 别停',
    'THAT SLAB BLINKS ON THE BEAT — IT WILL NOT WAIT': '那块板跟着节拍闪烁 — 它不会等你',
    'SHIFT / X TO DASH THROUGH A GAP': 'Shift / X 冲刺，跨过缺口',
    'DASH, THEN DOUBLE JUMP': '先冲刺，再二段跳',
    'BOOGIE WOOGIE — EVERYTHING AT ONCE': '布吉乌吉 — 所有机制一起来',
    'ALTERNATE WALL JUMPS TO CLIMB': '左右交替蹬墙，往上爬',
    'THE SPRING THROWS YOU HIGH': '弹簧会把你抛得很高',
    'TIME THE PADS, OR TAKE THE ROPE — BOTH WORK': '掐准嵌块的时机，或者用抓钩 — 两条路都行',
    'ONE LAST RUN': '最后一段',
  },
};

const TABLES = { en: EN, zh: ZH };

const isZh = (tag) => typeof tag === 'string' && /^zh/i.test(tag);

function browserLocale() {
  if (typeof navigator === 'undefined') return 'en';
  const tags = navigator.languages?.length ? navigator.languages : [navigator.language];
  for (const tag of tags) if (isZh(tag)) return 'zh';
  return 'en';
}

/** Resolves the saved setting ('auto' | 'en' | 'zh') to a real locale. */
export function resolveLocale(setting) {
  if (setting === 'en' || setting === 'zh') return setting;
  return browserLocale();
}

let current = 'en';
const listeners = new Set();

export function getLocale() { return current; }

export function setLocale(setting) {
  const next = resolveLocale(setting);
  if (next === current) return false;
  current = next;
  if (typeof document !== 'undefined') {
    document.documentElement.lang = next === 'zh' ? 'zh-Hans' : 'en';
  }
  for (const fn of listeners) {
    try { fn(next); } catch (err) { console.error('[i18n] listener failed', err); }
  }
  return true;
}

/** Subscribe to locale changes. Returns an unsubscribe function. */
export function onLocaleChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

const interpolate = (s, params) => (params
  ? s.replace(/\{(\w+)\}/g, (_, k) => (params[k] ?? `{${k}}`))
  : s);

/** UI chrome lookup. */
export function t(key, params) {
  const table = TABLES[current] ?? EN;
  const s = table[key] ?? EN[key] ?? key;
  return interpolate(s, params);
}

/** Content lookup, keyed by the English source string from the level data. */
export function tSource(text, params) {
  if (!text) return text;
  const table = SOURCE[current];
  const s = (table && table[text]) || text;
  return interpolate(s, params);
}

/** Human-readable name of a locale code, for the settings screen. */
export function localeName(code) {
  return code === 'zh' ? '简体中文' : 'English';
}
