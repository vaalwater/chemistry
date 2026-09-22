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

  const post = useCallback((msg: unknown) => {
    hostRef.current?.post(msg);
  }, []);

  useImperativeHandle(ref, () => ({ send: post }), [post]);

  // 场景切换：立即下发，不做自动播放（反应由用户手动点击 ▶）
  useEffect(() => {
    post(sceneCommand(scene));
  }, [scene, post]);

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

      if (obj.ev === 'ready') {
        // 引擎就绪后补发当前场景（避免启动早期消息丢失）
        const cur = sceneRef.current;
        post(sceneCommand(cur));
      }
      evRef.current(obj as EngineEvent);
    },
    [post]
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
