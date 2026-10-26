// 分子式解析 + 常见结构（直链烷/烯/炔、醇、羧酸、苯环、葡萄糖、简单无机物）的近似 3D 建模
import type { MolAtom, MoleculeData } from './types';

type V3 = [number, number, number];
type S = { atoms: MolAtom[]; bonds: { a: number; b: number; order: number; style?: string }[] };

const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a: V3, s: number): V3 => [a[0] * s, a[1] * s, a[2] * s];
const cross = (a: V3, b: V3): V3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
function norm(a: V3): V3 {
  const l = Math.sqrt(a[0] * a[0] + a[1] * a[1] + a[2] * a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
}
function perp(a: V3): V3 {
  const alt: V3 = Math.abs(a[0]) > 0.9 ? [0, 1, 0] : [1, 0, 0];
  return norm(cross(a, alt));
}
function rotV(v: V3, axis: V3, ang: number): V3 {
  const k = norm(axis);
  const c = Math.cos(ang), s = Math.sin(ang);
  const dot = v[0] * k[0] + v[1] * k[1] + v[2] * k[2];
  const cr = cross(k, v);
  return [
    v[0] * c + cr[0] * s + k[0] * dot * (1 - c),
    v[1] * c + cr[1] * s + k[1] * dot * (1 - c),
    v[2] * c + cr[2] * s + k[2] * dot * (1 - c),
  ];
}
const TETRA: V3[] = [
  [1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1],
].map((t) => norm(t as V3));

/**
 * 电负性（Pauling 近似值）—— 决定「谁是中心原子」。
 *
 * ⚠️ 这里曾经用「分子式里第一个出现的非氢元素」当中心，而我们在推导产物时习惯把计数排序成
 *    `Cl3Fe`（按字母），于是 FeCl₃ 画成了 **Cl 居中、挂着两个 Cl 和一个 Fe** —— 完全反了。
 *    化合物里中心一定是**更正电**（电负性更小）的那一方：盐/卤化物里就是金属阳离子。
 */
const EN: Record<string, number> = {
  Li: 0.98, Be: 1.57, B: 2.04, C: 2.55, N: 3.04, O: 3.44, F: 3.98,
  Na: 0.93, Mg: 1.31, Al: 1.61, Si: 1.90, P: 2.19, S: 2.58, Cl: 3.16,
  K: 0.82, Ca: 1.00, Cr: 1.66, Mn: 1.55, Fe: 1.83, Cu: 1.90, Zn: 1.65,
  Br: 2.96, Ag: 1.93, I: 2.66, Ba: 0.89, Pb: 2.33, H: 2.20,
  He: 2.0, Ne: 2.0, Ar: 2.0,
};
/** 共价半径（Å）：两个原子半径相加≈一根单键的长度，和上面 L_CH/L_CO 那套常量同量纲 */
const COV: Record<string, number> = {
  H: 0.31, C: 0.76, N: 0.71, O: 0.66, F: 0.57, P: 1.07, S: 1.05, Cl: 0.99, Br: 1.14, I: 1.33,
  Li: 1.28, Be: 0.96, B: 0.84, Na: 1.66, Mg: 1.41, Al: 1.21, Si: 1.11, K: 2.03, Ca: 1.76,
  Cr: 1.39, Mn: 1.39, Fe: 1.32, Cu: 1.32, Zn: 1.22, Ag: 1.45, Ba: 1.98, Pb: 1.46,
  He: 0.28, Ne: 0.58, Ar: 0.71,
};
/** 金属 / 卤素：判断「这是不是一坨离子化合物」用 */
const METALS = new Set(['Li', 'Be', 'Na', 'Mg', 'Al', 'K', 'Ca', 'Cr', 'Mn', 'Fe', 'Cu', 'Zn', 'Ag', 'Ba', 'Pb']);
const HALOGENS = new Set(['F', 'Cl', 'Br', 'I']);

/** 按电负性挑中心原子：化合物里最「正电」的那方居中（FeCl₃ → Fe，NaCl → Na，SO₂ → S） */
export function pickCentral(c: CountMap): string {
  const els = Object.keys(c).filter((el) => (c[el] || 0) > 0);
  if (!els.length) return 'H';
  const pool = els.filter((el) => el !== 'H');      // H 永远挂在外围，不当中心
  const list = pool.length ? pool : els;
  return list.reduce((best, el) => {
    if ((EN[el] ?? 2.0) < (EN[best] ?? 2.0)) return el;
    // 电负性相同时取原子数少的那个做中心（如 Cl₂ 两个都一样，取第一个即可）
    if ((EN[el] ?? 2.0) === (EN[best] ?? 2.0) && (c[el] || 0) < (c[best] || 0)) return el;
    return best;
  }, list[0]);
}
function bondLenOf(a: string, b: string): number {
  const sum = (COV[a] ?? 1.0) + (COV[b] ?? 1.0);
  return Math.min(2.4, Math.max(1.0, sum));
}
/** 已经连着中心原子的配体还能再接几个 H：O 再接 1 个（–OH）、N 再接 2 个、卤素和金属都不接 H */
function hostCapacity(el: string): number {
  if (METALS.has(el) || HALOGENS.has(el)) return 0;
  return EXTRA_H[el] ?? 1;
}
const EXTRA_H: Record<string, number> = { O: 1, S: 1, N: 2, C: 3, P: 2, Si: 2, B: 2 };
/**
 * n 个配体的方向：按配位数摆成标准构型，而不是随手散点。
 * 2 直线 / 3 平面三角（气相 FeCl₃、BF₃ 就是它）/ 4 正四面体 / 5 三角双锥 / 6 八面体，再多则球面均匀铺开。
 */
function ligandDirs(n: number): V3[] {
  if (n <= 0) return [];
  if (n === 1) return [[0, 1, 0]];
  if (n === 2) return [[1, 0, 0], [-1, 0, 0]];
  if (n === 3) return [0, 1, 2].map((i) => {
    const a = Math.PI / 2 + (i * 2 * Math.PI) / 3;
    return [Math.cos(a), Math.sin(a), 0] as V3;
  });
  if (n === 4) return TETRA.slice();
  if (n === 5) {
    const eq = [0, 1, 2].map((i) => {
      const a = (i * 2 * Math.PI) / 3;
      return [Math.cos(a), 0, Math.sin(a)] as V3;
    });
    return [[0, 1, 0], [0, -1, 0], ...eq];
  }
  if (n === 6) return [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
  const out: V3[] = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const y = 1 - (2 * i + 1) / n;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const a = golden * i;
    out.push([Math.cos(a) * r, y, Math.sin(a) * r] as V3);
  }
  return out;
}
/** 给碳原子生成 k 个“空闲键”方向（尽量避开已占用方向） */
function dirsFor(k: number, fixed: V3[]): V3[] {
  const out: V3[] = [];
  if (k <= 0) return out;
  if (fixed.length === 0) {
    for (let j = 0; j < k; j++) out.push(TETRA[j % TETRA.length]);
    return out;
  }
  const sum: V3 = [0, 0, 0];
  fixed.forEach((f) => { sum[0] += f[0]; sum[1] += f[1]; sum[2] += f[2]; });
  const b = norm(mul(sum, -1));
  const e1 = perp(b);
  const e2 = norm(cross(b, e1));
  const tilt = k === 2 ? 58 * (Math.PI / 180) : 70.5 * (Math.PI / 180);
  for (let j = 0; j < k; j++) {
    const az = (j * 2 * Math.PI) / k + 0.6;
    out.push(norm(add(add(mul(b, Math.cos(tilt)), mul(e1, Math.sin(tilt) * Math.cos(az))), mul(e2, Math.sin(tilt) * Math.sin(az)))));
  }
  return out;
}

/* ================= 分子式解析 ================= */
const SYMBOLS = [
  'H', 'He', 'Li', 'Be', 'B', 'C', 'N', 'O', 'F', 'Ne', 'Na', 'Mg', 'Al', 'Si', 'P', 'S', 'Cl', 'Ar', 'K', 'Ca',
  'Mn', 'Fe', 'Cu', 'Zn', 'Ag', 'Ba', 'Br', 'I',
  // Cr / Pb 是离子方程式的常客（Cr₂O₇²⁻、PbI₂），缺了这两个会导致整式解析直接失败
  'Cr', 'Pb',
];
export interface CountMap { [el: string]: number; }

const UNI2: Record<string, string> = { '₀': '0', '₁': '1', '₂': '2', '₃': '3', '₄': '4', '₅': '5', '₆': '6', '₇': '7', '₈': '8', '₉': '9' };
const SUPNUM: Record<string, string> = { '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9' };
const SUPSIGN: Record<string, string> = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹' };
export function normalizeFormula(raw: string): string {
  let s = raw.trim().replace(/\s+/g, '');
  s = s.replace(/[₀-₉]/g, (ch) => UNI2[ch] ?? ch);
  s = s.replace(/[¹²³⁴⁵⁶⁷⁸⁹⁰]/g, (ch) => '0123456789'['¹²³⁴⁵⁶⁷⁸⁹⁰'.indexOf(ch)]);
  // 结构式中的键符号（CH2=CHCN、CH3-COOH、CH2=CH-CN 等）不参与元素计数
  s = s.replace(/[=≡~·•←→>-]/g, '');
  return s;
}
function lex(s: string): (string | number)[] {
  const out: (string | number)[] = [];
  let i = 0;
  const pushNum = (d: string) => {
    const last = out[out.length - 1];
    if (typeof last === 'number') out[out.length - 1] = last * 10 + Number(d);
    else out.push(Number(d));
  };
  while (i < s.length) {
    const c = s[i];
    if (c >= '0' && c <= '9') { pushNum(c); i++; continue; }
    if (c === '(' || c === ')') { out.push(c); i++; continue; }
    if (/[A-Za-z]/.test(c)) {
      const two = s.substr(i, 2);
      let el = c.toUpperCase();
      let used = 1;
      if (two.length === 2 && two[1] >= 'a' && two[1] <= 'z') {
        const cand = two[0].toUpperCase() + two[1].toLowerCase();
        if (SYMBOLS.includes(cand)) { el = cand; used = 2; }
      }
      pushSingle(out, el);
      i += used;
      continue;
    }
    return [];
  }
  return out;
}
function pushSingle(out: (string | number)[], el: string) {
  out.push(el);
}
function parseLex(tokens: (string | number)[]): CountMap | null {
  const root: CountMap = {};
  const stack: { m: CountMap }[] = [{ m: root }];
  let lastEl = '';
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (typeof t === 'string') {
      if (t === '(') { stack.push({ m: {} }); lastEl = ''; continue; }
      if (t === ')') {
        if (stack.length < 2) return null;
        let mult = 1;
        if (i + 1 < tokens.length && typeof tokens[i + 1] === 'number') { mult = tokens[i + 1] as number; i++; }
        const group = stack.pop()!;
        const parent = stack[stack.length - 1];
        Object.keys(group.m).forEach((el) => { parent.m[el] = (parent.m[el] || 0) + group.m[el] * mult; });
        lastEl = '';
        continue;
      }
      const top = stack[stack.length - 1];
      top.m[t] = (top.m[t] || 0) + 1;
      lastEl = t;
    } else if (lastEl) {
      const top = stack[stack.length - 1];
      top.m[lastEl] = (top.m[lastEl] || 0) + (t - 1);
      lastEl = '';
    }
  }
  return stack.length === 1 ? root : null;
}
export function parseCounts(raw: string): CountMap | null {
  const s = normalizeFormula(raw);
  if (!s) return null;
  return parseCountsOf(s);
}
/** 大小写宽容解析：先统一转小写再按元素符号库重新切分（HCL→HCl、NA→Na、co2→CO2 等）。
 *  仅在严格解析失败时作兜底，避免影响库内标准写法的既有路径。 */
