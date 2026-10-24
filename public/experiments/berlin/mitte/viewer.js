import * as THREE from 'three/webgpu';
import {sampleTerrain, foundationPositions} from './ground.js?v=simple-3';
import {buildSimpleStreet, roadMaterial} from './street-detail.js?v=simple-3';

const $ = id => document.getElementById(id);
const streetStudy = window.location.pathname.endsWith('/auguststrasse');
const dataPath = streetStudy ? './data/auguststrasse/' : './data/';
const canvas = $('view');
const scene = new THREE.Scene();
scene.background = new THREE.Color(streetStudy ? '#67b3df' : '#c9d1d2');
scene.fog = new THREE.Fog(scene.background, streetStudy ? 135 : 1700, streetStudy ? 340 : 3800);
const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.2, 6000);
const renderer = new THREE.WebGPURenderer({canvas, antialias: true});
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.7));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = streetStudy ? 1.23 : 1.25;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
scene.add(new THREE.HemisphereLight('#e4f1ff', '#a59d83', streetStudy ? 2.2 : 1.5));
const sun = new THREE.DirectionalLight('#fff0d7', 2.5);
sun.position.set(-500, 900, 350);
sun.castShadow = true;
sun.shadow.mapSize.set(2048,2048);
const shadowWidth=streetStudy ? 130 : 600;
Object.assign(sun.shadow.camera,{left:-shadowWidth,right:shadowWidth,top:shadowWidth,bottom:-shadowWidth,near:50,far:2000});
sun.shadow.camera.updateProjectionMatrix();
sun.shadow.bias = -0.0001;
sun.shadow.normalBias = .18;
scene.add(sun,sun.target);
const official = new THREE.Group(), previous = new THREE.Group();
previous.visible = false;
scene.add(official, previous);
const mats = {
  wall: new THREE.MeshStandardMaterial({color: '#d5ccb5', roughness: 1, side: THREE.DoubleSide}),
  roof: new THREE.MeshStandardMaterial({color: '#838b89', roughness: 1, side: THREE.DoubleSide}),
  base: new THREE.MeshStandardMaterial({color: '#a5a497', roughness: 1, side: THREE.DoubleSide}),
};
let context, manifest, ready = false, mode = 'orbit', activeLayer = 'official';
let yaw = 0.6, pitch = 0, azimuth = 0.5, elevation = 0.8, distance = 600;
const target = new THREE.Vector3(), eye = new THREE.Vector3();
const keys = new Set(), raycaster = new THREE.Raycaster();
let highlighted;
let streetDetails;

