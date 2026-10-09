import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../../../theme';
import type { V2, Win } from '../../../math/extreme';

/**
 * 平面画布：和 FunctionGraph 一样纯 View 绘制，手机 / 电脑通吃。
 *
 * 关键一点：**横纵必须同一个尺度**（数据横向铺满，纵向按画面比例补）。
 * 不然「等高线与约束相切」这件事在屏幕上是歪的，几何也就白讲了。
 *
 * 所有图元都用「绕自身中心旋转」的方式定位，不需要 transform-origin。
 */

export type PItem =
  | { kind: 'poly'; pts: V2[]; color: string; width?: number; dash?: boolean; opacity?: number }
  | { kind: 'arrow'; from: V2; to: V2; color: string; width?: number; head?: number; opacity?: number }
  | { kind: 'dot'; at: V2; r?: number; color: string; hole?: boolean }
  | { kind: 'ring'; at: V2; r?: number; color: string; width?: number }
  | {
      kind: 'label';
      at: V2;
      text: string;
      color?: string;
      size?: number;
      dx?: number;
      dy?: number;
      bold?: boolean;
      /** 给了背景色就画成一小块「贴纸」，压在曲线上也看得清 */
      bg?: string;
    };

interface Props {
  win: Win;
  items: PItem[];
  height?: number;
  /** 背景网格的辅助文案（默认 x / y） */
  xLabel?: string;
  yLabel?: string;
  /** 把量出来的宽度报给外面：外面的取景要按这个比例补齐，横纵才同尺度 */
  onWidth?: (w: number) => void;
}

function niceStep(span: number): number {
  const raw = span / 5;
  const pow = Math.pow(10, Math.floor(Math.log10(Math.max(raw, 1e-6))));
  const n = raw / pow;
  const step = n >= 5 ? 5 : n >= 2 ? 2 : 1;
  return step * pow;
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
  const cx = (x1 + x2) / 2;
  const cy = (y1 + y2) / 2;
  const ang = (Math.atan2(dy, dx) * 180) / Math.PI;
  return (
    <View
      style={{
        position: 'absolute',
        left: cx - L / 2,
        top: cy - width / 2,
        width: L,
        height: width,
        backgroundColor: color,
        opacity,
        borderRadius: width / 2,
        transform: [{ rotate: `${ang}deg` }],
      }}
    />
  );
}

/** 箭头：一段杆 + 两根小鱼叉（同样用 SegView 画，避免 CSS 三角形在 RN 上翻车） */
function ArrowView({
  x1,
  y1,
  x2,
  y2,
  color,
  width = 2,
  head = 8,
  opacity = 1,
}: {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
  width?: number;
  head?: number;
  opacity?: number;
}) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const L = Math.hypot(dx, dy);
  if (L < 1) return null;
  const ux = dx / L;
  const uy = dy / L;
  const tipX = x2;
  const tipY = y2;
  const back = head;
  const spread = 0.5;
  // 鱼叉两边的方向与竖直/水平的夹角固定 30°
  const cos30 = Math.cos(Math.PI / 6);
  const sin30 = Math.sin(Math.PI / 6);
  const lx = -ux * cos30 - uy * sin30;
  const ly = -uy * cos30 + ux * sin30;
  const rx = -ux * cos30 + uy * sin30;
  const ry = -uy * cos30 - ux * sin30;
  return (
    <>
      <SegView x1={x1} y1={y1} x2={x2} y2={y2} color={color} width={width} opacity={opacity} />
      <SegView
        x1={tipX + lx * back * spread}
        y1={tipY + ly * back * spread}
        x2={tipX}
        y2={tipY}
        color={color}
        width={width}
        opacity={opacity}
      />
      <SegView
        x1={tipX + rx * back * spread}
        y1={tipY + ry * back * spread}
        x2={tipX}
        y2={tipY}
        color={color}
        width={width}
        opacity={opacity}
      />
    </>
  );
}

