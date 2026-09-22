/* 离子半径比规则（Radius Ratio Rule）· 教学内容与判据。
 *
 * 核心：正离子要大到能同时接触周围所有负离子，但也不能大到把负离子撑开。
 * 于是配位数只能取离散的 4 / 6 / 8 —— 在临界半径比 0.414 / 0.732 处发生“跳变”。
 *
 * 这里的常量与 3D 引擎（engine/engine.js 的 RAD_UPPER）保持一致，
 * 否则界面上的“当前配位数”会和画布里的结构错位。
 */

export type CN = 4 | 6 | 8;

export const RADIUS_MIN = 0.2;
export const RADIUS_MAX = 1.0;

/** 临界半径比：四面体 ↔ 八面体、八面体 ↔ 立方体 */
export const CRIT_LOW = 0.4142;
export const CRIT_HIGH = 0.732;

/** 滑块轨道上的标记线（第三个 0.225 是四面体空隙能容纳的下限） */
export const CRIT_MARKS: { value: number; label: string; note: string }[] = [
  { value: CRIT_LOW, label: '0.414', note: '四面体 ↔ 八面体' },
  { value: CRIT_HIGH, label: '0.732', note: '八面体 ↔ 立方体' },
  { value: 0.225, label: '0.225', note: '四面体空隙的下限' },
];

export interface StructureInfo {
  cn: CN;
  range: [number, number];
  rangeText: string;
  hole: string;
  type: string;
  typeFull: string;
  examples: { formula: string; name: string; ratio: number }[];
  /** 为什么这个区间是它：几何上的解释 */
  reason: string;
  /** 结构自带的稳定度提示（配合画布里的接触检测） */
  cue: string;
}

export const STRUCTURES: Record<CN, StructureInfo> = {
  4: {
    cn: 4,
    range: [0.225, CRIT_LOW],
    rangeText: '0.225 ~ 0.414',
    hole: '四面体空隙',
    type: 'ZnS 型',
    typeFull: '闪锌矿结构',
    examples: [
      { formula: 'ZnS', name: '硫化锌', ratio: 0.4 },
      { formula: 'BeO', name: '氧化铍', ratio: 0.32 },
      { formula: 'SiO₂', name: '二氧化硅', ratio: 0.32 },
    ],
    reason:
      '正离子太小，八面体空隙里装不满（碰到不到 6 个负离子），只能钻进更小的四面体空隙，配位数降到 4。',
    cue: '正离子在空隙里“空荡荡”，接触点够不着会闪红 —— 配位数 6 撑不住。',
  },
  6: {
    cn: 6,
    range: [CRIT_LOW, CRIT_HIGH],
    rangeText: '0.414 ~ 0.732',
    hole: '八面体空隙',
    type: 'NaCl 型',
    typeFull: '岩盐结构',
    examples: [
      { formula: 'NaCl', name: '氯化钠', ratio: 0.56 },
      { formula: 'MgO', name: '氧化镁', ratio: 0.51 },
      { formula: 'CaO', name: '氧化钙', ratio: 0.71 },
    ],
    reason:
      '正离子刚好大到能同时碰上下左右前后 6 个负离子，又还没大到把负离子撑开 —— 八面体配位最稳定。',
    cue: '负离子之间基本保持紧密排列，随着正离子变大，灰线会被逐渐撑开变橙。',
  },
  8: {
    cn: 8,
    range: [CRIT_HIGH, RADIUS_MAX],
    rangeText: '0.732 ~ 1.00',
    hole: '立方体空隙',
    type: 'CsCl 型',
    typeFull: '氯化铯结构',
    examples: [
      { formula: 'CsCl', name: '氯化铯', ratio: 0.93 },
      { formula: 'CsBr', name: '溴化铯', ratio: 0.85 },
      { formula: 'CsI', name: '碘化铯', ratio: 0.76 },
    ],
    reason:
      '正离子大到塞不进八面体空隙，会把周围负离子撑开；排列随即崩塌重排成立方体配位，周围容纳 8 个负离子。',
    cue: '负离子之间的灰线先变红、再断裂 —— 紧密堆积被破坏后才重排。',
  },
};

export const CN_ORDER: CN[] = [4, 6, 8];

/** 半径比 → 配位数（与引擎中的 radCnFor 完全一致） */
export function cnForRatio(r: number): CN {
  const k = clampRatio(r);
  if (k < CRIT_LOW) return 4;
  if (k < CRIT_HIGH) return 6;
  return 8;
}

export function clampRatio(r: number): number {
  if (!Number.isFinite(r)) return 0.56;
  return Math.min(RADIUS_MAX, Math.max(RADIUS_MIN, r));
}

export function infoFor(r: number): StructureInfo {
  return STRUCTURES[cnForRatio(r)];
}

export function ratioText(r: number): string {
  return r.toFixed(2);
}

/** 距离下一个临界值还有多远（用于“快到临界值了”的提示） */
export function nextCritical(r: number): { value: number; cn: CN; label: string } | null {
  const k = clampRatio(r);
  if (k < CRIT_LOW) return { value: CRIT_LOW, cn: 6, label: '0.414' };
  if (k < CRIT_HIGH) return { value: CRIT_HIGH, cn: 8, label: '0.732' };
  return null;
}

export function distanceToNextCritical(r: number): number {
  const n = nextCritical(r);
  return n ? Math.abs(r - n.value) : 1;
}

