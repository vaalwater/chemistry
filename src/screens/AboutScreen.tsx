import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme';

/** ICP 备案号（国内上架必需，公示在关于页底部），点击跳工信部备案查询 */
const ICP = '京ICP备2022030419号-4A';
const ICP_URL = 'https://beian.miit.gov.cn';

const sections: { title: string; body: string }[] = [
  {
    title: '这款 App 是什么',
    body: '理科3D视界是一款面向高中学习的交互式 App，首页按数学 / 物理 / 化学分成三个学科频道，目前「化学」频道内容最完整：分子 / 离子空间结构、原子电子层结构（原子核包含质子与中子）、以及常见化学反应方程式的 3D 动画演示。',
  },
  {
    title: '交互方式',
    body: '拖动 = 旋转视角；双指（或滚轮）= 缩放；在分子/晶体场景轻点某个原子，可下钻查看该元素的质子-中子-电子分层结构。',
  },
  {
    title: '演示范围',
    body: '内容覆盖初中到高中常见的单质、氧化物、酸碱盐、有机物分子与 NaCl 型离子晶体，共 19 个结构单元与 6 组典型反应（化合、分解、置换、中和、CO₂ 检验等）。',
  },
  {
    title: '关于比例尺',
    body: '出于教学清晰度考虑，原子核大小、电子轨道间距与真实物理尺度不成比例（真实原子核仅占原子极小体积）。电子分层按 K/L/M/N 壳层简化示意。',
  },
  {
    title: '打包为 iOS App',
    body: '本工程为 Expo (React Native) 跨平台代码。在装有 Xcode 的 Mac 上：npm install → npx expo run:ios 即可真机构建；或用 npx expo prebuild 生成原生工程后由 Xcode 打包。3D 引擎在 iOS 上通过 WKWebView 运行同一套 three.js 场景。',
  },
  {
    title: '免责声明',
    body: '本应用仅用于辅助理解与预习复习，内容以人教版高中化学教材表述为参考。若与教材存在出入，请以教材和老师讲解为准。',
  },
];

export default function AboutScreen({
  onBack,
  onOpenPrivacy,
}: {
  onBack: () => void;
  onOpenPrivacy: () => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.container}>
      {/* 不做沉浸式：内容从状态栏（时间/信号）下方开始 */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <Pressable style={styles.backBtn} onPress={onBack} accessibilityRole="button">
          <Ionicons name="chevron-back" size={18} color={colors.inkSoft} />
          <Text style={styles.backText}>返回</Text>
        </Pressable>
        <Text style={styles.title}>关于</Text>
        <Text style={styles.subtitle}>理科3D视界 · 数学 / 物理 / 化学</Text>
      </View>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {sections.map((s) => (
          <View key={s.title} style={styles.card}>
            <Text style={styles.cardTitle}>{s.title}</Text>
            <Text style={styles.cardBody}>{s.body}</Text>
          </View>
        ))}
        {/* 上架必需：隐私政策入口 */}
        <Pressable
          style={styles.linkCard}
          onPress={onOpenPrivacy}
          accessibilityRole="button"
          accessibilityLabel="查看隐私政策"
        >
          <Ionicons name="shield-checkmark-outline" size={18} color={colors.accent} />
          <View style={styles.linkTextCol}>
            <Text style={styles.linkTitle}>隐私政策</Text>
            <Text style={styles.linkSub}>我们收集什么、不收集什么，都写在这一页</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.faint} />
        </Pressable>
        {/* 备案信息：点击跳转工信部 ICP/IP 地址/域名信息备案管理系统 */}
        <Pressable
          style={styles.beianRow}
          onPress={() => Linking.openURL(ICP_URL).catch(() => {})}
          accessibilityRole="link"
          accessibilityLabel={`ICP 备案号 ${ICP}，跳转工信部备案查询`}
        >
          <Text style={styles.beianText}>{ICP}</Text>
        </Pressable>
        <View style={{ height: 24 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 8 },
  backBtn: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', marginBottom: 8 },
  backText: { fontSize: 14, color: colors.inkSoft, fontWeight: '600', marginLeft: 2 },
  title: { fontSize: 30, fontWeight: '800', color: colors.ink },
  subtitle: { fontSize: 13, color: colors.sub, marginTop: 6 },
  scroll: { paddingHorizontal: 14, paddingTop: 6 },
  card: {
    backgroundColor: colors.card,
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
  },
  cardTitle: { fontSize: 15, fontWeight: '800', color: colors.ink },
  cardBody: { fontSize: 13, lineHeight: 21, color: colors.sub, marginTop: 8 },
  linkCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
  },
  linkTextCol: { flex: 1, marginLeft: 10 },
  linkTitle: { fontSize: 15, fontWeight: '800', color: colors.ink },
  linkSub: { fontSize: 12, color: colors.sub, marginTop: 3 },
  beianRow: { alignItems: 'center', paddingVertical: 10 },
  beianText: {
    fontSize: 12.5,
    color: colors.sub,
    textDecorationLine: 'underline',
    letterSpacing: 0.3,
  },
});
