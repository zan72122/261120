// texworker.js — Worker 側の入口。金魚のテクスチャの画素を裏で計算してメインへ返す（build.mjs が文字列として埋め込む）。
// 受信: { jobs: [{ id, type: 'body'|'fin'|'eye', kind, seed }] }  → jobs の順に計算し、1 つできるたびに送り返す。
// 送信: { id, rgba, bump? }（ArrayBuffer は transfer）
import { bodyPixels, finPixels, eyePixels } from './fishtex.js';

self.postMessage({ ready: true }); // 起動できた合図（メインはこれを少しだけ待ってから重い処理に入る）

self.onmessage = (e) => {
  const jobs = (e.data && e.data.jobs) || [];
  for (const j of jobs) {
    try {
      if (j.type === 'body') {
        const p = bodyPixels(j.kind, j.seed);
        self.postMessage({ id: j.id, rgba: p.rgba, bump: p.bump }, [p.rgba.buffer, p.bump.buffer]);
      } else if (j.type === 'fin') {
        const rgba = finPixels(j.kind, j.seed);
        self.postMessage({ id: j.id, rgba }, [rgba.buffer]);
      } else {
        const rgba = eyePixels();
        self.postMessage({ id: j.id, rgba }, [rgba.buffer]);
      }
    } catch (err) {
      self.postMessage({ id: j.id, error: String(err) });
    }
  }
};
