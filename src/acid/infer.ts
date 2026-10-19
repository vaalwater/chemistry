/* =========================================================================
 * 酸碱性：由分子式推导它溶于水后的「电离 / 水解」行为
 * -------------------------------------------------------------------------
 * 不做查表：先把分子式解析成原子计数，再按高中生该掌握的规则推理 ——
 *   ① 先看是酸 / 碱 / 盐
 *   ② 盐拆成阳离子 + 阴离子（电荷守恒反推阳离子电荷，不用背化合价）
 *   ③ 「谁弱谁水解」：阳离子来自弱碱 → 抢 OH⁻ 放 H⁺；阴离子来自弱酸 → 抢 H⁺ 放 OH⁻
 *   ④ 两边都水解时用强弱刻度比一比，定最终酸碱性
 * 解析出来的结果直接转成 AcidCase，就能喂给现有的动画脚本生成器。
 * ========================================================================= */

import {
  CASES,
  type AcidCase,
  type AcidParticle,
  type HydrolysisSpec,
  type IonizationSpec,
  type Verdict,
} from './acidRule';

/* ------------------------------------------------------------ 显示用小工具 */

const SUB = ['₀', '₁', '₂', '₃', '₄', '₅', '₆', '₇', '₈', '₉'];
const SUP = ['⁰', '¹', '²', '³', '⁴', '⁵', '⁶', '⁷', '⁸', '⁹'];

/** 数字转下标：3 → ₃ */
export function sub(n: number): string {
  return String(n)
    .split('')
    .map((d) => SUB[Number(d)])
    .join('');
}
/** 电荷写法：3 → ³⁺；-2 → ²⁻；1 → ⁺ */
function chargeTag(z: number): string {
  if (z === 0) return '';
  const a = Math.abs(z);
  return (a > 1 ? SUP[a] : '') + (z > 0 ? '⁺' : '⁻');
}
/* ------------------------------------------------------------ 分子式解析 */

const ELEMENTS = [
  'He', 'Li', 'Be', 'Ne', 'Na', 'Mg', 'Al', 'Si', 'Cl', 'Ar', 'Ca', 'Mn', 'Fe', 'Cu', 'Zn', 'Ag', 'Ba',
  'Pb', 'Sn', 'Cr', 'Ni', 'Co', 'Hg', 'Br', 'Au', 'Pt', 'Cd', 'Bi', 'Sb', 'Sr', 'Rb', 'Cs', 'Se', 'Ti',
  'B', 'C', 'N', 'O', 'F', 'P', 'S', 'K', 'H', 'I', 'V', 'As',
];

/** 全角符号 / 下标 / 结晶水点号的归一化：'Ｎａ２ＣＯ３' → 'Na2CO3' */
export function normalizeFormula(raw: string): string {
  let s = raw.trim().replace(/\s+/g, '');
  s = s.replace(/[（）]/g, (c) => (c === '（' ? '(' : ')'));
  s = s.replace(/[·•・*]/g, '');
  s = s.replace(/[₀-₉]/g, (c) => String(SUB.indexOf(c)));
  s = s.replace(/[⁺⁻⁰-⁹]/g, '');
  // 全小写的写法（Na2CO3 打成 na2co3）：先把 o 恢复成 O（否则会被当成钴 Co），
  // 再大写首字母 —— 这样 na2co3 → Na2CO3、ch3cooh → Ch3cOOH，解析都能对上。
  if (s && !/[A-Z]/.test(s)) {
    s = s.replace(/o/g, 'O');
    s = s[0].toUpperCase() + s.slice(1);
  }
  return s;
}

type Node = { el: string; n: number } | { group: Node[]; n: number };

const ELEMENT_SET = new Set(ELEMENTS);
const isLower = (c: string) => c >= 'a' && c <= 'z';
const isUpper = (c: string) => c >= 'A' && c <= 'Z';

/**
 * 按化学式书写的规矩匹配元素符号：大写字母开头，后面最多跟一个小写字母。
 * 这样 CO3 是 C + O₃（而不是钴），真正写 Co 时才会当成钴。
 */
function matchElement(s: string, i: number): string | null {
  const c = s[i];
  if (!c) return null;
  if (isUpper(c)) {
    const two = s.slice(i, i + 2);
    if (two.length === 2 && isLower(two[1]) && ELEMENT_SET.has(two)) return two;
    return ELEMENT_SET.has(c) ? c : null;
  }
  if (isLower(c)) {
    const cap = c.toUpperCase();
    const nxt = s[i + 1];
    if (nxt && isLower(nxt)) {
      const two = cap + nxt;
      if (ELEMENT_SET.has(two)) return two;
    }
    return ELEMENT_SET.has(cap) ? cap : null;
  }
  return null;
}

/** 规范串里的下标还原成下标符号：Al2(SO4)3 → Al₂(SO₄)₃ */
export function prettyFormula(canon: string): string {
  return canon.replace(/[0-9]/g, (d) => SUB[Number(d)]);
}

/** 解析成保留结构的 token 树（含括号层级），失败返回 null */
export function parseGroups(formula: string): Node[] | null {
  const s = normalizeFormula(formula);
  if (!s) return null;
  const stack: Node[][] = [[]];
  let i = 0;
  const readNum = (): number => {
    let v = 0;
    let hit = false;
    while (i < s.length && /[0-9]/.test(s[i])) {
      v = v * 10 + Number(s[i]);
      i += 1;
      hit = true;
    }
    return hit && v > 0 ? v : 1;
  };
  while (i < s.length) {
    const ch = s[i];
    if (ch === '(') {
      stack.push([]);
      i += 1;
      continue;
    }
    if (ch === ')') {
      i += 1;
      const n = readNum();
      const top = stack.pop();
      if (!top || top.length === 0 || stack.length === 0) return null;
      stack[stack.length - 1].push({ group: top, n });
      continue;
    }
    const el = matchElement(s, i);
    if (!el) return null;
    i += el.length;
    const n = readNum();
    stack[stack.length - 1].push({ el, n });
  }
  if (stack.length !== 1) return null;
  return stack[0].length ? stack[0] : null;
}

