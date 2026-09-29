import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { PHYSICS_HTML } from '../engine/physicsHtml';
import ChemWebViewHost, { type ChemHostHandle } from './ChemWebViewHost';
import type { EngineEvent } from '../types';

/**
 * 物理（电磁学）3D 宿主：与化学 / 几何引擎同一套 WebView/iframe 通道。
 * 命令通过 command 下发；引擎就绪（ready）后会自动补发一次，避免首帧命令丢失。
 */
export default function Phys3DView({
  command,
  onEvent,
}: {
  command: object;
  onEvent: (ev: EngineEvent) => void;
}) {
  const hostRef = useRef<ChemHostHandle | null>(null);
  const readyRef = useRef(false);
  const evRef = useRef(onEvent);
  evRef.current = onEvent;
  const cmdRef = useRef(command);
  cmdRef.current = command;
  /** 当前引擎里已经建好的场景 id：用于判断这次命令是「换场景」还是「改参数」 */
  const sceneIdRef = useRef<string | null>(null);

  /**
   * 下发命令：
   * - 换场景（id 变化 / 首次）→ 走 scene 命令，引擎重建
   * - 同一场景改参数 → 走 param 命令，引擎只更新 params 并回调 onParams，不重建
   *   这样点击面板按钮不会把 3D 画面清空重建，动画也能连续。
   */
  const postCmd = () => {
    const host = hostRef.current;
    if (!host) return;
    const c = cmdRef.current as { action?: string; id?: string; params?: unknown; step?: number };
    const id = c && c.id != null ? String(c.id) : null;
    if (c.action === 'scene' && id && sceneIdRef.current === id) {
      host.post({ cmd: 'phys', action: 'param', id, params: c.params ?? {}, step: c.step ?? 0 });
      return;
    }
    host.post(c);
    sceneIdRef.current = c.action === 'scene' ? id : null;
  };

  useEffect(() => {
    if (!readyRef.current) return;
    postCmd();
  }, [command]);

  // 挂载后主动握手：引擎若已就绪会回 ready，触发首条命令补发
  useEffect(() => {
    hostRef.current?.post({ cmd: 'ping' });
  }, []);

  const handleEvent = (data: unknown) => {
    let obj: any = data;
    if (typeof obj === 'string') {
      try { obj = JSON.parse(obj); } catch { return; }
    }
    if (!obj || typeof obj !== 'object') return;
    if (obj.ev === 'ready' && !readyRef.current) {
      readyRef.current = true;
      // 新 iframe：之前记录的场景 id 作废，必须整场景重建
      sceneIdRef.current = null;
      postCmd();
    }
    evRef.current(obj as EngineEvent);
  };

  return (
    <View style={styles.fill} pointerEvents="box-none">
      <ChemWebViewHost ref={hostRef} html={PHYSICS_HTML} onEvent={handleEvent} />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, width: '100%', height: '100%' },
});
