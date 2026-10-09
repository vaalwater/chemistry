/**
 * 数学 · 最值 —— 统一引擎
 *
 * 中学里两道看着完全不像的题，其实是同一道题：
 *
 *   ① 均值不等式        x + 1/x ≥ 2
 *   ② 线性约束下的倒数和  ax + by = c，求 1/x + 1/y 的最小值
 *
 * 把 1/x 换成另一个变量 y，① 就变成「在 xy = 1 上求 x + y 的最小值」；
 * 于是两道题都是：**在约束 g(x,y) = 0 下，求 f(x,y) 的极值**。
 *
 * 几何上这等于：把目标函数的一族等高线推过去，推到刚好和约束曲线相切的那一秒
 * —— 再往前推就碰不到约束上的点了，那一点就是极值。
 * 代数上这就是拉格朗日乘数法：∇f = λ∇g（两条梯度平行），λ = 最优值对约束常数的变化率。
 *
 * 这个文件只管算：模型定义、解析解、沿约束的数值扫描、等值线（ marching squares ）。
 * 画的事交给 extreme 目录下的组件。
 */

/* ------------------------------------------------------------------ *
 * 小向量
 * ------------------------------------------------------------------ */

export type V2 = { x: number; y: number };

export const add = (a: V2, b: V2): V2 => ({ x: a.x + b.x, y: a.y + b.y });
export const sub = (a: V2, b: V2): V2 => ({ x: a.x - b.x, y: a.y - b.y });
export const mul = (s: number, a: V2): V2 => ({ x: s * a.x, y: s * a.y });
export const dot = (a: V2, b: V2): number => a.x * b.x + a.y * b.y;
export const len = (a: V2): number => Math.hypot(a.x, a.y);
export const unit = (a: V2): V2 => {
  const l = len(a);
  return l < 1e-12 ? { x: 0, y: 0 } : { x: a.x / l, y: a.y / l };
};
/** 逆时针转 90°：梯度的垂直方向就是曲线的切线方向 */
export const perp = (a: V2): V2 => ({ x: -a.y, y: a.x });

/* ------------------------------------------------------------------ *
 * 模型定义
 * ------------------------------------------------------------------ */

export type Sense = 'min' | 'max';

export type Knob = {
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
  def: number;
};

/** 画布「至少要看到」的一块数据区域 */
export type Req = { xLo: number; xHi: number; yLo: number; yHi: number };

export type Win = { xLo: number; xHi: number; yLo: number; yHi: number };

export type ExtremeCase = {
  id: string;
  name: string;
  short: string;
  /** 归到哪一组（选题区按组排：曲线约束 / 直线约束 / 圆与椭圆） */
  group: string;
  /** 这道题在原卷上长什么样 */
  story: string;
  sense: Sense;
  /** 目标函数 / 约束的写法 */
  fText: string;
  gText: (k: Record<string, number>) => string;
  vars: [string, string];
  knobs: Knob[];
  /** 约束里的那个常数（讲 λ 的「影子价格」时就是拖它） */
  cKey: string;
  f: (p: V2, k: Record<string, number>) => number;
  gradF: (p: V2, k: Record<string, number>) => V2;
  /** g(x,y) = 表达式 − 常数，所以 g = 0 就是约束成立 */
  g: (p: V2, k: Record<string, number>) => number;
  gradG: (p: V2, k: Record<string, number>) => V2;
  /** 沿约束走：t 是「走了多远」，返回约束上的点 */
  walk: (t: number, k: Record<string, number>) => V2;
  /** t 的起始范围（会在取景窗口里再裁剪一次） */
  tSeed: (k: Record<string, number>) => [number, number];
  /** 解必须待在的地方（比如 x, y > 0） */
  inDomain: (p: V2, k: Record<string, number>) => boolean;
  /** 定义域的一句人话（选题区要显示） */
  domainText: string;
  /** 画面上至少要看到的那块区域（外面再按比例补成同尺度） */
  req: (k: Record<string, number>) => Req;
  /** 解析解：最优点 / 最优值 / λ */
  solve: (k: Record<string, number>) => { at: V2; value: number; lambda: number };
  /** 拉格朗日乘数法的手写步骤 */
  steps: (k: Record<string, number>) => string[];
  /** 中学解法（均值不等式 / 柯西），用来和拉格朗日对照 */
  classic: (k: Record<string, number>) => string[];
};

const n1 = (v: number) => (Math.abs(v - Math.round(v)) < 1e-9 ? `${Math.round(v)}` : v.toFixed(2));
const n2 = (v: number) => (Math.abs(v * 10 - Math.round(v * 10)) < 1e-9 ? v.toFixed(1) : v.toFixed(2));
const sq = (v: number) => (Math.abs(v - Math.round(v)) < 1e-9 ? `${Math.round(v)}` : v.toFixed(3));

/* ------------------------------------------------------------------ *
 * 四个模型
 * ------------------------------------------------------------------ */