function atomsOf(nodes: Node[]): Record<string, number> {
  const out: Record<string, number> = {};
  const walk = (list: Node[], mult: number) => {
    list.forEach((node) => {
      if ('group' in node) walk(node.group, mult * node.n);
      else out[node.el] = (out[node.el] || 0) + node.n * mult;
    });
  };
  walk(nodes, 1);
  return out;
}

/** 把 token 树还原成规范串，用于匹配预置物质，如 'Fe2(SO4)3' */
function canonical(nodes: Node[]): string {
  return nodes
    .map((n) => {
      const body = 'group' in n ? `(${canonical(n.group)})` : n.el;
      return body + (n.n > 1 ? String(n.n) : '');
    })
    .join('');
}

function sameAtoms(a: Record<string, number>, b: Record<string, number>): boolean {
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  return ka.every((k) => a[k] === b[k]);
}

/* ------------------------------------------------------------ 离子字典 */

interface AnionDef {
  key: string;
  label: string;
  atoms: Record<string, number>;
  charge: number;
  /** strong 强酸根（不水解） / weak 弱酸根（水解） / amphi 酸式根（既水解又电离） / ionize 只电离 */
  kind: 'strong' | 'weak' | 'amphi' | 'ionize';
  /** 水解（或电离）能力的相对刻度，0~10，用来比强弱 */
  strength: number;
  /** 水解产物 */
  product?: string;
  /** 对应的酸 */
  parentAcid?: string;
  /** 酸式根电离出的阴离子 */
  into?: { label: string; charge: number };
  /** 酸式根：水解与电离谁占优 */
  winner?: 'hydrolysis' | 'ionization';
}

const A = (o: AnionDef) => o;

