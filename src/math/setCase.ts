/**
 * 完整案例：A = {x | x²−ax+1 ≤ 0}，B = {x | 1 ≤ x ≤ 3}，A ⊆ B，求 a。
 * 这一页要用到的文字素材都在这里：推理的每一步、参数地图上的三种情形、
 * 哪些变形要小心、会在哪儿停下来提问、逆用构造器的素材。
 */

/* ------------------------------------------------------------------ *
 * 一、右区：推理轨道
 * ------------------------------------------------------------------ */

export type Station = {
  id: string;
  title: string;
  detail: string;
  /** equiv = 等价变形（绿实线）；risk = 需要补充条件（红虚线） */
  kind: 'equiv' | 'risk';
  /** 属于哪条分支 */
  branch: 'both' | 'empty' | 'nonempty';
  /** risk 站点需要补的条件 */
  need?: string;
  /** 补上之后的正确说法 */
  after?: string;
  /** 未补条件时，中区会“多出来 / 丢掉”的那一坨（一句话） */
  missing?: string;
};

export const TRACK: Station[] = [
  {
    id: 'st1',
    title: '读题：A ⊆ B',
    detail: 'A 的每一个元素都要落在 [1,3] 里。先把 A 是什么弄清楚：A 是不等式 x²−ax+1 ≤ 0 的解集。',
    kind: 'equiv',
    branch: 'both',
  },
  {
    id: 'st2',
    title: '第一问：A 会不会是空集？',
    detail: '开口向上的抛物线，Δ = a²−4。当 Δ<0 时它整个悬在 x 轴上方，A 里一个元素都没有 —— 空集 ⊆ B 自动成立。',
    kind: 'risk',
    branch: 'both',
    need: '必须先分「A = ∅」与「A ≠ ∅」两支',
    after: '分两支讨论：① Δ<0 → A=∅；② Δ≥0 → A=[x₁,x₂]，再要求整段落进 [1,3]。',
    missing: '会把整条「A 是空集」的分支丢掉：Δ < 0 的那一整段参数就没了。',
  },
  {
    id: 'st3',
    title: '分支一：A = ∅',
    detail: 'Δ < 0 时 A 里一个数都没有，A ⊆ B 无条件成立。（课本例题里这对应 −2 < a < 2。）',
    kind: 'equiv',
    branch: 'empty',
  },
  {
    id: 'st4',
    title: '分支二：A ≠ ∅',
    detail: 'Δ ≥ 0 时 A 就是两根之间那一段：左根不小于 B 的左端，右根不大于 B 的右端。',
    kind: 'risk',
    branch: 'nonempty',
    need: '接下来讨论的是根的位子 —— 光有 Δ ≥ 0 还远远不够',
    after: '用根分布模板：Δ ≥ 0、对称轴落在 B 里、两个端点处的函数值都 ≥ 0，四条一起取交集。',
    missing: '会多出一段：只要 A 有实根就写进答案，于是那些「其实装不进 B」的参数也混了进来（图里红色那部分就是）。',
  },
  {
    id: 'st5',
    title: '韦达：两根同号',
    detail:
      '韦达：课本例题里 x₁+x₂ = a，x₁·x₂ = 1 > 0 —— 两根同号。要落进 B 就必须都是正数，于是只保留 a ≥ 2。',
    kind: 'equiv',
    branch: 'nonempty',
  },
  {
    id: 'st6',
    title: '根分布四条',
    detail:
      '课本例题里四条缺一不可：① Δ≥0；② 对称轴 a/2 ∈ [1,3] → 2 ≤ a ≤ 6；③ f(1)=2−a ≥ 0 → a ≤ 2；④ f(3)=10−3a ≥ 0 → a ≤ 10/3。',
    kind: 'risk',
    branch: 'nonempty',
    need: '端点处要单独检验（端点效应）',
    after: '四条取交集得 a = 2；代回去验：A = {1} ⊆ [1,3]，成立。',
    missing: '端点忘了代回去验：Δ = 0 的那条边界很容易被当成「不在解里」而丢掉。',
  },
  {
    id: 'st7',
    title: '合并两支',
    detail: '两支取并集：Δ < 0 的整段，加上 Δ = 0 且重根落在 B 上的那些端点（课本例题里是 −2 < a ≤ 2）。',
    kind: 'equiv',
    branch: 'both',
  },
];

