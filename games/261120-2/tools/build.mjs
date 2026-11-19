// ビルド: src/texworker.js を文字列に、src/main.js を esbuild で 1 つの IIFE にまとめ、src/index.template.html に埋め込んで index.html を出力する。
// 実行: (games/261120-2 で) node tools/build.mjs
// パスはこのスクリプトの位置 (tools/..) を基準に解決するので、cwd に依存しない。
import { build } from 'esbuild';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ENTRY = join(ROOT, 'src', 'main.js');
const WORKER = join(ROOT, 'src', 'texworker.js');
const TEMPLATE = join(ROOT, 'src', 'index.template.html');
const FALLBACK = join(ROOT, 'src', 'assets', 'fallback.jpg');
const OUT = join(ROOT, 'index.html');

// 1x1 の淡い水色 (#cfe8ea) PNG
const PALE_AQUA_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGM4/+IVAAUrAqL8iXSqAAAAAElFTkSuQmCC';

function fail(msg) {
  console.error('[build] ' + msg);
  process.exit(1);
}

if (!existsSync(ENTRY)) fail('src/main.js がまだありません。エントリポイントを用意してから実行してください。');
if (!existsSync(TEMPLATE)) fail('src/index.template.html が見つかりません。');

// 金魚テクスチャの Worker は別にまとめて文字列として本体へ埋め込む（Blob URL で起動。file:// でも動く）
let workerSrc = '';
try {
  const w = await build({
    entryPoints: [WORKER], bundle: true, format: 'iife', minify: true, target: ['es2019'], platform: 'browser',
    charset: 'utf8', legalComments: 'none', write: false, logLevel: 'warning',
  });
  workerSrc = w.outputFiles[0].text;
} catch (e) {
  fail('Worker のビルドに失敗しました: ' + (e && e.message ? e.message : e));
}

let result;
try {
  result = await build({
    entryPoints: [ENTRY],
    bundle: true,
    format: 'iife',
    minify: true,
    target: ['es2019'],
    platform: 'browser',
    charset: 'utf8',
    legalComments: 'none',
    loader: { '.jpg': 'dataurl', '.png': 'dataurl' },
    define: { 'process.env.NODE_ENV': '"production"', __TEXWORKER_SRC__: JSON.stringify(workerSrc) },
    write: false,
    logLevel: 'warning',
  });
} catch (e) {
  fail('esbuild に失敗しました: ' + (e && e.message ? e.message : e));
}

let js = result.outputFiles[0].text;
// HTML の <script> 内に安全に置けるようにエスケープ（JS としての意味は変わらない）
js = js.replace(/<\/(script)/gi, '<\\/$1').replace(/<!--/g, '<\\!--');

const fallbackUri = existsSync(FALLBACK)
  ? 'data:image/jpeg;base64,' + readFileSync(FALLBACK).toString('base64')
  : PALE_AQUA_PNG;

let html = readFileSync(TEMPLATE, 'utf8');
if (!html.includes('<!--APP_JS-->')) fail('テンプレートに <!--APP_JS--> がありません。');
// 置換文字列の $ パターンを避けるため関数で渡す
html = html.split('<!--FALLBACK_IMG-->').join(fallbackUri);
html = html.replace('<!--APP_JS-->', () => '<script>' + js + '</script>');

writeFileSync(OUT, html);
console.log('[build] index.html ' + (Buffer.byteLength(html) / 1024).toFixed(1) + ' KB');
