/* 同分异构体模块 · 异构体枚举。
 *
 * 思路：把分子抽象成“重原子图”（氢隐式），在价键规则下枚举所有连通的重原子连接
 * 方式，再用“高中范围内合理”的规则过滤与规范编码去重。芳香族题目先锚定苯环，
 * 只枚举取代基，规模可控。
 */

import {
  Graph,
  addAtom,
  addBond,
  bondSumOf,
  cloneGraph,
  dedupe,
  emptyGraph,
  parseFormula,
  removeAtom,
  removeBond,
  valenceOf,
} from './molgraph';
import { Category, categoriesOf, isPlausible } from './groups';

export interface EnumConstraint {
  /** 必须含苯环（芳香族） */
  aromatic?: boolean;
  /** 必须含有的类别，如 ['ester'] */
  require?: Category[];
  /** 禁止出现的类别 */
  forbid?: Category[];
  /** 只允许这些类别出现其一（用于“醇或醚”这类范围题） */
  allow?: Category[];
}

const cache = new Map<string, Graph[]>();
const STEP_LIMIT = 4000000;

export function enumerateIsomers(formula: string, c: EnumConstraint = {}): Graph[] {
  const key = formula + '|' + JSON.stringify(c);
  const hit = cache.get(key);
  if (hit) return hit;
  const out = compute(formula, c);
  cache.set(key, out);
  return out;
}

function benzeneSeed(): Graph {
  const g = emptyGraph();
  for (let i = 0; i < 6; i++) addAtom(g, 'C');
  for (let i = 0; i < 6; i++) addBond(g, i, (i + 1) % 6, i % 2 === 0 ? 1 : 2);
  return g;
}

/** 酯的特征基团：C(=O)—O—C */
function esterSeed(): Graph {
  const g = emptyGraph();
  const c0 = addAtom(g, 'C');
  const o1 = addAtom(g, 'O');
  const o2 = addAtom(g, 'O');
  const c3 = addAtom(g, 'C');
  addBond(g, c0, o1, 2);
  addBond(g, c0, o2, 1);
  addBond(g, o2, c3, 1);
  return g;
}

/** 羧酸的特征基团：C(=O)—OH */
function acidSeed(): Graph {
  const g = emptyGraph();
  const c0 = addAtom(g, 'C');
  const o1 = addAtom(g, 'O');
  const o2 = addAtom(g, 'O');
  addBond(g, c0, o1, 2);
  addBond(g, c0, o2, 1);
  return g;
}

/** 从重原子清单里拿走指定数量的原子，返回剩下的 */
function takeHeavy(heavy: string[], need: Record<string, number>): string[] | null {
  const left = heavy.slice();
  for (const el of Object.keys(need)) {
    for (let k = 0; k < need[el]; k++) {
      const idx = left.indexOf(el);
      if (idx < 0) return null;
      left.splice(idx, 1);
    }
  }
  return left;
}

/** 多重集的全排列（去重） */
function distinctPerms(items: string[]): string[][] {
  if (items.length <= 1) return [items.slice()];
  const seen = new Set<string>();
  const out: string[][] = [];
  for (let i = 0; i < items.length; i++) {
    if (i > 0 && items[i] === items[i - 1]) continue;
    const rest = items.slice(0, i).concat(items.slice(i + 1));
    for (const p of distinctPerms(rest)) out.push([items[i]].concat(p));
  }
  const uniq: string[][] = [];
  for (const p of out) {
    const k = p.join(',');
    if (seen.has(k)) continue;
    seen.add(k);
    uniq.push(p);
  }
  return uniq;
}

function matches(g: Graph, c: EnumConstraint): boolean {
  const cats = categoriesOf(g);
  if (c.aromatic && cats.indexOf('aromatic') < 0) return false;
  if (c.require && !c.require.every((r) => cats.indexOf(r) >= 0)) return false;
  if (c.forbid && c.forbid.some((f) => cats.indexOf(f) >= 0)) return false;
  if (c.allow && !cats.some((x) => c.allow!.indexOf(x) >= 0)) return false;
  return true;
}

/** 学生的结构是否满足题目的限制条件（含苯环 / 酯类 / 醇或醚 …） */
export function matchesConstraint(g: Graph, c: EnumConstraint): boolean {
  return matches(g, c);
}

