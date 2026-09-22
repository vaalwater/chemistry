/* 同分异构体模块 · 分子图基础。
 * 只保存“重原子图”（C / O / N / 卤素 / S），氢原子按价键规则隐式推算，
 * 这样“同一个分子”的不同搭建顺序会得到同一份数据，便于判重与匹配。 */

export interface GAtom {
  el: string;
}

export interface GBond {
  a: number;
  b: number;
  order: number;
}

export interface Graph {
  atoms: GAtom[];
  bonds: GBond[];
}

/** 各元素在中性有机物中的共价数（最高价） */
const VALENCE: Record<string, number> = {
  C: 4,
  N: 3,
  O: 2,
  S: 2,
  F: 1,
  Cl: 1,
  Br: 1,
  I: 1,
};

const HALOGENS = ['F', 'Cl', 'Br', 'I'];

export function valenceOf(el: string): number {
  return VALENCE[el] !== undefined ? VALENCE[el] : 4;
}

export function isHalogen(el: string): boolean {
  return HALOGENS.indexOf(el) >= 0;
}

export function emptyGraph(): Graph {
  return { atoms: [], bonds: [] };
}

export function cloneGraph(g: Graph): Graph {
  return { atoms: g.atoms.map((a) => ({ el: a.el })), bonds: g.bonds.map((b) => ({ a: b.a, b: b.b, order: b.order })) };
}

export function addAtom(g: Graph, el: string): number {
  g.atoms.push({ el });
  return g.atoms.length - 1;
}

export function addBond(g: Graph, a: number, b: number, order: number): void {
  if (a === b) return;
  const exist = findBond(g, a, b);
  if (exist) {
    exist.order = order;
    return;
  }
  g.bonds.push({ a: Math.min(a, b), b: Math.max(a, b), order });
}

export function removeBond(g: Graph, a: number, b: number): void {
  const x = Math.min(a, b);
  const y = Math.max(a, b);
  g.bonds = g.bonds.filter((bd) => !(bd.a === x && bd.b === y));
}

export function removeAtom(g: Graph, i: number): void {
  g.bonds = g.bonds.filter((b) => b.a !== i && b.b !== i);
  g.bonds = g.bonds.map((b) => ({
    a: b.a > i ? b.a - 1 : b.a,
    b: b.b > i ? b.b - 1 : b.b,
    order: b.order,
  }));
  g.atoms.splice(i, 1);
}

export function findBond(g: Graph, a: number, b: number): GBond | undefined {
  const x = Math.min(a, b);
  const y = Math.max(a, b);
  for (const bd of g.bonds) if (bd.a === x && bd.b === y) return bd;
  return undefined;
}

export function bondOrder(g: Graph, a: number, b: number): number {
  const bd = findBond(g, a, b);
  return bd ? bd.order : 0;
}

export interface Neighbor {
  j: number;
  order: number;
}

export function neighborsOf(g: Graph, i: number): Neighbor[] {
  const out: Neighbor[] = [];
  for (const b of g.bonds) {
    if (b.a === i) out.push({ j: b.b, order: b.order });
    else if (b.b === i) out.push({ j: b.a, order: b.order });
  }
  return out;
}

export function degreeOf(g: Graph, i: number): number {
  return neighborsOf(g, i).length;
}

/** 该原子已用掉的价键数（键级之和） */
export function bondSumOf(g: Graph, i: number): number {
  let s = 0;
  for (const n of neighborsOf(g, i)) s += n.order;
  return s;
}

/** 该原子上还挂几个氢（价键未满的部分） */
export function hOf(g: Graph, i: number): number {
  return valenceOf(g.atoms[i].el) - bondSumOf(g, i);
}

export function totalH(g: Graph): number {
  let s = 0;
  for (let i = 0; i < g.atoms.length; i++) s += hOf(g, i);
  return s;
}

export function countsOf(g: Graph): Record<string, number> {
  const c: Record<string, number> = {};
  for (const a of g.atoms) c[a.el] = (c[a.el] || 0) + 1;
  const h = totalH(g);
  if (h > 0) c.H = h;
  else delete c.H;
  return c;
}

const HILL_REST = ['N', 'O', 'F', 'Cl', 'Br', 'I', 'S'];

/** Hill 记法：C、H 在前，其余按字母序 */
export function formulaOf(g: Graph): string {
  const c = countsOf(g);
  let s = '';
  if (c.C) s += 'C' + (c.C > 1 ? c.C : '');
  if (c.H) s += 'H' + (c.H > 1 ? c.H : '');
  for (const el of HILL_REST) if (c[el]) s += el + (c[el] > 1 ? c[el] : '');
  return s;
}

