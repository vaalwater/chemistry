// 生物碱 / 天然含氮产物 与 含氮高分子、功能材料的 3D 模型。
// 复杂天然产物给出「骨架近似」模型（原子组成与分子式一致，几何为教学示意）；高分子给出重复单元链段。
import type { MoleculeData } from './types';
import { displayFormula, formulaOfCounts, parseCounts } from './formulaBuilder';
import { add, atom, attach, capHydrogens, cross, dist, fuseRing, LEN, link, mul, norm, ringAt, sketch, sub } from './molGeom';
import type { Sketch } from './molGeom';

const R6 = LEN.AR;                 // 六元芳环半径
const R6S = 1.54;                  // 饱和六元环（椅式简化为平面）半径
const R5S = 1.54 / (2 * Math.sin(Math.PI / 5)); // 饱和五元环半径

/* ================= 嘌呤 / 生物碱 ================= */
/** 咖啡因 C₈H₁₀N₄O₂：1,3,7-三甲基黄嘌呤（嘌呤环 + 两个 C=O + 三个 N–CH₃） */
function buildCaffeine(): Sketch {
  const s = sketch();
  // 六元嘧啶环：N1-C2-N3-C4-C5-C6
  const r = ringAt(s, [0, 0, 0], R6, ['N', 'C', 'N', 'C', 'C', 'C'], { aromatic: true });
  // 在 C4–C5 边稠合咪唑环，新增 N7-C8-N9
  const five = fuseRing(s, r[3], r[4], ['N', 'C', 'N'], { aromatic: true });
  attach(s, r[1], 'O', LEN.CdO, 2);   // C2=O
  attach(s, r[5], 'O', LEN.CdO, 2);   // C6=O
  attach(s, r[0], 'C', LEN.CN);       // N1–CH₃
  attach(s, r[2], 'C', LEN.CN);       // N3–CH₃
  attach(s, five[0], 'C', LEN.CN);    // N7–CH₃
  void r;
  capHydrogens(s);
  return s;
}
/** 尼古丁 C₁₀H₁₄N₂：3-(N-甲基-2-吡咯烷基)吡啶 */
function buildNicotine(): Sketch {
  const s = sketch();
  const r = ringAt(s, [-2.1, 0, 0], R6, ['N', 'C', 'C', 'C', 'C', 'C'], { aromatic: true });
  // 吡咯烷环：连接位碳（第 1 个原子）朝向吡啶的 3 位碳
  const at = s.atoms[r[2]].pos;
  const d = norm([at[0] + 2.1, at[1], at[2]]);
  const center = [at[0] + d[0] * (R5S + LEN.CC), at[1] + d[1] * (R5S + LEN.CC), 0] as [number, number, number];
  const five = ringAt(s, center, R5S, ['C', 'N', 'C', 'C', 'C'], { start: Math.atan2(-d[1], -d[0]) });
  link(s, r[2], five[0], 1);
  attach(s, five[1], 'C', LEN.CN);    // N–CH₃
  capHydrogens(s);
  return s;
}
/** 肾上腺素 C₉H₁₃NO₃：儿茶酚（邻苯二酚）+ –CH(OH)–CH₂–NH–CH₃ 侧链 */
function buildAdrenaline(): Sketch {
  const s = sketch();
  const r = ringAt(s, [0, 0, 0], R6, ['C', 'C', 'C', 'C', 'C', 'C'], { aromatic: true });
  const cb = attach(s, r[0], 'C', LEN.CC);   // –CH(OH)–
  attach(s, cb, 'O', LEN.CO, 1);
  const cc = attach(s, cb, 'C', LEN.CC);     // –CH₂–
  const n = attach(s, cc, 'N', LEN.CN);      // –NH–CH₃
  attach(s, n, 'C', LEN.CN);
  attach(s, r[2], 'O', 1.37);                // 酚羟基 1
  attach(s, r[3], 'O', 1.37);                // 酚羟基 2
  capHydrogens(s);
  return s;
}
/** 吗啡 C₁₇H₁₉NO₃：骨架近似（芳环 + 环己烯 + 哌啶 + 4,5-醚桥 + 两个羟基） */
function buildMorphine(): Sketch {
  const s = sketch();
  const ar = ringAt(s, [0, 0, 0], R6, ['C', 'C', 'C', 'C', 'C', 'C'], { aromatic: true });
  // 稠合的环己烯环：ar[1]-C5-C6-C7=C8-ar[0]
  const cyc = fuseRing(s, ar[0], ar[1], ['C', 'C', 'C', 'C']);
  s.bonds.forEach((b) => {
    if ((b.a === cyc[2] && b.b === cyc[3]) || (b.a === cyc[3] && b.b === cyc[2])) b.order = 2; // C7=C8
  });
  // 哌啶环（N–CH₃），连接位碳朝 C8
  const p8 = s.atoms[cyc[3]].pos;
  const d = norm([p8[0], p8[1], 0]);
  const pc: [number, number, number] = [p8[0] + d[0] * (R6S + LEN.CC), p8[1] + d[1] * (R6S + LEN.CC), 0];
  const pip = ringAt(s, pc, R6S, ['C', 'N', 'C', 'C', 'C', 'C'], { start: Math.atan2(-d[1], -d[0]) });
  link(s, cyc[3], pip[0], 1);
  attach(s, pip[1], 'C', LEN.CN);            // N–CH₃
  // 芳环与哌啶之间的亚甲基桥（构成第五个环）
  const bridge = atom(s, 'C', mul(add(s.atoms[ar[4]].pos, s.atoms[pip[3]].pos), 0.5));
  link(s, bridge, ar[4], 1);
  link(s, bridge, pip[3], 1);
  // 酚羟基（芳环 3 位）与醇羟基（环己烯 6 位）
  attach(s, ar[3], 'O', 1.37);
  attach(s, cyc[1], 'O', LEN.CO);
  // 4,5-醚桥：连接芳环 4 位与环己烯 5 位，氧落在两碳连线中点的外侧
  const pa = s.atoms[ar[2]].pos;
  const pb = s.atoms[cyc[0]].pos;
  const mid = mul(add(pa, pb), 0.5);
  const half = dist(pa, pb) / 2;
  const off = Math.sqrt(Math.max(LEN.CO * LEN.CO - half * half, 0.04));
  let nv = norm(cross(norm(sub(pb, pa)), [0, 0, 1]));
  let cx = 0;
  let cy = 0;
  s.atoms.forEach((a) => { cx += a.pos[0]; cy += a.pos[1]; });
  cx /= s.atoms.length;
  cy /= s.atoms.length;
  if (nv[0] * (mid[0] - cx) + nv[1] * (mid[1] - cy) < 0) nv = mul(nv, -1);
  const o = atom(s, 'O', add(mid, mul(nv, off)));
  link(s, o, ar[2], 1);
  link(s, o, cyc[0], 1);
  capHydrogens(s);
  return s;
}
/** 奎宁 C₂₀H₂₄N₂O₂：6-甲氧基喹啉 + 甲醇桥 + 5-乙烯基奎核啶（骨架近似） */
function buildQuinine(): Sketch {
  const s = sketch();
  const ar = ringAt(s, [0, 0, 0], R6, ['C', 'C', 'C', 'C', 'C', 'C'], { aromatic: true });
  const py = fuseRing(s, ar[0], ar[1], ['N', 'C', 'C', 'C'], { aromatic: true });
  // 侧链 –CH(OH)– 连在喹啉 4 位（py[3]）
  const choh = attach(s, py[3], 'C', LEN.CC);
  attach(s, choh, 'O', LEN.CO, 1);
  // 奎核啶：哌啶式六元环 + N…C4 之间的 –CH₂CH₂– 桥
  const ph = s.atoms[choh].pos;
  const d = norm([ph[0], ph[1], 0]);
  const pc: [number, number, number] = [ph[0] + d[0] * (R6S + LEN.CC), ph[1] + d[1] * (R6S + LEN.CC), 0];
  const pip = ringAt(s, pc, R6S, ['C', 'N', 'C', 'C', 'C', 'C'], { start: Math.atan2(-d[1], -d[0]) });
  link(s, choh, pip[0], 1);
  const b1 = attach(s, pip[1], 'C', LEN.CN);   // 桥 CH₂（靠 N 一侧）
  const b2 = attach(s, b1, 'C', LEN.CC);
  link(s, b2, pip[3], 1);
  // 乙烯基
  const v1 = attach(s, pip[4], 'C', LEN.CdC);
  attach(s, v1, 'C', LEN.CdC, 2);
  // 6-甲氧基
  const om = attach(s, ar[3], 'O', 1.37);
  attach(s, om, 'C', LEN.CO);
  capHydrogens(s);
  return s;
}

