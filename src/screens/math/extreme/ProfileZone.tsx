import { useMemo } from 'react';
import { StyleSheet, Text } from 'react-native';
import { colors } from '../../../theme';
import FunctionGraph from '../../../components/FunctionGraph';
import { Box, KV, Note, Zone } from '../zones/kit';
import { fitWin, numericOpt, samplesOf, type ExtremeCase } from '../../../math/extreme';

function fmt(v: number, d = 2): string {
  if (!Number.isFinite(v)) return '—';
  return String(Number(v.toFixed(d)));
}

interface Props {
  kase: ExtremeCase;
  knobs: Record<string, number>;
}

/**
 * 比一比：
 *   ① 把约束「走一遍」画成一条普通的函数曲线 —— 极值就是这条曲线的谷底 / 峰顶（还是老办法）；
 *   ② 中学的均值不等式 / 柯西写法，和大学的拉格朗日逐条对照。
 * 两者合起来回答一个问题：为什么「等号成立条件」长得和「∇f ∥ ∇g」一样。
 */
export default function ProfileZone({ kase, knobs }: Props) {
  const sol = kase.solve(knobs);
  const win = useMemo(() => fitWin(kase.req(knobs), 1), [kase, knobs]);
  const samples = useMemo(() => samplesOf(kase, knobs, win, 200), [kase, knobs, win]);

  const tLo = samples.length ? samples[0].t : 0;
  const tHi = samples.length ? samples[samples.length - 1].t : 1;
  /** 数值最优点在「走了多远」这个坐标上的位置（圆的走法是角度，所以不能用 x 坐标代替） */
  const optT = useMemo(() => numericOpt(kase, knobs, win), [kase, knobs, win]);
  const optU = optT
    ? Math.max(0, Math.min(1, (optT.t - tLo) / Math.max(1e-9, tHi - tLo)))
    : Math.max(0, Math.min(1, (sol.at.x - tLo) / Math.max(1e-9, tHi - tLo)));

  /** 沿约束走了 u∈[0,1] 那么远的时候，f 的值 */
  const profile = (u: number) => kase.f(kase.walk(tLo + (tHi - tLo) * u, knobs), knobs);

  const midU = Math.max(0.02, Math.min(0.98, optU));

  return (
    <Zone
      tag="比一比"
      title="两种方法，同一件事"
      sub="把约束曲线从头走到尾，f 的值画出来就是一条普通曲线 —— 极值落在这个熟悉的「谷底 / 峰顶」；而中学的均值不等式、柯西说的「等号成立条件」，翻译过来就是 ∇f ∥ ∇g。"
      color={colors.orange}
    >
      <Text style={styles.head}>沿约束走一圈，f 的高度曲线</Text>
      {samples.length > 2 ? (
        <FunctionGraph
          f={profile}
          xLo={0}
          xHi={1}
          height={170}
          color={colors.accent}
          vertex={{ x: optU, y: sol.value }}
          marks={[
            { x: optU, y: sol.value, label: `${fmt(sol.value)}`, color: colors.orange },
            { x: midU, y: profile(midU), color: colors.faint },
          ]}
        />
      ) : null}
      <Text style={styles.foot}>
        横轴 = 沿着约束曲线走了多远（左边是起点，右边是终点）；纵轴 = 目标函数的值。
        极值出现在这条曲线的{' '}
        <Text style={{ fontWeight: '800', color: colors.orange }}>{kase.sense === 'min' ? '最低点' : '最高点'}</Text>
        ，也就是切线水平的地方 —— 和上面那句「沿约束的分量变成 0」是同一句话。
      </Text>

      <Box tone="soft">
        <Text style={styles.head}>中学写法</Text>
        {kase.classic(knobs).map((s, i) => (
          <Text key={i} style={styles.line}>
            · {s}
          </Text>
        ))}
      </Box>

      <Box>
        <KV k="等号成立" v={`x = ${fmt(sol.at.x, 3)}，y = ${fmt(sol.at.y, 3)}`} color={colors.purple} />
        <KV k="同一个点" v={`几何版：等高线与约束曲线在这里相切`} color={colors.green} />
        <KV k="同一件事" v={`代数版：∇f = λ∇g，λ = ${fmt(sol.lambda, 3)}`} color="#e5524a" />
      </Box>

      <Note
        text="所以「基本不等式的等号成立条件」和「拉格朗日条件」从来不是两套东西：前者用不等式语言说「最紧的那一刻」，后者用向量语言说同一件事。"
        tone="good"
        icon="git-compare-outline"
      />
    </Zone>
  );
}

const styles = StyleSheet.create({
  head: { fontSize: 12.5, fontWeight: '800', color: colors.ink, marginTop: 6 },
  foot: { fontSize: 11.5, color: colors.sub, lineHeight: 17, marginTop: 6 },
  line: { fontSize: 12, color: colors.inkSoft, lineHeight: 19, fontWeight: '600', marginTop: 3 },
});
