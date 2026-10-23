import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Acid3DView from '../components/Acid3DView';
import AcidConfetti from '../components/AcidConfetti';
import CanvasPanPad, { type PanDir } from '../components/CanvasPanPad';
import AcidPracticeView from './AcidPracticeView';
import { colors, radii, shadow } from '../theme';
import {
  buildScript,
  caseById,
  CASES,
  GROUP_FILTERS,
  KW_BASE,
  VERDICT_TONE,
  fmtConc,
  type AcidCase,
  type Verdict,
} from '../acid/acidRule';

type FilterKey = 'all' | 'acid' | 'base' | 'salt';
type Mode = 'explore' | 'practice';

interface Status {
  step: number;
  steps: number;
  playing: boolean;
  title: string;
  text: string;
  kind: string;
  h: number;
  oh: number;
}

const SPEEDS: { v: number; label: string }[] = [
  { v: 0.7, label: '0.7×' },
  { v: 1, label: '1×' },
  { v: 1.5, label: '1.5×' },
];

export default function AcidBaseScreen({
  onBack,
  initialCaseId,
}: {
  onBack: () => void;
  /** 从知识点汇总进入时预选的物质（如 nh4cl、na2co3） */
  initialCaseId?: string;
}) {
  const { width, height: winH } = useWindowDimensions();
  const wide = width >= 720;
  const insets = useSafeAreaInsets();

  const [mode, setMode] = useState<Mode>('explore');
  const [filter, setFilter] = useState<FilterKey>('all');
  const [caseId, setCaseId] = useState<string>(initialCaseId ?? CASES[0].id);
  const [status, setStatus] = useState<Status | null>(null);
  const [speed, setSpeed] = useState<number>(1);
  /** 练习模式下推导出来的物质 + 要跳到第几拍 + 重放用的计数器 */
  const [practiceCase, setPracticeCase] = useState<AcidCase | null>(null);
  const [practiceFrom, setPracticeFrom] = useState<number>(0);
  const [nonce, setNonce] = useState<number>(0);
  /** 全部答对时的撒花（>0 才渲染，值变化重播） */
  const [confettiId, setConfettiId] = useState<number>(0);

  const exploreCase = useMemo<AcidCase>(() => caseById(caseId), [caseId]);
  const cur = mode === 'practice' && practiceCase ? practiceCase : exploreCase;
  const script = useMemo(() => buildScript(cur), [cur]);
  const command = useMemo(
    () => ({
      cmd: 'acid',
      case: cur,
      script,
      from: mode === 'practice' ? practiceFrom : 0,
      play: true,
      nonce,
    }),
    [cur, script, practiceFrom, mode, nonce]
  );

  const handlePracticeCase = useCallback((c: AcidCase | null) => {
    setPracticeCase(c);
    setPracticeFrom(0);
  }, []);
  /** 练习模式每答一步，就把画面跳到那一步的真实过程重新播一遍 */
  const handlePlayBeat = useCallback((i: number) => {
    setPracticeFrom(i);
    setNonce((v) => v + 1);
  }, []);
  const handleCelebrate = useCallback(() => setConfettiId((v) => v + 1), []);

  // 拿到宿主 post 句柄后存到这里；ctl 命令用它来发
  const [post, setPost] = useState<(m: object) => void>(() => () => {});
  const handleHostPost = useCallback((p: (m: object) => void) => setPost(() => p), []);
  /** 画布上的方向盘：平移观察中心（与分子浏览里那组按钮完全一致） */
  const handlePan = useCallback((dir: PanDir) => post({ cmd: 'view', action: 'pan', dir }), [post]);

  const onEvent = useCallback((ev: { ev: string } & Record<string, unknown>) => {
    if (ev.ev === 'acid' || ev.ev === 'ready') {
      setStatus({
        step: Number(ev.step || 0),
        steps: Number(ev.steps || 0),
        playing: !!ev.playing,
        title: String(ev.title || ''),
        text: String(ev.text || ''),
        kind: String(ev.kind || ''),
        h: Number(ev.h || 0),
        oh: Number(ev.oh || 0),
      });
    }
  }, []);

  // 切 case 时清掉上一次的 caption
  useEffect(() => {
    setStatus(null);
  }, [caseId]);

  // 速度变更后同步给引擎
  useEffect(() => {
    post({ cmd: 'acidCtl', action: 'speed', value: speed });
  }, [speed, post]);

  const filtered = useMemo(
    () => (filter === 'all' ? CASES : CASES.filter((c) => c.groupKey === filter)),
    [filter]
  );

  const canvasH = wide ? 430 : Math.round(Math.max(280, Math.min(400, winH * 0.42)));
  const h = status?.h ?? KW_BASE;
  const oh = status?.oh ?? KW_BASE;
  const maxBar = Math.max(2, h, oh);

  return (
    <View style={styles.root}>
      {confettiId > 0 ? (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <AcidConfetti runId={confettiId} count={64} />
        </View>
      ) : null}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <Pressable style={styles.backBtn} onPress={onBack} accessibilityRole="button" accessibilityLabel="返回">
          <Ionicons name="chevron-back" size={18} color={colors.accent} />
          <Text style={styles.backText}>返回</Text>
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>酸碱性</Text>
          <Text style={styles.subtitle} numberOfLines={1}>
            {mode === 'practice'
              ? '练习模式：先猜，再看动画验证'
              : `${cur.name} · ${cur.group}`}
          </Text>
        </View>
        <View style={styles.modeSwitch}>
          {(['explore', 'practice'] as Mode[]).map((m) => {
            const on = mode === m;
            return (
              <Pressable
                key={m}
                style={[styles.modeBtn, on && styles.modeBtnOn]}
                onPress={() => setMode(m)}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
              >
                <Text style={[styles.modeText, on && styles.modeTextOn]}>
                  {m === 'explore' ? '看动画' : '练一练'}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {mode === 'explore' ? (
        <>
          <View style={styles.filterRow}>
            {GROUP_FILTERS.map((g) => {
              const on = filter === g.key;
              return (
                <Pressable
                  key={g.key}
                  style={[styles.filterBtn, on && styles.filterBtnOn]}
                  onPress={() => setFilter(g.key)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                >
                  <Text style={[styles.filterText, on && styles.filterTextOn]}>{g.label}</Text>
                </Pressable>
              );
            })}
          </View>
          <CaseChips cases={filtered} activeId={exploreCase.id} onPick={setCaseId} />
        </>
      ) : null}

      {wide ? (
        <View style={styles.stageWide}>
          <View style={styles.canvasCol}>
            <View style={styles.canvasWrap}>
              <Acid3DView command={command} onEvent={onEvent} onHostPost={handleHostPost} />
              <CanvasPanPad top={8} bottom={8} onPan={handlePan} />
              <View style={styles.hudTop} pointerEvents="none">
                <CountPill kind="h" count={h} max={maxBar} />
                <CountPill kind="oh" count={oh} max={maxBar} />
              </View>
            </View>
            <ControlBar
              status={status}
              speed={speed}
              onCtl={(a) => post({ cmd: 'acidCtl', action: a })}
              onSpeed={setSpeed}
            />
          </View>
          <View style={styles.panelCol}>
            <ScrollView contentContainerStyle={styles.panelScroll} showsVerticalScrollIndicator={false}>
              <CaptionCard cur={cur} status={status} />
              <KwCard h={h} oh={oh} />
              {mode === 'practice' ? (
                <AcidPracticeView
                  onCaseReady={handlePracticeCase}
                  onPlayBeat={handlePlayBeat}
                  onCelebrate={handleCelebrate}
                />
              ) : (
                <>
                  <VerdictCard cur={cur} h={h} oh={oh} maxBar={maxBar} />
                  <ExplainCard cur={cur} />
                  <LegendCard />
                </>
              )}
            </ScrollView>
          </View>
        </View>
      ) : (
        /* 窄屏（手机）：整页统一滚动 —— 画布 + 控制条 + 卡片都在一个 ScrollView 里，
           否则画布把下方内容挤到屏幕外、剩余高度不够时滚动区直接塌成 0，什么都看不到 */
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.narrowBody}
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.canvasWrapFixed, { height: canvasH }]}>
            <Acid3DView command={command} onEvent={onEvent} onHostPost={handleHostPost} />
            <CanvasPanPad top={8} bottom={8} onPan={handlePan} />
            {/* 窄屏 HUD 放画布底部，给顶部居中的上箭头让位 */}
            <View style={wide ? styles.hudTop : styles.hudBottom} pointerEvents="none">
              <CountPill kind="h" count={h} max={maxBar} />
              <CountPill kind="oh" count={oh} max={maxBar} />
            </View>
          </View>
          <ControlBar
            status={status}
            speed={speed}
            onCtl={(a) => post({ cmd: 'acidCtl', action: a })}
            onSpeed={setSpeed}
            compact
          />
          <CaptionCard cur={cur} status={status} />
          <KwCard h={h} oh={oh} />
          {mode === 'practice' ? (
            <AcidPracticeView
              onCaseReady={handlePracticeCase}
              onPlayBeat={handlePlayBeat}
              onCelebrate={handleCelebrate}
            />
          ) : (
            <>
              <VerdictCard cur={cur} h={h} oh={oh} maxBar={maxBar} />
              <ExplainCard cur={cur} />
              <LegendCard />
            </>
          )}
        </ScrollView>
      )}
    </View>
  );
}

/* ---------------- 物质选择条 ---------------- */
function CaseChips({
  cases,
  activeId,
  onPick,
}: {
  cases: AcidCase[];
  activeId: string;
  onPick: (id: string) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.chipsScroll}
      contentContainerStyle={styles.chipsRow}
    >
      {cases.map((c) => {
        const on = c.id === activeId;
        const tone = VERDICT_TONE[c.verdict];
        return (
          <Pressable
            key={c.id}
            style={[styles.chip, on && styles.chipOn, on && { borderColor: tone.fg, backgroundColor: tone.bg }]}
            onPress={() => onPick(c.id)}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
          >
            <Text style={[styles.chipFormula, on && { color: tone.fg }]}>{c.formula}</Text>
            <View style={[styles.chipDot, { backgroundColor: tone.fg }]} />
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

/* ---------------- 计数小标 ---------------- */
function CountPill({ kind, count, max }: { kind: 'h' | 'oh'; count: number; max: number }) {
  const isH = kind === 'h';
  const c = isH ? '#c62828' : '#1565c0';
  const fillW = Math.max(6, Math.round((count / max) * 60));
  return (
    <View style={[styles.hudPill, { borderColor: c }]}>
      <Text style={[styles.hudPillT, { color: c }]}>
        {isH ? 'H⁺' : 'OH⁻'} ×{count}
      </Text>
      <View style={styles.hudPillBar}>
        <View style={{ width: fillW, height: 6, borderRadius: 3, backgroundColor: c }} />
      </View>
    </View>
  );
}

/* ---------------- 控制条 ---------------- */
function ControlBar({
  status,
  speed,
  onCtl,
  onSpeed,
  compact,
}: {
  status: Status | null;
  speed: number;
  onCtl: (a: string) => void;
  onSpeed: (v: number) => void;
  compact?: boolean;
}) {
  const playing = !!status?.playing;
  return (
    <View style={[styles.ctrl, compact && { marginHorizontal: 12, marginTop: 8 }]}>
      <Pressable style={styles.ctrlBtn} onPress={() => onCtl('restart')} accessibilityLabel="重播">
        <Ionicons name="refresh" size={18} color={colors.ink} />
      </Pressable>
      <Pressable style={styles.ctrlBtn} onPress={() => onCtl('prev')} accessibilityLabel="上一步">
        <Ionicons name="play-skip-back" size={18} color={colors.ink} />
      </Pressable>
      <Pressable
        style={[styles.ctrlBtn, styles.ctrlBtnPrimary]}
        onPress={() => onCtl(playing ? 'pause' : 'play')}
        accessibilityLabel={playing ? '暂停' : '播放'}
      >
        <Ionicons name={playing ? 'pause' : 'play'} size={22} color="#FFFFFF" />
      </Pressable>
      <Pressable style={styles.ctrlBtn} onPress={() => onCtl('next')} accessibilityLabel="下一步">
        <Ionicons name="play-skip-forward" size={18} color={colors.ink} />
      </Pressable>
      <View style={styles.ctrlSpacer} />
      <View style={styles.speedRow}>
        {SPEEDS.map((s) => {
          const on = s.v === speed;
          return (
            <Pressable
              key={s.v}
              style={[styles.speedBtn, on && styles.speedBtnOn]}
              onPress={() => onSpeed(s.v)}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
            >
              <Text style={[styles.speedText, on && styles.speedTextOn]}>{s.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/* ---------------- 讲义卡：当前节拍 + 文本 ---------------- */
function CaptionCard({ cur, status }: { cur: AcidCase; status: Status | null }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHead}>
        <Ionicons name="chatbox-ellipses-outline" size={15} color={colors.accent} />
        <Text style={styles.cardTitle}>当前讲解</Text>
        {status ? (
          <Text style={styles.cardStep}>
            {status.step}/{status.steps} · {status.kind || '-'}
          </Text>
        ) : null}
      </View>
      <Text style={styles.captionTitle}>{status?.title || cur.headline}</Text>
      <Text style={styles.captionText}>{status?.text || cur.why}</Text>
    </View>
  );
}

/* ---------------- 离子积面板：c(H⁺)·c(OH⁻) = Kw ---------------- */
function KwCard({ h, oh }: { h: number; oh: number }) {
  const ch = h / KW_BASE;
  const coh = oh / KW_BASE;
  const prod = ch * coh; // 单位 10⁻¹⁴；平衡时恒等于 1
  const total = Math.max(0.001, ch + coh);
  const ratio = Math.max(ch, coh) / Math.max(0.001, Math.min(ch, coh));
  const neutral = Math.abs(ch - coh) < 1e-6;
  // 乘积回到 1 = 已落回 Kw 平衡；大于 1 = 离子刚放出、平衡还没来得及左移
  const balanced = Math.abs(prod - 1) < 0.03;

  return (
    <View style={styles.card}>
      <View style={styles.cardHead}>
        <Ionicons name="analytics-outline" size={15} color={colors.accent} />
        <Text style={styles.cardTitle}>离子积 Kw（25 ℃）</Text>
        <Text style={styles.cardStep}>粒子数 {h} : {oh}</Text>
      </View>

      <View style={styles.kwRow}>
        <Text style={[styles.kwIon, { color: '#c62828' }]}>c(H⁺)</Text>
        <View style={styles.kwBarWrap}>
          <View style={[styles.kwBar, { width: `${(ch / total) * 100}%`, backgroundColor: '#c62828' }]} />
        </View>
        <Text style={styles.kwVal}>{fmtConc(ch)}</Text>
      </View>
      <View style={styles.kwRow}>
        <Text style={[styles.kwIon, { color: '#1565c0' }]}>c(OH⁻)</Text>
        <View style={styles.kwBarWrap}>
          <View style={[styles.kwBar, { width: `${(coh / total) * 100}%`, backgroundColor: '#1565c0' }]} />
        </View>
        <Text style={styles.kwVal}>{fmtConc(coh)}</Text>
      </View>

      <View style={[styles.kwProdBox, !balanced && { backgroundColor: '#FFF6E8' }]}>
        <Text style={styles.kwProd}>
          c(H⁺) × c(OH⁻) = {fmtConc(ch).replace('×10⁻⁷', '')} × {fmtConc(coh).replace('×10⁻⁷', '')} × 10⁻¹⁴
        </Text>
        <Text style={[styles.kwProdBig, !balanced && { color: '#B26A00' }]}>
          {balanced
            ? `= ${prod.toFixed(2)}×10⁻¹⁴ = Kw ✓`
            : `= ${prod.toFixed(2)}×10⁻¹⁴ ＞ Kw → 平衡正在左移`}
        </Text>
      </View>
      <Text style={styles.kwNote}>
        {neutral
          ? '两边相等 → 中性。此时 c(H⁺) = c(OH⁻) = 1.0×10⁻⁷，乘积就是 Kw。'
          : balanced
            ? `H⁺ 是 OH⁻ 的 ${ratio.toFixed(ratio < 10 ? 1 : 0)} 倍，OH⁻ 就被压到原来的 1/${ratio.toFixed(ratio < 10 ? 1 : 0)} —— ` +
              '一个 OH⁻ 都没有凭空消失，剩下的每一个都来自水分子的电离。乘积始终不变，这就是 Kw 的约束。'
            : '溶质刚放出大量离子、平衡还没来得及响应：此刻乘积暂时大于 Kw，' +
              '多余的 H⁺ 会立刻撞上 OH⁻ 结合成水（下一拍「平衡左移」），把乘积压回 Kw。'}
      </Text>
    </View>
  );
}

/* ---------------- 结论卡：H⁺ vs OH⁻ 对比 + 结论 ---------------- */
function VerdictCard({
  cur,
  h,
  oh,
  maxBar,
}: {
  cur: AcidCase;
  h: number;
  oh: number;
  maxBar: number;
}) {
  const tone = VERDICT_TONE[cur.verdict];
  const hW = Math.max(8, Math.round((h / maxBar) * 180));
  const oW = Math.max(8, Math.round((oh / maxBar) * 180));
  return (
    <View style={styles.card}>
      <View style={styles.cardHead}>
        <Ionicons name="analytics-outline" size={15} color={tone.fg} />
        <Text style={styles.cardTitle}>离子对比 · 结论</Text>
        <View style={[styles.verdictBadge, { backgroundColor: tone.bg }]}>
          <Text style={[styles.verdictText, { color: tone.fg }]}>{tone.label}</Text>
        </View>
      </View>

      <View style={styles.barRow}>
        <Text style={styles.barLabel}>H⁺</Text>
        <View style={styles.barTrack}>
          <View style={[styles.barFill, { width: hW, backgroundColor: '#ff5252' }]} />
        </View>
        <Text style={styles.barNum}>×{h}</Text>
      </View>
      <View style={styles.barRow}>
        <Text style={[styles.barLabel, { color: '#1565c0' }]}>OH⁻</Text>
        <View style={styles.barTrack}>
          <View style={[styles.barFill, { width: oW, backgroundColor: '#2f6fed' }]} />
        </View>
        <Text style={[styles.barNum, { color: '#1565c0' }]}>×{oh}</Text>
      </View>

      <Text style={styles.equation}>{cur.equation}</Text>
      <Text style={styles.headline}>{cur.headline}</Text>
    </View>
  );
}

/* ---------------- 讲解卡：为什么 ---------------- */
function ExplainCard({ cur }: { cur: AcidCase }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHead}>
        <Ionicons name="book-outline" size={15} color={colors.accent} />
        <Text style={styles.cardTitle}>为什么是这样</Text>
      </View>
      <Text style={styles.explain}>{cur.why}</Text>
      {cur.compare ? (
        <View style={styles.compareBox}>
          <Text style={styles.compareTitle}>易混对比</Text>
          <Text style={styles.compareText}>{cur.compare}</Text>
        </View>
      ) : null}
    </View>
  );
}

/* ---------------- 图例 ---------------- */
function LegendCard() {
  const Item = ({ color, label }: { color: string; label: string }) => (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
  return (
    <View style={styles.card}>
      <View style={styles.cardHead}>
        <Ionicons name="color-palette-outline" size={15} color={colors.sub} />
        <Text style={styles.cardTitle}>画面怎么看</Text>
      </View>
      <View style={styles.legendGrid}>
        <Item color="#ff5252" label="H⁺ 自由质子" />
        <Item color="#2f6fed" label="OH⁻ 自由氢氧根" />
        <Item color="#f5a623" label="阳离子（橙）" />
        <Item color="#2fbfa0" label="阴离子（青）" />
        <Item color="#9a6bd6" label="水解生成的弱电解质" />
        <Item color="#7f8fa6" label="未电离的溶质分子" />
        <Item color="#a9b4c4" label="水分子（溶剂）" />
      </View>
      <Text style={styles.legendTip}>
        抢走水的 OH⁻ / H⁺ 时，水消失、被抢走部分并入离子、剩下部分变成新的自由离子。
      </Text>
    </View>
  );
}

/* ---------------- 样式 ---------------- */
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingTop: 10, paddingBottom: 6,
  },
  backBtn: { flexDirection: 'row', alignItems: 'center', marginRight: 6 },
  backText: { fontSize: 13, color: colors.accent, fontWeight: '600' },
  title: { fontSize: 19, fontWeight: '800', color: colors.ink },
  subtitle: { fontSize: 11.5, color: colors.sub, marginTop: 2 },
  modeSwitch: {
    flexDirection: 'row', backgroundColor: '#EDF1F7', borderRadius: 10, padding: 2,
  },
  modeBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  modeBtnOn: { backgroundColor: colors.card, ...shadow.card },
  modeText: { fontSize: 12, fontWeight: '800', color: colors.sub },
  modeTextOn: { color: colors.accent },

  filterRow: { flexDirection: 'row', paddingHorizontal: 14, gap: 6, paddingTop: 6, paddingBottom: 4 },
  filterBtn: {
    paddingHorizontal: 12, paddingVertical: 5, borderRadius: radii.chip,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line,
  },
  filterBtnOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  filterText: { fontSize: 12.5, fontWeight: '700', color: colors.sub },
  filterTextOn: { color: '#FFFFFF' },

  chipsScroll: { marginTop: 6, flexGrow: 0 },
  chipsRow: { paddingHorizontal: 14, paddingVertical: 6, gap: 8 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 11, paddingVertical: 6, borderRadius: radii.chip,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line,
  },
  chipOn: { borderWidth: 1.5 },
  chipFormula: { fontSize: 13, fontWeight: '800', color: colors.ink },
  chipDot: { width: 7, height: 7, borderRadius: 4 },

  /* wide */
  stageWide: { flex: 1, flexDirection: 'row', paddingHorizontal: 14, gap: 12, paddingTop: 6, paddingBottom: 12 },
  canvasCol: { flex: 1, minWidth: 0 },
  canvasWrap: { flex: 1, borderRadius: radii.card, overflow: 'hidden', backgroundColor: '#F2F6FC' },
  /* 两条计数竖排：横排时它们横向铺开，正好压住画布上下居中的方向键箭头 */
  hudTop: {
    position: 'absolute', top: 8, right: 8,
    flexDirection: 'column', alignItems: 'flex-end', gap: 6,
  },
  /* 窄屏：HUD 放画布底部，避开顶部居中的上箭头 */
  hudBottom: {
    position: 'absolute', bottom: 8, right: 8,
    flexDirection: 'column', alignItems: 'flex-end', gap: 6,
  },
  hudPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(255,255,255,0.86)', borderRadius: 12,
    paddingHorizontal: 8, paddingVertical: 4,
    borderWidth: 1.2,
  },
  hudPillT: { fontSize: 11, fontWeight: '800' },
  hudPillBar: { width: 60, height: 6, backgroundColor: '#E3EBF5', borderRadius: 3, overflow: 'hidden' },

  /* 离子积面板 */
  kwRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  kwIon: { width: 52, fontSize: 12.5, fontWeight: '800' },
  kwBarWrap: {
    flex: 1,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#EEF3FA',
    overflow: 'hidden',
    marginHorizontal: 8,
  },
  kwBar: { height: 10, borderRadius: 5 },
  kwVal: { width: 74, fontSize: 11.5, fontWeight: '700', color: colors.ink, textAlign: 'right' },
  kwProdBox: {
    marginTop: 10,
    backgroundColor: '#EDF7F4',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  kwProd: { fontSize: 11.5, color: '#00695c', fontWeight: '700', textAlign: 'center' },
  kwProdBig: { fontSize: 13.5, color: '#00695c', fontWeight: '800', textAlign: 'center', marginTop: 2 },
  kwNote: { fontSize: 11.5, color: colors.sub, lineHeight: 18, marginTop: 8 },
  panelCol: { width: 286 },
  panelScroll: { gap: 10, paddingBottom: 24 },

  /* narrow */
  canvasWrapFixed: {
    alignSelf: 'stretch', borderRadius: radii.card, overflow: 'hidden',
    backgroundColor: '#F2F6FC',
  },
  narrowBody: { paddingHorizontal: 14, paddingTop: 10, gap: 10, paddingBottom: 24 },

  /* control */
  ctrl: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: colors.card, borderRadius: radii.card,
    padding: 8, marginTop: 8, ...shadow.card,
  },
  ctrlBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#F2F5FA', alignItems: 'center', justifyContent: 'center',
  },
  ctrlBtnPrimary: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.accent },
  ctrlSpacer: { flex: 1 },
  speedRow: { flexDirection: 'row', gap: 4 },
  speedBtn: { paddingHorizontal: 8, paddingVertical: 6, borderRadius: 9, backgroundColor: '#F2F5FA' },
  speedBtnOn: { backgroundColor: colors.accent },
  speedText: { fontSize: 11.5, fontWeight: '700', color: colors.sub },
  speedTextOn: { color: '#FFFFFF' },

  /* cards */
  card: { backgroundColor: colors.card, borderRadius: radii.card, padding: 12, ...shadow.card },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cardTitle: { fontSize: 13, fontWeight: '800', color: colors.ink, flex: 1 },
  cardStep: { fontSize: 11, color: colors.faint, fontWeight: '700' },
  captionTitle: { fontSize: 14, fontWeight: '800', color: colors.ink, marginTop: 8 },
  captionText: { fontSize: 12.5, color: colors.inkSoft, lineHeight: 19, marginTop: 6 },

  barRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  barLabel: { fontSize: 12, fontWeight: '800', color: '#c62828', width: 32 },
  barTrack: { flex: 1, height: 14, backgroundColor: '#F2F5FA', borderRadius: 7, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 7 },
  barNum: { fontSize: 12, fontWeight: '800', color: '#c62828', width: 32, textAlign: 'right' },
  verdictBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 9 },
  verdictText: { fontSize: 10.5, fontWeight: '800' },
  equation: { fontSize: 13, color: colors.ink, marginTop: 10, fontWeight: '700' },
  headline: { fontSize: 12, color: colors.inkSoft, lineHeight: 18, marginTop: 5 },

  explain: { fontSize: 12.5, color: colors.inkSoft, lineHeight: 19, marginTop: 8 },
  compareBox: { backgroundColor: '#F5F9FF', borderRadius: 12, padding: 10, marginTop: 10 },
  compareTitle: { fontSize: 11.5, fontWeight: '800', color: colors.accent },
  compareText: { fontSize: 12, color: colors.inkSoft, lineHeight: 18, marginTop: 4 },

  legendGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5, minWidth: '46%' },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: 11.5, color: colors.inkSoft },
  legendTip: { fontSize: 11, color: colors.sub, lineHeight: 17, marginTop: 10 },
});
