/* 同分异构体模块 · 结构简式生成与搭建结果校验。
 * 例：CH3CH2CH2OH、CH3CH(OH)CH3、CH3COOCH2CH3、HCOOCH3、CH3OCH2CH3、C6H5CH2OH。 */

import {
  Graph,
  bondOrder,
  bondSumOf,
  findBenzeneRing,
  formulaOf,
  hOf,
  isConnected,
  isHalogen,
  neighborsOf,
  valenceOf,
} from './molgraph';
import { aromaticPattern, isPlausible, positionLabel } from './groups';

export interface GraphCheck {
  ok: boolean;
  msg: string;
  formula: string;
}

export function checkGraph(g: Graph): GraphCheck {
  const formula = g.atoms.length ? formulaOf(g) : '';
  if (!g.atoms.length) return { ok: false, msg: '还没有放入任何原子', formula };
  if (!isConnected(g)) return { ok: false, msg: '分子不连通：还有原子没连上', formula };
  for (let i = 0; i < g.atoms.length; i++) {
    if (bondSumOf(g, i) > valenceOf(g.atoms[i].el)) {
      return { ok: false, msg: `${g.atoms[i].el} 上的键太多了（超过 ${valenceOf(g.atoms[i].el)} 价）`, formula };
    }
  }
  for (let i = 0; i < g.atoms.length; i++) {
    if (g.atoms[i].el === 'C' && hOf(g, i) === 0 && neighborsOf(g, i).length === 0) {
      return { ok: false, msg: '有孤立的碳原子', formula };
    }
  }
  if (!isPlausible(g)) return { ok: false, msg: '这个结构在高中范围内不稳定（如过氧键、同碳多羟基、三元环）', formula };
  return { ok: true, msg: '结构完整', formula };
}

/* ---------------- 路径 ---------------- */

function allSimplePaths(g: Graph, skip?: (i: number) => boolean): number[][] {
  const paths: number[][] = [];
  const n = g.atoms.length;
  const onPath = new Array<boolean>(n).fill(false);
  const path: number[] = [];
  const dfs = (v: number) => {
    paths.push(path.slice());
    for (const nb of neighborsOf(g, v)) {
      if (onPath[nb.j]) continue;
      if (skip && skip(nb.j)) continue;
      onPath[nb.j] = true;
      path.push(nb.j);
      dfs(nb.j);
      path.pop();
      onPath[nb.j] = false;
    }
  };
  for (let s = 0; s < n; s++) {
    if (skip && skip(s)) continue;
    onPath[s] = true;
    path.push(s);
    dfs(s);
    path.pop();
    onPath[s] = false;
  }
  return paths;
}

/**
 * 主链：最长重原子路径。
 * - 羰基氧（=O）不进主链：它由 token 里的 CO / CHO / COOH 表达，进主链会写出 CH3C(CH3)O 这种怪式子
 * - 长度并列时碳多者优先：保证 2-丁醇写成 CH3CH(OH)CH2CH3 而不是 CH3CH2CH(CH3)OH
 */
function mainPath(g: Graph): number[] {
  const isCarbonylO = (i: number) =>
    g.atoms[i].el === 'O' && neighborsOf(g, i).some((n) => n.order === 2);
  const paths = allSimplePaths(g, isCarbonylO);
  if (!paths.length) return allSimplePaths(g)[0] || [];
  // 碳数优先；并列时看这条路“带不带官能团”（保证 2-甲基丙醛写成 CH3CH(CH3)CHO）
  const score = (p: number[]) => {
    let s = p.filter((i) => g.atoms[i].el === 'C').length * 10;
    for (const i of p) {
      if (g.atoms[i].el !== 'C') s += 1;
      else if (neighborsOf(g, i).some((n) => g.atoms[n.j].el !== 'C')) s += 1;
    }
    return s;
  };
  let best = paths[0];
  for (const p of paths) {
    if (p.length > best.length) best = p;
    else if (p.length === best.length && score(p) > score(best)) best = p;
  }
  return best;
}

