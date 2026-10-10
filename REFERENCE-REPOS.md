# 参考仓库调研报告

针对 `iifor/doodleshooter`、`C:\Atian\Project\speed-rouge`，以及若干其他 three.js 游戏仓库做了素材与代码调研。结论先说：**这三个来源里几乎没有可以直接搬进本项目的素材**，但 doodleshooter 的玩法设计有明确可借鉴之处，已经落地成下面的抓钩机制。

---

## 1. iifor/doodleshooter — 「Doodle District」

一个第一人称生存射击：圆珠笔手绘在横线笔记本纸上的画风，可以在屋顶之间用抓钩摆荡、把子弹用武士刀打回去、扔手雷、撑过一波波涂鸦怪。支持单人 / 多人（WebRTC + PeerJS 点对点）。

**素材盘点：0 个。**

```
文件类型统计：js=18  yml=1  py=1  md=1  json=1  html=1  css=1
二进制素材：  0 个（png/jpg/wav/mp3/ogg/glb/gltf/ttf 全部为 0）
```

它的 README 自己说明了原因：

> Everything you see is generated in code with three.js. There are no models, textures or sound files: the paper, the ink outlines, the hatching, the enemies and the music are all procedural.

所以「使用里面的素材」这件事在字面上不成立——它没有素材，全部是 4813 行运行时生成的代码。

**许可证：没有。** 仓库里没有 LICENSE 文件，GitHub API 返回的 `license` 字段是 `null`。没有许可证默认意味着**保留所有权利**，因此：

- ❌ 没有复制它的任何代码
- ✅ 借鉴了它的玩法设计（见第 4 节）

**它值得学的地方**（纯设计层面）：

| 设计 | 说明 | 是否已落地 |
| --- | --- | --- |
| 抓钩 | 按住摆荡、松开保持惯性 | ✅ 已实现（见第 4 节） |
| 蹬墙跳 / 二段跳 | 本项目的平台跳跃本来就有 | — 已有 |
| 滑铲 / 空中冲刺 | 本项目的冲刺已覆盖 | — 已有 |
| 每张地图一首生成式 8-bit 主题曲 | 本项目也是生成式配乐，思路一致 | — 已有 |
| 屏幕提示跟随「最后使用的设备」 | 本项目触屏按键已按设备出现 | — 已有 |
| 波次 + 每五波一个 Boss + 存档点 | 关卡节奏设计思路 | 部分（本项目用关卡分段） |
| 武士刀反弹子弹 | 不适合平台跳跃 | ✗ 未采用 |
| 手雷抛物线 | 同上 | ✗ 未采用 |

---

## 2. C:\Atian\Project\speed-rouge — 你自己的 Godot 项目

实际上是 `fanquanpp/geometric-construct`（Godot 4 项目，有 `project.godot`、`addons/`、`levels_native/`）。因为是你自己的仓库，跨项目复用是没问题的。

**素材盘点：**

| 文件 | 许可 | 能否用于本项目 |
| --- | --- | --- |
| `assets/fonts/NotoSansSC-VF.ttf` | SIL OFL 1.1（Adobe / Source） | 可以，但本项目 UI 是英文，暂时不需要 |
| `assets/fonts/LICENSE.txt` | — | 已确认是 OFL 1.1 |
| `assets/brand/icon_*.png`（4 个） | 你自己的 | 风格不搭（本项目是纯矩形） |
| `assets/editor/*.svg`（11 个） | 你自己的 | 是关卡编辑器图标，本项目没有编辑器 |
| `assets/tiles/*.png`（4 个，681–4671 字节） | 你自己的 | 位图瓦片，会破坏「无贴图」的风格约束 |

结论：**没有取用**。唯一有价值的是那个 OFL 中文字体——如果以后要给游戏加中文界面，可以直接复用（本项目 README 已经是中文，游戏内文案目前是英文，是刻意的美术选择）。

---

## 3. 其他 three.js 游戏仓库（GitHub 搜索）

按 star 排序筛了 `three.js game`、`threejs platformer`、`webgl game assets cc0` 三组关键词，逐个看许可证和素材构成：

