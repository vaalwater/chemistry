import { useCallback, useMemo, useRef, useState } from 'react';
import {
  PanResponder,
  StyleSheet,
  Text,
  View,
  type GestureResponderEvent,
  type NativeTouchEvent,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii, shadow } from '../theme';
import {
  describeAtom,
  EMPTY_ATOM,
  MAX_E,
  MAX_N,
  MAX_P,
  relationHint,
  subText,
  supText,
  type AtomState,
} from '../isotope/isotope';

export type ParticleKind = 'p' | 'n' | 'e';

const PARTICLES: {
  id: ParticleKind;
  label: string;
  glyph: string;
  color: string;
  desc: string;
}[] = [
  { id: 'p', label: '质子', glyph: '+', color: '#ff6b5b', desc: '带 1 个单位正电荷，它决定元素种类' },
  { id: 'n', label: '中子', glyph: '0', color: '#78889f', desc: '不带电，和质子数一起决定质量数' },
  { id: 'e', label: '电子', glyph: '−', color: '#2fa7e8', desc: '带 1 个单位负电荷，排布决定化学性质' },
];

const PARTICLE_MAP: Record<ParticleKind, { label: string; color: string; glyph: string }> = {
  p: { label: '质子', color: '#ff6b5b', glyph: '+' },
  n: { label: '中子', color: '#78889f', glyph: '0' },
  e: { label: '电子', color: '#2fa7e8', glyph: '−' },
};

interface Ball {
  x: number;
  y: number;
  kind: ParticleKind;
  key: string;
}

/**
 * 原子构造器：把质子 / 中子 / 电子拖进原子模型里，实时生成核素符号（ᴬ_Z X）。
 *
 * 手势做法与 StructureBuilder 一致：pin 每个粒子格子各自用 PanResponder 接管拖拽，
 * 坐标用 pageX/pageY + measureInWindow 换算（iOS 的 locationX 是相对最内层视图的，
 * 不能直接当容器坐标用），保证移动端 / 模拟器上都能拖动。
 */
