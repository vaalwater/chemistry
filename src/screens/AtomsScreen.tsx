import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { colors } from '../theme';
import { content } from '../data';

interface Props {
  onOpen: (kind: 'atom', id: string) => void;
}

/** 长式周期表 1..118 定位：主表行 1..7、列 1..18；57-71/89-103 抽到镧系/锕系底行 */
function ptKey(z: number): string {
  if (z >= 57 && z <= 71) return `L${z - 57}`;
  if (z >= 89 && z <= 103) return `A${z - 89}`;
  if (z === 1) return '1-1';
  if (z === 2) return '1-18';
  if (z <= 10) {
    const i = z - 2;
    return `2-${i <= 2 ? i : i + 10}`;
  }
  if (z <= 18) {
    const i = z - 10;
    return `3-${i <= 2 ? i : i + 10}`;
  }
  if (z <= 36) return `4-${z - 18}`;
  if (z <= 54) return `5-${z - 36}`;
  if (z <= 56) return `6-${z - 54}`;
  if (z <= 86) return `6-${z - 68}`; // 72→4 … 86→18
  if (z <= 88) return `7-${z - 86}`;
  return `7-${z - 100}`; // 104→4 … 118→18
}

export default function AtomsScreen({ onOpen }: Props) {
  const { width: winW } = useWindowDimensions();
  const elements = [...content.elements].sort((a, b) => a.p - b.p);
  const byKey = new Map(elements.map((el) => [ptKey(el.p), el]));

  // 页面可用宽度内尽量放大，最大 18 列 × 44px，超宽时允许横向滚动
  const avail = Math.min(Math.max(winW - 24, 300), 792);
  const cellW = Math.floor(avail / 18);
  const cellH = Math.round(Math.max(cellW * 1.12, 30));
  const tableW = cellW * 18;
  const showName = cellW >= 34;
  const fBlocks: { tag: string; label: string; zs: number[] }[] = [
    { tag: 'L', label: '镧系 57–71', zs: Array.from({ length: 15 }, (_, i) => 57 + i) },
    { tag: 'A', label: '锕系 89–103', zs: Array.from({ length: 15 }, (_, i) => 89 + i) },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>原子结构</Text>
        <Text style={styles.subtitle}>
          已收录完整周期表 118 种元素 · 实色为高中常用元素，半透明为补充的少见元素（点击仍可查看电子层构型）
        </Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.hScroll}
      >
        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={{ width: tableW }}>
            {[1, 2, 3, 4, 5, 6, 7].map((row) => (
              <View key={row} style={styles.row}>
                {Array.from({ length: 18 }, (_, gi) => {
                  const col = gi + 1;
                  const el = byKey.get(`${row}-${col}`);
                  if (!el) {
                    // 第 6/7 周期第 3 列留空，提示镧系/锕系已抽到下方底行
                    const isGap = (row === 6 || row === 7) && col === 3;
                    return (
                      <View key={col} style={[styles.cellEmpty, { width: cellW, height: cellH }]}>
                        {isGap ? (
                          <Text style={styles.gapText} numberOfLines={1}>
                            {row === 6 ? '57–71' : '89–103'}
                          </Text>
                        ) : null}
                      </View>
                    );
                  }
                  const dim = el.core === false;
                  return (
                    <Pressable
                      key={col}
                      onPress={() => onOpen('atom', el.symbol)}
                      accessibilityRole="button"
                      accessibilityLabel={`${el.name} ${el.symbol}，原子序数 ${el.p}${dim ? '，补充元素' : ''}`}
                      style={({ pressed }) => [
                        styles.cell,
                        { width: cellW, height: cellH, backgroundColor: el.color },
                        dim && { opacity: 0.5 },
                        pressed && { opacity: dim ? 0.72 : 0.7, transform: [{ scale: 0.94 }] },
                      ]}
                    >
                      {cellW >= 22 ? (
                        <Text style={[styles.cellZ, { color: mixInk(el.color) }]}>{el.p}</Text>
                      ) : null}
                      <Text
                        style={[
                          styles.cellSym,
                          { color: mixInk(el.color), fontSize: Math.min(15, Math.max(9, cellW * 0.52)) },
                        ]}
                      >
                        {el.symbol}
                      </Text>
                      {showName ? (
                        <Text style={[styles.cellCn, { color: mixInk(el.color) }]}>{el.name}</Text>
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>
            ))}
            {/* 镧系 / 锕系两行：挂在主表第 3~17 列下方 */}
            {fBlocks.map((fb) => (
              <View key={fb.tag} style={styles.row}>
                <View style={[styles.fLabel, { width: cellW * 2, height: cellH }]}>
                  <Text style={styles.fLabelText} numberOfLines={2}>
                    {fb.label}
                  </Text>
                </View>
                {fb.zs.map((z) => {
                  const el = byKey.get(fb.tag + (z - (fb.tag === 'L' ? 57 : 89)));
                  if (!el) return null;
                  return (
                    <Pressable
                      key={z}
                      onPress={() => onOpen('atom', el.symbol)}
                      accessibilityRole="button"
                      accessibilityLabel={`${el.name} ${el.symbol}，原子序数 ${el.p}，补充元素`}
                      style={({ pressed }) => [
                        styles.cell,
                        { width: cellW, height: cellH, backgroundColor: el.color, opacity: 0.5 },
                        pressed && { opacity: 0.72, transform: [{ scale: 0.94 }] },
                      ]}
                    >
                      {cellW >= 22 ? (
                        <Text style={[styles.cellZ, { color: mixInk(el.color) }]}>{el.p}</Text>
                      ) : null}
                      <Text
                        style={[
                          styles.cellSym,
                          { color: mixInk(el.color), fontSize: Math.min(15, Math.max(9, cellW * 0.52)) },
                        ]}
                      >
                        {el.symbol}
                      </Text>
                      {showName ? (
                        <Text style={[styles.cellCn, { color: mixInk(el.color) }]}>{el.name}</Text>
                      ) : null}
                    </Pressable>
                  );
                })}
                <View style={{ width: cellW, height: cellH }} />
              </View>
            ))}
          </View>
        </ScrollView>
      </ScrollView>
      <View style={styles.legend}>
        <View style={styles.legendRow}>
          <View style={[styles.legendDot, { backgroundColor: '#ff5a52' }]} />
          <Text style={styles.legendText}>质子（红）</Text>
          <View style={[styles.legendDot, { backgroundColor: '#9aa3b2', marginLeft: 14 }]} />
          <Text style={styles.legendText}>中子（灰）</Text>
          <View style={[styles.legendDot, { backgroundColor: '#2f7df6', marginLeft: 14 }]} />
          <Text style={styles.legendText}>电子云（彩色，静态）</Text>
        </View>
        <View style={[styles.legendRow, { marginTop: 8 }]}>
          <View style={[styles.legendDot, { backgroundColor: '#e8923a' }]} />
          <Text style={styles.legendText}>实色 = 高中常用元素</Text>
          <View style={[styles.legendDot, { opacity: 0.5, backgroundColor: '#c6ade4', marginLeft: 14 }]} />
          <Text style={styles.legendText}>半透明 = 补充元素（少见/放射性）</Text>
        </View>
        <Text style={styles.legendSub}>
          彩色云带=各能层电子出现概率（静态示意，非真实轨迹）；由内向外 青/蓝/紫/粉 对应 K/L/M/N 层；进入后查看亚层构型与八隅体规则
        </Text>
      </View>
    </View>
  );
}

function mixInk(hex: string): string {
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
  hScroll: { paddingHorizontal: 12 },
  row: { flexDirection: 'row', marginBottom: 5 },
  cell: {
    borderRadius: 5,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(22,50,79,0.12)',
    overflow: 'hidden',
  },
  cellEmpty: { borderRadius: 5, backgroundColor: 'rgba(30,47,74,0.045)', alignItems: 'center', justifyContent: 'center' },
  gapText: { fontSize: 9, color: colors.faint, textAlign: 'center' },
  cellZ: {
    position: 'absolute',
    top: 1.5,
    left: 3,
    fontSize: 8,
    fontWeight: '700',
    opacity: 0.85,
  },
  cellSym: { fontWeight: '800', lineHeight: 18 },
  cellCn: { fontSize: 9, marginTop: -2 },
  fLabel: { alignItems: 'flex-start', justifyContent: 'center', paddingHorizontal: 4 },
  fLabelText: { fontSize: 9, color: colors.faint, lineHeight: 12 },
  legend: {
    backgroundColor: '#eef4fd',
    borderRadius: 14,
    padding: 12,
    marginHorizontal: 12,
    marginVertical: 10,
  },
  legendRow: { flexDirection: 'row', alignItems: 'center' },
  legendDot: { width: 12, height: 12, borderRadius: 6 },
  legendText: { color: colors.sub, fontSize: 12, marginLeft: 6 },
  legendSub: { color: colors.faint, fontSize: 11, marginTop: 8, lineHeight: 16 },
});
