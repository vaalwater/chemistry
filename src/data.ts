import raw from '../data/content.json';
import type { AcidLabel, Content, ElementData, MoleculeData, ReactionData, SceneReq } from './types';
import { buildCatalogOrganic, buildMoleculeForFormula, displayFormula, normalizeFormula, sameFormula } from './formulaBuilder';
import { buildNitrogenCatalog } from './nitrogenLib';
import { buildBioCatalog } from './nitrogenBio';

export const content = raw as Content;

export const SHELL_LABELS = ['K', 'L', 'M', 'N', 'O', 'P', 'Q'];

/** 内容库之外的扩展分子：有机物代表物 + 含氮化合物 + 生物碱/含氮高分子 */
const catalogMolecules: MoleculeData[] = buildCatalogOrganic();
const nitrogenMolecules: MoleculeData[] = buildNitrogenCatalog();
const bioMolecules: MoleculeData[] = buildBioCatalog();
const extraMolecules: MoleculeData[] = [...catalogMolecules, ...nitrogenMolecules, ...bioMolecules];

/** 全部可浏览分子：内容库 + 扩展分子 */
export function allMolecules(): MoleculeData[] {
  return [...content.molecules, ...extraMolecules];
}

export function elementBySymbol(symbol: string): ElementData | undefined {
  return content.elements.find((e) => e.symbol === symbol);
}

export function moleculeById(id: string): MoleculeData | undefined {
  const hit = content.molecules.find((m) => m.id === id) ?? extraMolecules.find((m) => m.id === id);
  if (hit) return hit;
  // 反应库中直接用“分子式”作为物种 id 的条目（如 Fe3O4、HNO3、Cu(NO3)2…），
  // 未收录进浏览目录时按公式自动建模，保证点击/输入也能进入 3D 演示。
  const na = normalizeFormula(id);
  if (!na) return undefined;
  const gen = buildMoleculeForFormula(na);
  const made: MoleculeData = {
    id,
    name: '',
    formula: displayFormula(na),
    category: '反应中间物种',
    level: '必修',
    scene: 'molecule',
    desc: '',
    formulaAscii: na,
  };
  if (gen && gen.atoms && gen.atoms.length) {
    made.atoms = gen.atoms;
    made.bonds = gen.bonds;
  }
  return made;
}

export function reactionById(id: string): ReactionData | undefined {
  return content.reactions.find((r) => r.id === id);
}

export function shellCountText(el: ElementData): string {
  return el.shells.map((n, i) => `${SHELL_LABELS[i] || '?'}${n}`).join(' · ');
}

/** 元素在周期表中的电子排布简写，如 Na: 2,8,1 */
export function electronArrange(el: ElementData): string {
  return el.shells.join(',');
}

/** 用元素符号列出某分子含有的元素（用于标题辅助） */
export function moleculeElementList(m: MoleculeData): string {
  if (!m.atoms) return m.formula;
  const set: string[] = [];
  m.atoms.forEach((a) => {
    if (!set.includes(a.el)) set.push(a.el);
  });
  return set.join(' · ');
}

const SUP_DIGITS: Record<string, string> = {
  '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
  '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
};

/** 生成带电荷的元素写法，如 Na → Na⁺、O → O²⁻、Cl → Cl⁻ */
export function ionChargeText(symbol: string, charge: number): string {
  if (!charge) return symbol;
  const a = Math.abs(charge);
  const sup = a > 1 ? String(a).split('').map((c) => SUP_DIGITS[c] ?? c).join('') : '';
  return `${symbol}${sup}${charge > 0 ? '⁺' : '⁻'}`;
}

const SHELL_CAPACITY = [2, 8, 18, 18, 18];

/** 按离子态总电子数（质子数 - 电荷）重排电子层；电荷为 0 时返回中性排布 */
export function shellsForIon(el: ElementData, charge: number): number[] {
  if (!charge) return el.shells.slice();
  let n = el.p - charge;
  const out: number[] = [];
  for (let i = 0; n > 0; i++) {
    const cap = i < SHELL_CAPACITY.length ? SHELL_CAPACITY[i] : 18;
    const c = Math.min(cap, n);
    if (c > 0) out.push(c);
    n -= c;
  }
  return out.length ? out : [0];
}

