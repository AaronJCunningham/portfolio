import { GEO } from './nyc-geodata.js';
import { isSurfaceRoad, connectBuildingPassage } from './building-passages.js';

// Berlin spatial adapter for mrdoob/slop-newyork's original engine.
// Legacy export names are retained as API aliases; all visible geography is Berlin.
// 1 unit = 1 metre, x east, z south, origin 13.405° E / 52.52° N.
const BERLIN_DATA = GEO.berlin;
export const BERLIN_ROAD_GRAPH = connectBuildingPassage(GEO.roadGraph, BERLIN_DATA.roads);
const toPts = (flat) => { const out=[]; for(let i=0;i<flat.length;i+=2)out.push({x:flat[i],z:flat[i+1]});return out; };
const projectLonLat = (lon,lat) => ({x:(lon-13.405)*111319.49*Math.cos(52.52*Math.PI/180),z:(52.52-lat)*111319.49});
const [minX,minZ,maxX,maxZ] = BERLIN_DATA.meta.bounds;
const ISLAND_BOUNDS = {minX,maxX,minZ,maxZ,sidewalkHeight:0.22,waterLevel:-2.2};
const CUT_Z=minZ;
const MANHATTAN_COASTLINE=toPts(GEO.manhattan);
const getIslandBoundsAtZ=()=>({westX:minX,eastX:maxX});
// Mitte has an arbitrary mapped street network. Empty legacy grid registries prevent
// the original corridor builder from inventing axis-aligned Manhattan streets.
const AVENUES=[], ALL_AVENUES=[], STREETS=[], ALL_STREETS=[];
const BROADWAY_LINE=[];
const getBroadwayX=()=>0;
const WATERFRONT_PIERS=[], EAST_RIVER_BRIDGES=[], OUTER_BRIDGES=[];
const ROOSEVELT_ISLAND_POLYGON=[],GOVERNORS_ISLAND_POLYGON=[],NJ_SHORELINE_POLYGON=[],LONG_ISLAND_POLYGON=[],LONG_ISLAND_POLYGONS=[],BROOKLYN_POLYGONS=[],QUEENS_POLYGONS=[],BRONX_POLYGONS=[],WESTCHESTER_POLYGON=[],NASSAU_POLYGON=[],UPPER_MANHATTAN_POLYGON=[],BRONX_POLYGON=[],STATEN_ISLAND_POLYGON=[],RANDALLS_ISLAND_POLYGON=[],LIBERTY_ISLAND_POLYGON=[],ELLIS_ISLAND_POLYGON=[],MILL_ROCK_POLYGON=[];
const LIBERTY_STATUE_POS={x:0,z:0};
// The legacy park bounds now describe the mapped eastern Tiergarten, never Central Park.
const CENTRAL_PARK_BOUNDS={minX:-2709.4,maxX:-1870,minZ:160,maxZ:1210};
const ROADS=BERLIN_DATA.roads.filter(isSurfaceRoad).map(r=>({...r,raw:r.name,name:r.name||`Unnamed ${r.kind}`,w:r.width,dir:r.oneway?(r.reverse?-1:1):0,highway:/motorway|trunk/.test(r.kind),pts:toPts(r.pts)}));
const DRIVABLE=new Set(['motorway','motorway_link','trunk','trunk_link','primary','primary_link','secondary','secondary_link','tertiary','tertiary_link','residential','unclassified','living_street']);
const ROAD_DRIVING=ROADS.filter(r=>DRIVABLE.has(r.kind));
const BERLIN_AREAS=(BERLIN_DATA.meta.areas||[]).map(a=>({...a,polygons:(a.polygons||[]).map(p=>({
 poly:toPts(p.ring),holes:(p.holes||[]).map(toPts)
}))}));
function districtAt(x,z){
 for(const area of BERLIN_AREAS){
  if(area.id==='mitte')continue;
  const b=area.bounds;
  if(b&&(x<b[0]||z<b[1]||x>b[2]||z>b[3]))continue;
  if(area.polygons.some(p=>pointInPoly(p.poly,x,z)&&!p.holes.some(h=>pointInPoly(h,x,z))))return area.id;
 }
 if(x<-1870&&z>160)return 'tiergarten';
 if(x<-1400&&z<220)return 'regierungsviertel';
 if(x>150&&z<100)return 'alexanderplatz';
 if(z<-360)return 'spandauer_vorstadt';
 if(z>500)return 'friedrichstadt';
 return 'mitte';
}
function makeBlock(b,id,park=0){
 const poly=toPts(b.ring),holes=(b.holes||[]).map(toPts);
 let minX=Infinity,maxX=-Infinity,minZ=Infinity,maxZ=-Infinity,a=0,cx=0,cz=0;
 for(let i=0,j=poly.length-1;i<poly.length;j=i++){
  const p=poly[i],q=poly[j],c=q.x*p.z-p.x*q.z;
  minX=Math.min(minX,p.x);maxX=Math.max(maxX,p.x);minZ=Math.min(minZ,p.z);maxZ=Math.max(maxZ,p.z);a+=c;cx+=(q.x+p.x)*c;cz+=(q.z+p.z)*c;
 }
 a*=.5;cx=a?cx/(6*a):(minX+maxX)/2;cz=a?cz/(6*a):(minZ+maxZ)/2;
 return {id,osmId:b.id,poly,holes,rects:[],frames:null,park,parkName:park?b.name:'',rect:false,area:Math.abs(a),minX,maxX,minZ,maxZ,cx,cz,median:false,district:districtAt(cx,cz)};
}
const BLOCKS=[...BERLIN_DATA.buildings.filter(b=>!b.part).map((b,i)=>makeBlock(b,i)),...BERLIN_DATA.parks.map((b,i)=>makeBlock(b,'park:'+i,1))];
const LANDMARK_BLOCKS=new Set();
const LANDMARK_SITES=GEO.landmarks;
function getBlockBounds(col,row){return BLOCKS[Number.isInteger(col)?col:0]||{minX:0,maxX:0,minZ:0,maxZ:0,cx:0,cz:0,width:0,depth:0};}
const avenueNameAt=(a)=>a?.short||a?.name||'';
const avenueX=()=>0;
const fromOldFrame=(x,z)=>({x,z});
// Nearest-road index (labels, sidewalk tests): uniform grid of road segments
const ROAD_CELL = 64;
const ROAD_GRID = new Map();
for (const r of ROADS) {
  for (let i = 0; i + 1 < r.pts.length; i++) {
    const a = r.pts[i];
    const b = r.pts[i + 1];
    const seg = { r, ax: a.x, az: a.z, bx: b.x, bz: b.z };
    const ix0 = Math.floor(Math.min(a.x, b.x) / ROAD_CELL), ix1 = Math.floor(Math.max(a.x, b.x) / ROAD_CELL);
    const iz0 = Math.floor(Math.min(a.z, b.z) / ROAD_CELL), iz1 = Math.floor(Math.max(a.z, b.z) / ROAD_CELL);
    for (let ix = ix0; ix <= ix1; ix++) for (let iz = iz0; iz <= iz1; iz++) {
      const k = ix * 100000 + iz;
      if (!ROAD_GRID.has(k)) ROAD_GRID.set(k, []);
      ROAD_GRID.get(k).push(seg);
    }
  }
}
/** Nearest roads to (x, z) within `radius`: [{ road, dist }] sorted by distance (one entry per road name) */
function nearestRoads(x, z, radius = 60) {
  const best = new Map();
  const ix0 = Math.floor((x - radius) / ROAD_CELL), ix1 = Math.floor((x + radius) / ROAD_CELL);
  const iz0 = Math.floor((z - radius) / ROAD_CELL), iz1 = Math.floor((z + radius) / ROAD_CELL);
  for (let ix = ix0; ix <= ix1; ix++) for (let iz = iz0; iz <= iz1; iz++) {
    const list = ROAD_GRID.get(ix * 100000 + iz);
    if (!list) continue;
    for (const s of list) {
      const dx = s.bx - s.ax, dz = s.bz - s.az;
      const L2 = dx * dx + dz * dz || 1e-9;
      const t = Math.max(0, Math.min(1, ((x - s.ax) * dx + (z - s.az) * dz) / L2));
      const d = Math.hypot(s.ax + t * dx - x, s.az + t * dz - z);
      if (d > radius) continue;
      const prev = best.get(s.r.name);
      if (!prev || d < prev.dist) best.set(s.r.name, { road: s.r, dist: d, horizontal: Math.abs(dx) > Math.abs(dz) });
    }
  }
  return [...best.values()].sort((a, b) => a.dist - b.dist);
}

