import { useCallback, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme';
import { PROBES } from '../../math/setCase';
import { baseObj, withParams, type MathObj } from '../../math/setObject';
import InputZone from './zones/InputZone';
import CanvasZone from './zones/CanvasZone';
import MapZone from './zones/MapZone';
import TrackZone from './zones/TrackZone';
import VietaZone from './zones/VietaZone';
import ProbeZone from './zones/ProbeZone';
import ArchiveZone from './zones/ArchiveZone';
import { ZONE_TAGS, bindScroller, jumpToZone } from './zones/kit';

/**
 * 数学 · 集合与不等式 —— 一页打通
 *
 *   读题 → 看图（函数曲线 / 数轴 / Venn / 平面）→ 试参数（参数地图）
 *   → 写步骤（每一步能不能站住）→ 根的关系（韦达）→ 我的记录
 *   走到容易错的地方，底部会停下来问一句。
 *
 * 手机上一列往下看，电脑上自动排成三栏；五个区始终看的是同一道题。
 */
export default function SetLabScreen({ onBack }: { onBack: () => void }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const wide = width >= 980;

  const [obj, setObj] = useState<MathObj>(() => baseObj());
  const [preview, setPreview] = useState<{ vals: Record<string, number>; label: string } | null>(null);
  const [unresolved, setUnresolved] = useState<string[]>([]);
  const [queue, setQueue] = useState<string[]>([]);
  const [asked, setAsked] = useState<Record<string, boolean>>({});
  const fired = useRef<Set<string>>(new Set());

  const patch = useCallback((p: Partial<MathObj>) => setObj((o) => withParams({ ...o, ...p })), []);
  const replace = useCallback((o: MathObj) => setObj(withParams(o)), []);

  /** 触发一次提问：同一个问题一趟里只问一次 */
  const fireProbe = useCallback((pid: string) => {
    if (fired.current.has(pid)) return;
    fired.current.add(pid);
    setQueue((q) => (q.includes(pid) ? q : [...q, pid]));
  }, []);

  const currentProbe = useMemo(() => PROBES.find((p) => p.id === queue[0]) ?? null, [queue]);
  const closeProbe = useCallback(() => setQueue((q) => q.slice(1)), []);
  const answerProbe = useCallback((pid: string, ok: boolean) => {
    setAsked((prev) => ({ ...prev, [pid]: ok }));
    setQueue((q) => q.filter((x) => x !== pid));
  }, []);

  const locked = !!currentProbe;

  const onPreview = useCallback((vals: Record<string, number> | null, label: string | null) => {
    setPreview(vals && label ? { vals, label } : null);
  }, []);

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable style={styles.backBtn} onPress={onBack} accessibilityRole="button">
          <Ionicons name="chevron-back" size={18} color={colors.inkSoft} />
          <Text style={styles.backText}>返回</Text>
        </Pressable>
        <Text style={styles.title}>集合 · 不等式 · 韦达定理</Text>
      </View>

      {!wide ? (
        <View style={styles.jumpBar}>
          {ZONE_TAGS.map((t) => (
            <Pressable key={t} style={styles.jumpChip} onPress={() => jumpToZone(t)} accessibilityRole="button">
              <Text style={styles.jumpText}>{t}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      <ScrollView
        ref={(node) => bindScroller(node)}
        contentContainerStyle={[styles.body, { paddingBottom: 96 }]}
        showsVerticalScrollIndicator={false}
      >
        <InputZone obj={obj} replace={replace} patch={patch} locked={locked} fireProbe={fireProbe} />

        {wide ? (
          <View style={styles.deckWide}>
            <View style={styles.colLeft}>
              <MapZone obj={obj} patch={patch} onPreview={onPreview} locked={locked} fireProbe={fireProbe} />
            </View>
            <View style={styles.colCenter}>
              <CanvasZone
                obj={obj}
                previewVals={preview?.vals ?? null}
                previewLabel={preview?.label ?? null}
                unresolved={unresolved}
                locked={locked}
                fireProbe={fireProbe}
              />
            </View>
            <View style={styles.colRight}>
              <TrackZone obj={obj} patch={patch} onUnresolved={setUnresolved} locked={locked} fireProbe={fireProbe} />
              <VietaZone obj={obj} patch={patch} locked={locked} fireProbe={fireProbe} />
            </View>
          </View>
        ) : (
          <>
            <CanvasZone
              obj={obj}
              previewVals={preview?.vals ?? null}
              previewLabel={preview?.label ?? null}
              unresolved={unresolved}
              locked={locked}
              fireProbe={fireProbe}
            />
            <MapZone obj={obj} patch={patch} onPreview={onPreview} locked={locked} fireProbe={fireProbe} />
            <TrackZone obj={obj} patch={patch} onUnresolved={setUnresolved} locked={locked} fireProbe={fireProbe} />
            <VietaZone obj={obj} patch={patch} locked={locked} fireProbe={fireProbe} />
          </>
        )}

        <ArchiveZone />
      </ScrollView>

      <ProbeZone
        queue={queue}
        asked={asked}
        current={currentProbe}
        onClose={closeProbe}
        onAnswer={answerProbe}
        onFire={fireProbe}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: 16, paddingBottom: 6 },
  backBtn: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', marginBottom: 6 },
  backText: { fontSize: 14, color: colors.inkSoft, fontWeight: '600', marginLeft: 2 },
  title: { fontSize: 26, fontWeight: '800', color: colors.ink },
  jumpBar: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingBottom: 6,
  },
  jumpChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: '#EEF3FB',
    marginRight: 6,
  },
  jumpText: { fontSize: 11.5, fontWeight: '700', color: colors.inkSoft },
  body: { paddingHorizontal: 12, paddingTop: 2 },
  deckWide: { flexDirection: 'row', alignItems: 'flex-start' },
  colLeft: { flex: 0.9, marginRight: 8 },
  colCenter: { flex: 1.2 },
  colRight: { flex: 1, marginLeft: 8 },
});
