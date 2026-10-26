import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme';

/** 生效日期：改动政策内容时同步改这一行 */
const EFFECTIVE = '2026 年 10 月 24 日';

const sections: { title: string; body: string }[] = [
  {
    title: '一句话版本',
    body: '理科3D视界不收集、不上传、不共享你的任何个人信息。你在这个 App 里做的每一件事，都只发生在这台设备上 —— 唯一的例外是「问答助手」，它会打开你自己在设置里选的第三方网站，那部分由对方处理（见下文）。',
  },
  {
    title: '我们不收集什么',
    body: '本应用没有账号系统，不需要注册或登录，因此我们不收集姓名、手机号、邮箱、通讯录、位置、照片、设备标识符等任何个人信息，也不会向任何服务器发送数据。',
  },
  {
    title: '存在本机的数据',
    body: '会写入本机存储的只有两类：一是数学频道「画图」里你手动保存的函数与关卡进度；二是问答助手的设置（是否显示悬浮球、选择哪个网站）。它们都写在这台设备的本地存储中，不会同步、不会上传。清除应用数据或卸载应用，这些数据即被删除。',
  },
  {
    title: '联网与离线',
    body: '所有教学内容（分子与原子结构、反应动画、3D 场景引擎）均打包在应用内部，打开即用，不需要联网。除「问答助手」外，应用自身不发起任何网络请求，也不加载外部网页或远程脚本。',
  },
  {
    title: '系统权限',
    body: '本应用不申请相机、相册、麦克风、定位、通讯录、通知、蓝牙等任何系统权限，也不读取剪贴板。',
  },
  {
    title: '第三方 SDK',
    body: '本应用未接入任何第三方统计分析、广告、推送或社交登录 SDK。唯一的第三方服务是「问答助手」—— 它以网页形式打开你选择的那个网站，详见下一节。',
  },
  {
    title: '问答助手（第三方网站）',
    body: '「问答助手」是屏幕右下角的悬浮球，点开后会在应用内打开你在设置里选择的网站，目前可选 Bing 搜索（www.bing.com）、DeepSeek（chat.deepseek.com）、豆包（www.doubao.com/chat/），默认为 Bing 搜索。这些网站由各自的公司运营，需要登录的要你自行注册或登录；你在其中的搜索记录、提问内容、对话与登录信息，均由对方按其自身的隐私政策处理，本应用不获取、不保存、不上传这些内容，也看不到你的对话。该功能默认开启，你可以随时关掉悬浮球，并在「关于」页右上角的设置里重新打开、更换网站或清理网页；不使用它时，应用不会与这些网站发生任何通信。',
  },
  {
    title: '关于未成年人',
    body: '本应用面向高中阶段的学科学习，不面向儿童，也不会有意收集儿童的个人信息。未满 14 周岁的用户建议在家长或老师的指导下使用。',
  },
  {
    title: '政策更新',
    body: '若日后功能调整导致数据处理方式发生变化，我们会先在这一页更新政策文本与生效日期，并在应用更新说明中提示。继续使用即视为同意更新后的政策。',
  },
  {
    title: '联系我们',
    body: '如对这份隐私政策有疑问，可通过 App Store 中本应用页面的「开发者 / 支持」信息联系到我们，我们会尽快答复。',
  },
];

/** 隐私政策页：从「关于」页进入，上架应用商店所需 */
export default function PrivacyScreen({ onBack }: { onBack: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <Pressable style={styles.backBtn} onPress={onBack} accessibilityRole="button">
          <Ionicons name="chevron-back" size={18} color={colors.inkSoft} />
          <Text style={styles.backText}>返回</Text>
        </Pressable>
        <Text style={styles.title}>隐私政策</Text>
        <Text style={styles.subtitle}>生效日期：{EFFECTIVE} · 版本 1.2</Text>
      </View>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {sections.map((s) => (
          <View key={s.title} style={styles.card}>
            <Text style={styles.cardTitle}>{s.title}</Text>
            <Text style={styles.cardBody}>{s.body}</Text>
          </View>
        ))}
        <Text style={styles.foot}>
          本页内容即为提交应用商店审核所用的隐私政策文本，应用内与对外公示的内容保持一致。
        </Text>
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
  card: { backgroundColor: colors.card, borderRadius: 18, padding: 16, marginBottom: 12 },
  cardTitle: { fontSize: 15, fontWeight: '800', color: colors.ink },
  cardBody: { fontSize: 13, lineHeight: 21, color: colors.sub, marginTop: 8 },
  foot: { fontSize: 12, lineHeight: 19, color: colors.faint, textAlign: 'center', paddingHorizontal: 18 },
});
