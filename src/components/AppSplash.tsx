import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii } from '../theme';

/** 至少停留这么久：包体大、首帧慢，闪一下反而更让人觉得没加载完 */
const MIN_MS = 900;
/** 淡出的时长 */
const FADE_MS = 340;

/**
 * 全 App 启动页：打开就盖在最上层，内容和底色与学科首页一致，
 * 等首帧画出来再整体淡出，避免开屏时先看到一片空白 / 半截界面。
 */
export default function AppSplash({ onDone }: { onDone: () => void }) {
  const op = useRef(new Animated.Value(1)).current;
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // 三个点轮流亮：让用户看见“在动”，而不是对着一个死画面干等
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 900,
          easing: Easing.linear,
          useNativeDriver: false,
        }),
        Animated.delay(220),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 0,
          useNativeDriver: false,
        }),
      ])
    );
    loop.start();

    const t = setTimeout(() => {
      Animated.timing(op, {
        toValue: 0,
        duration: FADE_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start(() => {
        loop.stop();
        onDone();
      });
    }, MIN_MS);

    return () => {
      clearTimeout(t);
      loop.stop();
    };
  }, [op, pulse, onDone]);

  const dot = (at: number) => ({
    opacity: pulse.interpolate({
      inputRange: [0, at, at + 0.18, at + 0.36, 1],
      outputRange: [0.22, 0.22, 1, 0.22, 0.22],
    }),
  });

  return (
    <Animated.View style={[styles.fill, { opacity: op }]}>
      <View style={styles.badge}>
        <Ionicons name="flask-outline" size={22} color="#1fa97a" />
        <Ionicons name="analytics-outline" size={22} color="#8a63d2" />
        <Ionicons name="rocket-outline" size={22} color="#e2822f" />
      </View>
      <Text style={styles.name}>理科3D视界</Text>
      <Text style={styles.tag}>把分子、几何与电磁场转起来看</Text>
      <View style={styles.dots}>
        <Animated.View style={[styles.dot, dot(0.05)]} />
        <Animated.View style={[styles.dot, dot(0.25)]} />
        <Animated.View style={[styles.dot, dot(0.45)]} />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  fill: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 99,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#fff',
    borderRadius: radii.card,
    paddingHorizontal: 18,
    paddingVertical: 12,
    marginBottom: 16,
  },
  name: { fontSize: 26, fontWeight: '800', color: colors.ink, letterSpacing: 1 },
  tag: { fontSize: 13, color: colors.sub, marginTop: 8 },
  dots: { flexDirection: 'row', marginTop: 22 },
  dot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: colors.accent, marginHorizontal: 4 },
});