export function parseCountsLenient(raw: string): CountMap | null {
  const s = normalizeFormula(raw).toLowerCase();
  if (!s) return null;
  return parseCountsLower(s);
}

/**
 * 全小写时，这两组两字母会被误认成金属符号 —— 一律拆成 C+O / N+O：
 * co2 是二氧化碳（不是 Co₂ 钴），no2 是二氧化氮（不是 No₂ 锘），ch3cooh 里的 cooh 同理。
 * 钴 / 锘在高中化学里用不到，这么取舍才符合实际输入。
 */
const TWO_LETTER_SPLIT = new Set(['co', 'no']);

function symbolCI(low: string): string | undefined {
  return SYMBOLS.find((x) => x.toLowerCase() === low);
}

/**
 * 小写串的贪心切分：fe→Fe、cl2→Cl2、hcl→HCl、h2so4→H2SO4。
 *
 * ⚠️ 之前的写法只是把串转小写就丢给 `parseCountsOf`，而 `lex` 靠「大写字母开头」辨认元素 ——
 *    小写串根本切不出来（fe 被当成 f + e），所以那个兜底从来没生效过，
 *    用户输入 fe / cl2 一律被判成不反应。现在在这里真正按符号表重新切分。
 */
function parseCountsLower(s: string): CountMap | null {
  const src = s.replace(/[^a-z0-9]/g, '');
  if (!src) return null;
  const out: CountMap = {};
  let i = 0;
  while (i < src.length) {
    let sym: string | undefined;
    const two = src.slice(i, i + 2);
    if (two.length === 2 && !/[0-9]/.test(two) && !TWO_LETTER_SPLIT.has(two)) {
      sym = symbolCI(two);
      if (sym) i += 2;
    }
    if (!sym) {
      sym = symbolCI(src.slice(i, i + 1));
      if (!sym) return null;
      i += 1;
    }
    let n = '';
    while (i < src.length && /[0-9]/.test(src[i])) {
      n += src[i];
      i += 1;
    }
    const cnt = n ? parseInt(n, 10) : 1;
    if (!cnt || cnt > 60) return null;
    out[sym] = (out[sym] || 0) + cnt;
  }
  return Object.keys(out).length ? out : null;
}
function parseCountsOf(s: string): CountMap | null {
  const tokens = lex(s);
  if (!tokens.length) return null;
  const c = parseLex(tokens);
  if (!c) return null;
  const els = Object.keys(c);
  if (!els.length) return null;
  for (const el of els) if (!SYMBOLS.includes(el) || (c[el] || 0) <= 0 || (c[el] || 0) > 60) return null;
  return c;
}
const SUB: Record<string, string> = { '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄', '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉' };
export function displayFormula(ascii: string): string {
  return ascii.replace(/([0-9]+)/g, (d) => d.split('').map((ch) => SUB[ch] ?? ch).join(''));
}
const RANK: Record<string, number> = { C: 0, H: 1 };
export function formulaOfCounts(c: CountMap): string {
  return Object.keys(c)
    .sort((a, b) => ((RANK[a] ?? 9) - (RANK[b] ?? 9)) || (a < b ? -1 : 1))
    .map((el) => el + ((c[el] || 0) > 1 ? (c[el] || 0) : ''))
    .join('');
}
/* ================= 带电荷物种的解析（离子方程式用） ================= */
export interface Species { counts: CountMap; charge: number; }

