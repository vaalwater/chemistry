// 生成 App Store 截屏（web 版渲染，一套脚本出多套尺寸）。
//
// 前置：
//   1) 启动 web dev server： npx expo start --web --port 8099
//   2) 安装浏览器：         npx playwright install chromium
//   3) 项目已 npm i -D playwright
//
// 运行：
//   node make-screenshots.cjs            # 全部尺寸（6.1-6.3 / 6.9 / duo-inner / duo-outer）
//   node make-screenshots.cjs 6.1-6.3    # 只跑某一类
//   node make-screenshots.cjs duo        # 只跑 duo 内/外屏
//
// 输出： appstore/screenshots/<尺寸目录>/*.png （像素 = 逻辑尺寸 × 3，符合 ASC 槽位）
//
// 说明：本 App 没有 URL 路由，所有导航靠模拟点击（首页卡片 → 频道 → tab / 模块 → 详情）。
//       每个 shot 都从首页重新加载（goto BASE 重置 SPA），互不依赖。3D 页面用 swiftshader
//       软渲染 WebGL；若个别页面空白，多半是 WebGL 在该环境没起来，可调整 launch args。

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.SHOT_URL || 'http://localhost:8099';
const THIS = __dirname; // appstore/screenshots/

// 逻辑尺寸（@1x）+ 3x → ASC 像素尺寸
const SIZES = {
  '6.1-6.3': { width: 393, height: 852, scale: 3 }, // 1179×2556
  '6.9': { width: 402, height: 874, scale: 3 }, // 1206×2622
  'duo-inner': { width: 669, height: 951, scale: 3 }, // 2007×2853
  'duo-outer': { width: 466, height: 678, scale: 3 }, // 1398×2034
};

async function tap(p, text, { exact = false, timeout = 15000 } = {}) {
  const el = p.getByText(text, { exact }).first();
  await el.waitFor({ state: 'visible', timeout });
  await el.click();
  await p.waitForTimeout(700);
}
async function waitText(p, text, timeout = 20000) {
  await p.getByText(text, { exact: false }).first().waitFor({ state: 'visible', timeout });
}
async function gotoHome(p) {
  await p.goto(BASE, { waitUntil: 'domcontentloaded' });
  await waitText(p, '理科3D视界', 40000);
  await p.waitForTimeout(600);
}

// 每个截图目标：name + go(page)。失败不阻断，最后汇总。
const SHOTS = [
  { name: '01-home', go: async () => {} },
  { name: '02-chem-molecules', go: async (p) => {
      await tap(p, '化学', { exact: true });
      await waitText(p, '分子模型');
  }},
  { name: '03-molecule-3d', go: async (p) => {
      await tap(p, '化学', { exact: true });
      await waitText(p, '分子模型');
      await tap(p, '水', { exact: true }); // 分子列表卡片「水」→ 3D 空间
      await waitText(p, '水', 25000);
      await p.waitForTimeout(1800); // 等 3D 引擎加载
  }},
  { name: '05-reaction', go: async (p) => {
      await tap(p, '化学', { exact: true });
      await waitText(p, '分子模型');
      await tap(p, '反应', { exact: true });
      await p.waitForTimeout(1000);
  }},
  { name: '06-handson', go: async (p) => {
      await tap(p, '化学', { exact: true });
      await waitText(p, '分子模型');
      await tap(p, '动手', { exact: true });
      await p.waitForTimeout(1000);
  }},
  { name: '07-geo', go: async (p) => {
      await tap(p, '数学', { exact: true });
      await waitText(p, /立体几何|集合|最值|画图|动手/);
      await tap(p, '立体几何', { exact: true });
      await p.waitForTimeout(1000);
  }},
  { name: '08-em', go: async (p) => {
      await tap(p, '物理', { exact: true });
      await waitText(p, /电磁学|安培|洛伦兹/);
      await tap(p, '电磁学', { exact: true });
      await p.waitForTimeout(1000);
  }},
  { name: '09-knowledge', go: async (p) => {
      await tap(p, '知识点汇总'); // 首页各学科卡片右侧
      await waitText(p, /知识点|汇总|长文|讲解/);
      await p.waitForTimeout(1000);
  }},
  { name: '10-about', go: async (p) => {
      await tap(p, '关于本 App');
      await p.waitForTimeout(1000);
  }},
];

async function run() {
  const arg = process.argv[2];
  let sizes = Object.entries(SIZES);
  if (arg === 'duo') sizes = sizes.filter(([k]) => k.startsWith('duo'));
  else if (arg) sizes = sizes.filter(([k]) => k === arg);

  const browser = await chromium.launch({
    args: [
      '--no-sandbox',
      '--use-gl=angle',
      '--use-angle=swiftshader',
      '--enable-unsafe-swiftshader',
      '--ignore-gpu-blocklist',
    ],
  });

  for (const [tag, size] of sizes) {
    const dir = path.join(THIS, tag);
    fs.mkdirSync(dir, { recursive: true });
    const ctx = await browser.newContext({
      viewport: { width: size.width, height: size.height },
      deviceScaleFactor: size.scale,
      isMobile: true,
      hasTouch: true,
    });
    const page = await ctx.newPage();
    const results = [];
    for (const shot of SHOTS) {
      try {
        await gotoHome(page);
        await shot.go(page);
        await page.waitForTimeout(900);
        await page.screenshot({ path: path.join(dir, shot.name + '.png') });
        results.push('OK   ' + shot.name);
      } catch (e) {
        results.push('FAIL ' + shot.name + ': ' + String(e.message).split('\n')[0]);
      }
    }
    await ctx.close();
    console.log('\n[' + tag + ']');
    results.forEach((r) => console.log('  ' + r));
  }
  await browser.close();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
