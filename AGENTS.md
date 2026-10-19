# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

---

# 理科3D视界 · 改造手册

面向「后续升级改造」的导航与约定说明。**改 UI 结构前先读这一份**，比翻代码快。

## 0. 一句话架构

**这个项目没有 expo-router，也没有 react-navigation。** 没有 `app/` 目录、没有 `_layout`、没有 `Stack.Screen`。
全部路由就是根目录 `App.tsx` 里几个 `useState`，加上各频道自己维护的内部 `view` 状态。

```
HomeScreen（学科首页）
  ├─ 化学   → App.tsx 的 ChemistryTabs  → BrowseScreen / ReactionsScreen / HandsOnScreen / AboutScreen
  │                                     → SceneScreen（全屏 3D）· RadiusLabScreen（全屏实验）
  ├─ 数学   → SubjectTabs               → 浏览页 + 模块分支（见 §2）
  └─ 物理   → SubjectTabs               → 浏览页 + 模块分支（见 §2）
```

## 1. 路由是真的 dumb state

`App.tsx` 里只有这些状态：`subject`（当前学科 / null=首页）、`moduleKey`（数学·物理的当前子模块 / null=浏览页）、`tab`（化学的四个 tab）、`scene`、`lab`（化学的全屏页）。

渲染是一个五分支决策（见 `App.tsx`~86-113 行）：`!subject` → HomeScreen；`subject !== 'chemistry'` → `SubjectTabs`；`lab` → RadiusLabScreen；`scene` → SceneScreen；否则 → `ChemistryTabs`。

含义：**加页面 = 加一个 state key + 一个 `<XxxScreen />` 分支**，不要去找导航配置，因为没有。

## 2. 数学 / 物理频道：三层结构（`src/screens/SubjectTabs.tsx`）

| 层 | 例子 | 渲染什么 |
| --- | --- | --- |
| 频道浏览页 | 模块清单 | `SubjectChannelScreen`（列出 `subject.modules` 卡片） |
| 一级模块页 | 集合 / 立体几何 / 最值 / 动手 / 电磁学 | 各自独立的 Screen |
| 二级实验室页 | 体积公式剧场 / 三方向定则训练器 … | 由一级模块的 `view` state 早返回渲染 |

当前模块路由表（`SubjectTabs.tsx` 里的 `active === '<key>'` 分支）：

| key | 组件 | 备注 |
| --- | --- | --- |
| `''`（空串 = BROWSE_KEY） | `SubjectChannelScreen` | 频道首页 |
| `set` | `math/SetLabScreen` | |
| `geo` | `geo/SolidGeoHomeScreen` | 内嵌 4 个二级实验室 |
| `extreme` | `math/ExtremeScreen` | |
| `handsOn` | `math/HandsOnHomeScreen` | 挂在底部导航上，内嵌“画图” |
| `playground` | `math/PlaygroundScreen`（标题：画图） | **不再是一级路由**，由 HandsOnHomeScreen 内部打开 |
| `em` | `physics/EmHomeScreen` | 内嵌 4 个二级实验室 |

## 3. 返回按钮 / 底部导航的规范（别再踩回去）

历史上一版导航很乱（有的页面用学科名当返回按钮文案，有的显示底部导航），现在约定如下：

| 页面类型 | 左上角返回 | 底部导航条 |
| --- | --- | --- |
| 频道浏览页 | ❌ 不要 | ✅ 显示（学科 + 本频道 tab） |
| 一级模块页 — **挂**在底部导航上 | 视情况（如「动手」保留） | ✅ 显示 |
| 一级模块页 — **没挂**在导航条上（集合 / 立体几何 / 最值 / 电磁学） | ✅ 「‹ 返回」 | ❌ 不显示 |
| 二级实验室页（更深一层） | ✅ 「‹ 返回」 | ❌ 不显示 |
| 化学全屏页（SceneScreen / RadiusLabScreen / IsoPlayScreen …） | ✅ 「‹ 返回」或关闭 | ❌ 不显示（本来就在导航条外渲染） |

要点：

- 返回按钮文案**统一写「返回」**，不要把学科名（数学 / 物理 / 立体几何 / 电磁学）当返回文案写回去。
- 底部导航是否显示，由 `SubjectTabs` 里的 `showTabBar = items.some(t => t.key === active)` 决定；`items` = 「浏览」+ 本学科 pinned 的模块。
- 一级模块页的返回按钮跳 `goBrowse`（回浏览页），不跳学科首页；跳学科首页的入口是底部导航最左「学科」格（`ChannelTabBar` 的 `homeLabel`）。
- 底层机制：`ChannelTabBar` 只渲染不负责流程，`onHome` 回学科首页、`onPress(key)` 切模块。上面那些显示/隐藏策略**不要**下沉到 TabBar 组件里实现。

