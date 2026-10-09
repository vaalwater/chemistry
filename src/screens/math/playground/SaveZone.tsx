import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { useSyncExternalStore } from 'react';
import { colors } from '../../../theme';
import { Box, Chip, Note, Zone } from '../zones/kit';
import {
  addSlot,
  clearSlots,
  deleteSlot,
  getSlots,
  slotSummary,
  subscribe,
  type FnSave,
  type GameSave,
} from '../../../math/playgroundSave';

/** 「存档」区：把当前写的函数 + 关卡存下来，随时读回去 */

interface Props {
  fns: FnSave[];
  params: Record<string, number>;
  game: GameSave;
  onLoad: (fns: FnSave[], params: Record<string, number>, game: GameSave | null) => void;
}

export default function SaveZone({ fns, params, game, onLoad }: Props) {
  const slots = useSyncExternalStore(subscribe, getSlots, getSlots);
  const [name, setName] = useState('');
  const [msg, setMsg] = useState<string | null>(null);

  const save = () => {
    const used = fns.filter((f) => f.expr.trim());
    if (!used.length && !game.on) {
      setMsg('先写一条函数，或者先开一关，再存档。');
      return;
    }
    const n = name.trim() || (game.on ? `闯关 · ${game.points.length} 个点` : `我的 ${used.length} 条函数`);
    addSlot({ name: n, fns: used, params, game });
    setName('');
    setMsg(`存好了：${n}（存在这台设备的浏览器里，刷新也还在）`);
  };

  return (
    <Zone
      tag="存档"
      title="存起来 · 下次接着玩"
      sub="存的是「写了哪几条函数（含颜色、参数）+ 当前这一关和命中情况」。浏览器里存在 localStorage，关掉再开还在。"
      color={colors.green}
    >
      <View style={styles.saveRow}>
        <TextInput
          style={styles.nameInput}
          value={name}
          onChangeText={setName}
          placeholder="存档名（可留空，自动起一个）"
          placeholderTextColor={colors.faint}
        />
      </View>
      <View style={styles.row}>
        <Chip label="保存当前" onPress={save} color={colors.green} icon="save-outline" />
        {slots.length ? <Chip label="清空全部" onPress={clearSlots} color={colors.red} icon="trash-outline" /> : null}
      </View>
      {msg ? <Note tone="good" text={msg} icon="checkmark-circle-outline" /> : null}

      {slots.length ? (
        <Box tone="soft">
          {slots.map((s) => (
            <View key={s.id} style={styles.slotRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.slotName}>{s.name}</Text>
                <Text style={styles.slotSum}>{slotSummary(s)}</Text>
              </View>
              <Chip
                label="载入"
                onPress={() => {
                  onLoad(s.fns, s.params, s.game);
                  setMsg(`读回来了：${s.name}`);
                }}
                color={colors.accent}
                icon="download-outline"
              />
              <Chip label="删" onPress={() => deleteSlot(s.id)} color={colors.red} icon="close-outline" />
            </View>
          ))}
        </Box>
      ) : (
        <Note text="还没有存档 —— 写几条函数、开一关，点「保存当前」就存下来了。" icon="archive-outline" />
      )}
    </Zone>
  );
}

const styles = StyleSheet.create({
  saveRow: { marginTop: 4 },
  nameInput: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 9,
    paddingHorizontal: 9,
    paddingVertical: 7,
    fontSize: 12.5,
    color: colors.ink,
    backgroundColor: '#FCFDFF',
  },
  row: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 6 },
  slotRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8, flexWrap: 'wrap' },
  slotName: { fontSize: 12.5, fontWeight: '800', color: colors.ink },
  slotSum: { fontSize: 11, color: colors.faint, marginTop: 2 },
});
