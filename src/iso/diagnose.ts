/* 同分异构体模块 · 完备性诊断。
 * 与预先枚举出的全部异构体比对，给出“遗漏 / 重复 / 不合条件”，
 * 并按结构特征分类反馈（碳骨架异构、官能团异构、位置异构）。 */

import {
  Graph,
  canonCode,
  cloneGraph,
  findBenzeneRing,
  formulaOf,
  neighborsOf,
  sameGraph,
} from './molgraph';
import {
  CATEGORY_NAME,
  aromaticPattern,
  branchCount,
  carbonSkeletonCode,
  categoriesOf,
  hasCarbonRing,
  positionLabel,
} from './groups';
import { enumerateIsomers } from './enumerate';
import { checkGraph, condensed } from './condensed';
import { IsoProblem } from './problems';

export type VerdictStatus = 'correct' | 'duplicate' | 'offFormula' | 'offCondition' | 'invalid';

export interface AnswerVerdict {
  graph: Graph;
  text: string;
  status: VerdictStatus;
  reason: string;
}

export interface Diagnosis {
  total: number;
  correct: Graph[];
  missing: Graph[];
  verdicts: AnswerVerdict[];
  hints: string[];
  perfect: boolean;
  score: string;
}

/** 主类别：芳香是“载体”属性，判类别异构时单独看官能团 */
function mainCats(g: Graph): string[] {
  return categoriesOf(g).filter((c) => c !== 'aromatic');
}

function catNames(g: Graph): string {
  const list = mainCats(g);
  if (!list.length) return '烷烃';
  return list.map((c) => CATEGORY_NAME[c] || c).join('、');
}

/** 去掉苯环碳之后的侧链骨架（芳香族题用来判断“骨架是否同类”） */
function sideSkeletonCode(g: Graph): string {
  const ring = findBenzeneRing(g);
  if (!ring) return carbonSkeletonCode(g);
  const keep: number[] = [];
  g.atoms.forEach((a, i) => {
    if (a.el === 'C' && ring.indexOf(i) < 0) keep.push(i);
  });
  const map: Record<number, number> = {};
  keep.forEach((old, k) => {
    map[old] = k;
  });
  const sub: Graph = { atoms: keep.map(() => ({ el: 'C' as string })), bonds: [] };
  for (let x = 0; x < g.bonds.length; x++) {
    const b = g.bonds[x];
    if (map[b.a] !== undefined && map[b.b] !== undefined) {
      sub.bonds.push({ a: map[b.a], b: map[b.b], order: b.order });
    }
  }
  return canonCode(sub);
}

function branchDesc(n: number): string {
  if (n <= 0) return '直链';
  if (n === 1) return '带 1 个支链';
  return `带 ${n} 个支链`;
}

export function diagnose(problem: IsoProblem, answers: Graph[]): Diagnosis {
  const standard = enumerateIsomers(problem.formula, problem.constraint);
  const correct: Graph[] = [];
  const verdicts: AnswerVerdict[] = [];
  const seen: Graph[] = [];

  for (const a of answers) {
    const text = condensed(a) || '（无法识别）';
    const f = formulaOf(a);
    if (f !== problem.formula) {
      verdicts.push({
        graph: a,
        text,
        status: 'offFormula',
        reason: `分子式是 ${f}，题目要求 ${problem.formula}`,
      });
      continue;
    }
    const chk = checkGraph(a);
    if (!chk.ok) {
      verdicts.push({ graph: a, text, status: 'invalid', reason: chk.msg });
      continue;
    }
    if (seen.some((s) => sameGraph(s, a))) {
      verdicts.push({ graph: a, text, status: 'duplicate', reason: '和前面某个结构重复了' });
      continue;
    }
    seen.push(a);
    const hit = standard.find((s) => sameGraph(s, a));
    if (hit) {
      correct.push(hit);
      verdicts.push({ graph: a, text, status: 'correct', reason: '正确' });
    } else {
      verdicts.push({
        graph: a,
        text,
        status: 'offCondition',
        reason: `不是符合「${problem.condition}」的同分异构体`,
      });
    }
  }

  const missing = standard.filter((s) => !correct.some((c) => sameGraph(c, s)));
  const hints = buildHints(problem, correct, missing, verdicts);
  const perfect = missing.length === 0 && verdicts.every((v) => v.status === 'correct') && verdicts.length > 0;

  return {
    total: standard.length,
    correct,
    missing,
    verdicts,
    hints,
    perfect,
    score: `${correct.length} / ${standard.length}`,
  };
}

