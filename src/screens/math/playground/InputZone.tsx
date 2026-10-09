import { useCallback, useMemo, useRef, useState } from 'react';
import { PanResponder, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../../theme';
import { Box, Chip, Note, Zone } from '../zones/kit';

/**
 * 「写函数」区
 *
 * 一条函数一行：颜色点 + 输入框 + 眼睛（显示/隐藏）+ 删除。
 * 式子里的字母（a、b、k…）会自动变成下面的滑块 —— 这就是「几元」不受限的那部分。
 */

export type FnRow = { id: string; expr: string; color: string; visible: boolean };

export const PALETTE = ['#2f6fed', '#e5524a', '#1fa97a', '#8a63d2', '#e2822f', '#2fa7e8', '#d64ba8', '#5b8c2a'];

const SAMPLES: { label: string; expr: string }[] = [
  { label: '一次', expr: 'y = 2x + 1' },
  { label: '二次', expr: 'y = x^2 - 4x + 4' },
  { label: '反比例', expr: 'y = 6/x' },
  { label: '指数', expr: 'y = 2^x' },
  { label: '对数', expr: 'y = ln(x)' },
  { label: '三角', expr: 'y = 2*sin(x)' },
  { label: '圆', expr: 'x^2 + y^2 = 25' },
  { label: '根号', expr: 'y = sqrt(x)' },
  { label: '三次', expr: 'y = x^3' },
  { label: '绝对值', expr: 'y = abs(x-3) + 1' },
  { label: '带参数', expr: 'y = a*x^2 + b' },
  { label: '三元', expr: 'x^2 + y^2 + z^2 = 9' },
];

/** 小滑块：点一下跳过去，拖着走实时改 */
function MiniSlider({
  value,
  min = -6,
  max = 6,
  onChange,
}: {
  value: number;
  min?: number;
  max?: number;
  onChange: (v: number) => void;
}) {
  const trackRef = useRef<View | null>(null);
  const [tw, setTw] = useState(0);
  const geo = useRef({ left: 0, width: 0 });
  const valRef = useRef(value);
  valRef.current = value;

  const apply = useCallback(
    (pageX: number) => {
      const { left, width } = geo.current;
      if (width <= 0) return;
      const r = Math.min(1, Math.max(0, (pageX - left) / width));
      const v = Math.round((min + r * (max - min)) * 10) / 10;
      if (Math.abs(v - valRef.current) > 1e-6) onChange(v);
    },
    [max, min, onChange]
  );

  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (e) => {
          trackRef.current?.measureInWindow?.((x: number, _y: number, w: number) => {
            if (w > 0) {
              geo.current = { left: x, width: w };
              setTw(w);
            }
          });
          apply(e.nativeEvent.pageX);
        },
        onPanResponderMove: (e) => apply(e.nativeEvent.pageX),
      }),
    [apply]
  );

  const ratio = (value - min) / (max - min);

  return (
    <View style={styles.sliderRow}>
      <View ref={trackRef} style={styles.track} {...pan.panHandlers}>
        <View style={styles.trackLine} />
        <View style={[styles.trackFill, { width: Math.max(0, Math.min(1, ratio)) * (tw || 0) }]} />
        <View style={[styles.knob, { left: Math.max(0, Math.min(1, ratio)) * (tw || 0) - 7 }]} />
      </View>
    </View>
  );
}

interface Props {
  fns: FnRow[];
  setFns: (next: FnRow[]) => void;
  params: Record<string, number>;
  setParams: (next: Record<string, number>) => void;
  /** 所有式子用到的参数名（并集） */
  usedParams: string[];
  /** 每条函数：解析错误 */
  errs: Record<string, string>;
  /** 每条函数：命中了哪些目标点 */
  hits: Record<string, string[]>;
  gameOn: boolean;
}

