import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import type WebViewType from 'react-native-webview';
import { colors } from '../theme';
import { siteByKey, useAssistant } from '../assistant/assistantStore';
import { clearSiteData } from '../assistant/siteDataCleaner';
import { fillInputScript } from '../assistant/fillInputScript';
import { AskVoiceButton } from './AskVoiceButton';

const SCREEN_H = Dimensions.get('window').height;

// 用 iPhone 的 UA，让站点返回手机版页面（桌面版在手机上要横向缩放，没法用）
const IOS_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

/**
 * 问答网页：直接内嵌用户在设置里选的那个站点，登录和问答都由用户自己在页面上完成。
 *
 * ⚠️ 这里**不用 RN 的 Modal** —— Modal 的 `visible={false}` 会卸载整棵子树，
 *    那样「最小化」就等于「关闭」，会话直接没了。
 *    所以自己用一层全屏浮层，隐藏时只是把它移出屏幕。
 *
 * ⚠️ 隐藏时也**不能用 `display:'none'`**：那样 iOS 会把网页进程回收掉，
 *    再显示回来就是一片空白（真机上实测如此）。现在靠「移出屏幕 + 不卸载视图」尽量保住，
 *    并在**每次恢复时主动 reload 兜底** —— 万一进程已被回收，至少不会白屏。
 *    DeepSeek 的登录态与对话记录都在服务端，reload 之后仍然在，代价只是页面重新加载一次。
 *
 * ⚠️ 关闭按钮必须做大做显眼，而且要常驻顶栏。
 *    这是**第三方网页**（不是我们自己的页面），一旦用户找不到出口，
 *    就会以为整个 App 卡死 —— 那比没有这个功能糟糕得多。
 */
