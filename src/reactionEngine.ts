// 反应“通用推导 + 电子级剧幕”模块
//  - 输入 A + B → 归一化物种 → 先匹配内容库预置反应
//  - 未收录时按高中常见反应模式推导（原子守恒 + 配平求解），并给出分步电子演示
//  - 推导结果对复杂/特殊组合可能不准确（界面上会给出提示）
import { allMolecules, content, elementBySymbol, moleculeById } from './data';
import {
  buildMoleculeForFormula,
  displayFormula,
  formulaOfCounts,
  normalizeFormula,
  parseCounts,
  parseCountsLenient,
  sameFormula,
} from './formulaBuilder';
import type { CountMap } from './formulaBuilder';
import type {
  MoleculeData,
  ReactionData,
  ReactionDrama,
  ReactionDramaSpecies,
  DramaStep,
  ElectronTransfer,
} from './types';

type MaybeDrama = { drama: ReactionDrama | null; error?: string; note?: string };

/* ---------------- 基础工具 ---------------- */
const SHELL_CAP = [2, 8, 18, 18, 18, 18];
function mulC(c: CountMap, k: number): CountMap {
  const o: CountMap = {};
  Object.keys(c).forEach((el) => { o[el] = (c[el] || 0) * k; });
  return o;
}
function addC(a: CountMap, b: CountMap): CountMap {
  const o = { ...a };
  Object.keys(b).forEach((el) => { o[el] = (o[el] || 0) + (b[el] || 0); });
  return o;
}
function subC(a: CountMap, b: CountMap): CountMap {
  const o = { ...a };
  Object.keys(b).forEach((el) => { o[el] = (o[el] || 0) - (b[el] || 0); });
  return o;
}
function zeroC(counts: CountMap): boolean {
  return Object.values(counts).every((v) => v === 0);
}
/** 两个原子计数完全相同（与分子式书写顺序无关） */
function sameCounts(a: CountMap, b: CountMap): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const el of keys) if ((a[el] || 0) !== (b[el] || 0)) return false;
  return true;
}
/** 在“字符串键为分子式”的表格里按原子组成查找（键的书写顺序可任意） */
function findEntry<T>(table: Record<string, T>, counts: CountMap): T | undefined {
  for (const k of Object.keys(table)) {
    const kc = parseCounts(k);
    if (kc && sameCounts(kc, counts)) return table[k];
  }
  return undefined;
}
function totalC(c: CountMap): number {
  return Object.values(c).reduce((a, b) => a + (b || 0), 0);
}
function keysC(c: CountMap): string[] {
  return Object.keys(c);
}

/* 常见元素离子价（供置换/成盐推算） */
const VAL: Record<string, number> = {
  H: 1, Li: 1, Na: 1, K: 1, Mg: 2, Ca: 2, Ba: 2, Al: 3,
  Zn: 2, Fe: 2, Cu: 2, Ag: 1, Mn: 2, C: 4, N: 3, O: 2, S: 4, Cl: 1, P: 5, Br: 1, I: 1,
};
const METAL_EL = new Set(['Li', 'Na', 'K', 'Mg', 'Ca', 'Ba', 'Al', 'Zn', 'Fe', 'Cu', 'Ag']);
const SINGLE_ELEMENT = new Set(['H2', 'O2', 'N2', 'Cl2', 'Br2', 'F2']);

/** 已识别酸：{Hn}An，key 为归一化式（小写）→ 酸的氢数 */
const KNOWN_ACIDS: Record<string, { h: number; name: string }> = {
  hcl: { h: 1, name: '盐酸' },
  h2so4: { h: 2, name: '硫酸' },
  hno3: { h: 1, name: '硝酸' },
  h3po4: { h: 3, name: '磷酸' },
  h2co3: { h: 2, name: '碳酸' },
  ch3cooh: { h: 1, name: '乙酸' },
  h2so3: { h: 2, name: '亚硫酸' },
  hno2: { h: 1, name: '亚硝酸' },
  h2c2o4: { h: 2, name: '草酸' },
  hbr: { h: 1, name: '氢溴酸' },
  hi: { h: 1, name: '氢碘酸' },
};
/** 碱（含 OH 的可电离金属化合物）按氢/氧同数识别 */
function baseOHCount(counts: CountMap): number | null {
  const metal = keysC(counts).find((k) => METAL_EL.has(k));
  if (!metal) return null;
  const oh = counts.H;
  if (!oh || !counts.O || counts.O !== oh) return null;
  return oh;
}
/** 已知分解表：单输入分解 → 产物式与条件 */
const DECOMP: Record<string, { products: string[]; cond: string; desc: string }> = {
  H2O2: { products: ['H2O', 'O2'], cond: 'MnO₂催化', desc: '过氧化氢分解' },
  CaCO3: { products: ['CaO', 'CO2'], cond: '高温', desc: '碳酸钙高温分解' },
  H2O: { products: ['H2', 'O2'], cond: '通电', desc: '水电解' },
  KClO3: { products: ['KCl', 'O2'], cond: 'MnO₂·Δ', desc: '氯酸钾分解' },
  KMnO4: { products: ['K2MnO4', 'MnO2', 'O2'], cond: '加热', desc: '高锰酸钾分解' },
  NaHCO3: { products: ['Na2CO3', 'H2O', 'CO2'], cond: '加热', desc: '碳酸氢钠分解' },
  H2CO3: { products: ['H2O', 'CO2'], cond: '常温', desc: '碳酸不稳定分解' },
  Cu2H2CO5: { products: ['CuO', 'H2O', 'CO2'], cond: '加热', desc: '碱式碳酸铜分解' },
};

/** 单质燃烧/化合价氧化物生成式（by 元素） */
const OXIDE_OF: Record<string, string> = {
  H: 'H2O', C: 'CO2', S: 'SO2', P: 'P2O5', Na: 'Na2O', K: 'K2O',
  Mg: 'MgO', Ca: 'CaO', Al: 'Al2O3', Zn: 'ZnO', Cu: 'CuO', Fe: 'Fe3O4', Ba: 'BaO',
};

/** 常见非金属氧化物与水化合（NO₂ 属自身氧化还原歧化，另放出 NO） */
const OXIDE_WATER: { oxide: string; oxideName: string; prods: string[]; dispro: boolean }[] = [
  { oxide: 'CO2', oxideName: '二氧化碳', prods: ['H2CO3'], dispro: false },
  { oxide: 'SO2', oxideName: '二氧化硫', prods: ['H2SO3'], dispro: false },
  { oxide: 'SO3', oxideName: '三氧化硫', prods: ['H2SO4'], dispro: false },
  { oxide: 'N2O5', oxideName: '五氧化二氮', prods: ['HNO3'], dispro: false },
  { oxide: 'P2O5', oxideName: '五氧化二磷', prods: ['H3PO4'], dispro: false },
  { oxide: 'NO2', oxideName: '二氧化氮', prods: ['HNO3', 'NO'], dispro: true },
];
/** 上述水合产物式的常用名 */
const PROD_CN: Record<string, string> = {
  H2CO3: '碳酸', H2SO3: '亚硫酸', H2SO4: '硫酸', HNO3: '硝酸', H3PO4: '磷酸', NO: '一氧化氮',
};
/** 低价（非金属）氧化物被 O₂ 继续氧化：CO→CO₂、NO→NO₂、SO₂→SO₃ */
const OXIDE_UPGRADE: { from: string; name: string; prods: string[]; cond: string; desc: string }[] = [
  { from: 'CO', name: '一氧化碳', prods: ['CO2'], cond: '点燃', desc: 'CO 中 C 为 +2 价，点燃后失电子被氧化为 +4 价（CO₂），火焰呈蓝色。' },
  { from: 'NO', name: '一氧化氮', prods: ['NO2'], cond: '常温', desc: 'NO 遇氧气立即被氧化：N 由 +2 价升到 +4 价，生成红棕色 NO₂。' },
  { from: 'SO2', name: '二氧化硫', prods: ['SO3'], cond: '催化剂 · 加热', desc: '工业制硫酸中 SO₂ 在催化剂（如 V₂O₅）作用下被氧化：S 由 +4 价升到 +6 价。' },
];

