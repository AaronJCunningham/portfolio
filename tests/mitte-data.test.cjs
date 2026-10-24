const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {gunzipSync} = require('node:zlib');
const {createHash} = require('node:crypto');
const dir = path.join(__dirname, '../public/experiments/berlin/mitte/data');
const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json')));
const context = JSON.parse(gunzipSync(fs.readFileSync(path.join(dir, 'context.json.gz'))));
const binary = gunzipSync(fs.readFileSync(path.join(dir, 'buildings.bin.gz')));

test('official geometry has complete provenance and survives triangulation without losing surface area', () => {
  assert.equal(manifest.sources.length, 4);
  assert.ok(manifest.sources.every(s => s.url.startsWith('https://gdi.berlin.de/data/a_lod2/atom/') && /^[a-f0-9]{64}$/.test(s.sha256)));
  assert.equal(createHash('sha256').update(binary).digest('hex'), manifest.geometrySha256);
  assert.equal(binary.byteLength, manifest.geometryBytes);
  assert.equal(binary.byteLength / 36, manifest.triangles);
  assert.ok(manifest.validation.maxProjectedAreaErrorM2 < 0.001);
  assert.equal(context.buildings.length, manifest.buildingParts);
  assert.equal(new Set(context.buildings.map(b => b.parent)).size, manifest.buildings);
});

test('render batches map every vertex to the correct source building and preserve its 3D extent', () => {
  const bounds = context.buildings.map(() => [Infinity,Infinity,Infinity,-Infinity,-Infinity,-Infinity]);
  let offset = 0;
  for (const chunk of context.chunks) {
    assert.equal(chunk.offset, offset);
    let start = 0;
    for (const range of chunk.ranges) {
      assert.equal(range.start, start);
      assert.equal(range.count % 3, 0);
      const box = bounds[range.building];
      assert.ok(box);
      for (let v=range.start;v<range.start+range.count;v++) for (let axis=0;axis<3;axis++) {
        const value = binary.readFloatLE(chunk.offset + (v*3+axis)*4);
        assert.ok(Number.isFinite(value));
        box[axis]=Math.min(box[axis],value);box[axis+3]=Math.max(box[axis+3],value);
      }
      start += range.count;
    }
    assert.equal(start, chunk.count);
    offset += chunk.count*12;
  }
  assert.equal(offset,binary.length);
  for (let i=0;i<bounds.length;i++) for (let axis=0;axis<6;axis++) assert.ok(Math.abs(bounds[i][axis]-context.buildings[i].bounds[axis])<0.002, `Extent mismatch for ${context.buildings[i].id}`);
});

test('named street viewpoints are on their mapped streets, within the trial and above finite terrain', () => {
  for (const place of context.places) {
    assert.ok(place.position.every(Number.isFinite));
    assert.ok(Math.abs(place.position[0])<1000 && Math.abs(place.position[2])<1000);
    if (place.name.endsWith('straße')) assert.equal(place.street,place.name);
    assert.ok(Math.abs(Math.hypot(...place.direction)-1)<1e-8);
  }
  assert.equal(context.terrain.heights.length,context.terrain.size**2);
  assert.ok(context.terrain.heights.every(Number.isFinite));
});

const streetContext=JSON.parse(gunzipSync(fs.readFileSync(path.join(dir,'auguststrasse/context.json.gz'))));

test('simple street volumes retain mapped extents, source wall tops and known storey counts',()=>{
  assert.ok(streetContext.simpleVolumes.length>50);
  for(const v of streetContext.simpleVolumes){
    const source=streetContext.buildings[v.building];
    assert.equal(source.id,v.id);
    assert.ok(v.top>v.base&&v.top<=source.bounds[4]+.002);
    assert.equal(v.base,source.bounds[1]);
    assert.ok(Number.isInteger(v.floors)&&v.floors>0&&v.floors<20);
    for(const ring of [v.ring,...v.holes]){
      assert.ok(ring.length>=3);
      for(const [x,z] of ring){
        assert.ok(x>=source.bounds[0]-.002&&x<=source.bounds[3]+.002);
        assert.ok(z>=source.bounds[2]-.002&&z<=source.bounds[5]+.002);
      }
    }
    const fronts=streetContext.street.fronts.filter(f=>f.building===v.id);
    if(fronts.length)assert.equal(v.top,Math.max(...fronts.map(f=>f.top)));
  }
  const five=streetContext.simpleVolumes.find(v=>v.id==='DEBE01YYK0000CLA');
  assert.equal(five.floors,5);assert.equal(five.floorSource,'OpenStreetMap building:levels');
  const kw=streetContext.simpleVolumes.find(v=>v.id==='DEBE3DPtpAXCXoId');
  assert.equal(kw.floors,2);assert.equal(kw.top,12.789);
});

test('simple walls meet the terrain along every footprint edge without shifting the source roofline',async()=>{
  const source=fs.readFileSync(path.join(dir,'../ground.js'),'utf8');
  const {sampleTerrain,simpleWallGeometry}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
  const terrainHeight=(x,z)=>sampleTerrain(streetContext.terrain,x,z)-.2;
  const height=(x,z)=>sampleTerrain(streetContext.terrain,x,z);
  for(const volume of streetContext.simpleVolumes)for(const ring of [volume.ring,...volume.holes])for(let i=0;i<ring.length;i++){
    const {positions:p,uv}=simpleWallGeometry(ring[i],ring[(i+1)%ring.length],volume.base,volume.top,height);
    assert.equal(p.length/3,uv.length/2);
    for(let j=0;j<p.length;j+=18){
      // Each segment's bottom edge must meet terrain at both ends and midway.
      for(const t of [0,.5,1]){
        const x=p[j]+(p[j+3]-p[j])*t,z=p[j+2]+(p[j+5]-p[j+2])*t;
        const bottom=p[j+1]+(p[j+4]-p[j+1])*t;
        assert.ok(bottom<=terrainHeight(x,z),`Floating base on ${volume.id}`);
      }
      assert.equal(p[j+7],volume.top);assert.equal(p[j+16],volume.top);
    }
  }
});
