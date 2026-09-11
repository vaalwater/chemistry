import raw from '../data/content.json';
import type { AcidLabel, Content, ElementData, MoleculeData, ReactionData, SceneReq } from './types';
import { buildCatalogOrganic, buildMoleculeForFormula, displayFormula, normalizeFormula, sameFormula } from './formulaBuilder';

export const content = raw as Content;

export const SHELL_LABELS = ['K', 'L', 'M', 'N', 'O', 'P', 'Q'];

/** 内容库之外的扩展有机物（甲烷/乙醇等常见物已在 content.json 内，这里补充 6 个代表物） */
const catalogMolecules: MoleculeData[] = buildCatalogOrganic();

/** 全部可浏览分子：内容库 + 扩展有机物 */
export function allMolecules(): MoleculeData[] {
  return [...content.molecules, ...catalogMolecules];
}

export function elementBySymbol(symbol: string): ElementData | undefined {
  return content.elements.find((e) => e.symbol === symbol);
}

export function moleculeById(id: string): MoleculeData | undefined {
  const hit = content.molecules.find((m) => m.id === id) ?? catalogMolecules.find((m) => m.id === id);
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
