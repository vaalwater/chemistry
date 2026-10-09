import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../../../theme';
import RatioSlider from '../../../components/RatioSlider';
import { Box, Chip, KV, Note, Zone } from '../zones/kit';
import { CASES, GROUPS, type ExtremeCase } from '../../../math/extreme';

function fmt(v: number): string {
  const r = Math.round(v * 100) / 100;
  return String(r);
}

interface Props {
  kase: ExtremeCase;
  knobs: Record<string, number>;
  onPick: (id: string) => void;
  onKnob: (key: string, v: number) => void;
}

/**
 * 选题区：四道题任选，参数随便拧。
 * 关键旁白：这四道题其实是同一道题 —— 在约束 g(x,y)=0 上找 f(x,y) 的极值。
 */
export default function CaseZone({ kase, knobs, onPick, onKnob }: Props) {
  return (
    <Zone
      tag="选题"
      title="挑一道题"
      sub="「x + 1/x ≥ 2」「ax + by = c 求 1/x + 1/y」「圆上 ax + by 最大」……看着是好几件事，其实是一件事：都是在一条约束曲线上，找目标函数取到极值的那一点。"
      color={colors.accent}
    >
      {GROUPS.map((g) => (
        <View key={g} style={styles.group}>
          <Text style={styles.groupName}>{g}</Text>
          <View style={styles.row}>
            {CASES.filter((c) => c.group === g).map((c) => (
              <Chip
                key={c.id}
                label={c.short}
                on={c.id === kase.id}
                onPress={() => onPick(c.id)}
                color={colors.accent}
                icon={c.id === kase.id ? 'checkmark-outline' : undefined}
              />
            ))}
          </View>
        </View>
      ))}

      <Box tone="soft">
        <Text style={styles.story}>
          <Text style={{ fontWeight: '800', color: colors.ink }}>{kase.name}：</Text>
          {kase.story}
        </Text>
        <KV k="目标 f" v={kase.sense === 'min' ? `${kase.fText}，求最小值` : `${kase.fText}，求最大值`} color={colors.accent} />
        <KV k="约束 g=0" v={kase.gText(knobs)} color={colors.green} />
        <KV k="定义域" v={kase.domainText} />
      </Box>

      {kase.knobs.map((k) => (
        <View key={k.key} style={styles.knob}>
          <View style={styles.knobHead}>
            <Text style={styles.knobName}>{k.label}</Text>
            <Text style={styles.knobVal}>= {fmt(knobs[k.key])}</Text>
          </View>
          <RatioSlider
            value={knobs[k.key]}
            min={k.min}
            max={k.max}
            marks={[{ value: k.def, label: '默认' }]}
            onChange={(v) => {
              const step = k.step;
              onKnob(k.key, Math.round(v / step) * step);
            }}
          />
        </View>
      ))}

      <Note
        text={`九道题、三种约束曲线（双曲线 / 直线 / 圆与椭圆），换题或动参数下面整页都会重画 —— 同一套几何解释，${CASES.length} 个模型全都成立。`}
        icon="swap-horizontal-outline"
      />
    </Zone>
  );
}

const styles = StyleSheet.create({
  group: { marginBottom: 2 },
  groupName: { fontSize: 10.5, fontWeight: '800', color: colors.faint, marginTop: 4, marginBottom: 1 },
  row: { flexDirection: 'row', flexWrap: 'wrap' },
  story: { fontSize: 12, color: colors.inkSoft, lineHeight: 18, fontWeight: '600' },
  knob: { marginTop: 8 },
  knobHead: { flexDirection: 'row', alignItems: 'baseline', marginBottom: 2 },
  knobName: { fontSize: 11.5, fontWeight: '700', color: colors.inkSoft },
  knobVal: { fontSize: 12, fontWeight: '800', color: colors.accent, marginLeft: 4 },
});
