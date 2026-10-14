const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const THREE = require('three');
const content = require('../src/components/community/tools/tree-content.json');

function glb(name) {
  const file = fs.readFileSync(path.join(__dirname, '../public/tools/tree-of-life', name));
  const end = 20 + file.readUInt32LE(12);
  return { json: JSON.parse(file.subarray(20, end).toString()), binary: file.subarray(end) };
}
const model = glb('tree-of-life-reference.glb');
// Diagram No. 6, p. 68, read from the user's IMG_8777.JPG.
const chart = [[1,2],[1,3],[1,6],[2,3],[2,6],[2,4],[3,6],[3,5],[4,5],[4,6],[4,7],[5,6],[5,8],[6,7],[6,9],[6,8],[7,8],[7,9],[7,10],[8,9],[8,10],[9,10]];

test('all 32 parts follow the supplied chart and have distinct information entries', () => {
  assert.deepEqual(content.parts.map(part => part.number), Array.from({length:32},(_,i)=>i+1));
  assert.equal(new Set(content.parts.map(part=>part.id)).size,32);
  const sephiroth = content.parts.filter(part=>part.kind==='sephirah');
  const paths = content.parts.filter(part=>part.kind==='path');
  assert.deepEqual(paths.map(part=>part.modelKey.split(' / ').map(name=>sephiroth.find(s=>s.modelKey===name).number)), chart);
  const nodes = model.json.nodes.filter(node=>node.mesh!==undefined);
  assert.equal(nodes.length,32);
  for (const node of nodes) {
    const key = node.extras.sephirah ?? node.extras.connects;
    assert.equal(content.parts.filter(part=>part.modelKey===key).length,1,key);
  }
});

test('every rendered path actually terminates at its two labelled sephiroth', () => {
  const sephiroth = new Map(model.json.nodes.filter(node=>node.extras?.sephirah).map(node=>[node.extras.sephirah,new THREE.Vector3(...(node.translation??[0,0,0]))]));
  for (const node of model.json.nodes.filter(node=>node.extras?.connects)) {
    const primitive = model.json.meshes[node.mesh].primitives[0];
    const bounds = model.json.accessors[primitive.attributes.POSITION];
    const matrix = new THREE.Matrix4().compose(new THREE.Vector3(...node.translation),new THREE.Quaternion(...node.rotation),new THREE.Vector3(...node.scale));
    const ends = [bounds.min[1],bounds.max[1]].map(y=>new THREE.Vector3(0,y,0).applyMatrix4(matrix));
    const expected = node.extras.connects.split(' / ').map(name=>sephiroth.get(name).clone().setZ(-.13));
    for (const end of expected) assert.ok(ends.some(actual=>actual.distanceTo(end)<.00001),`${node.extras.connects}: incorrect endpoint`);
  }
  assert.deepEqual(model.binary,glb('tree-of-life.glb').binary);
});

