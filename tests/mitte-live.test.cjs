const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {gunzipSync}=require('node:zlib');
const {createHash}=require('node:crypto');
const root=path.join(__dirname,'../public/experiments/berlin');
const data=JSON.parse(gunzipSync(fs.readFileSync(path.join(root,'data/berlin.json.gz'))));
const update=data.meta.mitteBuildingUpdate;
const official=data.buildings.filter(b=>b.geometrySource==='Berlin LoD2'&&b.accuracyArea==='mitte');
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');

test('the live module and downloadable dataset contain the same updated city',()=>{
 const source=fs.readFileSync(path.join(root,'js/nyc-geodata.js'),'utf8');
 const geo=JSON.parse(source.split('export const GEO = ')[1].split(';\n')[0]);
 if(geo.berlin===null){
  assert.match(source,/import \{ BERLIN_DATA \} from '\.\/berlin-geodata\.js'/);
  assert.match(source,/GEO\.berlin = BERLIN_DATA;/);
  geo.berlin=JSON.parse(fs.readFileSync(path.join(root,'js/berlin-geodata.js'),'utf8').split('export const BERLIN_DATA = ')[1].trim().replace(/;$/,''));
 }
 assert.equal(hash(geo.berlin),hash(data));
 assert.equal(data.buildings.length,data.meta.counts.buildings);
 assert.equal(new Set(data.buildings.map(b=>b.id)).size,data.buildings.length);
});

test('approved Mitte buildings and their original geometry budget remain intact',()=>{
 if(data.meta.ringbahnBuildingUpdate){
  assert.equal(hash(data.buildings.filter(b=>b.accuracyArea==='mitte')),data.meta.ringbahnBuildingUpdate.preservedMitteSha256);
 }else{
  assert.equal(hash(data.buildings.filter(b=>b.accuracyArea!=='mitte')),update.preservedOutsideMitteSha256);
  const edges=data.buildings.reduce((sum,b)=>sum+(b.ring.length+b.holes.reduce((n,h)=>n+h.length,0))/2,0);
  assert.equal(edges,update.stats.newFacadeEdges);
 }
 assert.equal(official.length,update.stats.officialVolumes);
 assert.equal(update.stats.replacedExisting+update.stats.retainedUnmatched,update.stats.processedExisting);
 assert.ok(update.stats.newFacadeEdges<=update.stats.oldFacadeEdges*1.05,'Approved Mitte facade count stayed within 5% of the original city');
 assert.ok(update.sources.every(s=>s.url.startsWith('https://gdi.berlin.de/data/a_lod2/atom/')&&/^[a-f0-9]{64}$/.test(s.sha256)));
});

test('official buildings have finite footprints, grounded simple masses and traceable heights',()=>{
 for(const b of official){
  assert.ok(b.sourceBuildingIds.length&&b.sourceParent);
  assert.equal(b.roofShape,'flat');assert.equal(b.roofHeight,0);
  assert.equal(b.minHeight||0,0);
  assert.ok(b.h>=1&&b.h<400);
  assert.ok(Number.isInteger(b.facadeLevels)&&b.facadeLevels>0);
  for(const ring of [b.ring,...b.holes]){
   assert.ok(ring.length>=6&&ring.length%2===0);
   assert.ok(ring.every(Number.isFinite));
  }
 }
});

test('low KW frontage stays two storeys beside taller wings, with a restrained reference colour',()=>{
 const kw=official.filter(b=>b.sourceParent==='DEBE01YYK00002jD');
 const front=kw.find(b=>b.sourceBuildingIds.includes('DEBE3DPtpAXCXoId'));
 assert.ok(front);assert.equal(front.h,9.99);assert.equal(front.facadeLevels,2);assert.equal(front.colour,'#dcd6c4');
 assert.ok(kw.some(b=>b.h>front.h+4),'Distinct courtyard heights should not become one tall block');
 const school=official.filter(b=>b.sourceParent==='DEBE01YYK00005tt');
 assert.ok(school.some(b=>b.h>15&&b.facadeLevels===5&&b.colour==='#765044'));
});
