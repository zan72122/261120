// three は app/vendor/three.min.js が global THREE として先に読み込まれている（file:// でも動くよう ES module にしない）。
const THREE = globalThis.THREE;
if (!THREE) throw new Error('THREE が読み込まれていません（vendor/three.min.js）');
export default THREE;
