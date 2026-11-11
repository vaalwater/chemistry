import { createContext, useCallback, useContext, useEffect, useRef, type ReactNode } from 'react';
import { Animated, PanResponder, StyleSheet, View, type GestureResponderEvent } from 'react-native';
import { colors } from '../theme';

/**
 * 左边缘右划返回上一页。
 *
 * 本项目没有 react-navigation，整站路由是 App.tsx 里的一堆 useState。
 * 所以“返回”没有统一栈，而是每个深层页面各自拿着一个 onBack / onClose 回调
 * （语义和页面左上角的「返回」按钮完全一致）。
 *
 * 这里提供一套轻量、零依赖（只用 RN 核心的 PanResponder）的机制：
 *   - `SwipeBackProvider` 在根节点包一层，监听从左边缘起手、向右拖动的手势，
 *     松手时按位移 / 速度阈值决定要不要“返回”，并带动页面整体右滑（iOS 风格）。
 *   - `useSwipeBack(handler)`：每个有「返回」按钮的页面调用一次，把自己的
 *     onBack 注册进提供者；同一时刻只有“当前最上层”的页面生效
 *     （用栈实现，覆盖层 / 二级实验室都能正确压栈）。
 *   - `SwipeEdge`：WebView 类全屏页（化学 3D / 半径比实验）原生的 WebView
 *     会吞掉触摸，外层 PanResponder 收不到手势。这个透明左侧热区只负责
 *     在 WebView 之上“探测”左边缘右划，探测到后复用同一套 translateX 让整页右滑。
 *
 * ⚠️ 感应区用「异形」：屏幕上下区域宽、中间（画布主体）窄。分子 / 原子 / 电磁学等
 *    页面靠「拖动改角度」，而从左边缘水平右划既是返回手势、也是画布旋转手势，方向
 *    本身无法区分。于是中间段只留最贴边 8px，常规旋转拖动（起手点在画布内部）都不会
 *    进返回手势；上下段放宽到 20px，让用户在导航 / 信息区更顺手起手返回。
 *    左上角始终有「‹ 返回」按钮兜底。
 *
 * ⚠️ 判断「起手点是否在左边缘」不能用 gestureState.x0：RN 在
 *    onMoveShouldSetPanResponder 阶段还没给它赋值（恒为 0，要到 grant 才写），
 *    那样写等于没有边缘限制，整个页面任何位置右划都会后退。见 startXOf。
 */

type BackHandler = (() => void) | null;

interface SwipeBackApi {
  /** 注册当前页的返回回调，返回值是卸载时清理用的函数 */
  register: (handler: BackHandler) => () => void;
  /** 整页右滑用的共享动画值（提供者滑动容器与 SwipeEdge 共用一个，保证视觉一致） */
  translateX: Animated.Value;
}

const SwipeBackContext = createContext<SwipeBackApi | null>(null);

/**
 * 异形左边缘热区：屏幕上下区域宽（EDGE_WIDE）、中间画布主体窄（EDGE_NARROW）。
 * 画布（分子 / 原子 / 3D 化学）靠「拖动改角度」，中间窄条只留最贴边一小条，
 * 常规旋转拖动（起手点远在画布内部）都不会进入返回手势；上下区域放宽到 20px，
 * 让用户在导航 / 信息区更顺手地起手返回。
 */
const EDGE_WIDE = 27;
/** 中间（画布主体）命中宽度，保持窄以保护旋转手势 */
const EDGE_NARROW = 15;
/** 顶部 / 底部热区各占屏幕高度的比例，中间段占 1 − 2×EDGE_ZONE */
const EDGE_ZONE = 0.28;
/** 起手后至少水平移动这么多才认作返回手势 */
const START_DX = 12;
/** 纵向漂移上限：旋转画布常带上下分量，纯水平右划才是返回 */
const MAX_DY = 18;
const AXIS_RATIO = 1.5;
/** 触发返回的横向位移阈值（px）：比原来更长，慢速长拖不再轻易触发 */
const TRIGGER_DISTANCE = 80;
/** 触发返回的横向速度阈值（px/ms）：快速一划仍可短距离返回 */
const TRIGGER_VELOCITY = 0.65;

