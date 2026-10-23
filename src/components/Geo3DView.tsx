import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { GEOMETRY_HTML } from '../engine/geometryHtml';
import ChemWebViewHost, { type ChemHostHandle } from './ChemWebViewHost';
import type { EngineEvent } from '../types';

export interface Geo3DHandle {
  /** 下发一次性命令（方向键平移、复位等），不影响 command 对应的场景 */
  send: (msg: object) => void;
}

/**
 * 立体几何 3D 宿主：与化学引擎同一套 WebView/iframe 通道，只是换成几何引擎 HTML。
 * 命令通过 command 下发；引擎就绪（ready）后会自动补发一次，避免首帧命令丢失。
 * 另外暴露 send()，让页面能单独下发视角平移这类即时命令。
 */
const Geo3DView = forwardRef<Geo3DHandle, { command: object; onEvent: (ev: EngineEvent) => void }>(
  function Geo3DView({ command, onEvent }, ref) {
  const hostRef = useRef<ChemHostHandle | null>(null);
  const readyRef = useRef(false);
  const evRef = useRef(onEvent);
  evRef.current = onEvent;
  const cmdRef = useRef(command);
  cmdRef.current = command;
  const lastRef = useRef('');

  // 宿主内部会做 JSON.stringify，这里不能再编码一次，否则引擎收到的是字符串而非对象
  const post = useCallback((msg: object) => {
    hostRef.current?.post(msg);
  }, []);

  useImperativeHandle(ref, () => ({ send: post }), [post]);

  // 命令对象由页面用 useMemo 精确构造：引用变了才下发，内容相同的重复渲染不会重发
  useEffect(() => {
    if (!readyRef.current) return;
    post(cmdRef.current);
  }, [command]);

  const handleEvent = (data: unknown) => {
    let obj: any = data;
    if (typeof obj === 'string') {
      try { obj = JSON.parse(obj); } catch { return; }
    }
    if (!obj || typeof obj !== 'object') return;
    if (obj.ev === 'ready' && !readyRef.current) {
      readyRef.current = true;
      lastRef.current = '';
      const payload = JSON.stringify(cmdRef.current);
      lastRef.current = payload;
      post(cmdRef.current);
    }
    evRef.current(obj as EngineEvent);
  };

  return (
    <View style={styles.fill} pointerEvents="box-none">
      <ChemWebViewHost ref={hostRef} html={GEOMETRY_HTML} onEvent={handleEvent} />
    </View>
  );
});

export default Geo3DView;

const styles = StyleSheet.create({
  fill: { flex: 1, width: '100%', height: '100%' },
});