type CompoundPart = {
  kind: 'acid' | 'base' | 'salt' | 'element' | 'organic' | 'oxide' | 'other';
  key: string;            // 归一化式
  counts: CountMap;       // 中性分子总原子数
  metal?: string;         // 金属元素（盐/碱）
  cationVal?: number;
  anion?: string;         // 阴离子名称（Cl⁻/SO₄²⁻…）
  anionCounts?: CountMap; // 阴离子原子组成
  anionCharge?: number;
  name?: string;
  mol?: MoleculeData;     // 库内直接命中
};
const ANION_DB: { name: string; charge: number; counts: CountMap }[] = [
  { name: '氯离子 Cl⁻', charge: 1, counts: { Cl: 1 } },
  { name: '硝酸根 NO₃⁻', charge: 1, counts: { N: 1, O: 3 } },
  { name: '硫酸根 SO₄²⁻', charge: 2, counts: { S: 1, O: 4 } },
  { name: '亚硫酸根 SO₃²⁻', charge: 2, counts: { S: 1, O: 3 } },
  { name: '碳酸根 CO₃²⁻', charge: 2, counts: { C: 1, O: 3 } },
  { name: '磷酸根 PO₄³⁻', charge: 3, counts: { P: 1, O: 4 } },
  { name: '氢氧根 OH⁻', charge: 1, counts: { O: 1, H: 1 } },
  { name: '硫离子 S²⁻', charge: 2, counts: { S: 1 } },
  { name: '氧离子 O²⁻', charge: 2, counts: { O: 1 } },
  { name: '溴离子 Br⁻', charge: 1, counts: { Br: 1 } },
  { name: '碘离子 I⁻', charge: 1, counts: { I: 1 } },
];
function matchAnion(counts: CountMap): { anion: CompoundPart['anion']; anionCounts: CountMap; anionCharge: number } | null {
  const cand = ANION_DB.filter((a) => zeroC(subC(counts, a.counts)));
  if (!cand.length) return null;
  cand.sort((a, b) => totalC(a.counts) - totalC(b.counts));
  const c = cand[0];
  return { anion: c.name, anionCounts: c.counts, anionCharge: c.charge };
}

/** 尝试解析单个物种 → 结构信息 */
function inspect(raw: string): CompoundPart | null {
  const ascii = normalizeFormula(raw);
  if (!ascii) return null;
  const counts = parseCounts(ascii);
  if (!counts) return null;
  const key = formulaOfCounts(counts).toLowerCase();
  const lib = allMolecules().find((m) => m.formulaAscii ? normalizeFormula(m.formulaAscii) === normalizeFormula(ascii) : sameFormula(m.formula, ascii));
  const base: CompoundPart = { kind: 'other', key, counts, name: lib?.name, mol: lib };

  // 单质（元素/分子单质）
  if (keysC(counts).length === 1) {
    const el = keysC(counts)[0];
    const n = counts[el] || 0;
    if (n === 1) {
      const isMetal = METAL_EL.has(el) || el === 'C' || el === 'S' || el === 'P';
      return { ...base, kind: isMetal ? 'element' : 'element', counts, name: lib?.name || elementBySymbol(el)?.name, mol: lib };
    }
    if (SINGLE_ELEMENT.has(ascii) || el === 'O') {
      return { ...base, kind: 'element', counts, name: lib?.name || (el === 'O' ? '氧气' : `${el}${n}`), mol: lib };
    }
  }
  // 酸（按原子组成匹配，不依赖书写顺序，如 H2SO4 也可识别）
  const acidDef = findEntry(KNOWN_ACIDS, counts);
  if (acidDef) {
    const h = acidDef.h;
    const anionCounts = subC(counts, { H: h });
    const a = matchAnion(anionCounts) || { anion: '酸根', anionCounts, anionCharge: h };
    return { ...base, kind: 'acid', counts, anion: a.anion, anionCounts: a.anionCounts, anionCharge: a.anionCharge, name: lib?.name || acidDef.name };
  }
  // 碱：金属 + O:H=1:1
  const oh = baseOHCount(counts);
  if (oh != null && oh > 0) {
    const metal = keysC(counts).find((k) => METAL_EL.has(k)) as string;
    return { ...base, kind: 'base', metal, cationVal: VAL[metal] || 1, counts, anion: '氢氧根 OH⁻', anionCounts: { O: 1, H: 1 }, anionCharge: 1, name: lib?.name || `${elementBySymbol(metal)?.name || metal}的氢氧化物` };
  }
  // 含碳可燃有机物（无金属）
  if (counts.C && !keysC(counts).some((k) => METAL_EL.has(k))) {
    return { ...base, kind: 'organic', counts, name: lib?.name || '有机物' };
  }
  // 金属盐（金属 + 剩余部分为已知阴离子）
  const metal = keysC(counts).find((k) => METAL_EL.has(k));
  if (metal && totalC(counts) >= 2) {
    const rest = subC(counts, { [metal]: 1 });
    if (!zeroC(rest)) {
      const a = matchAnion(rest);
      if (a) {
        return { ...base, kind: 'salt', metal, cationVal: VAL[metal] || 1, anion: a.anion, anionCounts: a.anionCounts, anionCharge: a.anionCharge, counts, name: lib?.name || '盐' };
      }
    }
  }
  // 氧化物/金属无 O 单质判断
  const els = keysC(counts);
  const metalOnly = els.filter((e) => METAL_EL.has(e)).length === 1 && totalC(counts) >= 1 && !counts.O && !counts.H && !counts.C;
  if (metalOnly) {
    const m = els.find((e) => METAL_EL.has(e)) as string;
    return { ...base, kind: 'element', counts, name: lib?.name || elementBySymbol(m)?.name, mol: lib };
  }
  return base;
}

