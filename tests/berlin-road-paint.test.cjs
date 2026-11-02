const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const { loadModule } = require('./upstream/module.cjs');

// Minimal Three.js math/object stub sufficient for road-paint.js and scene-culling.js
class Vector3 {
  constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; }
  set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; }
  copy(v) { this.x = v.x; this.y = v.y; this.z = v.z; return this; }
  applyMatrix4(m) {
    const e = m.elements;
    const x = this.x, y = this.y, z = this.z;
    this.x = e[0] * x + e[4] * y + e[8] * z + e[12];
    this.y = e[1] * x + e[5] * y + e[9] * z + e[13];
    this.z = e[2] * x + e[6] * y + e[10] * z + e[14];
    return this;
  }
}

class Matrix4 {
  constructor() { this.elements = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]; }
  copy(m) { this.elements = m.elements.slice(); return this; }
  fromArray(a, o = 0) { this.elements = Array.from(a.slice(o, o + 16)); return this; }
  multiplyMatrices(a, b) {
    const ae = a.elements, be = b.elements, te = this.elements;
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        te[j * 4 + i] = ae[i] * be[j * 4] + ae[i + 4] * be[j * 4 + 1] + ae[i + 8] * be[j * 4 + 2] + ae[i + 12] * be[j * 4 + 3];
      }
    }
    return this;
  }
  getMaxScaleOnAxis() { return 1; }
}

class Sphere {
  constructor(center = new Vector3(), radius = 0) { this.center = center; this.radius = radius; }
  clone() { return new Sphere(new Vector3(this.center.x, this.center.y, this.center.z), this.radius); }
  applyMatrix4(m) {
    this.center.applyMatrix4(m);
    return this;
  }
}

class BufferAttribute {
  constructor(array, itemSize) {
    this.array = ArrayBuffer.isView(array) ? array : new Float32Array(array);
    this.itemSize = itemSize;
    this.count = this.array.length / itemSize;
  }
  getX(i) { return this.array[i * this.itemSize]; }
}
class Float32BufferAttribute extends BufferAttribute {
  constructor(array, itemSize) { super(new Float32Array(array), itemSize); }
}
class Uint16BufferAttribute extends BufferAttribute {
  constructor(array, itemSize) { super(new Uint16Array(array), itemSize); this.isUint16 = true; }
}
class Uint32BufferAttribute extends BufferAttribute {
  constructor(array, itemSize) { super(new Uint32Array(array), itemSize); this.isUint32 = true; }
}

class BufferGeometry {
  constructor() {
    this.attributes = {};
    this.index = null;
    this.boundingSphere = null;
    this.groups = [];
    this.drawRange = { start: 0, count: Infinity };
  }
  setAttribute(name, attr) { this.attributes[name] = attr; return this; }
  setIndex(idx) {
    this.index = idx instanceof BufferAttribute ? idx : new Uint32BufferAttribute(idx, 1);
    return this;
  }
  computeBoundingSphere() {
    const pos = this.attributes.position.array;
    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
    for (let i = 0; i < pos.length; i += 3) {
      minX = Math.min(minX, pos[i]); maxX = Math.max(maxX, pos[i]);
      minY = Math.min(minY, pos[i + 1]); maxY = Math.max(maxY, pos[i + 1]);
      minZ = Math.min(minZ, pos[i + 2]); maxZ = Math.max(maxZ, pos[i + 2]);
    }
    const cx = (minX + maxX) * 0.5, cy = (minY + maxY) * 0.5, cz = (minZ + maxZ) * 0.5;
    let r2 = 0;
    for (let i = 0; i < pos.length; i += 3) {
      const dx = pos[i] - cx, dy = pos[i + 1] - cy, dz = pos[i + 2] - cz;
      r2 = Math.max(r2, dx * dx + dy * dy + dz * dz);
    }
    this.boundingSphere = new Sphere(new Vector3(cx, cy, cz), Math.sqrt(r2));
  }
}

class Object3D {
  constructor() {
    this.name = '';
    this.children = [];
    this.parent = null;
    this.visible = true;
    this.frustumCulled = true;
    this.castShadow = false;
    this.receiveShadow = false;
    this.renderOrder = 0;
    this.layers = { mask: 1, set(l) { this.mask = 1 << l; }, enable(l) { this.mask |= 1 << l; } };
    this.userData = {};
    this.position = new Vector3();
    this.quaternion = { x: 0, y: 0, z: 0, w: 1, copy() {} };
    this.scale = new Vector3(1, 1, 1);
    this.matrixAutoUpdate = true;
    this.matrix = new Matrix4();
    this.matrixWorld = new Matrix4();
  }
  add(child) {
    child.parent = this;
    this.children.push(child);
    return this;
  }
  remove(child) {
    const i = this.children.indexOf(child);
    if (i >= 0) { this.children.splice(i, 1); child.parent = null; }
  }
  updateMatrixWorld() {
    this.matrixWorld.elements[12] = this.position.x;
    this.matrixWorld.elements[13] = this.position.y;
    this.matrixWorld.elements[14] = this.position.z;
    for (const c of this.children) c.updateMatrixWorld();
  }
  traverse(fn) {
    fn(this);
    for (const c of this.children) c.traverse(fn);
  }
}

class Group extends Object3D {
  constructor() { super(); this.isGroup = true; }
}
class Scene extends Object3D {}
class Mesh extends Object3D {
  constructor(geometry, material) {
    super();
    this.isMesh = true;
    this.geometry = geometry;
    this.material = material;
  }
}

