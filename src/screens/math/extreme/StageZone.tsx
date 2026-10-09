import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PanResponder, Platform, StyleSheet, Text, View } from 'react-native';
import { colors } from '../../../theme';
import RatioSlider from '../../../components/RatioSlider';
import { Box, Chip, Note } from '../zones/kit';
import PlanePlot, { type PItem } from './PlanePlot';
import {
  contour,
  dot,
  familyLevels,
  feasibleRange,
  fitWin,
  levelState,
  numericOpt,
  samplesOf,
  tangencyAt,
  unit,
  add,
  mul,
  len,
  type ExtremeCase,
  type V2,
  type Win,
} from '../../../math/extreme';

const H = 330;

const C_F = '#e5524a'; // ∇f / 目标函数
const C_G = '#2f6fed'; // ∇g / 约束
const C_TAN = '#1fa97a'; // ∇f 的切向分量
const C_LV = '#2fa7e8'; // 等高线
const C_OPT = '#e2822f'; // 最优点那条等高线
const C_CONSTRAINT = '#43597a';
const C_POINT = '#8a63d2';

function fmt(v: number, d = 2): string {
  if (!Number.isFinite(v)) return '—';
  const r = Number(v.toFixed(d));
  return String(r);
}

function vecText(v: V2, d = 2): string {
  return `(${fmt(v.x, d)}, ${fmt(v.y, d)})`;
}

/** 动画相位：0 → 1 循环。停下来的那一刻不再请求下一帧，省电。 */
function usePhase(active: boolean, period: number): number {
  const [p, setP] = useState(0);
  useEffect(() => {
    if (!active) return undefined;
    let raf = 0;
    let alive = true;
    const t0 = Date.now();
    const step = () => {
      if (!alive) return;
      setP(((Date.now() - t0) % period) / period);
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
    };
  }, [active, period]);
  return p;
}

/** 折线吃喝的一种方式：0→1→0，匀速，到端点自然掉头 */
function pingpong(p: number): number {
  return p < 0.5 ? p * 2 : 2 - p * 2;
}

/** 0→1 之后停住（留一段时间看清相切那一瞬） */
function easeHold(p: number, holdAt = 0.8): number {
  const q = Math.min(1, p / holdAt);
  return 1 - Math.pow(1 - q, 2.4);
}

/* ------------------------------------------------------------------ *
 * 画布取景：拖动 / 缩放
 *
 * 只有一个规矩不能破：**横纵必须同一个尺度**。所以缩放是「整块窗按 z 倍缩小」，
 * 而不是分别改 x、y —— 不然「等高线与约束相切」在屏幕上就歪了。
 * ------------------------------------------------------------------ */

export type ViewState = { cx: number; cy: number; z: number };

const Z_MIN = 0.6;
const Z_MAX = 12;

function winOf(base: Win, v: ViewState | null): Win {
  if (!v) return base;
  const w = (base.xHi - base.xLo) / v.z;
  const h = (base.yHi - base.yLo) / v.z;
  return { xLo: v.cx - w / 2, xHi: v.cx + w / 2, yLo: v.cy - h / 2, yHi: v.cy + h / 2 };
}



interface Props {
  kase: ExtremeCase;
  knobs: Record<string, number>;
}

/**
 * 几何舞台 —— 这一页的心脏。
 *
 * 两种看法，同一件事：
 *   「沿约束走」：点在约束曲线上来回走，看 ∇f 在切线方向的分量什么时候变成 0；
 *   「等高线推到相切」：目标函数的等高线一路推过去，推到刚好贴住约束曲线的那一刻就是极值。
 *
 * 分量变 0 ⟺ 等高线与约束相切 ⟺ ∇f ∥ ∇g ⟺ ∇f = λ∇g。
 */
