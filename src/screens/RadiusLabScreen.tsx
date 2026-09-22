import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Chem3DView, { type Chem3DHandle } from '../components/Chem3DView';
import RatioSlider from '../components/RatioSlider';
import { colors, radii, shadow } from '../theme';
import type { SceneReq } from '../types';
import {
  APPLY_TASKS,
  clampRatio,
  cnForRatio,
  CN_ORDER,
  CRIT_MARKS,
  distanceToNextCritical,
  GEOMETRY_NOTE,
  infoFor,
  PREDICT_TASKS,
  RADIUS_MAX,
  RADIUS_MIN,
  STRUCTURES,
  trueRatioOf,
  WHY_DISCRETE,
  type CN,
  type RadiusLabEntry,
} from '../radius/radiusRule';

type Mode = 'explore' | 'predict' | 'apply';

const MODES: { key: Mode; label: string; icon: 'bulb-outline' | 'help-outline' | 'school-outline'; desc: string }[] = [
  { key: 'explore', label: '探索', icon: 'bulb-outline', desc: '自由拖滑块，观察配位数怎么跳变' },
  { key: 'predict', label: '预测', icon: 'help-outline', desc: '先猜配位数，再拖滑块验证' },
  { key: 'apply', label: '应用', icon: 'school-outline', desc: '给真实离子半径，自己算再判断' },
];

/** 把 0.4142 这类常量显示成常见的三位小数 */
function critText(v: number): string {
  return v.toFixed(3).replace(/0$/, '').replace(/\.$/, '');
}