/** 端点“应该放在后面”的分数：羟基/卤素/醛基/羧基在后，酯的羰基端在前 */
function endScore(g: Graph, i: number): number {
  const el = g.atoms[i].el;
  if (isHalogen(el)) return 5;
  if (el === 'O') return hOf(g, i) > 0 ? 5 : 0;
  if (el === 'C') {
    const nb = neighborsOf(g, i);
    const doubleO = nb.filter((n) => g.atoms[n.j].el === 'O' && n.order === 2);
    if (doubleO.length) {
      const esterO = nb.filter((n) => g.atoms[n.j].el === 'O' && n.order === 1);
      const isEster = esterO.some((n) => neighborsOf(g, n.j).some((m) => m.j !== i && g.atoms[m.j].el === 'C'));
      if (isEster) return -4; // 酸的部分写在前面：CH3COOCH2CH3
      return 4; // 醛 / 羧酸端写在后面
    }
  }
  return 0;
}

function orderPath(g: Graph, path: number[]): number[] {
  if (path.length < 2) return path;
  // 酯：羰基一侧写在前面（CH3COOCH2CH3，而不是反过来写成 CH3CH2OOCCH3）
  const ci = path.findIndex((i) => neighborsOf(g, i).some((n) => n.order === 2 && g.atoms[n.j].el === 'O'));
  const oi = path.findIndex(
    (i) => g.atoms[i].el === 'O' && hOf(g, i) === 0 && neighborsOf(g, i).length === 2
  );
  if (ci >= 0 && oi >= 0 && Math.abs(ci - oi) === 1 && bondOrder(g, path[ci], path[oi]) === 1) {
    return ci > oi ? path.slice().reverse() : path;
  }
  const a = path[0];
  const b = path[path.length - 1];
  const sa = endScore(g, a);
  const sb = endScore(g, b);
  if (sa === sb) {
    // 醚：短碳链在前（CH3OCH2CH3）
    const oIdx = path.findIndex((i) => g.atoms[i].el === 'O');
    if (oIdx > 0 && oIdx < path.length - 1) {
      const leftC = path.slice(0, oIdx).filter((i) => g.atoms[i].el === 'C').length;
      const rightC = path.slice(oIdx + 1).filter((i) => g.atoms[i].el === 'C').length;
      if (leftC > rightC) return path.slice().reverse();
    }
    return path;
  }
  return sa > sb ? path.slice().reverse() : path;
}

/* ---------------- 分支 ---------------- */

function joinBranches(parts: string[]): string {
  const count = new Map<string, number>();
  for (const p of parts) count.set(p, (count.get(p) || 0) + 1);
  const out: string[] = [];
  count.forEach((n, p) => {
    if (n === 1) out.push(`(${p})`);
    else out.push(`(${p})${n}`);
  });
  return out.join('');
}

/** 子取代基写法（从 i 出发，不回到 from） */
export function branchStr(g: Graph, i: number, from: number): string {
  const el = g.atoms[i].el;
  if (el === 'O') {
    if (hOf(g, i) > 0) return 'OH';
    const other = neighborsOf(g, i).filter((n) => n.j !== from)[0];
    return 'O' + (other ? branchStr(g, other.j, i) : '');
  }
  if (isHalogen(el)) return el;
  const h = hOf(g, i);
  const nb = neighborsOf(g, i).filter((n) => n.j !== from);
  const hasDoubleO = nb.some((n) => g.atoms[n.j].el === 'O' && n.order === 2);
  const rest = nb.filter((n) => !(g.atoms[n.j].el === 'O' && n.order === 2));
  let base = h === 3 ? 'CH3' : h === 2 ? 'CH2' : h === 1 ? 'CH' : 'C';
  if (hasDoubleO) {
    // 羰基：—CHO / —COOH / —CO—
    const ohBranch = rest.filter((n) => g.atoms[n.j].el === 'O' && hOf(g, n.j) > 0);
    base = (h === 1 ? 'CH' : 'C') + 'O';
    if (ohBranch.length) return base + 'OH';
  }
  const suffix: string[] = [];
  const chains: string[] = [];
  for (const n of rest) {
    const nel = g.atoms[n.j].el;
    if (nel === 'O' && hOf(g, n.j) > 0) suffix.push('OH');
    else if (isHalogen(nel)) suffix.push(nel);
    else chains.push((n.order === 2 ? '=' : n.order === 3 ? '≡' : '') + branchStr(g, n.j, i));
  }
  let s = base;
  if (chains.length === 1) s += chains[0];
  else if (chains.length > 1) s += joinBranches(chains);
  if (suffix.length) s += suffix.length === 1 ? suffix[0] : joinBranches(suffix);
  return s;
}

/* ---------------- 主链 token ---------------- */

