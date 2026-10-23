import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { content } from '../data';
import { colors } from '../theme';
import type { ReactionData, ReactionDrama, ReactionEnv } from '../types';
import { deriveDramaFromInputs, dramaForKnownReaction } from '../reactionEngine';

const SAMPLES: { a: string; b: string; label: string }[] = [
  { a: 'Zn', b: 'HCl', label: '金属 + 酸' },
  { a: 'CH4', b: 'O2', label: '燃烧' },
  { a: 'NaOH', b: 'HCl', label: '中和' },
  { a: 'CaCO3', b: 'HCl', label: '盐 + 酸' },
  { a: 'H2O2', b: '', label: '分解' },
  { a: 'CO2', b: 'Ca(OH)2', label: '检验 CO₂' },
];

/** 环境三档。目前只对离子方程式生效 —— 分子式那条推导还没有介质概念 */
const ENV_OPTIONS: { key: ReactionEnv; label: string; hint: string }[] = [
  { key: 'acid', label: '酸性', hint: '溶液中有大量 H⁺' },
  { key: 'neutral', label: '中性', hint: '纯水或中性盐溶液' },
  { key: 'base', label: '碱性', hint: '溶液中有大量 OH⁻' },
];

/**
 * 离子模式的样例：把环境连同反应物一起带上。
 * 特意放进了 MnO₄⁻ 的三种介质 —— 点一下就能直接看到同一个氧化剂在不同环境下的产物差异。
 */
const ION_SAMPLES: { a: string; b: string; env: ReactionEnv; label: string }[] = [
  { a: 'Ag+', b: 'Cl-', env: 'neutral', label: '沉淀' },
  { a: 'Ba2+', b: 'SO4 2-', env: 'neutral', label: '检验 SO₄²⁻' },
  { a: 'Fe3+', b: 'OH-', env: 'neutral', label: '生成沉淀' },
  { a: 'Al3+', b: 'OH-', env: 'base', label: '两性' },
  { a: 'MnO4-', b: 'Fe2+', env: 'acid', label: '酸性 → Mn²⁺' },
  { a: 'MnO4-', b: 'Fe2+', env: 'neutral', label: '中性 → MnO₂' },
  { a: 'MnO4-', b: 'Fe2+', env: 'base', label: '碱性 → MnO₄²⁻' },
  { a: 'MnO4-', b: 'SO3 2-', env: 'acid', label: '酸性氧化 SO₃²⁻' },
  { a: 'Cl2', b: 'OH-', env: 'base', label: '氯气歧化' },
  { a: 'NO2', b: 'OH-', env: 'base', label: 'NO₂ 歧化' },
  { a: 'Al', b: 'H+', env: 'acid', label: '铝溶于酸' },
  { a: 'Al', b: 'OH-', env: 'base', label: '铝溶于碱' },
  { a: 'H+', b: 'OH-', env: 'neutral', label: '中和本质' },
];

function typeTone(type: string): string {
  const t = type || '';
  if (t.includes('分解')) return '#b04a12';
  if (t.includes('置换')) return '#2f7d31';
  if (t.includes('化合')) return '#3a6fd8';
  if (t.includes('中和') || t.includes('复分解')) return '#8a5cc0';
  return '#5a6b8c';
}

