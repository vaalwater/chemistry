import { useCallback, useMemo, useRef, useState, type ReactElement } from 'react';
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
  Graph,
  addAtom,
  addBond,
  bondSumOf,
  cloneGraph,
  findBond,
  hOf,
  removeAtom,
  removeBond,
  valenceOf,
} from '../iso/molgraph';

export interface MolNode {
  x: number;
  y: number;
}

export interface BuilderState {
  graph: Graph;
  pos: MolNode[];
}

export function emptyBuilderState(): BuilderState {
  return { graph: { atoms: [], bonds: [] }, pos: [] };
}

/** 在画布上放一个苯环（六元碳环，单双键交替） */
export function withBenzene(v: BuilderState, cx: number, cy: number, r = 46): BuilderState {
  const g = cloneGraph(v.graph);
  const pos = v.pos.map((p) => ({ ...p }));
  const ids: number[] = [];
  for (let k = 0; k < 6; k++) {
    const ang = -Math.PI / 2 + (k * Math.PI) / 3;
    ids.push(addAtom(g, 'C'));
    pos.push({ x: cx + r * Math.cos(ang), y: cy + r * Math.sin(ang) });
  }
  for (let k = 0; k < 6; k++) addBond(g, ids[k], ids[(k + 1) % 6], k % 2 === 0 ? 1 : 2);
  return { graph: g, pos };
}

type PlaceToolId = 'C' | 'ring' | 'O' | 'OH' | 'CHO' | 'COOH' | 'Cl';
type EditToolId = 'move' | 'bond' | 'double' | 'erase';
type ToolId = EditToolId | PlaceToolId;

/** 可以从下方调色板拖上来的原子 / 基团 */
const PALETTE: { id: PlaceToolId; label: string; glyph: string; hint: string }[] = [
  { id: 'C', label: '碳', glyph: 'C', hint: '碳原子：拖到画板空白处单独放，拖到已有原子上就连成一根键' },
  { id: 'O', label: '氧', glyph: 'O', hint: '氧原子：只连一个碳且成双键是羰基，连两个碳是醚 —O—' },
  { id: 'ring', label: '苯环', glyph: '⬡', hint: '拖一个苯环上来打底，再把取代基拖到环上的碳原子' },
  { id: 'OH', label: '羟基', glyph: 'OH', hint: '羟基：挂在链上碳是醇，挂在苯环碳上是酚' },
  { id: 'CHO', label: '醛基', glyph: 'CHO', hint: '醛基 —CHO：碳氧双键 + 一个氢，只能挂在链端碳上' },
  { id: 'COOH', label: '羧基', glyph: 'COOH', hint: '羧基 —COOH：羰基 + 羟基' },
  { id: 'Cl', label: '氯', glyph: 'Cl', hint: '氯原子 —Cl：卤代烃' },
];

/** 作用在画板上的三种模式（竖向排在画板右侧） */
const MODES: { id: EditToolId; label: string; hint: string }[] = [
  { id: 'move', label: '移动', hint: '拖动原子调整位置，只挪位置，不会连键' },
  {
    id: 'bond',
    label: '连线',
    hint: '按住一个原子拖到另一个原子上松手，连一根单键（可以成环）；双击某条键可在单键 / 双键之间切换',
  },
  { id: 'erase', label: '擦除', hint: '点原子删原子，点化学键删键' },
];

const CHIP_COLOR: Record<PlaceToolId, string> = {
  C: '#43597a',
  O: colors.red,
  Cl: colors.green,
  ring: colors.cyan,
  OH: colors.orange,
  CHO: colors.purple,
  COOH: colors.purple,
};

const PLACE_IDS: string[] = PALETTE.map((t) => t.id);

const ATOM_COLOR: Record<string, string> = {
  C: '#43597a',
  O: colors.red,
  N: colors.accent,
  Cl: colors.green,
  Br: colors.green,
  F: colors.green,
  I: colors.purple,
  S: colors.orange,
};

/** 画板四边的方向箭头：整体挪动画面（用法和分子浏览里的平移箭头一致） */
type PanDir = 'up' | 'down' | 'left' | 'right';

const PAN_STEP = 18; // 每按一次箭头，画面挪动的距离
const PAN_ICONS: Record<PanDir, 'arrow-up' | 'arrow-down' | 'arrow-back' | 'arrow-forward'> = {
  up: 'arrow-up',
  down: 'arrow-down',
  left: 'arrow-back',
  right: 'arrow-forward',
};
const PAN_LABELS: Record<PanDir, string> = {
  up: '画面上移',
  down: '画面下移',
  left: '画面左移',
  right: '画面右移',
};

const NODE_R = 20;
const SNAP = 30; // 落点吸附到原子的距离
const LOOP_SNAP = 34; // 移动时成键的吸附距离
const DOUBLE_TAP_MS = 450; // 连线模式下双击某条键切换单键 / 双键的间隔上限

/** 隐式氢个数的下标写法（H₂ / H₃ …） */
const H_SUB = ['', '', '₂', '₃', '₄'];

function atomColor(el: string): string {
  return ATOM_COLOR[el] || '#43597a';
}

function glyphOf(id: ToolId): string {
  const p = PALETTE.find((t) => t.id === id);
  return p ? p.glyph : String(id);
}