function compute(formula: string, c: EnumConstraint): Graph[] {
  const counts = parseFormula(formula);
  const heavy: string[] = [];
  for (const el of Object.keys(counts)) {
    if (el === 'H') continue;
    for (let i = 0; i < counts[el]; i++) heavy.push(el);
  }
  const H = counts.H || 0;
  let vsum = 0;
  for (const el of heavy) vsum += valenceOf(el);
  const S = (vsum - H) / 2; // 需要的键级总和
  if (!Number.isInteger(S)) return [];
  if (heavy.length === 0) return [];
  if (S < heavy.length - 1) return [];

  let seed: Graph | null = null;
  let rest: string[] = heavy;
  if (c.aromatic) {
    if ((counts.C || 0) < 6) return [];
    seed = benzeneSeed();
    let removed = 0;
    rest = [];
    for (const el of heavy) {
      if (el === 'C' && removed < 6) {
        removed++;
        continue;
      }
      rest.push(el);
    }
    if (removed < 6) return [];
  }
  // 类别锚定：题目要求酯 / 羧酸时先摆好特征基团，搜索空间能降一个量级
  if (seed === null && c.require) {
    if (c.require.indexOf('ester') >= 0 && (counts.C || 0) >= 2 && (counts.O || 0) >= 2) {
      seed = esterSeed();
      const left = takeHeavy(heavy, { C: 2, O: 2 });
      if (!left) return [];
      rest = left;
    } else if (c.require.indexOf('acid') >= 0 && (counts.C || 0) >= 1 && (counts.O || 0) >= 2) {
      seed = acidSeed();
      const left = takeHeavy(heavy, { C: 1, O: 2 });
      if (!left) return [];
      rest = left;
    }
  }

  let seedUsed = 0;
  if (seed) for (const b of seed.bonds) seedUsed += b.order;
  const budget = S - seedUsed;
  if (budget < 0) return [];

  const results: Graph[] = [];
  let steps = 0;
  let overflow = false;

  const perms = distinctPerms(rest);
  for (const seq of perms) {
    if (overflow) break;
    const g: Graph = seed ? cloneGraph(seed) : emptyGraph();
    let start = 0;
    if (!seed) {
      addAtom(g, seq[0]);
      start = 1;
    }

    const dfs = (k: number, left: number) => {
      if (overflow) return;
      if (++steps > STEP_LIMIT) {
        overflow = true;
        return;
      }
      if (k >= seq.length) {
        if (left === 0) results.push(cloneGraph(g));
        return;
      }
      if (left < seq.length - k) return; // 剩余原子每个至少还要占 1 个键级
      const el = seq[k];
      const idx = addAtom(g, el);
      const maxNew = valenceOf(el);
      const chosen: { j: number; order: number }[] = [];

      const tryNext = (pi: number, usedV: number, usedB: number, any: boolean) => {
        if (overflow) return;
        if (pi >= idx) {
          if (!any) return;
          for (const ch of chosen) addBond(g, ch.j, idx, ch.order);
          dfs(k + 1, left - usedB);
          for (const ch of chosen) removeBond(g, ch.j, idx);
          return;
        }
        const freeJ = valenceOf(g.atoms[pi].el) - bondSumOf(g, pi);
        const maxHere = Math.min(3, maxNew - usedV, left - usedB, freeJ);
        for (let o = 0; o <= maxHere; o++) {
          if (o > 0) chosen.push({ j: pi, order: o });
          tryNext(pi + 1, usedV + o, usedB + o, any || o > 0);
          if (o > 0) chosen.pop();
        }
      };
      tryNext(0, 0, 0, false);
      removeAtom(g, idx);
    };

    dfs(start, budget);
  }

  if (overflow) {
    // 极端情况：限制被触发时仍返回已枚举到的部分，保证界面可用
    console.warn('[iso] 枚举步数超限，结果可能不完整:', formula);
  }

  const kept: Graph[] = [];
  for (const g of results) {
    if (!isPlausible(g)) continue;
    if (!matches(g, c)) continue;
    kept.push(g);
  }
  return dedupe(kept);
}

/** 该分子式在给定约束下“应该写出几个”——用于题目配置自检 */
export function countIsomers(formula: string, c: EnumConstraint = {}): number {
  return enumerateIsomers(formula, c).length;
}
