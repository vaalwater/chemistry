import type { Ionicons } from '@expo/vector-icons';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

/* ---------------------------------------------------------------- 场库 */
export type FieldId =
  | 'point' | 'same' | 'opp' | 'uniform'
  | 'wire' | 'loop' | 'solenoid' | 'magnet';

export type FieldMeta = {
  id: FieldId;
  name: string;
  kind: 'E' | 'B';
  canSplit: boolean;
  /** 场线视图下的图注说明 */
  lines: string;
  /** 等势面视图下的图注说明 */
  equi: string;
  /** 叠加开关的三档文案（canSplit 时使用） */
  split?: { a: string; b: string; sum: string };
};

export const FIELDS: FieldMeta[] = [
  {
    id: 'point', name: '点电荷', kind: 'E', canSplit: false,
    lines: '正点电荷的电场线呈放射状指向无穷远，越密的地方场强越大；沿场线方向电势降低。',
    equi: '等势面是一组同心的球壳，越靠近电荷球壳越密；场线处处垂直于等势面。',
  },
  {
    id: 'same', name: '等量同种电荷', kind: 'E', canSplit: true,
    lines: '两正电荷的场线相互"排斥"弯开，中点处场强为零——两个场在那里正好抵消。',
    equi: '靠近每个电荷是分离的球壳，远处合并成一个包裹两者的"花生壳"。',
    split: { a: '只有 Q₁', b: '只有 Q₂', sum: 'Q₁ + Q₂ 叠加' },
  },
  {
    id: 'opp', name: '等量异种电荷', kind: 'E', canSplit: true,
    lines: '场线从 +Q 出发、终止于 −Q，两电荷之间最密（场最强），这是最常见的电偶极子模型。',
    equi: '正电势（暖色壳）包着 +Q，负电势（冷色壳）包着 −Q；中垂面上电势为零。',
    split: { a: '只有 +Q', b: '只有 −Q', sum: '+Q 与 −Q 叠加' },
  },
  {
    id: 'uniform', name: '匀强电场', kind: 'E', canSplit: true,
    lines: '平行板之间场线平行等间距（匀强），只在边缘微微外凸——边缘效应。板外场很弱。',
    equi: '匀强电场的等势面是一组平行的平面，与板平行；场线垂直等势面。',
    split: { a: '只有正板', b: '只有负板', sum: '两板叠加' },
  },
  {
    id: 'wire', name: '通电直导线', kind: 'B', canSplit: false,
    lines: '磁感线是以导线为轴的同心圆，离导线越近越密（B = μ₀I/2πr）。用安培定则（右手螺旋）判断方向。',
    equi: '等 |B| 面是以导线为轴的圆柱面——同一圆柱面上的磁感应强度处处相等。',
  },
  {
    id: 'loop', name: '环形电流', kind: 'B', canSplit: false,
    lines: '环形电流的磁场线穿过环面、绕着导线闭合，中央处磁场最强且方向沿轴。',
    equi: '切面上的 |B| 热力图：环心最亮，越远离环越弱；等值线沿环闭合。',
  },
  {
    id: 'solenoid', name: '通电螺线管', kind: 'B', canSplit: false,
    lines: '管内磁感线平行等间距（近似匀强），管外与条形磁铁相同——这就是"通电螺线管相当于条形磁铁"。',
    equi: '切面热力图：管内亮且均匀（匀强），管外亮度迅速减弱。',
  },
  {
    id: 'magnet', name: '条形磁铁', kind: 'B', canSplit: false,
    lines: '磁感线从 N 极出发、回到 S 极（内部从 S 到 N 闭合）；两极附近最密。',
    equi: '磁铁外部等效于磁偶极子：等"磁势"面在 N 侧、S 侧各抱一壳，远处合并。',
  },
];

/* ------------------------------------------------------------ 三方向定则 */
export type RuleKey = 'ampere' | 'lorentz' | 'rightHand';

