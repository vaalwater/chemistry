import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';
import { has, type RealSet } from '../math/setCore';

export type GraphMark = {
  x: number;
  /** 点在图上的高度（不填就画在 x 轴上，比如根） */
  y?: number;
  label?: string;
  color?: string;
};

interface Props {
  f: (x: number) => number;
  xLo: number;
  xHi: number;
  height?: number;
  color?: string;
  /** 解集：满足不等式的那几段 x（画成 x 轴上的粗色带 + 曲线下方的填充） */
  solution?: RealSet | null;
  /** 越界 / 失守的部分（红色） */
  bad?: RealSet | null;
  /** 参考区间，比如 B = [1,3] */
  refBox?: { lo: number; hi: number } | null;
  marks?: GraphMark[];
  /** 对称轴 x = ? */
  axis?: number | null;
  /** 顶点 */
  vertex?: { x: number; y: number } | null;
}

const N = 150;

/** 取好看的刻度间隔 */
function niceStep(span: number): number {
  const raw = span / 6;
  const pow = Math.pow(10, Math.floor(Math.log10(Math.max(raw, 1e-6))));
  const n = raw / pow;
  const step = n >= 5 ? 5 : n >= 2 ? 2 : 1;
  return step * pow;
}

/**
 * 函数图像：一条曲线 + x 轴上“解的范围”粗色带。
 * 纯 View 绘制（不依赖 svg），手机和电脑都能用；坐标全部用百分比，宽度自适应。
 */
export default function FunctionGraph({
  f,
  xLo,
  xHi,
  height = 190,
  color = colors.accent,
  solution = null,
  bad = null,
  refBox = null,
  marks = [],
  axis = null,
  vertex = null,
}: Props) {
  const geo = useMemo(() => {
    const xs: number[] = [];
    const ys: number[] = [];
    for (let i = 0; i <= N; i += 1) {
      const x = xLo + ((xHi - xLo) * i) / N;
      xs.push(x);
      ys.push(f(x));
    }
    let lo = Math.min(0, ...ys);
    let hi = Math.max(0, ...ys);
    // 只围绕“和 x 轴有关”的几处取值（顶点、根、y 轴交点）展开：
    // 抛物线两端会冲出画面被裁掉，但真正要看的那一段永远在视线里。
    const focus: number[] = [0, f(0)];
    if (vertex) focus.push(vertex.y);
    marks.forEach((m) => focus.push(m.y ?? 0));
    const cap = Math.max(3, ...focus.filter((v) => Number.isFinite(v)).map((v) => Math.abs(v))) * 2;
    lo = Math.max(lo, -cap);
    hi = Math.min(hi, cap);
    const pad = Math.max(0.6, (hi - lo) * 0.12);
    lo -= pad;
    hi += pad;
    const clampY = (y: number) => Math.max(lo, Math.min(hi, y));
    return { xs, ys: ys.map(clampY), lo, hi };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f, xLo, xHi, marks, refBox, vertex]);

  const px = (x: number) => (((x - xLo) / (xHi - xLo)) * 100).toFixed(3);
  const py = (y: number) => (((geo.hi - Math.max(geo.lo, Math.min(geo.hi, y))) / (geo.hi - geo.lo)) * 100).toFixed(3);

  const zeroPct = Number(py(0));
  const step = niceStep(xHi - xLo);
  const ticks: number[] = [];
  for (let t = Math.ceil(xLo / step) * step; t <= xHi + 1e-9; t += step) {
    ticks.push(Math.round(t * 1000) / 1000);
  }

  const segW = 100 / N + 0.35;

  return (
    <View style={[styles.wrap, { height }]}>
      {/* 参考区间 B */}
      {refBox ? (
        <View
          style={[
            styles.refBox,
            {
              left: `${Number(px(refBox.lo))}%`,
              width: `${Math.max(1, Number(px(refBox.hi)) - Number(px(refBox.lo)))}%`,
            },
          ]}
        />
      ) : null}

      {/* 网格 */}
      <View style={[styles.gridH, { top: '25%' }]} />
      <View style={[styles.gridH, { top: '50%' }]} />
      <View style={[styles.gridH, { top: '75%' }]} />

      {/* 解集填充：曲线与 x 轴之间的那一段 */}
      {solution
        ? geo.xs.map((x, i) =>
            has(solution, x) ? (
              <View
                key={`s${i}`}
                style={[
                  styles.fill,
                  {
                    left: `${Number(px(x))}%`,
                    width: `${100 / N}%`,
                    top: `${Math.min(zeroPct, Number(py(geo.ys[i])))}%`,
                    height: `${Math.max(0.8, Math.abs(zeroPct - Number(py(geo.ys[i]))))}%`,
                    backgroundColor: `${color}33`,
                  },
                ]}
              />
            ) : null
          )
        : null}

      {/* 失守 / 多出来的部分 */}
      {bad
        ? geo.xs.map((x, i) =>
            has(bad, x) ? (
              <View
                key={`b${i}`}
                style={[
                  styles.fill,
                  {
                    left: `${Number(px(x))}%`,
                    width: `${100 / N}%`,
                    top: `${Math.min(zeroPct, Number(py(geo.ys[i])))}%`,
                    height: `${Math.max(0.8, Math.abs(zeroPct - Number(py(geo.ys[i]))))}%`,
                    backgroundColor: '#e5524a44',
                  },
                ]}
              />
            ) : null
          )
        : null}

      {/* 解集在 x 轴上的粗色带 */}
      {solution
        ? geo.xs.map((x, i) =>
            has(solution, x) ? (
              <View
                key={`t${i}`}
                style={[styles.band, { left: `${Number(px(x))}%`, width: `${100 / N + 0.2}%`, backgroundColor: color }]}
              />
            ) : null
          )
        : null}

      {/* 坐标轴 */}
      <View style={[styles.axisX, { top: `${zeroPct}%` }]} />
      {xLo < 0 && xHi > 0 ? <View style={[styles.axisY, { left: `${Number(px(0))}%` }]} /> : null}

      {/* 对称轴 */}
      {axis !== null && axis >= xLo && axis <= xHi ? (
        <View style={[styles.symAxis, { left: `${Number(px(axis))}%` }]} />
      ) : null}

      {/* 曲线 */}
      {geo.xs.slice(0, N).map((x, i) => {
        const y1 = Number(py(geo.ys[i]));
        const y2 = Number(py(geo.ys[i + 1]));
        return (
          <View
            key={`c${i}`}
            style={[
              styles.seg,
              {
                left: `${Number(px(x))}%`,
                width: `${segW}%`,
                top: `${Math.min(y1, y2)}%`,
                height: `${Math.max(0.5, Math.abs(y2 - y1))}%`,
                backgroundColor: color,
              },
            ]}
          />
        );
      })}

      {/* 顶点 */}
      {vertex ? (
        <View style={[styles.dot, styles.vertexDot, { left: `${Number(px(vertex.x))}%`, top: `${Number(py(vertex.y))}%` }]} />
      ) : null}

      {/* 标记点（根、端点…） */}
      {marks.map((m, i) => {
        const at = Number(px(m.x));
        const align = at < 14 ? 'left' : at > 86 ? 'right' : 'center';
        return (
          <View
            key={`m${i}`}
            style={[
              styles.dot,
              {
                left: `${at}%`,
                top: `${Number(py(m.y ?? 0))}%`,
                backgroundColor: m.color ?? '#fff',
                borderColor: m.color ?? colors.ink,
              },
            ]}
          >
            {m.label ? (
              <Text
                style={[
                  styles.dotLabel,
                  {
                    color: m.color ?? colors.ink,
                    textAlign: align,
                    marginLeft: align === 'left' ? -4 : align === 'right' ? -52 : -28,
                  },
                ]}
              >
                {m.label}
              </Text>
            ) : null}
          </View>
        );
      })}

      {/* x 轴刻度 */}
      {ticks.map((t) => (
        <View key={`k${t}`} style={[styles.tick, { left: `${Number(px(t))}%` }]}>
          <Text style={styles.tickText}>{t}</Text>
        </View>
      ))}

      <Text style={styles.yTop}>{fmtY(geo.hi)}</Text>
      <Text style={styles.yBottom}>{fmtY(geo.lo)}</Text>
    </View>
  );
}