/** PanResponder 手势状态里用到的字段（结构类型，不依赖 RN 的类型导出） */
type Gesture = { dx: number; dy: number; vx: number };

/** responder 事件带有 touchHistory，但公开类型没声明，这里补一个只读结构 */
type ResponderEvent = GestureResponderEvent & {
  touchHistory?: {
    touchBank?: Array<{ touchActive?: boolean; startPageX?: number } | undefined>;
  };
};

/**
 * 真实起手点的屏幕 x。
 *
 * ⚠️ 千万别用 g.x0 判边缘：PanResponder 源码里 gestureState.x0 初始为 0，
 *    直到 onResponderGrant 才被写成质心坐标；而 onMoveShouldSetPanResponder
 *    发生在 grant 之前，此时 x0 恒为 0。「g.x0 <= EDGE_WIDTH」因此恒为真，
 *    表现就是整个页面任意位置右划都会触发后退。
 *    这里优先取 RN 自己记录的 touchHistory.touchBank[].startPageX，
 *    取不到时用「当前 pageX − 累计位移 dx」反推起手点。
 */
function startXOf(e: GestureResponderEvent, g: Gesture): number {
  const bank = (e as ResponderEvent).touchHistory?.touchBank;
  if (Array.isArray(bank)) {
    for (const t of bank) {
      if (t?.touchActive && typeof t.startPageX === 'number') return t.startPageX;
    }
  }
  return e.nativeEvent.pageX - g.dx;
}

/** 起手判定：贴边 + 明显水平右划；斜向旋转不会被误判 */
function isBackSwipeStart(x0: number, g: Gesture, width: number): boolean {
  return x0 <= width
    && g.dx > START_DX
    && Math.abs(g.dy) < MAX_DY
    && Math.abs(g.dx) > Math.abs(g.dy) * AXIS_RATIO;
}
/** 松手判定：拖得够远、或划得够快；两者都要求整体仍在向右 */
function shouldGoBack(g: Gesture): boolean {
  return g.dx > 0 && (g.dx > TRIGGER_DISTANCE || g.vx > TRIGGER_VELOCITY);
}

/**
 * 生成一套「左边缘右划」PanResponder。width 是该段热区的命中宽度：
 * 同一份手势逻辑，只是上下段用 EDGE_WIDE、中间段用 EDGE_NARROW。
 * getCurrent 取当前生效的返回回调（栈顶）；取不到就不接管。
 */
function makeEdgePan(
  width: number,
  translateX: Animated.Value,
  getCurrent: () => BackHandler | null
) {
  return PanResponder.create({
    // 落点时不抢手势，交给内部的 ScrollView / Pressable / WebView；只有符合「左边缘右划」时才接管
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: (e, g) =>
      !!getCurrent() && isBackSwipeStart(startXOf(e, g), g, width),
    onPanResponderMove: (_e, g) => {
      if (g.dx >= 0) translateX.setValue(g.dx);
    },
    onPanResponderRelease: (_e, g) => {
      const h = getCurrent();
      if (h && shouldGoBack(g)) finish(translateX, h);
      else reset(translateX);
    },
    onPanResponderTerminate: () => reset(translateX),
    onPanResponderTerminationRequest: () => false,
  });
}

function finish(translateX: Animated.Value, handler: BackHandler) {
  Animated.timing(translateX, {
    toValue: 999,
    duration: 180,
    useNativeDriver: true,
  }).start(() => {
    translateX.setValue(0);
    handler?.();
  });
}

function reset(translateX: Animated.Value) {
  Animated.timing(translateX, {
    toValue: 0,
    duration: 200,
    useNativeDriver: true,
  }).start();
}