/* ---------------- 整数配平求解 ---------------- */
/** 在 1..range 内搜索整数系数使两侧各元素守恒；返回最小总系数的解 [lhsCoef..., rhsCoef...] 或 null */
function solve(lhs: CountMap[], rhs: CountMap[], range = 10): number[] | null {
  const n = lhs.length + rhs.length;
  const cur: number[] = [];
  let best: number[] | null = null;
  let bestSum = Infinity;
  const walk = (depth: number) => {
    if (depth === n) {
      const L: CountMap = {};
      const R: CountMap = {};
      lhs.forEach((c, i) => Object.keys(c).forEach((el) => { L[el] = (L[el] || 0) + (c[el] || 0) * cur[i]; }));
      rhs.forEach((c, i) => Object.keys(c).forEach((el) => { R[el] = (R[el] || 0) + (c[el] || 0) * cur[lhs.length + i]; }));
      const keys = new Set([...Object.keys(L), ...Object.keys(R)]);
      for (const el of keys) {
        if ((L[el] || 0) !== (R[el] || 0)) return;
      }
      if (cur.reduce(gcd, 0) !== 1) return;
      const sum = cur.reduce((a, b) => a + b, 0);
      if (sum < bestSum) { bestSum = sum; best = cur.slice(); }
      return;
    }
    for (let v = 1; v <= range; v++) {
      cur[depth] = v;
      walk(depth + 1);
    }
  };
  walk(0);
  return best;
}
function gcd(a: number, b: number): number {
  a = Math.abs(a); b = Math.abs(b);
  while (b) { const t = a % b; a = b; b = t; }
  return a;
}
/* ---------------- 显示与产物 ---------------- */
function findLibMol(formulaAscii: string): MoleculeData | undefined {
  const na = normalizeFormula(formulaAscii);
  return allMolecules().find((m) => {
    const target = m.formulaAscii ? normalizeFormula(m.formulaAscii) : '';
    // 先按 ASCII 精确比，再按“原子组成”比（容忍 FeO4S vs FeSO₄ 这类书写顺序差异）
    if (target && target === na) return true;
    return sameFormula(m.formula, formulaAscii);
  });
}
/** 若分子没有可拆解的原子几何（如晶格模型 NaCl 等），用公式重建一个近似分子供动画拆解/重组 */
function atomsReadyMol(m: MoleculeData): MoleculeData {
  if (m.atoms && m.atoms.length) return m;
  const ascii = normalizeFormula(m.formulaAscii || m.formula);
  const gen = buildMoleculeForFormula(ascii);
  if (gen && gen.atoms && gen.atoms.length) {
    return { ...m, scene: 'molecule', atoms: gen.atoms, bonds: gen.bonds };
  }
  return m;
}
/** 组装方程式文本：2A + B → C + D */
function equationOf(lhs: ReactionDramaSpecies[], rhs: ReactionDramaSpecies[], arrow = '→'): string {
  const side = (arr: ReactionDramaSpecies[]) =>
    arr.map((s) => `${s.count > 1 ? s.count : ''}${s.mol.formula || s.mol.id}`).join(' + ');
  return `${side(lhs)} ${arrow} ${side(rhs)}`;
}
/** 常见阴离子基元（式 → 原子计数），用于把“原子计数排序”还原成习惯写法（FeO₄S → FeSO₄） */
const ANION_TEMPLATES: { txt: string; c: CountMap }[] = [
  'Cl', 'F', 'Br', 'I', 'OH', 'SO4', 'SO3', 'NO3', 'NO2', 'CO3', 'PO4',
  'HCO3', 'HSO4', 'MnO4', 'MnO2', 'ClO3', 'ClO4', 'O', 'S', 'N',
].map((txt) => ({ txt, c: parseCounts(txt) || {} })).filter((d) => Object.keys(d.c).length > 0);
/** 若计数恰为“一种金属 + 一种常见阴离子”，生成习惯写法（含下标），否则 null */
function prettyFormulaOfCounts(counts: CountMap): string | null {
  const metal = keysC(counts).find((k) => METAL_EL.has(k) && (counts[k] || 0) > 0);
  if (!metal) return null;
  const mC = counts[metal] || 1;
  const rest: CountMap = { ...counts };
  delete rest[metal];
  const rEls = keysC(rest).filter((e) => (rest[e] || 0) > 0);
  if (!rEls.length) return null;
  for (const t of ANION_TEMPLATES) {
    const tEls = keysC(t.c);
    if (tEls.length !== rEls.length) continue;
    const k = (rest[rEls[0]] || 0) / (t.c[rEls[0]] || 0);
    if (!Number.isInteger(k) || k <= 0) continue;
    let ok = true;
    for (const e of rEls) if ((rest[e] || 0) !== (t.c[e] || 0) * k) { ok = false; break; }
    if (!ok) continue;
    const mTxt = mC > 1 ? metal + mC : metal;
    const aTxt = tEls.length > 1 && k > 1 ? `(${t.txt})${k}` : k > 1 ? t.txt + k : t.txt;
    return mTxt + aTxt;
  }
  return null;
}
/** 生成（或库内取用）一个可建模的产物分子 */
function ensureMol(formulaAscii: string): MoleculeData {
  const lib = findLibMol(formulaAscii);
  let m: MoleculeData | undefined;
  if (lib) m = atomsReadyMol(lib);
  if (!m) m = buildMoleculeForFormula(formulaAscii) || undefined;
  const counts = parseCounts(normalizeFormula(formulaAscii)) || undefined;
  if (counts && m) {
    const pretty = prettyFormulaOfCounts(counts);
    if (pretty && m.formula && m.formula.toLowerCase() !== pretty.toLowerCase()) {
      m = { ...m, formula: displayFormula(pretty) };
    }
  }
  if (m) return m;
  // 最简兜底：按原子计数散点成“示意聚集体”，保证守恒动画仍可画
  const els = counts ? keysC(counts).filter((e) => (counts[e] || 0) > 0) : [];
  const ascii = counts ? formulaOfCounts(counts) : normalizeFormula(formulaAscii);
  const parts: MoleculeData['atoms'] = [];
  const bonds: MoleculeData['bonds'] = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  const center = els.find((e) => e !== 'H') || els[0];
  parts.push({ el: center, pos: [0, 0, 0] });
  let ai = 1;
  els.forEach((el, ei) => {
    if (el === center) return;
    for (let k = 0; k < (counts ? counts[el] || 0 : 0); k++) {
      const ang = golden * (ei * 3 + k);
      const d = [Math.cos(ang), Math.sin(ang), ei % 2 ? 0.6 : -0.6];
      const l = Math.hypot(...d);
      parts.push({ el, pos: [d[0] / l * 1.4, d[1] / l * 1.4, d[2] / l * 1.4] });
      bonds.push({ a: 0, b: ai, order: 1 });
      ai++;
    }
  });
  if (parts.length === 1) {
    parts.push({ el: els[0] || 'H', pos: [0, 0, 0] }); // 不至于 0 原子
  }
  const hasC = !!(counts && counts.C);
  const shown = counts ? prettyFormulaOfCounts(counts) || formulaAscii : formulaAscii;
  return {
    id: 'dyn_' + ascii,
    name: hasC ? '有机/化合物 · 近似模型' : '化合物 · 近似模型',
    formula: displayFormula(shown),
    category: '化合物 · 自动推导', level: '扩展 · 自动建模',
    scene: 'molecule', desc: '由反应推导自动拼装的示意模型（键长/键角仅为近似）。',
    atoms: parts, bonds,
    formulaAscii: ascii,
  };
}

