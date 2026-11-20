// three は npm から app/vendor にコピーしたものを使う（tools/build.mjs が shell.js に同梱する）。
// 使うものだけを名前で取り出す（束ねるときに使わない部分を落として、iPad での読み込み・解析を軽くする）。
// hero には同じ名前の入った THREE（下の名前空間）を渡す。hero で新しいクラスを使うときはここに足す。
import {
  Vector2, Vector3, Matrix3, Matrix4, Quaternion, Euler, Color, Ray, MathUtils,
  Group, Mesh, InstancedMesh, Points, Scene, PerspectiveCamera, Raycaster, Fog,
  HemisphereLight, DirectionalLight, WebGLRenderer, PMREMGenerator,
  BufferGeometry, BufferAttribute, Float32BufferAttribute,
  BoxGeometry, CircleGeometry, ConeGeometry, CylinderGeometry, IcosahedronGeometry, LatheGeometry, PlaneGeometry, SphereGeometry, TorusGeometry,
  MeshStandardMaterial, MeshLambertMaterial, MeshBasicMaterial, ShaderMaterial, PointsMaterial,
  Texture, CanvasTexture, DataTexture,
  DynamicDrawUsage, AdditiveBlending, DoubleSide, BackSide, SRGBColorSpace, LinearFilter, RGBAFormat,
  RepeatWrapping, ClampToEdgeWrapping, MirroredRepeatWrapping, NeutralToneMapping, EquirectangularReflectionMapping,
} from '../../vendor/three.module.js';

export const THREE = Object.freeze({
  Vector2, Vector3, Matrix3, Matrix4, Quaternion, Euler, Color, Ray, MathUtils,
  Group, Mesh, InstancedMesh, Points, Scene, PerspectiveCamera, Raycaster, Fog,
  HemisphereLight, DirectionalLight, WebGLRenderer, PMREMGenerator,
  BufferGeometry, BufferAttribute, Float32BufferAttribute,
  BoxGeometry, CircleGeometry, ConeGeometry, CylinderGeometry, IcosahedronGeometry, LatheGeometry, PlaneGeometry, SphereGeometry, TorusGeometry,
  MeshStandardMaterial, MeshLambertMaterial, MeshBasicMaterial, ShaderMaterial, PointsMaterial,
  Texture, CanvasTexture, DataTexture,
  DynamicDrawUsage, AdditiveBlending, DoubleSide, BackSide, SRGBColorSpace, LinearFilter, RGBAFormat,
  RepeatWrapping, ClampToEdgeWrapping, MirroredRepeatWrapping, NeutralToneMapping, EquirectangularReflectionMapping,
});