标准返回按钮片段（照抄，样式名 `backBtn` / `backText` 保持一致）：

```tsx
<Pressable style={styles.backBtn} onPress={onBack} accessibilityRole="button">
  <Ionicons name="chevron-back" size={18} color={colors.inkSoft} />
  <Text style={styles.backText}>返回</Text>
</Pressable>
```

## 4. 关键文件地图

| 文件 | 作用 |
| --- | --- |
| `App.tsx` | 唯一的根路由；`ChemistryTabs`（化学四条 tab）也在这儿 |
| `src/screens/SubjectTabs.tsx` | 数学/物理频道路由；`PINNED_TABS` 决定哪些模块提到底部导航 |
| `src/screens/SubjectChannelScreen.tsx` | 频道浏览页（模块卡片清单） |
| `src/components/ChannelTabBar.tsx` | 底部导航条，三个频道共用，最左「学科」格回首页 |
| `src/subjects.ts` | 学科元数据 + 模块清单（`modules` 只在浏览页用） |
| `src/screens/HomeScreen.tsx` | 学科首页三张卡片 |
| `src/screens/math/`、`geo/`、`physics/` | 数学/物理的各模块页面 |
| `src/screens/HandsOnScreen.tsx` | ⚠️ 化学的“动手”tab 页，别和 `math/HandsOnHomeScreen.tsx` 搞混 |
| `src/theme.ts` | `colors` / `shadow`，样式统一从这里取 |

## 5. 加一个新模块怎么做

**A. 普通模块（作为浏览页的一张卡片）**

1. `src/subjects.ts` 对应学科的 `modules` 里加一条 `{ name, desc, done: true, route: 'xxx' }`（`done` 为假会灰掉显示「建设中」）。
2. `SubjectTabs.tsx` 加分支：`{active === 'xxx' ? <XxxScreen onBack={goBrowse} /> : null}`。
3. 新页面挂左上角「‹ 返回」（接 §3），不要显示底部导航。

**B. 提到底部导航（像「动手」那样）**

1. 做完 A 的第 2 步后，把 key 填进 `SubjectTabs.tsx` 的 `PINNED_TABS`（`{ subject: 'math', tab: { key, label, icon, iconOn } }`）。
2. **同时**把 `subjects.ts` 里那张卡片删掉，避免“清单里有 + 导航条上有”重复入口。
3. `showTabBar` 会自动把这一页算进去，无需改判断逻辑。

**C. 卡片式子频道（像立体几何 / 电磁学 / 动手）**

照 `geo/SolidGeoHomeScreen.tsx` 抄：一个 `ViewKey` + `useState`，非主线 view 用早返回渲染子页面，子页面 `onBack={() => setView('home')}`。

## 6. 3D 引擎（概要，细节见 README）

四套打包好的 HTML：`src/engine/engineHtml.ts`（化学）、`geometryHtml.ts`（立体几何）、`physicsHtml.ts`（电磁学）、`acidHtml.ts`（酸碱性），分别由 `npm run build:engine` / `build:geo` / `build:phys` / `build:acid` 生成 —— **这些文件自动生成，禁止手改**。
宿主通过 `ChemWebViewHost` 平台分文件（`.native.tsx` 用 WebView，`.web.tsx` 用 iframe）加载，双向 postMessage（宿主 → 引擎：`scene / reaction / view`；引擎 → 宿主：`ready / atomPick / reaction` …）。
化学内容库是 `data/content.json`，改内容也要重新 `npm run build:engine`。

**酸碱引擎（`engine/acid/` + `src/acid/acidRule.ts`）**：化学判断全在 TS 侧（`AcidCase` 数据表 + `buildScript()` 生成节拍），引擎 `acid.js` 只做演出。命令：`{cmd:'acid', case, script, from, play}` 建场（`from` = 快进到第 N 拍，练习模式用它直接演示某一步）、`{cmd:'acidCtl', action}` 控制；事件 `{ev:'acid', step, steps, title, text, h, oh}`（h/oh 是画面里自由 H⁺ / OH⁻ 的实时个数，直接用来画对比条）。改酸碱文案/物质 → 只改 `acidRule.ts`，热更新即生效；改动画本身 → 要重新 `npm run build:acid`。

