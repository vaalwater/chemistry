// 离子化合物的通用建模 —— 把「多原子离子」当成**一个整体骨架**，而不是把原子团拆成一堆配体。
//
// 旧逻辑的病根：buildFromCounts 末尾按电负性挑一个中心原子，再把其余原子摆成辐条，
// 于是 NaN₃ 画成「Na 居中 + 3 个 N」，NaNO₃ 画成「Na 连 1 个 N 和 3 个 O」——
// 这些都是把 NO₃⁻ / CO₃²⁻ / N₃⁻ 这样的原子团拆散了，化学上根本不成立。
//
// 这里的硬约束（不再靠特判兜）：
//  1. 先按「价电子 / 常见价态」认出阳离子，按「已知原子团」认出阴离子；
//  2. 用**电荷守恒**配平两者的个数比，变价金属（Fe / Cu）的价态也由电中性反推；
//  3. 阴离子按自己的形状（直线 / 平面三角 / 三角锥 / 正四面体…）生成骨架，阳离子独立摆放，
//     之间只用 style:'ionic' 的淡灰细线表示静电作用；
//  4. 逐原子按 Lewis 公式「价电子 − 孤对电子 − 成键电子对」算形式电荷，
//     **总和不为 0 就拒绝这次建模** —— 保证画出来的东西一定满足电中性。
//
// 本模块运行时零依赖（只 type-import types.ts），避免与 data.ts / formulaBuilder.ts 形成循环依赖。

import type { AcidInfo, Bond, ElectronLabel, MolAtom } from './types';

type CountMap = { [el: string]: number };
type V3 = [number, number, number];

export interface IonicBuilt {
  name: string;
  formulaAscii: string;
  desc: string;
  atoms: MolAtom[];
  bonds: Bond[];
  /** 逐原子的形式电荷，与 atoms 下标对齐；总和恒为 0 */
  charges: number[];
  /** 结构图上的电子转移 / 共价电子短标签 */
  electronLabels: ElectronLabel[];
  acidity?: AcidInfo;
}

/* ============================================================
 * 一、价电子与元素数据
 * ========================================================== */

/** 价电子数：主族 = 族序数；过渡金属按 data.ts 的 valenceInfo 口径（ns + 未满 (n−1)d） */
export const VALENCE_E: Record<string, number> = {
  H: 1, Li: 1, Be: 2, B: 3, C: 4, N: 5, O: 6, F: 7,
  Na: 1, Mg: 2, Al: 3, Si: 4, P: 5, S: 6, Cl: 7,
  K: 1, Ca: 2, Cr: 6, Mn: 7, Fe: 8, Cu: 11, Zn: 2,
  Br: 7, Ag: 11, I: 7, Ba: 2, Pb: 4,
};

/** 共价半径（Å），与 formulaBuilder 的 COV 同量纲，用来估团内键长 */
const COV: Record<string, number> = {
  H: 0.31, C: 0.76, N: 0.71, O: 0.66, F: 0.57, P: 1.07, S: 1.05,
  Cl: 0.99, Br: 1.14, I: 1.33, Al: 1.21, Mn: 1.39, Cr: 1.39,
  Li: 1.28, Na: 1.66, Mg: 1.41, K: 2.03, Ca: 1.76, Zn: 1.22,
  Fe: 1.32, Cu: 1.32, Ag: 1.45, Ba: 1.98, Pb: 1.46,
};
function bondLen(a: string, b: string): number {
  return Math.min(1.9, Math.max(0.9, (COV[a] ?? 1.0) + (COV[b] ?? 1.0)));
}

/* ============================================================
 * 二、阳离子 / 阴离子 / 多原子团
 * ========================================================== */

interface CationDef {
  el: string;
  charge: number;
  /** 中文名（变价金属用「亚铁」「亚铜」区分） */
  cn: string;
}

/** 单原子金属阳离子。变价金属列多个价态，由电荷守恒挑出正确的那个 */
const CATIONS: CationDef[] = [
  { el: 'Li', charge: 1, cn: '锂' },
  { el: 'Na', charge: 1, cn: '钠' },
  { el: 'K', charge: 1, cn: '钾' },
  { el: 'Ag', charge: 1, cn: '银' },
  { el: 'Mg', charge: 2, cn: '镁' },
  { el: 'Ca', charge: 2, cn: '钙' },
  { el: 'Ba', charge: 2, cn: '钡' },
  { el: 'Zn', charge: 2, cn: '锌' },
  { el: 'Mn', charge: 2, cn: '锰' },
  { el: 'Pb', charge: 2, cn: '铅' },
  { el: 'Al', charge: 3, cn: '铝' },
  { el: 'Cr', charge: 3, cn: '铬' },
  { el: 'Fe', charge: 2, cn: '亚铁' },
  { el: 'Fe', charge: 3, cn: '铁' },
  { el: 'Cu', charge: 1, cn: '亚铜' },
  { el: 'Cu', charge: 2, cn: '铜' },
];

type Shape = 'diatomic' | 'linear3' | 'bent' | 'trigonal' | 'pyramidal' | 'tetrahedral';

interface GroupDef {
  /** 习惯写法（不含电荷） */
  ascii: string;
  name: string;
  charge: number;
  /** 盐名前缀 + 是否要加「化」：叠氮+化+钠 / 硝酸+钠 */
  stem: string;
  hua: boolean;
  center: string;
  ligands: string[];
  /** 中心 → 各配体的键级（共振式之一，用于算形式电荷） */
  orders: number[];
  shape: Shape;
  /** 中心原子孤对电子对数（三角锥 / 角形 / 超价中心用；缺省按八隅体推） */
  lonePairs?: number;
  /** 第 i 个配体上再挂 1 个 H（酸式酸根 HCO₃⁻ / HSO₃⁻） */
  protonOn?: number;
  hydrolysis?: 'acid' | 'base';
  note: string;
}

