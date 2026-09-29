import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme';
import Geo3DView from '../../components/Geo3DView';
import { VOLUME_SHOWS } from '../../geometry/geoContent';

const SLIDER_STEPS = [
  { t: 0.15, label: '低' },
  { t: 0.4, label: '偏低' },
  { t: 0.65, label: '偏高' },
  { t: 0.9, label: '顶' },
];

/** 痛点四：体积公式推导剧场（先猜后验 + 分步动画 + 可拖动截面） */
export default function VolumeTheaterScreen({ onBack }: { onBack: () => void }) {
  const insets = useSafeAreaInsets();
  const [idx, setIdx] = useState(0);
  const [step, setStep] = useState(1);
  const [guess, setGuess] = useState<number | null>(null);
  const [t, setT] = useState(0.4);

  const show = VOLUME_SHOWS[idx];
  const command = useMemo(
    () => ({ cmd: 'geo', action: 'scene', id: show.sceneId, step, t }),
    [show.sceneId, step, t]
  );

  const pick = (i: number) => {
    setIdx(i);
    setStep(1);
    setGuess(null);
    setT(0.4);
  };

  const guessedRight = guess !== null && guess === show.guess.answer;

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable style={styles.backBtn} onPress={onBack} accessibilityRole="button">
          <Ionicons name="chevron-back" size={18} color={colors.inkSoft} />
          <Text style={styles.backText}>立体几何</Text>
        </Pressable>
        <Text style={styles.title}>体积公式剧场</Text>
      </View>

      <View style={styles.viewWrap}>
        <Geo3DView command={command} onEvent={() => {}} />
      </View>

      <ScrollView style={styles.panel} contentContainerStyle={styles.panelInner} showsVerticalScrollIndicator={false}>
        <View style={styles.chips}>
          {VOLUME_SHOWS.map((s, i) => {
            const on = i === idx;
            return (
              <Pressable
                key={s.id}
                style={[styles.chip, on && styles.chipOn]}
                onPress={() => pick(i)}
                accessibilityRole="button"
              >
                <Text style={[styles.chipText, on && styles.chipTextOn]}>{s.name}</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.card}>
          <Text style={styles.stepHead}>先猜一猜（别急着看公式）</Text>
          <Text style={styles.guessQ}>{show.guess.q}</Text>
          <View style={styles.guessRow}>
            {show.guess.options.map((o, i) => {
              const on = guess === i;
              const wrong = on && !guessedRight;
              return (
                <Pressable
                  key={o}
                  style={[styles.guessBtn, on && (guessedRight ? styles.guessOk : styles.guessNo)]}
                  onPress={() => setGuess(i)}
                  accessibilityRole="button"
                >
                  <Text style={[styles.guessText, on && styles.guessTextOn]}>{o}</Text>
                  {wrong ? <Ionicons name="close" size={13} color={colors.red} /> : null}
                  {on && guessedRight ? <Ionicons name="checkmark" size={13} color={colors.green} /> : null}
                </Pressable>
              );
            })}
          </View>
          {guess !== null ? (
            <Text style={[styles.explain, guessedRight ? styles.explainOk : styles.explainNo]}>
              {guessedRight ? '✓ 猜对了。' : '✗ 猜错了 —— 看完下面的动画再想一遍。'}
              {show.guess.explain}
            </Text>
          ) : null}
        </View>

        <View style={styles.stepsRow}>
          {[1, 2, 3, 4].map((s) => (
            <Pressable
              key={s}
              style={[styles.dot, s === step && styles.dotOn]}
              onPress={() => setStep(s)}
              accessibilityRole="button"
            >
              <Text style={[styles.dotText, s === step && styles.dotTextOn]}>{s}</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.card}>
          <Text style={styles.stepHead}>第 {step} 步 / 4</Text>
          <Text style={styles.stepBody}>{show.steps[step - 1]}</Text>
          <View style={styles.btnRow}>
            <Pressable
              style={[styles.btn, step <= 1 && styles.btnOff]}
              onPress={() => setStep(Math.max(1, step - 1))}
              accessibilityRole="button"
            >
              <Text style={[styles.btnText, step <= 1 && styles.btnTextOff]}>上一步</Text>
            </Pressable>
            <Pressable
              style={[styles.btn, styles.btnPrimary, step >= 4 && styles.btnOff]}
              onPress={() => setStep(Math.min(4, step + 1))}
              accessibilityRole="button"
            >
              <Text style={[styles.btnText, styles.btnTextPrimary, step >= 4 && styles.btnTextOff]}>
                下一步
              </Text>
            </Pressable>
          </View>
        </View>

        {show.slider ? (
          <View style={styles.card}>
            <Text style={styles.stepHead}>{show.slider.label}</Text>
            <View style={styles.guessRow}>
              {SLIDER_STEPS.map((s) => {
                const on = Math.abs(s.t - t) < 0.01;
                return (
                  <Pressable
                    key={s.label}
                    style={[styles.guessBtn, on && styles.guessOk]}
                    onPress={() => setT(s.t)}
                    accessibilityRole="button"
                  >
                    <Text style={[styles.guessText, on && styles.guessTextOn]}>{s.label}</Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={styles.stepBody}>
              {show.id === 'sphere'
                ? '两个几何体在同一高度上的截面面积始终相等（都是 π(R²−h²)）—— 这就是祖暅原理。'
                : '液面高度随次数均匀上升：3 次正好倒满，所以圆锥是圆柱的三分之一。'}
            </Text>
          </View>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.stepHead}>结论</Text>
          <Text style={styles.conclusion}>{show.conclusion}</Text>
        </View>
        <View style={{ height: 20 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: 16, paddingBottom: 6 },
  backBtn: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', marginBottom: 6 },
  backText: { fontSize: 14, color: colors.inkSoft, fontWeight: '600', marginLeft: 2 },
  title: { fontSize: 22, fontWeight: '800', color: colors.ink },
  viewWrap: { flex: 1, minHeight: 240, marginHorizontal: 10, borderRadius: 16, overflow: 'hidden' },
  panel: { maxHeight: '48%' },
  panelInner: { paddingHorizontal: 14, paddingTop: 8 },
  chips: { flexDirection: 'row', paddingBottom: 4 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16, marginRight: 8, backgroundColor: '#eef2f8' },
  chipOn: { backgroundColor: colors.purple },
  chipText: { color: colors.inkSoft, fontSize: 12.5, fontWeight: '600' },
  chipTextOn: { color: '#fff' },
  card: { backgroundColor: colors.card, borderRadius: 16, padding: 14, marginTop: 10 },
  stepHead: { fontSize: 13, fontWeight: '800', color: colors.purple },
  guessQ: { fontSize: 13.5, color: colors.ink, marginTop: 8, fontWeight: '600', lineHeight: 20 },
  guessRow: { flexDirection: 'row', marginTop: 10, flexWrap: 'wrap' },
  guessBtn: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 12, backgroundColor: '#f3f6fb', marginRight: 8, marginBottom: 8,
  },
  guessOk: { backgroundColor: '#E6F6EF' },
  guessNo: { backgroundColor: '#FDECEA' },
  guessText: { fontSize: 13, fontWeight: '700', color: colors.inkSoft },
  guessTextOn: { color: colors.ink },
  explain: { fontSize: 12.5, lineHeight: 19, marginTop: 10 },
  explainOk: { color: colors.green },
  explainNo: { color: colors.red },
  stepsRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12, paddingHorizontal: 4 },
  dot: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#eef2f8', alignItems: 'center', justifyContent: 'center' },
  dotOn: { backgroundColor: colors.purple },
  dotText: { fontSize: 13, fontWeight: '700', color: colors.sub },
  dotTextOn: { color: '#fff' },
  stepBody: { fontSize: 12.5, lineHeight: 20, color: colors.inkSoft, marginTop: 6 },
  btnRow: { flexDirection: 'row', marginTop: 12 },
  btn: {
    flex: 1, alignItems: 'center', backgroundColor: '#f3f6fb', borderRadius: 12,
    paddingVertical: 9, marginRight: 8,
  },
  btnPrimary: { backgroundColor: colors.purple, marginRight: 0, marginLeft: 8 },
  btnOff: { opacity: 0.45 },
  btnText: { fontSize: 13.5, fontWeight: '700', color: colors.inkSoft },
  btnTextPrimary: { color: '#fff' },
  btnTextOff: { color: colors.faint },
  conclusion: { fontSize: 15, fontWeight: '800', color: colors.purple, marginTop: 8 },
});
