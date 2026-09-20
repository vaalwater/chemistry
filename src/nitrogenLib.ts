// 常见含氮有机物的 3D 模型：胺 / 酰胺 / 硝基 / 腈 / 重氮 / 含氮杂环 / 氨基酸 / 三聚氰胺。
// 统一用「重原子骨架 + 按价数自动补氢」的方式搭建，保证原子数与分子式严格一致。
import type { MoleculeData } from './types';
import { displayFormula, formulaOfCounts, parseCounts } from './formulaBuilder';
import { atom, attach, capHydrogens, fuseRing, LEN, link, ringAt, sketch } from './molGeom';
import type { Sketch } from './molGeom';

const R6 = LEN.AR;          // 六元芳环外接圆半径（边长≈1.39）
const R5 = LEN.AR / (2 * Math.sin(Math.PI / 5)); // 五元环（同边长）

/* ================= 胺 / 酰胺 ================= */
/** 苯胺 C₆H₇N：苯环 + –NH₂ */
function buildAniline(): Sketch {
  const s = sketch();
  const r = ringAt(s, [0, 0, 0], R6, ['C', 'C', 'C', 'C', 'C', 'C'], { aromatic: true });
  attach(s, r[0], 'N', LEN.ARN);
  capHydrogens(s);
  return s;
}
/** 乙酰胺 C₂H₅NO：CH₃–CO–NH₂（肽键的模型分子） */
function buildAcetamide(): Sketch {
  const s = sketch();
  const c0 = atom(s, 'C', [-0.75, 0, 0]);
  const c1 = atom(s, 'C', [0.72, 0, 0]);
  link(s, c0, c1, 1);
  attach(s, c1, 'O', LEN.CdO, 2);
  attach(s, c1, 'N', 1.33);
  capHydrogens(s);
  return s;
}
/** 尿素 CH₄N₂O：CO(NH₂)₂ */
function buildUrea(): Sketch {
  const s = sketch();
  const c = atom(s, 'C', [0, 0, 0]);
  attach(s, c, 'O', LEN.CdO, 2);
  attach(s, c, 'N', 1.34);
  attach(s, c, 'N', 1.34);
  capHydrogens(s);
  return s;
}

/* ================= 硝基化合物 ================= */
/** 硝基苯 C₆H₅NO₂ */
function buildNitrobenzene(): Sketch {
  const s = sketch();
  const r = ringAt(s, [0, 0, 0], R6, ['C', 'C', 'C', 'C', 'C', 'C'], { aromatic: true });
  const n = attach(s, r[0], 'N', 1.49);
  attach(s, n, 'O', LEN.NO, 2);
  const o2 = attach(s, n, 'O', LEN.NO, 1);
  capHydrogens(s, { [o2]: 0 }); // 硝基的另一个氧带形式负电荷，不挂 H
  return s;
}
/** 硝基甲烷 CH₃NO₂ */
function buildNitromethane(): Sketch {
  const s = sketch();
  const c = atom(s, 'C', [0, 0, 0]);
  const n = attach(s, c, 'N', 1.49);
  attach(s, n, 'O', LEN.NO, 2);
  const o2 = attach(s, n, 'O', LEN.NO, 1);
  capHydrogens(s, { [o2]: 0 });
  return s;
}

/* ================= 腈 ================= */
/** 乙腈 C₂H₃N：CH₃–C≡N */
function buildAcetonitrile(): Sketch {
  const s = sketch();
  const c0 = atom(s, 'C', [-0.72, 0, 0]);
  const c1 = atom(s, 'C', [0.74, 0, 0]);
  link(s, c0, c1, 1);
  attach(s, c1, 'N', LEN.CtN, 3);
  capHydrogens(s);
  return s;
}
/** 丙烯腈 C₃H₃N：CH₂=CH–C≡N */
function buildAcrylonitrile(): Sketch {
  const s = sketch();
  const c0 = atom(s, 'C', [-1.38, 0, 0]);
  const c1 = atom(s, 'C', [-0.05, 0, 0]);
  const c2 = atom(s, 'C', [1.06, 0, 0]);
  link(s, c0, c1, 2);
  link(s, c1, c2, 1);
  attach(s, c2, 'N', LEN.CtN, 3);
  capHydrogens(s);
  return s;
}