export default function AtomBuilder({
  canvasHeight = 300,
  onDragStateChange,
}: {
  canvasHeight?: number;
  onDragStateChange?: (dragging: boolean) => void;
}) {
  const [atom, setAtom] = useState<AtomState>(EMPTY_ATOM);
  const atomRef = useRef<AtomState>(EMPTY_ATOM);
  atomRef.current = atom;
  /** 上一次的组成：用来判断“改了质子 / 只改了中子 / 只改了电子” */
  const prevAtom = useRef<AtomState>(EMPTY_ATOM);
  const history = useRef<AtomState[]>([]);
  const [msg, setMsg] = useState<{ text: string; warn?: boolean }>({ text: '' });
  const [drag, setDrag] = useState<{ x: number; y: number; kind: ParticleKind } | null>(null);
  const gesture = useRef<{ kind: ParticleKind; x0: number; y0: number; moved: boolean } | null>(null);
  const [size, setSize] = useState({ w: 320, h: canvasHeight });

  const rootRef = useRef<View | null>(null);
  const canvasRef = useRef<View | null>(null);
  const geom = useRef<{ rx: number; ry: number; cx: number; cy: number; cw: number; ch: number } | null>(null);
  const queue = useRef<(() => void)[] | null>(null);
  const measuring = useRef(false);

  const note = useCallback((text: string, warn = false) => setMsg({ text, warn }), []);

  /* ---------- 坐标换算（窗口坐标 ↔ 容器坐标） ---------- */
  const pagePoint = (e: GestureResponderEvent | { nativeEvent: NativeTouchEvent }) => {
    const ev = e.nativeEvent as NativeTouchEvent;
    const x = Number.isFinite(Number(ev.pageX)) ? Number(ev.pageX) : Number(ev.locationX) || 0;
    const y = Number.isFinite(Number(ev.pageY)) ? Number(ev.pageY) : Number(ev.locationY) || 0;
    return { x, y };
  };
  const rootPoint = (x: number, y: number) => {
    const g = geom.current;
    return g ? { x: x - g.rx, y: y - g.ry } : { x, y };
  };
  const canvasPoint = (x: number, y: number) => {
    const g = geom.current;
    return g ? { x: x - g.cx, y: y - g.cy } : { x: 0, y: 0 };
  };
  const onCanvas = (x: number, y: number) => {
    const g = geom.current;
    if (!g || g.cw <= 0) return false;
    return x >= g.cx && x <= g.cx + g.cw && y >= g.cy && y <= g.cy + g.ch;
  };

  const flushQueue = useCallback(() => {
    const q = queue.current;
    queue.current = null;
    if (!q) return;
    for (const fn of q) fn();
  }, []);

  /** 拿到绝对坐标后再执行；首次测量（约 1 帧）期间的事件排队补做 */
  const runWithGeom = useCallback(
    (fn: () => void) => {
      if (geom.current) {
        fn();
        return;
      }
      if (!queue.current) queue.current = [];
      queue.current.push(fn);
      if (measuring.current) return;
      const root = rootRef.current;
      const canvas = canvasRef.current;
      if (!root || !canvas) {
        flushQueue();
        return;
      }
      measuring.current = true;
      root.measureInWindow((rx, ry) => {
        canvas.measureInWindow((cx, cy, cw, ch) => {
          geom.current = { rx, ry, cx, cy, cw, ch };
          if (cw > 0 && ch > 0) setSize((prev) => (prev.w === cw && prev.h === ch ? prev : { w: cw, h: ch }));
          measuring.current = false;
          flushQueue();
        });
      });
    },
    [flushQueue]
  );

  /* ---------- 组成变化 ---------- */
  const commit = useCallback((next: AtomState) => {
    if (next.p === atomRef.current.p && next.n === atomRef.current.n && next.e === atomRef.current.e) return;
    history.current.push(atomRef.current);
    prevAtom.current = atomRef.current;
    atomRef.current = next;
    setAtom(next);
  }, []);

  const add = useCallback(
    (kind: ParticleKind, misplaced?: boolean) => {
      const cur = atomRef.current;
      let next: AtomState | null = null;
      let tip = '';
      if (kind === 'p') {
        if (cur.p >= MAX_P) {
          note(`课堂上先只用到前 ${MAX_P} 号元素（H ~ Ca）`, true);
          return;
        }
        next = { ...cur, p: cur.p + 1 };
        tip = misplaced ? '质子只能待在原子核里（已帮你放进去）' : `放进 1 个质子 → ${cur.p + 1} 号元素`;
        if (cur.p === 0) tip = '有了第 1 个质子，它就是氢元素了';
      } else if (kind === 'n') {
        if (cur.n >= MAX_N) {
          note('中子先别放太多啦', true);
          return;
        }
        next = { ...cur, n: cur.n + 1 };
        tip = misplaced ? '中子也在原子核里（已帮你放进去）' : '放进 1 个中子：质量数 +1，元素种类不变';
        if (cur.p === 0) tip = '中子要陪着质子才构成原子核哦';
      } else {
        if (cur.e >= MAX_E) {
          note('核外电子最多先摆到这里', true);
          return;
        }
        next = { ...cur, e: cur.e + 1 };
        tip = misplaced ? '电子在核外的电子层上（已放到对应壳层）' : '放进 1 个电子：带电情况发生变化';
        if (cur.p === 0) tip = '先放质子吧，没有原子核就没有电子层';
      }
      if (!next) return;
      commit(next);
      note(tip);
    },
    [commit, note]
  );

  const remove = useCallback(
    (kind: ParticleKind) => {
      const cur = atomRef.current;
      let next: AtomState | null = null;
      if (kind === 'p' && cur.p > 0) next = { ...cur, p: cur.p - 1 };
      else if (kind === 'n' && cur.n > 0) next = { ...cur, n: cur.n - 1 };
      else if (kind === 'e' && cur.e > 0) next = { ...cur, e: cur.e - 1 };
      if (!next) return;
      commit(next);
      note(`拿掉 1 个${PARTICLE_MAP[kind].label}`);
    },
    [commit, note]
  );

  const undo = useCallback(() => {
    const prev = history.current.pop();
    if (!prev) {
      note('没有可撤销的一步了', true);
      return;
    }
    const cur = atomRef.current;
    prevAtom.current = cur;
    atomRef.current = prev;
    setAtom(prev);
    note('');
  }, [note]);

  const clearAll = useCallback(() => {
    if (!atomRef.current.p && !atomRef.current.n && !atomRef.current.e) return;
    history.current.push(atomRef.current);
    prevAtom.current = atomRef.current;
    atomRef.current = EMPTY_ATOM;
    setAtom(EMPTY_ATOM);
    note('已清空，从质子重新开始吧');
  }, [note]);

  /* ---------- 粒子排布（金角螺旋放核子，电子按壳层均分） ---------- */
  const layout = useMemo(() => {
    const cx = size.w / 2;
    const cy = size.h / 2;
    const nucleusR = Math.max(32, Math.min(50, Math.min(size.w, size.h) * 0.16));
    const nucleons: Ball[] = [];
    const total = atom.p + atom.n;
    const golden = 2.39996323;
    for (let i = 0; i < total; i++) {
      const rr = nucleusR * 0.78 * Math.sqrt((i + 0.45) / Math.max(1, total + 0.4));
      const a = i * golden;
      nucleons.push({
        x: cx + rr * Math.cos(a),
        y: cy + rr * Math.sin(a),
        kind: i < atom.p ? 'p' : 'n',
        key: `nu-${i}`,
      });
    }
    const shells = describeAtom(atom).shells;
    const maxR = Math.min(size.w, size.h) / 2 - 12;
    const rings = shells.length;
    const gap = rings > 0 ? (maxR - nucleusR - 14) / Math.max(1, rings) : 0;
    const ringRadii = shells.map((_, k) => nucleusR + 16 + gap * (k + 0.6));
    const electrons: Ball[] = [];
    let idx = 0;
    shells.forEach((cnt, k) => {
      const r = ringRadii[k];
      for (let i = 0; i < cnt; i++) {
        const a = (i / cnt) * Math.PI * 2 + k * 0.7;
        electrons.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a), kind: 'e', key: `e-${idx}` });
        idx++;
      }
    });
    return { cx, cy, nucleusR, nucleons, ringRadii, electrons };
  }, [atom, size]);

  /* ---------- 拖拽：粒子格子各自接管 ---------- */
  const chipGrant = (kind: ParticleKind, x: number, y: number) => {
    geom.current = null; // 页面可能滚动过，本次手势重新量一次
    runWithGeom(() => {
      onDragStateChange?.(true);
      gesture.current = { kind, x0: x, y0: y, moved: false };
      const r = rootPoint(x, y);
      setDrag({ x: r.x, y: r.y, kind });
    });
  };

  const chipMove = (x: number, y: number) => {
    const gs = gesture.current;
    if (!gs) return;
    if (Math.hypot(x - gs.x0, y - gs.y0) > 4) gs.moved = true;
    runWithGeom(() => {
      const r = rootPoint(x, y);
      setDrag({ x: r.x, y: r.y, kind: gs.kind });
    });
  };

  const chipRelease = (x: number, y: number) => {
    const gs = gesture.current;
    if (!gs) return;
    runWithGeom(() => {
      gesture.current = null;
      setDrag(null);
      onDragStateChange?.(false);
      const kind = gs.kind;
      if (!gs.moved) {
        // 只点了一下格子 → 当作“放入一个”
        add(kind);
        return;
      }
      if (!onCanvas(x, y)) {
        note('要在这个圆圈范围里松手，粒子才能进去', true);
        return;
      }
      const p = canvasPoint(x, y);
      const dist = Math.hypot(p.x - layout.cx, p.y - layout.cy);
      const insideNucleus = dist <= layout.nucleusR + 6;
      const misplaced = kind === 'e' ? insideNucleus : !insideNucleus;
      add(kind, misplaced);
    });
  };

  const chipCancel = () => {
    if (!gesture.current) return;
    gesture.current = null;
    setDrag(null);
    onDragStateChange?.(false);
  };

  const live = useRef({ chipGrant, chipMove, chipRelease, chipCancel });
  live.current = { chipGrant, chipMove, chipRelease, chipCancel };

  const chipPans = useMemo(
    () =>
      PARTICLES.map((t) =>
        PanResponder.create({
          onStartShouldSetPanResponder: () => true,
          onMoveShouldSetPanResponder: () => true,
          onPanResponderTerminationRequest: () => false,
          onPanResponderGrant: (e) => {
            const p = pagePoint(e);
            live.current.chipGrant(t.id, p.x, p.y);
          },
          onPanResponderMove: (e) => {
            const p = pagePoint(e);
            live.current.chipMove(p.x, p.y);
          },
          onPanResponderRelease: (e) => {
            const p = pagePoint(e);
            live.current.chipRelease(p.x, p.y);
          },
          onPanResponderTerminate: () => live.current.chipCancel(),
        })
      ),
    []
  );

  const info = describeAtom(atom);
  const rel = relationHint(prevAtom.current, atom);
  const hint = rel?.text || msg.text;
  const hintWarn = rel ? rel.warn : msg.warn;

  return (
    <View ref={rootRef} style={styles.wrap} collapsable={false}>
      {/* ① 核素符号：左上角质量数 A、左下角质子数 Z，跟着拖入的粒子实时变 */}
      <View style={styles.readout}>
        <View style={styles.nuclideBox}>
          {info.hasAtom ? (
            <View style={styles.nuclideRow}>
              <View style={styles.nuclideIndex}>
                <Text style={styles.massSup}>{supText(info.mass)}</Text>
                <Text style={styles.protonSub}>{subText(info.z)}</Text>
              </View>
              <Text style={styles.symbol}>{info.symbol}</Text>
            </View>
          ) : (
            <Text style={styles.symbolEmpty}>？</Text>
          )}
        </View>
        <View style={styles.readoutInfo}>
          <Text style={styles.elName}>
            {info.hasAtom ? `${info.name} ${info.symbol}` : '还没有质子'}
          </Text>
          <Text style={styles.elMeta}>
            质子 {atom.p} · 中子 {atom.n} · 电子 {atom.e}　质量数 A = {info.mass}
          </Text>
          <View style={styles.badgeRow}>
            {info.hasAtom && !info.isCommon ? (
              <Text style={[styles.badge, styles.badgeIso]}>{info.symbol} 的同位素</Text>
            ) : null}
            {info.hasAtom && info.isCommon ? (
              <Text style={[styles.badge, styles.badgeCommon]}>最常见的核素</Text>
            ) : null}
            {info.meta?.radioactive ? (
              <Text style={[styles.badge, styles.badgeRadio]}>有放射性</Text>
            ) : null}
            {info.hasAtom && info.charge !== 0 ? (
              <Text style={[styles.badge, styles.badgeIon]}>{info.ionText} · {info.stateLabel}</Text>
            ) : null}
          </View>
          {info.meta?.name ? (
            <Text style={styles.isoName}>
              读作「{info.meta.name}」{info.meta.note ? ` · ${info.meta.note}` : ''}
            </Text>
          ) : null}
        </View>
      </View>

      {/* ② 原子模型画布 */}
      <View
        ref={canvasRef}
        style={[styles.canvas, { height: canvasHeight }]}
        collapsable={false}
        onLayout={(e) => {
          const { width, height: h } = e.nativeEvent.layout;
          setSize((prev) => (prev.w === width && prev.h === h ? prev : { w: width, h }));
          geom.current = null;
        }}
      >
        <View style={styles.fieldLabel} pointerEvents="none">
          <Text style={styles.fieldLabelText}>原子核</Text>
        </View>
        <View
          style={{
            position: 'absolute',
            left: layout.cx - layout.nucleusR,
            top: layout.cy - layout.nucleusR,
            width: layout.nucleusR * 2,
            height: layout.nucleusR * 2,
            borderRadius: layout.nucleusR,
            backgroundColor: '#FEF3EF',
            borderWidth: 1,
            borderColor: '#F7DCD2',
          }}
          pointerEvents="none"
        />
        {layout.ringRadii.map((r, k) => (
          <View
            key={`ring-${k}`}
            style={{
              position: 'absolute',
              left: layout.cx - r,
              top: layout.cy - r,
              width: r * 2,
              height: r * 2,
              borderRadius: r,
              borderWidth: 1,
              borderColor: '#D9E5F5',
            }}
            pointerEvents="none"
          />
        ))}
        {layout.nucleons.map((b) => (
          <BallView key={b.key} ball={b} size={24} onPress={() => remove(b.kind)} />
        ))}
        {layout.electrons.map((b) => (
          <BallView key={b.key} ball={b} size={16} onPress={() => remove(b.kind)} />
        ))}
      </View>

      {drag ? (
        <View
          pointerEvents="none"
          style={[
            styles.ghost,
            {
              left: drag.x - 17,
              top: drag.y - 17,
              backgroundColor: PARTICLE_MAP[drag.kind].color,
            },
          ]}
        >
          <Text style={styles.ghostText}>{PARTICLE_MAP[drag.kind].glyph}</Text>
        </View>
      ) : null}

      {/* ③ 粒子格子：按住往上拖，也可以直接点一下放进去 */}
      <View style={styles.palette}>
        {PARTICLES.map((t, i) => {
          const count = t.id === 'p' ? atom.p : t.id === 'n' ? atom.n : atom.e;
          return (
            <View
              key={t.id}
              style={styles.chip}
              collapsable={false}
              {...chipPans[i].panHandlers}
            >
              <View style={[styles.chipDot, { backgroundColor: t.color }]}>
                <Text style={styles.chipGlyph}>{t.glyph}</Text>
              </View>
              <View style={styles.chipBody}>
                <Text style={styles.chipLabel}>
                  {t.label}
                  <Text style={styles.chipCount}> ×{count}</Text>
                </Text>
                <Text style={styles.chipDesc}>{t.desc}</Text>
              </View>
            </View>
          );
        })}
      </View>

      <View style={styles.toolRow}>
        <PressableChip label="撤销" onPress={undo} />
        <View style={{ flex: 1 }} />
        <PressableChip label="清空" danger onPress={clearAll} />
      </View>

      {hint ? (
        <View style={[styles.hintRow, hintWarn && styles.hintRowWarn]}>
          <Ionicons
            name={hintWarn ? 'information-circle-outline' : 'checkmark-circle-outline'}
            size={14}
            color={hintWarn ? colors.orange : colors.green}
          />
          <Text style={[styles.hintText, hintWarn && styles.hintTextWarn]}>{hint}</Text>
        </View>
      ) : null}
    </View>
  );
}

