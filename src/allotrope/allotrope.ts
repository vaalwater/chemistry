/**
 * 同素异形体专题：金刚石 / 石墨 / C₆₀ —— 结构决定性质。
 *
 * 这里放三块内容：
 * 1) 三种碳单质的结构简介 + 联动的性质表（硬度 / 导电性 / 熔点 / 用途）；
 * 2) 结构几何生成（交给 3D 引擎画球棍模型，层间范德华力用虚线表示）；
 * 3) “同位素 / 同素异形体 / 同分异构体 / 同系物”辨析卡片与课堂小测。
 */
import type { Ionicons } from '@expo/vector-icons';
import type { Bond, MolAtom, MoleculeData } from '../types';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

export type AllotropeId = 'diamond' | 'graphite' | 'c60';

/** 性质联动表中的一行（随选中单质变化） */
export interface AllotropePropRow {
  label: string;
  value: string;
  icon: IconName;
  /** up = 强/高，down = 弱/低，mid = 中性说明 */
  tone: 'up' | 'down' | 'mid';
  note: string;
}

export interface AllotropeEntry {
  id: AllotropeId;
  name: string;
  formula: string;
  icon: IconName;
  /** 一句话结构标签 */
  structTag: string;
  /** 结构特点（详细） */
  structText: string;
  /** 微粒间作用力 */
  forceText: string;
  canvasHint: string;
  props: AllotropePropRow[];
  /** 结构 → 性质 的解释 */
  why: string;
  legend: { kind: 'atom' | 'solid' | 'dash'; text: string }[];
}

/* ==================== 一、三种同素异形体 ==================== */