/**
 * 高中常见的多原子阴离子。
 * counts 由 center + ligands(+H) 自动推出，杜绝「表里的组成和几何对不上」。
 * orders 选的是经典 Lewis 共振式之一：形式电荷之和必须等于 charge（下面会校验）。
 */
const GROUPS: GroupDef[] = [
  {
    ascii: 'N3', name: '叠氮根', charge: -1, stem: '叠氮', hua: true,
    center: 'N', ligands: ['N', 'N'], orders: [2, 2], shape: 'linear3', hydrolysis: 'base',
    note: 'N₃⁻ 与 CO₂、N₂O 等电子（16 个价电子）：中心 N 为 sp 杂化，三个 N 严格共线，两根 N–N 键等长（约 1.16 Å）、键级约 2，常用 ⁻N=N⁺=N⁻ 表示共振结构，还有两套互相垂直的三中心四电子离域 π 键。负电荷由三个 N 共同承担，不是「三个 N 各出一个电子」。',
  },
  {
    ascii: 'NO3', name: '硝酸根', charge: -1, stem: '硝酸', hua: false,
    center: 'N', ligands: ['O', 'O', 'O'], orders: [2, 1, 1], shape: 'trigonal',
    note: 'NO₃⁻ 是平面正三角形（N 为 sp² 杂化），三个 N–O 键完全等长 —— 真正存在的是 Π₄⁶ 离域大 π 键，画面上「一双两单」只是共振式之一的画法，不能理解成有一根特别短的双键。',
  },
  {
    ascii: 'NO2', name: '亚硝酸根', charge: -1, stem: '亚硝酸', hua: false,
    center: 'N', ligands: ['O', 'O'], orders: [2, 1], shape: 'bent', lonePairs: 1,
    note: 'NO₂⁻ 中心 N 上有一对孤对电子，把两个 N–O 压成 V 形（键角约 115°），不是直线。',
  },
  {
    ascii: 'CO3', name: '碳酸根', charge: -2, stem: '碳酸', hua: false,
    center: 'C', ligands: ['O', 'O', 'O'], orders: [2, 1, 1], shape: 'trigonal',
    hydrolysis: 'base',
    note: 'CO₃²⁻ 是平面正三角形，三个 C–O 键等长（Π₄⁶ 离域大 π 键）。它是弱酸 H₂CO₃ 的共轭碱，会水解出 OH⁻。',
  },
  {
    ascii: 'HCO3', name: '碳酸氢根', charge: -1, stem: '碳酸氢', hua: false,
    center: 'C', ligands: ['O', 'O', 'O'], orders: [2, 1, 1], protonOn: 2, shape: 'trigonal',
    hydrolysis: 'base',
    note: 'HCO₃⁻ 是碳酸的酸式酸根：三个 O 里有一个连着 H，其余负电荷离域。它既能电离出 H⁺ 又能水解出 OH⁻，在 NaHCO₃ 里水解占优，溶液显弱碱性。',
  },
  {
    ascii: 'SO4', name: '硫酸根', charge: -2, stem: '硫酸', hua: false,
    center: 'S', ligands: ['O', 'O', 'O', 'O'], orders: [2, 2, 1, 1], shape: 'tetrahedral',
    note: 'SO₄²⁻ 是正四面体（S 在中心，键角约 109.5°），四条 S–O 键等价。S 属第三周期，价层可以超过 8 电子（超价），这是它与 NO₃⁻ 的重要区别。',
  },
  {
    ascii: 'SO3', name: '亚硫酸根', charge: -2, stem: '亚硫酸', hua: false,
    center: 'S', ligands: ['O', 'O', 'O'], orders: [2, 1, 1], shape: 'pyramidal', lonePairs: 1,
    hydrolysis: 'base',
    note: 'SO₃²⁻ 中心 S 有一对孤对电子，因此是三角锥形而不是平面三角形（与 SO₂ 的 V 形同理）。',
  },
  {
    ascii: 'HSO3', name: '亚硫酸氢根', charge: -1, stem: '亚硫酸氢', hua: false,
    center: 'S', ligands: ['O', 'O', 'O'], orders: [2, 1, 1], protonOn: 2,
    shape: 'pyramidal', lonePairs: 1, hydrolysis: 'base',
    note: 'HSO₃⁻ 是亚硫酸的酸式酸根，S 上那对孤对电子仍在，整体呈三角锥形。',
  },
  {
    ascii: 'PO4', name: '磷酸根', charge: -3, stem: '磷酸', hua: false,
    center: 'P', ligands: ['O', 'O', 'O', 'O'], orders: [2, 1, 1, 1], shape: 'tetrahedral',
    hydrolysis: 'base',
    note: 'PO₄³⁻ 是正四面体，P 同样可以超价。它是中强酸 H₃PO₄ 的共轭碱，水解明显，溶液显碱性。',
  },
  {
    ascii: 'MnO4', name: '高锰酸根', charge: -1, stem: '高锰酸', hua: false,
    center: 'Mn', ligands: ['O', 'O', 'O', 'O'], orders: [2, 2, 2, 1], shape: 'tetrahedral',
    note: 'MnO₄⁻ 是正四面体，Mn 为 +7 价，紫红色来自 O→Mn 的电荷转移跃迁。它在酸 / 中 / 碱性介质里被还原的产物分别不同（Mn²⁺ / MnO₂ / MnO₄²⁻）。',
  },
  {
    ascii: 'ClO3', name: '氯酸根', charge: -1, stem: '氯酸', hua: false,
    center: 'Cl', ligands: ['O', 'O', 'O'], orders: [2, 2, 1], shape: 'pyramidal', lonePairs: 1,
    note: 'ClO₃⁻ 中心 Cl 有一对孤对电子，呈三角锥形。',
  },
  {
    ascii: 'ClO', name: '次氯酸根', charge: -1, stem: '次氯酸', hua: false,
    center: 'Cl', ligands: ['O'], orders: [1], shape: 'diatomic', hydrolysis: 'base',
    note: 'ClO⁻ 是弱酸 HClO 的共轭碱，水解显碱性，84 消毒液的有效成分就是它。',
  },
  {
    ascii: 'CN', name: '氰根', charge: -1, stem: '氰', hua: true,
    center: 'C', ligands: ['N'], orders: [3], shape: 'diatomic', hydrolysis: 'base',
    note: 'CN⁻ 与 N₂、CO 等电子（10 个价电子），C≡N 三键，负电荷主要在 C 上。',
  },
  {
    ascii: 'SCN', name: '硫氰根', charge: -1, stem: '硫氰', hua: true,
    center: 'C', ligands: ['S', 'N'], orders: [1, 3], shape: 'linear3',
    note: 'SCN⁻ 中心 C 是 sp 杂化，三个原子共线；⁻S–C≡N 与 S=C=N⁻ 是它的两个主要共振式。',
  },
  {
    ascii: 'OH', name: '氢氧根', charge: -1, stem: '氢氧', hua: true,
    center: 'O', ligands: ['H'], orders: [1], shape: 'diatomic',
    note: 'OH⁻ 是一个整体的阴离子：负电荷在 O 上，O–H 是共价键。金属氢氧化物里 M⁺ 与 OH⁻ 之间是离子键，不是「金属直接连着 H」。',
  },
  {
    ascii: 'AlO2', name: '偏铝酸根', charge: -1, stem: '偏铝酸', hua: false,
    center: 'Al', ligands: ['O', 'O'], orders: [2, 2], shape: 'linear3', hydrolysis: 'base',
    note: 'AlO₂⁻ 是强碱性溶液中的简写，水溶液里更准确的形态是 [Al(OH)₄]⁻（四羟基合铝酸根），这里按高中教材的简式画成直线型示意。',
  },
];

