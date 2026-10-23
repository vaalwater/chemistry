import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../../theme';
import { traceCurve, type V2, type Win } from '../../../math/curves';
import type { Compiled, Vars } from '../../../math/expr';

/**
 * 动手页的画布
 *
 * · 背景是浅色坐标网格，轻点一下就把那个点的坐标读出来（十字线 + 气泡）；
 * · 拖动平移、双指捏合 / ⌘(Ctrl)+滚轮 缩放、双击回到自动取景；
 * · 右上一列半透明按钮：放大、缩小、复位；
 * · 横纵永远同尺度（整块窗一起缩放），所以圆看着就是圆，不会被拉成椭圆。
 */

export type CurveView = { id: string; color: string; c: Compiled };
export type TargetView = { id: string; x: number; y: number; hit: boolean };

interface Props {
  /** 自动取景窗口（按内容算出来的；view 为 null 时用它） */
  base: Win;
  curves: CurveView[];
  /** 式子里的参数值（x、y 之外的字母） */
  vars: Vars;
  targets?: TargetView[];
  /** 命中容差（数据单位的半径，用来画那个小圈） */
  tol?: number;
  height?: number;
  /** 这个值一变就回到自动取景（换关卡时用） */
  resetKey?: string;
  onWidth?: (w: number) => void;
}

function niceStep(span: number): number {
  const raw = span / 6;
  const pow = Math.pow(10, Math.floor(Math.log10(Math.max(raw, 1e-6))));
  const n = raw / pow;
  return (n >= 5 ? 5 : n >= 2 ? 2 : 1) * pow;
}

/** 一段线：中点定位 + 绕中心旋转，任意角度都不糊 */
function SegView({
  x1,
  y1,
  x2,
  y2,
  color,
  width = 1.6,
  opacity = 1,
}: {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
  width?: number;
  opacity?: number;
}) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const L = Math.hypot(dx, dy);
  if (L < 0.4) return null;
  return (
    <View
      style={{
        position: 'absolute',
        left: (x1 + x2) / 2 - L / 2,
        top: (y1 + y2) / 2 - width / 2,
        width: L,
        height: width,
        backgroundColor: color,
        opacity,
        borderRadius: width / 2,
        transform: [{ rotate: `${(Math.atan2(dy, dx) * 180) / Math.PI}deg` }],
      }}
    />
  );
}

/** 目标点标签的左边位置：默认点在右边，贴近右边界就翻到左边，别被按钮压住 */
function tagLeft(px: number, text: string, w: number): number {
  const est = text.length * 5.6 + 10;
  const right = px + 7;
  if (right + est <= w - 4) return right;
  return Math.max(2, px - 7 - est);
}

const fmt = (v: number): string => {
  const r = Math.round(v * 100) / 100;
  return Number.isInteger(r) ? String(r) : String(r);
};

