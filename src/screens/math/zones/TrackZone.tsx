import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../../theme';
import { discriminant, fmtSet } from '../../../math/setCore';
import { TRACK, TRANSFORM_RULES } from '../../../math/setCase';
import { answerRuns, coefOf, evalA, evalB, inclusionHolds, mainParam, type MathObj } from '../../../math/setObject';
import { Box, Chip, Note, Zone } from './kit';

interface Props {
  obj: MathObj;
  patch: (p: Partial<MathObj>) => void;
  onUnresolved: (list: string[]) => void;
  locked?: boolean;
  fireProbe: (pid: string) => void;
}

/** 右区：推理轨道 —— 每一步变形一个站点，绿实线等价，红虚线要补条件 */
export default function TrackZone({ obj, patch, onUnresolved, locked, fireProbe }: Props) {
  const [done, setDone] = useState<string[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [showRules, setShowRules] = useState(false);
  const [showCounter, setShowCounter] = useState(false);

  const c = coefOf(obj);
  const disc = c ? discriminant(c[0], c[1], c[2]) : null;
  const branch: 'empty' | 'nonempty' | null = disc === null ? null : disc < 0 ? 'empty' : 'nonempty';
  const p = mainParam(obj);
  /** 答案不能写死：系数可以随便拖，成立范围当场扫出来 */
  const ans = useMemo(() => (p ? answerRuns(obj, p, -6, 6) : []), [obj, p]);

  const stations = useMemo(
    () => TRACK.filter((s) => s.branch === 'both' || s.branch === branch),
    [branch]
  );

  const risks = stations.filter((s) => s.kind === 'risk');
  const unresolved = risks.filter((s) => !done.includes(s.id));
  const missingList = unresolved.map((s) => s.missing ?? `「${s.title}」缺条件`);

  useEffect(() => {
    onUnresolved(missingList);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [missingList.join('|')]);

  const add = (id: string) => {
    if (done.includes(id)) return;
    setDone((prev) => [...prev, id]);
    const s = TRACK.find((x) => x.id === id);
    if (s?.id === 'st6') fireProbe('p-endpoint');
    if (s?.id === 'st4') fireProbe('p-rootpos');
  };

  const counter = useMemo(() => findCounter(obj), [obj]);

  return (
    <Zone tag="写步骤" title="推理的每一步" sub="绿色实线：这一步放心写；红色虚线：这一步还得再加一句话才站得住" color={colors.green}>
      <View style={{ opacity: locked ? 0.6 : 1 }}>
        <View style={styles.entryRow}>
          <Chip
            label={branch === 'empty' ? '现在在 A = ∅ 这一支' : branch === 'nonempty' ? '现在在 A ≠ ∅ 这一支' : '这不是二次的问题'}
            on
            onPress={() => undefined}
            color={branch === 'empty' ? colors.cyan : colors.green}
            icon="git-commit-outline"
          />
          <Chip label={showRules ? '收起变形规则' : '哪些变形要小心'} on={showRules} onPress={() => setShowRules(!showRules)} color={colors.faint} icon="list-outline" />
        </View>

        {showRules ? (
          <Box tone="soft">
            {TRANSFORM_RULES.map((r) => (
              <View key={r.op} style={styles.ruleRow}>
                <View style={[styles.ruleDot, { backgroundColor: r.risky ? colors.red : colors.green }]} />
                <Text style={styles.ruleOp}>{r.op}</Text>
                <Text style={[styles.ruleTip, { color: r.risky ? colors.red : colors.green }]}>{r.risky ? '红虚线' : '绿实线'}</Text>
                <Text style={styles.ruleText}>{r.tip}</Text>
              </View>
            ))}
          </Box>
        ) : null}

        <View style={styles.track}>
          {stations.map((s, i) => {
            const ok = s.kind === 'equiv' || done.includes(s.id);
            const lineColor = ok ? colors.green : colors.red;
            const isOpen = open === s.id;
            return (
              <View key={s.id}>
                {i > 0 ? (
                  <View style={styles.lineWrap}>
                    {ok ? (
                      <View style={[styles.line, { backgroundColor: colors.green }]} />
                    ) : (
                      <>
                        <View style={styles.dash} />
                        <View style={styles.dash} />
                        <View style={styles.dash} />
                      </>
                    )}
                  </View>
                ) : null}
                <Pressable
                  style={[styles.station, { borderColor: lineColor, backgroundColor: ok ? '#F4FBF7' : '#FDF2F1' }]}
                  onPress={() => setOpen(isOpen ? null : s.id)}
                  accessibilityRole="button"
                >
                  <View style={[styles.badge, { backgroundColor: ok ? colors.green : colors.red }]}>
                    <Text style={styles.badgeText}>{i + 1}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.stTitle}>{s.title}</Text>
                    <Text style={styles.stTag}>
                      {s.kind === 'equiv' ? '可以放心写' : '还得补一句话'} ·{' '}
                      {s.branch === 'both' ? '两支都要' : s.branch === 'empty' ? 'A=∅ 这一支' : 'A≠∅ 这一支'}
                    </Text>
                  </View>
                  <Ionicons name={ok ? 'checkmark-circle' : 'warning'} size={15} color={ok ? colors.green : colors.red} />
                </Pressable>

                {isOpen ? (
                  <Box tone={ok ? 'good' : 'bad'}>
                    <Text style={styles.detail}>{s.detail}</Text>
                    {s.kind === 'risk' ? (
                      <>
                        <Text style={styles.need}>要补：{s.need}</Text>
                        {ok ? (
                          <Text style={styles.after}>补上之后：{s.after}</Text>
                        ) : (
                          <>
                            <Text style={styles.warn}>少了这句话，答案就站不住：{s.missing}</Text>
                            <View style={styles.entryRow}>
                              <Chip label="把这句补上" onPress={() => add(s.id)} color={colors.red} icon="add-circle-outline" />
                              <Chip label="看个反例" onPress={() => { setShowCounter(true); fireProbe('p-rootpos'); }} color={colors.orange} icon="eye-outline" />
                            </View>
                          </>
                        )}
                      </>
                    ) : null}
                  </Box>
                ) : null}
              </View>
            );
          })}
        </View>

        {unresolved.length ? (
          <Box tone="bad">
            <Text style={styles.resTitle}>还有 {unresolved.length} 个地方没说清楚</Text>
            {missingList.map((t) => (
              <Note key={t} text={t} tone="bad" icon="alert-circle-outline" />
            ))}
            <Text style={styles.strict}>现在的答案：还不够严谨 ✗</Text>
            {showCounter && counter ? (
              <Text style={styles.counter}>
                反例：{counter.p} = {counter.v} 的时候，A = {fmtSet(counter.set)}，并没有落在 B = {fmtSet(evalB(obj))} 里面。
              </Text>
            ) : null}
            {showCounter && !counter ? <Text style={styles.counter}>在现在的参数范围内找不到反例 —— 说明这一支的条件其实是够的。</Text> : null}
          </Box>
        ) : (
          <Box tone="good">
            <Text style={styles.resTitle}>每一步都站得住了</Text>
            <Text style={styles.detail}>
              答案分两支：一支是 A 变成空集（Δ &lt; 0），另一支是 Δ = 0 且重根刚好落在 B 上。
              {p && ans.length
                ? `把 ${p} 从头到尾扫一遍，真正成立的取值范围是 ${ans
                    .map((r) => `${round3(r.lo)} ≤ ${p} ≤ ${round3(r.hi)}`)
                    .join('，或 ')} —— 边界要不要带上，得代回去试。`
                : ''}
            </Text>
            {p && ans.length ? (
              <View style={styles.entryRow}>
                <Chip
                  label={`停在答案端点 ${p} = ${round3(ans[ans.length - 1].hi)}`}
                  onPress={() => patch({ vals: { ...obj.vals, [p]: round3(ans[ans.length - 1].hi) } })}
                  color={colors.green}
                  icon="flag-outline"
                />
                <Chip
                  label={`回到答案中间 ${p} = ${round3((ans[0].lo + ans[0].hi) / 2)}`}
                  onPress={() => patch({ vals: { ...obj.vals, [p]: round3((ans[0].lo + ans[0].hi) / 2) } })}
                  color={colors.cyan}
                  icon="ban-outline"
                />
              </View>
            ) : null}
          </Box>
        )}
      </View>
    </Zone>
  );
}

/** 找一个“看着对其实错”的参数取值当反例 */
function findCounter(obj: MathObj): { p: string; v: number; set: ReturnType<typeof evalA> } | null {
  const p = mainParam(obj);
  if (!p) return null;
  for (let i = 0; i <= 240; i += 1) {
    const v = Math.round((-6 + (12 * i) / 240) * 100) / 100;
    const next = { ...obj, vals: { ...obj.vals, [p]: v } };
    const cc = coefOf(next);
    if (!cc) return null;
    if (discriminant(cc[0], cc[1], cc[2]) < 0) continue;
    if (!inclusionHolds(next)) {
      return { p, v, set: evalA(next) };
    }
  }
  return null;
}

function round3(v: number): number {
  return Math.round(v * 100) / 100;
}

const styles = StyleSheet.create({
  entryRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 6 },
  track: { marginTop: 10 },
  lineWrap: { paddingLeft: 13 },
  line: { width: 2, height: 10, marginVertical: 1, marginLeft: 1 },
  dash: { width: 2, height: 3, backgroundColor: colors.red, marginBottom: 1 },
  station: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    padding: 9,
  },
  badge: { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginRight: 9 },
  badgeText: { fontSize: 11, fontWeight: '800', color: '#fff' },
  stTitle: { fontSize: 12.5, fontWeight: '800', color: colors.ink, lineHeight: 17 },
  stTag: { fontSize: 10.5, color: colors.faint, marginTop: 2 },
  detail: { fontSize: 12, color: colors.inkSoft, lineHeight: 18 },
  need: { fontSize: 12, color: colors.red, fontWeight: '700', marginTop: 6, lineHeight: 17 },
  after: { fontSize: 12, color: colors.green, fontWeight: '700', marginTop: 6, lineHeight: 17 },
  warn: { fontSize: 11.5, color: colors.red, marginTop: 5, lineHeight: 17 },
  ruleRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', marginTop: 6 },
  ruleDot: { width: 8, height: 8, borderRadius: 4, marginRight: 7 },
  ruleOp: { fontSize: 12, fontWeight: '700', color: colors.ink, width: 128 },
  ruleTip: { fontSize: 11, fontWeight: '800', marginRight: 8 },
  ruleText: { flex: 1, fontSize: 11.5, color: colors.sub, lineHeight: 16 },
  resTitle: { fontSize: 11.5, fontWeight: '800', color: colors.faint, letterSpacing: 0.3 },
  strict: { fontSize: 12, fontWeight: '800', color: colors.red, marginTop: 6 },
  counter: { fontSize: 11.5, color: colors.orange, marginTop: 5, lineHeight: 17, fontWeight: '600' },
});
