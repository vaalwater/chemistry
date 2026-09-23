import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii, shadow } from '../theme';
import AtomBuilder from '../components/AtomBuilder';
import {
  C14_HALF_LIFE,
  ISOTOPE_GROUPS,
  makeQuizQuestion,
  remainPercent,
  subText,
  supText,
  type QuizQuestion,
} from '../isotope/isotope';

/** 同位素知识点卡片 */
const KNOWLEDGE: { icon: 'library-outline' | 'reader-outline' | 'swap-horizontal-outline' | 'analytics-outline' | 'flask-outline'; title: string; body: string }[] = [
  {
    icon: 'library-outline',
    title: '什么叫同位素',
    body: '质子数相同、中子数不同的同种元素的原子互称同位素。它们在周期表里占据同一格位置 —— “同位”这个名字就是这么来的。',
  },
  {
    icon: 'reader-outline',
    title: '核素符号 ᴬ_Z X 怎么读',
    body: '左上角 A 是质量数，A = 质子数 + 中子数；左下角 Z 是质子数，也等于核电荷数、等于中性原子的核外电子数。比如 ¹⁴₆C：质子 6、中子 8、电子 6。',
  },
  {
    icon: 'swap-horizontal-outline',
    title: '什么变了，什么没变',
    body: '质子数一变，元素种类就变；只改中子数，元素种类不变，只是多了一个同位素。因为核外电子排布一样，同位素的化学性质几乎完全相同，但质量不同，密度、熔点沸点等物理性质有差别。',
  },
  {
    icon: 'analytics-outline',
    title: '为什么相对原子质量不是整数',
    body: '天然元素往往是几种同位素的混合物，相对原子质量按天然丰度取平均值。氯-35 与氯-37 约 3:1，平均下来就是课本上的 35.5。',
  },
  {
    icon: 'flask-outline',
    title: '有的稳定，有的会衰变',
    body: '¹²C、¹⁶O 这类稳定同位素不会衰变；¹⁴C、³H、²³⁵U 这类有放射性，会自发放出射线变成别的核素。放射性同位素可以用来测年、示踪和治病。',
  },
];

