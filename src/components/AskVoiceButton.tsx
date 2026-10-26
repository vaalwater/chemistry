import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';
import { colors } from '../theme';

type Props = {
  /** 识别完成（拿到最终文字）时回调，由父组件负责塞进网页输入框 */
  onText: (text: string) => void;
  /** 页面刚加载完时网页还没就绪，先禁用一下，避免注入到空白页 */
  disabled?: boolean;
};

/**
 * 问答页右下角的语音输入按钮。
 *
 * 它只负责"把说的话变成字"，**不关心字去了哪儿** ——
 * 拿到最终文字就交给 onText，由 AskChatModal 注入到网页里的输入框。
 * 这样职责是清楚的：这里管收音，那边管填字。
 *
 * 交互是**按住说话、松手结束**（onPressIn / onPressOut）。
 * 三个容易踩的点：
 * ① `continuous` 必须为 true —— 设 false 的话引擎在你说话停顿处就自己结束了，
 *    话还没说完会话已经断了，松手时什么都拿不到。
 * ② 提交统一放在 end 事件里，不能在 result 回调里就交 ——
 *    边听边交会让网页被填进好几段。end 之后再交，拿到的还是修正过的完整结果。
 * ③ 权限只问一次并缓存（perms），否则每次按住都要等一次异步弹窗，按下不能马上说；
 *    另外弹窗期间用户可能已经松手了，所以拿到权限后要再看一眼 holding。
 * ④ 按下后**延迟 200ms** 才开录，这 200ms 留给「拖动」：手指在这期间挪动就是想挪按钮。
 *    别改回「按下即开录、拖动时再 abort」—— abort 会触发 error 事件，
 *    于是每挪一下按钮就弹一次「识别失败」。判成拖动只需要取消那个待启动的定时器。
 *    同理，已经开录后就不再把手势让给拖动（说话时手指会抖），避免录一半被打断。
 */
