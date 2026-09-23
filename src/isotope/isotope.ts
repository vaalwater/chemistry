/**
 * 同位素 / 核素相关的纯逻辑与文案（界面在 components/AtomBuilder.tsx、screens/AtomBuilderScreen.tsx）。
 */
import { content } from '../data';
import type { ElementData } from '../types';

/** 课堂范围：只搭前 20 号元素（H ~ Ca） */
export const MAX_P = 20;
export const MAX_N = 30;
export const MAX_E = 20;

const SUP = ['⁰', '¹', '²', '³', '⁴', '⁵', '⁶', '⁷', '⁸', '⁹'];
const SUB = ['₀', '₁', '₂', '₃', '₄', '₅', '₆', '₇', '₈', '₉'];

function mapDigits(n: number, table: string[]): string {
  return String(Math.max(0, Math.round(n)))
    .split('')
    .map((c) => table[Number(c)] ?? c)
    .join('');
}

/** 上标：14 → ¹⁴（核素符号左上角的质量数 A） */
export function supText(n: number): string {
  return mapDigits(n, SUP);
}

/** 下标：6 → ₆（核素符号左下角的质子数 Z） */
export function subText(n: number): string {
  return mapDigits(n, SUB);
}

/** 按质子数取元素 */
export function elementByZ(z: number): ElementData | undefined {
  if (z <= 0) return undefined;
  return content.elements.find((e) => e.p === z);
}

/** 元素在自然界最常见的中子数（内容库：H 为 0、C 为 6、Cl 为 18…） */
export function commonNeutrons(z: number): number {
  return elementByZ(z)?.n ?? 0;
}

export interface AtomState {
  p: number;
  n: number;
  e: number;
}

export const EMPTY_ATOM: AtomState = { p: 0, n: 0, e: 0 };

export interface IsotopeMeta {
  name?: string;
  note?: string;
  radioactive?: boolean;
}

/** 高中阶段会遇到的核素（key = 元素符号-质量数） */
const KNOWN: Record<string, IsotopeMeta> = {
  'H-1': { name: '氕', note: '普通氢原子，宇宙里含量最多的核素' },
  'H-2': { name: '氘（D）', note: '重氢，是重水 D₂O 的原料，也可用于核聚变' },
  'H-3': { name: '氚（T）', note: '超重氢，有放射性，半衰期约 12.4 年', radioactive: true },
  'He-3': { name: '氦-3', note: '稀有的稳定轻核素，核聚变研究中的理想燃料' },
  'He-4': { name: '氦-4', note: 'α 粒子就是它的原子核' },
  'C-12': { name: '碳-12', note: '相对原子质量的标准：它的 1/12 定义为 1 个原子质量单位' },
  'C-13': { name: '碳-13', note: '稳定同位素，核磁共振（¹³C-NMR）靠的就是它' },
  'C-14': { name: '碳-14', note: '有放射性，半衰期 5730 年，用来给古生物测年', radioactive: true },
  'O-16': { name: '氧-16', note: '最常见的氧核素' },
  'O-18': { name: '氧-18', note: '稳定同位素，常用于古气候研究' },
  'Cl-35': { name: '氯-35', note: '与氯-37 约 3:1 混合，所以氯的相对原子质量是 35.5' },
  'Cl-37': { name: '氯-37', note: '与氯-35 互称同位素' },
  'U-235': { name: '铀-235', note: '可裂变的核燃料', radioactive: true },
  'U-238': { name: '铀-238', note: '天然铀中最主要的核素', radioactive: true },
};

export function isotopeMeta(symbol: string, mass: number): IsotopeMeta | undefined {
  return KNOWN[`${symbol}-${mass}`];
}

/** 知识卡里成组展示的同位素例子 */
export const ISOTOPE_GROUPS: {
  z: number;
  symbol: string;
  name: string;
  masses: number[];
  note: string;
}[] = [
  { z: 1, symbol: 'H', name: '氢', masses: [1, 2, 3], note: '氕 / 氘 / 氚：化学性质几乎一样，质量不同' },
  { z: 6, symbol: 'C', name: '碳', masses: [12, 13, 14], note: '¹²C、¹³C 稳定，¹⁴C 有放射性，用于测年' },
  { z: 8, symbol: 'O', name: '氧', masses: [16, 17, 18], note: '三种都稳定，¹⁸O 常用于古气候研究' },
  { z: 17, symbol: 'Cl', name: '氯', masses: [35, 37], note: '天然丰度约 3:1，平均相对原子质量 35.5' },
  { z: 92, symbol: 'U', name: '铀', masses: [235, 238], note: '²³⁵U 可做核燃料，与 ²³⁸U 的分离是难点' },
];

const SHELL_CAP = [2, 8, 18, 18, 18];

/** 按电子数排电子层（K/L/M… 依次填满），如 11 → [2,8,1] */
export function electronShells(e: number): number[] {
  let left = Math.max(0, Math.round(e));
  const out: number[] = [];
  for (let i = 0; left > 0 && i < SHELL_CAP.length; i++) {
    const c = Math.min(SHELL_CAP[i], left);
    if (c > 0) out.push(c);
    left -= c;
  }
  return out;
}

export interface DescribeResult {
  hasAtom: boolean;
  symbol: string;
  name: string;
  z: number;
  n: number;
  e: number;
  mass: number;
  charge: number;
  ionText: string;
  stateLabel: string;
  shells: number[];
  standardN: number;
  isCommon: boolean;
  meta?: IsotopeMeta;
}

