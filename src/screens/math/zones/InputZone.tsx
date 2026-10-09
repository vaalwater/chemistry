import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { colors } from '../../../theme';
import RatioSlider from '../../../components/RatioSlider';
import {
  GOAL_TEXT,
  OP_TEXT,
  QUANT_TEXT,
  baseObj,
  fromSymbol,
  inferFromDrag,
  objSummary,
  readNatural,
  withParams,
  type Goal,
  type MathObj,
  type Quant,
  type SetOp,
} from '../../../math/setObject';
import { NEG_INF, POS_INF, normalize } from '../../../math/setCore';
import { Box, Chip, KV, Note, Zone } from './kit';

type Entry = 'natural' | 'symbol' | 'drag';

const NL_SAMPLES = [
  '对任意 x∈[1,2]，x²-a≥0',
  'A={x|x²−ax+1≤0}，B=[1,3]，A⊆B',
  '存在 x∈[0,3]，使 x²−2x−a<0',
  '求 x²−ax+1≤0 的解集',
];

const SYM_SAMPLES = ['x²−ax+1≤0', '|x−a|≤2', 'x²−3x+2>0', '[1,3]', '{x | 1≤x≤3}'];

const DOMAIN_PRESETS: { label: string; lo: number; hi: number }[] = [
  { label: '[1,2]', lo: 1, hi: 2 },
  { label: '[1,3]', lo: 1, hi: 3 },
  { label: '[0,5]', lo: 0, hi: 5 },
  { label: '[−2,2]', lo: -2, hi: 2 },
];

const B_PRESETS = ['1≤x≤3', '0≤x≤5', 'x≥1', '−2≤x≤2'];

interface Props {
  obj: MathObj;
  replace: (o: MathObj) => void;
  patch: (p: Partial<MathObj>) => void;
  locked?: boolean;
  fireProbe: (pid: string) => void;
}

