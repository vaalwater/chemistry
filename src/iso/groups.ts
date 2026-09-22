/* 同分异构体模块 · 官能团识别、合理性过滤与骨架指纹。 */

import {
  Graph,
  bondOrder,
  bondSumOf,
  canonCode,
  degreeOf,
  findBenzeneRing,
  findRings,
  hOf,
  isHalogen,
  neighborsOf,
  valenceOf,
} from './molgraph';

export type Category =
  | 'alkane'
  | 'alkene'
  | 'alkyne'
  | 'cycloalkane'
  | 'aromatic'
  | 'phenol'
  | 'alcohol'
  | 'ether'
  | 'aldehyde'
  | 'ketone'
  | 'acid'
  | 'ester'
  | 'halide';

export const CATEGORY_NAME: Record<string, string> = {
  alkane: '烷烃',
  alkene: '烯烃',
  alkyne: '炔烃',
  cycloalkane: '环烷烃',
  aromatic: '芳香族',
  phenol: '酚类',
  alcohol: '醇类',
  ether: '醚类',
  aldehyde: '醛类',
  ketone: '酮类',
  acid: '羧酸类',
  ester: '酯类',
  halide: '卤代烃',
};

export interface Features {
  /** 分类标签（一个分子可同时属于多类，如芳香醇） */
  categories: Category[];
  benzene: number[] | null;
  /** 羰基碳下标 */
  carbonyl: number[];
  /** 羟基氧（—OH）下标 */
  hydroxy: number[];
  /** 醚氧 / 酯氧（—O—）下标 */
  etherO: number[];
  /** 连有卤素的碳下标 */
  halideC: number[];
}

export function analyze(g: Graph): Features {
  const benzene = findBenzeneRing(g);
  const inBenzene = (i: number) => !!benzene && benzene.indexOf(i) >= 0;

  const carbonyl: number[] = [];
  const hydroxy: number[] = [];
  const etherO: number[] = [];
  const halideC: number[] = [];
  const cats: Category[] = [];

  for (let i = 0; i < g.atoms.length; i++) {
    const el = g.atoms[i].el;
    const nb = neighborsOf(g, i);
    if (el === 'O') {
      const carbonCount = nb.filter((n) => g.atoms[n.j].el === 'C').length;
      if (hOf(g, i) > 0 && carbonCount === 1) hydroxy.push(i);
      else if (nb.length === 2 && nb.every((n) => g.atoms[n.j].el === 'C')) etherO.push(i);
    }
    if (el === 'C') {
      const doubleO = nb.filter((n) => g.atoms[n.j].el === 'O' && n.order === 2);
      if (doubleO.length) carbonyl.push(i);
      if (nb.some((n) => isHalogen(g.atoms[n.j].el))) halideC.push(i);
    }
    if (isHalogen(el)) {
      for (const n of nb) if (g.atoms[n.j].el === 'C') halideC.push(n.j);
    }
  }

  // 羰基细分：羧酸 / 酯 / 醛 / 酮
  let hasAcid = false;
  let hasEster = false;
  let hasAldehyde = false;
  let hasKetone = false;
  for (const ci of carbonyl) {
    const nb = neighborsOf(g, ci);
    const singleO = nb.filter((n) => g.atoms[n.j].el === 'O' && n.order === 1);
    const carbonNb = nb.filter((n) => g.atoms[n.j].el === 'C');
    if (singleO.length) {
      const o = singleO[0].j;
      const oNb = neighborsOf(g, o);
      const otherC = oNb.filter((n) => n.j !== ci && g.atoms[n.j].el === 'C');
      if (hOf(g, o) > 0) hasAcid = true;
      else if (otherC.length) hasEster = true;
    } else if (hOf(g, ci) === 1 && carbonNb.length === 1) {
      hasAldehyde = true;
    } else if (carbonNb.length === 2) {
      hasKetone = true;
    }
  }

  let hasPhenol = false;
  let hasAlcohol = false;
  for (const o of hydroxy) {
    const nb = neighborsOf(g, o);
    const c = nb[0] ? nb[0].j : -1;
    if (c >= 0 && inBenzene(c)) hasPhenol = true;
    else hasAlcohol = true;
  }

  const hasEther = etherO.length > 0;

  // 芳香醚：苯环碳 —O— C
  const aromaticEther = etherO.some((o) =>
    neighborsOf(g, o).some((n) => inBenzene(n.j))
  );

  if (benzene) cats.push('aromatic');
  if (hasAcid) cats.push('acid');
  if (hasEster) cats.push('ester');
  if (hasAldehyde) cats.push('aldehyde');
  if (hasKetone) cats.push('ketone');
  if (hasPhenol) cats.push('phenol');
  if (hasAlcohol) cats.push('alcohol');
  if (hasEther) cats.push('ether');
  if (halideC.length) cats.push('halide');

  let hasDoubleC = false;
  let hasTripleC = false;
  for (const b of g.bonds) {
    if (g.atoms[b.a].el === 'C' && g.atoms[b.b].el === 'C') {
      if (b.order === 2) hasDoubleC = true;
      if (b.order === 3) hasTripleC = true;
    }
  }
  if (hasTripleC) cats.push('alkyne');
  else if (hasDoubleC) cats.push('alkene');

  // 环烷烃：非芳香的全单键碳环
  if (!benzene) {
    const rings = findRings(g);
    if (rings.some((r) => r.every((i) => g.atoms[i].el === 'C') && r.every((i, k) => bondOrder(g, i, r[(k + 1) % r.length]) === 1))) {
      cats.push('cycloalkane');
    }
  }

  if (!cats.length) cats.push('alkane');
  if (aromaticEther && cats.indexOf('ether') < 0) cats.push('ether');

  return {
    categories: cats,
    benzene,
    carbonyl,
    hydroxy,
    etherO,
    halideC,
  };
}

