import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii, shadow } from '../theme';
import { PROBLEMS, type IsoProblem } from '../iso/problems';
import IsomerListScreen from './IsomerListScreen';
import IsoPlayScreen from './IsoPlayScreen';
import AtomBuilderScreen from './AtomBuilderScreen';
import AllotropeScreen from './AllotropeScreen';
import AcidBaseScreen from './AcidBaseScreen';
import { CRIT_HIGH, CRIT_LOW, type RadiusLabEntry } from '../radius/radiusRule';

type ViewKey = 'home' | 'list' | 'play' | 'atom' | 'allotrope' | 'acid';

const ISO_CARD = {
  icon: 'git-network-outline' as const,
  title: '同分异构体',
  desc: '给出分子式和限制条件，用碳骨架搭建器把全部符合条件的异构体搭出来；提交后系统会诊断遗漏与重复。',
  tag: `${PROBLEMS.length} 道题`,
};

const COMING = ['官能团识别闯关', '方程式配平练习'];

/** 原子构造器 · 同位素 */
const ATOM_CARD = {
  icon: 'nuclear-outline' as const,
  title: '原子构造器',
  tag: '质子 / 中子 / 电子',
  desc:
    '拖动质子、中子、电子搭出一个原子，左上角实时生成核素符号：1 个质子是 H，加 1 个中子变 ²₁H（氘），再加 1 个中子变 ³₁H（氚）。' +
    '只改中子数系统就会提醒“这是同位素关系”，最后还有 ¹⁴C 测年小测。',
  bullets: ['拖拽搭原子，实时出核素符号', '同位素知识点讲解', '¹⁴C 衰变 + 测年小测'],
};

/** 同素异形体 · 结构决定性质 */
const ALLOTROPE_CARD = {
  icon: 'layers-outline' as const,
  title: '同素异形体',
  tag: 'C / O / P / S / Si 五组',
  desc:
    '同样的原子，搭法不同就成了完全不同的东西：金刚石的空间网状、石墨的层状（虚线是范德华力）、C₆₀ 的足球分子。' +
    '还有 O₂ 与 O₃、白磷与红磷、斜方硫与单斜硫、晶体硅与无定形硅 —— 切换任一种，下方的性质会跟着结构一起变，' +
    '最后还有同位素 / 同素异形体 / 同分异构体辨析和小测。',
  bullets: ['11 种单质 3D 结构切换 · 性质联动', '四组易混概念对比卡片', '17 道判断题练到会区分'],
};

/** 半径比 · 配位数实验 */
const RADIUS_CARD = {
  icon: 'resize-outline' as const,
  title: '半径比 · 配位数实验',
  tag: `临界值 ${CRIT_LOW.toFixed(3)} / ${CRIT_HIGH.toFixed(3)}`,
  desc:
    '拖动滑块改变 r₊/r₋，中间的晶格会实时重构：负离子保持紧密堆积，正离子变大到塞不进空隙时结构被迫重排。' +
    '配位数在临界半径比处直接跳变 —— 这就是它只能取 4 / 6 / 8 的原因。',
  bullets: ['滑块 + 3D 结构实时重构', '预测配位数并验证', '给真实离子半径自己算'],
};

/** 酸碱性 · 水溶液里的离子 */
const ACID_CARD = {
  icon: 'flask-outline' as const,
  title: '酸碱性 · 水溶液里的离子',
  tag: '16 种常见酸碱盐 · 含双水解与竞争',
  desc:
    '把物质扔进水里，看它先电离成什么离子、哪些离子会抢水里的 OH⁻ / H⁺、抢完会放出什么。' +
    '最后用 c(H⁺) 与 c(OH⁻) 的数量对比，直接读出酸性 / 碱性 / 中性。' +
    '同是 NaCl / NH₄Cl，差在一个「不水解」与「弱碱的阳离子水解」，结论就一个中性一个酸性。',
  bullets: [
    '电离：强酸/强碱完全、弱电解质部分可逆',
    '水解：阳离子抢 OH⁻ 显酸性、阴离子抢 H⁺ 显碱性',
    '酸式盐 NaHCO₃：水解与电离同时跑，看谁赢',
    '弱酸弱碱盐：双水解相互促进，H⁺ 与 OH⁻ 重新打平',
  ],
};