export function AskVoiceButton({ onText, disabled }: Props) {
  const [listening, setListening] = useState(false);
  const [partial, setPartial] = useState('');
  const [hint, setHint] = useState('');
  // 一段话可能被回调好几次（中间结果 + 最终结果），只提交一次
  const submitted = useRef(false);
  const pulse = useRef(new Animated.Value(1)).current;
  const hintTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 按住说话：holding = 手指还按着；listeningRef = 引擎真的在听（两者不同步）
  const holding = useRef(false);
  const listeningRef = useRef(false);
  const latest = useRef(''); // 最新一次听到的全部文字
  const perms = useRef<boolean | null>(null); // null = 还没问过权限
  const finishTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 按下后先等 200ms 才开录 —— 这 200ms 是留给「拖动」的（见 pressIn）
  const startTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearFinish = () => {
    if (finishTimer.current) {
      clearTimeout(finishTimer.current);
      finishTimer.current = null;
    }
  };

  /** 把听到的字交出去（只交一次）；没听到就什么都不做 */
  const commit = () => {
    if (submitted.current) return;
    const t = latest.current.trim();
    if (!t) return;
    submitted.current = true;
    onText(t);
  };

  const flash = (msg: string) => {
    setHint(msg);
    if (hintTimer.current) clearTimeout(hintTimer.current);
    hintTimer.current = setTimeout(() => setHint(''), 2600);
  };

  useEffect(
    () => () => {
      if (hintTimer.current) clearTimeout(hintTimer.current);
      clearFinish();
      // 页面关掉时如果还在收音，别把麦克风一直开着
      try {
        ExpoSpeechRecognitionModule.abort();
      } catch {
        /* 本来就没在听 */
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  // 录音中让按钮轻轻呼吸，给用户"我在听"的反馈
  useEffect(() => {
    if (!listening) {
      pulse.stopAnimation();
      pulse.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1.16,
          duration: 520,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 520,
          easing: Easing.in(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [listening, pulse]);

  // 按住期间会反复回调（中间结果），这里只更新显示 + 记住最新文字。
  // 提交统一等「松手」之后 —— 边听边交会让网页里被填进好几段。
  useSpeechRecognitionEvent('result', (e) => {
    const t = e.results?.[0]?.transcript ?? '';
    latest.current = t;
    setPartial(t);
  });

  useSpeechRecognitionEvent('end', () => {
    listeningRef.current = false;
    setListening(false);
    setPartial('');
    clearFinish();
    // 松手后引擎真正停下来才提交：这时拿到的是修正过的完整结果
    commit();
  });

  useSpeechRecognitionEvent('error', (e) => {
    setListening(false);
    setPartial('');
    // 错误码是库定好的一组字面量，按它来分诊：
    // service-not-allowed = 没给权限；no-speech = 没听到；client/unknown 多半是网络不通
    const msg =
      e.error === 'service-not-allowed'
        ? '需要麦克风与语音识别权限'
        : e.error === 'no-speech'
        ? '没听到声音，再说一次'
        : e.error === 'speech-timeout'
        ? '等太久没出结果，再说一次'
        : e.error === 'client' || e.error === 'unknown'
        ? '识别失败，语音识别需要联网'
        : '识别失败了，换个方式输入吧';
    flash(msg);
  });

  /**
   * 按下：**先等 200ms 再开录**。
   * 这 200ms 是留给「拖动」的 —— 手指在这期间挪动就是想挪按钮，不该开始录音。
   * 之前是按下即开录、拖动时再把录音 abort 掉，结果每次挪按钮都弹一次「识别失败」。
   */
  const pressIn = () => {
    if (disabled) return;
    holding.current = true;
    if (startTimer.current) clearTimeout(startTimer.current);
    startTimer.current = setTimeout(() => {
      startTimer.current = null;
      if (!holding.current) return; // 期间松了手，或者已经被判成拖动
      void beginListening();
    }, 200);
  };

  /** 真正开录。权限只在第一次问一次，之后用缓存，做到「按下就能说」 */
  const beginListening = async () => {
    if (perms.current !== true) {
      let ok = false;
      try {
        const p = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
        ok = p.granted;
        perms.current = ok;
      } catch {
        ok = false;
      }
      if (!ok) {
        flash('需要麦克风与语音识别权限');
        holding.current = false;
        return;
      }
      // 系统弹权限框那会儿，用户可能早松手了 —— 那就别开了
      if (!holding.current) return;
    }
    submitted.current = false;
    latest.current = '';
    setPartial('');
    setListening(true);
    listeningRef.current = true;
    try {
      ExpoSpeechRecognitionModule.start({
        lang: 'zh-CN',
        interimResults: true, // 边说边出字
        continuous: true, // 按住期间一直听；false 会在说话停顿处自己结束，话没说完就断了
      });
    } catch {
      listeningRef.current = false;
      setListening(false);
      flash('无法启动识别');
    }
  };

  /** 松手：结束这一句。提交交给 end 事件（那是修正后的完整结果），这里留个兜底 */
  const pressOut = () => {
    holding.current = false;
    // 200ms 内就松手 / 只是想挪按钮 —— 这时根本没开录，静默结束，不弹任何提示
    if (startTimer.current) {
      clearTimeout(startTimer.current);
      startTimer.current = null;
    }
    if (!listeningRef.current) return; // 还没开始听就松手了
    try {
      ExpoSpeechRecognitionModule.stop();
    } catch {
      listeningRef.current = false;
      setListening(false);
    }
    // end 事件万一不来，也得把听到的话交出去，否则用户觉得点了没反应
    clearFinish();
    finishTimer.current = setTimeout(commit, 900);
  };

  /**
   * 判成拖动：把「等着开录」的那一次取消掉。
   * 这时还没开录，所以**不需要 abort**（abort 反而会触发 error 事件弹出提示）。
   */
  const cancelPending = () => {
    if (startTimer.current) {
      clearTimeout(startTimer.current);
      startTimer.current = null;
    }
    holding.current = false; // 万一定时器已经跑了，看到这条也会放弃开录
    listeningRef.current = false;
    latest.current = '';
    clearFinish();
    setListening(false);
    setPartial('');
  };

  // 位置：默认停在底部正中，可以左右拖到两侧，松手吸附到最近的一档
  const { width: W } = Dimensions.get('window');
  const BTN = 52;
  const EDGE = 16;
  const maxX = Math.max(0, W / 2 - BTN / 2 - EDGE); // 中心到某一侧的最大偏移
  const [dock, setDock] = useState(0); // 0 = 正中
  const panX = useRef(new Animated.Value(0)).current;

  const dockPan = useMemo(
    () =>
      PanResponder.create({
        // 关键：不抢「按下」这一下 —— 按住说话要先让 Pressable 的 onPressIn 拿到，
        // 只有真的挪动了（>10pt）才接管成拖动
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_e, gs) =>
          // 已经在录音了就别抢 —— 说话时手指多少会抖，抢走会把这一句打断
          !listeningRef.current && Math.abs(gs.dx) > 10,
        onPanResponderGrant: () => {
          cancelPending();
          panX.setOffset(dock);
          panX.setValue(0);
        },
        onPanResponderMove: (_e, gs) => {
          // 别拖出屏幕外面去
          panX.setValue(Math.max(-maxX - dock, Math.min(maxX - dock, gs.dx)));
        },
        onPanResponderRelease: (_e, gs) => {
          panX.flattenOffset();
          const raw = Math.max(-maxX, Math.min(maxX, dock + gs.dx));
          // 三个停靠位：拖一点点算没动，回正中；拖过四成就吸到那一侧
          const target = Math.abs(raw) < maxX * 0.4 ? 0 : raw > 0 ? maxX : -maxX;
          setDock(target);
          Animated.spring(panX, { toValue: target, useNativeDriver: true }).start();
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dock, maxX]
  );

  return (
    <View style={styles.wrap} pointerEvents="box-none">
      {/* 这一层负责左右挪动；手势挂在这里，所以气泡和按钮是一起走的 */}
      <Animated.View
        style={[styles.dock, { transform: [{ translateX: panX }] }]}
        {...dockPan.panHandlers}
      >
        {/* 录音中：实时把听到的字显示出来，让用户知道识别对了没有 */}
        {listening ? (
          <View style={styles.bubble}>
            <Text style={styles.bubbleText} numberOfLines={3}>
              {partial || '正在听…'}
            </Text>
            <Text style={styles.bubbleHint}>松手结束，自动填入输入框</Text>
          </View>
        ) : hint ? (
          <View style={[styles.bubble, styles.bubblePlain]}>
            <Text style={styles.bubbleText}>{hint}</Text>
          </View>
        ) : null}

        <Animated.View style={{ transform: [{ scale: pulse }] }}>
          <Pressable
            style={[styles.btn, listening && styles.btnOn, disabled && styles.btnOff]}
            onPressIn={pressIn}
            onPressOut={pressOut}
            disabled={disabled}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel="按住说话，松手结束；左右拖动可挪到两侧"
          >
            {/* 按住说话：图标始终是麦克风，用变红 + 呼吸表示「正在听」 */}
            <Ionicons name="mic" size={24} color="#fff" />
          </Pressable>
        </Animated.View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  // 定位交给父容器（父容器是盖在网页上的 absolute 容器），这里只管内部排布
  wrap: { alignItems: 'center', gap: 8 },
  // 可左右拖动的那一层：内容居中，整体靠 translateX 挪
  dock: { alignItems: 'center', gap: 8 },
  btn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#2f6df6',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.22,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 6,
  },
  btnOn: { backgroundColor: '#e5484d' },
  btnOff: { backgroundColor: '#9aa4b2' },
  bubble: {
    maxWidth: 250,
    backgroundColor: 'rgba(24,28,36,0.92)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 3,
  },
  bubblePlain: { backgroundColor: 'rgba(24,28,36,0.86)' },
  bubbleText: { fontSize: 13, lineHeight: 18, color: '#fff' },
  bubbleHint: { fontSize: 11, color: 'rgba(255,255,255,0.62)' },
});