/** ① 均值不等式：min x + y  s.t. xy = k（k = 1 时就是 x + 1/x ≥ 2） */
const AMGM: ExtremeCase = {
  id: 'amgm',
  name: '均值不等式',
  short: 'x + 1/x ≥ 2',
  group: '曲线约束',
  story: '已知 x > 0，求 x + 1/x 的最小值 —— 换成两个变量：在双曲线 xy = 1 上找 x + y 最小的地方。',
  sense: 'min',
  fText: 'f = x + y',
  gText: (k) => `xy = ${n1(k.k)}`,
  vars: ['x', 'y'],
  knobs: [{ key: 'k', label: '约束常数 k（双曲线 xy = k）', min: 0.25, max: 4, step: 0.05, def: 1 }],
  cKey: 'k',
  f: (p) => p.x + p.y,
  gradF: () => ({ x: 1, y: 1 }),
  g: (p, k) => p.x * p.y - k.k,
  gradG: (p) => ({ x: p.y, y: p.x }),
  walk: (t, k) => ({ x: t, y: k.k / t }),
  tSeed: (k) => [Math.max(0.02, 0.05 * Math.sqrt(k.k)), 12 * Math.sqrt(k.k)],
  inDomain: (p) => p.x > 1e-6 && p.y > 1e-6,
  domainText: 'x > 0，y > 0（只看双曲线在第一象限那支）',
  req: (k) => {
    const s = Math.sqrt(k.k);
    return { xLo: -0.45 * s, xHi: 3.6 * s, yLo: -0.45 * s, yHi: 3.6 * s };
  },
  solve: (k) => {
    const s = Math.sqrt(k.k);
    return { at: { x: s, y: s }, value: 2 * s, lambda: 1 / s };
  },
  steps: (k) => {
    const s = Math.sqrt(k.k);
    return [
      `① 约束写成 g(x,y) = xy − ${n1(k.k)} = 0`,
      `② 造函数 L = f − λg = x + y − λ(xy − ${n1(k.k)})`,
      '③ 三个方程（两个偏导 + 约束）：',
      `   ∂L/∂x = 1 − λy = 0`,
      `   ∂L/∂y = 1 − λx = 0`,
      `   xy = ${n1(k.k)}`,
      `④ 前两式相除得 x = y，代进约束：x = y = ${sq(s)}`,
      `⑤ f = ${n2(2 * s)} 就是最小值；λ = ${n2(1 / s)}`,
    ];
  },
  classic: (k) => {
    const s = Math.sqrt(k.k);
    return [
      `x + y ≥ 2√(xy) = 2√${n1(k.k)} = ${n2(2 * s)}（均值不等式）`,
      `等号成立当且仅当 x = y = ${sq(s)}`,
      `把 y = ${n1(k.k)}/x 代回去：x + ${n1(k.k)}/x ≥ ${n2(2 * s)}${k.k === 1 ? ' —— 这就是那个「x + 1/x ≥ 2」' : ''}`,
    ];
  },
};

/** ② 线性约束下的倒数和：min 1/x + 1/y  s.t. ax + by = c */
const INV: ExtremeCase = {
  id: 'inv',
  name: '倒数和的最小值',
  short: '1/x + 1/y',
  group: '直线约束',
  story: '已知 x > 0, y > 0 且 ax + by = c，求 1/x + 1/y 的最小值 —— 常见的「乘 1 法 / 柯西」题型。',
  sense: 'min',
  fText: 'f = 1/x + 1/y',
  gText: (k) => `${n1(k.a)}x + ${n1(k.b)}y = ${n1(k.c)}`,
  vars: ['x', 'y'],
  knobs: [
    { key: 'a', label: 'x 前面的系数 a', min: 0.5, max: 3, step: 0.1, def: 1 },
    { key: 'b', label: 'y 前面的系数 b', min: 0.5, max: 3, step: 0.1, def: 2 },
    { key: 'c', label: '等号右边 c', min: 0.5, max: 4, step: 0.1, def: 1 },
  ],
  cKey: 'c',
  f: (p) => 1 / p.x + 1 / p.y,
  gradF: (p) => ({ x: -1 / (p.x * p.x), y: -1 / (p.y * p.y) }),
  g: (p, k) => k.a * p.x + k.b * p.y - k.c,
  gradG: (_p, k) => ({ x: k.a, y: k.b }),
  walk: (t, k) => ({ x: t, y: (k.c - k.a * t) / k.b }),
  tSeed: (k) => [1e-4, (k.c / k.a) * 0.999],
  inDomain: (p) => p.x > 1e-6 && p.y > 1e-6,
  domainText: 'x > 0，y > 0（只看直线在第一象限那一段）',
  req: (k) => {
    const W = k.c / k.a;
    const H = k.c / k.b;
    return { xLo: -0.14 * W, xHi: 1.28 * W, yLo: -0.14 * H, yHi: 1.4 * H };
  },
  solve: (k) => {
    const x = k.c / (k.a + Math.sqrt(k.a * k.b));
    const y = k.c / (k.b + Math.sqrt(k.a * k.b));
    const value = (Math.sqrt(k.a) + Math.sqrt(k.b)) ** 2 / k.c;
    return { at: { x, y }, value, lambda: -value / k.c };
  },
  steps: (k) => {
    const s = solveOf(INV, k);
    return [
      `① 约束写成 g(x,y) = ${n1(k.a)}x + ${n1(k.b)}y − ${n1(k.c)} = 0`,
      `② L = 1/x + 1/y − λ(${n1(k.a)}x + ${n1(k.b)}y − ${n1(k.c)})`,
      '③ 三个方程：',
      `   ∂L/∂x = −1/x² − λ·${n1(k.a)} = 0`,
      `   ∂L/∂y = −1/y² − λ·${n1(k.b)} = 0`,
      `   ${n1(k.a)}x + ${n1(k.b)}y = ${n1(k.c)}`,
      `④ 两式相除：y²/x² = ${n1(k.a)}/${n1(k.b)}，即 y/x = ${n2(Math.sqrt(k.a / k.b))}`,
      `⑤ 代回约束：x = ${sq(s.at.x)}，y = ${sq(s.at.y)}，最小值 = ${n2(s.value)}；λ = ${n2(s.lambda)}`,
    ];
  },
  classic: (k) => {
    const s = solveOf(INV, k);
    return [
      `(1/x + 1/y)(${n1(k.a)}x + ${n1(k.b)}y) ≥ (√${n1(k.a)} + √${n1(k.b)})²（柯西）`,
      `左边第二个括号 = ${n1(k.c)}，所以 1/x + 1/y ≥ ${n2(s.value)}`,
      `等号成立：y√${n1(k.b)} = x√${n1(k.a)}，即 y/x = ${n2(Math.sqrt(k.a / k.b))} —— 和拉格朗日算出来的完全一样`,
    ];
  },
};

