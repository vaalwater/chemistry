import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme';
import type { MoleculeData } from '../types';
import MoleculesScreen from './MoleculesScreen';
import AtomsScreen from './AtomsScreen';

type SectionKey = 'molecules' | 'atoms';

const SECTIONS: { key: SectionKey; label: string }[] = [
  { key: 'molecules', label: '分子' },
  { key: 'atoms', label: '原子' },
];

export default function BrowseScreen({
  section,
  onSectionChange,
  onOpen,
}: {
  section: string;
  onSectionChange: (s: SectionKey) => void;
  onOpen: (kind: 'molecule' | 'atom', id: string, mol?: MoleculeData) => void;
}) {
  const current = (['molecules', 'atoms'].includes(section) ? section : 'molecules') as SectionKey;
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.root}>
      <View style={[styles.chipsWrap, { paddingTop: 10 + insets.top }]}>
        {SECTIONS.map((s) => {
          const active = current === s.key;
          return (
            <Pressable
              key={s.key}
              onPress={() => onSectionChange(s.key)}
              style={[styles.chip, active && styles.chipOn]}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
            >
              <Text style={[styles.chipText, active && styles.chipTextOn]}>{s.label}</Text>
            </Pressable>
          );
        })}
      </View>
      <View style={styles.body}>
        {current === 'molecules' && <MoleculesScreen onOpen={onOpen} />}
        {current === 'atoms' && <AtomsScreen onOpen={onOpen} />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  chipsWrap: {
    flexDirection: 'row',
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 8,
    backgroundColor: colors.bg,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 16,
    marginRight: 8,
    backgroundColor: '#eef2f8',
  },
  chipOn: { backgroundColor: colors.accent },
  chipText: { color: colors.inkSoft, fontSize: 13.5, fontWeight: '600' },
  chipTextOn: { color: '#fff' },
  body: { flex: 1 },
});
