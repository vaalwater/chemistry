/**
 * 高中数学 · 集合内核（纯函数，不含任何渲染依赖）
 *
 * 一条主线：所有输入（自然语言 / 符号 / 拖出来的区间）先归一化成
 * 「实数集 = 若干区间的并」这一个数学对象，之后解集画布、参数地图、
 * 推理轨道、韦达面板、冲突探针全部只跟这个对象打交道。
 */

/* ------------------------------------------------------------------ *
 * 一、区间代数
 * ------------------------------------------------------------------ */

/** 端点：v 是坐标，closed 表示是否取到（实心 / 空心） */
export type End = { v: number; closed: boolean };
/** 一个区间（闭 / 开 / 半开半闭 / 退化成单点） */
export type Interval = { lo: End; hi: End };
/** 实数集：若干互不相交、已按左端点排序的区间的并 */
export type RealSet = Interval[];

export const NEG_INF = Number.NEGATIVE_INFINITY;
export const POS_INF = Number.POSITIVE_INFINITY;

export const EMPTY: RealSet = [];
export const REAL: RealSet = [{ lo: { v: NEG_INF, closed: false }, hi: { v: POS_INF, closed: false } }];

export function end(v: number, closed = true): End {
  return { v, closed };
}

export function iv(a: number, b: number, aClosed = true, bClosed = true): Interval {
  return { lo: end(Math.min(a, b), aClosed), hi: end(Math.max(a, b), bClosed) };
}

export function single(x: number): RealSet {
  return [{ lo: end(x), hi: end(x) }];
}

export function isEmpty(s: RealSet): boolean {
  return s.length === 0;
}

/** 是否整个实数轴 */
export function isReal(s: RealSet): boolean {
  return s.length === 1 && s[0].lo.v === NEG_INF && s[0].hi.v === POS_INF;
}

/** 区间是否为空（左端点超过右端点，或单点但两端不同时闭合） */
function ivEmpty(t: Interval): boolean {
  if (t.lo.v > t.hi.v) return true;
  if (t.lo.v === t.hi.v) return !(t.lo.closed && t.hi.closed);
  return false;
}

/** 两个区间是否可以合并成一段（重叠，或在接缝处至少一个端点闭合） */
function joinable(a: Interval, b: Interval): boolean {
  if (a.hi.v > b.lo.v) return true;
  if (a.hi.v === b.lo.v) return a.hi.closed || b.lo.closed;
  return false;
}

function mergeTwo(a: Interval, b: Interval): Interval {
  let lo = a.lo;
  let hi = a.hi;
  if (b.lo.v < a.lo.v || (b.lo.v === a.lo.v && (b.lo.closed || !a.lo.closed))) lo = b.lo;
  if (b.hi.v > a.hi.v || (b.hi.v === a.hi.v && (b.hi.closed || !a.hi.closed))) hi = b.hi;
  return { lo, hi };
}

/** 排序 + 合并重叠区间 */
export function normalize(list: Interval[]): RealSet {
  const parts = list.filter((t) => !ivEmpty(t)).map((t) => ({ ...t }));
  parts.sort((p, q) => p.lo.v - q.lo.v || (p.lo.closed ? 0 : 1) - (q.lo.closed ? 0 : 1));
  const out: Interval[] = [];
  for (const t of parts) {
    const last = out[out.length - 1];
    if (last && joinable(last, t)) out[out.length - 1] = mergeTwo(last, t);
    else out.push(t);
  }
  return out;
}

/** 并集 */
export function union(a: RealSet, b: RealSet): RealSet {
  return normalize([...a, ...b]);
}

/** 交集 */
export function intersect(a: RealSet, b: RealSet): RealSet {
  const out: Interval[] = [];
  for (const p of a) {
    for (const q of b) {
      const lo = p.lo.v > q.lo.v ? p.lo : q.lo.v > p.lo.v ? q.lo : { v: p.lo.v, closed: p.lo.closed && q.lo.closed };
      const hi = p.hi.v < q.hi.v ? p.hi : q.hi.v < p.hi.v ? q.hi : { v: p.hi.v, closed: p.hi.closed && q.hi.closed };
      const t: Interval = { lo, hi };
      if (!ivEmpty(t)) out.push(t);
    }
  }
  return normalize(out);
}

