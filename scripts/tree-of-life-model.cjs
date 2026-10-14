// Rebuild the website model to match Diagram No. 6 in the supplied book, p. 68.
// Keep the original Blender export and its binary geometry intact.
const fs = require('node:fs');
const path = require('node:path');
const THREE = require('three');
const root = path.resolve(__dirname, '..');
const content = require('../src/components/community/tools/tree-content.json');
const input = fs.readFileSync(path.join(root, 'public/tools/tree-of-life/tree-of-life.glb'));
const jsonLength = input.readUInt32LE(12);
const model = JSON.parse(input.subarray(20, 20 + jsonLength).toString());
const binaryChunks = input.subarray(20 + jsonLength);
const spheres = new Map(model.nodes.filter(node => node.extras?.sephirah).map(node => [node.extras.sephirah, node]));
const paths = content.parts.filter(part => part.kind === 'path');
const corrections = new Map([
  ['Chokmah / Geburah', 'Netzach / Malkuth'],
  ['Binah / Chesed', 'Hod / Malkuth'],
]);

for (const node of model.nodes) {
  if (!node.extras?.connects) continue;
  const corrected = corrections.get(node.extras.connects);
  if (corrected) {
    const [from, to] = corrected.split(' / ').map(name => new THREE.Vector3(...(spheres.get(name).translation ?? [0, 0, 0])));
    const direction = to.clone().sub(from);
    const primitive = model.meshes[node.mesh].primitives[0];
    const bounds = model.accessors[primitive.attributes.POSITION];
    // Exported path cylinders run along local Y. Reuse their radii and faces.
    node.scale = [node.scale[0], direction.length() / (bounds.max[1] - bounds.min[1]), node.scale[2]];
    node.rotation = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize()).toArray();
    node.translation = from.add(to).multiplyScalar(.5).toArray();
    node.translation[2] = -.13;
    node.extras.connects = corrected;
  }
  const part = paths.find(part => part.modelKey === node.extras.connects);
  if (!part) throw new Error(`Missing chart entry for ${node.extras.connects}`);
  node.name = `Path ${part.number} · ${part.title} · ${part.subtitle}`;
  node.extras.path_number = part.number;
  node.extras.hebrew_letter = part.hebrew;
}

// Preserve the reference artwork's established scale and centred framing.
const scale = 6.814635276794434 / 8.02499982714653;
const scene = model.scenes[model.scene ?? 0];
scene.nodes = [model.nodes.push({
  name: 'Tree of Life · reference framing',
  children: scene.nodes,
  scale: [scale, scale, scale],
  translation: [0, -3.5999999046325684 * scale, 0],
}) - 1];

let json = Buffer.from(JSON.stringify(model));
json = Buffer.concat([json, Buffer.alloc((4 - json.length % 4) % 4, 32)]);
const header = Buffer.alloc(20);
header.write('glTF');header.writeUInt32LE(2, 4);
header.writeUInt32LE(20 + json.length + binaryChunks.length, 8);
header.writeUInt32LE(json.length, 12);header.write('JSON', 16);
fs.writeFileSync(path.join(root, 'public/tools/tree-of-life/tree-of-life-reference.glb'), Buffer.concat([header, json, binaryChunks]));
console.log('Updated 22 paths to the supplied diagram; original export preserved.');
