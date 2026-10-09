import { StyleSheet, Text } from 'react-native';
import { colors } from '../../../theme';
import { Box, KV, Note, Zone } from '../zones/kit';
import { mul, sub, tangencyAt, type ExtremeCase, type V2 } from '../../../math/extreme';

function fmt(v: number, d = 3): string {
  if (!Number.isFinite(v)) return '—';
  const r = Number(v.toFixed(d));
  return String(r);
}
function vecText(v: V2, d = 3): string {
  return `(${fmt(v.x, d)}, ${fmt(v.y, d)})`;
}

interface Props {
  kase: ExtremeCase;
  knobs: Record<string, number>;
}

/**
 * 算一遍：把「相切」这句话翻译成三个方程。
 * 顺手把 ∇f − λ∇g 的残差算出来 —— 学生最吃这一口：「真的是 0」。
 */
export default function LagrangeZone({ kase, knobs }: Props) {
  const sol = kase.solve(knobs);
  const tan = tangencyAt(kase, knobs, sol.at);
  const residual = sub(tan.gradF, mul(sol.lambda, tan.gradG));
  const worst = Math.max(Math.abs(residual.x), Math.abs(residual.y));

  return (
    <Zone
      tag="算一遍"
      title="拉格朗日乘数法：把「相切」写成三个方程"
      sub="几何上的相切 = 两条梯度平行 = ∇f = λ∇g；再加上约束本身 g = 0，正好三个方程解 x、y、λ。"
      color={colors.purple}
    >
      <Box tone="soft">
        {kase.steps(knobs).map((s, i) => (
          <Text key={i} style={styles.step}>
            {s}
          </Text>
        ))}
      </Box>

      <Box>
        <KV k="最优点" v={`x = ${fmt(sol.at.x)}，y = ${fmt(sol.at.y)}`} color={colors.purple} />
        <KV k="最优值" v={fmt(sol.value)} color={colors.orange} />
        <KV k="∇f" v={`${vecText(tan.gradF)}　（指向 f 涨得最快的方向）`} color="#e5524a" />
        <KV k="∇g" v={`${vecText(tan.gradG)}　（垂直于约束曲线）`} color={colors.accent} />
        <KV k="λ" v={fmt(sol.lambda)} color="#1fa97a" />
        <KV
          k="验一验"
          v={`∇f − λ∇g = ${vecText(residual, 6)} → 最大分量 ${worst.toExponential(1)} ≈ 0`}
          color={colors.green}
        />
      </Box>

      <Note
        text="∇f 减去 λ 倍的 ∇g 等于 0，翻成人话就是：目标函数想往上涨的方向，被约束「刚好顶住」了 —— 沿约束再走一步，既不涨也不落。"
        icon="checkmark-done-outline"
      />
      <Note
        text="这也是为什么极值会出现在两个地方：不是驻点（梯度为零），就是边界 / 约束上。这里讨论的全部都是后者。"
        tone="warn"
        icon="information-circle-outline"
      />
    </Zone>
  );
}

const styles = StyleSheet.create({
  step: { fontSize: 12, color: colors.inkSoft, lineHeight: 20, fontWeight: '600' },
});