test('all paths use the supplied book’s tarot and elemental, planetary or zodiacal correspondences', () => {
  const aleph=content.parts.find(part=>part.number===11);
  const beth=content.parts.find(part=>part.number===12);
  const field=(part,label)=>part.correspondences.find(item=>item.label===label)?.value;
  assert.equal(aleph.title,'Aleph');assert.equal(aleph.modelKey,'Kether / Chokmah');
  assert.equal(field(aleph,'Tarot'),'0 — The Fool');assert.equal(field(aleph,'Element'),'Air');
  assert.equal(beth.title,'Beth');assert.equal(beth.modelKey,'Kether / Binah');
  assert.equal(field(beth,'Tarot'),'I — The Magician');assert.equal(field(beth,'Planet'),'Mercury');
  // A Garden of Pomegranates, pp. 71–91, from IMG_8780 2.JPG through IMG_8789.JPG.
  // Preserve this edition's He/Emperor, Tzaddi/Star and Strength VIII/Justice XI.
  const remaining = [
    [13,'Gimel','II — The High Priestess of the Silver Star','Planet','Moon'],
    [14,'Daleth','III — The Empress','Planet','Venus'],
    [15,'He','IV — The Emperor','Zodiac','Aries — the Ram'],
    [16,'Vav','V — The Hierophant','Zodiac','Taurus — the Bull'],
    [17,'Zayin','VI — The Lovers','Zodiac','Gemini — the Twins'],
    [18,'Cheth','VII — The Chariot','Zodiac','Cancer — the Crab'],
    [19,'Teth','VIII — Strength','Zodiac','Leo — the Lion'],
    [20,'Yod','IX — The Hermit','Zodiac','Virgo — the Virgin'],
    [21,'Kaph','X — The Wheel of Fortune','Planet','Jupiter'],
    [22,'Lamed','XI — Justice','Zodiac','Libra — the Scales'],
    [23,'Mem','XII — The Hanged Man','Element','Water'],
    [24,'Nun','XIII — Death','Zodiac','Scorpio'],
    [25,'Samekh','XIV — Temperance','Zodiac','Sagittarius — the Archer'],
    [26,'Ayin','XV — The Devil','Zodiac','Capricorn — the Goat'],
    [27,'Peh','XVI — The Tower','Planet','Mars'],
    [28,'Tzaddi','XVII — The Star','Zodiac','Aquarius — the Water-bearer'],
    [29,'Qoph','XVIII — The Moon','Zodiac','Pisces — the Fishes'],
    [30,'Resh','XIX — The Sun','Planet','Sun'],
    [31,'Shin','XX — The Last Judgment','Element','Fire'],
    [32,'Tav','XXI — The World','Planet','Saturn'],
  ];
  for (const [number,title,tarot,attribution,value] of remaining) {
    const part=content.parts.find(part=>part.number===number);
    assert.equal(part.title,title);
    assert.equal(field(part,'Tarot'),tarot,title);
    assert.equal(field(part,attribution),value,title);
    assert.ok(part.source.images.length>0&&part.source.pages!=='68',`${title}: missing source pages`);
  }
});

test('the ten sephiroth and three veils have sourced study notes', () => {
  const entries = [...content.parts.filter(part => part.kind === 'sephirah'), ...content.veils];
  assert.equal(entries.length, 13);
  for (const part of entries) {
    assert.ok(part.paragraphs.length >= 2, part.id);
    assert.ok(part.sections.length >= 2, part.id);
    assert.ok(part.source.pages && part.source.images.length, part.id);
    assert.ok(part.correspondences.length >= 4, part.id);
  }
  assert.ok(content.overview.sections.some(section => section.title === 'How to read correspondences'));
  assert.doesNotMatch(JSON.stringify(content), /\bspheres?\b/i);
});

test('all 78 original Rider–Waite cards are local, verified and assigned to the correct entries', () => {
  const crypto = require('node:crypto');
  const deck = require('../src/components/community/tools/tarot-cards.json');
  assert.equal(deck.cards.length, 78);
  const assigned = content.parts.flatMap(part => part.tarotCardIds);
  assert.equal(assigned.length, 78);
  assert.equal(new Set(assigned).size, 78);
  assert.deepEqual(new Set(assigned), new Set(deck.cards.map(card => card.id)));
  for (const card of deck.cards) {
    const file = fs.readFileSync(path.join(__dirname, '../public', card.src));
    assert.equal(file.readUInt16BE(0), 0xffd8, card.id);
    assert.equal(crypto.createHash('sha256').update(file).digest('hex'), card.sha256, card.id);
    assert.equal(card.license, 'Public domain');
    assert.match(card.source, /^https:\/\/commons\.wikimedia\.org\/wiki\/File:RWS1909/);
  }
  const suits = ['wands','cups','swords','pentacles'];
  for (const part of content.parts.filter(part => part.kind === 'sephirah')) {
    const ranks = [part.number];
    const court = { 2:14, 3:13, 6:12, 10:11 }[part.number];
    if (court) ranks.push(court);
    assert.deepEqual(part.tarotCardIds, ranks.flatMap(n => suits.map(s => `${s}-${String(n).padStart(2,'0')}`)), part.id);
  }
  for (const part of content.parts.filter(part => part.kind === 'path')) {
    assert.deepEqual(part.tarotCardIds, [`major-${String(part.number-11).padStart(2,'0')}`], part.id);
  }
});

