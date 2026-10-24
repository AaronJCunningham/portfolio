import * as THREE from 'three/webgpu';
import {simpleWallGeometry} from './ground.js?v=simple-3';

// The map controls footprints and height. Painted patterns keep the inexpensive,
// blocky language of the simulator; photographs only inform colour and rhythm.
const palette=['#d8cdb8','#c8b49b','#b1b4a1','#d0c5ae','#c5bda8'];
const facadeCache=new Map();
const plainCache=new Map();
const material=colour=>new THREE.MeshStandardMaterial({color:colour,roughness:.94,side:THREE.DoubleSide});
function hash(text){let n=0;for(const c of text)n=(Math.imul(n,31)+c.charCodeAt(0))>>>0;return n;}
function plain(colour){if(!plainCache.has(colour))plainCache.set(colour,material(colour));return plainCache.get(colour);}
function facadeMap(width,H,floors,colour,kind,front,seed){
  const bays=width<2.2?0:Math.max(1,Math.round(width/(kind==='kw'?2.7:2.8)));
  const key=[Math.round(width*2),Math.round(H*2),floors,colour,kind,front,seed%5].join('/');
  if(facadeCache.has(key))return facadeCache.get(key);
  const canvas=document.createElement('canvas');
  canvas.width=Math.max(128,Math.min(1024,Math.round(width*40)));
  canvas.height=Math.max(128,Math.min(1024,Math.round(H*40)));
  const ctx=canvas.getContext('2d'),sx=canvas.width/width,sy=canvas.height/H;
  const rect=(x,y,w,h,c)=>{ctx.fillStyle=c;ctx.fillRect(x*sx,canvas.height-(y+h)*sy,w*sx,h*sy);};
  rect(0,0,width,H,colour);
  // Large quiet planes, thin painted bands, no individually modelled frames.
  if(kind==='school'){
    for(let y=0;y<H;y+=.24)rect(0,y,width,.013,'#ffffff14');
  }
  rect(0,0,width,.72,kind==='school'?'#8a7765':'#aaa491');
  rect(0,H-.22,width,.22,kind==='school'?'#b5a58c':'#e2dac7');
  rect(0,H-.34,width,.06,'#645f514a');
  const floorH=(H-.8)/floors;
  const glass=['#263e4c','#334957','#233743','#394e57','#41525a'];
  function window(x,y,w,h,index){
    rect(x-.07,y-.07,w+.14,h+.14,kind==='school'?'#6e4c3d':'#c0b7a2');
    rect(x,y,w,h,glass[(index+seed)%glass.length]);
    rect(x+.05,y+h*.52,w-.1,h*.43,'#a8c7cf22');
    const frame=kind==='school'?'#9d8770':'#e2decc';
    rect(x+w/2-.025,y,.05,h,frame);
    rect(x,y+h*.62,w,.045,frame);
    rect(x-.1,y-.1,w+.2,.08,kind==='school'?'#b8aa93':'#e6decb');
    if(kind!=='school'&&(index+seed)%6===0)rect(x+.05,y+.05,w*.27,h-.1,'#c2bfa8');
  }
  const tower=kind==='school'&&H>19.5&&width>6&&width<12&&front;
  if(tower){
    for(let i=0;i<3;i++){
      const w=Math.min(1.55,width/6),x=(i+1)*width/4-w/2;
      window(x,1.8,w,6.5,i);window(x,11.2,w,5.7,i+3);
    }
  }else for(let row=0;row<floors;row++){
    if(kind!=='school'&&kind!=='kw'&&row>0)rect(0,.8+floorH*row-.1,width,.055,'#eee4cf66');
    for(let col=0;col<bays;col++){
      const bay=width/bays,w=Math.min(kind==='school'?1.7:1.4,bay*.55),h=Math.min(kind==='kw'?2.65:2.25,floorH*.6);
      const x=(col+.5)*bay-w/2,y=.8+row*floorH+(floorH-h)*.46;
      if(front&&kind==='context'&&row===0&&col===Math.floor(bays/2)&&width>7){
        rect(x-.12,.02,w+.24,Math.min(3.05,floorH-.1),'#454d46');
        rect(x+w*.49,.15,.035,2.6,'#969582');
        rect(x+w*.65,1.25,.035,.28,'#c7ba8e');
      }else window(x,y,w,h,row*bays+col);
    }
  }
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=8;
  const mat=new THREE.MeshStandardMaterial({map:texture,roughness:.95,side:THREE.DoubleSide});
  facadeCache.set(key,mat);return mat;
}

