import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii, shadow } from '../theme';
import type { IsoProblem } from '../iso/problems';
import { subFormula } from '../iso/problems';
import { checkGraph, condensed } from '../iso/condensed';
import { matchesConstraint } from '../iso/enumerate';
import { Graph, cloneGraph, formulaOf, parseFormula } from '../iso/molgraph';
import { answerTexts, diagnose, type Diagnosis } from '../iso/diagnose';
import StructureBuilder, {
  BuilderState,
  emptyBuilderState,
} from '../components/StructureBuilder';

/** 每次都从空白画板开始，全部原子与官能团都由学生从下方拖上来 */
function freshBuilder(): BuilderState {
  return emptyBuilderState();
}

/** 和题目分子式比一比，差哪些原子（氢是推算出来的，一并提示） */
function diffText(now: string, want: string): string {
  const a = parseFormula(now || '');
  const b = parseFormula(want);
  const parts: string[] = [];
  for (const el of ['C', 'O', 'N', 'Cl', 'Br']) {
    const d = (b[el] || 0) - (a[el] || 0);
    if (d > 0) parts.push(`还差 ${d} 个 ${el}`);
    else if (d < 0) parts.push(`多了 ${-d} 个 ${el}`);
  }
  const dh = (b.H || 0) - (a.H || 0);
  if (dh !== 0) {
    const heavy =
      ['C', 'O', 'N', 'Cl', 'Br'].every((el) => (b[el] || 0) === (a[el] || 0));
    parts.push(
      dh > 0
        ? `氢还差 ${dh} 个${heavy ? '（数一数双键 / 环是不是画多了）' : ''}`
        : `氢多了 ${-dh} 个${heavy ? '（数一数双键 / 环是不是画少了）' : ''}`
    );
  }
  return parts.join('，');
}