export const ALLOTROPES: AllotropeEntry[] = [
  {
    id: 'diamond',
    name: '金刚石',
    formula: 'C',
    icon: 'diamond-outline',
    structTag: '空间网状结构',
    structText:
      '每个碳原子以 4 个 sp³ 杂化轨道与周围 4 个碳形成共价键，键角 109°28′，向空间延伸成正四面体骨架。整块晶体就是一个巨大的“分子”。',
    forceText: '只有 C—C 共价键（键长 154 pm），键能大、没有薄弱环节',
    canvasHint: '正四面体向空间延伸 —— 拖动看它没有“层”，也没有边界',
    props: [
      {
        label: '硬度',
        value: '最大（莫氏 10）',
        icon: 'bonfire-outline',
        tone: 'up',
        note: '三维共价键网极难被压碎，天然存在中最硬的物质',
      },
      {
        label: '导电性',
        value: '不导电',
        icon: 'flash-off-outline',
        tone: 'down',
        note: '4 个价电子全部成键，没有自由移动的电子',
      },
      {
        label: '熔点',
        value: '极高（>3550 ℃）',
        icon: 'thermometer-outline',
        tone: 'up',
        note: '熔化要打断大量强共价键，需要的能量极高',
      },
      {
        label: '用途',
        value: '切割玻璃、钻头、装饰品',
        icon: 'cut-outline',
        tone: 'mid',
        note: '硬度大是它做刀具的全部理由',
      },
    ],
    why: '四个方向都是等强度的共价键 → 硬、脆、不导电、熔点极高 —— 这就是“键的方向性”写进宏观性质的样子。',
    legend: [
      { kind: 'atom', text: '灰球 = 碳原子 C' },
      { kind: 'solid', text: '实线 = C—C 共价键（正四面体方向）' },
    ],
  },
  {
    id: 'graphite',
    name: '石墨',
    formula: 'C',
    icon: 'layers-outline',
    structTag: '层状结构 · 层间滑移',
    structText:
      '每个碳原子用 3 个电子与同层 3 个碳成键，排成正六边形蜂巢平面（sp²，键角 120°）；第 4 个电子在层内自由移动。层与层只靠范德华力相吸，可以相互滑动。',
    forceText: '层内是强共价键，层间是弱的范德华力（层间距 335 pm，比键长大一倍多）',
    canvasHint: '三层蜂巢片平行叠放，层间虚线 = 范德华力，随时能被剪开',
    props: [
      {
        label: '硬度',
        value: '很软、滑腻（莫氏 1~2）',
        icon: 'bonfire-outline',
        tone: 'down',
        note: '层间只是范德华力，稍用力就层层滑移、剥落',
      },
      {
        label: '导电性',
        value: '良好导电',
        icon: 'flash-outline',
        tone: 'up',
        note: '每个碳剩 1 个未成键电子，在整个层面上自由移动',
      },
      {
        label: '熔点',
        value: '极高（3652 ℃）',
        icon: 'thermometer-outline',
        tone: 'up',
        note: '熔化前要先破坏层内的强共价键，同样极难',
      },
      {
        label: '用途',
        value: '电极、润滑剂、铅笔芯',
        icon: 'color-wand-outline',
        tone: 'mid',
        note: '导电靠自由电子，润滑靠层间易滑移',
      },
    ],
    why: '同一层里强、层与层之间弱 —— 这种“各向异性”让石墨同时具备高熔点（层内强键）和软、滑、导电（层间弱 + 自由电子）。',
    legend: [
      { kind: 'atom', text: '灰球 = 碳原子 C' },
      { kind: 'solid', text: '实线 = 层内 C—C 共价键（六元环）' },
      { kind: 'dash', text: '虚线 = 层间范德华力（很弱，可以滑移）' },
    ],
  },
  {
    id: 'c60',
    name: 'C₆₀',
    formula: 'C₆₀',
    icon: 'football-outline',
    structTag: '分子结构 · 足球状',
    structText:
      '60 个碳原子围成一个中空的球：12 个正五边形 + 20 个正六边形拼成足球的形状（截角二十面体），每个碳再与 3 个碳相连。分子内部是空的，分子之间靠范德华力堆积成分子晶体。',
    forceText: '分子内 C—C 共价键，分子间范德华力；有固定组成 C₆₀，就是一个独立分子',
    canvasHint: '足球在自转 —— 试着滚一滚，五元环是它被“掰弯”成球的原因',
    props: [
      {
        label: '硬度',
        value: '质脆（分子晶体）',
        icon: 'bonfire-outline',
        tone: 'down',
        note: '分子间力弱，受压时分子整体移位，不像金刚石那样硬',
      },
      {
        label: '导电性',
        value: '本身不导电',
        icon: 'flash-off-outline',
        tone: 'down',
        note: '分子是独立单元，电子不易在分子间跑；掺入碱金属后可变超导体',
      },
      {
        label: '熔点',
        value: '较低（约 600 ℃ 升华）',
        icon: 'thermometer-outline',
        tone: 'down',
        note: '熔化/升华只克服分子间力，不用打断分子内的共价键',
      },
      {
        label: '用途',
        value: '超导体、催化剂载体、纳米材料',
        icon: 'sparkles-outline',
        tone: 'mid',
        note: '可溶于苯等有机溶剂 —— 典型的分子晶体行为',
      },
    ],
    why: '结构单元从“无限延伸的网”缩小成“一个个独立分子”，于是熔点、硬度都按分子晶体的规律走：软、脆、易升华、可溶于有机溶剂。',
    legend: [
      { kind: 'atom', text: '灰球 = 碳原子 C' },
      { kind: 'solid', text: '实线 = C—C 共价键（五元环 + 六元环）' },
    ],
  },
];

export function allotropeById(id: AllotropeId): AllotropeEntry {
  return ALLOTROPES.find((a) => a.id === id) ?? ALLOTROPES[0];
}

/** 三者横向对比（表格）：label + 三项取值 */
export interface CompareRow {
  label: string;
  values: Record<AllotropeId, string>;
}

