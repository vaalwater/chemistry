/**
 * 立体几何模块内容库：形状、定理（含反例与判定树）、空间角变式题、体积推导剧场。
 * 3D 表现由 geometryHtml 引擎负责，这里只放“讲什么、怎么讲、答案是什么”。
 */

/* ---------------- 痛点一：3D 实体 ↔ 2D 直观图 ---------------- */

export type ShapeId = 'cube' | 'tetra' | 'prism3' | 'pyramid4' | 'frustum' | 'cylinder' | 'cone';

export const SHAPES: { id: ShapeId; name: string; formula: string; net: string }[] = [
  {
    id: 'cube',
    name: '正方体',
    formula: 'S = 6a²',
    net: '6 个全等的正方形，展开成“十字”或“一四一”型',
  },
  {
    id: 'tetra',
    name: '正四面体',
    formula: 'S = 4 × ½·a·(√3/2)a = √3a²',
    net: '4 个全等的正三角形',
  },
  {
    id: 'prism3',
    name: '直三棱柱',
    formula: 'S = 2S底 + 3 × (底边 × 高)',
    net: '2 个全等的三角形 + 3 个矩形（侧面积 = 底面周长 × 高）',
  },
  {
    id: 'pyramid4',
    name: '正四棱锥',
    formula: 'S = a² + 4 × ½·a·h斜',
    net: '1 个正方形 + 4 个全等的等腰三角形',
  },
  {
    id: 'frustum',
    name: '正四棱台',
    formula: 'S = S上 + S下 + 4 × ½(上底+下底)·h斜',
    net: '2 个正方形（大小不同）+ 4 个全等的等腰梯形',
  },
  {
    id: 'cylinder',
    name: '圆柱',
    formula: 'S = 2πr² + 2πrh',
    net: '1 个矩形（长 = 底面周长 2πr，宽 = 高）+ 2 个全等的圆',
  },
  {
    id: 'cone',
    name: '圆锥',
    formula: 'S = πr² + πrl（l 为母线）',
    net: '1 个扇形（半径 = 母线 l，弧长 = 底面周长 2πr）+ 1 个圆',
  },
];

export const PROJ_MODES: { id: 'oblique' | 'isometric'; name: string; desc: string }[] = [
  { id: 'oblique', name: '斜二测', desc: '教材里的直观图：正面不变形，深度方向取一半、画成 45°' },
  { id: 'isometric', name: '正等测', desc: '三个方向都按同样比例缩短，立体感更强但角度不真实' },
];

/* ---------------- 痛点二：定理实验室 ---------------- */

export type TheoremId =
  | 'thm:lpParallel'
  | 'thm:lpParallelProp'
  | 'thm:linePlanePerp'
  | 'thm:ppParallel'
  | 'thm:ppPerp';

export interface Theorem {
  id: TheoremId;
  name: string;
  kind: '判定' | '性质';
  statement: string;
  /** 四步演示的讲解文案 */
  steps: string[];
  /** 反例开关打开时的说明 */
  counterTitle: string;
  counterDesc: string;
}

