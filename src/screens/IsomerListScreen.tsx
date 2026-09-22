import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii, shadow } from '../theme';
import {
  CATEGORY_INTRO,
  CATEGORY_ORDER,
  PROBLEMS,
  problemsOf,
  subFormula,
  type IsoProblem,
} from '../iso/problems';

export default function IsomerListScreen({
  onBack,
  onOpen,
}: {
  onBack: () => void;
  onOpen: (p: IsoProblem) => void;
}) {
  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text onPress={onBack} style={styles.back}>
          <Ionicons name="chevron-back" size={18} color={colors.accent} /> 返回
        </Text>
        <Text style={styles.title}>同分异构体</Text>
        <Text style={styles.badge}>{PROBLEMS.length} 题</Text>
      </View>

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <Text style={styles.lead}>
          选一个分子式，按限制条件把全部同分异构体都搭出来。提交后系统会告诉你漏了哪一类。
        </Text>

        {CATEGORY_ORDER.map((cat) => (
          <View key={cat} style={styles.group}>
            <View style={styles.groupHead}>
              <Text style={styles.groupTitle}>{cat}</Text>
              <Text style={styles.groupIntro}>{CATEGORY_INTRO[cat]}</Text>
            </View>
            {problemsOf(cat).map((p) => (
              <Pressable key={p.id} style={styles.item} onPress={() => onOpen(p)}>
                <Text style={styles.itemTitle}>{p.title}</Text>
                <Text style={styles.itemFormula}>{subFormula(p.formula)}</Text>
                <Text style={styles.itemCond}>{p.condition}</Text>
                <Text style={styles.go}>去搭建 ›</Text>
              </Pressable>
            ))}
          </View>
        ))}
        <View style={{ height: 28 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  back: { fontSize: 13, color: colors.accent, fontWeight: '600' },
  title: { flex: 1, fontSize: 16, fontWeight: '700', color: colors.ink },
  badge: {
    fontSize: 11.5,
    fontWeight: '700',
    color: colors.accent,
    backgroundColor: colors.accentSoft,
    borderRadius: radii.chip,
    paddingHorizontal: 10,
    paddingVertical: 3,
    overflow: 'hidden',
  },
  body: { padding: 14, gap: 14, paddingBottom: 30 },
  lead: { fontSize: 12.5, color: colors.sub, lineHeight: 20 },
  group: { gap: 10 },
  groupHead: {
    backgroundColor: colors.card,
    borderRadius: radii.card,
    padding: 13,
    ...shadow.card,
  },
  groupTitle: { fontSize: 15, fontWeight: '800', color: colors.ink },
  groupIntro: { fontSize: 12, color: colors.sub, marginTop: 4, lineHeight: 19 },
  item: {
    backgroundColor: colors.card,
    borderRadius: radii.card,
    padding: 13,
    ...shadow.card,
  },
  itemTitle: { fontSize: 14, fontWeight: '700', color: colors.ink },
  itemFormula: { fontSize: 12.5, fontWeight: '700', color: colors.purple, marginTop: 3 },
  itemCond: { fontSize: 12.5, color: colors.inkSoft, marginTop: 5, lineHeight: 19 },
  go: { fontSize: 12, fontWeight: '700', color: colors.accent, marginTop: 8 },
});