function tokenFor(g: Graph, i: number, path: number[], pos: number): string {
  const onPath = new Set(path);
  const el = g.atoms[i].el;
  if (el === 'O') return hOf(g, i) > 0 ? 'OH' : 'O';
  if (isHalogen(el)) return el;

  const nb = neighborsOf(g, i);
  const isEnd = pos === 0 || pos === path.length - 1;
  const h = hOf(g, i);
  const carbonylO = nb.filter((n) => g.atoms[n.j].el === 'O' && n.order === 2);
  const carbonylOnPath = carbonylO.filter((n) => onPath.has(n.j));
  // 双键氧已经由 CO / CHO / COOH 表达，不能再当普通支链（否则写出 CH3CH2CO(O)CH3）
  const branches = nb.filter((n) => !onPath.has(n.j) && !(g.atoms[n.j].el === 'O' && n.order === 2));

  let base: string;
  if (carbonylO.length) {
    // 甲酸酯：羰基碳还连着主链上的酯氧时写作 HCOO—（HCOOCH3）
    const esterOOnPath = nb.some((n) => g.atoms[n.j].el === 'O' && n.order === 1 && onPath.has(n.j));
    if (carbonylOnPath.length) base = h === 1 ? 'CH' : 'C';
    else if (h === 1) base = esterOOnPath ? 'HCO' : 'CHO';
    else if (h === 2) base = 'HCHO'; // 甲醛：羰基碳上还剩两个氢
    else base = 'CO';
  } else {
    base = h === 4 ? 'CH4' : h === 3 ? 'CH3' : h === 2 ? 'CH2' : h === 1 ? 'CH' : 'C';
  }

  const suffix: string[] = [];
  const chains: string[] = [];
  for (const n of branches) {
    const nel = g.atoms[n.j].el;
    if (nel === 'O' && hOf(g, n.j) > 0) suffix.push('OH');
    else if (isHalogen(nel)) suffix.push(nel);
    else chains.push(branchStr(g, n.j, i));
  }

  let s = base;
  if (chains.length === 1 && isEnd) s += chains[0]; // 末端：线性延续 CH3CH2CH3
  else if (chains.length >= 1) s += joinBranches(chains);
  if (suffix.length) {
    if (isEnd) s += suffix.join(''); // CH3CH2OH / CH3CH2Cl
    else s += joinBranches(suffix); // CH3CH(OH)CH3
  }
  return s;
}

/* ---------------- 芳香族 ---------------- */

function condensedAromatic(g: Graph): string {
  const ring = findBenzeneRing(g);
  if (!ring) return '';
  const subs: string[] = [];
  for (const i of ring) {
    for (const nb of neighborsOf(g, i)) {
      if (ring.indexOf(nb.j) >= 0) continue;
      subs.push(branchStr(g, nb.j, i));
    }
  }
  if (!subs.length) return 'C6H6';
  if (subs.length === 1) return 'C6H5' + subs[0];
  const pat = aromaticPattern(g);
  const label = pat !== null ? positionLabel(pat) : null;
  const prefix = label ? label + '-' : '';
  const sorted = subs.slice().sort();
  if (subs.length === 2) return prefix + sorted[0] + 'C6H4' + sorted[1];
  return prefix + 'C6H3' + sorted.map((s) => `(${s})`).join('');
}

/* ---------------- 入口 ---------------- */

export function condensed(g: Graph): string {
  if (!g.atoms.length) return '';
  if (findBenzeneRing(g)) return condensedAromatic(g);
  const path = orderPath(g, mainPath(g));
  let s = '';
  path.forEach((i, pos) => {
    s += tokenFor(g, i, path, pos);
    if (pos < path.length - 1) {
      // 碳碳重键：CH2=CH2 / CH3C≡CH（羰基的 =O 由 CO / CHO / COOH 表达，不会出现在主链上）
      const o = bondOrder(g, i, path[pos + 1]);
      if (o === 2) s += '=';
      else if (o === 3) s += '≡';
    }
  });
  // 新戊烷型：CH3C(CH3)nCH3 → C(CH3)(n+2)
  const m = /^CH3C\(([^)]+)\)(\d+)CH3$/.exec(s);
  if (m) {
    const n = parseInt(m[2], 10) + 2;
    s = `C(${m[1]})${n}`;
  }
  // 叔丁醇型：CH3C(CH3)(OH)CH3 → (CH3)3COH
  if (s === 'CH3C(CH3)(OH)CH3') s = '(CH3)3COH';
  return s;
}