test('every selectable model part has its book colour or a documented related attribution', () => {
  for (const part of content.parts) {
    assert.ok(part.palette.name && part.palette.basis, part.id);
    assert.ok([1,2,4].includes(part.palette.colors.length), part.id);
    for (const hex of part.palette.colors) assert.match(hex, /^#[0-9a-f]{6}$/i, part.id);
    const stated = part.correspondences.find(row => ['Colour','Colours'].includes(row.label));
    if (stated) assert.equal(part.palette.name, stated.value, part.id);
    else assert.ok([12,15,31].includes(part.number), `${part.id}: undocumented colour gap`);
  }
  assert.equal(content.parts.find(part => part.id === 'malkuth').palette.colors.length, 4);
  assert.equal(content.parts.find(part => part.id === 'path-19').palette.name, 'Purple');
});

test('Aeon overlay swaps the two correspondence sets and retains path identities', () => {
  const ts = require('typescript');
  const filename = path.join(__dirname, '../src/components/community/tools/tree-aeon.ts');
  const js = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true },
  }).outputText;
  const mod = { exports: {} };
  new Function('require', 'exports', js)(require('node:module').createRequire(filename), mod.exports);
  const before = JSON.stringify(content);
  const oldParts = mod.exports.partsForAeon('old');
  const newParts = mod.exports.partsForAeon('new');
  for (const part of oldParts) {
    const actual = newParts.find(entry => entry.id === part.id);
    const donorId = part.id === 'path-15' ? 'path-28' : part.id === 'path-28' ? 'path-15' : null;
    if (!donorId) {
      for (const key of ['id', 'title', 'number', 'hebrew', 'modelKey', 'subtitle', 'paragraphs', 'sections', 'palette', 'tarotCardIds']) assert.deepEqual(actual[key], part[key]);
      assert.deepEqual(actual.correspondences.filter(row => row.label !== 'Tarot'), part.correspondences.filter(row => row.label !== 'Tarot'));
      continue;
    }
    const donor = oldParts.find(entry => entry.id === donorId);
    for (const key of ['id', 'title', 'number', 'hebrew', 'modelKey', 'subtitle']) assert.equal(actual[key], part[key]);
    assert.deepEqual(actual.tarotCardIds, donor.tarotCardIds);
    assert.deepEqual(actual.palette, donor.palette);
    const field = (entry, label) => entry.correspondences.find(item => item.label === label)?.value;
    for (const label of ['Tarot', 'Zodiac', 'Jewel']) assert.equal(field(actual, label), field(donor, label));
    for (const label of ['Letter / value', 'Letter meaning', 'Final letter / value', 'Intelligence']) assert.equal(field(actual, label), field(part, label));
  }
  assert.strictEqual(mod.exports.partsForAeon('old'), oldParts);
  assert.equal(JSON.stringify(content), before);
});


test('Thoth deck has 78 complete local images with correct semantic and court mappings', () => {
  const deck = require('../src/components/community/tools/thoth-cards.json');
  const rws = require('../src/components/community/tools/tarot-cards.json');
  const crypto = require('node:crypto');
  assert.equal(deck.cards.length, 78);
  assert.deepEqual(deck.cards.map(card => card.id).sort(), rws.cards.map(card => card.id).sort());
  assert.equal(new Set(deck.cards.map(card => card.sha256)).size, 78);
  for (const card of deck.cards) {
    const bytes = fs.readFileSync(path.join(__dirname, '../public', card.src));
    assert.equal(bytes.subarray(0,4).toString(), 'RIFF', card.id);
    assert.equal(bytes.subarray(8,12).toString(), 'WEBP', card.id);
    assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), card.sha256, card.id);
    assert.ok(card.width > 0 && card.height > card.width, card.id);
    assert.match(card.originalUrl, /^https:\/\/tarotfans\.com\//);
  }
  const name = id => deck.cards.find(card => card.id === id).name;
  assert.equal(name('major-08'), 'XI — Lust');
  assert.equal(name('major-11'), 'VIII — Adjustment');
  assert.equal(name('major-14'), 'XIV — Art');
  assert.equal(name('major-20'), 'XX — The Aeon');
  assert.equal(name('major-21'), 'XXI — The Universe');
  for (const suit of ['wands','cups','swords','pentacles']) {
    assert.match(name(`${suit}-11`), /^Princess of /);
    assert.match(name(`${suit}-12`), /^Prince of /);
    assert.match(name(`${suit}-13`), /^Queen of /);
    assert.match(name(`${suit}-14`), /^Knight of /);
  }
  assert.equal(name('pentacles-01'), 'Ace of Disks');
});
