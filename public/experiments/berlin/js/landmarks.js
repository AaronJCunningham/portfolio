import * as THREE from 'three/webgpu';
import { color, positionWorld, sin, step, abs, normalWorldGeometry, floor, fract, max, smoothstep, float, mix, vec3, mx_noise_float } from 'three/tsl';
import { cityUniforms, createMarbleAshlarMaterial } from './tsl-materials.js';
import { projectLonLat } from './city-config.js';

// All architecture is generated in metres. No models, photographs, or textures.
// Dimensions cross-checked with the monuments' operators and Berlin's monument
// register; positions use the same local projection as the OSM city data.
const project = (lon, lat) => { const p = projectLonLat(lon, lat); return [p.x, p.z]; };

// This live legacy export keeps the original walking controller, camera and tree
// systems intact. The park is Berlin's Lustgarten, directly west of the cathedral.
export let bryantParkLawn = { minX: -445, maxX: -355, minZ: 25, maxZ: 130, top: 0.22 };

const specifications = [
  { id: 'fernsehturm', name: 'Fernsehturm', subtitle: 'Alexanderplatz · 368 m', lon: 13.409419, lat: 52.520815, height: 368, rotation: 0, footprint: [110, 110], offset: [-85, 135], targetY: 135 },
  { id: 'brandenburg', name: 'Brandenburger Tor', subtitle: 'Pariser Platz · 1791', lon: 13.377704, lat: 52.516275, height: 26, rotation: Math.PI / 2, footprint: [68, 20], offset: [100, 5], targetY: 13 },
  { id: 'reichstag', name: 'Reichstag', subtitle: 'Regierungsviertel · Glaskuppel', lon: 13.3761011, lat: 52.5185959, height: 47.5, rotation: -Math.PI / 2, footprint: [139, 128], offset: [-145, 25], targetY: 26 },
  { id: 'dom', name: 'Berliner Dom', subtitle: 'Museumsinsel · 98 m', lon: 13.401012, lat: 52.519061, height: 98, rotation: -Math.PI / 2 + 0.115, footprint: [91, 88], offset: [-140, 25], targetY: 43 },
  { id: 'rotesrathaus', name: 'Rotes Rathaus', subtitle: 'Rathausviertel · 1869', lon: 13.4085550, lat: 52.5182743, height: 74, rotation: -2.45, footprint: [101, 92], offset: [-100, -100], targetY: 35 },
  { id: 'hauptbahnhof', name: 'Hauptbahnhof', subtitle: 'Moabit · Glas und Stahl', lon: 13.369402, lat: 52.525084, height: 46, rotation: 0.035, footprint: [325, 175], offset: [0, 170], targetY: 24 },
  { id: 'neuesynagoge', name: 'Neue Synagoge', subtitle: 'Oranienburger Straße · Goldene Kuppel', lon: 13.3942149, lat: 52.5249365, height: 50, rotation: -0.417, footprint: [40, 57], offset: [-65, 75], targetY: 29 },
  { id: 'gendarmenmarkt', name: 'Gendarmenmarkt', subtitle: 'Zwei Dome · Ein Konzerthaus', lon: 13.392700, lat: 52.513580, height: 72, rotation: 0, footprint: [220, 260], offset: [120, 0], targetY: 31 },
  { id: 'oberbaum', name: 'Oberbaumbrücke', subtitle: 'Kreuzberg · Friedrichshain · 1896', lon: 13.4456296, lat: 52.5017485, height: 34, rotation: 2.482, footprint: [52, 250], offset: [-115, 95], targetY: 13 },
  { id: 'kreuzbergdenkmal', name: 'Kreuzbergdenkmal', subtitle: 'Viktoriapark · Schinkel · 1821', lon: 13.3814783, lat: 52.4876488, height: 27.1, rotation: -0.22, footprint: [40, 42], offset: [10, -55], targetY: 13 },
  { id: 'frankfurtertor', name: 'Frankfurter Tor', subtitle: 'Friedrichshain · Zwei Kuppeltürme', lon: 13.4526224, lat: 52.5160795, height: 66, rotation: -0.159, footprint: [46, 126], exclusionBoxes: [[0, -47.6, 23, 23], [0, 47.6, 23, 23]], offset: [95, 0], targetY: 38 },
  { id: 'charlottenburg', name: 'Schloss Charlottenburg', subtitle: 'Charlottenburg · Barockschloss', lon: 13.2957045, lat: 52.5208787, height: 48, rotation: 0.10, footprint: [560, 170], exclusionBoxes: [[0, -3, 156, 33], [-41.5, 43, 22, 82], [41.5, 43, 22, 82], [-170, 7, 211, 25], [145, 7, 158, 20]], offset: [0, 175], targetY: 27 },
  { id: 'berghain', name: 'Berghain', subtitle: 'Friedrichshain · Ehemaliges Heizkraftwerk', lon: 13.44329083677111, lat: 52.511337096495865, height: 28.9, rotation: -0.5975261251411804, footprint: [110, 206], sourceIds: ['w25649554', 'w1483384695', 'w1483384696', 'w1499858555'], offset: [-80.9, 75.8], targetY: 13.5 },
  { id: 'gedaechtniskirche', name: 'Kaiser-Wilhelm-Gedächtniskirche', subtitle: 'Breitscheidplatz · Blaues Licht', lon: 13.33519, lat: 52.50480, height: 71, rotation: -0.159, footprint: [170, 98], offset: [45, 95], targetY: 33 },
];

function rotatedBounds(x, z, width, depth, rotation, padding = 0) {
  const c = Math.abs(Math.cos(rotation)), s = Math.abs(Math.sin(rotation));
  const halfX = (width * c + depth * s) / 2 + padding;
  const halfZ = (width * s + depth * c) / 2 + padding;
  return { minX: x - halfX, maxX: x + halfX, minZ: z - halfZ, maxZ: z + halfZ };
}

export const LANDMARKS = specifications.map(spec => {
  const [x, z] = project(spec.lon, spec.lat);
  return {
    ...spec, x, z,
    spawn: [x + spec.offset[0], z + spec.offset[1]],
    lookAt: [x, spec.targetY, z],
    bounds: rotatedBounds(x, z, spec.footprint[0], spec.footprint[1], spec.rotation, 3),
    radius: Math.hypot(...spec.footprint) / 2,
  };
});

// Local scene dressing follows the user's aerial and forecourt photographs.
// The irregular edge follows the mapped pedestrian approach, stays east of the
// west service road, and stops short of Am Wriezener Bahnhof's carriageway.
const berghainAnchor = LANDMARKS.find(l => l.id === 'berghain');
const berghainWorldPoint = ([x, z]) => {
  const a = berghainAnchor.rotation, c = Math.cos(a), s = Math.sin(a);
  return { x: berghainAnchor.x + x * c + z * s, z: berghainAnchor.z - x * s + z * c };
};
const BERGHAIN_LOCAL_GROUND = [[-23,38.6],[-24.8,45],[-22,55],[-17,63],[-15.4,76],[-15,92],[-14,97],[-10,100],[-6,96],[-3.5,82],[3.8,70],[10,62],[19.5,55],[21.3,45],[17,38.6]];
export const BERGHAIN_GROUND_POLYGON = BERGHAIN_LOCAL_GROUND.map(berghainWorldPoint);
// Separate site islands keep every mapped carriageway and crossing footpath
// open. Their shape follows the garden edges visible in the aerial reference.
const BERGHAIN_LOCAL_ISLANDS = [
  [[-46,44],[-36,43],[-28,45],[-25,56],[-25,70],[-25,84],[-28,90],[-37,88],[-47,86],[-51,77],[-50,62]],
  [[8,58],[17,56.5],[27,59],[33,63],[34,69],[30,72],[25,74.5],[22,77],[19,82],[16,94],[12,98],[0,95],[-1,86],[2,74],[4,65]],
];
export const BERGHAIN_GROUND_POLYGONS = [BERGHAIN_LOCAL_GROUND, ...BERGHAIN_LOCAL_ISLANDS].map(ring => ring.map(berghainWorldPoint));
// Species indices use upstream's London plane / honey locust / elm geometry.
// Small scale entries are shrub clusters grown by the same leaf-card pipeline.
const berghainPlanting = [
  // Mature canopy frames the facade; the central approach stays open.
  [-17,46,1.04,0,1.2,1.12],[-22,48,1.08,2,1.15,1.2],[-11,49,.76,2,1.1,1.1],[-18,58,1.1,0,1.22,1.15],
  [9,42.5,.82,2,1.15,1.1],[16,45,1.06,0,1.22,1.2],[19.5,55,1.05,2,1.2,1.15],[11,61,1.02,0,1.25,1.15],
  [-13.8,69,.82,2,1.2,1.1],[3.4,73,.79,0,1.15,1.1],[-3.3,87,.65,2,1.2,1.1],[-15.2,90,.66,0,1.15,1.1],
  [-23,33,.83,2,1.2,1.2],[23.5,33,.86,2,1.25,1.15],
  [-39,53,1.12,0,1.22,1.2],[-45,69,1.18,2,1.25,1.2],[-33,75,1.2,0,1.25,1.2],[-34,85,.94,2,1.2,1.2],[-28,59,1.05,2,1.2,1.2],
  [24,64,1.17,0,1.2,1.18],[19,75,1.1,2,1.2,1.2],[13,87,1.08,0,1.25,1.2],[6,88,.84,2,1.2,1.2],
  // Broad low saplings form undergrowth through the original leaf-card system.
  [-15,41,.25,2,2.1,1.8],[-21,45,.27,2,2.2,1.9],[-22,53,.25,0,2,1.9],[-16,51,.25,2,2.3,2],[-18,62,.24,0,2.2,1.8],
  [-12,63,.26,2,2.1,1.8],[-13,77,.25,2,2.1,1.8],[-13.5,85,.27,0,2.1,1.8],[-12.8,94,.24,2,2,1.8],
  [7.5,40.5,.27,0,2,1.8],[13,42,.28,2,2.2,1.9],[17.5,49,.26,2,2.3,2],[16,56,.25,0,2.2,1.8],
  [8.4,64,.26,2,2.1,1.8],[2.5,77,.25,2,2.2,1.9],[-2,90,.25,0,2.2,1.8],[-6,97,.25,2,2.1,1.8],
  [-32,47,.27,2,2.3,2],[-41,47,.25,0,2.3,1.9],[-47,57,.28,2,2.2,2],[-48,76,.26,0,2.3,1.9],
  [-42,82,.28,2,2.3,1.9],[-31,87,.25,0,2.2,1.8],[-27,77,.27,2,2.1,1.9],[-28,69,.28,2,2.1,1.8],
  [-35,62,.26,0,2.3,2],[-39,71,.27,2,2.3,2],[-32,54,.28,0,2.3,2],[-39,87,.25,2,2.1,1.8],
  [10,59,.25,2,2.2,1.9],[19,60,.28,0,2.3,1.9],[29,64,.26,2,2.3,1.8],[27,70,.27,2,2.3,2],
  [21,78,.26,0,2.3,1.9],[17,84,.28,2,2.3,2],[13,94,.25,2,2.2,1.9],[5,94,.25,0,2.2,1.9],
  [4,85,.27,2,2.3,2],[8,77,.25,0,2.3,1.9],[15,69,.26,2,2.2,1.9],[10,84,.26,2,2.2,1.9],
];
export const BERGHAIN_TREE_SITES = berghainPlanting.map(([x,z,scale,species,sx=1,sz=1], i) => ({
  ...berghainWorldPoint([x,z]), y: .09, scale, species, sx, sz,
  yaw: (i * 2.399963229728653) % (Math.PI * 2), isShrub: scale < .3,
}));

// Building exclusions and pedestrian colliders are deliberately separate:
// gateways, courtyards and the station's concourse remain open to exploration.
export const LANDMARK_SOURCE_EXCLUSIONS = new Set(LANDMARKS.flatMap(l => l.sourceIds || []));

export const LANDMARK_EXCLUSIONS = LANDMARKS.flatMap(l => {
  // Exact source replacement keeps adjacent courtyard venues intact.
  if (l.sourceIds) return [];
  if (!l.exclusionBoxes) return [{ ...l.bounds, id: l.id }];
  const c = Math.cos(l.rotation), s = Math.sin(l.rotation);
  return l.exclusionBoxes.map(([x, z, w, d]) => ({ ...rotatedBounds(l.x + x * c + z * s, l.z - x * s + z * c, w, d, l.rotation, 1), id: l.id }));
});

function makeMaterials() {
  const material = (color, roughness = 0.87, metalness = 0) => new THREE.MeshStandardNodeMaterial({ color, roughness, metalness });
  const materials = {
    stone: material('#c6bcaa'), trim: material('#ded1b7'), shade: material('#a19580'),
    pale: material('#d9d3c5'), concrete: material('#b9b8ad'),
    brick: material('#9a5441'), brickLight: material('#b56b50'), brickDark: material('#743c32'),
    sandstone: material('#c1a575'), copper: material('#577c70', 0.65, 0.25), copperDark: material('#385951', 0.75, 0.3),
    steel: material('#a8b2b1', 0.35, 0.7), darkSteel: material('#495555', 0.55, 0.55),
    glass: material('#779292', 0.22, 0.48), window: material('#33494d', 0.4, 0.25),
    glassDome: new THREE.MeshStandardNodeMaterial({ color: '#a8c3c1', roughness: 0.15, metalness: 0.28, transparent: true, opacity: 0.58, depthWrite: false, side: THREE.DoubleSide }),
    roof: material('#5c605d'), bronze: material('#35564c', 0.64, 0.5),
    gold: material('#cda44c', 0.38, 0.7), goldLight: material('#e3c474', 0.45, 0.65),
    black: material('#272b2b'), red: material('#b8493e'), yellow: material('#ddb449'), white: material('#e2e1d7'),
    beacon: new THREE.MeshStandardNodeMaterial({ color: '#da4f36', emissive: '#e93b20', emissiveIntensity: 2, roughness: 0.5 }),
    bhPlaster: material('#aaa998'), bhTrim: material('#b6b3a3'), bhRustica: material('#9a9988'),
    bhRecess: material('#52564d'), bhBlind: material('#303732'), bhGlass: material('#526260', 0.5, 0.18),
    bhMetal: material('#434b45', 0.68, 0.4), bhRoof: material('#64695e'),
    bhGravel: material('#82725b', 0.99), bhPaint: material('#c1bfb0'), bhTag: material('#67554a'),
    bhSoot: material('#4c5048'), bhGlassPale: material('#6e8990', .52, .12), bhGlassDirty: material('#485c61', .7, .1),
    bhBoard: material('#aa8254'), bhRust: material('#6a4840'), bhEarth: material('#65583e', 1), bhGrass: material('#5d6846', 1),
    bhTagBlack: material('#252a28'), bhTagWhite: material('#c0c2b8'), bhTagRed: material('#844738'), bhTagGreen: material('#46695b'),
    palace: material('#d4c69f'), terracotta: material('#a66543'), iron: material('#394340', 0.82, 0.45),
    blueGlass: material('#244989', 0.32, 0.15), blueConcrete: material('#a3a49a'), ruin: material('#8b8273'),
  };
  // Reuse upstream's weathered ashlar: individual stone courses, rain streaks,
  // fine veining, contact grime and canyon occlusion survive close inspection.
  materials.stone = createMarbleAshlarMaterial();
  materials.pale = createMarbleAshlarMaterial();
  materials.pale.colorNode = materials.pale.colorNode.mul(1.08);
  for (const key of ['brick', 'brickLight', 'brickDark', 'sandstone']) {
    const p = positionWorld;
    const u = p.x.mul(abs(normalWorldGeometry.z)).add(p.z.mul(abs(normalWorldGeometry.x)));
    const course = floor(p.y.div(0.24));
    const horizontal = smoothstep(0.465, 0.495, abs(fract(p.y.div(0.24)).sub(0.5)));
    const vertical = smoothstep(0.45, 0.495, abs(fract(u.div(0.52).add(fract(course.mul(0.5)))).sub(0.5)));
    const mortar = max(horizontal, vertical).mul(float(1).sub(abs(normalWorldGeometry.y)));
    const variation = sin(floor(u.div(0.52)).mul(1.71).add(course.mul(2.41))).mul(0.055).add(0.94);
    materials[key].colorNode = mix(color(materials[key].color).mul(variation), color(0x82776a), mortar.mul(0.4));
  }
  // The same time-of-day uniform as upstream's procedural windows. Sparse warm
  // panes are composed in TSL and compile natively with its WebGPU renderer.
  const litPane = step(0.18, sin(positionWorld.x.mul(0.73).add(positionWorld.z.mul(0.31)).add(positionWorld.y.mul(0.41))));
  materials.window.emissiveNode = color(0xffd59b).mul(cityUniforms.uInteriorGlow).mul(litPane).mul(0.5);
  materials.glass.emissiveNode = color(0xf6daa6).mul(cityUniforms.uInteriorGlow).mul(0.075);
  const cell = sin(floor(positionWorld.x.mul(1.8)).mul(2.71).add(floor(positionWorld.z.mul(1.8)).mul(4.13)).add(floor(positionWorld.y.mul(1.8)).mul(1.37)));
  materials.blueGlass.colorNode = mix(color(0x172b65), color(0x3c7eb4), cell.mul(0.5).add(0.5));
  materials.blueGlass.emissiveNode = mix(color(0x12308c), color(0x316bb8), cell.mul(0.5).add(0.5)).mul(cityUniforms.uInteriorGlow.mul(0.85).add(0.12));
  for (const key of ['palace', 'ruin']) {
    const weathering = createMarbleAshlarMaterial();
    materials[key].colorNode = weathering.colorNode.mul(color(key === 'palace' ? 0xd6c48f : 0x898477));
  }
  // Photo-matched aged render: multi-scale plaster mottling, soot under the
  // cornices and vertically stretched rain marks. The noise is native TSL;
  // there are no imported images or custom shader hooks.
  const bp = positionWorld;
  const broad = mx_noise_float(bp.mul(vec3(.18, .22, .18))).mul(.5).add(.5);
  const fine = mx_noise_float(bp.mul(5.8)).mul(.09).add(.94);
  const runoff = smoothstep(.08, .48, mx_noise_float(bp.mul(vec3(2.7, .075, 2.7))));
  const broken = smoothstep(.38, .68, broad);
  const verticalGrime = runoff.mul(smoothstep(2, 18, bp.y)).mul(.27);
  const renderTone = mix(color(0xc3bdab), color(0x8e9485), broken.mul(.65));
  materials.bhPlaster.colorNode = renderTone.mul(fine.sub(verticalGrime));
  materials.bhTrim.colorNode = mix(color(0xbab7a6), color(0x727c70), broken.mul(.68)).mul(fine.sub(verticalGrime.mul(.7)));
  materials.bhRustica.colorNode = mix(color(0xa6a38f), color(0x777c6a), broad).mul(fine).mul(sin(floor(bp.y.div(.47)).mul(1.63)).mul(.055).add(.95));
  materials.bhSoot.colorNode = color(0x4c5048).mul(broad.mul(.3).add(.78));
  materials.bhRoof.colorNode = mix(color(0x797e75), color(0x4d5754), smoothstep(.26, .73, broad)).mul(fine);
  materials.bhBoard.colorNode = color(0xaa8254).mul(mx_noise_float(bp.mul(vec3(12, .27, 12))).mul(.17).add(.83));
  for (const key of ['bhGlass', 'bhGlassPale', 'bhGlassDirty']) {
    const grime = mx_noise_float(bp.mul(vec3(3.3, .27, 3.3))).mul(.18).add(.87);
    materials[key].colorNode = color(materials[key].color).mul(grime);
    materials[key].emissiveNode = color(0x7e6549).mul(cityUniforms.uInteriorGlow).mul(.018);
  }
  for (const key of ['bhGravel', 'bhEarth', 'bhGrass', 'bhRust']) {
    const coarse = mx_noise_float(bp.mul(.28)).mul(key === 'bhGravel' || key === 'bhEarth' ? .35 : .13).add(.88);
    const grain = mx_noise_float(bp.mul(31)).mul(.12).add(.91);
    materials[key].colorNode = color(materials[key].color).mul(coarse).mul(grain);
  }
  return materials;
}