/** 把 ⁺/⁻、上标数字、^ 都归一到 ASCII：`SO₄²⁻`→`SO42-`、`MnO4^-`→`MnO4-`。注意不调用 normalizeFormula —— 那个会把电荷的 `-` 当键号删掉。 */
export function normalizeCharged(raw: string): string {
  let s = raw.trim().replace(/\s+/g, '');
  s = s.replace(/[₀-₉]/g, (ch) => UNI2[ch] ?? ch);
  s = s.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]/g, (ch) => SUPNUM[ch] ?? ch);
  s = s.replace(/[⁺]/g, '+').replace(/[⁻]/g, '-');
  s = s.replace(/\^+/g, '');
  return s;
}

/** 净电荷 → 上标串：+1→⁺、-2→²⁻ */
export function chargeMark(q: number): string {
  if (!q) return '';
  const sign = q > 0 ? '⁺' : '⁻';
  const abs = Math.abs(q);
  if (abs === 1) return sign;
  return String(abs).replace(/\d/g, (d) => SUPSIGN[d] ?? d) + sign;
}

/** 带电荷物种的展示式：('MnO4', -1) → MnO₄⁻ */
export function displaySpecies(asciiBody: string, charge: number): string {
  return displayFormula(asciiBody) + chargeMark(charge);
}

export interface ChargeSplit {
  sign: 1 | -1;
  /** 去掉电荷符号后的候选主体，按优先级排列，n 为该候选对应的电荷绝对值 */
  cands: { body: string; n: number }[];
}
/**
 * 从写法里剥离尾部电荷（纯语法层，不含化学知识）。
 * ⚠️ `SO42-`（2 是电荷数）与 `MnO4-`（4 是下标）去掉符号后**无法从句法上区分**，
 * 所以返回两个候选交给调用方结合已知离子表裁定：
 * - cand[0]：末尾一位数字当作电荷数 → body=`SO4`, n=2
 * - cand[1]：末尾数字全是下标、电荷为 1 → body=`MnO4`, n=1
 * 若字符串末尾不是 +/-（如 H2O、Cl2）返回 null，表示中性物种。
 */
