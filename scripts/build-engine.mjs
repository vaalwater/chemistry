import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');
const safe = (s) => s.replace(/<\/script>/gi, '<\\/script>');

const template = read('engine/index.template.html');
const css = read('engine/style.css');
const data = read('data/content.json');
const three = read('engine/vendor/three.min.js');
const engineJs = read('engine/engine.js');

// 注意：必须用“函数”作为替换值，不能用字符串——
// 字符串替换值中的 $& / $' / $` / $n 会被视为特殊模式展开，
// three.min.js 中含有大量 $& 等字符，会造成内容损坏（THREE is not defined）。
const html = template
  .replace('@@CSS@@', () => css)
  .replace('@@DATA@@', () => data)
  .replace('@@THREE@@', () => safe(three))
  .replace('@@ENGINE@@', () => safe(engineJs));

const outPath = join(root, 'src/engine/engineHtml.ts');
const ts = '/* 自动生成：由 scripts/build-engine.mjs 打包 engine/* 与内容库而来。请勿手改。 */\n' +
  'export const ENGINE_HTML: string = ' + JSON.stringify(html) + ';\n';

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, ts, 'utf8');

console.log('engineHtml.ts written:', (ts.length / 1024).toFixed(0) + ' KB');