/** 等价变形规则速查（对应“操作 → 轨道颜色 → 提示”） */
export const TRANSFORM_RULES: { op: string; risky: boolean; tip: string }[] = [
  { op: '移项 / 合并同类项', risky: false, tip: '放心写，不会多出解，也不会丢解。' },
  { op: '因式分解', risky: false, tip: '放心写，只要分解没错、符号没抄反。' },
  { op: '两边平方', risky: true, tip: '要两边都不是负数，不然会冒出一堆假解。' },
  { op: '两边除以含 x 的式子', risky: true, tip: '先问一句「它可能等于 0 吗」，再决定不等号要不要翻。' },
  { op: '去分母', risky: true, tip: '分母可能为正也可能为负；拿不准就两边同乘分母的平方。' },
  { op: '两边取倒数', risky: true, tip: '两边同号才安全，而且取倒数时不等号要翻过来。' },
  { op: '用判别式 Δ', risky: true, tip: '先确认它真的是二次的（二次项系数不为 0），否则没有 Δ 可谈。' },
];

/* ------------------------------------------------------------------ *
 * 二、左区：参数地图（横轴 a，纵轴 Δ）
 * ------------------------------------------------------------------ */

export type MapCaseId = 'empty' | 'inside' | 'outside' | 'trace';

export type MapRegion = {
  id: MapCaseId;
  name: string;
  short: string;
  color: string;
  desc: string;
};

export const MAP_REGIONS: MapRegion[] = [
  {
    id: 'empty',
    name: 'A 是空集',
    short: '∅',
    color: '#2fa7e8',
    desc: 'Δ < 0：抛物线整个悬在 x 轴上方，A 里一个数都没有，这时 A ⊆ B 自动成立。',
  },
  {
    id: 'inside',
    name: 'A 非空且装得进 B',
    short: '✓',
    color: '#1fa97a',
    desc: 'Δ ≥ 0，而且两根都落在 [1,3] 里：这条窄带才是真正要算的那一支。',
  },
  {
    id: 'outside',
    name: 'A 非空但装不进 B',
    short: '✗',
    color: '#e5524a',
    desc: '有实根，可整段跑出了 [1,3]：这一区要舍掉，写答案前一定把它排除干净。',
  },
];

/** 网格坐标范围 */
export const MAP_AXIS = { aMin: -6, aMax: 6, dMin: -6, dMax: 20, rows: 9, cols: 12 };

/**
 * 地图某一格属于哪个区。
 * 由于 A=1、B=−a、C=1，两根可写成 (a ± √Δ)/2，
 * 所以 (a, Δ) 这一对坐标本身就决定得了整个讨论情形。
 */
export function caseOf(a: number, d: number): MapCaseId {
  if (d < 0) return 'empty';
  const sq = Math.sqrt(d);
  const r1 = (a - sq) / 2;
  const r2 = (a + sq) / 2;
  if (r1 >= 1 - 1e-9 && r2 <= 3 + 1e-9) return 'inside';
  return 'outside';
}

/** 是否是真实轨迹 Δ = a²−4 经过的格子（临界点专项） */
export function onTrace(a: number, d: number): boolean {
  const real = a * a - 4;
  const rowH = (MAP_AXIS.dMax - MAP_AXIS.dMin) / MAP_AXIS.rows;
  return Math.abs(real - d) <= rowH / 2 + 1e-9;
}

/* ------------------------------------------------------------------ *
 * 三、底部：冲突探针
 * ------------------------------------------------------------------ */

export type Probe = {
  id: string;
  tag: string;
  trigger: string;
  question: string;
  options: { id: string; text: string; correct: boolean }[];
  /** 答错时的“让图形动起来”引导 */
  reveal: string;
  insight: string;
};