export default function HandsOnScreen({
  onOpenRadiusLab,
  initialView,
  initialItem,
  fromKnowledge,
  onExit,
}: {
  onOpenRadiusLab: (entry: RadiusLabEntry) => void;
  /** 从知识点汇总等处进入时，直接打开对应的实验 */
  initialView?: Exclude<ViewKey, 'play'>;
  /** 实验内要预选的条目（如酸碱实验的物质 id） */
  initialItem?: string;
  /** 这一屏是从知识点汇总点进来的 */
  fromKnowledge?: boolean;
  /** 实验页按返回时退回知识点汇总页 */
  onExit?: () => void;
}) {
  const [view, setView] = useState<ViewKey>(initialView ?? 'home');
  const [problem, setProblem] = useState<IsoProblem | null>(null);
  const insets = useSafeAreaInsets();
  /**
   * 被外部直接打开某个实验时（比如从知识点汇总点进来），
   * 实验里的「返回」直接离开本 tab（回到汇总页），而不是退回动手首页。
   */
  const backFromLab =
    fromKnowledge && onExit ? onExit : () => setView('home');

  if (view === 'play' && problem) {
    return <IsoPlayScreen problem={problem} onBack={() => setView('list')} />;
  }
  if (view === 'atom') {
    return <AtomBuilderScreen onBack={backFromLab} />;
  }
  if (view === 'allotrope') {
    return <AllotropeScreen onBack={backFromLab} />;
  }
  if (view === 'acid') {
    return <AcidBaseScreen onBack={backFromLab} initialCaseId={initialItem} />;
  }
  if (view === 'list') {
    return (
      <IsomerListScreen
        onBack={backFromLab}
        onOpen={(p) => {
          setProblem(p);
          setView('play');
        }}
      />
    );
  }

  return (
    <View style={styles.root}>
      {/* 不做沉浸式：内容从状态栏（时间/信号）下方开始 */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <Text style={styles.title}>动手</Text>
        <Text style={styles.subtitle}>搭一搭、写一写，把知识用起来</Text>
      </View>
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <Pressable style={styles.card} onPress={() => setView('list')}>
          <View style={styles.cardHead}>
            <View style={styles.iconWrap}>
              <Ionicons name={ISO_CARD.icon} size={22} color={colors.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>{ISO_CARD.title}</Text>
              <Text style={styles.cardTag}>{ISO_CARD.tag}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.faint} />
          </View>
          <Text style={styles.cardDesc}>{ISO_CARD.desc}</Text>
          <Text style={styles.enter}>开始练习</Text>
        </Pressable>

        <Pressable style={styles.card} onPress={() => setView('atom')} accessibilityRole="button">
          <View style={styles.cardHead}>
            <View style={styles.iconWrap}>
              <Ionicons name={ATOM_CARD.icon} size={22} color={colors.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>{ATOM_CARD.title}</Text>
              <Text style={styles.cardTag}>{ATOM_CARD.tag}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.faint} />
          </View>
          <Text style={styles.cardDesc}>{ATOM_CARD.desc}</Text>
          {ATOM_CARD.bullets.map((b) => (
            <View key={b} style={styles.bulletRow}>
              <Ionicons name="checkmark-circle" size={13} color={colors.green} />
              <Text style={styles.bulletText}>{b}</Text>
            </View>
          ))}
          <Text style={styles.enter}>开始搭建</Text>
        </Pressable>

        <Pressable style={styles.card} onPress={() => setView('allotrope')} accessibilityRole="button">
          <View style={styles.cardHead}>
            <View style={styles.iconWrap}>
              <Ionicons name={ALLOTROPE_CARD.icon} size={22} color={colors.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>{ALLOTROPE_CARD.title}</Text>
              <Text style={styles.cardTag}>{ALLOTROPE_CARD.tag}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.faint} />
          </View>
          <Text style={styles.cardDesc}>{ALLOTROPE_CARD.desc}</Text>
          {ALLOTROPE_CARD.bullets.map((b) => (
            <View key={b} style={styles.bulletRow}>
              <Ionicons name="checkmark-circle" size={13} color={colors.green} />
              <Text style={styles.bulletText}>{b}</Text>
            </View>
          ))}
          <Text style={styles.enter}>看结构怎么决定性质</Text>
        </Pressable>

        <Pressable
          style={styles.card}
          onPress={() => onOpenRadiusLab({ ratio: 0.56, from: 'NaCl' })}
          accessibilityRole="button"
        >
          <View style={styles.cardHead}>
            <View style={styles.iconWrap}>
              <Ionicons name={RADIUS_CARD.icon} size={22} color={colors.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>{RADIUS_CARD.title}</Text>
              <Text style={styles.cardTag}>{RADIUS_CARD.tag}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.faint} />
          </View>
          <Text style={styles.cardDesc}>{RADIUS_CARD.desc}</Text>
          {RADIUS_CARD.bullets.map((b) => (
            <View key={b} style={styles.bulletRow}>
              <Ionicons name="checkmark-circle" size={13} color={colors.green} />
              <Text style={styles.bulletText}>{b}</Text>
            </View>
          ))}
          <Text style={styles.enter}>进入实验</Text>
        </Pressable>

        <Pressable style={styles.card} onPress={() => setView('acid')} accessibilityRole="button">
          <View style={styles.cardHead}>
            <View style={styles.iconWrap}>
              <Ionicons name={ACID_CARD.icon} size={22} color={colors.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>{ACID_CARD.title}</Text>
              <Text style={styles.cardTag}>{ACID_CARD.tag}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.faint} />
          </View>
          <Text style={styles.cardDesc}>{ACID_CARD.desc}</Text>
          {ACID_CARD.bullets.map((b) => (
            <View key={b} style={styles.bulletRow}>
              <Ionicons name="checkmark-circle" size={13} color={colors.green} />
              <Text style={styles.bulletText}>{b}</Text>
            </View>
          ))}
          <Text style={styles.enter}>看水里的离子</Text>
        </Pressable>

        <Text style={styles.sectionTitle}>敬请期待</Text>
        {COMING.map((t) => (
          <View key={t} style={styles.card}>
            <View style={styles.cardHead}>
              <View style={[styles.iconWrap, styles.iconWrapOff]}>
                <Ionicons name="sparkles-outline" size={20} color={colors.faint} />
              </View>
              <Text style={styles.comingTitle}>{t}</Text>
            </View>
          </View>
        ))}
        <View style={{ height: 28 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 8 },
  title: { fontSize: 30, fontWeight: '800', color: colors.ink },
  subtitle: { fontSize: 13, color: colors.sub, marginTop: 6 },
  body: { paddingHorizontal: 14, paddingTop: 8, gap: 12 },
  card: {
    backgroundColor: colors.card,
    borderRadius: radii.card,
    padding: 15,
    ...shadow.card,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapOff: { backgroundColor: '#F2F5FA' },
  cardTitle: { fontSize: 16, fontWeight: '800', color: colors.ink },
  cardTag: { fontSize: 11.5, fontWeight: '600', color: colors.faint, marginTop: 3 },
  cardDesc: { fontSize: 12.5, color: colors.sub, lineHeight: 20, marginTop: 10 },
  bulletRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  bulletText: { fontSize: 12, color: colors.inkSoft, flex: 1 },
  enter: {
    marginTop: 12,
    backgroundColor: colors.accent,
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    overflow: 'hidden',
  },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: colors.faint, marginTop: 6 },
  comingTitle: { fontSize: 14, fontWeight: '700', color: colors.faint },
});