function isFrontEdge(a,b,volume,context){
  const dx=b[0]-a[0],dz=b[1]-a[1],L=Math.hypot(dx,dz);
  return context.street.fronts.some(f=>{
    if(f.building!==volume.id||L<1)return false;
    const fx=f.b[0]-f.a[0],fz=f.b[2]-f.a[2],mx=(a[0]+b[0])/2,mz=(a[1]+b[1])/2;
    const t=Math.max(0,Math.min(1,((mx-f.a[0])*fx+(mz-f.a[2])*fz)/(fx*fx+fz*fz)));
    return Math.abs((dx*fx+dz*fz)/(L*f.length))>.98&&Math.hypot(mx-f.a[0]-fx*t,mz-f.a[2]-fz*t)<.5;
  });
}

export function buildSimpleStreet(context,height){
  const buildings=new THREE.Group(),props=new THREE.Group(),facades=[];
  buildings.name='Auguststraße — simple mapped buildings';props.name='Auguststraße — simplified street';
  const roof=plain('#777b73');
  for(const volume of context.simpleVolumes){
    const seed=hash(volume.parent),profile=volume.appearance;
    const colour=profile?.colour||palette[seed%palette.length];
    const kind=profile?.kind||'context';
    const rings=[volume.ring,...volume.holes].map((ring,index)=>{
      const area=ring.reduce((sum,p,i)=>{const q=ring[(i+1)%ring.length];return sum+p[0]*q[1]-q[0]*p[1];},0);
      return (index===0 ? area>0 : area<0) ? [...ring].reverse() : ring;
    });
    for(const ring of rings)for(let i=0;i<ring.length;i++){
      const a=ring[i],b=ring[(i+1)%ring.length],width=Math.hypot(b[0]-a[0],b[1]-a[1]);
      if(width<.05)continue;
      const {positions,uv}=simpleWallGeometry(a,b,volume.base,volume.top,height);
      const geo=new THREE.BufferGeometry();
      geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
      geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geo.computeVertexNormals();
      const front=isFrontEdge(a,b,volume,context);
      const painted=facadeMap(width,volume.top-volume.base,volume.floors,colour,kind,front,seed);
      const item=new THREE.Mesh(geo,painted);item.castShadow=item.receiveShadow=true;
      item.userData.building=volume.building;item.userData.volume=volume;
      buildings.add(item);facades.push({item,painted,plain:plain(colour)});
    }
    const shape=rings.map(r=>r.map(p=>new THREE.Vector2(...p))),vertices=rings.flat(),positions=[];
    for(const tri of THREE.ShapeUtils.triangulateShape(shape[0],shape.slice(1))){
      const [a,b,c]=tri.map(i=>vertices[i]);
      if((b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])>0)tri.reverse();
      for(const j of tri)positions.push(vertices[j][0],volume.top,vertices[j][1]);
    }
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.computeVertexNormals();
    const item=new THREE.Mesh(geo,kind==='kw'&&volume.streetFront?plain('#99735a'):roof);item.castShadow=item.receiveShadow=true;item.userData.building=volume.building;item.userData.volume=volume;buildings.add(item);
  }
  addStreetProps(context,height,props);
  return {buildings,props,setFacadeEnabled(enabled){for(const f of facades)f.item.material=enabled?f.painted:f.plain;props.visible=enabled;}};
}

