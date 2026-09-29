import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme';
import Phys3DView from '../../components/Phys3DView';
import { FIELDS, type FieldId } from '../../physics/emContent';

type ViewMode = 'lines' | 'equi';
type SplitMode = 'a' | 'b' | 'sum';

/** 痛点一：3D 场线 + 流光粒子 + 可插拔的场强探针 + 等势面切换 */
export default function FieldLabScreen({ onBack }: { onBack: () => void }) {
  const insets = useSafeAreaInsets();
  const [field, setField] = useState<FieldId>('opp');
  const [view, setView] = useState<ViewMode>('lines');
  const [split, setSplit] = useState<SplitMode>('sum');
  const [probeOn, setProbeOn] = useState(true);
  const [probe, setProbe] = useState<{ mag: number; dir: number[]; pot: number | null; isB: boolean } | null>(null);

  const meta = FIELDS.find((f) => f.id === field) || FIELDS[0];

  const onEvent = useCallback((ev: { ev: string; [k: string]: unknown }) => {
    if (ev.ev === 'probe') {
      setProbe({
        mag: Number(ev.mag || 0),
        dir: (ev.dir as number[]) || [0, 0, 0],
        pot: ev.pot == null ? null : Number(ev.pot),
        isB: !!ev.isB,
      });
    }
  }, []);

  /** 首次命令（场切换）会整体重建场景 */
  const baseCmd = useMemo(
    () => ({ cmd: 'phys', action: 'field', id: field, view, mode: split, probe: probeOn }),
    [field, view, split, probeOn]
  );

  const pickField = (id: FieldId) => {
    setField(id);
    setProbe(null);
  };
  const pickView = (m: ViewMode) => setView(m);

  const unit = meta.kind === 'B' ? 'mT' : 'N/C';

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable style={styles.backBtn} onPress={onBack} accessibilityRole="button">
          <Ionicons name="chevron-back" size={18} color={colors.inkSoft} />
          <Text style={styles.backText}>电磁学</Text>
        </Pressable>
        <Text style={styles.title}>场的可视化实验室</Text>
      </View>

      <View style={styles.viewWrap}>
        <Phys3DView command={baseCmd} onEvent={onEvent} />
      </View>

      <ScrollView style={styles.panel} contentContainerStyle={styles.panelInner} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionTitle}>
          场（{meta.kind === 'B' ? '磁场' : '电场'}）
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {FIELDS.map((f) => {
            const on = f.id === field;
            return (
              <Pressable
                key={f.id}
                style={[styles.chip, on && (f.kind === 'B' ? styles.chipOnBlue : styles.chipOn)]}
                onPress={() => pickField(f.id)}
                accessibilityRole="button"
              >
                <Text style={[styles.chipKind, { color: f.kind === 'B' ? '#4aa8ff' : '#ff7a6a' }]}>
                  {f.kind === 'B' ? 'B' : 'E'}
                </Text>
                <Text style={[styles.chipText, on && styles.chipTextOn]}>{f.name}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <Text style={styles.sectionTitle}>视图</Text>
        <View style={styles.chips}>
          <Pressable style={[styles.chip, view === 'lines' && styles.chipOn]} onPress={() => pickView('lines')} accessibilityRole="button">
            <Text style={[styles.chipText, view === 'lines' && styles.chipTextOn]}>场线 + 流光</Text>
          </Pressable>
          <Pressable style={[styles.chip, view === 'equi' && styles.chipOn]} onPress={() => pickView('equi')} accessibilityRole="button">
            <Text style={[styles.chipText, view === 'equi' && styles.chipTextOn]}>
              {meta.kind === 'B' ? '等 |B| 面 / 切片' : '等势面'}
            </Text>
          </Pressable>
        </View>

        {meta.canSplit && (
          <>
            <Text style={styles.sectionTitle}>矢量叠加 · 亲眼看到"场的合成"</Text>
            <View style={styles.chips}>
              {(['a', 'sum', 'b'] as SplitMode[]).map((m) => {
                const on = split === m;
                return (
                  <Pressable
                    key={m}
                    style={[styles.chip, on && styles.chipOn]}
                    onPress={() => setSplit(m)}
                    accessibilityRole="button"
                  >
                    <Text style={[styles.chipText, on && styles.chipTextOn]}>
                      {meta.split ? meta.split[m] : m}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={styles.note}>
              先看"只有 A"，再看"只有 B"，最后切到叠加——每个点的总场就是两个场矢量相加。
            </Text>
          </>
        )}

        <Pressable
          style={[styles.bigBtn, probeOn && styles.bigBtnOn]}
          onPress={() => setProbeOn(!probeOn)}
          accessibilityRole="button"
        >
          <Ionicons name={probeOn ? 'locate' : 'locate-outline'} size={18} color="#fff" />
          <Text style={styles.bigBtnText}>{probeOn ? '探针已开启 · 拖动金色小球' : '开启场强探针'}</Text>
        </Pressable>

        {probeOn && probe != null && (
          <View style={styles.readCard}>
            <Text style={styles.readMain}>
              {meta.kind === 'B' ? 'B' : 'E'} = {probe.mag.toFixed(3)} {unit}
            </Text>
            <Text style={styles.readSub}>
              方向 ({probe.dir[0].toFixed(2)}, {probe.dir[1].toFixed(2)}, {probe.dir[2].toFixed(2)})
              {probe.pot != null ? `　V = ${probe.pot.toFixed(3)}` : ''}
            </Text>
            <Text style={styles.readNote}>
              拖动探针或轻点场景任意位置插针：数值随位置连续变化——场是逐点定义的。
            </Text>
          </View>
        )}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{view === 'lines' ? '看场线' : '看' + (meta.kind === 'B' ? '等 |B| 面' : '等势面')}</Text>
          <Text style={styles.cardBody}>{view === 'lines' ? meta.lines : meta.equi}</Text>
          <Text style={styles.cardNote}>
            {view === 'lines'
              ? '颜色与亮度 = 场的强弱，光点沿场线流动 = 场的方向。一根手指旋转，两指缩放。'
              : meta.kind === 'B'
                ? '热力图亮 = 磁场强，亮线是等值线；转动视角看立体分布。'
                : '半透明壳上每一点电势相等；转动视角，看它们如何包裹电荷。'}
          </Text>
        </View>
        <View style={{ height: 20 }} />
      </ScrollView>
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
  sectionTitle: { fontSize: 12.5, fontWeight: '700', color: colors.sub, marginTop: 8, marginBottom: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', paddingBottom: 4 },
  chip: {
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16,
    marginRight: 8, marginBottom: 6, backgroundColor: '#eef2f8',
    flexDirection: 'row', alignItems: 'center',
  },
  chipOn: { backgroundColor: colors.orange },
  chipOnBlue: { backgroundColor: '#3a7bff' },
  chipKind: { fontSize: 11, fontWeight: '800', marginRight: 5 },
  chipText: { color: colors.inkSoft, fontSize: 13, fontWeight: '600' },
  chipTextOn: { color: '#fff' },
  note: { fontSize: 12, color: colors.faint, marginTop: 2, lineHeight: 18 },
  bigBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#8a93a8', borderRadius: 14, paddingVertical: 11, marginTop: 12,
  },
  bigBtnOn: { backgroundColor: colors.orange },
  bigBtnText: { color: '#fff', fontWeight: '700', fontSize: 14, marginLeft: 8 },
  readCard: {
    backgroundColor: '#FFF7E8', borderRadius: 14, padding: 12, marginTop: 10,
    borderWidth: 1, borderColor: '#FFE1B0',
  },
  readMain: { fontSize: 16, fontWeight: '800', color: '#B25E00' },
  readSub: { fontSize: 12, color: colors.inkSoft, marginTop: 4 },
  readNote: { fontSize: 11.5, color: colors.faint, marginTop: 5, lineHeight: 17 },
  card: { backgroundColor: colors.card, borderRadius: 16, padding: 14, marginTop: 12 },
  cardTitle: { fontSize: 14, fontWeight: '800', color: colors.ink },
  cardBody: { fontSize: 13, color: colors.sub, marginTop: 6, lineHeight: 20 },
  cardNote: { fontSize: 11.5, color: colors.faint, marginTop: 7, lineHeight: 17 },
});
