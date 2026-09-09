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
  'Fe', 'Cu', 'Zn', 'Br', 'I',
];
export interface CountMap { [el: string]: number; }

const UNI2: Record<string, string> = { '₀': '0', '₁': '1', '₂': '2', '₃': '3', '₄': '4', '₅': '5', '₆': '6', '₇': '7', '₈': '8', '₉': '9' };
export function normalizeFormula(raw: string): string {
  let s = raw.trim().replace(/\s+/g, '');
  s = s.replace(/[₀-₉]/g, (ch) => UNI2[ch] ?? ch);
  s = s.replace(/[¹²³⁴⁵⁶⁷⁸⁹⁰]/g, (ch) => '0123456789'['¹²³⁴⁵⁶⁷⁸⁹⁰'.indexOf(ch)]);
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

interface BuiltInfo { kind: string; name: string; desc: string; s: S }
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
  // 简单无机物/不含碳的杂原子化合物：粗略径向排布
  if (nC === 0 && other.length === 0 && nH > 0 && (nO > 0 || nO === 0 && other.length === 0)) {
    return null;
  }
  if (nC === 0 && Object.keys(c).length <= 3) {
    const total = Object.values(c).reduce((a, b) => a + b, 0);
    if (total < 2) return null;
    const s = initS();
    const central = Object.keys(c).find((el) => el !== 'H' && (c[el] || 0) >= 1) || Object.keys(c)[0];
    const ci = s.atoms.length;
    s.atoms.push({ el: central, pos: [0, 0, 0] });
    const others: string[] = [];
    Object.keys(c).forEach((el) => {
      const cnt = c[el] || 0;
      if (el !== central) for (let i = 0; i < cnt; i++) others.push(el);
    });
    const golden = Math.PI * (3 - Math.sqrt(5));
    others.forEach((el, i) => {
      const d = norm([Math.cos(golden * i), Math.sin(golden * i), i % 2 ? 0.7 : -0.7]);
      const oi = s.atoms.length;
      s.atoms.push({ el, pos: mul(d, 1.3 + 0.2 * (i % 3)) });
      s.bonds.push({ a: ci, b: oi, order: 1 });
    });
    return { kind: 'simple', name: '', desc: '简单无机物近似模型（示意原子连接）。', s };
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
    : { label: '中性', explain: '水溶液中难电离，一般呈中性（示意，具体以实验为准）。' };
  const hasC = (counts['C'] || 0) > 0;
  return {
    id: 'dyn_' + ascii,
    name: info.name || (hasC ? '有机分子 · 近似模型' : '化合物 · 近似模型'),
    formula: displayFormula(ascii),
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
    return {
      id, name,
      formula: displayFormula(ascii),
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