/** 多原子阳离子：铵根 */
const NH4: GroupDef = {
  ascii: 'NH4', name: '铵根', charge: 1, stem: '', hua: false,
  center: 'N', ligands: ['H', 'H', 'H', 'H'], orders: [1, 1, 1, 1], shape: 'tetrahedral',
  hydrolysis: 'acid',
  note: 'NH₄⁺ 是正四面体：N 的一对孤对电子配给 H⁺ 形成配位键后，四条 N–H 键完全等价，整体带 1 个单位正电荷。',
};

/**
 * 单原子阴离子。默认只配合铵根使用，避免接管 NaCl / FeCl₃ 这类已有的晶体说明；
 * N³⁻ 例外：Na₃N、Ca₃N₂ 是真实氮化物，也该按「阳离子 + 阴离子」画，而不是金属居中挂辐条。
 */
const MONO_ANIONS: { el: string; charge: number; stem: string; monoWithCat?: boolean }[] = [
  { el: 'F', charge: -1, stem: '氟' },
  { el: 'Cl', charge: -1, stem: '氯' },
  { el: 'Br', charge: -1, stem: '溴' },
  { el: 'I', charge: -1, stem: '碘' },
  { el: 'O', charge: -2, stem: '氧' },
  { el: 'S', charge: -2, stem: '硫' },
  { el: 'N', charge: -3, stem: '氮', monoWithCat: true },
];

interface AnionDef {
  ascii: string;
  name: string;
  charge: number;
  stem: string;
  hua: boolean;
  counts: CountMap;
  group?: GroupDef;
  mono?: { el: string };
  /** 允许与单原子金属阳离子配对（目前只有 N³⁻） */
  monoWithCat?: boolean;
  hydrolysis?: 'acid' | 'base';
}

function groupCounts(g: GroupDef): CountMap {
  const c: CountMap = { [g.center]: 1 };
  g.ligands.forEach((el) => { c[el] = (c[el] || 0) + 1; });
  if (g.protonOn !== undefined) c['H'] = (c['H'] || 0) + 1;
  return c;
}

const ANIONS: AnionDef[] = [
  ...GROUPS.map((g) => ({
    ascii: g.ascii, name: g.name, charge: g.charge, stem: g.stem, hua: g.hua,
    counts: groupCounts(g), group: g, hydrolysis: g.hydrolysis,
  })),
  ...MONO_ANIONS.map((m) => ({
    ascii: m.el, name: `${m.stem}离子`, charge: m.charge, stem: m.stem, hua: true,
    counts: { [m.el]: 1 } as CountMap, mono: { el: m.el }, monoWithCat: m.monoWithCat,
  })),
];

/* ============================================================
 * 三、CountMap 工具
 * ========================================================== */

