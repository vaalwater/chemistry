/**
 * 统一数学对象模型
 *
 * 顶部输入区的三个入口（自然语言 / 符号 / 数轴拖拽）最终都落成同一个对象：
 *
 *   { 变量, 约束条件, 参数, 目标(解集 / 恒成立 / 最值), 量词 }
 *
 * 之后左区参数地图、中区解集画布、右区推理轨道、根关系区韦达面板、
 * 底部冲突探针，全部只跟这一个对象打交道。
 */

import {
  EMPTY,
  NEG_INF,
  POS_INF,
  REAL,
  complement,
  diff,
  discriminant,
  end,
  evalPoly,
  fmtPoly,
  intersect,
  isEmpty,
  isReal,
  has,
  normalize,
  parseQuadratic,
  parseSet,
  subset,
  union,
  type ParsedSet,
  type Poly,
  type RealSet,
} from './setCore';

export type Goal = 'solve' | 'hold' | 'extreme';
export type Quant = 'none' | 'forall' | 'exists';
export type SetOp = 'single' | 'subset' | 'intersect' | 'union' | 'diff' | 'comp';

export type MathObj = {
  /** 变量 */
  variable: string;
  /** 约束条件原文（A 侧） */
  source: string;
  /** 参照集合原文（B 侧） */
  sourceB: string;
  /** 集合运算：单独看 A / A⊆B / A∩B / A∪B / A\B / ∁A */
  op: SetOp;
  /** 参数取值 */
  vals: Record<string, number>;
  /** 当前盯着的参数（拖动、举证、反例都跟着它走） */
  focusP?: string;
  /** 量词 */
  quant: Quant;
  /** 量词作用域 */
  domain: RealSet;
  /** 目标 */
  goal: Goal;
};

export const OP_TEXT: Record<SetOp, string> = {
  single: '只看 A',
  subset: 'A ⊆ B（A 装进 B）',
  intersect: 'A ∩ B（公共部分）',
  union: 'A ∪ B（合起来）',
  diff: 'A \\ B（去掉 B 里的）',
  comp: '∁A（补集）',
};

export const GOAL_TEXT: Record<Goal, string> = {
  solve: '求它的解集',
  hold: '判断是不是恒成立',
  extreme: '求最大 / 最小值',
};

export const QUANT_TEXT: Record<Quant, string> = {
  none: '不指定',
  forall: '∀ 每一个都要成立',
  exists: '∃ 有一个就行',
};

/** 默认题目：A={x|x²−ax+1≤0}，B={x|1≤x≤3}，A ⊆ B */
export function baseObj(): MathObj {
  return {
    variable: 'x',
    source: 'x²−ax+1≤0',
    sourceB: '1≤x≤3',
    op: 'subset',
    vals: { a: 2 },
    quant: 'none',
    domain: REAL,
    goal: 'solve',
  };
}

/* ------------------------------------------------------------------ *
 * 求值：对象 → 若干实数集
 * ------------------------------------------------------------------ */

export function parsedA(o: MathObj): ParsedSet | null {
  return parseSet(o.source);
}

export function paramList(o: MathObj): string[] {
  const p = parsedA(o);
  return p && p.kind === 'param' ? p.params : [];
}

export function evalA(o: MathObj, vals: Record<string, number> = o.vals): RealSet {
  const p = parsedA(o);
  if (!p) return EMPTY;
  return p.kind === 'const' ? p.set : p.evalSet(vals);
}

export function evalB(o: MathObj): RealSet {
  const p = parseSet(o.sourceB);
  if (!p) return EMPTY;
  return p.kind === 'const' ? p.set : p.evalSet(o.vals);
}

/** 二次式（可能为 null，例如绝对值、区间的题目） */
export function polyOf(o: MathObj): Poly | null {
  const q = parseQuadratic(o.source);
  return q ? q.poly : null;
}

/** 代入参数后的数值系数 [A,B,C]，null 表示不是二次式 */
export function coefOf(o: MathObj, vals: Record<string, number> = o.vals): [number, number, number] | null {
  const c = polyOf(o);
  if (!c) return null;
  const num = (t: number | string): number => {
    if (typeof t === 'number') return t;
    const s = t.replace(/^\+/, '');
    const neg = s.startsWith('-');
    const letter = s.replace(/^[+-]/, '');
    const v = vals[letter];
    if (v === undefined || !Number.isFinite(v)) return 0;
    return neg ? -v : v;
  };
  return [num(c.a), num(c.b), num(c.c)];
}