const ANIONS: AnionDef[] = [
  /* 强酸根：不水解 */
  A({ key: 'Cl', label: 'Cl⁻', atoms: { Cl: 1 }, charge: -1, kind: 'strong', strength: 0, parentAcid: 'HCl（强酸）' }),
  A({ key: 'Br', label: 'Br⁻', atoms: { Br: 1 }, charge: -1, kind: 'strong', strength: 0, parentAcid: 'HBr（强酸）' }),
  A({ key: 'I', label: 'I⁻', atoms: { I: 1 }, charge: -1, kind: 'strong', strength: 0, parentAcid: 'HI（强酸）' }),
  A({ key: 'NO3', label: 'NO₃⁻', atoms: { N: 1, O: 3 }, charge: -1, kind: 'strong', strength: 0, parentAcid: 'HNO₃（强酸）' }),
  A({ key: 'SO4', label: 'SO₄²⁻', atoms: { S: 1, O: 4 }, charge: -2, kind: 'strong', strength: 0, parentAcid: 'H₂SO₄（强酸）' }),
  A({ key: 'ClO3', label: 'ClO₃⁻', atoms: { Cl: 1, O: 3 }, charge: -1, kind: 'strong', strength: 0, parentAcid: 'HClO₃（强酸）' }),
  A({ key: 'ClO4', label: 'ClO₄⁻', atoms: { Cl: 1, O: 4 }, charge: -1, kind: 'strong', strength: 0, parentAcid: 'HClO₄（强酸）' }),
  A({ key: 'MnO4', label: 'MnO₄⁻', atoms: { Mn: 1, O: 4 }, charge: -1, kind: 'strong', strength: 0, parentAcid: 'HMnO₄（强酸）' }),

  /* 弱酸根：抢 H⁺ 放 OH⁻ */
  A({ key: 'F', label: 'F⁻', atoms: { F: 1 }, charge: -1, kind: 'weak', strength: 5, product: 'HF', parentAcid: 'HF（弱酸）' }),
  A({ key: 'CH3COO', label: 'CH₃COO⁻', atoms: { C: 2, H: 3, O: 2 }, charge: -1, kind: 'weak', strength: 5, product: 'CH₃COOH', parentAcid: 'CH₃COOH（弱酸）' }),
  A({ key: 'HCOO', label: 'HCOO⁻', atoms: { C: 1, H: 1, O: 2 }, charge: -1, kind: 'weak', strength: 5, product: 'HCOOH', parentAcid: 'HCOOH（弱酸）' }),
  A({ key: 'CN', label: 'CN⁻', atoms: { C: 1, N: 1 }, charge: -1, kind: 'weak', strength: 6, product: 'HCN', parentAcid: 'HCN（弱酸）' }),
  A({ key: 'NO2', label: 'NO₂⁻', atoms: { N: 1, O: 2 }, charge: -1, kind: 'weak', strength: 5, product: 'HNO₂', parentAcid: 'HNO₂（弱酸）' }),
  A({ key: 'ClO', label: 'ClO⁻', atoms: { Cl: 1, O: 1 }, charge: -1, kind: 'weak', strength: 6, product: 'HClO', parentAcid: 'HClO（弱酸）' }),
  A({ key: 'CO3', label: 'CO₃²⁻', atoms: { C: 1, O: 3 }, charge: -2, kind: 'weak', strength: 8, product: 'HCO₃⁻', parentAcid: 'H₂CO₃（弱酸）' }),
  A({ key: 'SO3', label: 'SO₃²⁻', atoms: { S: 1, O: 3 }, charge: -2, kind: 'weak', strength: 7, product: 'HSO₃⁻', parentAcid: 'H₂SO₃（弱酸）' }),
  A({ key: 'SiO3', label: 'SiO₃²⁻', atoms: { Si: 1, O: 3 }, charge: -2, kind: 'weak', strength: 8, product: 'H₂SiO₃', parentAcid: 'H₂SiO₃（弱酸）' }),
  A({ key: 'S', label: 'S²⁻', atoms: { S: 1 }, charge: -2, kind: 'weak', strength: 9, product: 'HS⁻', parentAcid: 'H₂S（弱酸）' }),
  A({ key: 'PO4', label: 'PO₄³⁻', atoms: { P: 1, O: 4 }, charge: -3, kind: 'weak', strength: 9, product: 'HPO₄²⁻', parentAcid: 'H₃PO₄（中强酸，按弱酸处理）' }),
  A({ key: 'AlO2', label: 'AlO₂⁻', atoms: { Al: 1, O: 2 }, charge: -1, kind: 'weak', strength: 8, product: 'Al(OH)₃', parentAcid: 'HAlO₂（弱酸）' }),

  /* 弱酸的酸式根：水解与电离同时进行，看谁占优 */
  A({
    key: 'HCO3', label: 'HCO₃⁻', atoms: { H: 1, C: 1, O: 3 }, charge: -1, kind: 'amphi', strength: 6,
    product: 'H₂CO₃', parentAcid: 'H₂CO₃', into: { label: 'CO₃²⁻', charge: -2 }, winner: 'hydrolysis',
  }),
  A({
    key: 'HS', label: 'HS⁻', atoms: { H: 1, S: 1 }, charge: -1, kind: 'amphi', strength: 7,
    product: 'H₂S', parentAcid: 'H₂S', into: { label: 'S²⁻', charge: -2 }, winner: 'hydrolysis',
  }),
  A({
    key: 'HPO4', label: 'HPO₄²⁻', atoms: { H: 1, P: 1, O: 4 }, charge: -2, kind: 'amphi', strength: 7,
    product: 'H₂PO₄⁻', parentAcid: 'H₃PO₄', into: { label: 'PO₄³⁻', charge: -3 }, winner: 'hydrolysis',
  }),
  A({
    key: 'HSO3', label: 'HSO₃⁻', atoms: { H: 1, S: 1, O: 3 }, charge: -1, kind: 'amphi', strength: 6,
    product: 'H₂SO₃', parentAcid: 'H₂SO₃', into: { label: 'SO₃²⁻', charge: -2 }, winner: 'ionization',
  }),
  A({
    key: 'H2PO4', label: 'H₂PO₄⁻', atoms: { H: 2, P: 1, O: 4 }, charge: -1, kind: 'amphi', strength: 6,
    product: 'H₃PO₄', parentAcid: 'H₃PO₄', into: { label: 'HPO₄²⁻', charge: -2 }, winner: 'ionization',
  }),
  /* 强酸的酸式根：只电离、不水解 */
  A({
    key: 'HSO4', label: 'HSO₄⁻', atoms: { H: 1, S: 1, O: 4 }, charge: -1, kind: 'ionize', strength: 7,
    parentAcid: 'H₂SO₄', into: { label: 'SO₄²⁻', charge: -2 }, winner: 'ionization',
  }),
];

/** 阳离子所属碱的强弱：true = 对应强碱，阳离子不水解 */
const STRONG_BASE_ELEMENTS = ['Na', 'K', 'Ba', 'Ca', 'Sr', 'Rb', 'Cs', 'Li'];