/** ③ 周长一定，面积最大：max xy  s.t. x + y = s */
const RECT: ExtremeCase = {
  id: 'rect',
  name: '周长一定，面积最大',
  short: 'max xy',
  group: '直线约束',
  story: '周长固定的矩形，什么时候面积最大 —— 在直线 x + y = 定值 上找 xy 最大的地方。',
  sense: 'max',
  fText: 'f = x·y',
  gText: (k) => `x + y = ${n1(k.s)}`,
  vars: ['x', 'y'],
  knobs: [{ key: 's', label: '长加宽 s（周长的一半）', min: 1, max: 6, step: 0.1, def: 2 }],
  cKey: 's',
  f: (p) => p.x * p.y,
  gradF: (p) => ({ x: p.y, y: p.x }),
  g: (p, k) => p.x + p.y - k.s,
  gradG: () => ({ x: 1, y: 1 }),
  walk: (t, k) => ({ x: t, y: k.s - t }),
  tSeed: (k) => [1e-4, k.s - 1e-4],
  inDomain: (p) => p.x > 1e-6 && p.y > 1e-6,
  domainText: 'x > 0，y > 0（边长不能是负的）',
  req: (k) => ({ xLo: -0.16 * k.s, xHi: 1.16 * k.s, yLo: -0.16 * k.s, yHi: 1.16 * k.s }),
  solve: (k) => {
    const v = k.s / 2;
    return { at: { x: v, y: v }, value: v * v, lambda: v };
  },
  steps: (k) => {
    const v = k.s / 2;
    return [
      `① 约束写成 g(x,y) = x + y − ${n1(k.s)} = 0`,
      `② L = xy − λ(x + y − ${n1(k.s)})`,
      '③ 三个方程：',
      '   ∂L/∂x = y − λ = 0',
      '   ∂L/∂y = x − λ = 0',
      `   x + y = ${n1(k.s)}`,
      `④ 前两式给出 x = y，代进约束：x = y = ${sq(v)}`,
      `⑤ 最大面积 = ${n2(v * v)}；λ = ${n2(v)}（λ 正好是那个正方形的边长）`,
    ];
  },
  classic: (k) => {
    const v = k.s / 2;
    return [
      `xy ≤ ((x + y)/2)² = ${n2(v * v)}（均值不等式）`,
      `等号成立当且仅当 x = y = ${sq(v)}，也就是正方形的时候面积最大`,
      '注意这里求的是「最大」，等高线是从里面往外推到刚好相切 —— 和求最小值完全同一个画面',
    ];
  },
};

/** ④ 点到直线最近：min x² + y²  s.t. ax + by = c（同心圆推到和直线相切） */
const DIST: ExtremeCase = {
  id: 'dist',
  name: '点到直线最近',
  short: 'min x² + y²',
  group: '直线约束',
  story: '原点到直线的最短距离 —— 一族同心圆往外推，第一次碰到直线的那个点就是垂足。',
  sense: 'min',
  fText: 'f = x² + y²',
  gText: (k) => `${n1(k.a)}x + ${n1(k.b)}y = ${n1(k.c)}`,
  vars: ['x', 'y'],
  knobs: [
    { key: 'a', label: 'x 前面的系数 a', min: 0.5, max: 3, step: 0.1, def: 1 },
    { key: 'b', label: 'y 前面的系数 b', min: 0.5, max: 3, step: 0.1, def: 2 },
    { key: 'c', label: '等号右边 c', min: 0.5, max: 5, step: 0.1, def: 2 },
  ],
  cKey: 'c',
  f: (p) => p.x * p.x + p.y * p.y,
  gradF: (p) => ({ x: 2 * p.x, y: 2 * p.y }),
  g: (p, k) => k.a * p.x + k.b * p.y - k.c,
  gradG: (_p, k) => ({ x: k.a, y: k.b }),
  walk: (t, k) => ({ x: t, y: (k.c - k.a * t) / k.b }),
  tSeed: (k) => [-6, 6],
  inDomain: () => true,
  domainText: '整条直线（x, y 可正可负）',
  req: (k) => {
    const R = Math.max(k.c / k.a, k.c / k.b);
    return { xLo: -0.4 * R, xHi: 1.25 * R, yLo: -0.55 * R, yHi: 1.25 * R };
  },
  solve: (k) => {
    const d = k.a * k.a + k.b * k.b;
    const at = { x: (k.c * k.a) / d, y: (k.c * k.b) / d };
    return { at, value: (k.c * k.c) / d, lambda: (2 * k.c) / d };
  },
  steps: (k) => {
    const s = solveOf(DIST, k);
    return [
      `① 约束写成 g(x,y) = ${n1(k.a)}x + ${n1(k.b)}y − ${n1(k.c)} = 0`,
      `② L = x² + y² − λ(${n1(k.a)}x + ${n1(k.b)}y − ${n1(k.c)})`,
      '③ 三个方程：',
      `   ∂L/∂x = 2x − λ·${n1(k.a)} = 0`,
      `   ∂L/∂y = 2y − λ·${n1(k.b)} = 0`,
      `   ${n1(k.a)}x + ${n1(k.b)}y = ${n1(k.c)}`,
      `④ 前两式：最优点必须在 (${n1(k.a)}, ${n1(k.b)}) 方向上，也就是「垂直于直线」的方向`,
      `⑤ 得 x = ${sq(s.at.x)}，y = ${sq(s.at.y)}，最小距离² = ${n2(s.value)}；λ = ${n2(s.lambda)}`,
    ];
  },
  classic: (k) => {
    const s = solveOf(DIST, k);
    return [
      `点到直线的距离 d = ${n1(k.c)}/√(${n1(k.a)}² + ${n1(k.b)}²) = ${n2(Math.sqrt(s.value))}`,
      `所以最小值是 d² = ${n2(s.value)}（垂线段最短）`,
      '拉格朗日那句「∇f ∥ ∇g」翻过来就是：目标函数 x²+y² 的梯度（半径方向）必须垂直于直线',
    ];
  },
};

