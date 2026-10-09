/**
 * 游戏模式的关卡
 *
 * 一份关卡 = 「一条高中常见函数」+「这条函数上的几个整点」。
 * 点都在第一象限，而且 **x、y 都是整数**（整点），坐标就直接取在预设函数身上，
 * 所以一定有一条函数能同时穿过它们；
 * 答案（那条函数）默认打码，只给类别提示，愿意看才揭晓。
 */

/** 目标点（整点） */
export type Target = { x: number; y: number };

export type Preset = {
  id: string;
  /** 关卡名字（存档列表里显示） */
  name: string;
  family: string;
  /** 答案（用户看到的是打码版） */
  expr: string;
  /** 类别提示：说了是哪一类，但没说具体是哪一个 */
  hint: string;
  /** 这条函数上的整点（都在第一象限，x、y 都是整数） */
  pts: Target[];
  /** 答案函数，只用来自检「这些整点确实在曲线上」 */
  f: (x: number) => number;
};

export const FAMILIES = ['全部随机', '一次', '二次', '反比例', '指数', '对数', '三角', '圆与曲线', '幂与根号'] as const;
export type Family = (typeof FAMILIES)[number];

export const PRESETS: Preset[] = [
  {
    id: 'lin1',
    name: '一次函数 · 上升',
    family: '一次',
    expr: 'y = 2x + 1',
    hint: '是一条直线（一次函数），斜率为正',
    pts: [
      { x: 1, y: 3 },
      { x: 2, y: 5 },
      { x: 3, y: 7 },
      { x: 4, y: 9 },
    ],
    f: (x) => 2 * x + 1,
  },
  {
    id: 'lin2',
    name: '一次函数 · 下降',
    family: '一次',
    expr: 'y = 6 - x',
    hint: '是一条直线（一次函数），斜率为负',
    pts: [
      { x: 1, y: 5 },
      { x: 2, y: 4 },
      { x: 3, y: 3 },
      { x: 4, y: 2 },
    ],
    f: (x) => 6 - x,
  },
  {
    id: 'quad1',
    name: '二次函数 · (x−2)²',
    family: '二次',
    expr: 'y = x^2 - 4x + 4',
    hint: '是一条开口向上的抛物线，对称轴是 x = 2',
    pts: [
      { x: 1, y: 1 },
      { x: 3, y: 1 },
      { x: 4, y: 4 },
      { x: 5, y: 9 },
    ],
    f: (x) => x * x - 4 * x + 4,
  },
  {
    id: 'quad2',
    name: '二次函数 · 顶点式',
    family: '二次',
    expr: 'y = -(x-3)^2 + 6',
    hint: '是一条开口向下的抛物线，顶点横坐标是 3',
    pts: [
      { x: 1, y: 2 },
      { x: 2, y: 5 },
      { x: 3, y: 6 },
      { x: 4, y: 5 },
      { x: 5, y: 2 },
    ],
    f: (x) => -((x - 3) ** 2) + 6,
  },
  {
    id: 'inv1',
    name: '反比例函数 · 6/x',
    family: '反比例',
    expr: 'y = 6/x',
    hint: '是反比例函数（形如 k/x），两支都在一、三象限',
    pts: [
      { x: 1, y: 6 },
      { x: 2, y: 3 },
      { x: 3, y: 2 },
      { x: 6, y: 1 },
    ],
    f: (x) => 6 / x,
  },
  {
    id: 'exp1',
    name: '指数函数 · 2^x',
    family: '指数',
    expr: 'y = 2^x',
    hint: '是指数函数，底数大于 1，越往右涨得越快',
    pts: [
      { x: 1, y: 2 },
      { x: 2, y: 4 },
      { x: 3, y: 8 },
    ],
    f: (x) => 2 ** x,
  },
  {
    id: 'exp2',
    name: '指数衰减 · 16·(1/2)^x',
    family: '指数',
    expr: 'y = 16*(1/2)^x',
    hint: '是指数函数，底数在 0 和 1 之间，越往右越贴近 x 轴',
    pts: [
      { x: 1, y: 8 },
      { x: 2, y: 4 },
      { x: 3, y: 2 },
      { x: 4, y: 1 },
    ],
    f: (x) => 16 * 0.5 ** x,
  },
  {
    id: 'log1',
    name: '对数函数 · log₂x',
    family: '对数',
    expr: 'y = log(x, 2)',
    hint: '是以 2 为底的对数函数，越往右越平',
    pts: [
      { x: 2, y: 1 },
      { x: 4, y: 2 },
      { x: 8, y: 3 },
      { x: 16, y: 4 },
    ],
    f: (x) => Math.log2(x),
  },
  {
    id: 'log2',
    name: '对数函数 · 2 log₂x',
    family: '对数',
    expr: 'y = 2*log(x, 2)',
    hint: '是以 2 为底的对数函数，前面还乘了一个系数',
    pts: [
      { x: 2, y: 2 },
      { x: 4, y: 4 },
      { x: 8, y: 6 },
      { x: 16, y: 8 },
    ],
    f: (x) => 2 * Math.log2(x),
  },
  {
    id: 'sin1',
    name: '正弦曲线 · 2 sin(πx/6)',
    family: '三角',
    expr: 'y = 2*sin(pi*x/6)',
    hint: '是正弦型曲线，振幅是 2，周期是 12，x 用弧度',
    pts: [
      { x: 1, y: 1 },
      { x: 3, y: 2 },
      { x: 5, y: 1 },
    ],
    f: (x) => 2 * Math.sin((Math.PI * x) / 6),
  },
  {
    id: 'sin2',
    name: '正弦曲线 · 上移 2',
    family: '三角',
    expr: 'y = 2*sin(pi*x/6) + 2',
    hint: '是正弦型曲线，振幅是 2，整体向上平移了 2',
    pts: [
      { x: 1, y: 3 },
      { x: 3, y: 4 },
      { x: 5, y: 3 },
      { x: 7, y: 1 },
    ],
    f: (x) => 2 * Math.sin((Math.PI * x) / 6) + 2,
  },
  {
    id: 'circ1',
    name: '圆 · x²+y²=65',
    family: '圆与曲线',
    expr: 'x^2 + y^2 = 65',
    hint: '是一个圆，圆心在原点（半径 √65 ≈ 8.06）',
    pts: [
      { x: 1, y: 8 },
      { x: 4, y: 7 },
      { x: 7, y: 4 },
      { x: 8, y: 1 },
    ],
    f: (x) => Math.sqrt(Math.max(0, 65 - x * x)),
  },
  {
    id: 'sqrt1',
    name: '根号函数 · √x',
    family: '幂与根号',
    expr: 'y = sqrt(x)',
    hint: '是根号函数（幂函数，指数 1/2）',
    pts: [
      { x: 1, y: 1 },
      { x: 4, y: 2 },
      { x: 9, y: 3 },
    ],
    f: (x) => Math.sqrt(x),
  },
  {
    id: 'abs1',
    name: '绝对值 · |x−3|+1',
    family: '幂与根号',
    expr: 'y = abs(x-3) + 1',
    hint: '是带绝对值的折线，拐点在 x = 3',
    pts: [
      { x: 1, y: 3 },
      { x: 2, y: 2 },
      { x: 4, y: 2 },
      { x: 5, y: 3 },
    ],
    f: (x) => Math.abs(x - 3) + 1,
  },
  {
    id: 'cube1',
    name: '幂函数 · x³',
    family: '幂与根号',
    expr: 'y = x^3',
    hint: '是幂函数，指数是 3',
    pts: [
      { x: 1, y: 1 },
      { x: 2, y: 8 },
    ],
    f: (x) => x ** 3,
  },
];

