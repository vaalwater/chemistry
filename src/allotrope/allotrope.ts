/**
 * 同素异形体专题：同一种元素，结构不同 → 性质不同。
 *
 * 覆盖高中常见的五组：
 *  - 碳 C：金刚石 / 石墨 / C₆₀
 *  - 氧 O：氧气 O₂ / 臭氧 O₃
 *  - 磷 P：白磷 P₄ / 红磷
 *  - 硫 S：斜方硫 / 单斜硫
 *  - 硅 Si：晶体硅 / 无定形硅
 *
 * 每块内容包含：
 * 1) 结构简介 + 联动的性质表（硬度 / 导电性 / 着火点 / 用途等，按该组最说明问题的指标选取）；
 * 2) 结构几何生成（交给 3D 引擎画球棍模型，分子间 / 层间作用力用虚线表示）；
 * 3) “同位素 / 同素异形体 / 同分异构体 / 同系物”辨析卡片与课堂小测。
 */
import type { Ionicons } from '@expo/vector-icons';
import type { Bond, MolAtom, MoleculeData } from '../types';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

export type AllotropeId =
  | 'diamond'
  | 'graphite'
  | 'c60'
  | 'o2'
  | 'o3'
  | 'whiteP'
  | 'redP'
  | 'rhombicS'
  | 'monoclinicS'
  | 'crystalSi'
  | 'amorphousSi';

/** 元素族（一组同素异形体共享同一个元素） */
export type AllotropeGroupId = 'C' | 'O' | 'P' | 'S' | 'Si';

export interface AllotropeGroup {
  id: AllotropeGroupId;
  /** 元素符号，用于分组按钮 */
  symbol: string;
  /** 元素中文名 */
  name: string;
  color: string;
  /** 该组的引导语（切换组时页面首段文案随之变化） */
  lead: string;
  ids: AllotropeId[];
}

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
  group: AllotropeGroupId;
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

/* ==================== 〇、元素分组 ==================== */

export const ALLOTROPE_GROUPS: AllotropeGroup[] = [
  {
    id: 'C',
    symbol: 'C',
    name: '碳',
    color: '#6f6f6f',
    lead:
      '金刚石、石墨、C₆₀ 都由碳元素组成。切换下面的按钮，看它们的碳原子是怎么搭的，' +
      '再对照下方的性质 —— 硬度、导电性、熔点、用途全写在结构里。',
    ids: ['diamond', 'graphite', 'c60'],
  },
  {
    id: 'O',
    symbol: 'O',
    name: '氧',
    color: '#e02222',
    lead:
      '同样是氧原子，两个抱团是氧气 O₂，三个抱团就成了臭氧 O₃ —— 原子个数一变，' +
      '氧化性就从“需要点燃”变成“常温漂白杀菌”。',
    ids: ['o2', 'o3'],
  },
  {
    id: 'P',
    symbol: 'P',
    name: '磷',
    color: '#ff8f2b',
    lead:
      '白磷和红磷是“结构决定性质”最戏剧的一组：只差把正四面体里那根绷紧的键松开，' +
      '着火点就从 40 ℃ 跳到 240 ℃，毒性也基本消失。',
    ids: ['whiteP', 'redP'],
  },
  {
    id: 'S',
    symbol: 'S',
    name: '硫',
    color: '#e8c31c',
    lead:
      '斜方硫和单斜硫的分子式都是 S₈，变的不是环本身，而是环在晶体里怎么堆 —— ' +
      '这一组能说明“同素异形”不一定改分子式。',
    ids: ['rhombicS', 'monoclinicS'],
  },
  {
    id: 'Si',
    symbol: 'Si',
    name: '硅',
    color: '#c2a05e',
    lead:
      '晶体硅与无定形硅都是 4 配位的硅原子网，差别只在排得整不整齐：' +
      '整齐的有固定熔点、能做半导体；乱的没有熔点、导电也差。',
    ids: ['crystalSi', 'amorphousSi'],
  },
];

export const ALLOTROPE_GROUP_BY_ID: Record<AllotropeGroupId, AllotropeGroup> =
  ALLOTROPE_GROUPS.reduce(
    (acc, g) => {
      acc[g.id] = g;
      return acc;
    },
    {} as Record<AllotropeGroupId, AllotropeGroup>
  );

export function groupById(id: AllotropeGroupId): AllotropeGroup {
  return ALLOTROPE_GROUP_BY_ID[id] ?? ALLOTROPE_GROUPS[0];
}

/* ==================== 一、各同素异形体 ==================== */

