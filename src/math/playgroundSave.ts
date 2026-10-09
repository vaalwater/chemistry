/**
 * 动手页的存档
 *
 * 浏览器里存 localStorage（刷新、关掉再开都还在）；原生环境没有 localStorage 就退回内存。
 * 存的东西很简单：写了哪几条函数（含颜色 / 是否显示 / 参数）+ 当前关卡与命中情况。
 */

import type { Target } from './game';

export type FnSave = { expr: string; color: string; visible: boolean };

export type GameSave = {
  on: boolean;
  family: string;
  diff: number;
  presetId: string;
  points: Target[];
  revealed: boolean;
};

export type SaveSlot = {
  id: string;
  name: string;
  ts: number;
  fns: FnSave[];
  params: Record<string, number>;
  game: GameSave | null;
};

const KEY = 'math.playground.saves.v1';

let slots: SaveSlot[] = [];
let loaded = false;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function persist() {
  try {
    const ls = (globalThis as unknown as { localStorage?: { setItem: (k: string, v: string) => void } }).localStorage;
    ls?.setItem(KEY, JSON.stringify(slots));
  } catch {
    /* 存不了就算了，内存里还在 */
  }
}

function read(): SaveSlot[] {
  try {
    const ls = (globalThis as unknown as { localStorage?: { getItem: (k: string) => string | null } }).localStorage;
    const raw = ls?.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as SaveSlot[];
    return Array.isArray(arr) ? arr.filter((s) => s && typeof s.id === 'string') : [];
  } catch {
    return [];
  }
}

function ensure() {
  if (!loaded) {
    loaded = true;
    slots = read();
  }
  return slots;
}

export function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getSlots(): SaveSlot[] {
  return ensure();
}

export function addSlot(slot: Omit<SaveSlot, 'id' | 'ts'> & { name?: string }): SaveSlot {
  const now = Date.now();
  const full: SaveSlot = {
    id: `s${now}-${Math.floor(Math.random() * 1000)}`,
    ts: now,
    name: slot.name || '未命名存档',
    fns: slot.fns ?? [],
    params: slot.params ?? {},
    game: slot.game ?? null,
  };
  slots = [full, ...ensure()].slice(0, 40);
  persist();
  emit();
  return full;
}

export function deleteSlot(id: string) {
  slots = ensure().filter((s) => s.id !== id);
  persist();
  emit();
}

export function clearSlots() {
  slots = [];
  persist();
  emit();
}

/** 存档的一句话摘要（列表里显示） */
export function slotSummary(s: SaveSlot): string {
  const fn = s.fns.length ? `${s.fns.length} 条函数` : '没有函数';
  const g = s.game?.on
    ? ` · ${s.game.points.length} 个点${s.game.presetId ? `（${s.game.presetId}）` : ''}`
    : ' · 没开游戏';
  const d = new Date(s.ts);
  const time = `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(
    d.getMinutes()
  ).padStart(2, '0')}`;
  return `${fn}${g} · ${time}`;
}