// One mesh per material per destination. Primitive geometries are reused while
// building; the merged meshes retain no hidden Object3D hierarchies.
class Builder {
  constructor(landmark, materials, parent) {
    this.landmark = landmark;
    this.materials = materials;
    this.parent = parent;
    this.parts = new Map();
    this.colliders = [];
    this.frame = new THREE.Matrix4().makeRotationY(landmark.rotation);
    this.frame.setPosition(landmark.x, 0, landmark.z);
  }
  add(geometry, mat, position = [0, 0, 0], scale = [1, 1, 1], rotation = [0, 0, 0]) {
    const quaternion = rotation.isQuaternion ? rotation : new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation));
    const matrix = new THREE.Matrix4().compose(new THREE.Vector3(...position), quaternion, new THREE.Vector3(...scale));
    matrix.premultiply(this.frame);
    const transformed = (geometry.index ? geometry.toNonIndexed() : geometry.clone()).applyMatrix4(matrix);
    if (!transformed.attributes.normal) transformed.computeVertexNormals();
    if (!this.parts.has(mat)) this.parts.set(mat, []);
    this.parts.get(mat).push(transformed);
  }
  box(x, y, z, w, h, d, mat = 'stone', rotation = [0, 0, 0]) { this.add(primitives.box, mat, [x, y, z], [w, h, d], rotation); }
  cyl(x, y, z, radius, height, mat = 'stone', topRadius = radius, segments = 24) {
    if (Math.abs(topRadius - radius) < 0.0001 && segments === 24) this.add(primitives.cylinder, mat, [x, y, z], [radius, height, radius]);
    else this.add(new THREE.CylinderGeometry(topRadius, radius, height, segments), mat, [x, y, z]);
  }
  sphere(x, y, z, rx, ry, rz, mat = 'stone') { this.add(primitives.sphere, mat, [x, y, z], [rx, ry, rz]); }
  dome(x, y, z, radius, height, mat = 'copper') { this.add(primitives.hemisphere, mat, [x, y, z], [radius, height, radius]); }
  ring(x, y, z, radius, tube, mat = 'trim', rotation = [-Math.PI / 2, 0, 0], arc = Math.PI * 2) {
    this.add(new THREE.TorusGeometry(radius, tube, 5, Math.max(16, Math.round(48 * arc / (Math.PI * 2))), arc), mat, [x, y, z], [1, 1, 1], rotation);
  }
  beam(a, b, radius, mat = 'steel') {
    const start = new THREE.Vector3(...a), end = new THREE.Vector3(...b), delta = end.clone().sub(start);
    if (delta.lengthSq() < 1e-9) return;
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.clone().normalize());
    this.add(primitives.beam, mat, start.add(end).multiplyScalar(0.5).toArray(), [radius, delta.length(), radius], q);
  }
  collision(x, z, w, d, maxY = this.landmark.height) {
    const p = new THREE.Vector3(x, 0, z).applyMatrix4(this.frame);
    this.colliders.push({ ...rotatedBounds(p.x, p.z, w, d, this.landmark.rotation), landmark: this.landmark.id, maxY });
  }
  finish() {
    const group = new THREE.Group();
    group.name = this.landmark.name;
    group.userData.landmark = this.landmark.id;
    for (const [key, parts] of this.parts) {
      const count = parts.reduce((n, geometry) => n + geometry.attributes.position.count, 0);
      const positions = new Float32Array(count * 3), normals = new Float32Array(count * 3);
      let offset = 0;
      for (const geometry of parts) {
        positions.set(geometry.attributes.position.array, offset);
        normals.set(geometry.attributes.normal.array, offset);
        offset += geometry.attributes.position.array.length;
        geometry.dispose();
      }
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
      geometry.computeBoundingBox();
      geometry.computeBoundingSphere();
      const mesh = new THREE.Mesh(geometry, this.materials[key]);
      mesh.name = `${this.landmark.id}-${key}`;
      mesh.castShadow = key !== 'glassDome';
      mesh.receiveShadow = true;
      group.add(mesh);
    }
    this.parent.add(group);
    return this.colliders;
  }
}

const primitives = {
  box: new THREE.BoxGeometry(1, 1, 1),
  cylinder: new THREE.CylinderGeometry(1, 1, 1, 24),
  beam: new THREE.CylinderGeometry(1, 1, 1, 6),
  sphere: new THREE.SphereGeometry(1, 24, 16),
  hemisphere: new THREE.SphereGeometry(1, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2),
};

const archCache = new Map();
function archGeometry(width, height, depth = 0.18) {
  const key = `${width},${height},${depth}`;
  if (archCache.has(key)) return archCache.get(key);
  const r = width / 2, spring = height - r;
  const shape = new THREE.Shape();
  shape.moveTo(-r, 0); shape.lineTo(r, 0); shape.lineTo(r, spring);
  shape.absarc(0, spring, r, 0, Math.PI, false); shape.lineTo(-r, 0);
  const geometry = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 10 });
  archCache.set(key, geometry);
  return geometry;
}

function windowArch(b, x, y, z, width, height, rotation = 0, frame = 'trim', glass = 'window') {
  // y marks the sill; rotation 0 looks out of the positive local Z face.
  const c = Math.cos(rotation), s = Math.sin(rotation);
  const place = (dx, dy, dz) => [x + dx * c + dz * s, y + dy, z - dx * s + dz * c];
  b.add(archGeometry(width, height), glass, [x, y, z], [1, 1, 1], [0, rotation, 0]);
  const jamb = width > 4 ? 0.42 : 0.22;
  for (const side of [-1, 1]) b.box(...place(side * (width / 2 + jamb / 2), (height - width / 2) / 2, 0.13), jamb, height - width / 2, 0.35, frame, [0, rotation, 0]);
  const top = place(0, height - width / 2, 0.15);
  b.ring(...top, width / 2 + jamb / 2, jamb / 2, frame, [0, rotation, 0], Math.PI);
  b.box(...place(0, 0, 0.15), width + jamb * 2.5, 0.3, 0.6, frame, [0, rotation, 0]);
  if (width >= 2.2) b.box(...place(0, (height - 0.5) / 2, 0.23), 0.12, height - 0.5, 0.12, frame, [0, rotation, 0]);
  if (height >= 4) for (const fraction of [0.32, 0.64]) b.box(...place(0, height * fraction, 0.25), width, 0.11, 0.11, frame, [0, rotation, 0]);
}

function rectWindow(b, x, y, z, w, h, rotation = 0, frame = 'shade') {
  b.box(x, y, z, w + 0.45, h + 0.45, 0.2, frame, [0, rotation, 0]);
  b.box(x + Math.sin(rotation) * 0.15, y, z + Math.cos(rotation) * 0.15, w, h, 0.2, 'window', [0, rotation, 0]);
  b.box(x + Math.sin(rotation) * 0.28, y, z + Math.cos(rotation) * 0.28, 0.12, h, 0.1, 'trim', [0, rotation, 0]);
  b.box(x + Math.sin(rotation) * 0.28, y, z + Math.cos(rotation) * 0.28, w, 0.12, 0.1, 'trim', [0, rotation, 0]);
}

function pilaster(b, x, baseY, z, height, width = 1.2, rotation = 0, mat = 'trim') {
  const place = (dy, dz) => [x + Math.sin(rotation) * dz, baseY + dy, z + Math.cos(rotation) * dz];
  b.box(...place(height / 2, 0.22), width, height, 0.55, mat, [0, rotation, 0]);
  b.box(...place(0.4, 0.3), width * 1.35, 0.8, 0.8, mat, [0, rotation, 0]);
  b.box(...place(height - 0.4, 0.3), width * 1.55, 0.8, 0.85, mat, [0, rotation, 0]);
  b.box(...place(height + 0.1, 0.3), width * 1.8, 0.3, 0.9, mat, [0, rotation, 0]);
}

function column(b, x, baseY, z, radius, height, mat = 'trim', fluted = false) {
  b.cyl(x, baseY + 0.3, z, radius * 1.35, 0.6, mat);
  b.cyl(x, baseY + height / 2, z, radius, height - 0.5, mat, radius * 0.84);
  b.cyl(x, baseY + height - 0.4, z, radius * 1.18, 0.5, mat);
  b.box(x, baseY + height, z, radius * 2.7, 0.45, radius * 2.7, mat);
  if (fluted) for (let i = 0; i < 12; i++) {
    const angle = i * Math.PI / 6;
    b.beam([x + Math.cos(angle) * radius * 0.91, baseY + 0.9, z + Math.sin(angle) * radius * 0.91], [x + Math.cos(angle) * radius * 0.78, baseY + height - 0.9, z + Math.sin(angle) * radius * 0.78], radius * 0.055, 'shade');
  }
}

function triangle(b, x, y, z, width, height, depth, mat = 'trim', rotation = 0) {
  const shape = new THREE.Shape();
  shape.moveTo(-width / 2, 0); shape.lineTo(width / 2, 0); shape.lineTo(0, height); shape.closePath();
  b.add(new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false }), mat, [x, y, z], [1, 1, 1], [0, rotation, 0]);
}

