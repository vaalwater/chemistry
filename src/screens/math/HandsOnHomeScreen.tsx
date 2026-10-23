import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, shadow } from '../../theme';
import PlaygroundScreen from './PlaygroundScreen';

type ViewKey = 'home' | 'draw';

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
    key: 'draw',
    icon: 'brush-outline',
    title: '画图',
    pain: '函数只在脑子里想，参数一变图像怎么动全靠猜',
    desc: '自己写函数（几元几次都行，式子里的字母自动变成滑块），多条函数不同颜色画在同一张画布上；画布能拖动缩放、点一下读坐标。开游戏模式会随机给第一象限里的整点，写的函数穿过就算过关，还能存档下次接着玩。',
    bullets: ['自己写式子 · 字母自动变滑块', '画布可拖动缩放、点一下读坐标', '游戏模式：穿过随机整点过关，可存档'],
  },
];

/** 数学频道 · 动手子频道 */
export default function HandsOnHomeScreen({
  onBack,
  initialView,
}: {
  onBack: () => void;
  /** 从知识点汇总等处进入时，直接打开「画图」 */
  initialView?: Exclude<ViewKey, 'home'>;
}) {
  const [view, setView] = useState<ViewKey>(initialView ?? 'home');
  const insets = useSafeAreaInsets();

  // 被外部直接打开「画图」时（比如从知识点汇总点进来），返回就直接离开本页
  if (view === 'draw') {
    return <PlaygroundScreen onBack={initialView ? onBack : () => setView('home')} />;
  }

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <Pressable style={styles.backBtn} onPress={onBack} accessibilityRole="button">
          <Ionicons name="chevron-back" size={18} color={colors.inkSoft} />
          <Text style={styles.backText}>返回</Text>
        </Pressable>
        <Text style={styles.title}>动手</Text>
        <Text style={styles.subtitle}>动手写一写、画一画，把式子变成看得见的东西</Text>
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