export const PROBES: Probe[] = [
  {
    id: 'p-empty',
    tag: '空集',
    trigger: '处理 A ⊆ B 时',
    question: 'A 有可能为空吗？',
    options: [
      { id: 'o1', text: '有可能，Δ<0 时 A=∅，此时 A ⊆ B 自动成立', correct: true },
      { id: 'o2', text: '不可能，解集一定有元素', correct: false },
      { id: 'o3', text: '空集不算任何集合的子集', correct: false },
    ],
    reveal: '看中区：把 Δ 拖成负值，A 的色带一点点收缩，最后消失，浮出 ∅ —— 而包含关系依然成立。',
    insight: '凡含“⊆”的题，第一站永远是“它可能为空吗”。',
  },
  {
    id: 'p-quant',
    tag: '量词',
    trigger: '写出全称命题的否定时',
    question: '∀ 的否定是什么？',
    options: [
      { id: 'o1', text: '∃，并且把结论改成它的反面', correct: true },
      { id: 'o2', text: '∀，只把结论反过来', correct: false },
      { id: 'o3', text: '还是 ∀，什么都不用改', correct: false },
    ],
    reveal: '数轴上把“整段都成立”改成“只要有一个点不成立” —— 那个点会被红色标出来。',
    insight: '¬(∀x,p) ⟺ ∃x,¬p；不等号取反时等号要跟着走（> ↔ ≤）。',
  },
  {
    id: 'p-level',
    tag: '层级',
    trigger: '判断 ∈ 与 ⊆ 时',
    question: '“1 ∈ A”和“{1} ⊆ A”都对，两个“对”有什么不同？',
    options: [
      { id: 'o1', text: '前者说元素与集合的关系，后者说集合与集合的关系', correct: true },
      { id: 'o2', text: '两句话完全一样，只是写法不同', correct: false },
      { id: 'o3', text: '前者层级更高，后者层级更低', correct: false },
    ],
    reveal: '层级折叠动画：点开 A 露出元素 1；{1} 是把 1 再包一层，它只能当子集。',
    insight: '∈ 连接“元素—集合”，⊆ 连接“集合—集合”，中间差一层花括号。',
  },
  {
    id: 'p-comp',
    tag: '全集',
    trigger: '写出 ∁A 时',
    question: '∁A 写出来之前，必须先确定什么？',
    options: [
      { id: 'o1', text: '全集 U 是哪一个', correct: true },
      { id: 'o2', text: 'A 有没有最大元素', correct: false },
      { id: 'o3', text: 'A 的元素个数', correct: false },
    ],
    reveal: '把 U 从 R 换成 [−5,5] 再换成 {整数}：斜纹补集区三次重画，一次比一次短。',
    insight: '补集是“相对”的概念，脱离全集谈 ∁A 没有意义。',
  },
  {
    id: 'p-equal',
    tag: '等号',
    trigger: '用基本不等式求最值时',
    question: '等号能取到吗？',
    options: [
      { id: 'o1', text: '必须验证取等条件是否在定义域内', correct: true },
      { id: 'o2', text: '能取等号时才能用，取不到就不用验证', correct: false },
      { id: 'o3', text: '不等式里的等号总能取到', correct: false },
    ],
    reveal: '把取等的那一点标在数轴上：一旦它落在空心端点外，最小值就变成了“取不到”的下确界。',
    insight: '“等号取得当且仅当两数相等” —— 先看这个等式有没有解。',
  },
  {
    id: 'p-disc',
    tag: '判别式',
    trigger: '只用两根的和与积下结论时',
    question: '和满足、积满足，一定存在两个实根吗？',
    options: [
      { id: 'o1', text: '不一定，还要 Δ ≥ 0', correct: true },
      { id: 'o2', text: '一定，韦达已经够了', correct: false },
      { id: 'o3', text: '只要积为负就一定有两根', correct: false },
    ],
    reveal: '仪表盘的指针照着和与积摆好，但抛物线悬在 x 轴上方 —— 根压根不存在。',
    insight: '韦达是“若存在根，则和积如此”，逆命题必须由 Δ ≥ 0 来补。',
  },
  {
    id: 'p-degenerate',
    tag: '二次退化',
    trigger: '准备套韦达公式时',
    question: '二次项系数变成 0 的时候，还能用韦达吗？',
    options: [
      { id: 'o1', text: '不能，此时是一次方程，必须先单独讨论', correct: true },
      { id: 'o2', text: '能，把它代进去就行了', correct: false },
      { id: 'o3', text: '能，只是分母为 0 结果无穷大', correct: false },
    ],
    reveal: '滑块把二次项系数拖到 0：抛物线“啪”地化成一条直线，和积仪表盘立刻弹出红色警告。',
    insight: '凡是出现“一元二次”，第一件事是确认二次项系数不为 0。',
  },
  {
    id: 'p-rootpos',
    tag: '根分布',
    trigger: '解 A ⊆ B 且已经列出条件时',
    question: '把根拖出区间，刚才列的条件还满足吗？',
    options: [
      { id: 'o1', text: '要重新检验：端点条件本身就是防止根跑出去的', correct: true },
      { id: 'o2', text: '满足，因为对称轴还在区间里', correct: false },
      { id: 'o3', text: '只要 Δ≥0 就永远成立', correct: false },
    ],
    reveal: '拖动根指针越过 3：f(3)<0 立刻报警，root pair 变成“一内一外”。',
    insight: '根分布四件套：Δ、对称轴、f(左端点)、f(右端点)，缺一不可。',
  },
  {
    id: 'p-reverse',
    tag: '逆用',
    trigger: '给了两根的和与积去构造方程时',
    question: '构造出来的方程唯一吗？',
    options: [
      { id: 'o1', text: '不唯一，乘以非零常数 k 后根不变', correct: true },
      { id: 'o2', text: '唯一，因为和积已经定了', correct: false },
      { id: 'o3', text: '唯一，只要首项系数取 1', correct: false },
    ],
    reveal: '拉动 k 滑块：抛物线变陡变扁，但与 x 轴的交点一动不动。',
    insight: 'x²−(x₁+x₂)x + x₁x₂ = 0 只是代表元，同解的还有它的任意非零倍数。',
  },
  {
    id: 'p-double',
    tag: '重根',
    trigger: '用穿根法画解集走向时',
    question: '偶次因子为什么不“穿”过去？',
    options: [
      { id: 'o1', text: '重根两侧符号相同，图像只是碰到 x 轴再弹回去', correct: true },
      { id: 'o2', text: '因为重根不算根，直接跳过', correct: false },
      { id: 'o3', text: '因为二次项系数为正', correct: false },
    ],
    reveal: '把此刻的参数停在 Δ=0：中区色带缩成一个点，而不是断开的两段 —— 这就是“不穿”。',
    insight: '奇次因子穿，偶次因子不穿；重根 = (x−x₀)² ≥ 0 恒成立，符号跨不过去。',
  },
  {
    id: 'p-endpoint',
    tag: '端点',
    trigger: '用必要性探路求出参数后',
    question: '必要性探路之后还要做什么？',
    options: [
      { id: 'o1', text: '反过来验证充分性，尤其检查端点', correct: true },
      { id: 'o2', text: '直接写答案，必要条件已是答案的一部分', correct: false },
      { id: 'o3', text: '只需要再检查内部点', correct: false },
    ],
    reveal: '把参数推到端点值：中区显示的解集恰好贴着区间边界，多一分就漏出去。',
    insight: '必要性给出范围，充分性把边界上的点补回来 —— 端点往往正是答案。',
  },
];