/** ⑤ 双曲线上离原点最近：min x² + y²  s.t. xy = k（同心圆推到和双曲线相切） */
const QUAD: ExtremeCase = {
  id: 'quad',
  name: '双曲线上离原点最近',
  short: 'min x² + y²（双曲线）',
  group: '曲线约束',
  story: '在双曲线 xy = k 上找离原点最近的点 —— 一族同心圆往外推，第一次碰到双曲线的那一点就是答案（也就是「x² + y² ≥ 2xy」的几何版）。',
  sense: 'min',
  fText: 'f = x² + y²',
  gText: (k) => `xy = ${n1(k.k)}`,
  vars: ['x', 'y'],
  knobs: [{ key: 'k', label: '约束常数 k（双曲线 xy = k）', min: 0.25, max: 4, step: 0.05, def: 1 }],
  cKey: 'k',
  f: (p) => p.x * p.x + p.y * p.y,
  gradF: (p) => ({ x: 2 * p.x, y: 2 * p.y }),
  g: (p, k) => p.x * p.y - k.k,
  gradG: (p) => ({ x: p.y, y: p.x }),
  walk: (t, k) => ({ x: t, y: k.k / t }),
  tSeed: (k) => [Math.max(0.02, 0.05 * Math.sqrt(k.k)), 12 * Math.sqrt(k.k)],
  inDomain: (p) => p.x > 1e-6 && p.y > 1e-6,
  domainText: 'x > 0，y > 0（只看双曲线在第一象限那支）',
  req: (k) => {
    const s = Math.sqrt(k.k);
    return { xLo: -0.45 * s, xHi: 3.6 * s, yLo: -0.45 * s, yHi: 3.6 * s };
  },
  solve: (k) => {
    const s = Math.sqrt(k.k);
    return { at: { x: s, y: s }, value: 2 * k.k, lambda: 2 };
  },
  steps: (k) => {
    const s = Math.sqrt(k.k);
    return [
      `① 约束写成 g(x,y) = xy − ${n1(k.k)} = 0`,
      `② 造函数 L = x² + y² − λ(xy − ${n1(k.k)})`,
      '③ 三个方程（两个偏导 + 约束）：',
      `   ∂L/∂x = 2x − λy = 0`,
      `   ∂L/∂y = 2y − λx = 0`,
      `   xy = ${n1(k.k)}`,
      `④ 两式相除：x/y = y/x → x² = y²，第一象限里就是 x = y = ${sq(s)}`,
      `⑤ 最小距离² = ${n2(2 * k.k)}${k.k === 1 ? '（距离 = 1）' : ''}；λ = 2`,
    ];
  },
  classic: (k) => [
    `x² + y² ≥ 2xy = 2·${n1(k.k)} = ${n2(2 * k.k)}（均值不等式）`,
    `等号成立当且仅当 x = y，再配上 xy = ${n1(k.k)}：x = y = ${sq(Math.sqrt(k.k))}`,
    '和 ①「x + 1/x ≥ 2」是同一条双曲线，只是这次的目标函数换成了「离原点有多远」',
  ],
};

/** ⑥ 倒数和型的约束：min x + y  s.t. a/x + b/y = m（约束自己也是分式） */
const FRAC: ExtremeCase = {
  id: 'frac',
  name: '倒数和型的约束',
  short: 'a/x + b/y = m',
  group: '曲线约束',
  story: '已知 a/x + b/y = m，求 x + y 的最小值 —— 这次约束本身就是分式，曲线有两条渐近线；解法还是同一套：等高线推到相切。',
  sense: 'min',
  fText: 'f = x + y',
  gText: (k) => `${n1(k.a)}/x + ${n1(k.b)}/y = ${n1(k.m)}`,
  vars: ['x', 'y'],
  knobs: [
    { key: 'a', label: '分子 a', min: 0.25, max: 3, step: 0.05, def: 1 },
    { key: 'b', label: '分子 b', min: 0.25, max: 3, step: 0.05, def: 1 },
    { key: 'm', label: '等号右边 m', min: 0.4, max: 2.5, step: 0.05, def: 1 },
  ],
  cKey: 'm',
  f: (p) => p.x + p.y,
  gradF: () => ({ x: 1, y: 1 }),
  g: (p, k) => k.a / p.x + k.b / p.y - k.m,
  gradG: (p, k) => ({ x: -k.a / (p.x * p.x), y: -k.b / (p.y * p.y) }),
  walk: (t, k) => ({ x: t, y: (k.b * t) / (k.m * t - k.a) }),
  tSeed: (k) => {
    const s = Math.sqrt(k.a * k.b) / k.m;
    const xMin = k.a / k.m;
    return [xMin + 0.08 * s, xMin + 14 * s];
  },
  inDomain: (p) => p.x > 1e-6 && p.y > 1e-6,
  domainText: 'x > a/m，y > b/m（曲线在两条渐近线夹出来的那一支上）',
  req: (k) => {
    const s = Math.sqrt(k.a * k.b) / k.m;
    const xa = k.a / k.m;
    const yb = k.b / k.m;
    return { xLo: xa - 0.2 * s, xHi: xa + 2.4 * s, yLo: yb - 0.2 * s, yHi: yb + 2.4 * s };
  },
  solve: (k) => {
    const s = Math.sqrt(k.a);
    const t = Math.sqrt(k.b);
    return {
      at: { x: (k.a + Math.sqrt(k.a * k.b)) / k.m, y: (k.b + Math.sqrt(k.a * k.b)) / k.m },
      value: ((s + t) ** 2) / k.m,
      lambda: -((s + t) ** 2) / (k.m * k.m),
    };
  },
  steps: (k) => {
    const s = solveOf(FRAC, k);
    return [
      `① 约束写成 g(x,y) = ${n1(k.a)}/x + ${n1(k.b)}/y − ${n1(k.m)} = 0`,
      `② L = x + y − λ(${n1(k.a)}/x + ${n1(k.b)}/y − ${n1(k.m)})`,
      '③ 三个方程：',
      `   ∂L/∂x = 1 + λ·${n1(k.a)}/x² = 0`,
      `   ∂L/∂y = 1 + λ·${n1(k.b)}/y² = 0`,
      `   ${n1(k.a)}/x + ${n1(k.b)}/y = ${n1(k.m)}`,
      `④ 前两式给出 x²/${n1(k.a)} = y²/${n1(k.b)}，即 y/x = ${n2(Math.sqrt(k.b / k.a))}`,
      `⑤ 代回约束：x = ${sq(s.at.x)}，y = ${sq(s.at.y)}，最小值 = ${n2(s.value)}；λ = ${n2(s.lambda)}`,
    ];
  },
  classic: (k) => {
    const s = solveOf(FRAC, k);
    return [
      `(x + y)(${n1(k.a)}/x + ${n1(k.b)}/y) ≥ (√${n1(k.a)} + √${n1(k.b)})²（柯西）`,
      `第二个括号 = ${n1(k.m)}，所以 x + y ≥ ${n2(s.value)}`,
      `等号成立：x/√${n1(k.a)} = y/√${n1(k.b)} —— 也就是拉格朗日算出来的那个点`,
    ];
  },
};

