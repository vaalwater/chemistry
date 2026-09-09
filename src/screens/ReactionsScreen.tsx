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
import { Ionicons } from '@expo/vector-icons';
import { content } from '../data';
import { colors } from '../theme';
import type { ReactionData, ReactionDrama } from '../types';
import { deriveDramaFromInputs, dramaForKnownReaction } from '../reactionEngine';

const SAMPLES: { a: string; b: string; label: string }[] = [
  { a: 'Zn', b: 'HCl', label: '金属 + 酸' },
  { a: 'CH4', b: 'O2', label: '燃烧' },
  { a: 'NaOH', b: 'HCl', label: '中和' },
  { a: 'CaCO3', b: 'HCl', label: '盐 + 酸' },
  { a: 'H2O2', b: '', label: '分解' },
  { a: 'CO2', b: 'Ca(OH)2', label: '检验 CO₂' },
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
      setMsg({ ok: false, text: '请先填写反应物 A（可只填一个做分解反应）。' });
      return;
    }
    const res = deriveDramaFromInputs(a, b);
    if (!res.drama) {
      setMsg({ ok: false, text: res.error || '推导失败，请检查分子式写法。' });
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
          <View style={styles.hero}>
            <Text style={styles.title}>反应 · 电子级演示</Text>
            <Text style={styles.subtitle}>
              输入分子式 → 自动推导并配平 → 3D 分步观察「断键 → 电子得失/转移 → 重新成键」
            </Text>

            <View style={styles.inputCard}>
              <View style={styles.inputRow}>
                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>反应物 A</Text>
                  <TextInput
                    style={styles.input}
                    value={a}
                    onChangeText={setA}
                    placeholder="如 Zn / 锌、CH4、H2O2"
                    placeholderTextColor={colors.faint}
                    autoCapitalize="none"
                    autoCorrect={false}
                    returnKeyType="next"
                  />
                </View>
                <Text style={styles.plus}>+</Text>
                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>反应物 B</Text>
                  <TextInput
                    style={styles.input}
                    value={b}
                    onChangeText={setB}
                    placeholder="如 HCl / 盐酸"
                    placeholderTextColor={colors.faint}
                    autoCapitalize="none"
                    autoCorrect={false}
                    returnKeyType="done"
                    onSubmitEditing={submit}
                  />
                </View>
              </View>

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
                {SAMPLES.map((s) => (
                  <Pressable
                    key={s.label + s.a + s.b}
                    style={styles.sample}
                    onPress={() => {
                      setA(s.a);
                      setB(s.b);
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
