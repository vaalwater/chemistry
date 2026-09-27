import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, shadow } from '../theme';
import { SUBJECTS, type SubjectKey, type SubjectMeta } from '../subjects';

/** 首页：数学 / 物理 / 化学 三个学科卡片，点进去是各自的二级频道。 */
export default function HomeScreen({ onPick }: { onPick: (key: SubjectKey) => void }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 18 }]}>
        <Text style={styles.title}>数理化课堂</Text>
        <Text style={styles.subtitle}>数学 · 物理 · 化学，选一科进去看</Text>
      </View>
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        {SUBJECTS.map((s) => (
          <SubjectCard key={s.key} subject={s} onPress={() => onPick(s.key)} />
        ))}
        <Text style={styles.foot}>化学频道已开放，数学与物理的内容正在建设中。</Text>
        <View style={{ height: 24 }} />
      </ScrollView>
    </View>
  );
}

function SubjectCard({ subject, onPress }: { subject: SubjectMeta; onPress: () => void }) {
  return (
    <Pressable
      style={[styles.card, { borderLeftColor: subject.color }]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`进入${subject.name}频道`}
    >
      <View style={[styles.iconWrap, { backgroundColor: subject.tint }]}>
        <Ionicons name={subject.icon} size={26} color={subject.color} />
      </View>
      <View style={styles.textCol}>
        <View style={styles.titleRow}>
          <Text style={styles.cardTitle}>{subject.name}</Text>
          {!subject.ready && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>建设中</Text>
            </View>
          )}
        </View>
        <Text style={styles.cardTagline}>{subject.tagline}</Text>
        <View style={styles.metaRow}>
          <Ionicons
            name={subject.ready ? 'library-outline' : 'hammer-outline'}
            size={12}
            color={subject.ready ? colors.sub : colors.faint}
          />
          <Text style={styles.cardStats}>{subject.stats}</Text>
        </View>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.faint} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: 20, paddingBottom: 12 },
  title: { fontSize: 30, fontWeight: '800', color: colors.ink },
  subtitle: { fontSize: 13, color: colors.sub, marginTop: 6 },
  body: { paddingHorizontal: 14, paddingTop: 6 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    ...shadow.card,
  },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  textCol: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center' },
  cardTitle: { fontSize: 18, fontWeight: '800', color: colors.ink },
  badge: {
    marginLeft: 8,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: '#EEF2F8',
  },
  badgeText: { fontSize: 10.5, fontWeight: '700', color: colors.faint },
  cardTagline: { fontSize: 12.5, lineHeight: 18, color: colors.sub, marginTop: 5 },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 7 },
  cardStats: { fontSize: 11.5, color: colors.sub, marginLeft: 5, fontWeight: '600' },
  foot: { fontSize: 12, color: colors.faint, textAlign: 'center', marginTop: 6 },
});
