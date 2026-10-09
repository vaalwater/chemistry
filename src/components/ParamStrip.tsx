import { useCallback, useMemo, useRef } from 'react';
import { PanResponder, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';

interface Props {
  value: number;
  min: number;
  max: number;
  /** 每一段的底色（从左到右），用来提示“走到哪儿会遇到什么情况” */
  segColors: string[];
  onChange: (v: number) => void;
  /** 轨道上方的小标题 */
  label?: string;
  /** 底部左右两端的注记 */
  ends?: [string, string];
  /** 轨道高度（多根滑轨并排时用矮一点的） */
  height?: number;
}

/**
 * 一条好拖的参数滑轨：手指（或鼠标）按在轨道上左右滑动，参数就跟着走。
 * 触摸区域做到 40px 高，手机上也好按。
 */
export default function ParamStrip({ value, min, max, segColors, onChange, label, ends, height = 40 }: Props) {
  const geo = useRef({ left: 0, width: 0 });
  const node = useRef<View | null>(null);

  const measure = useCallback(() => {
    node.current?.measureInWindow?.((x: number, _y: number, w: number) => {
      if (w > 0) geo.current = { left: x, width: w };
    });
  }, []);

  const pick = useCallback(
    (pageX: number, locationX: number) => {
      const { left, width } = geo.current;
      if (width <= 0) return;
      let x = pageX - left;
      if (!Number.isFinite(x) || x < -2 || x > width + 2) x = locationX;
      if (!Number.isFinite(x)) return;
      const r = Math.min(1, Math.max(0, x / width));
      onChange(min + r * (max - min));
    },
    [min, max, onChange]
  );

  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (e) => {
          measure();
          pick(e.nativeEvent.pageX, e.nativeEvent.locationX);
        },
        onPanResponderMove: (e) => pick(e.nativeEvent.pageX, e.nativeEvent.locationX),
      }),
    [measure, pick]
  );

  const ratio = Math.min(1, Math.max(0, (value - min) / (max - min)));
  const n = segColors.length || 1;

  return (
    <View style={styles.wrap}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View
        ref={node}
        style={[styles.track, { height }]}
        onLayout={measure}
        testID="param-strip"
        {...pan.panHandlers}
      >
        <View style={styles.segRow} pointerEvents="none">
          {segColors.map((c, i) => (
            <View key={`s${i}`} style={[styles.seg, { backgroundColor: c, width: `${100 / n}%` }]} />
          ))}
        </View>
        <View style={[styles.handle, { left: `${ratio * 100}%` }]} pointerEvents="none">
          <View style={styles.handleBar} />
        </View>
      </View>
      {ends ? (
        <View style={styles.endRow}>
          <Text style={styles.endText}>{ends[0]}</Text>
          <Text style={styles.endText}>{ends[1]}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%' },
  label: { fontSize: 11.5, fontWeight: '700', color: colors.inkSoft, marginBottom: 3 },
  track: {
    height: 40,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.line,
    justifyContent: 'center',
  },
  segRow: { flexDirection: 'row', height: '100%' },
  seg: { height: '100%', opacity: 0.55 },
  handle: { position: 'absolute', top: -2, bottom: -2, width: 6, marginLeft: -3, justifyContent: 'center' },
  handleBar: { width: 6, height: '100%', borderRadius: 3, backgroundColor: colors.ink, borderWidth: 1.5, borderColor: '#fff' },
  endRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 3 },
  endText: { fontSize: 10, color: colors.faint, fontWeight: '700' },
});