export function categoriesOf(g: Graph): Category[] {
  return analyze(g).categories;
}

export function hasCategory(g: Graph, c: Category): boolean {
  return categoriesOf(g).indexOf(c) >= 0;
}

/* ---------------- 合理性（高中范围内“存在且稳定”）过滤 ---------------- */

export function isPlausible(g: Graph): boolean {
  const n = g.atoms.length;
  // 价键不能超
  for (let i = 0; i < n; i++) {
    if (bondSumOf(g, i) > valenceOf(g.atoms[i].el)) return false;
    if (hOf(g, i) < 0) return false;
  }
  // 过氧 / 次卤酸 / 卤素互化物等：高中不涉及
  for (const b of g.bonds) {
    const ea = g.atoms[b.a].el;
    const eb = g.atoms[b.b].el;
    if (ea === 'O' && eb === 'O') return false;
    if (ea === 'O' && isHalogen(eb)) return false;
    if (eb === 'O' && isHalogen(ea)) return false;
    if (isHalogen(ea) && isHalogen(eb)) return false;
    if (ea === 'N' && eb === 'N') return false;
  }
  // 一个碳上两个及以上羟基（偕二醇）不稳定
  for (let i = 0; i < n; i++) {
    if (g.atoms[i].el !== 'C') continue;
    let oh = 0;
    let doubleO = 0;
    for (const nb of neighborsOf(g, i)) {
      if (g.atoms[nb.j].el === 'O' && nb.order === 1 && hOf(g, nb.j) > 0) oh++;
      if (g.atoms[nb.j].el === 'O' && nb.order === 2) doubleO++;
    }
    if (oh >= 2) return false;
    if (doubleO >= 2) return false; // CO₂ 型
  }
  // 烯醇式（C=C—OH）不稳定；苯环上的 —OH 是酚，稳定，不算烯醇
  const benz = findBenzeneRing(g);
  for (const b of g.bonds) {
    if (b.order !== 2) continue;
    if (g.atoms[b.a].el !== 'C' || g.atoms[b.b].el !== 'C') continue;
    for (const end of [b.a, b.b]) {
      if (benz && benz.indexOf(end) >= 0) continue;
      for (const nb of neighborsOf(g, end)) {
        if (g.atoms[nb.j].el === 'O' && hOf(g, nb.j) > 0) return false;
      }
    }
  }
  // 三元 / 四元环张力过大（苯环除外）
  const benzene = findBenzeneRing(g);
  for (const r of findRings(g)) {
    if (r.length <= 4 && !(benzene && r.length === 6)) return false;
  }
  return true;
}

/* ---------------- 骨架指纹（用于诊断分类） ---------------- */

/** 只保留碳原子与碳-碳键的骨架 */
export function carbonGraph(g: Graph): Graph {
  const keep: number[] = [];
  g.atoms.forEach((a, i) => {
    if (a.el === 'C') keep.push(i);
  });
  const map: Record<number, number> = {};
  keep.forEach((old, k) => {
    map[old] = k;
  });
  const out: Graph = { atoms: keep.map((i) => ({ el: 'C' })), bonds: [] };
  for (const b of g.bonds) {
    if (map[b.a] !== undefined && map[b.b] !== undefined) {
      out.bonds.push({ a: map[b.a], b: map[b.b], order: b.order });
    }
  }
  return out;
}

export function carbonSkeletonCode(g: Graph): string {
  return canonCode(carbonGraph(g));
}

/** 支链数：碳骨架上度 ≥ 3 的碳个数（无环时即“支链个数”） */
export function branchCount(g: Graph): number {
  const cg = carbonGraph(g);
  let n = 0;
  for (let i = 0; i < cg.atoms.length; i++) if (degreeOf(cg, i) >= 3) n++;
  return n;
}

export function hasCarbonRing(g: Graph): boolean {
  return findRings(carbonGraph(g)).length > 0;
}

/**
 * 苯环取代模式的规范编码：把 6 个环位上有无取代基表示为 6 位掩码，
 * 取旋转/反射下的最小值 —— 同模式（如两个邻位）一定得到同一个数。
 */
export function aromaticPattern(g: Graph): number | null {
  const ring = findBenzeneRing(g);
  if (!ring) return null;
  // 环按 0..5 顺序排列
  const seq = ring;
  const bits = seq.map((i) => {
    const nb = neighborsOf(g, i);
    // 环外取代：除两个环内邻居外还有连接
    return nb.length > 2 ? 1 : 0;
  });
  let best = 63;
  for (let rot = 0; rot < 6; rot++) {
    for (const flip of [false, true]) {
      const v: number[] = [];
      for (let k = 0; k < 6; k++) {
        const idx = flip ? (6 - ((rot + k) % 6)) % 6 : (rot + k) % 6;
        v.push(bits[idx]);
      }
      let val = 0;
      for (let k = 0; k < 6; k++) val = val * 2 + v[k];
      if (val < best) best = val;
    }
  }
  return best;
}

const POSITION_LABEL: Record<number, string> = {
  3: '邻位', // 000011 → 1,2
  5: '间位', // 000101 → 1,3
  9: '对位', // 001001 → 1,4
};

export function positionLabel(code: number): string | null {
  return POSITION_LABEL[code] || null;
}

/** 取代基个数（挂在苯环上的非环基团数） */
export function aromaticSubCount(g: Graph): number {
  const ring = findBenzeneRing(g);
  if (!ring) return 0;
  let n = 0;
  for (const i of ring) if (neighborsOf(g, i).length > 2) n++;
  return n;
}
