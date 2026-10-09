import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, shadow } from '../../theme';
import ProjectionLabScreen from './ProjectionLabScreen';
import TheoremLabScreen from './TheoremLabScreen';
import AngleFinderScreen from './AngleFinderScreen';
import VolumeTheaterScreen from './VolumeTheaterScreen';

type ViewKey = 'home' | 'proj' | 'theorem' | 'angle' | 'volume';

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
    key: 'proj',
    icon: 'cube-outline',
    title: '立体 ↔ 直观图联动',
    pain: '空间想象力不足，看不懂斜二测画法背后的立体',
    desc: '上面是可旋转的 3D 几何体，下面是同步变化的斜二测直观图：实线是看得见的棱，虚线是被挡住的棱。点 2D 图上的线，3D 里对应棱会闪烁。',
    bullets: ['7 种几何体 · 拖着转，投影实时同步', '点线反查：2D ⇄ 3D 双向高亮', '一键展开：看表面积公式怎么来的'],
  },
  {
    key: 'theorem',
    icon: 'git-branch-outline',
    title: '定理可视化实验室',
    pain: '线面平行/垂直的判定定理记不住、不会用',
    desc: '每条定理配一个可交互场景，四步动画把“为什么成立”演出来；反例开关专门治“漏看条件”；不会选定理时让判定树问你几个问题。',
    bullets: ['5 条判定/性质定理 · 四步演示', '反例开关：条件少一个会怎样', '判定树：三个问题定位该用哪条'],
  },
  {
    key: 'angle',
    icon: 'locate-outline',
    title: '空间角三步定位器',
    pain: '异面直线角、线面角、二面角找不到、算不对',
    desc: '按“找 → 证 → 算”三步走：先动画演示怎么平移、怎么作射影、怎么找平面角，再把关键三角形拎出来让你自己算，App 即时判对错。',
    bullets: ['三类角 · 各配 3~4 道变式题', '辅助线选得对不对，App 当场反馈', '同一模型换条件，练“不同考法”'],
  },
  {
    key: 'volume',
    icon: 'beaker-outline',
    title: '体积公式推导剧场',
    pain: '柱、锥、球的体积公式混乱，不会推导',
    desc: '公式先让你猜，再演给你看：三棱柱切成三个等体积的锥、圆锥倒三次水装满圆柱、祖暅原理对比半球与“圆柱挖圆锥”。',
    bullets: ['先猜后验：错了才记得住', '截面可拖动，看形状怎么变', '每个公式配一段推导字幕'],
  },
];

/** 数学频道 · 立体几何子频道 */
export default function SolidGeoHomeScreen({ onBack }: { onBack: () => void }) {
  const [view, setView] = useState<ViewKey>('home');
  const insets = useSafeAreaInsets();

  if (view === 'proj') return <ProjectionLabScreen onBack={() => setView('home')} />;
  if (view === 'theorem') return <TheoremLabScreen onBack={() => setView('home')} />;
  if (view === 'angle') return <AngleFinderScreen onBack={() => setView('home')} />;
  if (view === 'volume') return <VolumeTheaterScreen onBack={() => setView('home')} />;

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <Pressable style={styles.backBtn} onPress={onBack} accessibilityRole="button">
          <Ionicons name="chevron-back" size={18} color={colors.inkSoft} />
          <Text style={styles.backText}>返回</Text>
        </Pressable>
        <Text style={styles.title}>立体几何</Text>
        <Text style={styles.subtitle}>四个实验室，专治“脑子里建不起模型”</Text>
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
                <Ionicons name={c.icon} size={22} color={colors.purple} />
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
                <Ionicons name="checkmark-circle" size={13} color={colors.purple} />
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
    backgroundColor: '#F1ECFB',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  cardTitle: { fontSize: 15.5, fontWeight: '800', color: colors.ink },
  cardPain: { fontSize: 11.5, color: colors.orange, marginTop: 3, fontWeight: '600' },
  cardDesc: { fontSize: 13, lineHeight: 20, color: colors.sub, marginTop: 10 },
  bulletRow: { flexDirection: 'row', alignItems: 'center', marginTop: 7 },
  bulletText: { fontSize: 12.5, color: colors.inkSoft, marginLeft: 7, flex: 1 },
  enter: { fontSize: 12.5, fontWeight: '700', color: colors.purple, marginTop: 10 },
});