export const COMPARE_ROWS: CompareRow[] = [
  {
    label: '结构型式',
    values: {
      diamond: '正四面体空间网状',
      graphite: '六元环层状',
      c60: '足球状分子',
    },
  },
  {
    label: '基本微粒',
    values: {
      diamond: '原子（整块晶体）',
      graphite: '原子（层）',
      c60: 'C₆₀ 分子',
    },
  },
  {
    label: '微粒间作用',
    values: {
      diamond: '全是共价键',
      graphite: '层内共价键 + 层间范德华力',
      c60: '分子内共价键 + 分子间范德华力',
    },
  },
  {
    label: '硬度',
    values: { diamond: '最硬', graphite: '很软、滑', c60: '质脆' },
  },
  {
    label: '导电性',
    values: { diamond: '不导电', graphite: '导电', c60: '不导电' },
  },
  {
    label: '熔点',
    values: { diamond: '极高 >3550 ℃', graphite: '极高 3652 ℃', c60: '较低，易升华' },
  },
  {
    label: '溶解性',
    values: { diamond: '不溶', graphite: '不溶', c60: '可溶于苯' },
  },
  {
    label: '典型用途',
    values: { diamond: '切割、钻头', graphite: '电极、润滑', c60: '超导、新材料' },
  },
];

/* ==================== 二、结构几何生成 ==================== */

interface Frame {
  atoms: MolAtom[];
  bonds: Bond[];
}

const C_CC_DIAMOND = 1.54; // 金刚石 C—C（示意）
const C_CC_GRAPHITE = 1.42; // 石墨层内 C—C
const C_LAYER_GAP = 3.35; // 石墨层间距
const C60_BOND = 1.42; // C₆₀ 键长（示意，实际有 139 / 145 pm 两种）

/** 金刚石：面心立方 + 两套原子的四面体网络，裁成一个球形团簇 */
function buildDiamond(): Frame {
  const d = C_CC_DIAMOND;
  const a = (4 * d) / Math.sqrt(3); // 晶胞参数
  const fcc: [number, number, number][] = [
    [0, 0, 0],
    [0, 0.5, 0.5],
    [0.5, 0, 0.5],
    [0.5, 0.5, 0],
  ];
  const basis: [number, number, number][] = [
    [0, 0, 0],
    [0.25, 0.25, 0.25],
  ];
  const raw: [number, number, number][] = [];
  for (let i = -2; i <= 1; i++) {
    for (let j = -2; j <= 1; j++) {
      for (let k = -2; k <= 1; k++) {
        for (const f of fcc) {
          for (const b of basis) {
            raw.push([(i + f[0] + b[0]) * a, (j + f[1] + b[1]) * a, (k + f[2] + b[2]) * a]);
          }
        }
      }
    }
  }
  const cx = raw.reduce((s, p) => s + p[0], 0) / raw.length;
  const cy = raw.reduce((s, p) => s + p[1], 0) / raw.length;
  const cz = raw.reduce((s, p) => s + p[2], 0) / raw.length;
  const cut = 4.0;
  const pos = raw.filter((p) => Math.hypot(p[0] - cx, p[1] - cy, p[2] - cz) <= cut);
  const atoms: MolAtom[] = pos.map((p) => ({ el: 'C', pos: [p[0] - cx, p[1] - cy, p[2] - cz] }));
  const bonds: Bond[] = [];
  for (let i = 0; i < atoms.length; i++) {
    for (let j = i + 1; j < atoms.length; j++) {
      const A = atoms[i].pos;
      const B = atoms[j].pos;
      const dd = Math.hypot(A[0] - B[0], A[1] - B[1], A[2] - B[2]);
      if (Math.abs(dd - d) < 0.15) bonds.push({ a: i, b: j, order: 1 });
    }
  }
  return { atoms, bonds };
}

