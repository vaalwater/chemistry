# 高中化学 3D 课堂（iOS）

面向高中化学学习的 **3D 交互式** iOS App（Expo / React Native）。核心亮点是把微观粒子「看得见」：

- **分子 / 离子 3D 球棍模型**：H₂、O₂、N₂、H₂O、CO₂、CH₄、NH₃、H₂SO₄、C₂H₅OH、CaCO₃、NaOH、NaCl 离子晶体等 19 个结构单元。
- **原子级下钻视图**：在分子场景轻点任意原子，即可进入该元素的原子结构 —— 红色**质子**与灰色**中子**组成的原子核 + 分层运动的蓝色**电子**（按 K/L/M/N 壳层简化示意）。
- **典型反应方程式 3D 动画**：6 组高中常见反应（氢气燃烧、H₂O₂ 分解、CaCO₃ 高温分解、酸碱中和、锌与稀盐酸、CO₂ 使石灰水变浑浊），分「反应物 → 中间过程 → 生成物」逐步演示，支持播放 / 暂停 / 上一步 / 下一步。

> 教学简化说明：原子核与电子轨道大小**并非真实比例**（真实原子核仅占原子体积的极小部分），本应用以清晰展示分层结构与成键过程为目的。

## 技术架构

```
┌────────────────────────────── RN 宿主（React Native，iOS/Web/Android） ──┐
│  App.tsx（Tab 导航） → 各列表页 → SceneScreen（全屏 3D 场景 + 覆盖式 UI）   │
│                              │                                           │
│                     Chem3DView（命令重放 / 事件转发）                       │
│                              │                                           │
│              ChemWebViewHost（平台分文件：.native = WebView，.web = iframe）│
└──────────────────────────────┬───────────────────────────────────────────┘
                               │ srcDoc 加载同一个打包 HTML + postMessage 协议
┌──────────────────────────────▼───────────────────────────────────────────┐
│  3D 引擎（独立 HTML，three.js r159，零外部请求）                           │
│  分子球棍 · 离子键/双键/三键 · NaCl 晶格 · 原子核+电子层 · 反应状态机       │
└──────────────────────────────────────────────────────────────────────────┘
```

关键设计：

- **一套引擎，两端复用**：引擎被打包成单个 HTML 字符串 `src/engine/engineHtml.ts`（约 726 KB），原生端放入 `react-native-webview`，Web 端放入 `<iframe srcDoc>`。
- **平台分文件路由**：`react-native-webview` 没有 Web 实现，因此宿主组件拆成 `.native.tsx` / `.web.tsx`，由 Metro 按平台自动选择；裸 `ChemWebViewHost.tsx` 仅用于 TypeScript 类型解析。
- **双向消息协议**：宿主 → 引擎走 `scene / reaction / view` 命令；引擎 → 宿主回 `ready / scene / atomPick / atomInfo / reaction` 事件。
- **共享内容库**：`data/content.json` 是 RN 侧列表与 3D 引擎的**同一数据源**，新增分子/反应只需改这一份 JSON。

## 目录结构

| 路径 | 说明 |
| --- | --- |
| `data/content.json` | 内容库：元素、分子（几何原子坐标+键）、反应与演示步骤 |
| `engine/index.template.html` | 引擎 HTML 外壳（含加载动画、HUD） |
| `engine/engine.js` | 3D 引擎核心（纯 JS，约 1000 行） |
| `engine/style.css` | 引擎内部样式 |
| `engine/vendor/three.min.js` | three.js r159（UMD） |
| `scripts/build-engine.mjs` | 把上面几部分打包进 `src/engine/engineHtml.ts` |
| `scripts/serve.mjs` | 本地静态预览服务器（默认目录 `dist`、端口 `8787`） |
| `src/engine/engineHtml.ts` | **自动生成**，勿手改 |
| `src/components/` | Chem3DView + 平台分文件 WebView 宿主、分子缩略图 |
| `src/screens/` | 分子 / 反应 / 原子 / 关于 列表页 + 全屏 3D 场景页 |

## 快速开始（Web 预览，Windows 可直接用）

```bash
npm install

# 1) 修改过 engine/* 或 data/* 后，先重新打包引擎：
npm run build:engine

# 2) 导出 Web 静态产物：
npx expo export --platform web

# 3) 本地预览：
node scripts/serve.mjs dist 8787
# 浏览器打开 http://localhost:8787
```

日常开发也可用热更新模式：`npx expo start --web`。

质量检查：

```bash
npm run typecheck          # TypeScript 全量类型检查
```

## 打包为 iOS App（需 macOS + Xcode）

工程为 Expo SDK 57 / React Native 0.86，iOS 端通过 `WKWebView` 运行同一套 three.js 3D 引擎。

推荐方式 —— **Expo 开发构建 / 预构建**（在装有 Xcode 的 Mac 上执行）：

```bash
# 1. 安装依赖
npm install

# 2. 若改动过引擎或内容，重新打包并生成 WebView 内嵌 HTML（不依赖网络资源）
npm run build:engine

# 3. 生成原生 ios 工程（会新增 ios/ 目录）
npx expo prebuild --platform ios

# 4. 真机运行（自动打开 Xcode / 或命令行构建）
npx expo run:ios

# 或直接打开生成的工程用 Xcode 打包：
open ios/*.xcworkspace
# Xcode -> Product -> Archive，再经 Organizer 导出 .ipa（需 Apple Developer 账号）
```

真机调试提示：设备需与 Mac 同局域网；首次运行会请求加载本地 Metro，若走纯离线包可注释 `scripts/serve.mjs` 无关——App 内 3D 页面为内嵌 HTML，**不依赖任何远程服务器**。

> 免开发者账号的真机自测：可在 Xcode 中设置 Team 为自己的 Apple ID（免费），选择个人设备直接 Run。

### 其他注意点

- 修改 `app.json` 中的 `ios.bundleIdentifier`（默认 `com.example.chem3dclassroom`）后再打包上架。
- `dist/`、`ios/`、`android/` 已加入 `.gitignore`，均为生成产物。
- Web 端通过 iframe 与引擎通信；原生端通过 `window.ReactNativeWebView.postMessage` 通信，切换平台无需改动引擎代码。

## 如何新增一个分子或反应

1. 在 `data/content.json` 的 `molecules` 增加一条：给出元素组成、各原子**三维坐标**（球棍模型据此生成）与键（`order`：1 单键 / 2 双键 / 3 三键，`style: "ionic"` 离子键）。
2. 若涉及反应，在 `reactions` 增加一条并引用上述分子 id，`steps[].show` 取值 `reactants / mixing / products` 对应引擎的状态机三阶段。
3. 重新执行：`npm run build:engine` → `npx expo export --platform web` → 预览验证。

## 免责声明

本应用仅供学习辅助，内容表述以人教版高中化学教材为准；如有出入请以教材为准。

## License

见 [LICENSE](./LICENSE)。
