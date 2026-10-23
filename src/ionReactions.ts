// 离子方程式推导模块 —— 与 reactionEngine 的「分子式推导」并列的一条独立路径
//
// 为什么独立：
//  1. 分子式那条路的中间表示 CountMap 只有「元素→个数」，没有电荷，
//     而离子方程式要求**原子守恒 + 电荷守恒**同时成立，沿用会污染公共底层。
//  2. 这里氧化还原由「半反应 + 电子守恒」推出而不是查整表，能自然地表达介质的影响：
//     同一个 MnO₄⁻，酸性得 5e⁻→Mn²⁺、中性得 3e⁻→MnO₂、碱性得 1e⁻→MnO₄²⁻。
//  3. content.json 里一条自由离子都没有，它们的 3D 几何必须在这一层补，
//     否则会落到 ensureMol 的辐条兜底（MnO₄⁻ 被画成一个「海胆」）。
//
// 走不走这条路由 ReactionsScreen 的「离子方程式」勾选框决定。

import { elementBySymbol } from './data';
import {
  buildMoleculeForFormula,
  displayFormula,
  displaySpecies,
  formulaOfCounts,
  parseCounts,
  splitCharge,
} from './formulaBuilder';
import type { CountMap } from './formulaBuilder';
import type {
  Bond,
  DramaStep,
  ElectronTransfer,
  MolAtom,
  MoleculeData,
  ReactionDrama,
  ReactionDramaSpecies,
  ReactionEnv,
} from './types';

/* ============================================================
 * 一、基本类型
 * ========================================================== */

/** 带净电荷的物种 */
export interface IonSp {
  counts: CountMap;
  charge: number;
}

export function sp(counts: CountMap, charge: number): IonSp {
  return { counts, charge };
}

/** 归一化身份：`MnO4|-1` —— 用来判断两个输入是不是同一种东西 */
export function spKey(s: IonSp): string {
  return `${formulaOfCounts(s.counts).toLowerCase()}|${s.charge}`;
}

/** 一个已解析出来的输入物种 */
export interface IonInput {
  kind: 'ion' | 'neutral';
  counts: CountMap;
  charge: number;
  key: string;
  /** 展示式（含电荷上标），如 MnO₄⁻ */
  label: string;
  /** 中文名，如 高锰酸根 */
  name?: string;
}

function sameCounts(a: CountMap, b: CountMap): boolean {
  const ka = Object.keys(a).filter((k) => a[k]);
  const kb = Object.keys(b).filter((k) => b[k]);
  if (ka.length !== kb.length) return false;
  return ka.every((k) => a[k] === (b[k] || 0));
}

/* ============================================================
 * 二、常用物种常量
 * 统一在这里定义，key 一律用 spKey 算出来，避免手写字符串与元素排序对不上
 * （formulaOfCounts 会重排元素，SO₃²⁻ 的实际标准式是 O3S 而不是 SO3）
 * ========================================================== */

export const SP = {
  H: sp({ H: 1 }, 1),
  OH: sp({ O: 1, H: 1 }, -1),
  H2O: sp({ H: 2, O: 1 }, 0),
  H2: sp({ H: 2 }, 0),
  O2: sp({ O: 2 }, 0),
  Cl2: sp({ Cl: 2 }, 0),
  NO2: sp({ N: 1, O: 2 }, 0),
  Cl: sp({ Cl: 1 }, -1),
  ClO: sp({ Cl: 1, O: 1 }, -1),
  NO3: sp({ N: 1, O: 3 }, -1),
  NO2m: sp({ N: 1, O: 2 }, -1),
  SO4: sp({ S: 1, O: 4 }, -2),
  SO3: sp({ S: 1, O: 3 }, -2),
  CO3: sp({ C: 1, O: 3 }, -2),
  MnO4: sp({ Mn: 1, O: 4 }, -1),
  MnO4_2: sp({ Mn: 1, O: 4 }, -2),
  MnO2: sp({ Mn: 1, O: 2 }, 0),
  Cr2O7: sp({ Cr: 2, O: 7 }, -2),
  AlO2: sp({ Al: 1, O: 2 }, -1),
  S2: sp({ S: 1 }, -2),
  I: sp({ I: 1 }, -1),
  I2: sp({ I: 2 }, 0),
  NH4: sp({ N: 1, H: 4 }, 1),
  C2O4: sp({ C: 2, O: 4 }, -2),
  CO2: sp({ C: 1, O: 2 }, 0),
  H2O2: sp({ H: 2, O: 2 }, 0),
  Al_metal: sp({ Al: 1 }, 0),
  Al3: sp({ Al: 1 }, 3),
  Fe2: sp({ Fe: 1 }, 2),
  Fe3: sp({ Fe: 1 }, 3),
  Mn2: sp({ Mn: 1 }, 2),
} as const;

/* ============================================================
 * 三、离子库：高中常见的阳离子 / 阴离子
 * 同时充当三件事的单一数据源：
 *   - 解析时的消歧义依据（`SO42-` 里的 2 到底是电荷还是下标，靠这里裁定）
 *   - 展示用的中文名
 *   - 3D 几何形状
 * ========================================================== */

type IonGeom =
  | 'single'        // 单原子：Na⁺、Cl⁻、Fe²⁺
  | 'diatomic'      // 双原子：OH⁻、ClO⁻
  | 'linear3'       // 直线三原子：SCN⁻
  | 'trigonal'      // 平面三角：NO₃⁻、CO₃²⁻
  | 'pyramidal'     // 三角锥：SO₃²⁻、ClO₃⁻
  | 'tetrahedral'   // 正四面体：SO₄²⁻、MnO₄⁻、NH₄⁺
  | 'dichromate'    // Cr₂O₇²⁻：两个四面体共用桥氧
  | 'hydroxide';    // M(OH)n：金属在中心，n 个 OH 朝多面体顶点伸

interface IonDef {
  name: string;
  counts: CountMap;
  charge: number;
  geom: IonGeom;
  /** 溶液 / 沉淀颜色（可选） */
  color?: string;
}

