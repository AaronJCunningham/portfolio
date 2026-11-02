const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { gzipSync, gunzipSync } = require('node:zlib');
const { createHash } = require('node:crypto');
const { loadModule } = require('./upstream/module.cjs');
const root = path.join(__dirname, '../public/experiments/berlin');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('city loader accepts gzip and host-decoded JSON, and rejects broken responses', async () => {
  const { loadCompressedJson } = await import(pathToFileURL(path.join(root, 'js/compressed-data.js')));
  const originalFetch = global.fetch;
  const data = { point: [13.404954321, 52.520001234], metadata: { license: 'ODbL-1.0' } };
  try {
    for (const body of [JSON.stringify(data), gzipSync(JSON.stringify(data))]) {
      global.fetch = async () => new Response(body);
      assert.deepEqual(await loadCompressedJson('test'), data);
    }
    for (const body of ['', 'null', '[]', '<html>Error</html>', Buffer.from([0x1f, 0x8b, 0])]) {
      global.fetch = async () => new Response(body);
      await assert.rejects(loadCompressedJson('test'));
    }
    global.fetch = async () => new Response('Missing', { status: 404 });
    await assert.rejects(loadCompressedJson('test'), /404/);
  } finally { global.fetch = originalFetch; }
});

test('compressed geography retains the approved grid bytes and city database', () => {
  const manifest = JSON.parse(read('export-manifest.json'));
  for (const [file, expected] of [
    [manifest.runtimeData.gridFile, manifest.runtimeData.gridSha256],
    [manifest.runtimeData.cityFile, manifest.dataSha256],
  ]) {
    const bytes = gunzipSync(fs.readFileSync(path.join(root, file)));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), expected);
  }
});

test('vehicle gamepad steering ignores vertical tilt and throttle stays on triggers', () => {
  const pad = { connected: true, mapping: 'standard', index: 0, id: 'test', axes: [0.7, 0, 0, 0], buttons: [] };
  const inputs = {};
  const { GamepadControls } = loadModule(read('js/gamepad-controls.js'), {
    imports: { './city-config.js': { isTypingInField: () => false } },
    globals: {
      window: { addEventListener() {} },
      document: { hasFocus: () => true, addEventListener() {} },
      navigator: { getGamepads: () => [pad] },
    },
  });
  const controller = { activeMode: 'car', clearGamepadInput() {}, setGamepadInput: (key, value) => { inputs[key] = value; } };
  const gamepad = new GamepadControls(controller, { applyGamepadInput() {} });
  gamepad.update(1 / 60);
  const steer = inputs.right;
  for (const mode of ['car', 'cyclist']) {
    controller.activeMode = mode;
    pad.axes[1] = -1;
    gamepad.update(1 / 60);
    assert.equal(inputs.forward, 0);
    assert.equal(inputs.right, steer);
    pad.buttons[7] = { value: 0.8 };
    gamepad.update(1 / 60);
    assert.equal(inputs.forward, 0.8);
    pad.buttons[7] = { value: 0 };
    pad.buttons[6] = { value: 0.6 };
    gamepad.update(1 / 60);
    assert.equal(inputs.backward, 0.6);
    pad.buttons[6] = { value: 0 };
  }
  controller.activeMode = 'person';
  gamepad.update(1 / 60);
  assert.ok(inputs.forward > 0, 'walking retains both stick axes');
});

test('opted-in lamp shadow proxies use reduced geometry on shadow cameras only', async () => {
  const THREE = await import(pathToFileURL(path.join(root, 'vendor/three/build/three.webgpu.js')));
  const { setupSceneCulling, SHADOW_PROXY_LAYER } = loadModule(read('js/scene-culling.js'), {
    imports: { 'three/webgpu': THREE, './city-range.js': { cityCellVisible: () => true } },
  });
  const scene = new THREE.Scene();
  const lamp = new THREE.InstancedMesh(new THREE.CylinderGeometry(1, 1, 8, 20), new THREE.MeshStandardNodeMaterial(), 1);
  lamp.setMatrixAt(0, new THREE.Matrix4().makeTranslation(10, 4, 20));
  lamp.castShadow = true;
  lamp.userData.shadowStandIn = new THREE.CylinderGeometry(1, 1, 8, 4, 1, true);
  scene.add(lamp);
  const camera = new THREE.PerspectiveCamera();
  setupSceneCulling(scene, [lamp], { getViewportCount: () => 1, getCamera: () => camera });
  const proxies = scene.children.filter(o => o.userData.shadowProxy);
  assert.equal(proxies.length, 1);
  assert.equal(lamp.castShadow, false);
  assert.equal(lamp.visible, true);
  assert.equal(proxies[0].geometry.index.count, lamp.userData.shadowStandIn.index.count);
  assert.ok(proxies[0].geometry.index.count < lamp.geometry.index.count);
  assert.equal(proxies[0].layers.mask, 1 << SHADOW_PROXY_LAYER);
  assert.ok(camera.layers.test(proxies[0].layers));
  assert.equal(new THREE.PerspectiveCamera().layers.test(proxies[0].layers), false);
});
