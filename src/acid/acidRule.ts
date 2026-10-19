/* =========================================================================
 * 酸碱性：物质溶于水后的「电离 / 水解」判定与动画脚本
 * -------------------------------------------------------------------------
 * 这一层只负责化学逻辑与文案，3D 动画由 engine/acid/acid.js 播放。
 * 核心教学点：
 *   酸性 = 溶液里 H⁺ 比 OH⁻ 多；碱性 = OH⁻ 比 H⁺ 多；中性 = 两者相等。
 *   水自身电离出等量的 H⁺ 和 OH⁻（基线 1 : 1），谁把这个平衡打破，谁决定酸碱性。
 * ========================================================================= */

export type Verdict = 'acid' | 'base' | 'neutral';
/** 从水分子里抢走的部分 / 释放到溶液里的离子 */
export type TakeIon = 'H' | 'OH';

export interface AcidParticle {
  label: string; // 'NH₄⁺'
  /** 电荷：+1 / -1 / -2 / +2 / +3 */
  charge: number;
  /** active = 会水解或继续电离；spectator = 旁观离子（只水合，不反应） */
  role: 'active' | 'spectator';
}

export interface HydrolysisSpec {
  /** 发生水解的离子，如 'NH₄⁺' */
  ion: string;
  /** 从水分子里抢走 OH⁻ 还是 H⁺ */
  take: TakeIon;
  /** 生成的弱电解质，如 'NH₃·H₂O' */
  product: string;
  /** 同时释放到溶液里的离子 */
  release: TakeIon;
  /** 动画里演示几个该离子发生水解（默认 1） */
  count?: number;
}

export interface IonizationSpec {
  /** 继续电离的离子，如 'HSO₄⁻' */
  ion: string;
  into: { label: string; charge: number }[];
  /** 完全电离（强酸的酸式根）还是部分电离 */
  full: boolean;
  /** 动画里演示几个（完全电离默认 3，部分默认 1） */
  count?: number;
}

export interface AcidCase {
  id: string;
  name: string;
  formula: string;
  /** 分类：'强酸' / '弱酸' / '强碱' / '弱碱' / '强酸弱碱盐' … */
  group: string;
  groupKey: 'acid' | 'base' | 'salt';
  verdict: Verdict;
  /** 一句话结论 */
  headline: string;
  /** 盐 = 直接解离成离子；分子 = 先以分子分散再电离 */
  form: 'salt' | 'molecule';
  /** form === 'salt' 时解离出的离子 */
  ions: AcidParticle[];
  /** form === 'molecule' 时的溶质分子式 */
  molecule?: string;
  /** 强酸 / 强碱 = 完全电离 */
  moleculeFull?: boolean;
  /** 分子电离的产物 */
  moleculeIons?: { label: string; charge: number }[];
  hydrolysis?: HydrolysisSpec[];
  ionization?: IonizationSpec;
  /** 主方程式 */
  equation: string;
  /** 讲解 */
  why: string;
  /** 易混对比 */
  compare?: string;
}

/* ------------------------------------------------------------------ 动画节拍 */

export type AcidBeat =
  | { kind: 'intro'; title: string; text: string }
  | { kind: 'dissolve'; title: string; text: string }
  | { kind: 'ionize'; title: string; text: string; full: boolean }
  | { kind: 'hydrate'; title: string; text: string }
  | { kind: 'hydrolyze'; title: string; text: string; spec: HydrolysisSpec }
  | { kind: 'ionizeIon'; title: string; text: string; spec: IonizationSpec }
  | {
      kind: 'compete';
      title: string;
      text: string;
      hyd: HydrolysisSpec;
      ion: IonizationSpec;
      /** 占优的一方 */
      winner: 'hydrolysis' | 'ionization';
    }
  | { kind: 'tally'; title: string; text: string };

const ionText = (list: { label: string }[]) => list.map((i) => i.label).join(' + ');

