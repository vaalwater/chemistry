import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme';

/** 视角平移方向（以屏幕方向为准，与引擎侧 panCamera 的约定一致） */
export type PanDir = 'left' | 'right' | 'up' | 'down';

const PAN_ICONS: Record<PanDir, 'arrow-back' | 'arrow-forward' | 'arrow-up' | 'arrow-down'> = {
  up: 'arrow-up',
  down: 'arrow-down',
  left: 'arrow-back',
  right: 'arrow-forward',
};

const PAN_LABELS: Record<PanDir, string> = {
  up: '视角上移',
  down: '视角下移',
  left: '视角左移',
  right: '视角右移',
};

/**
 * 平移按钮：弱化淡灰浮层。外层 box-none 只让按钮自身命中，
 * 按钮内以 Responder 抢占触摸，按下与滑动都不会透传给下层画布（不触发拖拽/缩放/点击原子）。
 */
function PanButton({ dir, onPan }: { dir: PanDir; onPan: (d: PanDir) => void }) {
  const [pressed, setPressed] = useState(false);
  return (
    <View
      style={[styles.panBtn, pressed && styles.panBtnPressed]}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderTerminationRequest={() => false}
      onResponderGrant={() => setPressed(true)}
      onResponderRelease={() => {
        setPressed(false);
        onPan(dir);
      }}
      onResponderTerminate={() => setPressed(false)}
      accessibilityRole="button"
      accessibilityLabel={PAN_LABELS[dir]}
    >
      <Ionicons name={PAN_ICONS[dir]} size={17} color={colors.faint} />
    </View>
  );
}

/** 画布上的视角平移方向盘：上/下/左/右四向浮层，覆盖在 3D 画布之上 */
export default function CanvasPanPad({
  top,
  bottom = 0,
  bottomPct,
  onPan,
}: {
  top: number;
  bottom?: number;
  /** 按容器高度的百分比留白（几何引擎内部会把画布切给 2D 投影图时用） */
  bottomPct?: number;
  onPan: (dir: PanDir) => void;
}) {
  const bottomStyle: `${number}%` | number = bottomPct ? `${bottomPct}%` : bottom;
  return (
    <View style={[styles.panLayer, { top, bottom: bottomStyle }]} pointerEvents="box-none">
      <View style={styles.panEdgeTop} pointerEvents="box-none">
        <PanButton dir="up" onPan={onPan} />
      </View>
      <View style={styles.panEdgeBottom} pointerEvents="box-none">
        <PanButton dir="down" onPan={onPan} />
      </View>
      <View style={styles.panEdgeLeft} pointerEvents="box-none">
        <PanButton dir="left" onPan={onPan} />
      </View>
      <View style={styles.panEdgeRight} pointerEvents="box-none">
        <PanButton dir="right" onPan={onPan} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panLayer: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
  panEdgeTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  panEdgeBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  panEdgeLeft: {
    position: 'absolute',
    left: 8,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  panEdgeRight: {
    position: 'absolute',
    right: 8,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  panBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.45)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(22,50,79,0.08)',
  },
  panBtnPressed: {
    backgroundColor: 'rgba(255,255,255,0.9)',
  },
});