function subCounts(a: CountMap, b: CountMap): CountMap | null {
  const out: CountMap = { ...a };
  for (const el of Object.keys(b)) {
    out[el] = (out[el] || 0) - b[el];
    if (out[el] < 0) return null;
  }
  const clean: CountMap = {};
  Object.keys(out).forEach((el) => { if (out[el] > 0) clean[el] = out[el]; });
  return clean;
}
function mulCounts(c: CountMap, k: number): CountMap {
  const out: CountMap = {};
  Object.keys(c).forEach((el) => { out[el] = c[el] * k; });
  return out;
}
/** rest 是否恰好等于 k 个 unit；否则返回 0 */
function fitMultiple(rest: CountMap, unit: CountMap): number {
  const keys = new Set([...Object.keys(rest), ...Object.keys(unit)]);
  let k = -1;
  for (const el of keys) {
    const r = rest[el] || 0;
    const u = unit[el] || 0;
    if (u === 0) { if (r !== 0) return 0; continue; }
    if (r === 0 || r % u !== 0) return 0;
    const q = r / u;
    if (k < 0) k = q;
    else if (k !== q) return 0;
  }
  return Math.max(0, k);
}
function totalValence(c: CountMap): number {
  return Object.keys(c).reduce((sum, el) => sum + (VALENCE_E[el] ?? 0) * c[el], 0);
}

/* ============================================================
 * 四、几何生成
 * ========================================================== */

const TETRA: V3[] = [
  [1, 1, 1], [-1, -1, 1], [-1, 1, -1], [1, -1, -1],
];
function norm(v: V3): V3 {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
}
function shapeDirs(shape: Shape, n: number): V3[] {
  switch (shape) {
    case 'diatomic': return [[1, 0, 0]];
    case 'linear3': return [[1, 0, 0], [-1, 0, 0]];
    case 'bent': {
      // 中心孤对朝 −x，两根键张成约 115°
      const t = 57.5 * Math.PI / 180;
      return [[Math.cos(t), Math.sin(t), 0], [Math.cos(t), -Math.sin(t), 0]];
    }
    case 'trigonal':
      return [0, 1, 2].map((i) => {
        const a = Math.PI / 2 + i * 2 * Math.PI / 3;
        return [Math.cos(a), Math.sin(a), 0] as V3;
      });
    case 'pyramidal': {
      // 孤对朝 +y，三根键从 +y 轴偏 107°（三角锥）
      const polar = 107 * Math.PI / 180;
      return [0, 1, 2].map((i) => {
        const a = i * 2 * Math.PI / 3;
        return [Math.sin(polar) * Math.cos(a), Math.cos(polar), Math.sin(polar) * Math.sin(a)] as V3;
      });
    }
    case 'tetrahedral': return TETRA.map(norm);
    default: return Array(n).fill(0).map((_, i) => {
      const a = i * 2 * Math.PI / Math.max(1, n);
      return [Math.cos(a), 0, Math.sin(a)] as V3;
    });
  }
}

interface AppendResult { centerIdx: number; }
/** 把一个原子团追加到全局原子/键表，返回它的中心原子下标 */
function appendGroup(
  atoms: MolAtom[], bonds: Bond[], g: GroupDef, origin: V3,
  loneOverride: Record<number, number>,
): AppendResult {
  const ci = atoms.length;
  atoms.push({ el: g.center, pos: origin });
  const dirs = shapeDirs(g.shape, g.ligands.length);
  if (g.lonePairs) loneOverride[ci] = g.lonePairs * 2;
  g.ligands.forEach((el, i) => {
    const d = norm(dirs[i] ?? [1, 0, 0]);
    const L = bondLen(g.center, el);
    const li = atoms.length;
    atoms.push({ el, pos: [origin[0] + d[0] * L, origin[1] + d[1] * L, origin[2] + d[2] * L] });
    bonds.push({ a: ci, b: li, order: g.orders[i] ?? 1 });
    if (g.protonOn === i) {
      const hd = norm([d[0] * 0.6 + 0.5, d[1] * 0.6 + 0.7, d[2] * 0.6 + 0.3] as V3);
      const hi = atoms.length;
      atoms.push({
        el: 'H',
        pos: [atoms[li].pos[0] + hd[0] * 0.97, atoms[li].pos[1] + hd[1] * 0.97, atoms[li].pos[2] + hd[2] * 0.97],
      });
      bonds.push({ a: li, b: hi, order: 1 });
    }
  });
  return { centerIdx: ci };
}

/**
 * Lewis 形式电荷：FC = 价电子 − 孤对电子 − 成键电子对数(= Σ键级)。
 * 第二周期按八隅体反推孤对电子 8 − 2Σ键级；H 无孤对；第三周期超价(Σ>4)时取 0 孤对；
 * 三角锥 / 角形中心用表里的 lonePairs 显式覆盖。
 * 单原子离子不参与共价键，直接用它的离子电荷。
 */
/** 第二周期元素受八隅体约束；第三周期（P/S/Cl/Mn…）允许超价，不参与这条检查 */
const OCTET_ELEMENTS = new Set(['B', 'C', 'N', 'O', 'F']);
function lewisCheck(
  atoms: MolAtom[], bonds: Bond[],
  ionOverride: Record<number, number>, loneOverride: Record<number, number>,
): { charges: number[]; octetOk: boolean } {
  const B = atoms.map(() => 0);
  bonds.forEach((b) => {
    if (b.style === 'ionic') return;   // 离子键不提供共用电子对
    const o = b.order ?? 1;
    B[b.a] += o;
    B[b.b] += o;
  });
  let octetOk = true;
  const charges = atoms.map((a, i) => {
    // 单原子离子靠得失电子直接达到稀有气体构型，不按「成键八隅体」判
    if (ionOverride[i] !== undefined) return ionOverride[i];
    const V = VALENCE_E[a.el] ?? 0;
    let lone = loneOverride[i];
    if (lone === undefined) {
      if (a.el === 'H') lone = 0;
      else if (B[i] > 4) lone = 0;                  // 第三周期超价
      else lone = Math.max(0, 8 - 2 * B[i]);        // 八隅体
    }
    // ★ 价电子壳层校验：第二周期 8 电子、H 2 电子，不满足就整体拒绝
    const need = a.el === 'H' ? 2 : 8;
    if ((OCTET_ELEMENTS.has(a.el) || a.el === 'H') && 2 * B[i] + lone !== need) octetOk = false;
    return V - lone - B[i];
  });
  return { charges, octetOk };
}

