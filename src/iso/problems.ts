/* 同分异构体模块 · 题库。
 * 每题给出分子式与限制条件，标准答案由 enumerate.ts 现场枚举（首次进入题目时计算）。 */

import { EnumConstraint } from './enumerate';

export type ProblemCategory = '芳香族' | '酯类' | '醇/醚' | '醛/酮';

export interface IsoProblem {
  id: string;
  category: ProblemCategory;
  title: string;
  formula: string;
  /** 展示给学生的限制条件 */
  condition: string;
  tip: string;
  constraint: EnumConstraint;
}

export const CATEGORY_ORDER: ProblemCategory[] = ['芳香族', '酯类', '醇/醚', '醛/酮'];

export const CATEGORY_INTRO: Record<ProblemCategory, string> = {
  芳香族: '先固定苯环，再考虑取代基的种类与位置（邻 / 间 / 对）。',
  酯类: '按“酸 + 醇”拆分碳原子：RCOOR′，两边碳数分配要穷举。',
  '醇/醚': '同样的分子式，氧可以是 —OH（醇），也可以是 —O—（醚）。',
  '醛/酮': '羰基位置不同：端位是醛，中间是酮。',
};

const SUBS = ['₀', '₁', '₂', '₃', '₄', '₅', '₆', '₇', '₈', '₉'];

/** C4H8O2 → C₄H₈O₂ */
export function subFormula(s: string): string {
  return s.replace(/(\d)/g, (_m, d: string) => SUBS[parseInt(d, 10)] || d);
}

export const PROBLEMS: IsoProblem[] = [
  {
    id: 'ar-c8h10',
    category: '芳香族',
    title: 'C₈H₁₀ 的芳香烃',
    formula: 'C8H10',
    condition: '分子中含有一个苯环，属于芳香烃',
    tip: '先固定苯环，剩下 2 个碳：可以连成一个乙基，也可以拆成两个甲基。',
    constraint: { aromatic: true },
  },
  {
    id: 'ar-c7h8o-phenol',
    category: '芳香族',
    title: 'C₇H₈O 的酚类',
    formula: 'C7H8O',
    condition: '含苯环，且 —OH 直接连在苯环上（属于酚类）',
    tip: '苯环上还剩一个 —CH₃，注意邻、间、对三个位置。',
    constraint: { aromatic: true, require: ['phenol'] },
  },
  {
    id: 'ar-c7h8o-all',
    category: '芳香族',
    title: 'C₇H₈O 的芳香族化合物',
    formula: 'C7H8O',
    condition: '分子中含有一个苯环',
    tip: '氧可以在侧链上（—CH₂OH、—OCH₃），也可以直接连在苯环上（酚）。',
    constraint: { aromatic: true },
  },
  {
    id: 'ester-c4h8o2',
    category: '酯类',
    title: 'C₄H₈O₂ 的酯',
    formula: 'C4H8O2',
    condition: '属于酯类（结构中含 —COO—）',
    tip: '酸的部分至少 1 个碳：甲酸酯、乙酸酯、丙酸酯都要想一遍。',
    constraint: { require: ['ester'] },
  },
  {
    id: 'ester-c5h10o2',
    category: '酯类',
    title: 'C₅H₁₀O₂ 的酯',
    formula: 'C5H10O2',
    condition: '属于酯类（结构中含 —COO—）',
    tip: '按酸侧碳数 1 + 4、2 + 3、3 + 2、4 + 1 分类，注意碳链还有支链。',
    constraint: { require: ['ester'] },
  },
  {
    id: 'acid-c4h8o2',
    category: '酯类',
    title: 'C₄H₈O₂ 的羧酸',
    formula: 'C4H8O2',
    condition: '属于羧酸（含 —COOH，能与 NaHCO₃ 反应放出 CO₂）',
    tip: '先拿走一个 —COOH，看剩下 C₃H₇ 有几种碳骨架。',
    constraint: { require: ['acid'] },
  },
  {
    id: 'alcohol-c3h8o',
    category: '醇/醚',
    title: 'C₃H₈O 的全部同分异构体',
    formula: 'C3H8O',
    condition: '醇和醚都要写（官能团异构）',
    tip: '—OH 挂在端位或中间碳上是两种醇；氧插在两个碳之间就是醚。',
    constraint: {},
  },
  {
    id: 'alcohol-c4h10o',
    category: '醇/醚',
    title: 'C₄H₁₀O 的醇',
    formula: 'C4H10O',
    condition: '属于醇类（含 —OH，能与金属 Na 反应放出 H₂）',
    tip: '先看丁烷的两种碳骨架，再把 —OH 挂到每种骨架的不同位置。',
    constraint: { require: ['alcohol'] },
  },
  {
    id: 'alcohol-ether-c4h10o',
    category: '醇/醚',
    title: 'C₄H₁₀O 的全部同分异构体',
    formula: 'C4H10O',
    condition: '醇和醚都要写（官能团异构）',
    tip: '醇 4 种 + 醚 3 种：醚按 1+3、2+2 拆分碳数。',
    constraint: {},
  },
  {
    id: 'aldehyde-c4h8o',
    category: '醛/酮',
    title: 'C₄H₈O 的醛',
    formula: 'C4H8O',
    condition: '属于醛类（含 —CHO，能发生银镜反应）',
    tip: '—CHO 一定在链端，剩下 C₃H₇ 有两种骨架。',
    constraint: { require: ['aldehyde'] },
  },
  {
    id: 'ketone-c4h8o',
    category: '醛/酮',
    title: 'C₄H₈O 的酮',
    formula: 'C4H8O',
    condition: '属于酮类（含 —CO—，羰基碳两边都连碳）',
    tip: '羰基只能在中间，注意左右碳数分配。',
    constraint: { require: ['ketone'] },
  },
  {
    id: 'carbonyl-c4h8o',
    category: '醛/酮',
    title: 'C₄H₈O 的醛和酮',
    formula: 'C4H8O',
    condition: '属于醛或酮（含羰基，不饱和度为 1）',
    tip: '醛 2 种 + 酮 1 种，别漏掉带支链的那种醛。',
    constraint: { allow: ['aldehyde', 'ketone'] },
  },
];

export function problemsOf(category: ProblemCategory): IsoProblem[] {
  return PROBLEMS.filter((p) => p.category === category);
}

export function problemById(id: string): IsoProblem | undefined {
  return PROBLEMS.find((p) => p.id === id);
}
