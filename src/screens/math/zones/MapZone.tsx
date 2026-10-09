import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../../theme';
import ParamStrip from '../../../components/ParamStrip';
import { discriminant } from '../../../math/setCore';
import { MAP_AXIS, MAP_REGIONS, type MapCaseId } from '../../../math/setCase';
import {
  B_STEP,
  bEndFits,
  bEnds,
  boundsOf,
  coefOf,
  coefsWith,
  coefSlots,
  evalB,
  mainParam,
  setBEnd,
  setCoef,
  type CoefSlot,
  type MathObj,
} from '../../../math/setObject';
import { Box, Chip, Note, Zone } from './kit';

const COLS = MAP_AXIS.cols;
const ROWS = MAP_AXIS.rows;

type Iv = { lo: number; hi: number };
type Win = { lo: number; hi: number };

type Cell = {
  key: string;
  pv: number;
  d: number;
  k: MapCaseId;
  trace: boolean;
  prod: number;
  /** 这一格里解集 A 的范围（null = 空集 / 退化） */
  iv: Iv | null;
};

interface Props {
  obj: MathObj;
  patch: (p: Partial<MathObj>) => void;
  /** 手指按住（或点开）某一格时，告诉中区“这个参数下的解长什么样” */
  onPreview: (vals: Record<string, number> | null, label: string | null) => void;
  locked?: boolean;
  fireProbe: (pid: string) => void;
}

/** 纵轴 Δ 的量级：按真实曲线 Δ(p) 的取值范围来定 */
function dSpan(o: MathObj, p: string | null, lo: number, hi: number): number {
  let mn = 0;
  let mx = 0;
  for (let i = 0; i <= 60; i += 1) {
    const v = lo + ((hi - lo) * i) / 60;
    const c = coefOf(o, p ? { ...o.vals, [p]: v } : o.vals);
    if (!c) return MAP_AXIS.dMax;
    const d = discriminant(c[0], c[1], c[2]);
    mn = Math.min(mn, d);
    mx = Math.max(mx, d);
  }
  return Math.max(6, Math.ceil(Math.max(mx, -mn) * 1.2));
}

/** Δ 行：越靠近 0 排得越密（真正分得清两种情形的地方就在 Δ = 0 附近），正中间正好是重根那一行 */
const D_FRACTIONS = [1, 0.4, 0.13, 0.04, 0, -0.04, -0.13, -0.4, -1];

function dAt(j: number, span: number): number {
  const f = D_FRACTIONS[Math.max(0, Math.min(D_FRACTIONS.length - 1, j))];
  return Math.round(f * span * 100) / 100;
}

/** 给定首项系数、一次项系数和 Δ，解集的那一段（d<0 或退化 = null） */
function intervalOf(A: number, B: number, d: number): Iv | null {
  if (d < 0 || Math.abs(A) < 1e-9) return null;
  const sq = Math.sqrt(Math.max(0, d));
  const r1 = (-B - sq) / (2 * A);
  const r2 = (-B + sq) / (2 * A);
  return { lo: Math.min(r1, r2), hi: Math.max(r1, r2) };
}

/** 某一格（参数值 + Δ 值）对应哪种情形 */
function caseOfCoef(c: [number, number, number], d: number, box: Iv | null): MapCaseId {
  if (d < 0) return 'empty';
  if (!box) return 'outside';
  const iv = intervalOf(c[0], c[1], d);
  if (!iv) return 'outside';
  if (iv.lo >= box.lo - 1e-9 && iv.hi <= box.hi + 1e-9) return 'inside';
  return 'outside';
}

/**
 * 一格里的「集合关系小图」：
 *
 *   上面那条浅色 U 形轨道 = 参照集合 B，两端那两根竖线就是 B 的两个端点；
 *   下面那条实心彩条 = 解集 A，两个小圆点是它的端点。
 *
 * 彩条整段落在轨道里 = 装得进；伸出轨道的部分画成半透明的一截，外加一个指出去的箭头；
 * 整段都在画面外 = 贴着边画一个箭头；没有彩条 = 空集 ∅。
 */