interface CationDef {
  el: string;
  name: string;
  /** 允许的化合价 */
  charges: number[];
  /** 水解能力刻度（越大越容易水解）；强碱阳离子给 0 */
  strength: Record<number, number>;
}
const CATION_DEFS: Record<string, CationDef> = {
  Na: { el: 'Na', name: '钠离子', charges: [1], strength: { 1: 0 } },
  K: { el: 'K', name: '钾离子', charges: [1], strength: { 1: 0 } },
  Li: { el: 'Li', name: '锂离子', charges: [1], strength: { 1: 0 } },
  Rb: { el: 'Rb', name: '铷离子', charges: [1], strength: { 1: 0 } },
  Cs: { el: 'Cs', name: '铯离子', charges: [1], strength: { 1: 0 } },
  Ca: { el: 'Ca', name: '钙离子', charges: [2], strength: { 2: 0 } },
  Ba: { el: 'Ba', name: '钡离子', charges: [2], strength: { 2: 0 } },
  Sr: { el: 'Sr', name: '锶离子', charges: [2], strength: { 2: 0 } },
  Mg: { el: 'Mg', name: '镁离子', charges: [2], strength: { 2: 3 } },
  Zn: { el: 'Zn', name: '锌离子', charges: [2], strength: { 2: 5 } },
  Cu: { el: 'Cu', name: '铜离子', charges: [1, 2], strength: { 1: 4, 2: 5 } },
  Fe: { el: 'Fe', name: '铁离子', charges: [2, 3], strength: { 2: 4, 3: 9 } },
  Al: { el: 'Al', name: '铝离子', charges: [3], strength: { 3: 8 } },
  Ag: { el: 'Ag', name: '银离子', charges: [1], strength: { 1: 3 } },
  Pb: { el: 'Pb', name: '铅离子', charges: [2, 4], strength: { 2: 4, 4: 7 } },
  Sn: { el: 'Sn', name: '锡离子', charges: [2, 4], strength: { 2: 4, 4: 7 } },
  Mn: { el: 'Mn', name: '锰离子', charges: [2, 4, 7], strength: { 2: 4, 4: 6, 7: 8 } },
  Ni: { el: 'Ni', name: '镍离子', charges: [2, 3], strength: { 2: 4, 3: 7 } },
  Co: { el: 'Co', name: '钴离子', charges: [2, 3], strength: { 2: 4, 3: 7 } },
  Cr: { el: 'Cr', name: '铬离子', charges: [3, 6], strength: { 3: 7, 6: 8 } },
  Hg: { el: 'Hg', name: '汞离子', charges: [1, 2], strength: { 1: 4, 2: 5 } },
  Cd: { el: 'Cd', name: '镉离子', charges: [2], strength: { 2: 4 } },
  Bi: { el: 'Bi', name: '铋离子', charges: [3, 5], strength: { 3: 7, 5: 8 } },
  NH4: { el: 'NH₄', name: '铵根离子', charges: [1], strength: { 1: 5 } },
};
/** NH₄⁺ 水解抢 OH⁻ 生成的一水合氨 */
const CATION_PRODUCT: Record<string, string> = { NH4: 'NH₃·H₂O' };
/** 阳离子符号的显示写法 */
const CATION_DISPLAY: Record<string, string> = { NH4: 'NH₄' };
/** 难溶盐 / 会彻底双水解的物质：讨论水溶液酸碱性意义不大，提示一下 */
const INSOLUBLE_NOTE: Record<string, string> = {
  CaCO3: 'CaCO₃ 难溶于水，严格谈「溶液酸碱性」意义不大 —— 这里按溶解的那一小部分推演。',
  BaCO3: 'BaCO₃ 难溶于水，这里按溶解的那一小部分推演。',
  BaSO4: 'BaSO₄ 难溶于水（钡餐），几乎不水解，通常不讨论它的酸碱性。',
  AgCl: 'AgCl 难溶于水，几乎不水解，通常不讨论它的酸碱性。',
  AgBr: 'AgBr 难溶于水，通常不讨论它的酸碱性。',
  AgI: 'AgI 难溶于水，通常不讨论它的酸碱性。',
  CaSO4: 'CaSO₄ 微溶，这里按溶解的那一部分推演。',
  PbSO4: 'PbSO₄ 难溶于水，通常不讨论它的酸碱性。',
  MgCO3: 'MgCO₃ 微溶 / 难溶，这里按溶解的那一部分推演。',
  CaF2: 'CaF₂ 难溶于水，通常不讨论它的酸碱性。',
  Al2S3: 'Al₂S₃ 遇水会发生**完全双水解**，直接生成 Al(OH)₃ 沉淀和 H₂S 气体，不属于水解平衡的讨论范围（这也是实验室不能湿法制 Al₂S₃ 的原因）。',
  Fe2S3: 'Fe₂S₃ 遇水会完全水解，通常不讨论它的酸碱性。',
};

const STRONG_ACID_KEYS = ['HCl', 'HBr', 'HI', 'HNO3', 'HClO4', 'HClO3', 'H2SO4'];

/** 常见物质的中文名（推导出来的未知名就直接用化学式） */
const COMMON_NAMES: Record<string, string> = {
  NaCl: '氯化钠', KCl: '氯化钾', BaCl2: '氯化钡', CaCl2: '氯化钙', MgCl2: '氯化镁',
  Na2CO3: '碳酸钠（纯碱）', K2CO3: '碳酸钾', NaHCO3: '碳酸氢钠（小苏打）',
  Na2SO4: '硫酸钠', CuSO4: '硫酸铜', Na2SO3: '亚硫酸钠', Na2SiO3: '硅酸钠',
  KNO3: '硝酸钾', AgNO3: '硝酸银', NH4NO3: '硝酸铵', NaNO3: '硝酸钠',
  FeCl3: '氯化铁', FeCl2: '氯化亚铁', AlCl3: '氯化铝', ZnSO4: '硫酸锌',
  NaClO: '次氯酸钠', CaCl2O2: '次氯酸钙', CH3COONa: '醋酸钠', NH4Cl: '氯化铵',
  NH4HCO3: '碳酸氢铵', NaF: '氟化钠', Na2S: '硫化钠', Na3PO4: '磷酸钠',
  Al2S3: '硫化铝（会完全水解）', NaAlO2: '偏铝酸钠',
};

/* ------------------------------------------------------------ 推导结果 */

export interface InferResult {
  ok: boolean;
  c?: AcidCase;
  /** 命中的预置物质（文案更精修） */
  fromPreset?: boolean;
  reason?: string;
  tip?: string;
}

function fail(reason: string, tip?: string): InferResult {
  return { ok: false, reason, tip };
}

/* ------------------------------------------------------------ 分类推导 */

interface SaltPlan {
  cationEl: string;
  cationCharge: number;
  cationCount: number;
  anion: AnionDef;
  anionCount: number;
}

function findAnion(atoms: Record<string, number>): { anion: AnionDef; count: number } | null {
  for (const a of ANIONS) {
    const keys = Object.keys(a.atoms);
    if (keys.length !== Object.keys(atoms).length) continue;
    if (!keys.every((k) => atoms[k] !== undefined)) continue;
    // atoms 必须是 a.atoms 的整数倍
    let k = -1;
    let ok = true;
    keys.forEach((key) => {
      const ratio = atoms[key] / a.atoms[key];
      if (ratio <= 0 || Math.abs(ratio - Math.round(ratio)) > 1e-9) ok = false;
      else if (k < 0) k = ratio;
      else if (Math.abs(k - ratio) > 1e-9) ok = false;
    });
    if (ok && k > 0) return { anion: a, count: Math.round(k) };
  }
  return null;
}

