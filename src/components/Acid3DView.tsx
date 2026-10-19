import { useCallback, useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { ACID_HTML } from '../engine/acidHtml';
import ChemWebViewHost, { type ChemHostHandle } from './ChemWebViewHost';
import type { EngineEvent } from '../types';

/**
 * 酸碱性 3D 宿主：照搬立体几何的容器，外加 onHostPost 让页面拿到 send 句柄，
 * 这样播放/暂停/下一步/速度等 ctl 命令就能直接调用 post()。
 */
export default function Acid3DView({
  command,
  onEvent,
  onHostPost,
}: {
  command: object;
  onEvent: (ev: EngineEvent) => void;
  /** 宿主就绪后回传 send 句柄；页面用这个去发 ctl 命令 */
  onHostPost?: (post: (msg: object) => void) => void;
}) {
  const hostRef = useRef<ChemHostHandle | null>(null);
  const readyRef = useRef(false);
  const evRef = useRef(onEvent);
  evRef.current = onEvent;
  const cmdRef = useRef(command);
  cmdRef.current = command;
  const postRef = useRef<(m: object) => void>(() => {});

  useEffect(() => {
    postRef.current = (msg: object) => hostRef.current?.post(msg);
    onHostPost?.(postRef.current);
  }, [onHostPost]);

  useEffect(() => {
    if (!readyRef.current) return;
    postRef.current(cmdRef.current);
  }, [command]);

  const handleEvent = useCallback((data: unknown) => {
    let obj: any = data;
    if (typeof obj === 'string') {
      try { obj = JSON.parse(obj); } catch { return; }
    }
    if (!obj || typeof obj !== 'object') return;
    if (obj.ev === 'ready' && !readyRef.current) {
      readyRef.current = true;
      postRef.current(cmdRef.current);
    }
    evRef.current(obj as EngineEvent);
  }, []);

  return (
    <View style={styles.fill} pointerEvents="box-none">
      <ChemWebViewHost ref={hostRef} html={ACID_HTML} onEvent={handleEvent} />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, width: '100%', height: '100%' },
});
