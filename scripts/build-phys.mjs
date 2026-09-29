import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');
const safe = (s) => s.replace(/<\/script>/gi, '<\\/script>');

const template = read('engine/phys/index.template.html');
const css = read('engine/style.css');
const three = read('engine/vendor/three.min.js');
const physJs = read('engine/phys/phys.js');
const fieldsJs = read('engine/phys/fields.js');
const scenesJs = read('engine/phys/scenes.js');

// 替换值必须用函数：three.min.js 中含有 $& 之类的模式，直接替换会被展开
const html = template
  .replace('@@CSS@@', () => css)
  .replace('@@THREE@@', () => safe(three))
  .replace('@@PHYS@@', () => safe(physJs))
  .replace('@@FIELDS@@', () => safe(fieldsJs))
  .replace('@@SCENES@@', () => safe(scenesJs));

const outPath = join(root, 'src/engine/physicsHtml.ts');
const ts = '/* 自动生成：由 scripts/build-phys.mjs 打包 engine/phys/* 而来。请勿手改。 */\n' +
  'export const PHYSICS_HTML: string = ' + JSON.stringify(html) + ';\n';

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, ts, 'utf8');

console.log('physicsHtml.ts written:', (ts.length / 1024).toFixed(0) + ' KB');