/** 函数 x ↦ f(x)（数值），用于恒成立 / 最值判断 */
export function fnOf(o: MathObj, vals: Record<string, number> = o.vals): ((x: number) => number) | null {
  const c = coefOf(o, vals);
  if (!c) return null;
  const [A, B, C] = c;
  return (x: number) => A * x * x + B * x + C;
}

/**
 * 画图用的函数：把约束条件写成 y = f(x)（右边减到左边）。
 * 二次式、一次式、|x−a| 型都支持；返回 null 表示画不出来。
 */
export function graphFnOf(
  o: MathObj,
  vals: Record<string, number> = o.vals
): { f: (x: number) => number; label: string; kind: 'quad' | 'linear' | 'abs' } | null {
  const s = o.source.replace(/\s/g, '').replace(/−/g, '-').replace(/–/g, '-');
  // 绝对值先单独认（不然可能被当成一次式）
  if (s.includes('|')) {
    const m = s.match(/^\|([a-z])([+-][\d.]+)?\|\s*(<=|<|>=|>)\s*([\d.]+)$/);
    if (!m) return null;
    const shift = m[2] ? -Number(m[2]) : 0;
    const r = Number(m[4]);
    const centerTxt = shift === 0 ? 'x' : shift > 0 ? `x − ${round3(shift)}` : `x + ${round3(-shift)}`;
    return {
      f: (x: number) => Math.abs(x - shift) - r,
      label: `y = |${centerTxt}| − ${round3(r)}`,
      kind: 'abs',
    };
  }
  const c = coefOf(o, vals);
  if (c) {
    const [A, B, C] = c;
    return {
      f: (x: number) => A * x * x + B * x + C,
      label: `y = ${fmtFunc([A, B, C])}`,
      kind: Math.abs(A) < 1e-9 ? 'linear' : 'quad',
    };
  }
  return null;
}

function round3(v: number): number {
  return Math.round(v * 1000) / 1000;
}

/** 把 [A,B,C] 写成 y = … 的样子 */
export function fmtFunc([A, B, C]: [number, number, number]): string {
  const r = (v: number) => String(Math.round(v * 1000) / 1000);
  const parts: string[] = [];
  const term = (coef: number, suffix: string, first: boolean) => {
    if (Math.abs(coef) < 1e-9 && !first) return;
    const abs = Math.abs(coef);
    const body = suffix === '' ? r(abs) : abs === 1 ? suffix : `${r(abs)}${suffix}`;
    const sign = coef < 0 ? '−' : first ? '' : '+';
    parts.push(`${sign} ${body}`.trim());
  };
  term(A, 'x²', true);
  term(B, 'x', false);
  term(C, '', false);
  return parts.length ? parts.join(' ') : '0';
}

/** B 的主区间端点（参数地图、根分布要用） */
export function boundsOf(s: RealSet): { lo: number; hi: number } | null {
  const finite = s.filter((t) => Number.isFinite(t.lo.v) && Number.isFinite(t.hi.v));
  if (!finite.length) return null;
  return { lo: finite[0].lo.v, hi: finite[0].hi.v };
}

/** 运算结果（中区主色带） */
export function evalCombined(o: MathObj, vals: Record<string, number> = o.vals): RealSet {
  const A = evalA(o, vals);
  const B = evalB(o);
  switch (o.op) {
    case 'intersect':
      return intersect(A, B);
    case 'union':
      return union(A, B);
    case 'diff':
      return diff(A, B);
    case 'comp':
      return complement(A, o.quant === 'none' ? REAL : o.domain);
    default:
      return A;
  }
}

/** A ⊆ B 是否成立 */
export function inclusionHolds(o: MathObj, vals: Record<string, number> = o.vals): boolean {
  return subset(evalA(o, vals), evalB(o));
}

/* ------------------------------------------------------------------ *
 * 参照集合 B 的两条边也拖得动
 * ------------------------------------------------------------------ */

export type BEnds = { lo: number; hi: number; loClosed: boolean; hiClosed: boolean };