/** 补集（默认全集为 R） */
export function complement(a: RealSet, universe: RealSet = REAL): RealSet {
  let rest: RealSet = normalize(universe.map((t) => ({ ...t })));
  for (const p of a) {
    const next: Interval[] = [];
    for (const u of rest) {
      // 左侧剩余
      if (p.lo.v > u.lo.v || (p.lo.v === u.lo.v && !p.lo.closed && u.lo.closed)) {
        next.push({ lo: u.lo, hi: { v: p.lo.v, closed: !p.lo.closed } });
      }
      // 右侧剩余
      if (p.hi.v < u.hi.v || (p.hi.v === u.hi.v && !p.hi.closed && u.hi.closed)) {
        next.push({ lo: { v: p.hi.v, closed: !p.hi.closed }, hi: u.hi });
      }
    }
    rest = normalize(next);
  }
  return rest;
}

/** 差集 A \ B */
export function diff(a: RealSet, b: RealSet): RealSet {
  return intersect(a, complement(b));
}

/** x ∈ A ? */
export function has(s: RealSet, x: number): boolean {
  return s.some((t) => {
    const loOk = t.lo.v < x || (t.lo.v === x && t.lo.closed);
    const hiOk = t.hi.v > x || (t.hi.v === x && t.hi.closed);
    return loOk && hiOk;
  });
}

/** A ⊆ B ? */
export function subset(a: RealSet, b: RealSet): boolean {
  if (isEmpty(a)) return true; // 空集是任何集合的子集
  return a.every((t) => {
    const cover = intersect([t], b);
    return sameSet(cover, [t]);
  });
}

/** A ⊇ B ? */
export function superset(a: RealSet, b: RealSet): boolean {
  return subset(b, a);
}

/** A = B ? */
export function sameSet(a: RealSet, b: RealSet): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    const p = a[i];
    const q = b[i];
    if (p.lo.v !== q.lo.v || p.lo.closed !== q.lo.closed) return false;
    if (p.hi.v !== q.hi.v || p.hi.closed !== q.hi.closed) return false;
  }
  return true;
}

/** A ⊊ B（真子集）? */
export function properSubset(a: RealSet, b: RealSet): boolean {
  return subset(a, b) && !sameSet(a, b);
}

/** A ∩ B 是否为空（互斥） */
export function disjoint(a: RealSet, b: RealSet): boolean {
  return isEmpty(intersect(a, b));
}

/** 端点列表（画布画刻度、探针用） */
export function endpoints(s: RealSet): number[] {
  const out: number[] = [];
  for (const t of s) {
    if (Number.isFinite(t.lo.v)) out.push(t.lo.v);
    if (Number.isFinite(t.hi.v)) out.push(t.hi.v);
  }
  return Array.from(new Set(out)).sort((x, y) => x - y);
}

/* ------------------------------------------------------------------ *
 * 二、显示
 * ------------------------------------------------------------------ */

export function fmtNum(v: number): string {
  if (v === NEG_INF) return '−∞';
  if (v === POS_INF) return '+∞';
  const r = Math.round(v * 1000) / 1000;
  return String(r);
}

export function fmtInterval(t: Interval): string {
  const l = t.lo.closed ? '[' : '(';
  const r = t.hi.closed ? ']' : ')';
  return `${l}${fmtNum(t.lo.v)}, ${fmtNum(t.hi.v)}${r}`;
}

/** 数轴 / 描述法两种写法 */
export function fmtSet(s: RealSet): string {
  if (isEmpty(s)) return '∅';
  if (isReal(s)) return 'R';
  return s.map(fmtInterval).join(' ∪ ');
}

export function fmtSetBuilder(s: RealSet, v = 'x'): string {
  if (isEmpty(s)) return `{${v} | ${v} ∈ ∅} = ∅`;
  if (isReal(s)) return 'R';
  const cond = s
    .map((t) => {
      const lo = t.lo.v === NEG_INF ? '' : `${fmtNum(t.lo.v)}${t.lo.closed ? '≤' : '<'}${v}`;
      const hi = t.hi.v === POS_INF ? '' : `${v}${t.hi.closed ? '≤' : '<'}${fmtNum(t.hi.v)}`;
      if (lo && hi) return `${lo}${t.lo.closed && t.hi.closed ? '≤' : '<'}${fmtNum(t.hi.v)}`;
      return lo || hi;
    })
    .join(' 或 ');
  return `{${v} | ${cond}}`;
}