export default function ReactionsScreen({
  onPlayReaction,
}: {
  onPlayReaction: (drama: ReactionDrama) => void;
}) {
  const [a, setA] = useState('');
  const [b, setB] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  /** 是否按离子方程式处理：勾选后可以写离子，配平加电荷守恒，同时解锁环境参数 */
  const [ionic, setIonic] = useState(false);
  const [env, setEnv] = useState<ReactionEnv>('neutral');
  const insets = useSafeAreaInsets();

  const launch = (drama: ReactionDrama) => {
    setMsg(null);
    onPlayReaction(drama);
  };
  const playKnown = (rx: ReactionData) => {
    const dr = dramaForKnownReaction(rx);
    if (dr) launch(dr);
    else setMsg({ ok: false, text: '该实验暂时缺少分子几何数据，无法进入 3D 演示。' });
  };

  const submit = () => {
    if (!a.trim() && !b.trim()) {
      setMsg({
        ok: false,
        text: ionic ? '请先填写反应物离子（如 Ag+、Cl-）。' : '请先填写反应物 A（可只填一个做分解反应）。',
      });
      return;
    }
    const res = deriveDramaFromInputs(a, b, { ionic, env });
    if (!res.drama) {
      setMsg({
        ok: false,
        text: res.error || (ionic ? '推导失败，请检查离子的写法。' : '推导失败，请检查分子式写法。'),
      });
      return;
    }
    setMsg(res.note ? { ok: true, text: res.note } : null);
    launch(res.drama);
  };

  return (
    <View style={styles.root}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          {/* 不做沉浸式：内容从状态栏（时间/信号）下方开始 */}
          <View style={[styles.hero, { paddingTop: insets.top + 14 }]}>
            <Text style={styles.title}>反应 · 电子级演示</Text>
            <Text style={styles.subtitle}>
              输入分子式 → 自动推导并配平 → 3D 分步观察「断键 → 电子得失/转移 → 重新成键」
            </Text>

            <View style={styles.inputCard}>
              {/* 离子方程式开关 + 环境参数 */}
              <Pressable
                style={styles.switchRow}
                onPress={() => setIonic((v) => !v)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: ionic }}
              >
                <View style={[styles.checkBox, ionic && styles.checkBoxOn]}>
                  {ionic ? <Ionicons name="checkmark" size={13} color="#fff" /> : null}
                </View>
                <View style={styles.switchText}>
                  <Text style={styles.switchLabel}>离子方程式</Text>
                  <Text style={styles.switchHint}>
                    勾选后反应物可以写离子（Ag⁺、MnO₄⁻、Fe³⁺…），配平同时满足电荷守恒
                  </Text>
                </View>
              </Pressable>

              {ionic ? (
                <View style={styles.envBlock}>
                  <View style={styles.envHead}>
                    <Text style={styles.envTitle}>环境（溶液酸碱性）</Text>
                    <Text style={styles.envHint}>{ENV_OPTIONS.find((o) => o.key === env)?.hint}</Text>
                  </View>
                  <View style={styles.envRow}>
                    {ENV_OPTIONS.map((o) => (
                      <Pressable
                        key={o.key}
                        style={[styles.envChip, env === o.key && styles.envChipOn]}
                        onPress={() => setEnv(o.key)}
                        accessibilityRole="radio"
                        accessibilityState={{ selected: env === o.key }}
                      >
                        <Ionicons
                          name={o.key === 'acid' ? 'flask-outline' : o.key === 'base' ? 'water-outline' : 'analytics-outline'}
                          size={13}
                          color={env === o.key ? '#fff' : colors.sub}
                        />
                        <Text style={[styles.envChipText, env === o.key && styles.envChipTextOn]}>
                          {o.label}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                  <Text style={styles.envNote}>
                    同一个氧化剂在不同介质里还原产物可能完全不同，例如 MnO₄⁻：酸性 → Mn²⁺、中性 → MnO₂、碱性 → MnO₄²⁻
                  </Text>
                </View>
              ) : null}

              <View style={styles.inputRow}>
                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>{ionic ? '离子 A' : '反应物 A'}</Text>
                  <TextInput
                    style={styles.input}
                    value={a}
                    onChangeText={setA}
                    placeholder={ionic ? '如 Ag+ / Ag⁺' : '如 Zn / 锌、CH4、H2O2'}
                    placeholderTextColor={colors.faint}
                    autoCapitalize="none"
                    autoCorrect={false}
                    returnKeyType="next"
                  />
                </View>
                <Text style={styles.plus}>+</Text>
                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>{ionic ? '离子 B' : '反应物 B'}</Text>
                  <TextInput
                    style={styles.input}
                    value={b}
                    onChangeText={setB}
                    placeholder={ionic ? '如 Cl- / Cl⁻' : '如 HCl / 盐酸'}
                    placeholderTextColor={colors.faint}
                    autoCapitalize="none"
                    autoCorrect={false}
                    returnKeyType="done"
                    onSubmitEditing={submit}
                  />
                </View>
              </View>

              {ionic ? (
                <Text style={styles.ionFormatHint}>
                  电荷写法：MnO4-、Fe3+、SO4 2-、SO₄²⁻ 都可以；多个离子用空格或逗号隔开
                </Text>
              ) : null}

              <Pressable style={styles.goBtn} onPress={submit}>
                <Ionicons name="play" size={18} color="#fff" />
                <Text style={styles.goText}>确认 · 进入反应过程</Text>
              </Pressable>

              {msg && (
                <Text style={[styles.msg, msg.ok ? styles.msgOk : styles.msgErr]}>
                  {msg.text}
                </Text>
              )}

              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.samples}>
                {(ionic ? ION_SAMPLES : SAMPLES).map((s) => (
                  <Pressable
                    key={s.label + s.a + s.b}
                    style={styles.sample}
                    onPress={() => {
                      setA(s.a);
                      setB(s.b);
                      // 离子样例自带环境（KMnO₄ 的三档就靠这里一键对比）
                      if (ionic && 'env' in s) setEnv((s as { env: ReactionEnv }).env);
                      setMsg(null);
                    }}
                  >
                    <Text style={styles.sampleText}>
                      {s.a}
                      {s.b ? ` + ${s.b}` : ''}
                    </Text>
                    <Text style={styles.sampleTag}>{s.label}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>

            <View style={styles.listHeader}>
              <Text style={styles.listTitle}>高中常见化学实验项目</Text>
              <Text style={styles.listHint}>点击即可播放电子级反应过程</Text>
            </View>

            {content.reactions.map((rx, idx) => (
              <Pressable key={rx.id} style={styles.card} onPress={() => playKnown(rx)}>
                <View style={styles.cardTop}>
                  <Text style={styles.cardName}>{rx.name}</Text>
                  <View style={styles.chips}>
                    <Text style={[styles.typeChip, { color: typeTone(rx.type) }]}>{rx.type}</Text>
                    <Text style={styles.levelChip}>{rx.level}</Text>
                  </View>
                </View>
                <Text style={styles.eq}>{rx.equation}</Text>
                <Text style={styles.cardDesc} numberOfLines={2}>
                  {rx.desc}
                </Text>
                <View style={styles.cardFoot}>
                  {rx.condition ? <Text style={styles.cond}>条件：{rx.condition}</Text> : <View />}
                  <Text style={styles.stepHint}>{idx + 1} · 点击进入 3D 演示</Text>
                </View>
              </Pressable>
            ))}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingBottom: 26 },
  hero: { paddingTop: 14 },
  title: { fontSize: 20, fontWeight: '800', color: colors.ink, paddingHorizontal: 16 },
  subtitle: {
    fontSize: 12.5,
    color: colors.inkSoft,
    paddingHorizontal: 16,
    marginTop: 4,
    lineHeight: 18,
  },
  inputCard: {
    marginHorizontal: 16,
    marginTop: 14,
    borderRadius: 16,
    padding: 14,
    backgroundColor: '#fff',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    shadowColor: '#3a4a6b',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 9,
    marginBottom: 10,
  },
  switchText: { flex: 1 },
  checkBox: {
    width: 18,
    height: 18,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: '#c4d0e2',
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  checkBoxOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  switchLabel: { fontSize: 13.5, fontWeight: '700', color: colors.ink },
  switchHint: { fontSize: 11, color: colors.sub, lineHeight: 16, marginTop: 2 },

  envBlock: {
    backgroundColor: '#F6F9FF',
    borderWidth: 1,
    borderColor: '#dfe7f3',
    borderRadius: 12,
    padding: 10,
    marginBottom: 11,
  },
  envHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  envTitle: { fontSize: 12.5, fontWeight: '700', color: colors.ink },
  envHint: { fontSize: 11, color: colors.faint },
  envRow: { flexDirection: 'row', gap: 6, marginTop: 8 },
  envChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 7,
    borderRadius: 9,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.line,
  },
  envChipOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  envChipText: { fontSize: 12.5, fontWeight: '700', color: colors.inkSoft },
  envChipTextOn: { color: '#fff' },
  envNote: { fontSize: 10.5, color: colors.sub, lineHeight: 15, marginTop: 7 },

  ionFormatHint: { fontSize: 11, color: colors.faint, marginTop: 8, lineHeight: 16 },

  inputRow: { flexDirection: 'row', alignItems: 'flex-end' },
  field: { flex: 1 },
  fieldLabel: { fontSize: 11, color: colors.inkSoft, marginBottom: 5 },
  input: {
    borderWidth: 1,
    borderColor: '#dce4f0',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 9,
    fontSize: 15,
    color: colors.ink,
    backgroundColor: '#f8fafd',
  },
  plus: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.faint,
    paddingHorizontal: 8,
    marginBottom: 8,
  },
  goBtn: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
    borderRadius: 12,
    paddingVertical: 11,
  },
  goText: { color: '#fff', fontWeight: '700', fontSize: 14.5, marginLeft: 6 },
  msg: { marginTop: 10, fontSize: 12.5, lineHeight: 18 },
  msgOk: { color: '#2f7d31' },
  msgErr: { color: '#c0392b' },
  samples: { marginTop: 12, flexGrow: 0 },
  sample: {
    marginRight: 8,
    backgroundColor: '#eef3fb',
    borderRadius: 9,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  sampleText: { color: '#2b4b8a', fontSize: 12.5, fontWeight: '600' },
  sampleTag: { color: '#8a97ad', fontSize: 10, marginTop: 2 },
  listHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginTop: 22,
    marginBottom: 8,
  },
  listTitle: { fontSize: 16.5, fontWeight: '800', color: colors.ink },
  listHint: { fontSize: 11.5, color: colors.faint },
  card: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 10,
    borderRadius: 15,
    padding: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardName: { fontSize: 15, fontWeight: '700', color: colors.ink, flexShrink: 1 },
  chips: { flexDirection: 'row', marginLeft: 8 },
  typeChip: { fontSize: 12, fontWeight: '700' },
  levelChip: { fontSize: 11, color: colors.faint, marginLeft: 8 },
  eq: {
    marginTop: 8,
    fontSize: 16.5,
    fontWeight: '700',
    color: '#29466f',
    letterSpacing: 0.3,
  },
  cardDesc: { marginTop: 6, fontSize: 12.5, color: colors.inkSoft, lineHeight: 18 },
  cardFoot: {
    marginTop: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cond: { fontSize: 11.5, color: '#c25b1e' },
  stepHint: { fontSize: 11.5, color: colors.accent, fontWeight: '600' },
});