/** 参照集合 B 的两个端点（只有一段有头有尾的区间才拖得动） */
export function bEnds(o: MathObj): BEnds | null {
  const s = evalB(o);
  if (s.length !== 1) return null;
  const t = s[0];
  if (!Number.isFinite(t.lo.v) || !Number.isFinite(t.hi.v)) return null;
  return { lo: t.lo.v, hi: t.hi.v, loClosed: t.lo.closed, hiClosed: t.hi.closed };
}

/** 端点步长：半格一格地挪，看得清又不至于太碎 */
export const B_STEP = 0.5;

function numTxt(v: number): string {
  const r = Math.round(v * 10) / 10;
  return (Number.isInteger(r) ? `${r}` : `${r}`).replace('-', '−');
}

/** 把 B 的某一条边拖到 v（另一条边不动，也不会被拖过头） */
export function setBEnd(o: MathObj, which: 'lo' | 'hi', raw: number): MathObj {
  const e = bEnds(o);
  if (!e) return o;
  const v = Math.round(raw / B_STEP) * B_STEP;
  const lo = which === 'lo' ? Math.min(v, e.hi - B_STEP) : e.lo;
  const hi = which === 'hi' ? Math.max(v, e.lo + B_STEP) : e.hi;
  const l = e.loClosed ? '≤' : '<';
  const r = e.hiClosed ? '≤' : '<';
  return { ...o, sourceB: `${numTxt(lo)}${l}${o.variable}${r}${numTxt(hi)}` };
}

/** 假设把 B 的这条边拖到 v，现在这个解集 A 还装得进吗（拿来给端点滑轨上色） */
export function bEndFits(o: MathObj, which: 'lo' | 'hi', v: number): boolean {
  const e = bEnds(o);
  if (!e) return false;
  const lo = which === 'lo' ? Math.min(v, e.hi - B_STEP) : e.lo;
  const hi = which === 'hi' ? Math.max(v, e.lo + B_STEP) : e.hi;
  return subset(evalA(o), [{ lo: end(lo, e.loClosed), hi: end(hi, e.hiClosed) }]);
}

/** 恒成立 / 存在性判断：返回“失守的部分”（空集 = 结论成立） */
export function violationOf(o: MathObj, vals: Record<string, number> = o.vals): RealSet {
  const target = o.quant === 'none' ? REAL : o.domain;
  if (o.op === 'subset') return diff(evalA(o, vals), evalB(o));
  if (o.goal === 'hold') {
    // ∀：漏掉的部分 = 作用域 \ A；∃：只要交集为空就“找不到”
    if (o.quant === 'exists') return isEmpty(intersect(target, evalA(o, vals))) ? target : EMPTY;
    return diff(target, evalA(o, vals));
  }
  return EMPTY;
}

/** 结论成立与否 */
export function conclude(o: MathObj, vals: Record<string, number> = o.vals): { ok: boolean; text: string } {
  if (o.goal === 'hold') {
    const bad = violationOf(o, vals);
    const targetEmpty = o.quant === 'none' ? false : isEmpty(o.domain);
    if (targetEmpty) return { ok: false, text: '作用域为空，先给量词一个区间' };
    if (isEmpty(bad)) {
      return {
        ok: true,
        text: o.quant === 'exists' ? '成立：作用域里确实能找到这样的 x' : '成立：作用域内每一个 x 都满足条件',
      };
    }
    return { ok: false, text: `不成立：这些 x 被漏掉了 —— 图上红色段就是反例` };
  }
  if (o.goal === 'extreme') {
    const e = extremeOf(o, vals);
    if (!e) return { ok: false, text: '当前不是二次式，无法给出精确的极值' };
    const parts: string[] = [];
    parts.push(e.min === null ? '下无界' : `最小值 ${round2(e.min)}`);
    parts.push(e.max === null ? '上无界' : `最大值 ${round2(e.max)}`);
    return { ok: true, text: parts.join('，') };
  }
  if (o.op === 'subset') {
    return inclusionHolds(o, vals)
      ? { ok: true, text: 'A 的每一段都落在 B 里面 —— 包含关系成立' }
      : { ok: false, text: 'A 有一段伸到了 B 外面 —— 图上标红的那一段就是多出来的' };
  }
  return { ok: true, text: '' };
}