/* ------------------------------------------------------------------ *
 * 三、解析：自然语言 / 符号 → 数学对象
 * ------------------------------------------------------------------ */

export type ParsedSet =
  | { kind: 'const'; set: RealSet; text: string }
  | {
      kind: 'param';
      params: string[];
      text: string;
      evalSet: (vals: Record<string, number>) => RealSet;
    };

export type Poly = { a: number | string; b: number | string; c: number | string };

/** 允许作为参数出现的字母 */
const PARAM_LETTERS = 'abcdkmnpq';
const PARAM_CLASS = '[abcdkmnpq]';

function isParamToken(s: string): boolean {
  return new RegExp(PARAM_CLASS).test(s);
}

/** 把「系数串」（'-a' / '3' / '' / '+2'）在具体参数取值下算成数字 */
function asValue(tok: string, vals: Record<string, number>): number {
  const raw = tok.trim();
  if (!raw) return 1;
  const t = raw.replace(/^\+/, '');
  if (/^-?\d+(\.\d+)?$/.test(t)) return Number(t);
  const neg = t.startsWith('-');
  const letter = t.replace(/^[+-]/, '');
  const v = vals[letter];
  if (v === undefined || !Number.isFinite(v)) return 0;
  return neg ? -v : v;
}

/** 系数归一化：'' → 1，'-' → -1，纯数字 → 数字，含字母 → 原样保留符号 */
function coefOf(raw: string): number | string {
  const t = raw.replace(/^\+/, '');
  if (t === '' || t === '+') return 1;
  if (t === '-') return -1;
  if (isParamToken(t)) return t;
  return Number(t);
}

/**
 * 解析一元二次不等式 ax²+bx+c ~ 0，系数可以是数字也可以是参数字母。
 * 返回 null 表示不是二次式。
 */
export function parseQuadratic(src: string): { poly: Poly; op: '<=' | '>=' | '<' | '>' } | null {
  const s = src
    .replace(/−/g, '-')
    .replace(/–/g, '-')
    .replace(/≤/g, '<=')
    .replace(/≥/g, '>=')
    .replace(/\s/g, '')
    .replace(/\^2/g, '²')
    .replace(/\^\{2\}/g, '²')
    .replace(/[*·]/g, '');
  // 含绝对值、集合花括号的式子不算二次式（它们另有解析路径）
  if (s.includes('|') || s.includes('{') || s.includes('[')) return null;
  const at = s.search(/(<=|>=|<|>)/);
  if (at < 0) return null;
  const op = (s.match(/(<=|>=|<|>)/) as RegExpMatchArray)[1] as '<=' | '>=' | '<' | '>';
  const lhs = s.slice(0, at);
  if (!/x/.test(lhs)) return null;

  const poly: Poly = { a: 0, b: 0, c: 0 };
  const am = lhs.match(new RegExp(`([+-]?[\\d.]*${PARAM_CLASS}?)x²`));
  if (am) poly.a = coefOf(am[1]);
  const restAfterA = am ? lhs.replace(am[0], '') : lhs;
  const bm = restAfterA.match(new RegExp(`([+-]?[\\d.]*${PARAM_CLASS}?)x(?!²)`));
  if (bm) poly.b = coefOf(bm[1]);
  const rest = bm ? restAfterA.replace(bm[0], '') : restAfterA;
  if (rest) {
    const cm = rest.match(/([+-]?[\d.]*[a-z]?)/);
    if (cm && cm[1]) poly.c = coefOf(cm[1]);
  }
  if (poly.a === 0 && poly.b === 0) return null;
  return { poly, op };
}

export function hasParam(poly: Poly): boolean {
  return [poly.a, poly.b, poly.c].some((v) => typeof v === 'string' && isParamToken(String(v)));
}

export function paramsOf(poly: Poly): string[] {
  const out = new Set<string>();
  [poly.a, poly.b, poly.c].forEach((v) => {
    if (typeof v !== 'string') return;
    const found = v.match(new RegExp(PARAM_CLASS, 'g'));
    if (found) found.forEach((ch) => out.add(ch));
  });
  return Array.from(out);
}