async function unzip(url, json = false) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Could not load ${url}`);
  const unpacked = new Response(response.body.pipeThrough(new DecompressionStream('gzip')));
  return json ? unpacked.json() : unpacked.arrayBuffer();
}
function height(x, z) {
  return sampleTerrain(context.terrain,x,z);
}
// Cut context roads at terrain triangle edges so they cannot sink into slopes.
function drapeRoad(quad, output) {
  const t=context.terrain;
  const minX=Math.max(0,Math.floor((Math.min(...quad.map(p=>p[0]))-t.min)/t.step));
  const maxX=Math.min(t.size-2,Math.floor((Math.max(...quad.map(p=>p[0]))-t.min)/t.step));
  const minZ=Math.max(0,Math.floor((Math.min(...quad.map(p=>p[1]))-t.min)/t.step));
  const maxZ=Math.min(t.size-2,Math.floor((Math.max(...quad.map(p=>p[1]))-t.min)/t.step));
  for(let iz=minZ;iz<=maxZ;iz++) for(let ix=minX;ix<=maxX;ix++) {
    const x=t.min+ix*t.step,z=t.min+iz*t.step,s=t.step;
    for(const tri of [[[x,z],[x+s,z],[x,z+s]],[[x+s,z],[x+s,z+s],[x,z+s]]]) {
      let poly=quad;
      for(let i=0;i<3;i++) {
        const a=tri[i],b=tri[(i+1)%3], input=poly;poly=[];
        const cross=p=>(b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0]);
        for(let j=0;j<input.length;j++) {
          const p=input[j],q=input[(j+1)%input.length],dp=cross(p),dq=cross(q);
          if(dp>=0)poly.push(p);
          if((dp>=0)!==(dq>=0)){const f=dp/(dp-dq);poly.push([p[0]+(q[0]-p[0])*f,p[1]+(q[1]-p[1])*f]);}
        }
      }
      for(let i=1;i<poly.length-1;i++)for(const [px,pz] of [poly[0],poly[i],poly[i+1]])output.push(px,height(px,pz)+.05,pz);
    }
  }
}
function mesh(positions, material, parent = scene) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  const item = new THREE.Mesh(geometry, material);
  item.castShadow = parent===official || parent===previous;
  item.receiveShadow = true;
  parent.add(item);
  return item;
}
function terrain() {
  const t = context.terrain, vertices = [], indices = [];
  for (let z = 0; z < t.size; z++) for (let x = 0; x < t.size; x++) vertices.push(t.min + x*t.step, t.heights[z*t.size+x] - 0.2, t.min+z*t.step);
  for (let z = 0; z < t.size-1; z++) for (let x = 0; x < t.size-1; x++) {
    const i = z*t.size+x;
    indices.push(i,i+t.size,i+1,i+1,i+t.size,i+t.size+1);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices,3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const ground=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color:streetStudy ? '#a6ad8b' : '#abb0a0',roughness:1}));
  ground.receiveShadow=true;scene.add(ground);
  const roads = [];
  for (const road of context.roads) for (let i = 1; i < road.pts.length; i++) {
    const [a,b] = [road.pts[i-1],road.pts[i]], dx=b[0]-a[0], dz=b[1]-a[1], length=Math.hypot(dx,dz);
    if (!length) continue;
    const w=Math.max(1.2,road.width)/2, nx=-dz/length*w, nz=dx/length*w;
    const steps=Math.max(1,Math.ceil(length/12));
    for (let j=0;j<steps;j++) {
      const p=[a[0]+dx*j/steps,a[1]+dz*j/steps], q=[a[0]+dx*(j+1)/steps,a[1]+dz*(j+1)/steps];
      if (Math.abs((p[0]+q[0])/2)>1000 || Math.abs((p[1]+q[1])/2)>1000) continue;
      const corners=[[p[0]+nx,p[1]+nz],[p[0]-nx,p[1]-nz],[q[0]-nx,q[1]-nz],[q[0]+nx,q[1]+nz]];
      drapeRoad(corners,roads);
    }
  }
  mesh(roads,streetStudy ? roadMaterial() : new THREE.MeshStandardMaterial({color:'#747e7c',roughness:1,side:THREE.DoubleSide}));
}
function foundations() {
  if(streetStudy)return;
  const positions=[];
  for(const f of context.foundations||[])for(const v of foundationPositions(f.rings,height))positions.push(v);
  mesh(positions,mats.wall);
}
function buildPrevious() {
  if (previous.children.length) return;
  const walls=[], roofs=[];
  for (const b of context.baseline) {
    const rings=[b.ring,...b.holes].map(r=>r.length>1 && r[0][0]===r.at(-1)[0] && r[0][1]===r.at(-1)[1] ? r.slice(0,-1) : r), vertices=rings.flat();
    const y=height(b.ring[0][0],b.ring[0][1]);
    const roof=y+b.height, base=y+b.minHeight;
    for (const ring of rings) for (let i=0;i<ring.length;i++) {
      const a=ring[i], b=ring[(i+1)%ring.length];
      for (const p of [[a[0],base,a[1]],[b[0],base,b[1]],[a[0],roof,a[1]],[a[0],roof,a[1]],[b[0],base,b[1]],[b[0],roof,b[1]]]) walls.push(...p);
    }
    const shape=rings.map(r=>r.map(p=>new THREE.Vector2(...p)));
    for (const tri of THREE.ShapeUtils.triangulateShape(shape[0],shape.slice(1))) for (const i of tri) roofs.push(vertices[i][0],roof,vertices[i][1]);
  }
  mesh(walls,mats.wall,previous); mesh(roofs,mats.roof,previous);
}
function cameraUpdate() {
  if (mode==='orbit') {
    camera.position.set(target.x+Math.sin(azimuth)*Math.cos(elevation)*distance,target.y+Math.sin(elevation)*distance,target.z+Math.cos(azimuth)*Math.cos(elevation)*distance);
    camera.lookAt(target);
  } else {
    camera.position.copy(eye);
    camera.lookAt(eye.x+Math.sin(yaw)*Math.cos(pitch),eye.y+Math.sin(pitch),eye.z-Math.cos(yaw)*Math.cos(pitch));
  }
}
function location(street = false) {
  if (!ready) return;
  const p=context.places[Number($('place').value)];
  target.fromArray(p.position); target.y+=12;
  sun.target.position.copy(target);sun.position.copy(target).add(new THREE.Vector3(-500,900,350));
  if (street) {
    mode='street'; eye.fromArray(p.position); eye.y=height(eye.x,eye.z)+1.75;
    yaw=Math.atan2(p.direction[0],-p.direction[1]); pitch=0.08;
  } else { mode='orbit'; distance=streetStudy ? 105 : 490; elevation=streetStudy ? .5 : .75; azimuth=streetStudy ? -.9 : .5; }
  $('help').textContent=street ? 'Drag to look · WASD / arrows to move · Shift for faster movement' : 'Drag to orbit · Scroll to zoom · Right-drag to pan · Click a building';
  cameraUpdate();
}
function clearSelection() {
  $('selection').hidden=true;
  if (highlighted) { scene.remove(highlighted); highlighted.geometry.dispose(); highlighted.material.dispose(); highlighted=null; }
}
function layer(name) {
  if (!ready) return;
  if(streetStudy){
    const enabled=name==='official';
    streetDetails.setFacadeEnabled(enabled);
    $('official').setAttribute('aria-pressed',String(enabled));
    $('previous').setAttribute('aria-pressed',String(!enabled));
    $('layer-note').textContent=enabled ? 'Simple buildings. Real proportions. A little local character.' : 'The same mapped footprints and heights, without the painted details.';
    clearSelection();return;
  }
  activeLayer=name;
  if (name==='previous') buildPrevious();
  official.visible=name==='official'; previous.visible=!official.visible;
  $('official').setAttribute('aria-pressed',String(official.visible));
  $('previous').setAttribute('aria-pressed',String(previous.visible));
  $('layer-note').textContent=official.visible ? 'Survey-derived walls and generalized roofs. Colours are illustrative.' : 'Existing OSM footprints and heights, shown as plain extrusions.';
  clearSelection();
}
function inspect(x,y) {
  if (activeLayer!=='official') return;
  raycaster.setFromCamera(new THREE.Vector2(x/innerWidth*2-1,1-y/innerHeight*2),camera);
  const hit=raycaster.intersectObjects(official.children,true)[0];
  if (!hit) { clearSelection(); return; }
  const range=hit.object.userData.ranges?.find(r=>hit.faceIndex*3>=r.start && hit.faceIndex*3<r.start+r.count);
  const buildingIndex=hit.object.userData.building??range?.building;
  if (buildingIndex==null) return;
  clearSelection();
  const b=context.buildings[buildingIndex], box=new THREE.Box3(new THREE.Vector3(...b.bounds.slice(0,3)),new THREE.Vector3(...b.bounds.slice(3)));
  highlighted=new THREE.Box3Helper(box,0xe6a839);scene.add(highlighted);
  $('building-name').textContent=b.address || 'Building / building part';
  $('building-details').replaceChildren();
  const fields=[['Source ID',b.id],['Height',b.measuredHeight==null?'Not supplied':`${b.measuredHeight.toFixed(1)} m`],['Model record date',b.sourceDate],['Official tile',b.sourceTile]];
  const volume=hit.object.userData.volume;
  if(volume)fields.push(['Storeys',`${volume.floors} · ${volume.floorSource}`],['Appearance','Simplified colours and windows; not a photographic reconstruction.']);
  for (const [label,value] of fields) {const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=label;dd.textContent=value;$('building-details').append(dt,dd);}
  $('selection').hidden=false;
}

$('official').onclick=()=>layer('official'); $('previous').onclick=()=>layer('previous');
$('overview').onclick=()=>location(); $('street').onclick=()=>location(true);
$('place').onchange=()=>location(mode==='street'); $('close-selection').onclick=clearSelection;
let pointer;
canvas.addEventListener('pointerdown',e=>{pointer={x:e.clientX,y:e.clientY,startX:e.clientX,startY:e.clientY,pan:e.button===2};canvas.setPointerCapture(e.pointerId);});
canvas.addEventListener('pointermove',e=>{
  if (!pointer || !ready) return;
  const dx=e.clientX-pointer.x, dy=e.clientY-pointer.y;
  if (mode==='street') {yaw+=dx*.004;pitch=THREE.MathUtils.clamp(pitch-dy*.004,-1.3,1.3);}
  else if (pointer.pan || e.shiftKey) {
    const scale=distance*.0015;
    target.x+=(-dx*Math.cos(azimuth)+dy*Math.sin(azimuth))*scale;
    target.z+=(dx*Math.sin(azimuth)+dy*Math.cos(azimuth))*scale;
    target.x=THREE.MathUtils.clamp(target.x,-1000,1000);target.z=THREE.MathUtils.clamp(target.z,-1000,1000);
  } else {azimuth-=dx*.005;elevation=THREE.MathUtils.clamp(elevation+dy*.004,.08,1.48);}
  pointer.x=e.clientX;pointer.y=e.clientY;cameraUpdate();
});
canvas.addEventListener('pointerup',e=>{if(pointer && Math.hypot(e.clientX-pointer.startX,e.clientY-pointer.startY)<5 && !pointer.pan)inspect(e.clientX,e.clientY);pointer=null;});
canvas.addEventListener('pointercancel',()=>{pointer=null;});
canvas.addEventListener('contextmenu',e=>e.preventDefault());
canvas.addEventListener('wheel',e=>{e.preventDefault();if(mode==='orbit'){distance=THREE.MathUtils.clamp(distance*Math.exp(e.deltaY*.001),35,2400);cameraUpdate();}},{passive:false});
addEventListener('keydown',e=>{if(['INPUT','SELECT','TEXTAREA'].includes(document.activeElement.tagName))return;if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','w','a','s','d','Shift'].includes(e.key)){keys.add(e.key);e.preventDefault();}});
addEventListener('keyup',e=>keys.delete(e.key)); addEventListener('blur',()=>keys.clear());
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});

async function start() {
  if (!navigator.gpu) throw new Error('This view needs a browser with WebGPU. Try current Chrome or Edge.');
  await renderer.init();
  if (!renderer.backend.isWebGPUBackend) throw new Error('WebGPU could not start on this device.');
  const [data,binary,metadata]=await Promise.all([unzip(dataPath+'context.json.gz?v=simple-3',true),unzip(dataPath+'buildings.bin.gz'),fetch(dataPath+'manifest.json').then(r=>r.json())]);
  context=data;manifest=metadata;
  if (binary.byteLength!==manifest.geometryBytes) throw new Error('The building download is incomplete. Please reload.');
  if(streetStudy){
    streetDetails=buildSimpleStreet(context,height);
    official.add(streetDetails.buildings);scene.add(streetDetails.props);configureStreetUI();
  }else for (const chunk of context.chunks) {
    const item=mesh(new Float32Array(binary,chunk.offset,chunk.count*3),mats[chunk.material],official);
    item.userData.ranges=chunk.ranges;
  }
  terrain();foundations();
  $('place').replaceChildren(...context.places.map((p,i)=>new Option(p.name,String(i))));
  $('place').disabled=false;
  $('counts').textContent=streetStudy ? '80 m style trial · 33 surrounding buildings' : `${manifest.buildings.toLocaleString()} buildings · ${manifest.buildingParts.toLocaleString()} parts · 4 km². Record dates: ${manifest.sourceDates.join(', ')}; individual surveys may be older.`;
  ready=true;location(streetStudy);
  $('load-text').textContent='Opening the streets…';
  await renderer.compileAsync(scene,camera);
  $('loading').hidden=true;
  let last=performance.now();
  renderer.setAnimationLoop(()=>{
    const now=performance.now(),dt=Math.min(.05,(now-last)/1000);last=now;
    if(mode==='street' && keys.size){
      const forward=Number(keys.has('w')||keys.has('ArrowUp'))-Number(keys.has('s')||keys.has('ArrowDown'));
      const side=Number(keys.has('d')||keys.has('ArrowRight'))-Number(keys.has('a')||keys.has('ArrowLeft'));
      const speed=(keys.has('Shift')?32:7)*dt;
      eye.x=THREE.MathUtils.clamp(eye.x+(Math.sin(yaw)*forward+Math.cos(yaw)*side)*speed,-990,990);
      eye.z=THREE.MathUtils.clamp(eye.z+(-Math.cos(yaw)*forward+Math.sin(yaw)*side)*speed,-990,990);
      eye.y=height(eye.x,eye.z)+1.75;cameraUpdate();
    }
    renderer.render(scene,camera);
  });
}
function configureStreetUI(){
  document.querySelector('.detail-link').hidden=true;
  document.title='Auguststraße · Simple streets';
  document.body.classList.add('street-study');
  canvas.setAttribute('aria-label','Interactive simplified model of Auguststraße');
  document.querySelector('header .eyebrow').textContent='ONE STREET · 80 METRES';
  document.querySelector('h1').textContent='A little Auguststraße.';
  document.querySelector('.intro').textContent='The familiar blocky city, with better proportions. A short stretch past KW and the former Jewish girls’ school.';
  document.querySelector('label[for="place"]').textContent='Choose a viewpoint';
  $('official').textContent='Simple street';$('previous').textContent='Building shapes';
  $('layer-note').textContent='Simple buildings. Real proportions. A little local character.';
  const details=document.querySelector('details');details.replaceChildren();
  const summary=document.createElement('summary');summary.textContent='Sources & accuracy';details.append(summary);
  for(const text of ['Building footprints and heights come from Berlin’s official 3D data, simplified into flat-roofed blocks. Storey counts use mapped values where available and height-based estimates elsewhere.','KW’s pale facade and blue entrance, and the school’s brick colour and window groups, take cues from published photographs. The windows are painted procedural patterns.','Neighbouring colours, windows and parked cars are illustrative. No invented shops or photographic textures. Building bases extend into the ground.']){const p=document.createElement('p');p.textContent=text;details.append(p);}
  for(const ref of context.street.references){const p=document.createElement('p'),a=document.createElement('a');a.href=ref.url;a.textContent=ref.title+' ↗';a.target='_blank';a.rel='noreferrer';p.append(a);details.append(p);}
  const counts=document.createElement('p');counts.id='counts';details.append(counts);
  document.querySelector('.back').href='/play/berlin/mitte';document.querySelector('.back').textContent='← Mitte building comparison';
}
start().catch(error=>{$('load-text').textContent=error.message;console.error(error);});