/** 每个配位结构的几何推导一句话（答题后显示） */
export const GEOMETRY_NOTE: Record<CN, string> = {
  4: '正四面体：四个顶点到中心的距离 = (√6/2)·r₋ = 1.225 r₋，减去 r₋ 得到空隙半径 0.225 r₋ —— 这就是 0.225 的来源。',
  6: '正八面体：相邻的负离子沿棱接触，中心到顶点 = √2·r₋ = 1.414 r₋，空隙半径 = 0.414 r₋ —— 这就是 0.414 的来源。',
  8: '立方体：体对角线穿过正离子，中心到顶角 = √3·r₋ = 1.732 r₋，空隙半径 = 0.732 r₋ —— 这就是 0.732 的来源。',
};

/** 为什么配位数是 4、6、8，而不是 5 或 7 */
export const WHY_DISCRETE =
  '只有 4 / 6 / 8 这三种配位能让正负离子几何上的空隙被“严丝合缝”地填满：' +
  '配位数 5、7 对应的排列既不能让负离子紧密堆积，又不能让正离子同时接触所有负离子 —— 所以它们不稳定，' +
  '现实中不会出现。拖动滑块跨过临界值时会看到配位数直接跳变，而不是慢慢变成 5。';

/* ---------------- 第二层：预测模式题库 ---------------- */
export interface PredictTask {
  id: string;
  ratio: number;
  cn: CN;
  hint: string;
}

export const PREDICT_TASKS: PredictTask[] = [
  { id: 'p1', ratio: 0.55, cn: 6, hint: '比 0.414 大、比 0.732 小，落在哪个区间？' },
  { id: 'p2', ratio: 0.93, cn: 8, hint: '已经超过 0.732 了 —— 八面体空隙还能装得下吗？' },
  { id: 'p3', ratio: 0.35, cn: 4, hint: '连 0.414 都没到，正离子小得可怜。' },
  { id: 'p4', ratio: 0.72, cn: 6, hint: '非常接近 0.732，但还没跨过去。' },
  { id: 'p5', ratio: 0.42, cn: 6, hint: '刚过 0.414 —— 跨过临界就是另一个配位数了。' },
  { id: 'p6', ratio: 0.28, cn: 4, hint: '只有 0.28，连四面体空隙都快装不下了。' },
  { id: 'p7', ratio: 0.74, cn: 8, hint: '刚刚超过 0.732，旧的排布马上就撑不住了。' },
  { id: 'p8', ratio: 0.62, cn: 6, hint: '典型区间中部，想想 NaCl。' },
];

/* ---------------- 第三层：应用模式（对接高考“晶胞与配位数”考点） ---------------- */
export interface ApplyTask {
  id: string;
  cation: { text: string; r: number };
  anion: { text: string; r: number };
  title: string;
  note: string;
}

/** 离子半径取教材常见数值（单位 pm，仅用于估算比例） */
export const APPLY_TASKS: ApplyTask[] = [
  {
    id: 'nacl',
    title: '判断 NaCl 的配位数',
    cation: { text: 'Na⁺', r: 102 },
    anion: { text: 'Cl⁻', r: 181 },
    note: '必修常见：NaCl 型，正负离子配位数都是 6。',
  },
  {
    id: 'cscl',
    title: '判断 CsCl 的配位数',
    cation: { text: 'Cs⁺', r: 167 },
    anion: { text: 'Cl⁻', r: 181 },
    note: 'Cs⁺ 比 Na⁺ 大得多，同是与 Cl⁻ 结合，结构却完全不同。',
  },
  {
    id: 'zns',
    title: '判断 ZnS 的配位数',
    cation: { text: 'Zn²⁺', r: 74 },
    anion: { text: 'S²⁻', r: 184 },
    note: 'Zn²⁺ 半径小、电荷高，常被误判成配位数 6。',
  },
  {
    id: 'mgo',
    title: '判断 MgO 的配位数',
    cation: { text: 'Mg²⁺', r: 72 },
    anion: { text: 'O²⁻', r: 140 },
    note: '高考常客：MgO 熔点很高，结构类型和 NaCl 相同。',
  },
  {
    id: 'cao',
    title: '判断 CaO 的配位数',
    cation: { text: 'Ca²⁺', r: 100 },
    anion: { text: 'O²⁻', r: 140 },
    note: 'Ca²⁺ 比 Mg²⁺ 大，半径比已经逼近 0.732 这条线。',
  },
  {
    id: 'beo',
    title: '判断 BeO 的配位数',
    cation: { text: 'Be²⁺', r: 45 },
    anion: { text: 'O²⁻', r: 140 },
    note: 'Be²⁺ 极小，只能落到配位数 4 的四面体空隙里。',
  },
];

export function trueRatioOf(task: ApplyTask): number {
  return task.cation.r / task.anion.r;
}

/* ---------------- 浏览页 → 本实验的入口 ---------------- */
/** 内容库里的离子晶体分子 → 对应的真实半径比（用于从详情页跳过来时把滑块定位到它） */
export const LATTICE_LINKS: Record<string, { ratio: number; formula: string }> = {
  nacl: { ratio: 0.56, formula: 'NaCl' },
};

export interface RadiusLabEntry {
  /** 进入时的初始半径比 */
  ratio: number;
  /** 从哪儿进来的（用于返回与提示） */
  from?: string;
  /** 是否直接切到“应用模式” */
  applyId?: string;
}
