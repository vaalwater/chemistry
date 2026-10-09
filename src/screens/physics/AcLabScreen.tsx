import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme';
import Phys3DView from '../../components/Phys3DView';
import { AC_MODULES, type AcKey } from '../../physics/emContent';

/** 交流电「波形实验室」：四个图表场景，专治瞬时值 / 峰值 / 有效值 / 平均值搅在一起 */
export default function AcLabScreen({ onBack }: { onBack: () => void }) {
  const insets = useSafeAreaInsets();
  const [mod, setMod] = useState<AcKey>('phasor');
  const meta = AC_MODULES.find((m) => m.key === mod) || AC_MODULES[0];

  // 相量同步
  const [paused, setPaused] = useState(false);
  const [freq, setFreq] = useState(1);
  // 电场波传能（原「能量流」：主角换成电子与电场）
  const [ePaused, setEPaused] = useState(false);
  const [eFreq, setEFreq] = useState(1);
  const [eUm, setEUm] = useState(1);
  const [eR, setER] = useState(10);
  const [showQ, setShowQ] = useState(true);
  const [showE, setShowE] = useState(true);
  const [showB, setShowB] = useState(true);
  const [stretch, setStretch] = useState(true);
  // 发电机
  const [gPaused, setGPaused] = useState(false);
  const [omega, setOmega] = useState(1);
  const [gB, setGB] = useState(1);
  const [gN, setGN] = useState(100);
  const [showTorque, setShowTorque] = useState(true);
  // 有效值
  const [wave, setWave] = useState<'sine' | 'square' | 'half'>('sine');
  // 变压器
  const [N1, setN1] = useState(1000);
  const [N2, setN2] = useState(500);
  const [Rl, setRl] = useState(44);
  // 输电
  const [hv, setHv] = useState(false);
  const [rLine, setRLine] = useState(5);

  const cmd = useMemo(() => {
    const base = { cmd: 'phys', action: 'scene', id: meta.scene, step: 0 };
    if (mod === 'energy') {
      return { ...base, params: { paused: ePaused, freq: eFreq, Um: eUm, R: eR, showQ, showE, showB, stretch } };
    }
    if (mod === 'gen') {
      return { ...base, params: { paused: gPaused, omega, B: gB, N: gN, showTorque } };
    }
    if (mod === 'phasor') return { ...base, params: { paused, freq } };
    if (mod === 'rms') return { ...base, params: { wave, reset: false } };
    if (mod === 'transformer') return { ...base, params: { U1: 220, N1, N2, R: Rl } };
    return { ...base, params: { hv, r: rLine, P: 100, Ulv: 2, Uhv: 20 } };
  }, [meta.scene, mod, ePaused, eFreq, eUm, eR, showQ, showE, showB, stretch,
      gPaused, omega, gB, gN, showTorque, paused, freq, wave, N1, N2, Rl, hv, rLine]);

  const switchMod = (k: AcKey) => {
    setMod(k);
    setPaused(false);
    setWave('sine');
  };

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable style={styles.backBtn} onPress={onBack} accessibilityRole="button">
          <Ionicons name="chevron-back" size={18} color={colors.inkSoft} />
          <Text style={styles.backText}>返回</Text>
        </Pressable>
        <Text style={styles.title}>交流电波形实验室</Text>
      </View>

      <View style={styles.viewWrap}>
        <Phys3DView command={cmd} onEvent={() => {}} />
      </View>

      <ScrollView style={styles.panel} contentContainerStyle={styles.panelInner} showsVerticalScrollIndicator={false}>
        <View style={styles.chips}>
          {AC_MODULES.map((m) => (
            <Pressable key={m.key} style={[styles.chip, m.key === mod && styles.chipOn]} onPress={() => switchMod(m.key)} accessibilityRole="button">
              <Ionicons name={m.icon} size={13} color={m.key === mod ? '#fff' : colors.inkSoft} />
              <Text style={[styles.chipText, m.key === mod && styles.chipTextOn]}>{m.title}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.note}>{meta.desc}</Text>

        {mod === 'energy' && (
          <>
            <Row label="播放">
              <Seg on={!ePaused} onChange={(v) => setEPaused(!v)} yes="运转中" no="暂停" />
            </Row>
            <Row label={`频率 × ${eFreq}`}>
              <Ticks values={[0.5, 1, 2]} value={eFreq} onChange={setEFreq} />
            </Row>
            <Row label={`电压峰值 ${(eUm * 220).toFixed(0)} V`}>
              <Ticks values={[0.5, 1, 1.5]} value={eUm} onChange={setEUm} />
            </Row>
            <Row label={`负载 R = ${eR} Ω`}>
              <Ticks values={[5, 10, 20, 40]} value={eR} onChange={setER} />
            </Row>
            <Row label={stretch ? '空间比例 · 夸张' : '空间比例 · 接近真实'}>
              <Seg on={stretch} onChange={setStretch} yes="看得见推进" no="还原真实" />
            </Row>
            <Text style={styles.sectionTitle}>逐层关掉，看谁才是真正搬运能量的那个</Text>
            <View style={styles.chips}>
              {([
                { k: 'q', label: '电子', on: showQ, set: setShowQ },
                { k: 'e', label: '电场 E', on: showE, set: setShowE },
                { k: 'b', label: '磁场 B', on: showB, set: setShowB },
              ] as const).map((o) => (
                <Pressable key={o.k} style={[styles.chip, o.on && styles.chipOn]} onPress={() => o.set(!o.on)} accessibilityRole="button">
                  <Text style={[styles.chipText, o.on && styles.chipTextOn]}>{o.label}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.note}>
              先关掉「电场 E」：灯泡立刻不亮。再把「电子」也关掉：灯泡照样亮——搬能量的从来不是跑到灯泡的电子，
              而是沿线路推进的那条电磁行波。
            </Text>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>电场和磁场是怎么互相生成的</Text>
              <Text style={styles.cardBody}>
                · 看橙色箭头（电场 E，上下摆）和青色箭头（磁场 B，穿进穿出屏幕）：两者始终同起同落，
                  而且互相垂直、都垂直于传播方向——它们不是两个东西，是同一条波的两个面。{'\n'}
                · 橙色的旋涡环：这里磁场正在变化（法拉第 ∂B/∂t），于是就地生出了绕着它的涡旋电场。{'\n'}
                · 青色的旋涡环：这里电场正在变化（麦克斯韦-安培 ∂E/∂t），于是就地生出了绕着它的环形磁场。{'\n'}
                · 环最大＝变化最猛的地方，也就是 E 和 B 互相"生"得最厉害的地方；每过半周，旋向还会翻一次。
                  两个就这样互相托着、一路向灯泡推过去，全程没有一个电子在跑腿。
              </Text>
            </View>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>波长到底有多长</Text>
              <Text style={styles.cardBody}>
                · 真实答案：50 Hz 的行波 λ = c / f ≈ 6000 km（差不多北京到新加坡的距离）。{'\n'}
                · 家里几米、甚至几十公里的线路，只占这条波长的百万分之一，所以实际整段几乎同时到达峰值，
                  你根本看不出它在"推"。{'\n'}
                · 所以画面里的波长是被狠狠压缩过的（约 10⁶ 倍）。把上面的开关切到「还原真实」，
                  你会看到整条线路几乎同时变色——那才是你家墙里的真实样子。
              </Text>
            </View>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>能量就是这么跟着波到的</Text>
              <Text style={styles.cardBody}>
                看图：橙实线（电源侧）已经到峰值时，橙虚线（灯泡侧）还在路上慢半拍——这段时间差就是波把能量送过去的过程。
                等到波到达灯泡，那里才有电压、才有电流，灯泡才亮。{'\n'}
                橙（E）与青（i ∝ B）严格同相，于是 p = ui ≥ 0 恒成立：能量只能单向流向灯泡，所以灯一直亮着；
                而电子只是在原地踏步，来回振荡而已。
              </Text>
            </View>
          </>
        )}

        {mod === 'gen' && (
          <>
            <Row label="播放">
              <Seg on={!gPaused} onChange={(v) => setGPaused(!v)} yes="转动中" no="暂停" />
            </Row>
            <Row label={`转速 ω × ${omega}`}>
              <Ticks values={[0.5, 1, 2]} value={omega} onChange={setOmega} />
            </Row>
            <Row label={`磁感应强度 B × ${gB}`}>
              <Ticks values={[0.5, 1, 2]} value={gB} onChange={setGB} />
            </Row>
            <Row label={`线圈匝数 N = ${gN}`}>
              <Ticks values={[50, 100, 200, 400]} value={gN} onChange={setGN} />
            </Row>
            <Row label="阻力矩（楞次）">
              <Seg on={showTorque} onChange={(v) => setShowTorque(v)} yes="显示" no="隐藏" />
            </Row>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>法拉第 + 楞次，一个场景看全</Text>
              <Text style={styles.cardBody}>
                · 法拉第 e = −N·ΔΦ/Δt：电动势取决于磁通的"变化率"。线圈经过中性面时 Φ 最大，那一刻变化率为零，所以 e = 0。{'\n'}
                · 楞次定律：感应电流的方向总是阻碍磁通的变化，宏观上表现为那个红色阻力矩——转得越快、匝数越多，就越"费力"，这正是机械能变成电能的代价。
              </Text>
            </View>
          </>
        )}

        {mod === 'phasor' && (
          <>
            <Row label="播放">
              <Seg on={!paused} onChange={(v) => setPaused(!v)} yes="转动中" no="暂停" />
            </Row>
            <Row label={`角频率 ω × ${freq}`}>
              <View style={styles.chips}>
                {[0.5, 1, 2, 3].map((f) => (
                  <Pressable key={f} style={[styles.tick, freq === f && styles.tickOn]} onPress={() => setFreq(f)} accessibilityRole="button">
                    <Text style={[styles.tickText, freq === f && styles.tickTextOn]}>{f}</Text>
                  </Pressable>
                ))}
              </View>
            </Row>
          </>
        )}

        {mod === 'rms' && (
          <Row label="波形">
            <View style={styles.chips}>
              {([
                { k: 'sine', label: '正弦' },
                { k: 'square', label: '方波' },
                { k: 'half', label: '半波整流' },
              ] as const).map((w) => (
                <Pressable key={w.k} style={[styles.chip, wave === w.k && styles.chipOn]} onPress={() => setWave(w.k)} accessibilityRole="button">
                  <Text style={[styles.chipText, wave === w.k && styles.chipTextOn]}>{w.label}</Text>
                </Pressable>
              ))}
            </View>
          </Row>
        )}

        {mod === 'transformer' && (
          <>
            <Row label={`原线圈 N₁ = ${N1}`}>
              <Ticks values={[500, 1000, 2000, 4000]} value={N1} onChange={setN1} />
            </Row>
            <Row label={`副线圈 N₂ = ${N2}`}>
              <Ticks values={[100, 250, 500, 1000, 2000]} value={N2} onChange={setN2} />
            </Row>
            <Row label={`负载 R = ${Rl} Ω`}>
              <Ticks values={[11, 22, 44, 88, 220]} value={Rl} onChange={setRl} />
            </Row>
          </>
        )}

        {mod === 'transmit' && (
          <>
            <Row label="输电方式">
              <Seg on={hv} onChange={(v) => setHv(v)} yes="高压 20 kV" no="低压 2 kV" />
            </Row>
            <Row label={`线路电阻 r = ${rLine} Ω`}>
              <Ticks values={[2, 5, 10, 20]} value={rLine} onChange={setRLine} />
            </Row>
          </>
        )}

        <View style={{ height: 20 }} />
      </ScrollView>
    </View>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={styles.rowBody}>{children}</View>
    </View>
  );
}

function Seg({ on, onChange, yes, no }: { on: boolean; onChange: (v: boolean) => void; yes: string; no: string }) {
  return (
    <View style={styles.seg}>
      <Pressable style={[styles.segBtn, !on && styles.segBtnOn]} onPress={() => onChange(false)} accessibilityRole="button">
        <Text style={[styles.segText, !on && styles.segTextOn]}>{no}</Text>
      </Pressable>
      <Pressable style={[styles.segBtn, on && styles.segBtnOn]} onPress={() => onChange(true)} accessibilityRole="button">
        <Text style={[styles.segText, on && styles.segTextOn]}>{yes}</Text>
      </Pressable>
    </View>
  );
}

function Ticks({ values, value, onChange }: { values: number[]; value: number; onChange: (v: number) => void }) {
  return (
    <View style={styles.chips}>
      {values.map((v) => (
        <Pressable key={v} style={[styles.tick, value === v && styles.tickOn]} onPress={() => onChange(v)} accessibilityRole="button">
          <Text style={[styles.tickText, value === v && styles.tickTextOn]}>{v}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: 16, paddingBottom: 6 },
  backBtn: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', marginBottom: 6 },
  backText: { fontSize: 14, color: colors.inkSoft, fontWeight: '600', marginLeft: 2 },
  title: { fontSize: 22, fontWeight: '800', color: colors.ink },
  viewWrap: { flex: 1, minHeight: 250, marginHorizontal: 10, borderRadius: 16, overflow: 'hidden', backgroundColor: '#0a1026' },
  panel: { maxHeight: '46%' },
  panelInner: { paddingHorizontal: 14, paddingTop: 8 },
  note: { fontSize: 12, color: colors.faint, marginTop: 4, lineHeight: 18 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', paddingBottom: 4 },
  chip: {
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16,
    marginRight: 8, marginBottom: 6, backgroundColor: '#eef2f8',
    flexDirection: 'row', alignItems: 'center',
  },
  chipOn: { backgroundColor: colors.orange },
  chipText: { color: colors.inkSoft, fontSize: 13, fontWeight: '600', marginLeft: 4 },
  chipTextOn: { color: '#fff' },
  row: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  rowLabel: { fontSize: 13, color: colors.inkSoft, fontWeight: '700', width: 108 },
  rowBody: { flex: 1 },
  seg: { flexDirection: 'row', backgroundColor: '#eef2f8', borderRadius: 12, padding: 3 },
  segBtn: { flex: 1, paddingVertical: 6, borderRadius: 10, alignItems: 'center' },
  segBtnOn: { backgroundColor: '#fff', shadowColor: '#1f3764', shadowOpacity: 0.12, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 2 },
  segText: { fontSize: 12.5, color: colors.faint, fontWeight: '600' },
  segTextOn: { color: colors.orange },
  tick: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12,
    backgroundColor: '#eef2f8', marginRight: 7, marginBottom: 5,
  },
  tickOn: { backgroundColor: colors.orange },
  tickText: { fontSize: 12.5, color: colors.inkSoft, fontWeight: '700' },
  tickTextOn: { color: '#fff' },
  sectionTitle: { fontSize: 12.5, fontWeight: '700', color: colors.sub, marginTop: 12, marginBottom: 6 },
  card: { backgroundColor: colors.card, borderRadius: 16, padding: 14, marginTop: 12 },
  cardTitle: { fontSize: 14, fontWeight: '800', color: colors.ink },
  cardBody: { fontSize: 12.5, color: colors.sub, marginTop: 7, lineHeight: 19 },
});