/** 把含参多项式在具体取值下算成 (A,B,C) */
export function evalPoly(poly: Poly, vals: Record<string, number>): [number, number, number] {
  return [asValue(String(poly.a), vals), asValue(String(poly.b), vals), asValue(String(poly.c), vals)];
}

/** 把含参多项式写成人类可读的式子 */
export function fmtPoly(poly: Poly, v = 'x'): string {
  const parts: string[] = [];
  const term = (coef: number | string, suffix: string, first: boolean) => {
    const c = typeof coef === 'number' ? String(coef) : coef;
    let body = '';
    const abs = typeof coef === 'number' ? Math.abs(coef) : c.replace(/^[+-]/, '');
    if (suffix === '') body = String(abs);
    else if (abs === '1' || abs === 1) body = suffix;
    else body = `${abs}${suffix}`;
    const sign = typeof coef === 'number' ? (coef < 0 ? '−' : first ? '' : '+') : c.startsWith('-') ? '−' : first ? '' : '+';
    parts.push(`${sign}${body}`);
  };
  term(poly.a, `${v}²`, true);
  term(poly.b, v, false);
  term(poly.c, '', false);
  return parts.join('') || '0';
}

/**
 * 解一元二次不等式（A 可为 0，此时退化为一次不等式）。
 * op 为 '≤' 时取函数值 ≤ 0 的部分。
 */
export function solveQuadratic(
  A: number,
  B: number,
  C: number,
  op: '<=' | '>=' | '<' | '>'
): RealSet {
  const wantsBelow = op === '<=' || op === '<';
  const strict = op === '<' || op === '>';
  // 退化：一次不等式
  if (Math.abs(A) < 1e-9) {
    if (Math.abs(B) < 1e-9) {
      const ok = wantsBelow ? C <= 0 : C >= 0;
      return ok ? REAL : EMPTY;
    }
    const root = -C / B;
    // B>0 时 Bx+C ≤ 0 → x ≤ root；B<0 时方向反过来
    if (wantsBelow) {
      return B > 0
        ? [{ lo: end(NEG_INF, false), hi: end(root, !strict) }]
        : [{ lo: end(root, !strict), hi: end(POS_INF, false) }];
    }
    return B > 0
      ? [{ lo: end(root, !strict), hi: end(POS_INF, false) }]
      : [{ lo: end(NEG_INF, false), hi: end(root, !strict) }];
  }
  const disc = B * B - 4 * A * C;
  const up = A > 0; // 开口向上
  // f ≤ 0 在开口向上时取两根之间
  const inner = up === wantsBelow;
  const close = !strict;
  if (disc < -1e-9) {
    // 无实根：开口向上则恒正
    const alwaysPositive = up;
    const ok = wantsBelow ? !alwaysPositive : alwaysPositive;
    return ok ? REAL : EMPTY;
  }
  const sq = Math.sqrt(Math.max(0, disc));
  const r1 = (-B - sq) / (2 * A);
  const r2 = (-B + sq) / (2 * A);
  const lo = Math.min(r1, r2);
  const hi = Math.max(r1, r2);
  if (disc <= 1e-9) {
    // 重根：f ≤ 0（开口向上）只有这一个点
    const pt = single(lo);
    if (inner) return strict ? EMPTY : pt;
    return REAL;
  }
  if (inner) return [{ lo: end(lo, close), hi: end(hi, close) }];
  return [
    { lo: end(NEG_INF, false), hi: end(lo, close) },
    { lo: end(hi, close), hi: end(POS_INF, false) },
  ];
}

/** 判别式 */
export function discriminant(A: number, B: number, C: number): number {
  return B * B - 4 * A * C;
}

/** 二次方程的实根（按大小排序） */
export function quadraticRoots(A: number, B: number, C: number): number[] {
  const d = discriminant(A, B, C);
  if (d < -1e-9) return [];
  if (Math.abs(A) < 1e-9) return Math.abs(B) < 1e-9 ? [] : [-C / B];
  const sq = Math.sqrt(Math.max(0, d));
  const r1 = (-B - sq) / (2 * A);
  const r2 = (-B + sq) / (2 * A);
  return d <= 1e-9 ? [r1] : [Math.min(r1, r2), Math.max(r1, r2)];
}

/** 韦达定理；a = 0 时返回 null（二次退化，不能用韦达） */
export function vieta(A: number, B: number, C: number) {
  if (Math.abs(A) < 1e-9) return null;
  return { sum: -B / A, prod: C / A, axis: -B / (2 * A), disc: discriminant(A, B, C) };
}

