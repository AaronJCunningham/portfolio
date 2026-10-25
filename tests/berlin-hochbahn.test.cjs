const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const root = path.join(__dirname, '../public/experiments/berlin');
function load(file, imports = {}) {
  const exports = {};
  const source = fs.readFileSync(path.join(root, file), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function('exports', 'require', code)(exports, name => {
    assert.ok(name in imports, `Unexpected dependency ${name}`);
    return imports[name];
  });
  return exports;
}
const data = JSON.parse(fs.readFileSync(path.join(root, 'data/hochbahn.json')));
const layout = load('js/hochbahn-layout.js');
test('published Hochbahn data retains both running tracks and all eight elevated stations', () => {
  assert.deepEqual(load('js/hochbahn-data.js').HOCHBAHN, data);
  assert.deepEqual(data.stations.map(s => s.name), ['Warschauer Straße', 'Schlesisches Tor', 'Görlitzer Bahnhof',
    'Kottbusser Tor', 'Prinzenstraße', 'Hallesches Tor', 'Möckernbrücke', 'Gleisdreieck']);
  assert.equal(new Set(data.tracks.flatMap(t => t.wayIds)).size, 40);
  assert.equal(data.stations.flatMap(s => s.platforms).length, 13);
  assert.equal(data.stations.find(s => s.name === 'Kottbusser Tor').platforms[0].holes.length, 2);
  for (const track of data.tracks) {
    assert.ok(track.points[0][0] < -2600 && track.points.at(-1)[0] > 2900);
    for (const [x, z] of track.points) assert.ok(Number.isFinite(x) && Number.isFinite(z));
    const sampled = layout.resampleTrack(track.points);
    for (let i = 1; i < sampled.length; i++) {
      const a = sampled[i - 1], b = sampled[i];
      assert.ok(Math.hypot(b.x - a.x, b.z - a.z) <= 8.001);
      assert.ok(b.s > a.s);
    }
  }
});
test('vertical profile joins the Oberbaum landmark and rises from the western tunnel portal', () => {
  assert.equal(layout.railHeight(2752), 10.2);
  assert.equal(layout.railHeight(1000) < 7, true);
  assert.equal(layout.railHeight(-2132), 14.2);
  assert.equal(layout.railHeight(-2659), 0.3);
  const c = Math.cos(2.482), s = Math.sin(2.482);
  assert.ok(layout.onOberbaumDeck(2752.094 + c * -12.5 + s * 23, 2031.748 - s * -12.5 + c * 23));
  assert.equal(layout.onOberbaumDeck(2400, 2130), false);
  for (let x = -2700; x < 3100; x++) assert.ok(Math.abs(layout.railHeight(x + 1) - layout.railHeight(x)) < 0.06);
});
test('Hochbahn geometry stays batched, finite and driveable below the decks', async () => {
  const THREE = await import('../public/experiments/berlin/vendor/three/build/three.webgpu.js');
  const geometry = load('vendor/three/examples/jsm/utils/BufferGeometryUtils.js', { three: THREE });
  const canvas = { width: 0, height: 0, getContext: () => ({ fillRect() {}, fillText() {} }) };
  const previousDocument = global.document;
  global.document = { createElement: () => canvas };
  try {
    const imports = { 'three/webgpu': THREE, 'three/addons/utils/BufferGeometryUtils.js': geometry,
      './hochbahn-data.js': { HOCHBAHN: data }, './hochbahn-layout.js': layout,
      './berlin-geometry.js': { nearestBerlinRoad: () => null }, './city-config.js': { waterAt: () => false } };
    const { group, colliders } = load('js/hochbahn.js', imports).buildHochbahn(new THREE.Scene());
    assert.ok(group.children.length < 300, `Draw batches: ${group.children.length}`);
    assert.ok(group.userData.instances < 40000, `Instances: ${group.userData.instances}`);
    assert.ok(group.userData.supports > 150);
    assert.ok(colliders.length > 300);
    for (const collider of colliders) {
      assert.ok(collider.maxX - collider.minX <= 1.1 && collider.maxZ - collider.minZ <= 1.1);
    }
    for (const mesh of group.children) {
      assert.equal(mesh.userData.cityRange, 'buildings');
      assert.ok([...mesh.geometry.attributes.position.array].every(Number.isFinite));
      if (mesh.isInstancedMesh) assert.ok([...mesh.instanceMatrix.array].every(Number.isFinite));
    }
    // Crossing a road suppresses ground columns, never the overhead connection.
    imports['./berlin-geometry.js'].nearestBerlinRoad = () => ({ distance: 0, width: 8, pedestrian: false });
    const crossing = load('js/hochbahn.js', imports).buildHochbahn(new THREE.Scene());
    assert.equal(crossing.colliders.length, 0);
    assert.ok(crossing.group.userData.instances > 15000);
  } finally { global.document = previousDocument; }
});
