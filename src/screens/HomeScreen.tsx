import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, shadow } from '../theme';
import { SUBJECTS, type SubjectKey, type SubjectMeta } from '../subjects';
import { knowledgeCount } from '../knowledge/knowledgeData';

/** 首页：数学 / 物理 / 化学 三个学科卡片，点进去是各自的二级频道。 */
export default function HomeScreen({
  onPick,
  onOpenAbout,
  onOpenKnowledge,
}: {
  onPick: (key: SubjectKey) => void;
  onOpenAbout: () => void;
  onOpenKnowledge: (key: SubjectKey) => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 18 }]}>
        <Text style={styles.title}>理科3D视界</Text>
        <Text style={styles.subtitle}>数学 · 物理 · 化学，选一科进去看</Text>
      </View>
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        {SUBJECTS.map((s) => (
          <SubjectCard
            key={s.key}
            subject={s}
            onPress={() => onPick(s.key)}
            onOpenKnowledge={() => onOpenKnowledge(s.key)}
          />
        ))}
        {/* 「关于」不是学科，不做成同级卡片：这里用一行轻量链接，避免抢学科卡片的视觉权重 */}
        <Pressable style={styles.aboutLink} onPress={onOpenAbout} accessibilityRole="button">
          <Ionicons name="information-circle-outline" size={16} color={colors.sub} />
          <Text style={styles.aboutLinkText}>关于本 App</Text>
          <Ionicons name="chevron-forward" size={14} color={colors.faint} />
        </Pressable>
        <Text style={styles.foot}>化学、数学立体几何、物理电磁学已开放；其余模块陆续上线。</Text>
        <View style={{ height: 24 }} />
      </ScrollView>
    </View>
  );
}

function SubjectCard({
  subject,
  onPress,
  onOpenKnowledge,
}: {
  subject: SubjectMeta;
  onPress: () => void;
  onOpenKnowledge: () => void;
}) {
  return (
    <View style={[styles.card, { borderLeftColor: subject.color }]}>
      {/* 卡片主体：进学科频道 */}
      <Pressable
        style={styles.cardMain}
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

      {/* 右侧：本学科的知识点汇总（与卡片主体并排，避免点链接时连卡片一起触发） */}
      <Pressable
        style={styles.knowLink}
        onPress={onOpenKnowledge}
        accessibilityRole="button"
        accessibilityLabel={`${subject.name}知识点汇总`}
      >
        <View style={[styles.knowIcon, { backgroundColor: subject.tint }]}>
          <Ionicons name="book-outline" size={15} color={subject.color} />
        </View>
        <Text style={[styles.knowText, { color: subject.color }]}>知识点汇总</Text>
        <Text style={styles.knowCount}>{knowledgeCount(subject.key)} 条</Text>
      </Pressable>
    </View>
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
    alignItems: 'stretch',
    backgroundColor: colors.card,
    borderRadius: 18,
    marginBottom: 12,
    borderLeftWidth: 4,
    overflow: 'hidden',
    ...shadow.card,
  },
  cardMain: { flex: 1, flexDirection: 'row', alignItems: 'center', padding: 16 },
  knowLink: {
    width: 94,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderLeftWidth: 1,
    borderLeftColor: colors.line,
    backgroundColor: '#FBFCFE',
  },
  knowIcon: { width: 28, height: 28, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  knowText: { fontSize: 11.5, fontWeight: '800', marginTop: 5 },
  knowCount: { fontSize: 10.5, color: colors.faint, marginTop: 2 },
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
  aboutLink: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginTop: 4,
    borderRadius: 999,
    backgroundColor: colors.card,
  },
  aboutLinkText: { fontSize: 12.5, fontWeight: '700', color: colors.sub, marginLeft: 6, marginRight: 2 },
  foot: { fontSize: 12, color: colors.faint, textAlign: 'center', marginTop: 10 },
});
