/* =========================================================================
 * 酸碱性：把推导结果变成「一步步猜」的题目
 * -------------------------------------------------------------------------
 * 每一步都是一个单选题，答完立刻告诉真相，并且：
 *   - 若这一步涉及的化学过程**真实存在**（比如确实会水解）→ 播对应动画验证
 *   - 若真实情况是「没有」→ 直接进下一步（或播「只水合」的对照动画）
 * 这样无论猜对猜错，最后看到的都是真实发生的过程。
 * ========================================================================= */

import { buildScript, kwTargetsOf, type AcidBeat, type AcidCase } from './acidRule';

export type QuizKey = 'ionizeDegree' | 'hydrolysis' | 'ionization' | 'compete' | 'verdict';

export interface QuizOption {
  value: string;
  label: string;
  hint?: string;
}

export interface QuizStep {
  key: QuizKey;
  question: string;
  options: QuizOption[];
  answer: string;
  /** 正确选项的文案，用于答完后公布 */
  truth: string;
  /** 答完后展示的解释（不管答没答对都讲真相） */
  explain: string;
  /** 验证用的动画节拍类型；null = 没有可播的动画 */
  beatKind: string | null;
  /** 没有动画时给的一句提示，例如「确实不水解，就不用看水解动画了」 */
  skipNote?: string;
}

const VERDICT_OPTIONS: QuizOption[] = [
  { value: 'acid', label: '酸性', hint: 'c(H⁺) > c(OH⁻)' },
  { value: 'base', label: '碱性', hint: 'c(OH⁻) > c(H⁺)' },
  { value: 'neutral', label: '中性', hint: 'c(H⁺) = c(OH⁻)' },
];
const VERDICT_LABEL: Record<string, string> = { acid: '酸性', base: '碱性', neutral: '中性' };

/** 某个 kind 的节拍在脚本里的位置（取最后一个，前面的都算已经发生过） */
export function beatIndexFor(script: AcidBeat[], kind: string): number | null {
  for (let i = script.length - 1; i >= 0; i -= 1) {
    if (script[i].kind === kind) return i;
  }
  return null;
}