function hipRoof(b, x, y, z, width, depth, height, mat = 'roof') {
  const w = width / 2, d = depth / 2, ridge = Math.max(0, w - d * 0.7);
  const vertices = [-w,0,-d, w,0,-d, ridge,height,0, -w,0,-d, ridge,height,0, -ridge,height,0,
    w,0,d, -w,0,d, -ridge,height,0, w,0,d, -ridge,height,0, ridge,height,0,
    -w,0,d, -w,0,-d, -ridge,height,0, w,0,-d, w,0,d, ridge,height,0];
  for (let i = 0; i < vertices.length; i += 9) for (let axis = 0; axis < 3; axis++) {
    const value = vertices[i + 3 + axis];
    vertices[i + 3 + axis] = vertices[i + 6 + axis];
    vertices[i + 6 + axis] = value;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.computeVertexNormals();
  b.add(geometry, mat, [x, y, z]);
}

function cross(b, x, y, z, height, mat = 'gold') {
  b.box(x, y + height / 2, z, height * 0.085, height, height * 0.085, mat);
  b.box(x, y + height * 0.7, z, height * 0.56, height * 0.085, height * 0.085, mat);
}

function domeRibs(b, x, y, z, radius, height, mat = 'copperDark', count = 16, thickness = 0.16) {
  for (let i = 0; i < count; i++) {
    const theta = i * Math.PI * 2 / count;
    for (let j = 0; j < 10; j++) {
      const a = j * Math.PI / 20, c = (j + 1) * Math.PI / 20;
      b.beam([x + Math.cos(a) * radius * Math.cos(theta), y + Math.sin(a) * height, z + Math.cos(a) * radius * Math.sin(theta)], [x + Math.cos(c) * radius * Math.cos(theta), y + Math.sin(c) * height, z + Math.cos(c) * radius * Math.sin(theta)], thickness, mat);
    }
  }
}

function germanFlag(b, x, y, z, poleHeight = 8) {
  b.cyl(x, y + poleHeight / 2, z, 0.08, poleHeight, 'steel');
  const colors = ['black', 'red', 'yellow'];
  colors.forEach((mat, stripe) => {
    const vertices = [];
    for (let i = 0; i < 8; i++) {
      const a = i * 0.5, c = (i + 1) * 0.5;
      const ya = y + poleHeight - 0.3 - stripe * 0.65;
      const za = Math.sin(i * 0.65) * 0.24, zc = Math.sin((i + 1) * 0.65) * 0.24;
      vertices.push(a,ya,za,c,ya,zc,c,ya-0.65,zc,a,ya,za,c,ya-0.65,zc,a,ya-0.65,za);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.computeVertexNormals();
    b.add(geometry, mat, [x, 0, z]);
    b.add(geometry, mat, [x, 0, z - 0.012], [1, 1, -1]);
  });
}

function buildFernsehturm(b) {
  // Hexagonal folded pavilion surrounds the slender concrete shaft.
  b.cyl(0, 0.2, 0, 46, 0.4, 'shade', 46, 6);
  for (let i = 0; i < 6; i++) {
    const angle = i * Math.PI / 3;
    const x = Math.sin(angle) * 25, z = Math.cos(angle) * 25;
    b.box(x, 3.3, z, 25, 6, 20, 'glass', [0, angle, 0]);
    b.box(x, 6.7, z, 29, 0.65, 27, 'pale', [-0.14, angle, 0]);
    for (let j = -2; j <= 2; j++) b.box(x + Math.cos(angle) * j * 4.5 + Math.sin(angle) * 10.15, 3.5, z - Math.sin(angle) * j * 4.5 + Math.cos(angle) * 10.15, 0.22, 6, 0.25, 'steel', [0, angle, 0]);
  }
  b.cyl(0, 125, 0, 8.2, 250, 'concrete', 4.5, 48);
  b.cyl(0, 2.3, 0, 11, 4.6, 'pale');
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4;
    b.beam([Math.cos(a) * 8.15, 8, Math.sin(a) * 8.15], [Math.cos(a) * 4.7, 246, Math.sin(a) * 4.7], 0.12, 'pale');
  }
  b.sphere(0, 212, 0, 16, 16, 16, 'steel');
  const minY = -9, maxY = -1.3;
  const thetaStart = Math.acos(maxY / 16), thetaEnd = Math.acos(minY / 16);
  b.add(new THREE.SphereGeometry(16.07, 48, 5, 0, Math.PI * 2, thetaStart, thetaEnd - thetaStart), 'window', [0, 212, 0]);
  for (const y of [203, 207.3, 210.7, 217, 223]) {
    const radius = Math.sqrt(16 * 16 - (y - 212) ** 2);
    b.ring(0, y, 0, radius + 0.06, y < 212 ? 0.16 : 0.09, 'steel');
  }
  for (let i = 0; i < 40; i++) {
    const a = i * Math.PI * 2 / 40;
    b.beam([Math.cos(a) * 13.3, 203.2, Math.sin(a) * 13.3], [Math.cos(a) * 16.02, 210.8, Math.sin(a) * 16.02], 0.09, 'steel');
  }
  b.cyl(0, 236, 0, 5.8, 17, 'steel', 4.8);
  for (const y of [230, 237, 244, 250]) b.cyl(0, y, 0, 6.2, 1.2, 'pale');
  const sections = [[250,272,3.8,3.3],[272,296,3.0,2.5],[296,320,2.1,1.7],[320,344,1.4,1.1],[344,368,0.9,0.4]];
  for (const [bottom, top, radius, tip] of sections) {
    for (let i = 0; i < 4; i++) {
      const h = (top - bottom) / 4;
      b.cyl(0, bottom + h * (i + 0.5), 0, radius + (tip - radius) * i / 4, h, i % 2 ? 'white' : 'red', radius + (tip - radius) * (i + 1) / 4);
    }
  }
  b.sphere(0, 367.35, 0, 0.65, 0.65, 0.65, 'beacon');
  b.collision(0, 0, 70, 70, 8);
  b.collision(0, 0, 17, 17, 368);
}

function buildGate(b) {
  for (const x of [-17.8, -10.7, -3.6, 3.6, 10.7, 17.8]) {
    for (const z of [-4.2, 4.2]) column(b, x, 0.5, z, 0.97, 14.2, 'trim', true);
    b.box(x, 7.1, 0, 1.15, 13.5, 6.4, 'stone');
    b.collision(x, 0, 2.15, 10.3, 20.9);
  }
  b.box(0, 15.8, 0, 40.2, 2.2, 11.1, 'stone');
  b.box(0, 17.3, 0, 41.1, 0.7, 11.8, 'trim');
  b.box(0, 18.3, 0, 40.1, 1.4, 10.8, 'stone');
  b.box(0, 19.25, 0, 41.5, 0.5, 12.1, 'trim');
  b.box(0, 20.0, 0, 19.2, 1.1, 10.5, 'stone');
  b.box(0, 20.72, 0, 20.2, 0.35, 11.4, 'trim');
  for (const side of [-1, 1]) {
    b.box(side * 27.1, 6.8, -1.4, 10.7, 12.5, 7.4, 'stone');
    b.box(side * 27.1, 13.4, 0, 12.8, 0.8, 12.5, 'trim');
    b.box(side * 27.1, 14.2, 0, 11.4, 0.9, 11.2, 'stone');
    hipRoof(b, side * 27.1, 14.65, 0, 11.4, 11.2, 1.1, 'roof');
    for (let j = -1; j <= 1; j++) column(b, side * 27.1 + j * 3.2, 0.4, 4.8, 0.52, 12.3, 'trim');
    b.collision(side * 27.1, -1.4, 10.8, 7.4, 15.75);
    windowArch(b, side * 27.1, 1.0, 2.4, 2.5, 6, 0, 'trim');
    windowArch(b, side * 27.1, 1.0, -5.2, 2.5, 6, Math.PI, 'trim');
    for (const z of [-2.5,1.2]) windowArch(b,side*32.55,3,z,2.0,5.1,side*Math.PI/2,'shade');
    for (const dx of [-4.3,4.3]) pilaster(b,side*27.1+dx,0.7,-5.2,11.7,0.7,Math.PI,'trim');
  }
  // Triglyphs and low sculptural reliefs articulate the entablature.
  for (let i = -16; i <= 16; i += 2) for (const z of [-5.6, 5.6]) {
    b.box(i, 15.9, z, 0.4, 1.5, 0.22, 'shade');
    b.sphere(i + 0.9, 18.3, z - Math.sign(z) * 0.03, 0.45, 0.42, 0.22, 'trim');
  }
  b.box(0, 21.35, 0, 7.9, 0.9, 5, 'bronze');
  // Four horses face east. Their raised heads, legs and chariot read at street scale.
  for (const x of [-2.7, -0.9, 0.9, 2.7]) {
    b.sphere(x, 23.15, 0.8, 0.5, 0.65, 1.15, 'bronze');
    b.beam([x,23.4,1.3],[x,24.25,1.7],0.3,'bronze');
    b.sphere(x, 24.35, 1.9, 0.28, 0.36, 0.6, 'bronze');
    for (const side of [-1,1]) {
      b.beam([x+side*0.27,22.9,0],[x+side*0.3,21.9,-0.3],0.1,'bronze');
      b.beam([x+side*0.27,22.9,1.4],[x+side*0.31,22.1,1.9],0.11,'bronze');
    }
    b.beam([x,23.3,-0.2],[x,22.7,-1],0.13,'bronze');
  }
  b.box(0, 22.6, -1.6, 2.5, 1.5, 1.6, 'bronze');
  for (const x of [-1.4, 1.4]) b.ring(x, 22, -1.7, 0.83, 0.16, 'bronze', [0, Math.PI/2, 0]);
  b.cyl(0, 24.1, -1.6, 0.45, 1.5, 'bronze', 0.25, 12);
  b.sphere(0, 25.15, -1.6, 0.3, 0.34, 0.3, 'bronze');
  b.beam([0.2,24.3,-1.5],[1.5,24.1,-0.1],0.1,'bronze');
  b.beam([-0.2,24.3,-1.5],[-1.5,24.1,-0.1],0.1,'bronze');
  b.beam([0.7,24.1,-1.5],[0.7,25.7,-1.5],0.07,'bronze');
  b.ring(0.7, 25.45, -1.5, 0.35, 0.12, 'bronze', [0,0,0]);
  triangle(b, 0.7, 25.65, -1.5, 1.7, 0.35, 0.12, 'bronze');
}

function buildReichstag(b) {
  b.box(0, 1.8, 0, 137.4, 3.6, 103.6, 'shade');
  const walls = [[0,42,137.4,20],[0,-42,137.4,20],[-56.7,0,24,64],[56.7,0,24,64],[0,0,48,65]];
  for (const [x,z,w,d] of walls) {
    b.box(x, 13.8, z, w, 24.4, d, 'stone');
    b.box(x, 26.3, z, w+1.2, 1.3, d+1.2, 'trim');
    b.box(x, 27.25, z, w, 0.55, d, 'roof');
    b.collision(x,z,w,d,32);
  }
  for (const z of [-52.05,52.05]) {
    for (let x=-61;x<=61;x+=7.6) {
      if (z>0 && Math.abs(x)<24) continue;
      windowArch(b,x,4.5,z,3.2,6.5,z<0?Math.PI:0,'shade');
      rectWindow(b,x,18.8,z,3.2,5.1,z<0?Math.PI:0,'trim');
      b.box(x,12.2,z,5,0.55,0.65,'trim');
    }
    b.box(0,12,z,137.8,0.6,0.8,'trim');
    b.box(0,23.8,z,138.5,0.8,1.2,'trim');
  }
  for (const side of [-1,1]) for(let z=-34;z<=34;z+=8.5) {
    windowArch(b,side*68.8,4.5,z,3.3,6.4,side*Math.PI/2,'shade');
    rectWindow(b,side*68.8,18.8,z,3.3,5.2,side*Math.PI/2,'trim');
  }
  for(const x of [-57.5,57.5]) for(const z of [-41,41]) {
    b.box(x,30.2,z,21.4,11,21.4,'stone');
    b.collision(x,z,23,23,41);
    b.box(x,36.1,z,23,1.0,23,'trim');
    b.box(x,38.2,z,20,3.2,20,'stone');
    b.box(x,40,z,22.2,0.7,22.2,'trim');
    for(const dx of [-6,0,6]) {
      b.box(x+dx,41,z,0.65,1.7,0.65,'shade');
    }
    for (const side of [-1,1]) for (const offset of [-6,0,6]) {
      rectWindow(b,x+side*10.8,31.1,z+offset,2.6,5.2,side*Math.PI/2,'trim');
      rectWindow(b,x+offset,31.1,z+side*10.8,2.6,5.2,side<0?Math.PI:0,'trim');
    }
    germanFlag(b,x,40.4,z,8);
  }
  // The west portico and broad stairs establish the public approach.
  for(let step=0;step<10;step++) b.box(0,0.18+step*0.29,59-step*0.8,42,0.36,14-step*0.7,'stone');
  for(let i=0;i<6;i++) column(b,-16+i*6.4,3.1,56,1.12,16.7,'trim',true);
  b.box(0,20.3,55,43,1.2,10.5,'trim');
  triangle(b,0,21,49.3,43,6.4,12,'trim');
  triangle(b,0,21.9,61.42,36,4.4,0.15,'shade');
  for(const x of [-12,-6,0,6,12]) windowArch(b,x,4.1,52.25,3.6,10,0,'trim');
  b.collision(0,0,41,41,47.5);
  b.cyl(0,25.3,0,20.7,2.5,'steel');
  b.dome(0,25.1,0,20,22.4,'glassDome');
  domeRibs(b,0,25.1,0,20.15,22.45,'steel',24,0.13);
  for(let j=1;j<9;j++) {
    const a=j*Math.PI/18;
    b.ring(0,25.1+Math.sin(a)*22.4,0,Math.cos(a)*20.15,0.1,'steel');
  }
  b.cyl(0,34.5,0,2.7,18.6,'steel',7.0,24);
  // Paired spiral ramps are visible through the Foster dome.
  for(let turn=0;turn<2;turn++) for(let i=0;i<72;i++) {
    const a=i*Math.PI*4/72+turn*Math.PI, y=26+i*0.23, r=17.5-i*0.055;
    const c=(i+1)*Math.PI*4/72+turn*Math.PI;
    b.beam([Math.cos(a)*r,y,Math.sin(a)*r],[Math.cos(c)*(r-0.055),y+0.23,Math.sin(c)*(r-0.055)],0.23,'pale');
  }
}

function cathedralCupola(b,x,z,baseY,radius,height) {
  b.cyl(x,baseY+4,z,radius*0.84,8,'stone');
  for(let i=0;i<8;i++) {
    const a=i*Math.PI/4;
    windowArch(b,x+Math.sin(a)*radius*0.85,baseY+0.8,z+Math.cos(a)*radius*0.85,2.2,5.8,a,'trim');
  }
  b.ring(x,baseY+8,z,radius*0.97,0.55,'trim');
  b.dome(x,baseY+8,z,radius,height,'copper');
  domeRibs(b,x,baseY+8,z,radius+0.05,height,'copperDark',12,0.13);
  b.cyl(x,baseY+height+9.4,z,radius*0.19,2.8,'copperDark');
  b.dome(x,baseY+height+10.8,z,radius*0.26,2.1,'copper');
  cross(b,x,baseY+height+12.5,z,3,'gold');
}

function buildDom(b) {
  b.box(0,1.7,0,83,3.4,72,'shade');
  b.box(0,18.9,0,79,34.4,65,'stone');
  b.box(0,36.5,0,81,1.2,67,'trim');
  b.box(0,37.6,0,76,1,62,'roof');
  b.collision(0,0,81,67,39);
  b.collision(0,0,42,42,98);
  // West (+local Z) faces Lustgarten; the east apse (-local Z) faces the
  // Spree. Model all four elevations because the original travel modes can
  // approach this freestanding building from every street and from the air.
  b.cyl(0,18.5,-31.5,17,34,'stone');
  b.cyl(0,36.1,-31.5,17.8,1.6,'trim');
  for (const y of [3.5, 9.3, 19.3, 27.1, 34.2]) b.cyl(0,y,-31.5,17.45,0.5,'shade');
  // The palace-like east front has four storeys, including the curved apse.
  for (let i = 0; i < 7; i++) {
    const angle = Math.PI * (0.625 + i * 0.125);
    const x = Math.sin(angle) * 17.18, z = -31.5 + Math.cos(angle) * 17.18;
    rectWindow(b,x,6.2,z,2.65,3.3,angle,'shade');
    windowArch(b,x,11.1,z,3.1,6.4,angle,'trim');
    rectWindow(b,x,23.1,z,2.9,5.1,angle,'trim');
    windowArch(b,x,29.1,z,2.55,4.4,angle,'shade');
    const divider = angle + Math.PI * 0.0625;
    if (i < 6) pilaster(b,Math.sin(divider)*17.12,4.4,-31.5+Math.cos(divider)*17.12,29.4,0.95,divider,'trim');
  }
  for (const x of [-34, -25, 25, 34]) {
    rectWindow(b,x,6.2,-32.7,3.4,3.3,Math.PI,'shade');
    windowArch(b,x,11,-32.7,4.1,6.6,Math.PI,'trim');
    rectWindow(b,x,23.1,-32.7,3.7,5.1,Math.PI,'trim');
    windowArch(b,x,29.1,-32.7,3.2,4.4,Math.PI,'shade');
  }
  for (const x of [-38.2,-29.5,-20.5,20.5,29.5,38.2]) pilaster(b,x,4.4,-32.8,29.4,1.25,Math.PI);
  for(const x of [-31,-21,-11,11,21,31]) {
    windowArch(b,x,7.2,32.7,4.3,12.2,0,'shade');
    windowArch(b,x,23,32.7,3.5,8.8,0,'trim');
  }
  for(const side of [-1,1]) for(const z of [-22,-11,0,11,22]) {
    windowArch(b,side*39.65,7,z,4,11.5,side*Math.PI/2,'shade');
    rectWindow(b,side*39.65,27.8,z,3.8,5.4,side*Math.PI/2,'trim');
  }
  for (const side of [-1,1]) for (const z of [-28,-16.5,-5.5,5.5,16.5,28]) pilaster(b,side*39.65,4.4,z,29.4,1.35,side*Math.PI/2);
  for (const x of [-37,-26,-16,16,26,37]) pilaster(b,x,4.4,32.7,29.4,1.35,0);
  for(const y of [5,21,33.7]) {
    b.box(0,y,0,80.6,0.65,66.6,'trim');
    // These courses are skins on the perimeter, not new interior floors.
  }
  // Open stone balustrades above the cornice keep the roof from reading as
  // stacked solid boxes when seen from the river or the helicopter.
  for (const z of [-33.5,33.5]) {
    b.box(0,39,z,80.5,0.35,0.7,'trim');
    for (let x=-38;x<=38;x+=3.1) {
      b.cyl(x,38.1,z,0.17,1.5,'stone',0.12,8);
      b.box(x,37.4,z,0.65,0.25,0.65,'trim');
    }
  }
  for (const x of [-40.25,40.25]) {
    b.box(x,39,0,0.7,0.35,67,'trim');
    for (let z=-31;z<=31;z+=3.1) b.cyl(x,38.1,z,0.17,1.5,'stone',0.12,8);
  }
  for(let i=0;i<9;i++) b.box(0,0.3+i*0.34,43-i*0.65,36,0.5,13-i*0.55,'stone');
  b.box(0,17.1,35.5,38,28,6,'stone');
  for(const x of [-15,-9,9,15]) column(b,x,3.8,40.3,1.1,22,'trim');
  for(const x of [-8,0,8]) windowArch(b,x,3.5,39.1,5,15,0,'shade');
  b.box(0,26.2,39,39,1.3,9,'trim');
  triangle(b,0,27,34.4,39,8.7,10.3,'stone');
  triangle(b,0,28,44.8,31,5.9,0.12,'shade');
  b.sphere(0,31,45,2.6,2.8,0.3,'trim');
  for(const x of [-32,32]) for(const z of [-24,24]) {
    b.box(x,36.3,z,16.6,5.6,16.6,'stone');
    b.box(x,39.4,z,17.4,0.8,17.4,'trim');
    cathedralCupola(b,x,z,39.6,8,8.8);
  }
  b.cyl(0,40,0,22,5,'stone',22,16);
  b.cyl(0,49.1,0,18.6,16,'stone',18.6,32);
  for(let i=0;i<16;i++) {
    const a=i*Math.PI/8;
    windowArch(b,Math.sin(a)*18.65,42.2,Math.cos(a)*18.65,3.7,10.6,a,'trim');
    const c=a+Math.PI/16;
    column(b,Math.sin(c)*19.4,41.8,Math.cos(c)*19.4,0.62,14.9,'trim');
  }
  b.cyl(0,57.4,0,20.2,1.9,'trim');
  b.cyl(0,59,0,20.8,1.3,'copperDark');
  b.dome(0,59.4,0,20.8,23,'copper');
  domeRibs(b,0,59.4,0,20.9,23.05,'copperDark',24,0.24);
  b.ring(0,59.6,0,20.8,0.55,'copperDark');
  b.cyl(0,84.4,0,3.25,5.8,'stone',3.25,12);
  for(let i=0;i<8;i++) {
    const a=i*Math.PI/4;
    b.box(Math.sin(a)*3.22,84.7,Math.cos(a)*3.22,1.5,3.8,0.15,'window',[0,a,0]);
  }
  b.dome(0,87.3,0,4.2,4.3,'copper');
  b.cyl(0,92.2,0,0.8,2.0,'gold');
  cross(b,0,93.2,0,4.8);
}

function clockFace(b,x,y,z,rotation) {
  const geometry=new THREE.CylinderGeometry(2.6,2.6,0.15,32);
  const transform=new THREE.Matrix4().makeRotationY(rotation).multiply(new THREE.Matrix4().makeRotationX(Math.PI/2));
  geometry.applyMatrix4(transform);
  b.add(geometry,'trim',[x,y,z]);
  const c=Math.cos(rotation),s=Math.sin(rotation);
  const p=(dx,dy,dz=0.14)=>[x+dx*c+dz*s,y+dy,z-dx*s+dz*c];
  b.ring(...p(0,0),2.7,0.18,'shade',[0,rotation,0]);
  for(let i=0;i<12;i++) {
    const a=i*Math.PI/6;
    b.beam(p(Math.sin(a)*2.08,Math.cos(a)*2.08),p(Math.sin(a)*2.4,Math.cos(a)*2.4),0.08,'black');
  }
  b.beam(p(0,0,0.25),p(-1.5,0.8,0.25),0.12,'black');
  b.beam(p(0,0,0.27),p(1.5,1.5,0.27),0.08,'black');
}

function buildRathaus(b) {
  const wings=[[0,36.5,99,18],[0,-36.5,99,18],[-41,0,17,55],[41,0,17,55],[0,0,15,55]];
  for(const [x,z,w,d] of wings) {
    b.box(x,13.3,z,w,26.6,d,'brick');
    b.box(x,27,z,w+1,1,d+1,'brickLight');
    hipRoof(b,x,27.5,z,w,d,5.3,'roof');
    b.collision(x,z,w,d,32);
  }
  for(const z of [-45.6,45.6]) for(let x=-43;x<=43;x+=7.2) {
    if(z>0 && Math.abs(x)<8) continue;
    windowArch(b,x,3,z,3.8,5.9,z<0?Math.PI:0,'brickLight');
    windowArch(b,x,12.2,z,3.4,6,z<0?Math.PI:0,'sandstone');
    windowArch(b,x,20,z,3.0,4.7,z<0?Math.PI:0,'brickLight');
  }
  for(const side of [-1,1]) for(let z=-34;z<=34;z+=7.5) for(const y of [3,12.2,20]) windowArch(b,side*49.65,y,z,3.2,y===20?4.7:5.9,side*Math.PI/2,y===12.2?'sandstone':'brickLight');
  for(const y of [1.3,10.5,19.2,25.6]) {
    for(const z of [-45.7,45.7]) b.box(0,y,z,100,0.6,0.6,'brickLight');
    for(const x of [-49.7,49.7]) b.box(x,y,0,0.6,0.6,91.4,'brickLight');
  }
  b.box(0,34.5,35,16,69,16,'brick');
  b.collision(0,35,17.5,17.5,74);
  for(const y of [27,39,48,59,69]) b.box(0,y,35,17.5,0.85,17.5,'brickLight');
  for(const x of [-7.7,7.7]) for(const z of [27.3,42.7]) {
    b.box(x,48,z,1.5,43,1.5,'brickLight');
    b.box(x,71.7,z,2.7,4.6,2.7,'brick');
  }
  for(let side=0;side<4;side++) {
    const a=side*Math.PI/2, sx=Math.sin(a),sz=Math.cos(a);
    for (const y of [30.5,40.8]) for (const offset of [-3.1,3.1]) windowArch(b,sx*8.15+Math.cos(a)*offset,y,35+sz*8.15-Math.sin(a)*offset,2.5,5.9,a,'brickLight');
    for(const offset of [-4.1,0,4.1]) windowArch(b,sx*8.1+Math.cos(a)*offset,61,35+sz*8.1-Math.sin(a)*offset,2.4,6.6,a,'brickLight');
    clockFace(b,sx*8.2,53,35+sz*8.2,a);
    for(const offset of [-5,-2.5,0,2.5,5]) b.box(sx*8+Math.cos(a)*offset,71.4,35+sz*8-Math.sin(a)*offset,1.4,3.0,1.4,'brickLight');
  }
  windowArch(b,0,1,45.8,5.4,8.2,0,'sandstone');
  for(const x of [-5,5]) b.box(x,6,46.4,1,12,1.6,'brickLight');
}

function barrelRoof(b,x,y,z,length,width,height) {
  const positions=[];
  const radius=width/2;
  for(let i=0;i<20;i++) {
    const a=i*Math.PI/20,c=(i+1)*Math.PI/20;
    const ya=y+Math.sin(a)*height,za=z+Math.cos(a)*radius;
    const yc=y+Math.sin(c)*height,zc=z+Math.cos(c)*radius;
    positions.push(x-length/2,ya,za,x+length/2,ya,za,x+length/2,yc,zc,x-length/2,ya,za,x+length/2,yc,zc,x-length/2,yc,zc);
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.computeVertexNormals();
  b.add(geometry,'glass');
  for(let xx=-length/2;xx<=length/2+0.1;xx+=10) for(let i=0;i<20;i++) {
    const a=i*Math.PI/20,c=(i+1)*Math.PI/20;
    b.beam([x+xx,y+Math.sin(a)*height+0.1,z+Math.cos(a)*radius],[x+xx,y+Math.sin(c)*height+0.1,z+Math.cos(c)*radius],0.15,'steel');
  }
  for(let i=0;i<=10;i++) {
    const a=i*Math.PI/10;
    b.beam([x-length/2,y+Math.sin(a)*height+0.1,z+Math.cos(a)*radius],[x+length/2,y+Math.sin(a)*height+0.1,z+Math.cos(a)*radius],0.12,'steel');
  }
}

function buildHauptbahnhof(b) {
  b.box(0,0.45,0,180,0.9,165,'shade');
  b.box(0,5.5,0,170,10,155,'glass');
  b.box(0,11,0,173,1.1,157,'steel');
  b.collision(0,0,170,155);
  // East-west S-Bahn shed, with parallel rails visible at both ends.
  b.box(0,11.8,0,320,1.3,66,'concrete');
  for(const z of [-24,-15,-6,6,15,24]) {
    b.box(0,12.6,z,320,0.3,1.6,'roof');
    for(const dz of [-0.75,0.75]) b.box(0,12.9,z+dz,320,0.18,0.13,'steel');
  }
  barrelRoof(b,0,17,0,321,67,13);
  for(const x of [-150,-120,120,150]) for(const z of [-28,28]) b.box(x,8.5,z,1.5,17,1.5,'steel');
  for(const x of [-61,61]) {
    for(const z of [-49,49]) {
      b.box(x,28,z,31,34,64,'glass');
      b.box(x,45.5,z,32,1,65,'steel');
    }
    b.box(x,38,0,31,15,35,'glass');
    b.box(x,45.5,0,32,1,35,'steel');
    // Regular curtain wall grids, visible from all approaches.
    for(const side of [-1,1]) {
      for(let z=-81;z<=81;z+=5.8) b.box(x+side*15.65,28.3,z,0.18,34,0.18,'steel');
      for(let y=13;y<=44;y+=3.8) b.box(x+side*15.7,y,0,0.2,0.18,163,'steel');
    }
    for(const z of [-81.2,81.2]) {
      for(let dx=-15;dx<=15;dx+=5) b.box(x+dx,28.3,z,0.18,34,0.18,'steel');
      for(let y=13;y<=44;y+=3.8) b.box(x,y,z,31,0.18,0.2,'steel');
    }
  }
  // Central north-south entrance volume and its exposed structural ribs.
  b.box(0,21,0,67,39,163,'glass');
  b.box(0,41,0,68,0.7,165,'steel');
  for(const z of [-82,82]) for(let x=-32;x<=32;x+=5.4) {
    b.box(x,20.8,z,0.35,39,0.4,'steel');
    if(Math.abs(x)>6) b.beam([x,2,z+0.3],[x+4,39,z+0.3],0.12,'steel');
  }
  for(const z of [-82.2,82.2]) for(let y=5;y<=40;y+=4.5) b.box(0,y,z,67,0.2,0.2,'steel');
  for(let z=-80;z<=80;z+=8) b.box(0,41.4,z,68,0.2,0.2,'steel');
  for (const x of [-33.65,33.65]) {
    for (let z=-80;z<=80;z+=5.4) b.box(x,21,z,0.22,39,0.25,'steel');
    for (let y=5;y<=40;y+=4.5) b.box(x,y,0,0.25,0.2,163,'steel');
  }
  for(const side of [-1,1]) {
    b.box(0,4.7,side*83,28,8,0.3,'window');
    for(const x of [-12,-6,0,6,12]) b.box(x,4.6,side*83.3,0.2,8,0.3,'steel');
    b.box(0,10,side*84.5,42,0.5,5,'steel');
    // A red station sign panel, deliberately texture-free.
    b.box(0,17.5,side*82.6,5.4,3.1,0.35,'red');
    b.box(0,17.5,side*82.85,4.4,2.2,0.15,'white');
    b.box(0,17.5,side*83,3.8,1.6,0.15,'red');
  }
}

function onionDome(b,x,y,z,radius,height,mat='gold') {
  const profile=[[0,0],[radius*0.76,0],[radius*0.9,height*0.12],[radius,height*0.3],[radius*0.94,height*0.48],[radius*0.7,height*0.72],[radius*0.27,height*0.91],[0,height]];
  const geometry=new THREE.LatheGeometry(profile.map(([r,h])=>new THREE.Vector2(r,h)),32);
  b.add(geometry,mat,[x,y,z]);
  for(let i=0;i<16;i++) {
    const a=i*Math.PI/8;
    for(let j=1;j<profile.length-1;j++) {
      const [r,h]=profile[j],[r2,h2]=profile[j+1];
      b.beam([x+Math.cos(a)*(r+0.04),y+h,z+Math.sin(a)*(r+0.04)],[x+Math.cos(a)*(r2+0.04),y+h2,z+Math.sin(a)*(r2+0.04)],0.09,'goldLight');
    }
  }
}

function buildSynagoge(b) {
  b.box(0,13.3,0,36,26.6,34,'sandstone');
  b.box(0,7,-22,27,14,19,'brick');
  b.box(0,27,0,37,0.7,35,'trim');
  hipRoof(b,0,27.4,-6,33,22,3,'roof');
  b.collision(0,-6,36,46,31);
  b.collision(0,2,21,21,50);
  for(const x of [-14.5,14.5]) {
    b.box(x,15,4,6,30,28,'brick');
    b.box(x,30.3,4,7.3,0.8,29,'sandstone');
    b.cyl(x,32,10,3.5,3.5,'sandstone');
    onionDome(b,x,33.7,10,4.1,5.7,'gold');
    b.cyl(x,40.1,10,0.15,1.6,'gold');
  }
  for(const y of [3,6.5,10,13.5,17,20.5,24]) b.box(0,y,17.12,36,0.65,0.25,'brick');
  for(const x of [-8,0,8]) windowArch(b,x,1.0,17.3,5.3,8.6,0,'brickDark');
  for(const x of [-14.5,14.5]) for(const y of [12,21]) windowArch(b,x,y,18.1,3.5,6.5,0,'sandstone');
  // Visible return walls and the restored rear wing are articulated too.
  for (const side of [-1,1]) {
    for (const z of [-12,-4,5,13]) for (const y of [3.2,13.2,22]) windowArch(b,side*18.15,y,z,2.4,y===22?3.5:6.2,side*Math.PI/2,'brickDark');
    for (const z of [-15,-8,0,8,15]) pilaster(b,side*18.2,1,z,24.7,0.75,side*Math.PI/2,'brick');
  }
  for (const x of [-10,-5,0,5,10]) {
    rectWindow(b,x,5,-31.7,2.5,4.5,Math.PI,'sandstone');
    rectWindow(b,x,11,-31.7,2.5,3.8,Math.PI,'sandstone');
    windowArch(b,x,17.4,-17.2,2.7,6.8,Math.PI,'brickDark');
  }
  // Central rose window with radial tracery.
  const disk=new THREE.CircleGeometry(4.5,32);
  b.add(disk,'window',[0,20.5,17.5]);
  b.ring(0,20.5,17.65,4.6,0.5,'brickDark',[0,0,0]);
  b.ring(0,20.5,17.8,3.5,0.16,'sandstone',[0,0,0]);
  for(let i=0;i<12;i++) {
    const a=i*Math.PI/6;
    b.beam([0,20.5,17.9],[Math.cos(a)*4.4,20.5+Math.sin(a)*4.4,17.9],0.08,'sandstone');
  }
  b.cyl(0,30.3,2,8.7,8,'sandstone',8.7,16);
  for(let i=0;i<12;i++) {
    const a=i*Math.PI/6;
    windowArch(b,Math.sin(a)*8.75,27.4,2+Math.cos(a)*8.75,2.5,5.6,a,'brickDark');
  }
  b.cyl(0,34.6,2,9.4,0.8,'gold');
  onionDome(b,0,35,2,10.3,12.3,'gold');
  b.cyl(0,48.4,2,0.2,2.2,'gold');
  b.sphere(0,49.6,2,0.4,0.4,0.4,'goldLight');
  for(const x of [-10.8,10.8]) b.box(x,26,17.8,1.6,5,1.1,'brickDark');
}

function buildGendarmenmarkt(b) {
  // Sub-builders keep the independently oriented buildings geographically true.
  const makeSub=(lon,lat,rotation)=> {
    const [x,z]=project(lon,lat);
    return new Builder({...b.landmark,x,z,rotation},b.materials,b.parent);
  };
  const twins=[
    {lon:13.3923878,lat:52.5143954,north:true},
    {lon:13.3926676,lat:52.5127461,north:false},
  ];
  for(const twin of twins) {
    const c=makeSub(twin.lon,twin.lat,Math.PI/2+0.095);
    const wall=twin.north?'pale':'stone';
    c.box(0,9,-24,35,18,43,wall);
    c.box(0,18.4,-24,37,1,45,'trim');
    hipRoof(c,0,19,-24,36,44,7.2,'roof');
    c.collision(0,-24,36,44,26.2);
    c.cyl(0,12.5,0,17.2,25,wall,17.2,32);
    c.cyl(0,25.6,0,18.3,1.6,'trim');
    c.collision(0,0,33,33);
    for(let i=0;i<12;i++) {
      const a=i*Math.PI/6;
      windowArch(c,Math.sin(a)*17.3,6,Math.cos(a)*17.3,4.5,11.5,a,'shade');
      const d=a+Math.PI/12;
      column(c,Math.sin(d)*17.6,3.5,Math.cos(d)*17.6,0.7,20,'trim');
    }
    for(let step=0;step<8;step++) c.box(0,0.2+step*0.3,24-step*0.7,24,0.4,12-step*0.6,'stone');
    for(const x of [-9,-5.4,-1.8,1.8,5.4,9]) column(c,x,2.6,18.4,0.72,14.5,'trim',true);
    c.box(0,17.8,18.5,24,1,8,'trim');
    triangle(c,0,18.4,14,24,5.4,9,'trim');
    c.cyl(0,29.6,0,12.6,6.6,wall,12.6,24);
    c.cyl(0,42.9,0,10.1,20,wall,10.1,32);
    for(let i=0;i<12;i++) {
      const a=i*Math.PI/6;
      windowArch(c,Math.sin(a)*10.18,34,Math.cos(a)*10.18,3.3,14,a,'shade');
      const d=a+Math.PI/12;
      column(c,Math.sin(d)*10.8,33,Math.cos(d)*10.8,0.65,19.4,'trim');
    }
    c.cyl(0,53.3,0,11.4,1.4,'trim');
    c.dome(0,54,0,11.8,11.2,'copper');
    domeRibs(c,0,54,0,11.85,11.3,'copperDark',16,0.16);
    c.cyl(0,66.2,0,2.1,3.6,'stone',2.1,12);
    c.dome(0,68,0,2.7,2,'copper');
    c.cyl(0,70.7,0,0.4,1.5,'bronze',0.15,8);
    c.sphere(0,71.7,0,0.28,0.3,0.28,'bronze');
    for(const side of [-1,1]) for(const z of [-39,-28,-17]) windowArch(c,side*17.6,4,z,3.6,10,side*Math.PI/2,'trim');
    for (const x of [-11,-5.5,0,5.5,11]) windowArch(c,x,4,-45.7,3.4,10,Math.PI,'trim');
    for (const x of [-15,-8,8,15]) pilaster(c,x,1,-45.8,16,0.9,Math.PI,'trim');
    b.colliders.push(...c.finish());
  }
  const c=makeSub(13.3918992,52.5135806,Math.PI/2+0.095);
  c.box(0,12.8,-3,83,25.6,55,'stone');
  c.box(0,26,-3,85,1.1,57,'trim');
  c.box(0,29,-8,54,5,43,'stone');
  hipRoof(c,0,31.6,-8,57,46,7.5,'roof');
  c.collision(0,-3,85,57,39.2);
  for(let step=0;step<17;step++) c.box(0,0.25+step*0.32,35-step*0.55,32,0.4,22-step*0.56,'stone');
  for(const x of [-13,-7.8,-2.6,2.6,7.8,13]) column(c,x,6,26.3,0.9,18.3,'trim',true);
  c.box(0,24.8,25,35,1,12,'trim');
  triangle(c,0,25.5,18.6,36,8.4,13,'trim');
  triangle(c,0,26.8,31.75,29,5.5,0.14,'shade');
  for(const x of [-35,-28,-21,21,28,35]) {
    windowArch(c,x,3,24.7,3.7,8,0,'shade');
    rectWindow(c,x,18.8,24.7,3.8,7.2,0,'trim');
  }
  for(const side of [-1,1]) for(let z=-23;z<=17;z+=8) {
    windowArch(c,side*41.7,3,z,4,8,side*Math.PI/2,'shade');
    rectWindow(c,side*41.7,18,z,4,7.6,side*Math.PI/2,'trim');
  }
  for (let x=-35;x<=35;x+=7) {
    windowArch(c,x,3,-30.7,3.5,8,Math.PI,'shade');
    rectWindow(c,x,18.8,-30.7,3.7,7.2,Math.PI,'trim');
  }
  for (let x=-39;x<=39;x+=13) pilaster(c,x,2,-30.8,22,1.1,Math.PI,'trim');
  // Apollo and the lyre crown the main pediment.
  c.cyl(0,35,27,0.65,2.2,'bronze',0.4,10);
  c.sphere(0,36.5,27,0.4,0.45,0.4,'bronze');
  c.beam([0,35,27],[2,36,27],0.15,'bronze');
  c.ring(2.2,35.6,27,0.75,0.16,'bronze',[0,0,0]);
  b.colliders.push(...c.finish());
}

// Expansion anchors use the original metre projection and the same batched
// NodeMaterials as Mitte. Ground routes stay level with the upstream controls.
function archScreen(b, x, y, z, width, opening, height, spring, depth, rotation = 0, mat = 'brick') {
  const r = opening / 2, half = width / 2;
  const shape = new THREE.Shape();
  shape.moveTo(-half, 0); shape.lineTo(-half, height); shape.lineTo(half, height);
  shape.lineTo(half, 0); shape.lineTo(r, 0); shape.lineTo(r, spring);
  shape.absarc(0, spring, r, 0, Math.PI, false);
  shape.lineTo(-r, 0); shape.closePath();
  b.add(new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 10 }), mat, [x, y, z], [1, 1, 1], [0, rotation, 0]);
}