/** 求 atom 场景中该原子在其来源分子/晶体里的离子电荷 */
export function atomChargeOf(scene: SceneReq, el: ElementData): number {
  if (scene.kind !== 'atom' || !scene.molId) return 0;
  const mol = scene.mol ?? moleculeById(scene.molId);
  if (!mol) return 0;
  if (mol.scene === 'lattice') {
    return el.symbol === 'Na' ? 1 : el.symbol === 'Cl' ? -1 : 0;
  }
  const ai = scene.ai;
  if (!mol.atoms || typeof ai !== 'number' || ai < 0 || ai >= mol.atoms.length) return 0;
  return mol.charges?.[ai] ?? 0;
}

/* ================= 分子式检索 / 酸碱性 ================= */

const CJK_RE = /[\u4e00-\u9fff]/;

/** 在全部内容中按「分子式 / 中文名」找分子；找不到返回 undefined */
export function libraryMoleculeByInput(raw: string): MoleculeData | undefined {
  const s = raw.trim();
  if (!s) return undefined;
  if (CJK_RE.test(s)) {
    const list = allMolecules();
    return list.find((m) => m.name === s) ?? list.find((m) => m.name.includes(s));
  }
  const norm = normalizeFormula(s);
  if (!norm) return undefined;
  return allMolecules().find((m) => sameFormula(m.formulaAscii ?? m.formula, norm));
}

export interface ResolvedMolecule {
  mol: MoleculeData;
  from: 'lib' | 'gen';
}

/** 首页输入框检索：库内优先，其次自动建模（烷/烯/炔/醇/酸/苯/葡萄糖等） */
export function resolveMoleculeInput(raw: string): ResolvedMolecule | null {
  const s = raw.trim();
  if (!s) return null;
  const lib = libraryMoleculeByInput(s);
  if (lib) return { mol: lib, from: 'lib' };
  const built = buildMoleculeForFormula(s);
  if (built) return { mol: built, from: 'gen' };
  return null;
}

/** 酸碱性徽标配色 */
export function acidityTone(label: AcidLabel): { bg: string; fg: string } {
  switch (label) {
    case '强酸': return { bg: '#fdeaea', fg: '#cf3f37' };
    case '弱酸': return { bg: '#fdf0e3', fg: '#d97a1f' };
    case '强碱': return { bg: '#e6f1fe', fg: '#2c6fd6' };
    case '弱碱': return { bg: '#e5f7f6', fg: '#1f9d93' };
    case '中性': return { bg: '#eef1f5', fg: '#677a92' };
  }
}

/* ================= 电子构型（轨道亚层表示，如 1s² 2s² 2p⁶） ================= */

const SS_LETTERS = ['s', 'p', 'd', 'f'];
const SS_CAP = [2, 6, 10, 14];
const SUP_DIGIT: Record<string, string> = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹' };

function supText(n: number): string {
  return String(n)
    .split('')
    .map((c) => SUP_DIGIT[c] ?? c)
    .join('');
}

/** 将各层电子数转成亚层写法（如 [2,8,14,2] → ['1s²','2s²2p⁶','3s²3p⁶3d⁶','4s²']）。
 *  按主量子数分壳、壳内按 s/p/d/f 填充，与常见基态构型顺序一致。 */
export function electronShellConfigs(shells: number[]): string[] {
  return shells.map((n, k) => {
    const parts: string[] = [];
    let rest = n;
    let si = 0;
    while (rest > 0 && si < SS_LETTERS.length) {
      const c = Math.min(SS_CAP[si], rest);
      if (c > 0) parts.push(`${k + 1}${SS_LETTERS[si]}${supText(c)}`);
      rest -= c;
      si++;
    }
    return parts.join('');
  });
}

/** 完整电子构型文本，如「1s² 2s² 2p⁴」；也可在括号中给出亚层简写 */
export function electronConfigText(shells: number[]): string {
  return electronShellConfigs(shells).join(' ');
}