/* ============================================================
 * 五、识别 + 电荷守恒配平
 * ========================================================== */

interface Candidate {
  catMono: CationDef | null;
  catGroup: GroupDef | null;
  n: number;
  anion: AnionDef;
  k: number;
  /** 用于排序：越靠前越优先 */
  rank: number;
}

function findCandidates(counts: CountMap): Candidate[] {
  const out: Candidate[] = [];
  let rank = 0;

  // ① 单原子金属阳离子 + 阴离子（NaNO₃、Ba(N₃)₂、Fe(NO₃)₃，以及 Na₃N 这类氮化物）
  for (const cat of CATIONS) {
    const have = counts[cat.el] || 0;
    for (let n = 1; n <= have; n++) {
      const rest = subCounts(counts, { [cat.el]: n });
      if (!rest || !Object.keys(rest).length) continue;
      ANIONS.forEach((anion) => {
        if (!anion.group && !anion.monoWithCat) return;   // 卤化物 / 氧化物仍归原有晶体说明
        const k = fitMultiple(rest, anion.counts);
        if (k < 1) return;
        if (n * cat.charge !== k * -anion.charge) return;   // ★ 电中性：变价金属的价态由它反推
        out.push({ catMono: cat, catGroup: null, n, anion, k, rank: rank++ });
      });
    }
  }

  // ② 铵根（多原子阳离子）+ 任意阴离子：NH₄NO₃、NH₄Cl、(NH₄)₂SO₄…
  for (let n = 1; n <= 6; n++) {
    const rest = subCounts(counts, mulCounts(groupCounts(NH4), n));
    if (!rest || !Object.keys(rest).length) continue;
    ANIONS.forEach((anion) => {
      const k = fitMultiple(rest, anion.counts);
      if (k < 1) return;
      if (n * NH4.charge !== k * -anion.charge) return;
      out.push({ catMono: null, catGroup: NH4, n, anion, k, rank: rank++ + 1000 });
    });
  }
  return out;
}

const SUB: Record<string, string> = {
  '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄',
  '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉',
};
const SUP: Record<string, string> = {
  '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
  '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
};
/** ASCII 式 → 下标式（只用于说明文案；formulaAscii 字段本身仍保持 ASCII） */
function pretty(ascii: string): string {
  return ascii.replace(/[0-9]/g, (d) => SUB[d] ?? d);
}
/** 电荷 → 上标：−1 → ⁻、−2 → ²⁻、+3 → ³⁺ */
function chargeText(q: number): string {
  if (!q) return '';
  const a = Math.abs(q);
  return (a > 1 ? String(a).replace(/[0-9]/g, (d) => SUP[d] ?? d) : '') + (q > 0 ? '⁺' : '⁻');
}

function formulaAsciiOf(c: Candidate): string {
  const cat = c.catGroup
    ? (c.n > 1 ? `(NH4)${c.n}` : 'NH4')
    : c.catMono
      ? (c.n > 1 ? `${c.catMono.el}${c.n}` : c.catMono.el)
      : '';
  const an = c.k > 1
    ? (c.anion.group ? `(${c.anion.ascii})${c.k}` : `${c.anion.ascii}${c.k}`)
    : c.anion.ascii;
  return cat + an;
}

function saltNameOf(c: Candidate): string {
  const cn = c.catGroup ? '铵' : (c.catMono?.cn ?? '');
  return `${c.anion.stem}${c.anion.hua ? '化' : ''}${cn}`;
}

function acidityOf(c: Candidate): AcidInfo | undefined {
  const anionBasic = c.anion.hydrolysis === 'base';
  const cationAcidic = c.catGroup === NH4;
  if (anionBasic && !cationAcidic) {
    return { label: '弱碱', explain: `${c.anion.name}是弱酸的共轭碱，在水中水解出 OH⁻，溶液呈弱碱性（示意）。` };
  }
  if (cationAcidic && !anionBasic) {
    return { label: '弱酸', explain: 'NH₄⁺ 是弱碱 NH₃·H₂O 的共轭酸，水解出 H⁺，溶液呈弱酸性（示意）。' };
  }
  return undefined;
}

/* ============================================================
 * 六、电子转移 / 共价电子说明
 * ========================================================== */

