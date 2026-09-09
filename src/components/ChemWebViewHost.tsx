// 平台分文件：Metro 会按平台选择 .web / .native 实现。
// 此文件仅用于 TypeScript 类型解析（web 声明含 DOM 类型，类型检查兼容）。
export { default } from './ChemWebViewHost.web';
export type { ChemWebViewHostProps, ChemHostHandle } from './ChemWebViewHost.web';
