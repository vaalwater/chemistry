import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../../theme';
import { COGN_OF, PROBES, type Probe } from '../../../math/setCase';
import { pushEntry, useArchive } from '../../../math/setArchive';

interface Props {
  queue: string[];
  asked: Record<string, boolean>;
  current: Probe | null;
  onClose: () => void;
  onAnswer: (pid: string, ok: boolean) => void;
  onFire: (pid: string) => void;
}

/** 底部：想一想 —— 走到容易错的地方就停下来问一句，答完才放行（提问时其余区被遮住） */
export default function ProbeZone({ queue, asked, current, onClose, onAnswer, onFire }: Props) {
  const [openList, setOpenList] = useState(false);
  const entries = useArchive();
  const insets = useSafeAreaInsets();

  const answeredCount = Object.keys(asked).length;
  const rightCount = Object.values(asked).filter(Boolean).length;
  const rate = answeredCount ? Math.round((rightCount / answeredCount) * 100) : null;

  return (
    <>
      {openList ? (
        <View style={styles.listBox}>
          <View style={styles.listHead}>
            <Text style={styles.listTitle}>这些地方最容易错（点一下就会问你）</Text>
            <Pressable onPress={() => setOpenList(false)} accessibilityRole="button">
              <Ionicons name="close" size={16} color={colors.faint} />
            </Pressable>
          </View>
          {PROBES.map((p) => {
            const state = asked[p.id];
            return (
              <Pressable key={p.id} style={styles.listRow} onPress={() => onFire(p.id)} accessibilityRole="button">
                <Ionicons
                  name={state === true ? 'checkmark-circle' : state === false ? 'close-circle' : 'help-circle-outline'}
                  size={14}
                  color={state === true ? colors.green : state === false ? colors.red : colors.faint}
                />
                <Text style={styles.listTag}>{p.tag}</Text>
                <Text style={styles.listQ} numberOfLines={1}>
                  {p.question}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      <View style={[styles.bar, !!current && styles.barActive, { paddingBottom: 9 + insets.bottom }]}>
        <Ionicons name={current ? 'help-circle' : 'shield-checkmark-outline'} size={15} color={current ? colors.orange : colors.green} />
        <Text style={styles.barText}>
          {current
            ? `先想一下：${current.tag} —— 答完才能继续`
            : rate === null
              ? '碰到容易错的地方，我会停下来问你一句'
              : `已经答了 ${answeredCount} 次，答对 ${rate}%`}
        </Text>
        <Pressable style={styles.barBtn} onPress={() => setOpenList(!openList)} accessibilityRole="button">
          <Text style={styles.barBtnText}>{openList ? '收起' : '全部'}</Text>
        </Pressable>
      </View>

      {current ? (
        <ProbeSheet
          probe={current}
          queue={queue}
          asked={asked}
          onClose={onClose}
          onAnswer={onAnswer}
          entries={entries.length}
          bottomInset={insets.bottom}
        />
      ) : null}
    </>
  );
}

function ProbeSheet({
  probe,
  queue,
  asked,
  onClose,
  onAnswer,
  entries,
  bottomInset,
}: {
  probe: Probe;
  queue: string[];
  asked: Record<string, boolean>;
  onClose: () => void;
  onAnswer: (pid: string, ok: boolean) => void;
  entries: number;
  bottomInset: number;
}) {
  const [picked, setPicked] = useState<string | null>(null);
  const opt = probe.options.find((o) => o.id === picked) ?? null;
  const answered = !!picked;
  const answeredBefore = asked[probe.id];

  const pick = (id: string) => {
    if (answered) return;
    setPicked(id);
    const o = probe.options.find((x) => x.id === id);
    const ok = !!o?.correct;
    pushEntry(COGN_OF[probe.id] ?? probe.tag, ok, `「${probe.tag}」这一问：${ok ? '答对了' : '答错了'}（${probe.trigger}）`);
    onAnswer(probe.id, ok);
  };

  return (
    <View style={styles.mask}>
      <View style={[styles.card, { paddingBottom: 16 + bottomInset }]}>
        <View style={styles.cardHead}>
          <View style={styles.tagChip}>
            <Text style={styles.tagText}>想一想 · {probe.tag}</Text>
          </View>
          <Text style={styles.trigger}>{probe.trigger}</Text>
          {queue.length > 1 ? <Text style={styles.queueTip}>后面还排着 {queue.length - 1} 个</Text> : null}
        </View>
        <Text style={styles.q}>{probe.question}</Text>

        {probe.options.map((o) => {
          const state = !answered ? 'idle' : o.id === picked ? (o.correct ? 'right' : 'wrong') : 'dim';
          const bg = state === 'right' ? '#E6F6EF' : state === 'wrong' ? '#FDEDED' : state === 'dim' ? '#F4F7FB' : '#F6F9FD';
          const bd = state === 'right' ? colors.green : state === 'wrong' ? colors.red : colors.line;
          return (
            <Pressable key={o.id} style={[styles.choice, { backgroundColor: bg, borderColor: bd }]} onPress={() => pick(o.id)} accessibilityRole="button">
              <Text style={styles.choiceText}>{o.text}</Text>
              {state === 'right' ? <Ionicons name="checkmark-circle" size={15} color={colors.green} /> : null}
              {state === 'wrong' ? <Ionicons name="close-circle" size={15} color={colors.red} /> : null}
              {picked === o.id ? (
                <Text style={styles.choiceNote}>{o.correct ? '✓ 答对了' : probe.reveal}</Text>
              ) : null}
            </Pressable>
          );
        })}

        {answered ? (
          <View style={styles.insight}>
            <Ionicons name="bulb-outline" size={14} color={colors.orange} />
            <Text style={styles.insightText}>{probe.insight}</Text>
          </View>
        ) : null}

        <View style={styles.btnRow}>
          {!answered ? (
            <Pressable
              style={styles.skip}
              onPress={() => {
                pushEntry(COGN_OF[probe.id] ?? probe.tag, false, `「${probe.tag}」这一问：没答就跳过了`);
                onAnswer(probe.id, false);
              }}
              accessibilityRole="button"
            >
              <Text style={styles.skipText}>这题先跳过</Text>
            </Pressable>
          ) : null}
          <Pressable style={styles.okBtn} onPress={onClose} accessibilityRole="button">
            <Text style={styles.okText}>{answered ? '明白了，继续' : '先跳过，回去再看看图'}</Text>
          </Pressable>
        </View>
        <Text style={styles.foot}>
          答错了不直接告诉你答案 —— 图会先动起来让你自己看：曲线怎么变、解集怎么跑，都在图上。已经记下{' '}
          {entries + (answered ? 1 : 0)} 条。
          {answeredBefore !== undefined ? '（这一问你之前答过）' : ''}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  listBox: {
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingHorizontal: 14,
    paddingTop: 10,
  },
  listHead: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  listTitle: { flex: 1, fontSize: 12.5, fontWeight: '800', color: colors.ink },
  listRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
  listTag: { width: 52, fontSize: 11.5, fontWeight: '800', color: colors.inkSoft, marginLeft: 7 },
  listQ: { flex: 1, fontSize: 11.5, color: colors.sub },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 9,
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  barActive: { backgroundColor: '#FFF7EC' },
  barText: { flex: 1, fontSize: 12, color: colors.inkSoft, marginLeft: 7, fontWeight: '600' },
  barBtn: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999, backgroundColor: '#F1ECFB' },
  barBtnText: { fontSize: 11.5, fontWeight: '800', color: colors.purple },
  mask: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(16,32,52,0.32)',
    justifyContent: 'flex-end',
  },
  card: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
    maxHeight: '92%',
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  tagChip: { backgroundColor: '#FFF1E3', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  tagText: { fontSize: 11, fontWeight: '800', color: colors.orange },
  trigger: { fontSize: 11.5, color: colors.faint, marginLeft: 8, flex: 1 },
  queueTip: { fontSize: 10.5, color: colors.orange, fontWeight: '700' },
  q: { fontSize: 15.5, fontWeight: '800', color: colors.ink, marginTop: 8, marginBottom: 10, lineHeight: 22 },
  choice: { borderWidth: 1, borderRadius: 12, padding: 11, marginBottom: 8, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  choiceText: { flex: 1, fontSize: 13, lineHeight: 19, color: colors.ink },
  choiceNote: { width: '100%', marginTop: 6, fontSize: 11.5, color: colors.sub, lineHeight: 17 },
  insight: { flexDirection: 'row', backgroundColor: '#FFF9F0', borderRadius: 12, padding: 10, marginTop: 2 },
  insightText: { flex: 1, fontSize: 12, color: colors.inkSoft, marginLeft: 7, lineHeight: 18 },
  btnRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  skip: { marginRight: 10 },
  skipText: { fontSize: 12, color: colors.faint, fontWeight: '700' },
  okBtn: { flex: 1, alignItems: 'center', paddingVertical: 10 },
  okText: { fontSize: 13, fontWeight: '800', color: colors.purple },
  foot: { fontSize: 11, color: colors.sub, lineHeight: 16, marginTop: 4 },
});