/** 在 around 周围找一个不重叠的位置 */
function freeSpot(pos: MolNode[], around: MolNode, extra: MolNode[] = [], dist = 54): MolNode {
  const all = pos.concat(extra);
  const clear = (p: MolNode) => all.every((q) => Math.hypot(q.x - p.x, q.y - p.y) > 46);
  for (let step = 0; step < 24; step++) {
    const ang = (step / 24) * Math.PI * 2 + (step % 2) * 0.26;
    const d = dist + Math.floor(step / 8) * 16;
    const p = { x: around.x + d * Math.cos(ang), y: around.y + d * Math.sin(ang) };
    if (clear(p)) return p;
  }
  return { x: around.x + dist, y: around.y - dist };
}

function distToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  let t = ((px - x1) * dx + (py - y1) * dy) / (len * len);
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

/**
 * 拖拽说明：整个组件（画板 + 下方的调色板）只有**根节点**接管手势。
 * 这样手指从下方格子一路拖到画板的过程中不会触发 responder 转交，
 * 中途不会出现“被别的节点抢走手势”而导致松手事件丢失的情况。
 */
export default function StructureBuilder({
  value,
  onChange,
  height = 250,
  tip,
  onDragStateChange,
}: {
  value: BuilderState;
  onChange: (v: BuilderState) => void;
  height?: number;
  tip?: string;
  /** 拖拽进行中：外层可以把 ScrollView 的滚动关掉，避免手势被滚动抢走 */
  onDragStateChange?: (active: boolean) => void;
}) {
  const [tool, setTool] = useState<ToolId>('move');
  /** warn=true 表示“这一步没成功 / 要注意”，用醒目的橙红提示条显示 */
  const [msg, setMsg] = useState<{ text: string; warn: boolean }>({ text: '', warn: false });
  const [drag, setDrag] = useState<{ x: number; y: number; id: ToolId } | null>(null);
  /** 「连线」时跟随手指的橡皮筋（画板内坐标） */
  const [rubber, setRubber] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);
  const dragNode = useRef<number | null>(null);
  const bondFrom = useRef<number | null>(null);
  /** 连线模式下“双击某条键”的第一次点击 */
  const lastTap = useRef<{ a: number; b: number; t: number } | null>(null);
  /** 连续按方向箭头时只存一次撤销记录 */
  const panSeq = useRef(false);
  /** 本次手势开始时的状态，用于撤销 */
  const snapshot = useRef<BuilderState | null>(null);
  const gesture = useRef<{
    id: PlaceToolId;
    x0: number;
    y0: number;
    moved: boolean;
    source: 'chip' | 'canvas';
  } | null>(null);
  const history = useRef<BuilderState[]>([]);
  const [size, setSize] = useState({ w: 320, h: height });

  const rootRef = useRef<View | null>(null);
  const canvasRef = useRef<View | null>(null);
  /**
   * 窗口绝对坐标（measureInWindow 得到）：根节点原点 + 画板矩形。
   * 原生端不能用 locationX/locationY —— iOS 上它是相对「被点中的最内层视图」的坐标
   * （见 RCTTouchHandler.m），和这里的画板 / 根节点坐标系不一致，会让手指位置算错，
   * 结果就是调色板按住拖不动（判定落在 CHIP 之外，手势压根不接管）。
   * 统一改用 pageX/pageY + measureInWindow 换算。
   */
  const geom = useRef<{ rx: number; ry: number; cx: number; cy: number; cw: number; ch: number } | null>(
    null
  );
  /** 首次测量是异步的（约 1 帧），这期间到达的手势事件排队，测量完成后按原顺序补做 */
  const queue = useRef<(() => void)[] | null>(null);
  const measuring = useRef(false);

  const note = useCallback((s: string, warn = false) => setMsg({ text: s, warn }), []);

  const pushHistory = useCallback((v: BuilderState) => {
    history.current.push({ graph: cloneGraph(v.graph), pos: v.pos.map((p) => ({ ...p })) });
    if (history.current.length > 30) history.current.shift();
  }, []);

  const apply = useCallback(
    (next: BuilderState, save = true) => {
      if (save) pushHistory(value);
      panSeq.current = false; // 真正的编辑发生了，结束“连续挪动画面”
      onChange(next);
    },
    [onChange, pushHistory, value]
  );

  /** 整体挪动画面：所有原子一起平移（画板是个窗口，内容可以移出去再移回来） */
  const panCanvas = useCallback(
    (dir: PanDir) => {
      if (!value.pos.length) return;
      const dx = dir === 'left' ? PAN_STEP : dir === 'right' ? -PAN_STEP : 0;
      const dy = dir === 'up' ? PAN_STEP : dir === 'down' ? -PAN_STEP : 0;
      const pos = value.pos.map((p) => ({ x: p.x + dx, y: p.y + dy }));
      // 保险：别把结构整个推出画板，否则就找不回来了
      const visible = pos.some(
        (p) => p.x > -24 && p.x < size.w + 24 && p.y > -24 && p.y < size.h + 24
      );
      if (!visible) {
        note('再往这边挪，结构就全跑到画板外面了', true);
        return;
      }
      if (!panSeq.current) {
        pushHistory(value);
        panSeq.current = true;
      }
      lastTap.current = null;
      onChange({ graph: value.graph, pos });
    },
    [note, onChange, pushHistory, size.h, size.w, value]
  );

  /* ---------- 坐标换算：窗口坐标 ↔ 根节点 / 画板本地坐标 ---------- */
  const pagePoint = (e: GestureResponderEvent | { nativeEvent: NativeTouchEvent }) => {
    const ev = e.nativeEvent as NativeTouchEvent;
    const x = Number.isFinite(Number(ev.pageX)) ? Number(ev.pageX) : Number(ev.locationX) || 0;
    const y = Number.isFinite(Number(ev.pageY)) ? Number(ev.pageY) : Number(ev.locationY) || 0;
    return { x, y };
  };

  /** 窗口坐标 → 根节点坐标（拖拽幽灵贴在图时用） */
  const rootPoint = (x: number, y: number) => {
    const g = geom.current;
    return g ? { x: x - g.rx, y: y - g.ry } : { x, y };
  };

  /** 窗口坐标 → 画板内坐标 */
  const canvasPoint = (x: number, y: number) => {
    const g = geom.current;
    return g ? { x: x - g.cx, y: y - g.cy } : { x: 0, y: 0 };
  };

  /** 这个窗口坐标落在白色画板里吗 */
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

  /** 拿到绝对坐标后再执行；首次测量期间的事件排队补做 */
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

  const nodeAt = (x: number, y: number, r = NODE_R + 8): number | null => {
    let best: number | null = null;
    let bd = r;
    value.pos.forEach((p, i) => {
      const d = Math.hypot(p.x - x, p.y - y);
      if (d < bd) {
        bd = d;
        best = i;
      }
    });
    return best;
  };

  /** 找落点附近最近的原子（可指定吸附半径、排除某个原子） */
  const nodeNear = (
    x: number,
    y: number,
    max: number,
    except?: number | null
  ): number | null => {
    let best: number | null = null;
    let bd = max;
    value.pos.forEach((p, i) => {
      if (except != null && i === except) return;
      const d = Math.hypot(p.x - x, p.y - y);
      if (d < bd) {
        bd = d;
        best = i;
      }
    });
    return best;
  };

  const bondAt = (x: number, y: number): { a: number; b: number } | null => {
    for (const b of value.graph.bonds) {
      const p = value.pos[b.a];
      const q = value.pos[b.b];
      if (!p || !q) continue;
      if (distToSegment(x, y, p.x, p.y, q.x, q.y) < 10) return { a: b.a, b: b.b };
    }
    return null;
  };

  const canBond = (g: Graph, i: number, order: number): boolean =>
    bondSumOf(g, i) + order <= valenceOf(g.atoms[i].el);

  /** 放置一个原子 / 基团（画板内坐标） */
  const place = (id: ToolId, x: number, y: number) => {
    const hit = nodeAt(x, y);
    const g = cloneGraph(value.graph);
    const pos = value.pos.map((p) => ({ ...p }));

    if (id === 'ring') {
      const center =
        hit !== null
          ? { x: pos[hit].x + 96, y: pos[hit].y }
          : { x: Math.max(70, Math.min(size.w - 70, x)), y: Math.max(70, Math.min(size.h - 70, y)) };
      apply(withBenzene({ graph: g, pos }, center.x, center.y));
      note('苯环放好了，再从下面拖取代基到环上的碳原子');
      return;
    }

    if (id === 'OH' || id === 'CHO' || id === 'COOH' || id === 'Cl') {
      if (hit === null) {
        note('官能团要挂在已有的原子上：把它拖到某个碳原子上再松手', true);
        return;
      }
      if (!canBond(g, hit, 1)) {
        note(`${g.atoms[hit].el} 上已经连满了，不能再挂`, true);
        return;
      }
      const host = pos[hit];
      const spot = freeSpot(pos, host);
      if (id === 'OH' || id === 'Cl') {
        const aid = addAtom(g, id === 'OH' ? 'O' : 'Cl');
        pos.push(spot);
        addBond(g, hit, aid, 1);
      } else {
        const cid = addAtom(g, 'C');
        pos.push(spot);
        addBond(g, hit, cid, 1);
        const o1 = addAtom(g, 'O');
        const s2 = freeSpot(pos, spot, [host]);
        pos.push(s2);
        addBond(g, cid, o1, 2);
        if (id === 'COOH') {
          const o2 = addAtom(g, 'O');
          const s3 = freeSpot(pos, spot, [host, s2]);
          pos.push(s3);
          addBond(g, cid, o2, 1);
        }
      }
      apply({ graph: g, pos });
      note('');
      return;
    }

    // 单原子：C / O
    const el = id === 'O' ? 'O' : 'C';
    const aid = addAtom(g, el);
    if (hit !== null && canBond(g, hit, 1)) {
      pos.push(freeSpot(pos, pos[hit]));
      addBond(g, hit, aid, 1);
      apply({ graph: g, pos });
      note(
        `已把 ${el} 连到 ${g.atoms[hit].el} 上（单键）；要 ${g.atoms[hit].el}=${el} 就在「连线」模式下双击这条键`
      );
      return;
    } else {
      pos.push({
        x: Math.max(24, Math.min(size.w - 24, x)),
        y: Math.max(24, Math.min(size.h - 24, y)),
      });
      if (hit !== null)
        note(`${g.atoms[hit].el} 上连满了，先把新原子放在旁边，再拖过去成键`, true);
    }
    apply({ graph: g, pos });
    if (!msg.text) note('');
  };

  const eraseAt = (x: number, y: number) => {
    const hit = nodeAt(x, y);
    const g = cloneGraph(value.graph);
    let pos = value.pos.map((p) => ({ ...p }));
    if (hit !== null) {
      removeAtom(g, hit);
      pos = pos.filter((_, i) => i !== hit);
      apply({ graph: g, pos });
      note('');
      return;
    }
    const b = bondAt(x, y);
    if (b) {
      removeBond(g, b.a, b.b);
      apply({ graph: g, pos });
      note('');
    }
  };

  const toggleDouble = (x: number, y: number) => {
    const b = bondAt(x, y);
    if (!b) {
      note('点中一条化学键才能切换单键 / 双键', true);
      return;
    }
    const g = cloneGraph(value.graph);
    const bd = findBond(g, b.a, b.b);
    if (!bd) return;
    const next = bd.order === 2 ? 1 : 2;
    if (next === 2 && (!canBond(g, b.a, 1) || !canBond(g, b.b, 1))) {
      note('两端原子都还有空价才能改成双键', true);
      return;
    }
    bd.order = next;
    apply({ graph: g, pos: value.pos.map((p) => ({ ...p })) });
    note(next === 2 ? '这条键改成双键了（再双击一次可改回单键）' : '这条键改回单键了');
  };

  /** 「连线」模式：在两个原子之间连一根单键（可成环） */
  const connectBond = (from: number, to: number) => {
    const g = cloneGraph(value.graph);
    if (findBond(g, from, to)) {
      note('这两个原子已经连上了', true);
      return;
    }
    if (!canBond(g, from, 1) || !canBond(g, to, 1)) {
      note('这两个原子都已经连满了，不能再连', true);
      return;
    }
    addBond(g, from, to, 1);
    apply({ graph: g, pos: value.pos.map((p) => ({ ...p })) });
    note('已连一根单键；双击这条键就能改成双键');
  };

  /** 用本次手势开始时的状态补一条撤销记录 */
  const commitWithSnapshot = (next: BuilderState) => {
    if (snapshot.current) {
      history.current.push(snapshot.current);
      if (history.current.length > 30) history.current.shift();
    }
    snapshot.current = null;
    onChange(next);
  };

  const clampToCanvas = (p: MolNode): MolNode => ({
    x: Math.max(16, Math.min(size.w - 16, p.x)),
    y: Math.max(16, Math.min(size.h - 16, p.y)),
  });

  /* ---------- 手势：调色板格子自己接管拖拽，画板自己接管编辑 ---------- */
  /* 说明：以前整个组件只有根节点接管手势，靠“逐层累加 onLayout 偏移”算出每个格子的位置；
     原生端这套相对坐标对不上（见上方 geom 注释），改成格子各自响应后不再需要算格子矩形。 */

  /** 从下方调色板格子开始拖（窗口坐标） */
  const chipGrant = (id: PlaceToolId, x: number, y: number) => {
    geom.current = null; // 页面可能滚动过，本次手势重新量一次绝对坐标
    runWithGeom(() => {
      onDragStateChange?.(true);
      gesture.current = { id, x0: x, y0: y, moved: false, source: 'chip' };
      setTool(id);
      const r = rootPoint(x, y);
      setDrag({ x: r.x, y: r.y, id });
      note('拖到上面的白色画板里松手');
    });
  };

  const chipMove = (x: number, y: number) => {
    const gs = gesture.current;
    if (!gs || gs.source !== 'chip') return;
    if (Math.hypot(x - gs.x0, y - gs.y0) > 4) gs.moved = true;
    runWithGeom(() => {
      const r = rootPoint(x, y);
      setDrag({ x: r.x, y: r.y, id: gs.id });
    });
  };

  const chipRelease = (x: number, y: number) => {
    const gs = gesture.current;
    if (!gs || gs.source !== 'chip') return;
    runWithGeom(() => {
      gesture.current = null;
      setDrag(null);
      onDragStateChange?.(false);
      if (!onCanvas(x, y)) {
        note(gs.moved ? '松手的位置要在白色画板里，把原子/基团拖上去再放手' : '', gs.moved);
        return;
      }
      const p = canvasPoint(x, y);
      place(gs.id, p.x, p.y);
    });
  };

  const chipCancel = () => {
    if (!gesture.current || gesture.current.source !== 'chip') return;
    gesture.current = null;
    setDrag(null);
    onDragStateChange?.(false);
  };

  /** 按（拖）在白色画板上 */
  const canvasGrant = (x: number, y: number) => {
    geom.current = null; // 同上：本次手势重新量一次
    runWithGeom(() => {
      onDragStateChange?.(true);
      gesture.current = {
        id: tool as PlaceToolId,
        x0: x,
        y0: y,
        moved: false,
        source: 'canvas',
      };
      snapshot.current = { graph: cloneGraph(value.graph), pos: value.pos.map((p) => ({ ...p })) };
      const p = canvasPoint(x, y);
      const hit = nodeAt(p.x, p.y);

      // 点（按）在已有原子上：自动切到「移动」，直接拖这个原子，不会误加新原子 / 误删
      if (hit !== null && (PLACE_IDS.indexOf(tool) >= 0 || tool === 'double')) {
        setTool('move');
        dragNode.current = hit;
        note('点到原子了，已切到「移动」模式：拖动它换位置；要连键请切「连线」模式', true);
        return;
      }

      if (tool === 'move') {
        dragNode.current = hit;
      } else if (tool === 'bond') {
        bondFrom.current = hit;
        if (hit === null) note('「连线」模式：按住一个原子，再拖到另一个原子上松手');
      } else if (PLACE_IDS.indexOf(tool) >= 0) {
        const r = rootPoint(x, y);
        setDrag({ x: r.x, y: r.y, id: tool });
      }
    });
  };

  const canvasMove = (x: number, y: number) => {
    const gs = gesture.current;
    if (!gs || gs.source !== 'canvas') return;
    if (Math.hypot(x - gs.x0, y - gs.y0) > 4) gs.moved = true;
    runWithGeom(() => {
      if (!onCanvas(x, y)) return;
      const p = canvasPoint(x, y);
      if (tool === 'bond' && bondFrom.current !== null && gs.moved) {
        const a = value.pos[bondFrom.current];
        setRubber({ x1: a.x, y1: a.y, x2: p.x, y2: p.y });
        return;
      }
      if (tool === 'move' && dragNode.current !== null) {
        const i = dragNode.current;
        const pos = value.pos.map((q) => ({ ...q }));
        pos[i] = clampToCanvas(p);
        onChange({ graph: value.graph, pos });
        return;
      }
      if (PLACE_IDS.indexOf(tool) >= 0) {
        const r = rootPoint(x, y);
        setDrag({ x: r.x, y: r.y, id: tool });
      }
    });
  };

  const canvasRelease = (x: number, y: number) => {
    const gs = gesture.current;
    if (!gs || gs.source !== 'canvas') return;
    gesture.current = null;
    setDrag(null);
    onDragStateChange?.(false);
    runWithGeom(() => {
      if (!onCanvas(x, y)) {
        dragNode.current = null;
        bondFrom.current = null;
        setRubber(null);
        snapshot.current = null;
        return;
      }
      const p = canvasPoint(x, y);

      if (tool === 'bond') {
        const from = bondFrom.current;
        bondFrom.current = null;
        setRubber(null);
        snapshot.current = null;
        // 点在键上（没拖动）：双击这条键 = 单键 / 双键来回切换
        // 注意：键很短的时候中点也可能落在原子的判定圈里，所以这里用更小的原子半径，
        // 只要不是明确点在原子上，就当成“点键”
        if (gs && !gs.moved) {
          const bd = nodeAt(p.x, p.y, NODE_R + 2) === null ? bondAt(p.x, p.y) : null;
          if (bd) {
            const now = Date.now();
            const last = lastTap.current;
            if (last && last.a === bd.a && last.b === bd.b && now - last.t <= DOUBLE_TAP_MS) {
              lastTap.current = null;
              toggleDouble(p.x, p.y);
              return;
            }
            lastTap.current = { a: bd.a, b: bd.b, t: now };
            note('再点一下这条键，就能在单键和双键之间切换');
            return;
          }
        }
        const to = nodeNear(p.x, p.y, LOOP_SNAP, from);
        if (from === null) note('「连线」模式：按住一个原子，再拖到另一个原子上松手');
        else if (to === null || to === from) note('要拖到另一个原子上松手才能连线', true);
        else connectBond(from, to);
        return;
      }

      if (tool === 'move') {
        const i = dragNode.current;
        dragNode.current = null;
        if (i === null || !gs || !gs.moved) {
          snapshot.current = null;
          return;
        }
        const pos = value.pos.map((q) => ({ ...q }));
        pos[i] = clampToCanvas(p);
        commitWithSnapshot({ graph: value.graph, pos });
        return;
      }

      snapshot.current = null;
      if (tool === 'erase') eraseAt(p.x, p.y);
      else if (tool === 'double') toggleDouble(p.x, p.y);
      else if (PLACE_IDS.indexOf(tool) >= 0) place(tool, p.x, p.y);
    });
  };

  const canvasCancel = () => {
    if (!gesture.current || gesture.current.source !== 'canvas') return;
    gesture.current = null;
    dragNode.current = null;
    bondFrom.current = null;
    snapshot.current = null;
    setRubber(null);
    setDrag(null);
    onDragStateChange?.(false);
  };

  /** PanResponder 的回调在创建时就固化了，统一走 ref 转发，避免闭包过期 */
  const live = useRef({
    chipGrant,
    chipMove,
    chipRelease,
    chipCancel,
    canvasGrant,
    canvasMove,
    canvasRelease,
    canvasCancel,
  });
  live.current = {
    chipGrant,
    chipMove,
    chipRelease,
    chipCancel,
    canvasGrant,
    canvasMove,
    canvasRelease,
    canvasCancel,
  };

  const chipPans = useMemo(
    () =>
      PALETTE.map((t) =>
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

  const canvasPan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (e) => {
          const p = pagePoint(e);
          live.current.canvasGrant(p.x, p.y);
        },
        onPanResponderMove: (e) => {
          const p = pagePoint(e);
          live.current.canvasMove(p.x, p.y);
        },
        onPanResponderRelease: (e) => {
          const p = pagePoint(e);
          live.current.canvasRelease(p.x, p.y);
        },
        onPanResponderTerminate: () => live.current.canvasCancel(),
      }),
    []
  );

  const undo = () => {
    const prev = history.current.pop();
    panSeq.current = false;
    if (prev) {
      onChange(prev);
      note('');
    } else note('没有可撤销的操作', true);
  };

  const clearAll = () => {
    apply(emptyBuilderState());
    note('已清空，从下面重新拖吧');
  };

  const tidy = () => {
    const n = value.graph.atoms.length;
    if (!n) return;
    const cx = size.w / 2;
    const cy = size.h / 2;
    const r = Math.min(78, Math.max(52, 16 * n));
    const pos = value.graph.atoms.map((_, i) => {
      const ang = (i / Math.max(1, n)) * Math.PI * 2;
      return { x: cx + r * Math.cos(ang), y: cy + r * Math.sin(ang) };
    });
    apply({ graph: value.graph, pos });
    note('已重新排布');
  };

  const bonds = useMemo(() => value.graph.bonds, [value.graph.bonds]);

  // 单键 = 一条线；双键 = 两条平行线（留出明显缝隙）
  const bondViews: ReactElement[] = [];
  bonds.forEach((b, k) => {
    const p = value.pos[b.a];
    const q = value.pos[b.b];
    if (!p || !q) return;
    const dx = q.x - p.x;
    const dy = q.y - p.y;
    const len = Math.hypot(dx, dy);
    const ang = Math.atan2(dy, dx);
    const nx = -dy / (len || 1);
    const ny = dx / (len || 1);
    const dbl = b.order >= 2;
    const thick = dbl ? 2.4 : 4;
    const lines = dbl ? [3.8, -3.8] : [0];
    lines.forEach((o, li) => {
      const cx = (p.x + q.x) / 2 + nx * o;
      const cy = (p.y + q.y) / 2 + ny * o;
      bondViews.push(
        <View
          key={`${k}-${li}`}
          style={{
            position: 'absolute',
            left: cx - len / 2,
            top: cy - thick / 2,
            width: len,
            height: thick,
            borderRadius: thick / 2,
            backgroundColor: dbl ? '#8fa4bd' : '#b8c6da',
            transform: [{ rotate: `${ang}rad` }],
          }}
        />
      );
    });
  });

  /** 隐式氢的摆放位置：朝远离已有化学键的一侧，且不压到别的原子 / 别的 H */
  const hSpot = (i: number, placed: MolNode[]): MolNode | null => {
    const p = value.pos[i];
    if (!p) return null;
    let sx = 0;
    let sy = 0;
    for (const b of value.graph.bonds) {
      const j = b.a === i ? b.b : b.b === i ? b.a : -1;
      if (j < 0) continue;
      const q = value.pos[j];
      if (!q) continue;
      const d = Math.hypot(q.x - p.x, q.y - p.y) || 1;
      sx -= (q.x - p.x) / d;
      sy -= (q.y - p.y) / d;
    }
    const base = Math.hypot(sx, sy) < 0.001 ? -Math.PI / 2 : Math.atan2(sy, sx);
    for (const delta of [0, 0.62, -0.62, 1.24, -1.24, 1.86, -1.86, 2.5, -2.5, Math.PI]) {
      const ang = base + delta;
      const x = Math.max(13, Math.min(size.w - 13, p.x + 32 * Math.cos(ang)));
      const y = Math.max(11, Math.min(size.h - 11, p.y + 32 * Math.sin(ang)));
      const clashAtom = value.pos.some((q, k) => k !== i && Math.hypot(q.x - x, q.y - y) < 26);
      const clashH = placed.some((q) => Math.hypot(q.x - x, q.y - y) < 24);
      if (!clashAtom && !clashH) return { x, y };
    }
    return null;
  };

  // 自动补的氢：按价键规则算出来，用小标签挂在原子旁边
  const hViews: ReactElement[] = [];
  const placedH: MolNode[] = [];
  value.graph.atoms.forEach((_, i) => {
    const h = hOf(value.graph, i);
    if (h <= 0) return;
    const s = hSpot(i, placedH);
    if (!s) return;
    placedH.push(s);
    hViews.push(
      <View
        key={`h-${i}`}
        pointerEvents="none"
        style={[styles.hBadge, { left: s.x - 13, top: s.y - 9 }]}
      >
        <Text style={styles.hText}>H{H_SUB[h] || (h > 1 ? String(h) : '')}</Text>
      </View>
    );
  });

  const empty = value.graph.atoms.length === 0;
  const draggingChip = drag && PLACE_IDS.indexOf(drag.id) >= 0 ? (drag.id as PlaceToolId) : null;
  const hintText =
    msg.text ||
    MODES.find((m) => m.id === tool)?.hint ||
    PALETTE.find((t) => t.id === tool)?.hint ||
    '';
  const hintWarn = !!msg.text && msg.warn;

  return (
    <View ref={rootRef} style={styles.wrap} collapsable={false}>
      <View style={styles.stage}>
        <View
          ref={canvasRef}
          style={[styles.canvas, { height }]}
          collapsable={false}
          onLayout={(e) => {
            const { width, height: h } = e.nativeEvent.layout;
            setSize((prev) => (prev.w === width && prev.h === h ? prev : { w: width, h }));
            geom.current = null; // 布局变了，下次手势重新量绝对坐标
          }}
          {...canvasPan.panHandlers}
        >
          {empty && !drag ? (
            <Text style={styles.placeholder}>画板是空的，从下面拖一个原子或官能团上来。</Text>
          ) : null}

          {bondViews}

          {rubber ? (
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                left:
                  (rubber.x1 + rubber.x2) / 2 -
                  Math.hypot(rubber.x2 - rubber.x1, rubber.y2 - rubber.y1) / 2,
                top: (rubber.y1 + rubber.y2) / 2 - 1.5,
                width: Math.hypot(rubber.x2 - rubber.x1, rubber.y2 - rubber.y1),
                height: 3,
                borderRadius: 2,
                backgroundColor: colors.accent,
                transform: [
                  { rotate: `${Math.atan2(rubber.y2 - rubber.y1, rubber.x2 - rubber.x1)}rad` },
                ],
              }}
            />
          ) : null}

          {hViews}

          {value.graph.atoms.map((a, i) => {
            const p = value.pos[i];
            if (!p) return null;
            return (
              <View
                key={i}
                style={[
                  styles.node,
                  {
                    left: p.x - NODE_R,
                    top: p.y - NODE_R,
                    backgroundColor: atomColor(a.el),
                  },
                ]}
              >
                <Text style={styles.nodeText}>{a.el}</Text>
              </View>
            );
          })}

          {/* 画板四边的方向箭头：整体挪动画面 */}
          {empty ? null : (
            <View style={styles.panLayer} pointerEvents="box-none">
              <View style={styles.panEdgeTop} pointerEvents="box-none">
                <PanButton dir="up" onPan={panCanvas} />
              </View>
              <View style={styles.panEdgeBottom} pointerEvents="box-none">
                <PanButton dir="down" onPan={panCanvas} />
              </View>
              <View style={styles.panEdgeLeft} pointerEvents="box-none">
                <PanButton dir="left" onPan={panCanvas} />
              </View>
              <View style={styles.panEdgeRight} pointerEvents="box-none">
                <PanButton dir="right" onPan={panCanvas} />
              </View>
            </View>
          )}
        </View>
      </View>

      {/* 工具条：移到画板下方横向排列，画板宽度不再被右侧竖排按钮占掉 */}
      <View style={styles.toolBar}>
        {MODES.map((m) => (
          <ToolButton
            key={m.id}
            label={m.label}
            active={tool === m.id}
            onPress={() => {
              setTool(m.id);
              note(m.hint);
            }}
          />
        ))}
        <View style={styles.toolDivider} />
        <ToolButton label="撤销" accent onPress={undo} />
        <View style={styles.toolSpacer} />
        <ToolButton label="重排" onPress={tidy} />
        <ToolButton label="清空" danger onPress={clearAll} />
      </View>

      {drag ? (
        <View
          pointerEvents="none"
          style={[
            styles.ghost,
            {
              left: drag.x - NODE_R,
              top: drag.y - NODE_R,
              backgroundColor: draggingChip ? `${CHIP_COLOR[draggingChip]}CC` : 'rgba(47,111,237,0.6)',
            },
          ]}
        >
          <Text style={styles.ghostText}>{glyphOf(drag.id)}</Text>
        </View>
      ) : null}

      {tip ? <Text style={styles.tip}>{tip}</Text> : null}
      <View style={[styles.hintBar, hintWarn && styles.hintBarWarn]}>
        <Text style={[styles.hint, hintWarn && styles.hintWarn]}>{hintText}</Text>
      </View>
      {empty ? null : (
        <Text style={styles.legend}>
          小标签 H / H₂ / H₃ 是系统按价键规则自动补上的氢（不用自己摆）；单键是一条线，双键是两条平行线，在「连线」模式下双击某条键就能切换。画板四边的小箭头可以整体挪动画面。
        </Text>
      )}

      <View style={styles.paletteBar}>
        <Text style={styles.paletteTitle}>按住下面的格子，往上拖到画板里</Text>
        <View style={styles.palette}>
          {PALETTE.map((t, ci) => {
            const on = tool === t.id;
            return (
              <View
                key={t.id}
                style={[styles.chip, on && styles.chipOn]}
                collapsable={false}
                // 每个格子自己接管手势：不再依赖“算格子的位置”，原生端也能稳定触发拖拽
                {...chipPans[ci].panHandlers}
              >
                <View style={[styles.chipDot, { backgroundColor: CHIP_COLOR[t.id] }]}>
                  <Text style={styles.chipGlyph}>{t.glyph}</Text>
                </View>
                <Text style={[styles.chipLabel, on && styles.chipLabelOn]}>{t.label}</Text>
              </View>
            );
          })}
        </View>
      </View>
    </View>
  );
}