| 仓库 | 许可证 | 素材情况 | 结论 |
| --- | --- | --- | --- |
| `SuboptimalEng/three-js-games` | NOASSERTION（不明确） | 有 mp3/obj/png，但含**明显第三方版权内容**（火影忍者的螺旋丸模型、贝多芬录音） | ❌ 不用。许可证不明 + 侵权风险 |
| `wwwtyro/Astray` | Unlicense（公有领域） | 3 张写实贴图（ball/brick/concrete） | ❌ 许可证干净，但写实贴图与「纯平涂矩形」风格完全冲突 |
| `EvanBacon/pillar-valley` | MIT | 等距建造游戏，有模型 | ❌ 风格冲突 |
| `TMHSDigital/Free-Game-Dev-Assets` | CC0-1.0 | **是素材目录，不是素材**（433 个 markdown 指向 Kenney / KayKit / Poly Haven / Quaternius 等 CC0 站点的链接） | ⚠️ 当索引用了，见下 |
| `jeromeetienne/threex` | MIT | three.js 扩展工具库 | ❌ 本项目不需要（无后处理、无加载器） |
| `kenney.nl` | CC0 | 优质音效包 | ⚠️ 下载链接由 JS 生成、带不可预测的哈希，无法稳定直连 |
| `opengameart.org` | 混合（可筛 CC0） | 大量 CC0 音效 | ✅ **实际采用**（见下） |

**唯一真正可用、且不破坏美术风格的一类素材是音频**——因为本项目的地形、角色、UI、背景全部是运行时生成的平涂矩形，任何位图贴图、模型或 HDRI 都会立刻破坏风格，而声音不受影响。

---

## 4. 实际落地的两件事

### (1) 新素材：OpenGameArt 的 CC0 音效

通过 `tools/fetch-assets.mjs` 新增两组，均为 CC0 1.0：

| 来源 | 内容 | 用途 |
| --- | --- | --- |
| `swishes-sound-pack`（CC0） | 14 个 swish 采样 | 抓钩发射、松手 |
| `75-cc0-breaking-falling-hit-sfx`（CC0） | 75 个 breaking/falling/glass 采样 | 抓钩命中、碎裂平台、落地变体 |

顺带一提：`whoosh-1` 这个候选是 **CC-BY-SA 3.0**，传染性许可，为了不把整个项目拖进 SA 义务，主动排除了。

### (2) 借鉴设计：抓钩（Grapple）

doodleshooter 最有辨识度的机制是「抓钩摆荡」。它和平台跳跃是天然搭配，所以按它的手感思路重新实现了一遍（自己写的代码，没有参考它的实现）：

- 按住开火键朝准心发射钩子，命中实体方块后挂住
- 按住时收绳，把玩家朝锚点拉过去；松手保留全部动量甩出去
- 绳索约束用**速度投影**实现（超长时消掉向外的径向速度），而不是硬拉位置，这样不会把玩家挤进墙里
- 绳子和钩子用黑色小方块画成虚线——一条线，正好符合风格派「只有横竖直线」的规则

抓钩只在第三关启用（第一关教基础、第二关教蹬墙跳与冲刺、第三关是抓钩关），关卡几何和校验器都相应更新了。

---

## 5. 一句话总结

- doodleshooter：**没有素材、没有许可证**，只借了设计思路（抓钩），没有碰它的代码
- speed-rouge：你自己的项目，但素材（位图瓦片 / 编辑器图标）与本项目的风格约束不兼容，未取用；那个 OFL 中文字体留着以后可能有用
- 其他 three.js 仓库：要么许可证不明、要么含第三方版权内容、要么是写实贴图，全部排除
- 最终落地的素材来自 OpenGameArt 的 **CC0** 音效；真正带来提升的是从 doodleshooter 学到的**抓钩机制**


---

## 6. 第二轮迭代：从 speed-rouge 学到的更多东西

上一轮把 doodleshooter 当主要参考，这一轮重新看了 `C:\Atian\Project\speed-rouge`——结果是它才是信息量最大的那个，因为它是你自己的 Godot 4 平台跳跃项目（`fanquanpp/geometric-construct`），里面沉淀了大量关于**手感**的调参经验。

### 6.1 素材：仍然只有音频可用

| 来源 | 素材 | 是否取用 |
| --- | --- | --- |
| `speed-rouge/assets/tiles/*.png` | 4 张位图瓦片（本身就是 `tools/gen_tile_assets.gd` 生成的产物） | ❌ 位图会破坏「纯平涂矩形」的风格约束 |
| `speed-rouge/assets/editor/*.svg` | 11 个关卡编辑器图标 | ❌ 本项目没有编辑器 |
| `speed-rouge/assets/fonts/NotoSansSC-VF.ttf` | OFL 1.1 中文字体 | ⏸ 留着以后做中文界面用 |
| `speed-rouge/scripts/fx/sfx.gd`、`ambience.gd` | 程序化音效与音乐合成器 | ✅ 思路一致（本项目也是生成式），本轮没有额外需要 |
| **OpenGameArt 的 CC0 音效** | 节拍器 tick、时钟 tick、铃音、金属撞击 | ✅ **本轮实际新增的 4 个素材** |