/** 最上面一块：把题目说清楚 —— 三种说法，落到同一道题 */
export default function InputZone({ obj, replace, patch, locked, fireProbe }: Props) {
  const [entry, setEntry] = useState<Entry>('natural');
  const [draft, setDraft] = useState('A={x|x²−ax+1≤0}，B=[1,3]，A⊆B');
  const [msg, setMsg] = useState<string | null>(null);
  const [showNeg, setShowNeg] = useState(false);

  // 拖图形入口的两个端点
  const [loVal, setLoVal] = useState(1);
  const [hiVal, setHiVal] = useState(3);
  const [loClosed, setLoClosed] = useState(true);
  const [hiClosed, setHiClosed] = useState(true);

  const gen = inferFromDrag({ lo: loVal, hi: hiVal, loClosed, hiClosed });
  const summary = objSummary(obj);
  const busy = !!locked;

  const apply = (fn: () => MathObj, okText: string) => {
    const next = withParams(fn());
    replace(next);
    setMsg(okText);
  };

  const commit = () => {
    if (entry === 'drag') {
      apply(() => ({ ...obj, source: gen.abs, goal: 'solve' as Goal, quant: 'none' as Quant }), `已经按数轴上的这一段写成：${gen.abs}`);
      return;
    }
    const raw = draft.trim();
    if (!raw) {
      setMsg('先写点东西，或者直接点下面的例子。');
      return;
    }
    if (entry === 'natural') apply(() => readNatural(raw, obj), '读好了：看看下面这几项对不对');
    else apply(() => ({ ...obj, source: fromSymbol(raw) }), `读好了：${fromSymbol(raw)}`);
  };

  const setDomain = (lo: number, hi: number) =>
    patch({
      domain: normalize([{ lo: { v: lo, closed: true }, hi: { v: hi, closed: true } }]),
      quant: obj.quant === 'none' ? 'forall' : obj.quant,
    });

  return (
    <Zone
      tag="读题"
      title="先把题目说清楚"
      sub="用中文写、用公式写、或者直接在数轴上拖一段 —— 三种说法最后都变成同一道题"
      color={colors.accent}
    >
      <View style={styles.entryRow}>
        <Chip label="用中文写" on={entry === 'natural'} onPress={() => setEntry('natural')} color={colors.accent} icon="chatbubble-outline" />
        <Chip label="用公式写" on={entry === 'symbol'} onPress={() => setEntry('symbol')} color={colors.accent} icon="code-slash-outline" />
        <Chip label="在数轴上拖" on={entry === 'drag'} onPress={() => setEntry('drag')} color={colors.accent} icon="swap-horizontal-outline" />
      </View>

      {entry === 'drag' ? (
        <Box tone="soft">
          <Text style={styles.sliderLabel}>左端点 {loVal.toFixed(1)}</Text>
          <RatioSlider value={loVal} min={-4} max={6} marks={[]} showMarks={false} onChange={(v) => setLoVal(Math.min(v, hiVal - 0.2))} />
          <Text style={styles.sliderLabel}>右端点 {hiVal.toFixed(1)}</Text>
          <RatioSlider value={hiVal} min={-4} max={6} marks={[]} showMarks={false} onChange={(v) => setHiVal(Math.max(v, loVal + 0.2))} />
          <View style={styles.entryRow}>
            <Chip label={loClosed ? '左端实心' : '左端空心'} on={loClosed} onPress={() => setLoClosed(!loClosed)} color={colors.cyan} />
            <Chip label={hiClosed ? '右端实心' : '右端空心'} on={hiClosed} onPress={() => setHiClosed(!hiClosed)} color={colors.cyan} />
          </View>
          <Note text={`这一段写成式子就是：${gen.abs}（也可以写成 ${gen.literal}）`} icon="git-branch-outline" />
        </Box>
      ) : (
        <View style={styles.inputWrap}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder={entry === 'natural' ? '比如：对任意 x∈[1,2]，x²-a≥0' : '比如：x^{2}-ax+1 \\le 0'}
            style={styles.input}
            autoCorrect={false}
            editable={!busy}
          />
        </View>
      )}

      <View style={styles.entryRow}>
        <Chip label="就按这个来 →" on color={colors.inkSoft} onPress={commit} icon="arrow-forward-circle-outline" />
        <Chip label="回到课本例题" onPress={() => replace(baseObj())} color={colors.faint} icon="refresh-outline" />
      </View>

      <View style={styles.samples}>
        {(entry === 'drag' ? [] : entry === 'natural' ? NL_SAMPLES : SYM_SAMPLES).map((s) => (
          <Chip
            key={s}
            label={s.length > 22 ? `${s.slice(0, 21)}…` : s}
            onPress={() => setDraft(s)}
            color={colors.faint}
            icon="document-text-outline"
          />
        ))}
      </View>

      {msg ? <Note text={msg} tone="good" icon="checkmark-circle-outline" /> : null}

      {/* 这道题的几个要素 */}
      <Box tone="soft">
        <Text style={styles.boxTitle}>这道题的几个要素</Text>
        {summary.map((kv) => (
          <KV key={kv.k} k={kv.k} v={kv.v} />
        ))}
      </Box>

      <Text style={styles.boxTitle}>题目问的是什么</Text>
      <View style={styles.entryRow}>
        {(['solve', 'hold', 'extreme'] as Goal[]).map((g) => (
          <Chip key={g} label={GOAL_TEXT[g]} on={obj.goal === g} onPress={() => patch({ goal: g })} color={colors.purple} />
        ))}
      </View>
      <View style={styles.entryRow}>
        {(['none', 'forall', 'exists'] as Quant[]).map((q) => (
          <Chip key={q} label={QUANT_TEXT[q]} on={obj.quant === q} onPress={() => patch({ quant: q })} color={colors.cyan} />
        ))}
        <Chip
          label="全体实数"
          on={obj.domain.length === 1 && obj.domain[0].lo.v === NEG_INF}
          onPress={() => patch({ domain: [{ lo: { v: NEG_INF, closed: false }, hi: { v: POS_INF, closed: false } }] })}
          color={colors.cyan}
        />
        {DOMAIN_PRESETS.map((d) => (
          <Chip key={d.label} label={d.label} onPress={() => setDomain(d.lo, d.hi)} color={colors.cyan} />
        ))}
      </View>
      {obj.quant !== 'none' ? (
        <View style={styles.negRow}>
          <Chip
            label={showNeg ? '收起否定' : '把这句话否定掉'}
            on={showNeg}
            onPress={() => {
              setShowNeg(!showNeg);
              fireProbe('p-quant');
            }}
            color={colors.orange}
            icon="remove-circle-outline"
          />
          {showNeg ? <Text style={styles.negText}>{negationOf(obj)}</Text> : null}
        </View>
      ) : null}

      <Text style={styles.boxTitle}>两个集合怎么放一起</Text>
      <View style={styles.entryRow}>
        {(['single', 'subset', 'intersect', 'union', 'diff', 'comp'] as SetOp[]).map((op) => (
          <Chip key={op} label={OP_TEXT[op]} on={obj.op === op} onPress={() => patch({ op })} color={colors.green} />
        ))}
      </View>
      {obj.op !== 'single' ? (
        <Box tone="soft">
          <Text style={styles.sliderLabel}>另一个集合 B 是什么</Text>
          <View style={styles.inputWrap}>
            <TextInput value={obj.sourceB} onChangeText={(t) => patch({ sourceB: t })} style={styles.input} editable={!busy} />
          </View>
          <View style={styles.entryRow}>
            {B_PRESETS.map((b) => (
              <Chip key={b} label={b} onPress={() => patch({ sourceB: b })} color={colors.green} icon="layers-outline" />
            ))}
          </View>
          <Note text="也可以到「试参数」那张地图里直接把 B 的两条边拖来拖去 —— 一边拖一边看哪些格子从 ✓ 变成 ✗。" icon="move-outline" />
        </Box>
      ) : null}
    </Zone>
  );
}