/** 按“八隅体规则”生成一句稳定结构提示（用于原子详情卡）。原子未成键时最外层趋向满壳（H/He 为 2，其余为 8）。 */
export function octetRuleText(shells: number[]): string {
  const onlyK = shells.length <= 1;
  const val = shells[shells.length - 1] ?? 0;
  const target = onlyK ? 2 : 8;
  if (val >= target) {
    return onlyK
      ? `最外层 ${val} e⁻，已达 2 电子满壳（类氦稳定结构）`
      : `最外层 ${val} e⁻ 已满壳，符合八隅体稳定结构（稀有气体构型）`;
  }
  return onlyK
    ? `最外层 ${val} e⁻，距 2 电子满壳还差 ${target - val} 个 · 常通过与相邻原子共用电子对趋稳`
    : `最外层 ${val} e⁻，按八隅体规则距 8 e⁻ 还差 ${target - val} 个 · 倾向得失或共用电子趋稳`;
}

/** 把某一层的电子数拆成 s/p/d/f 四个亚层（壳内按 s→p→d→f 贪心填充） */
export function subshellCounts(total: number): { s: number; p: number; d: number; f: number } {
  const out = { s: 0, p: 0, d: 0, f: 0 };
  const keys = ['s', 'p', 'd', 'f'] as const;
  let rest = total;
  for (let i = 0; i < keys.length && rest > 0; i++) {
    const c = Math.min(SS_CAP[i], rest);
    out[keys[i]] = c;
    rest -= c;
  }
  return out;
}

export interface ValenceInfo {
  /** 最外层是第几层（主量子数） */
  outerShell: number;
  /** 最外层电子数 */
  outerE: number;
  /** 最外层的亚层写法，如 ['4s²'] */
  outerParts: string[];
  /** 价电子总数 */
  valenceE: number;
  /** 价电子由哪些亚层构成，如 ['3d⁶', '4s²'] */
  parts: string[];
  /** 次外层 d 亚层未满 —— 即过渡元素，d 电子也要算进价电子 */
  isTransition: boolean;
  /** 一句解释 */
  note: string;
}

/** 能量由低到高的填充顺序（构造原理 / Aufbau）：4s 低于 3d、6s 低于 4f 低于 5d… */
const AUFBAU: { n: number; l: string; cap: number }[] = [
  { n: 1, l: 's', cap: 2 },
  { n: 2, l: 's', cap: 2 }, { n: 2, l: 'p', cap: 6 },
  { n: 3, l: 's', cap: 2 }, { n: 3, l: 'p', cap: 6 },
  { n: 4, l: 's', cap: 2 }, { n: 3, l: 'd', cap: 10 }, { n: 4, l: 'p', cap: 6 },
  { n: 5, l: 's', cap: 2 }, { n: 4, l: 'd', cap: 10 }, { n: 5, l: 'p', cap: 6 },
  { n: 6, l: 's', cap: 2 }, { n: 4, l: 'f', cap: 14 }, { n: 5, l: 'd', cap: 10 }, { n: 6, l: 'p', cap: 6 },
  { n: 7, l: 's', cap: 2 }, { n: 5, l: 'f', cap: 14 }, { n: 6, l: 'd', cap: 10 }, { n: 7, l: 'p', cap: 6 },
];
const AUFBAU_RANK: Record<string, number> = {};
AUFBAU.forEach((o, i) => { AUFBAU_RANK[`${o.n}${o.l}`] = i; });

/**
 * 价电子 = 能参与成键、决定化合价的电子。
 *
 * ⚠️ 它**不等于**最外层电子数，这是高中最容易混的地方：
 *    - 主族元素：两者相等（Na 最外层 1 个 = 价电子 1 个）；
 *    - 过渡金属：次外层**未充满**的 d 电子也参与成键，于是
 *      Fe 最外层只有 4s² 这 2 个，价电子却是 3d⁶ + 4s² = 8 个 —— 这正是它常见 +2、+3 价的原因；
 *    - d 亚层已充满 10 个时不再计入（Zn 的 3d¹⁰ 很稳定，价电子就只是 4s² 这 2 个），
 *      这也符合「过渡元素 = 原子基态具有未满 d 亚层」的定义，所以 Cu/Zn/Ag 不算过渡元素。
 *
 * ⚠️ 必须按**能量**顺序（Aufbau）从高往低数，不能只按主量子数分层：
 *    Fe²⁺ 失去 4s² 之后排布变成 [Ar]3d⁶，第 3 层成了「最外层」，
 *    但 3s²3p⁶ 是闭壳内层、并不参与成键 —— 若按层号硬算会得出「价电子 14」这种荒谬结果。
 */