export default function PlotCanvas({
  base,
  curves,
  vars,
  targets,
  tol = 0.06,
  height = 330,
  resetKey,
  onWidth,
}: Props) {
  const [w, setW] = useState(0);
  const [view, setView] = useState<Win | null>(null);
  const [probe, setProbe] = useState<V2 | null>(null);
  /** 手指 / 鼠标正按在画布上：这段时间降采样，抬手后再画回精细的一版 */
  const [dragging, setDragging] = useState(false);
  const H = height;
  const win = view ?? base;

  /**
   * 拖动时按「缩水后的画布尺寸」去采样。
   * 一条曲线按整屏宽度要采 400+ 个点，每一帧把上千个线段 View 全量重排就会卡；
   * 拖动中用四成采样率，点少了三倍多，松手再补一次精细的 —— 拖动顺滑，最终画面不变。
   */
  const sampleW = dragging ? Math.max(120, Math.round(w * 0.42)) : w;
  const sampleH = dragging ? Math.max(90, Math.round(H * 0.42)) : H;

  /** 曲线在「当前窗口」里重新采样 —— 所以放大之后曲线还是清楚的 */
  const paths = useMemo(
    () => curves.map((c) => ({ id: c.id, color: c.color, pts: traceCurve(c.c, win, sampleW, sampleH, vars) })),
    [curves, vars, win, sampleW, sampleH]
  );

  useEffect(() => {
    setView(null);
    setProbe(null);
  }, [resetKey]);

  const baseRef = useRef(base);
  baseRef.current = base;
  const winRef = useRef(win);
  winRef.current = win;
  const wRef = useRef(w);
  wRef.current = w;

  const X = useCallback((x: number) => ((x - win.xLo) / (win.xHi - win.xLo)) * wRef.current, [win]);
  const Y = useCallback((y: number) => H - ((y - win.yLo) / (win.yHi - win.yLo)) * H, [win]);

  /** 以画面上的 (px,py) 那一点为中心缩放 */
  const zoomAt = useCallback((factor: number, px?: number, py?: number) => {
    const b = baseRef.current;
    const cur = winRef.current;
    const pw = wRef.current;
    const baseSpan = b.xHi - b.xLo;
    const spanX = cur.xHi - cur.xLo;
    const next = spanX / factor;
    if (next < baseSpan / 24 || next > baseSpan * 12) return;
    const scale = next / spanX;
    const spanY = (cur.yHi - cur.yLo) * scale;
    const fx = px != null && pw > 0 ? px / pw : 0.5;
    const fy = py != null ? py / H : 0.5;
    const dx = cur.xLo + fx * spanX;
    const dy = cur.yHi - fy * (cur.yHi - cur.yLo);
    setView({ xLo: dx - fx * next, xHi: dx - fx * next + next, yLo: dy - (1 - fy) * spanY, yHi: dy + fy * spanY });
  }, []);

  const panBy = useCallback((dxPx: number, dyPx: number) => {
    const cur = winRef.current;
    const pw = wRef.current;
    if (pw <= 0) return;
    const mx = (dxPx * (cur.xHi - cur.xLo)) / pw;
    const my = (dyPx * (cur.yHi - cur.yLo)) / H;
    setView({ xLo: cur.xLo - mx, xHi: cur.xHi - mx, yLo: cur.yLo + my, yHi: cur.yHi + my });
  }, []);

  const boxRef = useRef<View | null>(null);
  const touch = useRef({ x: 0, y: 0, dist: 0, moved: 0, tapAt: 0, left: 0, top: 0 });

  const panRes = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_e, gs) => Math.abs(gs.dx) > 4 || Math.abs(gs.dy) > 4,
        /**
         * 画布整个嵌在页面的 ScrollView 里：默认允许中断的话，手指一动
         * 手势就被容器抢去滚动（带弹性），画布既收不到移动事件、又被滚动抢帧，拖起来就卡。
         * 这里明确拒绝交出手势，拖动全程留在画布上。
         */
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (e) => {
          const t = touch.current;
          const now = Date.now();
          setDragging(true);
          if (t.moved < 6 && now - t.tapAt < 340) {
            setView(null); // 双击：回到自动取景
            t.tapAt = 0;
          } else {
            t.tapAt = now;
          }
          t.x = e.nativeEvent.pageX;
          t.y = e.nativeEvent.pageY;
          t.dist = 0;
          t.moved = 0;
          boxRef.current?.measureInWindow?.((x: number, y: number) => {
            t.left = x;
            t.top = y;
          });
        },
        onPanResponderMove: (e) => {
          const ts = (e.nativeEvent as { touches?: { pageX: number; pageY: number }[] }).touches ?? [];
          const t = touch.current;
          if (ts.length >= 2) {
            const d = Math.hypot(ts[0].pageX - ts[1].pageX, ts[0].pageY - ts[1].pageY);
            if (t.dist > 8 && d > 8)
              zoomAt(d / t.dist, (ts[0].pageX + ts[1].pageX) / 2 - t.left, (ts[0].pageY + ts[1].pageY) / 2 - t.top);
            t.dist = d;
            t.moved = 99;
            return;
          }
          const nx = e.nativeEvent.pageX;
          const ny = e.nativeEvent.pageY;
          t.moved += Math.abs(nx - t.x) + Math.abs(ny - t.y);
          panBy(nx - t.x, ny - t.y);
          t.x = nx;
          t.y = ny;
        },
        onPanResponderRelease: (e) => {
          const t = touch.current;
          setDragging(false); // 松手：按原采样率重画一次，曲线恢复精细
          if (t.moved < 6 && wRef.current > 0) {
            // 一下轻点 = 读这个点的坐标
            const lx = (e.nativeEvent as { locationX?: number }).locationX ?? 0;
            const ly = (e.nativeEvent as { locationY?: number }).locationY ?? 0;
            const cw = winRef.current;
            setProbe({
              x: cw.xLo + (lx / wRef.current) * (cw.xHi - cw.xLo),
              y: cw.yHi - (ly / H) * (cw.yHi - cw.yLo),
            });
          }
          t.dist = 0;
        },
        onPanResponderTerminate: () => setDragging(false),
      }),
    [panBy, zoomAt]
  );

  /** 电脑上 ⌘ / Ctrl + 滚轮：直接挂 DOM 节点，最稳 */
  useEffect(() => {
    const el = boxRef.current as unknown as {
      addEventListener?: (t: string, h: (e: any) => void, o?: any) => void;
      removeEventListener?: (t: string, h: (e: any) => void) => void;
      getBoundingClientRect?: () => { left: number; top: number };
    } | null;
    if (!el || typeof el.addEventListener !== 'function') return undefined;
    const h = (e: any) => {
      if (!e || !(e.ctrlKey || e.metaKey)) return;
      if (typeof e.preventDefault === 'function') e.preventDefault();
      const rect = typeof el.getBoundingClientRect === 'function' ? el.getBoundingClientRect() : null;
      zoomAt(
        (e.deltaY ?? 0) < 0 ? 1.16 : 1 / 1.16,
        rect ? e.clientX - rect.left : undefined,
        rect ? e.clientY - rect.top : undefined
      );
    };
    el.addEventListener('wheel', h, { passive: false });
    return () => {
      if (typeof el.removeEventListener === 'function') el.removeEventListener('wheel', h);
    };
  }, [zoomAt]);

  const step = niceStep(Math.max(win.xHi - win.xLo, win.yHi - win.yLo));
  const xs: number[] = [];
  for (let t = Math.ceil(win.xLo / step) * step; t <= win.xHi + 1e-9; t += step) xs.push(Math.round(t * 1000) / 1000);
  const ys: number[] = [];
  for (let t = Math.ceil(win.yLo / step) * step; t <= win.yHi + 1e-9; t += step) ys.push(Math.round(t * 1000) / 1000);

  const z = (base.xHi - base.xLo) / Math.max(1e-9, win.xHi - win.xLo);
  const tolPx = Math.max(5, (tol * w) / Math.max(1e-9, win.xHi - win.xLo));

  return (
    <View
      style={[styles.wrap, { height: H }]}
      onLayout={(e) => {
        const nw = e.nativeEvent.layout.width;
        if (Math.abs(nw - w) > 0.5) {
          setW(nw);
          onWidth?.(nw);
        }
      }}
    >
      <View ref={boxRef} style={styles.board} {...panRes.panHandlers}>
        {w > 0 ? (
          <>
            {xs.map((t) => (
              <View key={`gx${t}`} style={[styles.gridV, { left: X(t) }]} />
            ))}
            {ys.map((t) => (
              <View key={`gy${t}`} style={[styles.gridH, { top: Y(t) }]} />
            ))}
            {win.xLo < 0 && win.xHi > 0 ? <View style={[styles.axisV, { left: X(0) }]} /> : null}
            {win.yLo < 0 && win.yHi > 0 ? <View style={[styles.axisH, { top: Y(0) }]} /> : null}

            {paths.map((c) => (
              <View key={c.id} style={[StyleSheet.absoluteFill, styles.noHit]}>
                {c.pts.map((pts, pi) =>
                  pts.slice(0, pts.length - 1).map((p, i) => (
                    <SegView
                      key={`${c.id}-${pi}-${i}`}
                      x1={X(p.x)}
                      y1={Y(p.y)}
                      x2={X(pts[i + 1].x)}
                      y2={Y(pts[i + 1].y)}
                      color={c.color}
                      width={2.1}
                    />
                  ))
                )}
              </View>
            ))}

            {(targets ?? []).map((t) => {
              const px = X(t.x);
              const py = Y(t.y);
              const c = t.hit ? colors.green : colors.orange;
              return (
                <View key={t.id} style={styles.noHit}>
                  <View
                    style={[
                      styles.ring,
                      {
                        left: px - tolPx,
                        top: py - tolPx,
                        width: tolPx * 2,
                        height: tolPx * 2,
                        borderRadius: tolPx,
                        borderColor: `${c}55`,
                        borderWidth: 1,
                      },
                    ]}
                  />
                  <View
                    style={[
                      styles.dot,
                      { left: px - 5, top: py - 5, width: 10, height: 10, borderRadius: 5, backgroundColor: c },
                    ]}
                  />
                  <View
                    style={[
                      styles.tag,
                      {
                        // 靠右边缘时把标签翻到点的左边，免得被右上角那排按钮压住
                        left: tagLeft(px, t.hit ? `${t.id} ✓` : `${t.id} (${fmt(t.x)}, ${fmt(t.y)})`, w),
                        top: Math.max(2, Math.min(H - 16, py - 14)),
                        backgroundColor: `${c}1a`,
                        borderColor: `${c}44`,
                      },
                    ]}
                  >
                    <Text style={[styles.tagText, { color: c }]}>
                      {t.id} {t.hit ? '✓' : `(${fmt(t.x)}, ${fmt(t.y)})`}
                    </Text>
                  </View>
                </View>
              );
            })}

            {probe ? (
              <View style={styles.noHit}>
                <View style={[styles.gridV, { left: X(probe.x), backgroundColor: `${colors.accent}55` }]} />
                <View style={[styles.gridH, { top: Y(probe.y), backgroundColor: `${colors.accent}55` }]} />
                <View
                  style={[
                    styles.probePill,
                    {
                      left: Math.min(Math.max(2, X(probe.x) + 8), Math.max(2, w - 96)),
                      top: Math.min(Math.max(2, Y(probe.y) - 26), H - 24),
                    },
                  ]}
                >
                  <Text style={styles.probeText}>
                    ({fmt(probe.x)}, {fmt(probe.y)})
                  </Text>
                </View>
              </View>
            ) : null}

            <View style={styles.tickRow}>
              {xs.map((t) => (
                <Text key={`tx${t}`} style={[styles.tickText, { left: Math.max(2, Math.min(w - 30, X(t) - 10)) }]}>
                  {fmt(t)}
                </Text>
              ))}
            </View>
            {ys.map((t) => (
              <Text
                key={`ty${t}`}
                style={[styles.tickY, { top: Math.min(H - 12, Math.max(0, Y(t) - 6)), left: 3 }]}
              >
                {fmt(t)}
              </Text>
            ))}
          </>
        ) : null}
      </View>

      {/* 半透明操作按钮（在画布上层，但不吃掉下面的拖动） */}
      <View style={styles.overlay} pointerEvents="box-none">
        <Pressable style={styles.btn} onPress={() => zoomAt(1.4)} accessibilityRole="button" accessibilityLabel="放大">
          <Ionicons name="add" size={16} color={colors.inkSoft} />
        </Pressable>
        <Pressable style={styles.btn} onPress={() => zoomAt(1 / 1.4)} accessibilityRole="button" accessibilityLabel="缩小">
          <Ionicons name="remove" size={16} color={colors.inkSoft} />
        </Pressable>
        <Pressable style={styles.btn} onPress={() => setView(null)} accessibilityRole="button" accessibilityLabel="回到自动取景">
          <Ionicons name="scan-outline" size={15} color={colors.inkSoft} />
        </Pressable>
        {probe ? (
          <Pressable style={styles.btn} onPress={() => setProbe(null)} accessibilityRole="button" accessibilityLabel="清掉坐标">
            <Ionicons name="close" size={15} color={colors.inkSoft} />
          </Pressable>
        ) : null}
      </View>

      <View style={styles.badge}>
        <Text style={styles.badgeText}>×{z.toFixed(1)}{view ? '　已手动' : '　自动'}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    backgroundColor: '#FBFCFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.line,
    overflow: 'hidden',
  },
  board: { flex: 1 },
  noHit: { pointerEvents: 'none' as const },
  gridV: { position: 'absolute', top: 0, bottom: 0, width: 1, backgroundColor: '#EFF3FA' },
  gridH: { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: '#EFF3FA' },
  axisV: { position: 'absolute', top: 0, bottom: 0, width: 1.2, backgroundColor: '#C3CFE0' },
  axisH: { position: 'absolute', left: 0, right: 0, height: 1.2, backgroundColor: '#C3CFE0' },
  ring: { position: 'absolute' },
  dot: { position: 'absolute' },
  tag: {
    position: 'absolute',
    borderRadius: 6,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderWidth: 1,
  },
  tagText: { fontSize: 9, fontWeight: '800' },
  probePill: {
    position: 'absolute',
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderWidth: 1,
    borderColor: `${colors.accent}55`,
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  probeText: { fontSize: 9.5, fontWeight: '800', color: colors.accent },
  tickRow: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 14 },
  tickText: { position: 'absolute', fontSize: 9, color: colors.faint, fontWeight: '700' },
  tickY: { position: 'absolute', fontSize: 9, color: colors.faint, fontWeight: '700' },
  overlay: { position: 'absolute', right: 6, top: 6, alignItems: 'center' },
  btn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.72)',
    borderWidth: 1,
    borderColor: colors.line,
    marginBottom: 6,
  },
  badge: {
    position: 'absolute',
    left: 6,
    top: 6,
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 2,
    backgroundColor: 'rgba(255,255,255,0.72)',
    borderWidth: 1,
    borderColor: colors.line,
  },
  badgeText: { fontSize: 9, fontWeight: '800', color: colors.faint },
});