/* ================= 重氮化合物 ================= */
/** 重氮甲烷 CH₂N₂：H₂C=N⁺=N⁻（线形重氮结构） */
function buildDiazomethane(): Sketch {
  const s = sketch();
  const c = atom(s, 'C', [-1.32, 0, 0]);
  const n1 = atom(s, 'N', [0, 0, 0]);
  const n2 = atom(s, 'N', [1.22, 0, 0]);
  link(s, c, n1, 2);
  link(s, n1, n2, 2);
  capHydrogens(s, { [n2]: 0 }); // 末端氮带形式负电荷，不挂 H
  return s;
}

/* ================= 含氮杂环 ================= */
/** 吡啶 C₅H₅N */
function buildPyridine(): Sketch {
  const s = sketch();
  ringAt(s, [0, 0, 0], R6, ['N', 'C', 'C', 'C', 'C', 'C'], { aromatic: true });
  capHydrogens(s);
  return s;
}
/** 嘧啶 C₄H₄N₂（1,3-二氮杂苯） */
function buildPyrimidine(): Sketch {
  const s = sketch();
  ringAt(s, [0, 0, 0], R6, ['N', 'C', 'N', 'C', 'C', 'C'], { aromatic: true });
  capHydrogens(s);
  return s;
}
/** 咪唑 C₃H₄N₂（1,3-二氮杂茂） */
function buildImidazole(): Sketch {
  const s = sketch();
  const r = ringAt(s, [0, 0, 0], R5, ['N', 'C', 'N', 'C', 'C'], { aromatic: true });
  capHydrogens(s, { [r[0]]: 1 }); // 吡咯型氮带 H
  return s;
}
/** 吲哚 C₈H₇N：苯并吡咯 */
function buildIndole(): Sketch {
  const s = sketch();
  const r = ringAt(s, [0, 0, 0], R6, ['C', 'C', 'C', 'C', 'C', 'C'], { aromatic: true });
  const pyr = fuseRing(s, r[0], r[1], ['N', 'C', 'C'], { aromatic: true });
  capHydrogens(s, { [pyr[0]]: 1 });
  return s;
}
/** 喹啉 C₉H₇N：苯并吡啶 */
function buildQuinoline(): Sketch {
  const s = sketch();
  const r = ringAt(s, [0, 0, 0], R6, ['C', 'C', 'C', 'C', 'C', 'C'], { aromatic: true });
  fuseRing(s, r[0], r[1], ['N', 'C', 'C', 'C'], { aromatic: true });
  capHydrogens(s);
  return s;
}

/* ================= 氨基酸 ================= */
/** 甘氨酸 C₂H₅NO₂：H₂N–CH₂–COOH */
function buildGlycine(): Sketch {
  const s = sketch();
  const n = atom(s, 'N', [-1.92, 0, 0]);
  const ca = atom(s, 'C', [-0.62, 0, 0]);
  const co = atom(s, 'C', [0.78, 0, 0]);
  link(s, n, ca, 1);
  link(s, ca, co, 1);
  attach(s, co, 'O', LEN.CdO, 2);
  attach(s, co, 'O', LEN.CO, 1);
  capHydrogens(s);
  return s;
}
/** 丙氨酸 C₃H₇NO₂：H₂N–CH(CH₃)–COOH */
function buildAlanine(): Sketch {
  const s = sketch();
  const n = atom(s, 'N', [-1.92, 0, 0]);
  const ca = atom(s, 'C', [-0.62, 0, 0]);
  const co = atom(s, 'C', [0.78, 0, 0]);
  link(s, n, ca, 1);
  link(s, ca, co, 1);
  const cb = attach(s, ca, 'C', LEN.CC);
  attach(s, co, 'O', LEN.CdO, 2);
  attach(s, co, 'O', LEN.CO, 1);
  void cb;
  capHydrogens(s);
  return s;
}
/** 谷氨酸 C₅H₉NO₄：HOOC–CH(NH₂)–CH₂–CH₂–COOH */
function buildGlutamicAcid(): Sketch {
  const s = sketch();
  const co1 = atom(s, 'C', [-2.2, 0, 0]);
  const ca = atom(s, 'C', [-0.85, 0, 0]);
  const cg = atom(s, 'C', [0.5, 0, 0]);
  const cb = atom(s, 'C', [1.85, 0, 0]);
  const co2 = atom(s, 'C', [3.2, 0, 0]);
  link(s, co1, ca, 1);
  link(s, ca, cg, 1);
  link(s, cg, cb, 1);
  link(s, cb, co2, 1);
  const n = attach(s, ca, 'N', LEN.CN);
  attach(s, co1, 'O', LEN.CdO, 2);
  attach(s, co1, 'O', LEN.CO, 1);
  attach(s, co2, 'O', LEN.CdO, 2);
  attach(s, co2, 'O', LEN.CO, 1);
  void n;
  capHydrogens(s);
  return s;
}

