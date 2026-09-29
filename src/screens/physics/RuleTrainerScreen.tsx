import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme';
import Phys3DView from '../../components/Phys3DView';
import { RULES, type RuleKey } from '../../physics/emContent';

type Feedback = { ok: boolean; answerCn: string; chooseCn: string } | null;

const DIR_OPTS: { k: string; label: string }[] = [
  { k: 'up', label: '上' },
  { k: 'down', label: '下' },
  { k: 'left', label: '左' },
  { k: 'right', label: '右' },
  { k: 'inn', label: '里' },
  { k: 'out', label: '外' },
];

/** 痛点二：三条定则各配一个可交互场景，先自己判断、App 当场判定，反例开关治"漏看条件" */
export default function RuleTrainerScreen({ onBack }: { onBack: () => void }) {
  const insets = useSafeAreaInsets();
  const [rule, setRule] = useState<RuleKey>('ampere');
  const meta = RULES.find((r) => r.key === rule) || RULES[0];

  // ampere
  const [bIn, setBIn] = useState(true);
  const [iUp, setIUp] = useState(true);
  const [parallel, setParallel] = useState(false);
  // lorentz
  const [qNeg, setQNeg] = useState(false);
  const [angle, setAngle] = useState(90);
  // rightHand
  const [bIn2, setBIn2] = useState(true);
  const [vRight, setVRight] = useState(true);
  const [reveal, setReveal] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);

  const choose = useCallback(
    (k: string) => {
      setFeedback(null);
      setParams((p) => ({ ...p, choose: k, reveal: false }));
    },
    []
  );

  /** 参数变化走轻量 param 命令；切场景才重建 */
  const [params, setParams] = useState<Record<string, unknown>>({ bIn: true, iUp: true, reveal: false });

  const onEvent = useCallback((ev: { ev: string; [k: string]: unknown }) => {
    if (ev.ev === 'answer') {
      setFeedback({
        ok: !!ev.ok,
        answerCn: String(ev.answerCn || ''),
        chooseCn: String(ev.chooseCn || ''),
      });
    }
  }, []);

  /** 场景命令：id 变了引擎会重建；id 不变时引擎只更新 params 并回调 onParams（轻量） */
  const sceneCmd = useMemo(
    () => ({ cmd: 'phys', action: 'scene', id: meta.scene, step: 0, params }),
    [meta.scene, params]
  );

  const switchRule = (k: RuleKey) => {
    setRule(k);
    setFeedback(null);
    setReveal(false);
    setParallel(false);
    if (k === 'ampere') setParams({ bIn, iUp, reveal: false });
    else if (k === 'lorentz') setParams({ q: qNeg ? -1 : 1, angle, reveal: false });
    else setParams({ bIn: bIn2, vRight, reveal: false });
  };

  const update = (patch: Record<string, unknown>) => {
    const next = { ...params, ...patch };
    setParams(next);
    setFeedback(null);
  };

  const showReveal = () => {
    setReveal(true);
    update({ choose: null, reveal: true });
  };

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable style={styles.backBtn} onPress={onBack} accessibilityRole="button">
          <Ionicons name="chevron-back" size={18} color={colors.inkSoft} />
          <Text style={styles.backText}>电磁学</Text>
        </Pressable>
        <Text style={styles.title}>三方向定则训练器</Text>
      </View>

      <View style={styles.viewWrap}>
        <Phys3DView command={sceneCmd} onEvent={onEvent} />
      </View>

      <ScrollView style={styles.panel} contentContainerStyle={styles.panelInner} showsVerticalScrollIndicator={false}>
        <View style={styles.chips}>
          {RULES.map((r) => {
            const on = r.key === rule;
            return (
              <Pressable key={r.key} style={[styles.chip, on && styles.chipOn]} onPress={() => switchRule(r.key)} accessibilityRole="button">
                <Ionicons name={r.icon} size={13} color={on ? '#fff' : colors.inkSoft} />
                <Text style={[styles.chipText, on && styles.chipTextOn]}>{r.title}</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.ruleCard}>
          <Text style={styles.ruleText}>{meta.rule}</Text>
        </View>

        {rule === 'ampere' && (
          <>
            <Row label="磁场 B">
              <Seg on={bIn} onChange={(v) => update({ bIn: v })} yes="⊗ 向里" no="⊙ 向外" />
            </Row>
            <Row label="电流 I">
              <Seg on={iUp} onChange={(v) => update({ iUp: v })} yes="沿棒向上" no="沿棒向下" />
            </Row>
            <Row label="反例开关">
              <Seg
                on={parallel}
                onChange={(v) => { setParallel(v); update({ variant: v ? 'parallel' : 'normal' }); }}
                yes="I ∥ B"
                no="I ⊥ B"
              />
            </Row>
          </>
        )}
        {rule === 'lorentz' && (
          <>
            <Row label="电荷">
              <Seg on={qNeg} onChange={(v) => { setQNeg(v); update({ q: v ? -1 : 1 }); }} yes="负电荷 −q" no="正电荷 +q" />
            </Row>
            <Row label="v 与 B 的夹角">
              <View style={styles.chips}>
                {[0, 30, 45, 60, 90].map((a) => (
                  <Pressable
                    key={a}
                    style={[styles.chip, angle === a && styles.chipOn]}
                    onPress={() => { setAngle(a); update({ angle: a }); }}
                    accessibilityRole="button"
                  >
                    <Text style={[styles.chipText, angle === a && styles.chipTextOn]}>
                      {a === 0 ? '0° 平行' : a === 90 ? '90° 垂直' : a + '°'}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </Row>
          </>
        )}
        {rule === 'rightHand' && (
          <>
            <Row label="磁场 B">
              <Seg on={bIn2} onChange={(v) => { setBIn2(v); update({ bIn: v }); }} yes="⊗ 向里" no="⊙ 向外" />
            </Row>
            <Row label="运动 v">
              <Seg on={vRight} onChange={(v) => { setVRight(v); update({ vRight: v }); }} yes="向右切割" no="向左切割" />
            </Row>
          </>
        )}

        {parallel && rule === 'ampere' ? (
          <View style={[styles.fbCard, { borderColor: '#FFE1B0', backgroundColor: '#FFF7E8' }]}>
            <Text style={[styles.fbMain, { color: '#B25E00' }]}>反例：I ∥ B 时 F = 0</Text>
            <Text style={styles.fbSub}>
              导体棒转到了与磁场平行的方向——此时无论电流多大，安培力都是零。这就是"垂直"这个前提条件不能少的原因。
            </Text>
          </View>
        ) : (
          <>
            <Text style={styles.sectionTitle}>
              {rule === 'lorentz' ? '粒子向哪边偏转？' : rule === 'rightHand' ? '回路电流方向是？' : '安培力指向哪？'}
            </Text>
            <View style={styles.chips}>
              {(rule === 'rightHand'
                ? [{ k: 'ccw', label: '逆时针' }, { k: 'cw', label: '顺时针' }]
                : rule === 'lorentz'
                  ? [...DIR_OPTS, { k: 'none', label: '不受力，走直线' }]
                  : DIR_OPTS
              ).map((o) => (
                <Pressable key={o.k} style={[styles.chip, styles.choiceChip]} onPress={() => choose(o.k)} accessibilityRole="button">
                  <Text style={styles.chipText}>{o.label}</Text>
                </Pressable>
              ))}
            </View>
            {feedback && (
              <View
                style={[
                  styles.fbCard,
                  feedback.ok ? { borderColor: '#B8ECCB', backgroundColor: '#EDFBF2' } : { borderColor: '#FFC9C9', backgroundColor: '#FFF1F0' },
                ]}
              >
                <Text style={[styles.fbMain, { color: feedback.ok ? '#1E7A46' : '#C21F1F' }]}>
                  {feedback.ok ? '✓ 判断正确！' : '✗ 再想想'}
                </Text>
                <Text style={styles.fbSub}>
                  {feedback.ok
                    ? `你选的「${feedback.chooseCn}」就是正确方向。`
                    : `你选了「${feedback.chooseCn}」，正确方向是「${feedback.answerCn}」。按 ${rule === 'ampere' ? '左手' : rule === 'lorentz' ? '左手' : '右手'}定则再摆一次手势试试。`}
                </Text>
              </View>
            )}
            <Pressable style={styles.revealBtn} onPress={showReveal} accessibilityRole="button">
              <Ionicons name="eye-outline" size={16} color={colors.inkSoft} />
              <Text style={styles.revealText}>直接看正确方向</Text>
            </Pressable>
          </>
        )}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>四步拆解</Text>
          {meta.steps.map((s) => (
            <Text key={s} style={styles.stepText}>{s}</Text>
          ))}
        </View>
        <View style={{ height: 20 }} />
      </ScrollView>
    </View>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={styles.rowBody}>{children}</View>
    </View>
  );
}

function Seg({ on, onChange, yes, no }: { on: boolean; onChange: (v: boolean) => void; yes: string; no: string }) {
  return (
    <View style={styles.seg}>
      <Pressable style={[styles.segBtn, !on && styles.segBtnOn]} onPress={() => onChange(false)} accessibilityRole="button">
        <Text style={[styles.segText, !on && styles.segTextOn]}>{no}</Text>
      </Pressable>
      <Pressable style={[styles.segBtn, on && styles.segBtnOn]} onPress={() => onChange(true)} accessibilityRole="button">
        <Text style={[styles.segText, on && styles.segTextOn]}>{yes}</Text>
      </Pressable>
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
  choiceChip: { backgroundColor: '#EDE7FB', marginRight: 8 },
  chipOn: { backgroundColor: colors.orange },
  chipText: { color: colors.inkSoft, fontSize: 13, fontWeight: '600', marginLeft: 4 },
  chipTextOn: { color: '#fff' },
  ruleCard: {
    backgroundColor: '#EDE7FB', borderRadius: 14, padding: 12, marginTop: 10,
  },
  ruleText: { fontSize: 13, lineHeight: 20, color: '#5B3FA8', fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  rowLabel: { fontSize: 13, color: colors.inkSoft, fontWeight: '700', width: 92 },
  rowBody: { flex: 1 },
  seg: { flexDirection: 'row', backgroundColor: '#eef2f8', borderRadius: 12, padding: 3 },
  segBtn: { flex: 1, paddingVertical: 6, borderRadius: 10, alignItems: 'center' },
  segBtnOn: { backgroundColor: '#fff', shadowColor: '#1f3764', shadowOpacity: 0.12, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 2 },
  segText: { fontSize: 12.5, color: colors.faint, fontWeight: '600' },
  segTextOn: { color: colors.orange },
  fbCard: { borderRadius: 14, borderWidth: 1, padding: 12, marginTop: 10 },
  fbMain: { fontSize: 14.5, fontWeight: '800' },
  fbSub: { fontSize: 12.5, color: colors.sub, marginTop: 4, lineHeight: 19 },
  revealBtn: { flexDirection: 'row', alignItems: 'center', alignSelf: 'center', marginTop: 10, paddingVertical: 6, paddingHorizontal: 14 },
  revealText: { fontSize: 12.5, color: colors.inkSoft, fontWeight: '600', marginLeft: 5 },
  card: { backgroundColor: colors.card, borderRadius: 16, padding: 14, marginTop: 12 },
  cardTitle: { fontSize: 14, fontWeight: '800', color: colors.ink },
  stepText: { fontSize: 12.5, color: colors.sub, marginTop: 7, lineHeight: 19 },
});