**练习模式（`src/acid/infer.ts` + `src/acid/quiz.ts` + `src/screens/AcidPracticeView.tsx`）**：用户输入任意分子式 → `inferFromFormula()` 按规则推导（不是查表：解析成原子计数 → 判断酸/碱/盐 → 电荷守恒反推阳离子电荷 → 「谁弱谁水解」，两边都水解时用 0~10 的强弱刻度比）→ 转成 `AcidCase` 复用动画；`buildQuiz()` 生成逐步单选题（水解 → 电离 → 谁占优 → 酸碱性），每步答完用 `from` 跳拍播放**真实情况**的动画。改推导规则/离子表 → 只改 `infer.ts`；已知局限：全小写输入靠「首字母 + 所有 o 大写」的启发式（`na2co3` 能对，`co3` 会被当成钴）。

## 6.5 iOS 原生层的手工补丁（prebuild 会冲掉，重生成后必须重打）

iOS 26+ 强制要求 App 采用 UIScene 生命周期，而 Expo SDK 57 / RN 0.86 的 prebuild 模板还是旧式
window 生命周期 —— 直接在 iOS 27 模拟器上启动即崩（`UIApplicationEvaluateRuntimeIssueForNoSceneLifecycleAdoption`）。
Expo 官方还没修，所以 `ios/3D/` 里有两处手工补丁，**跑过 `expo prebuild` 后要照着重打**：

1. `Info.plist`：加 `UIApplicationSceneManifest`，`UISceneDelegateClassName` 指向 `AppDelegate`
   （类上有 `@objc(AppDelegate)`，避免 Swift 模块名 `3D` 的名字重整问题）。
2. `AppDelegate.swift`：类声明 `: ExpoAppDelegate, UISceneDelegate`；RN 的启动从
   `didFinishLaunching` 挪到 `scene(_:willConnectTo:)` 里（场景代理和 app 代理是两个实例，
   工厂要在 scene 回调里新建）；DEBUG 的 `bundleURL()` 里把 `jsLocation` 固定为 `localhost:8099`。

编译模拟器包：`xcodebuild -workspace ios/3D.xcworkspace -scheme 3D -configuration Debug -sdk iphonesimulator -derivedDataPath ios/build CODE_SIGNING_ALLOWED=NO build`，
产物在 `ios/build/Build/Products/Debug-iphonesimulator/3D.app`（`xcrun simctl install booted <path>` 后 `launch`）。

## 7. 开发命令

```bash
npm run typecheck                      # tsc --noEmit，改动必跑
npx expo start --web --port 8099       # 日常预览（8099 是手动指定的，不是默认端口！默认 8081）
npm run build:engine                   # 改过 engine/* 或 data/* 后再跑
```

> 注意：**没有配 ESLint**。`tsconfig` 只有 `strict`，**不含 `noUnusedLocals`** —— 删掉 JSX 后残留的 `import`、无用 style 不会被报错拦住，改完请自己核一遍（常见：`Ionicons`、`Pressable`、`backBtn`/`backText`）。

## 8. 排错：改了代码页面没变（Metro 缓存）

这个项目的 Metro 监听偶发失效，**dev server 会一直吐旧 bundle**，反复改源码没用。判断方法 —— 直接拉 bundle 核对，别猜：

```bash
cd /tmp && curl -s "http://localhost:8099/index.ts.bundle?platform=web&dev=true&hot=false&lazy=true&transform.engine=hermes&transform.routerRoot=app&unstable_transformProfile=hermes-stable&_t=$(date +%s)" -o web.bundle
python3 -c "
s=open('web.bundle',encoding='utf-8').read()
j=s.find('\"src/screens/math/XXX.tsx\"'); print(s[s.rfind('__d(',0,j):j][:800])"
```

⚠️ bundle 里**中文被转义成 `\uXXXX`**（数学 = `\u6570\u5B66`、返回 = `\u8FD4\u56DE`），按字面搜「返回」搜不到。

解决：清缓存重启 dev server。

```bash
kill <pid>; npx expo start --web --port 8099 --clear
```

改完之后浏览器还要**硬刷新**（`Cmd+Shift+R`）。

## 9. 改动自检清单

- [ ] `npm run typecheck` 通过
- [ ] 返回按钮文案是「返回」，不是学科名
- [ ] 页面有没有底部导航，符合 §3 的表格
- [ ] 删掉的 JSX 有没有留下无用 import / style
- [ ] bundle 里确认是新代码（§8），别只看源码以为改完了
