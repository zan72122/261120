// Dev-time build: bundles src/main.js (+ three.js) into ONE self-contained index.html.
// The shipped index.html needs no build step, no network, works on file:// and in a Pages subfolder.
//   node build.mjs                       -> index.html
//   node build.mjs --entry X.js --out Y.html   (preview pages for development)
import { build } from 'esbuild';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const arg = (name, def) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : def;
};
const entry = resolve(arg('--entry', resolve(here, 'src/main.js')));
const out = resolve(arg('--out', resolve(here, 'index.html')));
const minify = !args.includes('--no-minify');

const result = await build({
  entryPoints: [entry],
  bundle: true,
  format: 'iife',
  minify,
  target: ['es2019', 'safari14'],
  write: false,
  nodePaths: [resolve(here, 'node_modules')],
  legalComments: 'none',
  logLevel: 'warning',
});
let js = result.outputFiles[0].text;
js = js.replace(/<\/script/gi, '<\\/script');

let html = readFileSync(resolve(here, 'template.html'), 'utf8');
const fallbackPath = resolve(here, 'assets/fallback.jpg');
const fallback = existsSync(fallbackPath)
  ? 'data:image/jpeg;base64,' + readFileSync(fallbackPath).toString('base64')
  : 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
html = html.replace('__FALLBACK_IMAGE__', () => fallback);
html = html.replace('/*__BUNDLE__*/', () => js);
writeFileSync(out, html);
console.log(`built ${out}  (${(html.length / 1024).toFixed(0)} KB)`);