/** 石墨：三层正六边形蜂巢片，层间用虚线（vdw）表示范德华力 */
function buildGraphite(): Frame {
  const l = C_CC_GRAPHITE;
  const gap = C_LAYER_GAP;
  const a1: [number, number] = [l * 1.5, (l * Math.sqrt(3)) / 2];
  const a2: [number, number] = [l * 1.5, (-l * Math.sqrt(3)) / 2];
  const basis: [number, number][] = [
    [0, 0],
    [l, 0],
  ];
  const plane: [number, number][] = [];
  for (let i = -3; i <= 3; i++) {
    for (let j = -3; j <= 3; j++) {
      for (const b of basis) {
        plane.push([i * a1[0] + j * a2[0] + b[0], i * a1[1] + j * a2[1] + b[1]]);
      }
    }
  }
  // 裁出一个圆形薄片（保留中心若干个六元环）
  const kept = plane.filter((p) => Math.hypot(p[0], p[1]) <= l * 3.4);
  const layers = 3;
  const atoms: MolAtom[] = [];
  for (let L = 0; L < layers; L++) {
    const z = (L - (layers - 1) / 2) * gap;
    kept.forEach((p) => atoms.push({ el: 'C', pos: [p[0], z, p[1]] }));
  }
  const n = kept.length;
  const bonds: Bond[] = [];
  const dist = (A: [number, number, number], B: [number, number, number]) =>
    Math.hypot(A[0] - B[0], A[1] - B[1], A[2] - B[2]);
  for (let i = 0; i < atoms.length; i++) {
    for (let j = i + 1; j < atoms.length; j++) {
      const A = atoms[i].pos;
      const B = atoms[j].pos;
      const dd = dist(A, B);
      if (Math.abs(dd - l) < 0.15) {
        bonds.push({ a: i, b: j, order: 1 });
      } else if (Math.abs(dd - gap) < 0.15 && i % n === j % n && i % n % 4 === 0) {
        // 层间范德华力：只挑少量对称位置画虚线，画面更清楚
        bonds.push({ a: i, b: j, order: 1, style: 'vdw' });
      }
    }
  }
  return { atoms, bonds };
}

/** C₆₀：截角二十面体的 60 个顶点（黄金比例构造），每条最近的边为一根键 */
function buildC60(): Frame {
  const phi = (1 + Math.sqrt(5)) / 2;
  const base: [number, number, number][] = [
    [0, 1, 3 * phi],
    [1, 2 + phi, 2 * phi],
    [phi, 2, 2 * phi + 1],
  ];
  const raw: [number, number, number][] = [];
  for (const v of base) {
    for (let sx = -1; sx <= 1; sx += 2) {
      for (let sy = -1; sy <= 1; sy += 2) {
        for (let sz = -1; sz <= 1; sz += 2) {
          const p: [number, number, number] = [v[0] * sx, v[1] * sy, v[2] * sz];
          raw.push(p, [p[2], p[0], p[1]], [p[1], p[2], p[0]]); // 循环置换
        }
      }
    }
  }
  const seen = new Set<string>();
  const verts: [number, number, number][] = [];
  for (const p of raw) {
    const key = p.map((x) => x.toFixed(4)).join(',');
    if (seen.has(key)) continue;
    seen.add(key);
    verts.push(p);
  }
  let minD = Infinity;
  for (let i = 0; i < verts.length; i++) {
    for (let j = i + 1; j < verts.length; j++) {
      const dd = Math.hypot(
        verts[i][0] - verts[j][0],
        verts[i][1] - verts[j][1],
        verts[i][2] - verts[j][2]
      );
      if (dd < minD) minD = dd;
    }
  }
  const k = C60_BOND / minD; // 缩放到示意键长
  const atoms: MolAtom[] = verts.map((p) => ({
    el: 'C',
    pos: [p[0] * k, p[1] * k, p[2] * k] as [number, number, number],
  }));
  const bonds: Bond[] = [];
  for (let i = 0; i < atoms.length; i++) {
    for (let j = i + 1; j < atoms.length; j++) {
      const A = atoms[i].pos;
      const B = atoms[j].pos;
      const dd = Math.hypot(A[0] - B[0], A[1] - B[1], A[2] - B[2]);
      if (Math.abs(dd - C60_BOND) < 0.15) bonds.push({ a: i, b: j, order: 1 });
    }
  }
  return { atoms, bonds };
}

function asMol(id: AllotropeId, name: string, frame: Frame, desc: string): MoleculeData {
  return {
    id: `allotrope-${id}`,
    name,
    formula: id === 'c60' ? 'C₆₀' : 'C',
    category: '同素异形体',
    level: '必修',
    scene: 'molecule',
    desc,
    atoms: frame.atoms,
    bonds: frame.bonds,
    noLabels: true, // 原子太多，逐个标元素符号会把结构糊住
  };
}