export default function AskChatModal({
  alive,
  visible,
  onMinimize,
  onClose,
}: {
  /** 是否存在一个会话（哪怕已最小化）。false 时整个组件不渲染 */
  alive: boolean;
  /** 当前是否显示 */
  visible: boolean;
  /** 最小化：收起但保留会话，之后点悬浮球可以原样回来 */
  onMinimize: () => void;
  /** 关闭：结束会话，下次打开是全新页面 */
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  // 站点由用户在设置里选；换站点或点「清理重置网页」时两者之一会变，
  // key 一变 React 就卸载重建网页实例
  const { site, resetSeq } = useAssistant();
  const current = siteByKey(site);
  // 真正用来当 key 的是这个 state：必须**等清除完成**才改，
  // 否则新实例会带着还在删的旧 cookie 去发请求，等于没清干净
  const [webKey, setWebKey] = useState(resetSeq);
  // 语音输入的两处反馈：一句提示语，以及塞不进网页时留给用户长按复制的文字
  const [voiceNote, setVoiceNote] = useState<{ text: string; copyable?: string } | null>(null);
  const [loaded, setLoaded] = useState(false);
  const ty = useRef(new Animated.Value(visible ? 0 : SCREEN_H)).current;
  const webRef = useRef<WebViewType>(null);
  const shownOnce = useRef(false);
  const pong = useRef(false); // 探活时页面有没有回应
  // 最近一次识别出的文字：网页回话说没填进去时，要原样拿给用户复制
  const lastVoiceText = useRef('');

  useEffect(() => {
    Animated.timing(ty, {
      toValue: visible ? 0 : SCREEN_H,
      duration: visible ? 260 : 220,
      useNativeDriver: true,
    }).start();
  }, [visible, ty]);

  // 用户点了「清理重置网页」/换了站点：先按域名把这个站点的 cookie 与本地存储删干净，
  // 再换 key 重建网页实例。**顺序不能反** —— 先重建的话页面会立刻带着旧登录态发请求。
  // 只清当前这一个站点，教学用的 3D 引擎那个 WebView 完全不受影响。
  useEffect(() => {
    if (resetSeq === webKey) return;
    let cancelled = false;
    (async () => {
      await clearSiteData(current.url);
      if (!cancelled) setWebKey(resetSeq);
    })();
    return () => {
      cancelled = true;
    };
  }, [resetSeq, webKey, current.url]);

  // 从最小化恢复时，先探一下页面还活着没有：
  //   · 活着 → 什么都不做，原样回到刚才那页（草稿也还在）
  //   · 没回应 → 说明网页进程已被回收，刷新一次，至少不是一片空白
  // 首次打开不探（本来就在加载）。
  useEffect(() => {
    if (!visible) return;
    if (!shownOnce.current) {
      shownOnce.current = true;
      return;
    }
    pong.current = false;
    // 加 typeof 保护：Web 端 react-native-webview 是 dummy 实现，没有这些方法，直接调会抛错
    const t1 = setTimeout(() => {
      const w = webRef.current as unknown as { injectJavaScript?: (s: string) => void } | null;
      if (typeof w?.injectJavaScript === 'function') {
        w.injectJavaScript(
          "(function(){try{window.ReactNativeWebView.postMessage('__fab_pong__')}catch(e){}})();"
        );
      }
    }, 220);
    const t2 = setTimeout(() => {
      const w = webRef.current as unknown as { reload?: () => void } | null;
      if (!pong.current && typeof w?.reload === 'function') w.reload();
    }, 1200);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [visible]);

  // 语音结果提示：成功的只闪一下，失败的留久一点（用户要抄走那段字）
  useEffect(() => {
    if (!voiceNote) return;
    const t = setTimeout(() => setVoiceNote(null), voiceNote.copyable ? 12000 : 2200);
    return () => clearTimeout(t);
  }, [voiceNote]);

  /*
   * 语音识别出的文字 → 塞进网页输入框。
   * ⚠️ 注入**调用成功**不等于**填进去了**（网页里可能压根没找到输入框），
   *    真正的成败由网页 postMessage 回执决定，见下面 onMessage 里的处理。
   *    Web 端没有 injectJavaScript，直接走「给你文字自己复制」这条路。
   */
  const handleVoiceText = (text: string) => {
    const w = webRef.current as unknown as { injectJavaScript?: (s: string) => void } | null;
    if (typeof w?.injectJavaScript === 'function') {
      w.injectJavaScript(fillInputScript(text));
      lastVoiceText.current = text;
      return;
    }
    setVoiceNote({ text: '当前环境不支持自动填入，长按下面的文字可复制', copyable: text });
  };

  // 会话没建立过就完全不渲染，省得后台挂着一个网页
  if (!alive) return null;

  return (
    <Animated.View
      style={[styles.root, { transform: [{ translateY: ty }] }]}
      pointerEvents={visible ? 'auto' : 'none'}
    >
      <View style={[styles.bar, { paddingTop: insets.top + 6 }]}>
        <View style={styles.barLeft}>
          <Ionicons name="globe-outline" size={15} color={colors.sub} />
          <Text style={styles.barTitle}>{current.name}</Text>
        </View>
        <View style={styles.barRight}>
          {/* 最小化：收起页面但会话还在，点右下角小球可原样回来 */}
          <Pressable
            style={styles.miniBtn}
            onPress={onMinimize}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel="最小化问答，稍后从悬浮球恢复"
          >
            <Ionicons name="remove-outline" size={20} color="#4a5568" />
          </Pressable>
          <Pressable
            style={styles.closeBtn}
            onPress={onClose}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel="关闭问答，返回应用"
          >
            <Ionicons name="close" size={22} color="#fff" />
          </Pressable>
        </View>
      </View>
      {/* 常驻一行说明：这是第三方服务，登录和问答都发生在对方那边 */}
      <View style={styles.noticeBar}>
        <Text style={styles.noticeText} numberOfLines={2}>
          {current.name} · 第三方服务 · 需自行登录 · 你的问答内容由它自己的隐私政策处理，本应用不保存也不上传
        </Text>
      </View>
      <WebView
        // key 一变 → 整个网页实例重建（webKey 会在数据清干净之后才变）
        key={`${site}-${webKey}`}
        ref={webRef}
        style={styles.web}
        source={{ uri: current.url }}
        userAgent={IOS_UA}
        javaScriptEnabled
        domStorageEnabled
        sharedCookiesEnabled
        thirdPartyCookiesEnabled
        originWhitelist={['*']}
        onLoadEnd={() => setLoaded(true)}
        onMessage={(e) => {
          // 只认我们自己发的暗号；页面自己发的消息一律忽略
          const d = e.nativeEvent.data;
          if (d === '__fab_pong__') {
            pong.current = true;
            return;
          }
          if (d === '__voice_ok__') {
            setVoiceNote({ text: '已填入输入框' });
            return;
          }
          // 网页里没找到输入框，或者 insertText 没生效 —— 把原文留给用户复制
          if (d === '__voice_fail__' || d === '__voice_nofield__') {
            setVoiceNote({
              text:
                d === '__voice_nofield__'
                  ? '没找到输入框，长按下面的文字可复制'
                  : '没能自动填入，长按下面的文字可复制',
              copyable: lastVoiceText.current,
            });
          }
        }}
        startInLoadingState
        renderLoading={() => (
          <View style={styles.loading}>
            <ActivityIndicator />
            <Text style={styles.loadingText}>正在打开{current.name}…</Text>
          </View>
        )}
      />
      {/* 语音输入按钮：盖在网页上的右下角，网页没加载完先禁用 */}
      <View
        style={[styles.voiceDock, { bottom: insets.bottom + 14 }]}
        pointerEvents="box-none"
      >
        <AskVoiceButton onText={handleVoiceText} disabled={!loaded} />
      </View>
      {/* 语音结果的提示；塞不进网页时把原文摊在这里，让用户长按复制 */}
      {voiceNote ? (
        <View style={[styles.voiceNote, { bottom: insets.bottom + 74 }]}>
          <View style={styles.voiceNoteBody}>
            <Text style={styles.voiceNoteText}>{voiceNote.text}</Text>
            {voiceNote.copyable ? (
              <Text selectable style={styles.voiceNoteCopy}>
                {voiceNote.copyable}
              </Text>
            ) : null}
          </View>
          <Pressable
            onPress={() => setVoiceNote(null)}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel="关闭提示"
          >
            <Ionicons name="close" size={15} color="rgba(255,255,255,0.75)" />
          </Pressable>
        </View>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    zIndex: 9999,
    backgroundColor: colors.bg,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingBottom: 8,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  barLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  barTitle: { fontSize: 15, fontWeight: '800', color: colors.ink },
  barRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  // 最小化：浅底圆钮，视觉上比关闭轻一档（一个是收起，一个是结束）
  miniBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#e6eaf2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // 关闭：深底圆钮 + 白叉，34pt 见方（配 hitSlop 达到 44pt 可点区）
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#3a4250',
    alignItems: 'center',
    justifyContent: 'center',
  },
  noticeBar: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: '#f4f7fd',
    borderBottomWidth: 1,
    borderBottomColor: '#dde6f4',
  },
  noticeText: { fontSize: 11, lineHeight: 15, color: colors.sub },
  web: { flex: 1 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  loadingText: { fontSize: 12, color: colors.sub },
  // 语音按钮的停靠层：横向铺满、**内容居中**，按钮默认落在底部中线，可左右拖到两侧
  voiceDock: {
    position: 'absolute',
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    alignItems: 'center',
    zIndex: 10,
  },
  // 提示条：左右对称，纵向让开正中的语音按钮（按钮 52pt + 间距）
  voiceNote: {
    position: 'absolute',
    left: 14,
    right: 14,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: 'rgba(24,28,36,0.92)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    zIndex: 11,
  },
  voiceNoteBody: { flex: 1, gap: 5 },
  voiceNoteText: { fontSize: 12, lineHeight: 16, color: '#fff' },
  voiceNoteCopy: { fontSize: 12, lineHeight: 17, color: '#9ec1ff' },
});
