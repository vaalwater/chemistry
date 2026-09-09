import React, { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';

export interface ChemWebViewHostProps {
  html: string;
  onEvent: (data: unknown) => void;
  onLoad?: () => void;
}

export interface ChemHostHandle {
  post: (msg: unknown) => void;
}

/**
 * Web 平台宿主：将打包好的引擎 HTML 渲染进同源 iframe，
 * 并通过 window.postMessage 双向通信。
 */
const ChemWebViewHost = forwardRef<ChemHostHandle, ChemWebViewHostProps>(
  function ChemWebViewHost({ html, onEvent, onLoad }, ref) {
    const frameRef = useRef<HTMLIFrameElement | null>(null);
    const evRef = useRef(onEvent);
    evRef.current = onEvent;

    useEffect(() => {
      const handler = (e: MessageEvent) => {
        if (e.source === frameRef.current?.contentWindow && e.data) {
          evRef.current(e.data);
        }
      };
      window.addEventListener('message', handler);
      return () => window.removeEventListener('message', handler);
    }, []);

    useImperativeHandle(ref, () => ({
      post: (msg: unknown) => {
        const win = frameRef.current?.contentWindow;
        if (win) win.postMessage(JSON.stringify(msg), '*');
      },
    }));

    return React.createElement('iframe', {
      ref: frameRef,
      title: 'chem3d-engine',
      srcDoc: html,
      onLoad: onLoad,
      style: {
        position: 'absolute' as const,
        inset: 0,
        width: '100%',
        height: '100%',
        border: 0,
        display: 'block',
        background: 'transparent',
      },
    });
  }
);

export default ChemWebViewHost;