export function valenceInfo(shells: number[]): ValenceInfo {
  const n = shells.length;
  const outerE = shells[n - 1] ?? 0;
  const outer = subshellCounts(outerE);

  const outerParts: string[] = [];
  if (outer.s) outerParts.push(`${n}s${supText(outer.s)}`);
  if (outer.p) outerParts.push(`${n}p${supText(outer.p)}`);

  // 特例 Pd（[Kr]4d¹⁰）：它压根没有更外的 s 电子，最外层本身就是已充满的 d 亚层，
  // 这时「最外层电子数」会得出 18 这种没有化学意义的数字，单独说明
  if (n >= 4 && outer.d === 10 && outer.p === 6) {
    return {
      outerShell: n,
      outerE,
      outerParts,
      valenceE: 10,
      parts: [`${n}d¹⁰`],
      isTransition: false,
      note: `最外层（第 ${n} 层）本身就是已充满的 d 亚层 ${n}d¹⁰，外面没有 s 电子 —— Pd 是唯一这样的元素，它的价电子就是这 10 个 d 电子。`,
    };
  }

  // 展开所有被占据的亚层，按能量从高到低遍历
  const occ: { n: number; l: string; e: number; cap: number }[] = [];
  shells.forEach((total, k) => {
    const c = subshellCounts(total);
    (['s', 'p', 'd', 'f'] as const).forEach((l, li) => {
      if (c[l] > 0) occ.push({ n: k + 1, l, e: c[l], cap: SS_CAP[li] });
    });
  });
  occ.sort((a, b) => (AUFBAU_RANK[`${b.n}${b.l}`] ?? 0) - (AUFBAU_RANK[`${a.n}${a.l}`] ?? 0));

  let sum = 0;
  const picked: { n: number; l: string; e: number }[] = [];
  let countedDF = false;
  for (let idx = 0; idx < occ.length; idx++) {
    const o = occ[idx];
    const full = o.e >= o.cap;
    if (o.l === 'd' || o.l === 'f') {
      if (full) continue;                       // 已充满的 d/f 是闭壳内层，跳过继续往下找
      sum += o.e; countedDF = true; picked.push(o);
      continue;                                 // 未满的 d/f 参与成键，继续带上更外侧的 s
    }
    if (o.l === 's') { sum += o.e; picked.push(o); break; }   // s 无论满否都计入，到此为止
    // p 亚层：只有当它是**能量最高**的亚层时，才是稀有气体那样的 8 电子闭壳；
    // 若上方还盖着 d/f 电子（Cu⁺ 的 3d¹⁰ 压在 3p⁶ 上），这层 p 是内层，不能计入
    if (full && (countedDF || idx > 0)) break;
    sum += o.e; picked.push(o);
    const sameS = occ.find((x) => x.n === o.n && x.l === 's'); // 主族的 ns² 同样参与成键
    if (sameS) { sum += sameS.e; picked.push(sameS); }
    break;
  }

  // 显示时按常规书写顺序（主量子数从小到大、同层 s→p→d→f），而不是能量顺序
  picked.sort((a, b) => a.n - b.n || ['s', 'p', 'd', 'f'].indexOf(a.l) - ['s', 'p', 'd', 'f'].indexOf(b.l));
  const parts = picked.map((o) => `${o.n}${o.l}${supText(o.e)}`);
  const valenceE = sum;

  let note: string;
  if (!countedDF && valenceE === 0) {
    note = `已填满的最外亚层之上再无电子，是稳定的闭壳结构（如 Na⁺、Cl⁻、Cu⁺ 这类离子），一般不再得失电子。`;
  } else if (countedDF) {
    note = `${parts.join('、')} 上的电子都能参与成键，所以价电子是 ${valenceE} 个（不只是最外层的 ${outerE} 个）；它们可以部分失去，因此往往不止一种化合价。`;
  } else if (outerE >= (n <= 1 ? 2 : 8)) {
    note = `最外层 ${outerE} 个电子已满壳，一般不再参与成键，所以化合价通常为 0。`;
  } else {
    note = `价电子就是最外层的 ${valenceE} 个电子（${parts.join(' + ')}），得失或共用这些电子即达到稳定结构。`;
  }
  return { outerShell: n, outerE, outerParts, valenceE, parts, isTransition: countedDF, note };
}
