import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');
const safe = (s) => s.replace(/<\/script>/gi, '<\\/script>');

const template = read('engine/geo/index.template.html');
const css = read('engine/style.css');
const three = read('engine/vendor/three.min.js');
const geoJs = read('engine/geo/geo.js');
const scenesJs = read('engine/geo/scenes.js');

// 与 build-engine.mjs 一样：替换值必须用函数，避免 three.min.js 里的 $& 被展开
const html = template
  .replace('@@CSS@@', () => css)
  .replace('@@THREE@@', () => safe(three))
  .replace('@@ENGINE@@', () => safe(geoJs))
  .replace('@@SCENES@@', () => safe(scenesJs));

const outPath = join(root, 'src/engine/geometryHtml.ts');
const ts = '/* 自动生成：由 scripts/build-geo.mjs 打包 engine/geo/* 而来。请勿手改。 */\n' +
  'export const GEOMETRY_HTML: string = ' + JSON.stringify(html) + ';\n';

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, ts, 'utf8');

console.log('geometryHtml.ts written:', (ts.length / 1024).toFixed(0) + ' KB');