function buildOberbaum(b) {
  // Road OSM ways4686103/4686104 define the axis. Gallery288514445 is on
  // its southeast side. The two towers flank the central span longitudinally.
  b.box(0, -0.19, 0, 26, 0.4, 150, 'concrete');
  for (const x of [-14, 12.5]) {
    b.box(x, 0.2, 0, 1.1, 0.4, 150, 'stone');
    b.box(x, 1.1, 0, 0.18, 0.18, 150, 'iron');
    for (let z = -74; z <= 74; z += 2.5) b.box(x, 0.65, z, 0.09, 0.9, 0.09, 'iron');
  }
  // Elevated U-Bahn deck and two tracks; the driving deck remains at y=0.
  b.box(-12.5, 9.75, 23, 8.4, 0.5, 196, 'brick');
  b.box(-12.5, 10.03, 23, 8.2, 0.12, 196, 'roof');
  for (const x of [-14.7, -13.265, -11.65, -10.215]) b.box(x, 10.2, 23, 0.09, 0.16, 196, 'steel');
  for (let z = -74; z <= 120; z += 1.1) b.box(-12.5, 10.12, z, 5.9, 0.12, 0.17, 'darkSteel');
  for (const side of [-1, 1]) {
    const first = side < 0 ? -72.5 : 19.8;
    for (let i = 0; i < (side < 0 ? 12 : 21); i++) {
      const z = first + i * 4.8;
      for (const x of [-16.6, -8.9]) {
        archScreen(b, x, 0.2, z, 4.8, 3.6, 8.8, 3.6, 0.6, Math.PI / 2, 'brick');
        b.ring(x + 0.67, 3.8, z, 1.84, 0.15, 'sandstone', [0, Math.PI / 2, 0], Math.PI);
        for (const dz of [-2.2, 2.2]) {
          b.box(x + 0.3, 4.5, z + dz, 0.9, 8.6, 0.37, 'brickLight');
          b.box(x + 0.3, 8.7, z + dz, 1, 0.3, 0.8, 'sandstone');
        }
        // Decorative blind lancets below the upper parapet.
        for (const dz of [-1.5, 0, 1.5]) windowArch(b, x + 0.69, 7.1, z + dz, 0.48, 1.2, Math.PI / 2, 'brickDark', 'brickDark');
      }
    }
  }
  for (const x of [-16.6, -8.3]) {
    b.box(x, 9.25, 23, 0.65, 0.5, 196, 'sandstone');
    b.box(x, 10.65, 23, 0.45, 0.7, 196, 'brick');
    b.box(x, 11.03, 23, 0.65, 0.2, 196, 'sandstone');
    for (let z = -74; z <= 120; z += 2.3) b.box(x, 11.3, z, 0.55, 0.5, 0.8, 'brickLight');
  }
  // Slender modern steel arch replaces the lost masonry central gallery span.
  for (const x of [-16.4, -8.6]) {
    for (let i = 0; i < 20; i++) {
      const z0 = -15.5 + i * 1.485, z1 = z0 + 1.485;
      const y0 = 1.4 + 5.8 * (1 - ((z0 + 0.65) / 14.85) ** 2), y1 = 1.4 + 5.8 * (1 - ((z1 + 0.65) / 14.85) ** 2);
      b.beam([x, y0, z0], [x, y1, z1], 0.3, 'darkSteel');
      if (i % 2 === 0) b.beam([x, y0, z0], [x, 9.5, z0], 0.09, 'steel');
    }
    b.beam([x, 9.35, -16], [x, 9.35, 15], 0.23, 'darkSteel');
  }
  for (const z of [-15.5, 14.2]) {
    const x = -19.5;
    b.cyl(x, 0.6, z, 5.2, 1.2, 'stone', 4.8, 8);
    b.box(x, 6, z, 7.6, 10.8, 7.6, 'stone');
    b.box(x, 11.7, z, 8.4, 0.65, 8.4, 'sandstone');
    b.cyl(x, 13, z, 4.8, 2.1, 'brickLight', 4.2, 8);
    b.cyl(x, 19, z, 3.6, 10, 'brick', 3.6, 16);
    b.cyl(x, 24.3, z, 4.1, 0.8, 'brickLight', 4.1, 16);
    b.cyl(x, 28.4, z, 3.75, 7.7, 'terracotta', 0.3, 16);
    for (let i = 0; i < 8; i++) {
      const a = i * Math.PI / 4;
      const dx = Math.sin(a), dz = Math.cos(a);
      windowArch(b, x + dx * 3.68, 17, z + dz * 3.68, 0.9, 3.7, a, 'sandstone');
      b.box(x + dx * 4, 25.2, z + dz * 4, 0.7, 1.6, 0.7, 'brickDark', [0, a, 0]);
      b.beam([x + dx * 3.77, 24.6, z + dz * 3.77], [x, 32.3, z], 0.07, 'brickDark');
    }
    for (const a of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
      windowArch(b, x + Math.sin(a) * 3.85, 3.4, z + Math.cos(a) * 3.85, 2.2, 5.4, a, 'sandstone');
      windowArch(b, x + Math.sin(a) * 4.3, 12, z + Math.cos(a) * 4.3, 1.4, 1.6, a, 'sandstone', 'brickDark');
    }
    b.cyl(x, 32.7, z, 0.07, 2.2, 'iron');
    b.sphere(x, 33.3, z, 0.23, 0.23, 0.23, 'gold');
    b.collision(x, z, 7.9, 7.9, 34);
  }
  // Bank piers and the smaller neo-Gothic gate towers mark both landings.
  for (const z of [-72, 72]) {
    for (const x of [-16.4, -8.6]) {
      b.box(x, 5.5, z, 1.5, 11, 2, 'brick');
      b.cyl(x, 12, z, 1.1, 3, 'brickLight', 0.8, 8);
      b.cyl(x, 14.1, z, 1.1, 2.1, 'terracotta', 0.02, 8);
      b.collision(x, z, 1.6, 2, 15.2);
    }
  }
}