function RelGlyph({
  iv,
  box,
  win,
  color,
  glyphStyle,
}: {
  iv: Iv | null;
  box: Iv | null;
  win: Win;
  color: string;
  glyphStyle?: 'cell' | 'legend';
}) {
  const pct = (v: number) => ((v - win.lo) / (win.hi - win.lo)) * 100;
  const cl = (v: number) => Math.max(0, Math.min(100, v));
  const big = glyphStyle === 'legend';

  const tl = box ? cl(pct(box.lo)) : 0;
  const tr = box ? cl(pct(box.hi)) : 100;
  const tw = box ? Math.max(16, tr - tl) : 0;

  /** 参照集合 B：一条浅色轨道 + 两端的端点竖线 */
  const track = box ? (
    <View style={[styles.gTrack, big && styles.gTrackBig, { left: `${tl}%`, width: `${tw}%` }]}>
      <View style={[styles.gEnd, big && styles.gEndBig, { left: 0 }]} />
      <View style={[styles.gEnd, big && styles.gEndBig, { right: 0 }]} />
    </View>
  ) : null;

  if (!iv) {
    return (
      <>
        {track}
        <Text style={[styles.emptyGlyph, big && { fontSize: 12 }, { color: `${color}99` }]}>∅</Text>
      </>
    );
  }

  const aL = cl(pct(iv.lo));
  const aR = cl(pct(iv.hi));
  const inL = box ? Math.max(aL, tl) : aL;
  const inR = box ? Math.min(aR, tr) : aR;
  const hasIn = inR - inL > 2;
  const outL = box ? aL < tl - 1.5 : false;
  const outR = box ? aR > tr + 1.5 : false;
  const toLeft = (pct(iv.lo) + pct(iv.hi)) / 2 < (box ? (tl + tr) / 2 : 50);

  return (
    <>
      {track}
      {outL ? (
        <View style={[styles.gOut, big && styles.gOutBig, { left: 0, width: `${Math.max(3, aL)}%`, backgroundColor: color }]} />
      ) : null}
      {hasIn ? (
        <>
          <View
            style={[styles.gIn, big && styles.gInBig, { left: `${inL}%`, width: `${inR - inL}%`, backgroundColor: color }]}
          />
          {big ? (
            <>
              <View style={[styles.gDot, { left: `${inL}%`, backgroundColor: color }]} />
              <View style={[styles.gDot, { left: `${inR}%`, backgroundColor: color }]} />
            </>
          ) : null}
        </>
      ) : null}
      {outR ? (
        <View
          style={[styles.gOut, big && styles.gOutBig, { left: `${inR}%`, width: `${Math.max(3, 100 - inR)}%`, backgroundColor: color }]}
        />
      ) : null}
      {!hasIn && !outL && !outR ? (
        <Text style={[styles.gArrow, big && { fontSize: 13 }, toLeft ? { left: 0 } : { right: 0 }, { color }]}>
          {toLeft ? '←' : '→'}
        </Text>
      ) : (
        <>
          {outL ? (
            <Text style={[styles.gArrow, big && { fontSize: 13 }, { left: 0 }, { color }]}>←</Text>
          ) : null}
          {outR ? (
            <Text style={[styles.gArrow, big && { fontSize: 13 }, { right: 0 }, { color }]}>→</Text>
          ) : null}
        </>
      )}
    </>
  );
}

/** 这一格「为什么装不进」：把探出去的那一端说出来 */
function whyOut(iv: Iv, box: Iv): string {
  const bits: string[] = [];
  if (iv.lo < box.lo - 1e-9) bits.push(`左端 ${fmt(iv.lo)} 伸到了 B 的左端 ${fmt(box.lo)} 外面`);
  if (iv.hi > box.hi + 1e-9) bits.push(`右端 ${fmt(iv.hi)} 伸到了 B 的右端 ${fmt(box.hi)} 外面`);
  return bits.length ? bits.join('，') : '端点正好压在 B 的边上，差一点点';
}

/** 点过一格之后，用大白话讲清这一格发生了什么 */
function cellStory(c: Cell, box: Iv | null, axis: string): string {
  if (!c.iv) return `这一格的 Δ = ${fmt(c.d)} ≤ 0 时没有一段解集${c.d < 0 ? '（整个抛物线在 x 轴同一侧，解集是空集）' : '（两根重合，只剩一个点）'}。`;
  const seg = `[${fmt(c.iv.lo)}, ${fmt(c.iv.hi)}]`;
  if (c.k === 'empty') return `Δ = ${fmt(c.d)} < 0，一个解也没有，解集是空集 ∅ —— 空集本来就算「装得进」任何集合。`;
  if (!box) return `${axis} = ${fmt(c.pv)} 时解集是 ${seg}。`;
  if (c.k === 'inside') return `${axis} = ${fmt(c.pv)}，Δ = ${fmt(c.d)}，解集 ${seg} 整段都在 B 里 —— 装得进 ✓。`;
  return `${axis} = ${fmt(c.pv)}，Δ = ${fmt(c.d)}，解集 ${seg}，${whyOut(c.iv, box)} —— 装不进 ✗。`;
}