/** 解析 C4H8O2 / C6H5Cl 这类分子式 */
export function parseFormula(s: string): Record<string, number> {
  const out: Record<string, number> = {};
  const re = /([A-Z][a-z]?)(\d*)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) {
    if (!m[1]) continue;
    out[m[1]] = (out[m[1]] || 0) + (m[2] ? parseInt(m[2], 10) : 1);
  }
  return out;
}

export function countsToString(c: Record<string, number>): string {
  let s = '';
  if (c.C) s += 'C' + (c.C > 1 ? c.C : '');
  if (c.H) s += 'H' + (c.H > 1 ? c.H : '');
  for (const el of HILL_REST) if (c[el]) s += el + (c[el] > 1 ? c[el] : '');
  return s;
}

export function isConnected(g: Graph): boolean {
  if (!g.atoms.length) return false;
  const seen = new Array<boolean>(g.atoms.length).fill(false);
  const stack = [0];
  seen[0] = true;
  let n = 1;
  while (stack.length) {
    const i = stack.pop() as number;
    for (const nb of neighborsOf(g, i)) {
      if (!seen[nb.j]) {
        seen[nb.j] = true;
        n++;
        stack.push(nb.j);
      }
    }
  }
  return n === g.atoms.length;
}

/* ---------------- 环 ---------------- */

/** 枚举所有简单环（分子很小，直接 DFS） */
export function findRings(g: Graph): number[][] {
  const rings: number[][] = [];
  const keys = new Set<string>();
  const n = g.atoms.length;
  for (let s = 0; s < n; s++) {
    const path: number[] = [s];
    const onPath = new Array<boolean>(n).fill(false);
    onPath[s] = true;
    const dfs = (v: number) => {
      for (const nb of neighborsOf(g, v)) {
        const w = nb.j;
        if (w === s && path.length >= 3) {
          const key = [...path].sort((a, b) => a - b).join('.');
          if (!keys.has(key)) {
            keys.add(key);
            rings.push([...path]);
          }
        } else if (!onPath[w] && w > s) {
          onPath[w] = true;
          path.push(w);
          dfs(w);
          path.pop();
          onPath[w] = false;
        }
      }
    };
    dfs(s);
  }
  return rings;
}

/** 苯环：6 个碳组成的环，键级 1/2 交替（Kekulé 式） */
export function findBenzeneRing(g: Graph): number[] | null {
  for (const r of findRings(g)) {
    if (r.length !== 6) continue;
    if (!r.every((i) => g.atoms[i].el === 'C')) continue;
    let ok = true;
    for (let k = 0; k < 6; k++) {
      const o1 = bondOrder(g, r[k], r[(k + 1) % 6]);
      const o2 = bondOrder(g, r[(k + 1) % 6], r[(k + 2) % 6]);
      if (o1 + o2 !== 3 || o1 === o2) {
        ok = false;
        break;
      }
    }
    if (ok) return r;
  }
  return null;
}

/* ---------------- 规范编码 / 同构判定 ---------------- */

function initLabels(g: Graph): string[] {
  return g.atoms.map((_, i) => `${g.atoms[i].el}:${degreeOf(g, i)}:${bondSumOf(g, i)}`);
}

function refineOnce(g: Graph, labels: string[]): string[] {
  return g.atoms.map((_, i) => {
    const nb = neighborsOf(g, i)
      .map((n) => `${n.order}${labels[n.j]}`)
      .sort()
      .join(',');
    return `${labels[i]}(${nb})`;
  });
}

/**
 * 芳香化：把苯环上的键统一标记为“芳香键”（order 4）。
 * 苯环的 Kekulé 式有两种写法，双键位置不同但代表同一个分子，
 * 不归一化会把同一个二甲苯判成两种不同的结构。
 */
function aromatized(g: Graph): Graph {
  const ring = findBenzeneRing(g);
  if (!ring) return g;
  const out = cloneGraph(g);
  for (let k = 0; k < ring.length; k++) {
    const bd = findBond(out, ring[k], ring[(k + 1) % ring.length]);
    if (bd) bd.order = 4;
  }
  return out;
}

/** 按给定的原子排列顺序编码整张图 */
function encodeWithOrder(g: Graph, order: number[]): string {
  const pos = new Array<number>(g.atoms.length);
  order.forEach((atomIdx, p) => {
    pos[atomIdx] = p;
  });
  let head = '';
  for (const i of order) head += g.atoms[i].el;
  const edges = g.bonds
    .map((b) => {
      const x = pos[b.a];
      const y = pos[b.b];
      return x < y ? `${x}-${y}:${b.order}` : `${y}-${x}:${b.order}`;
    })
    .sort()
    .join(',');
  return `${head}|${edges}`;
}

function permutationsOf(arr: number[]): number[][] {
  if (arr.length <= 1) return [arr.slice()];
  const out: number[][] = [];
  for (let i = 0; i < arr.length; i++) {
    const rest = arr.slice(0, i).concat(arr.slice(i + 1));
    for (const p of permutationsOf(rest)) out.push([arr[i]].concat(p));
  }
  return out;
}