export default function StageZone({ kase, knobs }: Props) {
  const [plotW, setPlotW] = useState(0);
  const [mode, setMode] = useState<'slide' | 'level'>('slide');
  const [playing, setPlaying] = useState(true);
  /** 手动拖动时接管动画 */
  const [manual, setManual] = useState<number | null>(null);
  /** 画布取景：null = 自动取景（跟着题目走）；否则按 (cx, cy) 居中、z 倍放大 */
  const [view, setView] = useState<ViewState | null>(null);
  const phase = usePhase(playing, 7600);

  useEffect(() => {
    setManual(null);
  }, [mode, kase.id]);

  useEffect(() => {
    setView(null);
  }, [kase.id]);

  const aspect = plotW > 0 ? H / plotW : 1;
  const base = useMemo(() => fitWin(kase.req(knobs), aspect), [kase, knobs, aspect]);
  const win = useMemo(() => winOf(base, view), [base, view]);
  const sol = useMemo(() => kase.solve(knobs), [kase, knobs]);
  /** 画用「看得见的那一段」，而极值 / 取值范围一律按整条约束算 —— 缩放不改答案 */
  const samples = useMemo(() => samplesOf(kase, knobs, win, 260), [kase, knobs, win]);
  const samplesAll = useMemo(() => samplesOf(kase, knobs, base, 220), [kase, knobs, base]);
  const optN = useMemo(() => numericOpt(kase, knobs, base), [kase, knobs, base]);
  const range = useMemo(() => feasibleRange(kase, knobs, base), [kase, knobs, base]);

  /** 目标函数去掉「f =」之后的那串（画布上标等高线要用） */
  const fExpr = kase.fText.replace(/^f\s*=\s*/, '');

  /* ---------------- 画布：拖动平移 / 捏合与滚轮缩放 ---------------- */

  const baseRef = useRef(base);
  baseRef.current = base;
  const winRef = useRef(win);
  winRef.current = win;
  const viewRef = useRef(view);
  viewRef.current = view;
  const wRef = useRef(plotW);
  wRef.current = plotW;

  /** 以画面上的 (px, py) 那一点为中心缩放（不给就是画面正中） */
  const zoomAt = useCallback((factor: number, px?: number, py?: number) => {
    const b = baseRef.current;
    const w = winRef.current;
    const pw = wRef.current;
    const cur = viewRef.current ?? { cx: (b.xLo + b.xHi) / 2, cy: (b.yLo + b.yHi) / 2, z: 1 };
    const z = Math.max(Z_MIN, Math.min(Z_MAX, cur.z * factor));
    const spanX = (b.xHi - b.xLo) / z;
    const spanY = (b.yHi - b.yLo) / z;
    const fx = px != null && pw > 0 ? px / pw : 0.5;
    const fy = py != null ? py / H : 0.5;
    const dx = w.xLo + fx * (w.xHi - w.xLo); // 缩放前后都停在鼠标底下的那个数据点
    const dy = w.yHi - fy * (w.yHi - w.yLo);
    setView({ cx: dx + spanX * (0.5 - fx), cy: dy - spanY * (0.5 - fy), z });
  }, []);

  const panBy = useCallback((dxPx: number, dyPx: number) => {
    const b = baseRef.current;
    const pw = wRef.current;
    if (pw <= 0) return;
    const cur = viewRef.current ?? { cx: (b.xLo + b.xHi) / 2, cy: (b.yLo + b.yHi) / 2, z: 1 };
    const spanX = (b.xHi - b.xLo) / cur.z;
    const spanY = (b.yHi - b.yLo) / cur.z;
    setView({ cx: cur.cx - (dxPx * spanX) / pw, cy: cur.cy + (dyPx * spanY) / H, z: cur.z });
  }, []);

  const boxRef = useRef<View | null>(null);
  const touch = useRef({ x: 0, y: 0, dist: 0, moved: 0, tapAt: 0, left: 0, top: 0 });

  const panRes = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_e, gs) => Math.abs(gs.dx) > 4 || Math.abs(gs.dy) > 4,
        onPanResponderGrant: (e) => {
          const t = touch.current;
          const now = Date.now();
          // 上一手势几乎没动 + 这两下挨得很近 = 双击 / 双敲 → 回到自动取景
          if (t.moved < 6 && now - t.tapAt < 340) {
            setView(null);
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
            // 双指捏合：以两指中点为心缩放
            const d = Math.hypot(ts[0].pageX - ts[1].pageX, ts[0].pageY - ts[1].pageY);
            const cx = (ts[0].pageX + ts[1].pageX) / 2 - t.left;
            const cy = (ts[0].pageY + ts[1].pageY) / 2 - t.top;
            if (t.dist > 8 && d > 8) zoomAt(d / t.dist, cx, cy);
            t.dist = d;
            t.moved = 99;
            return;
          }
          const nx = e.nativeEvent.pageX;
          const ny = e.nativeEvent.pageY;
          const dx = nx - t.x;
          const dy = ny - t.y;
          t.x = nx;
          t.y = ny;
          t.moved += Math.abs(dx) + Math.abs(dy);
          panBy(dx, dy);
        },
        onPanResponderRelease: () => {
          touch.current.dist = 0;
        },
      }),
    [panBy, zoomAt]
  );

  /**
   * 电脑上的滚轮缩放：按住 ⌘ / Ctrl 才生效，不抢页面本身的滚动。
   * 直接挂到画布那个 DOM 节点上（RNW 的 View 就是把 ref 给到 DOM），最稳。
   */
  useEffect(() => {
    if (Platform.OS !== 'web') return undefined;
    const el = boxRef.current as unknown as {
      addEventListener?: (t: string, h: (e: any) => void, o?: any) => void;
      removeEventListener?: (t: string, h: (e: any) => void) => void;
      getBoundingClientRect?: () => { left: number; top: number };
    };
    if (!el || typeof el.addEventListener !== 'function') return undefined;
    const h = (e: any) => {
      if (!e || !(e.ctrlKey || e.metaKey)) return;
      if (typeof e.preventDefault === 'function') e.preventDefault();
      const rect = typeof el.getBoundingClientRect === 'function' ? el.getBoundingClientRect() : null;
      const f = (e.deltaY ?? 0) < 0 ? 1.16 : 1 / 1.16;
      zoomAt(f, rect ? e.clientX - rect.left : undefined, rect ? e.clientY - rect.top : undefined);
    };
    el.addEventListener('wheel', h, { passive: false });
    return () => {
      if (typeof el.removeEventListener === 'function') el.removeEventListener('wheel', h);
    };
  }, [zoomAt]);

  /** 最优点现在还在不在画面里（不在就给个「找回来」的按钮） */
  const optInView =
    sol.at.x >= win.xLo && sol.at.x <= win.xHi && sol.at.y >= win.yLo && sol.at.y <= win.yHi;

  const halfSpan = Math.max(1e-6, (win.xHi - win.xLo) / 2);
  const arrowLen = halfSpan * 0.26;

  /** 沿约束走的范围：放大之后就只在看得见的这一段上来回走 */
  const walkSamples = samples.length > 4 ? samples : samplesAll;
  const tLo = walkSamples.length ? walkSamples[0].t : 0;
  const tHi = walkSamples.length ? walkSamples[walkSamples.length - 1].t : 1;
  /** 极值点在滑轨上的位置（用来「一键跳过去」） */
  const optRatio = (): number => {
    if (!optN) return 0.5;
    const r = (optN.t - tLo) / Math.max(1e-9, tHi - tLo);
    return Math.max(0, Math.min(1, r));
  };

  /* ---------------- 两种看法当前的「位置」 ---------------- */

  const slideRatio = manual ?? pingpong(phase);
  const tNow = tLo + (tHi - tLo) * slideRatio;
  const atSlide = kase.walk(tNow, knobs);
  const valueSlide = Number.isFinite(kase.f(atSlide, knobs)) ? kase.f(atSlide, knobs) : Number.NaN;

  const target = optN ? optN.value : range.lo;
  const startLevel = kase.sense === 'min' ? range.hi : range.lo;
  /** 「再往前推一点点」的那条：它已经碰不到约束了 */
  const nudged =
    kase.sense === 'min'
      ? target - Math.max(0.03, Math.abs(target) * 0.045)
      : target + Math.max(0.03, Math.abs(target) * 0.045);
  const lvLo = Math.min(startLevel, target, nudged);
  const lvHi = Math.max(startLevel, target, nudged);
  const levelNow = manual ?? target + (startLevel - target) * (1 - easeHold(phase));
  const levelSt = levelState(kase, knobs, win, levelNow);
  const levelHit = levelSt !== 'miss';

  /* ---------------- 静态图层：等高线族 + 约束曲线 ---------------- */

  const staticItems = useMemo<PItem[]>(() => {
    const items: PItem[] = [];
    const spanX = win.xHi - win.xLo;
    const spanY = win.yHi - win.yLo;

    // ① 目标函数的等高线族（先只画线，标签等一下统一摆，免得挤在一起）
    const levels = familyLevels(sol.value, kase.sense);
    const allSegs = levels.map((lv) => contour((x, y) => kase.f({ x, y }, knobs), lv, win, 56, 44));
    allSegs.forEach((segs, i) => {
      segs.forEach((s) => {
        items.push({ kind: 'poly', pts: [s.a, s.b], color: C_LV, width: 1.3, opacity: i === 0 ? 0.9 : 0.5 });
      });
    });

    /** 已经摆好的贴纸位置：新的贴纸必须离它们足够远，否则宁可不标 */
    const placed: V2[] = [];
    const gap = spanX * 0.17;

    // ② 约束曲线 + 「约束 g = 0：……」的贴纸
    if (samples.length > 1) {
      items.push({ kind: 'poly', pts: samples.map((s) => s.at), color: C_CONSTRAINT, width: 2.8 });
      const idx = Math.min(samples.length - 1, Math.floor(samples.length * 0.74));
      const p = samples[idx].at;
      const lp = add(p, mul(spanX * 0.08, unit(kase.gradG(p, knobs))));
      items.push({ kind: 'poly', pts: [p, lp], color: C_CONSTRAINT, width: 1, dash: true, opacity: 0.6 });
      items.push({
        kind: 'label',
        at: lp,
        text: `约束 g = 0：${kase.gText(knobs)}`,
        color: C_CONSTRAINT,
        size: 10,
        bold: true,
        bg: '#EDF1F9',
      });
      placed.push(lp);
      placed.push(sol.at); // 最优点那块地方留给「最小 / 最大 …」的标签
    }

    // ③ 等高线的标签 + 左上角那个「这些线是谁家的」
    const corner = { x: win.xLo + spanX * 0.04, y: win.yHi - spanY * 0.075 };
    items.push({
      kind: 'label',
      at: corner,
      text: `目标 ${kase.fText} 的等高线`,
      color: C_LV,
      size: 10,
      bold: true,
      bg: '#FFFFFF',
    });
    placed.push(corner);

    const far = (p: V2) => (placed.length ? Math.min(...placed.map((q) => Math.hypot(q.x - p.x, q.y - p.y))) : Infinity);

    allSegs.forEach((segs, i) => {
      if (i % 2 !== 0 || !segs.length) return;
      let best: V2 | null = null;
      let bestD = -1;
      segs.forEach((s) => {
        const m = { x: (s.a.x + s.b.x) / 2, y: (s.a.y + s.b.y) / 2 };
        // 太贴边的位置不放标签（一半会被裁掉）
        const margin = Math.min(m.x - win.xLo, win.xHi - m.x, m.y - win.yLo, win.yHi - m.y);
        if (margin < spanX * 0.13) return;
        const d = far(m);
        if (d > bestD) {
          bestD = d;
          best = m;
        }
      });
      if (best && bestD > gap) {
        placed.push(best);
        items.push({
          kind: 'label',
          at: best,
          text: `${fExpr} = ${fmt(levels[i])}`,
          color: C_LV,
          size: 9.5,
          bold: true,
          bg: '#FFFFFF',
        });
      }
    });

    return items;
  }, [kase, knobs, win, sol.value, sol.at, samples, fExpr]);

  /* ---------------- 动态图层 ---------------- */

  const liveItems = useMemo<PItem[]>(() => {
    const items: PItem[] = [];

    // 最优点：一直在那儿，作为参照
    items.push({ kind: 'ring', at: sol.at, r: 7, color: C_OPT, width: 2 });
    items.push({ kind: 'dot', at: sol.at, r: 3.4, color: C_OPT });
    items.push({
      kind: 'label',
      at: sol.at,
      text: `${kase.sense === 'min' ? '最小' : '最大'} ${fmt(sol.value)}`,
      color: C_OPT,
      size: 11,
      bold: true,
      dx: 46,
      dy: -16,
    });

    if (mode === 'slide') {
      const tan = tangencyAt(kase, knobs, atSlide);
      const V = mul(arrowLen, unit(tan.gradF)); // ∇f 的可视长度（方向信息，长短统一）
      const alongT = dot(V, tan.T);
      const tipF = add(atSlide, V);
      const tipT = add(atSlide, mul(alongT, tan.T));

      // 约束曲线在这一点的切线（虚线）：就是「还能往哪儿走」的方向
      items.push({
        kind: 'poly',
        pts: [add(atSlide, mul(-arrowLen * 0.9, tan.T)), add(atSlide, mul(arrowLen * 0.9, tan.T))],
        color: '#7d92b0',
        width: 1.6,
        dash: true,
      });
      // ∇f 分解：切向分量（能不能沿约束降） + 法向分量（虚线补全那个直角三角形）
      items.push({ kind: 'arrow', from: atSlide, to: tipF, color: C_F, width: 2.4, head: 9 });
      if (Math.abs(alongT) > arrowLen * 0.02) {
        items.push({ kind: 'arrow', from: atSlide, to: tipT, color: C_TAN, width: 2.6, head: 10 });
        items.push({ kind: 'poly', pts: [tipT, tipF], color: '#9db0c8', width: 1.2, dash: true });
      }
      items.push({ kind: 'arrow', from: atSlide, to: add(atSlide, mul(arrowLen, unit(tan.gradG))), color: C_G, width: 2.4, head: 9 });
      items.push({ kind: 'dot', at: atSlide, r: 5.4, color: C_POINT });
      items.push({ kind: 'label', at: tipF, text: '∇f', color: C_F, size: 11, bold: true, dx: 26, dy: -4 });
      items.push({
        kind: 'label',
        at: add(atSlide, mul(arrowLen, unit(tan.gradG))),
        text: '∇g',
        color: C_G,
        size: 11,
        bold: true,
        dx: 24,
        dy: 12,
      });
      if (Math.abs(alongT) > arrowLen * 0.02) {
        items.push({
          kind: 'label',
          at: tipT,
          text: `还能沿约束往这边${kase.sense === 'min' ? '降' : '升'}`,
          color: C_TAN,
          size: 10.5,
          dy: 18,
        });
      }
      return items;
    }

    // 等高线推过去：当前那条 + 「再往前就碰不到」的那条
    const segs = contour((x, y) => kase.f({ x, y }, knobs), levelNow, win, 62, 48);
    segs.forEach((s) => items.push({ kind: 'poly', pts: [s.a, s.b], color: levelHit ? C_OPT : '#b9c6d8', width: 2.4 }));
    const segs2 = contour((x, y) => kase.f({ x, y }, knobs), nudged, win, 62, 48);
    segs2.forEach((s) => items.push({ kind: 'poly', pts: [s.a, s.b], color: C_F, width: 1.6, dash: true, opacity: 0.75 }));
    items.push({
      kind: 'label',
      at: kase.walk((tLo + tHi) / 2, knobs),
      text: `${kase.fText.replace('f = ', '')} = ${fmt(levelNow)}${
        levelSt === 'miss' ? '：够不着了' : levelSt === 'tangent' ? '：相切！' : ''
      }`,
      color: levelSt === 'miss' ? colors.faint : C_OPT,
      size: 11.5,
      bold: true,
      dy: -18,
    });
    if (levelSt !== 'hit') {
      items.push({
        kind: 'label',
        at: sol.at,
        text: levelSt === 'tangent' ? '正好贴住 —— 切点就是极值点' : '再推就碰不到约束上的点了',
        color: levelSt === 'tangent' ? C_TAN : C_F,
        size: 11,
        bold: true,
        dx: 62,
        dy: 16,
      });
    }
    return items;
  }, [mode, kase, knobs, win, atSlide, arrowLen, levelNow, nudged, levelSt, sol, tLo, tHi]);

  const tan = tangencyAt(kase, knobs, atSlide);
  const nearOpt = Math.abs(tan.tangential) < 1e-6 * Math.max(1, Math.abs(tan.normal)) + 0.02;

  return (
    <View style={styles.wrap}>
      <View style={styles.modeRow}>
        <Chip label="沿约束走一圈" on={mode === 'slide'} onPress={() => setMode('slide')} color={colors.purple} icon="walk-outline" />
        <Chip label="等高线推到相切" on={mode === 'level'} onPress={() => setMode('level')} color={C_OPT} icon="resize-outline" />
        <Chip
          label={playing ? '暂停动画' : '继续动画'}
          on={playing}
          onPress={() => setPlaying((p) => !p)}
          color={colors.accent}
          icon={playing ? 'pause-outline' : 'play-outline'}
        />
      </View>

      <View ref={boxRef} style={styles.canvasBox} {...panRes.panHandlers}>
        <PlanePlot
          win={win}
          items={[...staticItems, ...liveItems]}
          height={H}
          xLabel={kase.vars[0]}
          yLabel={kase.vars[1]}
          onWidth={setPlotW}
        />
        <View style={styles.zoomBadge}>
          <Text style={styles.zoomBadgeText}>
            ×{(view?.z ?? 1).toFixed(1)}　{view ? '拖动可平移' : '自动取景'}
          </Text>
        </View>
      </View>

      <View style={styles.canvasBar}>
        <Chip label="缩小" onPress={() => zoomAt(1 / 1.4)} color={colors.faint} icon="remove-outline" />
        <Chip label="放大" onPress={() => zoomAt(1.4)} color={colors.faint} icon="add-outline" />
        <Chip label="回到自动取景" on={!view} onPress={() => setView(null)} color={colors.purple} icon="scan-outline" />
        {!optInView ? (
          <Chip
            label="把最优点找回来"
            onPress={() => setView({ cx: sol.at.x, cy: sol.at.y, z: view?.z ?? 1 })}
            color={C_OPT}
            icon="locate-outline"
          />
        ) : null}
      </View>

      <View style={styles.legendRow}>
        {[
          { c: C_LV, t: `等高线：${fExpr} = 各个常数` },
          { c: C_CONSTRAINT, t: `约束 g = 0：${kase.gText(knobs)}` },
          { c: C_F, t: '∇f（f 涨得最快的方向）' },
          { c: C_G, t: '∇g（垂直于约束曲线）' },
          { c: C_TAN, t: '∇f 的切向分量（≠ 0 就还能变）' },
          { c: C_OPT, t: '最优点 / 极值那条等高线' },
        ].map((l) => (
          <View key={l.t} style={styles.legendItem}>
            <View style={[styles.legendBar, { backgroundColor: l.c }]} />
            <Text style={styles.legendText}>{l.t}</Text>
          </View>
        ))}
      </View>

      <Text style={styles.canvasHelp}>
        画布上标了两边：蓝色的是目标函数 {kase.fText} 的等高线（每条都标了 f 等于多少），深色那条是约束 {kase.gText(knobs)}
        。拖动画布可以平移，双指捏合 / ⌘(Ctrl)+滚轮 缩放，双击回到自动取景 —— 缩放时横纵同尺度，所以「相切」永远画得正。
      </Text>

      <Box tone="soft">
        {mode === 'slide' ? (
          <>
            <Text style={styles.readHead}>
              现在在 ({fmt(atSlide.x)}, {fmt(atSlide.y)}) —— {kase.fText} = <Text style={{ color: C_OPT }}>{fmt(valueSlide)}</Text>
            </Text>
            <View style={styles.kvRow}>
              <Text style={styles.kvKey}>∇f</Text>
              <Text style={[styles.kvVal, { color: C_F }]}>
                {vecText(tan.gradF, 3)}　|∇f| = {fmt(len(tan.gradF))}
              </Text>
            </View>
            <View style={styles.kvRow}>
              <Text style={styles.kvKey}>∇g</Text>
              <Text style={[styles.kvVal, { color: C_G }]}>{vecText(tan.gradG, 3)}</Text>
            </View>
            <View style={styles.kvRow}>
              <Text style={styles.kvKey}>切向分量</Text>
              <Text style={[styles.kvVal, { color: Math.abs(tan.tangential) < 0.02 ? C_TAN : colors.ink }]}>
                ∇f·T = {fmt(tan.tangential, 3)} {nearOpt ? '≈ 0 → 这里再也降不动了' : '≠ 0 → 还能沿约束变'}
              </Text>
            </View>
            <View style={styles.kvRow}>
              <Text style={styles.kvKey}>λ</Text>
              <Text style={styles.kvVal}>
                ∇f·∇g / |∇g|² = {fmt(tan.lambda, 3)}（最优处 λ = {fmt(sol.lambda, 3)}）
              </Text>
            </View>
            <Note
              text={
                nearOpt
                  ? '∇f 正好垂直于切线 —— 沿着约束曲线怎么挪，f 都不再变小了。换个说法：目标函数的那条等高线，在这一刻正好和约束曲线相切。切点 = 极值点。'
                  : '绿色箭头是 ∇f 沿着约束的分量：只要它不是 0，顺着约束再走一步，f 就能变得更小（或更大）。走到它变成 0 的地方就到点了 —— 那一刻 ∇f 与 ∇g 平行。'
              }
              tone={nearOpt ? 'good' : 'sub'}
              icon={nearOpt ? 'checkmark-circle-outline' : 'analytics-outline'}
            />
          </>
        ) : (
          <>
            <Text style={styles.readHead}>
              等高线 {kase.fText} = <Text style={{ color: C_OPT }}>{fmt(levelNow)}</Text>　
              {levelSt === 'hit' ? '还压在约束上' : levelSt === 'tangent' ? '正好和约束相切！' : '已经碰不到约束了'}
            </Text>
            <Note
              text={
                levelSt === 'hit'
                  ? `这条等高线和约束曲线有交点，说明这个 f 值「取得到」。它正顺着 ${kase.sense === 'min' ? '数值变小' : '数值变大'}的方向往 ${fmt(target)} 推。`
                  : levelSt === 'tangent'
                    ? `橙色那条正好贴着约束曲线 —— 只有一个交点（相切）。这一步就是极值点：再想${kase.sense === 'min' ? '小' : '大'}一点点，看那条红色虚线，它已经整条脱离约束了。`
                    : `红色虚线就是「再推一点点」的那条：它和约束曲线一个交点都没有，上面的点一个都取不到 —— 所以 ${fmt(target)} 就是取得到的${kase.sense === 'min' ? '最小' : '最大'}值。`
              }
              tone={levelSt === 'hit' ? 'sub' : levelSt === 'tangent' ? 'good' : 'warn'}
              icon={levelSt === 'hit' ? 'git-compare-outline' : levelSt === 'tangent' ? 'checkmark-circle-outline' : 'flag-outline'}
            />
            <Note
              text={`等高线族是一层层${kase.sense === 'min' ? '往里收' : '往外扩'}的圆/线；约束是一条固定的曲线。两者刚好「贴上」而不是「穿过去」的那一瞬间 —— 切点就是极值点，那一刻两条曲线的法线重合，也就是 ∇f ∥ ∇g。`}
              icon="sparkles-outline"
            />
          </>
        )}
      </Box>

      <View style={styles.sliderBox}>
        <Text style={styles.sliderHead}>
          {mode === 'slide' ? '自己拖：沿着约束曲线挪这个点' : '自己拖：把等高线推过去'}
        </Text>
        <Text style={styles.sliderVal}>
          {mode === 'slide'
            ? `(${fmt(atSlide.x)}, ${fmt(atSlide.y)}) → f = ${fmt(valueSlide)}`
            : `f = ${fmt(levelNow)}${
                levelSt === 'miss' ? '（够不着约束）' : levelSt === 'tangent' ? '（正好相切）' : ''
              }`}
        </Text>
        <RatioSlider
          value={mode === 'slide' ? slideRatio : levelNow}
          min={mode === 'slide' ? 0 : lvLo}
          max={mode === 'slide' ? 1 : lvHi}
          marks={
            mode === 'slide'
              ? [
                  { value: 0, label: '起点' },
                  { value: 1, label: '终点' },
                ]
              : [{ value: target, label: `${kase.sense === 'min' ? '最小' : '最大'} ${fmt(target)}` }]
          }
          onChange={(v) => {
            setPlaying(false);
            setManual(v);
          }}
        />
        <View style={styles.modeRow}>
          {!playing ? (
            <Chip
              label="回到自动动画"
              onPress={() => {
                setManual(null);
                setPlaying(true);
              }}
              color={colors.accent}
              icon="play-outline"
            />
          ) : null}
          <Chip
            label={mode === 'slide' ? '直接跳到极值点' : '直接推到相切那一瞬'}
            onPress={() => {
              setPlaying(false);
              setManual(mode === 'slide' ? optRatio() : target);
            }}
            color={C_OPT}
            icon="flag-outline"
          />
          <Chip label={`极值 f = ${fmt(target)}`} on onPress={() => {}} color={colors.faint} icon="checkmark-done-outline" />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 8 },
  modeRow: { flexDirection: 'row', flexWrap: 'wrap' },
  canvasBox: { marginTop: 6 },
  canvasBar: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 6 },
  zoomBadge: {
    position: 'absolute',
    right: 6,
    top: 6,
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 2,
    backgroundColor: 'rgba(255,255,255,0.88)',
    borderWidth: 1,
    borderColor: colors.line,
    pointerEvents: 'none' as const,
  },
  zoomBadgeText: { fontSize: 9.5, fontWeight: '800', color: colors.faint },
  legendRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 },
  legendItem: { flexDirection: 'row', alignItems: 'center', marginRight: 10, marginBottom: 4 },
  legendBar: { width: 14, height: 3, borderRadius: 2, marginRight: 4 },
  legendText: { fontSize: 10, fontWeight: '600', color: colors.sub, flexShrink: 1 },
  canvasHelp: { fontSize: 10.5, color: colors.faint, lineHeight: 16, marginTop: 2 },
  readHead: { fontSize: 12.5, fontWeight: '800', color: colors.ink, lineHeight: 18 },
  kvRow: { flexDirection: 'row', alignItems: 'flex-start', marginTop: 5 },
  kvKey: { width: 66, fontSize: 11.5, color: colors.faint, fontWeight: '700' },
  kvVal: { flex: 1, fontSize: 11.5, color: colors.inkSoft, lineHeight: 17 },
  sliderBox: { marginTop: 10 },
  sliderHead: { fontSize: 11.5, fontWeight: '700', color: colors.inkSoft },
  sliderVal: { fontSize: 11.5, fontWeight: '800', color: colors.accent, marginBottom: 2 },
});
