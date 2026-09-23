import { forwardRef, memo, useCallback, useEffect, useImperativeHandle, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { ENGINE_HTML } from '../engine/engineHtml';
import ChemWebViewHost, { type ChemHostHandle } from './ChemWebViewHost';
import type { EngineEvent, SceneReq } from '../types';

export interface Chem3DHandle {
  send: (msg: unknown) => void;
}

export interface Chem3DViewProps {
  scene: SceneReq;
  onEvent: (ev: EngineEvent) => void;
}

function sceneCommand(scene: SceneReq): object {
  const mode = scene.kind === 'molecule' || scene.kind === 'atom' || scene.kind === 'radius'
    ? scene.kind
    : 'reaction';
  const cmd: Record<string, unknown> = { cmd: 'scene', mode, id: scene.id };
  if (scene.kind === 'radius') {
    if (scene.ratio !== undefined) cmd.ratio = scene.ratio;
  }
  if (scene.mol !== undefined) cmd.mol = scene.mol;
  if (scene.kind === 'atom') {
    if (scene.molId !== undefined) cmd.molId = scene.molId;
    if (scene.ai !== undefined) cmd.ai = scene.ai;
  }
  if (scene.kind === 'reaction' && scene.reaction !== undefined) {
    cmd.reaction = scene.reaction;
  }
  return cmd;
}

const Chem3DViewInner = forwardRef<Chem3DHandle, Chem3DViewProps>(function Chem3DViewInner(
  { scene, onEvent }: Chem3DViewProps,
  ref
) {
  const hostRef = useRef<ChemHostHandle | null>(null);
  const sceneRef = useRef(scene);
  sceneRef.current = scene;
  const evRef = useRef(onEvent);
  evRef.current = onEvent;
  // 最近一次下发的场景命令（序列化），用于去重：同一场景只下发一次，
  // 否则每次 ready 心跳都重建场景，进入页面时初始动画会被重复播放
  const lastCmdRef = useRef('');
  // 引擎是否已确认建立当前场景（收到 ev:'scene' 才算，收到后可以停止补发）
  const appliedRef = useRef(false);

  const post = useCallback((msg: unknown) => {
    hostRef.current?.post(msg);
  }, []);

  useImperativeHandle(ref, () => ({ send: post }), [post]);

  const sendScene = useCallback(
    (target: SceneReq, force: boolean) => {
      const payload = JSON.stringify(sceneCommand(target));
      // 重复下发同一个场景会让引擎重建、初始动画从头再来一次：只有场景真的变了才重发
      if (!force && payload === lastCmdRef.current) return;
      lastCmdRef.current = payload;
      appliedRef.current = false;
      post(JSON.parse(payload));
    },
    [post]
  );

  // 场景切换：立即下发，不做自动播放（反应由用户手动点击 ▶）
  useEffect(() => {
    sendScene(scene, false);
  }, [scene, sendScene]);

  const handleEvent = useCallback(
    (data: unknown) => {
      let obj: any = data;
      if (typeof data === 'string') {
        try {
          obj = JSON.parse(data);
        } catch {
          return;
        }
      }
      if (!obj || typeof obj !== 'object') return;

      if (obj.ev === 'scene') {
        // 引擎已建立该场景：此后的 ready 心跳不必再补发
        appliedRef.current = true;
      } else if (obj.ev === 'ready') {
        // 引擎就绪时要不要把场景再发一遍？只在“当前场景还没被引擎确认收到”时补发一次：
        // 页面加载初期下发的命令可能丢失（window.__dispatch 尚未定义），
        // 但一旦引擎确认收到就停止补发，否则每次心跳都会重建场景、重播初始动画。
        if (!appliedRef.current && obj.got !== true) sendScene(sceneRef.current, true);
      }
      evRef.current(obj as EngineEvent);
    },
    [post, sendScene]
  );

  return (
    <View style={styles.fill} pointerEvents="box-none">
      <ChemWebViewHost ref={hostRef} html={ENGINE_HTML} onEvent={handleEvent} />
    </View>
  );
});

const Chem3DView = memo(Chem3DViewInner);
export default Chem3DView;

const styles = StyleSheet.create({
  fill: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
});