export const ALLOTROPE_MOL: Record<AllotropeId, MoleculeData> = {
  diamond: asMol('diamond', '金刚石', buildDiamond(), '金刚石的空间网状结构'),
  graphite: asMol('graphite', '石墨', buildGraphite(), '石墨的层状结构，层间虚线为范德华力'),
  c60: asMol('c60', 'C₆₀', buildC60(), 'C₆₀ 足球状分子'),
};

/* ==================== 三、概念辨析 ==================== */

export type ConceptKey = 'isotope' | 'allotrope' | 'isomer' | 'homolog';

export interface ConceptCard {
  key: ConceptKey;
  name: string;
  icon: IconName;
  color: string;
  /** 研究对象 */
  object: string;
  /** 相同点 */
  same: string;
  /** 不同点 */
  diff: string;
  /** 举例 */
  example: string;
  /** 快速判断的关键一句 */
  judge: string;
}

export const CONCEPT_ORDER: ConceptKey[] = ['isotope', 'allotrope', 'isomer', 'homolog'];

export const CONCEPTS: Record<ConceptKey, ConceptCard> = {
  isotope: {
    key: 'isotope',
    name: '同位素',
    icon: 'nuclear-outline',
    color: '#2fa7e8',
    object: '原子（核素）',
    same: '质子数相同 → 同一种元素，化学性质几乎一样',
    diff: '中子数不同 → 质量数不同（原子质量、放射性可能不同）',
    example: '¹H / ²H(D) / ³H(T)；¹²C / ¹³C / ¹⁴C',
    judge: '看左右下标的质子数：Z 相同、A 不同 → 同位素',
  },
  allotrope: {
    key: 'allotrope',
    name: '同素异形体',
    icon: 'layers-outline',
    color: '#8a63d2',
    object: '单质',
    same: '同一种元素组成，都是单质',
    diff: '原子结合方式（结构）不同 → 物理性质差异很大',
    example: '金刚石 / 石墨 / C₆₀；O₂ / O₃；白磷 / 红磷',
    judge: '同种元素的不同单质 → 同素异形体',
  },
  isomer: {
    key: 'isomer',
    name: '同分异构体',
    icon: 'git-network-outline',
    color: '#e2822f',
    object: '分子（化合物）',
    same: '分子式相同、相对分子质量相同',
    diff: '原子连接顺序或空间排布不同 → 结构不同，性质不同',
    example: '正丁烷 / 异丁烷；乙醇 / 二甲醚；葡萄糖 / 果糖',
    judge: '分子式相同、结构不同 → 同分异构体',
  },
  homolog: {
    key: 'homolog',
    name: '同系物',
    icon: 'repeat-outline',
    color: '#1fa97a',
    object: '有机物（同一类）',
    same: '结构相似、通式相同，化学性质相似',
    diff: '相差一个或若干个 CH₂ → 分子式一定不同',
    example: 'CH₄ / C₂H₆ / C₃H₈；CH₂=CH₂ 与 CH₃CH=CH₂',
    judge: '结构相似、分子式相差 n 个 CH₂ → 同系物',
  },
};

/** 两两对比的一句提示（放在辨析区开头） */
export const COMPARE_TIPS: string[] = [
  '同位素改的是原子核（中子数），化学性质几乎不变；',
  '同素异形体改的是原子搭建方式（结构），物理性质随之改变；',
  '同分异构体改的是分子式内部的连接顺序，分子式不变性质变；',
  '同系物则是一串相差 CH₂ 的“兄弟姐妹”，分子式一定不同。',
];

/* ==================== 四、课堂小测 ==================== */

export interface QuizItem {
  id: string;
  /** 例子本身（题干主体） */
  example: string;
  /** 提问 */
  ask: string;
  answer: ConceptKey;
  explain: string;
  trap?: string;
}

export const QUIZ_OPTIONS: ConceptKey[] = ['isotope', 'allotrope', 'isomer', 'homolog'];

