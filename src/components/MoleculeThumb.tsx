import { memo } from 'react';
import { View } from 'react-native';
import type { MoleculeData } from '../types';
import { elementBySymbol } from '../data';

interface Props {
  mol: MoleculeData;
  size?: number;
}

/** 用分子真实坐标绘制的示意小图（仅用于列表卡片） */
function MoleculeThumb({ mol, size = 74 }: Props) {
  const atoms = mol.atoms ?? [];
  const points = atoms.map((a) => {
    const [x, y, z] = a.pos;
    // 等距投影
    const u = (x - z) * 0.85;
    const v = y * 0.82 + (x + z) * 0.3;
    return { el: a.el, u, v };
  });

  const inner = size - 12;
  const xs = points.map((p) => p.u);
  const ys = points.map((p) => p.v);
  const minU = Math.min(...xs, -0.1);
  const maxU = Math.max(...xs, 0.1);
  const minV = Math.min(...ys, -0.1);
  const maxV = Math.max(...ys, 0.1);
  const span = Math.max(maxU - minU, maxV - minV, 0.1);
  const unit = (inner - 6) / span;
  const cx = (minU + maxU) / 2;
  const cy = (minV + maxV) / 2;

  return (
    <View
      style={{
        width: size,
        height: size,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <View style={{ width: size * 0.9, height: size * 0.9 }}>
        {points.map((p, i) => {
          const el = elementBySymbol(p.el);
          const r = Math.max((el?.radius ?? 0.4) * unit * 2.1, 5);
          return (
            <View
              key={i}
              style={{
                position: 'absolute',
                left: (p.u - cx) * unit + inner / 2 - r,
                top: (p.v - cy) * unit + inner / 2 - r,
                width: r * 2,
                height: r * 2,
                borderRadius: r,
                backgroundColor: el?.color ?? '#b9c6d8',
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
