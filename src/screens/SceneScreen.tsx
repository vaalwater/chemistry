import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, PanResponder, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Chem3DView, { type Chem3DHandle } from '../components/Chem3DView';
import { colors, radii, shadow } from '../theme';
import {
  acidityTone,
  atomChargeOf,
  content,
  elementBySymbol,
  electronConfigText,
  electronShellConfigs,
  ionChargeText,
  moleculeById,
  octetRuleText,
  reactionById,
  SHELL_LABELS,
  shellsForIon,
} from '../data';
import { LATTICE_LINKS } from '../radius/radiusRule';
import type { ElementData, EngineEvent, MoleculeData, SceneReq } from '../types';

interface Entry {
  scene: SceneReq;
  from?: string; // 用于返回按钮文案
}

interface Props {
  initial: SceneReq;
  onClose: () => void;
  /** 离子晶体类分子（NaCl 等）跳转到“半径比·配位数实验” */
  onOpenRadiusLab?: (molId: string) => void;
}

/** 反应展示元数据：内置 ReactionData 与宿主下发剧幕 Drama 共用视图（都带 step title/desc） */
export interface ReactionView {
  name: string;
  equation: string;
  condition?: string;
  type: string;
  level: string;
  desc: string;
  steps: { title: string; desc: string }[];
}