function round2(v: number): string {
  return String(Math.round(v * 1000) / 1000);
}

/** 二次函数在给定集合上的最值（含无穷情形） */
export function extremeOf(
  o: MathObj,
  vals: Record<string, number> = o.vals
): { min: number | null; max: number | null } | null {
  const c = coefOf(o, vals);
  if (!c) return null;
  const [A, B, C] = c;
  const f = (x: number) => A * x * x + B * x + C;
  // 取值范围 = 量词作用域（没有量词就是整个 R）
  const target = o.quant === 'none' ? REAL : o.domain;
  if (isEmpty(target)) return { min: null, max: null };
  if (isReal(target) || target.some((t) => !Number.isFinite(t.lo.v) || !Number.isFinite(t.hi.v))) {
    if (Math.abs(A) < 1e-9) return { min: null, max: null };
    return A > 0 ? { min: f(-B / (2 * A)), max: null } : { min: null, max: f(-B / (2 * A)) };
  }
  let min: number | null = null;
  let max: number | null = null;
  target.forEach((t) => {
    const cand: number[] = [];
    if (t.lo.closed) cand.push(f(t.lo.v));
    if (t.hi.closed) cand.push(f(t.hi.v));
    if (Math.abs(A) > 1e-9) {
      const vx = -B / (2 * A);
      if (vx > t.lo.v && vx < t.hi.v) cand.push(f(vx));
    }
    cand.forEach((v) => {
      if (min === null || v < min) min = v;
      if (max === null || v > max) max = v;
    });
  });
  return { min, max };
}

/* ------------------------------------------------------------------ *
 * 入口一：自然语言
 * ------------------------------------------------------------------ */

const NUM = '-?\\d+(?:\\.\\d+)?';

/** 从文字里抓出 x∈[a,b] 这类作用域 */
function readDomain(text: string): RealSet | null {
  const m = text.match(new RegExp(`[xX]\\s*[∈属于]\\s*([\\[(])\\s*(${NUM})\\s*,\\s*(${NUM})\\s*([\\])])`));
  if (m) {
    return normalize([
      {
        lo: { v: Number(m[2]), closed: m[1] === '[' },
        hi: { v: Number(m[3]), closed: m[4] === ']' },
      },
    ]);
  }
  const plain = text.match(new RegExp(`[xX]\\s*[∈属于]\\s*(${NUM})\\s*~\\s*(${NUM})`));
  if (plain) {
    return normalize([
      { lo: { v: Number(plain[1]), closed: true }, hi: { v: Number(plain[2]), closed: true } },
    ]);
  }
  return null;
}

/** 从文字里抓出 B 的描述，如 B=[1,3] / B={x|1≤x≤3} */
function readB(text: string): string | null {
  const nb = text.match(new RegExp(`B\\s*=\\s*[\\[(]\\s*(${NUM})\\s*,\\s*(${NUM})\\s*[\\])]`));
  if (nb) return `${nb[1]}≤x≤${nb[2]}`;
  const chain = text.match(new RegExp(`B\\s*=\\s*\\{?\\s*[xX]\\s*\\|\\s*(${NUM})\\s*[≤<]\\s*[xX]\\s*[≤<]\\s*(${NUM})`));
  if (chain) return `${chain[1]}≤x≤${chain[2]}`;
  return null;
}

function readOp(text: string): SetOp {
  if (/A\s*[⊆⊂]\s*B/.test(text)) return 'subset';
  if (/A\s*[⊇⊃]\s*B/.test(text)) return 'single';
  if (/A\s*∩\s*B/.test(text)) return 'intersect';
  if (/A\s*∪\s*B/.test(text)) return 'union';
  if (/∁\s*A|补集/.test(text)) return 'comp';
  return 'single';
}

/**
 * 自然语言 → 对象。
 * 例：「对任意 x∈[1,2]，x²-a≥0」→ 量词 ∀、作用域 [1,2]、目标 恒成立。
 */