/** ⑦ 乘 1 法：min p/x + q/y  s.t. x + y = s（最典型的「乘 1」题型） */
const WSUM: ExtremeCase = {
  id: 'wsum',
  name: '加权倒数和（乘 1 法）',
  short: 'min p/x + q/y',
  group: '直线约束',
  story: '已知 x + y = s，求 p/x + q/y 的最小值 —— 课本上的做法是「乘 1」再配柯西；这里的做法是把一族曲线推到和这条直线相切。',
  sense: 'min',
  fText: 'f = p/x + q/y',
  gText: (k) => `x + y = ${n1(k.s)}`,
  vars: ['x', 'y'],
  knobs: [
    { key: 'p', label: '第一个分子 p', min: 0.25, max: 4, step: 0.05, def: 1 },
    { key: 'q', label: '第二个分子 q', min: 0.25, max: 4, step: 0.05, def: 4 },
    { key: 's', label: 'x + y 的和 s', min: 1, max: 6, step: 0.1, def: 3 },
  ],
  cKey: 's',
  f: (p, k) => k.p / p.x + k.q / p.y,
  gradF: (p, k) => ({ x: -k.p / (p.x * p.x), y: -k.q / (p.y * p.y) }),
  g: (p, k) => p.x + p.y - k.s,
  gradG: () => ({ x: 1, y: 1 }),
  walk: (t, k) => ({ x: t, y: k.s - t }),
  tSeed: (k) => [1e-4, k.s - 1e-4],
  inDomain: (p) => p.x > 1e-6 && p.y > 1e-6,
  domainText: 'x > 0，y > 0（分母不能是 0）',
  req: (k) => ({ xLo: -0.12 * k.s, xHi: 1.18 * k.s, yLo: -0.12 * k.s, yHi: 1.18 * k.s }),
  solve: (k) => {
    const sp = Math.sqrt(k.p);
    const sq2 = Math.sqrt(k.q);
    const value = (sp + sq2) ** 2 / k.s;
    return {
      at: { x: (k.s * sp) / (sp + sq2), y: (k.s * sq2) / (sp + sq2) },
      value,
      lambda: -value / k.s,
    };
  },
  steps: (k) => {
    const s = solveOf(WSUM, k);
    return [
      `① 约束写成 g(x,y) = x + y − ${n1(k.s)} = 0`,
      `② L = ${n1(k.p)}/x + ${n1(k.q)}/y − λ(x + y − ${n1(k.s)})`,
      '③ 三个方程：',
      `   ∂L/∂x = −${n1(k.p)}/x² − λ = 0`,
      `   ∂L/∂y = −${n1(k.q)}/y² − λ = 0`,
      `   x + y = ${n1(k.s)}`,
      `④ 两式相除：x²/y² = ${n1(k.p)}/${n1(k.q)}，即 x/y = ${n2(Math.sqrt(k.p / k.q))}`,
      `⑤ 代回约束：x = ${sq(s.at.x)}，y = ${sq(s.at.y)}，最小值 = ${n2(s.value)}；λ = ${n2(s.lambda)}`,
    ];
  },
  classic: (k) => {
    const s = solveOf(WSUM, k);
    return [
      `乘 1：${n1(k.p)}/x + ${n1(k.q)}/y = (1/${n1(k.s)})·(${n1(k.p)}/x + ${n1(k.q)}/y)(x + y)`,
      `≥ (1/${n1(k.s)})·(√${n1(k.p)} + √${n1(k.q)})² = ${n2(s.value)}（柯西）`,
      `等号成立：x/√${n1(k.p)} = y/√${n1(k.q)}，和上面算出来的是同一个点`,
    ];
  },
};