function shellStrFor(sym: string, q = 0): string {
  const el = elementBySymbol(sym);
  if (!el || !el.p) return '';
  let rem = el.p - q;
  if (rem <= 0) return '0';
  const out: number[] = [];
  for (let i = 0; rem > 0 && i < SHELL_CAP.length; i++) {
    const c = Math.min(SHELL_CAP[i], rem);
    out.push(c);
    rem -= c;
  }
  return out.join(',');
}
function sup(n: number): string {
  const M: Record<string, string> = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹' };
  return String(n).split('').map((d) => M[d] ?? d).join('');
}
/* ---------------- 步骤文案 ---------------- */
function donorShell(kind: string, metal: string, val: number): string {
  const el = elementBySymbol(metal);
  if (kind === 'metal_acid') {
    const before = shellStrFor(metal);
    const after = shellStrFor(metal, val);
    return `${metal}${el ? `(${before})` : ''} 失 ${val} 个最外层电子 → ${metal}${sup(val)}+(${after})`;
  }
  if (kind === 'metal_o2') return `${metal} 失电子被氧化成 ${metal}${sup(val)}+`;
  return '';
}
function stepsOf(kind: string, rNames: string[], lhsF: string, rhsF: string, cond?: string, p?: { metal?: string; val?: number; acidName?: string }): DramaStep[] {
  const s1 = rNames.join('、');
  let s2 = '';
  let s3 = '';
  let s4 = '';
  if (kind === 'metal_acid') {
    const mv = p?.val || 1;
    const me = p?.metal || '金属';
    s2 = `${s1} 碰撞后，${p?.acidName || '酸'}电离出的 H⁺ 靠近金属表面；金属键断裂、共价键 H–Cl/H–O 断裂，旧结构瓦解为原子/离子碎片。`;
    s3 = `${donorShell('metal_acid', me, mv)}；电子传给 H⁺，H⁺ + e⁻ → H（原子），两个 H 再以共用电子对结合成 H₂。`;
    s4 = `${me}${sup(mv)}+与${p?.acidName ? '酸根' : '酸根'}结合成盐，H 原子两两成键 → 盐 + H₂↑。`;
  } else if (kind === 'metal_o2') {
    const mv = p?.val || 1;
    s2 = `${s1} 接触氧气，旧金属键与 O=O 双键断裂，金属表面原子与氧原子靠近。`;
    s3 = `${p?.metal || '金属'}把最外层电子交予氧：${p?.metal}${sup(mv)}+ 与 O²⁻ 通过静电作用相互吸引（离子化合物本质是电子得失）。`;
    s4 = `阴阳离子按电荷比排布成 ${p?.metal ? p.metal + (mv === 1 ? '₂' : '') : ''}Oₓ 离子晶体。`;
  } else if (kind === 'burn_organic') {
    s2 = `${s1} 引燃：C–C / C–H 断裂，O=O 键断裂；氧原子需要 2 个电子凑满 8 电子。`;
    s3 = `碳把外层电子部分交给氧，形成 C=O 双键的两对共用电子；氢与氧形成 O–H 共用电子对（共价成键）。`;
    s4 = `电子重新排布达到稳定：碳被氧化为 +4 价（CO₂），氢与氧结合成 H₂O。`;
  } else if (kind === 'acid_base') {
    s2 = `${s1} 相互电离：H⁺ 从酸根脱离，金属阳离子与 OH⁻ 分开（强电解质全电离）。`;
    s3 = `H⁺ 与 OH⁻ 结合：OH⁻ 用一对电子与 H⁺ 共用，形成 H₂O；此步不涉及金属电子得失，只发生离子再组合。`;
    s4 = `水分子稳定生成，金属阳离子与酸根靠静电结合成盐（中和反应放热）。`;
  } else if (kind === 'decomp') {
    s2 = `${s1} 在${cond || '加热'}下旧化学键断裂，结构瓦解。`;
    s3 = `键能吸收热量，电子按新的稳定构型重新分配（部分分解含化合价变化，见产物）。`;
    s4 = `形成稳定小分子/晶体并逸出气体。`;
  } else if (kind === 'double_exchange') {
    s2 = `${s1} 在溶液中电离为自由离子，离子相互交换组合。`;
    s3 = `各离子保持原有电子构型，交换伴侣：阳离子 + 新阴离子 / 阴离子 + 新阳离子。`;
    s4 = `离子重新配对生成两种新化合物（若生成水/气体/沉淀则反应可发生）。`;
  } else {
    s2 = `${s1} 相互接触，旧化学键开始断裂。`;
    s3 = `断键后电子重新排布：电子由电子云密度高的一方流向需要电子的一方，或按稳定八隅体重新形成共用电子对。`;
    s4 = '新键生成，产物形成。';
  }
  return [
    { title: '写反应物', desc: `${lhsF}${cond ? '（' + cond + '）' : ''} · ${s1} 相遇。`, mode: 'reactants' },
    { title: '断键 · 拆解', desc: s2, mode: 'split' },
    { title: '电子得失与转移', desc: s3, mode: 'transfer' },
    { title: '重新成键 · 生成物', desc: `${rhsF} · ${s4}`, mode: 'products' },
  ];
}

/* ---------------- 物种 → 剧幕 ---------------- */
function toDramaSpecies(mol: MoleculeData, count: number): ReactionDramaSpecies {
  return { mol, count: Math.max(1, Math.round(count)) };
}

/* 内容库预置反应 → 剧幕 */
export function dramaForKnownReaction(rx: ReactionData): ReactionDrama | null {
  const lhs: ReactionDramaSpecies[] = [];
  const rhs: ReactionDramaSpecies[] = [];
  const lib = (m: string): MoleculeData | null => {
    const x = moleculeById(m);
    if (!x) return null;
    return atomsReadyMol(x);
  };
  for (const s of rx.lhs) {
    const m = lib(s.mol);
    if (!m) return null;
    lhs.push({ mol: m, count: s.count });
  }
  for (const s of rx.rhs) {
    const m = lib(s.mol);
    if (!m) return null;
    rhs.push({ mol: m, count: s.count });
  }
  // 用通用分类确定 kind 与离子/转移信息
  const p = classifyParts(lhs.map((l) => l.mol.formula));
  const atoms = { ...lhs.reduce((a, s) => addC(a, parseCounts(s.mol.formulaAscii || s.mol.formula) || {}), {}) };
  const steps = buildStepsForKnown(rx, p, atoms);
  return {
    id: rx.id,
    name: rx.name,
    equation: rx.equation,
    condition: rx.condition,
    type: rx.type,
    level: rx.level,
    desc: rx.desc,
    lhs, rhs, steps,
    ions: buildIons(p),
    transfers: buildTransfers(p),
  };
}