/** 从剩余的一组 token 里识别阴离子 */
function takeAnion(nodes: Node[]): { anion: AnionDef; count: number } | null {
  if (nodes.length === 1 && 'group' in nodes[0]) {
    const inner = nodes[0].group;
    const hit = findAnion(atomsOf(inner));
    if (!hit) return null;
    return { anion: hit.anion, count: hit.count * nodes[0].n };
  }
  return findAnion(atomsOf(nodes));
}

/** 开头是不是 NH₄⁺（(NH4)2… 或平铺的 NH4…） */
function headNH4(nodes: Node[]): number | null {
  const first = nodes[0];
  if (!first) return null;
  if ('group' in first) {
    return sameAtoms(atomsOf(first.group), { N: 1, H: 4 }) ? first.n : null;
  }
  if (nodes.length < 2) return null;
  const a = nodes[0] as { el: string; n: number };
  const b = nodes[1] as { el: string; n: number };
  if (!('el' in nodes[1])) return null;
  return a.el === 'N' && a.n === 1 && b.el === 'H' && b.n === 4 ? 1 : null;
}

function planSalt(nodes: Node[]): { plan: SaltPlan } | string {
  let rest = nodes.slice();
  let cationEl = '';
  let cationCount = 1;

  const nNh = headNH4(rest);
  if (nNh !== null) {
    cationEl = 'NH4';
    cationCount = nNh;
    rest = rest.slice('group' in rest[0] ? 1 : 2);
  } else if (rest[0] && 'el' in rest[0] && CATION_DEFS[rest[0].el]) {
    cationEl = rest[0].el;
    cationCount = rest[0].n;
    rest = rest.slice(1);
  } else {
    // 阴离子在前的写法（如 CH3COONa）：尾部才是阳离子
    const last = rest[rest.length - 1];
    if (last && 'el' in last && CATION_DEFS[last.el as string]) {
      cationEl = last.el as string;
      cationCount = (last as { el: string; n: number }).n;
      rest = rest.slice(0, -1);
    } else if (
      rest.length >= 2 &&
      'el' in rest[rest.length - 2] &&
      'el' in rest[rest.length - 1] &&
      (rest[rest.length - 2] as { el: string }).el === 'N' &&
      (rest[rest.length - 1] as { el: string; n: number }).n === 4 &&
      (rest[rest.length - 1] as { el: string }).el === 'H'
    ) {
      // CH3COONH4 这类：尾部是 NH4
      cationEl = 'NH4';
      cationCount = 1;
      rest = rest.slice(0, -2);
    }
  }
  if (!cationEl || !rest.length) return '没认出阳离子。试试 NaCl、Na₂CO₃、NH₄Cl、Al₂(SO₄)₃ 这样的写法。';

  const anionHit = takeAnion(rest);
  if (!anionHit) return `没认出酸根「${canonical(rest)}」。常见酸根：Cl⁻、NO₃⁻、SO₄²⁻、CO₃²⁻、HCO₃⁻、CH₃COO⁻。`;

  const anionTotal = anionHit.anion.charge * anionHit.count;
  const z = -anionTotal / cationCount;
  if (!Number.isInteger(z) || z <= 0 || z > 7) return '电荷配不平，检查一下下标有没有写错。';

  const def = CATION_DEFS[cationEl];
  if (!def.charges.includes(z)) return `${cationEl} 常见化合价是 ${def.charges.join(' / ')}，这里算出来是 +${z}，检查一下。`;

  return { plan: { cationEl, cationCharge: z, cationCount, anion: anionHit.anion, anionCount: anionHit.count } };
}

/* ------------------------------------------------------------ 主入口 */