export default function SceneScreen({ initial, onClose, onOpenRadiusLab }: Props) {
  const insets = useSafeAreaInsets();
  const [stack, setStack] = useState<Entry[]>([{ scene: initial }]);
  const [rxn, setRxn] = useState<{ step: number; steps: number; playing: boolean } | null>(null);
  const [note, setNote] = useState<string | null>(null); // 底部轻提示
  const [atomCtx, setAtomCtx] = useState<AtomCtxInfo | null>(null);
  // 原子视图里的“共价键形成”演示（成键过程动画）的播放状态
  const [bondDemo, setBondDemo] = useState<{
    step: number;
    steps: number;
    playing: boolean;
    title: string;
    text: string;
  } | null>(null);
  const [viewMode, setViewMode] = useState<'top' | 'solid'>('solid');
  const [labelsOn, setLabelsOn] = useState(true); // 分子球棍上的元素符号标注
  const [rxnSpeed, setRxnSpeed] = useState(1); // 反应动画速度倍率
  const [cardH, setCardH] = useState(0); // 底部信息卡实测高度，用于把画布浮层排在卡片之上
  const [engineReady, setEngineReady] = useState(false); // 引擎就绪后再补发一次视图命令（未就绪前下发的会丢失）
  const chemRef = useRef<Chem3DHandle | null>(null);

  const cur = stack[stack.length - 1];
  const curRef = useRef(cur);
  curRef.current = cur;

  const send = useCallback((msg: unknown) => {
    chemRef.current?.send(msg);
  }, []);

  // 白色过场动画：点击分子/原子进入下级视图时“点击即触发”，掩盖引擎切换场景的短暂延迟
  const veil = useRef(new Animated.Value(0)).current;
  const playVeil = useCallback(() => {
    veil.stopAnimation();
    veil.setValue(0.02);
    Animated.sequence([
      Animated.timing(veil, { toValue: 1, duration: 220, easing: Easing.out(Easing.quad), useNativeDriver: false }),
      Animated.delay(180),
      Animated.timing(veil, { toValue: 0, duration: 760, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
    ]).start();
  }, [veil]);

  const push = useCallback(
    (scene: SceneReq, from?: string) => {
      playVeil();
      setStack((s) => [...s, { scene, from }]);
    },
    [playVeil]
  );

  const goBack = useCallback(() => {
    if (stack.length > 1) {
      setStack((s) => s.slice(0, -1));
      setRxn(null);
    } else {
      onClose();
    }
  }, [stack.length, onClose]);

  const handleEvent = useCallback(
    (ev: EngineEvent) => {
      if (ev.ev === 'atomPick') {
        const symbol = String(ev.symbol ?? '');
        const req = curRef.current.scene;
        const isAtomable = req.kind === 'molecule' || req.kind === 'atom';
        if (isAtomable && elementBySymbol(symbol)) {
          // 分子页轻点原子 / 原子视图中轻点相邻原子核，都进入该原子的结构视图
          const from = req.kind === 'molecule' ? req.id : String(ev.mol ?? req.molId ?? '');
          if (!from) return;
          const aiN = Number(ev.ai);
          push(
            {
              kind: 'atom',
              id: symbol,
              molId: from,
              ai: Number.isFinite(aiN) ? aiN : undefined,
              // 内容库之外的动态分子/扩展有机物，需随请求带原数据供引擎解析
              mol: req.mol,
            },
            from
          );
        }
      } else if (ev.ev === 'atomInfo') {
        const bp = ev.bigPi as
          | { label: string; centers: number; electrons: number; selfE: number }
          | null
          | undefined;
        setAtomCtx({
          bondE: Number(ev.bondE ?? 0),
          valenceE: Number(ev.valenceE ?? 0),
          molName: ev.molName ? String(ev.molName) : null,
          sigmaE: Number(ev.sigmaE ?? ev.bondE ?? 0),
          piE: Number(ev.piE ?? 0),
          loneE: Number(ev.loneE ?? 0),
          bigPi: bp
            ? {
                label: String(bp.label ?? ''),
                centers: Number(bp.centers ?? 0),
                electrons: Number(bp.electrons ?? 0),
                selfE: Number(bp.selfE ?? 0),
              }
            : null,
        });
      } else if (ev.ev === 'bondDemo') {
        // 共价键形成演示：阶段推进 / 播放状态（进入原子视图后引擎会自动演一遍）
        setBondDemo({
          step: Number(ev.step ?? 0),
          steps: Number(ev.steps ?? 1),
          playing: Boolean(ev.playing),
          title: String(ev.title ?? ''),
          text: String(ev.text ?? ''),
        });
      } else if (ev.ev === 'formulaTap') {
        // 反应视图里点击分子式 → 打开该分子的 3D 结构页
        const req = curRef.current.scene;
        if (req.kind === 'reaction') {
          const id = String(ev.id ?? ev.molId ?? '');
          const name = ev.name ? String(ev.name) : undefined;
          const rawMol = ev.mol as MoleculeData | undefined;
          const molData =
            rawMol && rawMol.atoms && rawMol.atoms.length ? rawMol : undefined;
          if (id) {
            push(
              { kind: 'molecule', id, mol: molData ?? moleculeById(id) },
              id
            );
            setNote(`已打开 ${name ?? id} 的分子结构`);
            setTimeout(() => setNote(null), 2200);
          }
        }
      } else if (ev.ev === 'reaction') {
        setRxn({
          step: Number(ev.step ?? 0),
          steps: Number(ev.steps ?? 1),
          playing: Boolean(ev.playing),
        });
      } else if (ev.ev === 'scene') {
        if (String(ev.mode) === 'reaction') {
          // 等待引擎的第一个 step 事件同步 UI
        }
      } else if (ev.ev === 'ready') {
        // 引擎就绪前的 view / speed 命令会丢失（宿主尚未注入成功），这里标记后由 effect 补发
        setEngineReady(true);
        setNote('场景就绪，试试拖动旋转或轻点原子');
        setTimeout(() => setNote(null), 2400);
      }
    },
    [push]
  );

  const scene = cur.scene;
  const mol = scene.kind === 'molecule' ? scene.mol ?? moleculeById(scene.id) : undefined;
  const element = scene.kind === 'atom' ? elementBySymbol(scene.id) : undefined;
  // 反应场景优先采用宿主下发的“电子级剧幕”（通用推导/预置实验），否则回退内容库反应
  const reaction = useMemo<ReactionView | undefined>(() => {
    if (scene.kind !== 'reaction') return undefined;
    if (scene.reaction) {
      const d = scene.reaction;
      return {
        name: d.name,
        equation: d.equation,
        condition: d.condition,
        type: d.type,
        level: d.level,
        desc: d.desc,
        steps: d.steps,
      };
    }
    const r = reactionById(scene.id);
    if (!r) return undefined;
    return {
      name: r.name,
      equation: r.equation,
      condition: r.condition || undefined,
      type: r.type,
      level: r.level,
      desc: r.desc,
      steps: r.steps.map((s) => ({ title: s.title, desc: s.desc })),
    };
  }, [scene]);
  const atomMol = scene.kind === 'atom' && scene.molId ? scene.mol ?? moleculeById(scene.molId) : undefined;
  // 引擎按 scene 下发数据：内容库之外的扩展分子（含氮化合物/生物碱/高分子等）引擎并不认识其 id，
  // 必须随请求带上原子数据；否则只收到 id 会渲染成空白（搜索命中新分子后进入、原子视图的分子上下文等）
  const sceneForView = useMemo(() => {
    const needInject = (m?: MoleculeData): m is MoleculeData =>
      !!m && !!m.atoms && m.atoms.length > 0 && !content.molecules.some((x) => x.id === m.id);
    if (scene.mol) return scene;
    if (scene.kind === 'molecule' && needInject(mol)) return { ...scene, mol };
    if (scene.kind === 'atom' && needInject(atomMol)) return { ...scene, mol: atomMol };
    return scene;
  }, [scene, mol, atomMol]);
  const atomCharge = element && scene.kind === 'atom' ? atomChargeOf(scene, element) : 0;

  const title = useMemo(() => {
    if (scene.kind === 'molecule') return mol ? mol.formulaDisplay ?? mol.formula : scene.id;
    if (scene.kind === 'reaction') return reaction ? reaction.name : scene.id;
    if (element) return atomCharge ? ionChargeText(element.symbol, atomCharge) : element.symbol;
    return scene.id;
  }, [scene, mol, reaction, element, atomCharge]);

  const subtitle = useMemo(() => {
    if (scene.kind === 'molecule') return mol ? mol.name : '';
    if (scene.kind === 'reaction') return reaction ? reaction.equation : '';
    if (!element) return '';
    const base = element.name;
    if (atomMol) {
      return atomCharge
        ? `${base} · ${atomMol.name}中的 ${ionChargeText(element.symbol, atomCharge)}`
        : `${base} · ${atomMol.name}中的原子`;
    }
    return `${base} · 原子序数 ${element.p}`;
  }, [scene, mol, reaction, element, atomMol, atomCharge]);

  const resetView = () => send({ cmd: 'view', action: 'reset' });

  const toggleLabels = () => setLabelsOn((v) => !v);

  // 标注开关状态变化或切换分子场景时，同步给引擎（引擎每帧重建场景默认开启标注）
  useEffect(() => {
    send({ cmd: 'view', action: 'labels', value: labelsOn });
  }, [labelsOn, scene.kind, scene.id, scene.mol, send, engineReady]);

  const setAtomViewMode = (m: 'top' | 'solid') => {
    setViewMode(m);
    send({ cmd: 'view', action: m });
  };

  useEffect(() => {
    if (scene.kind === 'reaction' && reaction) {
      setRxn({ step: 0, steps: reaction.steps.length, playing: false });
    }
  }, [scene.kind, reaction]);

  // 反应动画速度倍率变化时同步给引擎（非反应场景下引擎会忽略）
  useEffect(() => {
    send({ cmd: 'reaction', action: 'speed', value: rxnSpeed });
  }, [rxnSpeed, send, engineReady]);

  // 反应 / 原子场景：把画布上下被遮挡的区域（顶部导航 / 底部信息卡，单位 px）告诉引擎，
  // 引擎据此把内容放进两条之间的可视带中央（手机竖屏上否则会被说明卡挡住、原子看着偏下）。
  // cardH 首帧还是 0、且引擎未就绪前下发的命令会丢失，所以再补一次
  useEffect(() => {
    if (scene.kind !== 'reaction' && scene.kind !== 'atom') return;
    send({ cmd: 'view', action: 'band', top: insets.top + 64, bottom: cardH + 8 });
  }, [scene.kind, cardH, insets.top, send, engineReady]);

  // 每次进入新的原子场景，默认立体视角（可手动切俯视逐层数电子），并清空上一原子的共用信息
  useEffect(() => {
    if (scene.kind === 'atom') setViewMode('solid');
    setAtomCtx(null);
    setBondDemo(null); // 换场景后等引擎重新上报演示状态
  }, [scene.kind, scene.id, scene.molId, scene.ai]);

  return (
    <View style={styles.root}>
      <View style={StyleSheet.absoluteFill}>
        <Chem3DView
          ref={chemRef}
          scene={sceneForView}
          onEvent={handleEvent}
        />
      </View>

      {/* 覆盖层：仅边缘区域拦截触摸 */}
      <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
        {/* 顶部导航 */}
        <View style={[styles.topWrap, { paddingTop: insets.top + 6 }]} pointerEvents="box-none">
          <View style={styles.topRow}>
            <Pressable
              style={styles.roundBtn}
              onPress={goBack}
              accessibilityLabel="返回"
            >
              <Ionicons name="chevron-back" size={22} color={colors.ink} />
            </Pressable>
            <View style={styles.topTitles}>
              <Text style={styles.topTitle} numberOfLines={1}>
                {title}
              </Text>
              <Text style={styles.topSub} numberOfLines={1}>
                {subtitle}
              </Text>
            </View>
            {scene.kind === 'molecule' && (!mol || mol.scene !== 'lattice') ? (
              <Pressable
                style={[styles.roundBtn, styles.labelsWrap, labelsOn && styles.roundBtnOn]}
                onPress={toggleLabels}
                accessibilityLabel={labelsOn ? '隐藏元素标注' : '显示元素标注'}
                accessibilityState={{ selected: labelsOn }}
              >
                <Text style={[styles.aaLabel, labelsOn && styles.aaLabelOn]}>Aa</Text>
              </Pressable>
            ) : null}
            <Pressable style={styles.roundBtn} onPress={resetView} accessibilityLabel="重置视角">
              <Ionicons name="refresh" size={19} color={colors.ink} />
            </Pressable>
          </View>
        </View>

        {/* 画布上的视角平移方向盘：上下左右四向浮层，覆盖在 3D 画布之上（分子浏览与反应场景共用） */}
        {(scene.kind === 'molecule' && mol) || (scene.kind === 'reaction' && reaction) ? (
          <CanvasPanPad
            top={insets.top + 64}
            bottom={cardH + 8}
            onPan={(dir) => send({ cmd: 'view', action: 'pan', dir })}
          />
        ) : null}

        {/* 中部轻提示 */}
        {note ? (
          <View style={styles.noteWrap} pointerEvents="none">
            <Text style={styles.noteText}>{note}</Text>
          </View>
        ) : null}

        {/* 底部信息卡 */}
        <View
          style={[styles.bottomWrap, { paddingBottom: Math.max(insets.bottom, 10) }]}
          pointerEvents="box-none"
          onLayout={(e) => setCardH(e.nativeEvent.layout.height)}
        >
          {scene.kind === 'molecule' && mol ? (
            <MoleculePanel
              mol={mol}
              onRadiusLab={onOpenRadiusLab ? () => onOpenRadiusLab(mol.id) : undefined}
              onAtom={(sym) => {
                const idx = mol.atoms?.findIndex((a) => a.el === sym) ?? -1;
                push(
                  {
                    kind: 'atom',
                    id: sym,
                    molId: mol.id,
                    ai: idx >= 0 ? idx : undefined,
                    mol: scene.mol,
                  },
                  mol.id
                );
              }}
            />
          ) : null}

          {scene.kind === 'reaction' && reaction ? (
            <ReactionPanel
              reaction={reaction}
              state={rxn ?? { step: 0, steps: reaction.steps.length, playing: false }}
              onPrev={() => send({ cmd: 'reaction', action: 'prev' })}
              onPlayPause={() =>
                send({ cmd: 'reaction', action: rxn?.playing ? 'pause' : 'play' })
              }
              onNext={() => send({ cmd: 'reaction', action: 'next' })}
              speed={rxnSpeed}
              onSpeed={setRxnSpeed}
            />
          ) : null}

          {scene.kind === 'atom' && element ? (
            <AtomPanel
              element={element}
              charge={atomCharge}
              viewMode={viewMode}
              onViewMode={setAtomViewMode}
              atomCtx={atomCtx}
              bond={bondDemo}
              onBond={(action) => send({ cmd: 'atomBond', action })}
            />
          ) : null}
        </View>

        {/* 进入分子/原子视图的过场动画：点击即触发，白色淡入淡出衔接场景切换 */}
        <Animated.View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, styles.veil, { opacity: veil }]}
        />
      </View>
    </View>
  );
}

