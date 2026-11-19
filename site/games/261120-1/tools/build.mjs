// index.html と本体の JS を組み立てる（開発時のみ使用。実行時ビルドは不要）
//   node tools/build.mjs
//     -> index.html（小さい。待ち画面の写真を出してから下の JS を読む）
//        game.js（最初の場面に要る部品）、late.js（遊んでいる間に裏で読む部品: パパ）
//        three.js は vendor/three.min.js をそのまま読む
//   node tools/build.mjs --out X.html --mods common,shirt --extra tools/rig.js --extra my.js
//     -> 全部を 1 ファイルに埋め込んだ X.html（開発・確認用。パパも最初から入る）
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ORDER = ['common', 'core', 'env', 'shirt', 'iron', 'acorn', 'papa', 'audio', 'flow'];
const LATE = { papa: 'late.js' };          // 部品名 -> 後から読むファイル
const POSTERS = [                          // 待ち画面の写真（tools/poster.mjs で作る）。a = 幅/高さ
  { src: 'poster-p.jpg', a: 390 / 844 },
  { src: 'poster-t.jpg', a: 3 / 4 },
  { src: 'poster-l.jpg', a: 844 / 390 },
];
const args = process.argv.slice(2);
let out = null;
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
const src = m => fs.readFileSync(path.join(root, 'src', m + '.js'), 'utf8');
const tpl = fs.readFileSync(path.join(root, 'src/template.html'), 'utf8');
const fb = path.join(root, 'src/fallback.jpg');
const kb = n => (n / 1024).toFixed(0) + ' KB';
const fill = (head, boot, scripts) => tpl
  .replace('<!--__HEAD__-->', () => head)
  .replace('/*__BOOT__*/{}', () => JSON.stringify(boot))
  .replace('<!--__SCRIPTS__-->', () => scripts);

if (out) {
  // 1 ファイル版（開発用）
  const parts = [tag('three.js r160 (MIT)', fs.readFileSync(path.join(root, 'vendor/three.min.js'), 'utf8'))];
  const boot = {};
  if (fs.existsSync(fb)) boot.fallback = `data:image/jpeg;base64,${fs.readFileSync(fb).toString('base64')}`;
  for (const m of list) parts.push(tag(m, src(m)));
  for (const e of extras) parts.push(tag(path.basename(e), fs.readFileSync(e, 'utf8')));
  const html = fill('', boot, parts.join('\n'));
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, html);
  console.log(`built ${out}  (${kb(html.length)})  mods: ${list.join(',')}${extras.length ? '  +extras ' + extras.length : ''}`);
} else {
  // 公開版: 小さい index.html + game.js + late.js
  const bundle = (names, extra = []) => names.map(m => `/* ${m}.js */\n${src(m)}`)
    .concat(extra.map(e => `/* ${path.basename(e)} */\n${fs.readFileSync(e, 'utf8')}`)).join('\n');
  const early = list.filter(m => !LATE[m]);
  const late = list.filter(m => LATE[m]);
  const game = bundle(early, extras);
  fs.writeFileSync(path.join(root, 'game.js'), game);
  const files = {};
  for (const m of late) (files[LATE[m]] = files[LATE[m]] || []).push(m);
  for (const f of Object.keys(files)) fs.writeFileSync(path.join(root, f), bundle(files[f]));
  const lateMap = {};
  for (const m of late) lateMap[m] = LATE[m];
  const ver = Date.now().toString(36); // 古いキャッシュを使い続けないように
  const scripts = ['vendor/three.min.js', 'game.js?v=' + ver];
  for (const m of Object.keys(lateMap)) lateMap[m] += '?v=' + ver;
  const posters = POSTERS.filter(p => fs.existsSync(path.join(root, p.src)));
  const boot = { scripts, late: lateMap, posters, fallback: fs.existsSync(fb) ? 'src/fallback.jpg' : undefined };
  const head = scripts.map(s => `<link rel="preload" as="script" href="${s}">`).join('\n');
  const html = fill(head, boot, '');
  fs.writeFileSync(path.join(root, 'index.html'), html);
  console.log(`built index.html (${kb(html.length)}) game.js (${kb(game.length)}) ${Object.keys(files).map(f => f).join(' ')}  posters: ${posters.length}`);
}
