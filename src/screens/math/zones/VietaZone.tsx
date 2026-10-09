import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../../theme';
import RatioSlider from '../../../components/RatioSlider';
import FunctionGraph from '../../../components/FunctionGraph';
import {
  ROOT_TEMPLATE_TEXT,
  discriminant,
  fmtSet,
  quadraticRoots,
  rootTemplate,
  vieta,
} from '../../../math/setCore';
import { BUILD_CASES } from '../../../math/setCase';
import {
  boundsOf,
  coefOf,
  evalA,
  evalB,
  fmtFunc,
  mainParam,
  solveParamForRoot,
  type MathObj,
} from '../../../math/setObject';
import { Box, Chip, Note, Zone } from './kit';

interface Props {
  obj: MathObj;
  patch: (p: Partial<MathObj>) => void;
  locked?: boolean;
  fireProbe: (pid: string) => void;
}

/** 根关系区：韦达定理 —— 和积怎么来的、根落在哪儿、反过来怎么用 */
export default function VietaZone({ obj, patch, locked, fireProbe }: Props) {
  const live = coefOf(obj);
  // 题目不是二次式时，交给这组系数自由练习
  const [free, setFree] = useState<[number, number, number]>([1, -3, 2]);
  const [A, B, C] = live ?? free;
  const tied = !!live;
  const [built, setBuilt] = useState<string | null>(null);
  const [inverse, setInverse] = useState(0);

  const v = vieta(A, B, C);
  const roots = quadraticRoots(A, B, C);
  const disc = discriminant(A, B, C);
  const box = boundsOf(evalB(obj)) ?? boundsOf(obj.domain) ?? null;
  const tpl = box ? rootTemplate(roots, box.lo, box.hi) : null;
  const p = mainParam(obj);

  // a → 0：这就不是二次方程了，韦达用不了
  useEffect(() => {
    if (Math.abs(A) < 1e-9) fireProbe('p-degenerate');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Math.abs(A) < 1e-9]);

  const dragRoot = (target: number, idx: number) => {
    const next = solveParamForRoot(obj, target, idx);
    if (next) patch({ vals: next });
    if (box && (target < box.lo - 1e-9 || target > box.hi + 1e-9)) fireProbe('p-rootpos');
  };

  const range = useMemo(() => {
    const pts: number[] = [0, 1, -2, 2];
    roots.forEach((r) => pts.push(r));
    if (box) pts.push(box.lo, box.hi);
    if (v) pts.push(v.axis);
    let lo = Math.min(...pts) - 1.5;
    let hi = Math.max(...pts) + 1.5;
    if (hi - lo < 6) {
      const m = (hi + lo) / 2;
      lo = m - 3;
      hi = m + 3;
    }
    return { lo, hi };
  }, [roots, box, v]);

  const f = (x: number) => A * x * x + B * x + C;
  const symAxis = v ? v.axis : null;
  const vertex = v ? { x: v.axis, y: f(v.axis) } : null;
  const marks = roots.map((r, i) => ({
    x: r,
    label: roots.length > 1 ? `x${i + 1}` : '重根',
    color: colors.purple,
  }));
  if (box) {
    marks.push({ x: box.lo, label: 'B左', color: '#e2a02f' });
    marks.push({ x: box.hi, label: 'B右', color: '#e2a02f' });
  }

  const caseNow = BUILD_CASES[inverse];
  const loLine = roots.length ? roots[0] : 0;
  const hiLine = roots.length ? roots[roots.length - 1] : 0;

  return (
    <Zone tag="根的关系" title="韦达定理" sub="两根的和、积都写在抛物线里：看对称轴、看与 y 轴的交点，一眼就明白" color={colors.purple}>
      <View style={{ opacity: locked ? 0.6 : 1 }}>
        <Text style={styles.line}>
          现在画的这条：y = {fmtFunc([A, B, C])}
          {tied ? '（由题目的参数决定）' : '（自己在下面随便调）'}
        </Text>

        {Math.abs(A) < 1e-9 ? (
          <Box tone="bad">
            <Text style={styles.warnTitle}>⚠ 现在二次项系数是 0</Text>
            <Text style={styles.detail}>
              一旦二次项系数为 0，它就不是二次方程了，韦达定理（要除以二次项系数）也就没有意义。先把这种情况单独说清楚，再回来用韦达。
            </Text>
          </Box>
        ) : null}

        {/* 抛物线：韦达的图形版 */}
        <Text style={styles.graphTitle}>这条抛物线与 x 轴的交点，就是方程的两个根</Text>
        <FunctionGraph
          f={f}
          xLo={range.lo}
          xHi={range.hi}
          color={colors.purple}
          marks={marks}
          axis={Math.abs(A) < 1e-9 ? null : symAxis}
          vertex={Math.abs(A) < 1e-9 ? null : vertex}
          refBox={box}
          height={186}
        />
        <View style={styles.legendRow}>
          <Text style={styles.legendTxt}>紫色点 = 两个根 x₁、x₂　·　竖虚线 = 对称轴　·　橙点 = 顶点　·　黄框 = 参考区间 B</Text>
        </View>

        {/* 和积仪表盘 */}
        <View style={styles.dialRow}>
          <Dial label="x₁ + x₂" value={v?.sum ?? NaN} expr="= −一次项 ÷ 二次项" color={colors.accent} />
          <Dial label="x₁ · x₂" value={v?.prod ?? NaN} expr="= 常数项 ÷ 二次项" color={colors.purple} />
        </View>
        <Text style={styles.detail}>
          和 = 对称轴的 2 倍（{v ? `对称轴 x = ${round(v.axis)}，所以和 = ${round(v.sum)}` : '—'}）；
          积 = 曲线与 y 轴交点的高度 ÷ 二次项系数（现在交点在 y = {round(C)}，二次项系数 = {round(A)}）。
        </Text>
        <View style={styles.kvRow}>
          <Ionicons name="analytics-outline" size={12.5} color={colors.faint} />
          <Text style={styles.kvText}>
            Δ = {round(disc)} · {disc > 0 ? '两个不相等的实根' : Math.abs(disc) < 1e-9 ? '两个相等的实根（重根）' : '没有实根'}
          </Text>
        </View>

        {/* 根落在哪儿 */}
        <Box tone="soft">
          <Text style={styles.resTitle}>两根现在落在哪儿</Text>
          <Text style={styles.detail}>
            {roots.length ? `根：${roots.map((r) => round(r)).join('，')}` : '目前没有实根'}
            {box ? `　参考区间 [${round(box.lo)}, ${round(box.hi)}]` : ''}
          </Text>
          {tpl ? <Text style={styles.tplText}>判定：{ROOT_TEMPLATE_TEXT[tpl]}</Text> : null}
          <Text style={styles.detail}>
            要让两根都落在区间里，得同时看四件事：Δ ≥ 0、对称轴在区间内、区间左端点函数值 ≥ 0、区间右端点函数值 ≥ 0。少看一件就会漏。
          </Text>
        </Box>

        {/* 拖根指针 */}
        {p ? (
          <Box tone="soft">
            <Text style={styles.resTitle}>拖一下根，参数跟着变</Text>
            <Text style={styles.sliderLabel}>x₁ = {round(loLine)}</Text>
            <RatioSlider value={clamp(loLine, -6, 6)} min={-6} max={6} marks={[]} showMarks={false} onChange={(x) => dragRoot(x, 0)} />
            <Text style={styles.sliderLabel}>x₂ = {round(hiLine)}</Text>
            <RatioSlider
              value={clamp(hiLine, -6, 6)}
              min={-6}
              max={6}
              marks={[]}
              showMarks={false}
              onChange={(x) => dragRoot(x, roots.length > 1 ? 1 : 0)}
            />
            <Note text={`拖左边这条，参数 ${p} 会被反算出来，上面的抛物线和右图都会跟着动 —— 一旦把根拖出区间，判定立刻就变了。`} icon="swap-horizontal-outline" />
          </Box>
        ) : null}

        {/* 自由练习 */}
        {!tied ? (
          <Box tone="soft">
            <Text style={styles.resTitle}>自己调一调三个系数</Text>
            <Text style={styles.sliderLabel}>二次项系数 = {A.toFixed(1)}</Text>
            <RatioSlider value={A} min={-3} max={3} marks={[]} showMarks={false} onChange={(x) => setFree([round1(x), free[1], free[2]])} />
            <Text style={styles.sliderLabel}>一次项系数 = {B.toFixed(1)}</Text>
            <RatioSlider value={B} min={-8} max={8} marks={[]} showMarks={false} onChange={(x) => setFree([free[0], round1(x), free[2]])} />
            <Text style={styles.sliderLabel}>常数项 = {C.toFixed(1)}</Text>
            <RatioSlider value={C} min={-8} max={8} marks={[]} showMarks={false} onChange={(x) => setFree([free[0], free[1], round1(x)])} />
          </Box>
        ) : null}

        {/* 逆用 */}
        <Box tone="soft">
          <Text style={styles.resTitle}>反过来用：已知两根的和与积，写出方程</Text>
          <View style={styles.entryRow}>
            {BUILD_CASES.map((c, i) => (
              <Chip
                key={c.id}
                label={c.given.length > 16 ? `${c.given.slice(0, 15)}…` : c.given}
                on={inverse === i}
                onPress={() => {
                  setInverse(i);
                  setBuilt(null);
                }}
                color={colors.purple}
              />
            ))}
          </View>
          <Text style={styles.detail}>
            已知和 = {caseNow.sum}，积 = {caseNow.prod}　→　先写出 x² − (和)x + 积 = 0
          </Text>
          <View style={styles.entryRow}>
            <Chip
              label={built === caseNow.id ? '已经写出来了' : '把方程写出来'}
              on={!!built}
              onPress={() => {
                setBuilt(caseNow.id);
                fireProbe('p-reverse');
                if (!caseNow.real) fireProbe('p-disc');
              }}
              color={colors.purple}
              icon="construct-outline"
            />
          </View>
          {built === caseNow.id ? (
            <>
              <Text style={styles.answer}>{caseNow.answer}</Text>
              <Text style={styles.detail}>{caseNow.note}</Text>
              {!caseNow.real ? (
                <Note text="提醒：方程写得出来，不等于它有实根 —— 逆用韦达之后一定回头查 Δ。" tone="warn" icon="warning-outline" />
              ) : null}
            </>
          ) : null}
        </Box>

        <Note text={`这条对象现在的解集 A = ${fmtSet(evalA(obj))} —— 和上面那张图是同一件事。`} icon="link-outline" />
      </View>
    </Zone>
  );
}