function buildKreuzbergDenkmal(b) {
  // Schinkel's 18.8m iron monument stands on the later 8m octagonal vault.
  // The original city has flat terrain, so no inaccessible artificial hill is
  // introduced: the walkable park remains level around the monument's plinth.
  for (let i = 0; i < 5; i++) b.cyl(0, 0.16 + i * 0.32, 0, 18.5 - i * 0.8, 0.32, 'stone', 18.5 - i * 0.8, 8);
  b.cyl(0, 4.6, 0, 14.2, 6.4, 'sandstone', 14.2, 8);
  b.cyl(0, 7.9, 0, 14.6, 0.45, 'trim', 14.6, 8);
  for (let i = 0; i < 8; i++) {
    const a = (i + 0.5) * Math.PI / 4;
    windowArch(b, Math.sin(a) * 13.18, 2.1, Math.cos(a) * 13.18, 3.7, 4.2, a, 'stone', 'iron');
    b.beam([Math.sin(a) * 14.1, 8.2, Math.cos(a) * 14.1], [Math.sin(a) * 14.1, 9.4, Math.cos(a) * 14.1], 0.065, 'iron');
  }
  for (let i = 0; i < 48; i++) {
    const a = i * Math.PI / 24, next = (i + 1) * Math.PI / 24;
    b.beam([Math.sin(a) * 13.6, 8.2, Math.cos(a) * 13.6], [Math.sin(a) * 13.6, 9.2, Math.cos(a) * 13.6], 0.035, 'iron');
    b.beam([Math.sin(a) * 13.6, 9.2, Math.cos(a) * 13.6], [Math.sin(next) * 13.6, 9.2, Math.cos(next) * 13.6], 0.05, 'iron');
  }
  b.cyl(0, 8.7, 0, 6.4, 1.2, 'iron', 6.2, 12);
  b.cyl(0, 11.1, 0, 4.7, 4, 'iron', 4.5, 12);
  b.cyl(0, 13.8, 0, 3.8, 1.4, 'iron', 3.6, 12);
  for (let i = 0; i < 12; i++) {
    const a = i * Math.PI / 6, x = Math.sin(a), z = Math.cos(a);
    windowArch(b, x * 4.7, 9.4, z * 4.7, 1.5, 3.3, a, 'iron', 'black');
    // Twelve sculpted figures and canopies, with separate heads and drapery.
    b.cyl(x * 4.95, 10.2, z * 4.95, 0.32, 1.5, 'iron', 0.19, 8);
    b.sphere(x * 4.95, 11.13, z * 4.95, 0.23, 0.27, 0.23, 'iron');
    b.beam([x * 4.95, 10.9, z * 4.95], [x * 5.3, 10.4, z * 5.3], 0.09, 'iron');
    triangle(b, x * 4.8, 12.6, z * 4.8, 1.8, 2.3, 0.4, 'iron', a);
    const edge = a + Math.PI / 12;
    for (let j = 0; j < 4; j++) {
      const y0 = 12.2 + j * 2.5, y1 = y0 + 2.5;
      const r0 = 4.8 * (1 - j / 5), r1 = 4.8 * (1 - (j + 1) / 5);
      b.beam([Math.sin(edge) * r0, y0, Math.cos(edge) * r0], [Math.sin(edge) * r1, y1, Math.cos(edge) * r1], 0.12, 'iron');
      b.sphere(Math.sin(edge) * r0, y0, Math.cos(edge) * r0, 0.21, 0.25, 0.21, 'iron');
    }
    b.cyl(Math.sin(edge) * 5.4, 13.8, Math.cos(edge) * 5.4, 0.18, 7, 'iron', 0.02, 6);
  }
  b.cyl(0, 19, 0, 2.3, 9, 'iron', 0.18, 12);
  for (const [y, r] of [[15.5, 3.4], [18, 2.5], [21, 1.5], [23.5, 0.7]]) b.ring(0, y, 0, r, 0.15, 'iron');
  b.box(0, 25.1, 0, 0.45, 3.7, 0.45, 'iron');
  b.box(0, 25.8, 0, 2.7, 0.55, 0.45, 'iron');
  // Expanded arms reproduce the Iron Cross at the pinnacle.
  for (const x of [-1.1, 1.1]) b.box(x, 25.8, 0, 0.65, 1.1, 0.5, 'iron');
  b.box(0, 26.8, 0, 1.1, 0.55, 0.5, 'iron');
  b.collision(0, 0, 28, 28, 27.1);
}

function buildFrankfurterTor(b) {
  // These are the two actual tower footprints, not the centre of the junction.
  // Adjacent apartment wings remain the surveyed OSM buildings, preserving
  // their full street blocks rather than replacing them with invented wings.
  for (const [lon, lat] of [[13.45273305, 52.51650145], [13.4525117, 52.51565755]]) {
    const [x, z] = project(lon, lat);
    const c = new Builder({ ...b.landmark, x, z, rotation: -0.159 }, b.materials, b.parent);
    c.box(0, 2.4, 0, 17, 4.8, 16, 'stone');
    c.box(0, 20.2, 0, 17, 30.8, 16, 'pale');
    for (const y of [4.8, 34.6, 35.5, 37]) c.box(0, y, 0, 18.2, 0.5, 17.2, 'trim');
    for (const side of [-1, 1]) {
      for (const dx of [-5.8, -2.9, 0, 2.9, 5.8]) {
        windowArch(c, dx, 0.5, side * 8.12, 1.8, 3.7, side > 0 ? 0 : Math.PI, 'shade');
        for (let floor = 0; floor < 9; floor++) rectWindow(c, dx, 6.9 + floor * 3.1, side * 8.13, 1.45, 2.2, side > 0 ? 0 : Math.PI, 'trim');
      }
      for (const dz of [-5.4, -2.7, 0, 2.7, 5.4]) {
        windowArch(c, side * 8.62, 0.5, dz, 1.8, 3.7, side * Math.PI / 2, 'shade');
        for (let floor = 0; floor < 9; floor++) rectWindow(c, side * 8.63, 6.9 + floor * 3.1, dz, 1.45, 2.2, side * Math.PI / 2, 'trim');
      }
      for (const dx of [-7.7, 7.7]) pilaster(c, dx, 5, side * 8.18, 28.8, 0.65, side > 0 ? 0 : Math.PI, 'trim');
    }
    c.cyl(0, 37.9, 0, 7.8, 1.4, 'stone', 7.8, 16);
    c.cyl(0, 42.5, 0, 6.1, 8.4, 'glass', 6.1, 24);
    c.cyl(0, 47, 0, 7.1, 0.6, 'trim', 7.1, 32);
    c.cyl(0, 51, 0, 4.8, 7.4, 'glass', 4.8, 24);
    for (let i = 0; i < 16; i++) {
      const a = i * Math.PI / 8;
      column(c, Math.sin(a) * 6.25, 38.6, Math.cos(a) * 6.25, 0.23, 7.8, 'trim');
      column(c, Math.sin(a) * 4.95, 47.5, Math.cos(a) * 4.95, 0.19, 7.2, 'trim');
      c.beam([Math.sin(a) * 7.1, 37.6, Math.cos(a) * 7.1], [Math.sin(a) * 7.1, 38.8, Math.cos(a) * 7.1], 0.05, 'steel');
    }
    c.ring(0, 38.8, 0, 7.1, 0.06, 'steel');
    c.cyl(0, 55.1, 0, 5.5, 0.8, 'trim', 5.5, 32);
    c.dome(0, 55.5, 0, 5.35, 6.8, 'copper');
    domeRibs(c, 0, 55.5, 0, 5.4, 6.8, 'copperDark', 16, 0.085);
    c.cyl(0, 63.2, 0, 0.8, 1.8, 'copper', 0.8, 12);
    c.dome(0, 64.1, 0, 1.1, 1.1, 'copper');
    c.cyl(0, 65.5, 0, 0.09, 1, 'gold');
    c.collision(0, 0, 17.4, 16.4, 66);
    b.colliders.push(...c.finish());
  }
}

