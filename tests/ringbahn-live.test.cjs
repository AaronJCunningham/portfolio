const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { gunzipSync } = require('node:zlib');
const { createHash } = require('node:crypto');
const root = path.join(__dirname, '../public/experiments/berlin');
const data = JSON.parse(gunzipSync(fs.readFileSync(path.join(root, 'data/berlin.json.gz'))));
const update = data.meta.ringbahnBuildingUpdate;
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');

test('Ringbahn update preserves approved Mitte, outside buildings, landmarks, and every other map layer', () => {
  assert.ok(update);
  assert.equal(hash(data.buildings.filter(b => b.accuracyArea === 'mitte')), update.preservedMitteSha256);
  assert.equal(hash(data.buildings.filter(b => !['mitte', 'ringbahn'].includes(b.accuracyArea))), update.preservedOtherBuildingsSha256);
  for (const [key, digest] of Object.entries(update.preservedMapLayersSha256)) assert.equal(hash(data[key]), digest, key);
  for (const id of update.preservedLandmarkIds) assert.ok(data.buildings.some(b => b.id === id), id);
  assert.ok(data.buildings.find(b => b.id === 'w25649554'), 'Berghain keeps its existing source footprint');
});

test('all populated Ringbahn localities have official coverage and traceable source tiles', () => {
  assert.equal(update.simplificationMetres, 0.6);
  assert.equal(update.stats.processedExisting, update.stats.replacedExisting + update.stats.retainedUnmatched);
  const official = data.buildings.filter(b => b.accuracyArea === 'ringbahn' && b.geometrySource === 'Berlin LoD2');
  assert.equal(official.length, update.stats.officialVolumes);
  const retained = data.buildings.filter(b => b.accuracyArea === 'ringbahn' && b.geometrySource !== 'Berlin LoD2');
  assert.equal(retained.length, update.stats.retainedUnmatched);
  for (const area of data.meta.areas.filter(a => a.id !== 'mitte').map(a => a.id)) {
    assert.ok(update.localities[area]?.officialVolumes > 0, `missing official buildings in ${area}`);
  }
  assert.ok(update.sources.length > 90);
  for (const source of update.sources) {
    assert.match(source.url, /^https:\/\/gdi\.berlin\.de\/data\/a_lod2\/atom\/LoD2_\d+_\d+\.zip$/);
    assert.match(source.sha256, /^[a-f0-9]{64}$/);
  }
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(root, 'data/ringbahn-buildings.json'))), update);
});

test('expanded buildings remain simple grounded extrusions with valid heights, floors, and unique IDs', () => {
  assert.equal(new Set(data.buildings.map(b => b.id)).size, data.buildings.length);
  for (const b of data.buildings.filter(b => b.accuracyArea === 'ringbahn' && b.geometrySource === 'Berlin LoD2')) {
    assert.ok(b.sourceParent && b.sourceBuildingIds.length);
    assert.equal(b.minHeight || 0, 0);
    assert.equal(b.roofShape, 'flat'); assert.equal(b.roofHeight, 0);
    assert.ok(Number.isFinite(b.h) && b.h >= 1 && b.h < 400);
    assert.ok(Number.isInteger(b.facadeLevels) && b.facadeLevels > 0);
    for (const ring of [b.ring, ...b.holes]) {
      assert.ok(ring.length >= 6 && ring.length % 2 === 0);
      assert.ok(ring.every(Number.isFinite));
    }
  }
});

test('geometry count and export metadata describe the completed scene', () => {
  for (const file of ['js/nyc-geodata.js', 'js/berlin-geodata.js']) {
    assert.ok(fs.statSync(path.join(root, file)).size < 100 * 1024 * 1024, `${file} must remain pushable as a regular Git file`);
  }
  const edges = data.buildings.reduce((sum, b) => sum + (b.ring.length + b.holes.reduce((n, h) => n + h.length, 0)) / 2, 0);
  assert.equal(edges, update.stats.newFacadeEdges);
  assert.ok(edges <= update.stats.oldFacadeEdges * 1.2, 'Keep the full expansion within 20% of the previous wall-instance budget');
  assert.equal(data.buildings.length, data.meta.counts.buildings);
  assert.equal(data.buildings.filter(b => b.holes.length).length, data.meta.counts.buildingCourtyards);
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'export-manifest.json')));
  assert.deepEqual(manifest.ringbahnBuildings.stats, update.stats);
});
