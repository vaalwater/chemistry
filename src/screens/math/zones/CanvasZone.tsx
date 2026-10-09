import { useCallback, useMemo, useState } from 'react';
import { PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../../theme';
import SetNumberLine, { type LineBand } from '../../../components/SetNumberLine';
import SetVenn from '../../../components/SetVenn';
import RatioSlider from '../../../components/RatioSlider';
import FunctionGraph from '../../../components/FunctionGraph';
import {
  REAL,
  complement,
  diff,
  endpoints,
  fmtNum,
  fmtSet,
  fmtSetBuilder,
  intersect,
  isEmpty,
  quadraticRoots,
  union,
  type RealSet,
} from '../../../math/setCore';
import {
  boundsOf,
  coefOf,
  conclude,
  evalA,
  evalB,
  graphFnOf,
  mainParam,
  membership,
  samplePoints,
  violationOf,
  type MathObj,
} from '../../../math/setObject';
import { Box, Chip, Note, Zone, useSpringNumber } from './kit';

type Proj = 'graph' | 'line' | 'venn' | 'plane';

export const C_A = '#2f6fed';
export const C_B = '#e2a02f';
export const C_INTER = '#1fa97a';
export const C_UNION = '#f08a3c';
export const C_COMP = '#8a63d2';
export const C_BAD = '#e5524a';

interface Props {
  obj: MathObj;
  /** 左区手指按住的那一格 */
  previewVals?: Record<string, number> | null;
  previewLabel?: string | null;
  /** 右区还没补的条件 */
  unresolved: string[];
  locked?: boolean;
  fireProbe: (pid: string) => void;
}

/** 中区：一个画布，四种看法 —— 函数曲线 / 数轴 / Venn / 平面区域 */
export default function CanvasZone({ obj, previewVals, previewLabel, unresolved, locked, fireProbe }: Props) {
  const [proj, setProj] = useState<Proj>('graph');

  return (
    <Zone tag="看图" title="函数与解集" sub="把不等式画成一条曲线：曲线落在要求的那一侧时，x 的范围就是解" color={colors.accent}>
      <View style={styles.projRow}>
        <Chip label="函数曲线" on={proj === 'graph'} onPress={() => setProj('graph')} color={colors.accent} icon="analytics-outline" />
        <Chip label="数轴" on={proj === 'line'} onPress={() => setProj('line')} color={colors.accent} icon="remove-outline" />
        <Chip
          label="Venn 图"
          on={proj === 'venn'}
          onPress={() => {
            setProj('venn');
            fireProbe('p-level');
          }}
          color={colors.purple}
          icon="ellipse-outline"
        />
        <Chip label="平面区域" on={proj === 'plane'} onPress={() => setProj('plane')} color={colors.green} icon="grid-outline" />
      </View>

      {proj === 'graph' ? (
        <GraphPart obj={obj} previewVals={previewVals} previewLabel={previewLabel} unresolved={unresolved} locked={locked} />
      ) : null}
      {proj === 'line' ? (
        <LinePart obj={obj} previewVals={previewVals} previewLabel={previewLabel} unresolved={unresolved} locked={locked} />
      ) : null}
      {proj === 'venn' ? <VennPart obj={obj} locked={locked} fireProbe={fireProbe} /> : null}
      {proj === 'plane' ? <PlanePart /> : null}
    </Zone>
  );
}

/* ------------------------------------------------------------------ *
 * 函数曲线
 * ------------------------------------------------------------------ */

function usable(s: RealSet): number[] {
  return endpoints(s).filter((v) => Number.isFinite(v));
}

function viewRange(o: MathObj, vals: Record<string, number>) {
  const A = evalA(o, vals);
  const B = evalB(o);
  const c = coefOf(o, vals);
  const pts: number[] = [];
  if (c && Math.abs(c[0]) > 1e-9) {
    const ax = -c[1] / (2 * c[0]);
    pts.push(ax, ax - 2, ax + 2);
    quadraticRoots(c[0], c[1], c[2]).forEach((r) => pts.push(r));
  }
  usable(A).forEach((v) => pts.push(v));
  usable(B).forEach((v) => pts.push(v));
  if (o.quant !== 'none') usable(o.domain).forEach((v) => pts.push(v));
  pts.push(-2, 2);
  let lo = Math.min(...pts) - 1.2;
  let hi = Math.max(...pts) + 1.2;
  if (hi - lo < 5) {
    const mid = (hi + lo) / 2;
    lo = mid - 2.5;
    hi = mid + 2.5;
  }
  return { lo: Math.max(-40, lo), hi: Math.min(40, hi) };
}

function GraphPart({
  obj,
  previewVals,
  previewLabel,
  unresolved,
  locked,
}: {
  obj: MathObj;
  previewVals?: Record<string, number> | null;
  previewLabel?: string | null;
  unresolved: string[];
  locked?: boolean;
}) {
  const p = mainParam(obj);
  const raw = p ? obj.vals[p] ?? 0 : 0;
  const sprung = useSpringNumber(raw);
  const dvals = useMemo(() => (p ? { ...obj.vals, [p]: sprung } : obj.vals), [p, sprung, obj.vals]);

  const A = useMemo(() => evalA(obj, dvals), [obj, dvals]);
  const B = useMemo(() => evalB(obj), [obj]);
  const bad = useMemo(() => violationOf(obj, dvals), [obj, dvals]);
  const verdict = conclude(obj, dvals);
  const fn = graphFnOf(obj, dvals);
  const c = coefOf(obj, dvals);
  const box = boundsOf(B);

  const range = useMemo(() => viewRange(obj, dvals), [obj, dvals]);
  // 绝对值图像的交点其实就是解集的两个端点
  const roots = c
    ? quadraticRoots(c[0], c[1], c[2])
    : fn && fn.kind === 'abs'
      ? usable(A)
      : [];
  const symAxis = c && Math.abs(c[0]) > 1e-9 ? -c[1] / (2 * c[0]) : null;
  const vertex = fn && symAxis !== null ? { x: symAxis, y: fn.f(symAxis) } : null;

  const marks = roots.map((r, i) => ({
    x: r,
    label: roots.length > 1 ? `x${i + 1}` : 'x₀',
    color: colors.accent,
  }));
  if (box) {
    marks.push({ x: box.lo, label: 'B左', color: C_B });
    marks.push({ x: box.hi, label: 'B右', color: C_B });
  }

  const compare = obj.op === 'subset' || obj.op === 'intersect' || obj.op === 'diff';
  const opChar = (obj.source.match(/(<=|>=|≤|≥|<|>)/) || [''])[1] || '<=';
  const wantBelow = opChar === '<=' || opChar === '<' || opChar === '≤';
  const sideTxt =
    fn && fn.kind === 'abs'
      ? wantBelow
        ? '压在水平线下方（含交点）'
        : '伸到水平线上方（含交点）'
      : wantBelow
        ? '落在 x 轴下方（含交点）'
        : '落在 x 轴上方（含交点）';

  return (
    <View style={{ opacity: locked ? 0.6 : 1 }}>
      {fn ? (
        <>
          <Text style={styles.fnLabel}>{fn.label}</Text>
          <FunctionGraph
            f={fn.f}
            xLo={range.lo}
            xHi={range.hi}
            solution={A}
            bad={obj.op === 'subset' || obj.goal === 'hold' ? bad : null}
            refBox={compare && box ? box : null}
            marks={marks}
            axis={fn.kind === 'quad' ? symAxis : null}
            vertex={fn.kind === 'quad' ? vertex : null}
            color={C_A}
            height={196}
          />
          <View style={styles.legendRow}>
            <Text style={styles.legendTxt}>
              <Text style={{ color: C_A }}>▬</Text> 曲线　<Text style={{ color: C_A }}>▬</Text>
              轴上的蓝带 = 解集 A
            </Text>
            {compare && box ? <Text style={styles.legendTxt}>黄色框 = B = {fmtSet(B)}</Text> : null}
            {!isEmpty(bad) ? <Text style={styles.legendTxt}>红色 = 跑出去 / 没照顾到的那一段</Text> : null}
          </View>

          <Box tone="soft">
            <Text style={styles.resTitle}>这张图在说什么</Text>
            <Text style={styles.readText}>
              解集 A = {fmtSet(A)}
              {isEmpty(A) ? '（空集 ∅）' : ''}
            </Text>
            <Text style={styles.detail}>
              看曲线和 x 轴的位置关系：曲线{sideTxt}的那一段 x 就是解，图上用轴上的粗蓝带画出来了。
            </Text>
            {compare && box ? (
              <Text style={styles.detail}>
                黄框是 B。蓝带整段都在黄框里，才叫 A ⊆ B；蓝带一旦伸出黄框（红色那段），这一支就要舍去。
              </Text>
            ) : null}
            {fn.kind === 'quad' && symAxis !== null ? (
              <Text style={styles.detail}>对称轴 x = {fmtNum(symAxis)}，顶点在图上用橙点标出 —— 根分布离不开这两个位置。</Text>
            ) : null}
            {fn.kind === 'abs' ? <Text style={styles.detail}>绝对值图像是 V 字形：把它和水平线比一比，就看出解是中间一段还是两边。</Text> : null}
            {verdict.text ? (
              <View style={styles.verdictRow}>
                <Ionicons name={verdict.ok ? 'checkmark-circle' : 'close-circle'} size={13} color={verdict.ok ? colors.green : colors.red} />
                <Text style={[styles.verdictText, { color: verdict.ok ? colors.green : colors.red }]}>{verdict.text}</Text>
              </View>
            ) : null}
            {isEmpty(A) ? (
              <Note
                text="曲线整个悬在 x 轴上方，一个交点都没有 —— 这时 A 是空集 ∅。空集是任何集合的子集，所以 A ⊆ B 照样成立。"
                tone="warn"
                icon="alert-circle-outline"
              />
            ) : null}
            {previewLabel ? (
              <Note text={`左区正按着「${previewLabel}」这一格：这里的曲线就是那个参数下的样子（半透明预览）。`} icon="eye-outline" />
            ) : null}
            {unresolved.map((t) => (
              <Note key={t} text={t} tone="bad" icon="warning-outline" />
            ))}
          </Box>
        </>
      ) : (
        <Box tone="soft">
          <Text style={styles.detail}>
            这个条件暂时画不成曲线（比如它只是一个区间）。可以直接看「数轴」那一档，或者在上面换一个含 x² 的条件试试。
          </Text>
        </Box>
      )}
    </View>
  );
}

/* ------------------------------------------------------------------ *
 * 数轴
 * ------------------------------------------------------------------ */

function LinePart({
  obj,
  previewVals,
  previewLabel,
  unresolved,
  locked,
}: {
  obj: MathObj;
  previewVals?: Record<string, number> | null;
  previewLabel?: string | null;
  unresolved: string[];
  locked?: boolean;
}) {
  const p = mainParam(obj);
  const raw = p ? obj.vals[p] ?? 0 : 0;
  const sprung = useSpringNumber(raw);
  const dvals = useMemo(() => (p ? { ...obj.vals, [p]: sprung } : obj.vals), [p, sprung, obj.vals]);

  const A = useMemo(() => evalA(obj, dvals), [obj, dvals]);
  const B = useMemo(() => evalB(obj), [obj]);
  const bad = useMemo(() => violationOf(obj, dvals), [obj, dvals]);
  const previewSet = previewVals ? evalA(obj, previewVals) : null;
  const verdict = conclude(obj, dvals);

  const bands = useMemo<LineBand[]>(() => {
    const out: LineBand[] = [{ key: 'A', set: A, color: C_A, label: 'A' }];
    if (obj.op !== 'single') out.push({ key: 'B', set: B, color: C_B, label: 'B' });
    if (obj.op === 'intersect') out.push({ key: 'i', set: intersect(A, B), color: C_INTER, label: 'A∩B' });
    if (obj.op === 'union') out.push({ key: 'u', set: union(A, B), color: C_UNION, label: 'A∪B' });
    if (obj.op === 'diff') out.push({ key: 'd', set: diff(A, B), color: C_COMP, label: 'A\\B' });
    if (obj.op === 'comp') {
      out.push({
        key: 'c',
        set: complement(A, obj.quant === 'none' ? REAL : obj.domain),
        color: C_COMP,
        label: '∁A',
        hatch: true,
      });
    }
    if (obj.op === 'subset' || obj.goal === 'hold') {
      if (!isEmpty(bad)) out.push({ key: 'bad', set: bad, color: C_BAD, label: '多出来的', hatch: true });
    }
    if (previewSet && !isEmpty(previewSet)) {
      out.push({ key: 'pv', set: previewSet, color: C_A, label: '预览', opacity: 0.3 });
    }
    return out;
  }, [A, B, bad, previewSet, obj.op, obj.quant, obj.domain, obj.goal]);

  const geo = useMemo(() => {
    const c = coefOf(obj, dvals);
    const axisSource: number[] = [];
    if (c && Math.abs(c[0]) > 1e-9) axisSource.push(-c[1] / (2 * c[0]));
    const all = [...usable(A), ...usable(B), ...axisSource];
    if (obj.quant !== 'none') all.push(...usable(obj.domain));
    let lo = Math.min(-2, ...all) - 1.2;
    let hi = Math.max(2, ...all) + 1.2;
    if (hi - lo < 4) hi = lo + 4;
    return { lo: Math.max(-40, lo), hi: Math.min(40, hi), axis: c && Math.abs(c[0]) > 1e-9 ? -c[1] / (2 * c[0]) : null };
  }, [A, B, obj, dvals]);

  const marks = useMemo(() => {
    const set = new Set<number>([0, 1]);
    usable(B).forEach((v) => set.add(v));
    if (obj.quant !== 'none') usable(obj.domain).forEach((v) => set.add(v));
    if (geo.axis !== null) set.add(Math.round(geo.axis * 100) / 100);
    return Array.from(set).filter((v) => v > geo.lo && v < geo.hi);
  }, [B, obj, geo]);

  return (
    <View style={{ opacity: locked ? 0.6 : 1 }}>
      <Text style={styles.projHint}>把同一件事压到一条数轴上：实心点表示取得到，空心点表示取不到。</Text>
      <SetNumberLine min={geo.lo} max={geo.hi} bands={bands} marks={marks} />

      <Box tone="soft">
        <Text style={styles.resTitle}>读数</Text>
        <Row k="A" v={`${fmtSet(A)}　（${fmtSetBuilder(A)}）`} color={C_A} />
        {obj.op !== 'single' ? <Row k="B" v={fmtSet(B)} color={C_B} /> : null}
        {verdict.text ? (
          <View style={styles.verdictRow}>
            <Ionicons name={verdict.ok ? 'checkmark-circle' : 'close-circle'} size={13} color={verdict.ok ? colors.green : colors.red} />
            <Text style={[styles.verdictText, { color: verdict.ok ? colors.green : colors.red }]}>{verdict.text}</Text>
          </View>
        ) : null}
        {previewLabel ? <Note text={`左区正按着「${previewLabel}」这一格：浅色那段就是那个参数下的解。`} icon="eye-outline" /> : null}
        {isEmpty(A) ? (
          <Note text="这一段收缩成一个点、然后消失 —— 这就是空集 ∅。空集是任何集合的子集，包含关系照样成立。" tone="warn" icon="alert-circle-outline" />
        ) : null}
        {unresolved.map((t) => (
          <Note key={t} text={t} tone="bad" icon="warning-outline" />
        ))}
      </Box>
    </View>
  );
}

function Row({ k, v, color }: { k: string; v: string; color?: string }) {
  return (
    <View style={styles.rowLine}>
      <Text style={[styles.rowKey, color ? { color } : null]}>{k}</Text>
      <Text style={styles.rowVal}>{v}</Text>
    </View>
  );
}

/* ------------------------------------------------------------------ *
 * Venn 图
 * ------------------------------------------------------------------ */

function regionPoint(sets: string[]): { x: number; y: number } {
  if (sets.includes('A') && sets.includes('B')) return { x: 0.5, y: 0.44 };
  if (sets.includes('A')) return { x: 0.27, y: 0.44 };
  if (sets.includes('B')) return { x: 0.73, y: 0.44 };
  return { x: 0.5, y: 0.85 };
}

function VennPart({
  obj,
  locked,
  fireProbe,
}: {
  obj: MathObj;
  locked?: boolean;
  fireProbe: (pid: string) => void;
}) {
  const pts = useMemo(() => samplePoints(obj), [obj]);
  const elements = useMemo(
    () => pts.map((v) => ({ id: `e${v}`, label: `${v}`, sets: membership(obj, v) })),
    [pts, obj]
  );
  const [tick, setTick] = useState(0);
  const layout = useMemo(() => {
    const m: Record<string, { x: number; y: number }> = {};
    elements.forEach((e) => {
      m[e.id] = regionPoint(e.sets);
    });
    return m;
  }, [elements, tick]);
  const [status, setStatus] = useState<string | null>(null);
  const [openIds, setOpenIds] = useState<string[]>(['U']);

  const onSettle = useCallback(
    (id: string, inside: string[]) => {
      const el = elements.find((e) => e.id === id);
      if (!el) return;
      const same = inside.length === el.sets.length && inside.every((n) => el.sets.includes(n));
      const where = el.sets.length ? `${el.sets.join(' ∩ ')}（且不属于其余集合）` : '两个集合都不属于';
      if (same) setStatus(`✓ ${el.label} 放对了：它在 ${where}。`);
      else {
        setStatus(`✗ ${el.label} 放错了：它其实 ${where}，已经自动吸回正确位置。`);
        fireProbe('p-level');
      }
      setTick((t) => t + 1);
    },
    [elements, fireProbe]
  );

  const toggle = (id: string) =>
    setOpenIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const inA = elements.filter((e) => e.sets.includes('A'));
  const inB = elements.filter((e) => e.sets.includes('B'));

  return (
    <View style={{ opacity: locked ? 0.6 : 1 }}>
      <Text style={styles.projHint}>
        换到集合的视角：一个数属于 A、属于 B，还是两个都属于？拖错位置会自动吸回正确的那块。
      </Text>
      <SetVenn
        names={['A', 'B']}
        elements={elements}
        layout={layout}
        onSettle={onSettle}
        complementOf={obj.op === 'comp' ? 'A' : null}
      />
      {status ? <Note text={status} tone={status.startsWith('✓') ? 'good' : 'bad'} icon="locate-outline" /> : null}

      <Box tone="soft">
        <Text style={styles.resTitle}>层级：∈ 说的是「元素在集合里」，⊆ 说的是「小集合装在大集合里」</Text>
        <TreeNode label="全集 U" depth={0} open={openIds.includes('U')} onToggle={() => toggle('U')} note="所有讨论对象都在 U 里" />
        {openIds.includes('U') ? (
          <>
            <TreeNode label="集合 A" depth={1} open={openIds.includes('A')} onToggle={() => toggle('A')} note={`里面有 ${inA.length} 个代表元素`} />
            {openIds.includes('A')
              ? inA.map((e) => (
                  <TreeNode
                    key={`A${e.id}`}
                    label={`元素 ${e.label}`}
                    depth={2}
                    open={openIds.includes(`A${e.id}`)}
                    onToggle={() => toggle(`A${e.id}`)}
                    note={`${e.label} ∈ A`}
                  />
                ))
              : null}
            {openIds.includes('A')
              ? inA
                  .filter((e) => openIds.includes(`A${e.id}`))
                  .map((e) => (
                    <Text key={`s${e.id}`} style={styles.deepNote}>
                      ↳ {'{'}
                      {e.label}
                      {'}'} ⊆ A —— 多包一层花括号，它就从「一个数」变成了「一个集合」
                    </Text>
                  ))
              : null}
            <TreeNode label="集合 B" depth={1} open={openIds.includes('B')} onToggle={() => toggle('B')} note={`里面有 ${inB.length} 个代表元素`} />
            {openIds.includes('B')
              ? inB.map((e) => (
                  <TreeNode
                    key={`B${e.id}`}
                    label={`元素 ${e.label}`}
                    depth={2}
                    open={false}
                    onToggle={() => undefined}
                    note={`${e.label} ∈ B`}
                  />
                ))
              : null}
          </>
        ) : null}
      </Box>
    </View>
  );
}

function TreeNode({
  label,
  depth,
  open,
  onToggle,
  note,
}: {
  label: string;
  depth: number;
  open: boolean;
  onToggle: () => void;
  note?: string;
}) {
  return (
    <Pressable style={[styles.treeRow, { paddingLeft: depth * 14 }]} onPress={onToggle} accessibilityRole="button">
      <Ionicons name={open ? 'chevron-down' : 'chevron-forward'} size={12} color={colors.faint} />
      <Text style={styles.treeLabel}>{label}</Text>
      {note ? <Text style={styles.treeNote}>{note}</Text> : null}
    </Pressable>
  );
}

/* ------------------------------------------------------------------ *
 * 平面区域（线性规划）
 * ------------------------------------------------------------------ */

const N = 14;
const XMAX = 8;
const YMAX = 8;

type Cons = { id: string; text: string; test: (x: number, y: number) => boolean };

const CONS: Cons[] = [
  { id: 'c1', text: 'x ≥ 0', test: (x) => x >= 0 },
  { id: 'c2', text: 'y ≥ 0', test: (_x, y) => y >= 0 },
  { id: 'c3', text: 'x + y ≤ 6', test: (x, y) => x + y <= 6 + 1e-9 },
  { id: 'c4', text: '2x + y ≤ 10', test: (x, y) => 2 * x + y <= 10 + 1e-9 },
];

function PlanePart() {
  const [k, setK] = useState(1);
  const [z, setZ] = useState(4);
  const [hidden, setHidden] = useState<string[]>([]);

  const cells = useMemo(() => {
    const out: { x: number; y: number; ok: boolean; val: number }[] = [];
    const active = CONS.filter((c) => !hidden.includes(c.id));
    for (let j = N - 1; j >= 0; j -= 1) {
      for (let i = 0; i < N; i += 1) {
        const x = (XMAX * (i + 0.5)) / N;
        const y = (YMAX * (j + 0.5)) / N;
        out.push({
          x,
          y,
          ok: active.every((c) => c.test(x, y)),
          val: x + k * y,
        });
      }
    }
    return out;
  }, [k, hidden]);

  const best = useMemo(() => {
    const feas = cells.filter((c) => c.ok);
    if (!feas.length) return null;
    return feas.reduce((m, c) => (c.val > m.val ? c : m), feas[0]);
  }, [cells]);

  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderMove: (_e, g) => setZ((prev) => clamp(prev - g.dy * (k + 1) * 0.08, 0, 12)),
      }),
    [k]
  );

  return (
    <View>
      <Text style={styles.projHint}>
        两个变量时的样子：每条约束砍掉半个平面，剩下的公共部分就是可行域；目标函数是一条能平行推动的直线。
      </Text>
      <View style={styles.grid} {...pan.panHandlers}>
        {cells.map((c) => {
          const onLine = Math.abs(c.val - z) < (k + 1) * 0.22;
          const isBest = !!best && Math.abs(best.x - c.x) < 1e-6 && Math.abs(best.y - c.y) < 1e-6;
          return (
            <View key={`${c.x}-${c.y}`} style={[styles.cell, c.ok && styles.cellOk, onLine && styles.cellLine, isBest && styles.cellBest]} />
          );
        })}
      </View>
      <View style={styles.axisRow}>
        <Text style={styles.axisText}>→ x（0 ~ {XMAX}）</Text>
        <Text style={styles.axisText}>↑ y（0 ~ {YMAX}）</Text>
      </View>
      <Text style={styles.legendTxt}>
        <Text style={{ color: colors.accent }}>■</Text> 可行域 ·{' '}
        <Text style={{ color: colors.red }}>■</Text> 最优点 ·{' '}
        <Text style={{ color: colors.orange }}>▬</Text> 目标直线 z = x + {k.toFixed(1)}y
      </Text>
      {best ? (
        <Text style={styles.bestTxt}>
          现在最优的一点：x = {fmtNum(best.x)}，y = {fmtNum(best.y)}，此时 z = {fmtNum(best.val)}。在方格上上下拖，就是平移这条直线。
        </Text>
      ) : (
        <Text style={styles.bestTxt}>可行域是空的：这几个条件互相打架了。</Text>
      )}
      <Text style={styles.sliderLabel}>目标直线的斜率 k = {k.toFixed(1)}</Text>
      <RatioSlider value={k} min={0.2} max={3} marks={[]} showMarks={false} onChange={setK} />
      <Text style={styles.sliderLabel}>平移到 z = {z.toFixed(1)}</Text>
      <RatioSlider value={z} min={0} max={12} marks={[]} showMarks={false} onChange={setZ} />
      <View style={styles.entryRow}>
        {CONS.map((c) => {
          const off = hidden.includes(c.id);
          return (
            <Pressable
              key={c.id}
              style={[styles.con, off && styles.conOff]}
              onPress={() =>
                setHidden((prev) => (prev.includes(c.id) ? prev.filter((h) => h !== c.id) : [...prev, c.id]))
              }
              accessibilityRole="button"
            >
              <Text style={[styles.conText, off && styles.conTextOff]}>{c.text}</Text>
            </Pressable>
          );
        })}
      </View>
      <Note text="点掉一个条件，可行域立刻变大 —— 所谓线性规划，说到底就是「条件 ∩ 条件 ∩ …」。" icon="cube-outline" />
    </View>
  );
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

