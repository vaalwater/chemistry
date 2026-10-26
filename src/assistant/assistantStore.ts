import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * 问答助手（右下角悬浮小球）的开关状态。
 *
 * ⚠️ 必须用 AsyncStorage，不能复用 `src/math/playgroundSave.ts` 那套 localStorage 封装 ——
 *    后者在原生环境里会退回内存，用户点了「先不要」关掉小球后，
 *    重开 App 小球又会冒出来，等于没关，「关于」页里那个开关也就失去意义了。
 */

const KEY_ON = 'assistant.on.v1'; // 悬浮球是否显示
const KEY_NOTICED = 'assistant.noticed.v1'; // 是否已看过「由第三方提供」的首次说明
const KEY_POS = 'assistant.pos.v1'; // 小球被拖到哪儿了
const KEY_SITE = 'assistant.site.v1'; // 打开哪个站点

/**
 * 悬浮球可以打开的站点。都是**第三方网页**，登录和问答都由用户自己在页面上完成。
 *
 * ⚠️ 默认选 Bing 搜索 —— 它不需要登录就能用，用户点开就能看到东西；
 *    DeepSeek 和豆包虽然更强，但没登录时看到的是登录墙，第一次点开体验很差。
 * 新增站点只要往这里加一条，设置页会自动出现选项。
 */
export const ASSISTANT_SITES = [
  {
    key: 'bing',
    name: 'Bing 搜索',
    url: 'https://www.bing.com',
    desc: '不用登录，打开就能搜',
  },
  {
    key: 'deepseek',
    name: 'DeepSeek',
    url: 'https://chat.deepseek.com',
    desc: 'AI 问答，需登录 DeepSeek 账号',
  },
  {
    key: 'doubao',
    name: '豆包',
    url: 'https://www.doubao.com/chat/',
    desc: '字节跳动的 AI 助手，需登录',
  },
] as const;

export type SiteKey = (typeof ASSISTANT_SITES)[number]['key'];

export function siteByKey(key: SiteKey) {
  return ASSISTANT_SITES.find((s) => s.key === key) ?? ASSISTANT_SITES[0];
}

/** 小球停下的位置。**只存吸附后的边缘与纵向比例**，不存像素 —— 换设备或转屏后像素值就对不上了 */
export type FabPos = { side: 'left' | 'right'; yRatio: number };

export type AssistantState = {
  /** 悬浮球是否显示（用户可在「关于」页重新打开） */
  on: boolean;
  /** 是否已提示过「问答由 DeepSeek 提供」 */
  noticed: boolean;
  /** 用户上次把小球拖到哪儿（没有就是 null，用默认右下角） */
  pos: FabPos | null;
  /** 点开小球打开哪个站点（默认 Bing） */
  site: SiteKey;
  /**
   * 网页重建计数。设置里点了「清理重置网页」就 +1，
   * AskChatModal 拿它当 WebView 的 key —— key 一变 React 就卸载旧实例重建新的，
   * 这是唯一能把第三方网页（连同它的缓存、登录态、卡住的状态）彻底清掉的办法。
   * **不持久化**：重开 App 本来就是新进程，没必要记住。
   */
  resetSeq: number;
  /** 本地值是否已读出来（没读出来前不要渲染小球，否则会闪一下） */
  loaded: boolean;
};

const listeners = new Set<() => void>();

let state: AssistantState = {
  on: true,
  noticed: false,
  pos: null,
  site: 'bing',
  resetSeq: 0,
  loaded: false,
};

function emit() {
  listeners.forEach((l) => l());
}

async function load() {
  try {
    const [on, noticed, pos, site] = await Promise.all([
      AsyncStorage.getItem(KEY_ON),
      AsyncStorage.getItem(KEY_NOTICED),
      AsyncStorage.getItem(KEY_POS),
      AsyncStorage.getItem(KEY_SITE),
    ]);
    // 默认开：新用户应该能看到这个入口，看过说明后自己决定要不要留着
    state = {
      on: on !== '0',
      noticed: noticed === '1',
      pos: parsePos(pos),
      site: parseSite(site),
      resetSeq: 0,
      loaded: true,
    };
  } catch {
    state = { ...state, loaded: true };
  }
  emit();
}

let started = false;
export function ensureAssistantLoaded() {
  if (started) return;
  started = true;
  load();
}

export async function setAssistantOn(v: boolean) {
  state = { ...state, on: v };
  emit();
  try {
    await AsyncStorage.setItem(KEY_ON, v ? '1' : '0');
  } catch {
    /* 存不下也先按当前会话的开关走 */
  }
}

function parsePos(raw: string | null): FabPos | null {
  if (!raw) return null;
  try {
    const o = JSON.parse(raw) as FabPos;
    if (o && (o.side === 'left' || o.side === 'right') && typeof o.yRatio === 'number') {
      return { side: o.side, yRatio: Math.max(0, Math.min(1, o.yRatio)) };
    }
  } catch {
    /* 存坏了就当没有 */
  }
  return null;
}

/** 记住小球被拖到哪儿了。不触发通知 —— 小球自己管位置，别在拖动途中被重新渲染回去 */
export async function setFabPos(p: FabPos) {
  state = { ...state, pos: p };
  try {
    await AsyncStorage.setItem(KEY_POS, JSON.stringify(p));
  } catch {
    /* 存不下就算了 */
  }
}

function parseSite(raw: string | null): SiteKey {
  return ASSISTANT_SITES.some((s) => s.key === raw) ? (raw as SiteKey) : 'bing';
}

/** 换一个站点。必须走得通知：正在开着的网页要跟着换掉 */
export async function setAssistantSite(v: SiteKey) {
  state = { ...state, site: v };
  emit();
  try {
    await AsyncStorage.setItem(KEY_SITE, v);
  } catch {
    /* 同上 */
  }
}

/**
 * 清理并重建网页视图。等价于把第三方网页的缓存、登录态、卡住的状态全部丢掉。
 * 换站点时也调一次 —— 否则刚才那家的登录状态还留在 WebView 里。
 */
export function resetAssistantWebview() {
  state = { ...state, resetSeq: state.resetSeq + 1 };
  emit();
}

export async function setAssistantNoticed(v: boolean) {
  state = { ...state, noticed: v };
  emit();
  try {
    await AsyncStorage.setItem(KEY_NOTICED, v ? '1' : '0');
  } catch {
    /* 同上 */
  }
}

/** 订阅开关状态；「关于」页的开关和悬浮球本身都靠它保持同步 */
export function useAssistant(): AssistantState {
  const [, tick] = useState(0);
  useEffect(() => {
    ensureAssistantLoaded();
    const l = () => tick((n) => n + 1);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  return state;
}