/** 把一个物质翻译成动画节拍序列 */
export function buildScript(c: AcidCase): AcidBeat[] {
  const beats: AcidBeat[] = [];

  beats.push({
    kind: 'intro',
    title: `把 ${c.formula} 放进水里`,
    text:
      '水里本来就有极少量 H⁺ 和 OH⁻（水自身电离，H₂O ⇌ H⁺ + OH⁻），它们数量相等、互不压制 —— 这是判断酸碱性的起跑线。',
  });

  if (c.form === 'salt') {
    beats.push({
      kind: 'dissolve',
      title: '溶解 · 解离成离子',
      text: `${c.formula} 在水中解离成 ${ionText(c.ions)}。这一步只是「分开」，离子还没有和水发生反应。`,
    });
  } else {
    beats.push({
      kind: 'dissolve',
      title: '溶解 · 分子分散',
      text: `${c.molecule} 以分子形式均匀分散到水分子之间，此刻还没电离，溶液里仍是水自己的 1 : 1。`,
    });
    beats.push({
      kind: 'ionize',
      full: !!c.moleculeFull,
      title: c.moleculeFull ? '完全电离' : '部分电离（可逆）',
      text: c.moleculeFull
        ? `${c.molecule} 全部电离成 ${ionText(c.moleculeIons || [])} —— 一个分子都不剩，所以多出来的离子数量很可观。`
        : `只有少数 ${c.molecule} 分子电离成 ${ionText(c.moleculeIons || [])}，绝大多数还是分子，这就是「弱」的含义，用 ⇌ 表示。`,
    });
  }

  // 只有水解（典型：强酸弱碱盐 / 强碱弱酸盐）
  if (c.hydrolysis && c.hydrolysis.length > 0 && !c.ionization) {
    c.hydrolysis.forEach((h) => {
      const gain = h.release === 'H' ? 'H⁺' : 'OH⁻';
      beats.push({
        kind: 'hydrolyze',
        spec: h,
        title: `${h.ion} 水解`,
        text: `${h.ion} 靠近水分子，把水里的 ${h.take === 'OH' ? 'OH⁻' : 'H⁺'} 抢过来结合成弱电解质 ${h.product}，` +
          `剩下的 ${gain} 被释放出来在溶液里自由移动 —— 这就是${c.verdict === 'acid' ? '酸性' : '碱性'}的来源。`,
      });
    });
  }

  // 只电离、不水解（典型：强酸的酸式盐 NaHSO₄）
  if (c.ionization && (!c.hydrolysis || c.hydrolysis.length === 0)) {
    const s = c.ionization;
    beats.push({
      kind: 'ionizeIon',
      spec: s,
      title: `${s.ion} 继续电离`,
      text: `${s.ion} ${s.full ? '完全' : '部分'}电离成 ${ionText(s.into)}，不水解，直接往溶液里放出 H⁺。`,
    });
  }

  // 水解与电离同时存在（典型：弱酸的酸式盐 NaHCO₃）—— 表现「竞争」
  if (c.ionization && c.hydrolysis && c.hydrolysis.length > 0) {
    const h = c.hydrolysis[0];
    const s = c.ionization;
    beats.push({
      kind: 'compete',
      hyd: h,
      ion: s,
      winner: 'hydrolysis',
      title: '水解 vs 电离：两条路在竞争',
      text: `同一个 ${s.ion} 有两条路可走：① 水解 —— 抢水里的 ${h.take === 'OH' ? 'OH⁻' : 'H⁺'} 生成 ${h.product} 并放出 ${h.release === 'H' ? 'H⁺' : 'OH⁻'}；` +
        `② 电离 —— 直接拆成 ${ionText(s.into)}。两条路同时进行，看哪条跑得多。`,
    });
  }

  // 强酸强碱盐：只水合，不反应
  if (
    c.form === 'salt' &&
    (!c.hydrolysis || c.hydrolysis.length === 0) &&
    !c.ionization
  ) {
    beats.push({
      kind: 'hydrate',
      title: '只水合，不反应',
      text: '这些离子只会把水分子短暂地吸引到身边（水合）：阳离子拉住水的 O 端，阴离子拉住水的 H 端。' +
        '靠近一下就分开，没有生成新物质，水的 1 : 1 平衡原封不动。',
    });
  }

  beats.push({
    kind: 'tally',
    title: c.verdict === 'acid' ? '结算：H⁺ 多 → 酸性' : c.verdict === 'base' ? '结算：OH⁻ 多 → 碱性' : '结算：一样多 → 中性',
    text: c.headline,
  });

  return beats;
}

/* ------------------------------------------------------------------ 物质库 */