export function SwipeBackProvider({ children }: { children: ReactNode }) {
  const stack = useRef<BackHandler[]>([]);
  const translateX = useRef(new Animated.Value(0)).current;

  const register = useCallback((handler: BackHandler) => {
    stack.current.push(handler);
    return () => {
      const idx = stack.current.lastIndexOf(handler);
      if (idx >= 0) stack.current.splice(idx, 1);
    };
  }, []);

  const current = () => stack.current[stack.current.length - 1] ?? null;

  // 异形左边缘热区：同一套手势逻辑，中间窄、上下宽，用不同命中宽度
  const panWide = useRef(makeEdgePan(EDGE_WIDE, translateX, current)).current;
  const panNarrow = useRef(makeEdgePan(EDGE_NARROW, translateX, current)).current;

  return (
    <SwipeBackContext.Provider value={{ register, translateX }}>
      <View style={styles.shell}>
        <Animated.View style={[styles.slide, { transform: [{ translateX }] }]}>
          {children}
        </Animated.View>
        {/* 异形左边缘热区：上下 28% 高、宽 20px；中间 44% 高、宽 8px 避画布旋转。
            物理上触摸落不到这些条上就进不了返回手势判定，即使坐标取值有偏差也不可能全屏触发。 */}
        <View style={[styles.edge, { top: 0, height: `${EDGE_ZONE * 100}%`, width: EDGE_WIDE }]} {...panWide.panHandlers} />
        <View style={[styles.edge, { top: `${EDGE_ZONE * 100}%`, height: `${(1 - 2 * EDGE_ZONE) * 100}%`, width: EDGE_NARROW }]} {...panNarrow.panHandlers} />
        <View style={[styles.edge, { bottom: 0, height: `${EDGE_ZONE * 100}%`, width: EDGE_WIDE }]} {...panWide.panHandlers} />
      </View>
    </SwipeBackContext.Provider>
  );
}

/** 在“有返回按钮”的页面里调用，把自己的 onBack 接进左划手势；handler 为 null 时不接管 */
export function useSwipeBack(handler: BackHandler) {
  const ctx = useContext(SwipeBackContext);
  useEffect(() => {
    if (!ctx || !handler) return;
    return ctx.register(handler);
  }, [ctx, handler]);
}

/** WebView 全屏页用的异形左侧透明热区：只探测左边缘右划，落点（轻点）不拦截，正常透传 */
export function SwipeEdge({ onBack }: { onBack: () => void }) {
  const ctx = useContext(SwipeBackContext);
  const translateX = ctx?.translateX;
  const handlerRef = useRef(onBack);
  handlerRef.current = onBack;
  const tx = translateX ?? new Animated.Value(0);

  useEffect(() => {
    if (!ctx) return;
    return ctx.register(onBack);
  }, [ctx, onBack]);

  const panWide = useRef(makeEdgePan(EDGE_WIDE, tx, () => handlerRef.current)).current;
  const panNarrow = useRef(makeEdgePan(EDGE_NARROW, tx, () => handlerRef.current)).current;

  return (
    <>
      <View style={[styles.edge, { top: 0, height: `${EDGE_ZONE * 100}%`, width: EDGE_WIDE }]} {...panWide.panHandlers} />
      <View style={[styles.edge, { top: `${EDGE_ZONE * 100}%`, height: `${(1 - 2 * EDGE_ZONE) * 100}%`, width: EDGE_NARROW }]} {...panNarrow.panHandlers} />
      <View style={[styles.edge, { bottom: 0, height: `${EDGE_ZONE * 100}%`, width: EDGE_WIDE }]} {...panWide.panHandlers} />
    </>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1, backgroundColor: colors.bg },
  slide: { flex: 1 },
  edge: {
    position: 'absolute',
    left: 0,
    zIndex: 5,
  },
});