export type RootTemplate =
  | 'none'
  | 'double'
  | 'both-in'
  | 'both-left'
  | 'both-right'
  | 'straddle'
  | 'on-edge';

/** 两根相对区间 [lo,hi] 的分布模板 */
export function rootTemplate(roots: number[], lo: number, hi: number): RootTemplate {
  if (roots.length === 0) return 'none';
  if (roots.length === 1) return 'double';
  const [x1, x2] = roots;
  if (x1 >= lo && x2 <= hi) return 'both-in';
  if (x2 <= lo) return 'both-left';
  if (x1 >= hi) return 'both-right';
  return 'straddle';
}

export const ROOT_TEMPLATE_TEXT: Record<RootTemplate, string> = {
  none: '无实根（Δ<0）',
  double: '两个相等实根（Δ=0）',
  'both-in': '两根都在区间内',
  'both-left': '两根都在区间左侧',
  'both-right': '两根都在区间右侧',
  straddle: '区间夹在两根中间',
  'on-edge': '根落在区间端点上',
};

/* ------------------------------------------------------------------ *
 * 四、统一入口解析
 * ------------------------------------------------------------------ */

const OP_RE = /(<=|>=|≤|≥|<|>)/;

/** 把用户输入归一化：统一减号、不等号，去掉空格 */
function canon(src: string): string {
  return src
    .replace(/−/g, '-')
    .replace(/–/g, '-')
    .replace(/≤/g, '<=')
    .replace(/≥/g, '>=')
    .replace(/≠/g, '!=')
    .replace(/\s/g, '');
}

