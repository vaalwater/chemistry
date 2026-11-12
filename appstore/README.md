# 发布材料（App Store）

本目录存放「理科3D视界」提交苹果 App Store 所需的全部**文案与说明材料**，
从原来的 `ios/build/`（Expo prebuild 临时目录，会随 `expo run:ios` 重建/清理）迁移到
项目根目录，便于版本化管理、长期留存。

> 上架的完整技术流程（归档 / 导出 IPA / 签名校验 / 截图脚本 / 宣传素材）见
> `CLAUDE.md` 的 **§6.6 归档与导出 IPA（上架流程）**，本目录只管「要填进
> App Store Connect 的文字」和「截图规格清单」。

## 目录结构

```
appstore/
├── README.md            # 本文件：材料清单与上架流程索引
├── AppStore文案.md      # 贴进 ASC 的全部文案（名称/副标题/描述/关键词/宣传文本/新版本说明/隐私URL）
├── 审核补充材料.md       # 英文：新开发者账号常被要求补充的答复（贴 ASC 回复 + 备注栏）
└── screenshots/         # 截图规格清单与生成脚本说明
    └── README.md
```

## 本次发布目标（小版本）

| 项 | 已确认 |
| --- | --- |
| `app.json` → `expo.version` | `2.0.1` |
| `app.json` → `expo.ios.buildNumber` | `4` |

> 首次上架是 `1.0.0(1)`，上一次是 `2.0.0(3)`（见 git 历史 `23331f1`）。

## 本次更新的主要卖点（用于文案与截图选页）

1. **左边缘右划返回手势重做**：上下区域更宽、画布主体区域收窄的「异形热区」，
   分子 / 原子 3D 画布上拖动改角度不再误触发整页返回。
2. **化学式输入更严谨**：拦截电荷不守恒的无效式（如 `NaN2`），更准确地识别
   `NaN3` / `Na3N` / `Ca3N2` 等。
3. **3D 分子结构新增共价键电子标注**：直观展示共用电子对与离子得失电子。
4. **体验改进**：问答助手悬浮小猫、页面滚动记忆、底部介绍卡片自适应高度等。
5. **隐私恒定**：完全离线、无广告、不收集个人信息（与隐私政策逐条一致）。

## 上架步骤速查（详细见 CLAUDE.md §6.6）

1. 改 `app.json` 的 `version` / `ios.buildNumber`。
2. `npm run build:engine`（若改过引擎/数据）后 `npx expo run:ios` 重新生成 `ios/`。
3. 打上 `§6.5` 的 iOS 原生补丁（UIScene 生命周期），否则 iOS 26+ 启动即崩。
4. `xcodebuild ... archive` → `exportArchive`（ExportOptions 已配 `method=app-store`）。
5. 校验签名（Apple Distribution + iOS Team Store 描述文件）。
6. 按 `screenshots/README.md` 生成截图，上传 ASC。
7. 把 `AppStore文案.md` 与 `审核补充材料.md` 的内容贴进 ASC 对应栏位。
8. 上传 IPA（已配好的 App Store Connect API key：`AuthKey_2CFX4DH8F6.p8`）。