/* ---------- 分子信息面板 ---------- */
function MoleculePanel({
  mol,
  onAtom,
  onRadiusLab,
}: {
  mol: MoleculeData;
  onAtom: (s: string) => void;
  onRadiusLab?: () => void;
}) {
  const [folded, setFolded] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const els: string[] = [];
  mol.atoms?.forEach((a) => {
    if (!els.includes(a.el)) els.push(a.el);
  });
  /** 离子晶体：可以一路跳到半径比实验去看它的配位数 */
  const link = LATTICE_LINKS[mol.id];
  // 大 π 键涉及的元素（O₃ 就是 O）
  const piSym = mol.bigpi?.atoms?.length
    ? (mol.atoms?.[mol.bigpi.atoms[0]]?.el ?? '')
    : '';
  const acid = mol.acidity;
  const tone = acid ? acidityTone(acid.label) : null;
  const foldTitle = `${mol.name} ${mol.formulaDisplay ?? mol.formula}`;
  if (folded) {
    return (
      <View style={[styles.card, styles.cardTight]}>
        <FoldToggle title={foldTitle} folded onToggle={() => setFolded(false)} />
      </View>
    );
  }
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>
          {mol.name} <Text style={styles.cardFormula}>{mol.formulaDisplay ?? mol.formula}</Text>
        </Text>
        <View style={styles.pillRow}>
          <View style={styles.pill}>
            <Text style={styles.pillText}>{mol.category}</Text>
          </View>
          <View style={styles.pill}>
            <Text style={styles.pillText}>{mol.level}</Text>
          </View>
        </View>
      </View>

      {acid && tone ? (
        <View style={[styles.acidStrip, { backgroundColor: tone.bg }]}>
          <Text style={[styles.acidStripTag, { color: tone.fg }]}>{acid.label}</Text>
          <Text style={[styles.acidStripText, { color: tone.fg }]} numberOfLines={2}>
            {acid.explain}
          </Text>
        </View>
      ) : null}

      {mol.bigpi ? (
        <View style={styles.piStrip}>
          <Text style={styles.piStripTag}>大 π 键 {mol.bigpi.label || ''}（离域）</Text>
          <Text style={styles.piStripText} numberOfLines={3}>
            {mol.bigpi.atoms.length} 个{piSym}原子各出一个垂直于分子平面的 p 轨道，肩并肩重叠成一体：
            {mol.bigpi.electrons} 个电子为 {mol.bigpi.atoms.length} 个{piSym}共有（紫色云），不专属某一对原子
            → 两条 {piSym}–{piSym} 键的键长、键能完全相同，并不是一单一双。
          </Text>
        </View>
      ) : null}

      {els.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.elScroll}>
          {els.map((s) => {
            const el = elementBySymbol(s);
            return (
              <Pressable
                key={s}
                style={styles.elChip}
                onPress={() => onAtom(s)}
              >
                <View style={[styles.elDot, { backgroundColor: el?.color ?? '#ccc' }]} />
                <Text style={styles.elChipText}>
                  {s} · 查看电子层
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}

      {link && onRadiusLab ? (
        <Pressable style={styles.labEntry} onPress={onRadiusLab} accessibilityRole="button">
          <View style={styles.labEntryIcon}>
            <Ionicons name="resize-outline" size={17} color={colors.accent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.labEntryTitle}>打开「半径比 · 配位数实验」</Text>
            <Text style={styles.labEntryMeta}>
              {link.formula} 的 r₊/r₋ ≈ {link.ratio.toFixed(2)}，动手拖滑块看它的配位数为什么是 6
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.faint} />
        </Pressable>
      ) : null}

      <Pressable onPress={() => setExpanded((v) => !v)}>
        <Text style={styles.desc} numberOfLines={expanded ? undefined : 2}>
          {mol.desc || '暂无简介'}
        </Text>
        <Text style={styles.tip}>
          拖动旋转 · 缩放观察 · 轻点任意原子可下钻到电子层结构
        </Text>
      </Pressable>

      <FoldToggle title={foldTitle} onToggle={() => setFolded(true)} />
    </View>
  );
}

/* ---------- 反应动画速度滑块（5 档：0.1 / 0.3 / 0.5 / 1 / 1.5 倍速） ---------- */
const SPEED_STOPS = [0.1, 0.3, 0.5, 1, 1.5];
const SPEED_THUMB = 18;

function speedText(v: number) {
  return `${v}×`;
}

function SpeedSlider({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [trackW, setTrackW] = useState(0);
  const trackWRef = useRef(0);
  const trackLeftRef = useRef(0);
  const trackRef = useRef<View | null>(null);
  const valueRef = useRef(value);
  valueRef.current = value;
  const idx = Math.max(0, SPEED_STOPS.indexOf(value));
  const ratio = SPEED_STOPS.length > 1 ? idx / (SPEED_STOPS.length - 1) : 0;

  // 记录轨道左边界（页面坐标），拖拽用 pageX 换算比例，避免 locationX 相对子元素失效
  const measureTrack = useCallback(() => {
    trackRef.current?.measureInWindow?.((x: number) => {
      trackLeftRef.current = x;
    });
  }, []);

  const pick = useCallback(
    (pageX: number, locationX: number) => {
      const w = trackWRef.current;
      if (w <= 0) return;
      // 优先用绝对坐标；未测到轨道位置时退回相对坐标
      const x = trackLeftRef.current > 0 ? pageX - trackLeftRef.current : locationX;
      if (!Number.isFinite(x)) return;
      const r = Math.min(1, Math.max(0, x / w));
      const v = SPEED_STOPS[Math.round(r * (SPEED_STOPS.length - 1))];
      if (v !== valueRef.current) onChange(v);
    },
    [onChange]
  );
  const pickRef = useRef(pick);
  pickRef.current = pick;

  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (e) => {
          if (trackLeftRef.current <= 0) measureTrack();
          pickRef.current(e.nativeEvent.pageX, e.nativeEvent.locationX);
        },
        onPanResponderMove: (e) => pickRef.current(e.nativeEvent.pageX, e.nativeEvent.locationX),
      }),
    [measureTrack]
  );

  return (
    <View style={styles.speedBox}>
      <View style={styles.speedHead}>
        <Text style={styles.speedLabel}>动画速度</Text>
        <Text style={styles.speedVal}>{speedText(value)}</Text>
      </View>
      <View
        ref={trackRef}
        style={styles.speedTrack}
        onLayout={(e) => {
          trackWRef.current = e.nativeEvent.layout.width;
          setTrackW(e.nativeEvent.layout.width);
          measureTrack();
        }}
        {...pan.panHandlers}
      >
        <View style={styles.speedRail} pointerEvents="none" />
        <View style={[styles.speedFill, { width: ratio * trackW }]} pointerEvents="none" />
        {SPEED_STOPS.map((s, i) => (
          <View
            key={s}
            pointerEvents="none"
            style={[
              styles.speedTick,
              {
                left: (i / (SPEED_STOPS.length - 1)) * trackW - 3,
                backgroundColor: i <= idx ? colors.accent : '#c9d7ea',
              },
            ]}
          />
        ))}
        <View
          style={[styles.speedThumb, { left: ratio * trackW - SPEED_THUMB / 2 }]}
          pointerEvents="none"
        />
      </View>
      <View style={styles.speedMarks}>
        {SPEED_STOPS.map((s) => (
          <Text key={s} style={[styles.speedMarkText, s === value && styles.speedMarkTextOn]}>
            {speedText(s)}
          </Text>
        ))}
      </View>
    </View>
  );
}

