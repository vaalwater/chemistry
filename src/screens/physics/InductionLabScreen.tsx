import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme';
import Phys3DView from '../../components/Phys3DView';

type Auto = 'in' | 'out' | 'stop';

/** 电磁感应探究台：磁铁插拔线圈，Φ 与 I 实时联动（下方曲线由引擎 2D 面板绘制） */
export default function InductionLabScreen({ onBack }: { onBack: () => void }) {
  const insets = useSafeAreaInsets();
  const [auto, setAuto] = useState<Auto>('in');
  const [N, setN] = useState(200);
  const [R, setR] = useState(50);
  const [flip, setFlip] = useState(false);
  const [reading, setReading] = useState<{ phi: number; I: number; x: number } | null>(null);

  const onEvent = useCallback((ev: { ev: string; [k: string]: unknown }) => {
    if (ev.ev === 'induction') {
      setReading({ phi: Number(ev.phi || 0), I: Number(ev.I || 0), x: Number(ev.x || 0) });
    }
  }, []);

  const cmd = useMemo(
    () => ({ cmd: 'phys', action: 'scene', id: 'induction', step: 0, params: { N, R, auto, flip } }),
    [N, R, auto, flip]
  );

  const Iabs = reading ? Math.abs(reading.I) : 0;

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable style={styles.backBtn} onPress={onBack} accessibilityRole="button">
          <Ionicons name="chevron-back" size={18} color={colors.inkSoft} />
          <Text style={styles.backText}>电磁学</Text>
        </Pressable>
        <Text style={styles.title}>电磁感应探究台</Text>
      </View>

      <View style={styles.viewWrap}>
        <Phys3DView command={cmd} onEvent={onEvent} />
      </View>

      <ScrollView style={styles.panel} contentContainerStyle={styles.panelInner} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionTitle}>磁铁运动</Text>
        <View style={styles.chips}>
          {([
            { k: 'in', label: '自动插入 ⇄ 拔出', icon: 'swap-horizontal' },
            { k: 'stop', label: '停住', icon: 'pause' },
          ] as { k: Auto; label: string; icon: string }[]).map((o) => (
            <Pressable key={o.k} style={[styles.chip, auto === o.k && styles.chipOn]} onPress={() => setAuto(o.k)} accessibilityRole="button">
              <Ionicons name={o.icon as any} size={13} color={auto === o.k ? '#fff' : colors.inkSoft} />
              <Text style={[styles.chipText, auto === o.k && styles.chipTextOn]}>{o.label}</Text>
            </Pressable>
          ))}
          <Pressable style={[styles.chip, flip && styles.chipOn]} onPress={() => setFlip(!flip)} accessibilityRole="button">
            <Ionicons name="sync" size={13} color={flip ? '#fff' : colors.inkSoft} />
            <Text style={[styles.chipText, flip && styles.chipTextOn]}>翻转磁极（N/S 对调）</Text>
          </Pressable>
        </View>

        <Text style={styles.sectionTitle}>线圈匝数 N = {N} 匝</Text>
        <Slider min={50} max={400} step={50} value={N} onChange={setN} />
        <Text style={styles.note}>匝数越多，同样的磁通变化率产生的感应电动势越大（ε = −N·ΔΦ/Δt）。</Text>

        <Text style={styles.sectionTitle}>回路电阻 R = {R} Ω</Text>
        <Slider min={10} max={100} step={10} value={R} onChange={setR} />
        <Text style={styles.note}>电阻越大，同样的电动势下电流越小（I = ε/R）。</Text>

        {reading != null && (
          <View style={styles.readCard}>
            <View style={styles.readRow}>
              <Text style={styles.readItem}>磁通量 Φ = {reading.phi.toFixed(3)}</Text>
              <Text style={[styles.readItem, { color: Iabs < 0.05 ? colors.faint : colors.orange }]}>
                感应电流 I = {reading.I.toFixed(2)} A
              </Text>
            </View>
            <Text style={styles.readNote}>
              {Iabs < 0.05
                ? '磁铁静止或在线圈远处：磁通量不变，就没有感应电流——"变化"才是关键。'
                : reading.I > 0
                  ? '磁通量正在增大 → 感应电流的磁场要"挡住"它（楞次定律：来者拒之）。'
                  : '磁通量正在减小 → 感应电流的磁场要"补上"它（楞次定律：去者留之）。'}
            </Text>
          </View>
        )}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>看图方法</Text>
          <Text style={styles.cardBody}>
            下方蓝线是穿过线圈的磁通量 Φ，橙线是感应电流 I。注意两个时刻：
            Φ 最大时（磁铁在线圈正中）I 恰好为零——因为那一刻磁通量"只大不小、还没开始变小"；
            而 Φ 变化最陡的时刻 I 最大。
          </Text>
        </View>
        <View style={{ height: 20 }} />
      </ScrollView>
    </View>
  );
}

