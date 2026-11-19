// 開発用: ページを開いてスクリーンショットを1枚とる
//   node tools/shot.mjs <html|url> <out.png> [w=390] [h=844] [waitMs=1500] ["js to eval before the shot"]
import { createRequire } from 'node:module';
import path from 'node:path';
const require = createRequire(import.meta.url);
let pw;
try { pw = require('playwright'); } catch (e) { pw = require('/opt/node-tools/node_modules/playwright'); }
const [, , target, outPng, w = '390', h = '844', wait = '1500', js = ''] = process.argv;
const url = /^(https?|file):/.test(target) ? target : 'file://' + path.resolve(target);
const browser = await pw.chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1 });
page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') console.log(`[${m.type()}]`, m.text()); });
page.on('pageerror', e => console.log('[pageerror]', e.message));
await page.goto(url);
await page.waitForTimeout(+wait);
if (js) { const r = await page.evaluate(js); if (r !== undefined) console.log('eval ->', JSON.stringify(r)); await page.waitForTimeout(400); }
await page.screenshot({ path: outPng });
await browser.close();
console.log('saved', outPng);