export default function AtomBuilderScreen({ onBack }: { onBack: () => void }) {
  const insets = useSafeAreaInsets();
  const [dragging, setDragging] = useState(false);

  /* ---------- ¹⁴C 衰变演示 ---------- */
  const [demoK, setDemoK] = useState(1);

  /* ---------- 小测 ---------- */
  const [q, setQ] = useState<QuizQuestion>(() => makeQuizQuestion());
  const [picked, setPicked] = useState<number | null>(null);
  const answered = picked !== null;
  const right = answered && picked === q.answerIndex;

  const pick = (i: number) => {
    if (answered) return;
    setPicked(i);
  };
  const nextQuestion = () => {
    setQ(makeQuizQuestion());
    setPicked(null);
  };

  const remain = remainPercent(demoK);

  return (
    <View style={styles.root}>
      {/* 全屏子页面：给状态栏（时间/信号）让出安全区 */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <Text onPress={onBack} style={styles.back}>
          <Ionicons name="chevron-back" size={18} color={colors.accent} /> 返回
        </Text>
        <Text style={styles.title}>原子构造器</Text>
        <Text style={styles.badge}>同位素</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
        scrollEnabled={!dragging}
      >
        <Text style={styles.lead}>
          把质子、中子、电子拖进原子模型，左上角会实时生成核素符号。先拖 1 个质子做出氢，再加中子看看会发生什么。
        </Text>

        <AtomBuilder canvasHeight={300} onDragStateChange={setDragging} />

        <Text style={styles.sectionTitle}>同位素知识点</Text>
        {KNOWLEDGE.map((k) => (
          <View key={k.title} style={styles.card}>
            <View style={styles.cardHead}>
              <View style={styles.iconWrap}>
                <Ionicons name={k.icon} size={20} color={colors.accent} />
              </View>
              <Text style={styles.cardTitle}>{k.title}</Text>
            </View>
            <Text style={styles.cardBody}>{k.body}</Text>
          </View>
        ))}

        <Text style={styles.sectionTitle}>常见的同位素一家子</Text>
        <View style={styles.card}>
          {ISOTOPE_GROUPS.map((g) => (
            <View key={g.symbol} style={styles.groupRow}>
              <Text style={styles.groupName}>{g.name}</Text>
              <View style={styles.groupChips}>
                {g.masses.map((a) => (
                  <View key={a} style={styles.nuclideChip}>
                    <Text style={styles.nuclideChipText}>
                      {supText(a)}
                      {subText(g.z)}
                      {g.symbol}
                    </Text>
                  </View>
                ))}
              </View>
              <Text style={styles.groupNote}>{g.note}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.sectionTitle}>小测试 · 用 ¹⁴C 给古物测年</Text>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>为什么能测年</Text>
          <Text style={styles.cardBody}>
            活着的生物不断与外界交换碳，体内 ¹⁴C 与 ¹²C 的比例基本恒定；一旦死亡，交换停止，¹⁴C 只会按半衰期越来越少。
            因此测出“还剩百分之几”，就能反推它死了多少年：
          </Text>
          <View style={styles.formulaBox}>
            <Text style={styles.formula}>t = {C14_HALF_LIFE} × log₂(N₀ / N)</Text>
          </View>
          <Text style={styles.cardBody}>
            ¹⁴C 的半衰期是 {C14_HALF_LIFE} 年：每过 {C14_HALF_LIFE} 年，剩下一半。
          </Text>

          <Text style={styles.subHead}>衰变演示</Text>
          <View style={styles.stepRow}>
            {[0, 1, 2, 3, 4].map((k) => (
              <Pressable
                key={k}
                style={[styles.stepBtn, demoK === k && styles.stepBtnOn]}
                onPress={() => setDemoK(k)}
                accessibilityRole="button"
                accessibilityState={{ selected: demoK === k }}
              >
                <Text style={[styles.stepBtnText, demoK === k && styles.stepBtnTextOn]}>
                  {k} 个半衰期
                </Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.barTrack}>
            <View style={[styles.barFill, { width: `${remain}%` }]} />
          </View>
          <Text style={styles.barText}>
            剩余 {remain >= 1 ? Math.round(remain * 10) / 10 : remain.toFixed(2)}% · 大约过了{' '}
            {C14_HALF_LIFE * demoK} 年
          </Text>
        </View>

        <View style={styles.card}>
          <View style={styles.quizHead}>
            <Ionicons name="help-circle-outline" size={18} color={colors.accent} />
            <Text style={styles.quizTitle}>{q.prompt}</Text>
          </View>
          {q.options.map((opt, i) => {
            const isAnswer = i === q.answerIndex;
            const isPicked = picked === i;
            let tone = styles.opt;
            let textTone = styles.optText;
            if (answered && isAnswer) {
              tone = styles.optRight;
              textTone = styles.optTextRight;
            } else if (answered && isPicked) {
              tone = styles.optWrong;
              textTone = styles.optTextWrong;
            }
            return (
              <Pressable key={opt} style={[tone]} onPress={() => pick(i)} accessibilityRole="button">
                <Text style={styles.optBullet}>{'ABCD'[i]}</Text>
                <Text style={[textTone, styles.optTextBase]}>{opt}</Text>
                {answered && isAnswer ? (
                  <Ionicons name="checkmark-circle" size={16} color={colors.green} />
                ) : null}
              </Pressable>
            );
          })}
          {answered ? (
            <View style={[styles.resultBox, right ? styles.resultRight : styles.resultWrong]}>
              <Text style={[styles.resultTitle, right ? styles.resultTitleRight : styles.resultTitleWrong]}>
                {right ? '答对了' : '再想想'}
              </Text>
              <Text style={styles.resultExplain}>{q.explain}</Text>
              <Text style={styles.resultHint}>
                对照上面：经过 {q.halfLives} 个半衰期时剩余{' '}
                {Math.round(remainPercent(q.halfLives) * 100) / 100}%。
              </Text>
            </View>
          ) : null}
          <Pressable style={styles.nextBtn} onPress={nextQuestion} accessibilityRole="button">
            <Text style={styles.nextBtnText}>{answered ? '再来一题' : '换一题'}</Text>
          </Pressable>
        </View>

        <View style={{ height: 28 }} />
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
  badge: {
    fontSize: 11.5,
    fontWeight: '700',
    color: colors.accent,
    backgroundColor: colors.accentSoft,
    borderRadius: radii.chip,
    paddingHorizontal: 10,
    paddingVertical: 3,
    overflow: 'hidden',
  },
  body: { padding: 14, gap: 12, paddingBottom: 30 },
  lead: { fontSize: 12.5, color: colors.sub, lineHeight: 20 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: colors.faint, marginTop: 8 },
  card: {
    backgroundColor: colors.card,
    borderRadius: radii.card,
    padding: 14,
    gap: 8,
    ...shadow.card,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 11,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: { flex: 1, fontSize: 15, fontWeight: '800', color: colors.ink },
  cardBody: { fontSize: 12.5, color: colors.inkSoft, lineHeight: 20 },
  subHead: { fontSize: 13, fontWeight: '700', color: colors.ink, marginTop: 4 },
  formulaBox: {
    backgroundColor: '#F4F8FF',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  formula: { fontSize: 14, fontWeight: '800', color: colors.accent },

  stepRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  stepBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: '#F4F8FF',
    borderWidth: 1,
    borderColor: colors.line,
  },
  stepBtnOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  stepBtnText: { fontSize: 11.5, fontWeight: '700', color: colors.inkSoft },
  stepBtnTextOn: { color: '#FFFFFF' },
  barTrack: {
    height: 14,
    borderRadius: 7,
    backgroundColor: '#EDF2FA',
    overflow: 'hidden',
  },
  barFill: { height: 14, borderRadius: 7, backgroundColor: colors.accent },
  barText: { fontSize: 12, color: colors.inkSoft, fontWeight: '600' },

  groupRow: { gap: 6, paddingVertical: 6 },
  groupName: { fontSize: 13.5, fontWeight: '800', color: colors.ink },
  groupChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  nuclideChip: {
    backgroundColor: colors.accentSoft,
    borderRadius: 10,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  nuclideChipText: { fontSize: 12.5, fontWeight: '700', color: colors.accent },
  groupNote: { fontSize: 11.5, color: colors.sub, lineHeight: 17 },

  quizHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  quizTitle: { flex: 1, fontSize: 13.5, fontWeight: '700', color: colors.ink, lineHeight: 20 },
  opt: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    paddingHorizontal: 11,
    paddingVertical: 10,
    backgroundColor: '#FBFCFF',
  },
  optRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 11,
    paddingVertical: 10,
    borderColor: colors.green,
    backgroundColor: '#EFF8F3',
  },
  optWrong: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 11,
    paddingVertical: 10,
    borderColor: colors.red,
    backgroundColor: '#FDECEA',
  },
  optBullet: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.line,
    textAlign: 'center',
    lineHeight: 18,
    fontSize: 11,
    fontWeight: '800',
    color: colors.sub,
    overflow: 'hidden',
  },
  optTextBase: { flex: 1, fontSize: 13, fontWeight: '600' },
  optText: { color: colors.ink },
  optTextRight: { color: colors.green },
  optTextWrong: { color: colors.red },

  resultBox: { borderRadius: 12, padding: 11, gap: 4, marginTop: 2 },
  resultRight: { backgroundColor: '#EFF8F3' },
  resultWrong: { backgroundColor: '#FFF6EA' },
  resultTitle: { fontSize: 13, fontWeight: '800' },
  resultTitleRight: { color: colors.green },
  resultTitleWrong: { color: colors.orange },
  resultExplain: { fontSize: 12, color: colors.inkSoft, lineHeight: 19 },
  resultHint: { fontSize: 11.5, color: colors.sub, lineHeight: 18 },

  nextBtn: {
    backgroundColor: colors.accent,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 2,
  },
  nextBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
});