export default function IsoPlayScreen({
  problem,
  onBack,
}: {
  problem: IsoProblem;
  onBack: () => void;
}) {
  const [builder, setBuilder] = useState<BuilderState>(() => freshBuilder());
  const [dragging, setDragging] = useState(false);
  const [answers, setAnswers] = useState<Graph[]>([]);
  const [result, setResult] = useState<Diagnosis | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [toast, setToast] = useState<string>('');
  const [total, setTotal] = useState<number | null>(null);

  useEffect(() => {
    setBuilder(freshBuilder());
    setAnswers([]);
    setResult(null);
    setShowAll(false);
    setTotal(null);
    const t = setTimeout(() => setTotal(answerTexts(problem).length), 40);
    return () => clearTimeout(t);
  }, [problem]);

  const check = useMemo(() => checkGraph(builder.graph), [builder.graph]);
  const text = useMemo(() => condensed(builder.graph), [builder.graph]);
  const nowFormula = useMemo(() => formulaOf(builder.graph), [builder.graph]);
  const standardTexts = useMemo(() => (showAll ? answerTexts(problem) : []), [showAll, problem]);

  /** 收进答案前要过三关：结构合法 → 分子式对得上 → 满足限制条件 */
  const formulaOk = check.ok && nowFormula === problem.formula;
  const condOk = check.ok && matchesConstraint(builder.graph, problem.constraint);
  const ready = formulaOk && condOk;
  const status = !check.ok
    ? { ok: false, text: check.msg }
    : !formulaOk
    ? {
        ok: false,
        text: `分子式是 ${subFormula(nowFormula)}，题目要求 ${subFormula(
          problem.formula
        )}：${diffText(nowFormula, problem.formula)}`,
      }
    : !condOk
    ? { ok: false, text: `结构还不满足限制条件：${problem.condition}` }
    : { ok: true, text: '结构完整，可以收进答案' };

  const addAnswer = () => {
    if (!status.ok) {
      setToast(status.text);
      return;
    }
    setAnswers((prev) => [...prev, cloneGraph(builder.graph)]);
    setResult(null);
    setToast('已收进答案，继续搭下一个');
    setBuilder(freshBuilder());
  };

  const submit = () => {
    if (!answers.length) {
      setToast('先搭出至少一种结构再提交');
      return;
    }
    setResult(diagnose(problem, answers));
    setToast('');
  };

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text onPress={onBack} style={styles.back}>
          <Ionicons name="chevron-back" size={18} color={colors.accent} /> 返回
        </Text>
        <Text style={styles.title}>{problem.title}</Text>
        <Text style={styles.formula}>{subFormula(problem.formula)}</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
        scrollEnabled={!dragging}
      >
        <View style={styles.card}>
          <Text style={styles.cond}>限制条件：{problem.condition}</Text>
          <Text style={styles.tip}>{problem.tip}</Text>
          <Text style={styles.count}>
            系统枚举：共 {total === null ? '计算中…' : `${total} 种`}
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>碳骨架搭建器</Text>
          <StructureBuilder
            value={builder}
            onChange={setBuilder}
            height={260}
            onDragStateChange={setDragging}
            tip={
              problem.constraint.aromatic
                ? '芳香族题目：先从下面拖一个「苯环」上来打底，再往环上的碳原子拖取代基。'
                : undefined
            }
          />
        </View>

        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.cardTitle}>当前结构</Text>
            <Text style={[styles.nowFormula, nowFormula === problem.formula && styles.nowOk]}>
              {subFormula(nowFormula) || '—'}
              {nowFormula === problem.formula ? ' ✓' : ''}
            </Text>
          </View>
          <Text style={styles.condensed}>{text || '（还没有结构）'}</Text>
          <Text style={[styles.state, status.ok ? styles.stateOk : styles.stateBad]}>
            {status.text}
          </Text>
          {toast ? <Text style={styles.toast}>{toast}</Text> : null}
          <Text onPress={addAnswer} style={[styles.primaryBtn, !ready && styles.primaryBtnOff]}>
            收进答案
          </Text>
        </View>

        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.cardTitle}>我的答案（{answers.length}）</Text>
            {answers.length ? (
              <Text onPress={() => setAnswers([])} style={styles.miniBtn}>
                清空
              </Text>
            ) : null}
          </View>
          {answers.length ? (
            <View style={styles.chips}>
              {answers.map((a, i) => (
                <View key={i} style={styles.chip}>
                  <Text style={styles.chipText}>{condensed(a)}</Text>
                  <Text
                    onPress={() => {
                      setAnswers((prev) => prev.filter((_, k) => k !== i));
                      setResult(null);
                    }}
                    style={styles.chipX}
                  >
                    ×
                  </Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.empty}>搭好一个结构后点上面的「收进答案」</Text>
          )}
          <Text onPress={submit} style={styles.primaryBtn}>
            提交批改
          </Text>
        </View>

        {result ? (
          <View style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.cardTitle}>批改结果</Text>
              <Text style={[styles.score, result.perfect && styles.scoreOk]}>
                {result.score}
              </Text>
            </View>
            {result.perfect ? (
              <Text style={styles.perfect}>
                全部找到，没有遗漏也没有重复！
              </Text>
            ) : null}
            {result.hints.map((h, i) => (
              <Text key={i} style={styles.hint}>
                • {h}
              </Text>
            ))}
            <View style={styles.verdicts}>
              {result.verdicts.map((v, i) => (
                <View key={i} style={styles.verdict}>
                  <Text
                    style={[
                      styles.dot,
                      v.status === 'correct'
                        ? styles.dotOk
                        : v.status === 'duplicate'
                        ? styles.dotDup
                        : styles.dotBad,
                    ]}
                  >
                    ●
                  </Text>
                  <Text style={styles.verdictText}>
                    {v.text}
                    {v.status === 'correct' ? '' : `　${v.reason}`}
                  </Text>
                </View>
              ))}
            </View>
            <Text onPress={() => setShowAll((s) => !s)} style={styles.miniBtn}>
              {showAll ? '收起标准答案' : '看看全部标准答案'}
            </Text>
            {showAll ? (
              <View style={styles.chips}>
                {standardTexts.map((s, i) => (
                  <View key={i} style={[styles.chip, styles.chipAnswer]}>
                    <Text style={styles.chipText}>{s}</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  back: { fontSize: 13, color: colors.accent, fontWeight: '600' },
  title: { flex: 1, fontSize: 16, fontWeight: '700', color: colors.ink },
  formula: { fontSize: 15, fontWeight: '700', color: colors.purple },
  body: { padding: 14, gap: 12, paddingBottom: 40 },
  card: {
    backgroundColor: colors.card,
    borderRadius: radii.card,
    padding: 14,
    ...shadow.card,
  },
  cardTitle: { fontSize: 14, fontWeight: '700', color: colors.ink, marginBottom: 6 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cond: { fontSize: 13.5, fontWeight: '600', color: colors.ink, lineHeight: 20 },
  tip: { fontSize: 12.5, color: colors.sub, marginTop: 6, lineHeight: 19 },
  count: { fontSize: 11.5, color: colors.faint, marginTop: 8 },
  nowFormula: { fontSize: 14, fontWeight: '700', color: colors.sub },
  nowOk: { color: colors.green },
  condensed: { fontSize: 17, fontWeight: '700', color: colors.ink, marginTop: 6 },
  state: { fontSize: 12, marginTop: 6, color: colors.sub },
  stateOk: { color: colors.green },
  stateBad: { color: colors.orange },
  toast: { fontSize: 12, color: colors.orange, marginTop: 6 },
  primaryBtn: {
    marginTop: 12,
    backgroundColor: colors.accent,
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 11,
    borderRadius: 12,
    overflow: 'hidden',
  },
  primaryBtnOff: { opacity: 0.45 },
  miniBtn: { fontSize: 12.5, fontWeight: '600', color: colors.accent },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accentSoft,
    borderRadius: radii.chip,
    paddingLeft: 11,
    paddingRight: 8,
    paddingVertical: 5,
  },
  chipAnswer: { backgroundColor: '#EAF7F1' },
  chipText: { fontSize: 12.5, fontWeight: '600', color: colors.ink },
  chipX: { fontSize: 14, color: colors.sub, marginLeft: 5, paddingHorizontal: 3 },
  empty: { fontSize: 12, color: colors.faint, marginTop: 4 },
  score: { fontSize: 18, fontWeight: '800', color: colors.orange },
  scoreOk: { color: colors.green },
  perfect: { fontSize: 13, fontWeight: '700', color: colors.green, marginBottom: 6 },
  hint: { fontSize: 12.5, color: colors.inkSoft, lineHeight: 20, marginTop: 3 },
  verdicts: { marginTop: 10, gap: 6 },
  verdict: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  dot: { fontSize: 11, marginTop: 2 },
  dotOk: { color: colors.green },
  dotDup: { color: colors.orange },
  dotBad: { color: colors.red },
  verdictText: { flex: 1, fontSize: 12.5, color: colors.inkSoft, lineHeight: 19 },
});