/* ---------- 画布上的视角平移方向盘（上/下/左/右四向，浮在 3D 画布之上） ---------- */
type PanDir = 'left' | 'right' | 'up' | 'down';

const PAN_ICONS: Record<PanDir, 'arrow-back' | 'arrow-forward' | 'arrow-up' | 'arrow-down'> = {
  up: 'arrow-up',
  down: 'arrow-down',
  left: 'arrow-back',
  right: 'arrow-forward',
};

const PAN_LABELS: Record<PanDir, string> = {
  up: '视角上移',
  down: '视角下移',
  left: '视角左移',
  right: '视角右移',
};

/**
 * 平移按钮：弱化淡灰浮层。外层 box-none 只让按钮自身命中，
 * 按钮内以 Responder 抢占触摸，按下与滑动都不会透传给下层画布（不触发拖拽/缩放/点击原子）。
 */
function PanButton({ dir, onPan }: { dir: PanDir; onPan: (d: PanDir) => void }) {
  const [pressed, setPressed] = useState(false);
  return (
    <View
      style={[styles.panBtn, pressed && styles.panBtnPressed]}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderTerminationRequest={() => false}
      onResponderGrant={() => setPressed(true)}
      onResponderRelease={() => {
        setPressed(false);
        onPan(dir);
      }}
      onResponderTerminate={() => setPressed(false)}
      accessibilityRole="button"
      accessibilityLabel={PAN_LABELS[dir]}
    >
      <Ionicons name={PAN_ICONS[dir]} size={17} color={colors.faint} />
    </View>
  );
}