/* ---------------- 匹配/推导主入口 ---------------- */
export function deriveDramaFromInputs(rawA: string, rawB: string): MaybeDrama {
  const trimA = rawA.trim();
  const trimB = rawB.trim();
  if (!trimA) return { drama: null, error: '请先填写反应物 A（如 Zn）或一个单反应物（如 H2O2）。' };
  // 允许在一格内写 A + B
  const parts: string[] = [];
  const splitPlus = (s: string) => s.split(/[＋+]/g).map((x) => x.trim()).filter(Boolean);
  if (trimB) parts.push(...splitPlus(trimA), ...splitPlus(trimB));
  else parts.push(...splitPlus(trimA));
  if (!parts.length) return { drama: null, error: '未识别到有效分子式。' };
  if (parts.length > 3) return { drama: null, error: '暂支持最多 3 个反应物种，请简化输入。' };
  // 0) 大小写宽容：标准解析失败时按不区分大小写重新解析并还原标准写法（HCL→HCl、NA→Na）
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    if (parseCounts(p)) continue;
    const c = parseCountsLenient(p);
    if (c) parts[i] = formulaOfCounts(c);
  }

  // 1) 直接匹配内容库预置反应（物种集合一致）
  const setKey = (f: string) => {
    const na = normalizeFormula(f);
    const key = formulaOfCounts(parseCounts(na) || {}).toLowerCase();
    return key;
  };
  const inputKeys = parts.map((p) => setKey(p)).sort();
  const inputC = parts.reduce<CountMap>((acc, f) => {
    const c = parseCounts(f);
    return c ? addC(acc, c) : acc;
  }, {});
  for (const r of content.reactions) {
    const lkeys: string[] = [];
    for (const s of r.lhs) {
      const m = moleculeById(s.mol);
      if (!m) { lkeys.length = 0; break; }
      lkeys.push(setKey(m.formula));
    }
    lkeys.sort();
    if (lkeys.length === inputKeys.length && lkeys.every((k, i) => k === inputKeys[i])) {
      const dr = dramaForKnownReaction(r);
      if (dr) return { drama: dr, note: '命中内容库实验，已按标准配平播放。' };
    }
  }
  void inputC;
  // 2) 单反应物分解
  if (parts.length === 1) {
    const d = deriveDecomp(parts[0]);
    if (d) return { drama: d, note: '按高中常见分解反应表匹配（产物可能需实验验证）。' };
    return { drama: null, error: '未匹配到该单反应物的分解反应，请试试双反应物输入；也可参考下方实验列表。' };
  }
  // 3) 一般推导（燃烧/置换/中和等）
  return derivePatterns(parts);
}

function buildStepsForKnown(rx: ReactionData, p: classifyInfo | null, atoms: CountMap): DramaStep[] {
  void atoms;
  if (!p || !p.kind) {
    return rx.steps.map((s, i) => {
      const mode = i === 0 ? 'reactants' : i === rx.steps.length - 1 ? 'products' : 'split';
      return { title: s.title, desc: s.desc, mode: mode as DramaStep['mode'] };
    });
  }
  const kind = p.kind;
  const rNames = rx.lhs.map((l) => moleculeById(l.mol)?.name || '').filter(Boolean);
  // 内容库按“分子式”自动建模的物种没有中文名，回退用分子式，避免步骤文案出现空白
  const nameFallback = rx.lhs.map((l) => moleculeById(l.mol)?.formula || '').filter(Boolean);
  const names = rNames.length ? rNames : nameFallback;
  const prodNames = rx.rhs.map((r) => moleculeById(r.mol)?.formula || '').join('、');
  const st = stepsOf(kind, names, rx.equation, prodNames, rx.condition, p);
  // 保留反应库原始 3 步描述的文字，若某步标题相近则融合到对应电子步骤，避免丢失细节
  if (rx.steps.length >= 3) {
    st[1].desc = rx.steps[1]?.desc || st[1].desc;
    st[3].desc = `${prodNames} · ${rx.steps[2]?.desc || st[3].desc}`;
  }
  return st;
}

type classifyInfo = {
  kind: 'metal_acid' | 'metal_o2' | 'burn_organic' | 'acid_base' | 'double_exchange' | 'other';
  metal?: string;
  val?: number;
  acidName?: string;
};

function classifyParts(formulas: string[]): classifyInfo | null {
  const parts = formulas.map((f) => inspect(f)).filter(Boolean) as CompoundPart[];
  const kinds = new Set(parts.map((p) => p?.kind));
  const get = (k: string) => parts.find((p) => p?.kind === k);
  if (kinds.has('element') && parts.some((p) => p && p.key.toLowerCase() === 'o2')) {
    const elPart = parts.find((p) => p && p.key.toLowerCase() !== 'o2');
    if (elPart && elPart.kind === 'element') {
      const sym = keysC(elPart.counts)[0];
      // H₂ 燃烧属共价断键/重新成键，非金属失电子，不套用 burn_organic/金属文案，保留内容库 3 步步骤
      if (sym === 'H') return null;
      return { kind: sym === 'C' ? 'burn_organic' : 'metal_o2', metal: sym, val: VAL[sym] || 2 };
    }
    const org = get('organic');
    if (org && org.counts.C) return { kind: 'burn_organic', metal: 'C', val: 4 };
  }
  const acid = get('acid');
  const metalEl = parts.find((p) => p && p.kind === 'element' && keysC(p.counts).some((e) => METAL_EL.has(e)));
  if (metalEl) {
    const sym = keysC(metalEl.counts)[0];
    return { kind: 'metal_acid', metal: sym, val: VAL[sym] || 2, acidName: acid?.name };
  }
  if (acid) {
    const base = get('base');
    const salt = get('salt');
    if (base) {
      return { kind: 'acid_base', metal: base.metal, val: base.cationVal, acidName: acid.name };
    }
    if (salt && salt.metal) {
      return { kind: 'double_exchange', metal: salt.metal, val: salt.cationVal };
    }
  }
  const twoSalts = parts.filter((p) => p && p.kind === 'salt' && p.metal);
  if (twoSalts.length === 2) return { kind: 'double_exchange', metal: twoSalts[0]?.metal, val: twoSalts[0]?.cationVal };
  if (acid) return { kind: 'other' };
  return null;
}

function buildIons(p: classifyInfo | null): Record<string, number> | undefined {
  if (!p) return undefined;
  if (p.kind === 'metal_acid' && p.metal) return { [p.metal]: p.val || 1 };
  if (p.kind === 'metal_o2' && p.metal) return { [p.metal]: p.val || 1 };
  if (p.kind === 'acid_base') {
    const ions: Record<string, number> = {};
    if (p.metal) ions[p.metal] = p.val || 1;
    return ions;
  }
  return undefined;
}
function buildTransfers(p: classifyInfo | null): ElectronTransfer[] | undefined {
  if (!p) return undefined;
  if (p.kind === 'metal_acid' && p.metal) return [{ a: p.metal, b: 'H', n: p.val || 1 }];
  if (p.kind === 'metal_o2' && p.metal) return [{ a: p.metal, b: 'O', n: (p.val || 1) * 2 }];
  return undefined;
}

function deriveDecomp(raw: string): ReactionDrama | null {
  const counts = parseCounts(raw);
  if (!counts) return null;
  const ascii = formulaOfCounts(counts);
  const def = findEntry(DECOMP, counts);
  if (!def) return null;
  const lhsMol = ensureMol(ascii);
  const prodMols = def.products.map((f) => ensureMol(f));
  const sol = solve([counts], prodMols.map((m) => parseCounts(m.formulaAscii || m.formula) || {}), 10);
  if (!sol) return null;
  const lhsCount = sol[0];
  const pCounts = sol.slice(1);
  const lhsSpecies = [toDramaSpecies(lhsMol, lhsCount)];
  const rhsSpecies = prodMols.map((m, i) => toDramaSpecies(m, pCounts[i]));
  const name = elementBySymbol(keysC(counts)[0])?.name || '';
  const lhsF = def.desc;
  const steps = stepsOf('decomp', [def.desc], lhsF, def.products.join('、'), def.cond, {});
  return {
    id: 'rx_decomp_' + ascii,
    name: def.desc,
    equation: equationOf(lhsSpecies, rhsSpecies),
    condition: def.cond,
    type: '分解', level: '必修 · 常见分解',
    desc: `${def.desc}：${displayFormula(ascii)} 在${def.cond}下分解。${name ? `（${name}）` : ''}`,
    lhs: lhsSpecies, rhs: rhsSpecies,
    steps,
  };
}