顺带把「找一个更正宗的风格派字体」这件事查到底了：**不存在**。van Doesburg 1919 年那套几何字母表没有任何 OFL / CC0 / 公有领域的数字复刻，DaFont 上那些 "De Stijl"/"Mondrian" 字体全部是「仅限个人使用」。Jost（Futura 复刻，1927）已经是许可干净前提下历史最准确的选项，所以**没有换字体**——强行换一个只会更差。

### 6.2 手感：movement_core.gd 的三条规则

这是本轮价值最高的部分。`scripts/entities/player/movement_core.gd` 是一个纯静态数学库，三条规则直接搬了过来：

| 规则 | speed-rouge 的写法 | 本项目的落地 |
| --- | --- | --- |
| **顶点滞空 + 加重下落** | 上升接近顶点时 `APEX_MULT 0.86`，下落 `FALL_MULT 1.24`，且下落加速度按 `1 - v_n²` 收束 | 重力分三段：上升按住 ×0.82、顶点 ×0.78、下落 ×1.28 并按 `1-(v/maxFall)²` 收束（不再硬截断） |
| **动量是状态，不是上限** | 同向超速时只 `move_toward(target, bleed)`，不做反向拉回 | `overSpeedBleed 0.55`：冲刺后按住前进，vx 从 27 以 34/s² 泄到 9.6，约 0.5 秒，而不是立刻归零 |
| **空中操控随速度衰减** | `air_accel` 从 0.62 插值到 0.20 | `airControlHigh 0.45`：静止满操控，跑速时 45% |

另外两条也一起采纳了：

- **死亡到重生要短**（speed-rouge 明确要求 ≤0.35 秒，别打断速通节奏）→ `deathPause` 从 0.85 秒改成 0.45 秒
- **跳跃高度按「格」来调**（`jump_v_for(units) = sqrt(2*g*units)`）→ 本项目本来就是 1 格 = 1 单位的坐标系，所以调参天然就是按格

### 6.3 机制：两个从 speed-rouge 借来的玩法

| speed-rouge | 本项目 | 改了什么 |
| --- | --- | --- |
| `world/mechanisms/timed_bridge.gd`（定时桥，0.75 秒预警 + 3→2→1 裂纹倒计时，可用形状冗余帮助色盲玩家） | **节奏平台** | 循环不再用秒计量，而是用**生成式配乐的节拍**计量——整关跟着音乐呼吸；倒计时用一排横杠逐根消失，形状与颜色同时表达同一件事 |
| `world/mechanisms/piano_tile.gd`（踩上去发一个音，音高相对角色基准音偏移） | **音阶条** | 音高取自配乐**当前小节的和弦**（新增 `AudioEngine.currentChord()`），所以永远在调内，且同一根条会随和声换音 |

没有采纳的：重力翻转（`swap`）、三个角色原型（红/黄/蓝各自不同的重力与弹跳）、`speed_gate` 增益门、幽灵录像、奖牌之外的时间赛模式——这些和本项目的单角色三关结构不搭。

### 6.4 工程：三条值得抄的做法

- **`reduced_motion` 贯穿一切**：speed-rouge 的每个特效都过一遍这个开关。本项目加了同样的设置项（首次运行读系统的 `prefers-reduced-motion`），关掉震屏、速度变焦，并把粒子数压到 35%。
- **关卡自带不变量校验**：`native_level.gd` 在编辑器里就对缺失出生点/终点/存档点、越界、零行程移动平台发出警告。本项目已有 `tools/validate-levels.mjs`，本轮又加了一条新 lint——**节奏平台上方必须有跳跃余量**，因为「能站上去但跳不下来」是个陷阱。这条 lint 加进去之后立刻抓到了本轮自己犯的两个错（第一关的节奏平台压在碎裂方块下面，第二关的压在移动平台下面），换位置后才通过。
- **奖牌阈值由公式推导**（`par = level_size.x / cruise_speed`，奖牌 = par × {1.15, 1.75, 2.4}）。本项目改成用每关自己的 `targetTime` 推导（金 70% / 银 100% / 铜 140%），因为关卡宽度和实际游玩时长的关系不如目标时间直接。

### 6.5 一句话总结

- doodleshooter：**零素材、无许可证**，只借了抓钩设计（上一轮已落地）
- speed-rouge：**自己的项目**，位图素材风格不兼容，但 `movement_core.gd` 的手感规则和 `timed_bridge`/`piano_tile` 两个机制被吸收进了本项目
- 其他 three.js 仓库：许可证不明或含第三方版权内容，全部排除
- 字体：**查证后确认没有更好的选择**，保持 Jost
- 本轮新增的素材只有 OpenGameArt 的 **4 个 CC0 音效**，而且它们直接服务于两个新机制