function CanvasPanPad({
  top,
  bottom,
  onPan,
}: {
  top: number;
  bottom: number;
  onPan: (dir: PanDir) => void;
}) {
  return (
    <View style={[styles.panLayer, { top, bottom }]} pointerEvents="box-none">
      <View style={styles.panEdgeTop} pointerEvents="box-none">
        <PanButton dir="up" onPan={onPan} />
      </View>
      <View style={styles.panEdgeBottom} pointerEvents="box-none">
        <PanButton dir="down" onPan={onPan} />
      </View>
      <View style={styles.panEdgeLeft} pointerEvents="box-none">
        <PanButton dir="left" onPan={onPan} />
      </View>
      <View style={styles.panEdgeRight} pointerEvents="box-none">
        <PanButton dir="right" onPan={onPan} />
      </View>
    </View>
  );
}

/* ---------- 反应面板 ---------- */
function ReactionPanel({
  reaction,
  state,
  onPrev,
  onPlayPause,
  onNext,
  speed,
  onSpeed,
}: {
  reaction: ReactionView;
  state: { step: number; steps: number; playing: boolean };
  onPrev: () => void;
  onPlayPause: () => void;
  onNext: () => void;
  speed: number;
  onSpeed: (v: number) => void;
}) {
  const step = reaction.steps.length ? Math.min(state.step, reaction.steps.length - 1) : 0;
  const active = reaction.steps[step];
  const [folded, setFolded] = useState(false);
  if (folded) {
    return (
      <View style={[styles.card, styles.cardTight]}>
        <FoldToggle title={reaction.equation} folded onToggle={() => setFolded(false)} />
      </View>
    );
  }
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle} numberOfLines={1}>
          {reaction.equation}
        </Text>
        <View style={styles.pillRow}>
          <View style={[styles.pill, styles.pillAccent]}>
            <Text style={[styles.pillText, styles.pillTextAccent]}>{reaction.type}</Text>
          </View>
          {reaction.condition ? (
            <View style={styles.pill}>
              <Text style={styles.pillText}>{reaction.condition}</Text>
            </View>
          ) : null}
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.stepRow}>
          {reaction.steps.map((s, i) => {
            const on = i === step;
            return (
              <View key={s.title} style={[styles.stepChip, on && styles.stepChipOn]}>
                <Text style={[styles.stepNo, on && styles.stepNoOn]}>{i + 1}</Text>
                <Text style={[styles.stepName, on && styles.stepNameOn]} numberOfLines={1}>
                  {s.title}
                </Text>
              </View>
            );
          })}
        </View>
      </ScrollView>

      {active ? (
        <Text style={styles.stepDesc}>{active.title}：{active.desc}</Text>
      ) : (
        <Text style={styles.stepDesc}>正在载入反应剧幕…</Text>
      )}

      <View style={styles.ctrlRow}>
        <RoundBtn icon="play-skip-back" label="上一步" onPress={onPrev} />
        <Pressable
          style={styles.playBtn}
          onPress={onPlayPause}
          accessibilityLabel="播放/暂停"
        >
          <Ionicons name={state.playing ? 'pause' : 'play'} size={26} color="#fff" />
        </Pressable>
        <RoundBtn icon="play-skip-forward" label="下一步" onPress={onNext} />
      </View>

      <SpeedSlider value={speed} onChange={onSpeed} />

      <FoldToggle title={reaction.equation} onToggle={() => setFolded(true)} />
    </View>
  );
}

/** 原子视图下钻上下文（引擎 atomInfo 上报）：最外层电子各有归属 */
interface AtomCtxInfo {
  bondE: number;
  valenceE: number;
  molName: string | null;
  /** 用于 σ 键的电子数 */
  sigmaE: number;
  /** 进入离域大 π 键的电子数（0 表示无大 π 键） */
  piE: number;
  /** 未参与成键、以孤对电子形式留在本原子最外层的电子数 */
  loneE: number;
  bigPi: { label: string; centers: number; electrons: number; selfE: number } | null;
}

