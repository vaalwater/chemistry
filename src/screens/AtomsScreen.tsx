import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, radii } from '../theme';
import { content, shellCountText } from '../data';

interface Props {
  onOpen: (kind: 'atom', id: string) => void;
}

export default function AtomsScreen({ onOpen }: Props) {
  const elements = [...content.elements].sort((a, b) => a.p - b.p);
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>原子结构</Text>
        <Text style={styles.subtitle}>前 20 号元素 + 常见金属 · 彩色轨迹云分层示意，进入后查看构型与八隅体</Text>
      </View>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <View style={styles.grid}>
          {elements.map((el) => (
            <Pressable
              key={el.symbol}
              style={({ pressed }) => [styles.tile, pressed && { transform: [{ scale: 0.96 }] }]}
              onPress={() => onOpen('atom', el.symbol)}
            >
              <View style={[styles.zBadge, { backgroundColor: el.color }]}>
                <Text style={[styles.zText, { color: mixInk(el.color) }]}>{el.p}</Text>
              </View>
              <Text style={[styles.sym, { color: mixInk(el.color) }]}>{el.symbol}</Text>
              <Text style={styles.cn}>{el.name}</Text>
              <Text style={styles.shells} numberOfLines={1}>
                {shellCountText(el)}
              </Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.legend}>
          <View style={styles.legendRow}>
            <View style={[styles.legendDot, { backgroundColor: '#ff5a52' }]} />
            <Text style={styles.legendText}>质子（红）</Text>
            <View style={[styles.legendDot, { backgroundColor: '#9aa3b2', marginLeft: 14 }]} />
            <Text style={styles.legendText}>中子（灰）</Text>
            <View style={[styles.legendDot, { backgroundColor: '#2f7df6', marginLeft: 14 }]} />
            <Text style={styles.legendText}>电子云（彩色，静态）</Text>
          </View>
          <Text style={styles.legendSub}>
            彩色云带=各能层电子出现概率（静态示意，非真实轨迹）；由内向外 青/蓝/紫/粉 对应 K/L/M/N 层；进入后查看亚层构型与八隅体规则
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

function mixInk(hex: string): string {
  // 简单取色相明度，保证深色元素文字可读
  const c = hex.replace('#', '');
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  const lum = (r * 299 + g * 587 + b * 114) / 1000;
  return lum > 150 ? colors.ink : '#ffffff';
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 8 },
  title: { fontSize: 30, fontWeight: '800', color: colors.ink },
  subtitle: { fontSize: 13, color: colors.sub, marginTop: 6 },
  scroll: { paddingHorizontal: 12, paddingTop: 6 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  tile: {
    width: '24.2%',
    backgroundColor: colors.card,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 10,
  },
  zBadge: {
    position: 'absolute',
    top: 6,
    left: 8,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  zText: { color: 'rgba(255,255,255,0.95)', fontSize: 10, fontWeight: '800' },
  sym: { fontSize: 26, fontWeight: '800', marginTop: 4 },
  cn: { fontSize: 12, color: colors.sub, marginTop: 2 },
  shells: { fontSize: 10, color: colors.faint, marginTop: 6, paddingHorizontal: 4 },
  legend: {
    backgroundColor: '#eef4fd',
    borderRadius: 14,
    padding: 12,
    marginTop: 6,
  },
  legendRow: { flexDirection: 'row', alignItems: 'center' },
  legendDot: { width: 12, height: 12, borderRadius: 6 },
  legendText: { color: colors.sub, fontSize: 12, marginLeft: 6 },
  legendSub: { color: colors.faint, fontSize: 11, marginTop: 8, lineHeight: 16 },
});