export function inferFromFormula(raw: string): InferResult {
  const input = raw.trim();
  if (!input) return fail('先写一个化学式，比如 NH₄Cl');

  const nodes = parseGroups(input);
  if (!nodes) return fail(`「${input}」没解析成功`, '只用元素符号 + 数字 + 括号，比如 Fe₂(SO₄)₃、Ca(OH)₂');
  const canon = canonical(nodes);
  const atoms = atomsOf(nodes);

  // 命中预置物质 → 直接用精修文案
  const preset = CASES.find((c) => normalizeFormula(c.formula) === canon);
  if (preset) return { ok: true, c: preset, fromPreset: true };

  /* ---- 一水合氨 ---- */
  if (canon === 'NH3H2O' || canon === 'NH4OH' || canon === 'NH3·H2O') {
    return { ok: true, c: weakBaseCase('NH₃·H₂O', 'NH₃H₂O') };
  }

  /* ---- 碱：M(OH)n ---- */
  const metalKeys = Object.keys(atoms).filter((k) => CATION_DEFS[k]);
  const isOH =
    (atoms.O || 0) > 0 && (atoms.H || 0) > 0 && atoms.O === atoms.H && metalKeys.length > 0;
  if (isOH) {
    const metal = metalKeys[0];
    const nOH = atoms.O;
    const totalMetalCount = atoms[metal];
    if (totalMetalCount && nOH % totalMetalCount === 0) {
      const z = nOH / totalMetalCount;
      const def = CATION_DEFS[metal];
      if (def.charges.includes(z)) {
        const strong = STRONG_BASE_ELEMENTS.includes(metal);
        return { ok: true, c: baseCase(metal, z, nOH, strong) };
      }
    }
    return fail('这个碱我没认出来', '试试 NaOH、Ca(OH)₂、Al(OH)₃、NH₃·H₂O');
  }

  /* ---- 酸 ---- */
  const noMetal = metalKeys.length === 0;
  const firstIsH = !!nodes[0] && 'el' in nodes[0] && (nodes[0] as { el: string }).el === 'H';
  const isCarboxylic = !firstIsH && (atoms.C || 0) >= 2 && (atoms.O || 0) >= 2;
  if (noMetal && (atoms.H || 0) > 0) {
    if (firstIsH || isCarboxylic) {
      const strong = STRONG_ACID_KEYS.includes(canon) || isKnownStrongAcid(atoms);
      // 强酸一次电离完，弱酸只写第一步（H₂CO₃ → H⁺ + HCO₃⁻）
      const anionRest = strong ? dropLeadingH(nodes) : isCarboxylic ? stripCarboxylH(nodes) : dropOneH(nodes);
      const anionHit = anionRest ? takeAnion(anionRest) : null;
      if (!anionHit) return fail(`没认出「${canon}」电离后的酸根`, '试试 HCl、H₂SO₄、CH₃COOH、H₂CO₃');
      const acidicH = strong ? atoms.H : anionHit.count > 1 ? anionHit.count : 1;
      return { ok: true, c: acidCase(input, canon, acidicH, strong, anionHit.anion) };
    }
    if (Object.keys(atoms).length === 1) {
      return fail('单质不属于这里讨论的酸 / 碱 / 盐', '写化合物，比如 HCl、NaOH、Na₂CO₃');
    }
    // 不是酸的样子，也可能是铵盐（NH₄HCO₃、NH₄NO₃）：先往下交给盐的分支试
  }

  /* ---- 盐 ---- */
  const planned = planSalt(nodes);
  if (typeof planned === 'string') {
    if (noMetal && (atoms.H || 0) > 0) {
      return fail(
        `没认出「${prettyFormula(canon)}」是酸、碱还是盐`,
        '这里只覆盖无机酸 / 碱 / 盐和羧酸，乙醇、葡萄糖这类非电解质不在范围内。试试 HCl、NaOH、CH₃COONa。'
      );
    }
    return fail(planned);
  }
  return { ok: true, c: saltCase(input, canon, planned.plan) };
}

/* ------------------------------------------------------------ 各种物质的组装 */

const KNOWN_STRONG_ACIDS: Record<string, number>[] = [
  { H: 1, Cl: 1 }, { H: 1, Br: 1 }, { H: 1, I: 1 }, { H: 1, N: 1, O: 3 },
  { H: 2, S: 1, O: 4 }, { H: 1, Cl: 1, O: 4 }, { H: 1, Cl: 1, O: 3 },
];
function isKnownStrongAcid(atoms: Record<string, number>): boolean {
  return KNOWN_STRONG_ACIDS.some((a) => sameAtoms(a, atoms));
}
/** 强酸：所有 H 都电离掉，剩下的就是酸根 */
function dropLeadingH(nodes: Node[]): Node[] | null {
  if (nodes[0] && 'el' in nodes[0] && nodes[0].el === 'H') return nodes.slice(1);
  return nodes;
}
/** 弱酸：一次只电离一个 H⁺，剩下的是酸式根（H₂CO₃ → HCO₃⁻，这才是高中写法） */
function dropOneH(nodes: Node[]): Node[] | null {
  const head = nodes[0];
  if (!head || !('el' in head) || head.el !== 'H') return nodes;
  if (head.n <= 1) return nodes.slice(1);
  const out = nodes.slice();
  out[0] = { el: 'H', n: head.n - 1 };
  return out;
}
/** 有机酸去掉羧基上那个可电离的 H：CH3COOH → CH3COO */
function stripCarboxylH(nodes: Node[]): Node[] | null {
  const atoms = atomsOf(nodes);
  const h = (atoms.H || 0) - 1;
  if (h > 0) atoms.H = h;
  else delete atoms.H;
  const hit = findAnion(atoms);
  return hit ? synth(hit) : null;
}
/** 由 {anion,count} 反推一组 token（只用于交给 takeAnion） */
function synth(hit: { anion: AnionDef; count: number }): Node[] {
  const out: Node[] = [];
  Object.keys(hit.anion.atoms).forEach((el) => {
    out.push({ el, n: hit.anion.atoms[el] * hit.count });
  });
  return out;
}

/* ---- 酸 ---- */
function acidCase(input: string, canon: string, acidicH: number, strong: boolean, anion: AnionDef): AcidCase {
  const name = COMMON_NAMES[canon] || `${anion.label}对应的${strong ? '强' : '弱'}酸`;
  const hLabels: { label: string; charge: number }[] = [];
  for (let i = 0; i < acidicH; i += 1) hLabels.push({ label: 'H⁺', charge: 1 });
  hLabels.push({ label: anion.label, charge: anion.charge });
  const arrow = strong ? '→' : '⇌';
  const hStr = acidicH > 1 ? `${acidicH}H⁺` : 'H⁺';
  const pretty = prettyFormula(canon);
  return {
    id: `custom:${canon}`,
    name,
    formula: prettyFormula(canon),
    group: strong ? '强酸' : '弱酸',
    groupKey: 'acid',
    verdict: 'acid',
    headline: strong
      ? `${pretty} 完全电离，${hStr} 全部放出来，c(H⁺) 远大于 c(OH⁻) → 酸性。`
      : `${pretty} 只电离掉一小部分，产生的 H⁺ 少，但仍然比 OH⁻ 多 → 弱酸性。`,
    form: 'molecule',
    ions: [],
    molecule: prettyFormula(canon),
    moleculeFull: strong,
    moleculeIons: hLabels,
    equation: `${pretty} ${arrow} ${hStr} + ${anion.label}`,
    why: strong
      ? '强酸在水中 100% 电离，方程式写单向箭头。「几元酸」说的是能电离出几个 H⁺，「强弱」说的是电离得彻不彻底，两回事。'
      : '弱电解质只能部分电离，写 ⇌。同浓度下 H⁺ 少得多，所以叫「弱」，但它依然是酸。',
    compare: '强弱看电离程度，不看能电离出几个 H⁺：醋酸是一元酸但也算弱酸，硫酸二元且是强酸。',
  };
}