/** 命题的否定：∀↔∃，不等号连同等号一起反 */
export function negationOf(o: MathObj): string {
  const flip = (s: string): string =>
    s
      .replace(/>=/g, '≥')
      .replace(/<=/g, '≤')
      .replace(/≤/g, '\u0001')
      .replace(/≥/g, '\u0002')
      .replace(/</g, '≥')
      .replace(/>/g, '≤')
      .replace(/\u0001/g, '>')
      .replace(/\u0002/g, '<');
  const q = o.quant === 'forall' ? '∃' : '∀';
  const scope =
    o.domain.length === 1 && o.domain[0].lo.v === NEG_INF
      ? 'x∈R'
      : `x∈${o.domain.map((t) => `${t.lo.v}≤x≤${t.hi.v}`).join('∪')}`;
  return `反过来怎么说：${q} ${scope}，${flip(o.source)}`;
}

const styles = StyleSheet.create({
  entryRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 6 },
  inputWrap: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
    backgroundColor: '#F7FAFE',
    marginTop: 8,
  },
  input: { paddingHorizontal: 10, paddingVertical: 9, fontSize: 13, color: colors.ink },
  samples: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 4 },
  boxTitle: { fontSize: 11.5, fontWeight: '800', color: colors.faint, letterSpacing: 0.3, marginTop: 10, marginBottom: 4 },
  sliderLabel: { fontSize: 11.5, fontWeight: '700', color: colors.inkSoft, marginTop: 6, marginBottom: 2 },
  negRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', marginTop: 4 },
  negText: { flex: 1, fontSize: 12, color: colors.orange, fontWeight: '700', marginLeft: 8, lineHeight: 17 },
});