/** ⑧ 圆上的线性函数：max ax + by  s.t. x² + y² = r²（一族平行线推到与圆相切） */
const CIRC: ExtremeCase = {
  id: 'circ',
  name: '圆上的线性函数',
  short: 'max ax + by（圆）',
  group: '圆与椭圆',
  story: '在半径为 r 的圆上找 ax + by 最大的点 —— 一族平行直线整体往一个方向平移，最后一条还能碰到圆的，就是相切的那条，切点就是最优点。',
  sense: 'max',
  fText: 'f = a·x + b·y',
  gText: (k) => `x² + y² = ${n1(k.r)}²`,
  vars: ['x', 'y'],
  knobs: [
    { key: 'a', label: 'x 前面的系数 a', min: 0.5, max: 3, step: 0.1, def: 1 },
    { key: 'b', label: 'y 前面的系数 b', min: 0.5, max: 3, step: 0.1, def: 2 },
    { key: 'r', label: '半径 r', min: 0.5, max: 3, step: 0.1, def: 2 },
  ],
  cKey: 'r',
  f: (p, k) => k.a * p.x + k.b * p.y,
  gradF: (_p, k) => ({ x: k.a, y: k.b }),
  g: (p, k) => Math.hypot(p.x, p.y) - k.r,
  gradG: (p) => {
    const l = Math.hypot(p.x, p.y) || 1e-9;
    return { x: p.x / l, y: p.y / l };
  },
  walk: (t, k) => ({ x: k.r * Math.cos(t), y: k.r * Math.sin(t) }),
  tSeed: () => [-Math.PI, Math.PI],
  inDomain: () => true,
  domainText: '整个圆（x, y 可正可负）',
  req: (k) => ({ xLo: -1.35 * k.r, xHi: 1.35 * k.r, yLo: -1.35 * k.r, yHi: 1.35 * k.r }),
  solve: (k) => {
    const m = Math.hypot(k.a, k.b);
    return { at: { x: (k.r * k.a) / m, y: (k.r * k.b) / m }, value: k.r * m, lambda: m };
  },
  steps: (k) => {
    const s = solveOf(CIRC, k);
    return [
      `① 约束写成 g(x,y) = √(x² + y²) − ${n1(k.r)} = 0（也就是 x² + y² = ${n1(k.r)}²）`,
      `② L = ${n1(k.a)}x + ${n1(k.b)}y − λ(√(x² + y²) − ${n1(k.r)})`,
      '③ 三个方程：',
      `   ∂L/∂x = ${n1(k.a)} − λ·x/√(x²+y²) = 0`,
      `   ∂L/∂y = ${n1(k.b)} − λ·y/√(x²+y²) = 0`,
      `   x² + y² = ${n1(k.r)}²`,
      `④ 前两式：最优点必须落在 (${n1(k.a)}, ${n1(k.b)}) 这个方向上 —— 也就是半径平行于 ∇f 的那个点`,
      `⑤ x = ${sq(s.at.x)}，y = ${sq(s.at.y)}，最大值 = ${n2(s.value)}；λ = ${n2(s.lambda)}`,
    ];
  },
  classic: (k) => {
    const s = solveOf(CIRC, k);
    return [
      `${n1(k.a)}x + ${n1(k.b)}y ≤ √(${n1(k.a)}² + ${n1(k.b)}²)·√(x² + y²)（柯西）`,
      `第二个根号 = ${n1(k.r)}，所以最大值 = ${n2(s.value)}`,
      `等号成立：(x, y) 与 (${n1(k.a)}, ${n1(k.b)}) 同向 —— 几何上就是「直线和圆相切」`,
    ];
  },
};

/** ⑨ 椭圆内接矩形：max xy  s.t. x²/a² + y²/b² = c（一族双曲线推到与椭圆相切） */
const ELLIPSE: ExtremeCase = {
  id: 'ellipse',
  name: '椭圆内接矩形面积',
  short: 'max xy（椭圆）',
  group: '圆与椭圆',
  story: '椭圆上取一点 (x, y)，以它为角上的顶点作矩形，面积 xy 什么时候最大 —— 一族双曲线往外推，推到刚好贴住椭圆的那一条。',
  sense: 'max',
  fText: 'f = x·y',
  gText: (k) => `x²/${n1(k.a * k.a)} + y²/${n1(k.b * k.b)} = ${n1(k.c)}`,
  vars: ['x', 'y'],
  knobs: [
    { key: 'a', label: '横半轴 a', min: 0.5, max: 3, step: 0.1, def: 2 },
    { key: 'b', label: '纵半轴 b', min: 0.5, max: 3, step: 0.1, def: 1 },
    { key: 'c', label: '等号右边 c（椭圆的大小）', min: 0.4, max: 2.5, step: 0.05, def: 1 },
  ],
  cKey: 'c',
  f: (p) => p.x * p.y,
  gradF: (p) => ({ x: p.y, y: p.x }),
  g: (p, k) => (p.x * p.x) / (k.a * k.a) + (p.y * p.y) / (k.b * k.b) - k.c,
  gradG: (p, k) => ({ x: (2 * p.x) / (k.a * k.a), y: (2 * p.y) / (k.b * k.b) }),
  walk: (t, k) => {
    const s = Math.sqrt(k.c);
    return { x: k.a * s * Math.cos(t), y: k.b * s * Math.sin(t) };
  },
  tSeed: () => [0.02, Math.PI / 2 - 0.02],
  inDomain: (p) => p.x > 1e-6 && p.y > 1e-6,
  domainText: 'x > 0，y > 0（只看椭圆在第一象限那一段）',
  req: (k) => {
    const X = k.a * Math.sqrt(k.c);
    const Y = k.b * Math.sqrt(k.c);
    return { xLo: -0.14 * X, xHi: 1.22 * X, yLo: -0.14 * Y, yHi: 1.22 * Y };
  },
  solve: (k) => {
    const s = Math.sqrt(k.c / 2);
    return { at: { x: k.a * s, y: k.b * s }, value: (k.a * k.b * k.c) / 2, lambda: (k.a * k.b) / 2 };
  },
  steps: (k) => {
    const s = solveOf(ELLIPSE, k);
    return [
      `① 约束写成 g(x,y) = x²/${n1(k.a * k.a)} + y²/${n1(k.b * k.b)} − ${n1(k.c)} = 0`,
      `② L = xy − λ(x²/${n1(k.a * k.a)} + y²/${n1(k.b * k.b)} − ${n1(k.c)})`,
      '③ 三个方程：',
      `   ∂L/∂x = y − 2λx/${n1(k.a * k.a)} = 0`,
      `   ∂L/∂y = x − 2λy/${n1(k.b * k.b)} = 0`,
      `   x²/${n1(k.a * k.a)} + y²/${n1(k.b * k.b)} = ${n1(k.c)}`,
      `④ 两式相除：y/x = (x/${n1(k.a * k.a)})·(${n1(k.b * k.b)}/y)，即 x·${n1(k.b)} = y·${n1(k.a)}`,
      `⑤ 代回约束：x = ${sq(s.at.x)}，y = ${sq(s.at.y)}，最大面积 = ${n2(s.value)}；λ = ${n2(s.lambda)}`,
    ];
  },
  classic: (k) => {
    const s = solveOf(ELLIPSE, k);
    return [
      `(x²/${n1(k.a * k.a)})·(y²/${n1(k.b * k.b)}) ≤ ((x²/${n1(k.a * k.a)} + y²/${n1(k.b * k.b)})/2)² = ${n2((k.c * k.c) / 4)}`,
      `开方得 xy ≤ ${n2(k.a * k.b * k.c / 2)}（均值不等式）`,
      `等号成立：x²/${n1(k.a * k.a)} = y²/${n1(k.b * k.b)} = ${n2(k.c / 2)}，即 x = ${sq(s.at.x)}，y = ${sq(s.at.y)}`,
    ];
  },
};