export const ALLOTROPES: AllotropeEntry[] = [
  /* ---------- 碳 ---------- */
  {
    id: 'diamond',
    group: 'C',
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
    group: 'C',
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
    group: 'C',
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

  /* ---------- 氧 ---------- */
  {
    id: 'o2',
    group: 'O',
    name: '氧气',
    formula: 'O₂',
    icon: 'ellipse-outline',
    structTag: '双原子分子 · O=O',
    structText:
      '两个氧原子之间形成一个 σ 键和一个 π 键，即 O=O（键长 121 pm，键能 498 kJ/mol）。双原子分子必然是直线形，是非极性分子；分子之间只靠范德华力，所以沸点很低。',
    forceText: '分子内 O=O 共价键（键能大，很牢固），分子间范德华力',
    canvasHint: '两个氧原子中间的双线就是 O=O —— 键能大，常温下相当稳',
    props: [
      {
        label: '氧化性',
        value: '较强，但需点燃/加热',
        icon: 'flash-outline',
        tone: 'mid',
        note: 'O=O 键能大，常温下比较“沉得住气”，反应常要加热、点燃或加催化剂',
      },
      {
        label: '色、味',
        value: '无色无味的气体',
        icon: 'color-wand-outline',
        tone: 'mid',
        note: '标准状况下为气体，沸点 −183 ℃，液态氧是淡蓝色',
      },
      {
        label: '稳定性',
        value: '很稳定',
        icon: 'shield-outline',
        tone: 'up',
        note: '要打断 O=O 需要不少能量，因此氧气可以压缩在钢瓶里长期存放',
      },
      {
        label: '用途',
        value: '供氧、助燃、炼钢、焊接',
        icon: 'medical-outline',
        tone: 'mid',
        note: '支持呼吸与燃烧，是地壳中含量最多的元素',
      },
    ],
    why: '两个氧原子用双键牢牢锁在一起，键能大 → 常温下稳定、氧化性要靠加热才“发作”；也因为分子间只有范德华力，氧气是沸点 −183 ℃ 的气体。',
    legend: [
      { kind: 'atom', text: '红球 = 氧原子 O' },
      { kind: 'solid', text: '双线 = O=O 双键（σ + π）' },
    ],
  },
  {
    id: 'o3',
    group: 'O',
    name: '臭氧',
    formula: 'O₃',
    icon: 'shield-outline',
    structTag: '三原子分子 · V 形',
    structText:
      '三个氧原子排成 V 形（角形）：键角约 117°，键长 128 pm，介于 O—O 单键与 O=O 双键之间，存在三中心四电子的离域 π 键，因此分子有极性（是极性分子）。',
    forceText: '分子内共价键（含离域大 π 键，O—O 比 O=O 弱得多），分子间范德华力',
    canvasHint: '三个氧拐了个弯 —— 多出的那个氧原子就是“活性氧”的来源',
    props: [
      {
        label: '氧化性',
        value: '极强（常温即可）',
        icon: 'flash-outline',
        tone: 'up',
        note: '常温下就能氧化 Ag、Hg，使有色物质褪色、杀菌消毒',
      },
      {
        label: '色、味',
        value: '淡蓝色、鱼腥臭味',
        icon: 'color-wand-outline',
        tone: 'mid',
        note: '液态臭氧是深蓝色；浓度较高时对人体有害',
      },
      {
        label: '稳定性',
        value: '不稳定，易变回 O₂',
        icon: 'thermometer-outline',
        tone: 'down',
        note: '2O₃ = 3O₂：受热、紫外线或催化剂都会加速分解',
      },
      {
        label: '用途',
        value: '消毒漂白、臭氧层',
        icon: 'shield-checkmark-outline',
        tone: 'mid',
        note: '高空臭氧层吸收紫外线；近地面的臭氧却是污染物',
      },
    ],
    why: '三个氧原子组成的 V 形分子里，多出的氧原子很容易“松手” → 氧化性比 O₂ 强得多；也正因为这个键弱，臭氧不稳定，会自己变回氧气。',
    legend: [
      { kind: 'atom', text: '红球 = 氧原子 O' },
      { kind: 'solid', text: '实线 = O—O 键（等长，含离域 π 键）' },
    ],
  },

  /* ---------- 磷 ---------- */
  {
    id: 'whiteP',
    group: 'P',
    name: '白磷',
    formula: 'P₄',
    icon: 'warning-outline',
    structTag: 'P₄ 分子 · 正四面体',
    structText:
      '4 个磷原子坐在正四面体的 4 个顶点上，6 条棱就是 6 个 P—P 键，键角被迫压到 60°（磷的正常键角接近 100°）。键被“绷”得极紧，一碰就断。分子之间靠范德华力堆成分子晶体。',
    forceText: '分子内 P—P 共价键（60° 张力键，极易断裂），分子间范德华力',
    canvasHint: '正四面体的 6 条棱全是键 —— 键角只有 60°，这是它危险的原因',
    props: [
      {
        label: '着火点',
        value: '40 ℃（空气中自燃）',
        icon: 'flame-outline',
        tone: 'down',
        note: '张力键极易断裂，缓慢氧化放出的热就足以把它点着',
      },
      {
        label: '毒性',
        value: '剧毒（约 0.1 g 可致死）',
        icon: 'skull-outline',
        tone: 'down',
        note: '必须隔绝空气保存在冷水中，取用要用镊子、在水下切割',
      },
      {
        label: '溶解性',
        value: '不溶于水，溶于 CS₂',
        icon: 'water-outline',
        tone: 'mid',
        note: '典型的分子晶体：能被有机溶剂“整个抱走”，20 个 P₄ 才凑一个晶胞',
      },
      {
        label: '用途',
        value: '制高纯磷酸、燃烧弹',
        icon: 'beaker-outline',
        tone: 'mid',
        note: '隔绝空气加热到 260 ℃ 就能转变成红磷',
      },
    ],
    why: '正四面体把 P—P 键压成 60° 的“张紧”状态 → 键极易断裂 → 着火点低到 40 ℃、还剧毒。把这条张力键拆开重排成链状，性质立刻温和下来。',
    legend: [
      { kind: 'atom', text: '橙球 = 磷原子 P' },
      { kind: 'solid', text: '实线 = P—P 键（正四面体的 6 条棱，键角 60°）' },
    ],
  },
  {
    id: 'redP',
    group: 'P',
    name: '红磷',
    formula: 'P',
    icon: 'checkmark-circle-outline',
    structTag: '链状巨分子 · 长链',
    structText:
      '白磷中一个 P—P 键断开后，无数 P₄ 单元首尾相接，连成无限长的锯齿链：每个磷仍与 3 个磷相连，但键角回到接近 100° 的正常值，张力消失。',
    forceText: '链内 P—P 共价键（键角正常、张力小），链间范德华力',
    canvasHint: '一条长链来回折 —— 60° 的张力键没有了，它也就不再自燃',
    props: [
      {
        label: '着火点',
        value: '240 ℃（不会自燃）',
        icon: 'flame-outline',
        tone: 'up',
        note: '张力键没了，要加热到 240 ℃ 才着火，可以安心涂在火柴盒侧面',
      },
      {
        label: '毒性',
        value: '基本无毒',
        icon: 'shield-checkmark-outline',
        tone: 'up',
        note: '红磷毒性很小，这正是“安全火柴”选它的原因',
      },
      {
        label: '溶解性',
        value: '不溶于水，也不溶于 CS₂',
        icon: 'water-outline',
        tone: 'mid',
        note: '巨分子链没法被溶剂单独“抱走”，不像白磷那样可溶',
      },
      {
        label: '用途',
        value: '安全火柴、农药、阻燃剂',
        icon: 'beaker-outline',
        tone: 'mid',
        note: '摩擦生热时红磷先变白磷再燃烧，火柴就点着了',
      },
    ],
    why: '把容易断的 60° 张力键拉开成正常角度的长链：着火点从 40 ℃ 跳到 240 ℃，毒性也基本消失 —— 结构上的“松开”，换来使用上的安全。',
    legend: [
      { kind: 'atom', text: '橙球 = 磷原子 P' },
      { kind: 'solid', text: '实线 = 链内 P—P 键（锯齿链，键角约 100°）' },
    ],
  },

  /* ---------- 硫 ---------- */
  {
    id: 'rhombicS',
    group: 'S',
    name: '斜方硫',
    formula: 'S₈',
    icon: 'cube-outline',
    structTag: 'S₈ 环状分子 · 正交堆积',
    structText:
      '8 个硫原子首尾相连成一个“皇冠”状的 S₈ 环（S—S 键长 206 pm，键角约 108°），环再按正交（斜方）晶系整齐地堆成晶体。95.6 ℃ 以下它是硫的稳定形态，天然硫磺、升华硫都是它。',
    forceText: '环内 S—S 共价键，环与环之间范德华力',
    canvasHint: '一个皇冠状的八元环 —— 转一圈看它上下交替的“褶边”',
    props: [
      {
        label: '外观',
        value: '黄色晶体',
        icon: 'color-wand-outline',
        tone: 'mid',
        note: '俗称硫磺，质脆，容易研成粉末',
      },
      {
        label: '稳定温度',
        value: '95.6 ℃ 以下稳定',
        icon: 'thermometer-outline',
        tone: 'up',
        note: '室温下所有其它形态的硫都会慢慢变回斜方硫',
      },
      {
        label: '溶解性',
        value: '不溶于水，溶于 CS₂',
        icon: 'water-outline',
        tone: 'mid',
        note: 'S₈ 是非极性分子，所以只肯进 CS₂ 这类非极性溶剂',
      },
      {
        label: '用途',
        value: '制硫酸、橡胶硫化、农药',
        icon: 'beaker-outline',
        tone: 'mid',
        note: '硫是“工业之母”硫酸的原料，也是橡胶硫化的交联剂',
      },
    ],
    why: '单元是闭合的 S₈ 环，环内是共价键、环间只有范德华力 → 分子晶体：质脆、熔点不高（115 ℃）、易溶于 CS₂。',
    legend: [
      { kind: 'atom', text: '黄球 = 硫原子 S' },
      { kind: 'solid', text: '实线 = 环内 S—S 键（八元环）' },
    ],
  },
  {
    id: 'monoclinicS',
    group: 'S',
    name: '单斜硫',
    formula: 'S₈',
    icon: 'shapes-outline',
    structTag: 'S₈ 环状分子 · 单斜堆积',
    structText:
      '基本单元同样是 S₈ 环，环本身没变，只是环在晶体里换了一种更“松”的排列方式（单斜晶系），96 ℃ 以上稳定；把它冷却到 95.6 ℃ 以下，又会慢慢变回斜方硫。',
    forceText: '环内 S—S 共价键，环间范德华力（堆积方式不同 → 晶格能略有差别）',
    canvasHint: '两个一样的环，摆法不同 —— 环间虚线就是把它们堆在一起的范德华力',
    props: [
      {
        label: '外观',
        value: '浅黄色针状晶体',
        icon: 'color-wand-outline',
        tone: 'mid',
        note: '把熔融硫慢慢冷却，就能长出针状的单斜硫晶体',
      },
      {
        label: '稳定温度',
        value: '95.6 ℃ 以上稳定',
        icon: 'thermometer-outline',
        tone: 'up',
        note: '与斜方硫的转变温度正好是 95.6 ℃，是教材里的经典例子',
      },
      {
        label: '溶解性',
        value: '同样溶于 CS₂',
        icon: 'water-outline',
        tone: 'mid',
        note: '分子单元一样，所以化学性质、溶解性几乎没差别',
      },
      {
        label: '用途',
        value: '同素异形转变的范例',
        icon: 'beaker-outline',
        tone: 'mid',
        note: '加热变单斜、冷却变斜方，说明“同素异形”可以在同一物质间来回',
      },
    ],
    why: '两者的分子式都是 S₈、化学性质几乎一样，变的只是环在晶体中的堆放方式 —— 说明“同素异形”改的不一定是分子式，而是原子（分子）的排列方式。',
    legend: [
      { kind: 'atom', text: '黄球 = 硫原子 S' },
      { kind: 'solid', text: '实线 = 环内 S—S 键' },
      { kind: 'dash', text: '虚线 = 环间范德华力（堆积方式不同）' },
    ],
  },

  /* ---------- 硅 ---------- */
  {
    id: 'crystalSi',
    group: 'Si',
    name: '晶体硅',
    formula: 'Si',
    icon: 'grid-outline',
    structTag: '空间网状 · 类金刚石结构',
    structText:
      '每个硅原子与周围 4 个硅形成正四面体的共价键网（Si—Si 键长 235 pm），结构与金刚石同型；但硅原子比碳大，键更长、更弱，所以硬度与熔点都低于金刚石。',
    forceText: '全是 Si—Si 共价键，整块晶体是一个巨大的共价网络',
    canvasHint: '和金刚石同型的正四面体网 —— 但键更长，性质就“软”了一档',
    props: [
      {
        label: '硬度',
        value: '硬而脆（莫氏 7）',
        icon: 'bonfire-outline',
        tone: 'mid',
        note: '比金刚石低得多：Si—Si 键比 C—C 键长、键能小',
      },
      {
        label: '导电性',
        value: '半导体',
        icon: 'flash-outline',
        tone: 'up',
        note: '导电性介于导体与绝缘体之间，升温或掺杂后大增 —— 芯片的物理基础',
      },
      {
        label: '熔点',
        value: '高（1410 ℃）',
        icon: 'thermometer-outline',
        tone: 'up',
        note: '仍是共价晶体，熔化要打断大量 Si—Si 键',
      },
      {
        label: '用途',
        value: '芯片、太阳能电池',
        icon: 'hardware-chip-outline',
        tone: 'mid',
        note: '高纯单晶硅是半导体工业的“地基”',
      },
    ],
    why: '和金刚石同一套正四面体网，只是把 C—C 换成更长更弱的 Si—Si → 硬度、熔点都降一档，而适中的键强恰好让电子“半自由”，成就了半导体。',
    legend: [
      { kind: 'atom', text: '黄褐球 = 硅原子 Si' },
      { kind: 'solid', text: '实线 = Si—Si 共价键（正四面体）' },
    ],
  },
  {
    id: 'amorphousSi',
    group: 'Si',
    name: '无定形硅',
    formula: 'Si',
    icon: 'shapes-outline',
    structTag: '短程有序 · 长程无序',
    structText:
      '硅原子大体上仍是 4 配位、四面体取向（短程有序），但键长、键角不再规则，网络扭曲打结，找不到可以无限重复的晶格（长程无序），因此没有固定的熔点。',
    forceText: 'Si—Si 共价键（键长键角都不规则），整体是无定形固体',
    canvasHint: '键还是 4 条，但整个网歪歪扭扭 —— 没有可以重复的晶格',
    props: [
      {
        label: '硬度',
        value: '棕黑色粉末，松脆',
        icon: 'bonfire-outline',
        tone: 'down',
        note: '没有连续的三维骨架，整块材料的强度远不如晶体硅',
      },
      {
        label: '导电性',
        value: '导电性差',
        icon: 'flash-off-outline',
        tone: 'down',
        note: '大量“悬挂键”和缺陷把载流子困住，导电性远差于晶体硅',
      },
      {
        label: '熔点',
        value: '没有固定熔点',
        icon: 'thermometer-outline',
        tone: 'down',
        note: '无定形固体的标志：加热时逐渐软化，而不是在某一温度突然熔化',
      },
      {
        label: '用途',
        value: '薄膜太阳能电池、感光材料',
        icon: 'hardware-chip-outline',
        tone: 'mid',
        note: '便宜、可大面积镀膜，是薄膜电池的主力材料',
      },
    ],
    why: '同样是 4 配位的硅：排得整整齐齐就有固定熔点、能做半导体；排得乱七八糟就没有熔点、导电也差 —— 排列的整齐程度本身就是性质。',
    legend: [
      { kind: 'atom', text: '黄褐球 = 硅原子 Si' },
      { kind: 'solid', text: '实线 = Si—Si 键（键长键角都不规则）' },
    ],
  },
];

export function allotropeById(id: AllotropeId): AllotropeEntry {
  return ALLOTROPES.find((a) => a.id === id) ?? ALLOTROPES[0];
}

/** 某一组的所有单质（按组内顺序） */
export function allotropesOfGroup(g: AllotropeGroupId): AllotropeEntry[] {
  const ids = groupById(g).ids;
  return ids.map(allotropeById);
}

/** 组内横向对比（表格）：label + 各项取值（只覆盖该组内单质） */
export interface CompareRow {
  label: string;
  values: Partial<Record<AllotropeId, string>>;
}

export const COMPARE_ROWS: Record<AllotropeGroupId, CompareRow[]> = {
  C: [
    {
      label: '结构型式',
      values: { diamond: '正四面体空间网状', graphite: '六元环层状', c60: '足球状分子' },
    },
    {
      label: '基本微粒',
      values: { diamond: '原子（整块晶体）', graphite: '原子（层）', c60: 'C₆₀ 分子' },
    },
    {
      label: '微粒间作用',
      values: {
        diamond: '全是共价键',
        graphite: '层内共价键 + 层间范德华力',
        c60: '分子内共价键 + 分子间范德华力',
      },
    },
    { label: '硬度', values: { diamond: '最硬', graphite: '很软、滑', c60: '质脆' } },
    { label: '导电性', values: { diamond: '不导电', graphite: '导电', c60: '不导电' } },
    {
      label: '熔点',
      values: { diamond: '极高 >3550 ℃', graphite: '极高 3652 ℃', c60: '较低，易升华' },
    },
    { label: '溶解性', values: { diamond: '不溶', graphite: '不溶', c60: '可溶于苯' } },
    {
      label: '典型用途',
      values: { diamond: '切割、钻头', graphite: '电极、润滑', c60: '超导、新材料' },
    },
  ],
  O: [
    { label: '分子式', values: { o2: 'O₂（双原子）', o3: 'O₃（三原子）' } },
    {
      label: '空间构型',
      values: { o2: '直线形（必然共线）', o3: 'V 形，键角约 117°' },
    },
    { label: '键的情况', values: { o2: 'O=O 双键，键能大', o3: '含离域 π 键，O—O 较弱' } },
    { label: '色、味', values: { o2: '无色无味气体', o3: '淡蓝色、鱼腥味' } },
    { label: '氧化性', values: { o2: '较强，需点燃', o3: '极强，常温即可' } },
    { label: '稳定性', values: { o2: '稳定，可长期存放', o3: '不稳定，易变回 O₂' } },
    { label: '沸点', values: { o2: '−183 ℃', o3: '−112 ℃' } },
    {
      label: '典型用途',
      values: { o2: '供氧、助燃、炼钢', o3: '消毒漂白、臭氧层' },
    },
  ],
  P: [
    { label: '组成', values: { whiteP: 'P₄ 分子', redP: '巨分子长链（P）' } },
    { label: '结构特点', values: { whiteP: '正四面体，键角 60°', redP: '锯齿链，键角约 100°' } },
    { label: '键的张力', values: { whiteP: '张力大，极易断裂', redP: '张力小，键较稳' } },
    { label: '着火点', values: { whiteP: '40 ℃（自燃）', redP: '240 ℃' } },
    { label: '毒性', values: { whiteP: '剧毒', redP: '基本无毒' } },
    { label: '溶解性', values: { whiteP: '溶于 CS₂', redP: '不溶于 CS₂' } },
    { label: '保存方法', values: { whiteP: '冷水中、隔绝空气', redP: '密封保存即可' } },
    { label: '典型用途', values: { whiteP: '制磷酸、燃烧弹', redP: '安全火柴、农药' } },
  ],
  S: [
    { label: '分子组成', values: { rhombicS: 'S₈ 环', monoclinicS: 'S₈ 环（相同）' } },
    { label: '晶系', values: { rhombicS: '正交（斜方）', monoclinicS: '单斜' } },
    { label: '外观', values: { rhombicS: '黄色晶体', monoclinicS: '浅黄色针状' } },
    { label: '稳定温度', values: { rhombicS: '< 95.6 ℃', monoclinicS: '> 95.6 ℃' } },
    { label: '溶解性', values: { rhombicS: '溶于 CS₂', monoclinicS: '溶于 CS₂' } },
    {
      label: '相互转化',
      values: { rhombicS: '加热到 96 ℃ 变单斜', monoclinicS: '冷却后变回斜方' },
    },
    { label: '典型用途', values: { rhombicS: '制硫酸、橡胶硫化', monoclinicS: '转变实验范例' } },
  ],
  Si: [
    { label: '结构型式', values: { crystalSi: '正四面体网状（类金刚石）', amorphousSi: '短程有序、长程无序' } },
    { label: '基本微粒', values: { crystalSi: '原子', amorphousSi: '原子' } },
    { label: '键长键角', values: { crystalSi: '规则 235 pm', amorphousSi: '不规则、网络扭曲' } },
    { label: '硬度', values: { crystalSi: '硬而脆（莫氏 7）', amorphousSi: '松脆粉末' } },
    { label: '导电性', values: { crystalSi: '半导体', amorphousSi: '差' } },
    { label: '熔点', values: { crystalSi: '1410 ℃', amorphousSi: '无固定熔点' } },
    { label: '典型用途', values: { crystalSi: '芯片、太阳能电池', amorphousSi: '薄膜电池、感光鼓' } },
  ],
};

/* ==================== 二、结构几何生成 ==================== */

interface Frame {
  atoms: MolAtom[];
  bonds: Bond[];
}

/** 把原子云平移到质心，避免团簇偏心 */
function centerFrame(atoms: MolAtom[]): MolAtom[] {
  const n = atoms.length || 1;
  const cx = atoms.reduce((s, a) => s + a.pos[0], 0) / n;
  const cy = atoms.reduce((s, a) => s + a.pos[1], 0) / n;
  const cz = atoms.reduce((s, a) => s + a.pos[2], 0) / n;
  return atoms.map((a) => ({
    ...a,
    pos: [a.pos[0] - cx, a.pos[1] - cy, a.pos[2] - cz] as [number, number, number],
  }));
}

/** 距离成键：距离落在 bond ± tol 内视为一根键 */
function bondsByDistance(atoms: MolAtom[], bond: number, tol: number): Bond[] {
  const bonds: Bond[] = [];
  for (let i = 0; i < atoms.length; i++) {
    for (let j = i + 1; j < atoms.length; j++) {
      const A = atoms[i].pos;
      const B = atoms[j].pos;
      const dd = Math.hypot(A[0] - B[0], A[1] - B[1], A[2] - B[2]);
      if (Math.abs(dd - bond) < tol) bonds.push({ a: i, b: j, order: 1 });
    }
  }
  return bonds;
}

/* ----- 碳：现有三种 ----- */

const C_CC_DIAMOND = 1.54; // 金刚石 C—C（示意）
const C_CC_GRAPHITE = 1.42; // 石墨层内 C—C
const C_LAYER_GAP = 3.35; // 石墨层间距
const C60_BOND = 1.42; // C₆₀ 键长（示意，实际有 139 / 145 pm 两种）

/**
 * 金刚石型网络（金刚石 / 晶体硅共用）。
 * jitter > 0 时把每个原子的位置在半径 jitter 的球内随机挪动，得到“无定形”网络：
 * 拓扑（谁和谁成键）保持 4 配位不变，只是键长键角不再规则。
 */
function buildDiamondNetwork(el: string, bond: number, jitter = 0): Frame {
  const d = bond;
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
  // 裁剪半径跟着键长缩放，保证不同元素的团簇看起来一样大、原子数相当
  const cut = 4.0 * (d / C_CC_DIAMOND);
  const pos = raw.filter((p) => Math.hypot(p[0] - cx, p[1] - cy, p[2] - cz) <= cut);
  let atoms: MolAtom[] = pos.map((p) => ({ el, pos: [p[0] - cx, p[1] - cy, p[2] - cz] as [number, number, number] }));
  // 先按规则结构判键（拓扑保持 4 配位），再扰动位置：这样“无定形”只乱几何、不乱连接
  const bonds = bondsByDistance(atoms, d, d * 0.1);
  if (jitter > 0) {
    let seed = 987654321;
    const rnd = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };
    atoms = atoms.map((at) => {
      // 球内均匀取点，位移模长不超过 jitter（两个原子相对位移最多 2×jitter，键长不会失真太多）
      const ux = rnd() * 2 - 1;
      const uy = rnd() * 2 - 1;
      const uz = rnd() * 2 - 1;
      const len = Math.hypot(ux, uy, uz) || 1;
      const r = jitter * Math.cbrt(rnd());
      return {
        el: at.el,
        pos: [
          at.pos[0] + (ux / len) * r,
          at.pos[1] + (uy / len) * r,
          at.pos[2] + (uz / len) * r,
        ] as [number, number, number],
      };
    });
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
  const bonds = bondsByDistance(atoms, C60_BOND, 0.15);
  return { atoms, bonds };
}

/* ----- 氧 ----- */

/** O₂：双原子分子，O=O 双键 */
function buildO2(): Frame {
  const d = 1.21; // O=O 键长 121 pm
  return {
    atoms: [
      { el: 'O', pos: [-d / 2, 0, 0] },
      { el: 'O', pos: [d / 2, 0, 0] },
    ],
    bonds: [{ a: 0, b: 1, order: 2 }],
  };
}

/** O₃：V 形（角形）分子，键角约 116.8° */
function buildO3(): Frame {
  const d = 1.278; // O—O 键长 128 pm
  const theta = (116.8 * Math.PI) / 180;
  const atoms: MolAtom[] = [
    { el: 'O', pos: [0, 0, 0] },
    { el: 'O', pos: [d, 0, 0] },
    { el: 'O', pos: [d * Math.cos(theta), d * Math.sin(theta), 0] },
  ];
  const bonds: Bond[] = [
    { a: 0, b: 1, order: 1 },
    { a: 0, b: 2, order: 1 },
  ];
  return { atoms: centerFrame(atoms), bonds };
}

/* ----- 磷 ----- */

/** 白磷 P₄：正四面体，6 条棱即 6 个 P—P 键，键角 60° */
function buildWhiteP(): Frame {
  const bond = 2.21; // P—P 键长 221 pm
  const s = bond / (2 * Math.SQRT2); // 正四面体顶点 (±1,±1,±1) 的棱长 = 2√2·s
  const verts: [number, number, number][] = [
    [1, 1, 1],
    [1, -1, -1],
    [-1, 1, -1],
    [-1, -1, 1],
  ];
  const atoms: MolAtom[] = verts.map((v) => ({
    el: 'P',
    pos: [v[0] * s, v[1] * s, v[2] * s] as [number, number, number],
  }));
  const bonds: Bond[] = [];
  for (let i = 0; i < 4; i++) {
    for (let j = i + 1; j < 4; j++) bonds.push({ a: i, b: j, order: 1 });
  }
  return { atoms, bonds };
}

/** 红磷：锯齿长链（P₄ 中一根张力键断开后首尾相接），键角约 100° */
function buildRedP(): Frame {
  const bond = 2.25; // 链内 P—P
  const n = 12;
  const turn = ((180 - 100) / 2) * (Math.PI / 180); // 每步左右各转 40° → 键角 100°
  const atoms: MolAtom[] = [];
  let x = 0;
  let z = 0;
  for (let i = 0; i < n; i++) {
    if (i > 0) {
      const dir = i % 2 === 1 ? turn : -turn;
      x += bond * Math.cos(dir);
      z += bond * Math.sin(dir);
    }
    // 轻微的高度起伏，让链看起来是扭曲的而不是压平的
    const y = 0.22 * Math.sin(i * 0.9);
    atoms.push({ el: 'P', pos: [x, y, z] });
  }
  const bonds: Bond[] = [];
  for (let i = 0; i < n - 1; i++) bonds.push({ a: i, b: i + 1, order: 1 });
  return { atoms: centerFrame(atoms), bonds };
}

/* ----- 硫 ----- */

/**
 * S₈ “皇冠”环：8 个硫水平均分 45°、上下交替错开。
 * R/h 由“键长 + 键角 108°”解出（R/bond ≈ 1.144，h/bond ≈ 0.241）。
 */
function s8RingPoints(bond: number): [number, number, number][] {
  const R = 1.1442 * bond;
  const h = 0.2415 * bond;
  const pts: [number, number, number][] = [];
  for (let k = 0; k < 8; k++) {
    const t = (Math.PI / 4) * k;
    pts.push([R * Math.cos(t), k % 2 === 0 ? h : -h, R * Math.sin(t)]);
  }
  return pts;
}

/** 斜方硫：单个 S₈ 皇冠环（正交堆积的分子单元） */
function buildRhombicS(): Frame {
  const bond = 2.06; // S—S 键长 206 pm
  const pts = s8RingPoints(bond);
  const atoms: MolAtom[] = pts.map((p) => ({ el: 'S', pos: p }));
  const bonds: Bond[] = [];
  for (let i = 0; i < 8; i++) bonds.push({ a: i, b: (i + 1) % 8, order: 1 });
  return { atoms, bonds };
}

/** 单斜硫：同样是 S₈ 环，展示两个环换了堆积取向（虚线 = 环间范德华力） */
function buildMonoclinicS(): Frame {
  const bond = 2.06;
  const ring = s8RingPoints(bond);
  const rot = (28 * Math.PI) / 180; // 第二个环绕 y 轴转一个角度，示意“另一种堆法”
  const dy = -3.4; // 两环间距（示意）
  const atoms: MolAtom[] = [];
  ring.forEach((p) => atoms.push({ el: 'S', pos: [p[0], p[1], p[2]] }));
  ring.forEach((p) => {
    const x = p[0] * Math.cos(rot) + p[2] * Math.sin(rot);
    const z = -p[0] * Math.sin(rot) + p[2] * Math.cos(rot);
    atoms.push({ el: 'S', pos: [x, p[1] + dy, z] });
  });
  const bonds: Bond[] = [];
  for (let i = 0; i < 8; i++) bonds.push({ a: i, b: (i + 1) % 8, order: 1 });
  for (let i = 8; i < 16; i++) bonds.push({ a: i, b: 8 + ((i - 8 + 1) % 8), order: 1 });
  // 环间范德华力：只连几条，说明两环之间没有化学键
  [0, 2, 4, 6].forEach((i) => bonds.push({ a: i, b: i + 8, order: 1, style: 'vdw' }));
  return { atoms: centerFrame(atoms), bonds };
}

/* ----- 硅 ----- */

const SI_SI = 2.35; // Si—Si 键长 235 pm

function asMol(entry: AllotropeEntry, frame: Frame): MoleculeData {
  return {
    id: `allotrope-${entry.id}`,
    name: entry.name,
    formula: entry.formula,
    category: '同素异形体',
    level: '必修',
    scene: 'molecule',
    desc: `${entry.name}：${entry.structTag}`,
    atoms: frame.atoms,
    bonds: frame.bonds,
    // 原子多的结构（晶体团簇 / 足球分子）不逐个标元素符号，否则会糊住结构
    noLabels: frame.atoms.length > 20,
  };
}

function frameOf(id: AllotropeId): Frame {
  switch (id) {
    case 'diamond':
      return buildDiamondNetwork('C', C_CC_DIAMOND);
    case 'graphite':
      return buildGraphite();
    case 'c60':
      return buildC60();
    case 'o2':
      return buildO2();
    case 'o3':
      return buildO3();
    case 'whiteP':
      return buildWhiteP();
    case 'redP':
      return buildRedP();
    case 'rhombicS':
      return buildRhombicS();
    case 'monoclinicS':
      return buildMonoclinicS();
    case 'crystalSi':
      return buildDiamondNetwork('Si', SI_SI);
    case 'amorphousSi':
      return buildDiamondNetwork('Si', SI_SI, 0.3);
    default:
      return buildDiamondNetwork('C', C_CC_DIAMOND);
  }
}

export const ALLOTROPE_MOL: Record<AllotropeId, MoleculeData> = ALLOTROPES.reduce(
  (acc, e) => {
    acc[e.id] = asMol(e, frameOf(e.id));
    return acc;
  },
  {} as Record<AllotropeId, MoleculeData>
);

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
    example: '¹H / ²H(D) / ³H(T)；¹²C / ¹³C / ¹⁴C；¹⁶O / ¹⁸O',
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
    example: '金刚石 / 石墨 / C₆₀；O₂ / O₃；白磷 / 红磷；斜方硫 / 单斜硫；晶体硅 / 无定形硅',
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
    example: '正丁烷 / 异丁烷；乙醇 / 二甲醚；葡萄糖 / 果糖；环丙烷 / 丙烯',
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
    example: 'CH₄ / C₂H₆ / C₃H₈；CH₂=CH₂ 与 CH₃CH=CH₂；CH₃OH 与 C₂H₅OH',
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
  {
    id: 'q13',
    example: '斜方硫 与 单斜硫',
    ask: '这两者的关系是',
    answer: 'allotrope',
    explain: '都是硫的单质，分子单元也同为 S₈ 环，只是晶体里环的堆放方式不同（转变温度 95.6 ℃），是同素异形体。',
    trap: '分子式相同（都是 S₈）不等于同一种物质：晶系不同、性质有别，仍是同素异形体。',
  },
  {
    id: 'q14',
    example: '晶体硅 与 无定形硅',
    ask: '这两者的关系是',
    answer: 'allotrope',
    explain: '都是硅元素的单质：一个排列规则有固定熔点，一个长程无序没有固定熔点 —— 同素异形体。',
  },
  {
    id: 'q15',
    example: '¹⁶O 与 ¹⁸O',
    ask: '这两者的关系是',
    answer: 'isotope',
    explain: '质子数都是 8，中子数 8 与 10，属于氧元素的两种同位素。',
    trap: '同位素讲的是原子，不是单质：O₂ 与 O₃ 才是同素异形体。',
  },
  {
    id: 'q16',
    example: '环丙烷（△）与 丙烯 CH₃CH=CH₂',
    ask: '这两者的关系是',
    answer: 'isomer',
    explain: '分子式都是 C₃H₆，一个成环、一个含碳碳双键，属于同分异构体。',
  },
  {
    id: 'q17',
    example: '甲醇 CH₃OH 与 乙醇 C₂H₅OH',
    ask: '这两者的关系是',
    answer: 'homolog',
    explain: '都含一个 —OH、同属饱和一元醇，相差 1 个 CH₂，属于同系物。',
  },
];
