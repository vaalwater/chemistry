import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../../../theme';
import { Box, Chip, Note, Zone } from '../zones/kit';
import { DIFFS, FAMILIES, fmtNum, maskText, presetById, type Family, type Level } from '../../../math/game';

/**
 * 「游戏」区
 *
 * 开一关：随机抽一条高中常见函数，从它身上取 n 个点（难度越高点越多）。
 * 你写的函数穿过所有点 = 通关。答案默认打码，只给类别提示，想看再点「揭晓」。
 */

interface Props {
  gameOn: boolean;
  setGameOn: (v: boolean) => void;
  family: Family;
  setFamily: (f: Family) => void;
  diff: number;
  setDiff: (d: number) => void;
  level: Level;
  onNewLevel: () => void;
  /** 每个点有没有被某条函数穿过：key 是点的小名 P1 / P2 … */
  hitMap: Record<string, boolean>;
  revealed: boolean;
  setRevealed: (v: boolean) => void;
}

export default function GameZone({
  gameOn,
  setGameOn,
  family,
  setFamily,
  diff,
  setDiff,
  level,
  onNewLevel,
  hitMap,
  revealed,
  setRevealed,
}: Props) {
  const preset = presetById(level.presetId);
  const keys = level.points.map((_, i) => `P${i + 1}`);
  const cleared = keys.filter((k) => hitMap[k]).length;
  const allClear = keys.length > 0 && cleared === keys.length;

  return (
    <Zone
      tag="游戏"
      title="穿点挑战"
      sub="开一关，随机给你第一象限里的几个整点（x、y 都是整数，且一定在某条高中常见函数上）：写的函数只要同时穿过它们就算过关。难度越高，点越多 —— 点多了，光靠一条直线就不够了。"
      color={colors.orange}
    >
      <View style={styles.row}>
        <Chip
          label={gameOn ? '游戏模式：开' : '游戏模式：关'}
          on={gameOn}
          onPress={() => setGameOn(!gameOn)}
          color={colors.orange}
          icon={gameOn ? 'game-controller' : 'game-controller-outline'}
        />
        <Chip label="换一批点" onPress={onNewLevel} color={colors.accent} icon="shuffle-outline" />
      </View>

      <Text style={styles.sub}>难度（点数）</Text>
      <View style={styles.row}>
        {DIFFS.map((d, i) => (
          <Chip key={d.label} label={`${d.label} · ${d.n}点`} on={diff === i} onPress={() => setDiff(i)} color={colors.orange} />
        ))}
      </View>
      <Note text={DIFFS[diff].note} icon="speedometer-outline" />

      <Text style={styles.sub}>答案来自哪一类函数</Text>
      <View style={styles.row}>
        {FAMILIES.map((f) => (
          <Chip key={f} label={f} on={family === f} onPress={() => setFamily(f)} color={colors.purple} />
        ))}
      </View>

      <Box tone={allClear ? 'good' : 'soft'}>
        <Text style={styles.sub}>这一关的点（都在第一象限，且全是整点）</Text>
        <View style={styles.row}>
          {level.points.map((p, i) => {
            const k = keys[i];
            const ok = !!hitMap[k];
            return (
              <View key={k} style={[styles.pointChip, ok && styles.pointChipOn]}>
                <Text style={[styles.pointText, ok && styles.pointTextOn]}>
                  {k} ({fmtNum(p.x)}, {fmtNum(p.y)}){ok ? ' ✓' : ''}
                </Text>
              </View>
            );
          })}
        </View>
        <Text style={styles.progress}>
          {cleared} / {keys.length} 个整点的曲线已经找到{allClear ? '　—— 通关！' : ''}
        </Text>
        {keys.length < DIFFS[diff].n ? (
          <Note
            tone="sub"
            icon="information-circle-outline"
            text={`这一类函数在这一关只能凑出 ${keys.length} 个整点（本来要 ${DIFFS[diff].n} 个），所以本关就是 ${keys.length} 个点。`}
          />
        ) : null}
        {allClear ? <Note tone="good" icon="trophy-outline" text="全部穿过 —— 这一关过了，可以换一批点继续。" /> : null}
      </Box>

      <Box tone="soft">
        <Text style={styles.sub}>答案（默认打码）</Text>
        <Text style={styles.masked}>{revealed ? (preset?.expr ?? '—') : maskText(preset?.expr ?? '—')}</Text>
        <Text style={styles.hint}>提示：{preset?.hint ?? '—'}</Text>
        <View style={styles.row}>
          <Chip
            label={revealed ? '重新打码' : '揭晓答案'}
            on={revealed}
            onPress={() => setRevealed(!revealed)}
            color={colors.purple}
            icon={revealed ? 'eye-off-outline' : 'eye-outline'}
          />
        </View>
        {revealed ? (
          <Note tone="warn" text={`答案就是 ${preset?.expr ?? ''} —— 真想练手，建议先自己试，实在不行再看。`} />
        ) : null}
      </Box>
    </Zone>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 4 },
  sub: { fontSize: 11.5, fontWeight: '800', color: colors.ink, marginTop: 8 },
  progress: { fontSize: 12, fontWeight: '700', color: colors.inkSoft, marginTop: 6 },
  masked: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.purple,
    letterSpacing: 2,
    marginTop: 6,
    fontFamily: 'monospace' as unknown as undefined,
  },
  hint: { fontSize: 11.5, color: colors.sub, marginTop: 6, lineHeight: 17 },
  pointChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: '#F5F8FE',
    marginRight: 6,
    marginBottom: 6,
  },
  pointChipOn: { backgroundColor: colors.green, borderColor: colors.green },
  pointText: { fontSize: 11.5, fontWeight: '700', color: colors.inkSoft },
  pointTextOn: { color: '#fff' },
});