// Spatial index of the blocks (64 m cells)
const BLOCK_CELL = 64;
const BLOCK_GRID = new Map();
for (const b of BLOCKS) {
  for (let ix = Math.floor(b.minX / BLOCK_CELL); ix <= Math.floor(b.maxX / BLOCK_CELL); ix++) {
    for (let iz = Math.floor(b.minZ / BLOCK_CELL); iz <= Math.floor(b.maxZ / BLOCK_CELL); iz++) {
      const k = ix * 100000 + iz;
      if (!BLOCK_GRID.has(k)) BLOCK_GRID.set(k, []);
      BLOCK_GRID.get(k).push(b);
    }
  }
}
function pointInPoly(poly, x, z) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a.z > z) !== (b.z > z) && x < ((b.x - a.x) * (z - a.z)) / (b.z - a.z) + a.x) inside = !inside;
  }
  return inside;
}
/** The block (curb island) under (x, z), or null on the roadway / in the water */
function blockAt(x, z) {
  const list = BLOCK_GRID.get(Math.floor(x / BLOCK_CELL) * 100000 + Math.floor(z / BLOCK_CELL));
  for (const b of list || []) {
    if (x < b.minX || x > b.maxX || z < b.minZ || z > b.maxZ) continue;
    if ((b.rect || pointInPoly(b.poly, x, z)) && !b.holes.some(h=>pointInPoly(h,x,z))) return b;
  }
  return sidewalkAt(x,z);
}
function sidewalkAt(x,z){
  if(waterAt(x,z)&&!nearestRoads(x,z,24).some(q=>q.road.bridge&&q.dist<q.road.w/2+3))return null;
  for(const q of nearestRoads(x,z,24)){
    const r=q.road, pedestrian=['footway','pedestrian','path','cycleway','steps'].includes(r.kind);
    if((pedestrian&&q.dist<=r.w/2)||(!pedestrian&&q.dist>=r.w/2-.4&&q.dist<=r.w/2+5.5))return {id:'sidewalk:'+r.id,sidewalk:true,park:0,median:false,cx:x,cz:z,district:districtAt(x,z)};
  }
  return null;
}
/** Blocks whose bounds overlap a rectangle */
function blocksInRect(minX, maxX, minZ, maxZ) {
  const out = new Set();
  for (let ix = Math.floor(minX / BLOCK_CELL); ix <= Math.floor(maxX / BLOCK_CELL); ix++) {
    for (let iz = Math.floor(minZ / BLOCK_CELL); iz <= Math.floor(maxZ / BLOCK_CELL); iz++) {
      const list = BLOCK_GRID.get(ix * 100000 + iz);
      if (list) for (const b of list) if (b.maxX > minX && b.minX < maxX && b.maxZ > minZ && b.minZ < maxZ) out.add(b);
    }
  }
  return [...out];
}


