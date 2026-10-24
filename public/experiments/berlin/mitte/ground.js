export function sampleTerrain(terrain, x, z) {
  const t=terrain, clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
  const fx=clamp((x-t.min)/t.step,0,t.size-1.001),fz=clamp((z-t.min)/t.step,0,t.size-1.001);
  const ix=Math.floor(fx),iz=Math.floor(fz),a=fx-ix,b=fz-iz;
  const at=(dx,dz)=>t.heights[(iz+dz)*t.size+ix+dx];
  return a+b<=1 ? at(0,0)*(1-a-b)+at(1,0)*a+at(0,1)*b : at(1,1)*(a+b-1)+at(1,0)*(1-b)+at(0,1)*(1-a);
}

// These are added plinths; the official mesh is never translated or flattened.
export function foundationPositions(rings, height) {
  const vertices=[];
  for(const ring of rings)for(let i=0;i<ring.length;i++) {
    const a=ring[i],b=ring[(i+1)%ring.length];
    const steps=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[2]-a[2])/.75));
    for(let j=0;j<steps;j++) {
      const p=a.map((v,k)=>v+(b[k]-v)*j/steps),q=a.map((v,k)=>v+(b[k]-v)*(j+1)/steps);
      const lowP=[p[0],Math.min(p[1],height(p[0],p[2])-.35),p[2]],lowQ=[q[0],Math.min(q[1],height(q[0],q[2])-.35),q[2]];
      for(const v of [p,lowP,q,q,lowP,lowQ])vertices.push(...v);
    }
  }
  return vertices;
}

// Simple volumes keep their source tops, with a draped lower edge extending
// beneath the terrain. UVs stay tied to source height so storeys remain level.
export function simpleWallGeometry(a,b,base,top,height) {
  const positions=[],uv=[],length=Math.hypot(b[0]-a[0],b[1]-a[1]);
  const steps=Math.max(1,Math.ceil(length/.75));
  const at=t=>{const x=a[0]+(b[0]-a[0])*t,z=a[1]+(b[1]-a[1])*t;return {x,z,y:Math.min(base,height(x,z)-.4),u:t};};
  for(let j=0;j<steps;j++){
    const p=at(j/steps),q=at((j+1)/steps);
    for(const [v,y] of [[p,p.y],[q,q.y],[p,top],[p,top],[q,q.y],[q,top]]){
      positions.push(v.x,y,v.z);uv.push(v.u,(y-base)/(top-base));
    }
  }
  return {positions,uv};
}