const ION_DB: IonDef[] = [
  /* 单原子阳离子 */
  { name: '氢离子', counts: SP.H.counts, charge: 1, geom: 'single' },
  { name: '锂离子', counts: { Li: 1 }, charge: 1, geom: 'single' },
  { name: '钠离子', counts: { Na: 1 }, charge: 1, geom: 'single' },
  { name: '钾离子', counts: { K: 1 }, charge: 1, geom: 'single' },
  { name: '银离子', counts: { Ag: 1 }, charge: 1, geom: 'single' },
  { name: '钡离子', counts: { Ba: 1 }, charge: 2, geom: 'single' },
  { name: '钙离子', counts: { Ca: 1 }, charge: 2, geom: 'single' },
  { name: '镁离子', counts: { Mg: 1 }, charge: 2, geom: 'single' },
  { name: '锌离子', counts: { Zn: 1 }, charge: 2, geom: 'single' },
  { name: '铜离子', counts: { Cu: 1 }, charge: 2, geom: 'single', color: '蓝' },
  { name: '亚铁离子', counts: { Fe: 1 }, charge: 2, geom: 'single', color: '浅绿' },
  { name: '锰离子', counts: { Mn: 1 }, charge: 2, geom: 'single', color: '近无色' },
  { name: '铅离子', counts: { Pb: 1 }, charge: 2, geom: 'single' },
  { name: '铝离子', counts: { Al: 1 }, charge: 3, geom: 'single' },
  { name: '铁离子', counts: { Fe: 1 }, charge: 3, geom: 'single', color: '黄' },

  /* 多原子阳离子 */
  { name: '铵根', counts: SP.NH4.counts, charge: 1, geom: 'tetrahedral' },

  /* 单原子阴离子 */
  { name: '氟离子', counts: { F: 1 }, charge: -1, geom: 'single' },
  { name: '氯离子', counts: { Cl: 1 }, charge: -1, geom: 'single' },
  { name: '溴离子', counts: { Br: 1 }, charge: -1, geom: 'single' },
  { name: '碘离子', counts: { I: 1 }, charge: -1, geom: 'single' },
  { name: '硫离子', counts: { S: 1 }, charge: -2, geom: 'single' },
  { name: '氧离子', counts: { O: 1 }, charge: -2, geom: 'single' },

  /* 多原子阴离子 */
  { name: '氢氧根', counts: SP.OH.counts, charge: -1, geom: 'diatomic' },
  { name: '硝酸根', counts: SP.NO3.counts, charge: -1, geom: 'trigonal' },
  { name: '亚硝酸根', counts: SP.NO2m.counts, charge: -1, geom: 'pyramidal' },
  { name: '硫酸根', counts: SP.SO4.counts, charge: -2, geom: 'tetrahedral' },
  { name: '亚硫酸根', counts: SP.SO3.counts, charge: -2, geom: 'pyramidal' },
  { name: '碳酸根', counts: SP.CO3.counts, charge: -2, geom: 'trigonal' },
  { name: '碳酸氢根', counts: { H: 1, C: 1, O: 3 }, charge: -1, geom: 'trigonal' },
  { name: '磷酸根', counts: { P: 1, O: 4 }, charge: -3, geom: 'tetrahedral' },
  { name: '高锰酸根', counts: SP.MnO4.counts, charge: -1, geom: 'tetrahedral', color: '紫红' },
  { name: '锰酸根', counts: SP.MnO4_2.counts, charge: -2, geom: 'tetrahedral', color: '墨绿' },
  { name: '铬酸根', counts: { Cr: 1, O: 4 }, charge: -2, geom: 'tetrahedral', color: '黄' },
  { name: '重铬酸根', counts: SP.Cr2O7.counts, charge: -2, geom: 'dichromate', color: '橙' },
  { name: '次氯酸根', counts: SP.ClO.counts, charge: -1, geom: 'diatomic' },
  { name: '氯酸根', counts: { Cl: 1, O: 3 }, charge: -1, geom: 'pyramidal' },
  { name: '偏铝酸根', counts: SP.AlO2.counts, charge: -1, geom: 'linear3' },
  { name: '硫氰根', counts: { S: 1, C: 1, N: 1 }, charge: -1, geom: 'linear3' },
  { name: '醋酸根', counts: { C: 2, H: 3, O: 2 }, charge: -1, geom: 'linear3' },
  { name: '草酸根', counts: SP.C2O4.counts, charge: -2, geom: 'linear3' },
];

export function findIon(counts: CountMap, charge: number): IonDef | undefined {
  return ION_DB.find((d) => d.charge === charge && sameCounts(d.counts, counts));
}

/* ============================================================
 * 四、输入解析
 *   把 MnO4- / MnO4^- / MnO₄⁻ / MnO4  / Fe3+ / Fe³⁺ / SO4 2- / SO42- / SO₄²⁻
 *   都读到同一个 IonInput 上。
 * ========================================================== */

/**
 * 难点：`SO42-`（2 是电荷数）与 `MnO4-`（4 是下标）去掉符号后**从写法上看不出区别**。
 * 所以先让 formulaBuilder 给出两个候选，再用 ION_DB 裁定谁能对上号：
 *   候选① 末尾一位数字当电荷数  → SO4 / -2
 *   候选② 末尾数字全是下标、电荷为 1 → MnO4 / -1
 * 「在离子库里查得到」的那个就是答案；都查不到时退化为第一个能算出合法原子组成的候选。
 */
export function parseIonPart(raw: string): IonInput | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const charged = splitCharge(trimmed);
  if (!charged) {
    const counts = parseCounts(trimmed);
    if (!counts) return null;
    return {
      kind: 'neutral',
      counts,
      charge: 0,
      key: spKey({ counts, charge: 0 }),
      label: neutralLabel(counts),
    };
  }

  let fallback: IonInput | null = null;
  let libraryHit: IonInput | null = null;
  for (const cand of charged.cands) {
    const counts = parseCounts(cand.body);
    if (!counts) continue;
    const charge = charged.sign * cand.n;
    const ion = findIon(counts, charge);
    const made: IonInput = {
      kind: 'ion',
      counts,
      charge,
      key: spKey({ counts, charge }),
      label: displaySpecies(formulaOfCounts(counts), charge),
      name: ion?.name,
    };
    if (ion && !libraryHit) libraryHit = made;
    if (!fallback) fallback = made;
  }
  return libraryHit ?? fallback;
}

/** UI 实时校验用：这段输入能不能被读懂 */
export function canParseIon(raw: string): boolean {
  return parseIonPart(raw) !== null;
}

/** 中性物种的展示式：优先写成人习惯的顺序（OH、SO4），没有对应习惯时才用算出来的标准式 */
function neutralLabel(counts: CountMap): string {
  const keys = Object.keys(counts).filter((k) => counts[k]);
  if (keys.length === 1) {
    const el = keys[0];
    return counts[el] > 1 ? displayFormula(`${el}${counts[el]}`) : el;   // Cl2 → Cl₂
  }
  const habit = habitOf(counts);
  // 习惯式里可能带数字（H2O、Fe(OH)3），要过一遍下标渲染，别原样输出
  return habit ? displayFormula(habit) : stdFormula(counts);
}

/** 常见阴离子/中性小分子的习惯写法，避免显示成 O4S、HO 这种机器顺序 */
const HABIT: { txt: string; c: Record<string, number> }[] = [
  { txt: 'OH', c: { O: 1, H: 1 } },
  { txt: 'H2O', c: { H: 2, O: 1 } },
  { txt: 'SO4', c: { S: 1, O: 4 } },
  { txt: 'SO3', c: { S: 1, O: 3 } },
  { txt: 'CO3', c: { C: 1, O: 3 } },
  { txt: 'NO3', c: { N: 1, O: 3 } },
  { txt: 'MnO4', c: { Mn: 1, O: 4 } },
  { txt: 'MnO2', c: { Mn: 1, O: 2 } },
  { txt: 'Cr2O7', c: { Cr: 2, O: 7 } },
  { txt: 'AlO2', c: { Al: 1, O: 2 } },
  { txt: 'NH4', c: { N: 1, H: 4 } },
  { txt: 'SCN', c: { S: 1, C: 1, N: 1 } },
  /* 沉淀产物：它们的中性式如果按 machine 排序会写成 BaO₄S、CCaO₃ 这种谁也认不出的样子 */
  { txt: 'AgCl', c: { Ag: 1, Cl: 1 } },
  { txt: 'AgBr', c: { Ag: 1, Br: 1 } },
  { txt: 'AgI', c: { Ag: 1, I: 1 } },
  { txt: 'Ag2SO4', c: { Ag: 2, S: 1, O: 4 } },
  { txt: 'BaSO4', c: { Ba: 1, S: 1, O: 4 } },
  { txt: 'BaSO3', c: { Ba: 1, S: 1, O: 3 } },
  { txt: 'CaSO4', c: { Ca: 1, S: 1, O: 4 } },
  { txt: 'PbSO4', c: { Pb: 1, S: 1, O: 4 } },
  { txt: 'PbI2', c: { Pb: 1, I: 2 } },
  { txt: 'CuS', c: { Cu: 1, S: 1 } },
  { txt: 'FeS', c: { Fe: 1, S: 1 } },
  { txt: 'ZnS', c: { Zn: 1, S: 1 } },
  { txt: 'Ag2CO3', c: { Ag: 2, C: 1, O: 3 } },
  { txt: 'BaCO3', c: { Ba: 1, C: 1, O: 3 } },
  { txt: 'CaCO3', c: { Ca: 1, C: 1, O: 3 } },
  { txt: 'MgCO3', c: { Mg: 1, C: 1, O: 3 } },
  { txt: 'Al(OH)3', c: { Al: 1, O: 3, H: 3 } },
  { txt: 'Cu(OH)2', c: { Cu: 1, O: 2, H: 2 } },
  { txt: 'Fe(OH)2', c: { Fe: 1, O: 2, H: 2 } },
  { txt: 'Fe(OH)3', c: { Fe: 1, O: 3, H: 3 } },
  { txt: 'Mg(OH)2', c: { Mg: 1, O: 2, H: 2 } },
  { txt: 'Zn(OH)2', c: { Zn: 1, O: 2, H: 2 } },
];

