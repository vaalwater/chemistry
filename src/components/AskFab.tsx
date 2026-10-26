import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Image,
  Modal,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme';
import {
  setAssistantNoticed,
  setAssistantOn,
  setFabPos,
  siteByKey,
  useAssistant,
} from '../assistant/assistantStore';
import AskChatModal from './AskChatModal';

const FAB = 62;
const EDGE = 16;
/** 底部导航条 56pt + 安全区，小球要待在它上面，别压住「反应 / 动手」这些 tab */
const ABOVE_TABS = 68;

const CAT_IDLE = require('../../assets/cat-idle.png');
const CAT_SLEEP = require('../../assets/cat-sleep.png');

/**
 * 全站悬浮问答入口：右下角一只猫，常驻、**可拖动**。
 *
 * ⚠️ 首次点击**不能直接弹网页** —— 那等于把用户扔进一个没听说过的第三方站点。
 *    必须先说清「打开的是第三方网站、要不要登录、去哪儿关掉」，给一个明确的选择。
 * ⚠️ 位置存的是**吸附后的边缘 + 纵向比例**，不是像素 ——
 *    换设备、转屏之后像素坐标就对不上了，比例还能落在差不多的高度。
 *
 * 后续闯关游戏的气泡提示也挂在这只猫身上（气泡从这里往上冒），所以它的
 * 位置 / 拖拽 / 动画逻辑要保持独立，别塞进具体某一个业务。
 */