/* ================= 含氮高分子 / 功能材料 ================= */
/** 尼龙 66（聚酰胺）重复单元：H₂N–(CH₂)₆–NH–CO–(CH₂)₄–COOH */
function buildNylon66(): Sketch {
  const s = sketch();
  const n1 = atom(s, 'N', [-4.6, 0, 0]);
  const c: number[] = [];
  for (let i = 0; i < 6; i++) c.push(atom(s, 'C', [-3.25 + i * 1.35, i % 2 ? 0.28 : -0.28, 0]));
  link(s, n1, c[0], 1);
  for (let i = 0; i < 5; i++) link(s, c[i], c[i + 1], 1);
  const n2 = atom(s, 'N', [4.9, 0, 0]);
  link(s, c[5], n2, 1);
  const co1 = atom(s, 'C', [6.3, 0.28, 0]);
  link(s, n2, co1, 1);
  attach(s, co1, 'O', LEN.CdO, 2, [0, 1, 0]);
  const d: number[] = [];
  for (let i = 0; i < 4; i++) d.push(atom(s, 'C', [7.65 + i * 1.35, i % 2 ? -0.28 : 0.28, 0]));
  link(s, co1, d[0], 1);
  for (let i = 0; i < 3; i++) link(s, d[i], d[i + 1], 1);
  const co2 = atom(s, 'C', [13.05, -0.28, 0]);
  link(s, d[3], co2, 1);
  attach(s, co2, 'O', LEN.CdO, 2, [0, -1, 0]);
  attach(s, co2, 'O', LEN.CO, 1, [1, 0, 0]);
  capHydrogens(s);
  return s;
}
/** 聚氨酯链段（氨基甲酸酯键）：CH₃O–CO–NH–(CH₂)₆–NH–CO–OCH₃ */
function buildPolyurethane(): Sketch {
  const s = sketch();
  const me1 = atom(s, 'C', [-6.2, 0, 0]);
  const o1 = atom(s, 'O', [-4.8, 0.2, 0]);
  link(s, me1, o1, 1);
  const co1 = atom(s, 'C', [-3.5, -0.2, 0]);
  link(s, o1, co1, 1);
  attach(s, co1, 'O', LEN.CdO, 2, [0, -1, 0]);
  const n1 = atom(s, 'N', [-2.2, 0.3, 0]);
  link(s, co1, n1, 1);
  const c: number[] = [];
  for (let i = 0; i < 6; i++) c.push(atom(s, 'C', [-0.9 + i * 1.35, i % 2 ? -0.28 : 0.28, 0]));
  link(s, n1, c[0], 1);
  for (let i = 0; i < 5; i++) link(s, c[i], c[i + 1], 1);
  const n2 = atom(s, 'N', [8.0, 0.3, 0]);
  link(s, c[5], n2, 1);
  const co2 = atom(s, 'C', [9.3, -0.2, 0]);
  link(s, n2, co2, 1);
  attach(s, co2, 'O', LEN.CdO, 2, [0, -1, 0]);
  const o2 = atom(s, 'O', [10.6, 0.2, 0]);
  link(s, co2, o2, 1);
  const me2 = atom(s, 'C', [12.0, -0.1, 0]);
  link(s, o2, me2, 1);
  capHydrogens(s);
  return s;
}
/** 三聚氰胺甲醛树脂交联片段：两个三嗪环经 –NH–CH₂–NH– 连接 */
function buildMelamineResin(): Sketch {
  const s = sketch();
  const mk = (cx: number): number[] => {
    const r = ringAt(s, [cx, 0, 0], 1.35, ['C', 'N', 'C', 'N', 'C', 'N'], { aromatic: true });
    const nh: number[] = [];
    r.forEach((i) => { if (s.atoms[i].el === 'C') nh.push(attach(s, i, 'N', 1.34)); });
    return nh;
  };
  const a = mk(-3.0);
  const b = mk(3.0);
  const bridge = atom(s, 'C', mul(add(s.atoms[a[0]].pos, s.atoms[b[0]].pos), 0.5));
  link(s, bridge, a[0], 1);
  link(s, bridge, b[0], 1);
  capHydrogens(s);
  return s;
}
/** 聚丙烯腈链段：–[CH₂–CH(CN)]₃–（三个重复单元） */
function buildPolyacrylonitrile(): Sketch {
  const s = sketch();
  const c: number[] = [];
  for (let i = 0; i < 6; i++) c.push(atom(s, 'C', [(i - 2.5) * 1.5, i % 2 ? 0.32 : -0.32, 0]));
  for (let i = 0; i < 5; i++) link(s, c[i], c[i + 1], 1);
  [1, 3, 5].forEach((i) => {
    const cn = attach(s, c[i], 'C', LEN.CC);
    attach(s, cn, 'N', LEN.CtN, 3);
  });
  capHydrogens(s);
  return s;
}

