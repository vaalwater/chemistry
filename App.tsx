import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { colors } from './src/theme';
import type { MoleculeData, ReactionDrama, SceneReq } from './src/types';
import BrowseScreen from './src/screens/BrowseScreen';
import ReactionsScreen from './src/screens/ReactionsScreen';
import AboutScreen from './src/screens/AboutScreen';
import SceneScreen from './src/screens/SceneScreen';
import HandsOnScreen from './src/screens/HandsOnScreen';
import RadiusLabScreen from './src/screens/RadiusLabScreen';
import { LATTICE_LINKS, type RadiusLabEntry } from './src/radius/radiusRule';

type TabKey = 'browse' | 'reaction' | 'handson' | 'about';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

const TABS: { key: TabKey; label: string; icon: IoniconName; iconOn: IoniconName }[] = [
  { key: 'browse', label: '浏览', icon: 'grid-outline', iconOn: 'grid' },
  { key: 'reaction', label: '反应', icon: 'git-compare-outline', iconOn: 'git-compare' },
  { key: 'handson', label: '动手', icon: 'construct-outline', iconOn: 'construct' },
  { key: 'about', label: '关于', icon: 'information-circle-outline', iconOn: 'information-circle' },
];

export default function App() {
  const [tab, setTab] = useState<TabKey>('browse');
  const [scene, setScene] = useState<SceneReq | null>(null);
  /** 半径比·配位数实验独立成页（token 用来让同一入口可以重复打开） */
  const [lab, setLab] = useState<{ entry: RadiusLabEntry; token: number } | null>(null);

  const openScene = useCallback(
    (kind: SceneReq['kind'], id: string, mol?: MoleculeData, reaction?: ReactionDrama) => {
      setLab(null);
      setScene({ kind, id, mol, reaction });
    },
    []
  );

  const closeScene = useCallback(() => setScene(null), []);

  /** 从详情页的离子晶体卡片跳到配位数实验 */
  const openRadiusLabFor = useCallback((molId: string) => {
    const link = LATTICE_LINKS[molId];
    setScene(null);
    setTab('handson');
    setLab(prev => ({
      entry: { ratio: link ? link.ratio : 0.56, from: link ? link.formula : molId },
      token: (prev?.token || 0) + 1,
    }));
  }, []);

  const openRadiusLab = useCallback((entry: RadiusLabEntry) => {
    setScene(null);
    setTab('handson');
    setLab(prev => ({ entry, token: (prev?.token || 0) + 1 }));
  }, []);

  const closeLab = useCallback(() => setLab(null), []);

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      {lab ? (
        <RadiusLabScreen key={lab.token} entry={lab.entry} onBack={closeLab} />
      ) : scene ? (
        <SceneScreen
          key={scene.kind + ':' + scene.id}
          initial={scene}
          onClose={closeScene}
          onOpenRadiusLab={openRadiusLabFor}
        />
      ) : (
        <HomeTabs
          tab={tab}
          setTab={setTab}
          openScene={openScene}
          openRadiusLab={openRadiusLab}
        />
      )}
    </SafeAreaProvider>
  );
}

function HomeTabs({
  tab,
  setTab,
  openScene,
  openRadiusLab,
}: {
  tab: TabKey;
  setTab: (t: TabKey) => void;
  openScene: (kind: SceneReq['kind'], id: string, mol?: MoleculeData, reaction?: ReactionDrama) => void;
  openRadiusLab: (entry: RadiusLabEntry) => void;
}) {
  const insets = useSafeAreaInsets();
  // “浏览”tab 内部的分子/原子切换
  const [browseKey, setBrowseKey] = useState<string>('molecules');

  const openByKind = useCallback(
    (kind: SceneReq['kind'], id: string, mol?: MoleculeData) => {
      if (kind === 'reaction') {
        setTab('reaction');
      } else {
        setTab('browse');
        if (kind === 'atom') setBrowseKey('atoms');
        else if (kind === 'molecule') setBrowseKey('molecules');
      }
      openScene(kind, id, mol);
    },
    [openScene, setTab]
  );

  const playReaction = useCallback(
    (drama: ReactionDrama) => {
      setTab('reaction');
      openScene('reaction', drama.id, undefined, drama);
    },
    [openScene, setTab]
  );

  return (
    <View style={styles.root}>
      <View style={styles.content}>
        {tab === 'browse' && (
          <BrowseScreen
            section={browseKey}
            onSectionChange={setBrowseKey}
            onOpen={(k, id, mol) => openByKind(k, id, mol)}
          />
        )}
        {tab === 'reaction' && <ReactionsScreen onPlayReaction={playReaction} />}
        {tab === 'handson' && <HandsOnScreen onOpenRadiusLab={openRadiusLab} />}
        {tab === 'about' && <AboutScreen />}
      </View>

      <View
        style={[
          styles.tabBarWrap,
          { paddingBottom: Math.max(insets.bottom, 8) },
        ]}
      >
        <View style={styles.tabBar}>
          {TABS.map((t) => {
            const active = tab === t.key;
            return (
              <Pressable
                key={t.key}
                style={styles.tabItem}
                onPress={() => setTab(t.key)}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
              >
                <Ionicons
                  name={active ? t.iconOn : t.icon}
                  size={23}
                  color={active ? colors.accent : colors.faint}
                />
                <Text style={[styles.tabLabel, active && styles.tabLabelOn]}>
                  {t.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { flex: 1 },
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
});