export function readNatural(text: string, base: MathObj): MathObj {
  if (!text.trim()) return base;
  let rest = text.replace(/\s+/g, ' ');

  const quant: Quant = /对任意|任取|任意的?\s*x|∀/.test(rest)
    ? 'forall'
    : /存在|至少有一个|∃/.test(rest)
      ? 'exists'
      : 'none';

  const domain = readDomain(rest) ?? base.domain;
  const op = readOp(rest);
  const sourceB = readB(rest) ?? base.sourceB;

  // 去掉量词短语、作用域短语和前置称呼，剩下的就是约束条件
  rest = rest
    .replace(/^(已知|设|若|题目)?[：:]?\s*/, '')
    .replace(/对任意|任取|任意的?|∀|存在|至少有一个|∃/g, '')
    .replace(new RegExp(`[xX]\\s*[∈属于]\\s*[\\[(]?\\s*${NUM}\\s*[~,=]\\s*${NUM}\\s*[\\])]?`), '')
    .replace(/A\s*[⊆⊂⊇⊃=∩∪]\s*B\s*(=[^，,]*)?/g, '')
    .replace(/B\s*=[^，,]*/g, '')
    .replace(/[，,。;；]/g, '，')
    .split('，')
    .map((s) => s.trim())
    .filter(Boolean)
    .find((s) => /x|不等式|恒成立|≥|≤|>|<|²/.test(s)) ?? '';

  const source = cleanExpr(rest) || base.source;

  const goal: Goal = /最[大小]值|最值/.test(text)
    ? 'extreme'
    : quant !== 'none' || /恒成立|都成立|恒成立|总成立/.test(text)
      ? 'hold'
      : 'solve';

  const next: MathObj = { ...base, quant, domain, source, sourceB, op, goal };
  return withParams(next);
}

/** 把一句话收拾成一个能解析的式子：去外壳、去废话连接词、去尾巴 */
function cleanExpr(raw: string): string {
  if (!raw.trim()) return '';
  let s = raw.trim();
  const bar = s.match(/\{?\s*[xX]\s*\|\s*(.+?)\s*\}?$/);
  if (bar) s = bar[1];
  s = s
    .replace(/^[AB]\s*=\s*/, '')
    .replace(/^[{}]|[{}\s]+$/g, '')
    .trim();
  // 句首连接词
  for (let i = 0; i < 4; i += 1) {
    const next = s.replace(/^(使|使得|让|则|有|且|若|设|求|求解|解|试|试用|并|恒有|恒成立|已知|而)\s*/, '').trim();
    if (next === s) break;
    s = next;
  }
  // 句尾废话
  for (let i = 0; i < 4; i += 1) {
    const next = s.replace(/(\s*(的解集|解集|的解|的范围|范围|恒成立|成立|都成立|恒成立即可)+)$/, '').trim();
    if (next === s) break;
    s = next;
  }
  return /[xX²≥≤<>=\-]/.test(s) ? s : '';
}

/* ------------------------------------------------------------------ *
 * 入口二：符号 / LaTeX
 * ------------------------------------------------------------------ */

/** LaTeX → 纯文本：去掉 $ / \left / \right / 空格，\le → ≤ … */
export function fromSymbol(src: string): string {
  return src
    .replace(/\\left|\\right|\\displaystyle|\\,|\\;|\\!/g, '')
    .replace(/\$/g, '')
    .replace(/\\le(q)?/g, '≤')
    .replace(/\\ge(q)?/g, '≥')
    .replace(/\\ne(q)?/g, '≠')
    .replace(/\\times|\\cdot/g, '')
    .replace(/\\in/g, '∈')
    .replace(/\\subseteq|\\subset/g, '⊆')
    .replace(/\\supseteq|\\supset/g, '⊇')
    .replace(/\\cap/g, '∩')
    .replace(/\\cup/g, '∪')
    .replace(/\\complement/g, '∁')
    .replace(/\\varnothing|\\emptyset/g, '∅')
    .replace(/\^\{2\}/g, '²')
    .replace(/\^\{(-?\d+)\}/g, '^$1')
    .replace(/\^\{(-?[a-z0-9]+)\}/g, '^($1)')
    .replace(/\\forall/g, '∀')
    .replace(/\\exists/g, '∃')
    .replace(/\\infty/g, '∞')
    .replace(/-\\infty/g, '−∞')
    .replace(/\\frac\s*\{([^}]*)\}\s*\{([^}]*)\}/g, '($1)/($2)')
    .replace(/\s/g, '');
}

/* ------------------------------------------------------------------ *
 * 入口三：数轴拖拽反推
 * ------------------------------------------------------------------ */