const WATER_POLYGONS=BERLIN_DATA.water.map(w=>{const poly=toPts(w.ring);return {...w,poly,inner:(w.holes||[]).map(toPts),minX:Math.min(...poly.map(p=>p.x)),maxX:Math.max(...poly.map(p=>p.x)),minZ:Math.min(...poly.map(p=>p.z)),maxZ:Math.max(...poly.map(p=>p.z))};});
function waterAt(x,z){return WATER_POLYGONS.some(w=>x>=w.minX&&x<=w.maxX&&z>=w.minZ&&z<=w.maxZ&&pointInPoly(w.poly,x,z)&&!w.inner.some(h=>pointInPoly(h,x,z)));}
function nearestDrivingPoint(x,z,name=null){
 let best=null,dist=Infinity;
 for(const r of ROAD_DRIVING.filter(r=>!name||r.name===name))for(let i=0;i+1<r.pts.length;i++){
  const a=r.pts[i],b=r.pts[i+1],dx=b.x-a.x,dz=b.z-a.z,L2=dx*dx+dz*dz;if(L2<1)continue;
  const t=Math.max(0.02,Math.min(.98,((x-a.x)*dx+(z-a.z)*dz)/L2)),px=a.x+t*dx,pz=a.z+t*dz,d=Math.hypot(px-x,pz-z);
  if(d<dist){dist=d;const sign=r.dir<0?-1:1;best={x:px,z:pz,heading:Math.atan2(dx*sign,dz*sign),road:r};}
 }
 return best;
}
function arrival(lon,lat,name=null){const p=projectLonLat(lon,lat),q=nearestDrivingPoint(p.x,p.z,name);return q?{x:q.x,z:q.z,heading:q.heading}:{...p,heading:0};}
const defaultSpawn=arrival(13.3893,52.51715,'Unter den Linden');
defaultSpawn.x-=Math.cos(defaultSpawn.heading)*1.8;defaultSpawn.z+=Math.sin(defaultSpawn.heading)*1.8;defaultSpawn.name='Unter den Linden';
// Legacy material code samples ordered district bands through streetZ; keep distinct
// thresholds so upstream TSL smoothstep edges never coincide. No numbered roads are built.
const streetZ=(n=37)=>defaultSpawn.z+(37-Number(n))*25;
const TELEPORT_LOCATIONS={
 fernsehturm:arrival(13.4085,52.5216),brandenburg:arrival(13.3767,52.5163),reichstag:arrival(13.3748,52.5188),dom:arrival(13.4024,52.5194),
 hauptbahnhof:arrival(13.3696,52.5267,'Invalidenstraße'),gendarmenmarkt:arrival(13.3945,52.5134),rotesrathaus:arrival(13.4070,52.5188,'Spandauer Straße'),neuesynagoge:arrival(13.3945,52.5247)
};
const NYC_LANDMARKS=[
 ['fernsehturm','Berliner Fernsehturm','Fernsehturm',13.40942,52.52080,'Alexanderplatz'],
 ['brandenburg','Brandenburger Tor','Brandenburger Tor',13.37770,52.51627,'Pariser Platz'],
 ['reichstag','Reichstagsgebäude','Reichstag',13.3761011,52.5185959,'Regierungsviertel'],
 ['dom','Berliner Dom','Berliner Dom',13.401012,52.519061,'Museumsinsel'],
 ['hauptbahnhof','Berlin Hauptbahnhof','Hauptbahnhof',13.369402,52.525084,'Moabit'],
 ['gendarmenmarkt','Gendarmenmarkt','Gendarmenmarkt',13.39270,52.51360,'Friedrichstadt'],
 ['rotesrathaus','Rotes Rathaus','Rotes Rathaus',13.408555,52.5182743,'Alt-Berlin'],
 ['neuesynagoge','Neue Synagoge','Neue Synagoge',13.3942149,52.5249365,'Spandauer Vorstadt'],
 ['kreuzbergdenkmal','Nationaldenkmal im Viktoriapark','Viktoriapark',13.38148,52.48765,'Kreuzberg'],
 ['kottbussertor','Kottbusser Tor','Kottbusser Tor',13.4180,52.4990,'Kreuzberg'],
 ['oberbaum','Oberbaumbrücke','Oberbaumbrücke',13.4456296,52.5017485,'Kreuzberg / Friedrichshain'],
 ['frankfurtertor','Frankfurter Tor','Frankfurter Tor',13.4526224,52.5160795,'Friedrichshain'],
 ['berghain','Berghain','Berghain',13.4432908368,52.5113370965,'Friedrichshain'],
 ['charlottenburg','Schloss Charlottenburg','Schloss Charlottenburg',13.2957045,52.5208787,'Charlottenburg'],
 ['gedaechtniskirche','Kaiser-Wilhelm-Gedächtniskirche','Gedächtniskirche',13.33519,52.50480,'Charlottenburg']
].map(([id,name,short,lon,lat,district])=>({id,name,short,...projectLonLat(lon,lat),district}));
// Keep vehicle arrivals on real streets around each new destination; the park,
// pedestrian plazas and church interiors remain available by walking or map tap.
Object.assign(TELEPORT_LOCATIONS,{
 kreuzbergdenkmal:arrival(13.38225,52.48927,'Kreuzbergstraße'),
 kottbussertor:arrival(13.41830,52.49900,'Skalitzer Straße'),
 oberbaum:arrival(13.4450,52.5011,'Oberbaumstraße'),
 frankfurtertor:arrival(13.4543,52.51595,'Karl-Marx-Allee'),
 berghain:arrival(13.44257224,52.51068447,'Am Wriezener Bahnhof'),
 charlottenburg:arrival(13.29560,52.51875,'Spandauer Damm'),
 gedaechtniskirche:arrival(13.33545,52.50405,'Tauentzienstraße')
});
// Road-centreline approaches checked against the actual Ringbahn polygon.
// These are neighbourhood destinations, not additional hand-modelled monuments.
const RINGBAHN_PLACES=[
 ['moabit','Kleiner Tiergarten','Kleiner Tiergarten','Moabit',13.3445314,52.5262080,'Turmstraße'],
 ['wedding','Wedding · Reinickendorfer Straße','Wedding','Wedding',13.3700126,52.5400794,'Müllerstraße'],
 ['gesundbrunnen','Gesundbrunnen · Südseite','Gesundbrunnen','Gesundbrunnen',13.38923672,52.54712286,'Brunnenstraße'],
 ['kollwitzplatz','Kollwitzplatz','Kollwitzplatz','Prenzlauer Berg',13.4175988,52.5359181,'Kollwitzstraße'],
 ['winterfeldtplatz','Winterfeldtplatz','Winterfeldtplatz','Schöneberg',13.3539580,52.4965089,'Goltzstraße'],
 ['ludwigkirchplatz','Ludwigkirchplatz','Ludwigkirchplatz','Wilmersdorf',13.32028195,52.49759939,'Ludwigkirchplatz'],
 ['hermannplatz','Hermannplatz','Hermannplatz','Neukölln',13.4250003,52.4870313,'Hermannplatz'],
 ['tempelhoferfeld','Tempelhofer Feld · Nordeingang','Tempelhofer Feld','Tempelhof',13.4067003,52.4825505,'Columbiadamm'],
 ['schlesischerbusch','Schlesischer Busch','Schlesischer Busch','Alt-Treptow',13.4503197,52.4963493,'Puschkinallee'],
 ['hansaplatz','Hansaplatz','Hansaplatz','Hansaviertel',13.3424117,52.5177102,'Altonaer Straße']
];
if(BERLIN_DATA.meta.ringbahn)for(const [id,name,short,district,lon,lat,road] of RINGBAHN_PLACES){
 TELEPORT_LOCATIONS[id]=arrival(lon,lat,road);
 NYC_LANDMARKS.push({id,name,short,district,...projectLonLat(lon,lat),place:true});
}
for(const lm of NYC_LANDMARKS){const p=TELEPORT_LOCATIONS[lm.id];if(!lm.place)p.heading=Math.atan2(lm.x-p.x,lm.z-p.z);}
for(const lm of NYC_LANDMARKS)if(!LANDMARK_SITES[lm.name])LANDMARK_SITES[lm.name]={x:lm.x,z:lm.z,w:60,d:60,h:20,ring:[]};
// Highlight the mapped power-station footprint, including the attached Halle,
// instead of drawing a generic landmark square over the surrounding club site.
const berghainFootprint=BERLIN_DATA.buildings.find(b=>b.id==='w25649554');
if(berghainFootprint)LANDMARK_SITES.Berghain={...LANDMARK_SITES.Berghain,w:37.8,d:76.6,h:25.5,ring:berghainFootprint.ring};
function getLocationLabel(x,z){
 for(const lm of NYC_LANDMARKS)if(Math.hypot(x-lm.x,z-lm.z)<100)return lm.name;
 const nearby=nearestRoads(x,z,100).filter(q=>q.road.raw);
 if(nearby.length>1&&nearby[1].dist<22)return `${nearby[0].road.name} & ${nearby[1].road.name}`;
 if(nearby.length)return nearby[0].road.name;
 if(waterAt(x,z))return 'Berlin · Wasser';
 const district=districtAt(x,z);
 const name=BERLIN_AREAS.find(a=>a.id===district)?.name||district.split('_').map(w=>w[0].toUpperCase()+w.slice(1)).join(' ');
 return name+' · Berlin';
}
// Keyboard shortcuts are ignored while typing into a form field (e.g. the map's street search box)
function isTypingInField(e) {
  return e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT');
}