export default function InputZone({ fns, setFns, params, setParams, usedParams, errs, hits, gameOn }: Props) {
  const addRow = (expr: string) => {
    const id = `f${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    // 最后一条还是空的就直接填进去，不然再加一行
    if (fns.length && !fns[fns.length - 1].expr.trim()) {
      setFns(fns.map((f, i) => (i === fns.length - 1 ? { ...f, expr } : f)));
      return;
    }
    setFns([...fns, { id, expr, color: PALETTE[fns.length % PALETTE.length], visible: true }]);
  };

  const patch = (id: string, p: Partial<FnRow>) => setFns(fns.map((f) => (f.id === id ? { ...f, ...p } : f)));

  return (
    <Zone
      tag="写函数"
      title="自己写函数 · 几条都行"
      sub="x、y 是变量，式子里的其它字母（a、b、k、z…）会自动变成滑块 —— 几元几次都吃得下。带等号就是等式（x²+y²=25 这种也行），不带等号默认当成 y = …。"
      color={colors.accent}
    >
      <View style={styles.row}>
        {SAMPLES.map((s) => (
          <Chip key={s.label} label={s.label} onPress={() => addRow(s.expr)} color={colors.accent} icon="add-outline" />
        ))}
      </View>

      {fns.map((f, i) => {
        const err = errs[f.id];
        const hit = hits[f.id] ?? [];
        return (
          <View key={f.id} style={styles.fnRow}>
            <Pressable
              style={styles.colorDot}
              onPress={() => patch(f.id, { color: PALETTE[(PALETTE.indexOf(f.color) + 1 + i) % PALETTE.length] })}
              accessibilityRole="button"
              accessibilityLabel="换个颜色"
            >
              <View style={[styles.dot, { backgroundColor: f.color, opacity: f.visible ? 1 : 0.25 }]} />
            </Pressable>
            <TextInput
              style={styles.input}
              value={f.expr}
              onChangeText={(t) => patch(f.id, { expr: t })}
              placeholder="例如 y = x^2 - 4x + 4"
              placeholderTextColor={colors.faint}
              autoCorrect={false}
              autoCapitalize="none"
              spellCheck={false}
            />
            <Pressable
              style={styles.iconBtn}
              onPress={() => patch(f.id, { visible: !f.visible })}
              accessibilityRole="button"
              accessibilityLabel={f.visible ? '隐藏这条' : '显示这条'}
            >
              <Ionicons name={f.visible ? 'eye-outline' : 'eye-off-outline'} size={15} color={colors.sub} />
            </Pressable>
            <Pressable
              style={styles.iconBtn}
              onPress={() => setFns(fns.filter((x) => x.id !== f.id))}
              accessibilityRole="button"
              accessibilityLabel="删掉这条"
            >
              <Ionicons name="close-outline" size={16} color={colors.faint} />
            </Pressable>
          </View>
        );
      })}

      <View style={styles.row}>
        <Chip label="再加一条函数" onPress={() => addRow('')} color={colors.accent} icon="add-outline" />
      </View>

      {fns.map((f) =>
        errs[f.id] ? (
          <Note key={`e${f.id}`} tone="bad" icon="warning-outline" text={`「${f.expr}」：${errs[f.id]}`} />
        ) : null
      )}

      {gameOn ? (
        <Box tone="soft">
          <Text style={styles.hitTitle}>穿过目标点的情况</Text>
          {fns.map((f) => {
            const hit = hits[f.id] ?? [];
            const bad = errs[f.id];
            return (
              <Text key={`h${f.id}`} style={styles.hitLine}>
                <Text style={{ color: f.color, fontWeight: '800' }}>■ </Text>
                {bad ? (
                  <Text style={{ color: colors.red }}>读不出来</Text>
                ) : hit.length ? (
                  <Text style={{ color: colors.green, fontWeight: '700' }}>命中 {hit.join('、')}</Text>
                ) : (
                  <Text style={{ color: colors.faint }}>还没穿过任何目标点</Text>
                )}
                <Text style={{ color: colors.faint }}>　{f.expr || '（空）'}</Text>
              </Text>
            );
          })}
        </Box>
      ) : null}

      {usedParams.length ? (
        <Box tone="soft">
          <Text style={styles.hitTitle}>式子里的参数（拖一下就变）</Text>
          {usedParams.map((p) => (
            <View key={p} style={styles.paramRow}>
              <Text style={styles.paramName}>{p} =</Text>
              <Text style={styles.paramVal}>{(params[p] ?? 1).toFixed(1)}</Text>
              <MiniSlider value={params[p] ?? 1} onChange={(v) => setParams({ ...params, [p]: v })} />
            </View>
          ))}
          <Note
            text="这些字母不是变量，是参数：图是 x、y 平面上的，参数一动，整条曲线跟着变（三元式子里多出来的那个字母就当它的值）。"
            icon="options-outline"
          />
        </Box>
      ) : null}
    </Zone>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 4 },
  fnRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  colorDot: { padding: 3, marginRight: 4 },
  dot: { width: 12, height: 12, borderRadius: 6 },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 9,
    paddingHorizontal: 9,
    paddingVertical: 7,
    fontSize: 13,
    color: colors.ink,
    backgroundColor: '#FCFDFF',
    fontFamily: 'monospace' as unknown as undefined,
  },
  iconBtn: { paddingHorizontal: 6, paddingVertical: 4 },
  hitTitle: { fontSize: 11.5, fontWeight: '800', color: colors.ink },
  hitLine: { fontSize: 11.5, color: colors.inkSoft, marginTop: 4, lineHeight: 17 },
  paramRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  paramName: { fontSize: 12, fontWeight: '800', color: colors.ink, width: 26 },
  paramVal: { fontSize: 12, fontWeight: '700', color: colors.accent, width: 42 },
  sliderRow: { flex: 1 },
  track: { height: 22, justifyContent: 'center' },
  trackLine: { position: 'absolute', left: 0, right: 0, height: 3, borderRadius: 2, backgroundColor: '#E3EBF5' },
  trackFill: { position: 'absolute', left: 0, height: 3, borderRadius: 2, backgroundColor: colors.accent },
  knob: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: colors.accent,
  },
});