export type DragSpec = { lo: number; hi: number; loClosed: boolean; hiClosed: boolean };

/** 区间 → 式子：优先写成绝对值距离模型 |x−c| ~ r，也可写成区间 */
export function inferFromDrag(d: DragSpec): { abs: string; literal: string; chain: string } {
  const c = Math.round(((d.lo + d.hi) / 2) * 100) / 100;
  const r = Math.round(((d.hi - d.lo) / 2) * 100) / 100;
  const inner = d.loClosed ? '≤' : '<';
  const centerTxt = c === 0 ? 'x' : `x−${c}`;
  const lit: string = `${d.loClosed ? '[' : '('}${d.lo}, ${d.hi}${d.hiClosed ? ']' : ')'}`;
  if (!Number.isFinite(d.lo) || !Number.isFinite(d.hi)) {
    if (!Number.isFinite(d.lo) && Number.isFinite(d.hi)) return { abs: `x${inner}${d.hi}`, literal: lit, chain: `x${inner}${d.hi}` };
    if (Number.isFinite(d.lo) && !Number.isFinite(d.hi)) return { abs: `x${d.loClosed ? '≥' : '>'}${d.lo}`, literal: lit, chain: `x${d.loClosed ? '≥' : '>'}${d.lo}` };
    return { abs: 'R', literal: 'R', chain: 'R' };
  }
  return {
    abs: `|${centerTxt}|${inner}${r}`,
    literal: lit,
    chain: `${d.lo}${d.loClosed ? '≤' : '<'}x${d.hiClosed ? '≤' : '<'}${d.hi}`,
  };
}

/* ------------------------------------------------------------------ *
 * 参数：给每个参数一个默认取值
 * ------------------------------------------------------------------ */

export function withParams(o: MathObj): MathObj {
  const ps = paramList(o);
  const vals = { ...o.vals };
  let dirty = false;
  ps.forEach((p) => {
    if (vals[p] === undefined) {
      vals[p] = 2;
      dirty = true;
    }
  });
  return dirty ? { ...o, vals } : o;
}

/** 一次只看一个主参数：正在盯着的那个，没有就取第一个（再没有就 null） */
export function mainParam(o: MathObj): string | null {
  const ps = paramList(o);
  if (!ps.length) return null;
  return o.focusP && ps.includes(o.focusP) ? o.focusP : ps[0];
}

/* ------------------------------------------------------------------ *
 * 每一项的系数都能拖：原来是数字的，也能就地变成参数
 * ------------------------------------------------------------------ */

/** 二次式的三个位置：二次项 / 一次项 / 常数项 */
export type CoefKey = 'A' | 'B' | 'C';

const KEY_TO_FIELD: Record<CoefKey, 'a' | 'b' | 'c'> = { A: 'a', B: 'b', C: 'c' };

const LETTER_POOL = ['a', 'b', 'c', 'k', 'm', 'n', 'p', 'q', 'd'];

export type CoefSlot = {
  key: CoefKey;
  /** 这一项的名字 */
  name: string;
  /** 式子里的位置，说得更直白 */
  term: string;
  /** 当前数值 */
  value: number;
  /** 现在这一项已经是参数字母（null = 还是个数字） */
  param: string | null;
  /** 这个参数在式子里带着负号（如 −a） */
  neg: boolean;
  /** 拖动范围 */
  min: number;
  max: number;
  step: number;
};

const SLOT_INFO: Record<CoefKey, { name: string; term: string; min: number; max: number; step: number }> = {
  A: { name: '二次项系数', term: 'x² 前面的那个数', min: -3, max: 3, step: 0.1 },
  B: { name: '一次项系数', term: 'x 前面的那个数', min: -6, max: 6, step: 0.1 },
  C: { name: '常数项', term: '不带 x 的那个数', min: -6, max: 6, step: 0.1 },
};

function roundTo(v: number, step: number): number {
  return Math.round(v / step) * step;
}