/** 解析区间字面量，如 [1,3) ∪ (5,7] */
function parseIntervalLiteral(s: string): RealSet | null {
  if (!/[\[(]/.test(s)) return null;
  const parts = s.split('∪').filter(Boolean);
  const out: Interval[] = [];
  for (const raw of parts) {
    const m = raw.match(/^([\[(])\s*(-?[\d.]+|-?∞|-?oo)\s*,\s*(-?[\d.]+|∞|\+?∞|oo)\s*([\])])$/);
    if (!m) return null;
    const toNum = (t: string) => (t === '∞' || t === '+∞' || t === 'oo' ? POS_INF : t === '-∞' || t === '-oo' ? NEG_INF : Number(t));
    out.push({
      lo: { v: toNum(m[2]), closed: m[1] === '[' },
      hi: { v: toNum(m[3]), closed: m[4] === ']' },
    });
  }
  return normalize(out);
}

/** 解析不等式链：1≤x≤3 / -2<x<5 / x>2 / x≤0 */
function parseChain(s: string): RealSet | null {
  const low = s.match(/^(-?[\d.]+)\s*(<=|<)\s*[a-z]\s*(<=|<)\s*(-?[\d.]+)$/);
  if (low) {
    return [
      {
        lo: { v: Number(low[1]), closed: low[2] === '<=' },
        hi: { v: Number(low[4]), closed: low[3] === '<=' },
      },
    ];
  }
  const hiSide = s.match(/^[a-z]\s*(<=|<)\s*(-?[\d.]+)$/);
  if (hiSide) {
    return [
      { lo: { v: NEG_INF, closed: false }, hi: { v: Number(hiSide[2]), closed: hiSide[1] === '<=' } },
    ];
  }
  const loSide = s.match(/^(-?[\d.]+)\s*(<=|<)\s*[a-z]$/);
  if (loSide) {
    return [
      { lo: { v: Number(loSide[1]), closed: loSide[2] === '<=' }, hi: { v: POS_INF, closed: false } },
    ];
  }
  const right = s.match(/^[a-z]\s*(>=|>)\s*(-?[\d.]+)$/);
  if (right) {
    return [
      { lo: { v: Number(right[2]), closed: right[1] === '>=' }, hi: { v: POS_INF, closed: false } },
    ];
  }
  return null;
}

/** 解析绝对值不等式 |x-a|≤b → a-b ≤ x ≤ a+b */
function parseAbs(s: string): RealSet | null {
  const m = s.match(/^\|([a-z])\s*([+-]\s*[\d.]+)?\s*\|\s*(<=|<|>=|>)\s*([\d.]+)$/);
  if (!m) return null;
  const center = m[2] ? -Number(m[2].replace(/\s/g, '')) : 0;
  const r = Number(m[4]);
  const op = m[3];
  const inside = op === '<=' || op === '<';
  const close = op === '<=' || op === '>=';
  if (inside) return [{ lo: end(center - r, close), hi: end(center + r, close) }];
  return [
    { lo: end(NEG_INF, false), hi: end(center - r, close) },
    { lo: end(center + r, close), hi: end(POS_INF, false) },
  ];
}

/**
 * 统一解析入口。
 * 支持：
 *   [1,3] / (1,3] / [1,3) ∪ [5,7]
 *   {x|1≤x≤3} / {x | x > 2}
 *   x²-3x+2≤0 / x²-ax+1≤0（含参）
 *   |x-1|≤2
 *   R / ∅
 */
export function parseSet(src: string): ParsedSet | null {
  const raw = src.trim();
  if (!raw) return null;
  const text = raw;
  const s = canon(raw);

  if (s === 'R' || s === 'ℝ') return { kind: 'const', set: REAL, text };
  if (s === '∅' || s === '{}' || s === '空集') return { kind: 'const', set: EMPTY, text };

  // 描述法：抽出竖线后的条件
  let cond = s;
  const bar = s.match(/\{?\s*[a-z]\s*\|\s*(.+?)\s*\}?$/);
  if (bar) cond = bar[1];

  const abs = parseAbs(cond);
  if (abs) return { kind: 'const', set: abs, text };

  const lit = parseIntervalLiteral(cond);
  if (lit) return { kind: 'const', set: lit, text };

  const chain = parseChain(cond);
  if (chain) return { kind: 'const', set: chain, text };

  // 二次（可含参数）
  if (/x\s*(²|\^2)/.test(cond) && OP_RE.test(cond)) {
    const q = parseQuadratic(cond);
    if (q) {
      const opMatch = cond.match(/(<=|>=|<|>)/);
      const op = (opMatch ? opMatch[1] : '<=') as '<=' | '>=' | '<' | '>';
      const ps = paramsOf(q.poly);
      if (ps.length === 0) {
        const [A2, B2, C2] = evalPoly(q.poly, {});
        return { kind: 'const', set: solveQuadratic(A2, B2, C2, op), text };
      }
      return {
        kind: 'param',
        params: ps,
        text,
        evalSet: (vals) => {
          const [A2, B2, C2] = evalPoly(q.poly, vals);
          return solveQuadratic(A2, B2, C2, op);
        },
      };
    }
  }
  return null;
}

/* ------------------------------------------------------------------ *
 * 五、离散集合（Venn 图用）
 * ------------------------------------------------------------------ */

export type VennElement = { id: string; label: string; sets: string[] };

/** 元素落在 Venn 的哪一块：按所属集合名排序后拼接，'' 表示在全集外 */
export function regionKey(sets: string[], order: string[]): string {
  return order.filter((n) => sets.includes(n)).join('') || 'U';
}

export function regionLabel(key: string, order: string[]): string {
  if (key === 'U') return '全集内但不在任何给定集合里';
  const inside = order.filter((n) => key.includes(n));
  const outside = order.filter((n) => !key.includes(n));
  if (outside.length === 0) return `${inside.join(' ∩ ')}（公共部分）`;
  return `${inside.join(' ∩ ')} 且不属于 ${outside.join('、')}`;
}

/** 集合运算（离散版） */
export function dUnion(a: string[], b: string[]): string[] {
  return Array.from(new Set([...a, ...b]));
}
export function dIntersect(a: string[], b: string[]): string[] {
  return a.filter((x) => b.includes(x));
}
export function dComplement(a: string[], universe: string[]): string[] {
  return universe.filter((x) => !a.includes(x));
}
export function dSubset(a: string[], b: string[]): boolean {
  return a.every((x) => b.includes(x));
}

/** 关系判定：给两个离散集合，返回可展示的关系链 */
export function relationOf(a: string[], b: string[]) {
  return {
    subset: dSubset(a, b),
    superset: dSubset(b, a),
    equal: dSubset(a, b) && dSubset(b, a),
    disjoint: dIntersect(a, b).length === 0,
    inter: dIntersect(a, b),
    uni: dUnion(a, b),
  };
}