function Dial({ label, value, expr, color }: { label: string; value: number; expr: string; color: string }) {
  const ok = Number.isFinite(value);
  const ang = ok ? Math.max(-88, Math.min(88, (value / 8) * 88)) : 0;
  return (
    <View style={styles.dialBox}>
      <View style={[styles.dial, { borderColor: color }]}>
        <View style={[styles.handWrap, { transform: [{ rotate: `${-ang}deg` }] }]}>
          <View style={[styles.hand, { backgroundColor: color }]} />
        </View>
        <View style={[styles.hub, { backgroundColor: color }]} />
      </View>
      <Text style={styles.dialLabel}>{label}</Text>
      <Text style={[styles.dialVal, { color }]}>{ok ? round(value) : '—'}</Text>
      <Text style={styles.dialExpr}>{expr}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  line: { fontSize: 12, color: colors.inkSoft, fontWeight: '600', marginTop: 2, lineHeight: 17 },
  graphTitle: { fontSize: 11.5, fontWeight: '700', color: colors.inkSoft, marginTop: 10, marginBottom: 4 },
  legendRow: { marginTop: 6 },
  legendTxt: { fontSize: 11, color: colors.sub, lineHeight: 17 },
  dialRow: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 10 },
  dialBox: { alignItems: 'center', width: 128 },
  dial: { width: 84, height: 84, borderRadius: 42, borderWidth: 2, overflow: 'hidden' },
  handWrap: { position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 },
  hand: { position: 'absolute', left: '50%', bottom: '50%', marginLeft: -1.5, width: 3, height: '46%', borderRadius: 2 },
  hub: { position: 'absolute', left: '50%', top: '50%', marginLeft: -4, marginTop: -4, width: 8, height: 8, borderRadius: 4 },
  dialLabel: { fontSize: 11, color: colors.faint, fontWeight: '700', marginTop: 6 },
  dialVal: { fontSize: 17, fontWeight: '800' },
  dialExpr: { fontSize: 10.5, color: colors.faint },
  kvRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  kvText: { fontSize: 11.5, color: colors.inkSoft, marginLeft: 6, fontWeight: '600' },
  resTitle: { fontSize: 11.5, fontWeight: '800', color: colors.faint, letterSpacing: 0.3, marginBottom: 4 },
  tplText: { fontSize: 12, color: colors.purple, fontWeight: '800', marginTop: 4 },
  detail: { fontSize: 11.5, color: colors.inkSoft, lineHeight: 17, marginTop: 4 },
  warnTitle: { fontSize: 12.5, fontWeight: '800', color: colors.red },
  entryRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 6 },
  sliderLabel: { fontSize: 11.5, fontWeight: '700', color: colors.inkSoft, marginTop: 6, marginBottom: 2 },
  answer: { fontSize: 14, fontWeight: '800', color: colors.purple, marginTop: 6 },
});

function round(v: number): number {
  return Math.round(v * 1000) / 1000;
}
function round1(v: number): number {
  return Math.round(v * 10) / 10;
}
function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}