const THREE = {
  Color: class { constructor(hex) { this.r = ((hex >> 16) & 255) / 255; this.g = ((hex >> 8) & 255) / 255; this.b = (hex & 255) / 255; } },
  Vector3,
  Matrix4,
  BufferAttribute,
  Float32BufferAttribute,
  Uint16BufferAttribute,
  Uint32BufferAttribute,
  BufferGeometry,
  Object3D,
  Group,
  Scene,
  Mesh
};

const sharedMat = { name: 'RoadPaintMat', transparent: true };
const roadPaintSrc = readFileSync(join(__dirname, '../public/experiments/berlin/js/road-paint.js'), 'utf8');
const sceneCullingSrc = readFileSync(join(__dirname, '../public/experiments/berlin/js/scene-culling.js'), 'utf8');

const { buildRoadPaint, createRoadPaintChunkBuilder } = loadModule(roadPaintSrc, {
  filename: 'road-paint.js',
  imports: {
    'three/webgpu': THREE,
    './road-network.js': { CROSSWALK: 3.8 },
    './tsl-materials.js': { createRoadPaintMaterial: () => sharedMat }
  }
});

const { setupSceneCulling, updateSceneCulling } = loadModule(sceneCullingSrc, {
  filename: 'scene-culling.js',
  imports: { 'three/webgpu': THREE, './city-range.js': { cityCellVisible: () => true } }
});

test('buildRoadPaint chunks markings into compact spatial cells with shared pipeline and padded bounds', () => {
  const makeEdge = (id0, id1, x0, z, len) => ({
    from: { id: id0, shape: false },
    to: { id: id1, shape: false },
    x0, z0: z, sx: x0, sz: z,
    dx: 1, dz: 0, rx: 0, rz: 1,
    len, span: len, half: 7.0,
    axis: 'ave',
    lanes: [-3.5, 0, 3.5]
  });

  const scene = new Scene();
  // Two streets 3.2 km apart in Z (wholly inside cellX = 0) -> must land in 2 separate 450 m spatial chunks
  const network = {
    edges: [
      makeEdge(1, 2, 100, -1600, 160),
      makeEdge(3, 4, 100, 1600, 160)
    ],
    isRoadClear: () => true
  };

  const group = buildRoadPaint(scene, network);
  assert.equal(group.name, 'RoadMarkings');
  assert.equal(group.children.length, 2, 'distant blocks split into separate spatial chunks');

  const [c0, c1] = group.children;
  assert.equal(c0.material, sharedMat);
  assert.equal(c1.material, sharedMat);
  assert.equal(c0.renderOrder, -1);
  assert.equal(c1.renderOrder, -1);
  assert.equal(c0.receiveShadow, true);
  assert.equal(c0.userData.cullDistance, 1650);
  assert.equal(c0.userData.sharesPipelineWith, undefined, 'first chunk owns the pipeline');
  assert.equal(c1.userData.sharesPipelineWith, c0, 'subsequent chunks share first chunk pipeline');
  assert.ok(c0.geometry.index.isUint16, 'compact chunks use 16-bit index buffers');
  assert.ok(c0.geometry.boundingSphere.radius > 80 + 16, 'boundingSphere includes screen-space widen padding');

  // Verify scene-culling hides distant road-paint chunks and keeps nearby ones visible
  setupSceneCulling(scene, [group], null);
  updateSceneCulling({ x: 180, y: 10, z: -1600 });
  assert.equal(c0.visible, true, 'nearby chunk stays visible');
  assert.equal(c1.visible, false, 'chunk 3.2 km away is distance-culled');

  updateSceneCulling({ x: 180, y: 10, z: 1600 });
  assert.equal(c0.visible, false);
  assert.equal(c1.visible, true);
});

test('createRoadPaintChunkBuilder subdivides long strips across cells with continuous dash phase and ramp height', () => {
  const builder = createRoadPaintChunkBuilder('ShoreHighwayMarkings', { cellSize: 450 });
  // 700 m sloped highway stripe from y=0.012 to y=7.012 with period=12, duty=0.25, phase=3.5
  builder.strip3D(0, 0.012, 0, 0, 7.012, 700, 0.15, { r: 1, g: 1, b: 1 }, 12, 0.25, 3.5, 1);
  const group = builder.build();
  assert.equal(group.children.length, 2, '700 m run spans two 450 m cells after 200 m subdivision');

  // Collect all 4-vertex quads in Z order and verify continuous u (paint.x) and y ramp
  const quads = [];
  for (const chunk of group.children) {
    const pos = chunk.geometry.attributes.position.array;
    const pnt = chunk.geometry.attributes.paint.array;
    for (let v = 0; v < pos.length / 3; v += 4) {
      quads.push({
        y0: pos[v * 3 + 1],
        z0: pos[v * 3 + 2],
        y1: pos[(v + 2) * 3 + 1],
        z1: pos[(v + 2) * 3 + 2],
        u0: pnt[v * 3],
        u1: pnt[(v + 2) * 3]
      });
    }
  }
  quads.sort((a, b) => a.z0 - b.z0);
  assert.equal(quads.length, 4, 'ceil(700 / 200) = 4 sub-quads');
  assert.ok(Math.abs(quads[0].u0 - 3.5) < 1e-5);
  assert.ok(Math.abs(quads[3].u1 - 703.5) < 1e-4);
  assert.ok(Math.abs(quads[3].y1 - 7.012) < 1e-4);
  for (let i = 1; i < quads.length; i++) {
    assert.ok(Math.abs(quads[i].z0 - quads[i - 1].z1) < 1e-4, 'seamless Z join');
    assert.ok(Math.abs(quads[i].y0 - quads[i - 1].y1) < 1e-4, 'seamless Y ramp');
    assert.ok(Math.abs(quads[i].u0 - quads[i - 1].u1) < 1e-4, 'continuous dash phase');
  }
});