/* ------------------------------------------------------------------ *
 * 四、根关系区：逆用构造器
 * ------------------------------------------------------------------ */

export type BuildCase = {
  id: string;
  /** 已知条件的一句话 */
  given: string;
  sum: number;
  prod: number;
  /** 构造出的代表方程（首项系数为 1） */
  answer: string;
  /** 是否有实根 */
  real: boolean;
  note: string;
};

export const BUILD_CASES: BuildCase[] = [
  {
    id: 'b1',
    given: '两根之和为 5，两根之积为 6',
    sum: 5,
    prod: 6,
    answer: 'x² − 5x + 6 = 0',
    real: true,
    note: 'Δ = 25 − 24 = 1 > 0，两根为 2 和 3，方程不唯一（可乘任意非零常数）。',
  },
  {
    id: 'b2',
    given: '两根之和为 2，两根之积为 5',
    sum: 2,
    prod: 5,
    answer: 'x² − 2x + 5 = 0',
    real: false,
    note: 'Δ = 4 − 20 = −16 < 0，方程照样能写出来，但没有实根 —— 这正是“判别式探针”要问的。',
  },
  {
    id: 'b3',
    given: '两根互为相反数，积为 −4',
    sum: 0,
    prod: -4,
    answer: 'x² − 4 = 0',
    real: true,
    note: '和为 0 ⇒ 一次项消失；积为负 ⇒ 两根异号，一定有实根。',
  },
  {
    id: 'b4',
    given: '两根之和为 4，积为 4',
    sum: 4,
    prod: 4,
    answer: 'x² − 4x + 4 = 0',
    real: true,
    note: 'Δ = 0：两根重合为 2（重根）。穿根法里这是“不穿过”的那一种。',
  },
];

/* ------------------------------------------------------------------ *
 * 五、学习记录：热力图的维度
 * ------------------------------------------------------------------ */
export const COGN_TAGS: { id: string; name: string; color: string }[] = [
  { id: 'empty', name: '空集这一支', color: '#2fa7e8' },
  { id: 'level', name: '∈ 和 ⊆ 分不清', color: '#8a63d2' },
  { id: 'quant', name: '全称 / 存在', color: '#e2822f' },
  { id: 'complement', name: '补集与全集', color: '#1fa97a' },
  { id: 'vieta', name: '韦达定理', color: '#2f6fed' },
  { id: 'endpoint', name: '端点检验', color: '#e5524a' },
];

/** 探针 → 档案知识点的映射 */
export const COGN_OF: Record<string, string> = {
  'p-empty': 'empty',
  'p-quant': 'quant',
  'p-level': 'level',
  'p-comp': 'complement',
  'p-equal': 'endpoint',
  'p-disc': 'vieta',
  'p-degenerate': 'vieta',
  'p-rootpos': 'endpoint',
  'p-double': 'empty',
  'p-reverse': 'vieta',
  'p-endpoint': 'endpoint',
};
