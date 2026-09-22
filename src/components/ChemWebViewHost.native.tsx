import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import { StyleSheet } from 'react-native';
import WebView from 'react-native-webview';
import type { WebView as WebViewType } from 'react-native-webview';

export interface ChemWebViewHostProps {
  html: string;
  onEvent: (data: unknown) => void;
  onLoad?: () => void;
}

export interface ChemHostHandle {
  post: (msg: unknown) => void;
}

/**
 * 原生平台宿主：用 WKWebView(ios)/WebView(android) 加载打包好的引擎 HTML。
 * RN -> 页面 通过 injectJavaScript 调用 window.__dispatch；页面 -> RN 走 postMessage。
 */
const ChemWebViewHost = forwardRef<ChemHostHandle, ChemWebViewHostProps>(
  function ChemWebViewHost({ html, onEvent, onLoad }, ref) {
    const webRef = useRef<WebViewType | null>(null);

    useImperativeHandle(ref, () => ({
      post: (msg: unknown) => {
        const payload = JSON.stringify(msg);
        webRef.current?.injectJavaScript(
          `window.__dispatch && window.__dispatch(${JSON.stringify(payload)}); true;`
        );
      },
    }));

    return (
      <WebView
        ref={webRef}
        originWhitelist={['*']}
        source={{ html }}
        javaScriptEnabled
        domStorageEnabled
        allowFileAccess
        // 关掉 WebView 自己的滚动/回弹与多指缩放，双指才能完整交给 3D 画布
        scrollEnabled={false}
        bounces={false}
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        onLoadEnd={onLoad}
        onMessage={(e) => {
          try {
            onEvent(e.nativeEvent.data);
          } catch (err) {
            // 忽略无法解析的消息
          }
        }}
        style={styles.fill}
      />
    );
  }
);

const styles = StyleSheet.create({
  fill: {
    flex: 1,
    backgroundColor: 'transparent',
  },
});

export default ChemWebViewHost;
