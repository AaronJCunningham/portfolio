const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const ts = require('typescript');
const root = path.join(__dirname, '../public/experiments/berlin');
function load(file, imports = {}) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(path.join(root, 'js', file), 'utf8'),
    { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function('exports', 'require', code)(exports, name => imports[name]);
  return exports;
}
const { buildingsWithPassages, isSurfaceRoad, connectBuildingPassage } = load('building-passages.js', {
  './building-passage-data.js': load('building-passage-data.js') });
const data = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(root, 'data/berlin.json.gz'))));
const source = data.buildings.filter(s => ['lod2:DEBE3Df39BZhuunM:0', 'lod2:DEBE00YY1IW0004t:0'].includes(s.id));
const parts = [...buildingsWithPassages(source)];
const area = ring => Math.abs(ring.reduce((sum, _, i) => i % 2 ? sum :
  sum + ring[i] * ring[(i + 3) % ring.length] - ring[(i + 2) % ring.length] * ring[i + 1], 0) / 2);
function inside(ring, x, z) {
  let result = false;
  for (let i = 0, j = ring.length - 2; i < ring.length; j = i, i += 2) {
    const ax = ring[i], az = ring[i + 1], bx = ring[j], bz = ring[j + 1];
    if ((az > z) !== (bz > z) && x < (bx - ax) * (z - az) / (bz - az) + ax) result = !result;
  }
  return result;
}
test('the NKZ road and both driving lanes remain clear beneath the overhead building', () => {
  const road = data.roads.find(r => r.id === 'w65425836');
  assert.equal(road.tunnel, true);
  assert.equal(isSurfaceRoad(road), true);
  const [ax, az] = road.pts, [bx, bz] = road.pts.slice(-2);
  const len = Math.hypot(bx - ax, bz - az), nx = -(bz - az) / len, nz = (bx - ax) / len;
  let overhead = 0;
  for (let t = -0.2; t < 1.3; t += 0.05) for (const offset of [-4.5, -1.7, 0, 1.7, 4.5]) {
    const x = ax + (bx - ax) * t + nx * offset, z = az + (bz - az) * t + nz * offset;
    const covering = parts.filter(p => inside(p.ring, x, z));
    assert.ok(covering.every(p => p.minHeight >= 4.25), `Blocked passage at ${x},${z}`);
    overhead += covering.length;
  }
  assert.ok(overhead > 50, 'Keep the building spanning the road');
});
test('the repair preserves building area, height, style and all unrelated buildings', () => {
  for (const original of source) {
    const split = parts.filter(p => p.id.startsWith(original.id + ':passage:'));
    assert.equal(split.length, 3);
    assert.ok(Math.abs(split.reduce((n, p) => n + area(p.ring), 0) - area(original.ring)) < 0.02);
    for (const p of split) {
      assert.equal(p.h, original.h);
      assert.equal(p.styleSeed, original.styleSeed);
    }
  }
  const other = data.buildings.find(s => !source.includes(s));
  assert.equal([...buildingsWithPassages([other])][0], other);
  assert.equal(isSurfaceRoad({ id: 'another-tunnel', tunnel: true }), false);
});

test('map routing and traffic receive the same two-way link without mutating the source graph', () => {
  const road = data.roads.find(r => r.id === 'w65425836');
  const graph = { nodes: [...road.pts.slice(0, 2), ...road.pts.slice(-2)], names: [road.name], links: [] };
  const connected = connectBuildingPassage(graph, data.roads);
  assert.deepEqual(connected.links, [[0, 1, 0, 6.9, 2, 0, road.pts.slice(2, -2)]]);
  assert.equal(graph.links.length, 0);
  assert.equal(connectBuildingPassage(connected, data.roads), connected);
});
