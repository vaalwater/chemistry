import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');
const safe = (s) => s.replace(/<\/script>/gi, '<\\/script>');

const template = read('engine/acid/index.template.html');
const css = read('engine/style.css');
const three = read('engine/vendor/three.min.js');
const acidJs = read('engine/acid/acid.js');

const html = template
  .replace('@@CSS@@', () => css)
  .replace('@@THREE@@', () => safe(three))
  .replace('@@ACID@@', () => safe(acidJs));

const outPath = join(root, 'src/engine/acidHtml.ts');
const ts =
  '/* 自动生成：由 scripts/build-acid.mjs 打包 engine/acid/* 而来。请勿手改。 */\n' +
  'export const ACID_HTML: string = ' + JSON.stringify(html) + ';\n';

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, ts, 'utf8');

console.log('acidHtml.ts written:', (ts.length / 1024).toFixed(0) + ' KB');
