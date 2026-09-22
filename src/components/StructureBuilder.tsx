import { useCallback, useMemo, useRef, useState, type ReactElement } from 'react';
import { StyleSheet, Text, View, type GestureResponderEvent } from 'react-native';
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

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

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

function inBox(b: Box, x: number, y: number): boolean {
  return b.w > 0 && x >= b.x && y >= b.y && x <= b.x + b.w && y <= b.y + b.h;
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

  // 各区域相对根节点的矩形（根节点坐标系）
  const canvasBox = useRef<Box>({ x: 0, y: 0, w: 0, h: 0 });
  const barOff = useRef({ x: 0, y: 0 });
  const rowOff = useRef({ x: 0, y: 0 });
  const chipRaw = useRef<Record<string, Box>>({});
  const chipAbs = useRef<Record<string, Box>>({});

  const note = useCallback((s: string, warn = false) => setMsg({ text: s, warn }), []);

  const recomputeChips = useCallback(() => {
    const out: Record<string, Box> = {};
    for (const k of Object.keys(chipRaw.current)) {
      const c = chipRaw.current[k];
      out[k] = {
        x: c.x + rowOff.current.x + barOff.current.x,
        y: c.y + rowOff.current.y + barOff.current.y,
        w: c.w,
        h: c.h,
      };
    }
    chipAbs.current = out;
  }, []);

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

  /** 根节点坐标 → 画板内坐标 */
  const canvasPoint = (x: number, y: number) => ({
    x: x - canvasBox.current.x,
    y: y - canvasBox.current.y,
  });

  const onCanvas = (x: number, y: number) => inBox(canvasBox.current, x, y);

  const chipAt = (x: number, y: number): PlaceToolId | null => {
    for (const k of Object.keys(chipAbs.current)) {
      if (inBox(chipAbs.current[k], x, y)) return k as PlaceToolId;
    }
    return null;
  };

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

  /* ---------- 手势（全部由根节点接管） ---------- */

  const shouldStart = useCallback(
    (x: number, y: number) => onCanvas(x, y) || chipAt(x, y) !== null,
    []
  );

  const onGrant = (x: number, y: number) => {
    onDragStateChange?.(true);
    const chip = chipAt(x, y);
    if (chip) {
      // 从下方格子开始拖
      gesture.current = { id: chip, x0: x, y0: y, moved: false, source: 'chip' };
      setTool(chip);
      setDrag({ x, y, id: chip });
      note('拖到上面的白色画板里松手');
      return;
    }
    if (!onCanvas(x, y)) return;
    gesture.current = { id: tool as PlaceToolId, x0: x, y0: y, moved: false, source: 'canvas' };
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
      setDrag({ x, y, id: tool });
    }
  };

  const onMove = (x: number, y: number) => {
    const gs = gesture.current;
    if (!gs) return;
    if (Math.hypot(x - gs.x0, y - gs.y0) > 4) gs.moved = true;
    if (gs.source === 'chip') {
      setDrag({ x, y, id: gs.id });
      return;
    }
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
    if (PLACE_IDS.indexOf(tool) >= 0) setDrag({ x, y, id: tool });
  };

  const onRelease = (x: number, y: number) => {
    const gs = gesture.current;
    gesture.current = null;
    setDrag(null);
    onDragStateChange?.(false);

    if (gs && gs.source === 'chip') {
      if (!onCanvas(x, y)) {
        note(gs.moved ? '松手的位置要在白色画板里，把原子/基团拖上去再放手' : '', gs.moved);
        return;
      }
      const p = canvasPoint(x, y);
      place(gs.id, p.x, p.y);
      return;
    }
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
  };

  const onTerminate = () => {
    gesture.current = null;
    dragNode.current = null;
    bondFrom.current = null;
    snapshot.current = null;
    setRubber(null);
    setDrag(null);
    onDragStateChange?.(false);
  };

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
    <View
      style={styles.wrap}
      collapsable={false}
      onStartShouldSetResponder={(e: GestureResponderEvent) =>
        shouldStart(e.nativeEvent.locationX, e.nativeEvent.locationY)
      }
      onMoveShouldSetResponder={() => false}
      onResponderGrant={(e) => onGrant(e.nativeEvent.locationX, e.nativeEvent.locationY)}
      onResponderMove={(e) => onMove(e.nativeEvent.locationX, e.nativeEvent.locationY)}
      onResponderRelease={(e) => onRelease(e.nativeEvent.locationX, e.nativeEvent.locationY)}
      onResponderTerminate={onTerminate}
    >
      <View style={styles.stage}>
        <View
          style={[styles.canvas, { height }]}
          onLayout={(e) => {
            const { x, y, width, height: h } = e.nativeEvent.layout;
            canvasBox.current = { x, y, w: width, h };
            setSize({ w: width, h });
          }}
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

        {/* 画板右侧：模式切换 + 撤销 */}
        <View style={styles.side}>
          {MODES.map((m) => {
            const on = tool === m.id;
            return (
              <Text
                key={m.id}
                onPress={() => {
                  setTool(m.id);
                  note(m.hint);
                }}
                style={[styles.sideBtn, on && styles.sideBtnOn]}
              >
                {m.label}
              </Text>
            );
          })}
          <View style={styles.sideDivider} />
          <Text onPress={undo} style={[styles.sideBtn, styles.sideBtnUndo]}>
            撤销
          </Text>
        </View>
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

      <View
        style={styles.paletteBar}
        onLayout={(e) => {
          barOff.current = { x: e.nativeEvent.layout.x, y: e.nativeEvent.layout.y };
          recomputeChips();
        }}
      >
        <Text style={styles.paletteTitle}>按住下面的格子，往上拖到画板里</Text>
        <View
          style={styles.palette}
          onLayout={(e) => {
            rowOff.current = { x: e.nativeEvent.layout.x, y: e.nativeEvent.layout.y };
            recomputeChips();
          }}
        >
          {PALETTE.map((t) => {
            const on = tool === t.id;
            return (
              <View
                key={t.id}
                style={[styles.chip, on && styles.chipOn]}
                collapsable={false}
                onLayout={(e) => {
                  const { x, y, width, height: h } = e.nativeEvent.layout;
                  chipRaw.current[t.id] = { x, y, w: width, h };
                  recomputeChips();
                }}
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

      <View style={styles.ops}>
        <Text onPress={tidy} style={styles.op}>
          重排
        </Text>
        <Text onPress={clearAll} style={[styles.op, { color: colors.red }]}>
          清空
        </Text>
      </View>
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
  side: { width: 48, gap: 6, paddingTop: 2 },
  sideBtn: {
    textAlign: 'center',
    fontSize: 11.5,
    fontWeight: '700',
    color: colors.inkSoft,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
    paddingVertical: 6,
    overflow: 'hidden',
  },
  sideBtnOn: { backgroundColor: colors.accent, borderColor: colors.accent, color: '#FFFFFF' },
  sideBtnUndo: { color: colors.accent },
  sideDivider: { height: 1, backgroundColor: colors.line, marginVertical: 1 },
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
  ops: { flexDirection: 'row', gap: 16, justifyContent: 'flex-end' },
  op: { fontSize: 12.5, fontWeight: '600', color: colors.accent },
});