export const THEOREMS: Theorem[] = [
  {
    id: 'thm:lpParallel',
    name: '线面平行判定',
    kind: '判定',
    statement: '平面外一条直线与此平面内的一条直线平行，则该直线与此平面平行。',
    steps: [
      '看清条件：直线 a 在平面 α 外，直线 b 在平面 α 内。',
      '在 α 内找出与 a 平行的那条直线 b（橙色高亮）——这是判定的“桥梁”。',
      '把 a 平行移动到 α 内，它与 b 完全重合：a 上每一点都不在 α 上，说明 a 与 α 没有公共点。',
      '结论：a ∥ α。记住三要素：a 在平面外、b 在平面内、a ∥ b，缺一不可。',
    ],
    counterTitle: '反例：a 在平面 α 内',
    counterDesc:
      '把 a 挪进 α 里，它仍然与 b 平行，但此时 a 上所有点都在 α 内 —— 这叫“直线在平面内”，不是平行。判定定理的第一个条件“平面外”不能省。',
  },
  {
    id: 'thm:lpParallelProp',
    name: '线面平行性质',
    kind: '性质',
    statement: '一条直线与一个平面平行，则过这条直线的任一平面与原平面的交线与该直线平行。',
    steps: [
      '看清条件：a ∥ α，且 a 在平面 β 内。',
      '找到 β 与 α 的交线 l（橙色）——性质定理永远从“交线”入手。',
      'a 与 l 同在 β 内，又都不可能与对方相交（a 与 α 无公共点，l 在 α 内），所以只能平行。',
      '结论：a ∥ l。这条性质常用来“由面面平行推出线线平行”。',
    ],
    counterTitle: '反例：β ∥ α（没有交线）',
    counterDesc:
      '把 β 抬到与 α 平行的位置，两平面没有交线 l，性质定理的前提“α ∩ β = l”不成立 —— 此时虽然 a ∥ α 依然为真，却无法推出任何线线平行。',
  },
  {
    id: 'thm:linePlanePerp',
    name: '线面垂直判定',
    kind: '判定',
    statement: '一条直线与一个平面内的两条相交直线都垂直，则该直线与此平面垂直。',
    steps: [
      '看清条件：直线 l 与平面 α 交于 O，α 内有直线 m、n 经过 O。',
      '先证 l ⊥ m：直角符号标出 90°（橙色高亮 m）。',
      '再证 l ⊥ n：两条都垂直还不够，关键在“相交” —— m ∩ n = O，两条相交直线确定一个平面方向。',
      '结论：l ⊥ α。若只垂直一条，l 还能绕着它转，不能判定垂直。',
    ],
    counterTitle: '反例：m ∥ n（不相交）',
    counterDesc:
      '把 n 平移开，使 m ∥ n。此时 l 同时垂直 m 和 n，却仍然可以是“斜着穿过 α”的 —— 两条平行直线等价于一条，约束不住一个平面。所以定理要求“两条相交直线”。',
  },
  {
    id: 'thm:ppParallel',
    name: '面面平行判定',
    kind: '判定',
    statement: '一个平面内的两条相交直线都平行于另一个平面，则这两个平面平行。',
    steps: [
      '看清条件：平面 β 内有两条相交直线 m、n。',
      '在 α 内作出与 m 平行的直线 m′（橙色）——只要能作出，就说明 m ∥ α。',
      '同理作出 n′ ∥ n。此时 α 内有两条相交直线分别与 m、n 平行。',
      '结论：β ∥ α。本质上是把“面面平行”化成两次“线面平行”，且必须是两条相交直线。',
    ],
    counterTitle: '反例：m ∥ n（不相交）',
    counterDesc:
      '把 β 内的 n 平移成与 m 平行。两条平行直线都平行于 α 时，β 仍然可以绕着它们转动并与 α 相交 —— 少了“相交”这个条件，判定失效。',
  },
  {
    id: 'thm:ppPerp',
    name: '面面垂直判定',
    kind: '判定',
    statement: '一个平面经过另一个平面的一条垂线，则这两个平面互相垂直。',
    steps: [
      '看清条件：直线 l 垂直于平面 α（直角符号）。',
      '平面 β 经过这条直线 l。',
      '因为 l ⊂ β 且 l ⊥ α，β 相当于“立”在 α 上，两个平面的二面角是直角。',
      '结论：β ⊥ α。用法：要证面面垂直，就去找一条“线面垂直”。',
    ],
    counterTitle: '反例：经过的是斜线',
    counterDesc:
      '把 l 改成斜线（不垂直 α）。此时 β 虽然仍经过 l，但它是“斜靠”在 α 上的，二面角不是 90° —— 所以必须先证线面垂直，才能推出面面垂直。',
  },
];

/** 判定树：学生不确定用哪条定理时，用提问把他引到正确的那条 */
export type TreeNode =
  | { id: string; q: string; options: { label: string; next: string }[] }
  | { id: string; answer: TheoremId; tip: string };