function habitOf(counts: CountMap): string | null {
  const hit = HABIT.find((h) => sameCounts(h.c, counts));
  return hit?.txt ?? null;
}

function stdFormula(counts: CountMap): string {
  return displaySpecies(formulaOfCounts(counts), 0);
}

interface MultiInfo {
  base: CountMap;      // 单个离子的原子组成
  baseCharge: number;  // 单个离子的电荷
  mul: number;         // 一共几个
}

/**
 * 识别「几个相同离子」：{I:2} 带 -2 电荷其实就是 2 个 I⁻。
 * 只在原子数与电荷都能被同一个整数整除、且除得出来的确实是已知离子时才成立
 * （H₂、O₂ 这种中性分子不会被误伤）。
 */
function extractMulti(counts: CountMap, charge: number): MultiInfo | null {
  if (!charge) return null;
  const els = Object.keys(counts).filter((k) => (counts[k] || 0) > 0);
  if (!els.length) return null;
  let g = Math.abs(charge);
  els.forEach((e) => { g = gcd(g, counts[e] || 0); });
  if (g <= 1 || !Number.isFinite(g)) return null;
  const base: CountMap = {};
  els.forEach((e) => { base[e] = (counts[e] || 0) / g; });
  const baseCharge = charge / g;
  if (!findIon(base, baseCharge)) return null;
  return { base, baseCharge, mul: g };
}

/* ============================================================
 * 五、3D 几何 —— 离子在 content.json 里一条都没有，必须自己造
 * ========================================================== */

/** ElementData.radius 是 0.28~1.1 的相对值（不是 pm），乘系数换算成键长 */
const BOND_K = 1.35;
const METALS = new Set(['Li', 'Na', 'K', 'Mg', 'Ca', 'Ba', 'Al', 'Zn', 'Fe', 'Cu', 'Ag', 'Mn', 'Pb', 'Cr']);

function radiusOf(el: string): number {
  return elementBySymbol(el)?.radius ?? 0.5;
}

function bondLen(a: string, b: string): number {
  return Math.max(0.95, Math.min(1.85, (radiusOf(a) + radiusOf(b)) * BOND_K));
}

function unit(v: [number, number, number]): [number, number, number] {
  const m = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / m, v[1] / m, v[2] / m];
}

function scaled(v: [number, number, number], len: number): [number, number, number] {
  const u = unit(v);
  return [u[0] * len, u[1] * len, u[2] * len];
}

/** 正四面体的四个方向 */
const TETRA: [number, number, number][] = [
  [1, 1, 1],
  [-1, -1, 1],
  [-1, 1, -1],
  [1, -1, -1],
];
/** 八面体的六个方向（六配位氢氧化物用） */
const OCTA: [number, number, number][] = [
  [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1],
];

interface Geom {
  atoms: MolAtom[];
  bonds: Bond[];
}

function countsKey(counts: CountMap): string {
  return formulaOfCounts(counts).toLowerCase();
}

/**
 * 直线形/双原子离子**画的时候**谁在中间、两端分别是谁，是无法从元素组成推断的，
 * 这里显式列出来：AlO₂⁻ 是 O=Al=O（金属在中间），OH⁻ 是 O–H，ClO⁻ 是 Cl–O。
 */
const CHAIN_SHAPE: { match: IonSp; order: string[] }[] = [
  { match: SP.OH, order: ['O', 'H'] },
  { match: SP.ClO, order: ['Cl', 'O'] },
  { match: SP.AlO2, order: ['O', 'Al', 'O'] },
  { match: SP.NO2m, order: ['O', 'N', 'O'] },
  { match: sp({ C: 1, O: 2 }, 0), order: ['O', 'C', 'O'] },
];

function buildTetra(center: string, ligand: string): Geom {
  const atoms: MolAtom[] = [{ el: center, pos: [0, 0, 0] }];
  const bonds: Bond[] = [];
  const d = bondLen(center, ligand);
  TETRA.forEach((v, i) => {
    atoms.push({ el: ligand, pos: scaled(v, d) });
    bonds.push({ a: 0, b: i + 1, order: 1 });
  });
  return { atoms, bonds };
}

/**
 * 平面三角 / V 形 / 三角锥：配体个数 n 由 counts 决定
 * ⚠️ 不能一律按 3 画 —— NO₂⁻ 只有 2 个氧，画成 3 个就凭空多出一个原子，
 *    配平虽然还在，但 3D 里的原子数与分子式对不上。
 */
function buildTrigonal(center: string, ligand: string, n: number, puckered: boolean): Geom {
  const atoms: MolAtom[] = [{ el: center, pos: [0, puckered ? bondLen(center, ligand) * 0.42 : 0, 0] }];
  const bonds: Bond[] = [];
  const d = bondLen(center, ligand);
  // 2 配位按 ~115° 的 V 形（NO₂⁻ 就是弯的），3 配位按 120° 均分
  const angles = n === 2 ? [-1.0, 1.0] : [0, (2 * Math.PI) / 3, (4 * Math.PI) / 3];
  angles.slice(0, Math.min(n, 3)).forEach((a) => {
    atoms.push({ el: ligand, pos: [Math.cos(a) * d, 0, Math.sin(a) * d] });
    bonds.push({ a: 0, b: atoms.length - 1, order: 1 });
  });
  return { atoms, bonds };
}

/** Cr₂O₇²⁻：两个 CrO₄ 四面体共用一个桥氧 */
function buildDichromate(): Geom {
  const d = bondLen('Cr', 'O');
  const atoms: MolAtom[] = [{ el: 'O', pos: [0, 0, 0] }];   // 0 号是桥氧
  const bonds: Bond[] = [];
  [-1, 1].forEach((sgn) => {
    const crIdx = atoms.length;
    atoms.push({ el: 'Cr', pos: [sgn * d * 0.95, 0, 0] });
    bonds.push({ a: 0, b: crIdx, order: 1 });
    // 每个 Cr 再挂 3 个端氧，绕 Cr–桥氧 轴转开
    [[0, 1, 0], [0, -0.5, 0.87], [0, -0.5, -0.87]].forEach((v) => {
      const p = scaled([v[0], v[1], v[2]], d);
      atoms.push({ el: 'O', pos: [atoms[crIdx].pos[0] + sgn * p[0] * 0.55 + p[0] * 0.45, p[1], p[2]] });
      bonds.push({ a: crIdx, b: atoms.length - 1, order: 1 });
    });
  });
  return { atoms, bonds };
}

