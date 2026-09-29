import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme';
import Geo3DView from '../../components/Geo3DView';
import { DECISION_TREE, THEOREMS, type TheoremId } from '../../geometry/geoContent';

type Tree = typeof DECISION_TREE[keyof typeof DECISION_TREE];

/** 痛点二：定理可视化实验室（四步演示 + 反例开关 + 判定树引导） */
export default function TheoremLabScreen({ onBack }: { onBack: () => void }) {
  const insets = useSafeAreaInsets();
  const [idx, setIdx] = useState(0);
  const [step, setStep] = useState(1);
  const [counter, setCounter] = useState(false);
  const [node, setNode] = useState<string | null>(null);

  const th = THEOREMS[idx];
  const command = useMemo(
    () => ({ cmd: 'geo', action: 'scene', id: th.id, step, counter }),
    [th.id, step, counter]
  );

  const pickTheorem = (i: number) => {
    setIdx(i);
    setStep(1);
    setCounter(false);
  };
  const pickTheoremById = (id: TheoremId) => {
    const i = THEOREMS.findIndex((t) => t.id === id);
    pickTheorem(i < 0 ? 0 : i);
    setNode(null);
  };

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable style={styles.backBtn} onPress={onBack} accessibilityRole="button">
          <Ionicons name="chevron-back" size={18} color={colors.inkSoft} />
          <Text style={styles.backText}>立体几何</Text>
        </Pressable>
        <Text style={styles.title}>定理实验室</Text>
      </View>

      <View style={styles.viewWrap}>
        <Geo3DView command={command} onEvent={() => {}} />
      </View>

      <ScrollView style={styles.panel} contentContainerStyle={styles.panelInner} showsVerticalScrollIndicator={false}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {THEOREMS.map((t, i) => {
            const on = i === idx;
            return (
              <Pressable
                key={t.id}
                style={[styles.chip, on && styles.chipOn]}
                onPress={() => pickTheorem(i)}
                accessibilityRole="button"
              >
                <Text style={[styles.chipText, on && styles.chipTextOn]}>
                  {t.name}（{t.kind}）
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={styles.card}>
          <Text style={styles.statement}>{th.statement}</Text>
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

        <View style={[styles.card, counter && step >= 3 && styles.cardBad]}>
          <Text style={styles.stepTitle}>
            第 {step} 步{counter && step >= 3 ? ' · 反例' : ''}
          </Text>
          <Text style={styles.stepBody}>
            {counter && step >= 3 ? th.counterDesc : th.steps[step - 1]}
          </Text>
          {counter && step >= 4 ? <Text style={styles.badTag}>✗ 结论不成立</Text> : null}
          {!counter && step >= 4 ? <Text style={styles.okTag}>✓ {th.name}成立</Text> : null}
        </View>

        <View style={styles.btnRow}>
          <Pressable
            style={[styles.btn, step <= 1 && styles.btnOff]}
            onPress={() => setStep(Math.max(1, step - 1))}
            accessibilityRole="button"
          >
            <Ionicons name="chevron-back" size={16} color={step <= 1 ? colors.faint : colors.inkSoft} />
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
            <Ionicons name="chevron-forward" size={16} color={step >= 4 ? colors.faint : '#fff'} />
          </Pressable>
        </View>

        <Pressable
          style={[styles.counterBtn, counter && styles.counterBtnOn]}
          onPress={() => setCounter(!counter)}
          accessibilityRole="button"
        >
          <Ionicons
            name={counter ? 'close-circle' : 'warning-outline'}
            size={17}
            color={counter ? colors.red : colors.orange}
          />
          <View style={{ flex: 1, marginLeft: 8 }}>
            <Text style={[styles.counterText, counter && styles.counterTextOn]}>
              {counter ? '回到正常情况' : '打开反例开关'}
            </Text>
            <Text style={styles.counterSub}>{th.counterTitle}</Text>
          </View>
          <View style={[styles.switch, counter && styles.switchOn]}>
            <View style={[styles.knob, counter && styles.knobOn]} />
          </View>
        </Pressable>

        <View style={styles.card}>
          <View style={styles.cardHead}>
            <Ionicons name="help-circle-outline" size={17} color={colors.purple} />
            <Text style={styles.cardTitle}>不确定用哪条定理？让判定树问你</Text>
          </View>
          {node === null ? (
            <>
              <Text style={styles.cardBody}>
                给一道题，回答两三个问题，App 会告诉你该用哪条定理，并直接跳到它的演示场景。
              </Text>
              <Pressable style={styles.treeStart} onPress={() => setNode('root')} accessibilityRole="button">
                <Text style={styles.treeStartText}>开始提问</Text>
              </Pressable>
            </>
          ) : (
            <TreeQuestion nodeId={node} onPick={setNode} onTheorem={pickTheoremById} onReset={() => setNode(null)} />
          )}
        </View>
        <View style={{ height: 20 }} />
      </ScrollView>
    </View>
  );
}

function TreeQuestion({
  nodeId,
  onPick,
  onTheorem,
  onReset,
}: {
  nodeId: string;
  onPick: (id: string) => void;
  onTheorem: (id: TheoremId) => void;
  onReset: () => void;
}) {
  const n: Tree | undefined = DECISION_TREE[nodeId];
  if (!n) return null;
  if ('answer' in n) {
    const th = THEOREMS.find((t) => t.id === n.answer);
    return (
      <View style={{ marginTop: 10 }}>
        <Text style={styles.tip}>{n.tip}</Text>
        <Text style={styles.answer}>建议定理：{th ? th.name : n.answer}</Text>
        <Pressable style={styles.treeStart} onPress={() => onTheorem(n.answer)} accessibilityRole="button">
          <Text style={styles.treeStartText}>跳到这条定理的场景</Text>
        </Pressable>
        <Pressable style={styles.treeReset} onPress={onReset} accessibilityRole="button">
          <Text style={styles.treeResetText}>重新问一遍</Text>
        </Pressable>
      </View>
    );
  }
  return (
    <View style={{ marginTop: 10 }}>
      <Text style={styles.question}>{n.q}</Text>
      {n.options.map((o) => (
        <Pressable
          key={o.label}
          style={styles.option}
          onPress={() => onPick(o.next)}
          accessibilityRole="button"
        >
          <Text style={styles.optionText}>{o.label}</Text>
          <Ionicons name="chevron-forward" size={15} color={colors.faint} />
        </Pressable>
      ))}
      <Pressable style={styles.treeReset} onPress={onReset} accessibilityRole="button">
        <Text style={styles.treeResetText}>退出判定树</Text>
      </Pressable>
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
  cardBad: { backgroundColor: '#FDECEA' },
  cardHead: { flexDirection: 'row', alignItems: 'center' },
  statement: { fontSize: 13.5, lineHeight: 21, color: colors.ink, fontWeight: '600' },
  stepsRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12, paddingHorizontal: 4 },
  dot: {
    width: 34, height: 34, borderRadius: 17, backgroundColor: '#eef2f8',
    alignItems: 'center', justifyContent: 'center',
  },
  dotOn: { backgroundColor: colors.purple },
  dotText: { fontSize: 13, fontWeight: '700', color: colors.sub },
  dotTextOn: { color: '#fff' },
  stepTitle: { fontSize: 13, fontWeight: '800', color: colors.purple },
  stepBody: { fontSize: 13, lineHeight: 21, color: colors.inkSoft, marginTop: 6 },
  okTag: { fontSize: 13, fontWeight: '800', color: colors.green, marginTop: 10 },
  badTag: { fontSize: 13, fontWeight: '800', color: colors.red, marginTop: 10 },
  btnRow: { flexDirection: 'row', marginTop: 12 },
  btn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.card, borderRadius: 14, paddingVertical: 10, marginRight: 8,
  },
  btnPrimary: { backgroundColor: colors.purple, marginRight: 0, marginLeft: 8 },
  btnOff: { opacity: 0.45 },
  btnText: { fontSize: 13.5, fontWeight: '700', color: colors.inkSoft, marginLeft: 4 },
  btnTextPrimary: { color: '#fff', marginLeft: 0, marginRight: 4 },
  btnTextOff: { color: colors.faint },
  counterBtn: {
    flexDirection: 'row', alignItems: 'center', marginTop: 12, backgroundColor: colors.card,
    borderRadius: 14, padding: 12,
  },
  counterBtnOn: { backgroundColor: '#FDECEA' },
  counterText: { fontSize: 13.5, fontWeight: '700', color: colors.orange },
  counterTextOn: { color: colors.red },
  counterSub: { fontSize: 11.5, color: colors.sub, marginTop: 3 },
  switch: {
    width: 42, height: 24, borderRadius: 12, backgroundColor: '#dfe6f0',
    padding: 2, justifyContent: 'center', alignItems: 'flex-start',
  },
  switchOn: { backgroundColor: colors.red, alignItems: 'flex-end' },
  knob: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff' },
  knobOn: {},
  cardTitle: { fontSize: 13.5, fontWeight: '800', color: colors.ink, marginLeft: 8, flex: 1 },
  cardBody: { fontSize: 12.5, color: colors.sub, marginTop: 8, lineHeight: 19 },
  treeStart: {
    backgroundColor: colors.purple, borderRadius: 12, paddingVertical: 9,
    alignItems: 'center', marginTop: 10,
  },
  treeStartText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  question: { fontSize: 13.5, fontWeight: '700', color: colors.ink, marginBottom: 8 },
  option: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#f3f6fb', borderRadius: 12, padding: 11, marginBottom: 8,
  },
  optionText: { fontSize: 13, color: colors.inkSoft, flex: 1 },
  tip: { fontSize: 12.5, color: colors.sub, lineHeight: 19 },
  answer: { fontSize: 13.5, fontWeight: '800', color: colors.purple, marginTop: 8 },
  treeReset: { alignItems: 'center', paddingVertical: 6, marginTop: 4 },
  treeResetText: { fontSize: 12.5, color: colors.faint },
});