function groupAtomCount(g: GroupDef): number {
  return 1 + g.ligands.length + (g.protonOn !== undefined ? 1 : 0);
}
/** 「3 个 N」还是「4 个原子」：团内元素单一时写出元素符号更直观 */
function groupAtomWord(g: GroupDef): string {
  const els = new Set([g.center, ...g.ligands, ...(g.protonOn !== undefined ? ['H'] : [])]);
  const n = groupAtomCount(g);
  return els.size === 1 ? `${n} 个 ${g.center}` : `${n} 个原子`;
}
/** 阳离子为什么是这个价态：从价电子构型讲清楚，而不是只背一句「金属显正价」 */
function cationValenceReason(cat: CationDef): string {
  if (cat.el === 'Li' || cat.el === 'Na' || cat.el === 'K') {
    return `${cat.cn}是碱金属，最外层只有 1 个电子（ns¹），失去它即达到稀有气体的稳定 8 电子构型，所以在化合物中稳定呈 +1 价`;
  }
  if (cat.el === 'Mg' || cat.el === 'Ca' || cat.el === 'Ba') {
    return `${cat.cn}是碱土金属，最外层有 2 个电子（ns²），失去后同样达到稳定 8 电子构型，所以稳定呈 +2 价`;
  }
  if (cat.el === 'Al') return '铝最外层有 3 个电子，失去后达到氖的稳定构型，所以稳定呈 +3 价';
  if (cat.el === 'Fe' || cat.el === 'Cu') {
    return `${cat.cn}是可变价金属，这里取 +${cat.charge} 价，是由下面的电荷守恒反推出来的`;
  }
  return `${cat.cn}在这里呈 +${cat.charge} 价`;
}

/* ============================================================
 * 七、主入口
 * ========================================================== */