const styles = StyleSheet.create({
  projRow: { flexDirection: 'row', flexWrap: 'wrap' },
  projHint: { fontSize: 11.5, color: colors.sub, lineHeight: 17, marginTop: 8 },
  fnLabel: { fontSize: 13, fontWeight: '800', color: colors.ink, marginTop: 10, marginBottom: 6 },
  legendRow: { marginTop: 6 },
  legendTxt: { fontSize: 11, color: colors.sub, lineHeight: 17 },
  resTitle: { fontSize: 11.5, fontWeight: '800', color: colors.faint, letterSpacing: 0.3 },
  readText: { fontSize: 13, fontWeight: '800', color: colors.ink, marginTop: 4 },
  detail: { fontSize: 11.5, color: colors.inkSoft, lineHeight: 17, marginTop: 4 },
  rowLine: { flexDirection: 'row', alignItems: 'flex-start', marginTop: 5 },
  rowKey: { width: 18, fontSize: 12, fontWeight: '800' },
  rowVal: { flex: 1, fontSize: 12, color: colors.inkSoft, lineHeight: 17 },
  verdictRow: { flexDirection: 'row', alignItems: 'flex-start', marginTop: 6 },
  verdictText: { flex: 1, fontSize: 12, fontWeight: '700', lineHeight: 17, marginLeft: 6 },
  treeRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4 },
  treeLabel: { fontSize: 12, fontWeight: '700', color: colors.ink, marginLeft: 6 },
  treeNote: { fontSize: 11, color: colors.faint, marginLeft: 8, flex: 1 },
  deepNote: { fontSize: 11, color: colors.purple, marginLeft: 40, lineHeight: 16, marginVertical: 2, fontWeight: '600' },
  grid: {
    width: '100%',
    aspectRatio: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: '#F7FAFE',
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.line,
    marginTop: 8,
  },
  cell: { width: `${100 / N}%`, aspectRatio: 1, borderWidth: 0.3, borderColor: '#EAF0F8' },
  cellOk: { backgroundColor: '#DCE9FE' },
  cellLine: { backgroundColor: '#FFE3C7' },
  cellBest: { backgroundColor: colors.red },
  axisRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  axisText: { fontSize: 10.5, color: colors.faint, fontWeight: '600' },
  bestTxt: { fontSize: 11.5, color: colors.inkSoft, marginTop: 4, lineHeight: 17 },
  sliderLabel: { fontSize: 11.5, fontWeight: '700', color: colors.inkSoft, marginTop: 8, marginBottom: 2 },
  entryRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 },
  con: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.green,
    marginRight: 8,
    marginBottom: 6,
  },
  conText: { fontSize: 11.5, fontWeight: '700', color: colors.green },
  conOff: { borderColor: colors.line, backgroundColor: '#F4F7FB' },
  conTextOff: { color: colors.faint, textDecorationLine: 'line-through' },
});
