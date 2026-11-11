/**
 * 极简的滚动位置记忆：页面卸载后记住它停留在哪一屏，下次挂载时滚回去。
 *
 * 本项目没有导航栈，很多“返回上一页”其实是「旧页面被卸载、再重新挂载」，
 * 于是 ScrollView 回到了顶部。这里用模块级的键值表把偏移量存下来，
 * 由页面自己在 onScroll 里写、在 onContentSizeChange 里读并滚回。
 */

const store: Record<string, number> = {};

export function saveScroll(key: string, y: number): void {
  store[key] = y;
}

export function loadScroll(key: string): number {
  return store[key] ?? 0;
}
