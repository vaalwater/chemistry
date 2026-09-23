import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Chem3DView from '../components/Chem3DView';
import { colors, radii, shadow } from '../theme';
import type { SceneReq } from '../types';
import {
  ALLOTROPE_MOL,
  ALLOTROPES,
  allotropeById,
  COMPARE_ROWS,
  COMPARE_TIPS,
  CONCEPTS,
  CONCEPT_ORDER,
  QUIZ,
  QUIZ_OPTIONS,
  type AllotropeId,
  type ConceptKey,
} from '../allotrope/allotrope';

type PropTone = 'up' | 'down' | 'mid';

const TONE_COLOR: Record<PropTone, string> = {
  up: colors.green,
  down: colors.orange,
  mid: colors.accent,
};

export default function AllotropeScreen({ onBack }: { onBack: () => void }) {
  const insets = useSafeAreaInsets();
  const { width, height: winH } = useWindowDimensions();
  const wide = width >= 780;

  const [active, setActive] = useState<AllotropeId>('diamond');
  const [showCompare, setShowCompare] = useState(false);
  const entry = allotropeById(active);

  const scene = useMemo<SceneReq>(
    () => ({ kind: 'molecule', id: `allotrope-${active}`, mol: ALLOTROPE_MOL[active] }),
    [active]
  );
  const noop = useCallback(() => {}, []);

  // 画布别太高，否则下面的性质会被挤出屏幕（和半径比实验室同一套处理）
  const canvasH = wide ? 420 : Math.round(Math.max(260, Math.min(360, winH - 400)));

  return (
    <View style={styles.root}>
      {/* 全屏子页面：给状态栏（时间/信号）让出安全区，否则返回按钮点不到 */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <Pressable style={styles.backBtn} onPress={onBack} accessibilityLabel="返回">
          <Ionicons name="chevron-back" size={18} color={colors.accent} />
          <Text style={styles.backText}>返回</Text>
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>同素异形体</Text>
          <Text style={styles.subtitle} numberOfLines={1}>
            同一种元素，结构不同 → 性质不同
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <Text style={styles.lead}>
          金刚石、石墨、C₆₀ 都由碳元素组成。切换下面的按钮，看它们的碳原子是怎么搭的，
          再对照下方的性质 —— 硬度、导电性、熔点、用途全写在结构里。
        </Text>

        {/* ---------- 选择器 ---------- */}
        <View style={styles.pickRow}>
          {ALLOTROPES.map((a) => {
            const on = a.id === active;
            return (
              <Pressable
                key={a.id}
                style={[styles.alloBtn, on && styles.alloBtnOn]}
                onPress={() => setActive(a.id)}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
              >
                <Ionicons name={a.icon} size={20} color={on ? '#FFFFFF' : colors.accent} />
                <Text style={[styles.alloName, on && styles.alloNameOn]}>{a.name}</Text>
                <Text style={[styles.alloTag, on && styles.alloTagOn]} numberOfLines={1}>
                  {a.structTag}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* ---------- 3D 画布 ---------- */}
        <View style={[styles.canvasWrap, { height: canvasH }]}>
          <Chem3DView scene={scene} onEvent={noop} />
          <View style={styles.canvasHint} pointerEvents="none">
            <Text style={styles.canvasHintText}>{entry.canvasHint}</Text>
          </View>
        </View>

        <View style={styles.legendRow}>
          {entry.legend.map((l) => (
            <View key={l.text} style={styles.legendItem}>
              {l.kind === 'solid' ? <View style={styles.legendSolid} /> : null}
              {l.kind === 'dash' ? <View style={styles.legendDash} /> : null}
              {l.kind === 'atom' ? <View style={styles.legendDot} /> : null}
              <Text style={styles.legendText}>{l.text}</Text>
            </View>
          ))}
        </View>

        {/* ---------- 结构说明 ---------- */}
        <View style={styles.card}>
          <View style={styles.cardHead}>
            <View style={styles.iconWrap}>
              <Ionicons name={entry.icon} size={20} color={colors.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>{entry.name}</Text>
              <Text style={styles.cardTag}>{entry.structTag}</Text>
            </View>
            <Text style={styles.formula}>{entry.formula}</Text>
          </View>
          <Text style={styles.bodyText}>{entry.structText}</Text>
          <View style={styles.forceBox}>
            <Ionicons name="analytics-outline" size={14} color={colors.purple} />
            <Text style={styles.forceText}>{entry.forceText}</Text>
          </View>
        </View>

        {/* ---------- 性质联动 ---------- */}
        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <Text style={styles.cardTitle}>{entry.name}的性质</Text>
            <Text style={styles.cardTag}>跟着结构一起变</Text>
          </View>
          {entry.props.map((p) => (
            <View key={p.label} style={styles.propRow}>
              <View style={styles.propLabel}>
                <Ionicons name={p.icon} size={15} color={TONE_COLOR[p.tone]} />
                <Text style={styles.propLabelText}>{p.label}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.propValue, { color: TONE_COLOR[p.tone] }]}>{p.value}</Text>
                <Text style={styles.propNote}>{p.note}</Text>
              </View>
            </View>
          ))}
          <View style={styles.whyBox}>
            <Text style={styles.whyTitle}>为什么</Text>
            <Text style={styles.whyText}>{entry.why}</Text>
          </View>
        </View>

        {/* ---------- 三者横向对比 ---------- */}
        <View style={styles.card}>
          <Pressable style={styles.rowBetween} onPress={() => setShowCompare((v) => !v)}>
            <Text style={styles.cardTitle}>三者横向对比</Text>
            <View style={styles.foldRow}>
              <Text style={styles.foldText}>{showCompare ? '收起' : '展开'}</Text>
              <Ionicons
                name={showCompare ? 'chevron-up' : 'chevron-down'}
                size={15}
                color={colors.accent}
              />
            </View>
          </Pressable>
          {showCompare ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View>
                <View style={styles.tableHead}>
                  <View style={styles.thLabel}>
                    <Text style={styles.thLabelText}>对比项</Text>
                  </View>
                  {ALLOTROPES.map((a) => (
                    <View key={a.id} style={styles.thCell}>
                      <Text style={[styles.thCellText, a.id === active && styles.thCellTextOn]}>
                        {a.name}
                      </Text>
                    </View>
                  ))}
                </View>
                {COMPARE_ROWS.map((r) => (
                  <View key={r.label} style={styles.tRow}>
                    <View style={styles.tdLabel}>
                      <Text style={styles.tdLabelText}>{r.label}</Text>
                    </View>
                    {ALLOTROPES.map((a) => (
                      <View
                        key={a.id}
                        style={[styles.tdCell, a.id === active && styles.tdCellOn]}
                      >
                        <Text style={[styles.tdText, a.id === active && styles.tdTextOn]}>
                          {r.values[a.id]}
                        </Text>
                      </View>
                    ))}
                  </View>
                ))}
              </View>
            </ScrollView>
          ) : (
            <Text style={styles.bodyText}>
              同一份对比表：结构型式、作用力、硬度、导电性、熔点、溶解性、用途，点开一眼看完。
            </Text>
          )}
        </View>

        {/* ---------- 概念辨析 ---------- */}
        <Text style={styles.sectionTitle}>易混概念辨析</Text>
        <View style={styles.card}>
          {COMPARE_TIPS.map((t) => (
            <Text key={t} style={styles.tipLine}>
              · {t}
            </Text>
          ))}
        </View>
        {CONCEPT_ORDER.map((k) => {
          const c = CONCEPTS[k];
          return (
            <View key={k} style={styles.card}>
              <View style={styles.cardHead}>
                <View style={[styles.iconWrap, { backgroundColor: c.color + '18' }]}>
                  <Ionicons name={c.icon} size={20} color={c.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>{c.name}</Text>
                  <Text style={styles.cardTag}>研究对象：{c.object}</Text>
                </View>
              </View>
              <ConceptLine icon="checkmark-circle" color={colors.green} label="相同点" text={c.same} />
              <ConceptLine icon="swap-horizontal-outline" color={colors.orange} label="不同点" text={c.diff} />
              <ConceptLine icon="library-outline" color={colors.purple} label="举例" text={c.example} />
              <View style={styles.judgeBox}>
                <Ionicons name="bulb-outline" size={14} color={colors.accent} />
                <Text style={styles.judgeText}>{c.judge}</Text>
              </View>
            </View>
          );
        })}

        {/* ---------- 小测试 ---------- */}
        <Text style={styles.sectionTitle}>小测试</Text>
        <QuizCard />

        <View style={{ height: 28 }} />
      </ScrollView>
    </View>
  );
}

function ConceptLine({
  icon,
  color,
  label,
  text,
}: {
  icon: 'checkmark-circle' | 'swap-horizontal-outline' | 'library-outline';
  color: string;
  label: string;
  text: string;
}) {
  return (
    <View style={styles.conceptLine}>
      <Ionicons name={icon} size={14} color={color} style={{ marginTop: 2 }} />
      <Text style={styles.conceptBody}>
        <Text style={styles.conceptLabel}>{label}：</Text>
        {text}
      </Text>
    </View>
  );
}

function QuizCard() {
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState<ConceptKey | null>(null);
  const [right, setRight] = useState(0);
  const [wrong, setWrong] = useState(0);

  const item = QUIZ[idx % QUIZ.length];
  const done = picked !== null;
  const ok = picked === item.answer;

  const pick = (k: ConceptKey) => {
    if (done) return;
    setPicked(k);
    if (k === item.answer) setRight((v) => v + 1);
    else setWrong((v) => v + 1);
  };

  const next = () => {
    setPicked(null);
    setIdx((v) => (v + 1) % QUIZ.length);
  };

  return (
    <View style={styles.card}>
      <View style={styles.rowBetween}>
        <Text style={styles.cardTitle}>判断属于哪一类</Text>
        <Text style={styles.score}>
          {right} 对 / {right + wrong} 题
        </Text>
      </View>

      <View style={styles.qBox}>
        <Text style={styles.qExample}>{item.example}</Text>
        <Text style={styles.qAsk}>{item.ask}</Text>
      </View>

      <View style={styles.optWrap}>
        {QUIZ_OPTIONS.map((k) => {
          const c = CONCEPTS[k];
          const isAnswer = k === item.answer;
          const isPicked = k === picked;
          const tone = !done
            ? null
            : isAnswer
            ? styles.optRight
            : isPicked
            ? styles.optWrong
            : null;
          return (
            <Pressable
              key={k}
              style={[styles.opt, tone, isPicked && !tone && styles.optOn]}
              onPress={() => pick(k)}
              disabled={done}
              accessibilityRole="button"
            >
              <Ionicons name={c.icon} size={16} color={isAnswer && done ? colors.green : c.color} />
              <Text style={[styles.optText, isAnswer && done && styles.optTextRight, isPicked && !isAnswer && styles.optTextWrong]}>
                {c.name}
              </Text>
              {done && isAnswer ? (
                <Ionicons name="checkmark-circle" size={16} color={colors.green} />
              ) : null}
              {done && isPicked && !isAnswer ? (
                <Ionicons name="close-circle" size={16} color={colors.red} />
              ) : null}
            </Pressable>
          );
        })}
      </View>

      {done ? (
        <View style={[styles.fbBox, ok ? styles.fbOk : styles.fbBad]}>
          <Text style={[styles.fbTitle, ok ? styles.fbTitleOk : styles.fbTitleBad]}>
            {ok ? '答对了' : `答案是「${CONCEPTS[item.answer].name}」`}
          </Text>
          <Text style={styles.fbText}>{item.explain}</Text>
          {item.trap && !ok ? <Text style={styles.fbTrap}>易错点：{item.trap}</Text> : null}
        </View>
      ) : null}

      <Pressable style={styles.primaryBtn} onPress={next} accessibilityRole="button">
        <Text style={styles.primaryBtnText}>{done ? '下一题' : '跳过这题'}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 6,
  },
  backBtn: { flexDirection: 'row', alignItems: 'center', marginRight: 6 },
  backText: { fontSize: 13, color: colors.accent, fontWeight: '600' },
  title: { fontSize: 17, fontWeight: '800', color: colors.ink },
  subtitle: { fontSize: 11.5, color: colors.sub, marginTop: 2 },

  body: { paddingHorizontal: 14, paddingTop: 6, gap: 12, paddingBottom: 20 },
  lead: { fontSize: 12.5, color: colors.sub, lineHeight: 20 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: colors.faint, marginTop: 8 },

  pickRow: { flexDirection: 'row', gap: 8 },
  alloBtn: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderRadius: radii.card,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
  },
  alloBtnOn: { backgroundColor: colors.accent, borderColor: colors.accent, ...shadow.card },
  alloName: { fontSize: 13.5, fontWeight: '800', color: colors.ink, marginTop: 2 },
  alloNameOn: { color: '#FFFFFF' },
  alloTag: { fontSize: 10.5, color: colors.faint, fontWeight: '600' },
  alloTagOn: { color: 'rgba(255,255,255,0.85)' },

  canvasWrap: {
    borderRadius: radii.card,
    overflow: 'hidden',
    backgroundColor: '#EAF1FB',
  },
  canvasHint: { position: 'absolute', left: 8, top: 8, right: 8 },
  canvasHintText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
    backgroundColor: 'rgba(30,45,72,0.6)',
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 10,
    overflow: 'hidden',
  },
  legendRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingHorizontal: 2 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: '#6f6f6f',
  },
  legendSolid: { width: 16, height: 3, borderRadius: 2, backgroundColor: '#cfd8e8' },
  legendDash: { width: 16, height: 0, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.purple },
  legendText: { fontSize: 11, color: colors.sub },

  card: {
    backgroundColor: colors.card,
    borderRadius: radii.card,
    padding: 13,
    ...shadow.card,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: { fontSize: 14.5, fontWeight: '800', color: colors.ink },
  cardTag: { fontSize: 11.5, color: colors.sub, fontWeight: '600', marginTop: 2 },
  formula: { fontSize: 15, fontWeight: '800', color: colors.accent },
  bodyText: { fontSize: 12.5, color: colors.inkSoft, lineHeight: 20, marginTop: 9 },
  forceBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginTop: 9,
    backgroundColor: '#F6F3FE',
    borderRadius: 12,
    padding: 9,
  },
  forceText: { flex: 1, fontSize: 12, color: colors.inkSoft, lineHeight: 19 },

  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  propRow: {
    flexDirection: 'row',
    gap: 9,
    marginTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
    paddingTop: 9,
  },
  propLabel: { flexDirection: 'row', alignItems: 'center', gap: 5, width: 62 },
  propLabelText: { fontSize: 12, fontWeight: '700', color: colors.sub },
  propValue: { fontSize: 13, fontWeight: '800' },
  propNote: { fontSize: 11.5, color: colors.sub, lineHeight: 17, marginTop: 2 },
  whyBox: { marginTop: 11, backgroundColor: '#EFF5FF', borderRadius: 12, padding: 10 },
  whyTitle: { fontSize: 12, fontWeight: '800', color: colors.accent },
  whyText: { fontSize: 12, color: colors.inkSoft, lineHeight: 19, marginTop: 3 },

  foldRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  foldText: { fontSize: 12, fontWeight: '700', color: colors.accent },
  tableHead: { flexDirection: 'row', marginTop: 10 },
  thLabel: { width: 62, paddingVertical: 6 },
  thLabelText: { fontSize: 11, fontWeight: '700', color: colors.faint },
  thCell: { width: 104, paddingVertical: 6, paddingHorizontal: 4 },
  thCellText: { fontSize: 12, fontWeight: '800', color: colors.ink, textAlign: 'center' },
  thCellTextOn: { color: colors.accent },
  tRow: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
  },
  tdLabel: { width: 62, paddingVertical: 8 },
  tdLabelText: { fontSize: 11, color: colors.sub, fontWeight: '600' },
  tdCell: {
    width: 104,
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: colors.line,
  },
  tdCellOn: { backgroundColor: colors.accentSoft },
  tdText: { fontSize: 11, color: colors.inkSoft, lineHeight: 16, textAlign: 'center' },
  tdTextOn: { color: colors.ink, fontWeight: '700' },

  tipLine: { fontSize: 12, color: colors.inkSoft, lineHeight: 19, marginTop: 3 },
  conceptLine: { flexDirection: 'row', gap: 6, marginTop: 8 },
  conceptBody: { flex: 1, fontSize: 12.5, color: colors.inkSoft, lineHeight: 19 },
  conceptLabel: { fontWeight: '800', color: colors.ink },
  judgeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    backgroundColor: colors.accentSoft,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  judgeText: { flex: 1, fontSize: 12, fontWeight: '700', color: colors.accent, lineHeight: 18 },

  qBox: {
    marginTop: 10,
    backgroundColor: '#F5F9FF',
    borderRadius: 12,
    padding: 11,
    alignItems: 'center',
  },
  qExample: { fontSize: 15, fontWeight: '800', color: colors.ink, textAlign: 'center', lineHeight: 22 },
  qAsk: { fontSize: 12, color: colors.sub, marginTop: 4 },
  score: { fontSize: 12.5, fontWeight: '800', color: colors.orange },

  optWrap: { marginTop: 10, gap: 7 },
  opt: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    paddingHorizontal: 11,
    paddingVertical: 10,
    backgroundColor: '#FBFCFF',
  },
  optOn: { borderColor: colors.accent },
  optRight: { backgroundColor: '#EAF7F1', borderColor: colors.green },
  optWrong: { backgroundColor: '#FDECEB', borderColor: colors.red },
  optText: { flex: 1, fontSize: 13, fontWeight: '700', color: colors.ink },
  optTextRight: { color: colors.green },
  optTextWrong: { color: colors.red },

  fbBox: { marginTop: 10, borderRadius: 12, padding: 10 },
  fbOk: { backgroundColor: '#EAF7F1' },
  fbBad: { backgroundColor: '#FDECEB' },
  fbTitle: { fontSize: 13, fontWeight: '800' },
  fbTitleOk: { color: colors.green },
  fbTitleBad: { color: colors.red },
  fbText: { fontSize: 12, color: colors.inkSoft, lineHeight: 18, marginTop: 3 },
  fbTrap: { fontSize: 11.5, color: colors.orange, lineHeight: 17, marginTop: 4 },

  primaryBtn: {
    marginTop: 11,
    backgroundColor: colors.accent,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  primaryBtnText: { color: '#FFFFFF', fontSize: 13.5, fontWeight: '700' },
});