export function buildIonicCompound(counts: CountMap): IonicBuilt | null {
  const candidates = findCandidates(counts);
  if (!candidates.length) return null;
  // 优先：单原子金属路径（更常见）→ 团在表中的顺序 → 更少的离子个数
  candidates.sort((x, y) => (x.rank - y.rank) || ((x.n + x.k) - (y.n + y.k)));
  const c = candidates[0];

  const atoms: MolAtom[] = [];
  const bonds: Bond[] = [];
  const ionOverride: Record<number, number> = {};
  const loneOverride: Record<number, number> = {};
  const anionCenters: number[] = [];
  const cationCenters: number[] = [];

  const SPREAD = 5.2;
  const CAT_Y = 3.6;

  // 1) 阴离子：每个都是**一份完整、独立的原子团骨架**
  for (let i = 0; i < c.k; i++) {
    const origin: V3 = [(i - (c.k - 1) / 2) * SPREAD, 0, 0];
    if (c.anion.group) {
      anionCenters.push(appendGroup(atoms, bonds, c.anion.group, origin, loneOverride).centerIdx);
    } else {
      const idx = atoms.length;
      atoms.push({ el: c.anion.mono?.el ?? c.anion.ascii, pos: origin });
      anionCenters.push(idx);
      // 单原子阴离子没有共价键，形式电荷直接就是它的离子电荷
      ionOverride[idx] = c.anion.charge;
    }
    // ⚠️ 多原子阴离子**不能**把团电荷盖在中心原子上：
    //    NO₃⁻ 的中心 N 形式电荷是 +1、两个单键 O 各 −1，合计才是 −1。
    //    盖成 −1 会让整式净电荷变成 −3，电中性校验直接失败。
  }

  // 2) 阳离子：孤立摆放（NH₄⁺ 自己也是一个完整骨架）
  for (let j = 0; j < c.n; j++) {
    const origin: V3 = [(j - (c.n - 1) / 2) * 2.1, CAT_Y, 0];
    if (c.catGroup) {
      cationCenters.push(appendGroup(atoms, bonds, c.catGroup, origin, loneOverride).centerIdx);
      // NH₄⁺ 的 +1 由 Lewis 形式电荷自然给出（N 为 +1、四个 H 为 0），不额外覆盖
    } else if (c.catMono) {
      const idx = atoms.length;
      atoms.push({ el: c.catMono.el, pos: origin });
      ionOverride[idx] = c.catMono.charge;
      cationCenters.push(idx);
    }
  }

  // 3) 离子键：淡灰细线只表示静电作用，不是共用电子对
  for (let j = 0; j < cationCenters.length; j++) {
    const ai = Math.min(c.k - 1, Math.floor((j * c.k) / Math.max(1, c.n)));
    bonds.push({ a: cationCenters[j], b: anionCenters[ai], order: 1, style: 'ionic' });
  }
  if (c.k > c.n) {
    for (let i = c.n; i < c.k; i++) {
      bonds.push({ a: cationCenters[0], b: anionCenters[i], order: 1, style: 'ionic' });
    }
  }

  // 4) ★ 双重硬校验：第二周期满足八隅体，且逐原子 Lewis 形式电荷之和必须为 0
  const { charges, octetOk } = lewisCheck(atoms, bonds, ionOverride, loneOverride);
  const net = charges.reduce((a, b) => a + b, 0);
  if (!octetOk || net !== 0) return null;

  const name = saltNameOf(c);
  const formulaAscii = formulaAsciiOf(c);
  const catName = c.catGroup ? NH4.name : `${c.catMono?.cn ?? ''}离子`;
  const catQ = c.catGroup ? NH4.charge : (c.catMono?.charge ?? 0);
  const anQ = -c.anion.charge;
  const totalV = totalValence(counts);
  const groupV = totalValence(c.anion.counts);
  const unitV = groupV + anQ;                  // 每个阴离子（团）分到的价电子总数
  const lostTotal = c.n * catQ;                // 阳离子交出的电子总数
  const gainedTotal = c.k * anQ;               // 阴离子得到的电子总数
  const pairCount = c.anion.group
    ? c.anion.group.orders.reduce((a, b) => a + b, 0) + (c.anion.group.protonOn !== undefined ? 1 : 0)
    : 0;                                      // 原子团内部的共用电子对数
  const cationLabel = `${c.n} 个${catName}（${c.catGroup ? 'NH₄⁺' : `${c.catMono?.el ?? ''}${chargeText(catQ)}`}）`;
  const anionLabel = `${c.k} 个${c.anion.name}（${pretty(c.anion.ascii)}${chargeText(c.anion.charge)}）`;
  const shapeNote = c.anion.group?.note ?? '';
  const neutrality = `${c.n} × (+${catQ}) + ${c.k} × (−${anQ}) = 0`;
  // 句子里写「整体 −1 电荷」而不是上标 ⁻ —— ⁻ 单独出现在正文里读不通
  const anChargeWord = `−${anQ}`;
  const anSym = `${pretty(c.anion.ascii)}${chargeText(c.anion.charge)}`;
  const who = c.anion.group ? groupAtomWord(c.anion.group) : '';

  const neutralityLine = c.catMono
    ? `${cationValenceReason(c.catMono)}；这个 +${catQ} 恰好平衡${c.anion.name}的整体 ${anChargeWord} 电荷，所以两种离子按 ${c.n} : ${c.k} 配成电中性的式量单元（${neutrality}）${['Fe', 'Cu'].includes(c.catMono.el) ? `，${c.catMono.el} 的价态正是由这条守恒反推出来的` : ''}。`
    : `NH₄⁺ 的整体 +1 恰好平衡${c.anion.name}的整体 ${anChargeWord} 电荷，所以两种离子按 ${c.n} : ${c.k} 配成电中性的式量单元（${neutrality}）。`;

  const transferLine = c.catMono
    ? `电子转移：${c.catMono.el} 共交出 ${lostTotal} 个电子，全部转给 ${c.k} 个${c.anion.name} —— ` +
      (c.anion.group
        ? c.k > 1
          ? `每个${c.anion.name}里的 ${who} 共得到 ${anQ} 个电子（合计 ${gainedTotal} 个），负电荷由整个原子团离域承担，不是某个原子独占`
          : `${who} 共得到 ${gainedTotal} 个电子，负电荷由整个原子团离域承担，不是某个原子独占`
        : c.k > 1
          ? `每个${c.anion.name}得到 ${anQ} 个电子（合计 ${gainedTotal} 个），凑满最外层 8 电子`
          : `这个${c.anion.name}得到 ${anQ} 个电子，凑满最外层 8 电子`) +
      `；${c.catMono.el}${chargeText(catQ)} 与 ${anSym} 之间没有共用电子对。`
    : `电子转移：NH₄⁺ 与${c.anion.name}之间同样没有共用电子对（离子键）；铵根的正电荷来自 NH₃ 把 N 上的一对孤对电子配给 H⁺（配位键），形成后 4 条 N–H 键完全等价，并不是 NH₄⁺ 把电子交给了阴离子。`;

  const covalentLine = c.anion.group
    ? `共价电子情况：${anSym} 内 ${groupAtomCount(c.anion.group)} 个原子共 ${unitV} 个价电子（中性原子团自身 ${groupV} 个 + 因带 ${anChargeWord} 电荷多出的 ${anQ} 个），其中 ${pairCount} 对、共 ${pairCount * 2} 个是原子间共用的成键电子，其余 ${unitV - pairCount * 2} 个以孤对电子留在各原子上；共价键只存在于原子团内部，原子团与阳离子之间没有共用电子对。`
    : `共价电子情况：${c.anion.name}是单原子离子，得到 ${anQ} 个电子后最外层凑满 8 电子，内部没有共价键。`;

  const desc = [
    `${name}（${pretty(formulaAscii)}）是离子化合物，由 ${cationLabel} 与 ${anionLabel} 构成。`,
    `电中性：${neutralityLine}`,
    transferLine,
    covalentLine,
    `Lewis 校验：按价电子数全式共 ${totalV} 个价电子；逐原子用「价电子 − 孤对电子 − 成键电子对」算形式电荷，合计 ${net}，与电中性一致，第二周期原子也都满足八隅体（H 为 2 电子）。`,
    shapeNote,
    '画面上阳离子独立在阴离子骨架之外，那条淡灰色细线只表示阴阳离子间的静电作用（离子键），不是共价键；真实晶体里离子按一定配位数无限堆积，这里只画 1 个式量单元。',
    '注：原子下钻面板里的价态标记取自 Lewis 形式电荷，用于核算电荷守恒；原子团中的负电荷往往是离域的，形式电荷不等于该原子真实带的净电荷。',
  ].filter(Boolean).join('\n');

  // 图上的短标签：阳离子上方标「交出几 e⁻」，阴离子下方标「几个原子共得几 e⁻」与团内共价电子。
  // 坐标与 atoms 同系（阳离子在 CAT_Y、阴离子在 y=0），引擎挂在 root 下随模型一起旋转。
  // ⚠️ 多个阴离子时不能说「3 个 N 共得 2 e⁻」（Ba(N₃)₂ 是每个 N₃⁻ 的 3 个 N 各得 1 个）；
  //    铵盐里电子也不是 NH₄⁺ 交给阴离子的，这两种情况都换一种说法。
  const gainLabel = c.catGroup
    ? `${anSym} · 离子键无共用电子对`
    : c.k > 1
      ? `${c.k} 个 ${anSym} 共得 ${gainedTotal} e⁻`
      : c.anion.group
        ? `${who} 共得 ${gainedTotal} e⁻`
        : `${anSym} 得到 ${anQ} e⁻`;
  const electronLabels: ElectronLabel[] = [
    {
      text: c.catMono
        ? (c.n > 1
          ? `${c.n} 个 ${c.catMono.el}${chargeText(catQ)} 共交出 ${lostTotal} e⁻`
          : `${c.catMono.el}${chargeText(catQ)} 交出 ${lostTotal} e⁻`)
        : 'NH₄⁺ · 4 条 N–H 共价键',
      pos: [0, CAT_Y + 0.9, 0],
      tone: c.catMono ? 'transfer' : 'covalent',
    },
    { text: gainLabel, pos: [0, -1.6, 0], tone: 'transfer' },
  ];
  if (c.anion.group) {
    electronLabels.push({
      text: `${anSym} 共价键共用 ${pairCount * 2} e⁻`,
      pos: [0, -2.35, 0],
      tone: 'covalent',
    });
  }

  return {
    name,
    formulaAscii,
    desc,
    atoms,
    bonds,
    charges,
    electronLabels,
    acidity: acidityOf(c),
  };
}