function derivePatterns(parts: string[]): MaybeDrama {
  // 两两尝试交换组合（用户可能不按顺序输入）
  for (const perm of [parts, [parts[1], parts[0]]]) {
    const r = deriveTwo(perm[0], perm[1]);
    if (r) return { drama: r, note: '已按守恒与常见反应模式自动推导；产物为经验推测，仅供参考，请以实验/教科书为准。' };
  }
  return {
    drama: null,
    error: '暂未能从该组合推导出可靠的常见反应产物。\n可尝试：金属+酸（Zn+HCl）、酸+碱（NaOH+HCl）、燃烧（CH4+O2、C+O2）、分解（H2O2）等，或从下方实验列表进入。',
  };
}

function neutralSalt(countsOfAnion: CountMap, anionCharge: number, metal: string, cationVal: number): CountMap | null {
  const g = gcd(cationVal, anionCharge);
  const metalCount = anionCharge / g;
  const anionRep = cationVal / g;
  const out = { [metal]: metalCount };
  Object.keys(countsOfAnion).forEach((el) => { out[el] = (out[el] || 0) + countsOfAnion[el] * anionRep; });
  return out;
}

function deriveTwo(rawA: string, rawB: string): ReactionDrama | null {
  const a = inspect(rawA);
  const b = inspect(rawB);
  if (!a || !b) return null;
  const el = (p: CompoundPart | null) => (p && p.kind === 'element' ? keysC(p.counts)[0] : null);
  const isO2 = (p: CompoundPart | null) => p?.key.toLowerCase() === 'o2';

  // —— 燃烧：X + O2 ——
  const [o2p, other] = isO2(a) ? [a, b] : isO2(b) ? [b, a] : [null, null];
  if (o2p && other) {
    const sym = el(other);
    // 低价氧化物被 O₂ 继续氧化：CO→CO₂、NO→NO₂、SO₂→SO₃
    const upOx = OXIDE_UPGRADE.find((u) => sameCounts(parseCounts(u.from) || {}, other.counts));
    if (upOx) {
      const upC = upOx.prods.map((f) => ({ f, c: parseCounts(f) || {} }));
      const sol = solve([other.counts, parseCounts('O2') || {}], upC.map((p) => p.c), 10);
      if (!sol) return null;
      const lhsSp = [
        toDramaSpecies(ensureMol(formulaOfCounts(other.counts)), sol[0]),
        toDramaSpecies(ensureMol('O2'), sol[1]),
      ];
      const rhsSp = upC.map((p, i) => toDramaSpecies(ensureMol(p.f), sol[2 + i]));
      const eq = equationOf(lhsSp, rhsSp);
      const steps = stepsOf('other', [upOx.name, 'O₂'], eq, upOx.prods.map((f) => displayFormula(f)).join('、'), upOx.cond, {});
      return {
        id: 'rx_up_' + upOx.from.toLowerCase(),
        name: upOx.name + '的继续氧化',
        equation: eq,
        condition: upOx.cond,
        type: '氧化（化合）',
        level: '必修',
        desc: upOx.desc,
        lhs: lhsSp, rhs: rhsSp,
        steps,
      };
    }
    if (other.kind === 'organic' && other.counts.C) {
      const prods = [{ f: 'CO2', c: parseCounts('CO2') || {} }, { f: 'H2O', c: parseCounts('H2O') || {} }];
      const lhsC = [other.counts, parseCounts('O2') || {}];
      const sol = solve(lhsC, prods.map((p) => p.c), 10);
      if (!sol) return null;
      const co = Math.ceil(Math.max(...sol) / 4);
      const sc = (v: number) => Math.max(1, Math.round(v / Math.max(1, co)));
      const lhsSp = [
        toDramaSpecies(other.mol ? ensureMol(other.mol.formulaAscii || other.mol.formula) : ensureMol(formulaOfCounts(other.counts)), sc(sol[0])),
        toDramaSpecies(ensureMol('O2'), sc(sol[1])),
      ];
      const rhsSp = [toDramaSpecies(ensureMol('CO2'), sc(sol[2])), toDramaSpecies(ensureMol('H2O'), sc(sol[3]))];
      const eq = `${sc(sol[0]) === 1 ? '' : sc(sol[0])}${other.name || formulaOfCounts(other.counts)} + ${sc(sol[1]) === 1 ? '' : sc(sol[1])}O2 → ${sc(sol[2]) === 1 ? '' : sc(sol[2])}CO2 + ${sc(sol[3]) === 1 ? '' : sc(sol[3])}H2O`;
      const steps = stepsOf('burn_organic', [other.name || formulaOfCounts(other.counts), 'O₂'], eq, 'CO₂ + H₂O', '点燃', { metal: 'C', val: 4 });
      return {
        id: 'rx_burn_' + formulaOfCounts(other.counts),
        name: (other.name || '有机物') + ' 的燃烧',
        equation: eq,
        condition: '点燃', type: '氧化反应（燃烧）', level: '必修',
        desc: `${other.name || '有机物'}完全燃烧生成二氧化碳和水（前提：氧气充足）。`,
        lhs: lhsSp, rhs: rhsSp, steps,
      };
    }
    // 单质 + O2
    if (other.kind === 'element' && sym && (METAL_EL.has(sym) || sym === 'C' || sym === 'S' || sym === 'P' || sym === 'H')) {
      const oxide = OXIDE_OF[sym];
      if (!oxide) return null;
      const oc = parseCounts(oxide);
      if (!oc) return null;
      const sol = solve([other.counts, parseCounts('O2') || {}], [oc], 10);
      if (!sol) return null;
      const maxC = Math.max(...sol);
      const co = Math.ceil(maxC / 4);
      const sc = (v: number) => Math.max(1, Math.round(v / co));
      const name = elementBySymbol(sym)?.name || sym;
      const ions: Record<string, number> = {};
      if (METAL_EL.has(sym)) ions[sym] = VAL[sym] || 2;
      const steps = stepsOf('metal_o2', [name + '单质', 'O₂'], '', oxide, '点燃', { metal: sym, val: VAL[sym] || 2 });
      const lhsSp = [
        toDramaSpecies(ensureMol(formulaOfCounts(other.counts)), sc(sol[0])),
        toDramaSpecies(ensureMol('O2'), sc(sol[1])),
      ];
      const rhsSp = [toDramaSpecies(ensureMol(oxide), sc(sol[2]))];
      return {
        id: 'rx_oxid_' + sym,
        name: name + '与氧气化合',
        equation: equationOf(lhsSp, rhsSp),
        condition: '点燃/加热', type: '化合（氧化）', level: '必修',
        desc: `${name}在氧气中燃烧生成氧化物（${oxide}）。`,
        lhs: lhsSp, rhs: rhsSp,
        steps, ions,
      };
    }
    return null;
  }

  // —— 活泼金属 + 水 → 碱 + H2 ——（Na/K/Li 等冷水即剧烈反应）
  const elA = el(a), elB = el(b);
  const ACTIVE_WATER = new Set(['Li', 'Na', 'K']);
  const isWater = (p: CompoundPart | null) => !!p && p.kind === 'other' && sameCounts(p.counts, { H: 2, O: 1 });
  const alkP = (a.kind === 'element' && elA && ACTIVE_WATER.has(elA)) ? a : (b.kind === 'element' && elB && ACTIVE_WATER.has(elB)) ? b : null;
  const waterP = isWater(a) ? a : isWater(b) ? b : null;
  if (alkP && waterP && alkP !== waterP) {
    const sym = keysC(alkP.counts)[0];
    const name = elementBySymbol(sym)?.name || sym;
    const sol = solve([alkP.counts, { H: 2, O: 1 }], [{ [sym]: 1, H: 1, O: 1 }, { H: 2 }], 10);
    if (sol) {
      const sc = (v: number) => Math.max(1, v);
      const lhsSp = [
        toDramaSpecies(ensureMol(sym), sc(sol[0])),
        toDramaSpecies(ensureMol('H2O'), sc(sol[1])),
      ];
      const rhsSp = [
        toDramaSpecies(ensureMol(formulaOfCounts({ [sym]: 1, H: 1, O: 1 })), sc(sol[2])),
        toDramaSpecies(ensureMol('H2'), sc(sol[3])),
      ];
      const steps = stepsOf('metal_acid', [name + '单质', '水'], '', `${rhsSp[0].mol.formula} + H₂`, '', { metal: sym, val: 1 });
      return {
        id: 'rx_metal_water_' + sym,
        name: name + '与水的反应',
        equation: equationOf(lhsSp, rhsSp),
        condition: '常温', type: '置换反应', level: '必修',
        desc: `${name}非常活泼，与水剧烈反应：原子失电子成 ${sym}⁺，水中 H⁺ 得电子成 H₂，OH⁻ 与阳离子结合成碱。`,
        lhs: lhsSp, rhs: rhsSp,
        steps,
        ions: { [sym]: 1 },
        transfers: [{ a: sym, b: 'H', n: 1 }],
      };
    }
  }

  // —— 非金属氧化物（含 NO₂ 歧化）+ 水 → 含氧酸 ——（3NO₂ + H₂O → 2HNO₃ + NO）
  const wtrP = isWater(a) ? a : isWater(b) ? b : null;
  const oxideP = wtrP ? (wtrP === a ? b : a) : null;
  const hydOx = oxideP ? OXIDE_WATER.find((h) => sameCounts(parseCounts(h.oxide) || {}, oxideP.counts)) : null;
  if (wtrP && oxideP && hydOx) {
    const h2oC = parseCounts('H2O') || {};
    const prods = hydOx.prods.map((f) => ({ f, c: parseCounts(f) || {} }));
    const sol = solve([oxideP.counts, h2oC], prods.map((p) => p.c), 12);
    if (sol) {
      const makeM = (f: string, nm?: string): MoleculeData => {
        const base = ensureMol(f);
        const merged: MoleculeData = { ...base, formula: displayFormula(f), formulaAscii: f };
        if (nm) merged.name = nm;
        return merged;
      };
      const lhsSp = [
        toDramaSpecies(makeM(hydOx.oxide, hydOx.oxideName), sol[0]),
        toDramaSpecies(makeM('H2O', '水'), sol[1]),
      ];
      const rhsSp = prods.map((p, i) => toDramaSpecies(makeM(p.f, PROD_CN[p.f]), sol[2 + i]));
      const eq = equationOf(lhsSp, rhsSp);
      const prodTxt = rhsSp.map((s) => s.mol.formula).join('、');
      const steps: DramaStep[] = hydOx.dispro
        ? [
            { title: '写反应物', desc: `${eq} · 红棕色的${hydOx.oxideName}溶于水。`, mode: 'reactants' },
            { title: '断键 · 拆解', desc: `${hydOx.oxideName}与水接触后，N–O 键和水的 O–H 键断裂，分子结构瓦解。`, mode: 'split' },
            { title: '电子得失与转移', desc: 'NO₂ 中氮为 +4 价，在水中发生自身氧化还原（歧化）：一部分 N 失去电子升为 +5（NO₃⁻），另一部分 N 得到电子降为 +2（NO）。', mode: 'transfer' },
            { title: '重新成键 · 生成物', desc: `${prodTxt} · H⁺ 与 NO₃⁻ 结合成硝酸，NO 以气体形式逸出。`, mode: 'products' },
          ]
        : [
            { title: '写反应物', desc: `${eq} · ${hydOx.oxideName}溶于水。`, mode: 'reactants' },
            { title: '断键 · 拆解', desc: `${hydOx.oxideName}与水接触，氧化物骨架和水的 O–H 键断裂，中心原子与氧/氢碎片重新接近。`, mode: 'split' },
            { title: '电子得失与转移', desc: '该化合过程无电子得失：非金属元素化合价不变，氧以孤对电子与 H⁺ 配位，构成含氧酸根。', mode: 'transfer' },
            { title: '重新成键 · 生成物', desc: `${prodTxt} · 中心原子与 –OH 键合生成酸分子（酸性氧化物 + 水 → 含氧酸）。`, mode: 'products' },
          ];
      return {
        id: 'rx_water_' + hydOx.oxide.toLowerCase(),
        name: hydOx.oxideName + '与水的反应',
        equation: eq,
        condition: '',
        type: hydOx.dispro ? '氧化还原（歧化）' : '化合反应',
        level: '必修',
        desc: hydOx.dispro
          ? 'NO₂ 中 N 为 +4 价，溶于水自身歧化（一部分升为 +5 生成硝酸、另一部分降为 +2 生成 NO）：3NO₂ + H₂O → 2HNO₃ + NO。'
          : `${hydOx.oxideName}与水化合生成${prodTxt}。`,
        lhs: lhsSp, rhs: rhsSp,
        steps,
      };
    }
  }

  // —— 金属 + 酸 → 盐 + H2 ——
  const metalP = (a.kind === 'element' && elA && METAL_EL.has(elA)) ? a : (b.kind === 'element' && elB && METAL_EL.has(elB)) ? b : null;
  const acidP = a.kind === 'acid' ? a : b.kind === 'acid' ? b : null;
  if (metalP && acidP && acidP.anionCounts && acidP.anionCharge != null) {
    const sym = keysC(metalP.counts)[0];
    const val = VAL[sym] || 2;
    const saltC = neutralSalt(acidP.anionCounts, acidP.anionCharge, sym, val);
    const h2c = parseCounts('H2');
    if (!saltC || !h2c) return null;
    const sol = solve([metalP.counts, acidP.counts], [saltC, h2c], 10);
    if (!sol) return null;
    const sc = (v: number) => Math.max(1, v);
    const metalName = elementBySymbol(sym)?.name || sym;
    const saltF = formulaOfCounts(saltC);
    const saltMol = ensureMol(saltF);
    const lhsSp = [
      toDramaSpecies(ensureMol(formulaOfCounts(metalP.counts)), sc(sol[0])),
      toDramaSpecies(ensureMol(formulaOfCounts(acidP.counts)), sc(sol[1])),
    ];
    const h2Sp = toDramaSpecies(ensureMol('H2'), sc(sol[3]));
    const rhsSp = [toDramaSpecies(saltMol, sc(sol[2])), h2Sp];
    const steps = stepsOf('metal_acid', [metalName, acidP.name || '酸'], '', `${saltMol.formula} + ${h2Sp.mol.formula}`, '', { metal: sym, val, acidName: acidP.name });
    return {
      id: 'rx_salt_h2_' + formulaOfCounts(saltC),
      name: metalName + '与' + (acidP.name || '酸') + '的置换',
      equation: equationOf(lhsSp, rhsSp),
      condition: '', type: '置换反应', level: '必修',
      desc: `较活泼金属把酸中氢置换出来，自身失电子成阳离子（${sym}${sup(val)}+），H⁺ 得电子成 H₂。`,
      lhs: lhsSp, rhs: rhsSp,
      steps,
      ions: { [sym]: val },
      transfers: [{ a: sym, b: 'H', n: val }],
    };
  }

  // —— 酸 + 碱 → 盐 + H2O ——
  const baseP = a.kind === 'base' ? a : b.kind === 'base' ? b : null;
  if (acidP && baseP && baseP.metal && acidP.anionCounts && acidP.anionCharge != null) {
    const saltC = neutralSalt(acidP.anionCounts, acidP.anionCharge, baseP.metal, baseP.cationVal || 1);
    const h2oc = parseCounts('H2O');
    if (!saltC || !h2oc) return null;
    const sol = solve([acidP.counts, baseP.counts], [saltC, h2oc], 10);
    if (!sol) return null;
    const saltF = formulaOfCounts(saltC);
    const saltMol = ensureMol(saltF);
    const baseName = baseP.name || `${elementBySymbol(baseP.metal)?.name}的氢氧化物`;
    const acidName = acidP.name || '酸';
    const lhsSp = [
      toDramaSpecies(acidP.mol || ensureMol(formulaOfCounts(acidP.counts)), sol[0]),
      toDramaSpecies(baseP.mol || ensureMol(formulaOfCounts(baseP.counts)), sol[1]),
    ];
    const rhsSp = [
      toDramaSpecies(saltMol, sol[2]),
      toDramaSpecies(ensureMol('H2O'), sol[3]),
    ];
    const steps = stepsOf('acid_base', [acidName, baseName], '', `${saltMol.formula} + ${rhsSp[1].mol.formula}`, '', { metal: baseP.metal, val: baseP.cationVal, acidName });
    const ions: Record<string, number> = { [baseP.metal]: baseP.cationVal || 1 };
    const an = acidP.anion?.split(' ')[0];
    const anEls = keysC(acidP.anionCounts || {});
    const catEls = anEls.filter((e) => e !== 'H' && e !== 'O' && e !== 'C' && e !== 'N' && e !== 'P' && e !== 'S' && e !== 'Cl');
    catEls.forEach((e) => { ions[e] = VAL[e] || 1; });
    void an;
    return {
      id: 'rx_neutral_' + formulaOfCounts(saltC),
      name: acidName + '与' + baseName + '中和',
      equation: equationOf(lhsSp, rhsSp),
      condition: '', type: '复分解（中和）', level: '必修',
      desc: '酸碱中和：H⁺ + OH⁻ → H₂O（只交换离子、不转移电子），另生成盐。',
      lhs: lhsSp, rhs: rhsSp,
      steps, ions,
    };
  }

  // —— 盐 + 酸（碳酸盐放出 CO₂） ——
  const saltP = (a.kind === 'salt' && a.metal && acidP) ? a : (b.kind === 'salt' && b.metal && acidP) ? b : null;
  if (acidP && saltP && acidP.anionCounts != null && acidP.anionCharge != null && saltP.anionCharge != null && saltP.anionCounts) {
    const cCo3 = !!saltP.anionCounts.C;
    const saltC = neutralSalt(acidP.anionCounts, acidP.anionCharge, saltP.metal as string, saltP.cationVal || 1);
    if (!saltC) return null;
    let prods: { f: string; c: CountMap }[] = [];
    if (cCo3) prods = [
      { f: formulaOfCounts(saltC), c: saltC },
      { f: 'CO2', c: parseCounts('CO2') || {} },
      { f: 'H2O', c: parseCounts('H2O') || {} },
    ];
    else prods = [
      { f: formulaOfCounts(saltC), c: saltC },
      { f: formulaOfCounts(addC(saltP.anionCounts, { H: 1 })), c: addC(saltP.anionCounts, { H: 1 }) },
    ];
    const sol = solve([saltP.counts, acidP.counts], prods.map((p) => p.c), 10);
    if (!sol) return null;
    const saltName = saltP.name || '盐';
    const pMol = prods.map((p) => ensureMol(p.f));
    const sc = (v: number) => Math.max(1, v);
    const lhsSp = [
      toDramaSpecies(saltP.mol || ensureMol(formulaOfCounts(saltP.counts)), sc(sol[0])),
      toDramaSpecies(acidP.mol || ensureMol(formulaOfCounts(acidP.counts)), sc(sol[1])),
    ];
    const rhsSp = pMol.map((m, i) => toDramaSpecies(m, sc(sol[2 + i])));
    const names = pMol.map((m) => m.formula).join('、');
    const steps = stepsOf(cCo3 ? 'double_exchange' : 'other', [saltName, acidP.name || '酸'], '', names, '', {});
    return {
      id: 'rx_saltacid_' + formulaOfCounts(prods[0].c),
      name: saltName + '与' + (acidP.name || '酸') + '反应',
      equation: equationOf(lhsSp, rhsSp),
      condition: '', type: '复分解', level: '必修',
      desc: cCo3 ? '碳酸盐遇较强酸生成碳酸（H₂CO₃），立即分解为 CO₂↑ 和 H₂O。' : '盐与酸发生复分解，离子交换组合。',
      lhs: lhsSp, rhs: rhsSp,
      steps,
    };
  }

  // —— 盐 + 盐 复分解 ——
  const saltA = a.kind === 'salt' && a.metal ? a : null;
  const saltB = b.kind === 'salt' && b.metal ? b : null;
  if (saltA && saltB && saltA !== saltB) {
    const p1 = neutralSalt(saltB.anionCounts as CountMap, saltB.anionCharge as number, saltA.metal as string, saltA.cationVal || 1);
    const p2 = neutralSalt(saltA.anionCounts as CountMap, saltA.anionCharge as number, saltB.metal as string, saltB.cationVal || 1);
    if (p1 && p2) {
      const prods = [{ f: formulaOfCounts(p1), c: p1 }, { f: formulaOfCounts(p2), c: p2 }];
      const sol = solve([saltA.counts, saltB.counts], prods.map((p) => p.c), 10);
      if (sol) {
        const pMols = prods.map((p) => ensureMol(p.f));
        const names = pMols.map((m) => m.formula).join('、');
        const lhsSp = [
          toDramaSpecies(ensureMol(formulaOfCounts(saltA.counts)), sol[0]),
          toDramaSpecies(ensureMol(formulaOfCounts(saltB.counts)), sol[1]),
        ];
        const rhsSp = pMols.map((m, i) => toDramaSpecies(m, sol[2 + i]));
        const steps = stepsOf('double_exchange', [saltA.name || '盐', saltB.name || '盐'], '', names, '', {});
        return {
          id: 'rx_double_' + formulaOfCounts(p1),
          name: '盐与盐的复分解',
          equation: equationOf(lhsSp, rhsSp),
          condition: '', type: '复分解', level: '必修',
          desc: '两盐溶液交换阳离子/阴离子，是否发生以生成沉淀/水/气体为准（此处仅做离子交换示意）。',
          lhs: lhsSp, rhs: rhsSp,
          steps,
        };
      }
    }
    return null;
  }
  return null;
}

/** 内容库反应名与 eq（reactions list 使用） */
export function reactionDramaKey(rx: ReactionData): string {
  return rx.id;
}
export function reactionName(rx: ReactionData): string {
  return rx.name;
}