export const DECISION_TREE: Record<string, TreeNode> = {
  root: {
    id: 'root',
    q: '你要证明的是哪一类关系？',
    options: [
      { label: '线 ∥ 面', next: 'lp' },
      { label: '线 ⊥ 面', next: 'lperp' },
      { label: '面 ∥ 面', next: 'pp' },
      { label: '面 ⊥ 面', next: 'pperp' },
    ],
  },
  lp: {
    id: 'lp',
    q: '已知条件里能找到一条与它平行的直线吗？',
    options: [
      { label: '能，而且这条线在平面内', next: 'a-yes' },
      { label: '不能，但它在一个与已知平面相交的平面内', next: 'a-no' },
      { label: '都没有', next: 'a-none' },
    ],
  },
  'a-yes': { id: 'a-yes', answer: 'thm:lpParallel', tip: '三要素齐了：平面外、平面内、两线平行 —— 直接用判定定理。' },
  'a-no': { id: 'a-no', answer: 'thm:lpParallelProp', tip: '这题是“已知平行求线线平行”，走性质定理：先找交线。' },
  'a-none': {
    id: 'a-none',
    q: '那试着构造：能不能在平面内作出一条与已知直线平行的线（比如用中位线、平行四边形）？',
    options: [
      { label: '能作出来', next: 'a-yes' },
      { label: '作不出来', next: 'a-stuck' },
    ],
  },
  'a-stuck': { id: 'a-stuck', answer: 'thm:lpParallel', tip: '多数考题的套路就是“造平行线”：找中点、连中位线，或补一个平行四边形。' },
  lperp: {
    id: 'lperp',
    q: '这条直线垂直于平面内的几条直线？',
    options: [
      { label: '两条相交的', next: 'perp-2' },
      { label: '只找到一条', next: 'perp-1' },
    ],
  },
  'perp-2': { id: 'perp-2', answer: 'thm:linePlanePerp', tip: '两条相交直线 + 都垂直 → 线面垂直，直接用。' },
  'perp-1': {
    id: 'perp-1',
    q: '那这条直线还垂直于平面内另一条与它相交的直线吗？',
    options: [
      { label: '还垂直第二条', next: 'perp-2' },
      { label: '找不到第二条', next: 'perp-stuck' },
    ],
  },
  'perp-stuck': { id: 'perp-stuck', answer: 'thm:linePlanePerp', tip: '一条不够。常见补法：连对角线、找等腰三角形底边中线、或利用矩形邻边。' },
  pp: {
    id: 'pp',
    q: '其中一个平面内有两条相交直线平行于另一个平面吗？',
    options: [
      { label: '有两条相交的', next: 'pp-yes' },
      { label: '只有一条 / 两条平行', next: 'pp-no' },
    ],
  },
  'pp-yes': { id: 'pp-yes', answer: 'thm:ppParallel', tip: '把面面平行化成两次线面平行，注意必须是“相交”的两条。' },
  'pp-no': { id: 'pp-no', answer: 'thm:ppParallel', tip: '条件不够：只有一条或两条平行都不行，再找一条与它相交的直线。' },
  pperp: {
    id: 'pperp',
    q: '其中一个平面经过另一个平面的一条垂线吗？',
    options: [
      { label: '经过一条垂线', next: 'pperp-yes' },
      { label: '只经过一条斜线', next: 'pperp-no' },
    ],
  },
  'pperp-yes': { id: 'pperp-yes', answer: 'thm:ppPerp', tip: '先证线面垂直，再用面面垂直判定 —— 这是最常见的一条链。' },
  'pperp-no': { id: 'pperp-no', answer: 'thm:ppPerp', tip: '斜线不行。要证面面垂直，必须先找出（或作出）一条垂直于另一个平面的直线。' },
};

/* ---------------- 痛点三：空间角三步定位器 ---------------- */

export type AngleType = 'skew' | 'linePlane' | 'dihedral';

export interface AngleVariant {
  id: string;
  title: string;
  given: string;
  /** 正确答案（角度数） */
  answer: number;
  hint: string;
  /** “找”这一步的辅助线候选（可拖拽辅助线的简化版：选中后 App 判定是否合理） */
  aux: { id: string; label: string; correct: boolean; feedback: string }[];
  solution: string;
}

export interface AngleKind {
  id: AngleType;
  name: string;
  sceneId: string;
  findText: string;
  proveText: string;
  variants: AngleVariant[];
}