function chargeDigits(charge: number): string {
  const a = Math.abs(charge);
  return a > 1 ? supText(a) : '';
}

export function describeAtom(s: AtomState): DescribeResult {
  const z = s.p;
  const el = elementByZ(z);
  const symbol = el?.symbol ?? '';
  const name = el?.name ?? '还没有质子';
  const mass = z + s.n;
  const charge = z - s.e;
  let ionText = symbol;
  if (charge > 0) ionText = `${symbol}${chargeDigits(charge)}⁺`;
  else if (charge < 0) ionText = `${symbol}${chargeDigits(charge)}⁻`;
  const standardN = el?.n ?? 0;
  return {
    hasAtom: z > 0,
    symbol,
    name,
    z,
    n: s.n,
    e: s.e,
    mass,
    charge,
    ionText,
    stateLabel: charge === 0 ? '电中性原子' : charge > 0 ? '阳离子' : '阴离子',
    shells: electronShells(s.e),
    standardN,
    isCommon: !!el && s.n === standardN,
    meta: el ? isotopeMeta(el.symbol, mass) : undefined,
  };
}

/**
 * 相对上一次搭建给出提示 —— 本页的核心教学点：
 * 质子数决定元素种类，中子数决定同位素，电子数只决定是否为离子。
 */
export function relationHint(prev: AtomState, cur: AtomState): { text: string; warn?: boolean } | null {
  if (!prev.p || !cur.p) return null;
  if (prev.p === cur.p && prev.n === cur.n && prev.e === cur.e) return null;
  if (prev.p === cur.p && prev.n !== cur.n) {
    return { text: '质子数没变、中子数变了 —— 这是同位素关系' };
  }
  if (prev.p !== cur.p) {
    const a = elementByZ(prev.p)?.symbol ?? '';
    const b = elementByZ(cur.p)?.symbol ?? '';
    return { text: `质子数变了，元素种类随之改变：${a} → ${b}`, warn: true };
  }
  return { text: '只是电子数变了 —— 元素和中子数都没动，它现在是离子', warn: true };
}

/* ======================= ¹⁴C 测年小测 ======================= */

export const C14_HALF_LIFE = 5730;

export interface QuizQuestion {
  kind: 'age' | 'remain';
  prompt: string;
  options: string[];
  answerIndex: number;
  explain: string;
  /** 这题对应的半衰期个数，用于对照演示 */
  halfLives: number;
}

/** 经过 halfLives 个半衰期后的剩余比例（%） */
export function remainPercent(halfLives: number): number {
  return 100 / Math.pow(2, halfLives);
}

function fmtYears(y: number): string {
  if (y >= 10000) {
    const w = y / 10000;
    const s = w.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
    return `${s} 万年`;
  }
  return `${Math.round(y)} 年`;
}

function fmtPercent(p: number): string {
  const s = p < 1 ? p.toFixed(2) : String(Math.round(p * 10) / 10);
  return `${s}%`;
}

function buildOptions(correct: string, distractors: string[]): { options: string[]; answerIndex: number } {
  const all = [correct];
  for (const d of distractors) if (d !== correct && !all.includes(d)) all.push(d);
  for (let i = all.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = all[i];
    all[i] = all[j];
    all[j] = tmp;
  }
  const options = all.slice(0, 4);
  return { options, answerIndex: options.indexOf(correct) };
}

/** 随机出题：考「由剩余量推年代」或「由年代推剩余量」 */
export function makeQuizQuestion(): QuizQuestion {
  const k = 1 + Math.floor(Math.random() * 4); // 经过 1~4 个半衰期
  const remain = remainPercent(k);
  const years = C14_HALF_LIFE * k;

  if (Math.random() < 0.6) {
    const { options, answerIndex } = buildOptions(fmtYears(years), [
      fmtYears(C14_HALF_LIFE * Math.max(1, k - 1)),
      fmtYears(C14_HALF_LIFE * (k + 1)),
      fmtYears(C14_HALF_LIFE * (k + 2)),
      fmtYears(C14_HALF_LIFE / 2),
    ]);
    return {
      kind: 'age',
      prompt: `测出样品中 ¹⁴C 只剩活体时的 ${fmtPercent(remain)}，它大约经历了多少年？`,
      options,
      answerIndex,
      halfLives: k,
      explain:
        `剩下 ${fmtPercent(remain)} = (1/2) 的 ${k} 次方，说明衰退了 ${k} 个半衰期；` +
        `${k} × 5730 ≈ ${Math.round(years)} 年。`,
    };
  }

  const { options, answerIndex } = buildOptions(fmtPercent(remain), [
    fmtPercent(remainPercent(Math.max(0, k - 1))),
    fmtPercent(remainPercent(k + 1)),
    fmtPercent(remainPercent(k + 2)),
    fmtPercent(100 - remain),
  ]);
  return {
    kind: 'remain',
    prompt: `一份样品已经过了 ${fmtYears(years)}，其中 ¹⁴C 还剩原来的百分之多少？`,
    options,
    answerIndex,
    halfLives: k,
    explain:
      `${Math.round(years)} ÷ 5730 = ${k} 个半衰期，剩余比例 = (1/2) 的 ${k} 次方 = ${fmtPercent(remain)}。`,
  };
}
