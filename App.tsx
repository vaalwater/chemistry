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
import PrivacyScreen from './src/screens/PrivacyScreen';
import SceneScreen from './src/screens/SceneScreen';
import HandsOnScreen from './src/screens/HandsOnScreen';
import RadiusLabScreen from './src/screens/RadiusLabScreen';
import { LATTICE_LINKS, type RadiusLabEntry } from './src/radius/radiusRule';
import { subjectOf, type SubjectKey } from './src/subjects';
import { reactionById } from './src/data';
import { dramaForKnownReaction } from './src/reactionEngine';
import type { KnowledgeTarget } from './src/knowledge/knowledgeData';
import KnowledgeScreen from './src/screens/KnowledgeScreen';
import AppSplash from './src/components/AppSplash';

type TabKey = 'browse' | 'reaction' | 'handson';

/**
 * 从知识点汇总跳进去时要带的「预选」信息：
 * view = 一级模块里的二级实验室（geo 的 theorem / em 的 field / 动手的实验 …），
 * item = 实验室里要预选的条目（定理 id / 场的 id / 酸碱物质 id …），
 * section = 化学浏览 tab 内的分子 / 原子切换。
 */
type NavInit = { view?: string; item?: string; section?: string };

/** 化学频道底部导航：只放频道内的功能区，「关于」移到学科首页做入口。 */
const TABS: ChannelTabItem[] = [
  { key: 'browse', label: '浏览', icon: 'grid-outline', iconOn: 'grid' },
  { key: 'reaction', label: '反应', icon: 'git-compare-outline', iconOn: 'git-compare' },
  { key: 'handson', label: '动手', icon: 'construct-outline', iconOn: 'construct' },
];

