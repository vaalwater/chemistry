import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';
import { POS_INF, NEG_INF, fmtNum, isEmpty, type RealSet } from '../math/setCore';

export type LineBand = {
  key: string;
  set: RealSet;
  color: string;
  label?: string;
  /** 斜纹填充：补集用 */
  hatch?: boolean;
  /** 半透明：地图预览的“影子解集” */
  opacity?: number;
};

interface Props {
  min: number;
  max: number;
  bands: LineBand[];
  /** 参考点刻度（0、1、区间端点等） */
  marks?: number[];
}

/** 斜纹填充：补集 / 挖空区域，纯 RN 实现（细斜条 + 裁剪） */
export function Hatch({ color, size = 6 }: { color: string; size?: number }) {
  const bars = useMemo(() => Array.from({ length: 14 }, (_, i) => i), []);
  return (
    <View style={[styles.hatchClip, styles.noTouch]}>
      <View style={styles.hatchInner}>
        {bars.map((i) => (
          <View
            key={i}
            style={[styles.hatchBar, { backgroundColor: color, width: size * 3, left: i * size * 2 - 40, transform: [{ rotate: '45deg' }] }]}
          />
        ))}
      </View>
    </View>
  );
}

const ROW_H = 26;
const AXIS_TOP = 8;

/**
 * 数轴投影：一条轴上叠多条色带。
 * 实心 / 空心端点、斜纹补集、空集显示 ∅ 都在这里画。
 */
export default function SetNumberLine({ min, max, bands, marks }: Props) {
  const [width, setWidth] = useState(0);
  const span = max - min;
  const x = useCallback(
    (v: number) => {
      if (width <= 0 || span <= 0) return 0;
      if (v === NEG_INF) return 0;
      if (v === POS_INF) return width;
      const r = (v - min) / span;
      return Math.max(0, Math.min(width, r * width));
    },
    [width, span, min]
  );

  const ticks = useMemo(() => {
    const list: number[] = [];
    const step = span / 8;
    for (let i = 0; i <= 8; i += 1) {
      const v = Math.round((min + i * step) * 100) / 100;
      if (Number.isFinite(v)) list.push(v);
    }
    return list;
  }, [min, span]);

  const rows = Math.max(1, bands.length);
  const refMarks = marks ?? [];

  return (
    <View style={styles.wrap}>
      <View
        style={[styles.canvas, { height: AXIS_TOP + rows * ROW_H + 26 }]}
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      >
        {/* 色带层 */}
        {bands.map((b, i) => {
          const top = AXIS_TOP + i * ROW_H;
          if (isEmpty(b.set)) {
            return (
              <View key={b.key} style={[styles.rowEmpty, { top }]}>
                <View style={[styles.emptyDot, { backgroundColor: b.color }]} />
                <Text style={styles.emptyText}>∅</Text>
                <Text style={styles.emptyLabel}>{b.label ?? ''}</Text>
              </View>
            );
          }
          return (
            <View key={b.key} style={[styles.row, styles.noTouch, { top }]}>
              {b.set.map((t, j) => {
                const left = x(t.lo.v);
                const right = x(t.hi.v);
                const w = Math.max(2, right - left);
                return (
                  <View key={j} style={{ position: 'absolute', left, width: w, top: 7, height: 12 }}>
                    <View
                      style={[
                        styles.band,
                        { backgroundColor: b.color, opacity: b.opacity ?? (b.hatch ? 0.18 : 0.85) },
                      ]}
                    />
                    {b.hatch ? <Hatch color={b.color} /> : null}
                    {/* 端点 */}
                    {Number.isFinite(t.lo.v) ? (
                      <View
                        style={[
                          styles.tip,
                          {
                            left: -5,
                            backgroundColor: t.lo.closed ? b.color : colors.card,
                            borderColor: b.color,
                          },
                        ]}
                      />
                    ) : null}
                    {Number.isFinite(t.hi.v) ? (
                      <View
                        style={[
                          styles.tip,
                          {
                            right: -5,
                            backgroundColor: t.hi.closed ? b.color : colors.card,
                            borderColor: b.color,
                          },
                        ]}
                      />
                    ) : null}
                  </View>
                );
              })}
              {b.label ? <Text style={[styles.rowLabel, { color: b.color }]}>{b.label}</Text> : null}
            </View>
          );
        })}

        {/* 参考点 */}
        {refMarks.map((m) => (
          <View key={`ref-${m}`} style={[styles.refMark, { left: x(m) - 0.5, top: AXIS_TOP - 2, height: rows * ROW_H + 4 }]}>
            <Text style={[styles.refText, { left: 3 }]}>{fmtNum(m)}</Text>
          </View>
        ))}

        {/* 轴与刻度 */}
        <View style={[styles.axis, { top: AXIS_TOP + rows * ROW_H + 6 }]} />
        {ticks.map((v) => (
          <View key={`t-${v}`} style={[styles.tickWrap, { left: x(v) - 14, top: AXIS_TOP + rows * ROW_H + 9 }]}>
            <Text style={styles.tickText}>{fmtNum(v)}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%' },
  canvas: { width: '100%', position: 'relative' },
  noTouch: { pointerEvents: 'none' },
  row: { position: 'absolute', left: 0, right: 0, height: ROW_H },
  band: { flex: 1, borderRadius: 6 },
  rowLabel: { position: 'absolute', right: 0, top: 0, fontSize: 10.5, fontWeight: '700' },
  tip: {
    position: 'absolute',
    top: -1,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
  },
  rowEmpty: { position: 'absolute', left: 0, right: 0, height: ROW_H, flexDirection: 'row', alignItems: 'center' },
  emptyDot: { width: 6, height: 6, borderRadius: 3, opacity: 0.5, marginRight: 6 },
  emptyText: { fontSize: 15, fontWeight: '800', color: colors.faint },
  emptyLabel: { fontSize: 11, color: colors.faint, marginLeft: 8 },
  refMark: { position: 'absolute', width: 1, backgroundColor: colors.line },
  refText: { position: 'absolute', top: -4, fontSize: 9.5, color: colors.faint, fontWeight: '700' },
  axis: { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: colors.sub },
  tickWrap: { position: 'absolute', width: 28, alignItems: 'center' },
  tickText: { fontSize: 9.5, color: colors.faint },
  hatchClip: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, overflow: 'hidden', borderRadius: 6 },
  hatchInner: { width: '100%', height: '100%' },
  hatchBar: { position: 'absolute', top: -40, height: 120, opacity: 0.55 },
});
