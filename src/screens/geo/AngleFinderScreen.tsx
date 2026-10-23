import { useCallback, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme';
import Geo3DView, { type Geo3DHandle } from '../../components/Geo3DView';
import CanvasPanPad, { type PanDir } from '../../components/CanvasPanPad';
import { ANGLE_KINDS, type AngleType } from '../../geometry/geoContent';

const STEPS = [
  { key: 'find', label: '找', desc: '' },
  { key: 'prove', label: '证', desc: '' },
  { key: 'calc', label: '算', desc: '' },
];

/** 痛点三：空间角三步定位器（找 → 证 → 算 + 变式题 + 辅助线判定） */
export default function AngleFinderScreen({
  onBack,
  initialKind,
}: {
  onBack: () => void;
  /** 从知识点汇总进入时预选的角的类型 */
  initialKind?: AngleType;
}) {
  const insets = useSafeAreaInsets();
  const [kindIdx, setKindIdx] = useState(() => {
    const i = initialKind ? ANGLE_KINDS.findIndex((k) => k.id === initialKind) : -1;
    return i >= 0 ? i : 0;
  });
  const [varIdx, setVarIdx] = useState(0);
  const [step, setStep] = useState(0); // 0=找 1=证 2=算
  const [auxId, setAuxId] = useState<string | null>(null);
  const [answer, setAnswer] = useState('');
  const [judge, setJudge] = useState<null | 'ok' | 'no'>(null);
  const [reveal, setReveal] = useState(false);
  const geoRef = useRef<Geo3DHandle | null>(null);
  const handlePan = useCallback(
    (dir: PanDir) => geoRef.current?.send({ cmd: 'geo', action: 'view', pan: dir }),
    []
  );

  const kind = ANGLE_KINDS[kindIdx];
  const v = kind.variants[varIdx];

  // 引擎步骤：1=原题，2=找（辅助线），3=证（角+直角），4=算（三角形拎出来）
  const command = useMemo(
    () => ({ cmd: 'geo', action: 'scene', id: kind.sceneId, variant: v.id, step: step + 2 }),
    [kind.sceneId, v.id, step]
  );

  const reset = (ki: number, vi: number) => {
    setKindIdx(ki);
    setVarIdx(vi);
    setStep(0);
    setAuxId(null);
    setAnswer('');
    setJudge(null);
    setReveal(false);
  };

  const submit = () => {
    const n = Number(answer.replace(/[^\d.]/g, ''));
    setJudge(Math.abs(n - v.answer) < 0.6 ? 'ok' : 'no');
  };

  const auxPicked = v.aux.find((a) => a.id === auxId);

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable style={styles.backBtn} onPress={onBack} accessibilityRole="button">
          <Ionicons name="chevron-back" size={18} color={colors.inkSoft} />
          <Text style={styles.backText}>返回</Text>
        </Pressable>
        <Text style={styles.title}>空间角三步定位</Text>
      </View>

      <View style={styles.viewWrap}>
        <Geo3DView ref={geoRef} command={command} onEvent={() => {}} />
        <CanvasPanPad top={8} bottom={8} onPan={handlePan} />
      </View>

      <ScrollView style={styles.panel} contentContainerStyle={styles.panelInner} showsVerticalScrollIndicator={false}>
        <View style={styles.chips}>
          {ANGLE_KINDS.map((k, i) => {
            const on = i === kindIdx;
            return (
              <Pressable
                key={k.id}
                style={[styles.chip, on && styles.chipOn]}
                onPress={() => reset(i, 0)}
                accessibilityRole="button"
              >
                <Text style={[styles.chipText, on && styles.chipTextOn]}>{k.name}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.sectionTitle}>变式题（同一模型，换条件）</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {kind.variants.map((vv, i) => {
            const on = i === varIdx;
            return (
              <Pressable
                key={vv.id}
                style={[styles.chip, on && styles.chipOn]}
                onPress={() => reset(kindIdx, i)}
                accessibilityRole="button"
              >
                <Text style={[styles.chipText, on && styles.chipTextOn]}>变式 {i + 1}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={styles.card}>
          <Text style={styles.probTitle}>{v.title}</Text>
          <Text style={styles.given}>已知：{v.given}</Text>
        </View>

        <View style={styles.stepsRow}>
          {STEPS.map((s, i) => (
            <Pressable
              key={s.key}
              style={[styles.stepBtn, i === step && styles.stepBtnOn]}
              onPress={() => setStep(i)}
              accessibilityRole="button"
            >
              <Text style={[styles.stepBtnText, i === step && styles.stepBtnTextOn]}>
                {i + 1} · {s.label}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.card}>
          <Text style={styles.stepHead}>
            {step === 0 ? '第一步 · 找：把角“搬”到一起' : step === 1 ? '第二步 · 证：为什么它就是所求角' : '第三步 · 算：把三角形拎出来算'}
          </Text>
          <Text style={styles.stepBody}>
            {step === 0 ? kind.findText : step === 1 ? kind.proveText : '关键三角形已被单独放到旁边，边长都标好了 —— 用正弦/余弦/正切算出角度。'}
          </Text>
        </View>

        {step === 0 ? (
          <View style={styles.card}>
            <Text style={styles.stepHead}>拉一条辅助线试试</Text>
            <Text style={styles.stepBody}>{v.hint}</Text>
            {v.aux.map((a) => {
              const on = a.id === auxId;
              return (
                <Pressable
                  key={a.id}
                  style={[styles.option, on && (a.correct ? styles.optionOk : styles.optionNo)]}
                  onPress={() => setAuxId(a.id)}
                  accessibilityRole="button"
                >
                  <Ionicons
                    name={on ? (a.correct ? 'checkmark-circle' : 'close-circle') : 'ellipse-outline'}
                    size={16}
                    color={on ? (a.correct ? colors.green : colors.red) : colors.faint}
                  />
                  <Text style={styles.optionText}>{a.label}</Text>
                </Pressable>
              );
            })}
            {auxPicked ? (
              <Text style={[styles.feedback, auxPicked.correct ? styles.feedbackOk : styles.feedbackNo]}>
                {auxPicked.feedback}
              </Text>
            ) : null}
          </View>
        ) : null}

        {step === 2 ? (
          <View style={styles.card}>
            <Text style={styles.stepHead}>填入你算出的角度（只要数字）</Text>
            <View style={styles.inputRow}>
              <TextInput
                style={styles.input}
                value={answer}
                onChangeText={(t) => { setAnswer(t); setJudge(null); }}
                keyboardType="numeric"
                placeholder="例如 60"
                placeholderTextColor={colors.faint}
              />
              <Text style={styles.unit}>°</Text>
              <Pressable style={styles.submit} onPress={submit} accessibilityRole="button">
                <Text style={styles.submitText}>判对错</Text>
              </Pressable>
            </View>
            {judge === 'ok' ? <Text style={styles.feedbackOk}>✓ 正确！{v.solution}</Text> : null}
            {judge === 'no' ? (
              <View>
                <Text style={styles.feedbackNo}>✗ 不对。提示：{v.hint}</Text>
                <Pressable onPress={() => setJudge(null)} accessibilityRole="button">
                  <Text style={styles.showAnswer}>看完整解答</Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        ) : null}

        <View style={styles.card}>
          <Pressable style={styles.revealRow} onPress={() => setReveal(!reveal)} accessibilityRole="button">
            <Ionicons name="bulb-outline" size={16} color={colors.orange} />
            <Text style={styles.revealText}>{reveal ? '收起解答' : '直接看解答'}</Text>
          </Pressable>
          {reveal ? <Text style={styles.solution}>{v.solution}</Text> : null}
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
  sectionTitle: { fontSize: 12, fontWeight: '700', color: colors.sub, marginTop: 8, marginBottom: 4 },
  chips: { flexDirection: 'row', paddingBottom: 4 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16, marginRight: 8, backgroundColor: '#eef2f8' },
  chipOn: { backgroundColor: colors.purple },
  chipText: { color: colors.inkSoft, fontSize: 12.5, fontWeight: '600' },
  chipTextOn: { color: '#fff' },
  card: { backgroundColor: colors.card, borderRadius: 16, padding: 14, marginTop: 10 },
  probTitle: { fontSize: 13.5, fontWeight: '700', color: colors.ink, lineHeight: 21 },
  given: { fontSize: 12.5, color: colors.sub, marginTop: 6 },
  stepsRow: { flexDirection: 'row', marginTop: 12 },
  stepBtn: {
    flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: 12,
    backgroundColor: '#eef2f8', marginRight: 8,
  },
  stepBtnOn: { backgroundColor: colors.purple, marginRight: 8 },
  stepBtnText: { fontSize: 13, fontWeight: '700', color: colors.inkSoft },
  stepBtnTextOn: { color: '#fff' },
  stepHead: { fontSize: 13, fontWeight: '800', color: colors.purple },
  stepBody: { fontSize: 12.5, lineHeight: 20, color: colors.inkSoft, marginTop: 6 },
  option: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#f3f6fb',
    borderRadius: 12, padding: 11, marginTop: 8,
  },
  optionOk: { backgroundColor: '#E6F6EF' },
  optionNo: { backgroundColor: '#FDECEA' },
  optionText: { fontSize: 13, color: colors.inkSoft, marginLeft: 8, flex: 1 },
  feedback: { fontSize: 12.5, marginTop: 10, lineHeight: 19 },
  feedbackOk: { fontSize: 12.5, marginTop: 10, lineHeight: 19, color: colors.green, fontWeight: '600' },
  feedbackNo: { fontSize: 12.5, marginTop: 10, lineHeight: 19, color: colors.red, fontWeight: '600' },
  inputRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  input: {
    flex: 1, backgroundColor: '#f3f6fb', borderRadius: 12, paddingHorizontal: 12,
    paddingVertical: 9, fontSize: 15, color: colors.ink,
  },
  unit: { fontSize: 15, color: colors.sub, marginLeft: 6 },
  submit: { backgroundColor: colors.purple, borderRadius: 12, paddingVertical: 9, paddingHorizontal: 14, marginLeft: 10 },
  submitText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  showAnswer: { fontSize: 12.5, color: colors.accent, marginTop: 8, fontWeight: '600' },
  solution: { fontSize: 12.5, color: colors.sub, marginTop: 8, lineHeight: 19 },
  revealRow: { flexDirection: 'row', alignItems: 'center' },
  revealText: { fontSize: 12.5, color: colors.orange, fontWeight: '700', marginLeft: 6 },
});
