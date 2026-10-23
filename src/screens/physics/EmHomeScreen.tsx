import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, shadow } from '../../theme';
import FieldLabScreen from './FieldLabScreen';
import RuleTrainerScreen from './RuleTrainerScreen';
import InductionLabScreen from './InductionLabScreen';
import AcLabScreen from './AcLabScreen';
import type { AcKey, FieldId, RuleKey } from '../../physics/emContent';

type ViewKey = 'home' | 'field' | 'rule' | 'induction' | 'ac';
/** 二级实验室 key（home 之外的取值），供外部（知识点汇总）直接定位到某个实验室 */
export type EmViewKey = Exclude<ViewKey, 'home'>;

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

const CARDS: {
  key: Exclude<ViewKey, 'home'>;
  icon: IoniconName;
  title: string;
  pain: string;
  desc: string;
  bullets: string[];
}[] = [
  {
    key: 'field',
    icon: 'pulse-outline',
    title: '场的可视化实验室',
    pain: '场看不见摸不着，只能靠背"× 和 ·"的符号',
    desc: '8 个典型电场 / 磁场全部用 3D 流光场线呈现：点电荷、平行板、直导线、螺线管……可以叠加、可以切等势面，还能在空间任意位置插一根探针实时读数。',
    bullets: ['8 个场 · 流光粒子沿场线流动', '探针：拖到哪读到哪，理解"场是逐点定义的"', '叠加开关：只有 A / 只有 B / A+B，亲眼看矢量合成', '一键切等势面：场线垂直等势面、沿场线电势降得最快'],
  },
  {
    key: 'rule',
    icon: 'hand-left-outline',
    title: '三方向定则训练器',
    pain: '左手右手总是分不清，"垂直纸面"的方向全靠猜',
    desc: '安培力、洛伦兹力、右手定则各配一个可交互场景：先自己判断方向，App 用叉乘当场判定对错；反例开关专门治"漏看条件"。',
    bullets: ['3 条定则 · 先判断后判定，练成肌肉记忆', '洛伦兹力：夹角从 0° 拉到 90°，直线 → 螺旋 → 圆周', '反例：I ∥ B 时无论电流多大，F = 0'],
  },
  {
    key: 'induction',
    icon: 'magnet-outline',
    title: '电磁感应探究台',
    pain: '磁通量变化"看不见"，楞次定律只会死记',
    desc: '拖动磁铁插入 / 拔出线圈，磁通量曲线和感应电流曲线实时画出。Φ 最大时 I 恰好为零——这个"反直觉"时刻亲眼看过一次就懂了。',
    bullets: ['磁铁自动往返，或翻转 N/S 极', 'Φ-t 与 I-t 双曲线实时联动', '匝数、电阻可调，看 ε = −N·ΔΦ/Δt 怎么起作用'],
  },
  {
    key: 'ac',
    icon: 'stats-chart-outline',
    title: '交流电波形实验室',
    pain: '瞬时值、峰值、有效值、平均值四个概念搅在一起',
    desc: '波形图和旋转相量同步转动；切换正弦 / 方波 / 半波整流，用"相同电阻相同热量"的对比实验说明有效值；变压器与远距离输电每个量实时联动。',
    bullets: ['相量转一圈 = 波形走一个周期', '有效值：两个电阻发热条始终同步增长', '输电损耗链：高压 / 低压一开关，I²r 对比一目了然'],
  },
];

/** 物理频道 · 电磁学子频道 */
export default function EmHomeScreen({
  onBack,
  initialView,
  initialItem,
}: {
  onBack: () => void;
  /** 从知识点汇总等处进入时，直接打开对应的二级实验室 */
  initialView?: EmViewKey;
  /** 二级实验室里要预选的条目（场 id / 定则 key / 交流电模块 key） */
  initialItem?: string;
}) {
  const [view, setView] = useState<ViewKey>(initialView ?? 'home');
  const insets = useSafeAreaInsets();
  /** 被外部直接定位到某个实验室时（比如从知识点汇总点进来），返回就直接离开本模块 */
  const backFromLab = initialView ? onBack : () => setView('home');

  if (view === 'field') {
    return <FieldLabScreen onBack={backFromLab} initialField={initialItem as FieldId | undefined} />;
  }
  if (view === 'rule') {
    return <RuleTrainerScreen onBack={backFromLab} initialRule={initialItem as RuleKey | undefined} />;
  }
  if (view === 'induction') return <InductionLabScreen onBack={backFromLab} />;
  if (view === 'ac') {
    return <AcLabScreen onBack={backFromLab} initialKey={initialItem as AcKey | undefined} />;
  }

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <Pressable style={styles.backBtn} onPress={onBack} accessibilityRole="button">
          <Ionicons name="chevron-back" size={18} color={colors.inkSoft} />
          <Text style={styles.backText}>返回</Text>
        </Pressable>
        <Text style={styles.title}>电磁学</Text>
        <Text style={styles.subtitle}>四个实验室，把"看不见的场"变成能摸的对象</Text>
      </View>
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        {CARDS.map((c) => (
          <Pressable
            key={c.key}
            style={styles.card}
            onPress={() => setView(c.key)}
            accessibilityRole="button"
            accessibilityLabel={`进入${c.title}`}
          >
            <View style={styles.cardHead}>
              <View style={styles.iconWrap}>
                <Ionicons name={c.icon} size={22} color={colors.orange} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{c.title}</Text>
                <Text style={styles.cardPain}>痛点：{c.pain}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.faint} />
            </View>
            <Text style={styles.cardDesc}>{c.desc}</Text>
            {c.bullets.map((b) => (
              <View key={b} style={styles.bulletRow}>
                <Ionicons name="checkmark-circle" size={13} color={colors.orange} />
                <Text style={styles.bulletText}>{b}</Text>
              </View>
            ))}
            <Text style={styles.enter}>进入实验室</Text>
          </Pressable>
        ))}
        <View style={{ height: 24 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: 16, paddingBottom: 10 },
  backBtn: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', marginBottom: 8 },
  backText: { fontSize: 14, color: colors.inkSoft, fontWeight: '600', marginLeft: 2 },
  title: { fontSize: 30, fontWeight: '800', color: colors.ink },
  subtitle: { fontSize: 13, color: colors.sub, marginTop: 6 },
  body: { paddingHorizontal: 14, paddingTop: 4 },
  card: {
    backgroundColor: colors.card,
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    ...shadow.card,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center' },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#FDF0E3',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  cardTitle: { fontSize: 15.5, fontWeight: '800', color: colors.ink },
  cardPain: { fontSize: 11.5, color: colors.orange, marginTop: 3, fontWeight: '600' },
  cardDesc: { fontSize: 13, lineHeight: 20, color: colors.sub, marginTop: 10 },
  bulletRow: { flexDirection: 'row', alignItems: 'center', marginTop: 7 },
  bulletText: { fontSize: 12.5, color: colors.inkSoft, marginLeft: 7, flex: 1 },
  enter: { fontSize: 12.5, fontWeight: '700', color: colors.orange, marginTop: 10 },
});