export function splitCharge(raw: string): ChargeSplit | null {
  const s = normalizeCharged(raw);
  const m = s.match(/^([A-Za-z0-9()]+?)([0-9]*)([+-])$/);
  if (!m) return null;
  const [, head, digit, signCh] = m;
  const sign: 1 | -1 = signCh === '+' ? 1 : -1;
  const cands: { body: string; n: number }[] = [];
  if (digit.length) {
    const n = Number(digit[digit.length - 1]);
    const body = head + digit.slice(0, -1);
    if (body && n >= 1) cands.push({ body, n });
  }
  if (head + digit) cands.push({ body: head + digit, n: 1 });
  return cands.length ? { sign, cands } : null;
}

export function sameFormula(aRaw: string, bRaw: string): boolean {
  const ca = parseCounts(aRaw);
  const cb = parseCounts(bRaw);
  if (!ca || !cb) return false;
  const keys = new Set([...Object.keys(ca), ...Object.keys(cb)]);
  for (const k of keys) if ((ca[k] || 0) !== (cb[k] || 0)) return false;
  return true;
}

/* ================= 建模核心 ================= */
const L_H = 1.09, L_CO = 1.43, L_OH = 0.97, L_CC = 1.54, L_CdO = 1.23;
const L_CN = 1.47, L_NH = 1.01;
const BOND_LEN = { 1: 1.0, 2: 0.88, 3: 0.78 };
const orderLen = (o: number): number => L_CC * (BOND_LEN[o as 1 | 2 | 3] ?? 1);