function fact(n: number): number {
  let r = 1;
  for (let i = 2; i <= n; i++) r *= i;
  return r;
}

const CANON_PERM_LIMIT = 5000;

/**
 * 规范串：Weisfeiler-Lehman 精化后，对“标签相同（互为对称）”的原子枚举排列取最小编码。
 * 只按标签排序是不够的 —— 二乙醚左右两半对称，两种编号会给出不同的边串，
 * 会被当成两个结构。枚举对称组后取最小值可保证同一个分子只有一种编码。
 */
export function canonCode(g: Graph): string {
  const src = aromatized(g);
  const n = src.atoms.length;
  let labels = initLabels(src);
  for (let it = 0; it < n + 2; it++) labels = refineOnce(src, labels);

  const groups = new Map<string, number[]>();
  labels.forEach((l, i) => {
    const arr = groups.get(l);
    if (arr) arr.push(i);
    else groups.set(l, [i]);
  });
  const groupList = [...groups.keys()].sort().map((k) => groups.get(k) as number[]);

  const baseOrder = src.atoms.map((_, i) => i).sort((a, b) => {
    if (labels[a] < labels[b]) return -1;
    if (labels[a] > labels[b]) return 1;
    return a - b;
  });

  let combos = 1;
  for (const grp of groupList) combos *= fact(grp.length);
  if (combos <= 1 || combos > CANON_PERM_LIMIT) return encodeWithOrder(src, baseOrder);

  let best: string | null = null;
  const assemble = (gi: number, acc: number[]) => {
    if (gi >= groupList.length) {
      const code = encodeWithOrder(src, acc);
      if (best === null || code < best) best = code;
      return;
    }
    for (const perm of permutationsOf(groupList[gi])) assemble(gi + 1, acc.concat(perm));
  };
  assemble(0, []);
  return best !== null ? best : encodeWithOrder(src, baseOrder);
}

function adjacency(g: Graph): number[][] {
  const n = g.atoms.length;
  const m: number[][] = [];
  for (let i = 0; i < n; i++) m.push(new Array<number>(n).fill(0));
  for (const b of g.bonds) {
    m[b.a][b.b] = b.order;
    m[b.b][b.a] = b.order;
  }
  return m;
}

/** 精确同构判定（回溯 + 度/价剪枝），用于规范串冲突时兜底 */
export function areIsomorphic(a: Graph, b: Graph): boolean {
  a = aromatized(a);
  b = aromatized(b);
  if (a.atoms.length !== b.atoms.length) return false;
  if (a.bonds.length !== b.bonds.length) return false;
  const ca = countsOf(a);
  const cb = countsOf(b);
  for (const k of Object.keys(ca)) if (ca[k] !== cb[k]) return false;
  for (const k of Object.keys(cb)) if (ca[k] !== cb[k]) return false;

  const n = a.atoms.length;
  const am = adjacency(a);
  const bm = adjacency(b);
  const orderA = a.atoms.map((_, i) => i).sort((x, y) => degreeOf(a, y) - degreeOf(a, x));
  const map = new Array<number>(n).fill(-1);
  const used = new Array<boolean>(n).fill(false);

  const bt = (k: number): boolean => {
    if (k === n) return true;
    const ai = orderA[k];
    for (let bj = 0; bj < n; bj++) {
      if (used[bj]) continue;
      if (a.atoms[ai].el !== b.atoms[bj].el) continue;
      if (degreeOf(a, ai) !== degreeOf(b, bj)) continue;
      if (bondSumOf(a, ai) !== bondSumOf(b, bj)) continue;
      let ok = true;
      for (let p = 0; p < k; p++) {
        const aj = orderA[p];
        if (am[ai][aj] !== bm[bj][map[aj]]) {
          ok = false;
          break;
        }
      }
      if (!ok) continue;
      map[ai] = bj;
      used[bj] = true;
      if (bt(k + 1)) return true;
      used[bj] = false;
      map[ai] = -1;
    }
    return false;
  };
  return bt(0);
}

/** 去重：先按规范串分桶，桶内再用精确同构合并 */
export function dedupe(graphs: Graph[]): Graph[] {
  const buckets = new Map<string, Graph[]>();
  for (const g of graphs) {
    const key = canonCode(g);
    const arr = buckets.get(key);
    if (!arr) buckets.set(key, [g]);
    else if (!arr.some((x) => areIsomorphic(x, g))) arr.push(g);
  }
  const out: Graph[] = [];
  buckets.forEach((arr) => arr.forEach((g) => out.push(g)));
  return out;
}

/** 学生答案与标准答案是否是同一个分子 */
export function sameGraph(a: Graph, b: Graph): boolean {
  if (canonCode(a) === canonCode(b) && a.bonds.length === b.bonds.length) return true;
  return areIsomorphic(a, b);
}
