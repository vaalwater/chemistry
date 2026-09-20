// 分子 3D 草图的构造工具：向量运算、环系/稠环搭建、按价数自动补氢。
// 供含氮化合物等结构较复杂的扩展分子复用（formulaBuilder 侧重通式识别，这里侧重具体结构）。
import type { MolAtom } from './types';

export type V3 = [number, number, number];
export interface SBond { a: number; b: number; order: number; style?: string }
export interface Sketch { atoms: MolAtom[]; bonds: SBond[] }

export const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const mul = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];
export function len(a: V3): number { return Math.sqrt(a[0] * a[0] + a[1] * a[1] + a[2] * a[2]); }
export function norm(a: V3): V3 { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; }
export function cross(a: V3, b: V3): V3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}
export function dist(a: V3, b: V3): number { return len(sub(a, b)); }
export function perp(a: V3): V3 {
  const t: V3 = Math.abs(a[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
  return norm(cross(a, t));
}

/** 常用键长（Å，仅作教学示意） */
export const LEN = {
  CH: 1.09, NH: 1.01, OH: 0.97,
  CC: 1.54, CdC: 1.34, CtC: 1.20,
  CN: 1.47, CdN: 1.29, CtN: 1.16,
  NN: 1.45, NdN: 1.25, NtN: 1.10,
  CO: 1.43, CdO: 1.23, NO: 1.22,
  AR: 1.39, ARN: 1.34,
};

export function sketch(): Sketch { return { atoms: [], bonds: [] }; }

export function atom(s: Sketch, el: string, pos: V3): number {
  s.atoms.push({ el, pos });
  return s.atoms.length - 1;
}
export function link(s: Sketch, a: number, b: number, order = 1, style?: string): void {
  const bd: SBond = { a, b, order };
  if (style) bd.style = style;
  s.bonds.push(bd);
}
export function dirOf(s: Sketch, from: number, to: number): V3 {
  return norm(sub(s.atoms[to].pos, s.atoms[from].pos));
}
/** 该原子已连键的价数之和（芳香键按 1.5 计，与苯环碳“再挂 1 个 H”相符） */
export function usedValence(s: Sketch, i: number): number {
  let v = 0;
  s.bonds.forEach((b) => {
    if (b.a !== i && b.b !== i) return;
    v += b.style === 'ar' ? 1.5 : b.order;
  });
  return v;
}
/** 球面均匀候选方向（黄金螺旋），保证结果稳定可复现 */
const SPIRAL: V3[] = (() => {
  const out: V3[] = [];
  const N = 220;
  const ga = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < N; i++) {
    const y = 1 - (2 * (i + 0.5)) / N;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const th = ga * i;
    out.push([Math.cos(th) * r, y, Math.sin(th) * r]);
  }
  return out;
})();
/** 为 count 条新键挑方向：尽量远离已有键（fixed）与其它原子（avoid 为相对本原子的向量） */
export function freeDirs(count: number, fixed: V3[], avoid: V3[] = [], bondLen = 1.1, prefer?: V3): V3[] {
  const chosen: V3[] = [];
  for (let k = 0; k < count; k++) {
    let best: V3 = [1, 0, 0];
    let bestScore = -Infinity;
    for (const c of SPIRAL) {
      let minF = Infinity;
      for (const f of fixed) minF = Math.min(minF, dist(c, f));
      for (const g of chosen) minF = Math.min(minF, dist(c, g));
      let extra = 0;
      if (avoid.length) {
        const p = mul(c, bondLen);
        let minA = Infinity;
        for (const v of avoid) minA = Math.min(minA, dist(p, v));
        extra = 0.9 * Math.min(minA, 2) / 2;
      }
      // prefer：可选的期望方向（如让羰基氧朝上/朝下），在不冲突的前提下优先贴合
      const score = minF + extra + (prefer ? c[0] * prefer[0] + c[1] * prefer[1] + c[2] * prefer[2] : 0);
      if (score > bestScore) { bestScore = score; best = c; }
    }
    chosen.push(best);
  }
  return chosen;
}
const VALENCE: Record<string, number> = { C: 4, N: 3, O: 2, S: 2, P: 3, H: 1 };
const H_LEN: Record<string, number> = { N: LEN.NH, O: LEN.OH, C: LEN.CH, S: 1.34 };
/** 按价数自动补氢；overrides 可指定某原子的 H 数（如吡咯型 N–H） */
export function capHydrogens(s: Sketch, overrides: Record<number, number> = {}): void {
  const n0 = s.atoms.length;
  for (let i = 0; i < n0; i++) {
    const el = s.atoms[i].el;
    if (el === 'H') continue;
    const fixed: V3[] = [];
    s.bonds.forEach((b) => {
      if (b.a === i) fixed.push(dirOf(s, i, b.b));
      else if (b.b === i) fixed.push(dirOf(s, i, b.a));
    });
    const avoid: V3[] = [];
    for (let j = 0; j < n0; j++) if (j !== i) avoid.push(sub(s.atoms[j].pos, s.atoms[i].pos));
    const auto = Math.max(0, Math.round((VALENCE[el] ?? 4) - usedValence(s, i)));
    const need = overrides[i] !== undefined ? overrides[i] : auto;
    if (need <= 0) continue;
    const hl = H_LEN[el] ?? LEN.CH;
    freeDirs(need, fixed, avoid, hl).forEach((d) => {
      const hi = atom(s, 'H', add(s.atoms[i].pos, mul(d, hl)));
      link(s, i, hi, 1);
    });
  }
}
/** 在 idx 上再连一个新原子（方向自动避让），返回新原子下标 */
export function attach(s: Sketch, idx: number, el: string, bondLen: number, order = 1, prefer?: V3): number {
  const fixed: V3[] = [];
  s.bonds.forEach((b) => {
    if (b.a === idx) fixed.push(dirOf(s, idx, b.b));
    else if (b.b === idx) fixed.push(dirOf(s, idx, b.a));
  });
  const avoid: V3[] = [];
  for (let j = 0; j < s.atoms.length; j++) if (j !== idx) avoid.push(sub(s.atoms[j].pos, s.atoms[idx].pos));
  const d = freeDirs(1, fixed, avoid, bondLen, prefer)[0];
  const ni = atom(s, el, add(s.atoms[idx].pos, mul(d, bondLen)));
  link(s, idx, ni, order);
  return ni;
}
/** 平面正 n 元环（XY 平面）；aromatic 时环键标记为芳香键（补氢按 1.5 价计） */
export function ringAt(
  s: Sketch,
  center: V3,
  R: number,
  syms: string[],
  opts: { start?: number; aromatic?: boolean; orders?: number[] } = {},
): number[] {
  const n = syms.length;
  const start = opts.start ?? Math.PI / 2;
  const idx: number[] = [];
  for (let i = 0; i < n; i++) {
    const a = start + (i * 2 * Math.PI) / n;
    idx.push(atom(s, syms[i], add(center, [Math.cos(a) * R, Math.sin(a) * R, 0])));
  }
  for (let i = 0; i < n; i++) {
    link(s, idx[i], idx[(i + 1) % n], opts.orders ? opts.orders[i] : 1, opts.aromatic ? 'ar' : undefined);
  }
  return idx;
}
/** 以已有边 (a,b) 为公共边、在远离现有原子的一侧稠合一个环；newSyms 按 b→a 的外侧顺序 */
export function fuseRing(s: Sketch, a: number, b: number, newSyms: string[], opts: { aromatic?: boolean } = {}): number[] {
  const pa = s.atoms[a].pos;
  const pb = s.atoms[b].pos;
  const L = dist(pa, pb);
  const n = newSyms.length + 2;
  const R = L / (2 * Math.sin(Math.PI / n));
  const mid = mul(add(pa, pb), 0.5);
  const d = norm(sub(pb, pa));
  const perpIn = norm(cross(d, [0, 0, 1]));
  const h = Math.sqrt(Math.max(R * R - (L / 2) * (L / 2), 1e-6));
  const others: V3[] = [];
  for (let i = 0; i < s.atoms.length; i++) if (i !== a && i !== b) others.push(s.atoms[i].pos);
  let cOld: V3 = [0, 0, 0];
  if (others.length) cOld = mul(others.reduce((acc, p) => add(acc, p), [0, 0, 0] as V3), 1 / others.length);
  const dot = (x: V3, y: V3) => x[0] * y[0] + x[1] * y[1] + x[2] * y[2];
  const side = dot(sub(add(mid, mul(perpIn, h)), cOld), perpIn) > 0 ? 1 : -1;
  const O = add(mid, mul(perpIn, side * h));
  const ang = (p: V3) => Math.atan2(p[1] - O[1], p[0] - O[0]);
  const ta = ang(pa);
  const tb = ang(pb);
  let delta = ta - tb;
  while (delta > Math.PI) delta -= 2 * Math.PI;
  while (delta < -Math.PI) delta += 2 * Math.PI;
  const step = (delta >= 0 ? -1 : 1) * ((2 * Math.PI) / n);
  const news: number[] = [];
  for (let j = 0; j < newSyms.length; j++) {
    const th = tb + step * (j + 1);
    news.push(atom(s, newSyms[j], add(O, [Math.cos(th) * R, Math.sin(th) * R, 0])));
  }
  const seq = [b, ...news, a];
  for (let i = 0; i < seq.length - 1; i++) {
    link(s, seq[i], seq[i + 1], 1, opts.aromatic ? 'ar' : undefined);
  }
  if (opts.aromatic) {
    s.bonds.forEach((bd) => {
      if ((bd.a === a && bd.b === b) || (bd.a === b && bd.b === a)) bd.style = 'ar';
    });
  }
  return news;
}