/** 左区：参数地图 —— 分类讨论变成在一张地图上走一遍 */
export default function MapZone({ obj, patch, onPreview, locked, fireProbe }: Props) {
  const slots = useMemo(() => coefSlots(obj), [obj]);
  const p = mainParam(obj);
  const [blink, setBlink] = useState(true);
  const [visited, setVisited] = useState<MapCaseId[]>([]);
  const [dup, setDup] = useState<string | null>(null);
  const [crit, setCrit] = useState<Cell | null>(null);
  const [showLayer, setShowLayer] = useState(true);
  /** 竖轴放大到 Δ ≈ 0 附近（两种情形真正分家的地方） */
  const [zoom, setZoom] = useState(false);
  /** 刚刚点过的那一格（地图下方会讲清这一格发生了什么） */
  const [picked, setPicked] = useState<Cell | null>(null);

  /** 参照集合 B 的主区间 */
  const box = useMemo(
    () => boundsOf(evalB(obj)) ?? (obj.quant !== 'none' ? boundsOf(obj.domain) : null),
    [obj]
  );

  /** 参照集合 B 的两条边 */
  const bE = useMemo(() => bEnds(obj), [obj]);

  /** 地图横轴 = 正在盯着的那个参数；它的取值范围跟着所在项走 */
  const axisSlot: CoefSlot | null = p ? slots.find((s) => s.param === p) ?? null : null;
  const axisMin = axisSlot ? (axisSlot.neg ? -axisSlot.max : axisSlot.min) : MAP_AXIS.aMin;
  const axisMax = axisSlot ? (axisSlot.neg ? -axisSlot.min : axisSlot.max) : MAP_AXIS.aMax;

  /** 小图的取景窗口：以 B 为中心向两边各留一点，超出画面的部分会贴在格子边上 */
  const win = useMemo<Win>(() => {
    if (!box) return { lo: -4, hi: 4 };
    const pad = Math.max(1.5, (box.hi - box.lo) * 0.8);
    return { lo: box.lo - pad, hi: box.hi + pad };
  }, [box]);

  const span = useMemo(() => dSpan(obj, p, axisMin, axisMax), [obj, p, axisMin, axisMax]);
  /** 放大档：把 Δ 的量级压到临界带附近，只看“差一点点就变了”的那几行 */
  const spanEff = zoom ? Math.max(1.5, span * 0.08) : span;

  const cells = useMemo<Cell[]>(() => {
    if (!p) return [];
    const out: Cell[] = [];
    for (let j = 0; j < ROWS; j += 1) {
      const d = dAt(j, spanEff);
      const up = j > 0 ? Math.abs(dAt(j - 1, spanEff) - d) / 2 : 0;
      const down = j < ROWS - 1 ? Math.abs(dAt(j + 1, spanEff) - d) / 2 : 0;
      const tol = Math.max(0.6, up, down);
      for (let i = 0; i < COLS; i += 1) {
        const pv = Math.round((axisMin + ((i + 0.5) * (axisMax - axisMin)) / COLS) * 100) / 100;
        const c = coefOf(obj, { ...obj.vals, [p]: pv });
        if (!c) continue;
        const prod = Math.abs(c[0]) > 1e-9 ? c[2] / c[0] : 0;
        const realD = discriminant(c[0], c[1], c[2]);
        out.push({
          key: `${i}-${j}`,
          pv,
          d,
          k: caseOfCoef(c, d, box),
          trace: Math.abs(realD - d) <= tol,
          prod,
          iv: intervalOf(c[0], c[1], d),
        });
      }
    }
    return out;
  }, [obj, p, spanEff, box, axisMin, axisMax]);

  /** 每一条滑轨上的颜色：这一项从左到右走过去，会依次遇到什么情形 */
  const stripColorsFor = (slot: CoefSlot): string[] => {
    const out: string[] = [];
    for (let i = 0; i < COLS; i += 1) {
      const v = slot.min + ((i + 0.5) * (slot.max - slot.min)) / COLS;
      const c = coefsWith(obj, slot.key, v);
      const d = c ? discriminant(c[0], c[1], c[2]) : 0;
      out.push(MAP_REGIONS.find((r) => r.id === caseOfCoef(c ?? [0, 0, 0], d, box))?.color ?? colors.line);
    }
    return out;
  };

  const stripColors = useMemo(() => {
    const out: string[] = [];
    if (!p) return out;
    for (let i = 0; i < COLS; i += 1) {
      const pv = axisMin + ((i + 0.5) * (axisMax - axisMin)) / COLS;
      const c = coefOf(obj, { ...obj.vals, [p]: pv });
      const d = c ? discriminant(c[0], c[1], c[2]) : 0;
      out.push(MAP_REGIONS.find((r) => r.id === caseOfCoef(c ?? [0, 0, 0], d, box))?.color ?? colors.line);
    }
    return out;
  }, [obj, p, box, axisMin, axisMax]);

  const missing = useMemo(() => MAP_REGIONS.filter((r) => !visited.includes(r.id)), [visited]);

  useEffect(() => {
    if (!missing.length) return undefined;
    const t = setInterval(() => setBlink((b) => !b), 520);
    return () => clearInterval(t);
  }, [missing.length]);

  const curPV = p ? obj.vals[p] ?? 0 : 0;
  const curC = coefOf(obj);
  const curD = curC ? discriminant(curC[0], curC[1], curC[2]) : 0;

  /** 紫色十字：你现在站在哪一列（参数取到哪儿）、哪一行（Δ 落在哪儿） */
  const curCol = Math.max(
    0,
    Math.min(COLS - 1, Math.round(((curPV - axisMin) / (axisMax - axisMin)) * COLS - 0.5))
  );
  const curRow = useMemo(() => {
    let best = Math.floor(ROWS / 2);
    for (let j = 0; j < ROWS; j += 1) {
      if (Math.abs(dAt(j, spanEff) - curD) < Math.abs(dAt(best, spanEff) - curD)) best = j;
    }
    return best;
  }, [curD, spanEff]);

  const setSlotValue = (slot: CoefSlot, v: number) => patch(setCoef(obj, slot.key, v));

  /** 把某一项变成参数并拿它当地图横轴（已经是参数的就直接切过去） */
  const useAsAxis = (slot: CoefSlot) => {
    if (slot.param) {
      patch({ focusP: slot.param });
      return;
    }
    patch(setCoef(obj, slot.key, slot.value));
  };

  const commit = (c: Cell) => {
    if (p) patch({ vals: { ...obj.vals, [p]: c.pv } });
    if (c.trace) setCrit(c);
    if (visited.includes(c.k)) {
      setDup(`「${MAP_REGIONS.find((r) => r.id === c.k)?.name}」这种情形你已经走过了 —— 每种情况走一遍就好，不用重复。`);
    } else {
      setDup(null);
      setVisited((prev) => [...prev, c.k]);
    }
    if (c.k === 'empty') fireProbe('p-empty');
    if (c.k === 'inside') fireProbe('p-rootpos');
  };

  const region = (id: MapCaseId) => MAP_REGIONS.find((r) => r.id === id);
  const colW = (axisMax - axisMin) / COLS;

  return (
    <Zone
      tag="试参数"
      title="参数地图"
      sub="三项系数都能拖。横着是某个参数，竖着是 Δ；每一格里都画着「解集 A」和「参照集合 B」——谁装得进谁，一眼看清。"
      color={colors.cyan}
    >
      <View style={{ opacity: locked ? 0.6 : 1 }}>
        {slots.length ? (
          <Box tone="soft">
            <Text style={styles.resTitle}>每一项都拖得动（拖一下，数字就变成参数）</Text>
            {slots.map((slot) => (
              <View key={slot.key} style={styles.knob}>
                <View style={styles.knobHead}>
                  <Text style={styles.knobName}>{slot.name}</Text>
                  <Text style={styles.knobTerm}>{slot.term}</Text>
                  <View style={{ flex: 1 }} />
                  <Pressable
                    style={styles.stepBtn}
                    onPress={() => setSlotValue(slot, slot.value - slot.step)}
                    accessibilityRole="button"
                    accessibilityLabel={`${slot.name}减一点`}
                  >
                    <Ionicons name="remove" size={13} color={colors.inkSoft} />
                  </Pressable>
                  <Text style={styles.knobVal}>{fmt(slot.value)}</Text>
                  <Pressable
                    style={styles.stepBtn}
                    onPress={() => setSlotValue(slot, slot.value + slot.step)}
                    accessibilityRole="button"
                    accessibilityLabel={`${slot.name}加一点`}
                  >
                    <Ionicons name="add" size={13} color={colors.inkSoft} />
                  </Pressable>
                </View>
                <ParamStrip
                  height={26}
                  value={slot.value}
                  min={slot.min}
                  max={slot.max}
                  segColors={stripColorsFor(slot)}
                  ends={[`${fmt(slot.min)}`, `${fmt(slot.max)}`]}
                  onChange={(v) => setSlotValue(slot, v)}
                />
              </View>
            ))}
            {slots.length > 1 ? (
              <>
                <Text style={styles.axisPick}>地图横轴用哪一项：</Text>
                <View style={styles.entryRow}>
                  {slots.map((slot) => (
                    <Chip
                      key={slot.key}
                      label={slot.name}
                      on={!!slot.param && slot.param === p}
                      onPress={() => useAsAxis(slot)}
                      color={colors.cyan}
                    />
                  ))}
                </View>
              </>
            ) : null}
            <Note text="拖的时候盯住右边的图和曲线：解集的端点会先冲出去一点再弹回来，这就是含参的端点。" icon="sparkles-outline" />
          </Box>
        ) : (
          <Note text="这个式子不是二次式（比如是绝对值），三项系数就没有了 —— 直接看右边的图。" icon="information-circle-outline" />
        )}

        {p ? (
          <>
            <Text style={styles.mapTitle}>地图横轴：{p}（{fmt(axisMin)} → {fmt(axisMax)}），竖轴：Δ</Text>
            <Box tone="soft">
              <ParamStrip
                label={`按住这条滑轨左右拖 ${p} = ${fmt(curPV)}`}
                value={curPV}
                min={axisMin}
                max={axisMax}
                segColors={stripColors}
                ends={[`${fmt(axisMin)}`, `${fmt(axisMax)}`]}
                onChange={(v) => patch({ focusP: p, vals: { ...obj.vals, [p]: v } })}
              />
            </Box>

            <View style={styles.howBox}>
              <Text style={styles.howLine}>· 按住一格：先在右边预览「这个参数下解集长什么样」</Text>
              <Text style={styles.howLine}>· 点一下：参数就取这一格的值，右区的图和数轴跟着变</Text>
              <Text style={styles.howLine}>· 紫色十字 = 你现在站的地方；深边框的格子 = 真实曲线 Δ 经过的</Text>
            </View>
            <View style={styles.map}>
              {p ? (
                <>
                  <View
                    style={[styles.crossV, { left: `${(curCol * 100) / COLS}%`, width: `${100 / COLS}%` }]}
                    pointerEvents="none"
                  />
                  <View
                    style={[styles.crossH, { top: `${(curRow * 100) / ROWS}%`, height: `${100 / ROWS}%` }]}
                    pointerEvents="none"
                  />
                </>
              ) : null}
              {cells.map((c) => {
                const rg = region(c.k);
                const base = rg?.color ?? colors.line;
                const col = cells.filter((x) => Math.abs(x.pv - c.pv) < 1e-9);
                const nearRow = col.reduce(
                  (best, x) => (Math.abs(x.d - curD) < Math.abs(best.d - curD) ? x : best),
                  col[0]
                );
                const isHere = Math.abs(curPV - c.pv) < colW / 2 + 1e-9 && nearRow?.key === c.key;
                const miss = missing.some((m) => m.id === c.k);
                const done = visited.includes(c.k);
                const on = picked?.key === c.key;
                return (
                  <Pressable
                    key={c.key}
                    style={[
                      styles.cell,
                      { backgroundColor: `${base}14` },
                      done && { backgroundColor: `${base}4d` },
                      c.trace && styles.cellTrace,
                      miss && { opacity: blink ? 0.4 : 0.95, borderColor: colors.red, borderWidth: 1 },
                      isHere && styles.cellHere,
                      on && styles.cellPicked,
                      showLayer && c.prod > 0 && styles.prodPos,
                      showLayer && c.prod < 0 && styles.prodNeg,
                    ]}
                    onPressIn={() => onPreview({ ...obj.vals, [p]: c.pv }, rg?.name ?? '?')}
                    onPressOut={() => onPreview(null, null)}
                    onPress={() => {
                      onPreview(null, null);
                      setPicked(c);
                      commit(c);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={`${p} = ${fmt(c.pv)}，Δ = ${fmt(c.d)}，${rg?.name ?? ''}`}
                  >
                    <RelGlyph iv={c.iv} box={box} win={win} color={base} />
                  </Pressable>
                );
              })}
              {box ? (
                <View
                  style={[
                    styles.guide,
                    {
                      left: `${Math.max(0, Math.min(1, (box.lo - win.lo) / (win.hi - win.lo))) * 100}%`,
                      width: `${
                        Math.max(
                          2,
                          (Math.min(1, (box.hi - win.lo) / (win.hi - win.lo)) -
                            Math.max(0, (box.lo - win.lo) / (win.hi - win.lo))) * 100
                        )
                      }%`,
                    },
                  ]}
                />
              ) : null}
            </View>
            {box ? (
              <Text style={styles.guideFoot}>
                中间那条浅蓝的竖带就是 B = [{fmt(box.lo)}, {fmt(box.hi)}]：彩条整段落在轨道里才是「装得进」，探出去一点点（带箭头）就是「装不进」。
              </Text>
            ) : null}

            {picked && p ? (
              <View style={styles.pickBox}>
                <View style={styles.pickGlyph}>
                  <RelGlyph
                    iv={picked.iv}
                    box={box}
                    win={win}
                    color={region(picked.k)?.color ?? colors.line}
                    glyphStyle="legend"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.pickHead}>
                    刚点的这一格：{p} = {fmt(picked.pv)}，Δ = {fmt(picked.d)} · {region(picked.k)?.name}
                  </Text>
                  <Text style={styles.pickText}>{cellStory(picked, box, p)}</Text>
                </View>
                <Pressable
                  style={styles.pickBack}
                  onPress={() => patch({ focusP: p, vals: { ...obj.vals, [p]: picked.pv } })}
                  accessibilityRole="button"
                  accessibilityLabel="再回到这一格"
                >
                  <Ionicons name="arrow-back-outline" size={14} color={colors.purple} />
                  <Text style={styles.pickBackText}>再回到这一格</Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.pickHint}>
                <Ionicons name="hand-left-outline" size={13} color={colors.faint} />
                <Text style={styles.pickHintText}>随便点一格，这里会把那一格讲清楚</Text>
              </View>
            )}

            <View style={styles.axisRow}>
              <Text style={styles.axisText}>横着看：{p} 从 {fmt(axisMin)} 到 {fmt(axisMax)}</Text>
              <Text style={styles.axisText}>
                竖着看：Δ 从上到下是{' '}
                {Array.from({ length: ROWS }, (_, j) => fmt(dAt(j, spanEff))).join(' · ')}
                {zoom ? '（现在放大到 Δ ≈ 0 的临界带）' : ''}（正中间那一行是重根）
              </Text>
            </View>
            <View style={styles.entryRow}>
              <Chip
                label={zoom ? '竖轴：看全景' : '竖轴：放大到 Δ ≈ 0 附近'}
                on={zoom}
                onPress={() => setZoom(!zoom)}
                color={colors.cyan}
                icon="resize-outline"
              />
            </View>

            {bE ? (
              <Box tone="soft">
                <Text style={styles.resTitle}>参照集合 B 的两条边也拖得动</Text>
                {(['lo', 'hi'] as const).map((w) => {
                  const val = w === 'lo' ? bE.lo : bE.hi;
                  const colors12: string[] = [];
                  for (let i = 0; i < COLS; i += 1) {
                    const v = -6 + (12 * (i + 0.5)) / COLS;
                    colors12.push(bEndFits(obj, w, v) ? '#1fa97a' : '#e5524a');
                  }
                  return (
                    <View key={w} style={styles.knob}>
                      <View style={styles.knobHead}>
                        <Text style={styles.knobName}>{w === 'lo' ? 'B 的左端' : 'B 的右端'}</Text>
                        <View style={{ flex: 1 }} />
                        <Pressable
                          style={styles.stepBtn}
                          onPress={() => patch(setBEnd(obj, w, val - B_STEP))}
                          accessibilityRole="button"
                          accessibilityLabel={`B 的${w === 'lo' ? '左端' : '右端'}往左挪`}
                        >
                          <Ionicons name="remove" size={13} color={colors.inkSoft} />
                        </Pressable>
                        <Text style={styles.knobVal}>{fmt(val)}</Text>
                        <Pressable
                          style={styles.stepBtn}
                          onPress={() => patch(setBEnd(obj, w, val + B_STEP))}
                          accessibilityRole="button"
                          accessibilityLabel={`B 的${w === 'lo' ? '左端' : '右端'}往右挪`}
                        >
                          <Ionicons name="add" size={13} color={colors.inkSoft} />
                        </Pressable>
                      </View>
                      <ParamStrip
                        height={26}
                        value={val}
                        min={-6}
                        max={6}
                        segColors={colors12}
                        ends={['−6', '6']}
                        onChange={(v) => patch(setBEnd(obj, w, v))}
                      />
                    </View>
                  );
                })}
                <Note
                  text="绿的一段 = 那一边拖过去之后，现在的解集 A 还装得进 B；红的一段 = 一拖就漏出去了。B 一动，「装得进」的那片和答案的端点都跟着挪。"
                  icon="swap-horizontal-outline"
                />
              </Box>
            ) : null}

            <View style={styles.legendRow}>
              {[
                { iv: box ? { lo: box.lo + 0.25, hi: box.hi - 0.25 } : null, color: '#1fa97a', txt: '装得进 B' },
                { iv: null, color: '#2fa7e8', txt: '空集' },
                {
                  iv: box ? { lo: box.lo - 0.6, hi: box.hi + 0.7 } : null,
                  color: '#e5524a',
                  txt: '伸到 B 外面',
                },
              ].map((it, i) => (
                <View key={i} style={styles.legendItem}>
                  <View style={styles.legendBox}>
                    <RelGlyph iv={it.iv} box={box} win={win} color={it.color} glyphStyle="legend" />
                  </View>
                  <Text style={styles.legendText}>{it.txt}</Text>
                </View>
              ))}
            </View>
            <Text style={styles.legendFoot}>
              每一格里：上面那条浅色轨道（两端的竖线就是它的端点）是固定不动的参照集合 B，下面那条彩条是这一格参数下的解集 A（图例里那两个小圆点就是解集的端点）。彩条整段落在轨道里 = ✓，探出去的那一段是半透明的、还带一个指出去的箭头 = ✗，没有彩条只有 ∅ = 空集。
            </Text>

            <View style={styles.entryRow}>
              {MAP_REGIONS.map((r) => {
                const hit = visited.includes(r.id);
                return (
                  <Chip
                    key={r.id}
                    label={`${r.short} ${r.name}`}
                    on={hit}
                    onPress={() => {
                      const cell = cells.find((c) => c.k === r.id);
                      if (cell) commit(cell);
                    }}
                    color={r.color}
                  />
                );
              })}
              <Chip
                label={showLayer ? '收起根的正负' : '看看根的正负'}
                on={showLayer}
                onPress={() => setShowLayer(!showLayer)}
                color={colors.green}
                icon="analytics-outline"
              />
            </View>

            <Box tone="soft">
              <Text style={styles.resTitle}>三种情形，已经走过 {visited.length} / {MAP_REGIONS.length}</Text>
              {visited.length ? (
                <View style={styles.pathRow}>
                  {visited.map((v, i) => (
                    <View key={`${v}${i}`} style={styles.pathItem}>
                      <Text style={[styles.pathText, { color: region(v)?.color }]}>
                        {i + 1}. {region(v)?.name}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : (
                <Note text="先在地图上点几格：点过的地方会留下一串脚印。" icon="walk-outline" />
              )}
              {missing.length ? (
                <View style={styles.missBox}>
                  <Text style={styles.missTitle}>还有 {missing.length} 种情形没走到（地图上的空洞正在闪）：</Text>
                  {missing.map((m) => (
                    <Text key={m.id} style={styles.missText}>
                      · {m.name}：{m.desc}
                    </Text>
                  ))}
                </View>
              ) : (
                <Note
                  text="✓ 三种情形都走到了，既不重复也没漏 —— 可以把两支的答案合起来了。"
                  tone="good"
                  icon="checkmark-done-outline"
                />
              )}
              {dup ? <Note text={dup} tone="warn" icon="repeat-outline" /> : null}
            </Box>

            {crit ? (
              <Box tone="warn">
                <Text style={styles.resTitle}>正好在边界上 · {p} ≈ {fmt(crit.pv)}，Δ ≈ {fmt(crit.d)}</Text>
                <Text style={styles.critText}>
                  这一格刚好落在真实曲线 Δ = Δ({p}) 上，也就是真会被取到的情形。
                  {'\n'}边界值一定要代回去验一验：{p} ≈ {fmt(crit.pv)} 时，解集的端点正好贴在 B 的边上，再走一点点就漏出去了。
                </Text>
                <View style={styles.entryRow}>
                  <Chip
                    label="就停在这一格"
                    onPress={() => {
                      patch({ vals: { ...obj.vals, [p]: crit.pv } });
                      fireProbe('p-endpoint');
                    }}
                    color={colors.orange}
                    icon="flag-outline"
                  />
                  <Chip label="收起" onPress={() => setCrit(null)} color={colors.faint} />
                </View>
              </Box>
            ) : (
              <Note text="点深边框的格子（真实曲线经过的那些），能打开边界值的专项练习。" icon="flag-outline" />
            )}

            {showLayer ? (
              <Note
                text="格子顶边是绿的，说明两根同号；是红的，说明一正一负 —— 一眼看出根的正负。"
                icon="git-network-outline"
              />
            ) : null}
          </>
        ) : (
          <Note
            text="现在三项都是固定的数字，地图没有横轴可走 —— 上面随便拖一项，那一项立刻变成可调参数，地图就有了。"
            icon="hand-left-outline"
          />
        )}
      </View>
    </Zone>
  );
}

function fmt(v: number): string {
  return String(Math.round(v * 100) / 100);
}

const styles = StyleSheet.create({
  resTitle: { fontSize: 11.5, fontWeight: '800', color: colors.faint, letterSpacing: 0.3 },
  knob: { marginTop: 9 },
  knobHead: { flexDirection: 'row', alignItems: 'center' },
  knobName: { fontSize: 12, fontWeight: '800', color: colors.ink },
  knobTerm: { fontSize: 10.5, color: colors.faint, marginLeft: 6, fontWeight: '600' },
  knobVal: {
    minWidth: 40,
    textAlign: 'center',
    fontSize: 12.5,
    fontWeight: '800',
    color: colors.accent,
  },
  stepBtn: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#EEF3FB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  axisPick: { fontSize: 11.5, fontWeight: '700', color: colors.inkSoft, marginTop: 10 },
  mapTitle: { fontSize: 11.5, fontWeight: '700', color: colors.inkSoft, marginTop: 10 },
  map: {
    position: 'relative',
    flexDirection: 'row',
    flexWrap: 'wrap',
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: '#FBFCFF',
    marginTop: 6,
  },
  cell: {
    width: `${100 / COLS}%`,
    aspectRatio: 1,
    borderWidth: 0.4,
    borderColor: '#EAF0F8',
    borderRadius: 3,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 2,
  },
  cellTrace: { borderWidth: 1.5, borderColor: colors.ink },
  cellPicked: { borderWidth: 2, borderColor: colors.purple, borderRadius: 5 },
  /** 紫色十字：你现在站在哪一列 / 哪一行 */
  crossV: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(124,90,214,0.10)',
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: 'rgba(124,90,214,0.38)',
  },
  crossH: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: 'rgba(124,90,214,0.07)',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(124,90,214,0.3)',
  },
  howBox: {
    marginTop: 8,
    borderRadius: 10,
    backgroundColor: '#F4F7FD',
    borderWidth: 1,
    borderColor: '#E4EAF6',
    padding: 8,
  },
  howLine: { fontSize: 10.5, color: colors.sub, lineHeight: 17, fontWeight: '600' },
  guide: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    pointerEvents: 'none',
    borderLeftWidth: 1.5,
    borderRightWidth: 1.5,
    borderColor: '#7E97BC',
    backgroundColor: 'rgba(140,168,205,0.10)',
  },
  guideFoot: { fontSize: 10.5, color: colors.sub, lineHeight: 16, marginTop: 6 },
  cellHere: { borderWidth: 2.4, borderColor: colors.purple },
  prodPos: { borderTopColor: colors.green, borderTopWidth: 1.6 },
  prodNeg: { borderTopColor: colors.red, borderTopWidth: 1.6 },
  /** 参照集合 B：浅色轨道 + 两端的端点竖线 */
  gTrack: { position: 'absolute', top: '15%', height: '21%', backgroundColor: '#E4EAF5', borderRadius: 2 },
  gTrackBig: { top: '13%', height: '24%', borderRadius: 3 },
  gEnd: { position: 'absolute', top: 0, bottom: 0, width: 1.6, backgroundColor: '#93A6C2', borderRadius: 1 },
  gEndBig: { width: 2.2 },
  /** 解集 A 落在 B 里的那一段：实心条（图例里还会点上两个端点圆点） */
  gIn: { position: 'absolute', top: '52%', height: '30%', borderRadius: 2 },
  gInBig: { top: '50%', height: '34%', borderRadius: 3 },
  /** 探出去的那一段：半透明 + 一个指出去的箭头 */
  gOut: { position: 'absolute', top: '55%', height: '24%', opacity: 0.4, borderRadius: 1 },
  gOutBig: { top: '53%', height: '28%', borderRadius: 2 },
  gDot: {
    position: 'absolute',
    top: '67%',
    width: 4.5,
    height: 4.5,
    borderRadius: 2.5,
    borderWidth: 0.9,
    borderColor: '#fff',
    transform: [{ translateX: -2.2 }, { translateY: -2.2 }],
  },
  gArrow: {
    position: 'absolute',
    top: '67%',
    fontSize: 9,
    fontWeight: '800',
    transform: [{ translateY: -7 }],
  },
  emptyGlyph: {
    position: 'absolute',
    top: '42%',
    left: 0,
    right: 0,
    textAlign: 'center',
    fontSize: 10,
    fontWeight: '800',
  },
  /** 点过一格之后的即时讲解 */
  pickBox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2D9F6',
    backgroundColor: '#F8F5FF',
    padding: 8,
  },
  pickGlyph: {
    width: 34,
    height: 34,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: '#fff',
    marginRight: 8,
  },
  pickHead: { fontSize: 11.5, fontWeight: '800', color: colors.ink, lineHeight: 16 },
  pickText: { fontSize: 11, color: colors.sub, lineHeight: 17, marginTop: 2 },
  pickBack: { flexDirection: 'row', alignItems: 'center', paddingLeft: 6 },
  pickBackText: { fontSize: 10.5, fontWeight: '700', color: colors.purple, marginLeft: 2 },
  pickHint: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  pickHintText: { fontSize: 10.5, color: colors.faint, fontWeight: '600', marginLeft: 4 },
  axisRow: { marginTop: 6 },
  axisText: { fontSize: 10.5, color: colors.faint, fontWeight: '600', lineHeight: 16 },
  legendRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 },
  legendItem: { flexDirection: 'row', alignItems: 'center', marginRight: 12, marginBottom: 4 },
  legendBox: {
    width: 30,
    height: 30,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: '#F7FAFF',
    marginRight: 6,
  },
  legendText: { fontSize: 11, fontWeight: '700', color: colors.inkSoft },
  legendFoot: { fontSize: 10.5, color: colors.sub, lineHeight: 16, marginTop: 4 },
  entryRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 6 },
  pathRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 6 },
  pathItem: { marginRight: 10, marginBottom: 4 },
  pathText: { fontSize: 11.5, fontWeight: '700' },
  missBox: { backgroundColor: '#FDEDED', borderRadius: 10, padding: 8, marginTop: 8 },
  missTitle: { fontSize: 11.5, fontWeight: '800', color: colors.red },
  missText: { fontSize: 11, color: colors.inkSoft, lineHeight: 17, marginTop: 3 },
  critText: { fontSize: 11.5, color: colors.inkSoft, lineHeight: 17, marginTop: 4 },
});