export default function AskFab({ onOpenSettings }: { onOpenSettings?: () => void }) {
  const insets = useSafeAreaInsets();
  const { width: W, height: H } = Dimensions.get('window');
  const { on, noticed, loaded, pos: savedPos, site } = useAssistant();

  const [chatAlive, setChatAlive] = useState(false); // 是否有会话（哪怕已最小化）
  const [chatVisible, setChatVisible] = useState(false);
  const [intro, setIntro] = useState(false);
  // 长按弹出的「小猫说话」气泡
  const [bubble, setBubble] = useState(false);
  // 小猫吸附在哪一侧 —— 气泡要挂在它的另一侧，尖角才对得上猫
  const [side, setSide] = useState<'left' | 'right'>('right');
  const bubbleAnim = useRef(new Animated.Value(0)).current;
  const lpTimer = useRef<ReturnType<typeof setTimeout> | null>(null); // 长按计时
  const lpFired = useRef(false); // 这次触摸已经判成长按了，松手时别再当点击

  const cancelLongPress = () => {
    if (lpTimer.current) {
      clearTimeout(lpTimer.current);
      lpTimer.current = null;
    }
  };

  useEffect(() => cancelLongPress, []);

  // 气泡弹出：轻微弹一下，像猫凑过来说话；收起直接归零
  useEffect(() => {
    if (!bubble) {
      bubbleAnim.setValue(0);
      return;
    }
    Animated.spring(bubbleAnim, {
      toValue: 1,
      tension: 190,
      friction: 9,
      useNativeDriver: true,
    }).start();
  }, [bubble, bubbleAnim]);

  // 说完自己收起来，别一直挡着页面
  useEffect(() => {
    if (!bubble) return;
    const t = setTimeout(() => setBubble(false), 8000);
    return () => clearTimeout(t);
  }, [bubble]);

  const clampY = (y: number) => {
    const minY = insets.top + 50; // 别盖住顶部的返回 / 标题
    const maxY = H - insets.bottom - ABOVE_TABS - FAB; // 别掉进底部导航条
    return Math.max(minY, Math.min(maxY, y));
  };

  const defaultXY = () => ({ x: W - EDGE - FAB, y: clampY(H - insets.bottom - ABOVE_TABS - FAB) });

  const pos = useRef(new Animated.ValueXY(defaultXY())).current;
  const base = useRef(defaultXY()); // 本次拖动开始时的位置
  const cur = useRef(defaultXY()); // 当前位置（拖动中实时更新）
  const placed = useRef(false);

  /** 眨眼：大部分时间是睁眼的 idle，隔几秒翻一下闭眼帧，其余靠底部投影撑立体感 */
  const blink = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const loop = () => {
      timer = setTimeout(
        () => {
          if (stopped) return;
          Animated.sequence([
            Animated.timing(blink, { toValue: 1, duration: 90, useNativeDriver: true }),
            Animated.delay(70),
            Animated.timing(blink, { toValue: 0, duration: 130, useNativeDriver: true }),
          ]).start(() => {
            if (!stopped) loop();
          });
        },
        2600 + Math.random() * 4200
      );
    };
    loop();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [blink]);

  // 读到本地存的位置后，把小球放到用户上次拖到的地方（只放一次）
  useEffect(() => {
    if (!loaded || placed.current) return;
    placed.current = true;
    const p = savedPos
      ? { x: savedPos.side === 'right' ? W - EDGE - FAB : EDGE, y: clampY(savedPos.yRatio * H) }
      : defaultXY();
    cur.current = p;
    setSide(savedPos ? savedPos.side : 'right');
    pos.setValue(p);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);

  /** 松手后贴到最近的左 / 右边缘，并限制上下范围 */
  const settle = (c: { x: number; y: number }) => {
    const s = c.x + FAB / 2 > W / 2 ? ('right' as const) : ('left' as const);
    const to = { x: s === 'right' ? W - EDGE - FAB : EDGE, y: clampY(c.y) };
    cur.current = to;
    setSide(s); // 气泡要挂到猫的另一侧
    Animated.spring(pos, { toValue: to, useNativeDriver: false }).start();
    setFabPos({ side: s, yRatio: to.y / H });
  };

  const onPress = () => {
    // 气泡开着的时候点猫 = 收起气泡。不拦这一下的话，想关气泡很容易变成打开网页
    if (bubble) {
      setBubble(false);
      return;
    }
    // 已经有会话（哪怕是最小化状态）就原样恢复，不重新加载页面
    if (chatAlive) {
      setChatVisible(true);
      return;
    }
    if (!noticed) {
      setIntro(true);
      return;
    }
    setChatAlive(true);
    setChatVisible(true);
  };

  const pan = useMemo(
    () =>
      PanResponder.create({
        // 接管触摸，才能区分「点一下」和「拖一段」
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          base.current = { ...cur.current };
          pos.setOffset(base.current);
          pos.setValue({ x: 0, y: 0 });
          lpFired.current = false;
          cancelLongPress();
          // 按住不动 480ms → 猫开口说话（松手后气泡留着，否则内容一闪就没了）
          lpTimer.current = setTimeout(() => {
            lpFired.current = true;
            setBubble(true);
          }, 480);
        },
        onPanResponderMove: (_e, gs) => {
          const dist = Math.abs(gs.dx) + Math.abs(gs.dy);
          if (dist > 8) {
            // 一动就是想拖位置，不是长按
            cancelLongPress();
            if (lpFired.current) {
              lpFired.current = false;
              setBubble(false);
            }
          }
          cur.current = { x: base.current.x + gs.dx, y: base.current.y + gs.dy };
          pos.setValue({ x: gs.dx, y: gs.dy });
        },
        onPanResponderRelease: (_e, gs) => {
          cancelLongPress();
          pos.flattenOffset();
          // 长按已经算处理过了：松手不再当点击，让气泡继续显示
          if (lpFired.current) {
            lpFired.current = false;
            return;
          }
          // 位移很小 → 当成点击，不当成拖动
          if (Math.abs(gs.dx) + Math.abs(gs.dy) < 8) {
            onPress();
            return;
          }
          settle(cur.current);
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [insets.top, insets.bottom, W, H, chatAlive, noticed, bubble]
  );

  const accept = async () => {
    await setAssistantNoticed(true);
    setIntro(false);
    setChatAlive(true);
    setChatVisible(true);
  };

  const decline = async () => {
    await setAssistantOn(false);
    setIntro(false);
  };

  // 本地值没读出来前不渲染，否则关掉过的用户每次开 App 都会看到小球闪一下
  if (!loaded || !on) return null;

  // 气泡宽度：有上限，也不能顶到屏幕另一边（猫拖到边上时气泡会不够放）
  const bubbleW = Math.min(232, W - FAB - 44);

  const currentSite = siteByKey(site);

  return (
    <>
      <Animated.View
        style={[styles.fab, { transform: pos.getTranslateTransform() }]}
        {...pan.panHandlers}
        accessibilityRole="button"
        accessibilityLabel="打开问答助手"
      >
        {/* 地面投影：让猫看起来是「坐」在屏幕上而不是贴纸 */}
        <View style={styles.groundShadow} />
        <View style={styles.disc}>
          <Image source={CAT_IDLE} style={styles.cat} resizeMode="contain" />
          <Animated.Image
            source={CAT_SLEEP}
            style={[styles.cat, styles.catOverlay, { opacity: blink }]}
            resizeMode="contain"
          />
        </View>
        {/* 会话最小化着：右上角一个小点，提示「点它还能回去」 */}
        {chatAlive && !chatVisible ? <View style={styles.dot} /> : null}
      </Animated.View>

      {/*
        长按弹出的「小猫说话」气泡。
        ⚠️ 它是**独立一层**，不是 fab 的子节点 —— fab 上挂着拖动用的 PanResponder，
           气泡放进那里面，点「设置页」时这次触摸会被 PanResponder 抢走。
           位置沿用猫的 transform，所以拖动时气泡也跟着猫走。
      */}
      {bubble ? (
        <Animated.View
          style={[styles.bubbleLayer, { transform: pos.getTranslateTransform() }]}
          pointerEvents="box-none"
        >
          <Animated.View
            style={[
              styles.bubble,
              side === 'right' ? styles.bubbleAtRight : styles.bubbleAtLeft,
              { width: bubbleW },
              {
                opacity: bubbleAnim,
                transform: [
                  { scale: bubbleAnim },
                  {
                    translateY: bubbleAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [8, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            {/* 尖角指向猫 —— 让它看起来是猫在说话，方向随猫在哪一侧翻转 */}
            <View style={side === 'right' ? styles.tailRight : styles.tailLeft} />
            <View style={styles.bubbleRow}>
              <Text style={styles.bubbleText}>
                你好，我是问答助手，你可以点击我快速进行联网搜索，进一步了解相关知识点。关闭或修改可在
                <Text
                  style={styles.bubbleLink}
                  onPress={() => {
                    setBubble(false);
                    onOpenSettings?.();
                  }}
                >
                  设置页
                </Text>
                完成
              </Text>
              <Pressable
                onPress={() => setBubble(false)}
                hitSlop={6}
                accessibilityRole="button"
                accessibilityLabel="关闭提示"
              >
                <Ionicons name="close-circle" size={16} color="rgba(15,23,42,0.32)" />
              </Pressable>
            </View>
          </Animated.View>
        </Animated.View>
      ) : null}

      {/* 首次点击的说明：说清是谁提供服务、要不要登录、去哪儿改设置 */}
      <Modal visible={intro} transparent animationType="fade" onRequestClose={decline}>
        <Pressable style={styles.mask} onPress={decline}>
          <View style={styles.sheet}>
            <View style={styles.sheetHead}>
              <Ionicons name="globe-outline" size={18} color={colors.accent} />
              <Text style={styles.sheetTitle}>打开的是第三方网站</Text>
            </View>
            <Text style={styles.sheetBody}>
              点它会在这个 App 里打开 <Text style={styles.strong}>{currentSite.name}</Text>
              （{currentSite.url}），和用浏览器打开一样 —— 需要登录的站要你自己登录。
            </Text>
            <View style={styles.bullets}>
              <Text style={styles.bullet}>· 搜索和提问的内容由这些网站按各自的隐私政策处理</Text>
              <Text style={styles.bullet}>· 本应用不保存、不上传，也看不到你在里面的对话</Text>
              <Text style={styles.bullet}>· 小猫可拖动位置，松手会自动贴到左 / 右边缘</Text>
              <Text style={styles.bullet}>· 换网站或关掉它：「关于」页右上角的齿轮</Text>
            </View>
            <View style={styles.btnRow}>
              <Pressable style={styles.btnGhost} onPress={decline} accessibilityRole="button">
                <Text style={styles.btnGhostText}>暂不需要</Text>
              </Pressable>
              <Pressable style={styles.btnPrimary} onPress={accept} accessibilityRole="button">
                <Text style={styles.btnPrimaryText}>打开</Text>
              </Pressable>
            </View>
          </View>
        </Pressable>
      </Modal>

      <AskChatModal
        alive={chatAlive}
        visible={chatVisible}
        onMinimize={() => setChatVisible(false)}
        onClose={() => {
          setChatVisible(false);
          setChatAlive(false);
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  // 位置由 transform 控制（top/left 恒为 0），拖动时只改 transform，性能好
  fab: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: FAB,
    height: FAB,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // 脚下的椭圆投影 —— 立体感主要靠它，而不是加大 box-shadow
  groundShadow: {
    position: 'absolute',
    bottom: 2,
    width: 38,
    height: 9,
    borderRadius: 5,
    backgroundColor: 'rgba(15,23,42,0.18)',
  },
  // 白色底盘：把猫和页面内容隔开，同时承接高光与阴影
  disc: {
    width: FAB - 2,
    height: FAB - 2,
    borderRadius: (FAB - 2) / 2,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.95)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0f172a',
    shadowOpacity: 0.24,
    shadowRadius: 9,
    shadowOffset: { width: 0, height: 4 },
    elevation: 7,
  },
  cat: { width: 46, height: 51 },
  catOverlay: { position: 'absolute' },
  dot: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#34c759',
    borderWidth: 1.5,
    borderColor: '#fff',
  },
  // 气泡层：跟猫同尺寸同位置（transform 共用），这样拖动时气泡跟着猫
  bubbleLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: FAB,
    height: FAB,
    zIndex: 20,
  },
  // 圆润白泡泡 + 暖色细边，跟猫的调子一致
  bubble: {
    position: 'absolute',
    bottom: 4,
    borderRadius: 18,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: 'rgba(255,214,170,0.95)',
    paddingHorizontal: 13,
    paddingVertical: 11,
    shadowColor: '#0f172a',
    shadowOpacity: 0.16,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  // 猫在右边 → 气泡挂在它左侧
  bubbleAtRight: { right: FAB - 4 },
  bubbleAtLeft: { left: FAB - 4 },
  // 尖角：纯 CSS 三角，颜色跟气泡底色一致才连得起来
  tailRight: {
    position: 'absolute',
    right: -7,
    bottom: 16,
    width: 0,
    height: 0,
    borderTopWidth: 7,
    borderBottomWidth: 7,
    borderLeftWidth: 8,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderLeftColor: '#fff',
  },
  tailLeft: {
    position: 'absolute',
    left: -7,
    bottom: 16,
    width: 0,
    height: 0,
    borderTopWidth: 7,
    borderBottomWidth: 7,
    borderRightWidth: 8,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderRightColor: '#fff',
  },
  bubbleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 7 },
  bubbleText: { flex: 1, fontSize: 13, lineHeight: 19.5, color: colors.ink },
  bubbleLink: {
    color: colors.accent,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  mask: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.42)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 26,
  },
  sheet: {
    width: '100%',
    backgroundColor: colors.card,
    borderRadius: 18,
    padding: 18,
  },
  sheetHead: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 10 },
  sheetTitle: { fontSize: 16, fontWeight: '800', color: colors.ink },
  sheetBody: { fontSize: 13.5, lineHeight: 21, color: colors.inkSoft },
  strong: { fontWeight: '800', color: colors.ink },
  bullets: { marginTop: 10, gap: 5 },
  bullet: { fontSize: 12.5, lineHeight: 19, color: colors.sub },
  btnRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
  btnGhost: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: '#f1f4f9',
  },
  btnGhostText: { fontSize: 14, fontWeight: '700', color: colors.sub },
  btnPrimary: {
    flex: 0.9,
    paddingVertical: 11,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: colors.accent,
  },
  btnPrimaryText: { fontSize: 14, fontWeight: '700', color: '#fff' },
});
