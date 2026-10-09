import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../../theme';
import { COGN_TAGS } from '../../../math/setCase';
import { resetEntries, statByTag, useArchive } from '../../../math/setArchive';
import { Box, Note, Zone } from './kit';

/** 学习记录：刚才答过的每一问、走过的每一步，都留在这里 */
export default function ArchiveZone() {
  const entries = useArchive();
  const stats = statByTag(entries, COGN_TAGS);
  const answered = entries.length;
  const right = entries.filter((e) => e.ok).length;
  const rate = answered ? Math.round((right / answered) * 100) : 0;
  const recent = entries.slice(-4).reverse();
  const total = stats.reduce((a, s) => a + s.total, 0);
  const maxTag = Math.max(1, ...stats.map((s) => s.total));

  return (
    <Zone tag="我的记录" title="哪里容易错，这里看得见" sub="做过的题、答过的追问都记下来了，颜色越长说明在这一类上花的时间越多" color={colors.orange}>
      <View style={styles.headRow}>
        <View style={styles.bigBox}>
          <Text style={styles.bigNum}>{answered}</Text>
          <Text style={styles.bigLabel}>次练习</Text>
        </View>
        <View style={styles.bigBox}>
          <Text style={[styles.bigNum, { color: rate >= 70 ? colors.green : colors.orange }]}>{rate}%</Text>
          <Text style={styles.bigLabel}>答对比例</Text>
        </View>
        <Pressable style={styles.resetBtn} onPress={resetEntries} accessibilityRole="button">
          <Text style={styles.resetText}>清空</Text>
        </Pressable>
      </View>

      <Box tone="soft">
        <Text style={styles.resTitle}>哪一类最容易错</Text>
        {stats.map((s) => {
          const t = COGN_TAGS.find((x) => x.id === s.id);
          const w = total ? Math.max(2, Math.round((s.total / maxTag) * 100)) : 0;
          return (
            <View key={s.id} style={styles.heatRow}>
              <Text style={styles.heatName}>{t?.name ?? s.id}</Text>
              <View style={styles.heatTrack}>
                <View style={[styles.heatBar, { width: `${w}%`, backgroundColor: t?.color ?? colors.faint }]} />
              </View>
              <Text style={styles.heatNum}>
                {s.total} 次 · {s.total ? Math.round(s.rate * 100) : 0}%
              </Text>
            </View>
          );
        })}
      </Box>

      {recent.length ? (
        <Box tone="soft">
          <Text style={styles.resTitle}>刚才做的几步</Text>
          {recent.map((e) => (
            <View key={e.id} style={styles.recRow}>
              <Ionicons name={e.ok ? 'checkmark-circle' : 'close-circle'} size={13} color={e.ok ? colors.green : colors.red} />
              <Text style={styles.recText}>{e.detail}</Text>
            </View>
          ))}
        </Box>
      ) : (
        <Note text="还没有记录 —— 去地图上走两格，或者处理一次标红的步骤，这里就会亮起来。" icon="file-tray-outline" />
      )}
    </Zone>
  );
}

const styles = StyleSheet.create({
  headRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  bigBox: { alignItems: 'center', marginRight: 18 },
  bigNum: { fontSize: 24, fontWeight: '800', color: colors.ink },
  bigLabel: { fontSize: 11, color: colors.sub, marginTop: 2 },
  resetBtn: { flex: 1, alignItems: 'flex-end' },
  resetText: { fontSize: 12, fontWeight: '800', color: colors.red },
  resTitle: { fontSize: 11.5, fontWeight: '800', color: colors.faint, letterSpacing: 0.3, marginBottom: 4 },
  heatRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 7 },
  heatName: { width: 84, fontSize: 11.5, fontWeight: '700', color: colors.inkSoft },
  heatTrack: { flex: 1, height: 8, backgroundColor: '#EEF2F8', borderRadius: 4, overflow: 'hidden' },
  heatBar: { height: 8, borderRadius: 4 },
  heatNum: { width: 62, fontSize: 10.5, color: colors.sub, textAlign: 'right' },
  recRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 5 },
  recText: { flex: 1, fontSize: 11.5, color: colors.inkSoft, marginLeft: 6, lineHeight: 17 },
});
