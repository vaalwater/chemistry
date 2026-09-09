import { Fragment, useState } from 'react';
import { Keyboard, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import MoleculeThumb from '../components/MoleculeThumb';
import { colors, radii, shadow } from '../theme';
import { acidityTone, allMolecules, content, resolveMoleculeInput } from '../data';
import type { AcidInfo, MoleculeData } from '../types';

interface Props {
  onOpen: (kind: 'molecule', id: string, mol?: MoleculeData) => void;
}

const SAMPLES = ['H2O', 'CO2', 'CH4', 'CH3COOH', 'C2H4', 'C6H12O6', 'NH3'];

export function AcidBadge({ acidity, small = false }: { acidity: AcidInfo; small?: boolean }) {
  const tone = acidityTone(acidity.label);
  return (
    <View style={[styles.acidPill, { backgroundColor: tone.bg }, small && styles.acidPillSm]}>
      <Ionicons
        name={acidity.label === '中性' ? 'water-outline' : 'flask-outline'}
        size={small ? 9 : 11}
        color={tone.fg}
      />
      <Text style={[styles.acidPillText, { color: tone.fg }, small && styles.acidPillTextSm]}>
        {acidity.label}
      </Text>
    </View>
  );
}

export default function MoleculesScreen({ onOpen }: Props) {
  const [text, setText] = useState('');
  const [err, setErr] = useState<string | null>(null);

  const openByFormula = (raw: string) => {
    const t = raw.trim();
    if (!t) {
      setErr('请输入分子式，例如 H2O、CO2、CH3COOH');
      return;
    }
    const res = resolveMoleculeInput(t);
    if (!res) {
      setErr('未找到匹配分子，且暂不支持该分子式的自动建模');
      return;
    }
    setErr(null);
    Keyboard.dismiss();
    onOpen('molecule', res.mol.id, res.from === 'gen' ? res.mol : undefined);
  };

  const cats: { name: string; list: MoleculeData[] }[] = [];
  allMolecules().forEach((m) => {
    let c = cats.find((x) => x.name === m.category);
    if (!c) {
      c = { name: m.category, list: [] };
      cats.push(c);
    }
    c.list.push(m);
  });

  return (
    <View style={styles.container}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        <View style={styles.header}>
          <Text style={styles.title}>分子模型</Text>
          <Text style={styles.subtitle}>库内检索 + 简单生成 · 点击卡片或搜索后进入 3D 空间</Text>
        </View>

        {/* 分子式输入 */}
        <View style={styles.searchCard}>
          <View style={styles.searchRow}>
            <Ionicons name="search" size={16} color={colors.faint} />
            <TextInput
              style={styles.input}
              value={text}
              onChangeText={(v) => {
                setText(v);
                setErr(null);
              }}
              placeholder="输入分子式，如 C2H5OH"
              placeholderTextColor={colors.faint}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
              onSubmitEditing={() => openByFormula(text)}
            />
            <Pressable
              style={({ pressed }) => [styles.searchBtn, pressed && { opacity: 0.8 }]}
              onPress={() => openByFormula(text)}
              accessibilityLabel="搜索分子"
            >
              <Ionicons name="arrow-forward" size={16} color="#fff" />
            </Pressable>
          </View>
          {err ? <Text style={styles.errText}>{err}</Text> : null}
          <View style={styles.sampleRow}>
            <Text style={styles.sampleLabel}>试试：</Text>
            {SAMPLES.map((s) => (
              <Pressable key={s} onPress={() => openByFormula(s)} hitSlop={6}>
                <Text style={styles.sampleChip}>{s}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        {cats.map((cat) => (
          <Fragment key={cat.name}>
            <Text style={styles.catName}>{cat.name}</Text>
            <View style={styles.grid}>
              {cat.list.map((m) => {
                const inContent = content.molecules.some((cm) => cm.id === m.id);
                return (
                  <Pressable
                    key={m.id}
                    style={({ pressed }) => [styles.card, pressed && { opacity: 0.75 }]}
                    onPress={() => onOpen('molecule', m.id, inContent ? undefined : m)}
                  >
                    <MoleculeThumb mol={m} />
                    <Text style={styles.formula}>{m.formula}</Text>
                    <Text style={styles.name} numberOfLines={1}>
                      {m.name}
                    </Text>
                    <View style={styles.tagRow}>
                      <Text style={styles.tag}>{m.level}</Text>
                      {m.acidity ? <AcidBadge acidity={m.acidity} small /> : null}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </Fragment>
        ))}
        <View style={{ height: 24 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 4 },
  title: { fontSize: 30, fontWeight: '800', color: colors.ink },
  subtitle: { fontSize: 13, color: colors.sub, marginTop: 6 },
  scroll: { paddingHorizontal: 14, paddingBottom: 8 },
  searchCard: {
    backgroundColor: colors.card,
    borderRadius: radii.card,
    padding: 12,
    marginTop: 10,
    ...shadow.card,
  },
  searchRow: { flexDirection: 'row', alignItems: 'center' },
  input: {
    flex: 1,
    fontSize: 15,
    color: colors.ink,
    paddingVertical: 8,
    paddingHorizontal: 8,
    marginLeft: 2,
  },
  searchBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errText: { fontSize: 12, color: colors.red, marginTop: 2, marginLeft: 4 },
  sampleRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6, flexWrap: 'wrap' },
  sampleLabel: { fontSize: 11, color: colors.faint },
  sampleChip: {
    fontSize: 11,
    color: colors.accent,
    fontWeight: '600',
    backgroundColor: colors.accentSoft,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 9,
    overflow: 'hidden',
    marginLeft: 6,
    marginTop: 4,
  },
  catName: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.sub,
    marginLeft: 6,
    marginTop: 16,
    marginBottom: 8,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  card: {
    width: '48.6%',
    backgroundColor: colors.card,
    borderRadius: radii.card,
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 8,
    marginBottom: 12,
    ...shadow.card,
  },
  formula: { fontSize: 18, fontWeight: '800', color: colors.ink, marginTop: 4 },
  name: { fontSize: 13, color: colors.sub, marginTop: 2 },
  tagRow: { flexDirection: 'row', marginTop: 8, alignItems: 'center' },
  tag: {
    fontSize: 10,
    color: colors.accent,
    backgroundColor: colors.accentSoft,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
    overflow: 'hidden',
    marginRight: 6,
  },
  acidPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 9,
  },
  acidPillSm: { paddingHorizontal: 5, paddingVertical: 1.5 },
  acidPillText: { fontSize: 11, fontWeight: '700', marginLeft: 3 },
  acidPillTextSm: { fontSize: 10, marginLeft: 2.5 },
});
