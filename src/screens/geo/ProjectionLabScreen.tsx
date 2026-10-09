import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme';
import Geo3DView from '../../components/Geo3DView';
import { PROJ_MODES, SHAPES, type ShapeId } from '../../geometry/geoContent';
import type { EngineEvent } from '../../types';

/** 痛点一：3D 实体 ↔ 2D 直观图双向联动 + 表面展开 */
export default function ProjectionLabScreen({ onBack }: { onBack: () => void }) {
  const insets = useSafeAreaInsets();
  const [shape, setShape] = useState<ShapeId>('cube');
  const [proj, setProj] = useState<'oblique' | 'isometric'>('oblique');
  const [opened, setOpened] = useState(false);
  const [picked, setPicked] = useState<{ id: string; from: string } | null>(null);
  const [cmd, setCmd] = useState<object>({
    cmd: 'geo', action: 'shape', shape: 'cube', layout: 'split', proj: 'oblique',
  });

  const onEvent = useCallback((ev: EngineEvent) => {
    if (ev.ev === 'pick') {
      setPicked({ id: String(ev.id || ''), from: ev.source === '2d' ? '平面直观图' : '3D 模型' });
    }
  }, []);

  const pickShape = (id: ShapeId) => {
    setShape(id);
    setOpened(false);
    setPicked(null);
    setCmd({ cmd: 'geo', action: 'shape', shape: id, layout: 'split', proj });
  };
  const pickProj = (m: 'oblique' | 'isometric') => {
    setProj(m);
    setCmd({ cmd: 'geo', action: 'proj', mode: m });
  };
  const toggleOpen = () => {
    const next = !opened;
    setOpened(next);
    setCmd({ cmd: 'geo', action: 'unfold', t: next ? 1 : 0, animate: true });
  };

  const meta = SHAPES.find((s) => s.id === shape) || SHAPES[0];

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable style={styles.backBtn} onPress={onBack} accessibilityRole="button">
          <Ionicons name="chevron-back" size={18} color={colors.inkSoft} />
          <Text style={styles.backText}>返回</Text>
        </Pressable>
        <Text style={styles.title}>立体 ↔ 直观图</Text>
      </View>

      <View style={styles.viewWrap}>
        <Geo3DView command={cmd} onEvent={onEvent} />
      </View>

      <ScrollView style={styles.panel} contentContainerStyle={styles.panelInner} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionTitle}>几何体</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {SHAPES.map((s) => {
            const on = s.id === shape;
            return (
              <Pressable
                key={s.id}
                style={[styles.chip, on && styles.chipOn]}
                onPress={() => pickShape(s.id)}
                accessibilityRole="button"
              >
                <Text style={[styles.chipText, on && styles.chipTextOn]}>{s.name}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <Text style={styles.sectionTitle}>投影方式</Text>
        <View style={styles.chips}>
          {PROJ_MODES.map((m) => {
            const on = m.id === proj;
            return (
              <Pressable
                key={m.id}
                style={[styles.chip, on && styles.chipOn]}
                onPress={() => pickProj(m.id)}
                accessibilityRole="button"
              >
                <Text style={[styles.chipText, on && styles.chipTextOn]}>{m.name}</Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={styles.note}>{PROJ_MODES.find((m) => m.id === proj)?.desc}</Text>

        <Pressable style={styles.bigBtn} onPress={toggleOpen} accessibilityRole="button">
          <Ionicons name={opened ? 'contract-outline' : 'expand-outline'} size={18} color="#fff" />
          <Text style={styles.bigBtnText}>{opened ? '收起，回到立体' : '拆解展开看表面积'}</Text>
        </Pressable>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{meta.name}的表面积</Text>
          <Text style={styles.formula}>{meta.formula}</Text>
          <Text style={styles.cardBody}>展开图：{meta.net}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>看图例</Text>
          <View style={styles.legendRow}>
            <View style={styles.lineSolid} />
            <Text style={styles.legendText}>实线：从当前角度看得见的棱</Text>
          </View>
          <View style={styles.legendRow}>
            <View style={styles.lineDash} />
            <Text style={styles.legendText}>虚线：被挡住的棱（背面）</Text>
          </View>
          <View style={styles.legendRow}>
            <View style={styles.lineHi} />
            <Text style={styles.legendText}>橙色：你点中的那条棱</Text>
          </View>
          {picked ? (
            <Text style={styles.picked}>
              你在{picked.from}上点的是「{picked.id}」，3D 模型里它正在闪烁。
            </Text>
          ) : (
            <Text style={styles.hintText}>拖动上面转动立体，下面的直观图会同步；点直观图上的任意一条线试试。</Text>
          )}
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
  viewWrap: { flex: 1, minHeight: 260, marginHorizontal: 10, borderRadius: 16, overflow: 'hidden' },
  panel: { maxHeight: '46%' },
  panelInner: { paddingHorizontal: 14, paddingTop: 8 },
  sectionTitle: { fontSize: 12.5, fontWeight: '700', color: colors.sub, marginTop: 8, marginBottom: 6 },
  chips: { flexDirection: 'row', paddingBottom: 4 },
  chip: {
    paddingHorizontal: 13, paddingVertical: 7, borderRadius: 16,
    marginRight: 8, backgroundColor: '#eef2f8',
  },
  chipOn: { backgroundColor: colors.purple },
  chipText: { color: colors.inkSoft, fontSize: 13, fontWeight: '600' },
  chipTextOn: { color: '#fff' },
  note: { fontSize: 12, color: colors.faint, marginTop: 4, lineHeight: 18 },
  bigBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.purple, borderRadius: 14, paddingVertical: 11, marginTop: 12,
  },
  bigBtnText: { color: '#fff', fontWeight: '700', fontSize: 14, marginLeft: 8 },
  card: {
    backgroundColor: colors.card, borderRadius: 16, padding: 14, marginTop: 12,
  },
  cardTitle: { fontSize: 14, fontWeight: '800', color: colors.ink },
  formula: { fontSize: 15, fontWeight: '700', color: colors.purple, marginTop: 6 },
  cardBody: { fontSize: 12.5, color: colors.sub, marginTop: 6, lineHeight: 19 },
  legendRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  lineSolid: { width: 26, height: 3, backgroundColor: '#2f4a6d', borderRadius: 2, marginRight: 10 },
  lineDash: { width: 26, height: 0, borderTopWidth: 2, borderColor: '#9db0c8', borderStyle: 'dashed', marginRight: 10 },
  lineHi: { width: 26, height: 4, backgroundColor: '#ff8a3d', borderRadius: 2, marginRight: 10 },
  legendText: { fontSize: 12.5, color: colors.inkSoft, flex: 1 },
  picked: { fontSize: 12.5, color: colors.orange, fontWeight: '600', marginTop: 10, lineHeight: 19 },
  hintText: { fontSize: 12, color: colors.faint, marginTop: 10, lineHeight: 18 },
});