function palaceWing(b, x, z, width, depth, height, roofHeight, mat = 'palace') {
  b.box(x, height / 2, z, width, height, depth, mat);
  b.box(x, 0.7, z, width + 0.4, 1.4, depth + 0.4, 'stone');
  for (const y of [height / 2, height - 0.5, height + 0.2]) b.box(x, y, z, width + 0.7, 0.35, depth + 0.7, 'trim');
  hipRoof(b, x, height + 0.4, z, width + 1.1, depth + 1.1, roofHeight, 'terracotta');
  const sides = [
    { ox: 0, oz: depth / 2 + 0.14, span: width, angle: 0 },
    { ox: 0, oz: -depth / 2 - 0.14, span: width, angle: Math.PI },
    { ox: width / 2 + 0.14, oz: 0, span: depth, angle: Math.PI / 2 },
    { ox: -width / 2 - 0.14, oz: 0, span: depth, angle: -Math.PI / 2 },
  ];
  for (const face of sides) {
    const count = Math.max(1, Math.floor(face.span / 4.7));
    for (let i = 0; i < count; i++) {
      const along = (i - (count - 1) / 2) * face.span / count;
      const wx = x + face.ox + Math.cos(face.angle) * along;
      const wz = z + face.oz - Math.sin(face.angle) * along;
      windowArch(b, wx, 1.8, wz, 1.8, Math.min(4.3, height * 0.35), face.angle, 'trim');
      rectWindow(b, wx, height * 0.73, wz, 1.8, Math.min(3.5, height * 0.27), face.angle, 'trim');
      if (i % 2 === 0) {
        const dx = Math.cos(face.angle) * 2.1, dz = -Math.sin(face.angle) * 2.1;
        pilaster(b, wx + dx, 1.5, wz + dz, height - 2, 0.55, face.angle, 'trim');
      }
    }
  }
  // Roof dormers and chimneys retain the long palace's rhythm at aerial range.
  if (width > depth) for (let dx = -width / 2 + 7; dx < width / 2 - 3; dx += 12) {
    for (const side of [-1, 1]) {
      const dz = side * depth * 0.27;
      b.box(x + dx, height + 1.9, z + dz, 1.9, 2.5, 1.6, 'palace');
      rectWindow(b, x + dx, height + 1.9, z + dz + side * 0.86, 1, 1.6, side > 0 ? 0 : Math.PI, 'trim');
      hipRoof(b, x + dx, height + 3.2, z + dz, 2.1, 2, 0.8, 'terracotta');
    }
    if (Math.round(dx) % 3 === 0) b.box(x + dx, height + roofHeight, z, 0.9, 2, 0.8, 'stone');
  }
  b.collision(x, z, width, depth, height + roofHeight + 0.8);
}

function buildCharlottenburg(b) {
  // Surveyed west/east wings extend about500m; the courtyard opens south.
  palaceWing(b, 0, -3, 136, 20, 18.5, 6.5);
  palaceWing(b, -41.5, 41, 11.7, 68, 14.5, 5.5);
  palaceWing(b, 41.5, 41, 11.7, 68, 14.5, 5.5);
  for (const x of [-41.5, 41.5]) palaceWing(b, x, 75, 17, 12, 16.7, 5.3);
  palaceWing(b, -144, 7, 152, 13.5, 11.7, 5.8);
  palaceWing(b, 145, 7, 154, 13.5, 13.7, 5.8);
  palaceWing(b, -247, 7, 52, 20, 14, 6);
  for (const x of [-68, 68]) palaceWing(b, x, 0, 17, 28, 18.5, 5.3);
  // The central risalit and copper crown are modelled above their true anchor.
  b.box(0, 13.2, 3.5, 16, 26.4, 17, 'palace');
  for (const side of [-1, 1]) {
    for (const x of [-5.2, 0, 5.2]) {
      windowArch(b, x, 1.3, 3.5 + side * 8.65, 2.6, 5.5, side > 0 ? 0 : Math.PI, 'shade');
      rectWindow(b, x, 11.4, 3.5 + side * 8.66, 2.4, 4.2, side > 0 ? 0 : Math.PI, 'trim');
      pilaster(b, x + 1.9, 7.5, 3.5 + side * 8.7, 10, 0.55, side > 0 ? 0 : Math.PI, 'trim');
    }
    triangle(b, 0, 17.8, 3.5 + side * 8.9, 15.5, 4.3, 0.4, 'trim', side > 0 ? 0 : Math.PI);
    clockFace(b, 0, 23.7, 3.5 + side * 8.78, side > 0 ? 0 : Math.PI);
  }
  b.cyl(0, 29.6, 2, 6.4, 7, 'palace', 6.4, 8);
  b.cyl(0, 33.3, 2, 7.2, 0.65, 'trim', 7.2, 16);
  for (let i = 0; i < 8; i++) {
    const a = (i + 0.5) * Math.PI / 4;
    windowArch(b, Math.sin(a) * 5.98, 27.4, 2 + Math.cos(a) * 5.98, 2.1, 4.5, a, 'trim');
  }
  onionDome(b, 0, 33.6, 2, 7.8, 7.7, 'copper');
  b.cyl(0, 42.5, 2, 1.8, 3.3, 'copper', 1.8, 12);
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4;
    b.beam([Math.sin(a) * 1.6, 41.1, 2 + Math.cos(a) * 1.6], [Math.sin(a) * 1.6, 44.4, 2 + Math.cos(a) * 1.6], 0.1, 'gold');
  }
  b.dome(0, 44.2, 2, 2.3, 1.5, 'copper');
  b.cyl(0, 46.3, 2, 0.2, 1.3, 'gold', 0.14, 8);
  b.sphere(0, 47.2, 2, 0.18, 0.24, 0.18, 'gold');
  b.beam([0, 46.7, 2], [1, 47.7, 2], 0.08, 'gold');
  b.beam([0, 46.7, 2], [-0.8, 46.9, 2.4], 0.08, 'gold');
  b.collision(0, 3.5, 16, 17, 48);
  // Courtyard equestrian statue; the full cobbled court remains traversable.
  b.box(0, 1, 51, 6, 2, 4.1, 'stone');
  b.box(0, 2.7, 51, 4.3, 1.5, 2.5, 'stone');
  b.sphere(0, 5.25, 51, 0.65, 0.82, 1.8, 'bronze');
  b.beam([0, 5.4, 52], [0, 6.4, 52.5], 0.4, 'bronze');
  b.sphere(0, 6.6, 52.7, 0.35, 0.43, 0.7, 'bronze');
  for (const side of [-1, 1]) for (const z of [50, 52]) b.beam([side * 0.4, 5, z], [side * 0.46, 3.5, z + 0.25], 0.15, 'bronze');
  b.cyl(0, 6.5, 50.7, 0.4, 1.6, 'bronze', 0.28, 10);
  b.sphere(0, 7.55, 50.7, 0.28, 0.32, 0.28, 'bronze');
  b.beam([0, 6.9, 50.7], [0.9, 6.4, 52], 0.12, 'bronze');
  b.beam([0, 5.6, 49.5], [0, 4.1, 48.9], 0.17, 'bronze');
  b.collision(0, 51, 6, 4.1, 7.9);
  // Front enclosure, with a broad central entrance aligned to Schloßstraße.
  for (const side of [-1, 1]) {
    b.box(side * 27.5, 0.4, 82, 31, 0.8, 0.5, 'stone');
    for (let dx = 12; dx <= 43; dx += 1.1) b.box(side * dx, 1.4, 82, 0.06, 2, 0.06, 'iron');
    b.box(side * 27.5, 2.25, 82, 31, 0.1, 0.1, 'gold');
    b.box(side * 10.5, 1.7, 82, 1.2, 3.4, 1.2, 'stone');
    b.sphere(side * 10.5, 3.7, 82, 0.5, 0.5, 0.5, 'stone');
  }
}

function blueGlassPrism(b, x, z, radius, sides, base, height, rotation = 0) {
  const halfAngle = Math.PI / sides;
  const apothem = radius * Math.cos(halfAngle), width = 2 * radius * Math.sin(halfAngle);
  b.add(new THREE.CylinderGeometry(radius, radius, height, sides), 'blueGlass', [x, base + height / 2, z], [1, 1, 1], [0, rotation, 0]);
  b.add(new THREE.CylinderGeometry(radius + 0.15, radius + 0.15, 0.55, sides), 'blueConcrete', [x, base + height, z], [1, 1, 1], [0, rotation, 0]);
  for (let i = 0; i < sides; i++) {
    const angle = rotation + (i + 0.5) * Math.PI * 2 / sides;
    const cx = x + Math.sin(angle) * (apothem + 0.12), cz = z + Math.cos(angle) * (apothem + 0.12);
    const columns = Math.ceil(width / 0.68), rows = Math.ceil(height / 0.67);
    for (let j = 0; j <= columns; j++) {
      const u = (j / columns - 0.5) * width;
      b.box(cx + Math.cos(angle) * u, base + height / 2, cz - Math.sin(angle) * u, j === 0 || j === columns ? 0.2 : 0.09, height, 0.23, 'blueConcrete', [0, angle, 0]);
    }
    for (let j = 0; j <= rows; j++) b.box(cx, base + j * height / rows, cz, width, 0.09, 0.23, 'blueConcrete', [0, angle, 0]);
    b.box(cx, base + height / 2, cz, width, 0.3, 0.27, 'blueConcrete', [0, angle, 0]);
  }
}

function brokenSpire(b) {
  // Hollow shell with a surveyed-height, asymmetric damaged crown. The gap is
  // actual geometry; a dark solid cone would lose the ruin's defining outline.
  const vertices = [], heights = [60.5, 62.8, 67.8, 70.96, 65.7, 60.5, 58.3, 59.1];
  const point = (i, radius, y) => {
    const a = i * Math.PI / 4;
    return [Math.sin(a) * radius, y, Math.cos(a) * radius];
  };
  const triangle = (a, c, d) => vertices.push(...a, ...c, ...d);
  for (let i = 0; i < 8; i++) {
    const j = (i + 1) % 8;
    const a = point(i, 7.4, 56.6), c = point(j, 7.4, 56.6);
    const d = point(j, 4.2, heights[j]), e = point(i, 4.2, heights[i]);
    const ai = point(i, 6.5, 56.6), ci = point(j, 6.5, 56.6);
    const di = point(j, 3.4, heights[j]), ei = point(i, 3.4, heights[i]);
    triangle(a, c, d); triangle(a, d, e);
    triangle(ai, di, ci); triangle(ai, ei, di);
    triangle(e, d, di); triangle(e, di, ei);
    b.beam(a, e, 0.18, 'shade');
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.computeVertexNormals();
  b.add(geometry, 'ruin');
  b.box(0, 56.5, 0, 12, 0.2, 12, 'black');
}

function buildGedaechtniskirche(b) {
  // The old tower's orientation and its four neighbours use independent OSM
  // anchors; their unequal spacing is central to Eiermann's ensemble.
  b.box(0, 0.5, 0, 19, 1, 31, 'stone');
  b.box(0, 9, 0, 17.2, 17, 27, 'ruin');
  b.box(0, 17.7, 0, 18.4, 0.8, 28.2, 'shade');
  for (const side of [-1, 1]) {
    for (const z of [-9, 0, 9]) windowArch(b, side * 8.72, 2, z, 3.8, 9.2, side * Math.PI / 2, 'stone');
    for (const x of [-5.4, 0, 5.4]) windowArch(b, x, 2, side * 13.64, 3.2, 10.7, side > 0 ? 0 : Math.PI, 'stone');
    for (const z of [-12, -4, 4, 12]) pilaster(b, side * 8.8, 1.3, z, 16.3, 0.95, side * Math.PI / 2, 'shade');
  }
  // Large open belfry arches and thin masonry webs are visible from every side.
  for (const a of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
    archScreen(b, Math.sin(a) * 8.25, 18.1, Math.cos(a) * 8.25, 16.5, 10.6, 18.8, 6.3, 1.2, a, 'ruin');
    for (const dx of [-6.5, 6.5]) {
      const px = Math.sin(a) * 8.5 + Math.cos(a) * dx, pz = Math.cos(a) * 8.5 - Math.sin(a) * dx;
      pilaster(b, px, 18.4, pz, 18, 0.8, a, 'shade');
    }
  }
  b.box(0, 38.1, 0, 17.2, 1.3, 17.2, 'shade');
  b.box(0, 42.7, 0, 15.4, 7.8, 15.4, 'ruin');
  for (const a of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
    clockFace(b, Math.sin(a) * 7.84, 42.6, Math.cos(a) * 7.84, a);
    for (const dx of [-6.5, 6.5]) {
      const x = Math.sin(a) * 7.8 + Math.cos(a) * dx, z = Math.cos(a) * 7.8 - Math.sin(a) * dx;
      b.cyl(x, 45.1, z, 0.65, 4.5, 'stone', 0.65, 8);
      b.cyl(x, 48.2, z, 0.85, 2, 'copper', 0, 8);
    }
  }
  b.box(0, 47, 0, 16.6, 0.9, 16.6, 'stone');
  for (const a of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
    archScreen(b, Math.sin(a) * 7.2, 47.3, Math.cos(a) * 7.2, 14.4, 7, 9.4, 4.1, 1, a, 'ruin');
    for (const dx of [-5.1, 5.1]) {
      const x = Math.sin(a) * 7.35 + Math.cos(a) * dx, z = Math.cos(a) * 7.35 - Math.sin(a) * dx;
      column(b, x, 47.8, z, 0.37, 8.4, 'stone');
    }
    for (const dx of [-4.5, -1.5, 1.5, 4.5]) windowArch(b, Math.sin(a) * 8.45 + Math.cos(a) * dx, 45, Math.cos(a) * 8.45 - Math.sin(a) * dx, 1.2, 1.8, a, 'shade', 'black');
  }
  brokenSpire(b);
  // Surviving corner stair turret, with its tall conical slate roof.
  b.cyl(-6.9, 16, -12, 2.6, 31, 'ruin', 2.4, 12);
  b.cyl(-6.9, 33.6, -12, 2.5, 4, 'stone', 2.5, 12);
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4;
    windowArch(b, -6.9 + Math.sin(a) * 2.55, 30.4, -12 + Math.cos(a) * 2.55, 0.8, 4.2, a, 'stone');
  }
  b.cyl(-6.9, 42.2, -12, 2.7, 13.4, 'roof', 0.04, 12);
  b.collision(0, 0, 18.4, 28.2, 71);
  const child = (lon, lat, rotation = -0.159) => {
    const [x, z] = project(lon, lat);
    return new Builder({ ...b.landmark, x, z, rotation }, b.materials, b.parent);
  };
  const church = child(13.3346162, 52.50490705);
  church.add(new THREE.CylinderGeometry(18.3, 18.3, 1.5, 8), 'blueConcrete', [0, 0.75, 0], [1, 1, 1], [0, Math.PI / 8, 0]);
  blueGlassPrism(church, 0, 0, 18.3, 8, 1.5, 20.2, Math.PI / 8);
  church.add(new THREE.CylinderGeometry(18.45, 18.45, 0.4, 8), 'roof', [0, 21.8, 0], [1, 1, 1], [0, Math.PI / 8, 0]);
  // East entrance: bronze portal and a shallow, generous stair apron.
  church.box(17, 3.2, 0, 0.35, 3.4, 4.7, 'bronze');
  for (let i = 0; i < 5; i++) church.box(19.1 - i * 0.35, 0.15 + i * 0.3, 0, 3.5 - i * 0.35, 0.3, 6.6, 'stone');
  church.collision(0, 0, 35.5, 35.5, 22);
  b.colliders.push(...church.finish());
  const tower = child(13.33553665, 52.50472085);
  tower.add(new THREE.CylinderGeometry(6.25, 6.25, 5.4, 6), 'blueConcrete', [0, 2.7, 0], [1, 1, 1], [0, Math.PI / 6, 0]);
  blueGlassPrism(tower, 0, 0, 6.25, 6, 5.4, 47.7, Math.PI / 6);
  tower.add(new THREE.CylinderGeometry(6.5, 6.5, 0.8, 6), 'blueConcrete', [0, 27.8, 0], [1, 1, 1], [0, Math.PI / 6, 0]);
  tower.add(new THREE.CylinderGeometry(6.5, 6.5, 0.4, 6), 'roof', [0, 53.3, 0], [1, 1, 1], [0, Math.PI / 6, 0]);
  tower.collision(0, 0, 12.8, 12.8, 53.5);
  b.colliders.push(...tower.finish());
  const chapel = child(13.335776, 52.504867);
  chapel.box(0, 2.7, 0, 17.5, 4.6, 11.5, 'blueConcrete');
  for (const side of [-1, 1]) for (let x = -7; x <= 7; x += 1.4) rectWindow(chapel, x, 3.1, side * 5.85, 1, 2.6, side > 0 ? 0 : Math.PI, 'blueConcrete');
  for (const side of [-1, 1]) for (const z of [-3.5, 0, 3.5]) rectWindow(chapel, side * 8.85, 3.1, z, 2.3, 2.6, side * Math.PI / 2, 'blueConcrete');
  chapel.box(0, 5.05, 0, 18.2, 0.3, 12.2, 'roof');
  chapel.collision(0, 0, 17.5, 11.5, 5.2);
  b.colliders.push(...chapel.finish());
  const foyer = child(13.33419507, 52.50496511);
  foyer.box(0, 0.75, 0, 16.8, 1.5, 11.3, 'blueConcrete');
  foyer.box(0, 2.9, 0, 16.3, 2.8, 10.8, 'glass');
  foyer.box(0, 4.4, 0, 17.1, 0.3, 11.6, 'roof');
  for (const side of [-1, 1]) {
    for (let x = -7.6; x <= 7.7; x += 1.9) foyer.box(x, 2.9, side * 5.5, 0.13, 2.8, 0.2, 'blueConcrete');
    for (let z = -4.7; z <= 4.8; z += 1.9) foyer.box(side * 8.25, 2.9, z, 0.2, 2.8, 0.13, 'blueConcrete');
  }
  foyer.collision(0, 0, 17.1, 11.6, 4.6);
  b.colliders.push(...foyer.finish());
}

