import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme';
import { bindScroller, jumpToZone, Note, Zone } from './zones/kit';
import { compile, type Compiled, type Vars } from '../../math/expr';
import { distanceTo, pathsBox, traceCurve, type V2, type Win } from '../../math/curves';
import { fitWin, type Req } from '../../math/extreme';
import { HIT_TOL, makeLevel, presetById, type Family, type Level } from '../../math/game';
import type { FnSave, GameSave } from '../../math/playgroundSave';
import PlotCanvas from './playground/PlotCanvas';
import InputZone, { PALETTE, type FnRow } from './playground/InputZone';
import GameZone from './playground/GameZone';
import SaveZone from './playground/SaveZone';

/**
 * 数学 · 动手：自己写函数，画在同一张画布上
 *
 *   写函数（几元几次都行，式子里的字母自动变成参数）
 *   → 画布（浅色网格、可拖可缩放、点一下读坐标、多条函数各一个颜色）
 *   → 游戏（随机给第一象限里的点，写的函数穿过就算过；难度越高点越多）
 *   → 存档（函数 + 关卡一起存，下次接着玩）
 */

const ZONE_TAGS = ['写函数', '画布', '游戏', '存档'];

const DEFAULT_FNS: FnRow[] = [
  { id: 'f1', expr: 'y = x^2 - 4x + 4', color: PALETTE[0], visible: true },
  { id: 'f2', expr: 'y = 2x + 1', color: PALETTE[1], visible: true },
];