// Traffic signal cycle shared by the signal heads (street-details.js) and the traffic (traffic.js), in seconds:
// avenues green until avenueAmber, amber until avenueRed; cross streets green from avenueRed until streetAmber,
// amber until the end of the cycle. Pedestrians cross with the traffic that runs parallel to them, stepping off
// only on the WALK, the first `walk` seconds of its green: long enough before the cross traffic's green for the
// slowest walker to get across the widest avenue.
const SIGNAL_TIMING = { cycle: 60, avenueAmber: 26, avenueRed: 30, streetAmber: 56, walk: 7 };

// 'green', 'amber' or 'red' for avenue or cross street traffic at a given time
function signalPhase(time, isAvenue) {
  const { cycle, avenueAmber, avenueRed, streetAmber } = SIGNAL_TIMING;
  const t = ((time % cycle) + cycle) % cycle;
  if (isAvenue) return t < avenueAmber ? 'green' : t < avenueRed ? 'amber' : 'red';
  return t < avenueRed ? 'red' : t < streetAmber ? 'green' : 'amber';
}

// Do pedestrians walking alongside avenue (or cross street) traffic have the WALK at a given time?
function walkSignal(time, isAvenue) {
  const { cycle, avenueRed, walk } = SIGNAL_TIMING;
  const t = (((time - (isAvenue ? 0 : avenueRed)) % cycle) + cycle) % cycle;
  return t < walk;
}
export {
  BERLIN_DATA, BERLIN_AREAS, toPts, projectLonLat, pointInPoly, waterAt, nearestDrivingPoint, defaultSpawn, sidewalkAt,
  AVENUES,
  ALL_AVENUES,
  CENTRAL_PARK_BOUNDS,
  getIslandBoundsAtZ,
  MANHATTAN_COASTLINE,
  getBroadwayX,
  BROADWAY_LINE,
  WATERFRONT_PIERS,
  ROOSEVELT_ISLAND_POLYGON,
  GOVERNORS_ISLAND_POLYGON,
  NJ_SHORELINE_POLYGON,
  LONG_ISLAND_POLYGON,
  LONG_ISLAND_POLYGONS,
  BROOKLYN_POLYGONS,
  QUEENS_POLYGONS,
  BRONX_POLYGONS,
  WESTCHESTER_POLYGON,
  NASSAU_POLYGON,
  UPPER_MANHATTAN_POLYGON,
  BRONX_POLYGON,
  STATEN_ISLAND_POLYGON,
  RANDALLS_ISLAND_POLYGON,
  LIBERTY_ISLAND_POLYGON,
  LIBERTY_STATUE_POS,
  ELLIS_ISLAND_POLYGON,
  MILL_ROCK_POLYGON,
  EAST_RIVER_BRIDGES,
  OUTER_BRIDGES,
  STREETS,
  ALL_STREETS,
  ROADS,
  NYC_LANDMARKS,
  LANDMARK_SITES,
  TELEPORT_LOCATIONS,
  ISLAND_BOUNDS,
  LANDMARK_BLOCKS,
  BLOCKS,
  CUT_Z,
  SIGNAL_TIMING,
  streetZ,
  avenueX,
  avenueNameAt,
  districtAt,
  blockAt,
  blocksInRect,
  nearestRoads,
  getBlockBounds,
  getLocationLabel,
  fromOldFrame,
  isTypingInField,
  signalPhase,
  walkSignal
};