/** 这个式子的三个系数槽位长什么样（不是二次式就返回空数组） */
export function coefSlots(o: MathObj): CoefSlot[] {
  const q = parseQuadratic(o.source);
  if (!q) return [];
  const [va, vb, vc] = evalPoly(q.poly, o.vals);
  const values: Record<CoefKey, number> = { A: va, B: vb, C: vc };
  return (['A', 'B', 'C'] as CoefKey[]).map((key) => {
    const tok = q.poly[KEY_TO_FIELD[key]];
    const info = SLOT_INFO[key];
    return {
      key,
      name: info.name,
      term: info.term,
      value: Math.round(values[key] * 1000) / 1000,
      param: typeof tok === 'string' ? tok.replace(/^[+-]/, '') : null,
      neg: typeof tok === 'string' && tok.startsWith('-'),
      min: info.min,
      max: info.max,
      step: info.step,
    };
  });
}

/** 把某一项系数改成新数值：原来是字母就改取值，原来是数字就把这一项就地换成参数字母 */
export function setCoef(o: MathObj, key: CoefKey, raw: number): MathObj {
  const q = parseQuadratic(o.source);
  if (!q) return o;
  const v = roundTo(raw, SLOT_INFO[key].step);
  const field = KEY_TO_FIELD[key];
  const tok = q.poly[field];

  // 已经是参数（可能带负号）：维持符号，改的是取值
  if (typeof tok === 'string') {
    const letter = tok.replace(/^[+-]/, '');
    const neg = tok.startsWith('-');
    const vals = { ...o.vals, [letter]: neg ? -v : v };
    // 别把式子拖成「0·x² + 0·x」—— 那样连 x 都不剩了
    const [A, B] = evalPoly(q.poly, vals);
    if (Math.abs(A) < 1e-9 && Math.abs(B) < 1e-9) return o;
    return { ...o, focusP: letter, vals };
  }

  // 还是数字：挑一个没被占用的字母替上去，取值先等于现在这个数
  const used = new Set([...paramList(o), o.variable]);
  const letter = LETTER_POOL.find((c) => !used.has(c));
  if (!letter) return o;
  const poly: Poly = { ...q.poly, [field]: letter };
  const vals = { ...o.vals, [letter]: Math.round(Number(tok) * 1000) / 1000 };
  const [A, B] = evalPoly(poly, vals);
  if (Math.abs(A) < 1e-9 && Math.abs(B) < 1e-9) return o;
  return { ...o, source: polyToSrc(poly, q.op), vals, focusP: letter };
}

/** （系数 + 不等号）→ 一句人能读的式子 */
export function polyToSrc(poly: Poly, op: '<=' | '>=' | '<' | '>'): string {
  const sign = op === '<=' ? '≤' : op === '>=' ? '≥' : op === '<' ? '<' : '>';
  return `${fmtPoly(poly)}${sign}0`;
}

/**
 * 把参数扫一遍，看看哪些取值真的让结论成立 —— 这就是数值版的「答案区间」。
 * 系数可以随便拖，所以答案不能写死，得当场算出来。
 */
export function answerRuns(o: MathObj, p: string, lo: number, hi: number, steps = 400): { lo: number; hi: number }[] {
  const holds = (v: number) => inclusionHolds(o, { ...o.vals, [p]: v });
  const at = (i: number) => lo + ((hi - lo) * i) / steps;
  const bisect = (badV: number, goodV: number) => {
    let a = badV;
    let b = goodV;
    for (let k = 0; k < 14; k += 1) {
      const m = (a + b) / 2;
      if (holds(m)) b = m;
      else a = m;
    }
    return b;
  };
  const runs: { lo: number; hi: number }[] = [];
  let i = 0;
  while (i <= steps) {
    if (!holds(at(i))) {
      i += 1;
      continue;
    }
    const startV = i > 0 ? bisect(at(i - 1), at(i)) : lo;
    let j = i;
    while (j + 1 <= steps && holds(at(j + 1))) j += 1;
    const endV = j < steps ? bisect(at(j + 1), at(j)) : hi;
    runs.push({ lo: startV, hi: endV });
    i = j + 2;
  }
  return runs;
}

/** 只把某一项换成 v 之后的 (A,B,C) —— 用来预演「这一项拖到那儿会怎样」，不改动原题 */
export function coefsWith(o: MathObj, key: CoefKey, v: number): [number, number, number] | null {
  const q = parseQuadratic(o.source);
  if (!q) return null;
  const poly: Poly = { ...q.poly, [KEY_TO_FIELD[key]]: v };
  return evalPoly(poly, o.vals);
}