export default function PlaygroundScreen({ onBack }: { onBack: () => void }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const wide = width >= 980;

  const [plotW, setPlotW] = useState(0);
  const H = wide ? 400 : 320;

  const [fns, setFns] = useState<FnRow[]>(DEFAULT_FNS);
  const [params, setParams] = useState<Record<string, number>>({});
  const [gameOn, setGameOn] = useState(false);
  const [family, setFamily] = useState<Family>('全部随机');
  const [diff, setDiff] = useState(1);
  const [level, setLevel] = useState<Level>(() => makeLevel('全部随机', 1));
  const [revealed, setRevealed] = useState(false);

  /** 编译结果：读得出来的留着画，读不出来的留着报错 */
  const compiled = useMemo(() => fns.map((f) => ({ f, r: compile(f.expr) })), [fns]);

  const okCurves = useMemo(
    () =>
      compiled
        .filter((x) => x.r.ok && x.f.visible)
        .map((x) => ({ id: x.f.id, color: x.f.color, c: (x.r as { ok: true; c: Compiled }).c })),
    [compiled]
  );

  const errs = useMemo(() => {
    const m: Record<string, string> = {};
    compiled.forEach((x) => {
      if (!x.r.ok && x.f.expr.trim()) m[x.f.id] = (x.r as { ok: false; err: string }).err;
    });
    return m;
  }, [compiled]);

  const usedParams = useMemo(() => {
    const s = new Set<string>();
    compiled.forEach((x) => {
      if (x.r.ok) (x.r as { ok: true; c: Compiled }).c.params.forEach((p) => s.add(p));
    });
    return [...s].sort();
  }, [compiled]);

  const vars = useMemo<Vars>(() => {
    const v: Vars = { x: 0, y: 0 };
    usedParams.forEach((p) => {
      v[p] = params[p] ?? 1;
    });
    return v;
  }, [usedParams, params]);

  /* ---------------- 自动取景：让画的内容刚好在画面里 ---------------- */

  const aspect = plotW > 0 ? H / Math.max(1, plotW) : 0.8;
  const base = useMemo<Win>(() => {
    // 先在一块「探针窗口」里粗采一遍，看看这些曲线大概占多大地方
    const probe = fitWin({ xLo: -9, xHi: 9, yLo: -6, yHi: 6 }, aspect);
    const samples = okCurves.map((cv) => traceCurve(cv.c, probe, 320, Math.round(320 * aspect), vars));
    const box = pathsBox(samples);
    const clamp = (v: number) => Math.max(-25, Math.min(25, v));
    let req: Req = { xLo: -6, xHi: 6, yLo: -4, yHi: 6 };
    if (box) {
      // 只取「探针窗口里看得见的那部分」—— 不然 y = x^5 这种会把画面撑到看不见原点
      const inter = {
        xLo: Math.max(box.xLo, probe.xLo),
        xHi: Math.min(box.xHi, probe.xHi),
        yLo: Math.max(box.yLo, probe.yLo),
        yHi: Math.min(box.yHi, probe.yHi),
      };
      const usable = inter.xHi - inter.xLo > 0.5 && inter.yHi - inter.yLo > 0.5;
      const src = usable ? inter : box;
      req = { xLo: clamp(src.xLo), xHi: clamp(src.xHi), yLo: clamp(src.yLo), yHi: clamp(src.yHi) };
    }
    if (gameOn && level.points.length) {
      const xs = level.points.map((p) => p.x);
      const ys = level.points.map((p) => p.y);
      req.xLo = Math.min(req.xLo, ...xs);
      req.xHi = Math.max(req.xHi, ...xs);
      req.yLo = Math.min(req.yLo, ...ys);
      req.yHi = Math.max(req.yHi, ...ys);
    }
    const padX = Math.max(0.6, (req.xHi - req.xLo) * 0.12);
    const padY = Math.max(0.6, (req.yHi - req.yLo) * 0.12);
    return fitWin(
      { xLo: req.xLo - padX, xHi: req.xHi + padX, yLo: req.yLo - padY, yHi: req.yHi + padY },
      aspect
    );
  }, [okCurves, vars, aspect, gameOn, level]);

  /* ---------------- 命中判定：点有没有落在曲线上 ---------------- */

  const { hits, hitMap } = useMemo(() => {
    const out: Record<string, string[]> = {};
    const map: Record<string, boolean> = {};
    if (!gameOn) return { hits: out, hitMap: map };
    level.points.forEach((p, i) => {
      const key = `P${i + 1}`;
      map[key] = false;
      okCurves.forEach((cv) => {
        const d = distanceTo(cv.c.F, p as V2, vars);
        if (Number.isFinite(d) && d <= level.tol) {
          map[key] = true;
          out[cv.id] = [...(out[cv.id] ?? []), key];
        }
      });
    });
    return { hits: out, hitMap: map };
  }, [gameOn, level, okCurves, vars]);

  const targets = useMemo(
    () =>
      level.points.map((p, i) => ({
        id: `P${i + 1}`,
        x: p.x,
        y: p.y,
        hit: !!hitMap[`P${i + 1}`],
      })),
    [level, hitMap]
  );

  /* ---------------- 各种操作 ---------------- */

  const newLevel = useCallback(() => {
    setLevel(makeLevel(family, diff));
    setRevealed(false);
  }, [family, diff]);

  const changeFamily = useCallback(
    (f: Family) => {
      setFamily(f);
      setLevel(makeLevel(f, diff));
      setRevealed(false);
    },
    [diff]
  );

  const changeDiff = useCallback(
    (d: number) => {
      setDiff(d);
      setLevel(makeLevel(family, d));
      setRevealed(false);
    },
    [family]
  );

  const loadSave = useCallback((sfns: FnSave[], sparams: Record<string, number>, sgame: GameSave | null) => {
    setFns(
      sfns.length
        ? sfns.map((s, i) => ({ id: `f${Date.now()}-${i}`, expr: s.expr, color: s.color, visible: s.visible }))
        : []
    );
    setParams(sparams ?? {});
    if (sgame) {
      setGameOn(sgame.on);
      setFamily((sgame.family as Family) ?? '全部随机');
      setDiff(sgame.diff ?? 1);
      setLevel({
        presetId: sgame.presetId,
        family: (sgame.family as Family) ?? '全部随机',
        diff: sgame.diff ?? 1,
        points: sgame.points ?? [],
        tol: HIT_TOL,
      });
      setRevealed(!!sgame.revealed);
    }
  }, []);

  const gameSave: GameSave = {
    on: gameOn,
    family,
    diff,
    presetId: level.presetId,
    points: level.points,
    revealed,
  };

  const preset = presetById(level.presetId);
  const resetKey = `${level.presetId}:${level.points.map((p) => `${p.x},${p.y}`).join('|')}`;

  const canvasZone = (
    <Zone
      tag="画布"
      title="一张画布 · 几条函数"
      sub="浅色网格是坐标系，点一下画布就把那个点的坐标读出来；拖动平移，双指捏合 / ⌘(Ctrl)+滚轮 缩放，双击或点右上角回自动取景。横纵同尺度，圆看着就是圆。"
      color={colors.cyan}
    >
      <PlotCanvas
        base={base}
        curves={okCurves}
        vars={vars}
        targets={gameOn ? targets : undefined}
        tol={level.tol}
        height={H}
        resetKey={resetKey}
        onWidth={setPlotW}
      />

      <View style={styles.legendRow}>
        {fns.map((f) => {
          const bad = errs[f.id];
          const hit = hits[f.id] ?? [];
          return (
            <View key={f.id} style={styles.legendItem}>
              <View style={[styles.legendBar, { backgroundColor: f.color, opacity: f.visible ? 1 : 0.25 }]} />
              <Text style={[styles.legendText, !f.visible && { color: colors.faint }]} numberOfLines={1}>
                {f.expr || '（空）'}
                {bad ? ' · 读不出来' : hit.length ? ` · 命中 ${hit.join('、')}` : ''}
              </Text>
            </View>
          );
        })}
        {!fns.length ? <Text style={styles.empty}>还没有函数 —— 在「写函数」里加一条，或者点个预设。</Text> : null}
      </View>

      {gameOn && preset ? (
        <Note
          tone={targets.every((t) => t.hit) ? 'good' : 'sub'}
          icon={targets.every((t) => t.hit) ? 'trophy-outline' : 'locate-outline'}
          text={`关卡目标：让（随便哪一条）函数穿过 ${level.points.length} 个整点 —— 判定用的是「点到曲线有多远」，小于 ${level.tol} 就算穿过。`}
        />
      ) : null}
    </Zone>
  );

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable style={styles.backBtn} onPress={onBack} accessibilityRole="button">
          <Ionicons name="chevron-back" size={18} color={colors.inkSoft} />
          <Text style={styles.backText}>返回</Text>
        </Pressable>
        <Text style={styles.title}>画图</Text>
        <Text style={styles.subtitle}>
          自己写函数（几元几次都行，式子里的字母自动变成滑块），好几条同时画在一张画布上 ——
          画布能拖能缩放，点一下读坐标；开游戏模式，随机给你第一象限里的点，穿过去就算过关，还能存档下次接着玩
        </Text>
      </View>

      {!wide ? (
        <View style={styles.jumpBar}>
          {ZONE_TAGS.map((t) => (
            <Pressable key={t} style={styles.jumpChip} onPress={() => jumpToZone(t)} accessibilityRole="button">
              <Text style={styles.jumpText}>{t}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      <ScrollView
        ref={(node) => bindScroller(node)}
        contentContainerStyle={[styles.body, { paddingBottom: 96 }]}
        showsVerticalScrollIndicator={false}
      >
        {wide ? (
          <View style={styles.deck}>
            <View style={styles.colMain}>
              {canvasZone}
              <InputZone
                fns={fns}
                setFns={setFns}
                params={params}
                setParams={setParams}
                usedParams={usedParams}
                errs={errs}
                hits={hits}
                gameOn={gameOn}
              />
            </View>
            <View style={styles.colSide}>
              <GameZone
                gameOn={gameOn}
                setGameOn={setGameOn}
                family={family}
                setFamily={changeFamily}
                diff={diff}
                setDiff={changeDiff}
                level={level}
                onNewLevel={newLevel}
                hitMap={hitMap}
                revealed={revealed}
                setRevealed={setRevealed}
              />
              <SaveZone fns={fns} params={params} game={gameSave} onLoad={loadSave} />
            </View>
          </View>
        ) : (
          <>
            {canvasZone}
            <InputZone
              fns={fns}
              setFns={setFns}
              params={params}
              setParams={setParams}
              usedParams={usedParams}
              errs={errs}
              hits={hits}
              gameOn={gameOn}
            />
            <GameZone
              gameOn={gameOn}
              setGameOn={setGameOn}
              family={family}
              setFamily={changeFamily}
              diff={diff}
              setDiff={changeDiff}
              level={level}
              onNewLevel={newLevel}
              hitMap={hitMap}
              revealed={revealed}
              setRevealed={setRevealed}
            />
            <SaveZone fns={fns} params={params} game={gameSave} onLoad={loadSave} />
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: 16, paddingBottom: 6 },
  backBtn: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', marginBottom: 6 },
  backText: { fontSize: 14, color: colors.inkSoft, fontWeight: '600', marginLeft: 2 },
  title: { fontSize: 26, fontWeight: '800', color: colors.ink },
  subtitle: { fontSize: 11.5, color: colors.sub, lineHeight: 17, marginTop: 4 },
  jumpBar: { flexDirection: 'row', paddingHorizontal: 12, paddingBottom: 6 },
  jumpChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: '#EEF3FB',
    marginRight: 6,
  },
  jumpText: { fontSize: 11.5, fontWeight: '700', color: colors.inkSoft },
  body: { paddingHorizontal: 12, paddingTop: 2 },
  deck: { flexDirection: 'row', alignItems: 'flex-start' },
  colMain: { flex: 1.15, marginRight: 8 },
  colSide: { flex: 1 },
  legendRow: { marginTop: 8 },
  legendItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  legendBar: { width: 14, height: 3, borderRadius: 2, marginRight: 6 },
  legendText: { flex: 1, fontSize: 11, fontWeight: '600', color: colors.inkSoft },
  empty: { fontSize: 11.5, color: colors.faint },
});
