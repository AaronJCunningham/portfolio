import * as THREE from 'three/webgpu';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { HOCHBAHN } from './hochbahn-data.js';
import { railHeight, resampleTrack, nearestTrackPoint, onOberbaumDeck, platformFrame } from './hochbahn-layout.js';
import { nearestBerlinRoad } from './berlin-geometry.js';
import { waterAt } from './city-config.js';

// All structural parts share a unit box and a small material palette. Spatial
// batches plug into the existing nearby-city culling; there is no frame loop.
export function buildHochbahn(scene) {
  const group = new THREE.Group();
  group.name = 'BerlinHochbahn';
  const materials = {
    steel: new THREE.MeshStandardNodeMaterial({ color: 0x50594f, roughness: 0.8, metalness: 0.35 }),
    edge: new THREE.MeshStandardNodeMaterial({ color: 0x697267, roughness: 0.75, metalness: 0.3 }),
    dark: new THREE.MeshStandardNodeMaterial({ color: 0x313a33, roughness: 0.9 }),
    rail: new THREE.MeshStandardNodeMaterial({ color: 0x8b8d85, roughness: 0.5, metalness: 0.7 }),
    stone: new THREE.MeshStandardNodeMaterial({ color: 0x999482, roughness: 0.95 }),
    roof: new THREE.MeshStandardNodeMaterial({ color: 0x465a4d, roughness: 0.85 }),
  };
  const buckets = new Map(), solids = new Map(), colliders = [];
  const box = new THREE.BoxGeometry(1, 1, 1), dummy = new THREE.Object3D();
  const up = new THREE.Vector3(0, 1, 0), direction = new THREE.Vector3();
  let instanceCount = 0;
  const cellKey = (x, z) => `${Math.floor(x / 300)}/${Math.floor(z / 300)}`;
  function collectMatrix(material, x, z) {
    const key = `${material}/${cellKey(x, z)}`;
    if (!buckets.has(key)) buckets.set(key, { material, matrices: [] });
    dummy.updateMatrix();
    buckets.get(key).matrices.push(dummy.matrix.clone());
    instanceCount++;
  }
  function part(material, x, y, z, w, h, d, ry = 0) {
    dummy.position.set(x, y, z); dummy.rotation.set(0, ry, 0); dummy.scale.set(w, h, d);
    collectMatrix(material, x, z);
  }
  function beam(material, a, b, width, depth = width) {
    direction.set(b.x - a.x, b.y - a.y, b.z - a.z);
    const length = direction.length();
    if (length < 0.01) return;
    dummy.position.set((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
    dummy.quaternion.setFromUnitVectors(up, direction.divideScalar(length));
    dummy.scale.set(width, length, depth);
    collectMatrix(material, dummy.position.x, dummy.position.z);
  }
  function solid(geometry, material, x, z) {
    const key = `${material}/${cellKey(x, z)}`;
    if (!solids.has(key)) solids.set(key, { material, geometries: [] });
    solids.get(key).geometries.push(geometry.index ? geometry.toNonIndexed() : geometry);
    if (geometry.index) geometry.dispose();
  }
  const paths = HOCHBAHN.tracks.map(t => resampleTrack(t.points));
  const centres = paths[0].map(p => {
    const other = nearestTrackPoint(HOCHBAHN.tracks[1].points, p.x, p.z);
    return { x: (p.x + other.x) / 2, z: (p.z + other.z) / 2, s: p.s,
      width: Math.max(6.6, Math.min(18, other.distance + 3.4)) };
  });
  let nextSupport = 12, supports = 0;
  for (let i = 1; i < centres.length; i++) {
    const a = centres[i - 1], b = centres[i], x = (a.x + b.x) / 2, z = (a.z + b.z) / 2;
    if (onOberbaumDeck(x, z)) continue; // existing masonry landmark already carries the tracks
    const dx = b.x - a.x, dz = b.z - a.z, len = Math.hypot(dx, dz);
    if (len < 0.1) continue;
    const nx = -dz / len, nz = dx / len, ry = -Math.atan2(dz, dx);
    const y = railHeight(x), width = (a.width + b.width) / 2;
    part('dark', x, y - 0.5, z, len + 0.15, 0.45, width, ry);
    // Riveted plate-girder silhouette: deep web, upper/lower flanges, and ribs.
    for (const side of [-1, 1]) {
      const ox = nx * side * (width / 2 - 0.15), oz = nz * side * (width / 2 - 0.15);
      part('steel', x + ox, y - 0.95, z + oz, len + 0.18, 1.25, 0.18, ry);
      for (const h of [-1.57, -0.33]) part('edge', x + ox, y + h, z + oz, len + 0.2, 0.12, 0.43, ry);
      part('edge', x + ox, y - 0.95, z + oz, 0.12, 1.25, 0.28, ry);
      part('edge', x + ox, y + 0.52, z + oz, len + 0.18, 0.08, 0.08, ry);
      part('edge', x + ox, y + 0.06, z + oz, len + 0.18, 0.06, 0.06, ry);
      for (let s = 0; s < len; s += 2.4) {
        part('steel', a.x + dx * s / len + ox, y + 0.18, a.z + dz * s / len + oz, 0.07, 0.7, 0.07);
      }
    }
    part('steel', x, y - 1.05, z, 0.2, 0.7, width, ry);
    if (b.s < nextSupport || y < 3) continue;
    nextSupport = b.s + 24;
    if (waterAt(x, z)) continue;
    const feet = [-1, 1].map(side => ({ x: x + nx * side * (width / 2 - 0.75), z: z + nz * side * (width / 2 - 0.75), side }));
    // Keep the road openings clear at intersections. The span crosses overhead.
    if (feet.some(p => { const road = nearestBerlinRoad(p.x, p.z, 18); return road && !road.pedestrian && road.distance < road.width / 2 + 0.5; })) continue;
    for (const foot of feet) {
      part('stone', foot.x, 0.22, foot.z, 1.1, 0.45, 1.1);
      const top = { x: x + nx * foot.side * (width / 2 - 0.4), y: y - 1.35, z: z + nz * foot.side * (width / 2 - 0.4) };
      beam('steel', { ...foot, y: 0.35 }, top, 0.42, 0.5);
      beam('edge', { ...foot, y: Math.max(0.6, y - 3.6) }, { x, y: y - 1.4, z }, 0.2);
      colliders.push({ minX: foot.x - 0.48, maxX: foot.x + 0.48, minZ: foot.z - 0.48, maxZ: foot.z + 0.48, maxY: y - 1.3 });
    }
    part('steel', x, y - 1.4, z, 0.55, 0.42, width, ry);
    supports++;
  }
  // U3 uses the other side of the Warschauer terminal island. Its short branch
  // needs its own bed beyond the shared pair of U1 running tracks.
  for (const track of HOCHBAHN.terminalTracks) {
    const path = resampleTrack(track.points);
    for (let i = 1; i < path.length; i++) {
      const a = path[i - 1], b = path[i], x = (a.x + b.x) / 2, z = (a.z + b.z) / 2;
      const dx = b.x - a.x, dz = b.z - a.z, len = Math.hypot(dx, dz), y = railHeight(x);
      if (len < 0.1) continue;
      part('dark', x, y - 0.5, z, len + 0.15, 0.45, 3.4, -Math.atan2(dz, dx));
      if (i % 4) continue;
      const road = nearestBerlinRoad(x, z, 18);
      if (waterAt(x, z) || (road && road.distance < road.width / 2 + 0.5)) continue;
      part('steel', x, (y - 0.75) / 2, z, 0.5, y - 0.75, 0.5);
      part('steel', x, y - 0.8, z, 0.5, 0.5, 3.4, -Math.atan2(dz, dx));
      colliders.push({ minX: x - 0.4, maxX: x + 0.4, minZ: z - 0.4, maxZ: z + 0.4, maxY: y - 0.75 });
    }
  }
  // Each mapped way is one track, with two 1,435 mm-gauge running rails.
  const railSegmentKeys = new Set();
  const railPaths = [...paths, ...HOCHBAHN.terminalTracks.map(t => resampleTrack(t.points))];
  for (const path of railPaths) for (let i = 1; i < path.length; i++) {
    const a = path[i - 1], b = path[i], dx = b.x - a.x, dz = b.z - a.z, len = Math.hypot(dx, dz);
    if (len < 0.01 || onOberbaumDeck((a.x + b.x) / 2, (a.z + b.z) / 2)) continue;
    const key = [a.x, a.z, b.x, b.z].map(v => v.toFixed(2)).join('/');
    if (railSegmentKeys.has(key)) continue;
    railSegmentKeys.add(key);
    const nx = -dz / len, nz = dx / len;
    for (const offset of [-0.7175, 0.7175]) beam('rail', { x: a.x + nx * offset, y: railHeight(a.x), z: a.z + nz * offset },
      { x: b.x + nx * offset, y: railHeight(b.x), z: b.z + nz * offset }, 0.09, 0.13);
    for (let s = 0; s < len; s += 2) {
      const x = a.x + dx * s / len, z = a.z + dz * s / len;
      part('dark', x, railHeight(x) - 0.15, z, 0.22, 0.16, 2.5, -Math.atan2(dz, dx));
    }
  }

  // The platform polygons include the actual curved edges and Kotti's openings.
  // Simple open canopies preserve the original project's low-detail appearance.
  const atlas = document.createElement('canvas'); atlas.width = 1024; atlas.height = 512;
  const ctx = atlas.getContext('2d');
  ctx.fillStyle = '#202b2b'; ctx.fillRect(0, 0, 1024, 512);
  for (let i = 0; i < HOCHBAHN.stations.length; i++) {
    const station = HOCHBAHN.stations[i], row = i * 64;
    ctx.fillStyle = '#7dad4c'; ctx.fillRect(6, row + 8, 78, 48);
    ctx.fillStyle = '#16683d'; ctx.fillRect(90, row + 8, 78, 48);
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = 'bold 32px Arial';
    ctx.fillText('U1', 45, row + 32); ctx.fillText('U3', 129, row + 32);
    ctx.textAlign = 'left'; ctx.font = 'bold 34px Arial'; ctx.fillText(station.name, 190, row + 33);
    for (const platform of station.platforms) {
      const frame = platformFrame(platform.ring), y = railHeight(frame.x) + 0.85;
      const shape = new THREE.Shape(platform.ring.map(p => new THREE.Vector2(p[0], -p[1])));
      for (const hole of platform.holes) shape.holes.push(new THREE.Path(hole.map(p => new THREE.Vector2(p[0], -p[1]))));
      const slab = new THREE.ExtrudeGeometry(shape, { depth: 0.45, bevelEnabled: false, curveSegments: 1 });
      slab.rotateX(-Math.PI / 2); slab.translate(0, y - 0.45, 0);
      solid(slab, 'stone', frame.x, frame.z);
      const { ux, uz } = frame, nx = -uz, nz = ux, ry = -Math.atan2(uz, ux);
      const length = (frame.max - frame.min) * 0.78, mid = (frame.max + frame.min) / 2;
      const cx = frame.x + ux * mid, cz = frame.z + uz * mid, width = Math.max(3, frame.width * 0.85);
      part('roof', cx, y + 3.5, cz, length, 0.26, width, ry);
      part('edge', cx, y + 3.66, cz, length, 0.14, 0.25, ry);
      for (let t = -length / 2 + 4; t < length / 2; t += 12) {
        const px = cx + ux * t, pz = cz + uz * t;
        part('steel', px, y + 1.65, pz, 0.16, 3.3, 0.16);
        part('steel', px, y + 3.18, pz, 0.18, 0.18, width, ry);
      }
      for (let t = -length / 2 + 8; t < length / 2; t += 24) {
        const px = cx + ux * t, pz = cz + uz * t;
        const road = nearestBerlinRoad(px, pz, 18);
        if (waterAt(px, pz) || (road && !road.pedestrian && road.distance < road.width / 2 + 0.5)) continue;
        part('steel', px, (y - 0.45) / 2, pz, 0.5, y - 0.45, 0.5);
        part('steel', px, y - 0.65, pz, 0.5, 0.4, width, ry);
        colliders.push({ minX: px - 0.4, maxX: px + 0.4, minZ: pz - 0.4, maxZ: pz + 0.4, maxY: y - 0.45 });
      }
      for (const side of [-1, 1]) {
        const sign = new THREE.PlaneGeometry(10, 0.625);
        const uv = sign.attributes.uv;
        for (let v = 0; v < uv.count; v++) uv.setY(v, 1 - (i + 1 - uv.getY(v)) / 8);
        sign.rotateY(Math.atan2(nx * side, nz * side));
        sign.translate(cx + nx * side * width / 2, y + 2.8, cz + nz * side * width / 2);
        solid(sign, 'sign', cx, cz);
      }
    }
  }
  const texture = new THREE.CanvasTexture(atlas); texture.colorSpace = THREE.SRGBColorSpace;
  materials.sign = new THREE.MeshStandardNodeMaterial({ map: texture, roughness: 0.9 });
  const first = new Map();
  function addMesh(mesh, key) {
    mesh.castShadow = key !== 'sign'; mesh.receiveShadow = true;
    mesh.userData.cityRange = 'buildings';
    mesh.name = `Hochbahn_${key}`;
    const signature = key + (mesh.isInstancedMesh ? ':instanced' : ':merged');
    if (first.has(signature)) mesh.userData.sharesPipelineWith = first.get(signature);
    else first.set(signature, mesh);
    group.add(mesh);
  }
  for (const { material, matrices } of buckets.values()) {
    const mesh = new THREE.InstancedMesh(box, materials[material], matrices.length);
    matrices.forEach((matrix, i) => mesh.setMatrixAt(i, matrix));
    mesh.computeBoundingSphere(); addMesh(mesh, material);
  }
  for (const { material, geometries } of solids.values()) {
    const geometry = mergeGeometries(geometries, false);
    geometries.forEach(g => g.dispose());
    addMesh(new THREE.Mesh(geometry, materials[material]), material);
  }
  group.userData = { source: 'OpenStreetMap U1/U3 route relations', stations: HOCHBAHN.stations.length,
    instances: instanceCount, batches: group.children.length, supports };
  scene.add(group);
  console.info('[hochbahn]', JSON.stringify(group.userData));
  return { group, colliders };
}
