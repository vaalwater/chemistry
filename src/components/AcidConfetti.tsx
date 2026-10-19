import { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, View, useWindowDimensions } from 'react-native';

const COLORS = ['#ff5252', '#2f6fed', '#f5a623', '#2fbfa0', '#9a6bd6', '#ffd54f', '#4caf50'];

/**
 * 撒花：全部答对时的奖励动画。
 * runId 变化时重播（同一个 achievement 重复触发也能重放）。
 */
export default function AcidConfetti({ count = 44, runId = 0 }: { count?: number; runId?: number }) {
  const { width, height } = useWindowDimensions();
  const pieces = useMemo(
    () =>
      Array.from({ length: count }).map((_, i) => ({
        x: Math.random() * Math.max(80, width),
        size: 5 + Math.random() * 7,
        color: COLORS[i % COLORS.length],
        delay: Math.random() * 420,
        dur: 1500 + Math.random() * 1200,
        drift: (Math.random() - 0.5) * 110,
        spin: 240 + Math.random() * 420,
        round: i % 3 !== 0,
      })),
    [width, count]
  );
  const anims = useRef(pieces.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    anims.forEach((a) => a.setValue(0));
    Animated.parallel(
      pieces.map((p, i) =>
        Animated.timing(anims[i], {
          toValue: 1,
          duration: p.dur,
          delay: p.delay,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        })
      )
    ).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runId]);

  return (
    <View style={styles.wrap} pointerEvents="none">
      {pieces.map((p, i) => {
        const y = anims[i].interpolate({ inputRange: [0, 1], outputRange: [-24, height * 0.95] });
        const rotate = anims[i].interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${p.spin}deg`] });
        const tx = anims[i].interpolate({ inputRange: [0, 1], outputRange: [0, p.drift] });
        const opacity = anims[i].interpolate({ inputRange: [0, 0.7, 1], outputRange: [1, 1, 0] });
        return (
          <Animated.View
            key={i}
            style={{
              position: 'absolute',
              left: p.x,
              top: 0,
              width: p.size,
              height: p.size * 1.7,
              borderRadius: p.round ? p.size : 2,
              backgroundColor: p.color,
              opacity,
              transform: [{ translateY: y }, { translateX: tx }, { rotate }],
            }}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, overflow: 'hidden' },
});