export function presetsOf(family: Family): Preset[] {
  return family === '全部随机' ? PRESETS : PRESETS.filter((p) => p.family === family);
}

export function presetById(id: string): Preset | undefined {
  return PRESETS.find((p) => p.id === id);
}

/** 难度：几个点（难度越高点越多，要同时穿过的点也越多；点都是整点） */
export const DIFFS: { label: string; n: number; note: string }[] = [
  { label: '入门', n: 1, note: '1 个整点：随便一条过得去的曲线就行' },
  { label: '普通', n: 2, note: '2 个整点：两点确定一条直线，但也可能是曲线' },
  { label: '进阶', n: 3, note: '3 个整点：直线基本不够用了' },
  { label: '挑战', n: 4, note: '4 个整点：要真的猜出是哪一类函数' },
];

export type Level = {
  presetId: string;
  family: Family;
  diff: number;
  points: Target[];
  /** 判定容差（画面上的距离）：点都是整点，答案是精确穿过，给 0.06 足够宽松 */
  tol: number;
};

export const HIT_TOL = 0.06;

const shuffle = <T,>(arr: T[]): T[] => {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

/** 抽一关：先挑一条函数，再从它身上取 n 个整点（都在第一象限） */
export function makeLevel(family: Family, diff: number): Level {
  const pool = presetsOf(family);
  const n = DIFFS[Math.max(0, Math.min(DIFFS.length - 1, diff))].n;
  // 尽量挑「整点够多」的那条函数，这样挑战难度也真的是 4 个点
  const enough = pool.filter((p) => p.pts.length >= n);
  const from = enough.length ? enough : pool;
  const preset = from[Math.floor(Math.random() * from.length)] ?? PRESETS[0];
  const points = shuffle(preset.pts)
    .slice(0, n)
    .map((p) => ({ x: p.x, y: p.y }));
  return { presetId: preset.id, family, diff, points, tol: HIT_TOL };
}

/** 答案打码：把字符换成方块（空格保留）—— 想看真的再点「揭晓」 */
export function maskText(s: string): string {
  return s.replace(/\S/g, '▒');
}

export const fmtNum = (x: number): string => (Number.isInteger(x) ? String(x) : String(Math.round(x * 100) / 100));
