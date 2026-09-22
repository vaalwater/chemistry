import { useCallback, useMemo, useRef, useState } from 'react';
import { PanResponder, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';

export interface SliderMark {
  value: number;
  label: string;
  note?: string;
}

interface Props {
  value: number;
  min: number;
  max: number;
  marks: SliderMark[];
  showMarks?: boolean;
  onChange: (v: number) => void;
}

/**
 * 横向滑块：左端 = min，右端 = max，宽度由父容器决定。
 * 自己接管触摸，点击轨道任意处可直接跳过去，拖动时按位置实时回调。
 */
export default function RatioSlider({ value, min, max, marks, showMarks, onChange }: Props) {
  const trackRef = useRef<View | null>(null);
  const [trackW, setTrackW] = useState(0);
  const geoRef = useRef({ left: 0, width: 0 });
  const valueRef = useRef(value);
  valueRef.current = value;

  const span = max - min;
  const ratio = span > 0 ? (value - min) / span : 0;

  const measure = useCallback(() => {
    trackRef.current?.measureInWindow?.((x: number, _y: number, w: number) => {
      if (w > 0) {
        geoRef.current = { left: x, width: w };
        setTrackW((prev) => (Math.abs(prev - w) < 0.5 ? prev : w));
      }
    });
  }, []);

  const pick = useCallback(
    (pageX: number, locationX: number) => {
      const { left, width } = geoRef.current;
      if (width <= 0 || span <= 0) return;
      const x = left > 0 && Number.isFinite(pageX) ? pageX - left : locationX;
      if (!Number.isFinite(x)) return;
      const r = Math.min(1, Math.max(0, x / width));
      const v = min + r * span;
      if (Math.abs(v - valueRef.current) > 0.001) onChange(v);
    },
    [min, onChange, span]
  );
  const pickRef = useRef(pick);
  pickRef.current = pick;

  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (e) => {
          measure();
          pickRef.current(e.nativeEvent.pageX, e.nativeEvent.locationX);
        },
        onPanResponderMove: (e) => pickRef.current(e.nativeEvent.pageX, e.nativeEvent.locationX),
      }),
    [measure]
  );

  return (
    <View style={styles.wrap}>
      <View style={styles.trackArea}>
        <View
          ref={trackRef}
          style={styles.track}
          onLayout={(e) => {
            const w = e.nativeEvent.layout.width;
            if (w > 0) {
              geoRef.current = { left: geoRef.current.left, width: w };
              setTrackW((prev) => (Math.abs(prev - w) < 0.5 ? prev : w));
            }
            measure();
          }}
          {...pan.panHandlers}
        >
          <View style={[styles.fill, { width: ratio * trackW }]} pointerEvents="none" />
        </View>

        {showMarks
          ? marks.map((m) => {
              const r = span > 0 ? (m.value - min) / span : 0;
              return (
                <View key={m.label} style={[styles.markTick, { left: r * trackW }]} pointerEvents="none">
                  <View style={styles.markLine} />
                  <View style={styles.markBox}>
                    <Text style={styles.markText}>{m.label}</Text>
                    {m.note ? <Text style={styles.markNote}>{m.note}</Text> : null}
                  </View>
                </View>
              );
            })
          : null}

        <View style={[styles.thumb, { left: ratio * trackW }]} pointerEvents="none">
          <View style={styles.thumbKnob} />
        </View>
      </View>

      <View style={styles.rangeRow}>
        <Text style={styles.rangeText}>{min.toFixed(2)}</Text>
        <Text style={styles.rangeText}>{max.toFixed(2)}</Text>
      </View>
    </View>
  );
}

const TRACK_H = 12;
const THUMB = 26;

const styles = StyleSheet.create({
  wrap: { width: '100%' },
  trackArea: {
    height: 68,
    justifyContent: 'flex-start',
    paddingTop: 5,
  },
  track: {
    height: TRACK_H,
    width: '100%',
    borderRadius: TRACK_H / 2,
    backgroundColor: '#E7EDF7',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  fill: { height: TRACK_H, backgroundColor: colors.accent, borderRadius: TRACK_H / 2 },
  thumb: {
    position: 'absolute',
    top: 5 + TRACK_H / 2 - THUMB / 2,
    marginLeft: -THUMB / 2,
    width: THUMB,
    height: THUMB,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbKnob: {
    width: THUMB - 4,
    height: THUMB - 4,
    borderRadius: (THUMB - 4) / 2,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: colors.accent,
  },
  markTick: { position: 'absolute', top: 5 + TRACK_H, alignItems: 'center' },
  markLine: { width: 1, height: 6, backgroundColor: colors.faint },
  markBox: { position: 'absolute', top: 7, left: -34, width: 68, alignItems: 'center' },
  markText: { fontSize: 10.5, fontWeight: '800', color: colors.sub },
  markNote: { fontSize: 9, color: colors.faint, marginTop: 1, textAlign: 'center' },
  rangeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  rangeText: { fontSize: 10, color: colors.faint, fontWeight: '700' },
});
