import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii, shadow } from '../theme';
import { buildScript, VERDICT_TONE, type AcidCase } from '../acid/acidRule';
import { INFER_EXAMPLES, inferFromFormula } from '../acid/infer';
import { beatIndexFor, buildQuiz, type QuizStep } from '../acid/quiz';

interface Session {
  c: AcidCase;
  steps: QuizStep[];
  idx: number;
  answers: (string | null)[];
  /** 每步是否真的存在可播动画 */
  beatIdx: (number | null)[];
}

/**
 * 练习模式：自己写分子式 → 一步步猜（水解 / 电离 / 谁占优 / 酸碱性）
 * 每步选完立刻反馈对错，并播放**真实情况**对应的动画作为验证。
 */
export default function AcidPracticeView({
  onCaseReady,
  onPlayBeat,
  onCelebrate,
}: {
  onCaseReady: (c: AcidCase | null) => void;
  onPlayBeat: (index: number) => void;
  /** 全部答对时回调（页面用来放全屏撒花） */
  onCelebrate?: () => void;
}) {
  const [input, setInput] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [runId, setRunId] = useState(0);

  const start = (formula: string) => {
    const r = inferFromFormula(formula);
    if (!r.ok || !r.c) {
      setErr(r.reason || '没推导出来');
      setSession(null);
      onCaseReady(null);
      return;
    }
    const c = r.c;
    const script = buildScript(c);
    const steps = buildQuiz(c);
    setErr(null);
    setSession({
      c,
      steps,
      idx: 0,
      answers: steps.map(() => null),
      beatIdx: steps.map((s) => (s.beatKind ? beatIndexFor(script, s.beatKind) : null)),
    });
    setRunId((v) => v + 1);
    onCaseReady(c);
    // 先播「溶解解离」：让用户看到水里到底有哪些离子，再开始猜
    const dissolve = beatIndexFor(script, 'dissolve');
    onPlayBeat(dissolve ?? 0);
  };

  const answer = (i: number, value: string) => {
    if (!session) return;
    if (session.answers[i]) return; // 已答过
    const answers = session.answers.slice();
    answers[i] = value;
    setSession({ ...session, answers });
    // 立刻播放这一步的「真相动画」（存在才播）
    const b = session.beatIdx[i];
    if (b !== null) onPlayBeat(b);
  };

  const next = () => {
    if (!session) return;
    if (session.idx >= session.steps.length - 1) {
      setSession({ ...session, idx: session.steps.length });
      const allRight = session.steps.every((s, i) => session.answers[i] === s.answer);
      if (allRight) onCelebrate?.();
      return;
    }
    const nextIdx = session.idx + 1;
    setSession({ ...session, idx: nextIdx });
    // 下一题把画面先回到这一题开始前的状态
    const b = session.beatIdx[nextIdx];
    if (b !== null) onPlayBeat(b);
  };

  const reset = () => {
    setSession(null);
    setErr(null);
    onCaseReady(null);
  };

  if (!session) {
    return (
      <View style={styles.card}>
        <View style={styles.cardHead}>
          <Ionicons name="create-outline" size={15} color={colors.accent} />
          <Text style={styles.cardTitle}>自己写一个物质来猜</Text>
        </View>
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder="输入分子式，如 NH₄Cl / Fe₂(SO₄)₃"
            placeholderTextColor={colors.faint}
            autoCapitalize="none"
            autoCorrect={false}
            onSubmitEditing={() => start(input)}
          />
          <Pressable style={styles.goBtn} onPress={() => start(input)} accessibilityRole="button">
            <Text style={styles.goText}>出题</Text>
          </Pressable>
        </View>
        {err ? (
          <View style={styles.errBox}>
            <Ionicons name="alert-circle" size={14} color="#cf1322" />
            <Text style={styles.errText}>{err}</Text>
          </View>
        ) : null}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10 }}>
          <View style={styles.exRow}>
            {INFER_EXAMPLES.map((ex) => (
              <Pressable
                key={ex}
                style={styles.exChip}
                onPress={() => {
                  setInput(ex);
                  start(ex);
                }}
                accessibilityRole="button"
              >
                <Text style={styles.exText}>{ex}</Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>
        <Text style={styles.tip}>
          可以写下标数字（Na2CO3）、也可以直接用下标符号（Na₂CO₃）；不认识的写法会直接告诉你原因。
        </Text>
      </View>
    );
  }

  const { c, steps, idx, answers } = session;
  const done = idx >= steps.length;
  const rightCount = steps.filter((s, i) => answers[i] === s.answer).length;
  const allRight = done && rightCount === steps.length;

  return (
    <View style={{ gap: 10 }}>

      {/* 当前物质 */}
      <View style={styles.card}>
        <View style={styles.cardHead}>
          <Ionicons name="flask-outline" size={15} color={colors.accent} />
          <Text style={styles.cardTitle}>{c.name}</Text>
          <Pressable onPress={reset} accessibilityRole="button">
            <Text style={styles.link}>换一个</Text>
          </Pressable>
        </View>
        <Text style={styles.formula}>{c.formula}</Text>
        <Text style={styles.group}>{c.group}</Text>
        <Text style={styles.tipSmall}>已经拆好放进水里了，下面一步步猜：</Text>
      </View>

      {/* 题目 */}
      {steps.map((s, i) => {
        if (i > idx) return null;
        const picked = answers[i];
        const correct = picked === s.answer;
        const tone = VERDICT_TONE[c.verdict];
        return (
          <View key={s.key + i} style={styles.card}>
            <View style={styles.cardHead}>
              <Text style={styles.qNo}>
                第 {i + 1} / {steps.length} 步
              </Text>
              <Text style={styles.cardTitle}>{s.key === 'verdict' ? '最终结算' : '猜一猜'}</Text>
              {picked ? (
                <View style={[styles.mark, { backgroundColor: correct ? '#E6F7EC' : '#FDECEB' }]}>
                  <Ionicons
                    name={correct ? 'checkmark-circle' : 'close-circle'}
                    size={13}
                    color={correct ? '#2E9B57' : '#cf1322'}
                  />
                  <Text style={[styles.markText, { color: correct ? '#2E9B57' : '#cf1322' }]}>
                    {correct ? '答对' : '答错'}
                  </Text>
                </View>
              ) : null}
            </View>

            <Text style={styles.question}>{s.question}</Text>

            <View style={{ marginTop: 10, gap: 6 }}>
              {s.options.map((o) => {
                const chosen = picked === o.value;
                const isAnswer = s.answer === o.value;
                const showState = !!picked;
                let border = colors.line;
                let bg = '#FFFFFF';
                if (showState && isAnswer) { border = '#2E9B57'; bg = '#F2FBF5'; }
                if (showState && chosen && !isAnswer) { border = '#cf1322'; bg = '#FFF6F5'; }
                return (
                  <Pressable
                    key={o.value}
                    style={[styles.option, { borderColor: border, backgroundColor: bg }]}
                    onPress={() => (i === idx ? answer(i, o.value) : undefined)}
                    disabled={!!picked}
                    accessibilityRole="button"
                  >
                    <View style={[styles.radio, showState && isAnswer && styles.radioOn]}>
                      {showState && isAnswer ? <View style={styles.radioDot} /> : null}
                    </View>
                    <Text style={styles.optionText}>{o.label}</Text>
                    {o.hint ? <Text style={styles.optionHint}>{o.hint}</Text> : null}
                    {showState && chosen && !isAnswer ? (
                      <Ionicons name="close" size={14} color="#cf1322" />
                    ) : null}
                    {showState && isAnswer ? <Ionicons name="checkmark" size={14} color="#2E9B57" /> : null}
                  </Pressable>
                );
              })}
            </View>

            {picked ? (
              <View style={styles.truthBox}>
                <Text style={styles.truthTitle}>
                  <Ionicons name="bulb-outline" size={13} color={tone.fg} /> 真相：{s.truth}
                </Text>
                <Text style={styles.truthText}>{s.explain}</Text>
                {session.beatIdx[i] !== null ? (
                  <Pressable
                    style={styles.replayBtn}
                    onPress={() => onPlayBeat(session.beatIdx[i] as number)}
                    accessibilityRole="button"
                  >
                    <Ionicons name="play" size={13} color={colors.accent} />
                    <Text style={styles.replayText}>再看一遍动画</Text>
                  </Pressable>
                ) : (
                  <Text style={styles.skipNote}>{s.skipNote || '这一步没有对应的过程可演示，直接看下一步。'}</Text>
                )}
              </View>
            ) : null}
          </View>
        );
      })}

      {/* 导航 / 结果 */}
      {done ? (
        <View style={styles.card}>
          <View style={styles.cardHead}>
            <Ionicons name={allRight ? 'trophy' : 'school-outline'} size={16} color={colors.accent} />
            <Text style={styles.cardTitle}>{allRight ? '全对！' : '练习完成'}</Text>
          </View>
          <Text style={styles.resultBig}>
            答对 {rightCount} / {steps.length} 步
          </Text>
          <Text style={styles.resultText}>
            {allRight
              ? `${c.formula}：${c.headline}`
              : `再看一遍讲评：${c.headline}`}
          </Text>
          <View style={styles.eqBox}>
            <Text style={styles.eqText}>{c.equation}</Text>
          </View>
          <Text style={styles.resultExplain}>{c.why}</Text>
          <View style={styles.btnRow}>
            <Pressable
              style={styles.primaryBtn}
              onPress={() => {
                const again = session;
                setSession({ ...again, idx: 0, answers: again.steps.map(() => null) });
                const b = again.beatIdx[0];
                onPlayBeat(b ?? 0);
              }}
              accessibilityRole="button"
            >
              <Text style={styles.primaryText}>这道题再来一次</Text>
            </Pressable>
            <Pressable style={styles.ghostBtn} onPress={reset} accessibilityRole="button">
              <Text style={styles.ghostText}>换个物质</Text>
            </Pressable>
          </View>
        </View>
      ) : answers[idx] ? (
        <Pressable style={styles.primaryBtn} onPress={next} accessibilityRole="button">
          <Text style={styles.primaryText}>
            {idx === steps.length - 1 ? '完成，看结果' : '下一题'}
          </Text>
        </Pressable>
      ) : (
        <Text style={styles.tipSmall}>选一个答案，马上揭晓真相。</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.card, borderRadius: radii.card, padding: 12, ...shadow.card },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cardTitle: { fontSize: 13, fontWeight: '800', color: colors.ink, flex: 1 },
  link: { fontSize: 12, fontWeight: '700', color: colors.accent },

  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  input: {
    flex: 1, borderWidth: 1, borderColor: colors.line, borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 9, fontSize: 15, fontWeight: '700', color: colors.ink,
  },
  goBtn: { backgroundColor: colors.accent, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 },
  goText: { color: '#FFFFFF', fontWeight: '800', fontSize: 13 },
  errBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 5, marginTop: 10,
    backgroundColor: '#FFF6F5', borderRadius: 10, padding: 9,
  },
  errText: { fontSize: 12, color: '#cf1322', lineHeight: 17, flex: 1 },
  exRow: { flexDirection: 'row', gap: 6 },
  exChip: {
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: radii.chip,
    backgroundColor: '#F2F5FA',
  },
  exText: { fontSize: 12, fontWeight: '700', color: colors.inkSoft },
  tip: { fontSize: 11, color: colors.sub, lineHeight: 16, marginTop: 10 },
  tipSmall: { fontSize: 11.5, color: colors.sub, marginTop: 6 },

  formula: { fontSize: 22, fontWeight: '800', color: colors.ink, marginTop: 6 },
  group: { fontSize: 12, color: colors.sub, fontWeight: '700' },

  qNo: { fontSize: 11, fontWeight: '800', color: colors.faint },
  mark: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 9 },
  markText: { fontSize: 10.5, fontWeight: '800' },
  question: { fontSize: 14, fontWeight: '800', color: colors.ink, marginTop: 8, lineHeight: 20 },

  option: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 9,
  },
  radio: {
    width: 15, height: 15, borderRadius: 8, borderWidth: 1.5,
    borderColor: colors.faint, alignItems: 'center', justifyContent: 'center',
  },
  radioOn: { borderColor: '#2E9B57' },
  radioDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#2E9B57' },
  optionText: { fontSize: 13, fontWeight: '700', color: colors.ink, flex: 1 },
  optionHint: { fontSize: 10.5, color: colors.faint },

  truthBox: { marginTop: 10, backgroundColor: '#F5F9FF', borderRadius: 10, padding: 10 },
  truthTitle: { fontSize: 12.5, fontWeight: '800', color: colors.ink },
  truthText: { fontSize: 12, color: colors.inkSoft, lineHeight: 18, marginTop: 5 },
  replayBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start',
    marginTop: 8, borderWidth: 1, borderColor: colors.accent, borderRadius: 9,
    paddingHorizontal: 9, paddingVertical: 5,
  },
  replayText: { fontSize: 11.5, fontWeight: '800', color: colors.accent },
  skipNote: { fontSize: 11.5, color: colors.sub, marginTop: 7 },

  resultBig: { fontSize: 20, fontWeight: '800', color: colors.ink, marginTop: 8 },
  resultText: { fontSize: 12.5, color: colors.inkSoft, lineHeight: 18, marginTop: 4 },
  eqBox: { backgroundColor: '#F2F5FA', borderRadius: 10, padding: 9, marginTop: 9 },
  eqText: { fontSize: 12.5, fontWeight: '700', color: colors.ink },
  resultExplain: { fontSize: 12, color: colors.inkSoft, lineHeight: 18, marginTop: 8 },

  btnRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  primaryBtn: {
    backgroundColor: colors.accent, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 11, alignItems: 'center', marginTop: 2,
  },
  primaryText: { color: '#FFFFFF', fontWeight: '800', fontSize: 13 },
  ghostBtn: {
    flex: 1, borderWidth: 1, borderColor: colors.line, borderRadius: 10,
    paddingVertical: 11, alignItems: 'center',
  },
  ghostText: { color: colors.inkSoft, fontWeight: '800', fontSize: 13 },
});
