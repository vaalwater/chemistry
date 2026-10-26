# 35中数理化（iOS）

面向高中数理化学习的 **3D 交互式** iOS App（Expo / React Native）。首页按 **数学 / 物理 / 化学** 分成三个学科频道（已开放内容的排在最前），每个学科点进去是自己的二级内容页。

| 频道 | 状态 | 内容 |
| --- | --- | --- |
| 化学 | **已开放** | 19 个 3D 结构、6 组反应动画、4 个动手实验 |
| 数学 | **立体几何已开放** | 立体几何 4 个实验室（见下）；函数与图像、平面几何、概率统计规划中 |
| 物理 | **电磁学已开放** | 电磁学 4 个实验室（见下）；力学、运动学、光学与热学规划中 |

## 数学频道 · 立体几何

针对老师总结的四个痛点，做成一个个可交互的实验室：

| 实验室 | 痛点 | 做法 |
| --- | --- | --- |
| 立体 ↔ 直观图联动 | 空间想象力不足，看不懂斜二测画法 | 上方 3D 几何体可旋转缩放，下方斜二测 / 正等测直观图实时同步；实线=可见棱、虚线=被遮挡棱；点 2D 图上的线，3D 对应棱闪烁高亮；支持 7 种几何体表面展开动画 |
| 定理可视化实验室 | 线面关系判定定理记不住、不会用 | 5 条判定/性质定理各配四步动画，反例开关演示“少一个条件会怎样”，判定树三个问题定位该用哪条定理 |
| 空间角三步定位器 | 异面直线角、线面角、二面角找不到、算不对 | 按「找 → 证 → 算」三步演示作图过程，辅助线选得对不对当场反馈，再把关键三角形拎出来填空，App 即时判对错；每类角配 3~4 道变式题 |
| 体积公式推导剧场 | 体积/表面积公式混乱、不会推导 | 先猜后验：三棱柱切成三个等体积的锥、圆锥倒三次水装满圆柱、祖暅原理对比半球与「圆柱挖圆锥」，截面高度可拖动 |

## 物理频道 · 电磁学

针对老师总结的痛点，做成四个实验室：

| 实验室 | 痛点 | 做法 |
| --- | --- | --- |
| 场的可视化实验室 | 场看不见摸不着，只能背「× 和 ·」的符号 | 点电荷、等量同种/异种、匀强电场、通电直导线、环形电流、螺线管、条形磁铁共 8 个场，全部 3D 场线 + 流光粒子；场强探针拖到哪读到哪；叠加开关「只有 A / 只有 B / A+B」看矢量合成；一键切等势面（磁场为切片热力图） |
| 三方向定则训练器 | 左手右手分不清，「垂直纸面」的方向全靠猜 | 安培力、洛伦兹力、右手定则各一个可交互场景，学生先选方向、App 用叉乘当场判定；洛伦兹力可把 v 与 B 的夹角从 0° 拉到 90°（直线 → 螺旋 → 圆周）；安培力带「I ∥ B」反例开关 |
| 电磁感应探究台 | 磁通量变化「看不见」，楞次定律只会死记 | 磁铁自动往返插拔线圈，Φ-t 与 I-t 双曲线实时联动，匝数 / 电阻 / 磁极可调——亲眼看到「Φ 最大时 I 恰好为零」 |
| 能量流 · 电磁场传能 | 「电、能、场」搅在一起：以为电子跑到了灯泡 | 双导线 + 灯泡场景：电荷只在原地振荡、电场/磁场随 u、i 反转、能量流 S = E×H 始终单向流向负载；p = ui ≥ 0 曲线 + 平均功率线；电场 / 磁场 / 能量流可逐层关掉，看谁在真正搬运能量 |
| 交流发电机 · 法拉第与楞次 | 正弦从哪来？中性面与 e = −N·ΔΦ/Δt 记不牢 | 线圈在匀强磁场中旋转，Φ = BS cos θ 与 e = NBSω sin θ 同步画出，中性面（Φ 最大、e = 0）与平行位置（Φ = 0、e 最大）自动提示；红色阻力矩演示楞次定律的「阻碍」——转得越快越费力 |
| 交流电波形实验室 | 瞬时值、峰值、有效值、平均值四个概念搅在一起 | 波形与旋转相量同步；正弦 / 方波 / 半波整流的有效值用「同阻同时同热」对比实验说明；变压器匝数比与负载可调；远距离输电损耗链高压 / 低压一开关对比 |

化学频道的核心亮点是把微观粒子「看得见」：