/** 把某个参数改成指定值 */
export function setParam(o: MathObj, name: string, v: number): MathObj {
  return { ...o, vals: { ...o.vals, [name]: v } };
}

/* ------------------------------------------------------------------ *
 * 拖拽根 → 反解参数（数值扫描）
 * ------------------------------------------------------------------ */

/**
 * 给定目标根 target 与根序号 idx，在参数取值范围内扫描出最接近的参数值。
 * 这样“拖根指针”就能反过来带着中区画布动起来。
 */
export function solveParamForRoot(
  o: MathObj,
  target: number,
  idx: number,
  range: { min: number; max: number } = { min: -8, max: 8 }
): Record<string, number> | null {
  const p = mainParam(o);
  if (!p) return null;
  let bestV = o.vals[p];
  let bestErr = Number.POSITIVE_INFINITY;
  const steps = 1600;
  for (let i = 0; i <= steps; i += 1) {
    const v = range.min + ((range.max - range.min) * i) / steps;
    const c = coefOf(o, { ...o.vals, [p]: v });
    if (!c) break;
    const [A, B, C] = c;
    const d = discriminant(A, B, C);
    if (d < 0) continue;
    if (Math.abs(A) < 1e-9) {
      const r = -C / B;
      if (Number.isFinite(r)) {
        const err = Math.abs(r - target);
        if (err < bestErr) {
          bestErr = err;
          bestV = v;
        }
      }
      continue;
    }
    const sq = Math.sqrt(d);
    const roots = [(-B - sq) / (2 * A), (-B + sq) / (2 * A)].sort((x, y) => x - y);
    const picked = roots[Math.min(idx, roots.length - 1)];
    const err = Math.abs(picked - target);
    if (err < bestErr) {
      bestErr = err;
      bestV = v;
    }
  }
  return { ...o.vals, [p]: Math.round(bestV * 1000) / 1000 };
}

/* ------------------------------------------------------------------ *
 * 对象模型 → 展示
 * ------------------------------------------------------------------ */

export function objSummary(o: MathObj): { k: string; v: string }[] {
  const ps = paramList(o);
  return [
    { k: '未知数', v: o.variable },
    { k: '条件', v: o.source },
    { k: '参数', v: ps.length ? ps.map((p) => `${p} = ${round2(o.vals[p] ?? 0)}`).join('，') : '没有参数，全是数字' },
    { k: '说法', v: `${QUANT_TEXT[o.quant]}${o.quant === 'none' ? '' : `，范围 ${scopeText(o.domain)}`}` },
    { k: '要做什么', v: GOAL_TEXT[o.goal] },
  ];
}

function scopeText(s: RealSet): string {
  if (isEmpty(s)) return '∅';
  if (s === REAL || (s.length === 1 && s[0].lo.v === NEG_INF && s[0].hi.v === POS_INF)) return 'R';
  return s
    .map((t) => `${t.lo.v}${t.lo.closed ? '≤' : '<'}x${t.hi.closed ? '≤' : '<'}${t.hi.v}`)
    .join(' 或 ');
}

/** 取某集合中的若干“代表元”，给 Venn 投影用 */
export function samplePoints(o: MathObj, extra: number[] = []): number[] {
  const set = evalA(o);
  const pool = new Set<number>([...extra, 0, 1, -1, 2, 3, 4, -2]);
  set.forEach((t) => {
    if (Number.isFinite(t.lo.v)) pool.add(Math.round(t.lo.v * 100) / 100);
    if (Number.isFinite(t.hi.v)) pool.add(Math.round(t.hi.v * 100) / 100);
    const mid = (t.lo.v + t.hi.v) / 2;
    if (Number.isFinite(mid)) pool.add(Math.round(mid * 100) / 100);
  });
  return Array.from(pool)
    .filter((n) => Number.isFinite(n) && Math.abs(n) < 60)
    .sort((a, b) => a - b)
    .slice(0, 7);
}

/** x 是否属于 A / B，给 Venn 的元素定位用 */
export function membership(o: MathObj, x: number): string[] {
  const out: string[] = [];
  if (has(evalA(o), x)) out.push('A');
  if (has(evalB(o), x)) out.push('B');
  return out;
}
