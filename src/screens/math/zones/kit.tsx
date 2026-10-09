import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, shadow } from '../../../theme';

export type IconName = React.ComponentProps<typeof Ionicons>['name'];

/* ------------------------------------------------------------------ *
 * 手机上快速跳转：记下每一区的位置，点一下就滚过去
 * ------------------------------------------------------------------ */

const anchors: Record<string, number> = {};
let scrollNode: { scrollTo: (o: { y: number; animated?: boolean }) => void } | null = null;

export function bindScroller(node: unknown) {
  scrollNode = node as typeof scrollNode;
}

export function jumpToZone(tag: string) {
  const y = anchors[tag];
  if (scrollNode && typeof y === 'number') scrollNode.scrollTo({ y: Math.max(0, y - 6), animated: true });
}

/** 各区的名字（跳转条要用） */
export const ZONE_TAGS = ['读题', '看图', '试参数', '写步骤', '根的关系', '我的记录'];

/**
 * 弹簧数值：目标值跳变时不直接跳过去，而是过冲一点点再回弹。
 * 中区含参端点（“含参端点带弹簧效果”）就是靠它。
 */
export function useSpringNumber(target: number, stiffness = 0.24, damping = 0.68): number {
  const [v, setV] = useState(target);
  const ref = useRef({ v: target, vel: 0 });

  useEffect(() => {
    let alive = true;
    let raf = 0;
    const step = () => {
      if (!alive) return;
      const s = ref.current;
      const dx = target - s.v;
      s.vel = s.vel * damping + dx * stiffness;
      s.v += s.vel;
      if (Math.abs(target - s.v) < 0.0015 && Math.abs(s.vel) < 0.0015) {
        s.v = target;
        s.vel = 0;
        setV(target);
        return;
      }
      setV(s.v);
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
    };
  }, [target, stiffness, damping]);

  return v;
}

/**
 * 一「区」的容器：左侧色条 + 区名 + 标题。
 * 手机上标题可点开 / 收起，方便在小屏上一屏只看一块。
 */
export function Zone({
  tag,
  title,
  sub,
  color = colors.purple,
  children,
  flex,
}: {
  tag: string;
  title: string;
  sub?: string;
  color?: string;
  children: React.ReactNode;
  flex?: number;
}) {
  const { width } = useWindowDimensions();
  const collapsible = width < 980;
  const [open, setOpen] = useState(true);

  useEffect(() => {
    if (!collapsible) setOpen(true);
  }, [collapsible]);

  return (
    <View
      style={[styles.zone, flex ? { flex } : null]}
      onLayout={(e) => {
        anchors[tag] = e.nativeEvent.layout.y;
      }}
    >
      <View style={[styles.rail, { backgroundColor: color }]} />
      <View style={styles.zoneBody}>
        <Pressable
          style={styles.zoneHead}
          onPress={collapsible ? () => setOpen((v) => !v) : undefined}
          accessibilityRole={collapsible ? 'button' : undefined}
        >
          <View style={[styles.tagChip, { backgroundColor: `${color}1c` }]}>
            <Text style={[styles.tagText, { color }]}>{tag}</Text>
          </View>
          <Text style={styles.zoneTitle}>{title}</Text>
          {collapsible ? (
            <Ionicons name={open ? 'chevron-up-outline' : 'chevron-down-outline'} size={15} color={colors.faint} />
          ) : null}
        </Pressable>
        {open ? (
          <>
            {sub ? <Text style={styles.zoneSub}>{sub}</Text> : null}
            {children}
          </>
        ) : null}
      </View>
    </View>
  );
}

/** 小胶囊开关 */
export function Chip({
  label,
  on,
  onPress,
  color = colors.purple,
  disabled,
  icon,
}: {
  label: string;
  on?: boolean;
  onPress: () => void;
  color?: string;
  disabled?: boolean;
  icon?: IconName;
}) {
  return (
    <Pressable
      style={[styles.chip, on && { backgroundColor: color, borderColor: color }, disabled && styles.chipOff]}
      onPress={disabled ? undefined : onPress}
      accessibilityRole="button"
    >
      {icon ? <Ionicons name={icon} size={12} color={on ? '#fff' : color} /> : null}
      <Text style={[styles.chipText, { color: on ? '#fff' : color }, icon ? { marginLeft: 5 } : null]}>
        {label}
      </Text>
    </Pressable>
  );
}

/** 一行「图标 + 文案」说明 */
export function Note({
  text,
  tone = 'sub',
  icon = 'information-circle-outline',
}: {
  text: string;
  tone?: 'sub' | 'warn' | 'bad' | 'good';
  icon?: IconName;
}) {
  const c =
    tone === 'warn' ? colors.orange : tone === 'bad' ? colors.red : tone === 'good' ? colors.green : colors.sub;
  return (
    <View style={styles.noteRow}>
      <Ionicons name={icon} size={12.5} color={c} />
      <Text style={[styles.noteText, { color: c }]}>{text}</Text>
    </View>
  );
}

/** 键值对小行 */
export function KV({ k, v, color }: { k: string; v: string; color?: string }) {
  return (
    <View style={styles.kvRow}>
      <Text style={styles.kvKey}>{k}</Text>
      <Text style={[styles.kvVal, color ? { color, fontWeight: '700' } : null]}>{v}</Text>
    </View>
  );
}

/** 卡片式小面板 */
export function Box({
  children,
  tone = 'plain',
  style,
}: {
  children: React.ReactNode;
  tone?: 'plain' | 'soft' | 'warn' | 'bad' | 'good';
  style?: any;
}) {
  const bg =
    tone === 'soft'
      ? '#F5F8FE'
      : tone === 'warn'
        ? '#FFF7EC'
        : tone === 'bad'
          ? '#FDEDED'
          : tone === 'good'
            ? '#E9F7F1'
            : colors.card;
  const bd = tone === 'warn' ? '#F6DFC4' : tone === 'bad' ? '#F6D2D0' : tone === 'good' ? '#C9EADC' : colors.line;
  return <View style={[styles.box, { backgroundColor: bg, borderColor: bd }, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  zone: {
    backgroundColor: colors.card,
    borderRadius: 16,
    flexDirection: 'row',
    overflow: 'hidden',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.line,
    ...shadow.card,
  },
  rail: { width: 4 },
  zoneBody: { flex: 1, padding: 12 },
  zoneHead: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  tagChip: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, marginRight: 8 },
  tagText: { fontSize: 10.5, fontWeight: '800', letterSpacing: 0.3 },
  zoneTitle: { fontSize: 14.5, fontWeight: '800', color: colors.ink, flex: 1 },
  zoneSub: { fontSize: 11.5, color: colors.sub, marginTop: 4, lineHeight: 17 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: '#F5F8FE',
    marginRight: 6,
    marginBottom: 6,
  },
  chipOff: { opacity: 0.45 },
  chipText: { fontSize: 11.5, fontWeight: '700' },
  noteRow: { flexDirection: 'row', alignItems: 'flex-start', marginTop: 6 },
  noteText: { flex: 1, fontSize: 11.5, lineHeight: 17, marginLeft: 6 },
  kvRow: { flexDirection: 'row', alignItems: 'flex-start', marginTop: 5 },
  kvKey: { width: 62, fontSize: 11.5, color: colors.faint, fontWeight: '700' },
  kvVal: { flex: 1, fontSize: 12, color: colors.inkSoft, lineHeight: 17 },
  box: { borderRadius: 12, borderWidth: 1, padding: 10, marginTop: 8 },
});