export default function PlanePlot({ win, items, height = 300, xLabel = 'x', yLabel = 'y', onWidth }: Props) {
  const [w, setW] = useState(0);
  const H = height;
  const X = (x: number) => ((x - win.xLo) / (win.xHi - win.xLo)) * w;
  const Y = (y: number) => H - ((y - win.yLo) / (win.yHi - win.yLo)) * H;

  const step = niceStep(Math.max(win.xHi - win.xLo, win.yHi - win.yLo));
  const xsTicks: number[] = [];
  for (let t = Math.ceil(win.xLo / step) * step; t <= win.xHi + 1e-9; t += step) xsTicks.push(Math.round(t * 1000) / 1000);
  const ysTicks: number[] = [];
  for (let t = Math.ceil(win.yLo / step) * step; t <= win.yHi + 1e-9; t += step) ysTicks.push(Math.round(t * 1000) / 1000);

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
      {w > 0 ? (
        <>
          {/* 网格 */}
          {xsTicks.map((t) => (
            <View key={`gx${t}`} style={[styles.gridV, { left: X(t) }]} />
          ))}
          {ysTicks.map((t) => (
            <View key={`gy${t}`} style={[styles.gridH, { top: Y(t) }]} />
          ))}

          {/* 坐标轴（0 在视野里才画） */}
          {win.xLo < 0 && win.xHi > 0 ? <View style={[styles.axisV, { left: X(0) }]} /> : null}
          {win.yLo < 0 && win.yHi > 0 ? <View style={[styles.axisH, { top: Y(0) }]} /> : null}

          {/* 图元 */}
          {items.map((it, idx) => {
            const key = `it${idx}`;
            if (it.kind === 'poly') {
              const wd = it.width ?? 1.6;
              const pts = it.pts.map((p) => ({ x: X(p.x), y: Y(p.y) }));
              return (
                <View key={key} style={[StyleSheet.absoluteFill, styles.noHit]}>
                  {pts.slice(0, pts.length - 1).map((p, i) =>
                    !it.dash || i % 2 === 0 ? (
                      <SegView
                        key={`${key}-${i}`}
                        x1={p.x}
                        y1={p.y}
                        x2={pts[i + 1].x}
                        y2={pts[i + 1].y}
                        color={it.color}
                        width={wd}
                        opacity={it.opacity ?? 1}
                      />
                    ) : null
                  )}
                </View>
              );
            }
            if (it.kind === 'arrow') {
              return (
                <ArrowView
                  key={key}
                  x1={X(it.from.x)}
                  y1={Y(it.from.y)}
                  x2={X(it.to.x)}
                  y2={Y(it.to.y)}
                  color={it.color}
                  width={it.width ?? 2}
                  head={it.head ?? 8}
                  opacity={it.opacity ?? 1}
                />
              );
            }
            if (it.kind === 'dot') {
              const r = it.r ?? 5;
              return (
                <View
                  key={key}
                  style={[
                    styles.dot,
                    {
                      left: X(it.at.x) - r,
                      top: Y(it.at.y) - r,
                      width: r * 2,
                      height: r * 2,
                      borderRadius: r,
                      backgroundColor: it.hole ? colors.card : it.color,
                      borderWidth: it.hole ? 1.6 : 0,
                      borderColor: it.color,
                    },
                  ]}
                />
              );
            }
            if (it.kind === 'ring') {
              const r = it.r ?? 8;
              return (
                <View
                  key={key}
                  style={[
                    styles.ring,
                    {
                      left: X(it.at.x) - r,
                      top: Y(it.at.y) - r,
                      width: r * 2,
                      height: r * 2,
                      borderRadius: r,
                      borderColor: it.color,
                      borderWidth: it.width ?? 2,
                    },
                  ]}
                />
              );
            }
            if (it.kind === 'label') {
              const size = it.size ?? 11;
              const left = Math.min(Math.max(2, X(it.at.x) + (it.dx ?? 0) - 60), Math.max(2, w - 122));
              const top = Math.min(Math.max(2, Y(it.at.y) + (it.dy ?? 0) - size), H - size - 4);
              const font = {
                color: it.color ?? colors.inkSoft,
                fontSize: size,
                fontWeight: it.bold ? '800' : '600',
              } as const;
              if (it.bg) {
                return (
                  <View
                    key={key}
                    style={[
                      styles.labelPill,
                      styles.noHit,
                      { left, top, backgroundColor: it.bg, borderColor: `${font.color}33` },
                    ]}
                  >
                    <Text style={[styles.pillText, font]} numberOfLines={2}>
                      {it.text}
                    </Text>
                  </View>
                );
              }
              return (
                <Text key={key} style={[styles.label, { left, top }, font]}>
                  {it.text}
                </Text>
              );
            }
            return null;
          })}

          {/* 坐标刻度：只标注边界上的几个数 */}
          {xsTicks.length ? (
            <View style={styles.tickRow}>
              {xsTicks.map((t) => (
                <Text key={`tx${t}`} style={[styles.tickText, { left: Math.max(2, Math.min(w - 26, X(t) - 8)) }]}>
                  {t}
                </Text>
              ))}
              <Text style={[styles.tickText, styles.tickAxis, { right: 4 }]}>{xLabel}</Text>
            </View>
          ) : null}
          {ysTicks.length ? (
            <Text style={[styles.tickY, { left: 4, top: Math.max(0, Y(ysTicks[ysTicks.length - 1]) - 14) }]}>
              {yLabel}
            </Text>
          ) : null}
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  noHit: { pointerEvents: 'none' as const },
  wrap: {
    width: '100%',
    backgroundColor: '#FBFCFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.line,
    overflow: 'hidden',
  },
  gridV: { position: 'absolute', top: 0, bottom: 0, width: 1, backgroundColor: '#EDF1F8' },
  gridH: { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: '#EDF1F8' },
  axisV: { position: 'absolute', top: 0, bottom: 0, width: 1.2, backgroundColor: '#B7C4D8' },
  axisH: { position: 'absolute', left: 0, right: 0, height: 1.2, backgroundColor: '#B7C4D8' },
  dot: { position: 'absolute' },
  ring: { position: 'absolute' },
  label: { position: 'absolute', width: 120, textAlign: 'center' },
  labelPill: {
    position: 'absolute',
    maxWidth: 132,
    borderRadius: 7,
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillText: { textAlign: 'center', lineHeight: 14 },
  tickRow: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 14 },
  tickText: { position: 'absolute', fontSize: 9.5, color: colors.faint, fontWeight: '700' },
  tickAxis: { color: colors.faint },
  tickY: { position: 'absolute', fontSize: 9.5, color: colors.faint, fontWeight: '700' },
});