export default function App() {
  /** 当前学科频道；null = 学科首页 */
  const [subject, setSubject] = useState<SubjectKey | null>(null);
  /** 频道内的子模块（如数学 → 立体几何） */
  const [moduleKey, setModuleKey] = useState<string | null>(null);
  const [tab, setTab] = useState<TabKey>('browse');
  /** 「关于」页：从学科首页进入，不再占用化学频道的底部导航 */
  const [showAbout, setShowAbout] = useState(false);
  /** 「隐私政策」页：从「关于」页进入（上架应用商店需要） */
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [scene, setScene] = useState<SceneReq | null>(null);
  /** 半径比·配位数实验独立成页（token 用来让同一入口可以重复打开） */
  const [lab, setLab] = useState<{ entry: RadiusLabEntry; token: number } | null>(null);
  /** 知识点汇总页（null = 不在该页）；从首页学科卡片右侧进入 */
  const [knowledge, setKnowledge] = useState<SubjectKey | null>(null);
  /** 当前这一屏是从知识点汇总点进来的（非 null 时，按返回要退回汇总页而不是频道页） */
  const [knowRet, setKnowRet] = useState<SubjectKey | null>(null);
  /** 从知识点跳进模块 / 实验时的预选信息（普通导航时会被清掉，只生效一次） */
  const [init, setInit] = useState<NavInit | null>(null);
  /** 启动页：打开 App 先盖一层，首帧画出来后淡出（包体大，免得先看到空白） */
  const [splash, setSplash] = useState(true);
  const hideSplash = useCallback(() => setSplash(false), []);

  const openScene = useCallback(
    (kind: SceneReq['kind'], id: string, mol?: MoleculeData, reaction?: ReactionDrama) => {
      setInit(null);
      setKnowledge(null);
      setKnowRet(null);
      setLab(null);
      setScene({ kind, id, mol, reaction });
    },
    []
  );

  /**
   * 关闭全屏页：若这一屏是从知识点汇总点进来的，就退回知识点页，
   * 而不是退回化学的 tab 页（用户心里的上一页是汇总页）。
   */
  const closeScene = useCallback(() => {
    setScene(null);
    if (knowRet) {
      setSubject(null);
      setKnowRet(null);
    }
  }, [knowRet]);

  /** 从详情页的离子晶体卡片跳到配位数实验 */
  const openRadiusLabFor = useCallback((molId: string) => {
    const link = LATTICE_LINKS[molId];
    setInit(null);
    setKnowledge(null);
    setKnowRet(null);
    setScene(null);
    setTab('handson');
    setLab(prev => ({
      entry: { ratio: link ? link.ratio : 0.56, from: link ? link.formula : molId },
      token: (prev?.token || 0) + 1,
    }));
  }, []);

  const openRadiusLab = useCallback((entry: RadiusLabEntry) => {
    setInit(null);
    setKnowledge(null);
    setKnowRet(null);
    setScene(null);
    setTab('handson');
    setLab(prev => ({ entry, token: (prev?.token || 0) + 1 }));
  }, []);

  const closeLab = useCallback(() => {
    setLab(null);
    if (knowRet) {
      setSubject(null);
      setKnowRet(null);
    }
  }, [knowRet]);

  /** 切换学科：先收起化学的场景页，回到频道首页 */
  const pickSubject = useCallback((key: SubjectKey) => {
    setInit(null);
    setShowAbout(false);
    setShowPrivacy(false);
    setLab(null);
    setScene(null);
    setTab('browse');
    setModuleKey(null);
    setSubject(key);
  }, []);

  const backToSubjects = useCallback(() => {
    setInit(null);
    setKnowledge(null);
    setLab(null);
    setScene(null);
    setModuleKey(null);
    setSubject(null);
  }, []);

  /** 普通导航（切模块 / 切 tab）把知识点带来的预选信息清掉，避免下次误入 */
  const goModule = useCallback((key: string | null) => {
    setInit(null);
    setKnowledge(null);
    setKnowRet(null);
    setModuleKey(key);
  }, []);
  const changeTab = useCallback((t: TabKey) => {
    setInit(null);
    setKnowledge(null);
    setKnowRet(null);
    setTab(t);
  }, []);

  /** 详情页里按「返回」时退回知识点汇总页（数学 / 物理的模块页、化学的动手实验都走这里） */
  const backToKnowledge = useCallback(() => {
    setModuleKey(null);
    setScene(null);
    setLab(null);
    setSubject(null);
    setKnowRet(null);
  }, []);

  /** 知识点汇总 → 对应页面（可能一路定位到实验室里的具体条目） */
  const openKnowledgeItem = useCallback((t: KnowledgeTarget) => {
    // 注意：这里不清 knowledge —— 详情页返回时还要靠它把用户送回汇总页
    setShowAbout(false);
    setKnowRet(t.kind === 'module' ? t.subject : 'chemistry');
    if (t.kind === 'module') {
      setLab(null);
      setScene(null);
      setSubject(t.subject);
      setModuleKey(t.moduleKey);
      setInit({ view: t.view, item: t.item });
      return;
    }
    // 以下都是化学频道
    setModuleKey(null);
    setSubject('chemistry');
    if (t.kind === 'chemScene') {
      setLab(null);
      setTab('browse');
      setScene({ kind: t.scene, id: t.id });
      setInit(null);
      return;
    }
    if (t.kind === 'chemReaction') {
      const rx = reactionById(t.id);
      const drama = rx ? dramaForKnownReaction(rx) : null;
      setLab(null);
      setTab('reaction');
      if (drama) {
        setScene({ kind: 'reaction', id: drama.id, reaction: drama });
        setInit(null);
      } else {
        // 缺几何数据的反应兜底：停在反应列表页
        setScene(null);
        setInit(null);
      }
      return;
    }
    if (t.kind === 'chemTab') {
      setLab(null);
      setScene(null);
      setTab(t.tab);
      setInit(t.section ? { section: t.section } : null);
      return;
    }
    // chemLab
    if (t.view === 'radius') {
      setScene(null);
      setTab('handson');
      setLab(prev => ({
        entry: { ratio: LATTICE_LINKS.nacl?.ratio ?? 0.56, from: LATTICE_LINKS.nacl?.formula ?? 'NaCl' },
        token: (prev?.token || 0) + 1,
      }));
      setInit(null);
      return;
    }
    setLab(null);
    setScene(null);
    setTab('handson');
    setInit({ view: t.view, item: t.item });
  }, []);

  /** 预选信息变化时强制重建频道组件，保证 initialView / initialItem 生效一次 */
  const initKey = `${init?.view ?? ''}|${init?.item ?? ''}|${init?.section ?? ''}`;

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      {splash ? <AppSplash onDone={hideSplash} /> : null}
      {!subject ? (
        knowledge ? (
          <KnowledgeScreen
            subject={subjectOf(knowledge)}
            onBack={() => setKnowledge(null)}
            onOpen={openKnowledgeItem}
          />
        ) : showPrivacy ? (
          <PrivacyScreen onBack={() => setShowPrivacy(false)} />
        ) : showAbout ? (
          <AboutScreen onBack={() => setShowAbout(false)} onOpenPrivacy={() => setShowPrivacy(true)} />
        ) : (
          <HomeScreen
            onPick={pickSubject}
            onOpenAbout={() => setShowAbout(true)}
            onOpenKnowledge={setKnowledge}
          />
        )
      ) : subject !== 'chemistry' ? (
        // 数学 / 物理：内容页 + 底部导航（与化学同一条导航条）
        <SubjectTabs
          key={initKey}
          subject={subjectOf(subject)}
          moduleKey={moduleKey}
          setModuleKey={goModule}
          init={init}
          fromKnowledge={knowRet !== null}
          onKnowledgeBack={backToKnowledge}
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
          key={initKey}
          tab={tab}
          setTab={changeTab}
          openScene={openScene}
          openRadiusLab={openRadiusLab}
          init={init}
          fromKnowledge={knowRet !== null}
          onKnowledgeBack={backToKnowledge}
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
  init,
  fromKnowledge,
  onKnowledgeBack,
  onExit,
}: {
  tab: TabKey;
  setTab: (t: TabKey) => void;
  openScene: (kind: SceneReq['kind'], id: string, mol?: MoleculeData, reaction?: ReactionDrama) => void;
  openRadiusLab: (entry: RadiusLabEntry) => void;
  /** 从知识点汇总进来时的预选：section = 浏览 tab 的分子/原子，view + item = 动手实验及条目 */
  init?: NavInit | null;
  /** 这一屏是从知识点汇总点进来的 */
  fromKnowledge?: boolean;
  /** 实验页按返回时退回知识点汇总页 */
  onKnowledgeBack: () => void;
  onExit: () => void;
}) {
  // “浏览”tab 内部的分子/原子切换
  const [browseKey, setBrowseKey] = useState<string>(init?.section ?? 'molecules');

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
        {tab === 'handson' && (
          <HandsOnScreen
            onOpenRadiusLab={openRadiusLab}
            initialView={init?.view as 'home' | 'list' | 'atom' | 'allotrope' | 'acid' | undefined}
            initialItem={init?.item}
            fromKnowledge={fromKnowledge}
            onExit={onKnowledgeBack}
          />
        )}
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