function Slider({ min, max, step, value, onChange }: {
  min: number; max: number; step: number; value: number; onChange: (v: number) => void;
}) {
  const vals: number[] = [];
  for (let v = min; v <= max; v += step) vals.push(v);
  return (
    <View style={styles.sliderRow}>
      {vals.map((v) => (
        <Pressable
          key={v}
          style={[styles.tick, v === value && styles.tickOn]}
          onPress={() => onChange(v)}
          accessibilityRole="button"
          accessibilityLabel={String(v)}
        >
          <Text style={[styles.tickText, v === value && styles.tickTextOn]}>{v}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: 16, paddingBottom: 6 },
  backBtn: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', marginBottom: 6 },
  backText: { fontSize: 14, color: colors.inkSoft, fontWeight: '600', marginLeft: 2 },
  title: { fontSize: 22, fontWeight: '800', color: colors.ink },
  viewWrap: { flex: 1, minHeight: 250, marginHorizontal: 10, borderRadius: 16, overflow: 'hidden', backgroundColor: '#0a1026' },
  panel: { maxHeight: '46%' },
  panelInner: { paddingHorizontal: 14, paddingTop: 8 },
  sectionTitle: { fontSize: 12.5, fontWeight: '700', color: colors.sub, marginTop: 10, marginBottom: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', paddingBottom: 4 },
  chip: {
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16,
    marginRight: 8, marginBottom: 6, backgroundColor: '#eef2f8',
    flexDirection: 'row', alignItems: 'center',
  },
  chipOn: { backgroundColor: colors.orange },
  chipText: { color: colors.inkSoft, fontSize: 13, fontWeight: '600', marginLeft: 4 },
  chipTextOn: { color: '#fff' },
  note: { fontSize: 11.5, color: colors.faint, marginTop: 4, lineHeight: 17 },
  sliderRow: { flexDirection: 'row', flexWrap: 'wrap' },
  tick: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12,
    backgroundColor: '#eef2f8', marginRight: 7, marginBottom: 5,
  },
  tickOn: { backgroundColor: colors.orange },
  tickText: { fontSize: 12.5, color: colors.inkSoft, fontWeight: '700' },
  tickTextOn: { color: '#fff' },
  readCard: {
    backgroundColor: '#FFF7E8', borderRadius: 14, padding: 12, marginTop: 12,
    borderWidth: 1, borderColor: '#FFE1B0',
  },
  readRow: { flexDirection: 'row', flexWrap: 'wrap' },
  readItem: { fontSize: 13.5, fontWeight: '800', color: '#B25E00', marginRight: 16 },
  readNote: { fontSize: 12, color: colors.sub, marginTop: 6, lineHeight: 18 },
  card: { backgroundColor: colors.card, borderRadius: 16, padding: 14, marginTop: 12 },
  cardTitle: { fontSize: 14, fontWeight: '800', color: colors.ink },
  cardBody: { fontSize: 13, color: colors.sub, marginTop: 6, lineHeight: 20 },
});
