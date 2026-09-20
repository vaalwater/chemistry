export interface ElementData {
  symbol: string;
  name: string;
  p: number;
  n: number;
  shells: number[];
  color: string;
  radius: number;
  desc: string;
  /** 是否为高中常用元素（false = 后期补全的少见元素，界面半透明展示） */
  core?: boolean;
}

export type AcidLabel = '强酸' | '弱酸' | '强碱' | '弱碱' | '中性';

export interface AcidInfo {
  label: AcidLabel;
  explain: string;
}

export interface MolAtom {
  el: string;
  pos: [number, number, number];
}

export interface Bond {
  a: number;
  b: number;
  order?: number;
  style?: string;
}

export interface MoleculeData {
  id: string;
  name: string;
  formula: string;
  category: string;
  level: string;
  scene: 'molecule' | 'lattice';
  desc: string;
  note?: string;
  atoms?: MolAtom[];
  bonds?: Bond[];
  /** 每个原子在该化合物中的离子电荷（与 atoms 下标对齐；缺省按 0 处理） */
  charges?: number[];
  /** 水溶液酸碱性标注 */
  acidity?: AcidInfo;
  /** 原子下标集：该分子与反应等引用相关（无特殊含义时可缺省） */
  formulaAscii?: string;
  /** 习惯写法 / 结构简式（如 CH₃NH₂、CH₃COOH），仅用于展示；缺省时界面回退到 formula */
  formulaDisplay?: string;
  view?: { rx?: number; ry?: number; rz?: number };
}

export interface ReactionSpecies {
  mol: string;
  count: number;
}

export interface ReactionStep {
  title: string;
  desc: string;
  show: string;
}

/** 反应“电子级演示”步骤的引擎模式 */
export type RxnStepMode = 'reactants' | 'split' | 'transfer' | 'products';

export interface DramaStep {
  title: string;
  desc: string;
  mode: RxnStepMode;
}

/** 剧幕中的一个物种（携带完整分子数据，引擎无需查库即可绘制） */
export interface ReactionDramaSpecies {
  mol: MoleculeData;
  count: number;
}

/** 电子转移：元素 a 的原子向元素 b 的原子转移 n 个电子（拆分/组合阶段的橙黄小球示意） */
export interface ElectronTransfer {
  a: string;
  b: string;
  n: number;
}

/** 由宿主下发给引擎的“电子级反应剧幕” */
export interface ReactionDrama {
  id: string;
  name: string;
  equation: string;
  condition?: string;
  type: string;
  level: string;
  desc: string;
  lhs: ReactionDramaSpecies[];
  rhs: ReactionDramaSpecies[];
  steps: DramaStep[];
  /** 拆分后按元素标注的目标离子电荷，如 { Na: 1, Cl: -1 } */
  ions?: Record<string, number>;
  /** 电子转移事件列表 */
  transfers?: ElectronTransfer[];
}

export interface ReactionData {
  id: string;
  name: string;
  equation: string;
  condition: string;
  type: string;
  level: string;
  desc: string;
  lhs: ReactionSpecies[];
  rhs: ReactionSpecies[];
  lhsGap?: number;
  rhsGap?: number;
  steps: ReactionStep[];
}

export interface Content {
  version: string;
  elements: ElementData[];
  molecules: MoleculeData[];
  reactions: ReactionData[];
}

export type SceneKind = 'molecule' | 'atom' | 'reaction';

export interface SceneReq {
  kind: SceneKind;
  id: string;
  /** 从哪个分子/晶体下钻进入（仅 atom 场景会携带） */
  molId?: string;
  /** 分子 atoms 下标 / 晶格离子序号（仅 atom 场景会携带） */
  ai?: number;
  /** 不在内容库中的动态分子（输入框即时生成 / 目录扩展有机物），随场景一起交给引擎 */
  mol?: MoleculeData;
  /** 反应模式下的电子级剧幕（通用推导/预置实验进入时下发给引擎） */
  reaction?: ReactionDrama;
}

export interface EngineEvent {
  ev: string;
  [k: string]: unknown;
}
