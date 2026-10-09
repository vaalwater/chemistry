import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import type { MoleculeData, ReactionDrama, SceneReq } from './src/types';
import { colors } from './src/theme';
import ChannelTabBar, { type ChannelTabItem } from './src/components/ChannelTabBar';
import HomeScreen from './src/screens/HomeScreen';
import SubjectTabs from './src/screens/SubjectTabs';
import BrowseScreen from './src/screens/BrowseScreen';
import ReactionsScreen from './src/screens/ReactionsScreen';
import AboutScreen from './src/screens/AboutScreen';
import SceneScreen from './src/screens/SceneScreen';
import HandsOnScreen from './src/screens/HandsOnScreen';
import RadiusLabScreen from './src/screens/RadiusLabScreen';
import { LATTICE_LINKS, type RadiusLabEntry } from './src/radius/radiusRule';
import { subjectOf, type SubjectKey } from './src/subjects';

type TabKey = 'browse' | 'reaction' | 'handson' | 'about';

const TABS: ChannelTabItem[] = [
  { key: 'browse', label: '浏览', icon: 'grid-outline', iconOn: 'grid' },
  { key: 'reaction', label: '反应', icon: 'git-compare-outline', iconOn: 'git-compare' },
  { key: 'handson', label: '动手', icon: 'construct-outline', iconOn: 'construct' },
  { key: 'about', label: '关于', icon: 'information-circle-outline', iconOn: 'information-circle' },
];

export default function App() {
  /** 当前学科频道；null = 学科首页 */
  const [subject, setSubject] = useState<SubjectKey | null>(null);
  /** 频道内的子模块（如数学 → 立体几何） */
  const [moduleKey, setModuleKey] = useState<string | null>(null);
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

  /** 切换学科：先收起化学的场景页，回到频道首页 */
  const pickSubject = useCallback((key: SubjectKey) => {
    setLab(null);
    setScene(null);
    setTab('browse');
    setModuleKey(null);
    setSubject(key);
  }, []);

  const backToSubjects = useCallback(() => {
    setLab(null);
    setScene(null);
    setModuleKey(null);
    setSubject(null);
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      {!subject ? (
        <HomeScreen onPick={pickSubject} />
      ) : subject !== 'chemistry' ? (
        // 数学 / 物理：内容页 + 底部导航（与化学同一条导航条）
        <SubjectTabs
          subject={subjectOf(subject)}
          moduleKey={moduleKey}
          setModuleKey={setModuleKey}
          onExit={backToSubjects}
        />
      ) : lab ? (
        <RadiusLabScreen key={lab.token} entry={lab.entry} onBack={closeLab} />
      ) : scene ? (
        <SceneScreen
          key={scene.kind + ':' + scene.id}
          initial={scene}
          onClose={closeScene}
          onOpenRadiusLab={openRadiusLabFor}
        />
      ) : (
        <ChemistryTabs
          tab={tab}
          setTab={setTab}
          openScene={openScene}
          openRadiusLab={openRadiusLab}
          onExit={backToSubjects}
        />
      )}
    </SafeAreaProvider>
  );
}

/** 化学频道：原「高中化学 3D 课堂」的全部内容，作为首页下的二级频道。 */
function ChemistryTabs({
  tab,
  setTab,
  openScene,
  openRadiusLab,
  onExit,
}: {
  tab: TabKey;
  setTab: (t: TabKey) => void;
  openScene: (kind: SceneReq['kind'], id: string, mol?: MoleculeData, reaction?: ReactionDrama) => void;
  openRadiusLab: (entry: RadiusLabEntry) => void;
  onExit: () => void;
}) {
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

      <ChannelTabBar
        items={TABS}
        active={tab}
        onPress={(k) => setTab(k as TabKey)}
        onHome={onExit}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { flex: 1 },
});