/* ================= 目录 ================= */
interface BEntry {
  id: string;
  name: string;
  ascii: string;
  display?: string;
  category: string;
  level: string;
  desc: string;
  note?: string;
  acidity?: MoleculeData['acidity'];
  build: () => Sketch;
}

const CAT_ALK = '化合物 · 生物碱与天然产物';
const CAT_POLY = '化合物 · 含氮高分子';

const ENTRIES: BEntry[] = [
  {
    id: 'b_caffeine', name: '咖啡因', ascii: 'C8H10N4O2', display: 'C8H10N4O2',
    category: CAT_ALK, level: '拓展 · 有机',
    desc: '1,3,7-三甲基黄嘌呤，属嘌呤类生物碱，存在于咖啡、茶叶与可乐中。分子含两个羰基与四个氮原子，能阻断腺苷受体而起到提神作用。',
    acidity: { label: '弱碱', explain: '环上氮可与强酸成盐，但碱性很弱；其水溶液接近中性。' },
    build: buildCaffeine,
  },
  {
    id: 'b_nicotine', name: '尼古丁', ascii: 'C10H14N2', display: 'C10H14N2',
    category: CAT_ALK, level: '拓展 · 有机',
    desc: '烟草中的主要生物碱，由吡啶环与 N-甲基吡咯烷环组成。分子中两个氮都能结合 H⁺，因此可与酸生成盐；是烟草成瘾性的主要来源。',
    acidity: { label: '弱碱', explain: '吡啶氮与吡咯烷氮均为碱性中心，可与酸成盐（如烟碱硫酸盐）。' },
    build: buildNicotine,
  },
  {
    id: 'b_morphine', name: '吗啡', ascii: 'C17H19NO3', display: 'C17H19NO3',
    category: CAT_ALK, level: '拓展 · 有机',
    desc: '罂粟中的异喹啉类生物碱，含酚羟基、醇羟基、醚桥与叔胺（N–CH₃）等官能团。既是强效镇痛药，也具有很强的成瘾性，属严格管制物质。',
    note: '完整结构为五环稠合体系，此处给出的是保留全部官能团与原子组成的骨架近似模型。',
    acidity: { label: '弱碱', explain: '叔胺氮可与酸成盐（临床常用其盐酸盐/硫酸盐）；酚羟基又使其略带酸性，属两性分子。' },
    build: buildMorphine,
  },
  {
    id: 'b_quinine', name: '奎宁', ascii: 'C20H24N2O2', display: 'C20H24N2O2',
    category: CAT_ALK, level: '拓展 · 有机',
    desc: '金鸡纳树皮中的喹啉类生物碱，含喹啉环、奎核啶环（双环叔胺）、醇羟基、甲氧基与乙烯基。它是经典的抗疟药，也是奎宁水的苦味来源。',
    note: '完整结构含奎核啶双环体系，此处给出的是保留全部官能团与原子组成的骨架近似模型。',
    acidity: { label: '弱碱', explain: '喹啉氮与奎核啶氮均可结合 H⁺，临床常用其硫酸盐/盐酸盐以增加溶解度。' },
    build: buildQuinine,
  },
  {
    id: 'b_adrenaline', name: '肾上腺素', ascii: 'C9H13NO3', display: 'C9H13NO3',
    category: CAT_ALK, level: '拓展 · 有机',
    desc: '儿茶酚（邻苯二酚）为母体、侧链为 –CH(OH)–CH₂–NH–CH₃ 的儿茶酚胺。它是肾上腺髓质分泌的激素，能使心跳加快、血压升高（应激反应）。',
    acidity: { label: '弱碱', explain: '侧链仲胺氮可结合 H⁺ 显弱碱性；酚羟基又带弱酸性，为两性分子。' },
    build: buildAdrenaline,
  },
  {
    id: 'p_nylon66', name: '尼龙 66（聚酰胺）', ascii: 'C12H24N2O3', display: 'H2N(CH2)6NHCO(CH2)4COOH',
    category: CAT_POLY, level: '拓展 · 材料',
    desc: '由己二胺与己二酸缩聚而成的聚酰胺，链中含大量酰胺键 –CO–NH–，链间可形成氢键，因而强度高、耐磨。图中为一个重复单元（两端封端）的链段。',
    note: '实际高分子的聚合度可达数百，此处以一个重复单元示意其链结构与酰胺键。',
    acidity: { label: '中性', explain: '酰胺键不电离，尼龙本身不溶于水也不显酸碱性（强酸强碱下可水解）。' },
    build: buildNylon66,
  },
  {
    id: 'p_polyurethane', name: '聚氨酯', ascii: 'C10H20N2O4', display: 'CH3OOCNH(CH2)6NHCOOCH3',
    category: CAT_POLY, level: '拓展 · 材料',
    desc: '由二异氰酸酯与多元醇加成聚合而成，主链含氨基甲酸酯键 –NH–CO–O–。通过改变原料可得到泡沫、弹性体、涂料、黏合剂等不同形态的材料。',
    note: '图中为含两个氨基甲酸酯键的链段示意。',
    acidity: { label: '中性', explain: '氨基甲酸酯键不电离，材料整体呈中性。' },
    build: buildPolyurethane,
  },
  {
    id: 'p_melamine_resin', name: '三聚氰胺树脂', ascii: 'C7H12N12', display: 'C7H12N12',
    category: CAT_POLY, level: '拓展 · 材料',
    desc: '三聚氰胺与甲醛缩合交联得到的热固性树脂（密胺树脂）。三嗪环之间通过 –NH–CH₂–NH– 亚甲基桥连接成三维网状结构，硬度高、耐热、耐水，常用于餐具层压板。',
    note: '图中为两个三嗪环经一个亚甲基桥交联的片段示意，实际为三维网状大分子。',
    acidity: { label: '中性', explain: '固化后氨基多已参与交联，材料耐酸碱、整体呈中性。' },
    build: buildMelamineResin,
  },
  {
    id: 'p_polyacrylonitrile', name: '聚丙烯腈', ascii: 'C9H11N3', display: '(CH2CHCN)3',
    category: CAT_POLY, level: '拓展 · 材料',
    desc: '由丙烯腈 CH₂=CH–CN 加聚而成，侧链上挂着规律的氰基 –C≡N，因此纤维保暖性好、手感似羊毛（腈纶，人称「合成羊毛」）；也是制备碳纤维的主要前驱体。',
    note: '图中为三个重复单元的链段示意，实际聚合度可达数千。',
    acidity: { label: '中性', explain: '腈基不电离，聚丙烯腈纤维呈中性、耐酸碱。' },
    build: buildPolyacrylonitrile,
  },
];

/** 生成可浏览的生物碱 / 含氮高分子目录 */
export function buildBioCatalog(): MoleculeData[] {
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