/* ---- 碱 ---- */
function weakBaseCase(display: string, canon: string): AcidCase {
  return {
    id: `custom:${canon}`,
    name: '一水合氨（氨水）',
    formula: display,
    group: '弱碱',
    groupKey: 'base',
    verdict: 'base',
    headline: 'NH₃·H₂O 只部分电离，放出的 OH⁻ 让 c(OH⁻) 略大于 c(H⁺) → 弱碱性。',
    form: 'molecule',
    ions: [],
    molecule: display,
    moleculeFull: false,
    moleculeIons: [{ label: 'NH₄⁺', charge: 1 }, { label: 'OH⁻', charge: -1 }],
    equation: 'NH₃·H₂O ⇌ NH₄⁺ + OH⁻',
    why: '高中唯一的常见弱碱。氨水显碱性，就是因为这一小部分电离出来的 OH⁻。',
    compare: 'NH₃ 本身不是碱，NH₃ 溶于水生成的 NH₃·H₂O 才是电解质 —— 写电离方程式别写成 NH₃ ⇌ NH₄⁺ + OH⁻。',
  };
}

function baseCase(metal: string, z: number, nOH: number, strong: boolean): AcidCase {
  const def = CATION_DEFS[metal];
  const catLabel = `${metal}${chargeTag(z)}`;
  const display = nOH > 1 ? `${metal}(OH)${sub(nOH)}` : `${metal}OH`;
  const ions: { label: string; charge: number }[] = [{ label: catLabel, charge: z }];
  for (let i = 0; i < nOH; i += 1) ions.push({ label: 'OH⁻', charge: -1 });
  const arrow = strong ? '→' : '⇌';
  return {
    id: `custom:${metal}(OH)${nOH}`,
    name: COMMON_NAMES[display] || `${def.name}的氢氧化物`,
    formula: display,
    group: strong ? '强碱' : '弱碱',
    groupKey: 'base',
    verdict: 'base',
    headline: strong
      ? `${display} 完全电离出 ${nOH > 1 ? `${nOH} 个 ` : ''}OH⁻，c(OH⁻) 远大于 c(H⁺) → 碱性。`
      : `${display} 难溶、电离程度小，但溶解的那部分会给出 OH⁻ → 弱碱性。`,
    form: 'molecule',
    ions: [],
    molecule: display,
    moleculeFull: strong,
    moleculeIons: ions,
    equation: `${display} ${arrow} ${catLabel} + ${nOH > 1 ? `${nOH}OH⁻` : 'OH⁻'}`,
    why: strong
      ? '强碱完全电离。OH⁻ 一多就会反过来压制水的电离，H⁺ 被压得更少。'
      : '弱碱难溶、部分电离。注意「难溶」不等于「弱」：Ca(OH)₂ 微溶但溶解部分完全电离，仍算强碱；Mg(OH)₂ 则按弱碱处理。',
  };
}