export default function RadiusLabScreen({
  entry,
  onBack,
}: {
  entry: RadiusLabEntry | null;
  onBack: () => void;
}) {
  const { width, height: winH } = useWindowDimensions();
  const wide = width >= 780;

  const startRatio = useMemo(() => clampRatio(entry?.ratio ?? 0.56), [entry]);
  const [ratio, setRatio] = useState(startRatio);
  const [showCrit, setShowCrit] = useState(true);
  const [mode, setMode] = useState<Mode>(entry?.applyId ? 'apply' : 'explore');
  const insets = useSafeAreaInsets();

  const chemRef = useRef<Chem3DHandle | null>(null);
  const ratioRef = useRef(ratio);
  ratioRef.current = ratio;

  const scene = useMemo<SceneReq>(
    () => ({ kind: 'radius', id: 'radius-lab', ratio: startRatio }),
    [startRatio]
  );

  // 引擎就绪：把当前半径比补发一次（避免早于 iframe 加载）
  const handleEvent = useCallback((ev: { ev: string }) => {
    if (ev.ev === 'ready') chemRef.current?.send({ cmd: 'radius', value: ratioRef.current });
  }, []);

  useEffect(() => {
    chemRef.current?.send({ cmd: 'radius', value: ratio });
  }, [ratio]);

  /* 探索模式：记录拖过的半径比区间 */
  const [explored, setExplored] = useState<Partial<Record<CN, { min: number; max: number }>>>({});
  useEffect(() => {
    const cn = cnForRatio(ratio);
    setExplored((prev) => {
      const cur = prev[cn];
      if (cur && Math.abs(cur.min - ratio) < 0.001 && Math.abs(cur.max - ratio) < 0.001) return prev;
      const next = cur
        ? { min: Math.min(cur.min, ratio), max: Math.max(cur.max, ratio) }
        : { min: ratio, max: ratio };
      if (cur && next.min === cur.min && next.max === cur.max) return prev;
      return { ...prev, [cn]: next };
    });
  }, [ratio]);

  // 滑块改成横向后放在画布下方，剩下的空间尽量都留给 3D
  const canvasH = wide ? 430 : Math.round(Math.max(240, Math.min(400, winH - 395)));

  const info = infoFor(ratio);
  const nearCrit = distanceToNextCritical(ratio) < 0.03;

  return (
    <View style={styles.root}>
      {/* 全屏子页面：给状态栏（时间/信号）让出安全区，否则返回按钮会被盖住点不到 */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <Pressable style={styles.backBtn} onPress={onBack} accessibilityLabel="返回">
          <Ionicons name="chevron-back" size={18} color={colors.accent} />
          <Text style={styles.backText}>返回</Text>
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>半径比 · 配位数实验</Text>
          <Text style={styles.subtitle} numberOfLines={1}>
            {entry?.from ? `从 ${entry.from} 进来 · ` : ''}拖动滑块，看配位数在临界值处跳变
          </Text>
        </View>
      </View>

      <View style={styles.modeRow}>
        {MODES.map((m) => {
          const on = mode === m.key;
          return (
            <Pressable
              key={m.key}
              style={[styles.modeBtn, on && styles.modeBtnOn]}
              onPress={() => setMode(m.key)}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
            >
              <Ionicons name={m.icon} size={14} color={on ? '#FFFFFF' : colors.sub} />
              <Text style={[styles.modeText, on && styles.modeTextOn]}>{m.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {wide ? (
        <View style={styles.stageWide}>
          <View style={styles.canvasCol}>
            <View style={styles.canvasWrap}>
              <Chem3DView ref={chemRef} scene={scene} onEvent={handleEvent} />
              <View style={styles.canvasHint} pointerEvents="none">
                <Text style={styles.canvasHintText}>
                  {nearCrit ? '注意：马上跨过临界值，配位数要跳变了' : info.hole + ' · 配位数 ' + info.cn}
                </Text>
              </View>
            </View>
            <View style={styles.sliderBar}>
              <SliderBlock
                ratio={ratio}
                setRatio={setRatio}
                showCrit={showCrit}
                onToggleCrit={() => setShowCrit((v) => !v)}
              />
            </View>
          </View>
          <View style={styles.panelCol}>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.panelScroll}>
              <InfoPanel ratio={ratio} />
              {mode === 'explore' ? <ExplorePanel explored={explored} /> : null}
              {mode === 'predict' ? <PredictPanel onJump={setRatio} /> : null}
              {mode === 'apply' ? <ApplyPanel startId={entry?.applyId} onJump={setRatio} /> : null}
              <Legend />
            </ScrollView>
          </View>
        </View>
      ) : (
        <View style={styles.stageNarrow}>
          <View style={styles.canvasColNarrow}>
            <View style={[styles.canvasWrapFixed, { height: canvasH }]}>
              <Chem3DView ref={chemRef} scene={scene} onEvent={handleEvent} />
              <View style={styles.canvasHint} pointerEvents="none">
                <Text style={styles.canvasHintText}>
                  {nearCrit ? '马上跨过临界值了' : `配位数 ${info.cn} · ${info.hole}`}
                </Text>
              </View>
            </View>
          </View>
          <View style={styles.sliderBarNarrow}>
            <SliderBlock
              ratio={ratio}
              setRatio={setRatio}
              showCrit={showCrit}
              onToggleCrit={() => setShowCrit((v) => !v)}
            />
          </View>
          <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.narrowBody}>
            <InfoPanel ratio={ratio} />
            {mode === 'explore' ? <ExplorePanel explored={explored} /> : null}
            {mode === 'predict' ? <PredictPanel onJump={setRatio} /> : null}
            {mode === 'apply' ? <ApplyPanel startId={entry?.applyId} onJump={setRatio} /> : null}
            <Legend />
          </ScrollView>
        </View>
      )}
    </View>
  );
}

/* ---------------- 横向滑块 + 临界值开关 ---------------- */
function SliderBlock({
  ratio,
  setRatio,
  showCrit,
  onToggleCrit,
}: {
  ratio: number;
  setRatio: (v: number) => void;
  showCrit: boolean;
  onToggleCrit: () => void;
}) {
  return (
    <View style={styles.sliderCard}>
      <View style={styles.sliderHead}>
        <View style={styles.sliderHeadLeft}>
          <Text style={styles.sliderLabel}>半径比 r₊ / r₋</Text>
          <Text style={styles.sliderNow}>{ratio.toFixed(3)}</Text>
        </View>
        <Pressable
          style={styles.critToggle}
          onPress={onToggleCrit}
          accessibilityRole="switch"
          accessibilityState={{ checked: showCrit }}
        >
          <Ionicons
            name={showCrit ? 'checkmark-circle' : 'ellipse-outline'}
            size={15}
            color={showCrit ? colors.accent : colors.faint}
          />
          <Text style={[styles.critToggleText, showCrit && styles.critToggleTextOn]}>
            显示临界值
          </Text>
        </Pressable>
      </View>
      <RatioSlider
        value={ratio}
        min={RADIUS_MIN}
        max={RADIUS_MAX}
        marks={CRIT_MARKS}
        showMarks={showCrit}
        onChange={(v) => setRatio(clampRatio(v))}
      />
    </View>
  );
}

/* ---------------- 右侧：信息面板 ---------------- */
function InfoPanel({ ratio }: { ratio: number }) {
  const info = infoFor(ratio);
  const [openGeo, setOpenGeo] = useState(false);
  return (
    <View style={styles.card}>
      <View style={styles.infoHead}>
        <View>
          <Text style={styles.infoLabel}>当前半径比 r₊/r₋</Text>
          <Text style={styles.infoBig}>{ratio.toFixed(3)}</Text>
        </View>
        <View style={styles.cnBox}>
          <Text style={styles.infoLabel}>配位数</Text>
          <Text style={styles.cnBig}>{info.cn}</Text>
        </View>
      </View>

      <View style={styles.kvRow}>
        <Text style={styles.kvKey}>晶体类型</Text>
        <Text style={styles.kvVal}>
          {info.type} · {info.typeFull}
        </Text>
      </View>
      <View style={styles.kvRow}>
        <Text style={styles.kvKey}>所在空隙</Text>
        <Text style={styles.kvVal}>{info.hole}</Text>
      </View>
      <View style={styles.kvRow}>
        <Text style={styles.kvKey}>半径比区间</Text>
        <Text style={styles.kvVal}>{info.rangeText}</Text>
      </View>

      <Text style={styles.infoSec}>典型物质</Text>
      <View style={styles.exRow}>
        {info.examples.map((e) => (
          <View key={e.formula} style={styles.exChip}>
            <Text style={styles.exFormula}>{e.formula}</Text>
            <Text style={styles.exRatio}>{e.ratio.toFixed(2)}</Text>
          </View>
        ))}
      </View>

      <Text style={styles.reason}>{info.reason}</Text>
      <Text style={styles.cue}>{info.cue}</Text>

      <Pressable onPress={() => setOpenGeo((v) => !v)} style={styles.geoBtn}>
        <Text style={styles.geoBtnText}>{openGeo ? '收起几何推导' : '看看几何推导（临界值怎么来的）'}</Text>
      </Pressable>
      {openGeo ? <Text style={styles.geoText}>{GEOMETRY_NOTE[info.cn]}</Text> : null}
    </View>
  );
}

/* ---------------- 第一层：探索 ---------------- */
function ExplorePanel({ explored }: { explored: Partial<Record<CN, { min: number; max: number }>> }) {
  const done = CN_ORDER.filter((cn) => explored[cn]).length;
  return (
    <View style={styles.card}>
      <View style={styles.rowBetween}>
        <Text style={styles.cardTitle}>我探索过的结构</Text>
        <Text style={[styles.score, done === CN_ORDER.length && styles.scoreOk]}>
          {done}/{CN_ORDER.length}
        </Text>
      </View>
      {CN_ORDER.map((cn) => {
        const r = explored[cn];
        const s = STRUCTURES[cn];
        return (
          <View key={cn} style={[styles.expRow, !r && styles.expRowOff]}>
            <View style={styles.expCn}>
              <Text style={[styles.expCnText, !r && styles.expCnTextOff]}>{cn}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.expTitle, !r && styles.expTitleOff]}>
                {s.type} · {s.typeFull}
              </Text>
              <Text style={styles.expMeta}>
                {r
                  ? `探索过的区间 ${r.min.toFixed(2)} ~ ${r.max.toFixed(2)}`
                  : `还没拖到 ${s.rangeText} 这一段`}
              </Text>
            </View>
            <Text style={[styles.expHole, !r && styles.expHoleOff]}>{s.hole}</Text>
          </View>
        );
      })}
      {done === CN_ORDER.length ? (
        <Text style={styles.expDone}>三种结构都见过了 —— 配位数只会取 4 / 6 / 8，没有 5 或 7。</Text>
      ) : null}
      <Text style={styles.why}>{WHY_DISCRETE}</Text>
    </View>
  );
}

/* ---------------- 第二层：预测 ---------------- */
function PredictPanel({ onJump }: { onJump: (v: number) => void }) {
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState<CN | null>(null);
  const [right, setRight] = useState(0);
  const [wrong, setWrong] = useState(0);
  const task = PREDICT_TASKS[idx % PREDICT_TASKS.length];
  const correct = task.cn;

  const submit = (cn: CN) => {
    if (picked !== null) return;
    setPicked(cn);
    if (cn === correct) setRight((v) => v + 1);
    else setWrong((v) => v + 1);
  };

  const next = () => {
    setPicked(null);
    setIdx((v) => (v + 1) % PREDICT_TASKS.length);
  };

  return (
    <View style={styles.card}>
      <View style={styles.rowBetween}>
        <Text style={styles.cardTitle}>先猜再验证</Text>
        <Text style={styles.score}>
          {right} 对 / {right + wrong} 题
        </Text>
      </View>
      <Text style={styles.qText}>如果 r₊ / r₋ = {task.ratio.toFixed(2)}，配位数是几？</Text>
      <Text style={styles.qHint}>{task.hint}</Text>

      <View style={styles.pickRow}>
        {CN_ORDER.map((cn) => {
          const on = picked === cn;
          const isRight = cn === correct;
          const tone = picked === null
            ? null
            : isRight
            ? styles.pickRight
            : cn === picked
            ? styles.pickWrong
            : null;
          return (
            <Pressable
              key={cn}
              style={[styles.pickBtn, on && styles.pickBtnOn, tone]}
              onPress={() => submit(cn)}
              disabled={picked !== null}
            >
              <Text style={[styles.pickText, on && styles.pickTextOn, tone && styles.pickTextTone]}>
                {cn}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {picked !== null ? (
        <View style={[styles.fbBox, picked === correct ? styles.fbOk : styles.fbBad]}>
          <Text style={[styles.fbTitle, picked === correct ? styles.fbTitleOk : styles.fbTitleBad]}>
            {picked === correct ? '答对了' : `答错了，正确答案是 ${correct}`}
          </Text>
          <Text style={styles.fbText}>{STRUCTURES[correct].reason}</Text>
          <Text style={styles.fbGeo}>{GEOMETRY_NOTE[correct]}</Text>
        </View>
      ) : null}

      <Pressable style={styles.primaryBtn} onPress={() => onJump(task.ratio)}>
        <Text style={styles.primaryBtnText}>把滑块拖到 {task.ratio.toFixed(2)} 看结构</Text>
      </Pressable>
      <Pressable style={styles.miniBtnRow} onPress={next}>
        <Text style={styles.miniBtn}>下一题</Text>
      </Pressable>
    </View>
  );
}

/* ---------------- 第三层：应用 ---------------- */
function ApplyPanel({
  startId,
  onJump,
}: {
  startId?: string;
  onJump: (v: number) => void;
}) {
  const startIdx = Math.max(0, APPLY_TASKS.findIndex((t) => t.id === startId));
  const [idx, setIdx] = useState(startIdx);
  const [text, setText] = useState('');
  const [cn, setCn] = useState<CN | null>(null);
  const [fb, setFb] = useState<{ ok: boolean; title: string; detail: string } | null>(null);

  const task = APPLY_TASKS[idx % APPLY_TASKS.length];
  const truth = trueRatioOf(task);
  const truthCn = cnForRatio(truth);

  const check = () => {
    const v = parseFloat(text.replace(/[^0-9.]/g, ''));
    if (!Number.isFinite(v) || v <= 0) {
      setFb({ ok: false, title: '先算出半径比', detail: '用正离子半径除以负离子半径，例如 102 ÷ 181 ≈ 0.56。' });
      return;
    }
    const ratioOk = Math.abs(v - truth) <= 0.03;
    const cnOk = cn === truthCn;
    setFb({
      ok: ratioOk && cnOk,
      title: ratioOk && cnOk ? '完全正确' : cnOk ? '配位数对了，比例再算算' : ratioOk ? '比例对了，配位数再想想' : '再看一眼两个答案',
      detail:
        `${task.cation.text} ${task.cation.r} pm ÷ ${task.anion.text} ${task.anion.r} pm = ${truth.toFixed(3)}，` +
        `落在 ${STRUCTURES[truthCn].rangeText}，所以配位数是 ${truthCn}（${STRUCTURES[truthCn].type}）。${task.note}`,
    });
  };

  const reset = (i: number) => {
    setIdx(i);
    setText('');
    setCn(null);
    setFb(null);
  };

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>真实数据 · 自己算</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.taskScroll}>
        {APPLY_TASKS.map((t, i) => {
          const on = i === idx % APPLY_TASKS.length;
          return (
            <Pressable key={t.id} style={[styles.taskChip, on && styles.taskChipOn]} onPress={() => reset(i)}>
              <Text style={[styles.taskChipText, on && styles.taskChipTextOn]}>
                {t.cation.text}{t.anion.text}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <Text style={styles.applyTitle}>{task.title}</Text>
      <View style={styles.dataRow}>
        <View style={styles.dataBox}>
          <Text style={styles.dataKey}>{task.cation.text} 半径</Text>
          <Text style={styles.dataVal}>{task.cation.r} pm</Text>
        </View>
        <Text style={styles.dataSlash}>÷</Text>
        <View style={styles.dataBox}>
          <Text style={styles.dataKey}>{task.anion.text} 半径</Text>
          <Text style={styles.dataVal}>{task.anion.r} pm</Text>
        </View>
      </View>

      <View style={styles.inputRow}>
        <Text style={styles.inputLabel}>r₊ / r₋ =</Text>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          keyboardType="numeric"
          placeholder="算一算"
          placeholderTextColor={colors.faint}
        />
        <Text style={styles.inputLabel2}>配位数</Text>
        {CN_ORDER.map((c) => (
          <Pressable
            key={c}
            style={[styles.miniPick, cn === c && styles.miniPickOn]}
            onPress={() => setCn(c)}
          >
            <Text style={[styles.miniPickText, cn === c && styles.miniPickTextOn]}>{c}</Text>
          </Pressable>
        ))}
      </View>

      <Pressable style={styles.primaryBtn} onPress={check}>
        <Text style={styles.primaryBtnText}>检查</Text>
      </Pressable>

      {fb ? (
        <View style={[styles.fbBox, fb.ok ? styles.fbOk : styles.fbBad]}>
          <Text style={[styles.fbTitle, fb.ok ? styles.fbTitleOk : styles.fbTitleBad]}>{fb.title}</Text>
          <Text style={styles.fbText}>{fb.detail}</Text>
        </View>
      ) : null}

      <Pressable style={styles.miniBtnRow} onPress={() => onJump(truth)}>
        <Text style={styles.miniBtn}>把滑块拖到 {truth.toFixed(2)} 看它的真实结构</Text>
      </Pressable>
    </View>
  );
}

/* ---------------- 图例 ---------------- */
function Legend() {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>画布怎么看</Text>
      <Text style={styles.legendLine}>
        <Text style={styles.dotCat}>●</Text> 橙球 = 正离子 r₊（半径由滑块决定）
      </Text>
      <Text style={styles.legendLine}>
        <Text style={styles.dotAnion}>●</Text> 绿球 = 负离子 r₋（大小固定，作为标尺）
      </Text>
      <Text style={styles.legendLine}>
        <Text style={styles.dotOk}>●</Text> 绿接触点 = 正负离子刚好接触（结构稳定）
      </Text>
      <Text style={styles.legendLine}>
        <Text style={styles.dotBad}>●</Text> 红点闪烁 = 正离子够不着，配位数撑不住要往下掉
      </Text>
      <Text style={styles.legendLine}>
        <Text style={styles.dotBar}>━</Text> 灰线→橙→红：负离子之间的堆积接触被撑开，
        <Text style={styles.dotBad}> 断裂</Text> 就意味着要重排啦
      </Text>
      <Text style={styles.legendTip}>
        拖动过临界值 {critText(0.4142)} / {critText(0.732)} 时，画面会先在旧结构上“报警”，
        再用约 1 秒滑到新结构 —— 这段过程就是配位数跳变的原因。
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 6,
  },
  backBtn: { flexDirection: 'row', alignItems: 'center', marginRight: 6 },
  backText: { fontSize: 13, color: colors.accent, fontWeight: '600' },
  title: { fontSize: 17, fontWeight: '800', color: colors.ink },
  subtitle: { fontSize: 11.5, color: colors.sub, marginTop: 2 },
  modeRow: { flexDirection: 'row', paddingHorizontal: 14, gap: 8, paddingBottom: 8 },
  modeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radii.chip,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
  },
  modeBtnOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  modeText: { fontSize: 12.5, fontWeight: '700', color: colors.sub },
  modeTextOn: { color: '#FFFFFF' },

  stageWide: { flex: 1, flexDirection: 'row', paddingHorizontal: 14, gap: 12, paddingBottom: 12 },
  canvasCol: { flex: 1, minWidth: 0 },
  sliderBar: { marginTop: 10 },
  sliderBarNarrow: { paddingHorizontal: 14, paddingTop: 10 },
  canvasColNarrow: { paddingHorizontal: 14, paddingTop: 2 },
  sliderCard: {
    backgroundColor: colors.card,
    borderRadius: radii.card,
    padding: 12,
    paddingTop: 10,
    ...shadow.card,
  },
  sliderHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  sliderHeadLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sliderLabel: { fontSize: 12.5, fontWeight: '800', color: colors.ink },
  sliderNow: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.accent,
    backgroundColor: colors.accentSoft,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 9,
    overflow: 'hidden',
  },
  critToggle: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  critToggleText: { fontSize: 11.5, fontWeight: '600', color: colors.faint },
  critToggleTextOn: { color: colors.accent },

  // 宽布局：父容器有明确高度，画板用 flex: 1 撑满剩余空间
  canvasWrap: {
    flex: 1,
    borderRadius: radii.card,
    overflow: 'hidden',
    backgroundColor: '#EAF1FB',
  },
  // 窄布局（移动端）：父容器高度是 auto，这里绝不能写 flex: 1 ——
  // flexBasis 为 0 会让它对父容器高度的贡献变成 0，3D 画布直接“塌陷”成一条看不见的缝，
  // 表现为手机上完全不显示 3D 图。改成显式高度即可。
  canvasWrapFixed: {
    alignSelf: 'stretch',
    borderRadius: radii.card,
    overflow: 'hidden',
    backgroundColor: '#EAF1FB',
  },
  canvasHint: { position: 'absolute', left: 8, top: 8 },
  canvasHintText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
    backgroundColor: 'rgba(30,45,72,0.6)',
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 10,
    overflow: 'hidden',
  },
  panelCol: { width: 268 },
  panelScroll: { gap: 10, paddingBottom: 20 },
  stageNarrow: { flex: 1 },
  narrowBody: { paddingHorizontal: 14, paddingTop: 10, gap: 10, paddingBottom: 24 },

  card: {
    backgroundColor: colors.card,
    borderRadius: radii.card,
    padding: 13,
    ...shadow.card,
  },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTitle: { fontSize: 14, fontWeight: '800', color: colors.ink },
  score: { fontSize: 13, fontWeight: '800', color: colors.orange },
  scoreOk: { color: colors.green },

  infoHead: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  infoLabel: { fontSize: 11, color: colors.sub, fontWeight: '600' },
  infoBig: { fontSize: 27, fontWeight: '800', color: colors.ink, marginTop: 2 },
  cnBox: { alignItems: 'flex-end' },
  cnBig: { fontSize: 30, fontWeight: '800', color: colors.accent, marginTop: 2 },
  kvRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 7,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
    paddingTop: 7,
  },
  kvKey: { fontSize: 11.5, color: colors.sub },
  kvVal: { fontSize: 12.5, fontWeight: '700', color: colors.ink },
  infoSec: { fontSize: 11, color: colors.sub, fontWeight: '700', marginTop: 10 },
  exRow: { flexDirection: 'row', gap: 6, marginTop: 6, flexWrap: 'wrap' },
  exChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.accentSoft,
    borderRadius: radii.chip,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  exFormula: { fontSize: 12, fontWeight: '700', color: colors.ink },
  exRatio: { fontSize: 10.5, color: colors.accent, fontWeight: '700' },
  reason: { fontSize: 12.5, color: colors.inkSoft, lineHeight: 19, marginTop: 10 },
  cue: { fontSize: 11.5, color: colors.sub, lineHeight: 18, marginTop: 5 },
  geoBtn: { marginTop: 8, alignSelf: 'flex-start' },
  geoBtnText: { fontSize: 12, fontWeight: '700', color: colors.accent },
  geoText: { fontSize: 11.5, color: colors.sub, lineHeight: 18, marginTop: 4 },

  expRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    marginTop: 8,
    backgroundColor: '#F5F9FF',
    borderRadius: 12,
    padding: 9,
  },
  expRowOff: { backgroundColor: '#F4F6FA' },
  expCn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  expCnText: { fontSize: 14, fontWeight: '800', color: colors.accent },
  expCnTextOff: { color: colors.faint },
  expTitle: { fontSize: 12.5, fontWeight: '700', color: colors.ink },
  expTitleOff: { color: colors.faint },
  expMeta: { fontSize: 11, color: colors.sub, marginTop: 2 },
  expHole: { fontSize: 10.5, color: colors.accent, fontWeight: '700' },
  expHoleOff: { color: colors.faint },
  expDone: { fontSize: 12, fontWeight: '700', color: colors.green, marginTop: 9 },
  why: { fontSize: 11.5, color: colors.sub, lineHeight: 18, marginTop: 10 },

  qText: { fontSize: 15, fontWeight: '700', color: colors.ink, marginTop: 8 },
  qHint: { fontSize: 12, color: colors.orange, marginTop: 4 },
  pickRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  pickBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 11,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.line,
  },
  pickBtnOn: { borderColor: colors.accent },
  pickRight: { backgroundColor: '#EAF7F1', borderColor: colors.green },
  pickWrong: { backgroundColor: '#FDECEB', borderColor: colors.red },
  pickText: { fontSize: 18, fontWeight: '800', color: colors.ink },
  pickTextOn: { color: colors.accent },
  pickTextTone: { color: colors.ink },

  fbBox: { marginTop: 10, borderRadius: 12, padding: 10 },
  fbOk: { backgroundColor: '#EAF7F1' },
  fbBad: { backgroundColor: '#FDECEB' },
  fbTitle: { fontSize: 13, fontWeight: '800' },
  fbTitleOk: { color: colors.green },
  fbTitleBad: { color: colors.red },
  fbText: { fontSize: 12, color: colors.inkSoft, lineHeight: 18, marginTop: 3 },
  fbGeo: { fontSize: 11.5, color: colors.sub, lineHeight: 17, marginTop: 4 },

  primaryBtn: {
    marginTop: 11,
    backgroundColor: colors.accent,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  primaryBtnText: { color: '#FFFFFF', fontSize: 13.5, fontWeight: '700' },
  miniBtnRow: { marginTop: 9, alignItems: 'center' },
  miniBtn: { fontSize: 12.5, fontWeight: '700', color: colors.accent },

  taskScroll: { marginTop: 8, flexGrow: 0 },
  taskChip: {
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: radii.chip,
    backgroundColor: '#F2F5FA',
    marginRight: 6,
  },
  taskChipOn: { backgroundColor: colors.accent },
  taskChipText: { fontSize: 12, fontWeight: '700', color: colors.sub },
  taskChipTextOn: { color: '#FFFFFF' },
  applyTitle: { fontSize: 14, fontWeight: '700', color: colors.ink, marginTop: 10 },
  dataRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  dataBox: {
    flex: 1,
    backgroundColor: '#F5F9FF',
    borderRadius: 12,
    padding: 9,
    alignItems: 'center',
  },
  dataKey: { fontSize: 11, color: colors.sub },
  dataVal: { fontSize: 16, fontWeight: '800', color: colors.ink, marginTop: 2 },
  dataSlash: { fontSize: 16, fontWeight: '800', color: colors.faint },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, flexWrap: 'wrap' },
  inputLabel: { fontSize: 12, fontWeight: '700', color: colors.inkSoft },
  inputLabel2: { fontSize: 12, fontWeight: '700', color: colors.inkSoft, marginLeft: 4 },
  input: {
    width: 62,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 9,
    paddingHorizontal: 8,
    paddingVertical: 5,
    fontSize: 13,
    color: colors.ink,
  },
  miniPick: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: '#FFFFFF',
  },
  miniPickOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  miniPickText: { fontSize: 12.5, fontWeight: '700', color: colors.sub },
  miniPickTextOn: { color: '#FFFFFF' },

  legendLine: { fontSize: 12, color: colors.inkSoft, lineHeight: 19, marginTop: 5 },
  dotCat: { color: '#F2A25C' },
  dotAnion: { color: '#5FBFA8' },
  dotOk: { color: colors.green },
  dotBad: { color: colors.red },
  dotBar: { color: colors.faint },
  legendTip: { fontSize: 11.5, color: colors.sub, lineHeight: 18, marginTop: 8 },
});
