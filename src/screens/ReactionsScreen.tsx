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
import type { ReactionData, ReactionDrama, ReactionEnv, ReactantAmount } from '../types';
import { deriveDramaFromInputs, dramaForKnownReaction } from '../reactionEngine';

const SAMPLES: { a: string; b: string; label: string; env?: ReactionEnv; amount?: ReactantAmount }[] = [
  { a: 'Zn', b: 'HCl', label: '金属 + 酸' },
  { a: 'CH4', b: 'O2', label: '燃烧' },
  { a: 'NaOH', b: 'HCl', label: '中和' },
  { a: 'CaCO3', b: 'HCl', label: '盐 + 酸' },
  { a: 'H2O2', b: '', label: '分解' },
  { a: 'CO2', b: 'Ca(OH)2', label: '检验 CO₂' },
  // 只填「一种化合物」，靠环境参数决定它发生什么反应
  { a: 'Al', b: '', env: 'acid', label: '酸中溶解' },
  { a: 'Al', b: '', env: 'base', label: '碱中溶解' },
  { a: 'Cl2', b: '', env: 'base', label: '碱中歧化' },
  { a: 'NO2', b: '', env: 'base', label: '碱液吸收' },
  { a: 'Na2CO3', b: '', env: 'acid', label: '酸中放气' },
  { a: 'NH4Cl', b: '', env: 'base', label: '碱中放氨' },
  // 同一组反应物，用量决定产物：少量得正盐、过量得酸式盐
  { a: 'SO2', b: '', env: 'base', amount: 'limited', label: 'SO₂ 少量 → SO₃²⁻' },
  { a: 'SO2', b: '', env: 'base', amount: 'excess', label: 'SO₂ 过量 → HSO₃⁻' },
  { a: 'CO2', b: '', env: 'base', amount: 'limited', label: 'CO₂ 少量 → CO₃²⁻' },
  { a: 'CO2', b: '', env: 'base', amount: 'excess', label: 'CO₂ 过量 → HCO₃⁻' },
];

/** 用量两档：酸性氧化物遇碱时，是生成正盐还是酸式盐，全看谁过量 */
const AMOUNT_OPTIONS: { key: ReactantAmount; label: string }[] = [
  { key: 'limited', label: '少量（碱过量）' },
  { key: 'excess', label: '过量（碱不足）' },
];

/** 环境三档：离子模式决定氧化还原产物，分子式模式决定「化合物 + 介质」走哪条净离子反应 */
const ENV_OPTIONS: { key: ReactionEnv; label: string; hint: string }[] = [
  { key: 'acid', label: '酸性', hint: '溶液中有大量 H⁺' },
  { key: 'neutral', label: '中性', hint: '纯水或中性盐溶液' },
  { key: 'base', label: '碱性', hint: '溶液中有大量 OH⁻' },
];

/**
 * 离子模式的样例：把环境连同反应物一起带上。
 * 特意放进了 MnO₄⁻ 的三种介质 —— 点一下就能直接看到同一个氧化剂在不同环境下的产物差异。
 */
const ION_SAMPLES: { a: string; b: string; env: ReactionEnv; label: string; amount?: ReactantAmount }[] = [
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
  // 只填一种物质：介质会自动补成第二个反应物
  { a: 'Cl2', b: '', env: 'base', label: '只填一种 · 碱' },
  { a: 'Al', b: '', env: 'acid', label: '只填一种 · 酸' },
  { a: 'SO2', b: '', env: 'base', amount: 'limited', label: 'SO₂ 少量 → SO₃²⁻' },
  { a: 'SO2', b: '', env: 'base', amount: 'excess', label: 'SO₂ 过量 → HSO₃⁻' },
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
  /** 是否按离子方程式处理：勾选后反应物可以写离子，配平加电荷守恒 */
  const [ionic, setIonic] = useState(false);
  /** 介质：两种模式共用 —— 离子模式决定还原产物，分子式模式决定「化合物 + 介质」的净离子反应 */
  const [env, setEnv] = useState<ReactionEnv>('neutral');
  /** 通入物质相对介质的用量：SO₂ / CO₂ 遇碱时决定产物是正盐还是酸式盐 */
  const [amount, setAmount] = useState<ReactantAmount>('limited');
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
        text: ionic
          ? '请先填写反应物离子（如 Ag+、Cl-）。'
          : '请先填写反应物 A；只填一种化合物并选定酸性 / 碱性，也能看它在介质中的反应。',
      });
      return;
    }
    const res = deriveDramaFromInputs(a, b, { ionic, env, amount });
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
              输入分子式 → 自动推导并配平 → 3D 分步观察「断键 → 电子得失/转移 → 重新成键」。选定酸碱性后，只填一种化合物也能看到它在该介质中的反应。
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
                {ionic ? (
                  <Text style={styles.envNote}>
                    同一个氧化剂在不同介质里还原产物可能完全不同，例如 MnO₄⁻：酸性 → Mn²⁺、中性 → MnO₂、碱性 → MnO₄²⁻
                  </Text>
                ) : (
                  <Text style={styles.envNote}>
                    选中酸性 / 碱性后，只填一种化合物就能看它在介质里的反应：环境会自动补入 H⁺ 或 OH⁻，再按净离子方程式配平。例如 Al 在酸中生成 Al³⁺、在碱中生成 AlO₂⁻；Cl₂ 只在碱里歧化。
                  </Text>
                )}

                {/* 用量分支目前都是「酸性氧化物 + 碱」，酸性介质里没有这档，不显示免得误导 */}
                {env === 'base' ? (
                  <>
                    <View style={styles.amountRow}>
                      <Text style={styles.amountLabel}>用量</Text>
                      {AMOUNT_OPTIONS.map((o) => (
                        <Pressable
                          key={o.key}
                          style={[styles.amountChip, amount === o.key && styles.amountChipOn]}
                          onPress={() => setAmount(o.key)}
                          accessibilityRole="radio"
                          accessibilityState={{ selected: amount === o.key }}
                        >
                          <Text style={[styles.amountChipText, amount === o.key && styles.amountChipTextOn]}>
                            {o.label}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                    <Text style={styles.envNote}>
                      同一组反应物也可能因用量不同而产物不同：SO₂ / CO₂ 少量（碱过量）得正盐 SO₃²⁻ / CO₃²⁻，过量（碱不足）得酸式盐 HSO₃⁻ / HCO₃⁻。
                    </Text>
                  </>
                ) : null}
              </View>

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
                      // 样例自带环境（介质的三档差异靠这里一键对比）；不带环境的样例回到中性
                      setEnv('env' in s && s.env ? s.env : 'neutral');
                      setAmount('amount' in s && s.amount ? s.amount : 'limited');
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

  amountRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
  amountLabel: { fontSize: 11.5, fontWeight: '700', color: colors.inkSoft, marginRight: 2 },
  amountChip: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
  },
  amountChipOn: { backgroundColor: '#e8eefb', borderColor: colors.accent },
  amountChipText: { fontSize: 11.5, fontWeight: '600', color: colors.inkSoft },
  amountChipTextOn: { color: colors.accent },

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