/* ================= 其它含氮物 ================= */
/** 三聚氰胺 C₃H₆N₆：1,3,5-三嗪 + 三个 –NH₂ */
function buildMelamine(): Sketch {
  const s = sketch();
  const r = ringAt(s, [0, 0, 0], 1.35, ['C', 'N', 'C', 'N', 'C', 'N'], { aromatic: true });
  r.forEach((i) => { if (s.atoms[i].el === 'C') attach(s, i, 'N', 1.34); });
  capHydrogens(s);
  return s;
}

/* ================= 目录 ================= */
interface NEntry {
  id: string;
  name: string;
  /** 分子式（标准元素序），用于检索匹配 */
  ascii: string;
  /** 习惯写法 / 结构简式（界面展示） */
  display?: string;
  category: string;
  level: string;
  desc: string;
  note?: string;
  acidity?: MoleculeData['acidity'];
  build: () => Sketch;
}

const CAT_N = '化合物 · 含氮有机物';
const CAT_AA = '化合物 · 氨基酸';
const CAT_RING = '化合物 · 含氮杂环';

const ENTRIES: NEntry[] = [
  {
    id: 'n_aniline', name: '苯胺', ascii: 'C6H7N', display: 'C6H5NH2',
    category: CAT_N, level: '拓展 · 有机',
    desc: '芳香胺：氨基 –NH₂ 直接连在苯环上。氮上孤对电子与苯环大 π 键共轭，因此碱性明显弱于甲胺等脂肪胺；是合成染料、药物的重要中间体。',
    acidity: { label: '弱碱', explain: '氨基孤对电子与苯环共轭后被分散，结合 H⁺ 的能力弱于脂肪胺，属弱碱。' },
    build: buildAniline,
  },
  {
    id: 'n_acetamide', name: '乙酰胺', ascii: 'C2H5NO', display: 'CH3CONH2',
    category: CAT_N, level: '拓展 · 有机',
    desc: '羧酸衍生物，含酰胺基 –CONH₂。酰胺键中的 C–N 因与羰基共轭而具有部分双键性质，键长缩短、趋于共平面，是蛋白质中肽键的模型分子。',
    acidity: { label: '中性', explain: '酰胺氮的孤对电子被羰基吸走，几乎不显碱性，水溶液近中性。' },
    build: buildAcetamide,
  },
  {
    id: 'n_urea', name: '尿素', ascii: 'CH4N2O', display: 'CO(NH2)2',
    category: CAT_N, level: '拓展 · 有机',
    desc: '碳酸的二酰胺 CO(NH₂)₂，分子中含两个氨基与一个羰基。它是人体蛋白质代谢的终产物，也是含氮量最高的常用氮肥（含 N 约 46%）。',
    acidity: { label: '中性', explain: '两个氨基的孤对电子均与羰基共轭，碱性极弱，水溶液近中性。' },
    build: buildUrea,
  },
  {
    id: 'n_nitrobenzene', name: '硝基苯', ascii: 'C6H5NO2', display: 'C6H5NO2',
    category: CAT_N, level: '拓展 · 有机',
    desc: '苯环上的氢被硝基 –NO₂ 取代的产物。硝基是强吸电子基，使苯环电子云密度降低，进一步发生亲电取代比苯困难，且主要进入间位。',
    acidity: { label: '中性', explain: '硝基化合物不电离，水溶液呈中性。' },
    build: buildNitrobenzene,
  },
  {
    id: 'n_nitromethane', name: '硝基甲烷', ascii: 'CH3NO2', display: 'CH3NO2',
    category: CAT_N, level: '拓展 · 有机',
    desc: '最简单的硝基化合物，可看作甲烷的一个氢被硝基 –NO₂ 取代。注意：硝基中与碳相连的是氮原子（C–N 键），而不是氧。',
    acidity: { label: '中性', explain: '硝基甲烷不电离；因硝基强吸电子，其 α-H 有一定酸性但远弱于羧酸。' },
    build: buildNitromethane,
  },
  {
    id: 'n_acetonitrile', name: '乙腈', ascii: 'C2H3N', display: 'CH3CN',
    category: CAT_N, level: '拓展 · 有机',
    desc: '含氰基 –C≡N 的腈类，分子中 C≡N 三键使氰基碳显较强正电性。乙腈是常用的极性非质子溶剂，广泛用于有机合成与色谱分析。',
    acidity: { label: '中性', explain: '腈类不电离，水溶液呈中性。' },
    build: buildAcetonitrile,
  },
  {
    id: 'n_acrylonitrile', name: '丙烯腈', ascii: 'C3H3N', display: 'CH2=CHCN',
    category: CAT_N, level: '拓展 · 有机',
    desc: 'CH₂=CH–C≡N，同时含碳碳双键与氰基，既能加成也能加聚。它是合成聚丙烯腈纤维（腈纶）的单体。',
    acidity: { label: '中性', explain: '腈类不电离，水溶液呈中性。' },
    build: buildAcrylonitrile,
  },
  {
    id: 'n_diazomethane', name: '重氮甲烷', ascii: 'CH2N2', display: 'CH2N2',
    category: CAT_N, level: '拓展 · 有机',
    desc: '最简单的重氮化合物，结构可写成 H₂C=N⁺=N⁻。分子中 C–N–N 近乎直线，是很强的甲基化试剂（能把羧酸变成甲酯），但毒性大且易爆炸。',
    note: '此处给出的是其共振式之一的示意结构（H₂C=N⁺=N⁻）。',
    acidity: { label: '中性', explain: '重氮甲烷在水中迅速分解/反应，一般不讨论其水溶液酸碱性。' },
    build: buildDiazomethane,
  },
  {
    id: 'n_pyridine', name: '吡啶', ascii: 'C5H5N', display: 'C5H5N',
    category: CAT_RING, level: '拓展 · 有机',
    desc: '含一个氮原子的六元芳香杂环，可看作苯环中一个 CH 被 N 取代。氮上的孤对电子不参与环的共轭体系，因此能与 H⁺ 结合，显弱碱性。',
    acidity: { label: '弱碱', explain: '氮上孤对电子未参与共轭，可接受 H⁺：C₅H₅N + H⁺ ⇌ C₅H₅NH⁺，显弱碱性。' },
    build: buildPyridine,
  },
  {
    id: 'n_pyrimidine', name: '嘧啶', ascii: 'C4H4N2', display: 'C4H4N2',
    category: CAT_RING, level: '拓展 · 有机',
    desc: '六元芳香杂环，1、3 位为两个氮原子（间位）。它是核酸碱基胞嘧啶、胸腺嘧啶、尿嘧啶的母核，也是许多药物的结构单元。',
    acidity: { label: '弱碱', explain: '环上两个氮均有未参与共轭的孤对电子，理论上可接受 H⁺，碱性弱于吡啶（两个氮相互吸电子）。' },
    build: buildPyrimidine,
  },
  {
    id: 'n_imidazole', name: '咪唑', ascii: 'C3H4N2', display: 'C3H4N2',
    category: CAT_RING, level: '拓展 · 有机',
    desc: '含两个氮的五元芳香杂环：一个氮带氢（吡咯型，孤对电子参与共轭），另一个为吡啶型氮（可结合 H⁺）。它存在于组氨酸的侧链中。',
    acidity: { label: '弱碱', explain: '吡啶型氮的孤对电子可接受 H⁺，咪唑既能作碱又能作酸（N–H 可给出 H⁺），是典型的两性杂环。' },
    build: buildImidazole,
  },
  {
    id: 'n_indole', name: '吲哚', ascii: 'C8H7N', display: 'C8H7N',
    category: CAT_RING, level: '拓展 · 有机',
    desc: '苯环与吡咯环稠合而成的双环（苯并吡咯），氮上带一个氢。它是色氨酸的侧链，也是许多生物碱与药物的母核。',
    acidity: { label: '中性', explain: '氮的孤对电子参与双环共轭，碱性极弱，通常视为中性。' },
    build: buildIndole,
  },
  {
    id: 'n_quinoline', name: '喹啉', ascii: 'C9H7N', display: 'C9H7N',
    category: CAT_RING, level: '拓展 · 有机',
    desc: '苯环与吡啶环稠合而成（苯并吡啶），氮为吡啶型。它是奎宁等生物碱以及多种抗疟药、染料的母核结构。',
    acidity: { label: '弱碱', explain: '环上氮的孤对电子未参与共轭，可与 H⁺ 结合生成喹啉盐，显弱碱性。' },
    build: buildQuinoline,
  },
  {
    id: 'n_glycine', name: '甘氨酸', ascii: 'C2H5NO2', display: 'H2NCH2COOH',
    category: CAT_AA, level: '拓展 · 有机',
    desc: '结构最简单的氨基酸 H₂N–CH₂–COOH，侧链只是一个氢。分子中同时有碱性的氨基与酸性的羧基，是典型的两性化合物。',
    acidity: { label: '中性', explain: '分子内氨基与羧基相互中和形成内盐，等电点时整体不带电；既能与酸反应也能与碱反应（两性）。' },
    build: buildGlycine,
  },
  {
    id: 'n_alanine', name: '丙氨酸', ascii: 'C3H7NO2', display: 'CH3CH(NH2)COOH',
    category: CAT_AA, level: '拓展 · 有机',
    desc: '侧链为甲基的氨基酸 CH₃–CH(NH₂)–COOH，是最常见的蛋白质组成单位之一，也有 α- 与 β- 两种位置异构。',
    acidity: { label: '中性', explain: '与甘氨酸同为中性氨基酸：一个氨基、一个羧基，等电点约为 pH 6。' },
    build: buildAlanine,
  },
  {
    id: 'n_glutamic', name: '谷氨酸', ascii: 'C5H9NO4', display: 'HOOC(CH2)2CH(NH2)COOH',
    category: CAT_AA, level: '拓展 · 有机',
    desc: '侧链上多一个羧基的酸性氨基酸 HOOC–CH(NH₂)–CH₂–CH₂–COOH。它参与脑内神经信号传递，其钠盐（味精）具有鲜味。',
    acidity: { label: '弱酸', explain: '分子中两个羧基多于一个氨基，等电点偏酸（约 pH 3.2），水溶液中显弱酸性。' },
    build: buildGlutamicAcid,
  },
  {
    id: 'n_melamine', name: '三聚氰胺', ascii: 'C3H6N6', display: 'C3H6N6',
    category: CAT_N, level: '拓展 · 有机',
    desc: '1,3,5-三嗪环上连有三个氨基，含氮量高达约 66.7%。它与甲醛缩合可制得三聚氰胺甲醛树脂（密胺餐具）；因含氮量高被非法用于虚假提高蛋白质检测值，须严格区分。',
    acidity: { label: '弱碱', explain: '环上氮与氨基均可接受 H⁺，水溶液呈弱碱性；与酸可生成盐。' },
    build: buildMelamine,
  },
];

/** 生成可浏览的含氮化合物目录 */
export function buildNitrogenCatalog(): MoleculeData[] {
  return ENTRIES.map((e) => {
    const counts = parseCounts(e.ascii) || {};
    const s = e.build();
    return {
      id: e.id,
      name: e.name,
      formula: displayFormula(formulaOfCounts(counts)),
      formulaDisplay: e.display ? displayFormula(e.display) : undefined,
      formulaAscii: formulaOfCounts(counts),
      category: e.category,
      level: e.level,
      scene: 'molecule' as const,
      desc: e.desc,
      note: e.note,
      atoms: s.atoms,
      bonds: s.bonds,
      acidity: e.acidity,
    };
  }).filter((m) => m.atoms.length > 0);
}
