/**
 * 按域名清除某个站点的网站数据（登录态 / localStorage / IndexedDB / 缓存）。
 *
 * 走的是自己写的原生模块 `SiteDataCleaner`（见 `modules/site-data-cleaner/`），
 * 而不是 `react-native-webview` 自带的 `clearCache`：后者清所有 WKWebView 共享的
 * store，会误伤教学用的 3D 引擎，而且漏了 cookie 类型清不掉登录态。
 *
 * Web 端与未集成的情况都**静默降级**：清理只是尽力而为，绝不能把界面搞崩。
 */
type Cleaner = { clearForHost: (host: string) => Promise<number> };

let cached: Cleaner | null | undefined;

function nativeCleaner(): Cleaner | null {
  if (cached !== undefined) return cached;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const core = require('expo-modules-core') as {
      requireNativeModule?: (name: string) => unknown;
    };
    cached =
      typeof core.requireNativeModule === 'function'
        ? (core.requireNativeModule('SiteDataCleaner') as Cleaner)
        : null;
  } catch {
    cached = null; // Web 端没有原生这一层
  }
  return cached;
}

/** 取主域：`chat.deepseek.com` → `deepseek.com`，cookie 常挂在父域上，按主域清才干净 */
export function mainHostOf(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^\./, '');
    const parts = host.split('.');
    return parts.length > 2 ? parts.slice(-2).join('.') : host;
  } catch {
    return '';
  }
}

/** 清掉该站点在本机留下的所有网站数据。返回是否真的执行了清除 */
export async function clearSiteData(url: string): Promise<boolean> {
  const mod = nativeCleaner();
  const host = mainHostOf(url);
  if (!mod || !host) return false;
  try {
    await mod.clearForHost(host);
    return true;
  } catch {
    return false;
  }
}