function buildHints(
  problem: IsoProblem,
  correct: Graph[],
  missing: Graph[],
  verdicts: AnswerVerdict[]
): string[] {
  const hints: string[] = [];
  const push = (s: string) => {
    if (s && hints.indexOf(s) < 0) hints.push(s);
  };

  for (const v of verdicts) {
    if (v.status === 'duplicate') push(`${v.text} 重复了，同一结构只算一种。`);
    if (v.status === 'offFormula') push(`${v.text}：${v.reason}。`);
    if (v.status === 'invalid') push(`${v.text}：${v.reason}。`);
    if (v.status === 'offCondition') push(`${v.text}：${v.reason}。`);
  }

  if (!missing.length) {
    if (correct.length) push('全部找到，没有遗漏！');
    return hints;
  }
  if (!correct.length) {
    push(`还没有写出符合条件的结构：题目要求「${problem.condition}」。`);
    push(`提示：${problem.tip}`);
    return hints;
  }

  // ① 官能团异构：缺失的类别一个都没写到
  const writtenCats = new Set<string>();
  correct.forEach((c) => mainCats(c).forEach((x) => writtenCats.add(x)));
  const missingCats = new Set<string>();
  missing.forEach((m) => mainCats(m).forEach((x) => missingCats.add(x)));
  const brandNew: string[] = [];
  missingCats.forEach((c) => {
    if (!writtenCats.has(c)) brandNew.push(c);
  });
  if (brandNew.length) {
    const writtenName: string[] = [];
    writtenCats.forEach((c) => writtenName.push(CATEGORY_NAME[c] || c));
    const missName = brandNew.map((c) => CATEGORY_NAME[c] || c).join('、');
    push(`你写了${writtenName.join('、')}，但漏了${missName}（官能团异构）。`);
  }

  // ② 位置异构（芳香族）：同骨架同类，只是取代位置不同
  const aromatic = !!problem.constraint.aromatic;
  if (aromatic) {
    const missPos: string[] = [];
    const havePos: string[] = [];
    missing.forEach((m) => {
      const pat = aromaticPattern(m);
      if (pat === null) return;
      const label = positionLabel(pat) || '其它位置';
      const sameKind = correct.some(
        (c) =>
          sideSkeletonCode(c) === sideSkeletonCode(m) &&
          mainCats(c).join(',') === mainCats(m).join(',')
      );
      if (sameKind && missPos.indexOf(label) < 0) missPos.push(label);
    });
    correct.forEach((c) => {
      const pat = aromaticPattern(c);
      if (pat === null) return;
      const label = positionLabel(pat) || '其它位置';
      if (havePos.indexOf(label) < 0) havePos.push(label);
    });
    if (missPos.length && havePos.length) {
      push(`你写了${havePos.join('和')}，但漏了${missPos.join('和')}（位置异构）。`);
    }
  }

  // ③ 碳骨架异构：链 / 环
  const ringMissing = missing.some((m) => hasCarbonRing(m) && !findBenzeneRing(m));
  const ringWritten = correct.some((c) => hasCarbonRing(c) && !findBenzeneRing(c));
  const chainMissing = missing.some((m) => !hasCarbonRing(m));
  const chainWritten = correct.some((c) => !hasCarbonRing(c));
  if (ringMissing && chainWritten && !ringWritten) {
    push('你写了链状，但漏了环状（碳骨架异构）。');
  } else if (chainMissing && ringWritten && !chainWritten) {
    push('你写了环状，但漏了链状（碳骨架异构）。');
  }

  // ④ 碳骨架异构：直链 / 支链（无环部分）
  const branchPairs = new Map<string, string>();
  missing.forEach((m) => {
    const skel = sideSkeletonCode(m);
    const mate = correct.find((c) => {
      if (sideSkeletonCode(c) === skel) return false;
      if (hasCarbonRing(c) !== hasCarbonRing(m)) return false;
      return mainCats(c).join(',') === mainCats(m).join(',');
    });
    if (!mate) return;
    const bm = branchCount(m);
    const bc = branchCount(mate);
    if (bm === bc) return;
    branchPairs.set(branchDesc(bc), branchDesc(bm));
  });
  const mutual = [...branchPairs.keys()].some(
    (h) => branchPairs.get(branchPairs.get(h) as string) === h
  );
  if (mutual) {
    push('直链的和带支链的都要写全（碳骨架异构）。');
  } else {
    branchPairs.forEach((missDesc, haveDesc) => {
      push(`你写了${haveDesc}的，但漏了${missDesc}的（碳骨架异构）。`);
    });
  }

  // ⑤ 位置异构（链状：官能团位置）
  if (!aromatic) {
    const posMissing = missing.some((m) =>
      correct.some(
        (c) =>
          carbonSkeletonCode(c) === carbonSkeletonCode(m) &&
          mainCats(c).join(',') === mainCats(m).join(',')
      )
    );
    if (posMissing) push('骨架和官能团都对，但官能团的位置还没写全（位置异构）。');
  }

  if (hints.length === 0) {
    push(`还差 ${missing.length} 种：${missing.slice(0, 2).map((m) => condensed(m)).join('、')}${missing.length > 2 ? ' 等' : ''}。`);
  }
  push(`提示：${problem.tip}`);
  return hints;
}

/** 供“看答案”使用：标准答案的结构简式列表 */
export function answerTexts(problem: IsoProblem): string[] {
  return enumerateIsomers(problem.formula, problem.constraint).map((g) => condensed(g));
}

export function cloneAnswer(g: Graph): Graph {
  return cloneGraph(g);
}

export { neighborsOf };
