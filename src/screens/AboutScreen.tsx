import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme';

const sections: { title: string; body: string }[] = [
  {
    title: '这款 App 是什么',
    body: '面向高中化学学习的 3D 交互应用：分子/离子空间结构、原子电子层结构（原子核包含质子与中子）、以及常见化学反应方程式的 3D 动画演示。',
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

export default function AboutScreen() {
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.container}>
      {/* 不做沉浸式：内容从状态栏（时间/信号）下方开始 */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <Text style={styles.title}>关于</Text>
        <Text style={styles.subtitle}>高中化学 · 3D 分子课堂</Text>
      </View>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {sections.map((s) => (
          <View key={s.title} style={styles.card}>
            <Text style={styles.cardTitle}>{s.title}</Text>
            <Text style={styles.cardBody}>{s.body}</Text>
          </View>
        ))}
        <View style={{ height: 24 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 8 },
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
});
