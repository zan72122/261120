// 1ファイル index.html を組み立てる（開発時のみ使用。実行時ビルドは不要）
//   node tools/build.mjs                       -> games/261120-1/index.html（全モジュール）
//   node tools/build.mjs --out X.html --mods common,shirt --extra tools/rig.js --extra my.js
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ORDER = ['common', 'core', 'env', 'shirt', 'iron', 'papa', 'audio', 'flow'];
const args = process.argv.slice(2);
let out = path.join(root, 'index.html');
let mods = null;
const extras = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--out') out = path.resolve(args[++i]);
  else if (args[i] === '--mods') mods = args[++i].split(',').map(s => s.trim()).filter(Boolean);
  else if (args[i] === '--extra') extras.push(path.resolve(args[++i]));
}
const list = (mods || ORDER).filter(m => fs.existsSync(path.join(root, 'src', m + '.js')));
const esc = s => s.replace(/<\/script/gi, '<\\/script').replace(/<!--/g, '<\\!--');
const tag = (name, code) => `<script>/* ${name} */\n${esc(code)}\n</script>`;

const parts = [];
parts.push(tag('three.js r160 (MIT)', fs.readFileSync(path.join(root, 'vendor/three.min.js'), 'utf8')));
const fb = path.join(root, 'src/fallback.jpg');
if (fs.existsSync(fb)) {
  parts.push(tag('fallback', `window.G=window.G||{};G.FALLBACK_IMG="data:image/jpeg;base64,${fs.readFileSync(fb).toString('base64')}";`));
}
for (const m of list) parts.push(tag(m, fs.readFileSync(path.join(root, 'src', m + '.js'), 'utf8')));
for (const e of extras) parts.push(tag(path.basename(e), fs.readFileSync(e, 'utf8')));

const tpl = fs.readFileSync(path.join(root, 'src/template.html'), 'utf8');
const html = tpl.replace('<!--__SCRIPTS__-->', () => parts.join('\n'));
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, html);
console.log(`built ${out}  (${(html.length / 1024).toFixed(0)} KB)  mods: ${list.join(',')}${extras.length ? '  +extras ' + extras.length : ''}`);
