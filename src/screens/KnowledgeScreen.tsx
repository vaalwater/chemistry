import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, shadow } from '../theme';
import {
  KNOWLEDGE,
  knowledgeCount,
  type KnowledgeItem,
  type KnowledgeTarget,
} from '../knowledge/knowledgeData';
import type { SubjectKey, SubjectMeta } from '../subjects';

/**
 * 知识点汇总：一页教科书式的讲解（分章、连贯陈述、科普语气）。
 * 每条知识点讲三件事 —— 叫什么、是什么、怎么用 —— 并在段落里插一个通往对应页面的链接。
 *
 * 这是从学科卡片右侧入口进来的全屏页，不显示底部导航，返回走左上角「返回」。
 */
export default function KnowledgeScreen({
  subject,
  onBack,
  onOpen,
}: {
  subject: SubjectMeta;
  onBack: () => void;
  onOpen: (target: KnowledgeTarget) => void;
}) {
  const insets = useSafeAreaInsets();
  const chapters = KNOWLEDGE[subject.key as SubjectKey] ?? [];

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <Pressable style={styles.backBtn} onPress={onBack} accessibilityRole="button">
          <Ionicons name="chevron-back" size={18} color={colors.inkSoft} />
          <Text style={styles.backText}>返回</Text>
        </Pressable>
        <Text style={styles.title}>{subject.name} · 知识点汇总</Text>
        <Text style={styles.subtitle}>
          一篇讲完 {chapters.length} 章、{knowledgeCount(subject.key as SubjectKey)} 个定理与定律 ·
          带下划线的句子可以直接点进去看
        </Text>
      </View>

      <ScrollView style={styles.body} contentContainerStyle={styles.bodyInner} showsVerticalScrollIndicator={false}>
        <View style={styles.paper}>
          {chapters.map((ch) => (
            <View key={ch.id} style={styles.chapter}>
              <View style={styles.chapterHead}>
                <View style={[styles.chapterBar, { backgroundColor: subject.color }]} />
                <Text style={styles.chapterTitle}>{ch.title}</Text>
              </View>
              <Text style={styles.lead}>{ch.lead}</Text>
              {ch.items.map((it) => (
                <Item key={it.name} item={it} color={subject.color} onOpen={onOpen} />
              ))}
            </View>
          ))}
          <Text style={styles.ending}>
            看完要是还觉得抽象，就顺着这些链接点进去 —— 转一转、拖一拖，比读十遍记得牢。
          </Text>
        </View>
        <View style={{ height: 24 }} />
      </ScrollView>
    </View>
  );
}

/** 一条知识点：小标题 + 一段连贯的陈述，链接嵌在段末 */
function Item({
  item,
  color,
  onOpen,
}: {
  item: KnowledgeItem;
  color: string;
  onOpen: (t: KnowledgeTarget) => void;
}) {
  const body = item.how ? `${item.what}\n\n${item.how}\n\n` : `${item.what}\n\n`;
  return (
    <View style={styles.item}>
      <Text style={styles.itemName}>{item.name}</Text>
      <Text style={styles.para}>
        {body}
        <Text style={styles.link} onPress={() => onOpen(item.target)} accessibilityRole="link">
          {item.linkText} →
        </Text>
      </Text>
      <View style={[styles.itemDot, { backgroundColor: color }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: 18, paddingBottom: 12 },
  backBtn: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  backText: { fontSize: 14, color: colors.inkSoft, fontWeight: '600', marginLeft: 2 },
  title: { fontSize: 24, fontWeight: '800', color: colors.ink },
  subtitle: { fontSize: 12.5, color: colors.sub, marginTop: 6, lineHeight: 18 },
  body: { flex: 1 },
  bodyInner: { paddingHorizontal: 12, paddingBottom: 10 },
  paper: {
    backgroundColor: colors.card,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 6,
    ...shadow.card,
  },
  chapter: { marginBottom: 18 },
  chapterHead: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  chapterBar: { width: 4, height: 18, borderRadius: 2, marginRight: 8 },
  chapterTitle: { fontSize: 17, fontWeight: '800', color: colors.ink },
  lead: { fontSize: 13, lineHeight: 20, color: colors.sub, marginBottom: 4 },
  item: { marginTop: 14, paddingLeft: 12 },
  itemDot: {
    position: 'absolute',
    left: 0,
    top: 8,
    width: 5,
    height: 5,
    borderRadius: 3,
    opacity: 0.5,
  },
  itemName: { fontSize: 15, fontWeight: '700', color: colors.ink, marginBottom: 4 },
  para: { fontSize: 14, lineHeight: 23, color: colors.inkSoft },
  link: { color: colors.accent, fontWeight: '700', textDecorationLine: 'underline' },
  ending: {
    fontSize: 12.5,
    lineHeight: 19,
    color: colors.faint,
    textAlign: 'center',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
});