function initS(): S {
  return { atoms: [], bonds: [] };
}
function zigzagPos(orders: number[]): V3[] {
  const pts: V3[] = [[0, 0, 0]];
  const rad = 54.7 * (Math.PI / 180);
  const cb = Math.cos(rad), sb = Math.sin(rad);
  for (let i = 0; i < orders.length; i++) {
    const prev = pts[pts.length - 1];
    const dy = i % 2 === 0 ? sb : -sb;
    pts.push([prev[0] + cb * orderLen(orders[i]), prev[1] + dy * orderLen(orders[i]), 0]);
  }
  return pts;
}
function dirOf(s: S, a: number, b: number): V3 {
  return norm(sub(s.atoms[b].pos, s.atoms[a].pos));
}
/** 按 roles 依次为碳 ci 挂上重原子/氢，返回每个 role 创建的新原子下标（-1 表示未建） */
function applyRoles(s: S, ci: number, fixedNb: number[], roles: string[]): number[] {
  const pC = s.atoms[ci].pos;
  const fixed = fixedNb.map((nb) => dirOf(s, ci, nb));
  const dirs = dirsFor(roles.length, fixed);
  const created: number[] = [];
  roles.forEach((role, j) => {
    const d = dirs[j];
    if (role === 'H') {
      const hi = s.atoms.length;
      s.atoms.push({ el: 'H', pos: add(pC, mul(d, L_H)) });
      s.bonds.push({ a: ci, b: hi, order: 1 });
      created.push(hi);
    } else if (role === 'O=') {
      const oi = s.atoms.length;
      s.atoms.push({ el: 'O', pos: add(pC, mul(d, L_CdO)) });
      s.bonds.push({ a: ci, b: oi, order: 2 });
      created.push(oi);
    } else if (role === 'OH') {
      const oi = s.atoms.length;
      s.atoms.push({ el: 'O', pos: add(pC, mul(d, L_CO)) });
      s.bonds.push({ a: ci, b: oi, order: 1 });
      // O 上的 H：朝外并略偏转，避免与 C–O 共线
      const oh = rotV(mul(d, -1), perp(d), 0.8);
      const hi = s.atoms.length;
      s.atoms.push({ el: 'H', pos: add(s.atoms[oi].pos, mul(oh, L_OH)) });
      s.bonds.push({ a: oi, b: hi, order: 1 });
      created.push(oi, hi);
    } else if (role === 'C') {
      const c2 = s.atoms.length;
      s.atoms.push({ el: 'C', pos: add(pC, mul(d, L_CC)) });
      s.bonds.push({ a: ci, b: c2, order: 1 });
      created.push(c2);
    }
  });
  return created;
}
/** 链式烷/烯/炔骨架（orders = 相邻碳间键级） */
function buildChain(orders: number[]): S | null {
  const s = initS();
  const pts = zigzagPos(orders);
  const cIdx: number[] = pts.map((p) => {
    s.atoms.push({ el: 'C', pos: p });
    return s.atoms.length - 1;
  });
  for (let i = 0; i < orders.length; i++) s.bonds.push({ a: cIdx[i], b: cIdx[i + 1], order: orders[i] });
  // 每个碳补足氢
  for (let i = 0; i < cIdx.length; i++) {
    const nb: number[] = [];
    let used = 0;
    if (i > 0) { nb.push(cIdx[i - 1]); used += orders[i - 1]; }
    if (i < cIdx.length - 1) { nb.push(cIdx[i + 1]); used += orders[i]; }
    const nH = 4 - used;
    if (nH < 0 || nH > 4) return null;
    applyRoles(s, cIdx[i], nb, Array(nH).fill('H'));
  }
  return s;
}
/** 饱和一元醇 R–CH₂OH（羟基在链端 0 号碳） */
function buildAlcohol(n: number): S | null {
  const s = initS();
  const pts = zigzagPos(Array(n - 1).fill(1) as number[]);
  const cIdx = pts.map((p) => { s.atoms.push({ el: 'C', pos: p }); return s.atoms.length - 1; });
  for (let i = 0; i < n - 1; i++) s.bonds.push({ a: cIdx[i], b: cIdx[i + 1], order: 1 });
  // 先挂 O 到 0 号碳
  const oDirs = dirsFor(1, n > 1 ? [dirOf(s, 0, 1)] : []);
  const oi = s.atoms.length;
  s.atoms.push({ el: 'O', pos: add(s.atoms[0].pos, mul(oDirs[0], L_CO)) });
  s.bonds.push({ a: 0, b: oi, order: 1 });
  const created = applyRoles(s, 0, [...(n > 1 ? [1] : []), oi], Array(n > 1 ? 2 : 3).fill('H'));
  // 其余碳补氢
  for (let i = 1; i < n; i++) {
    const nb: number[] = [];
    let used = 0;
    if (i > 0) { nb.push(cIdx[i - 1]); used += 1; }
    if (i < n - 1) { nb.push(cIdx[i + 1]); used += 1; }
    applyRoles(s, cIdx[i], nb, Array(4 - used).fill('H'));
  }
  // OH 的 H（直接复用 applyRoles 已在 'OH' 分支处理）—— 此处使用 'OH' 处理
  void created;
  void oi;
  return s;
}
/** 饱和羧酸 R–COOH（羧基在链末端） */
function buildCarboxylicAcid(n: number): S | null {
  const s = initS();
  const pts = zigzagPos(Array(n - 1).fill(1) as number[]);
  const cIdx = pts.map((p) => { s.atoms.push({ el: 'C', pos: p }); return s.atoms.length - 1; });
  for (let i = 0; i < n - 1; i++) s.bonds.push({ a: cIdx[i], b: cIdx[i + 1], order: 1 });
  const carb = n - 1;
  // 羧基碳：=O 与 -OH（甲酸另加 C–H）
  const roles = n === 1 ? ['O=', 'OH', 'H'] : ['O=', 'OH'];
  applyRoles(s, cIdx[carb], n > 1 ? [cIdx[carb - 1]] : [], roles);
  // 其余链碳补氢
  for (let i = 0; i < n - 1; i++) {
    const nb: number[] = [];
    let used = 0;
    if (i > 0) { nb.push(cIdx[i - 1]); used += 1; }
    if (i < n - 1) { nb.push(cIdx[i + 1]); used += 1; }
    applyRoles(s, cIdx[i], nb, Array(4 - used).fill('H'));
  }
  return s;
}
/** 饱和一元胺 R–NH₂（氨基在链端 0 号碳，N 呈三角锥形并留一对孤对电子） */
function buildAmine(n: number): S | null {
  const s = initS();
  const pts = zigzagPos(Array(Math.max(n - 1, 0)).fill(1) as number[]);
  const cIdx = pts.map((p) => { s.atoms.push({ el: 'C', pos: p }); return s.atoms.length - 1; });
  for (let i = 0; i < n - 1; i++) s.bonds.push({ a: cIdx[i], b: cIdx[i + 1], order: 1 });
  // 氨基挂在 0 号碳：C–N 单键
  const nDirs = dirsFor(1, n > 1 ? [dirOf(s, cIdx[0], cIdx[1])] : []);
  const d = nDirs[0];
  const ni = s.atoms.length;
  s.atoms.push({ el: 'N', pos: add(s.atoms[cIdx[0]].pos, mul(d, L_CN)) });
  s.bonds.push({ a: cIdx[0], b: ni, order: 1 });
  // N 上两个 H：以 N→C 的反方向为轴张开，使 H–N–C 键角约 107°（第三个方向留给孤对电子）
  const e1 = perp(d);
  const e2 = norm(cross(d, e1));
  const back = mul(d, -1);
  const tilt = (180 - 107) * (Math.PI / 180);
  for (let j = 0; j < 2; j++) {
    const az = j * Math.PI;
    const hd = norm(add(
      add(mul(back, Math.cos(tilt)), mul(e1, Math.sin(tilt) * Math.cos(az))),
      mul(e2, Math.sin(tilt) * Math.sin(az)),
    ));
    const hi = s.atoms.length;
    s.atoms.push({ el: 'H', pos: add(s.atoms[ni].pos, mul(hd, L_NH)) });
    s.bonds.push({ a: ni, b: hi, order: 1 });
  }
  // 各碳补足氢（0 号碳已用一个键连 N）
  for (let i = 0; i < n; i++) {
    const nb: number[] = [];
    let used = 0;
    if (i > 0) { nb.push(cIdx[i - 1]); used += 1; }
    if (i < n - 1) { nb.push(cIdx[i + 1]); used += 1; }
    if (i === 0) { nb.push(ni); used += 1; }
    applyRoles(s, cIdx[i], nb, Array(4 - used).fill('H'));
  }
  return s;
}
/** 苯环 */
function buildBenzene(): S {
  const s = initS();
  const R = 1.39;
  const cIdx: number[] = [];
  for (let i = 0; i < 6; i++) {
    const a = Math.PI / 2 + (i * 2 * Math.PI) / 6;
    cIdx.push(s.atoms.length);
    s.atoms.push({ el: 'C', pos: [Math.cos(a) * R, Math.sin(a) * R, 0] });
  }
  for (let i = 0; i < 6; i++) s.bonds.push({ a: cIdx[i], b: cIdx[(i + 1) % 6], order: 1 });
  for (let i = 0; i < 6; i++) applyRoles(s, cIdx[i], [cIdx[(i + 5) % 6], cIdx[(i + 1) % 6]], ['H']);
  return s;
}
/** D-吡喃葡萄糖（Haworth 环状示意，六元环：C1-O5-C5-C4-C3-C2） */
function buildGlucose(): S {
  const s = initS();
  const R = 1.45;
  const sym = ['C', 'O', 'C', 'C', 'C', 'C'];
  const ring: number[] = [];
  for (let i = 0; i < 6; i++) {
    const a = Math.PI / 6 + (i * 2 * Math.PI) / 6;
    ring.push(s.atoms.length);
    s.atoms.push({ el: sym[i], pos: [Math.cos(a) * R, Math.sin(a) * R, 0] });
  }
  for (let i = 0; i < 6; i++) s.bonds.push({ a: ring[i], b: ring[(i + 1) % 6], order: 1 });
  const nbr = (i: number) => [ring[(i + 5) % 6], ring[(i + 1) % 6]];
  // C1: -OH + H
  applyRoles(s, ring[0], nbr(0), ['OH', 'H']);
  // C5: 接 C6 和 H
  const c6 = applyRoles(s, ring[2], nbr(2), ['C', 'H'])[0];
  // C6(CH2OH): 1 个 OH + 2 个 H
  applyRoles(s, c6, [ring[2]], ['OH', 'H', 'H']);
  // C4、C3、C2 各 -OH + H
  applyRoles(s, ring[3], nbr(3), ['OH', 'H']);
  applyRoles(s, ring[4], nbr(4), ['OH', 'H']);
  applyRoles(s, ring[5], nbr(5), ['OH', 'H']);
  return s;
}

