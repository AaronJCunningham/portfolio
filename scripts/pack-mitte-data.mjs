// Triangulate the supplied CityGML surfaces without inventing facade geometry.
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {ShapeUtils, Vector2} from 'three';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const street = process.argv.includes('--auguststrasse');
const raw = JSON.parse(await fs.readFile(path.join(root, `.cache/berlin-mitte/surfaces${street ? '-auguststrasse' : ''}.json`), 'utf8'));
const out = path.join(root, 'public/experiments/berlin/mitte/data', street ? 'auguststrasse' : '');
const buckets = new Map();
let polygonCount = 0, maxAreaError = 0;
const parentBase = new Map();
for (const b of raw.buildings) parentBase.set(b.parent, Math.min(parentBase.get(b.parent) ?? Infinity, b.bounds[1]));
raw.foundations = [];

function polygon(rings) {
  const normal = [0, 0, 0], edge = rings[0];
  for (let i = 0; i < edge.length; i++) {
    const a = edge[i], b = edge[(i + 1) % edge.length];
    normal[0] += (a[1] - b[1]) * (a[2] + b[2]);
    normal[1] += (a[2] - b[2]) * (a[0] + b[0]);
    normal[2] += (a[0] - b[0]) * (a[1] + b[1]);
  }
  const axis = normal.map(Math.abs).indexOf(Math.max(...normal.map(Math.abs)));
  const dimensions = [0, 1, 2].filter(a => a !== axis);
  const projected = rings.map(r => r.map(p => new Vector2(p[dimensions[0]], p[dimensions[1]])));
  const triangles = ShapeUtils.triangulateShape(projected[0], projected.slice(1));
  const flat = rings.flat(), flat2 = projected.flat();
  const expected = Math.abs(ShapeUtils.area(projected[0])) - projected.slice(1).reduce((s, r) => s + Math.abs(ShapeUtils.area(r)), 0);
  const actual = triangles.reduce((sum, t) => sum + Math.abs(ShapeUtils.area(t.map(i => flat2[i]))), 0);
  const error = Math.abs(expected - actual);
  maxAreaError = Math.max(maxAreaError, error);
  if (error > Math.max(0.05, expected * 0.001)) throw new Error(`Triangulation lost ${error.toFixed(3)}m² of a ${expected.toFixed(3)}m² surface`);
  polygonCount++;
  return triangles.flatMap(indices => {
    const p = indices.map(i => flat[i]);
    const a = p[1].map((v, i) => v - p[0][i]), b = p[2].map((v, i) => v - p[0][i]);
    const cross = [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
    if (cross.reduce((s, v, i) => s + v * normal[i], 0) < 0) [p[1], p[2]] = [p[2], p[1]];
    return p.flat();
  });
}

for (let i = 0; i < raw.buildings.length; i++) {
  const b = raw.buildings[i];
  for (const s of b.surfaces) {
    if (s.kind === 'GroundSurface' && Math.min(...s.rings[0].map(p => p[1])) < parentBase.get(b.parent) + 1.5) {
      raw.foundations.push({building: i, rings: s.rings});
    }
    const material = s.kind === 'RoofSurface' ? 'roof' : s.kind === 'GroundSurface' ? 'base' : 'wall';
    const key = `${Math.floor(b.bounds[0]/250)},${Math.floor(b.bounds[2]/250)},${material}`;
    if (!buckets.has(key)) buckets.set(key, {material, positions: [], ranges: []});
    const bucket = buckets.get(key), start = bucket.positions.length / 3;
    let vertices;
    try { vertices = polygon(s.rings); }
    catch (error) { throw new Error(`${b.id} ${s.kind}: ${error.message}; rings=${JSON.stringify(s.rings)}`); }
    // Avoid spreading very large arrays into a function call.
    for (const v of vertices) bucket.positions.push(v);
    const last = bucket.ranges.at(-1);
    if (last?.building === i) last.count += vertices.length / 3;
    else bucket.ranges.push({building: i, start, count: vertices.length / 3});
  }
  delete b.surfaces;
}
let offset = 0;
const chunks = [], buffers = [];
for (const {material, positions, ranges} of buckets.values()) {
  const array = new Float32Array(positions);
  buffers.push(Buffer.from(array.buffer));
  chunks.push({material, offset, count: positions.length / 3, ranges});
  offset += array.byteLength;
}
const binary = Buffer.concat(buffers);
raw.manifest.geometrySha256 = createHash('sha256').update(binary).digest('hex');
raw.manifest.geometryBytes = binary.byteLength;
raw.manifest.triangles = binary.byteLength / 36;
raw.manifest.validation = {polygonCount, maxProjectedAreaErrorM2: maxAreaError, courtyardHolesPreserved: true};
raw.manifest.groundConnection = 'Additional foundation skirts join source ground outlines to interpolated terrain. Surveyed vertices remain unchanged; skirts are a rendering adaptation.';
const manifest = raw.manifest;
delete raw.manifest;
raw.chunks = chunks;
await fs.mkdir(out, {recursive: true});
await fs.writeFile(path.join(out, 'buildings.bin.gz'), gzipSync(binary, {level: 9}));
await fs.writeFile(path.join(out, 'context.json.gz'), gzipSync(JSON.stringify(raw), {level: 9}));
await fs.writeFile(path.join(out, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(JSON.stringify({buildings: manifest.buildings, parts: raw.buildings.length, triangles: manifest.triangles, chunks: chunks.length, compressedGeometryMB: gzipSync(binary).byteLength / 1e6, maxAreaError}));