function fmtY(v: number): string {
  const r = Math.round(v * 10) / 10;
  return String(r);
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    backgroundColor: '#FBFCFE',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.line,
    overflow: 'hidden',
  },
  refBox: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    backgroundColor: '#e2a02f1f',
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: '#e2a02f88',
  },
  gridH: { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: '#EEF2F8' },
  fill: { position: 'absolute' },
  band: { position: 'absolute', bottom: 0, height: 3.5, borderRadius: 2 },
  axisX: { position: 'absolute', left: 0, right: 0, height: 1.2, backgroundColor: colors.sub },
  axisY: { position: 'absolute', top: 0, bottom: 0, width: 1.2, backgroundColor: colors.sub },
  symAxis: { position: 'absolute', top: 0, bottom: 0, width: 1.4, backgroundColor: '#8a63d2aa' },
  seg: { position: 'absolute', borderRadius: 1 },
  dot: {
    position: 'absolute',
    width: 9,
    height: 9,
    borderRadius: 5,
    marginLeft: -4.5,
    marginTop: -4.5,
    borderWidth: 1.6,
    alignItems: 'center',
  },
  vertexDot: { backgroundColor: '#fff', borderColor: colors.orange, borderWidth: 2 },
  dotLabel: {
    position: 'absolute',
    top: -21,
    fontSize: 9.5,
    fontWeight: '800',
    width: 56,
  },
  tick: { position: 'absolute', bottom: 1, alignItems: 'center' },
  tickText: { fontSize: 9, color: colors.faint, fontWeight: '700', marginLeft: -8, width: 16, textAlign: 'center' },
  yTop: { position: 'absolute', left: 3, top: 2, fontSize: 9, color: colors.faint, fontWeight: '700' },
  yBottom: { position: 'absolute', left: 3, bottom: 10, fontSize: 9, color: colors.faint, fontWeight: '700' },
});