/* ================= 结构识别 ================= */
function cnName(base: string, n: number): string {
  if (n === 1) return '甲' + base;
  const pre = ['乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'][n - 2] ?? `C${n}`;
  return pre + base;
}
function nameAlkane(n: number): string { return n === 1 ? '甲烷' : cnName('烷', n); }
function nameAlkene(n: number): string { return cnName('烯', n); }
function nameAlkyne(n: number): string { return cnName('炔', n); }
function nameAlcohol(n: number): string { return n === 1 ? '甲醇' : cnName('醇', n); }
function nameAcid(n: number): string {
  if (n === 1) return '甲酸';
  if (n === 2) return '乙酸';
  return cnName('酸', n);
}

/** 常见类别的习惯写法（结构简式）ASCII 形式，如 CH3NH2 / C2H5OH / CH3COOH；无习惯写法时返回 undefined */
function structuralAscii(kind: string, nC: number): string | undefined {
  if (kind === 'amine') return nC === 1 ? 'CH3NH2' : `C${nC}H${2 * nC + 1}NH2`;
  if (kind === 'alcohol') return nC === 1 ? 'CH3OH' : `C${nC}H${2 * nC + 1}OH`;
  if (kind === 'acid') return nC === 1 ? 'HCOOH' : nC === 2 ? 'CH3COOH' : `C${nC - 1}H${2 * nC - 1}COOH`;
  return undefined;
}
interface BuiltInfo { kind: string; name: string; desc: string; s: S }

/**
 * 无水金属氯化物里，有几位是「高中最容易画错」的 —— 它们**不是**一个个独立小分子，
 * 而是 M 阳离子被 Cl⁻ 包围、再由 Cl⁻ 桥连起来的层状/链状离子晶体。
 *
 * ⚠️ 键按「元素符号排序 + 原子数」拼成（如 FeCl₃ → cl3fe），这样无论调用方递进来的是
 *    `FeCl3` 还是推导时排序后的 `Cl3Fe`，都能命中同一条备注。
 */
const STRUCT_NOTE: Record<string, string> = {
  cl3fe: '真实的无水 FeCl₃ 是层状离子晶体：每个 Fe³⁺ 被 6 个 Cl⁻ 八面体配位，相邻八面体共用棱上的 Cl⁻ 连成层，属六方晶系；只有当它气化时才变成 Fe₂Cl₆ 二聚分子（更高温度下才解体为平面三角的 FeCl₃ 单分子）。画面上的模型是 1 个 FeCl₃ 式量单元，配位数要看真实晶体才成立。',
  cl2fe: '真实的无水 FeCl₂ 是 CdI₂ 型层状离子晶体：Fe²⁺ 同样被 6 个 Cl⁻ 八面体配位成层。',
  alcl3: '真实的无水 AlCl₃ 是层状离子晶体（Al³⁺ 落在密堆积 Cl⁻ 层间的八面体空隙里），熔融或气化后才变成 Al₂Cl₆ 二聚分子、Al 转为四面体配位。',
  cl2cu: '真实的无水 CuCl₂ 是链状晶体：平面正方形的 CuCl₄ 单元共用 Cl⁻ 连成长链（姜–泰勒效应把八面体拉长），不是一个个独立的 CuCl₂ 分子。',
};

/** 离子化合物/简单无机物的说明：讲清「画面上的这个模型代表什么」，避免被当成真实分子理解 */
function simpleDesc(c: CountMap, central: string): string {
  const rest = Object.keys(c).filter((el) => el !== central && (c[el] || 0) > 0);
  let head: string;
  if (METALS.has(central) && rest.length && rest.every((el) => HALOGENS.has(el))) {
    head = `离子化合物：由 ${central} 阳离子与 ${rest.join('⁻、')}⁻ 靠离子键结合（画面上中心是 ${central}），实际是离子按一定配位堆积成的晶体，这里画的是它的 1 个式量单元。`;
  } else if (METALS.has(central) && rest.every((el) => el === 'O' || HALOGENS.has(el))) {
    head = `金属${rest.includes('O') ? '氧化物/卤化物' : '卤化物'}：以离子键为主，实际多为离子晶体（${central} 被 ${rest.join('、')} 配位包围），这里画出 1 个 ${central} 的配位单元作示意。`;
  } else {
    head = '简单化合物近似模型：按常见配位数摆出的配位单元，用来看清谁和谁相连。';
  }
  const key = Object.keys(c)
    .filter((el) => (c[el] || 0) > 0)
    .sort()
    .map((el) => el + ((c[el] || 0) > 1 ? c[el] : ''))
    .join('')
    .toLowerCase();
  const note = STRUCT_NOTE[key];
  return note ? `${head}\n真实结构：${note}` : head;
}