export function buildQuiz(c: AcidCase): QuizStep[] {
  const script = buildScript(c);
  const hasBeat = (kind: string) => beatIndexFor(script, kind) !== null;

  if (c.form === 'molecule') {
    // 酸 / 碱：只考「电离程度」+ 最终酸碱性
    const steps: QuizStep[] = [];
    steps.push({
      key: 'ionizeDegree',
      question: `${c.molecule} 溶于水后，分子是怎么电离的？`,
      options: [
        { value: 'full', label: '完全电离', hint: '一个分子都不剩，用 →' },
        { value: 'partial', label: '部分电离（可逆）', hint: '大部分还是分子，用 ⇌' },
      ],
      answer: c.moleculeFull ? 'full' : 'partial',
      truth: c.moleculeFull ? '完全电离' : '部分电离（可逆）',
      explain: c.moleculeFull
        ? `${c.molecule} 是强电解质，在水里 100% 电离，方程式写 ${c.equation} —— 所有的分子都拆开了。`
        : `${c.molecule} 是弱电解质，只有一小部分电离：${c.equation}。绝大多数还以分子形式待着，所以才叫「弱」。`,
      beatKind: hasBeat('ionize') ? 'ionize' : null,
    });
    steps.push(verdictStep(c));
    return steps;
  }

  // 盐：水解 → 电离 →（竞争）→ 酸碱性
  const hydList = c.hydrolysis || [];
  const cat = hydList.find((h) => h.release === 'H');
  const an = hydList.find((h) => h.release === 'OH');
  const hasHydrolysis = hydList.length > 0;
  const hasIonization = !!c.ionization;

  let hydrolysisAnswer = 'none';
  if (cat && an) hydrolysisAnswer = 'both';
  else if (cat) hydrolysisAnswer = 'cat';
  else if (an) hydrolysisAnswer = 'an';

  const hydTruth =
    hydrolysisAnswer === 'both' ? '阴、阳离子都水解（双水解）'
      : hydrolysisAnswer === 'cat' ? '有，阳离子水解'
        : hydrolysisAnswer === 'an' ? '有，阴离子水解'
          : '都不水解';

  const hydExplain = hasHydrolysis
    ? hydList
      .map((h) =>
        h.release === 'H'
          ? `${h.ion} 来自弱碱，会把水分子拆开、抢走 OH⁻ 生成 ${h.product}，剩下的 H⁺ 释放到溶液里`
          : `${h.ion} 来自弱酸，会把水分子拆开、抢走 H⁺ 生成 ${h.product}，剩下的 OH⁻ 释放到溶液里`)
      .join('；') + '。'
    : `${(c.ions || []).map((i) => i.label).join(' 和 ')} 一个来自强碱、一个来自强酸，两边都不水解 —— 它们只会把水分子短暂地吸到身边（水合），然后放开。`;

  const steps: QuizStep[] = [];

  steps.push({
    key: 'hydrolysis',
    question: `${c.formula} 溶于水后有离子会水解吗？`,
    options: [
      { value: 'none', label: '都不水解' },
      { value: 'cat', label: '有，阳离子水解' },
      { value: 'an', label: '有，阴离子水解' },
      { value: 'both', label: '阴、阳离子都水解' },
    ],
    answer: hydrolysisAnswer,
    truth: hydTruth,
    explain: hydExplain,
    beatKind: hasHydrolysis ? 'hydrolyze' : hasBeat('hydrate') ? 'hydrate' : null,
    skipNote: '确实不水解 —— 看一眼「只水合、不反应」的对照动画。',
  });

  steps.push({
    key: 'ionization',
    question: '除了水解，这里的离子还会自己继续电离出 H⁺ 吗？',
    options: [
      { value: 'yes', label: '会', hint: '酸式根才能继续电离' },
      { value: 'no', label: '不会' },
    ],
    answer: hasIonization ? 'yes' : 'no',
    truth: hasIonization ? `会，${c.ionization?.ion} 会继续电离` : '不会',
    explain: hasIonization
      ? `${c.ionization?.ion} 是酸式根，除了水解还能把自己拆成 H⁺ 和 ${(c.ionization?.into || [])
        .filter((i) => i.label !== 'H⁺')
        .map((i) => i.label)
        .join('')} —— 两条路同时进行，这就是「竞争」。`
      : `${(c.ions || []).map((i) => i.label).join(' 和 ')} 都不是酸式根，除了水解这条路之外，没有能继续电离出 H⁺ 的结构。`,
    beatKind: hasIonization && hasBeat('ionizeIon') ? 'ionizeIon' : null,
    skipNote: '没有可以继续电离的酸式根，这一步跳过动画。',
  });

  if (hasHydrolysis && hasIonization) {
    const anIon = c.ionization?.ion || '';
    const hydSpec = c.hydrolysis?.[0];
    steps.push({
      key: 'compete',
      question: `${anIon} 的水解和电离同时在跑，谁占上风？`,
      options: [
        { value: 'hydrolysis', label: '水解占优', hint: '放出更多 OH⁻' },
        { value: 'ionization', label: '电离占优', hint: '放出更多 H⁺' },
      ],
      answer: c.verdict === 'base' ? 'hydrolysis' : 'ionization',
      truth: c.verdict === 'base' ? '水解占优 → 碱性' : '电离占优 → 酸性',
      explain: `${anIon} 同时走两条路：水解产生 OH⁻（${hydSpec ? `生成 ${hydSpec.product}` : ''}），电离产生 H⁺。` +
        `实验测定${c.verdict === 'base' ? '水解程度更大，OH⁻ 压过 H⁺，溶液显碱性（如 NaHCO₃ 溶液）' : '电离程度更大，H⁺ 压过 OH⁻，溶液显酸性（如 NaHSO₃ 溶液）'}。`,
      beatKind: hasBeat('compete') ? 'compete' : null,
    });
  }

  steps.push(verdictStep(c));
  return steps;
}

function verdictStep(c: AcidCase): QuizStep {
  const hyd = c.hydrolysis || [];
  const ion = c.ionization;
  const bits: string[] = [];
  hyd.forEach((h) => {
    bits.push(`${h.ion} 水解放出 ${h.release === 'H' ? 'H⁺' : 'OH⁻'}`);
  });
  if (ion) bits.push(`${ion.ion} 电离放出 H⁺`);
  const kw = kwTargetsOf(c);
  const kwNote = kw.h === kw.oh
    ? '两边仍然相等，c(H⁺) = c(OH⁻) = 1.0×10⁻⁷，正好落在 Kw 上'
    : `此时 c(H⁺)·c(OH⁻) 仍然等于 Kw = 1.0×10⁻¹⁴：H⁺ 多出来的这些，全靠把 OH⁻ 压到原来的 ${(Math.max(kw.h, kw.oh) / Math.min(kw.h, kw.oh)).toFixed(1)} 分之一换来的`;
  const explain = bits.length
    ? `${bits.join('，')}。把水自身的电离平衡打破之后，${c.verdict === 'acid' ? 'H⁺ 比 OH⁻ 多 → 酸性' : c.verdict === 'base' ? 'OH⁻ 比 H⁺ 多 → 碱性' : '两边放出的量大致抵消 → 接近中性'}。${kwNote}。${c.headline}`
    : `${c.headline}`;
  return {
    key: 'verdict',
    question: `最后结算：${c.formula} 的水溶液显什么性？`,
    options: VERDICT_OPTIONS,
    answer: c.verdict,
    truth: VERDICT_LABEL[c.verdict] || '',
    explain,
    beatKind: 'tally',
  };
}
