import { useSyncExternalStore } from 'react';

/**
 * 认知档案：模块内的极简订阅式存储。
 * 探针回答、推理轨道补条件、分类讨论遗漏…… 都往这里记一条，
 * 认知档案页按知识点聚合后画成热力图。
 */

export type ArchiveEntry = {
  id: string;
  /** 知识点标签（对应 COGN_TAGS 的 id） */
  tag: string;
  /** 这次作答是否正确 */
  ok: boolean;
  /** 一句话记录：做了什么 / 卡在哪 */
  detail: string;
  ts: number;
};

let entries: ArchiveEntry[] = [];
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getEntries(): ArchiveEntry[] {
  return entries;
}

export function pushEntry(tag: string, ok: boolean, detail: string) {
  entries = [
    ...entries,
    { id: `${tag}-${Date.now()}-${entries.length}`, tag, ok, detail, ts: Date.now() },
  ].slice(-200);
  emit();
}

export function resetEntries() {
  entries = [];
  emit();
}

export function useArchive(): ArchiveEntry[] {
  return useSyncExternalStore(subscribe, getEntries, getEntries);
}

/** 按标签聚合：命中次数与正确率 */
export function statByTag(list: ArchiveEntry[], tags: { id: string }[]) {
  return tags.map((t) => {
    const hit = list.filter((e) => e.tag === t.id);
    const ok = hit.filter((e) => e.ok).length;
    return {
      id: t.id,
      total: hit.length,
      ok,
      rate: hit.length ? ok / hit.length : 0,
    };
  });
}