/* ---------- 原子面板 ---------- */
function AtomPanel({
  element,
  charge,
  viewMode,
  onViewMode,
  atomCtx,
  bond,
  onBond,
}: {
  element: ElementData;
  charge: number;
  viewMode: 'top' | 'solid';
  onViewMode: (m: 'top' | 'solid') => void;
  atomCtx?: AtomCtxInfo | null;
  /** 共价键形成演示的播放状态（无共价邻居时为 null） */
  bond?: { step: number; steps: number; playing: boolean; title: string; text: string } | null;
  onBond?: (action: 'play' | 'pause' | 'restart' | 'next' | 'prev') => void;
}) {
  const [folded, setFolded] = useState(false);
  const shells = shellsForIon(element, charge);
  const shellCfg = electronShellConfigs(shells);
  const cfgText = electronConfigText(shells);
  const electrons = element.p - charge;
  const charged = charge !== 0;
  const ionName = ionChargeText(element.symbol, charge);
  const octetText = octetRuleText(shells);
  const summary = charged
    ? charge > 0
      ? `在此化合物中为 ${ionName}：${element.symbol} 失去 ${charge} 个电子，排布 ${shells.join(',')}`
      : `在此化合物中为 ${ionName}：${element.symbol} 得到 ${Math.abs(charge)} 个电子，排布 ${shells.join(',')}`
    : `电子排布 ${shells.join(',')} · 共 ${electrons} 个电子`;
  const foldTitle = `${ionName} · ${element.name}`;
  if (folded) {
    return (
      <View style={[styles.card, styles.cardTight]}>
        <FoldToggle title={foldTitle} folded onToggle={() => setFolded(false)} />
      </View>
    );
  }
  return (
    <View style={styles.card}>
      <View style={styles.atomHead}>
        <View style={[styles.atomBadge, { borderColor: element.color }]}>
          <Text style={[styles.atomBadgeText, { color: element.color }]}>{ionName}</Text>
        </View>
        <View style={{ flex: 1, marginLeft: 10 }}>
          <View style={styles.pillRow}>
            <View style={styles.pill}>
              <Text style={styles.pillText}>质子 {element.p}</Text>
            </View>
            <View style={styles.pill}>
              <Text style={styles.pillText}>中子 {element.n}</Text>
            </View>
            <View style={[styles.pill, charged && styles.pillAccent]}>
              <Text style={[styles.pillText, charged && styles.pillTextAccent]}>电子 {electrons}</Text>
            </View>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
            <View style={styles.shellRow}>
              {shells.map((n, i) => (
                <View key={i} style={styles.shellChip}>
                  <Text style={styles.shellK}>{SHELL_LABELS[i] || i + 1}层</Text>
                  <Text style={styles.shellN}>{n} e⁻</Text>
                </View>
              ))}
            </View>
          </ScrollView>
        </View>
      </View>

      {/* 构型（能量分层 + 亚层） */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8, flexGrow: 0 }}>
        <View style={styles.shellRow}>
          {shellCfg.map((cfg, i) => (
            <View key={i} style={styles.cfgChip}>
              <Text style={styles.cfgName}>{SHELL_LABELS[i] || i + 1}层</Text>
              <Text style={styles.cfgText}>{cfg || '—'}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
      {/* 八隅体规则提示：成键态已由下方“共用电子对”卡片说明，此处不重复 */}
      {!(atomCtx && atomCtx.bondE > 0) ? (
        <View style={styles.octetWrap}>
          <Text style={styles.octetTag}>八隅体</Text>
          <Text style={styles.octetText} numberOfLines={2}>
            {octetText}
          </Text>
        </View>
      ) : null}
      <Text style={styles.desc} numberOfLines={3}>
        {element.desc.split('。')[0]}。 {summary}。
      </Text>
      {atomCtx && (atomCtx.bondE > 0 || atomCtx.piE > 0) ? (
        <View style={styles.covNoteWrap}>
          <Text style={styles.covNote} numberOfLines={4}>
            {atomCtx.molName ? `在 ${atomCtx.molName} 中 · ` : ''}
            最外层 {atomCtx.valenceE} 个电子各有归属：
            {atomCtx.loneE > 0 ? `${Math.round(atomCtx.loneE / 2)} 对孤对电子（${atomCtx.loneE} 个，不共用）` : ''}
            {atomCtx.sigmaE > 0
              ? `${atomCtx.loneE > 0 ? ' + ' : ''}${atomCtx.sigmaE} 个与相邻原子配成共用电子对（σ 键）`
              : ''}
            {atomCtx.piE > 0
              ? ` + ${atomCtx.piE} 个进入大 π 键 ${atomCtx.bigPi?.label || ''}（${atomCtx.bigPi?.centers ?? 0} 个原子共用 ${atomCtx.bigPi?.electrons ?? 0} 个电子，不专属某一对原子）`
              : ''}
          </Text>
          {atomCtx.bigPi ? (
            <Text style={styles.covNoteSub} numberOfLines={2}>
              大 π 键的电子为 {atomCtx.bigPi.centers} 个原子共有（离域），所以 {atomCtx.molName || '该分子'} 中两个
              O–O 键的键长、键能完全相同，并不是一单一双。
            </Text>
          ) : (
            <Text style={styles.covNoteSub} numberOfLines={2}>
              与相邻原子各出一个电子配成共用电子对，双方共用后最外层都达到 8 电子（H 为 2）稳定结构。
            </Text>
          )}
          {bond ? <Text style={styles.covNoteSub}>形成过程见上方动画演示 · 可重播 / 分步</Text> : null}
        </View>
      ) : null}
      {bond ? (
        <View style={styles.bondBox}>
          <View style={styles.bondHead}>
            <Text style={styles.bondTitle}>共价键形成演示</Text>
            <Text style={styles.bondStep}>
              {bond.step + 1} / {bond.steps}
            </Text>
          </View>
          <Text style={styles.bondStage}>{bond.title}</Text>
          <Text style={styles.bondText}>{bond.text}</Text>
          <View style={styles.bondBtnRow}>
            <BondBtn icon="play-skip-back" label="上一步" onPress={() => onBond?.('prev')} />
            <BondBtn
              icon={bond.playing ? 'pause' : 'play'}
              label={bond.playing ? '暂停' : '播放'}
              primary
              onPress={() => onBond?.(bond.playing ? 'pause' : 'play')}
            />
            <BondBtn icon="play-skip-forward" label="下一步" onPress={() => onBond?.('next')} />
            <BondBtn icon="refresh" label="重播" onPress={() => onBond?.('restart')} />
          </View>
        </View>
      ) : null}
      <View style={styles.segRow}>
        <Text style={styles.segLabel}>视角</Text>
        {(['top', 'solid'] as const).map((m) => {
          const on = viewMode === m;
          return (
            <Pressable
              key={m}
              style={[styles.segBtn, on && styles.segBtnOn]}
              onPress={() => onViewMode(m)}
            >
              <Text style={[styles.segText, on && styles.segTextOn]}>
                {m === 'top' ? '俯视' : '立体'}
              </Text>
            </Pressable>
          );
        })}
        <Text style={styles.segHint}>立体分辨分层 · 俯视逐层数电子</Text>
      </View>
      <Text style={styles.tip}>
        红=质子 · 灰=中子 · 彩色线框+云=各能层（静态轨迹云） · 橙=共用电子对
        {atomCtx?.bigPi ? ' · 紫=大 π 键（多原子共有）' : ''}
        {atomCtx?.molName ? ' · 轻点外圈原子核球切换查看' : ''}
      </Text>

      <FoldToggle title={foldTitle} onToggle={() => setFolded(true)} />
    </View>
  );
}

/* 底部介绍卡片“收起 / 展开”切换条：展开态贴底一行收起；收起态变成仅标题+展开按钮的窄条 */
function FoldToggle({
  title,
  folded,
  onToggle,
}: {
  title: string;
  folded?: boolean;
  onToggle: () => void;
}) {
  if (folded) {
    return (
      <Pressable
        style={styles.foldBar}
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityLabel="展开介绍"
      >
        <Text style={styles.foldBarTitle} numberOfLines={1}>
          {title}
        </Text>
        <View style={styles.foldBarBtn}>
          <Ionicons name="chevron-down" size={14} color={colors.accent} />
          <Text style={styles.foldBarBtnText}>展开</Text>
        </View>
      </Pressable>
    );
  }
  return (
    <Pressable
      style={styles.foldUp}
      onPress={onToggle}
      accessibilityRole="button"
      accessibilityLabel="收起介绍"
    >
      <Ionicons name="chevron-up" size={13} color={colors.faint} />
      <Text style={styles.foldUpText}>收起介绍</Text>
    </Pressable>
  );
}

/** 共价键形成演示的控制按钮（播放 / 暂停 / 分步 / 重播） */
function BondBtn({
  icon,
  label,
  onPress,
  primary,
}: {
  icon: 'play' | 'pause' | 'play-skip-back' | 'play-skip-forward' | 'refresh';
  label: string;
  onPress: () => void;
  primary?: boolean;
}) {
  return (
    <Pressable
      style={[styles.bondBtn, primary && styles.bondBtnOn]}
      onPress={onPress}
      accessibilityRole="button"
    >
      <Ionicons name={icon} size={13} color={primary ? '#FFFFFF' : '#c2410c'} />
      <Text style={[styles.bondBtnText, primary && styles.bondBtnTextOn]}>{label}</Text>
    </Pressable>
  );
}

function RoundBtn({
  icon,
  label,
  onPress,
}: {
  icon: 'play-skip-back' | 'play-skip-forward';
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.roundBtnBig} onPress={onPress}>
      <Ionicons name={icon} size={18} color={colors.accent} />
      <Text style={styles.roundBtnLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  veil: {
    backgroundColor: '#eef3fc',
  },
  topWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  topTitles: {
    flex: 1,
    marginHorizontal: 8,
    alignItems: 'center',
  },
  topTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.ink,
  },
  topSub: {
    fontSize: 12,
    color: colors.sub,
    marginTop: 2,
  },
  roundBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(22,50,79,0.12)',
  },
  roundBtnOn: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accent,
  },
  labelsWrap: {
    marginLeft: 8,
  },
  aaLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.sub,
    letterSpacing: 0.5,
  },
  aaLabelOn: {
    color: colors.accent,
  },
  noteWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  noteText: {
    fontSize: 12,
    color: '#fff',
    backgroundColor: 'rgba(30,45,72,0.75)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    overflow: 'hidden',
  },
  bottomWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  card: {
    alignSelf: 'stretch',
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderRadius: radii.card,
    padding: 14,
    ...shadow.card,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  cardTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: colors.ink,
    marginRight: 8,
  },
  cardFormula: {
    color: colors.sub,
    fontWeight: '600',
    fontSize: 14,
  },
  pillRow: {
    flexDirection: 'row',
  },
  pill: {
    backgroundColor: colors.accentSoft,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    marginLeft: 6,
  },
  pillAccent: {
    backgroundColor: colors.accent,
  },
  pillText: {
    fontSize: 11,
    color: colors.accent,
  },
  pillTextAccent: {
    color: '#fff',
  },
  elScroll: {
    marginTop: 10,
    flexGrow: 0,
  },
  elChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f2f6fd',
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#e2ebf8',
  },
  elDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 5,
  },
  elChipText: {
    fontSize: 12,
    color: colors.ink,
    fontWeight: '600',
  },
  labEntry: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    marginTop: 10,
    backgroundColor: colors.accentSoft,
    borderRadius: 13,
    padding: 10,
  },
  labEntryIcon: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  labEntryTitle: { fontSize: 13, fontWeight: '800', color: colors.ink },
  labEntryMeta: { fontSize: 11, color: colors.sub, marginTop: 2, lineHeight: 16 },
  desc: {
    fontSize: 13,
    lineHeight: 20,
    color: colors.sub,
    marginTop: 8,
  },
  tip: {
    fontSize: 11,
    color: colors.faint,
    marginTop: 6,
  },
  stepRow: {
    flexDirection: 'row',
    marginTop: 10,
  },
  stepChip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginRight: 8,
    backgroundColor: '#f0f5fc',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  stepChipOn: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accent,
  },
  stepNo: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#d5e1f3',
    color: '#5a7297',
    fontSize: 10,
    textAlign: 'center',
    lineHeight: 16,
    marginRight: 5,
    overflow: 'hidden',
  },
  stepNoOn: {
    backgroundColor: colors.accent,
    color: '#fff',
  },
  stepName: {
    fontSize: 12,
    color: '#8fa2bd',
    fontWeight: '600',
  },
  stepNameOn: {
    color: colors.accent,
  },
  stepDesc: {
    fontSize: 12,
    color: colors.sub,
    marginTop: 8,
    lineHeight: 18,
  },
  ctrlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  playBtn: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 18,
    ...shadow.card,
  },
  roundBtnBig: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: colors.accentSoft,
  },
  roundBtnLabel: {
    fontSize: 12,
    color: colors.accent,
    fontWeight: '600',
    marginLeft: 4,
  },
  panLayer: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
  panEdgeTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  panEdgeBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  panEdgeLeft: {
    position: 'absolute',
    left: 8,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  panEdgeRight: {
    position: 'absolute',
    right: 8,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  panBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.45)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(22,50,79,0.08)',
  },
  panBtnPressed: {
    backgroundColor: 'rgba(255,255,255,0.9)',
  },
  speedBox: {
    marginTop: 10,
  },
  speedHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  speedLabel: {
    fontSize: 12,
    color: colors.sub,
    fontWeight: '600',
  },
  speedVal: {
    fontSize: 12,
    color: colors.accent,
    fontWeight: '800',
  },
  speedTrack: {
    height: 26,
    justifyContent: 'center',
    marginTop: 2,
  },
  speedRail: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 11,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#e2ebf8',
  },
  speedFill: {
    position: 'absolute',
    left: 0,
    top: 11,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.accent,
  },
  speedTick: {
    position: 'absolute',
    top: 10,
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  speedThumb: {
    position: 'absolute',
    top: 4,
    width: SPEED_THUMB,
    height: SPEED_THUMB,
    borderRadius: SPEED_THUMB / 2,
    backgroundColor: '#fff',
    borderWidth: 3,
    borderColor: colors.accent,
    ...shadow.card,
  },
  speedMarks: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  speedMarkText: {
    fontSize: 10,
    color: colors.faint,
  },
  speedMarkTextOn: {
    color: colors.accent,
    fontWeight: '800',
  },
  cardTight: {
    paddingVertical: 8,
  },
  foldBar: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  foldBarTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: colors.ink,
    marginRight: 10,
  },
  foldBarBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accentSoft,
    borderRadius: 13,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  foldBarBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.accent,
    marginLeft: 3,
  },
  foldUp: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    paddingTop: 9,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(22,50,79,0.1)',
  },
  foldUpText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.faint,
    marginLeft: 3,
  },
  atomHead: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  atomBadge: {
    width: 62,
    height: 62,
    borderRadius: 31,
    borderWidth: 2,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  atomBadgeText: {
    fontSize: 21,
    fontWeight: '800',
  },
  segRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
  },
  segLabel: {
    fontSize: 11,
    color: colors.faint,
    marginRight: 6,
  },
  segBtn: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 13,
    backgroundColor: '#eef2f9',
    marginRight: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  segBtnOn: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  segText: {
    fontSize: 12,
    color: colors.sub,
    fontWeight: '600',
  },
  segTextOn: {
    color: '#fff',
  },
  segHint: {
    fontSize: 11,
    color: colors.faint,
  },
  shellRow: {
    flexDirection: 'row',
  },
  shellChip: {
    marginRight: 8,
    alignItems: 'center',
    backgroundColor: '#f4f7fd',
    borderRadius: 10,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  shellK: {
    fontSize: 11,
    color: colors.sub,
  },
  shellN: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.ink,
  },
  acidStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginTop: 10,
  },
  acidStripTag: {
    fontSize: 12,
    fontWeight: '800',
    marginRight: 8,
  },
  acidStripText: {
    flex: 1,
    fontSize: 11.5,
    lineHeight: 16,
    fontWeight: '600',
  },
  cfgChip: {
    marginRight: 8,
    backgroundColor: '#eef5ff',
    borderRadius: 10,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  cfgName: {
    fontSize: 10,
    color: colors.faint,
    fontWeight: '600',
  },
  cfgText: {
    fontSize: 12,
    color: colors.ink,
    fontWeight: '700',
    marginTop: 1,
  },
  covNoteWrap: {
    backgroundColor: '#fdf3e0',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginTop: 6,
  },
  covNote: {
    fontSize: 11.5,
    lineHeight: 16,
    color: '#a06a15',
    fontWeight: '600',
  },
  covNoteSub: {
    marginTop: 3,
    fontSize: 11,
    lineHeight: 15,
    color: '#8a5a10',
    fontWeight: '500',
  },
  piStrip: {
    marginTop: 10,
    borderRadius: 10,
    backgroundColor: '#f3edff',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  piStripTag: {
    fontSize: 12,
    fontWeight: '800',
    color: '#6d28d9',
    marginBottom: 2,
  },
  piStripText: {
    fontSize: 11.5,
    lineHeight: 16,
    color: '#5b4b8a',
    fontWeight: '600',
  },
  bondBox: {
    marginTop: 9,
    borderRadius: 12,
    backgroundColor: '#fff4ec',
    borderWidth: 1,
    borderColor: '#ffd9bd',
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  bondHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  bondTitle: { fontSize: 12.5, fontWeight: '800', color: '#c2410c' },
  bondStep: { fontSize: 11, fontWeight: '700', color: '#a06a15' },
  bondStage: { fontSize: 13, fontWeight: '800', color: colors.ink, marginTop: 5 },
  bondText: { fontSize: 11.5, lineHeight: 17, color: colors.inkSoft, marginTop: 3 },
  bondBtnRow: { flexDirection: 'row', gap: 6, marginTop: 9 },
  bondBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#ffd9bd',
  },
  bondBtnOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  bondBtnText: { fontSize: 10.5, fontWeight: '700', color: '#c2410c' },
  bondBtnTextOn: { color: '#FFFFFF' },
  octetWrap: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#eaf0ff',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginTop: 8,
  },
  octetTag: {
    fontSize: 10,
    fontWeight: '800',
    color: '#3a62c4',
    backgroundColor: '#d3e1fb',
    borderRadius: 6,
    overflow: 'hidden',
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginTop: 1,
  },
  octetText: {
    flex: 1,
    fontSize: 11.5,
    lineHeight: 16,
    color: '#41598f',
    marginLeft: 7,
  },
});
