import { useEffect, useRef, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme';
import {
  ASSISTANT_SITES,
  resetAssistantWebview,
  setAssistantOn,
  setAssistantSite,
  siteByKey,
  useAssistant,
  type SiteKey,
} from '../assistant/assistantStore';

/**
 * 问答助手设置：开 / 关悬浮球、选打开哪个站点、清理重置网页。
 * 两个入口：「关于」页右上角的齿轮；长按悬浮球小猫 → 气泡里的「设置页」链接。
 *
 * ⚠️ 它在 App.tsx 里是**全局覆盖层**（不在学科分支内），否则从化学 / 数学页
 *    点气泡里的链接会没反应。改动路由时别把它挪回首页分支。
 *
 * ⚠️ 这里列出的站点都是**第三方网页**，所以说明文字务必写清：
 *    要自己登录、提问内容归对方处理、本应用不保存 —— 别让用户以为这是我们自己做的 AI。
 */
export default function AssistantSettingsScreen({ onBack }: { onBack: () => void }) {
  const insets = useSafeAreaInsets();
  const { on, site, loaded } = useAssistant();
  const [resetDone, setResetDone] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );

  const pickSite = (k: SiteKey) => {
    setAssistantSite(k);
    // 换站点要连网页一起重置 —— 否则上一家的登录状态还留在同一个 WebView 里
    resetAssistantWebview();
  };

  const doReset = () => {
    resetAssistantWebview();
    setResetDone(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setResetDone(false), 2800);
  };

  const current = siteByKey(site);

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <Pressable style={styles.backBtn} onPress={onBack} accessibilityRole="button">
          <Ionicons name="chevron-back" size={18} color={colors.inkSoft} />
          <Text style={styles.backText}>返回</Text>
        </Pressable>
        <Text style={styles.title}>问答助手设置</Text>
        <Text style={styles.subtitle}>右下角那只小猫 · 长按它会开口说话</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <View style={styles.hero}>
          <Image
            source={require('../../assets/cat-idle.png')}
            style={styles.heroCat}
            resizeMode="contain"
          />
          <View style={styles.heroCol}>
            <Text style={styles.heroTitle}>它会在各页面右下角等你</Text>
            <Text style={styles.heroBody}>
              点一下打开你在下面选的那个网站，拖动可以挪位置。网站是第三方提供的，
              要自己登录、自己提问。
            </Text>
          </View>
        </View>

        {/* 开关 */}
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={styles.col}>
              <Text style={styles.cardTitle}>显示悬浮球</Text>
              <Text style={styles.cardBody}>关掉后小猫不再出现，随时可以再打开。</Text>
            </View>
            <Switch
              value={loaded && on}
              onValueChange={setAssistantOn}
              accessibilityLabel="开启或关闭问答助手悬浮球"
            />
          </View>
        </View>

        {/* 站点选择 */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>打开哪个网站</Text>
          <View style={styles.sites}>
            {ASSISTANT_SITES.map((s) => {
              const active = s.key === site;
              return (
                <Pressable
                  key={s.key}
                  style={[styles.siteRow, active && styles.siteRowActive]}
                  onPress={() => pickSite(s.key)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={`切换到${s.name}`}
                >
                  <View style={[styles.radio, active && styles.radioActive]}>
                    {active ? <View style={styles.radioDot} /> : null}
                  </View>
                  <View style={styles.col}>
                    <Text style={styles.siteName}>{s.name}</Text>
                    <Text style={styles.siteDesc}>{s.desc}</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
          <Text style={styles.hint}>当前：{current.url}</Text>
        </View>

        {/* 清理重置 */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>网页清理</Text>
          <Text style={styles.cardBody}>
            网页卡住、想换个账号登录、或者想清掉对方网站留下的缓存时用。
            会彻底关闭网页重新打开 —— 你在网站里的登录状态也会一并清掉。
          </Text>
          <Pressable
            style={[styles.resetBtn, resetDone && styles.resetBtnDone]}
            onPress={doReset}
            accessibilityRole="button"
            accessibilityLabel="清理并重置网页"
          >
            <Ionicons
              name={resetDone ? 'checkmark-circle' : 'refresh-outline'}
              size={17}
              color={resetDone ? '#0a7d3a' : colors.inkSoft}
            />
            <Text style={[styles.resetText, resetDone && styles.resetTextDone]}>
              {resetDone ? '已清理，下次打开是全新网页' : '清理并重置网页'}
            </Text>
          </Pressable>
        </View>

        <View style={styles.footCard}>
          <Text style={styles.footText}>
            你在上面那些网站里搜索、提问的内容，由它们各自的隐私政策处理，
            本应用不保存也不上传，也无法看到你的对话。
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    backgroundColor: colors.card,
  },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 2, alignSelf: 'flex-start' },
  backText: { fontSize: 14, color: colors.inkSoft, fontWeight: '600' },
  title: { fontSize: 22, fontWeight: '800', color: colors.ink, marginTop: 6 },
  subtitle: { fontSize: 12.5, color: colors.sub, marginTop: 3 },
  scroll: { padding: 14, paddingBottom: 40 },

  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#fffaf5',
    borderWidth: 1,
    borderColor: '#f5dfc9',
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
  },
  heroCat: { width: 66, height: 66 },
  heroCol: { flex: 1 },
  heroTitle: { fontSize: 14, fontWeight: '800', color: colors.ink, marginBottom: 3 },
  heroBody: { fontSize: 12, lineHeight: 18, color: colors.sub },

  card: {
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.line,
  },
  cardTitle: { fontSize: 15, fontWeight: '800', color: colors.ink },
  cardBody: { fontSize: 12.5, lineHeight: 19, color: colors.sub, marginTop: 5 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  col: { flex: 1 },

  sites: { marginTop: 10, gap: 8 },
  siteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 11,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: '#fff',
  },
  siteRowActive: { borderColor: colors.accent, backgroundColor: '#f4f8ff' },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.faint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioActive: { borderColor: colors.accent },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.accent },
  siteName: { fontSize: 14, fontWeight: '700', color: colors.ink },
  siteDesc: { fontSize: 11.5, color: colors.sub, marginTop: 2 },
  hint: { fontSize: 11, color: colors.faint, marginTop: 9 },

  resetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    marginTop: 11,
    paddingVertical: 10,
    borderRadius: 11,
    backgroundColor: '#f1f4f9',
  },
  resetBtnDone: { backgroundColor: '#e7f7ee' },
  resetText: { fontSize: 13.5, fontWeight: '700', color: colors.inkSoft },
  resetTextDone: { color: '#0a7d3a' },

  footCard: { paddingHorizontal: 4 },
  footText: { fontSize: 11.5, lineHeight: 18, color: colors.faint },
});