- **分子 / 离子 3D 球棍模型**：H₂、O₂、N₂、H₂O、CO₂、CH₄、NH₃、H₂SO₄、C₂H₅OH、CaCO₃、NaOH、NaCl 离子晶体等 19 个结构单元。
- **原子级下钻视图**：在分子场景轻点任意原子，即可进入该元素的原子结构 —— 红色**质子**与灰色**中子**组成的原子核 + 分层运动的蓝色**电子**（按 K/L/M/N 壳层简化示意）。
- **典型反应方程式 3D 动画**：6 组高中常见反应（氢气燃烧、H₂O₂ 分解、CaCO₃ 高温分解、酸碱中和、锌与稀盐酸、CO₂ 使石灰水变浑浊），分「反应物 → 中间过程 → 生成物」逐步演示，支持播放 / 暂停 / 上一步 / 下一步。

> 教学简化说明：原子核与电子轨道大小**并非真实比例**（真实原子核仅占原子体积的极小部分），本应用以清晰展示分层结构与成键过程为目的。

## 技术架构

```
┌────────────────────────────── RN 宿主（React Native，iOS/Web/Android） ──┐
│  App.tsx（学科首页 → 频道）→ 化学频道 Tab 导航 → 各列表页 → SceneScreen    │
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
| `scripts/build-engine.mjs` | 把上面几部分打包进 `src/engine/engineHtml.ts`（并执行 build-geo） |
| `scripts/build-geo.mjs` | 把 `engine/geo/*` 打包进 `src/engine/geometryHtml.ts`（立体几何引擎） |
| `scripts/build-phys.mjs` | 把 `engine/phys/*` 打包进 `src/engine/physicsHtml.ts`（电磁学引擎） |
| `scripts/serve.mjs` | 本地静态预览服务器（默认目录 `dist`、端口 `8787`） |
| `src/engine/engineHtml.ts` | **自动生成**，勿手改 |
| `src/components/` | Chem3DView / Geo3DView + 平台分文件 WebView 宿主、分子缩略图 |
| `src/subjects.ts` | 学科频道元数据（名称 / 主题色 / 模块清单 / 是否开放），已开放的排前面 |
| `src/screens/` | 学科首页 HomeScreen、学科频道页 SubjectChannelScreen，化学频道的分子 / 反应 / 原子 / 关于 列表页 + 全屏 3D 场景页 |
| `src/screens/geo/` | 数学频道 · 立体几何：模块首页 + 四个实验室页面 |
| `src/screens/physics/` | 物理频道 · 电磁学：子频道首页 + 四个实验室页面 |
| `src/geometry/geoContent.ts` | 立体几何内容库：形状、定理与判定树、空间角变式题、体积推导字幕 |
| `src/physics/emContent.ts` | 电磁学内容库：8 个场的说明、三条定则、四个交流电模块 |
| `engine/geo/` | 立体几何 3D 引擎（geo.js 核心 + scenes.js 场景库 + 页面模板） |
| `engine/phys/` | 电磁学 3D 引擎（phys.js 核心 + fields.js 场库 + scenes.js 场景库） |

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

- 修改 `app.json` 中的 `ios.bundleIdentifier`（默认 `com.rongweiwei.stem3dclassroom`）后再打包上架。
- `dist/`、`ios/`、`android/` 已加入 `.gitignore`，均为生成产物。
- Web 端通过 iframe 与引擎通信；原生端通过 `window.ReactNativeWebView.postMessage` 通信，切换平台无需改动引擎代码。

## 如何新增一个分子或反应

1. 在 `data/content.json` 的 `molecules` 增加一条：给出元素组成、各原子**三维坐标**（球棍模型据此生成）与键（`order`：1 单键 / 2 双键 / 3 三键，`style: "ionic"` 离子键）。
2. 若涉及反应，在 `reactions` 增加一条并引用上述分子 id，`steps[].show` 取值 `reactants / mixing / products` 对应引擎的状态机三阶段。
3. 重新执行：`npm run build:engine` → `npx expo export --platform web` → 预览验证。

> 未收录进 `content.json` 的物质（反应推导的产物、输入框里手打的分子式）由 `src/formulaBuilder.ts`
> 按分子式自动建模，改动这里要注意两条约定：
> - **中心原子由电负性决定**（`pickCentral`），不是「分子式里第一个非氢元素」—— 否则 `FeCl₃`
>   （推导时会按字母排序写成 `Cl3Fe`）会画成 Cl 居中挂着两个 Cl 和一个 Fe。
> - **配位数决定构型**：2 直线 / 3 平面三角 / 4 正四面体 / 5 三角双锥 / 6 八面体（`ligandDirs`），
>   H 优先挂在电负性大的配体上（氢氧化物因此画成 Fe–O–H 而不是 Fe 同时连 O 和 H）。
> - 画面上的离子化合物只是**一个式量单元**，真实结构写在 `STRUCT_NOTE`（如无水 FeCl₃ 实为 Fe³⁺ 八面体配位的层状离子晶体）。

## 免责声明

本应用仅供学习辅助，内容表述以人教版高中化学教材为准；如有出入请以教材为准。

## License

见 [LICENSE](./LICENSE)。