export const ANGLE_KINDS: AngleKind[] = [
  {
    id: 'skew',
    name: '异面直线角',
    sceneId: 'ang:skew',
    findText: '找：平移其中一条直线，使两条直线相交 —— 平行移动不改变所成角。',
    proveText: '证：说明平移后的角就是异面直线所成角（取值范围 0°~90°）。',
    variants: [
      {
        id: 's1',
        title: '正方体 ABCD-A₁B₁C₁D₁ 中，求 AB 与 CC₁ 所成角',
        given: '棱长为 2',
        answer: 90,
        hint: 'CC₁ 平行于哪条经过 B 点的棱？',
        aux: [
          { id: 'bb1', label: '平移 CC₁ 到 BB₁', correct: true, feedback: '对！BB₁ ∥ CC₁ 且过 B 点，与 AB 相交于 B。' },
          { id: 'cd', label: '连 CD', correct: false, feedback: 'CD 与 CC₁ 相交于 C，并不平行，平移必须保持方向不变。' },
          { id: 'a1b1', label: '连 A₁B₁', correct: false, feedback: 'A₁B₁ ∥ AB，它与 AB 平行而不相交，不能用来找角。' },
        ],
        solution: 'CC₁ ∥ BB₁，所求角为 ∠ABB₁；AB ⊥ 平面 BCC₁B₁，故 ∠ABB₁ = 90°。',
      },
      {
        id: 's2',
        title: '正方体中，求 AB₁ 与 BC₁ 所成角',
        given: '棱长为 2',
        answer: 60,
        hint: 'BC₁ 与哪条过 A 点的面对角线平行？三条面对角线长度有什么关系？',
        aux: [
          { id: 'ad1', label: '平移 BC₁ 到 AD₁', correct: true, feedback: '对！AD₁ ∥ BC₁，于是所求角为 ∠B₁AD₁。' },
          { id: 'cd1', label: '连 CD₁', correct: false, feedback: 'CD₁ 与 BC₁ 相交于 C₁，方向不同，不是平移。' },
          { id: 'b1c1', label: '连 B₁C₁', correct: false, feedback: 'B₁C₁ 与 BC₁ 相交，无法把角“搬到一起”。' },
        ],
        solution: 'AD₁ ∥ BC₁，所求角为 ∠B₁AD₁；AB₁ = AD₁ = B₁D₁ = 2√2（都是面对角线），△AB₁D₁ 等边，故为 60°。',
      },
      {
        id: 's3',
        title: '正方体中，求 AC 与 BC₁ 所成角',
        given: '棱长为 2',
        answer: 60,
        hint: '把 BC₁ 平移到过 A 点的位置，看看三角形三边长度。',
        aux: [
          { id: 'ad1', label: '平移 BC₁ 到 AD₁', correct: true, feedback: '对！AD₁ 与 AC 相交于 A，所求角即 ∠CAD₁。' },
          { id: 'a1c1', label: '连 A₁C₁', correct: false, feedback: 'A₁C₁ ∥ AC，与 AC 平行不相交，拼不出角。' },
          { id: 'dd1', label: '连 DD₁', correct: false, feedback: 'DD₁ ∥ CC₁，方向与 BC₁ 不同，不是它的平移。' },
        ],
        solution: 'AD₁ ∥ BC₁，所求角为 ∠CAD₁；AC = AD₁ = CD₁ = 2√2，△ACD₁ 等边，故为 60°。',
      },
      {
        id: 's4',
        title: '正方体中，求 AB 与 B₁D₁ 所成角',
        given: '棱长为 2',
        answer: 45,
        hint: 'B₁D₁ 是上底面的对角线，它平行于下底面的哪一条对角线？',
        aux: [
          { id: 'bd', label: '平移 B₁D₁ 到 BD', correct: true, feedback: '对！BD ∥ B₁D₁ 且过 B 点，与 AB 相交于 B。' },
          { id: 'ac', label: '连 AC', correct: false, feedback: 'AC 与 BD 不平行，方向对不上 B₁D₁。' },
          { id: 'b1c1', label: '连 B₁C₁', correct: false, feedback: 'B₁C₁ 是上底面的一条边，与 B₁D₁ 相交而非平行。' },
        ],
        solution: 'BD ∥ B₁D₁，所求角为 ∠ABD；正方形中 ∠ABD = 45°。',
      },
    ],
  },
  {
    id: 'linePlane',
    name: '线面角',
    sceneId: 'ang:linePlane',
    findText: '找：过斜线上一点作平面的垂线，连接垂足与斜足 —— 这条“射影”就是关键。',
    proveText: '证：PO ⊥ α，所以 AO 是 PA 在 α 内的射影，∠PAO 就是线面角（直角三角形的锐角）。',
    variants: [
      {
        id: 'lp1',
        title: 'PO ⊥ 平面 α，垂足 O，PA 是斜线，PO = 2，OA = 2，求 PA 与 α 所成角',
        given: 'PO = 2，OA = 2',
        answer: 45,
        hint: '在 Rt△POA 中，tanθ = 对边 / 邻边 = PO / OA。',
        aux: [
          { id: 'ao', label: '连 AO（射影）', correct: true, feedback: '对！AO 是 PA 在 α 内的射影，∠PAO 即所求。' },
          { id: 'pa', label: '连 PA', correct: false, feedback: 'PA 就是斜线本身，不是射影。' },
          { id: 'po', label: '连 PO', correct: false, feedback: 'PO 是垂线，用来“造直角”，但它与 PA 的夹角不是线面角。' },
        ],
        solution: 'tanθ = PO/OA = 2/2 = 1，故 θ = 45°。',
      },
      {
        id: 'lp2',
        title: 'PO ⊥ α，PO = √3，OA = 3，求 PA 与 α 所成角',
        given: 'PO = √3，OA = 3',
        answer: 30,
        hint: 'tanθ = √3/3，这是哪个特殊角？',
        aux: [
          { id: 'ao', label: '连 AO（射影）', correct: true, feedback: '对！先找射影 AO，再在 Rt△POA 中算。' },
          { id: 'pa', label: '连 PA', correct: false, feedback: 'PA 是斜线，∠APO 不是线面角（它的顶点在 P 上）。' },
          { id: 'ob', label: '连 OB（任一点 B）', correct: false, feedback: '射影必须由垂足 O 连到斜足 A，换成别的点就不对了。' },
        ],
        solution: 'tanθ = PO/OA = √3/3，故 θ = 30°。',
      },
      {
        id: 'lp3',
        title: 'PO ⊥ α，PO = 3，OA = √3，求 PA 与 α 所成角',
        given: 'PO = 3，OA = √3',
        answer: 60,
        hint: 'tanθ = 3/√3 = √3，反过来想：哪个角的正切是 √3？',
        aux: [
          { id: 'ao', label: '连 AO（射影）', correct: true, feedback: '对！∠PAO 是线面角，tanθ = PO/OA。' },
          { id: 'pa', label: '连 PA', correct: false, feedback: '斜线本身不构成线面角。' },
          { id: 'po', label: '连 PO', correct: false, feedback: '垂线已经画好了，缺的是射影 AO。' },
        ],
        solution: 'tanθ = PO/OA = 3/√3 = √3，故 θ = 60°。',
      },
    ],
  },
  {
    id: 'dihedral',
    name: '二面角',
    sceneId: 'ang:dihedral',
    findText: '找：在棱上取一点，分别在两个半平面内作棱的垂线 —— 两条垂线的夹角就是平面角。',
    proveText: '证：AB ⊥ PM，AB ⊥ OM，所以 AB ⊥ 平面 PMO，∠PMO 即为二面角的平面角。',
    variants: [
      {
        id: 'd1',
        title: '正四棱锥 P-ABCD 底面边长 2，高 PO = 1，求侧面与底面所成二面角',
        given: '底边 2，高 1（M 为 AB 中点）',
        answer: 45,
        hint: '在 Rt△PMO 中，OM 是多少？tanθ = PO / OM。',
        aux: [
          { id: 'pm-om', label: '作 PM、OM（都垂直棱 AB）', correct: true, feedback: '对！PM ⊥ AB、OM ⊥ AB，∠PMO 就是平面角。' },
          { id: 'pa-pb', label: '连 PA、PB', correct: false, feedback: 'PA、PB 并不垂直棱 AB，构不成平面角。' },
          { id: 'po', label: '只连 PO', correct: false, feedback: 'PO 垂直底面但不垂直棱 AB，还需要 OM 这条垂线。' },
        ],
        solution: 'OM = 1（中心到边距离 = 边长的一半），tanθ = PO/OM = 1，故 θ = 45°。',
      },
      {
        id: 'd2',
        title: '正四棱锥底边 2，高 PO = √3，求侧面与底面所成二面角',
        given: '底边 2，高 √3',
        answer: 60,
        hint: 'tanθ = √3 / 1。',
        aux: [
          { id: 'pm-om', label: '作 PM、OM', correct: true, feedback: '对！两条垂线确定平面角 ∠PMO。' },
          { id: 'pc', label: '连 PC', correct: false, feedback: 'PC 是侧棱，与棱 AB 无关。' },
          { id: 'ac', label: '连 AC', correct: false, feedback: 'AC 是底面对角线，不垂直棱 AB。' },
        ],
        solution: 'tanθ = √3/1 = √3，故 θ = 60°。',
      },
      {
        id: 'd3',
        title: '正四棱锥底边 2，高 PO = √3⁄3，求侧面与底面所成二面角',
        given: '底边 2，高 √3⁄3',
        answer: 30,
        hint: 'tanθ = (√3⁄3) / 1。',
        aux: [
          { id: 'pm-om', label: '作 PM、OM', correct: true, feedback: '对！∠PMO 即所求平面角。' },
          { id: 'pa', label: '连 PA', correct: false, feedback: 'PA 不垂直棱 AB。' },
          { id: 'pd', label: '连 PD', correct: false, feedback: 'PD 与棱 AB 无关。' },
        ],
        solution: 'tanθ = (√3⁄3)/1 = √3⁄3，故 θ = 30°。',
      },
    ],
  },
];

