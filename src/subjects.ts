import type { Ionicons } from '@expo/vector-icons';

/**
 * 学科频道：首页三张卡片（数学 / 物理 / 化学）。
 *
 * 化学频道已经把原「高中化学 3D 课堂」的全部内容收进来（浏览 / 反应 / 动手 / 关于）；
 * 数学与物理频道先给出规划中的模块清单，后续按同一套「列表页 → 交互场景页」的结构填充。
 */
export type SubjectKey = 'math' | 'physics' | 'chemistry';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

export type SubjectMeta = {
  key: SubjectKey;
  /** 学科名 */
  name: string;
  /** 一句话说明 */
  tagline: string;
  /** 卡片右下角的规模标注 */
  stats: string;
  /** 学科主题色（卡片图标、频道页强调色） */
  color: string;
  /** 主题色的浅色底 */
  tint: string;
  icon: IconName;
  /** 是否已开放内容 */
  ready: boolean;
  /** 频道内的模块清单（ready 为 false 时表示规划中） */
  modules: { name: string; desc: string }[];
};

export const SUBJECTS: SubjectMeta[] = [
  {
    key: 'math',
    name: '数学',
    tagline: '函数、几何、概率 —— 把抽象关系画出来看',
    stats: '规划中',
    color: '#8a63d2',
    tint: '#F1ECFB',
    icon: 'analytics-outline',
    ready: false,
    modules: [
      { name: '函数与图像', desc: '一次 / 二次 / 指数 / 三角函数，拖动参数看曲线怎么变' },
      { name: '平面几何', desc: '三角形、圆与相似全等，图形随拖动实时重画' },
      { name: '立体几何', desc: '空间向量与截面，3D 旋转看棱柱、棱锥、球' },
      { name: '概率与统计', desc: '掷骰子、抽球做实验，频率如何收敛到概率' },
    ],
  },
  {
    key: 'physics',
    name: '物理',
    tagline: '受力、运动、电路 —— 让过程动起来',
    stats: '规划中',
    color: '#e2822f',
    tint: '#FDF0E3',
    icon: 'rocket-outline',
    ready: false,
    modules: [
      { name: '力学', desc: '受力分析与斜面、滑轮，箭头长短即力的大小' },
      { name: '运动学', desc: 'v-t / s-t 图像与小车动画同步，看见加速度' },
      { name: '电与磁', desc: '串并联电路、电表读数，电流沿导线流动' },
      { name: '光学与热学', desc: '反射折射光路、物态变化与热传递' },
    ],
  },
  {
    key: 'chemistry',
    name: '化学',
    tagline: '分子、原子、反应 —— 把微观结构看得见',
    stats: '19 个结构 · 6 组反应 · 4 个动手实验',
    color: '#1fa97a',
    tint: '#E6F6EF',
    icon: 'flask-outline',
    ready: true,
    modules: [
      { name: '浏览', desc: '19 个分子 / 离子晶体球棍模型，点原子下钻看电子分层' },
      { name: '反应', desc: '6 组典型反应 3D 动画：反应物 → 过程 → 生成物，逐帧可控' },
      { name: '动手', desc: '同分异构体搭建、原子构造器、同素异形体、半径比实验' },
      { name: '关于', desc: '交互说明、比例尺声明与打包方式' },
    ],
  },
];

export function subjectOf(key: SubjectKey): SubjectMeta {
  return SUBJECTS.find((s) => s.key === key) ?? SUBJECTS[SUBJECTS.length - 1];
}
