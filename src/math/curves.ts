/**
 * 曲线的画法 + 「这条曲线过不过这个点」的判定
 *
 * 两种画法：
 *   · 显式的 y = f(x)（或 x = f(y)）：按屏幕像素一列一点地采样，遇到断点（无穷 / 跳变）就断开；
 *   · 隐式的 F(x,y) = 0（比如 x²+y²=25）：网格上逐格找变号，插值连线。
 *
 * 命中判定用的是「点到曲线的距离」的一阶近似：|F| / |∇F|。
 * 这样不管曲线有多陡，判据都是画面上的距离，不会因为 y−f(x) 本身很大就误判。
 */

import type { Vars } from './expr';
import type { Compiled } from './expr';
import { contour, type V2, type Win } from './extreme';

export type { V2, Win };

/** 一根曲线 = 若干条折线（断开的地方另起一条） */
export type Paths = V2[][];

const finite = (x: number) => Number.isFinite(x);

/** 显式 y = f(x)：按像素采样，断了就断 */
function sampleY(g: (v: Vars) => number, win: Win, pxW: number, vars: Vars): Paths {
  const n = Math.max(160, Math.min(1000, Math.round(pxW)));
  const spanY = win.yHi - win.yLo;
  const lim = spanY * 3; // 太远的（ asymptotes 冲上天）直接断掉，免得画出竖直假线
  const out: V2[] = [];
  const paths: Paths = [];
  let prev: number | null = null;
  for (let i = 0; i <= n; i += 1) {
    const x = win.xLo + ((win.xHi - win.xLo) * i) / n;
    const y = g({ ...vars, x, y: 0 });
    if (!finite(y) || Math.abs(y - ((win.yLo + win.yHi) / 2)) > lim || (prev !== null && Math.abs(y - prev) > spanY * 0.9)) {
      if (out.length > 1) paths.push(out.slice());
      out.length = 0;
      prev = null;
      continue;
    }
    out.push({ x, y });
    prev = y;
  }
  if (out.length > 1) paths.push(out);
  return paths;
}

/** 显式 x = f(y)：按 y 采样 */
function sampleX(g: (v: Vars) => number, win: Win, pxH: number, vars: Vars): Paths {
  const n = Math.max(160, Math.min(1000, Math.round(pxH * 1.2)));
  const spanX = win.xHi - win.xLo;
  const midX = (win.xLo + win.xHi) / 2;
  const out: V2[] = [];
  const paths: Paths = [];
  let prev: number | null = null;
  for (let i = 0; i <= n; i += 1) {
    const y = win.yLo + ((win.yHi - win.yLo) * i) / n;
    const x = g({ ...vars, x: 0, y });
    if (!finite(x) || Math.abs(x - midX) > spanX * 3 || (prev !== null && Math.abs(x - prev) > spanX * 0.9)) {
      if (out.length > 1) paths.push(out.slice());
      out.length = 0;
      prev = null;
      continue;
    }
    out.push({ x, y });
    prev = x;
  }
  if (out.length > 1) paths.push(out);
  return paths;
}

/** 隐式 F = 0：网格上找变号的格子，变号的两条边插值出交点 */
function sampleImplicit(F: (v: Vars) => number, win: Win, pxW: number, pxH: number, vars: Vars): Paths {
  const nx = Math.max(40, Math.min(150, Math.round(pxW / 5)));
  const ny = Math.max(30, Math.min(110, Math.round(pxH / 5)));
  const segs = contour((x, y) => F({ ...vars, x, y }), 0, win, nx, ny);
  return segs.map((s) => [s.a, s.b]);
}

export function traceCurve(c: Compiled, win: Win, pxW: number, pxH: number, vars: Vars): Paths {
  if (c.kind === 'y' && c.g) return sampleY(c.g, win, pxW, vars);
  if (c.kind === 'x' && c.g) return sampleX(c.g, win, pxH, vars);
  return sampleImplicit(c.F, win, pxW, pxH, vars);
}

/** 数值梯度（中心差分） */
export function gradOf(F: (v: Vars) => number, p: V2, vars: Vars): V2 {
  const h = 1e-4 * Math.max(1, Math.abs(p.x), Math.abs(p.y));
  const base = { ...vars, x: p.x, y: p.y };
  const fx = (F({ ...base, x: p.x + h }) - F({ ...base, x: p.x - h })) / (2 * h);
  const fy = (F({ ...base, y: p.y + h }) - F({ ...base, y: p.y - h })) / (2 * h);
  return { x: fx, y: fy };
}

/**
 * 点 p 到「F = 0 这条曲线」的距离（一阶近似）。
 * 返回 Infinity 表示算不出来（式子在这个点上没有意义）。
 */
export function distanceTo(F: (v: Vars) => number, p: V2, vars: Vars): number {
  const f = F({ ...vars, x: p.x, y: p.y });
  if (!finite(f)) return Infinity;
  const g = gradOf(F, p, vars);
  const gl = Math.hypot(g.x, g.y);
  if (!finite(gl) || gl < 1e-9) return Infinity;
  return Math.abs(f) / gl;
}

/** 曲线在窗口里的包围盒（用来自动取景）；返回 null 表示窗口里啥也没有 */
export function pathsBox(paths: Paths[]): Win | null {
  let xLo = Infinity;
  let xHi = -Infinity;
  let yLo = Infinity;
  let yHi = -Infinity;
  paths.forEach((ps) =>
    ps.forEach((pts) =>
      pts.forEach((p) => {
        if (!finite(p.x) || !finite(p.y)) return;
        if (Math.abs(p.x) > 1e4 || Math.abs(p.y) > 1e4) return;
        xLo = Math.min(xLo, p.x);
        xHi = Math.max(xHi, p.x);
        yLo = Math.min(yLo, p.y);
        yHi = Math.max(yHi, p.y);
      })
    )
  );
  if (!finite(xLo) || !finite(xHi) || !finite(yLo) || !finite(yHi)) return null;
  return { xLo, xHi, yLo, yHi };
}