function BallView({
  ball,
  size,
  onPress,
}: {
  ball: Ball;
  size: number;
  onPress: () => void;
}) {
  const meta = PARTICLE_MAP[ball.kind];
  return (
    <View
      style={{
        position: 'absolute',
        left: ball.x - size / 2,
        top: ball.y - size / 2,
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: meta.color,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.75)',
      }}
      accessibilityRole="button"
      accessibilityLabel={`${meta.label}，点一下拿走`}
      onStartShouldSetResponder={() => true}
      onResponderRelease={onPress}
    >
      <Text style={{ color: '#FFFFFF', fontSize: size * 0.6, fontWeight: '800' }}>{meta.glyph}</Text>
    </View>
  );
}

function PressableChip({
  label,
  danger,
  onPress,
}: {
  label: string;
  danger?: boolean;
  onPress: () => void;
}) {
  const [pressed, setPressed] = useState(false);
  return (
    <View
      style={[styles.toolBtn, danger && styles.toolBtnDanger, pressed && styles.toolBtnPressed]}
      accessibilityRole="button"
      onStartShouldSetResponder={() => true}
      onResponderTerminationRequest={() => false}
      onResponderGrant={() => setPressed(true)}
      onResponderRelease={() => {
        setPressed(false);
        onPress();
      }}
      onResponderTerminate={() => setPressed(false)}
    >
      <Text style={[styles.toolBtnText, danger && styles.toolBtnTextDanger]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  readout: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: colors.card,
    borderRadius: radii.card,
    padding: 14,
    ...shadow.card,
  },
  nuclideBox: {
    minWidth: 108,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  nuclideRow: { flexDirection: 'row', alignItems: 'center' },
  nuclideIndex: { alignItems: 'flex-end', marginRight: 3 },
  massSup: { fontSize: 15, fontWeight: '800', color: colors.ink, lineHeight: 17 },
  protonSub: { fontSize: 15, fontWeight: '800', color: colors.purple, lineHeight: 17 },
  symbol: { fontSize: 34, fontWeight: '800', color: colors.ink },
  symbolEmpty: { fontSize: 30, fontWeight: '800', color: colors.faint },
  readoutInfo: { flex: 1 },
  elName: { fontSize: 16, fontWeight: '800', color: colors.ink },
  elMeta: { fontSize: 12, color: colors.sub, marginTop: 3 },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  badge: {
    fontSize: 11,
    fontWeight: '700',
    borderRadius: radii.chip,
    paddingHorizontal: 8,
    paddingVertical: 3,
    overflow: 'hidden',
  },
  badgeIso: { backgroundColor: '#E9F6F0', color: colors.green },
  badgeCommon: { backgroundColor: colors.accentSoft, color: colors.accent },
  badgeRadio: { backgroundColor: '#FDECEA', color: colors.red },
  badgeIon: { backgroundColor: '#FFF3E4', color: colors.orange },
  isoName: { fontSize: 11.5, color: colors.inkSoft, marginTop: 6, lineHeight: 17 },

  canvas: {
    backgroundColor: '#F7FAFF',
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.line,
    overflow: 'hidden',
  },
  fieldLabel: { position: 'absolute', left: 10, top: 8 },
  fieldLabelText: { fontSize: 11, color: colors.faint, fontWeight: '700' },
  ghost: {
    position: 'absolute',
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.9,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  ghostText: { color: '#FFFFFF', fontSize: 17, fontWeight: '800' },

  palette: { gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 10,
  },
  chipDot: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipGlyph: { color: '#FFFFFF', fontSize: 17, fontWeight: '800' },
  chipBody: { flex: 1 },
  chipLabel: { fontSize: 13.5, fontWeight: '700', color: colors.ink },
  chipCount: { color: colors.accent },
  chipDesc: { fontSize: 11.5, color: colors.sub, marginTop: 2 },

  toolRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  toolBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: colors.accentSoft,
    borderWidth: 1,
    borderColor: '#CFE0FB',
  },
  toolBtnDanger: { backgroundColor: '#FDECEA', borderColor: '#F6CFCB' },
  toolBtnPressed: { opacity: 0.7 },
  toolBtnText: { fontSize: 12.5, fontWeight: '700', color: colors.accent },
  toolBtnTextDanger: { color: colors.red },

  hintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#EFF8F3',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  hintRowWarn: { backgroundColor: '#FFF6EA' },
  hintText: { flex: 1, fontSize: 12, color: colors.green, lineHeight: 17, fontWeight: '600' },
  hintTextWarn: { color: colors.orange },
});
