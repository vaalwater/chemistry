import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, shadow } from '../theme';
import type { SubjectMeta } from '../subjects';

/** 尚未开放内容的学科频道：说明现状 + 列出规划中的模块，结构与化学频道一致。 */
export default function SubjectChannelScreen({
  subject,
  onOpenModule,
}: {
  subject: SubjectMeta;
  onOpenModule?: (route: string) => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <Text style={[styles.title, { color: subject.color }]}>{subject.name}</Text>
        <Text style={styles.subtitle}>{subject.tagline}</Text>
      </View>
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <View style={[styles.notice, { backgroundColor: subject.tint }]}>
          <Ionicons name={subject.ready ? 'checkmark-circle-outline' : 'hammer-outline'} size={18} color={subject.color} />
          <Text style={[styles.noticeText, { color: subject.color }]}>
            {subject.ready
              ? '标着「可进入」的模块已经能直接用；灰掉的是还在搭建中的模块，上线后同样是点进去即可交互。'
              : '这个频道还在搭建中 —— 下面是规划中的模块，上线后点进去即可交互。'}
          </Text>
        </View>

        {subject.modules.map((m) => {
          const openable = !!m.done && !!m.route && !!onOpenModule;
          const body = (
            <>
              <View style={styles.cardHead}>
                <View style={[styles.iconWrap, openable ? { backgroundColor: subject.tint } : styles.iconWrapOff]}>
                  <Ionicons
                    name={openable ? 'cube-outline' : 'ellipse-outline'}
                    size={16}
                    color={openable ? subject.color : colors.faint}
                  />
                </View>
                <Text style={[styles.cardTitle, !openable && styles.cardTitleOff]}>{m.name}</Text>
                <View style={[styles.badge, openable && styles.badgeOn]}>
                  <Text style={[styles.badgeText, openable && styles.badgeTextOn]}>
                    {openable ? '可进入' : '建设中'}
                  </Text>
                </View>
                {openable ? <Ionicons name="chevron-forward" size={16} color={colors.faint} /> : null}
              </View>
              <Text style={[styles.cardDesc, !openable && styles.cardDescOff]}>{m.desc}</Text>
            </>
          );
          return openable ? (
            <Pressable
              key={m.name}
              style={styles.card}
              onPress={() => onOpenModule && onOpenModule(m.route as string)}
              accessibilityRole="button"
              accessibilityLabel={`进入${m.name}模块`}
            >
              {body}
              <Text style={styles.enter}>进入模块</Text>
            </Pressable>
          ) : (
            // 还没做完的模块：整张卡灰掉，一眼就能看出点不动
            <View
              key={m.name}
              style={[styles.card, styles.cardOff]}
              accessibilityRole="none"
              accessibilityState={{ disabled: true }}
            >
              {body}
              <Text style={styles.enterOff}>建设中 · 还没开放</Text>
            </View>
          );
        })}

        <Text style={styles.foot}>
          {subject.ready
            ? '想看更完整的内容？回学科首页进「化学」，里面有 3D 分子、反应动画和动手实验。'
            : '想先看点实在的？回学科首页进「化学」或「数学」，里面已经有可以上手的内容。'}
        </Text>
        <View style={{ height: 24 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: 16, paddingBottom: 10 },
  title: { fontSize: 30, fontWeight: '800' },
  subtitle: { fontSize: 13, color: colors.sub, marginTop: 6 },
  body: { paddingHorizontal: 14, paddingTop: 4 },
  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
  },
  noticeText: { flex: 1, fontSize: 13, lineHeight: 20, fontWeight: '600', marginLeft: 10 },
  card: {
    backgroundColor: colors.card,
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    ...shadow.card,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center' },
  iconWrap: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  cardOff: { backgroundColor: '#F2F3F6', opacity: 0.72 },
  iconWrapOff: { backgroundColor: '#E7E9EE' },
  cardTitle: { flex: 1, fontSize: 15.5, fontWeight: '800', color: colors.ink },
  cardTitleOff: { color: '#9AA3B2' },
  cardDescOff: { color: '#A6AEBB' },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: '#EEF2F8',
  },
  badgeText: { fontSize: 10.5, fontWeight: '700', color: colors.faint },
  badgeOn: { backgroundColor: '#E6F6EF' },
  badgeTextOn: { color: colors.green },
  cardDesc: { fontSize: 13, lineHeight: 20, color: colors.sub, marginTop: 8 },
  enter: { fontSize: 12.5, fontWeight: '700', color: colors.green, marginTop: 10 },
  enterOff: { fontSize: 12.5, fontWeight: '700', color: '#A6AEBB', marginTop: 10 },
  foot: { fontSize: 12, color: colors.faint, textAlign: 'center', marginTop: 8, lineHeight: 18 },
});