/**
 * 工具条上的按钮：自己用 Responder 抢占触摸，
 * 保证在画板 / 页面滚动等父级手势之上仍能被准确点到。
 */
function ToolButton({
  label,
  active,
  accent,
  danger,
  onPress,
}: {
  label: string;
  active?: boolean;
  accent?: boolean;
  danger?: boolean;
  onPress: () => void;
}) {
  const [pressed, setPressed] = useState(false);
  return (
    <View
      style={[
        styles.toolBtn,
        active && styles.toolBtnOn,
        accent && styles.toolBtnAccent,
        danger && styles.toolBtnDanger,
        pressed && styles.toolBtnPressed,
      ]}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderTerminationRequest={() => false}
      onResponderGrant={() => setPressed(true)}
      onResponderRelease={() => {
        setPressed(false);
        onPress();
      }}
      onResponderTerminate={() => setPressed(false)}
      accessibilityRole="button"
      accessibilityState={{ selected: !!active }}
    >
      <Text
        style={[
          styles.toolBtnText,
          active && styles.toolBtnTextOn,
          accent && styles.toolBtnTextAccent,
          danger && styles.toolBtnTextDanger,
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

/**
 * 方向箭头按钮：淡灰浮层，样式与分子浏览 / 反应场景里的平移箭头一致。
 * 按钮自己用 Responder 抢占触摸，按下不会透传给画板（不会被当成拖原子 / 连线）。
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
      <Ionicons name={PAN_ICONS[dir]} size={15} color={pressed ? colors.accent : colors.faint} />
    </View>
  );
}

const styles = StyleSheet.create({
  // userSelect: 'none' 很关键：否则拖拽会被浏览器当成“选中文字”，
  // RNW 会立刻 terminate 掉手势（导致松手事件收不到）
  wrap: { gap: 8, userSelect: 'none' },
  stage: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  canvas: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.line,
    overflow: 'hidden',
    ...shadow.card,
  },
  toolBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  toolBtn: {
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 10,
    backgroundColor: '#F4F8FF',
    borderWidth: 1,
    borderColor: colors.line,
    justifyContent: 'center',
    alignItems: 'center',
  },
  toolBtnOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  toolBtnPressed: { opacity: 0.7 },
  toolBtnAccent: { backgroundColor: colors.accentSoft, borderColor: '#C9DDFB' },
  toolBtnDanger: { backgroundColor: '#FDECEA', borderColor: '#F6CFCB' },
  toolBtnText: { fontSize: 12, fontWeight: '700', color: colors.inkSoft },
  toolBtnTextOn: { color: '#FFFFFF' },
  toolBtnTextAccent: { color: colors.accent },
  toolBtnTextDanger: { color: colors.red },
  toolDivider: { width: 1, height: 20, backgroundColor: colors.line },
  toolSpacer: { flex: 1, minWidth: 4 },
  panLayer: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  panEdgeTop: { position: 'absolute', top: 3, left: 0, right: 0, alignItems: 'center' },
  panEdgeBottom: { position: 'absolute', bottom: 3, left: 0, right: 0, alignItems: 'center' },
  panEdgeLeft: { position: 'absolute', left: 3, top: 0, bottom: 0, justifyContent: 'center' },
  panEdgeRight: { position: 'absolute', right: 3, top: 0, bottom: 0, justifyContent: 'center' },
  panBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.86)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  panBtnPressed: { backgroundColor: colors.accentSoft, borderColor: colors.accent },
  placeholder: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '44%',
    textAlign: 'center',
    fontSize: 12.5,
    color: colors.faint,
  },
  node: {
    position: 'absolute',
    width: NODE_R * 2,
    height: NODE_R * 2,
    borderRadius: NODE_R,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#16324f',
    shadowOpacity: 0.18,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  nodeText: { color: '#FFFFFF', fontWeight: '700', fontSize: 12 },
  ghost: {
    position: 'absolute',
    width: NODE_R * 2,
    height: NODE_R * 2,
    borderRadius: NODE_R,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.accent,
  },
  ghostText: { color: '#FFFFFF', fontWeight: '800', fontSize: 12.5 },
  tip: { fontSize: 11.5, color: colors.purple, fontWeight: '600' },
  hintBar: {
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#F4F8FF',
    borderLeftWidth: 3,
    borderLeftColor: colors.line,
  },
  hintBarWarn: { backgroundColor: '#FDECEA', borderLeftColor: colors.red },
  hint: { fontSize: 11.5, color: colors.sub, minHeight: 16 },
  hintWarn: { color: colors.red, fontWeight: '700' },
  legend: { fontSize: 10.5, color: colors.faint, lineHeight: 15 },
  hBadge: {
    position: 'absolute',
    width: 26,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderWidth: 1,
    borderColor: '#d7e0ec',
  },
  hText: { fontSize: 10.5, fontWeight: '700', color: colors.sub },
  paletteBar: {
    marginTop: 2,
    backgroundColor: '#FFFFFF',
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 10,
  },
  paletteTitle: { fontSize: 11.5, color: colors.faint, fontWeight: '600', marginBottom: 8 },
  palette: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    width: '22%',
    minWidth: 62,
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.line,
    paddingVertical: 7,
    backgroundColor: '#FBFDFF',
  },
  chipOn: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  chipDot: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 5,
  },
  chipGlyph: { color: '#FFFFFF', fontWeight: '800', fontSize: 12.5 },
  chipLabel: { fontSize: 11.5, fontWeight: '600', color: colors.inkSoft },
  chipLabelOn: { color: colors.accent },
});
