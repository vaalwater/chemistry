import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme';
import { CASES, caseById, defaultKnobs } from '../../math/extreme';
import { bindScroller, jumpToZone } from './zones/kit';
import CaseZone from './extreme/CaseZone';
import StageZone from './extreme/StageZone';
import LambdaZone from './extreme/LambdaZone';
import ProfileZone from './extreme/ProfileZone';
import LagrangeZone from './extreme/LagrangeZone';

/**
 * 数学 · 最值 —— 在约束 g(x,y)=0 下求 f(x,y) 的极值
 *
 *   选题 → 几何（等高线推到相切 / ∇f 的切向分量变 0）
 *        → λ 是什么（影子价格）→ 比一比（中学不等式 vs 拉格朗日）→ 算一遍（手写三方程）
 *
 * 五个区始终说的是同一道题同一个参数。
 */

const ZONE_TAGS = ['选题', '几何', 'λ 是什么', '比一比', '算一遍'];

export default function ExtremeScreen({ onBack }: { onBack: () => void }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const wide = width >= 980;

  const [caseId, setCaseId] = useState('amgm');
  const kase = useMemo(() => caseById(caseId), [caseId]);

  /** 每个模型的参数各存一份，切回来的时候还在原处 */
  const [knobsAll, setKnobsAll] = useState<Record<string, Record<string, number>>>(() => {
    const out: Record<string, Record<string, number>> = {};
    CASES.forEach((c) => {
      out[c.id] = defaultKnobs(c);
    });
    return out;
  });
  const knobs = knobsAll[caseId] ?? defaultKnobs(kase);

  const pickCase = useCallback((id: string) => {
    setCaseId(id);
    setKnobsAll((prev) => (prev[id] ? prev : { ...prev, [id]: defaultKnobs(caseById(id)) }));
  }, []);

  const setKnob = useCallback(
    (key: string, v: number) => {
      setKnobsAll((prev) => ({ ...prev, [caseId]: { ...prev[caseId], [key]: v } }));
    },
    [caseId]
  );

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable style={styles.backBtn} onPress={onBack} accessibilityRole="button">
          <Ionicons name="chevron-back" size={18} color={colors.inkSoft} />
          <Text style={styles.backText}>返回</Text>
        </Pressable>
        <Text style={styles.title}>最值 · 约束下的极值</Text>
        <Text style={styles.subtitle}>
          均值不等式（x + 1/x ≥ 2）、「ax + by = c 求 1/x + 1/y」、圆与椭圆上的最大最小 —— 九道题
          全都是「在 g(x,y) = 0 上找 f 的极值」，全能用同一张动画讲明白：画布上等高线与约束都标了名字，还能拖着看、放大看
        </Text>
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
        <CaseZone kase={kase} knobs={knobs} onPick={pickCase} onKnob={setKnob} />

        {wide ? (
          <View style={styles.deck}>
            <View style={styles.colMain}>
              <StageZone kase={kase} knobs={knobs} />
              <LagrangeZone kase={kase} knobs={knobs} />
            </View>
            <View style={styles.colSide}>
              <LambdaZone kase={kase} knobs={knobs} onKnob={setKnob} />
              <ProfileZone kase={kase} knobs={knobs} />
            </View>
          </View>
        ) : (
          <>
            <StageZone kase={kase} knobs={knobs} />
            <LambdaZone kase={kase} knobs={knobs} onKnob={setKnob} />
            <ProfileZone kase={kase} knobs={knobs} />
            <LagrangeZone kase={kase} knobs={knobs} />
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: 16, paddingBottom: 6 },
  backBtn: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', marginBottom: 6 },
  backText: { fontSize: 14, color: colors.inkSoft, fontWeight: '600', marginLeft: 2 },
  title: { fontSize: 26, fontWeight: '800', color: colors.ink },
  subtitle: { fontSize: 11.5, color: colors.sub, lineHeight: 17, marginTop: 4 },
  jumpBar: { flexDirection: 'row', paddingHorizontal: 12, paddingBottom: 6 },
  jumpChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: '#EEF3FB',
    marginRight: 6,
  },
  jumpText: { fontSize: 11.5, fontWeight: '700', color: colors.inkSoft },
  body: { paddingHorizontal: 12, paddingTop: 2 },
  deck: { flexDirection: 'row', alignItems: 'flex-start' },
  colMain: { flex: 1.15, marginRight: 8 },
  colSide: { flex: 1 },
});