function buildFromCounts(c: CountMap): BuiltInfo | null {
  const nC = c['C'] || 0, nH = c['H'] || 0, nO = c['O'] || 0;
  const other = Object.keys(c).filter((k) => !['C', 'H', 'O'].includes(k));
  const onlyCH = nO === 0 && other.length === 0;
  if (nC === 6 && onlyCH && nH === 6) return { kind: 'benzene', name: '苯', desc: '平面六元环，C–C 键介于单双键之间（离域大 π 键）。', s: buildBenzene() };
  if (nC === 6 && nH === 12 && nO === 6 && other.length === 0) return { kind: 'glucose', name: '葡萄糖', desc: '环状半缩醛结构示意（吡喃环），也可写成多羟基醛。', s: buildGlucose() };
  if (onlyCH && nC >= 1) {
    if (nC === 1) {
      if (nH === 4) { const s = buildChain([]); return s ? { kind: 'alkane', name: '甲烷', desc: '最简单的有机物，正四面体，键角 109.5°。', s } : null; }
      return null;
    }
    const orders = Array(nC - 1).fill(1) as number[];
    if (nH === 2 * nC + 2) { const s = buildChain(orders); return s ? { kind: 'alkane', name: nameAlkane(nC), desc: '饱和链烃，通式 CₙH₂ₙ₊₂。', s } : null; }
    if (nH === 2 * nC) { orders[0] = 2; const s = buildChain(orders); return s ? { kind: 'alkene', name: nameAlkene(nC), desc: '含 C=C 双键的 1-烯烃，通式 CₙH₂ₙ。', s } : null; }
    if (nH === 2 * nC - 2) { orders[0] = 3; const s = buildChain(orders); return s ? { kind: 'alkyne', name: nameAlkyne(nC), desc: '含 C≡C 三键的 1-炔烃，通式 CₙH₂ₙ₋₂。', s } : null; }
    return null;
  }
  if (other.length === 0 && nC >= 1 && nO === 1 && nH === 2 * nC + 2) {
    const s = buildAlcohol(nC);
    return s ? { kind: 'alcohol', name: nameAlcohol(nC), desc: '饱和一元醇，含羟基 –OH（1-醇）。', s } : null;
  }
  if (other.length === 0 && nC >= 1 && nO === 2 && nH === 2 * nC) {
    const s = buildCarboxylicAcid(nC);
    return s ? { kind: 'acid', name: nameAcid(nC), desc: '含羧基 –COOH 的有机酸。', s } : null;
  }
  // 饱和一元胺 R–NH₂（结构简式如 CH₃NH₂、C₂H₅NH₂），通式 CₙH₂ₙ₊₃N
  if (other.length === 1 && other[0] === 'N' && (c['N'] || 0) === 1 && nO === 0 && nC >= 1 && nH === 2 * nC + 3) {
    const s = buildAmine(nC);
    return s ? { kind: 'amine', name: cnName('胺', nC), desc: '饱和一元胺，含氨基 –NH₂：氮原子 sp³ 杂化呈三角锥形，有一对孤对电子。', s } : null;
  }
  // 简单无机物 / 含非 C、H、O 元素的化合物（如 Fe₃O₄、Cu(NO₃)₂、KSCN、Fe(SCN)₃）：粗略径向排布
  const total = Object.values(c).reduce((a, b) => a + b, 0);
  const distinct = Object.keys(c).length;
  const hasSpecial = other.length > 0;
  if ((nC === 0 || hasSpecial) && distinct <= 6) {
    // 单原子（如金属单质 Fe/Cu/Na、固体碳等）：画一个原子球
    if (total === 1) {
      const s = initS();
      s.atoms.push({ el: Object.keys(c)[0], pos: [0, 0, 0] });
      return { kind: 'simple', name: '', desc: '单原子（元素单质示意）。', s };
    }
    if (total < 2) return null;
    const s = initS();
    const central = pickCentral(c);
    const ci = s.atoms.length;
    s.atoms.push({ el: central, pos: [0, 0, 0] });
    // 1) 配体（不含 H）轮着排布（避免同种原子全挤在一起），再按配位数套标准构型
    const groups: string[][] = Object.keys(c)
      .filter((el) => el !== 'H')
      .map((el) => Array(el === central ? (c[el] || 0) - 1 : c[el] || 0).fill(el))
      .filter((g) => g.length > 0);
    const around: string[] = [];
    for (let i = 0; i < 64; i++) {
      let added = false;
      groups.forEach((g) => { if (i < g.length) { around.push(g[i]); added = true; } });
      if (!added) break;
    }
    const dirs = ligandDirs(around.length);
    const hosts: { el: string; idx: number; dir: V3; left: number }[] = [];
    around.forEach((el, i) => {
      const oi = s.atoms.length;
      s.atoms.push({ el, pos: mul(dirs[i], bondLenOf(central, el)) });
      s.bonds.push({ a: ci, b: oi, order: 1 });
      hosts.push({ el, idx: oi, dir: dirs[i], left: hostCapacity(el) });
    });
    // 2) H 优先挂到已放好的阴离子原子上 —— 氢氧化物要画成 Fe–O–H，而不是 Fe 同时连着 O 和 H
    let hLeft = c['H'] || 0;
    while (hLeft > 0) {
      const host = hosts
        .filter((h) => h.left > 0)
        .sort((a, b) => (EN[b.el] ?? 0) - (EN[a.el] ?? 0))[0];
      if (!host) break;
      host.left -= 1;
      hLeft -= 1;
      const d = rotV(host.dir, perp(host.dir), 0.8); // 从配体往外偏一点，M–O–H 不至于成直线
      const hi = s.atoms.length;
      s.atoms.push({ el: 'H', pos: add(s.atoms[host.idx].pos, mul(d, bondLenOf(host.el, 'H'))) });
      s.bonds.push({ a: host.idx, b: hi, order: 1 });
    }
    if (hLeft > 0) {
      // 剩下挂不到配体上的 H（HCl、NH₄Cl 这类）直接挂在中心上，方向避开已占用的那些
      const extra = dirs.length ? dirsFor(hLeft, dirs) : ligandDirs(hLeft);
      for (let j = 0; j < hLeft; j++) {
        const hi = s.atoms.length;
        s.atoms.push({ el: 'H', pos: mul(extra[j], bondLenOf(central, 'H')) });
        s.bonds.push({ a: ci, b: hi, order: 1 });
      }
    }
    return { kind: 'simple', name: '', desc: simpleDesc(c, central), s };
  }
  return null;
}