export const CASES: ExtremeCase[] = [AMGM, QUAD, FRAC, INV, RECT, WSUM, DIST, CIRC, ELLIPSE];

/** 选题区按这个顺序分组摆题 */
export const GROUPS: string[] = ['曲线约束', '直线约束', '圆与椭圆'];

export function caseById(id: string): ExtremeCase {
  return CASES.find((c) => c.id === id) ?? CASES[0];
}

export function defaultKnobs(kase: ExtremeCase): Record<string, number> {
  const out: Record<string, number> = {};
  kase.knobs.forEach((k) => {
    out[k.key] = k.def;
  });
  return out;
}

function solveOf(kase: ExtremeCase, k: Record<string, number>) {
  return kase.solve(k);
}

/* ------------------------------------------------------------------ *
 * 取景：横纵必须同一个尺度（不然「相切」在屏幕上就是歪的），
 * 同时保证要看的区域一定在画面里、宽高比又正好等于画布的宽高比。
 * ------------------------------------------------------------------ */

export function fitWin(req: Req, aspect: number): Win {
  const a = Math.max(aspect, 1e-6);
  const spanX = Math.max(1e-6, req.xHi - req.xLo);
  const spanY = Math.max(1e-6, req.yHi - req.yLo);
  const W = Math.max(spanX, spanY / a);
  const Hh = W * a;
  const cx = (req.xLo + req.xHi) / 2;
  const cy = (req.yLo + req.yHi) / 2;
  const xLo = Math.min(cx - W / 2, req.xLo);
  const yLo = Math.min(cy - Hh / 2, req.yLo);
  return { xLo, xHi: xLo + W, yLo, yHi: yLo + Hh };
}

/* ------------------------------------------------------------------ *
 * 沿约束扫描：数值版的「遍历」，滑动条和动画都用同一份数据
 * ------------------------------------------------------------------ */

export type Sample = { t: number; at: V2; value: number };

/** 把 t 的范围裁进取景窗口：只看得见的那一段 */
export function tRangeIn(kase: ExtremeCase, k: Record<string, number>, win: Win): [number, number] {
  const [t0, t1] = kase.tSeed(k);
  const N = 400;
  let lo = Number.NaN;
  let hi = Number.NaN;
  for (let i = 0; i <= N; i += 1) {
    const t = t0 + ((t1 - t0) * i) / N;
    const p = kase.walk(t, k);
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) continue;
    if (!kase.inDomain(p, k)) continue;
    const inside = p.x >= win.xLo && p.x <= win.xHi && p.y >= win.yLo && p.y <= win.yHi;
    if (inside) {
      if (Number.isNaN(lo)) lo = t;
      hi = t;
    }
  }
  if (Number.isNaN(lo)) return [t0, t1];
  return [lo, hi];
}

/** 沿约束等距取一串点（跳过定义域外的），用来画曲线 / 算极值 */
export function samplesOf(kase: ExtremeCase, k: Record<string, number>, win: Win, n = 240): Sample[] {
  const [t0, t1] = tRangeIn(kase, k, win);
  const out: Sample[] = [];
  for (let i = 0; i <= n; i += 1) {
    const t = t0 + ((t1 - t0) * i) / n;
    const at = kase.walk(t, k);
    if (!Number.isFinite(at.x) || !Number.isFinite(at.y)) continue;
    if (!kase.inDomain(at, k)) continue;
    const value = kase.f(at, k);
    if (!Number.isFinite(value)) continue;
    out.push({ t, at, value });
  }
  return out;
}

/** 数值最优点：先粗扫，再在最好的那一小段上做黄金分割细化 */
export function numericOpt(
  kase: ExtremeCase,
  k: Record<string, number>,
  win: Win
): { t: number; at: V2; value: number } | null {
  const rough = samplesOf(kase, k, win, 480);
  if (!rough.length) return null;
  let best = rough[0];
  rough.forEach((s) => {
    const better = kase.sense === 'min' ? s.value < best.value : s.value > best.value;
    if (better) best = s;
  });
  const all = kase.tSeed(k);
  const [ra, rb] = tRangeIn(kase, k, win);
  const span = rb - ra;
  let lo = Math.max(all[0], best.t - span / 60);
  let hi = Math.min(all[1], best.t + span / 60);
  if (hi <= lo) return best;
  const of = (t: number) => kase.f(kase.walk(t, k), k);
  const g = 0.6180339887;
  for (let it = 0; it < 60; it += 1) {
    const l = hi - lo;
    if (l < 1e-10) break;
    const t1 = hi - g * l;
    const t2 = lo + g * l;
    const v1 = of(t1);
    const v2 = of(t2);
    const takeLeft = kase.sense === 'min' ? v1 < v2 : v1 > v2;
    if (takeLeft) hi = t2;
    else lo = t1;
  }
  const t = (lo + hi) / 2;
  const at = kase.walk(t, k);
  return { t, at, value: kase.f(at, k) };
}

/* ------------------------------------------------------------------ *
 * 拉格朗日的两个向量：∇f 与 ∇g，以及 ∇f 沿约束的分量
 * ------------------------------------------------------------------ */

export type Tangency = {
  /** 约束在该点的单位切向 */
  T: V2;
  /** 目标函数的梯度（f 涨得最快的方向） */
  gradF: V2;
  /** 约束的梯度（垂直于约束曲线） */
  gradG: V2;
  /** ∇f 在切线方向上的分量：= 0 就是极值点 */
  tangential: number;
  /** ∇f 在法线方向上的分量 */
  normal: number;
  /** ∇f = λ∇g 里的 λ */
  lambda: number;
  /** 两个梯度夹角的正弦（0 = 完全平行） */
  misalign: number;
};

