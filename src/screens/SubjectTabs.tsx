import { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import ChannelTabBar, { type ChannelTabItem } from '../components/ChannelTabBar';
import SubjectChannelScreen from './SubjectChannelScreen';
import SolidGeoHomeScreen, { type GeoViewKey } from './geo/SolidGeoHomeScreen';
import SetLabScreen from './math/SetLabScreen';
import ExtremeScreen from './math/ExtremeScreen';
import HandsOnHomeScreen from './math/HandsOnHomeScreen';
import EmHomeScreen, { type EmViewKey } from './physics/EmHomeScreen';
import type { SubjectKey, SubjectMeta } from '../subjects';
import { colors } from '../theme';

/**
 * 数学 / 物理频道：内容页 + 底部导航（和化学频道同一条导航条）。
 *
 * 导航条是「学科（回学科首页）+ 若干模块」，默认只有浏览（频道首页 = 模块清单）；
 * 像「动手」这种被提到导航条上的模块，不再出现在模块清单里。
 * 没挂在导航条上的一级模块页（集合 / 立体几何 / 最值 / 电磁学）及更深的实验室页
 * 都不显示底部导航，返回统一走页面左上角的「返回」，和化学频道的深层页一致。
 */
const BROWSE_KEY = '';

const BROWSE_TAB: ChannelTabItem = {
  key: BROWSE_KEY,
  label: '浏览',
  icon: 'grid-outline',
  iconOn: 'grid',
};

/** 直接从导航条进入的模块（已从模块清单中拆出来） */
const PINNED_TABS: { subject: SubjectKey; tab: ChannelTabItem }[] = [
  {
    subject: 'math',
    tab: { key: 'handsOn', label: '动手', icon: 'construct-outline', iconOn: 'construct' },
  },
];

export default function SubjectTabs({
  subject,
  moduleKey,
  setModuleKey,
  init,
  fromKnowledge,
  onKnowledgeBack,
  onExit,
}: {
  subject: SubjectMeta;
  /** 当前子模块路由；null = 浏览（频道首页） */
  moduleKey: string | null;
  setModuleKey: (route: string | null) => void;
  /**
   * 从知识点汇总进来时的预选：
   * view = 一级模块里的二级实验室（geo 的 theorem / em 的 field / 数学动手的 draw），
   * item = 实验室里要预选的条目（定理 id / 场 id / 交流电模块 key …）。
   */
  init?: { view?: string; item?: string } | null;
  /** 这一屏是从知识点汇总点进来的 */
  fromKnowledge?: boolean;
  /** 模块页按返回时退回知识点汇总页（而不是频道浏览页） */
  onKnowledgeBack: () => void;
  onExit: () => void;
}) {
  /** 「浏览」+ 本学科提到导航条上的模块；最左的「学科」由导航条自带 */
  const items: ChannelTabItem[] = [
    BROWSE_TAB,
    ...PINNED_TABS.filter((p) => p.subject === subject.key).map((p) => p.tab),
  ];

  const active = moduleKey ?? BROWSE_KEY;
  /** 导航条在这些页上出现：浏览页 + 挂在导航条上的模块页 */
  const showTabBar = items.some((t) => t.key === active);
  /** 返回：从知识点汇总进来时退回汇总页，否则退回频道浏览页 */
  const goBrowse = useCallback(
    () => (fromKnowledge ? onKnowledgeBack() : setModuleKey(null)),
    [fromKnowledge, onKnowledgeBack, setModuleKey]
  );
  const openModule = useCallback((route: string) => setModuleKey(route), [setModuleKey]);
  const pressTab = useCallback(
    (key: string) => setModuleKey(key === BROWSE_KEY ? null : key),
    [setModuleKey]
  );

  return (
    <View style={styles.root}>
      <View style={styles.content}>
        {active === BROWSE_KEY ? (
          <SubjectChannelScreen subject={subject} onOpenModule={openModule} />
        ) : null}
        {active === 'set' ? <SetLabScreen onBack={goBrowse} /> : null}
        {active === 'geo' ? (
          <SolidGeoHomeScreen
            onBack={goBrowse}
            initialView={init?.view as GeoViewKey | undefined}
            initialItem={init?.item}
          />
        ) : null}
        {active === 'extreme' ? <ExtremeScreen onBack={goBrowse} /> : null}
        {active === 'handsOn' ? (
          <HandsOnHomeScreen onBack={goBrowse} initialView={init?.view as 'draw' | undefined} />
        ) : null}
        {active === 'em' ? (
          <EmHomeScreen
            onBack={goBrowse}
            initialView={init?.view as EmViewKey | undefined}
            initialItem={init?.item}
          />
        ) : null}
      </View>

      {/* 没挂到导航条上的模块页往下不显示底部导航，返回走页面左上角的「返回」 */}
      {showTabBar ? (
        <ChannelTabBar items={items} active={active} onPress={pressTab} onHome={onExit} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { flex: 1 },
});
