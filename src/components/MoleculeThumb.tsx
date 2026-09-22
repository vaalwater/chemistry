import { memo } from 'react';
import { View } from 'react-native';
import type { MoleculeData } from '../types';
import { elementBySymbol } from '../data';

interface Props {
  mol: MoleculeData;
  size?: number;
  /** 缩略图最大高度：Ca/Zn 等重原子半径远大于 C/H，需限制高度防止结构图撑破卡片 */
  maxHeight?: number;
}

/** 原子球半径下限（保证大分子里仍看得见） */
const MIN_ATOM_R = 5;
/** 单个原子球半径占绘图区的最大比例（重原子不会无限放大） */
const MAX_ATOM_RATIO = 0.19;
/** 绘图区留白 */
const PAD = 3;

/** 用分子真实坐标绘制的示意小图（仅用于列表卡片） */
function MoleculeThumb({ mol, size = 74, maxHeight }: Props) {
  const points = (mol.atoms ?? []).map((a) => {
    const [x, y, z] = a.pos;
    // 等距投影
    const u = (x - z) * 0.85;
    const v = y * 0.82 + (x + z) * 0.3;
    return { el: a.el, rad: elementBySymbol(a.el)?.radius ?? 0.4, u, v };
  });

  const box = size * 0.9; // 绘图区边长
  const limit = Math.max(24, maxHeight ?? size + 10); // 高度上限
  const draw = Math.min(box, limit); // 实际可绘制高度
  const avail = Math.min(box, draw) - PAD * 2;
  const maxR = Math.min(box, draw) * MAX_ATOM_RATIO;

  // 投影平面内最近的两球心距（世界单位）：键长短时先按它收窄球径，避免原子球叠成一团
  let dmin = Infinity;
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      const d = Math.hypot(points[i].u - points[j].u, points[i].v - points[j].v);
      if (d < dmin) dmin = d;
    }
  }
  const capOf = (unit: number) =>
    Math.max(Math.min(maxR, Number.isFinite(dmin) ? dmin * unit * 0.62 : maxR), MIN_ATOM_R);

  /** 各原子半径：超过上限时整体等比缩小（保留 Ca/Zn 与 C/H 的相对大小），并保证最小可见半径 */
  const radiiAt = (unit: number) => {
    const base = points.map((p) => p.rad * unit * 2.1);
    const maxBase = base.length ? Math.max(...base) : 0;
    const cap = capOf(unit);
    const k = maxBase > cap && maxBase > 0 ? cap / maxBase : 1;
    return base.map((b) => Math.max(b * k, MIN_ATOM_R));
  };

  /** 包围盒：把原子球半径一并算进去，避免球心在内、球体溢出 */
  const bounds = (unit: number) => {
    if (!points.length) return { loU: -0.1, hiU: 0.1, loV: -0.1, hiV: 0.1 };
    const rs = radiiAt(unit);
    let loU = Infinity;
    let hiU = -Infinity;
    let loV = Infinity;
    let hiV = -Infinity;
    points.forEach((p, i) => {
      const d = rs[i] / unit; // 像素半径换算回世界坐标单位
      if (p.u - d < loU) loU = p.u - d;
      if (p.u + d > hiU) hiU = p.u + d;
      if (p.v - d < loV) loV = p.v - d;
      if (p.v + d > hiV) hiV = p.v + d;
    });
    return { loU, hiU, loV, hiV };
  };

  const us = points.map((p) => p.u);
  const vs = points.map((p) => p.v);
  const span0 = Math.max(
    Math.max(...us, -0.1) - Math.min(...us, 0.1),
    Math.max(...vs, -0.1) - Math.min(...vs, 0.1),
    0.1
  );

  // 半径依赖缩放、缩放又依赖包围盒，迭代几轮即收敛
  let unit = avail / span0;
  for (let k = 0; k < 6; k++) {
    const b = bounds(unit);
    const s = Math.max(b.hiU - b.loU, b.hiV - b.loV, 0.1);
    const next = avail / s;
    if (Math.abs(next - unit) < 0.05) {
      unit = next;
      break;
    }
    unit = next;
  }
  const b = bounds(unit);
  const cx = (b.loU + b.hiU) / 2;
  const cy = (b.loV + b.hiV) / 2;
  const radii = radiiAt(unit);

  return (
    <View
      style={{
        width: size,
        height: Math.min(size, limit),
        maxHeight: limit,
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <View style={{ width: box, height: draw }}>
        {points.map((p, i) => {
          const r = radii[i];
          return (
            <View
              key={i}
              style={{
                position: 'absolute',
                left: (p.u - cx) * unit + box / 2 - r,
                top: (p.v - cy) * unit + draw / 2 - r,
                width: r * 2,
                height: r * 2,
                borderRadius: r,
                backgroundColor: elementBySymbol(p.el)?.color ?? '#b9c6d8',
                borderWidth: 1,
                borderColor: 'rgba(0,0,0,0.12)',
              }}
            />
          );
        })}
      </View>
    </View>
  );
}

export default memo(MoleculeThumb);