// Berghain exterior references: studio karhard's Berghain/Halle project pages
// and their 2006 architectural model; photographed southwest facade by Yannick
// (2014, Wikimedia Commons). Only procedural architecture is shipped, no images.
// The grunge/roof/forecourt pass additionally follows the user's photographs:
// /Users/aaroncunningham/Downloads/Berlin_Berghain.jpg
// /Users/aaroncunningham/Downloads/berghain_berlin.jpg
// /Users/aaroncunningham/Downloads/38720196-169-jpg-100-1920x1080.jpg
// Those files are visual references only; no raster image is shipped.
// Exact OSM footprint: w25649554; three attached service volumes are separately
// mapped. The 18m turbine hall and 21m boiler hall describe interior spaces;
// exterior eaves below are photo-based estimates, not surveyed height claims.
function buildBerghain(b) {
  const front = 38.27, back = -38.27, halfWidth = 18.9;
  const frontEave = 22.8, rearEave = 25.5;
  const random = n => { const v = Math.sin(n * 127.17 + 41.3) * 43758.5453; return v - Math.floor(v); };
  const glassPane = new THREE.PlaneGeometry(1,1);
  const facadeWindow = (x, y, z, width, height, angle = 0, dark = false, columns = 3, rows = 4) => {
    const c = Math.cos(angle), s = Math.sin(angle);
    const face = (dx, dy, depth) => [x + dx * c + depth * s, y + dy, z - dx * s + depth * c];
    const seed = x * 3.7 + y * 7.1 + z * 2.3;
    const opened = dark && y > 8 && y < 18;
    b.box(x, y, z, width + .18, height + .18, .13, 'bhRecess', [0, angle, 0]);
    b.box(...face(0, 0, .085), width, height, .08, 'bhBlind', [0, angle, 0]);
    for (let col = 0; col < columns; col++) for (let row = 0; row < rows; row++) {
      if (opened && row >= Math.ceil(rows / 2)) continue;
      const dx = ((col + .5) / columns - .5) * width, dy = ((row + .5) / rows - .5) * height;
      const n = random(seed + col * 11 + row * 3);
      b.add(glassPane, dark && y < 4 ? 'bhBlind' : n < .17 ? 'bhGlassPale' : n > .7 ? 'bhGlassDirty' : 'bhGlass',
        face(dx,dy,.15), [width / columns - .045,height / rows - .04,1], [0,angle,0]);
    }
    for (let i = 0; i <= columns; i++) {
      const outer = i === 0 || i === columns;
      b.box(...face((i / columns - .5) * width, opened && !outer ? -height / 4 : 0, .16), outer ? .075 : .04, opened && !outer ? height / 2 : height, .075, 'bhMetal', [0, angle, 0]);
    }
    for (let j = 0; j <= rows; j++) {
      if (opened && j > rows / 2 && j < rows) continue;
      b.box(...face(0, (j / rows - .5) * height, .17), width, j === 0 || j === rows ? .075 : .04, .075, 'bhMetal', [0, angle, 0]);
    }
    if (opened) {
      // Lifted/hinged top sash leaves a genuine black opening, as in the
      // entrance photograph, instead of another uniformly reflective pane.
      const hinge = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, angle, 0));
      hinge.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0), -.3));
      b.add(primitives.box, 'bhGlassDirty', face(0, height * .43, .28), [width * .94, height * .16, .04], hinge);
      b.box(...face(0, height / 2 + .03, .3), width + .15, .09, .4, 'bhMetal', [0, angle, 0]);
    }
    b.box(...face(0, -height / 2 - .12, .2), width + .32, .18, .42, 'bhTrim', [0, angle, 0]);
  };
  const block = (x, z, width, depth, height) => {
    b.box(x, height / 2, z, width, height, depth, 'bhPlaster');
    b.box(x, 2.15, z, width + 0.12, 4.3, depth + 0.12, 'bhRustica');
    b.box(x, 4.35, z, width + 0.52, 0.22, depth + 0.52, 'bhTrim');
    for (const [y, overhang, h] of [[height - 2.7, 0.22, 0.16], [height - 0.65, 0.45, 0.18], [height - 0.18, 0.9, 0.28]]) b.box(x, y, z, width + overhang, h, depth + overhang, 'bhTrim');
    b.box(x, height + 0.015, z, width + 0.95, 0.13, depth + 0.95, 'bhRoof');
    if (height > 18) b.box(x, height - .38, z, width + .65, .2, depth + .65, 'bhSoot');
    // Grooved rustication remains visible at close pedestrian range.
    for (let y = 0.48; y < 4.3; y += 0.47) {
      b.box(x, y, z + depth / 2 + 0.08, width, 0.035, 0.05, 'bhRecess');
      b.box(x, y, z - depth / 2 - 0.08, width, 0.035, 0.05, 'bhRecess');
      b.box(x + width / 2 + 0.08, y, z, 0.05, 0.035, depth, 'bhRecess');
      b.box(x - width / 2 - 0.08, y, z, 0.05, 0.035, depth, 'bhRecess');
    }
  };
  const tiledCollision = (x, z, width, depth, height) => {
    // Small local rectangles avoid the large rotated-AABB wedge that would
    // otherwise prevent a pedestrian from reaching the entrance courtyard.
    const nx = Math.ceil(width / 6), nz = Math.ceil(depth / 6);
    for (let ix = 0; ix < nx; ix++) for (let iz = 0; iz < nz; iz++) b.collision(x + ((ix + 0.5) / nx - 0.5) * width, z + ((iz + 0.5) / nz - 0.5) * depth, width / nx, depth / nz, height);
  };
  block(0, 19.135, 37.8, 38.27, frontEave);
  block(0, -19.135, 37.8, 38.27, rearEave);
  tiledCollision(0, 19.135, 37.8, 38.27, frontEave + 0.1);
  tiledCollision(0, -19.135, 37.8, 38.27, rearEave + 0.1);
  // Southwest front: thirteen narrow window axes between colossal pilasters.
  // Most openings are dark, with blue-grey industrial glazing and fine grids.
  const pitch = 2.53;
  for (let i = 0; i < 13; i++) {
    const x = (i - 6) * pitch;
    for (const [y, height, rows] of [[5.05, 0.65, 1], [7.05, 2.15, 4], [11.8, 4.8, 8], [16.65, 2.25, 4]]) facadeWindow(x, y, front + 0.11, 1.34, height, 0, (y === 11.8 && [1,2,3].includes(i)) || (y === 16.65 && i === 11), 3, rows);
    b.box(x, 19.5, front + 0.07, 0.56, 1.15, 0.1, i === 3 ? 'bhPlaster' : 'bhBlind');
    b.box(x, 21.5, front + 0.12, 0.65, 0.17, 0.13, 'bhRecess');
    if (Math.abs(x - 1.3) > 2.7) facadeWindow(x, 2.2, front + 0.15, 0.8, 2.6, 0, true, 1, 2);
    if (i < 12) {
      b.box(x + pitch / 2, 11.3, front + 0.3, 0.72, 13.75, 0.58, 'bhPlaster');
      b.box(x + pitch / 2, 18.25, front + 0.37, 0.94, 0.25, 0.72, 'bhTrim');
    }
  }
  b.box(0, 18.5, front + 0.25, 37.7, 0.2, 0.62, 'bhTrim');
  // The understated entrance sits in the rusticated base. No invented sign.
  b.box(1.3, 1.65, front + 0.23, 3.25, 3.3, 0.18, 'bhRecess');
  for (const dx of [-0.76, 0.76]) {
    b.box(1.3 + dx, 1.6, front + 0.34, 1.45, 3.05, 0.16, 'bhBlind');
    b.box(1.3 + dx * 0.1, 1.48, front + 0.46, 0.045, 0.65, 0.08, 'steel');
  }
  b.box(1.3, 3.45, front + 0.48, 4.05, 0.3, 1.05, 'bhTrim');
  b.box(1.3, 0.09, front + 0.45, 3.9, 0.18, 1.1, 'bhRustica');
  // Surface marks use thin planar triangles, merged by material. Paint is
  // flush with the rustication; frames and sills naturally cover it.
  const polygon = (points, material, origin = [0,0,0], angle = 0) => {
    const contour = points.map(p => new THREE.Vector2(...p));
    const triangles = THREE.ShapeUtils.triangulateShape(contour, []), coords = [];
    for (const triangle of triangles) for (const i of triangle) coords.push(points[i][0], points[i][1], 0);
    const g = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(coords, 3));
    g.computeVertexNormals(); b.add(g, material, origin, [1,1,1], [0,angle,0]); g.dispose();
  };
  const stroke = (points, width, material, origin, angle = 0) => {
    const coords = [];
    for (let i = 1; i < points.length; i++) {
      const a = points[i-1], c = points[i], dx = c[0]-a[0], dy = c[1]-a[1], length = Math.hypot(dx,dy);
      if (length < .0001) continue;
      const nx = -dy / length * width / 2, ny = dx / length * width / 2;
      for (const p of [[a[0]+nx,a[1]+ny],[a[0]-nx,a[1]-ny],[c[0]+nx,c[1]+ny],[c[0]+nx,c[1]+ny],[a[0]-nx,a[1]-ny],[c[0]-nx,c[1]-ny]]) coords.push(...p,0);
    }
    const g = new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(coords,3));
    g.computeVertexNormals(); b.add(g, material, origin, [1,1,1], [0,angle,0]); g.dispose();
  };
  // Abstract overlapping handstyles reproduce the density and scale of the
  // photos without an invented club logo or a large explanatory sign.
  const glyphs = [
    [[.04,0],[.26,1],[.55,.03],[.42,.42],[.13,.42]],
    [[.03,.02],[.08,.95],[.52,.05],[.57,1]],
    [[.4,.05],[.05,.2],[.02,.8],[.3,1],[.59,.82],[.51,.14],[.4,.05]],
    [[.03,0],[.1,1],[.52,.96],[.57,.62],[.11,.5],[.61,.04]],
    [[.6,.9],[.22,1],[.03,.69],[.54,.4],[.48,.05],[.03,.1]],
    [[.03,.1],[.57,.98],[.1,.94],[.54,.04]],
  ];
  const tag = (x,y,z,seed,angle=0,scale=1,letters=4,outlined=true) => {
    const c=Math.cos(angle),s=Math.sin(angle);
    for (let i=0;i<letters;i++) {
      const glyph=glyphs[Math.floor(random(seed+i)*glyphs.length)];
      const points=glyph.map(([u,v])=>[(u+i*.54+v*.14)*scale,v*scale]);
      if (outlined) stroke(points,.24*scale,'bhTagBlack',[x,y,z],angle);
      const mat=outlined ? ['bhTagWhite','bhTagGreen','bhTagRed','bhPaint'][Math.floor(random(seed+17)*4)] : (seed%3===0?'bhTagRed':'bhTagBlack');
      stroke(points,(outlined?.13:.035)*scale,mat,[x+s*.008,y,z+c*.008],angle);
    }
    if (!outlined) stroke([[-.1,-.08],[letters*.48*scale,-.02],[letters*.58*scale,.06]],.027,'bhTagBlack',[x,y,z],angle);
  };
  // Dirty overpaint patches sit behind several generations of large throw-ups
  // and much smaller scratch tags, concentrated below the first cornice.
  for (let i=0;i<20;i++) {
    const x=-18+i*1.85, y=.22+random(i)*1.8;
    polygon([[0,0],[1.7,.05],[1.6,1.1],[.96,1.4],[.2,1.24]],i%3?'bhPaint':'bhRustica',[x,y,front+.135]);
  }
  for (let i=0;i<12;i++) {
    const x=-17.9+i*3.05;
    if (x>-.5 && x<3) continue;
    tag(x,.35+random(i+9)*.35,front+.18,i*13,0,.9+random(i+6)*.5,4,true);
    tag(x+.14,2.65+random(i+7)*.65,front+.19,i+70,0,.38,4,false);
    tag(x+.5,1.95+random(i+19)*.4,front+.20,i+95,0,.48,3,false);
  }
  // Boards and a battered painted entrance match the lower openings in the
  // daylight forecourt image. Boards are narrow individual plywood sheets.
  for (const i of [3,4,8]) {
    const x=(i-6)*pitch;
    b.box(x,2.18,front+.37,.86,2.45,.06,'bhBoard');
    b.box(x+.05,2.15,front+.407,.014,2.3,.015,'bhTag');
    for (const dx of [-.31,.31]) for (const y of [1.18,3.19]) b.box(x+dx,y,front+.412,.035,.035,.015,'bhMetal');
    tag(x-.35,1.55,front+.418,i+109,0,.3,2,false);
  }
  polygon([[-1.42,0],[1.4,.05],[1.3,2.78],[.9,2.82],[-.3,2.67],[-1.4,2.8]],'bhRust',[1.3,.13,front+.425]);
  tag(-.12,.3,front+.438,12,0,1.05,4,true);
  tag(.1,2.1,front+.446,81,0,.4,4,false);
  for (const x of [-12.5,-4.2,7.7,15.1]) {
    b.box(x,4.05,front+.31,.32,.17,.28,'bhMetal');
    b.box(x,3.99,front+.48,.23,.07,.08,'bhPaint');
  }
  // Thin broken plaster cracks and eroded spots, rather than regular stripes.
  for (let i=0;i<21;i++) {
    const x=-18+random(i+311)*36,y=5+random(i+401)*16;
    const points=[[0,0],[.08,-.42],[-.03,-.81],[.12,-1.3],[.07,-1.75]];
    stroke(points,.014,'bhTag',[x,y,front+.121]);
    if (i%3===0) stroke([[.08,-.42],[.33,-.71],[.4,-1.1]],.012,'bhTag',[x,y,front+.122]);
  }
  polygon([[0,0],[1.4,.2],[1.1,1.3],[.7,1.6],[.05,1.1]],'bhSoot',[-17.9,16.7,front+.12]);
  // The turbine hall's long sides continue the narrow vertical rhythm. The
  // northeast boiler house intentionally has larger unpierced industrial bays.
  for (const side of [-1, 1]) {
    const a = side * Math.PI / 2, x = side * (halfWidth + 0.13);
    for (let i = 0; i < 12; i++) {
      const z = 2.8 + i * 2.9;
      facadeWindow(x, 16.65, z, 1.45, 2.2, a, i % 5 === 0, 3, 4);
      if (i % 5 !== 1) {
        facadeWindow(x, 11.8, z, 1.45, 4.8, a, i % 4 === 0, 3, 8);
        facadeWindow(x, 6.9, z, 1.45, 2.1, a, false, 3, 4);
      }
      b.box(side * 19.12, 11.3, z + 1.44, 0.48, 13.75, 0.67, 'bhPlaster');
      b.box(x, 19.5, z, 0.11, 1.1, 0.55, 'bhBlind');
      b.box(x, 21.5, z, 0.12, 0.16, 0.65, 'bhRecess');
      if (i % 3 === 0) facadeWindow(x, 2.1, z, 1.25, 2.45, a, true, 2, 3);
    }
    for (const z of [-7.5, -14.2, -21, -28, -34.5]) {
      b.box(side * 19.08, 14, z + 2.6, 0.35, 17.8, 0.62, 'bhPlaster');
      b.box(side * 19.05, 22.4, z, 0.18, 1.15, 0.6, 'bhBlind');
      facadeWindow(x, 3, z, 1.4, 3.3, a, true, 2, 4);
      if (z === -7.5 || z === -34.5) facadeWindow(x, 10.4, z, 3.3, 7.6, a, false, 5, 11);
    }
    b.box(side * 19.16, 19.15, -19, 0.35, 0.18, 38, 'bhTrim');
  }
  for (const side of [-1,1]) for (let i=0;i<10;i++) {
    const z=3+i*3.2, angle=side*Math.PI/2;
    tag(side*19.08,.5+random(i+2)*.3,z,i+150,angle,1.05,4,true);
    tag(side*19.09,2.9,z+.7,i+179,angle,.43,4,false);
  }
  // Rear boiler-house elevation and the projecting glazed stair bay.
  for (const x of [-12.4, -6.2, 0, 6.2, 12.4]) {
    facadeWindow(x, 14.1, back - 0.13, x === 0 ? 3.8 : 2.8, 12.5, Math.PI, x === 0, 5, 17);
    b.box(x + 2.6, 14.1, back - 0.23, 0.68, 17.7, 0.45, 'bhPlaster');
    facadeWindow(x, 2.5, back - 0.13, 1.3, 3.6, Math.PI, true, 2, 4);
    b.box(x, 22.3, back - 0.13, 0.7, 1.2, 0.13, 'bhBlind');
  }
  b.box(19.35, 13.7, -19.7, 0.9, 22.4, 5.8, 'bhPlaster');
  facadeWindow(19.86, 14.4, -19.7, 4.05, 15.4, Math.PI / 2, false, 5, 19);
  b.box(19.4, 25.25, -19.7, 1.25, 0.35, 6.5, 'bhTrim');
  // The aerial reference shows a broad flat front roof and a full-width
  // sloped transition to the raised boiler-house roof, not a pyramidal cap.
  b.box(0,22.92,26.3,36.8,.18,22.2,'bhRoof');
  const slopeLength=Math.hypot(17,2.7), slopeAngle=Math.atan2(2.7,17);
  b.box(0,24.19,7.5,35.9,.17,slopeLength,'bhRoof',[slopeAngle,0,0]);
  b.box(0,25.65,-18.7,36.9,.3,36.7,'bhRoof');
  for (let x=-16.8;x<18;x+=2.3) b.box(x,24.28,7.5,.035,.025,slopeLength,'bhMetal',[slopeAngle,0,0]);
  for (const side of [-1,1]) b.box(side*18.3,25.96,-18.7,.18,.55,37,'bhTrim');
  b.box(0,25.96,-37.1,36.8,.55,.18,'bhTrim');
  b.box(4.2,27.1,-19,7.4,3.2,6.8,'bhPlaster');
  b.box(4.2,25.7,-19,7.6,.45,7,'bhSoot');
  b.box(4.2,28.75,-19,8,.2,7.4,'bhRoof');
  for (const z of [-20.8,-17.4]) facadeWindow(8.02,27.2,z,1.6,1.3,Math.PI/2,true,2,2);
  b.cyl(-11.7,26.15,-8,.22,2.1,'bhMetal',.22,8);
  for (let i=0;i<17;i++) {
    const x=-15+random(i+87)*29, z=19+random(i+91)*17;
    b.box(x,23.025,z,1.4+random(i)*4,.018,.7+random(i+2)*2,i%3?'bhSoot':'bhRust');
  }
  for (const [x,z,w,d,h] of [[-8,23,2,1.8,1.2],[-2,24,2.7,2,1.6],[6,27,1.2,1.3,.9],[12,22,1.5,1.2,.55]]) {
    b.box(x,23.2,z,w+.5,.3,d+.5,'bhPaint');
    b.box(x,23.3+h/2,z,w,h,d,'bhMetal');
    for (let j=0;j<5;j++) b.box(x-w*.4+j*w*.2,23.4+h/2,z+d/2+.02,.04,h*.72,.05,'bhSoot');
    b.box(x,23.35+h,z,w+.15,.08,d+.15,'bhRoof');
  }
  b.beam([-7,23.35,24],[-4,23.35,24],.17,'bhMetal');
  b.beam([-4,23.35,24],[-4,23.35,28],.17,'bhMetal');
  // Three attached OSM structures; Kantine and Bierhof are separate, untouched.
  block(-26.74, -19.5, 15.65, 27.3, 10.6);
  block(-22.38, 15.8, 6.94, 15.84, 4.8);
  tiledCollision(-26.74, -19.5, 15.65, 27.3, 10.7);
  tiledCollision(-22.38, 15.8, 6.94, 15.84, 4.9);
  for (const z of [-30, -24.7, -19.4, -14.1, -8.8]) for (const y of [2.2, 5.3, 8.4]) facadeWindow(-34.68, y, z, 2.4, 2, -Math.PI / 2, false, 4, 3);
  for (const z of [-33.3, -5.72]) for (const x of [-31.4, -26.7, -22]) for (const y of [2.2, 5.3, 8.4]) facadeWindow(x, y, z, 2.3, 2, z < -20 ? Math.PI : 0, false, 4, 3);
  for (const z of [10.2, 15.8, 21.3]) facadeWindow(-25.96, 2.5, z, 3.2, 3.1, -Math.PI / 2, false, 5, 6);
  for (const z of [7.79, 23.82]) facadeWindow(-22.4, 2.5, z, 3.2, 3.1, z < 10 ? Math.PI : 0, false, 5, 6);
  // Small mapped L-shaped eastern escape annex and its exposed steel flights.
  block(24.8, 23.6, 11.9, 2.7, 6.8);
  block(22.5, 20.8, 7.3, 2.8, 6.8);
  tiledCollision(24.8, 23.6, 11.9, 2.7, 7);
  tiledCollision(22.5, 20.8, 7.3, 2.8, 7);
  for (const x of [22, 27.6]) facadeWindow(x, 3.5, 25.06, 2.1, 2.8, 0, true, 2, 4);
  for (let flight = 0; flight < 4; flight++) {
    const startZ = flight % 2 ? 19.9 : 24.7, endZ = flight % 2 ? 24.7 : 19.9;
    const y0 = 0.4 + flight * 3.9, y1 = y0 + 3.9;
    for (let step = 0; step < 13; step++) {
      const t = (step + 0.5) / 13;
      b.box(28, y0 + t * 3.9, startZ + (endZ - startZ) * t, 2.5, 0.09, 0.42, 'bhMetal');
    }
    for (const x of [26.7, 29.3]) {
      b.beam([x, y0, startZ], [x, y1, endZ], 0.075, 'bhMetal');
      b.beam([x, y0 + 1.1, startZ], [x, y1 + 1.1, endZ], 0.045, 'bhMetal');
      for (let j = 0; j <= 4; j++) {
        const t = j / 4, z = startZ + (endZ - startZ) * t, y = y0 + t * 3.9;
        b.beam([x, y, z], [x, y + 1.1, z], 0.035, 'bhMetal');
      }
    }
    b.box(28, y1, endZ, 2.8, 0.12, 1.6, 'bhMetal');
  }
  // The low western service room is largely covered with dark red vine
  // growth in the aerial; irregular strips leave its windows visible.
  for (let i=0;i<18;i++) {
    const z=8+random(i+61)*15.5,y=1.7+random(i+73)*2.3;
    b.box(-25.91,y,z,.06,1.8+random(i+3),.4+random(i+4)*.9,'bhRust');
  }
  // The modern paneled smoking/escape enclosure projects from the east side.
  b.box(23.2,12.25,22.1,7.7,6.2,5.8,'bhGlassDirty');
  for (const x of [19.4,21.9,24.5,27.05]) b.box(x,12.25,25.05,.08,6.3,.08,'bhMetal');
  for (const y of [9.15,11.2,13.3,15.4]) {
    b.box(23.2,y,25.05,7.8,.08,.08,'bhMetal');
    b.box(27.07,y,22.1,.08,.08,5.9,'bhMetal');
  }
  for (const z of [19.2,21.15,23.1,25.05]) b.box(27.07,12.25,z,.08,6.3,.08,'bhMetal');
  for (const x of [21,25.5]) b.box(x,7.6,23.6,.18,3.3,.18,'bhMetal');
  // Sparse roof services and downpipes emphasize the former power station.
  for (const side of [-1, 1]) for (const z of [-35.7, 35.7]) b.beam([side * 19.22, 0.4, z], [side * 19.22, side > 0 && z < 0 ? 25.2 : 22.2, z], 0.055, 'bhMetal');
  // Bounded irregular dirt/gravel approach, above the mapped 0.055m footway.
  // Its narrow southern tail stops before the real public carriageway.
  const ground = (ring,y,mat) => {
    const contour=ring.map(([x,z])=>new THREE.Vector2(x,-z));
    const triangles=THREE.ShapeUtils.triangulateShape(contour,[]),coords=[];
    for (const triangle of triangles) for (const i of triangle) coords.push(ring[i][0],y,ring[i][1]);
    const g=new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(coords,3));
    g.computeVertexNormals(); b.add(g,mat);g.dispose();
  };
  // Earth beneath rough grass gives the islands a worn perimeter; the smaller
  // inset green shape avoids the appearance of a pristine lawn cutout.
  for (const ring of BERGHAIN_LOCAL_ISLANDS) {
    ground(ring,.081,'bhEarth');
    const cx=ring.reduce((sum,p)=>sum+p[0],0)/ring.length,cz=ring.reduce((sum,p)=>sum+p[1],0)/ring.length;
    ground(ring.map(([x,z])=>[cx+(x-cx)*.95,cz+(z-cz)*.95]),.087,'bhGrass');
  }
  ground(BERGHAIN_LOCAL_GROUND,.081,'bhEarth');
  ground([[-20,39],[-21,47],[-17,55],[-12,64],[-12.6,80],[-12.6,96],[-9.5,98],[-7.6,94],[-6,79],[-.5,67],[7.5,59],[16.5,52],[18,44],[15,39]],.087,'bhGravel');
  ground([[-21,46],[-13,47],[-9,52],[-11,65],[-13.8,80],[-15,85],[-15.6,77],[-17.5,65],[-22,56]],.096,'bhGrass');
  ground([[7,40],[16.5,40.5],[19,44],[18,48],[12,46.5],[8,45.2],[5,43.5]],.096,'bhGrass');
  const inRing=(x,z,ring)=>{
    let inside=false;
    for(let i=0,j=ring.length-1;i<ring.length;j=i++) {
      const a=ring[i],c=ring[j];
      if ((a[1]>z)!==(c[1]>z) && x<(c[0]-a[0])*(z-a[1])/(c[1]-a[1])+a[0]) inside=!inside;
    }
    return inside;
  };
  for(let k=0;k<BERGHAIN_LOCAL_ISLANDS.length;k++) {
    const ring=BERGHAIN_LOCAL_ISLANDS[k],xs=ring.map(p=>p[0]),zs=ring.map(p=>p[1]);
    const minX=Math.min(...xs),maxX=Math.max(...xs),minZ=Math.min(...zs),maxZ=Math.max(...zs);
    for(let i=0;i<28;i++) {
      const x=minX+random(i+k*81+1031)*(maxX-minX),z=minZ+random(i+k*67+1192)*(maxZ-minZ),r=.7+random(i+50)*2.1;
      if(!inRing(x-r,z-r,ring)||!inRing(x+r,z+r,ring))continue;
      ground(Array.from({length:8},(_,j)=>{const a=j/8*Math.PI*2,rr=r*(.65+random(i*8+j)*.35);return[x+Math.cos(a)*rr,z+Math.sin(a)*rr*.7];}),.1,i%3?'bhEarth':'bhGravel');
    }
    for(let i=0;i<320;i++) {
      const x=minX+random(i+k*67+2171)*(maxX-minX),z=minZ+random(i+k*77+2253)*(maxZ-minZ);
      if(!inRing(x,z,ring))continue;
      const h=.22+random(i+998)*.5;
      for(let j=0;j<3;j++)polygon([[-.08,0],[.05,0],[(random(i+j)-.5)*.4,h]],'bhGrass',[x,.10,z],j*1.047+i);
    }
  }
  const contains=(x,z)=>{
    let inside=false;
    for(let i=0,j=BERGHAIN_LOCAL_GROUND.length-1;i<BERGHAIN_LOCAL_GROUND.length;j=i++) {
      const a=BERGHAIN_LOCAL_GROUND[i],c=BERGHAIN_LOCAL_GROUND[j];
      if ((a[1]>z)!==(c[1]>z) && x<(c[0]-a[0])*(z-a[1])/(c[1]-a[1])+a[0]) inside=!inside;
    }
    return inside;
  };
  for(let i=0;i<48;i++) {
    const x=-23+random(i+681)*43,z=40+random(i+722)*57,r=.3+random(i+17)*1.4;
    if (!contains(x-r,z-r)||!contains(x+r,z+r))continue;
    const ring=Array.from({length:7},(_,j)=>{const a=j/7*Math.PI*2,rr=r*(.6+random(i*7+j)*.4);return[x+Math.cos(a)*rr,z+Math.sin(a)*rr*.6];});
    ground(ring,.093,i%3?'bhEarth':'bhGravel');
  }
  // Low weeds around the dusty clearing. Tree and shrub crowns are supplied
  // to the original city foliage pipeline by BERGHAIN_TREE_SITES above.
  for(let i=0;i<240;i++) {
    const k=i%(BERGHAIN_LOCAL_GROUND.length-1),a=BERGHAIN_LOCAL_GROUND[k],c=BERGHAIN_LOCAL_GROUND[k+1],t=random(i+901);
    const x=a[0]+(c[0]-a[0])*t+(random(i+77)-.5)*1.8,z=a[1]+(c[1]-a[1])*t+(random(i+3)-.5)*1.8;
    if(!contains(x,z)||z<40)continue;
    const h=.15+random(i+99)*.42;
    for(let j=0;j<3;j++)polygon([[-.055,0],[.035,0],[(random(i+j)-.5)*.3,h]],'bhGrass',[x,.09,z],j*1.047+i);
  }
  // Galvanized construction mesh frames the approach and opens at the
  // cross-site footway. Segment positions leave the entrance corridor clear.
  const fence=(a,c,height=1.9)=>{
    const length=Math.hypot(c[0]-a[0],c[1]-a[1]),segments=Math.ceil(length/2.6);
    for(let i=0;i<=segments;i++) {const t=i/segments;b.cyl(a[0]+(c[0]-a[0])*t,height/2+.09,a[1]+(c[1]-a[1])*t,.04,height,'bhMetal',.04,6);}
    for(const y of [.22,.67,1.12,1.57,height]) b.beam([a[0],y,a[1]],[c[0],y,c[1]],.012,'bhMetal');
    for(let d=.13;d<length;d+=.24) {const t=d/length,x=a[0]+(c[0]-a[0])*t,z=a[1]+(c[1]-a[1])*t;b.beam([x,.22,z],[x,height,z],.009,'bhMetal');}
  };
  fence([-6.7,40],[-6.1,44]);fence([5.7,40],[6.4,45]);
  fence([-7.3,49],[-9,65]);fence([-9,65],[-13.8,91]);
  fence([1.5,50],[-2.5,65]);fence([-2.5,65],[-5.8,91]);
  fence([8,41],[18.5,43],2.2);fence([-9,42],[-20,43],2.05);
  // Battered bins and a modest lamp belong to the site, not the roadway.
  b.box(3.9,.62,52, .72,1.05,.82,'bhBlind');b.box(3.9,1.17,52,.8,.12,.91,'bhSoot');
  tag(3.6,.3,52.43,43,0,.35,2,true);
  b.cyl(-11.2,2.8,57,.065,5.6,'bhMetal',.065,8);
  b.box(-10.9,5.55,57,.8,.15,.35,'bhMetal');
  for (const [x, z] of [[-2.8, 42.6], [-2.8, 45.6], [4.9, 48.6]]) {
    for (const dx of [-1.15, 1.15]) {
      b.beam([x + dx, 0.1, z], [x + dx, 1.05, z], 0.035, 'steel');
      b.beam([x + dx, 0.12, z - 0.32], [x + dx, 0.12, z + 0.32], 0.035, 'steel');
    }
    b.beam([x - 1.15, 1.05, z], [x + 1.15, 1.05, z], 0.035, 'steel');
    for (let dx = -0.9; dx <= 0.9; dx += 0.3) b.beam([x + dx, 0.25, z], [x + dx, 1.05, z], 0.016, 'steel');
  }
}