export const CASES: AcidCase[] = [
  /* ---------------- 酸 ---------------- */
  {
    id: 'hcl',
    name: '氯化氢（盐酸）',
    formula: 'HCl',
    group: '强酸',
    groupKey: 'acid',
    verdict: 'acid',
    headline: 'HCl 全部电离，H⁺ 一股脑全放出来，c(H⁺) 远大于 c(OH⁻) → 酸性。',
    form: 'molecule',
    ions: [],
    molecule: 'HCl',
    moleculeFull: true,
    moleculeIons: [{ label: 'H⁺', charge: 1 }, { label: 'Cl⁻', charge: -1 }],
    equation: 'HCl → H⁺ + Cl⁻',
    why: '强酸在水里 100% 电离，写方程式用单向箭头。H⁺ 越多，pH 越小。',
  },
  {
    id: 'h2so4',
    name: '硫酸',
    formula: 'H₂SO₄',
    group: '强酸',
    groupKey: 'acid',
    verdict: 'acid',
    headline: '一个 H₂SO₄ 放出两个 H⁺，H⁺ 数量翻倍地涨 → 强酸性。',
    form: 'molecule',
    ions: [],
    molecule: 'H₂SO₄',
    moleculeFull: true,
    moleculeIons: [
      { label: 'H⁺', charge: 1 },
      { label: 'H⁺', charge: 1 },
      { label: 'SO₄²⁻', charge: -2 },
    ],
    equation: 'H₂SO₄ → 2H⁺ + SO₄²⁻',
    why: '二元强酸，两步电离在高中阶段合并写成一步。注意「元数」不等于「强弱」：看的是电离是否彻底，不是能电离出几个 H⁺。',
  },
  {
    id: 'hno3',
    name: '硝酸',
    formula: 'HNO₃',
    group: '强酸',
    groupKey: 'acid',
    verdict: 'acid',
    headline: 'HNO₃ 完全电离，H⁺ 大量增加 → 酸性。',
    form: 'molecule',
    ions: [],
    molecule: 'HNO₃',
    moleculeFull: true,
    moleculeIons: [{ label: 'H⁺', charge: 1 }, { label: 'NO₃⁻', charge: -1 }],
    equation: 'HNO₃ → H⁺ + NO₃⁻',
    why: '三大强酸之一（HCl、H₂SO₄、HNO₃），完全电离。',
  },
  {
    id: 'ch3cooh',
    name: '醋酸',
    formula: 'CH₃COOH',
    group: '弱酸',
    groupKey: 'acid',
    verdict: 'acid',
    headline: '只有少数 CH₃COOH 电离，H⁺ 少但依然比 OH⁻ 多 → 弱酸性。',
    form: 'molecule',
    ions: [],
    molecule: 'CH₃COOH',
    moleculeFull: false,
    moleculeIons: [{ label: 'CH₃COO⁻', charge: -1 }, { label: 'H⁺', charge: 1 }],
    equation: 'CH₃COOH ⇌ CH₃COO⁻ + H⁺',
    why: '弱电解质，电离可逆，写 ⇌。同浓度下 H⁺ 远少于强酸，所以「弱」。',
    compare: '强弱看的是电离程度，不是 H⁺ 个数：1 mol/L 的醋酸 H⁺ 远少于 0.1 mol/L 的盐酸。',
  },

  /* ---------------- 碱 ---------------- */
  {
    id: 'naoh',
    name: '氢氧化钠',
    formula: 'NaOH',
    group: '强碱',
    groupKey: 'base',
    verdict: 'base',
    headline: 'NaOH 全部电离出 OH⁻，OH⁻ 把 H⁺ 压了下去 → 碱性。',
    form: 'molecule',
    ions: [],
    molecule: 'NaOH',
    moleculeFull: true,
    moleculeIons: [{ label: 'Na⁺', charge: 1 }, { label: 'OH⁻', charge: -1 }],
    equation: 'NaOH → Na⁺ + OH⁻',
    why: '强碱完全电离。OH⁻ 增多会反过来压住水的电离，使 H⁺ 变得更少。',
  },
  {
    id: 'caoh2',
    name: '氢氧化钙',
    formula: 'Ca(OH)₂',
    group: '强碱',
    groupKey: 'base',
    verdict: 'base',
    headline: '一个 Ca(OH)₂ 电离出两个 OH⁻ → 碱性。',
    form: 'molecule',
    ions: [],
    molecule: 'Ca(OH)₂',
    moleculeFull: true,
    moleculeIons: [
      { label: 'Ca²⁺', charge: 2 },
      { label: 'OH⁻', charge: -1 },
      { label: 'OH⁻', charge: -1 },
    ],
    equation: 'Ca(OH)₂ → Ca²⁺ + 2OH⁻',
    why: '二元强碱。它微溶，但溶解的那部分是完全电离的 —— 溶解度和强弱是两回事。',
    compare: '溶解度小 ≠ 弱碱：Ca(OH)₂ 溶得少，但溶进去的部分 100% 电离。',
  },
  {
    id: 'nh3h2o',
    name: '一水合氨',
    formula: 'NH₃·H₂O',
    group: '弱碱',
    groupKey: 'base',
    verdict: 'base',
    headline: '只有少数 NH₃·H₂O 电离出 OH⁻，OH⁻ 略占上风 → 弱碱性。',
    form: 'molecule',
    ions: [],
    molecule: 'NH₃·H₂O',
    moleculeFull: false,
    moleculeIons: [{ label: 'NH₄⁺', charge: 1 }, { label: 'OH⁻', charge: -1 }],
    equation: 'NH₃·H₂O ⇌ NH₄⁺ + OH⁻',
    why: '唯一的常见弱碱，可逆电离。氨水显碱性就是因为它电离出的那一点 OH⁻。',
  },

  /* ---------------- 盐：不水解（中性） ---------------- */
  {
    id: 'nacl',
    name: '氯化钠',
    formula: 'NaCl',
    group: '强酸强碱盐',
    groupKey: 'salt',
    verdict: 'neutral',
    headline: 'Na⁺、Cl⁻ 谁也不抢水的 H⁺/OH⁻，只短暂水合就分开 → c(H⁺) = c(OH⁻)，中性。',
    form: 'salt',
    ions: [
      { label: 'Na⁺', charge: 1, role: 'spectator' },
      { label: 'Cl⁻', charge: -1, role: 'spectator' },
    ],
    equation: 'NaCl → Na⁺ + Cl⁻（不水解）',
    why: '判断口诀「谁弱谁水解，谁强不水解，同强显中性」：NaOH 是强碱、HCl 是强酸，两个都强，所以 Na⁺ 和 Cl⁻ 都不水解。',
    compare: '对照 NH₄Cl：同样是可溶盐，NH₄⁺ 会抢 OH⁻，NaCl 不会 —— 差别就在阳离子弱不弱。',
  },
  {
    id: 'kno3',
    name: '硝酸钾',
    formula: 'KNO₃',
    group: '强酸强碱盐',
    groupKey: 'salt',
    verdict: 'neutral',
    headline: 'K⁺、NO₃⁻ 都来自强碱 / 强酸，都不水解 → 中性。',
    form: 'salt',
    ions: [
      { label: 'K⁺', charge: 1, role: 'spectator' },
      { label: 'NO₃⁻', charge: -1, role: 'spectator' },
    ],
    equation: 'KNO₃ → K⁺ + NO₃⁻（不水解）',
    why: '和 NaCl 一样是「同强显中性」。',
  },

  /* ---------------- 盐：阳离子水解（酸性） ---------------- */
  {
    id: 'nh4cl',
    name: '氯化铵',
    formula: 'NH₄Cl',
    group: '强酸弱碱盐',
    groupKey: 'salt',
    verdict: 'acid',
    headline: 'NH₄⁺ 抢走水里的 OH⁻ 变成 NH₃·H₂O，把 H⁺ 单独留在溶液里 → c(H⁺) > c(OH⁻)，酸性。',
    form: 'salt',
    ions: [
      { label: 'NH₄⁺', charge: 1, role: 'active' },
      { label: 'Cl⁻', charge: -1, role: 'spectator' },
    ],
    hydrolysis: [{ ion: 'NH₄⁺', take: 'OH', product: 'NH₃·H₂O', release: 'H' }],
    equation: 'NH₄⁺ + H₂O ⇌ NH₃·H₂O + H⁺',
    why: 'NH₄⁺ 来自弱碱 NH₃·H₂O，所以它「认得」OH⁻，会把水拆开把 OH⁻ 抱走；Cl⁻ 来自强酸 HCl，不水解。' +
      '结果水被拆走 OH⁻，剩下的 H⁺ 无处可去，溶液就显酸性。',
    compare: '对照 NaCl：Na⁺ 来自强碱，不认 OH⁻，水分子只是被它短暂吸住又放走，H⁺ 与 OH⁻ 依旧 1 : 1。',
  },
  {
    id: 'alcl3',
    name: '氯化铝',
    formula: 'AlCl₃',
    group: '强酸弱碱盐',
    groupKey: 'salt',
    verdict: 'acid',
    headline: 'Al³⁺ 电荷高、抢 OH⁻ 的能力更强，水解后放出 H⁺ → 酸性（净水原理）。',
    form: 'salt',
    ions: [
      { label: 'Al³⁺', charge: 3, role: 'active' },
      { label: 'Cl⁻', charge: -1, role: 'spectator' },
    ],
    hydrolysis: [{ ion: 'Al³⁺', take: 'OH', product: 'Al(OH)₃', release: 'H' }],
    equation: 'Al³⁺ + 3H₂O ⇌ Al(OH)₃(胶体) + 3H⁺',
    why: 'Al³⁺ 电荷密度大，水解能力强，生成的 Al(OH)₃ 胶体能吸附水中悬浮杂质 —— 这就是明矾净水的原理。',
    compare: '同样阳离子水解，Al³⁺ 比 NH₄⁺ 更「凶」：电荷越高，抢 OH⁻ 越猛。',
  },

  /* ---------------- 盐：阴离子水解（碱性） ---------------- */
  {
    id: 'ch3coona',
    name: '醋酸钠',
    formula: 'CH₃COONa',
    group: '强碱弱酸盐',
    groupKey: 'salt',
    verdict: 'base',
    headline: 'CH₃COO⁻ 抢走水里的 H⁺ 变成醋酸，把 OH⁻ 留在溶液里 → c(OH⁻) > c(H⁺)，碱性。',
    form: 'salt',
    ions: [
      { label: 'Na⁺', charge: 1, role: 'spectator' },
      { label: 'CH₃COO⁻', charge: -1, role: 'active' },
    ],
    hydrolysis: [{ ion: 'CH₃COO⁻', take: 'H', product: 'CH₃COOH', release: 'OH' }],
    equation: 'CH₃COO⁻ + H₂O ⇌ CH₃COOH + OH⁻',
    why: 'CH₃COO⁻ 来自弱酸 CH₃COOH，所以它「认得」H⁺，把水拆开把 H⁺ 抱走，剩下的 OH⁻ 让溶液显碱性。',
    compare: '和 NH₄Cl 正好镜像：一个抢 OH⁻ 显酸性，一个抢 H⁺ 显碱性。',
  },
  {
    id: 'na2co3',
    name: '碳酸钠（纯碱）',
    formula: 'Na₂CO₃',
    group: '强碱弱酸盐',
    groupKey: 'salt',
    verdict: 'base',
    headline: 'CO₃²⁻ 分两步水解，第一步为主，放出 OH⁻ → 碱性（纯碱不是碱，是盐！）。',
    form: 'salt',
    ions: [
      { label: 'Na⁺', charge: 1, role: 'spectator' },
      { label: 'CO₃²⁻', charge: -2, role: 'active' },
    ],
    hydrolysis: [{ ion: 'CO₃²⁻', take: 'H', product: 'HCO₃⁻', release: 'OH' }],
    equation: 'CO₃²⁻ + H₂O ⇌ HCO₃⁻ + OH⁻（主要）',
    why: '多元弱酸根分步水解，以第一步为主。Na₂CO₃ 叫「纯碱」却属于盐 —— 分类看组成，不看酸碱性。',
    compare: '纯碱是盐不是碱：判断物质类别看组成（金属离子 + 酸根），判断酸碱性看水解。',
  },

  /* ---------------- 酸式盐：水解与电离的竞争 ---------------- */
  {
    id: 'nahco3',
    name: '碳酸氢钠（小苏打）',
    formula: 'NaHCO₃',
    group: '弱酸的酸式盐',
    groupKey: 'salt',
    verdict: 'base',
    headline: 'HCO₃⁻ 既能水解（放 OH⁻）又能电离（放 H⁺），水解跑赢电离 → 碱性。',
    form: 'salt',
    ions: [
      { label: 'Na⁺', charge: 1, role: 'spectator' },
      { label: 'HCO₃⁻', charge: -1, role: 'active' },
    ],
    hydrolysis: [{ ion: 'HCO₃⁻', take: 'H', product: 'H₂CO₃', release: 'OH', count: 2 }],
    ionization: { ion: 'HCO₃⁻', into: [{ label: 'H⁺', charge: 1 }, { label: 'CO₃²⁻', charge: -2 }], full: false, count: 1 },
    equation: '水解：HCO₃⁻ + H₂O ⇌ H₂CO₃ + OH⁻ ＞ 电离：HCO₃⁻ ⇌ H⁺ + CO₃²⁻',
    why: '两条路同时存在，看谁跑得多：HCO₃⁻ 的水解程度大于电离程度，所以溶液显碱性。' +
      '小苏打水溶液的碱性就是这么来的（也是它能中和胃酸的原因）。',
    compare: '对照 NaHSO₄：同样是酸式盐，HSO₄⁻ 只电离不水解，结果一个碱性一个酸性。',
  },
  {
    id: 'nahso4',
    name: '硫酸氢钠',
    formula: 'NaHSO₄',
    group: '强酸的酸式盐',
    groupKey: 'salt',
    verdict: 'acid',
    headline: 'HSO₄⁻ 只电离不水解，直接放出 H⁺ → 酸性（水溶液相当于稀硫酸）。',
    form: 'salt',
    ions: [
      { label: 'Na⁺', charge: 1, role: 'spectator' },
      { label: 'HSO₄⁻', charge: -1, role: 'active' },
    ],
    ionization: { ion: 'HSO₄⁻', into: [{ label: 'H⁺', charge: 1 }, { label: 'SO₄²⁻', charge: -2 }], full: true, count: 3 },
    equation: 'NaHSO₄ → Na⁺ + H⁺ + SO₄²⁻',
    why: 'HSO₄⁻ 是强酸 H₂SO₄ 的酸式根，只电离不水解，水溶液相当于稀硫酸，能使石蕊变红。',
    compare: '对照 NaHCO₃：一个只电离（酸性），一个水解占优（碱性）—— 别把酸式盐都当酸性。',
  },
  {
    id: 'ch3coonh4',
    name: '醋酸铵',
    formula: 'CH₃COONH₄',
    group: '弱酸弱碱盐',
    groupKey: 'salt',
    verdict: 'neutral',
    headline: 'NH₄⁺ 和 CH₃COO⁻ 双水解、互相促进，放出的 H⁺ 与 OH⁻ 又互相抵消 → 接近中性。',
    form: 'salt',
    ions: [
      { label: 'NH₄⁺', charge: 1, role: 'active' },
      { label: 'CH₃COO⁻', charge: -1, role: 'active' },
    ],
    hydrolysis: [
      { ion: 'NH₄⁺', take: 'OH', product: 'NH₃·H₂O', release: 'H', count: 1 },
      { ion: 'CH₃COO⁻', take: 'H', product: 'CH₃COOH', release: 'OH', count: 1 },
    ],
    equation: 'NH₄⁺ + CH₃COO⁻ + H₂O ⇌ NH₃·H₂O + CH₃COOH',
    why: '阴、阳离子都水解，互相促进（双水解），但因为两者的水解程度接近，放出的 H⁺ 和 OH⁻ 数量相当，溶液近中性。',
    compare: '弱酸弱碱盐不能一刀切说中性：要看 Ka 与 Kb 谁大，醋酸铵恰好两者接近。',
  },
];

/* ------------------------------------------------------------------ 查询辅助 */

export const VERDICT_TEXT: Record<Verdict, string> = {
  acid: '酸性',
  base: '碱性',
  neutral: '中性',
};

export const VERDICT_TONE: Record<Verdict, { bg: string; fg: string; label: string }> = {
  acid: { bg: '#FDECEB', fg: '#D9453C', label: 'c(H⁺) > c(OH⁻)' },
  base: { bg: '#E7F0FE', fg: '#2C6FD6', label: 'c(OH⁻) > c(H⁺)' },
  neutral: { bg: '#EEF1F5', fg: '#677A92', label: 'c(H⁺) = c(OH⁻)' },
};

export const GROUP_FILTERS: { key: 'all' | 'acid' | 'base' | 'salt'; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'acid', label: '酸' },
  { key: 'base', label: '碱' },
  { key: 'salt', label: '盐' },
];

export function caseById(id: string): AcidCase {
  return CASES.find((c) => c.id === id) || CASES[0];
}

/** 显酸性 / 碱性 / 中性各有多少，用作页面统计 */
export function verdictCount(v: Verdict): number {
  return CASES.filter((c) => c.verdict === v).length;
}
