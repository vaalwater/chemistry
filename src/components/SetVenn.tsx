import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PanResponder, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';

export type VennDotData = { id: string; label: string; sets: string[] };

export type CircleGeo = { name: string; cx: number; cy: number; r: number; color: string };

const PALETTE = ['#2f6fed', '#e2822f', '#8a63d2'];

/** 圆心与半径（相对坐标：1 = 正方形边长） */
export function circleLayout(names: string[], aspect = 1): CircleGeo[] {
  if (names.length >= 3) {
    const r = 0.235;
    return names.slice(0, 3).map((n, i) => ({
      name: n,
      cx: [0.36, 0.64, 0.5][i],
      cy: [0.36, 0.36, 0.68][i],
      r,
      color: PALETTE[i],
    }));
  }
  return names.slice(0, 2).map((n, i) => ({
    name: n,
    cx: i === 0 ? 0.38 : 0.62,
    cy: 0.46,
    r: 0.235,
    color: PALETTE[i],
  }));
}

interface Props {
  names: string[];
  elements: VennDotData[];
  /** 指定初始位置（0~1 相对坐标）；不指定则排在底部托盘 */
  layout?: Record<string, { x: number; y: number }>;
  /** 每次元素落位：sets 表示它落在哪几个圆里 */
  onSettle?: (id: string, inside: string[]) => void;
  /** 手势开始时通知父组件（探针锁区用） */
  onDragStart?: () => void;
  /** 补集：对某个集合做斜纹高亮 */
  complementOf?: string | null;
}

type Pt = { x: number; y: number };

/**
 * Venn 图交互器：元素可拖，松手自动落进正确区域。
 * 纯 RN 实现：圆 = 圆角 View，元素 = 小圆点 + PanResponder。
 */
export default function SetVenn({ names, elements, layout, onSettle, onDragStart, complementOf }: Props) {
  const boxRef = useRef<View | null>(null);
  const [size, setSize] = useState(0);
  const circles = useMemo(() => circleLayout(names), [names]);

  // 元素位置：百分比坐标（相对容器宽高）；未指定 layout 时排在底部托盘
  const initial = useMemo(() => {
    const map: Record<string, Pt> = {};
    elements.forEach((e, i) => {
      map[e.id] = layout?.[e.id] ?? { x: 0.08 + (i % 9) * 0.095, y: 0.93 };
    });
    return map;
  }, [elements, layout]);

  const [pos, setPos] = useState<Record<string, Pt>>({});
  useEffect(() => {
    setPos(initial);
  }, [initial]);

  const insideOf = useCallback(
    (p: Pt): string[] => {
      if (size <= 0) return [];
      return circles
        .filter((c) => {
          const dxPx = (p.x - c.cx) * size;
          const dyPx = (p.y - c.cy) * size;
          return Math.sqrt(dxPx * dxPx + dyPx * dyPx) <= c.r * size;
        })
        .map((c) => c.name);
    },
    [circles, size]
  );

  const settle = useCallback(
    (id: string, p: Pt) => {
      const inside = insideOf(p);
      onSettle?.(id, inside);
    },
    [insideOf, onSettle]
  );

  return (
    <View style={styles.wrap}>
      <View
        ref={boxRef}
        style={styles.box}
        onLayout={(e) => {
          const w = e.nativeEvent.layout.width;
          if (Math.abs(w - size) > 0.5) setSize(w);
        }}
      >
        {/* 全集框 */}
        <View style={styles.universe}>
          <Text style={styles.universeTag}>U</Text>
        </View>

        {circles.map((c) => (
          <View
            key={c.name}
            style={[
              styles.circle,
              {
                left: (c.cx - c.r) * size,
                top: (c.cy - c.r) * size,
                width: c.r * 2 * size,
                height: c.r * 2 * size,
                borderColor: c.color,
                backgroundColor: `${c.color}14`,
                opacity: complementOf && complementOf !== c.name ? 0.35 : 1,
                pointerEvents: 'none',
              },
            ]}
          >
            <Text style={[styles.circleName, { color: c.color }]}>{c.name}</Text>
          </View>
        ))}

        {size > 0
          ? elements.map((el, i) => (
              <Dot
                key={el.id}
                el={el}
                p={pos[el.id] ?? initial[el.id]}
                size={size}
                color={PALETTE[i % PALETTE.length]}
                onChange={(np) => setPos((prev) => ({ ...prev, [el.id]: np }))}
                onDrop={(np) => settle(el.id, np)}
                onDragStart={onDragStart}
              />
            ))
          : null}
      </View>
    </View>
  );
}

/** 单个可拖元素 */
function Dot({
  el,
  p,
  size,
  color,
  onChange,
  onDrop,
  onDragStart,
}: {
  el: VennDotData;
  p: Pt;
  size: number;
  color: string;
  onChange: (p: Pt) => void;
  onDrop: (p: Pt) => void;
  onDragStart?: () => void;
}) {
  const start = useRef<Pt>(p);
  const pRef = useRef<Pt>(p);
  pRef.current = p;

  /** 用 gestureState 的累计位移换算，避免滚动 / 基准漂移 */
  const moveTo = useCallback(
    (g: { dx: number; dy: number }) => ({
      x: Math.max(0.03, Math.min(0.97, start.current.x + g.dx / size)),
      y: Math.max(0.03, Math.min(0.97, start.current.y + g.dy / size)),
    }),
    [size]
  );

  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: () => {
          start.current = pRef.current;
          onDragStart?.();
        },
        onPanResponderMove: (_e, g) => onChange(moveTo(g)),
        onPanResponderRelease: (_e, g) => {
          const np = moveTo(g);
          onChange(np);
          onDrop(np);
        },
      }),
    [onChange, onDrop, onDragStart, moveTo]
  );

  return (
    <View
      {...pan.panHandlers}
      style={[styles.dot, { left: p.x * size - 12, top: p.y * size - 12, backgroundColor: color }]}
      accessibilityRole="button"
      accessibilityLabel={`元素 ${el.label}`}
    >
      <Text style={styles.dotText}>{el.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%' },
  box: { width: '100%', aspectRatio: 1, position: 'relative' },
  universe: {
    position: 'absolute',
    left: 2,
    top: 2,
    right: 2,
    bottom: 2,
    borderWidth: 1.5,
    borderColor: colors.line,
    borderRadius: 14,
  },
  universeTag: { position: 'absolute', left: 8, top: 4, fontSize: 11, color: colors.faint, fontWeight: '700' },
  circle: {
    position: 'absolute',
    borderWidth: 1.6,
    borderRadius: 9999,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  circleName: { fontSize: 12, fontWeight: '800', marginTop: 6 },
  dot: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#1d3a63',
    shadowOpacity: 0.25,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  dotText: { fontSize: 11, fontWeight: '800', color: '#fff' },
});
