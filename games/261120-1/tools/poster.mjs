// 開発用: 待ち画面の写真（最初の場面、かごは空）を実際の描画から作る
//   node tools/build.mjs && node tools/poster.mjs && node tools/build.mjs
//   -> poster-p.jpg（縦長スマホ）, poster-t.jpg（縦のタブレット）, poster-l.jpg（横長）
//   シャツは色が周ごとに変わるので写さない（かごが空の絵から、本物のシャツがふわっと現れる）
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
let pw;
try { pw = require('playwright'); } catch (e) { pw = require('/opt/node-tools/node_modules/playwright'); }
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const url = 'file://' + path.join(root, 'index.html');
const SHOTS = [
  { out: 'poster-p.jpg', w: 390, h: 844, scale: 1.5, q: 62 },
  { out: 'poster-t.jpg', w: 768, h: 1024, scale: 1, q: 62 },
  { out: 'poster-l.jpg', w: 844, h: 390, scale: 1.5, q: 62 },
];
const browser = await pw.chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
for (const s of SHOTS) {
  const page = await browser.newPage({ viewport: { width: s.w, height: s.h }, deviceScaleFactor: s.scale });
  page.on('pageerror', e => console.log('[pageerror]', e.message));
  await page.goto(url);
  await page.waitForFunction(() => window.G && G.app && !document.getElementById('splash'), null, { timeout: 180000 });
  await page.evaluate(() => { G.app.scene.getObjectByName('shirt').traverse(o => o.layers.set(5)); }); // 描画からだけ外す
  await page.waitForTimeout(2500);
  await page.screenshot({ path: path.join(root, s.out), type: 'jpeg', quality: s.q });
  await page.close();
  console.log('saved', s.out);
}
await browser.close();