/** M(OH)n：金属在中心，n 个 OH 基团沿多面体顶点方向伸出（每个 O 再挂一个 H） */
function buildHydroxide(metal: string, n: number): Geom {
  const atoms: MolAtom[] = [{ el: metal, pos: [0, 0, 0] }];
  const bonds: Bond[] = [];
  const dMO = bondLen(metal, 'O');
  const dOH = bondLen('O', 'H');
  const dirs = n > 4 ? OCTA : TETRA;
  dirs.slice(0, Math.min(n, dirs.length)).forEach((dir) => {
    const u = unit(dir);
    const oPos: [number, number, number] = [u[0] * dMO, u[1] * dMO, u[2] * dMO];
    const oIdx = atoms.length;
    atoms.push({ el: 'O', pos: oPos });
    // H 从 O 继续往外伸，并向外偏 40°，避免画成一条直线
    const perp: [number, number, number] = Math.abs(u[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
    const hDir: [number, number, number] = [
      u[0] * 0.72 + perp[0] * 0.68,
      u[1] * 0.72 + perp[1] * 0.68,
      u[2] * 0.72 + perp[2] * 0.68,
    ];
    const off = scaled(hDir, dOH);
    atoms.push({ el: 'H', pos: [oPos[0] + off[0], oPos[1] + off[1], oPos[2] + off[2]] });
    bonds.push({ a: 0, b: oIdx, order: 1 });
    bonds.push({ a: oIdx, b: oIdx + 1, order: 1 });
  });
  return { atoms, bonds };
}

function buildChain(els: string[]): Geom {
  const atoms: MolAtom[] = [];
  const bonds: Bond[] = [];
  let x = 0;
  els.forEach((el, i) => {
    if (i > 0) x += bondLen(els[i - 1], el);
    atoms.push({ el, pos: [x, 0, 0] });
    if (i > 0) bonds.push({ a: i - 1, b: i, order: 1 });
  });
  const shift = x / 2;
  atoms.forEach((a) => { a.pos = [a.pos[0] - shift, 0, 0]; });
  return { atoms, bonds };
}

function geometryOf(counts: CountMap, geom: IonGeom): Geom | null {
  const els = Object.keys(counts).filter((k) => (counts[k] || 0) > 0);
  if (!els.length) return null;
  switch (geom) {
    case 'single': {
      // 可能不止一个原子：半反应里的还原剂是 {I:2}⁻² 这种「2 个碘离子」的形态
      const el = els[0];
      const n = Math.max(1, Math.min(8, counts[el] || 1));
      const gap = 2.2;
      const atoms: MolAtom[] = [];
      for (let i = 0; i < n; i++) atoms.push({ el, pos: [i * gap - ((n - 1) * gap) / 2, 0, 0] });
      return { atoms, bonds: [] };
    }
    case 'diatomic':
    case 'linear3': {
      const shape = CHAIN_SHAPE.find((c) => countsKey(c.match.counts) === countsKey(counts));
      if (shape) return buildChain(shape.order);
      // 其余按 counts 展开成一条链（SCN⁻、C₂O₄²⁻ 这类够用）
      const expanded: string[] = [];
      Object.keys(counts).forEach((el) => {
        for (let i = 0; i < (counts[el] || 0); i++) expanded.push(el);
      });
      return buildChain(expanded.length ? expanded : els);
    }
    case 'tetrahedral': {
      const center = els.find((e) => e !== 'H' && e !== 'O') ?? els[0];
      const ligand = (counts.H || 0) > 1 ? 'H' : 'O';   // NH₄⁺ 配体是 H，其余 XO₄ 是 O
      return buildTetra(center, ligand);
    }
    case 'trigonal': {
      const center = els.find((e) => e !== 'O' && e !== 'H') ?? els[0];
      return buildTrigonal(center, 'O', counts.O || 3, false);
    }
    case 'pyramidal': {
      const center = els.find((e) => e !== 'O') ?? els[0];
      return buildTrigonal(center, 'O', counts.O || 3, true);
    }
    case 'dichromate':
      return buildDichromate();
    case 'hydroxide': {
      const metal = els.find((e) => e !== 'O' && e !== 'H') ?? els[0];
      return buildHydroxide(metal, counts.O || 1);
    }
    default:
      return null;
  }
}

/** 任意 CountMap 兜底：摊成一条链，至少不会所有原子叠在中心 */
function chainFallback(counts: CountMap): Geom {
  const els: string[] = [];
  Object.keys(counts).forEach((el) => {
    for (let i = 0; i < (counts[el] || 0); i++) els.push(el);
  });
  if (!els.length) els.push('H');
  return buildChain(els.slice(0, 18));
}

/** 把一个 IonSp 变成引擎能直接画的 MoleculeData */
export function speciesMolecule(s: IonSp, opts?: { name?: string; desc?: string }): MoleculeData {
  const total = Object.keys(s.counts).reduce((a, k) => a + (s.counts[k] || 0), 0);
  const ion = findIon(s.counts, s.charge);
  const label = s.charge
    ? displaySpecies(habitOf(s.counts) ?? formulaOfCounts(s.counts), s.charge)
    : neutralLabel(s.counts);
  const name = opts?.name || ion?.name || label;

  let built: Geom | null = ion ? geometryOf(ion.counts, ion.geom) : null;
  if (!built && !s.charge) {
    // 中性产物（沉淀）：氢氧化物走专用几何，其余交给既有 builder
    const metal = Object.keys(s.counts).find((e) => METALS.has(e));
    const ohN = s.counts.O || 0;
    if (metal && ohN > 0 && ohN === (s.counts.H || 0) && Object.keys(s.counts).length === 3) {
      built = buildHydroxide(metal, ohN);
    } else if (total <= 14) {
      const gen = buildMoleculeForFormula(formulaOfCounts(s.counts));
      if (gen?.atoms?.length) built = { atoms: gen.atoms, bonds: gen.bonds ?? [] };
    }
  }
  if (!built) built = chainFallback(s.counts);

  return {
    id: `ion_${spKey(s).replace('|', '_')}`,
    name,
    formula: label,
    formulaAscii: habitOf(s.counts) ?? formulaOfCounts(s.counts),
    category: s.charge ? '离子' : '难溶物',
    // 净电荷单独给出：详情页靠它显示「‑1 价 / +3 价」，光看上标几乎看不出来
    charge: s.charge || 0,
    level: '高中 · 离子反应',
    scene: 'molecule',
    desc:
      opts?.desc ||
      `${name}（${label}）${s.charge ? `，带 ${Math.abs(s.charge)} 个单位${s.charge > 0 ? '正' : '负'}电荷` : ''}。`,
    atoms: built.atoms,
    bonds: built.bonds,
  };
}

/* ============================================================
 * 六、配平：原子守恒 + 电荷守恒
 * ========================================================== */

/**
 * 在 1..range 内暴力搜索整数系数，使两侧各元素守恒**且净电荷相等**，
 * 返回最简整数比 [左侧系数…, 右侧系数…]；配不出则返回 null。
 */
export function solveWithCharge(lhs: IonSp[], rhs: IonSp[], range = 12): number[] | null {
  const nl = lhs.length;
  const nr = rhs.length;
  const n = nl + nr;
  if (!n) return null;
  const els = Array.from(
    new Set([...lhs, ...rhs].flatMap((s) => Object.keys(s.counts).filter((e) => s.counts[e])))
  );

  let best: number[] | null = null;
  let bestSum = Infinity;

  const check = (coef: number[]) => {
    for (const el of els) {
      let sum = 0;
      for (let j = 0; j < nl; j++) sum += (lhs[j].counts[el] || 0) * coef[j];
      for (let j = 0; j < nr; j++) sum -= (rhs[j].counts[el] || 0) * coef[nl + j];
      if (sum !== 0) return false;
    }
    let q = 0;
    for (let j = 0; j < nl; j++) q += lhs[j].charge * coef[j];
    for (let j = 0; j < nr; j++) q -= rhs[j].charge * coef[nl + j];
    return q === 0;
  };

  const rec = (i: number, cur: number[]) => {
    if (best && cur.reduce((a, b) => a + b, 0) >= bestSum) return;   // 剪枝
    if (i === n) {
      if (check(cur)) {
        const sum = cur.reduce((a, b) => a + b, 0);
        if (sum < bestSum) { bestSum = sum; best = [...cur]; }
      }
      return;
    }
    for (let k = 1; k <= range; k++) rec(i + 1, [...cur, k]);
  };
  rec(0, []);
  return best;
}

/* ============================================================
 * 七、产物表
 * ========================================================== */

export interface RxPlanMeta {
  name: string;
  type: string;
  cond?: string;
  desc: string;
  steps: { title: string; desc: string; mode: DramaStep['mode'] }[];
  transfers?: ElectronTransfer[];
}

export interface RxPlan extends RxPlanMeta {
  lhs: ReactionDramaSpecies[];
  rhs: ReactionDramaSpecies[];
}

/** 沉淀反应用的阴离子定义（key 用习惯写法，便于 PRECIP 表书写） */
const PRECIP_ANIONS: Record<string, IonSp> = {
  Cl: sp({ Cl: 1 }, -1),
  Br: sp({ Br: 1 }, -1),
  I: sp({ I: 1 }, -1),
  S: sp({ S: 1 }, -2),
  OH: SP.OH,
  SO4: SP.SO4,
  SO3: SP.SO3,
  CO3: SP.CO3,
  PO4: sp({ P: 1, O: 4 }, -3),
};

interface PrecipDef {
  /** 阳离子元素符号 */
  cat: string;
  /** 阳离子电荷（用来区分 Fe²⁺ / Fe³⁺ 这类同元素不同价） */
  catCharge: number;
  an: string;
  prodAscii: string;
  prodName: string;
  color: string;
  note?: string;
}

const PRECIP: PrecipDef[] = [
  { cat: 'Ag', catCharge: 1, an: 'Cl', prodAscii: 'AgCl', prodName: '氯化银', color: '白', note: '不溶于稀硝酸，这是检验 Cl⁻ 最常用的方法' },
  { cat: 'Ag', catCharge: 1, an: 'Br', prodAscii: 'AgBr', prodName: '溴化银', color: '淡黄' },
  { cat: 'Ag', catCharge: 1, an: 'I', prodAscii: 'AgI', prodName: '碘化银', color: '黄' },
  { cat: 'Ag', catCharge: 1, an: 'CO3', prodAscii: 'Ag2CO3', prodName: '碳酸银', color: '白' },
  { cat: 'Ba', catCharge: 2, an: 'SO4', prodAscii: 'BaSO4', prodName: '硫酸钡', color: '白', note: '不溶于稀硝酸，是检验 SO₄²⁻ 的经典方法' },
  { cat: 'Ba', catCharge: 2, an: 'CO3', prodAscii: 'BaCO3', prodName: '碳酸钡', color: '白', note: '能溶于稀盐酸并放出气体' },
  { cat: 'Ba', catCharge: 2, an: 'SO3', prodAscii: 'BaSO3', prodName: '亚硫酸钡', color: '白' },
  { cat: 'Ca', catCharge: 2, an: 'CO3', prodAscii: 'CaCO3', prodName: '碳酸钙', color: '白', note: '澄清石灰水变浑浊就是这个反应' },
  { cat: 'Ca', catCharge: 2, an: 'SO4', prodAscii: 'CaSO4', prodName: '硫酸钙', color: '白（微溶）' },
  { cat: 'Cu', catCharge: 2, an: 'OH', prodAscii: 'Cu(OH)2', prodName: '氢氧化铜', color: '蓝' },
  { cat: 'Cu', catCharge: 2, an: 'S', prodAscii: 'CuS', prodName: '硫化铜', color: '黑' },
  { cat: 'Fe', catCharge: 3, an: 'OH', prodAscii: 'Fe(OH)3', prodName: '氢氧化铁', color: '红褐', note: '胶体形态时就是净水用的氢氧化铁胶体' },
  { cat: 'Fe', catCharge: 2, an: 'OH', prodAscii: 'Fe(OH)2', prodName: '氢氧化亚铁', color: '白→灰绿→红褐', note: '极易被空气氧化，白色沉淀会迅速变色' },
  { cat: 'Fe', catCharge: 2, an: 'S', prodAscii: 'FeS', prodName: '硫化亚铁', color: '黑' },
  { cat: 'Mg', catCharge: 2, an: 'OH', prodAscii: 'Mg(OH)2', prodName: '氢氧化镁', color: '白' },
  { cat: 'Mg', catCharge: 2, an: 'CO3', prodAscii: 'MgCO3', prodName: '碳酸镁', color: '白' },
  { cat: 'Al', catCharge: 3, an: 'OH', prodAscii: 'Al(OH)3', prodName: '氢氧化铝', color: '白', note: '两性氢氧化物，能溶于过量强碱' },
  { cat: 'Zn', catCharge: 2, an: 'OH', prodAscii: 'Zn(OH)2', prodName: '氢氧化锌', color: '白' },
  { cat: 'Zn', catCharge: 2, an: 'S', prodAscii: 'ZnS', prodName: '硫化锌', color: '白' },
  { cat: 'Pb', catCharge: 2, an: 'I', prodAscii: 'PbI2', prodName: '碘化铅', color: '黄' },
  { cat: 'Pb', catCharge: 2, an: 'SO4', prodAscii: 'PbSO4', prodName: '硫酸铅', color: '白' },
];

/* ---- 7.1 沉淀 / 离子共存 ---- */

function tryPrecipitation(inputs: IonInput[], env: ReactionEnv): RxPlan | null {
  if (inputs.length !== 2) return null;
  const [x, y] = inputs;
  for (const [cat, an] of [[x, y], [y, x]] as [IonInput, IonInput][]) {
    if (cat.charge <= 0 || an.charge >= 0) continue;
    const els = Object.keys(cat.counts).filter((e) => cat.counts[e] > 0);
    if (els.length !== 1) continue;
    const catEl = els[0];
    const anKey = Object.keys(PRECIP_ANIONS).find((k) => sameCounts(PRECIP_ANIONS[k].counts, an.counts));
    if (!anKey) continue;
    const def = PRECIP.find((d) => d.cat === catEl && d.catCharge === cat.charge && d.an === anKey);
    if (!def) continue;
    // 酸性介质里碳酸盐 / 亚硫酸盐 / 氢氧化物沉淀会溶解，此时不该当成沉淀反应讲
    if (env === 'acid' && ['CO3', 'SO3', 'OH'].includes(def.an)) {
      continue;
    }
    const prodCounts = parseCounts(def.prodAscii);
    if (!prodCounts) continue;

    return balance(
      [sp(cat.counts, cat.charge), sp(an.counts, an.charge)],
      [sp(prodCounts, 0)],
      {
        name: `${def.prodName}沉淀的生成`,
        type: '复分解反应 · 离子反应',
        cond: '常温 · 水溶液中',
        desc: `${cat.label} 与 ${an.label} 在水溶液中相遇，结合成${def.color}色的${def.prodName}沉淀。${
          def.note ? def.note + '。' : ''
        }这类反应之所以能发生，是因为生成了难溶物，溶液中的离子浓度大幅降低。反应前后各元素化合价都没变 —— 它不是氧化还原反应。`,
        steps: [
          { title: '两种离子相遇', desc: `${cat.label}和${an.label}各自被水分子包围，在溶液中自由运动。`, mode: 'reactants' },
          { title: '离子重新配对', desc: `两者结合成难溶的${def.prodName}。这个过程没有电子转移，只是离子的重新组合。`, mode: 'split' },
          { title: '沉淀析出', desc: `生成${def.color}色${def.prodName}沉淀，溶液中相应离子的浓度随之下降。`, mode: 'products' },
        ],
      }
    );
  }
  return null;
}

/* ---- 7.2 高锰酸根 × 介质（半反应 + 电子守恒） ---- */

/**
 * 半反应统一写成：
 *   reduced + hPlus·H⁺  + e·e⁻  →  oxidized + water·H₂O         （氧化剂被还原）
 *   reduced + hPlus·H⁺          →  oxidized + water·H₂O + e·e⁻  （还原剂被氧化）
 * hPlus 为负表示 H⁺ 在生成物一侧，water 为负表示 H₂O 在反应物一侧。
 */
interface HalfRx {
  key: string;
  reduced: IonSp;
  oxidized: IonSp;
  e: number;
  hPlus: number;
  water: number;
  label: string;
}

/** 高锰酸根在三种介质下的还原半反应 —— 「环境参数」真正起作用的地方 */
const MNO4_HALF: Record<ReactionEnv, HalfRx & { prodLabel: string; prodName: string; desc: string }> = {
  acid: {
    key: spKey(SP.MnO4),
    reduced: SP.MnO4, oxidized: SP.Mn2,
    e: 5, hPlus: 8, water: 4,
    label: 'MnO₄⁻ → Mn²⁺',
    prodLabel: 'Mn²⁺', prodName: '锰离子',
    desc: '酸性条件下 MnO₄⁻ 里 +7 价的 Mn 得到 5 个电子，还原为近乎无色的 Mn²⁺，紫红色褪得最快，此时它的氧化性最强。',
  },
  neutral: {
    key: spKey(SP.MnO4),
    reduced: SP.MnO4, oxidized: SP.MnO2,
    e: 3, hPlus: 4, water: 2,
    label: 'MnO₄⁻ → MnO₂',
    prodLabel: 'MnO₂', prodName: '二氧化锰',
    desc: '中性或弱碱性条件下 MnO₄⁻ 得到 3 个电子，还原为棕黑色的 MnO₂，常能看到溶液里出现黑色浑浊。',
  },
  base: {
    key: spKey(SP.MnO4),
    reduced: SP.MnO4, oxidized: SP.MnO4_2,
    e: 1, hPlus: 0, water: 0,
    label: 'MnO₄⁻ → MnO₄²⁻',
    prodLabel: 'MnO₄²⁻', prodName: '锰酸根',
    desc: '强碱性条件下 MnO₄⁻ 只得到 1 个电子，还原为墨绿色的 MnO₄²⁻，此时氧化性最弱，溶液由紫红转绿。',
  },
};

/** 常见还原剂们的氧化半反应 */
const REDUCERS: (HalfRx & { name: string })[] = [
  { key: spKey(SP.Fe2), reduced: SP.Fe2, oxidized: SP.Fe3, e: 1, hPlus: 0, water: 0, label: 'Fe²⁺ → Fe³⁺', name: '亚铁离子' },
  { key: spKey(SP.SO3), reduced: SP.SO3, oxidized: SP.SO4, e: 2, hPlus: -2, water: -1, label: 'SO₃²⁻ → SO₄²⁻', name: '亚硫酸根' },
  // ⚠️ 卤离子的氧化必须写成 2X⁻ → X₂：reduced 侧是「2 个卤离子」，
  //    丢电子数是 2，不能与 reduced=I⁻（1 个）配 e=1，那样原子数会对不上
  { key: spKey(SP.I), reduced: sp({ I: 2 }, -2), oxidized: SP.I2, e: 2, hPlus: 0, water: 0, label: '2I⁻ → I₂', name: '碘离子' },
  { key: spKey(SP.Cl), reduced: sp({ Cl: 2 }, -2), oxidized: SP.Cl2, e: 2, hPlus: 0, water: 0, label: '2Cl⁻ → Cl₂', name: '氯离子' },
  { key: spKey(SP.H2O2), reduced: SP.H2O2, oxidized: SP.O2, e: 2, hPlus: -2, water: 0, label: 'H₂O₂ → O₂', name: '过氧化氢' },
  { key: spKey(SP.C2O4), reduced: SP.C2O4, oxidized: sp({ C: 2, O: 4 }, 0), e: 2, hPlus: 0, water: 0, label: 'C₂O₄²⁻ → 2CO₂', name: '草酸根' },
];

function gcd(a: number, b: number): number {
  return b ? gcd(b, a % b) : Math.abs(a) || 1;
}

function tryPermanganate(inputs: IonInput[], env: ReactionEnv): RxPlan | null {
  if (inputs.length !== 2) return null;
  const oxInput = inputs.find((i) => i.key === spKey(SP.MnO4));
  if (!oxInput) return null;
  const redInput = inputs.find((i) => i !== oxInput)!;
  const red = REDUCERS.find((r) => r.key === redInput.key);
  if (!red) return null;

  const ox = MNO4_HALF[env];
  const m = (ox.e / gcd(ox.e, red.e)) * red.e;   // 电子数的最小公倍数
  const kOx = m / ox.e;
  const kRed = m / red.e;

  const lhsList: IonSp[] = [ox.reduced, red.reduced];
  const rhsList: IonSp[] = [ox.oxidized, red.oxidized];
  const kL = [kOx, kRed];
  const kR = [kOx, kRed];

  // 酸式配平先攒出净 H⁺ 与净 H₂O
  let hNet = ox.hPlus * kOx + red.hPlus * kRed;   // >0 在反应物侧
  let wNet = ox.water * kOx + red.water * kRed;   // >0 在生成物侧

  if (env !== 'acid') {
    // 中 / 碱性：两边各加上等量的 OH⁻ 把 H⁺ 变成水，剩余的水统一到最后处理
    if (hNet > 0) { rhsList.push(SP.OH); kR.push(hNet); }
    else if (hNet < 0) { lhsList.push(SP.OH); kL.push(-hNet); }
    wNet -= hNet;
  } else if (hNet > 0) {
    lhsList.push(SP.H); kL.push(hNet);
  } else if (hNet < 0) {
    rhsList.push(SP.H); kR.push(-hNet);
  }

  if (wNet > 0) { rhsList.push(SP.H2O); kR.push(wNet); }
  else if (wNet < 0) { lhsList.push(SP.H2O); kL.push(-wNet); }

  const el = Object.keys(red.reduced.counts)[0];
  const media =
    env === 'acid'
      ? 'H⁺ 参与反应并结合成水'
      : env === 'base'
        ? '生成 OH⁻（碱性介质里 H⁺ 不能独立存在）'
        : '有水参与反应';

  return balanceWithCoefs(lhsList, kL, rhsList, kR, {
    name: `高锰酸钾氧化${red.name}（${envName(env)}性介质）`,
    type: '氧化还原反应 · 离子反应',
    cond: `${envName(env)}性介质`,
    desc: `${ox.desc} ${red.name}则失去电子被氧化（${red.label}）。配平的依据是：高锰酸根得到的电子总数必须与还原剂失去的电子总数相等。`,
    steps: [
      { title: '写反应物', desc: `${envName(env)}性条件下，MnO₄⁻ 与${red.name}共存于同一溶液中。`, mode: 'reactants' },
      {
        title: '电子转移',
        desc: `MnO₄⁻ 每个 Mn 得 ${ox.e} 个电子变成${ox.prodLabel}；${red.name}每份失 ${red.e} 个电子。电子得失总数的最小公倍数是 ${m}，于是两侧系数分别为 ${kOx} 和 ${kRed}。`,
        mode: 'transfer',
      },
      { title: '配平与产物', desc: `Mn 被还原为${ox.prodName}，${media}，最终两侧原子数与电荷数同时守恒。`, mode: 'products' },
    ],
    transfers: [{ a: 'Mn', b: el, n: m }],
  });
}

export function envName(env: ReactionEnv): string {
  return env === 'acid' ? '酸' : env === 'base' ? '碱' : '中';
}

/* ---- 7.3 歧化 ---- */

interface TableRx {
  inputs: string[];
  env: ReactionEnv;
  lhs: IonSp[];
  rhs: IonSp[];
  meta: RxPlanMeta;
}

const DISPROP: TableRx[] = [
  {
    inputs: [spKey(SP.Cl2), spKey(SP.OH)],
    env: 'base',
    lhs: [SP.Cl2, SP.OH],
    rhs: [SP.Cl, SP.ClO, SP.H2O],
    meta: {
      name: '氯气与碱反应（歧化）',
      type: '氧化还原反应 · 歧化反应',
      cond: '碱性溶液 · 常温',
      desc: 'Cl₂ 中 0 价的氯一部分降到 −1 价变成 Cl⁻，另一部分升到 +1 价变成 ClO⁻ —— 同一种元素既被氧化又被还原，这就是歧化反应。冷碱生成次氯酸盐，这正是 84 消毒液的制取原理；若用热碱则会进一步生成氯酸盐。',
      steps: [
        { title: '通入氯气', desc: 'Cl₂ 分子进入碱液，两个 Cl 原子原本价态相同，都是 0 价。', mode: 'reactants' },
        { title: '电子在同种元素间转移', desc: '一个 Cl 原子把 1 个电子让给另一个 Cl：得到电子的变成 Cl⁻，失去电子的变成 ClO⁻。', mode: 'transfer' },
        { title: '生成两种含氯产物', desc: '同时得到 Cl⁻ 与 ClO⁻，水作为介质参与配平，黄绿色褪去。', mode: 'products' },
      ],
      transfers: [{ a: 'Cl', b: 'Cl', n: 1 }],
    },
  },
  {
    inputs: [spKey(SP.NO2), spKey(SP.OH)],
    env: 'base',
    lhs: [SP.NO2, SP.OH],
    rhs: [SP.NO3, SP.NO2m, SP.H2O],
    meta: {
      name: '二氧化氮与碱反应（歧化）',
      type: '氧化还原反应 · 歧化反应',
      cond: '碱性溶液',
      desc: 'NO₂ 中 +4 价的氮发生歧化：一部分升到 +5 价成为 NO₃⁻，另一部分降到 +3 价成为 NO₂⁻。工业上用碱液吸收硝酸厂尾气，利用的就是这个反应。',
      steps: [
        { title: 'NO₂ 溶入碱液', desc: '红棕色的 NO₂ 气体通入碱液，很快就被吸收。', mode: 'reactants' },
        { title: '氮的价态一升一降', desc: '+4 价的 N 同时向两侧变化：升到 +5（NO₃⁻），降到 +3（NO₂⁻）。', mode: 'transfer' },
        { title: '生成硝酸盐与亚硝酸盐', desc: '得到 NO₃⁻ 和 NO₂⁻ 两种产物，红棕色逐渐褪去。', mode: 'products' },
      ],
      transfers: [{ a: 'N', b: 'N', n: 1 }],
    },
  },
];

/* ---- 7.4 铝的两性 ---- */

const AMPHOTERIC: TableRx[] = [
  {
    inputs: [spKey(SP.Al_metal), spKey(SP.H)],
    env: 'acid',
    lhs: [SP.Al_metal, SP.H],
    rhs: [SP.Al3, SP.H2],
    meta: {
      name: '铝与酸反应',
      type: '氧化还原反应 · 离子反应',
      cond: '酸性溶液',
      desc: 'Al 比 H 活泼，能把 H⁺ 还原成 H₂：每个 Al 失去 3 个电子变成 Al³⁺，每 2 个 H⁺ 得到 2 个电子生成 1 个 H₂。这体现的是铝的金属性。',
      steps: [
        { title: '铝投入酸中', desc: '铝表面有一层致密的氧化膜，刚开始的一小会儿几乎看不到气泡。', mode: 'reactants' },
        { title: '电子从铝流向氢离子', desc: '氧化膜被溶解后，Al 不断失去电子成为 Al³⁺ 进入溶液，电子被 H⁺ 得到。', mode: 'transfer' },
        { title: '放出氢气', desc: 'H⁺ 得电子生成 H₂，铝片逐渐溶解，气泡明显加快。', mode: 'products' },
      ],
      transfers: [{ a: 'Al', b: 'H', n: 6 }],
    },
  },
  {
    inputs: [spKey(SP.Al_metal), spKey(SP.OH)],
    env: 'base',
    lhs: [SP.Al_metal, SP.OH, SP.H2O],
    rhs: [SP.AlO2, SP.H2],
    meta: {
      name: '铝与强碱反应（两性）',
      type: '氧化还原反应 · 离子反应',
      cond: '强碱性溶液',
      desc: '铝竟然也能溶于强碱 —— 这是它的「非金属性」一面。Al 先被氧化，生成的 Al(OH)₃ 是两性氢氧化物，会继续与过量的 OH⁻ 结合成可溶的 AlO₂⁻，于是铝不断溶解并放出 H₂。',
      steps: [
        { title: '铝投入强碱溶液', desc: '同样要先破坏表面的氧化膜，之后反应很快。', mode: 'reactants' },
        { title: '铝被氧化、水被还原', desc: 'Al 失去电子，水得到电子生成 H₂；生成的 Al³⁺ 立即与 OH⁻ 结合。', mode: 'transfer' },
        { title: '生成偏铝酸根', desc: '最终得到可溶的 AlO₂⁻ 并放出 H₂，铝片逐渐溶解。', mode: 'products' },
      ],
      transfers: [{ a: 'Al', b: 'H', n: 6 }],
    },
  },
  {
    inputs: [spKey(SP.Al3), spKey(SP.OH)],
    env: 'base',
    lhs: [SP.Al3, SP.OH],
    rhs: [sp({ Al: 1, O: 3, H: 3 }, 0)],
    meta: {
      name: '铝离子生成氢氧化铝沉淀',
      type: '复分解反应 · 离子反应',
      cond: '碱性溶液',
      desc: 'Al³⁺ 遇 OH⁻ 生成白色胶状的 Al(OH)₃ 沉淀，它能吸附水中的悬浮杂质，可用于净水。继续滴加过量强碱，沉淀又会溶解变成 AlO₂⁻ —— 这正是 Al(OH)₃ 两性的体现。',
      steps: [
        { title: '两种离子相遇', desc: 'Al³⁺ 与 OH⁻ 在溶液中相遇。', mode: 'reactants' },
        { title: '结合成沉淀', desc: '生成白色胶状 Al(OH)₃，没有化合价变化。', mode: 'split' },
        { title: '沉淀析出', desc: '注意：若继续加入过量强碱，沉淀会溶解并生成 AlO₂⁻。', mode: 'products' },
      ],
    },
  },
  {
    inputs: [spKey(SP.AlO2), spKey(SP.H)],
    env: 'acid',
    lhs: [SP.AlO2, SP.H, SP.H2O],
    rhs: [sp({ Al: 1, O: 3, H: 3 }, 0)],
    meta: {
      name: '偏铝酸根遇酸生成沉淀',
      type: '复分解反应 · 离子反应',
      cond: '酸性溶液',
      desc: 'AlO₂⁻ 只能在强碱性环境中稳定存在；一旦遇到 H⁺，就会结合 H⁺ 与 H₂O 重新沉淀出 Al(OH)₃。往偏铝酸盐溶液里通入 CO₂，同样能得到这个白色沉淀。',
      steps: [
        { title: '偏铝酸根溶液', desc: 'AlO₂⁻ 存在于强碱性溶液中。', mode: 'reactants' },
        { title: '加入酸', desc: 'H⁺ 与 AlO₂⁻ 结合，先生成 Al(OH)₃。', mode: 'split' },
        { title: '白色沉淀析出', desc: '若酸继续过量，Al(OH)₃ 会进一步溶解生成 Al³⁺。', mode: 'products' },
      ],
    },
  },
];

function tryTable(table: TableRx[], inputs: IonInput[], env: ReactionEnv): RxPlan | null {
  for (const t of table) {
    if (t.env !== env) continue;
    if (inputs.length !== t.inputs.length) continue;
    const have = new Set(inputs.map((i) => i.key));
    if (!t.inputs.every((k) => have.has(k))) continue;
    const plan = balance(t.lhs, t.rhs, t.meta);
    if (plan) return plan;
  }
  return null;
}

/* ---- 7.5 兜底：酸碱中和的离子本质 ---- */

function tryNeutralization(inputs: IonInput[]): RxPlan | null {
  if (inputs.length !== 2) return null;
  const keys = new Set(inputs.map((i) => i.key));
  if (!keys.has(spKey(SP.H)) || !keys.has(spKey(SP.OH))) return null;
  return balance([SP.H, SP.OH], [SP.H2O], {
    name: '酸碱中和的离子本质',
    type: '复分解反应 · 中和反应',
    cond: '常温 · 水溶液',
    desc: '酸提供的 H⁺ 与碱提供的 OH⁻ 结合成难电离的水，这就是中和反应的离子本质。无论换成哪一种强酸强碱，写出来的离子方程式都是这一个。',
    steps: [
      { title: 'H⁺ 与 OH⁻ 相遇', desc: '酸电离出的 H⁺ 和碱电离出的 OH⁻ 在溶液中自由移动。', mode: 'reactants' },
      { title: '结合成水', desc: 'H⁺ 与 OH⁻ 结合成难电离的水，两者浓度同时下降。', mode: 'split' },
      { title: '溶液趋于中性', desc: '生成 H₂O，若恰好完全反应则溶液呈中性。', mode: 'products' },
    ],
  });
}

/* ============================================================
 * 八、配平装配与对外入口
 * ========================================================== */

function toSpecies(s: IonSp, count: number): ReactionDramaSpecies {
  // 「2 个碘离子」这种聚合形态要摊平成 1 个 I⁻ 的 mol × 2 倍数量，
  // 否则方程式里会写出 52I⁻（系数 5 撞上物种名里的 2）
  const multi = extractMulti(s.counts, s.charge);
  if (multi) {
    return {
      mol: speciesMolecule(sp(multi.base, multi.baseCharge)),
      count: count * multi.mul,
      charge: multi.baseCharge,
    };
  }
  return { mol: speciesMolecule(s), count, charge: s.charge };
}

/** 先把同一物种的系数合并，再用配平器求最简整数比 */
function balanceWithCoefs(
  lhsList: IonSp[], kL: number[],
  rhsList: IonSp[], kR: number[],
  meta: RxPlanMeta
): RxPlan | null {
  const lhsDedup: IonSp[] = [];
  const lhsCoef: number[] = [];
  lhsList.forEach((s, i) => {
    const hit = lhsDedup.findIndex((o) => spKey(o) === spKey(s));
    if (hit >= 0) lhsCoef[hit] += kL[i] ?? 1;
    else { lhsDedup.push(s); lhsCoef.push(kL[i] ?? 1); }
  });
  const rhsDedup: IonSp[] = [];
  const rhsCoef: number[] = [];
  rhsList.forEach((s, i) => {
    const hit = rhsDedup.findIndex((o) => spKey(o) === spKey(s));
    if (hit >= 0) rhsCoef[hit] += kR[i] ?? 1;
    else { rhsDedup.push(s); rhsCoef.push(kR[i] ?? 1); }
  });

  const solved = solveWithCharge(lhsDedup, rhsDedup);
  if (!solved) {
    // 守恒算不出整数解时，退回到推导给出的系数，但要确认电荷确实守恒
    let q = 0;
    lhsList.forEach((s, i) => { q += s.charge * (kL[i] ?? 1); });
    rhsList.forEach((s, i) => { q -= s.charge * (kR[i] ?? 1); });
    if (q !== 0) return null;
  }
  const useL = solved ? solved.slice(0, lhsDedup.length) : lhsCoef;
  const useR = solved ? solved.slice(lhsDedup.length) : rhsCoef;

  return {
    ...meta,
    lhs: lhsDedup.map((s, i) => toSpecies(s, useL[i])).filter((x) => x.count > 0),
    rhs: rhsDedup.map((s, i) => toSpecies(s, useR[i])).filter((x) => x.count > 0),
  };
}

function balance(lhs: IonSp[], rhs: IonSp[], meta: RxPlanMeta): RxPlan | null {
  return balanceWithCoefs(lhs, lhs.map(() => 1), rhs, rhs.map(() => 1), meta);
}

/** 由配好的两侧生成展示用方程式（系数 + 含电荷上标的分子式） */
export function equationOfPlan(lhs: ReactionDramaSpecies[], rhs: ReactionDramaSpecies[]): string {
  const side = (arr: ReactionDramaSpecies[]) =>
    arr.map((s) => (s.count > 1 ? `${s.count}${s.mol.formula}` : s.mol.formula)).join(' + ');
  return `${side(lhs)} ——→ ${side(rhs)}`;
}

/**
 * 离子方程式推导总入口。按优先级依次尝试：
 *   沉淀 / 离子共存 → 铝的两性 → 高锰酸根 × 介质 → 歧化 → 中和兜底
 */
export function deriveIonic(inputs: IonInput[], env: ReactionEnv): RxPlan | null {
  if (!inputs.length) return null;
  return (
    tryPrecipitation(inputs, env) ??
    tryTable(AMPHOTERIC, inputs, env) ??
    tryPermanganate(inputs, env) ??
    tryTable(DISPROP, inputs, env) ??
    tryNeutralization(inputs)
  );
}

/** 把推导结果包装成 SceneScreen 能直接播放的 ReactionDrama */
export function planToDrama(plan: RxPlan, id: string, env: ReactionEnv): ReactionDrama {
  return {
    id,
    name: plan.name,
    equation: equationOfPlan(plan.lhs, plan.rhs),
    condition: plan.cond,
    type: plan.type,
    level: '高中 · 必修',
    desc: plan.desc,
    lhs: plan.lhs,
    rhs: plan.rhs,
    steps: plan.steps,
    transfers: plan.transfers,
    ionic: true,
    env,
  };
}

/** 给 UI 的友好报错：说清楚为什么推不出来 */
export function ionicError(inputs: IonInput[], env: ReactionEnv): string {
  const keys = new Set(inputs.map((i) => i.key));
  const has = (k: string) => keys.has(k);
  const mno4 = has(spKey(SP.MnO4));
  if (mno4) {
    return `已识别到 MnO₄⁻ 但没有找到配对的还原剂。可试试这些：${REDUCERS.map((r) => r.name).join('、')}。当前介质为${envName(env)}性，还原产物会是${MNO4_HALF[env].prodLabel}。`;
  }
  if (inputs.some((i) => i.kind === 'neutral')) {
    return '离子方程式模式下需要写离子。若不勾选「离子方程式」，可以写分子式（如 Zn、HCl、NaOH）。';
  }
  return '暂未收录这组离子之间的反应。目前已支持：沉淀类（Ag⁺+Cl⁻、Ba²⁺+SO₄²⁻、Fe³⁺+OH⁻ 等）、高锰酸根的介质氧化还原、Cl₂/NO₂ 的碱性歧化、铝的两性，以及酸碱中和。';
}