export const QUIZ: QuizItem[] = [
  {
    id: 'q1',
    example: '¹H、²H、³H（氕、氘、氚）',
    ask: '这三者的关系是',
    answer: 'isotope',
    explain: '质子数都是 1，中子数分别是 0、1、2 —— Z 相同、A 不同，属于同位素。',
  },
  {
    id: 'q2',
    example: '金刚石 与 石墨',
    ask: '这两者的关系是',
    answer: 'allotrope',
    explain: '都由碳元素组成且都是单质，差别在碳原子的连接方式（网状 vs 层状），是同素异形体。',
    trap: '二者都是 C 却“物理性质天差地别”，正是同素异形体的标志。',
  },
  {
    id: 'q3',
    example: '正丁烷 CH₃CH₂CH₂CH₃ 与 异丁烷 (CH₃)₃CH',
    ask: '这两者的关系是',
    answer: 'isomer',
    explain: '分子式都是 C₄H₁₀，但碳骨架一个直链一个带支链，属于同分异构体（碳链异构）。',
  },
  {
    id: 'q4',
    example: 'O₂（氧气）与 O₃（臭氧）',
    ask: '这两者的关系是',
    answer: 'allotrope',
    explain: '同由氧元素组成的两种单质，分子组成不同、性质不同（臭氧强氧化），是同素异形体。',
    trap: '分子式不同 ≠ 同分异构体：分子式不同的化合物才轮到“同分”二字。',
  },
  {
    id: 'q5',
    example: '乙醇 CH₃CH₂OH 与 二甲醚 CH₃OCH₃',
    ask: '这两者的关系是',
    answer: 'isomer',
    explain: '分子式同为 C₂H₆O，但官能团不同（醇 vs 醚），属于同分异构体中的官能团异构。',
  },
  {
    id: 'q6',
    example: '甲烷 CH₄ 与 乙烷 C₂H₆',
    ask: '这两者的关系是',
    answer: 'homolog',
    explain: '都是烷烃（通式 CₙH₂ₙ₊₂），分子式相差 1 个 CH₂，结构相似、性质相似，属于同系物。',
    trap: '相差 CH₂ 必然分子式不同，所以不可能是同分异构体。',
  },
  {
    id: 'q7',
    example: '¹²C 与 ¹⁴C',
    ask: '这两者的关系是',
    answer: 'isotope',
    explain: '质子数都是 6，质量数 12 与 14（¹⁴C 具放射性，用于测年），属于同位素。',
  },
  {
    id: 'q8',
    example: '白磷 P₄ 与 红磷',
    ask: '这两者的关系是',
    answer: 'allotrope',
    explain: '都是磷元素的单质，白磷是 P₄ 分子、红磷是链状巨分子 —— 结构不同，属于同素异形体。',
  },
  {
    id: 'q9',
    example: '葡萄糖 C₆H₁₂O₆ 与 果糖 C₆H₁₂O₆',
    ask: '这两者的关系是',
    answer: 'isomer',
    explain: '分子式相同，一个是多羟基醛、一个是多羟基酮，官能团不同 → 同分异构体。',
  },
  {
    id: 'q10',
    example: '乙烯 CH₂=CH₂ 与 丙烯 CH₃CH=CH₂',
    ask: '这两者的关系是',
    answer: 'homolog',
    explain: '都含一个碳碳双键、同属烯烃（通式 CₙH₂ₙ），相差 1 个 CH₂，属于同系物。',
  },
  {
    id: 'q11',
    example: '石墨 与 C₆₀',
    ask: '这两者的关系是',
    answer: 'allotrope',
    explain: '都是碳单质：一个是层层堆叠的片层，一个是足球形分子 —— 结构不同，属于同素异形体。',
  },
  {
    id: 'q12',
    example: '乙酸 CH₃COOH 与 甲酸甲酯 HCOOCH₃',
    ask: '这两者的关系是',
    answer: 'isomer',
    explain: '分子式同为 C₂H₄O₂，一个羧酸一个酯（官能团异构），属于同分异构体。',
  },
];