const builders = {
  berghain: buildBerghain,
  fernsehturm: buildFernsehturm,
  brandenburg: buildGate,
  reichstag: buildReichstag,
  dom: buildDom,
  rotesrathaus: buildRathaus,
  hauptbahnhof: buildHauptbahnhof,
  neuesynagoge: buildSynagoge,
  gendarmenmarkt: buildGendarmenmarkt,
  oberbaum: buildOberbaum,
  kreuzbergdenkmal: buildKreuzbergDenkmal,
  frankfurtertor: buildFrankfurterTor,
  charlottenburg: buildCharlottenburg,
  gedaechtniskirche: buildGedaechtniskirche,
};

export function buildLandmarks(scene) {
  const group = new THREE.Group();
  // Keep the upstream culling/debug key; its contents and metadata are Berlin.
  group.name = 'ManhattanLandmarks';
  group.userData.city = 'Berlin';
  const materials = makeMaterials();
  const colliders = [];
  for (const landmark of LANDMARKS) {
    const builder = new Builder(landmark, materials, group);
    builders[landmark.id](builder);
    colliders.push(...builder.finish());
  }
  scene.add(group);
  return {
    group, colliders, exclusions: LANDMARK_EXCLUSIONS,
    update(time) { materials.beacon.emissiveIntensity = 0.8 + Math.pow(Math.max(0, Math.sin(time * 2.3)), 8) * 2.2; },
  };
}
