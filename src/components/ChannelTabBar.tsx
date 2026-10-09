import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

export type ChannelTabItem = {
  key: string;
  label: string;
  icon: IoniconName;
  iconOn: IoniconName;
  /** 建设中：灰掉、点不动 */
  disabled?: boolean;
};

/**
 * 频道底部导航条。
 *
 * 最左一格固定是「学科」（回学科首页），右边是该频道的入口，选中的那格高亮：
 * - 化学：浏览 / 反应 / 动手 / 关于
 * - 数学、物理：浏览（频道首页 = 模块清单）+ 已上线的模块
 */
export default function ChannelTabBar({
  items,
  active,
  onPress,
  onHome,
  homeLabel = '学科',
}: {
  items: ChannelTabItem[];
  /** 当前选中的 key */
  active: string;
  onPress: (key: string) => void;
  onHome: () => void;
  homeLabel?: string;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.tabBarWrap, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      <View style={styles.tabBar}>
        <Pressable
          style={styles.tabItem}
          onPress={onHome}
          accessibilityRole="button"
          accessibilityLabel="返回学科首页"
        >
          <Ionicons name="home-outline" size={23} color={colors.faint} />
          <Text style={styles.tabLabel}>{homeLabel}</Text>
        </Pressable>
        {items.map((t) => {
          const on = !t.disabled && t.key === active;
          return (
            <Pressable
              key={t.key}
              style={styles.tabItem}
              disabled={t.disabled}
              onPress={() => onPress(t.key)}
              accessibilityRole="tab"
              accessibilityState={{ selected: on, disabled: !!t.disabled }}
            >
              <Ionicons
                name={on ? t.iconOn : t.icon}
                size={23}
                color={t.disabled ? '#B7C1D0' : on ? colors.accent : colors.faint}
              />
              <Text
                style={[styles.tabLabel, t.disabled && styles.tabLabelOff, on && styles.tabLabelOn]}
                numberOfLines={1}
              >
                {t.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tabBarWrap: {
    backgroundColor: 'rgba(252,254,255,0.98)',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
  },
  tabBar: {
    flexDirection: 'row',
    height: 56,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  tabLabel: {
    fontSize: 10.5,
    color: colors.faint,
    marginTop: 3,
    fontWeight: '600',
  },
  tabLabelOn: {
    color: colors.accent,
  },
  tabLabelOff: {
    color: '#B7C1D0',
  },
});
