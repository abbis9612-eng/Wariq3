import { Engine, Scene, ArcRotateCamera, Vector3, HemisphericLight, DirectionalLight, Color4, Color3, SceneLoader } from '@babylonjs/core';
import '@babylonjs/loaders/glTF'; import * as BJS from '@babylonjs/core'; (window as any).BABYLON = BJS;
const m = new URLSearchParams(location.search).get('m')!;
const engine = new Engine(document.getElementById('c') as HTMLCanvasElement, true, { preserveDrawingBuffer: true });
const scene = new Scene(engine); (window as any).BABYLON_SCENE = scene; scene.clearColor = new Color4(0.6, 0.66, 0.7, 1);
const cam = new ArcRotateCamera('c', -Math.PI / 3, Math.PI / 2.6, 10, Vector3.Zero(), scene);
new HemisphericLight('h', new Vector3(0, 1, 0), scene).intensity = 0.8;
const d = new DirectionalLight('d', new Vector3(-1, -2, -1), scene); d.intensity = 2; d.diffuse = new Color3(1, .95, .85);
SceneLoader.ImportMeshAsync('', '/tools/cand/', m + '.glb', scene).then(r => {
  const { min, max } = r.meshes[0].getHierarchyBoundingVectors(true);
  const size = max.subtract(min); cam.setTarget(min.add(size.scale(.5))); cam.radius = size.length() * 0.9;
  (window as any).info = { size: [size.x, size.y, size.z].map(v => +v.toFixed(2)), meshes: r.meshes.length,
    mats: scene.materials.map(x => x.name), tex: scene.textures.map(t => t.name + ':' + t.getSize().width) };
  scene.executeWhenReady(() => { engine.runRenderLoop(() => scene.render()); setTimeout(() => (window as any).done = true, 800); });
});