export function tangencyAt(kase: ExtremeCase, k: Record<string, number>, at: V2): Tangency {
  const gradF = kase.gradF(at, k);
  const gradG = kase.gradG(at, k);
  const nrm = unit(gradG);
  const T = perp(nrm);
  const lg = len(gradG);
  const lf = len(gradF);
  const crossv = gradF.x * gradG.y - gradF.y * gradG.x;
  const misalign = lf * lg < 1e-12 ? 0 : Math.abs(crossv) / (lf * lg);
  return {
    T,
    gradF,
    gradG,
    tangential: dot(gradF, T),
    normal: dot(gradF, nrm),
    lambda: lg < 1e-12 ? 0 : dot(gradF, gradG) / (lg * lg),
    misalign,
  };
}

/* ------------------------------------------------------------------ *
 * 等值线（marching squares）：给一个水平值，吐出一堆小线段
 * ------------------------------------------------------------------ */

export type Seg = { a: V2; b: V2 };

/**
 * 求 fn(x,y) = level 的等值线。
 * 网格上逐格看四个角的正负，变号的两条边上线性插值出一个交点，连成线段。
 * 线之间不拼接 —— 画的时候本来就是一条一条画，够用而且简单。
 */
export function contour(fn: (x: number, y: number) => number, level: number, win: Win, nx = 52, ny = 52): Seg[] {
  const dx = (win.xHi - win.xLo) / nx;
  const dy = (win.yHi - win.yLo) / ny;
  const at = (i: number, j: number): V2 => ({ x: win.xLo + i * dx, y: win.yLo + j * dy });
  const val: number[][] = [];
  for (let j = 0; j <= ny; j += 1) {
    const row: number[] = [];
    for (let i = 0; i <= nx; i += 1) {
      const p = at(i, j);
      const v = fn(p.x, p.y);
      row.push(Number.isFinite(v) ? v - level : Number.NaN);
    }
    val.push(row);
  }
  const lerp = (p1: V2, v1: number, p2: V2, v2: number): V2 => {
    const d = v2 - v1;
    const r = Math.abs(d) < 1e-12 ? 0.5 : Math.max(0, Math.min(1, (-v1) / d));
    return { x: p1.x + (p2.x - p1.x) * r, y: p1.y + (p2.y - p1.y) * r };
  };
  const segs: Seg[] = [];
  for (let j = 0; j < ny; j += 1) {
    for (let i = 0; i < nx; i += 1) {
      const v00 = val[j][i];
      const v10 = val[j][i + 1];
      const v01 = val[j + 1][i];
      const v11 = val[j + 1][i + 1];
      if ([v00, v10, v01, v11].some((v) => !Number.isFinite(v))) continue;
      const p00 = at(i, j);
      const p10 = at(i + 1, j);
      const p01 = at(i, j + 1);
      const p11 = at(i + 1, j + 1);
      const pts: V2[] = [];
      if (v00 * v10 < 0) pts.push(lerp(p00, v00, p10, v10));
      if (v10 * v11 < 0) pts.push(lerp(p10, v10, p11, v11));
      if (v01 * v11 < 0) pts.push(lerp(p01, v01, p11, v11));
      if (v00 * v01 < 0) pts.push(lerp(p00, v00, p01, v01));
      if (pts.length === 2) segs.push({ a: pts[0], b: pts[1] });
      else if (pts.length === 4) {
        // 鞍点：用中心值的正负决定怎么连
        const mid = (v00 + v10 + v01 + v11) / 4;
        if (mid > 0 === (v00 > 0)) {
          segs.push({ a: pts[0], b: pts[3] });
          segs.push({ a: pts[1], b: pts[2] });
        } else {
          segs.push({ a: pts[0], b: pts[1] });
          segs.push({ a: pts[2], b: pts[3] });
        }
      }
    }
  }
  return segs;
}

/* ------------------------------------------------------------------ *
 * 等高线取值：围着最优值铺一层
 * ------------------------------------------------------------------ */

/** 从最优值往外铺的等高线（求最小就往上推，求最大就往下拉） */
export function familyLevels(optValue: number, sense: Sense): number[] {
  const up = [1, 1.035, 1.08, 1.14, 1.22, 1.33, 1.48, 1.68, 1.95, 2.3, 2.8];
  const down = [1, 0.965, 0.92, 0.86, 0.78, 0.67, 0.52, 0.34, 0.15, -0.1];
  return (sense === 'min' ? up : down).map((f) => optValue * f);
}

/**
 * 这条等高线现在和约束什么关系：
 *   hit     —— 还有交点，这个 f 值取得到；
 *   tangent —— 正好贴着（相切），这就是极值那一瞬；
 *   miss    —— 整条脱开了，一个点都取不到。
 */
export function levelState(
  kase: ExtremeCase,
  k: Record<string, number>,
  win: Win,
  level: number
): 'hit' | 'tangent' | 'miss' {
  const xs = samplesOf(kase, k, win, 200);
  if (!xs.length) return 'miss';
  let mn = Infinity;
  let mx = -Infinity;
  xs.forEach((s) => {
    mn = Math.min(mn, s.value);
    mx = Math.max(mx, s.value);
  });
  const edge = kase.sense === 'min' ? mn : mx;
  const eps = 2e-3 * Math.max(1, Math.abs(edge));
  const gap = kase.sense === 'min' ? level - edge : edge - level;
  if (gap < -eps) return 'miss';
  if (Math.abs(gap) <= eps) return 'tangent';
  return 'hit';
}

/** 沿约束的可行取值区间（讲解文字要用） */
export function feasibleRange(
  kase: ExtremeCase,
  k: Record<string, number>,
  win: Win
): { lo: number; hi: number } {
  const xs = samplesOf(kase, k, win, 240);
  if (!xs.length) return { lo: 0, hi: 0 };
  let mn = Infinity;
  let mx = -Infinity;
  xs.forEach((s) => {
    mn = Math.min(mn, s.value);
    mx = Math.max(mx, s.value);
  });
  return { lo: mn, hi: mx };
}