/* ---------------- 痛点四：体积公式推导剧场 ---------------- */

export interface VolumeShow {
  id: string;
  sceneId: string;
  name: string;
  /** 先猜后验 */
  guess: { q: string; options: string[]; answer: number; explain: string };
  steps: string[];
  conclusion: string;
  /** 是否支持拖动（下发 t 参数） */
  slider?: { label: string };
}

export const VOLUME_SHOWS: VolumeShow[] = [
  {
    id: 'pyramid',
    sceneId: 'vol:pyramid',
    name: '锥体 = ⅓ 柱体（切三锥）',
    guess: {
      q: '等底等高的三棱锥体积是三棱柱的几分之几？',
      options: ['1/2', '1/3', '1/4'],
      answer: 1,
      explain: '把三棱柱切成 3 个三棱锥：①以原底面为底、②和③各以侧面的一半为底，它们高相同、底面积相等，所以体积相等 —— 各占 1/3。',
    },
    steps: [
      '三棱柱 ABC-A′B′C′，底面积 S、高 h，体积 = Sh。',
      '沿平面 A′BC 和 A′B′C 把它切成三个三棱锥 ①②③。',
      '①的底是 ABC（面积 S），②③的底分别是侧面矩形的一半，面积也都是 S；三个锥的高都是 h。',
      '所以 V锥 = ⅓Sh —— 这就是锥体体积公式的来历。',
    ],
    conclusion: 'V锥 = ⅓Sh（等底等高的锥是柱的三分之一）',
  },
  {
    id: 'cone',
    sceneId: 'vol:cone',
    name: '圆锥 = ⅓ 圆柱（倒水）',
    guess: {
      q: '同底等高的圆锥装满水，倒进圆柱里，几次能倒满？',
      options: ['2 次', '3 次', '4 次'],
      answer: 1,
      explain: '实验与推导都表明：3 次正好倒满。所以 V锥 = ⅓πr²h，V柱 = πr²h。',
    },
    steps: [
      '准备一个圆锥和一个与它同底等高的圆柱。',
      '把圆锥装满水倒进圆柱，第一次液面升到 1/3 高。',
      '第二次到 2/3，第三次正好倒满。',
      '所以 V圆锥 = ⅓ V圆柱 = ⅓πr²h。',
    ],
    conclusion: 'V圆锥 = ⅓πr²h',
    slider: { label: '拖动看液面上升' },
  },
  {
    id: 'sphere',
    sceneId: 'vol:sphere',
    name: '球体积（祖暅原理）',
    guess: {
      q: '半径为 R 的球体积是多少？',
      options: ['(4/3)πR³', '(2/3)πR³', 'πR³'],
      answer: 0,
      explain:
        '祖暅原理：两个几何体在任意同一高度上的截面面积都相等，则体积相等。半球与“圆柱挖去同底等高圆锥”在高度 h 处的截面面积都是 π(R²−h²)，所以 V半球 = πR³ − ⅓πR³ = ⅔πR³，V球 = 4⁄3πR³。',
    },
    steps: [
      '左边是半径 R 的半球，右边是“底面半径 R、高 R 的圆柱挖去同底等高的圆锥”。',
      '在高度 h 处截一刀：左边得到半径 √(R²−h²) 的圆，面积 = π(R²−h²)。',
      '右边得到外半径 R、内半径 h 的圆环，面积 = πR² − πh² = π(R²−h²)。',
      '处处相等 ⇒ 体积相等（祖暅原理）：V半球 = πR³ − ⅓πR³ = ⅔πR³。',
    ],
    conclusion: 'V球 = 4⁄3πR³',
    slider: { label: '拖动改变截面高度' },
  },
];