/* ============================================================
 * 八、化学式可行性：别让「不成立」的式子画出假结构
 * ========================================================== */

const METAL_ELS = new Set(CATIONS.map((c) => c.el));

/**
 * 常见离子价态，只用于「这个式子有没有可能电中性」的粗校验。
 * 一元素多价时允许同种元素的不同原子取不同价（Fe₃O₄ 的 Fe 是 +2/+3 混合），
 * 否则会把这类真实化合物误判成不成立。
 * C / Si / P / B 故意不列：含它们的式子多半是有机盐或共价晶体，不归这条防线管
 * （一律视为「不否决」，交回原有 builder）。
 */
const ION_VALENCE: Record<string, number[]> = {
  Li: [1], Na: [1], K: [1], Ag: [1],
  Mg: [2], Ca: [2], Ba: [2], Zn: [2], Mn: [2], Pb: [2, 4],
  Al: [3], Cr: [3, 6], Fe: [2, 3], Cu: [1, 2],
  H: [-1, 1], N: [-3], F: [-1], Cl: [-1], Br: [-1], I: [-1], S: [-2],
  O: [-2, -1],
};

function sumsOf(opts: number[], n: number): Set<number> {
  let cur = new Set<number>([0]);
  for (let i = 0; i < n; i++) {
    const next = new Set<number>();
    cur.forEach((s) => opts.forEach((o) => next.add(s + o)));
    cur = next;
  }
  return cur;
}

/**
 * 穷举常见价态，判断这个原子计数有没有可能满足电荷守恒。
 * NaN₂：Na 只能 +1，2 个 N 至少要 −6，总和永远为负 ⇒ 不可能电中性。
 * Na₃N / Ca₃N₂ / Fe₃O₄ / Na₂O₂ 都能配平 ⇒ 放行给原有 builder。
 */
export function chargeBalancePossible(counts: CountMap): boolean {
  const els = Object.keys(counts).filter((el) => (counts[el] || 0) > 0);
  if (!els.length || !els.some((el) => METAL_ELS.has(el))) return true;
  if (!els.every((el) => ION_VALENCE[el] !== undefined)) return true;
  let sums = new Set<number>([0]);
  for (const el of els) {
    const n = counts[el] || 0;
    if (n > 12) return true;
    let part: Set<number>;
    if (el === 'O' && n >= 2) {
      // 过氧根 O₂²⁻ / 超氧根 O₂⁻ 里 O 不是 −2 价（甚至不是整数价）。
      // 放宽成「n 个 O 整体带 −2n ~ −1」，只为不误伤这类真实化合物。
      part = new Set<number>();
      for (let q = -2 * n; q <= -1; q++) part.add(q);
    } else {
      part = sumsOf(ION_VALENCE[el], n);
    }
    const next = new Set<number>();
    sums.forEach((s) => part.forEach((p) => next.add(s + p)));
    sums = next;
  }
  return sums.has(0);
}

function gcd2(a: number, b: number): number { return b ? gcd2(b, a % b) : a; }
function sameCounts(a: CountMap, b: CountMap): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) if ((a[k] || 0) !== (b[k] || 0)) return false;
  return true;
}

/**
 * 输入式不成立时，给出「同元素集合、按已知离子正确配平」的候选式。
 * NaN₂ → Na3N（氮化钠）、NaN3（叠氮化钠），让用户知道该改输什么。
 */
export function suggestIonicFormulas(counts: CountMap, limit = 3): string[] {
  const want = new Set(Object.keys(counts).filter((el) => (counts[el] || 0) > 0));
  const out: string[] = [];
  for (const cat of CATIONS) {
    if (!want.has(cat.el)) continue;
    for (const an of ANIONS) {
      const g = gcd2(cat.charge, -an.charge);
      const n = -an.charge / g;
      const k = cat.charge / g;
      const made: CountMap = { [cat.el]: n };
      Object.keys(an.counts).forEach((el) => { made[el] = (made[el] || 0) + an.counts[el] * k; });
      const els = Object.keys(made).filter((e) => (made[e] || 0) > 0);
      if (els.length !== want.size || els.some((e) => !want.has(e))) continue;
      if (sameCounts(made, counts)) continue;      // 正是输入本身，不必建议
      const catTxt = n > 1 ? `${cat.el}${n}` : cat.el;
      const anTxt = k > 1 ? (an.group ? `(${an.ascii})${k}` : `${an.ascii}${k}`) : an.ascii;
      const f = catTxt + anTxt;
      if (!out.includes(f)) out.push(f);
    }
  }
  return out.slice(0, limit);
}