/* ---- 盐 ---- */
function saltCase(input: string, canon: string, p: SaltPlan): AcidCase {
  const catDef = CATION_DEFS[p.cationEl];
  const catLabel = `${CATION_DISPLAY[p.cationEl] || p.cationEl}${chargeTag(p.cationCharge)}`;
  const catHydrolyzes = p.cationEl === 'NH4' || !STRONG_BASE_ELEMENTS.includes(p.cationEl);
  const catStrength = catDef.strength[p.cationCharge] ?? 0;
  const cationProduct =
    CATION_PRODUCT[p.cationEl] ||
    (p.cationCharge > 1 ? `${p.cationEl}(OH)${sub(p.cationCharge)}` : `${p.cationEl}OH`);

  const an = p.anion;
  const anionHydrolyzes = an.kind === 'weak' || (an.kind === 'amphi' && an.winner === 'hydrolysis');
  const anionIonizes = an.kind === 'ionize' || (an.kind === 'amphi' && an.winner === 'ionization');

  // 两边分别往 H⁺ 侧 / OH⁻ 侧施加的「力度」
  let hDrive = catHydrolyzes ? catStrength : 0;
  let ohDrive = anionHydrolyzes ? an.strength : 0;
  if (anionIonizes) hDrive += an.strength;

  // 强弱刻度是相对值：只有两边完全打平时才算中性（醋酸铵就是这种情况）
  let verdict: Verdict = 'neutral';
  if (hDrive !== ohDrive) verdict = hDrive > ohDrive ? 'acid' : 'base';
  // 只有单边水解时不需要比刻度
  if (catHydrolyzes && !anionHydrolyzes && !anionIonizes) verdict = 'acid';
  if (!catHydrolyzes && anionHydrolyzes) verdict = 'base';
  if (!catHydrolyzes && !anionHydrolyzes && !anionIonizes) verdict = 'neutral';

  const ions: AcidParticle[] = [
    {
      label: catLabel,
      charge: p.cationCharge,
      role: catHydrolyzes ? 'active' : 'spectator',
    },
    {
      label: an.label,
      charge: an.charge,
      role: anionHydrolyzes || anionIonizes ? 'active' : 'spectator',
    },
  ];

  const hydrolysis: HydrolysisSpec[] = [];
  if (catHydrolyzes) {
    hydrolysis.push({ ion: catLabel, take: 'OH', product: cationProduct, release: 'H' });
  }
  if (anionHydrolyzes) {
    hydrolysis.push({ ion: an.label, take: 'H', product: an.product || '', release: 'OH' });
  }
  const ionization: IonizationSpec | undefined = anionIonizes && an.into
    ? {
        ion: an.label,
        into: [{ label: 'H⁺', charge: 1 }, { label: an.into.label, charge: an.into.charge }],
        full: an.kind === 'ionize',
        count: an.kind === 'ionize' ? 3 : 1,
      }
    : undefined;

  // 同时有水解和电离时，水解的动画份数多一点，好看出「谁跑赢」
  if (hydrolysis.length && ionization) hydrolysis[0].count = 2;

  const anionStrongAcidRadical = an.kind === 'strong';
  const cationStrongBaseRadical = !catHydrolyzes;
  const group =
    an.kind === 'amphi' || an.kind === 'ionize'
      ? `${an.parentAcid}的酸式盐`
      : `${anionStrongAcidRadical ? '强酸' : '弱酸'}${cationStrongBaseRadical ? '强碱' : '弱碱'}盐`;

  const parts: string[] = [];
  if (catHydrolyzes) parts.push(`${catLabel} 水解：抢水里的 OH⁻ 生成 ${cationProduct}，放出 H⁺`);
  if (anionHydrolyzes) parts.push(`${an.label} 水解：抢水里的 H⁺ 生成 ${an.product}，放出 OH⁻`);
  if (anionIonizes) parts.push(`${an.label} 电离：直接拆出 H⁺ 和 ${an.into ? an.into.label : ''}`);
  if (!parts.length) parts.push('两种离子都只被水短暂包围（水合），不与水发生反应');

  const verdictText = verdict === 'acid' ? '酸性' : verdict === 'base' ? '碱性' : '中性';
  const headline = `${parts.join('；')} → 溶液显${verdictText}。`;

  const equations: string[] = [];
  if (catHydrolyzes) equations.push(`${catLabel} + H₂O ⇌ ${cationProduct} + H⁺`);
  if (anionHydrolyzes) equations.push(`${an.label} + H₂O ⇌ ${an.product} + OH⁻`);
  if (anionIonizes && an.into) {
    equations.push(`${an.label} ⇌ H⁺ + ${an.into.label}${anionHydrolyzes ? '（次要）' : ''}`);
  }
  if (!equations.length) equations.push(`${prettyFormula(canon)} → ${catLabel} + ${an.label}（不水解）`);

  const whyBits: string[] = [];
  whyBits.push(catHydrolyzes
    ? `${catLabel} 来自${p.cationEl === 'NH4' ? '弱碱 NH₃·H₂O' : '弱碱'}，它「认得」OH⁻，会把水分子拆开把 OH⁻ 抱走。`
    : `${catLabel} 来自强碱，不认 OH⁻，水只会被它短暂吸住又放走。`);
  whyBits.push(anionHydrolyzes
    ? `${an.label} 来自${an.parentAcid}，它「认得」H⁺，会把水分子拆开把 H⁺ 抱走。`
    : anionIonizes
      ? `${an.label} 是${an.parentAcid}的酸式根，会自己电离出 H⁺。`
      : `${an.label} 来自${an.parentAcid || '强酸'}，不水解。`);
  if (hydrolysis.length === 2) {
    whyBits.push(`两边都水解（双水解），互相促进，比的是谁更强：${catLabel} 的强度 ${catStrength} vs ${an.label} 的强度 ${an.strength}，` +
      (verdict === 'neutral' ? '两者接近，放出的 H⁺ 与 OH⁻ 大致抵消，溶液近中性。' : verdict === 'acid' ? '阳离子这边更强，H⁺ 占上风。' : '阴离子这边更强，OH⁻ 占上风。'));
  }
  if (hydrolysis.length && ionization) {
    whyBits.push(`${an.label} 同时有水解和电离两条路，${anionHydrolyzes ? '水解跑赢电离' : '电离跑赢水解'}，这就是最终结果的方向。`);
  }

  const note = INSOLUBLE_NOTE[canon];
  const compare = note
    ? note
    : catHydrolyzes && !anionHydrolyzes
      ? '对照 NaCl：同样是可溶盐，Na⁺ 不水解就不显酸性 —— 差别就在阳离子弱不弱。'
      : anionHydrolyzes && !catHydrolyzes
        ? '对照 NaCl：Na⁺、Cl⁻ 两边都不水解，所以 NaCl 显中性。'
        : undefined;

  return {
    id: `custom:${canon}`,
    name: COMMON_NAMES[canon] || `${catLabel} 与 ${an.label} 组成的盐`,
    formula: prettyFormula(canon),
    group,
    groupKey: 'salt',
    verdict,
    headline,
    form: 'salt',
    ions,
    hydrolysis: hydrolysis.length ? hydrolysis : undefined,
    ionization,
    equation: equations.join('；'),
    why: (note ? `${note} ` : '') + whyBits.join(''),
    compare,
  };
}

/** 给输入框用的示例 */
export const INFER_EXAMPLES = ['NH₄Cl', 'NaCl', 'CH₃COONa', 'Na₂CO₃', 'Al₂(SO₄)₃', 'NaHCO₃', 'NaHSO₄', 'CuSO₄', 'CH₃COONH₄', 'HCl', 'NaOH'];
