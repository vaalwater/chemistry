import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../../../theme';
import RatioSlider from '../../../components/RatioSlider';
import { Box, Chip, KV, Note, Zone } from '../zones/kit';
import { fitWin, samplesOf, tangencyAt, type ExtremeCase, type Win } from '../../../math/extreme';

function fmt(v: number, d = 3): string {
  if (!Number.isFinite(v)) return '—';
  return String(Number(v.toFixed(d)));
}

interface Props {
  kase: ExtremeCase;
  knobs: Record<string, number>;
  onKnob: (key: string, v: number) => void;
}

/**
 * λ 到底是什么 —— 影子价格。
 * 把约束里的那个常数拧一点点，看最优值跟着变多少；再和 λ 比一比：两者几乎一样。
 * 这一块让「λ 不仅仅是一个解方程用的中间变量」这件事落到实处。
 */
export default function LambdaZone({ kase, knobs, onKnob }: Props) {
  const knob = kase.knobs.find((k) => k.key === kase.cKey) ?? kase.knobs[0];
  const base = kase.solve(knobs);

  /** 微小扰动：约束常数一左一右各挪一小步，用中心差商估「最优值的变化率」 */
  const h = knob.step;
  const cLo = Math.max(knob.min, knobs[knob.key] - h);
  const cHi = Math.min(knob.max, knobs[knob.key] + h);
  const vLo = kase.solve({ ...knobs, [knob.key]: cLo }).value;
  const vHi = kase.solve({ ...knobs, [knob.key]: cHi }).value;
  const slope = cHi > cLo ? (vHi - vLo) / (cHi - cLo) : Number.NaN;

  /** 原解析解 vs 沿约束数值扫一遍的解（顺便核对一下答案） */
  const win: Win = useMemo(() => fitWin(kase.req(knobs), 1), [kase, knobs]);
  const hitCount = useMemo(() => samplesOf(kase, knobs, win, 120).length, [kase, knobs, win]);
  const tanBase = tangencyAt(kase, knobs, base.at);

  return (
    <Zone
      tag="λ 是什么"
      title="λ = 约束松开一点，最优值能变多少"
      sub="拉格朗日里那个 λ 不是凑出来的常数：它就是最优值对约束常数的变化率。经济学里叫「影子价格」。"
      color="#1fa97a"
    >
      <Box tone="soft">
        <View style={styles.knobHead}>
          <Text style={styles.knobName}>{knob.label}</Text>
          <Text style={styles.knobVal}>= {fmt(knobs[knob.key], 2)}</Text>
        </View>
        <RatioSlider
          value={knobs[knob.key]}
          min={knob.min}
          max={knob.max}
          marks={[{ value: knob.def, label: '默认' }]}
          onChange={(v) => onKnob(knob.key, Math.round(v / knob.step) * knob.step)}
        />
        <Text style={styles.caption}>
          拖一下这条，整套画面（约束曲线、最优点、最优值）都会动 —— 这就是「约束被挪了一点点」。
        </Text>
      </Box>

      <Box>
        <KV k="现在" v={`${kase.gText(knobs)} → 最优 ${fmt(base.value)}`} color={colors.accent} />
        <KV k="紧一点" v={`${kase.gText({ ...knobs, [knob.key]: cLo })} → 最优 ${fmt(vLo)}`} />
        <KV k="松一点" v={`${kase.gText({ ...knobs, [knob.key]: cHi })} → 最优 ${fmt(vHi)}`} color={colors.purple} />
        <KV k="实际斜率" v={`Δ最优 / Δ${knob.key} ≈ ${fmt(slope, 3)}`} />
        <KV k="λ（理论值）" v={`${fmt(base.lambda, 3)}　·　也是 ∇f 上的那个 λ：${fmt(tanBase.lambda, 3)}`} color="#1fa97a" />
      </Box>

      <Note
        text={`「实际斜率」和「λ」几乎一样 —— 这就是那句话的意思：Δ最优 ≈ λ · Δ${knob.key}，约束松一格，最优值就按 λ 这个价钱变。高考不考 λ，但它是这道题真正的「主变量」。`}
        tone="good"
        icon="trending-up-outline"
      />

      <View style={styles.row}>
        <Chip
          label="把约束挪回来"
          onPress={() => onKnob(knob.key, knob.def)}
          color="#1fa97a"
          icon="refresh-outline"
        />
        <Chip
          label={hitCount > 0 ? `约束上取了 ${hitCount} 个样点做对照` : '这个参数下视野里没有可取的点'}
          on
          onPress={() => {}}
          color={colors.faint}
        />
      </View>

      <Note
        text="把 λ 想象成「价格」：约束是资源，λ 告诉你多给它一单位的资源，成绩（最优值）能涨多少。"
        icon="pricetag-outline"
      />
    </Zone>
  );
}

const styles = StyleSheet.create({
  knobHead: { flexDirection: 'row', alignItems: 'baseline' },
  knobName: { fontSize: 11.5, fontWeight: '700', color: colors.inkSoft },
  knobVal: { fontSize: 12, fontWeight: '800', color: colors.accent, marginLeft: 4 },
  caption: { fontSize: 11, color: colors.faint, marginTop: 4, lineHeight: 16 },
  row: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 6 },
});