export const RULES: {
  key: RuleKey;
  scene: string;
  icon: IconName;
  title: string;
  short: string;
  rule: string;
  steps: string[];
}[] = [
  {
    key: 'ampere',
    scene: 'rule-ampere',
    icon: 'hand-left-outline',
    title: '安培力 · 左手定则',
    short: '通电导线在磁场中受力',
    rule: '伸开左手，让磁感线穿过手心，四指指向电流方向，大拇指所指就是安培力方向。',
    steps: [
      '① 判断磁场 B 的方向（⊗ 向里 / ⊙ 向外）',
      '② 判断电流 I 的方向（沿导体棒）',
      '③ 用左手定则摆手：B 进手心，四指指 I',
      '④ 大拇指 = 安培力 F = IL×B 的方向',
    ],
  },
  {
    key: 'lorentz',
    scene: 'rule-lorentz',
    icon: 'aperture-outline',
    title: '洛伦兹力 · 带电粒子',
    short: '磁场使带电粒子偏转',
    rule: '洛伦兹力 F = qv×B，方向仍用左手定则判断（负电荷方向相反），永不做功、只改变方向。',
    steps: [
      '① 确认电荷的正负（负电荷四指指运动的反方向）',
      '② 看速度 v 与 B 的夹角：平行不受力、垂直做圆周',
      '③ 左手定则判断初始偏转方向',
      '④ 圆周半径 r = mv/(qB)，周期 T = 2πm/(qB)',
    ],
  },
  {
    key: 'rightHand',
    scene: 'rule-induction',
    icon: 'hand-right-outline',
    title: '右手定则 · 导体切割',
    short: '感应电流方向的判断',
    rule: '伸开右手，磁感线穿过手心，大拇指指向导体运动方向，四指指向感应电流方向。',
    steps: [
      '① 磁感线穿入手心（B ⊗ / ⊙）',
      '② 大拇指指向导体切割速度 v 的方向',
      '③ 四指 = 棒中感应电流方向',
      '④ 再用楞次定律验证：安培力一定阻碍相对运动',
    ],
  },
];

/* ---------------------------------------------------------- 交流电模块 */
export type AcKey = 'energy' | 'phasor' | 'rms' | 'gen' | 'transformer' | 'transmit';

export const AC_MODULES: {
  key: AcKey;
  scene: string;
  icon: IconName;
  title: string;
  desc: string;
}[] = [
  {
    key: 'energy',
    scene: 'ac-energy',
    icon: 'sparkles-outline',
    title: '电子不动 · 电磁波传能',
    desc: '电场和磁场是同一条行波的两个面：两者互相垂直、严格同相，并在每处互相生成（E 生 B、B 再生 E），一路把能量推到灯泡。这一幕也会讲清波长到底有多长，以及为什么真实家里的线路看不出这道波。',
  },
  {
    key: 'gen',
    scene: 'ac-gen',
    icon: 'sync-outline',
    title: '交流发电机 · 法拉第与楞次',
    desc: '线圈在匀强磁场里转：Φ = BS cos θ 与 e = NBSω sin θ 同步画出，中性面（Φ 最大、e = 0）一眼看穿；红色阻力矩演示楞次定律的"阻碍"。',
  },
  {
    key: 'phasor',
    scene: 'ac-phasor',
    icon: 'reload-outline',
    title: '波形与相量',
    desc: '旋转矢量转一圈 = 波形走一个周期。看着相量端点的投影在右侧扫出正弦曲线。',
  },
  {
    key: 'rms',
    scene: 'ac-rms',
    icon: 'flame-outline',
    title: '有效值探究',
    desc: '切换正弦 / 方波 / 半波整流，看"相同电阻、相同时间、相同热量"的直流值是怎么定义出来的。',
  },
  {
    key: 'transformer',
    scene: 'ac-transformer',
    icon: 'git-merge-outline',
    title: '变压器',
    desc: '拖动匝数比与负载电阻，看哪些量不变（频率、功率）、哪些量随之变（电压、电流）。',
  },
  {
    key: 'transmit',
    scene: 'ac-transmit',
    icon: 'flash-outline',
    title: '远距离输电',
    desc: '发电 → 升压 → 输电线 → 降压 → 用户。切换高压输电开关，线路损耗一目了然。',
  },
];