// A small number of boxy props gives scale without recreating every fitting.
function addStreetProps(context,height,group){
  const unitBox=new THREE.BoxGeometry(1,1,1),unitCylinder=new THREE.CylinderGeometry(1,1,1,8),batches=new Map(),temp=new THREE.Object3D();
  function instance(geometry,mat,p,s,rotation=0,q){
    const key=geometry.uuid+'/'+mat.uuid;
    if(!batches.has(key))batches.set(key,{geometry,mat,matrices:[]});
    temp.position.set(...p);temp.scale.set(...s);temp.rotation.set(0,rotation,0);if(q)temp.quaternion.copy(q);temp.updateMatrix();batches.get(key).matrices.push(temp.matrix.clone());
  }
  const box=(mat,p,s,rotation=0)=>instance(unitBox,mat,p,s,rotation);
  const start=context.street.start,end=context.street.end,dx=end[0]-start[0],dz=end[1]-start[1],L=Math.hypot(dx,dz),d=[dx/L,dz/L],n=[-d[1],d[0]],angle=Math.atan2(-d[1],d[0]);
  const point=(u,v,y=0)=>{const x=start[0]+d[0]*u+n[0]*v,z=start[1]+d[1]*u+n[1]*v;return [x,height(x,z)+y,z];};
  const paving=plain('#bdb9a8'),kerb=plain('#d1cdbb'),metal=plain('#42574d'),rubber=plain('#343835'),glass=plain('#314959');
  for(let u=-12;u<L+12;u+=1)for(const side of [-1,1]){
    box(paving,point(u,side*7.05,-.02),[1.015,.23,3.9],angle);
    box(kerb,point(u,side*5.05,.045),[1.015,.23,.22],angle);
  }
  for(const u of [12,61]){
    box(metal,point(u,-4.9,2.85),[.12,5.7,.12]);
    box(metal,point(u,-4.5,5.7),[.2,.16,1],angle);
    box(plain('#e9dfb9'),point(u,-4.1,5.59),[.4,.14,.6],angle);
  }
  const up=new THREE.Vector3(0,1,0),axle=new THREE.Vector3(n[0],0,n[1]),q=new THREE.Quaternion().setFromUnitVectors(up,axle);
  for(const [u,v,c] of [[8,3.8,'#788f94'],[32,3.8,'#d0c8b2'],[68,-3.8,'#8b5344']]){
    const body=plain(c),p=point(u,v,.54);
    box(body,p,[4.1,.68,1.72],angle);
    box(glass,[p[0],p[1]+.58,p[2]],[2.35,.56,1.48],angle);
    box(body,[p[0],p[1]+.9,p[2]],[2.45,.1,1.58],angle);
    for(const side of [-1,1]){
      box(body,[p[0]+n[0]*.76*side,p[1]+.57,p[2]+n[1]*.76*side],[.12,.6,.05],angle);
      for(const x of [-1.3,1.3])instance(unitCylinder,rubber,[p[0]+d[0]*x+n[0]*.84*side,p[1]-.2,p[2]+d[1]*x+n[1]*.84*side],[.32,.18,.32],0,q);
      box(plain('#e9dfba'),[p[0]+d[0]*2.06+n[0]*.52*side,p[1],p[2]+d[1]*2.06+n[1]*.52*side],[.035,.2,.34],angle);
    }
  }
  // Reference-informed KW entrance, kept as one flat panel across the portal.
  const canvas=document.createElement('canvas');canvas.width=256;canvas.height=512;const ctx=canvas.getContext('2d');
  ctx.fillStyle='#dcd6c4';ctx.fillRect(0,0,256,512);ctx.fillStyle='#24476b';ctx.fillRect(12,200,116,312);ctx.fillStyle='#2d383c';ctx.fillRect(128,200,116,312);
  ctx.fillStyle='#48544b';ctx.font='bold 72px Arial';ctx.textAlign='center';ctx.fillText('KW',128,138);
  const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;
  const sign=new THREE.Mesh(new THREE.PlaneGeometry(2.65,5.4),new THREE.MeshStandardMaterial({map,roughness:1,side:THREE.DoubleSide}));
  sign.position.set(116.6,5.5,162.31);sign.rotation.y=Math.atan2(n[0],n[1]);group.add(sign);
  for(const {geometry,mat,matrices} of batches.values()){
    const item=new THREE.InstancedMesh(geometry,mat,matrices.length);matrices.forEach((m,i)=>item.setMatrixAt(i,m));item.castShadow=item.receiveShadow=true;group.add(item);
  }
}

export const roadMaterial=()=>plain('#777c78');