/** 由分子式自动生成近似 3D 分子 */
export function buildMoleculeForFormula(raw: string): MoleculeData | null {
  const counts = parseCounts(raw);
  if (!counts) return null;
  const info = buildFromCounts(counts);
  if (!info) return null;
  const ascii = formulaOfCounts(counts);
  const neutralAcid: MoleculeData['acidity'] | undefined = info.kind === 'acid'
    ? { label: '弱酸', explain: '羧酸在水中部分电离出 H⁺，显弱酸性（示意）。' }
    : info.kind === 'amine'
      ? { label: '弱碱', explain: '氨基氮原子有孤对电子，能结合水中的 H⁺：R–NH₂ + H₂O ⇌ R–NH₃⁺ + OH⁻，显弱碱性。' }
      : { label: '中性', explain: '水溶液中难电离，一般呈中性（示意，具体以实验为准）。' };
  const hasC = (counts['C'] || 0) > 0;
  const structural = structuralAscii(info.kind, counts['C'] || 0);
  return {
    id: 'dyn_' + ascii,
    name: info.name || (hasC ? '有机分子 · 近似模型' : '化合物 · 近似模型'),
    formula: displayFormula(ascii),
    formulaDisplay: structural ? displayFormula(structural) : undefined,
    category: hasC ? '化合物 · 有机物' : '化合物 · 自动建模',
    level: '扩展 · 自动建模',
    scene: 'molecule',
    desc: `${info.desc}（分子式输入后自动生成，键长/键角为近似示意，仅用于学习原子连接关系。）`,
    atoms: info.s.atoms,
    bonds: info.s.bonds,
    formulaAscii: ascii,
    acidity: neutralAcid,
  };
}

/** 首页内容库补充的代表性有机物 */
export function buildCatalogOrganic(): MoleculeData[] {
  const mk = (id: string, name: string, ascii: string, desc: string, kind: string, acidity: MoleculeData['acidity']): MoleculeData | null => {
    const info = buildFromCounts(parseCounts(ascii) || {});
    if (!info) return null;
    const st = structuralAscii(kind, (parseCounts(ascii) || {})['C'] || 0);
    return {
      id, name,
      formula: displayFormula(ascii),
      formulaDisplay: st ? displayFormula(st) : undefined,
      category: '化合物 · 有机物', level: '必修', scene: 'molecule',
      desc,
      atoms: info.s.atoms, bonds: info.s.bonds, formulaAscii: ascii,
      acidity,
    };
    void kind;
  };
  const list: MoleculeData[] = [];
  const e = mk('c2h6', '乙烷', 'C2H6', '烷烃代表物：C–C 单键、C–H 键构成四面体骨架，通式 CₙH₂ₙ₊₂。', 'alkane', { label: '中性', explain: '烷烃难溶于水且不电离，水溶液呈中性。' });
  const en = mk('c2h4', '乙烯', 'C2H4', '烯烃代表物：含 C=C 双键，平面分子，是化工基础原料。', 'alkene', { label: '中性', explain: '乙烯不电离，水溶液呈中性。' });
  const yn = mk('c2h2', '乙炔', 'C2H2', '炔烃代表物：含 C≡C 三键，直线形，燃烧火焰温度高（氧炔焰）。', 'alkyne', { label: '中性', explain: '乙炔不电离，水溶液呈中性。' });
  const be = mk('c6h6', '苯', 'C6H6', '芳香烃代表物：平面正六边形，碳碳键介于单双键之间（大 π 键）。', 'benzene', { label: '中性', explain: '苯为非电解质，水溶液呈中性。' });
  const aa = mk('ch3cooh', '乙酸', 'C2H4O2', '食醋主要成分，含羧基 –COOH，属弱酸（此处以 C₂H₄O₂ 等同式建模）。', 'acid', { label: '弱酸', explain: 'CH₃COOH 部分电离：CH₃COOH ⇌ CH₃COO⁻ + H⁺。' });
  const gl = mk('c6h12o6', '葡萄糖', 'C6H12O6', '单糖，人体主要供能物质，环状半缩醛结构示意。', 'glucose', { label: '中性', explain: '葡萄糖溶液呈中性。' });
  [e, en, yn, be, aa, gl].forEach((m) => { if (m) list.push(m); });
  return list;
}
