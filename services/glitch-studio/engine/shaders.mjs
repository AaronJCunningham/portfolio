const common = /* wgsl */`
struct Params { size:vec4f, edit:vec4f, fx:vec4f, look:vec4f, misc:vec4f, framing:vec4f, bridge:vec4f, };
@group(0) @binding(0) var<uniform> u:Params;
fn hash(p:vec2f)->f32 { return fract(sin(dot(p,vec2f(127.1,311.7)))*43758.5453); }
fn noise(p:vec2f)->f32 {
 let i=floor(p); let f=fract(p); let s=f*f*(3.-2.*f);
 return mix(mix(hash(i),hash(i+vec2f(1,0)),s.x),mix(hash(i+vec2f(0,1)),hash(i+vec2f(1,1)),s.x),s.y);
}
fn field(p:vec2f)->f32 { return noise(p)*.57+noise(p*2.13)*.28+noise(p*4.37)*.15; }
fn lum(c:vec3f)->f32 { return dot(c,vec3f(.2126,.7152,.0722)); }
fn mirror(p:vec2f)->vec2f { return 1.-abs(1.-(p-floor(p/2.)*2.)); }
@vertex fn vertex(@builtin(vertex_index) i:u32)->@builtin(position) vec4f {
 let p=array<vec2f,3>(vec2f(-1,-1),vec2f(3,-1),vec2f(-1,3));return vec4f(p[i],0,1);
}
`;
export const baseShader=common+/* wgsl */`
@group(0) @binding(1) var sm:sampler;
@group(0) @binding(2) var photo:texture_2d<f32>;
@group(0) @binding(3) var other:texture_2d<f32>;
@group(0) @binding(4) var rd:texture_2d<f32>;
fn samplePhoto(t:texture_2d<f32>,uv:vec2f,z:f32)->vec3f {
 let dim=vec2f(textureDimensions(t)); let aspect=u.size.x/u.size.y;
 var q=uv-.5; q.x*=min(1.,aspect/(dim.x/dim.y));q.y*=min(1.,(dim.x/dim.y)/aspect);
 return textureSampleLevel(t,sm,mirror(q/z+u.framing.zw),0).rgb;
}
@fragment fn fragment(@builtin(position) pos:vec4f)->@location(0) vec4f {
 let uv=pos.xy/u.size.xy; let time=u.size.z; let frame=u.size.w;
 let warp=u.fx.x; let slices=u.look.x;
 var q=uv;
 // Mirrored repeats occupy effect passages; clear image holds stay stable.
 var folded=q;
 if(u.framing.x>.5 && u.framing.x<1.5){folded.x=abs(q.x-.5)*2.;}
 if(u.framing.x>1.5 && u.framing.x<2.5){folded=mirror(q*2.);}
 if(u.framing.x>2.5){
  let center=q-.5;let radius=length(center);let sector=1.04719755;
  let angle=abs((atan2(center.y,center.x)+6.2831853)%sector-sector*.5);
  folded=.5+vec2f(cos(angle),sin(angle))*radius;
 }
 q=mix(q,folded,u.framing.y);
 let n=field(uv*vec2f(5,9)+vec2f(time*2.,-time*3.));
 let ang=n*18.+time*5.;
 q+=vec2f(cos(ang),sin(ang))*.075*warp;
 q.x+=sin(q.y*19.+time*15.)*.085*warp;
 let band=floor(uv.y*(12.+floor(u.edit.x)%4.*13.));
 let tear=(hash(vec2f(band,floor(frame/3.)))-.5)*slices;
 q.x+=tear*.42;
 q.y+=sin(q.x*35.+time*23.)*warp*.018;
 if(slices>.45 && hash(vec2f(band,u.edit.x))>.65){ q.x=fract(q.x*2.); }
 let zoom=u.edit.z+u.edit.y*.11+sin(time*28.)*warp*.04;
 let rgb=.002+warp*.012;
 var col=samplePhoto(photo,q,zoom);
 col.r=samplePhoto(photo,q+vec2f(rgb,0),zoom).r;
 col.b=samplePhoto(photo,q-vec2f(rgb,0),zoom).b;
 let chem=textureSampleLevel(rd,sm,uv,0).g;
 let dissolve=chem*2.5+field(uv*9.+time*.45)*.7;
 let mask=smoothstep(1.2-u.fx.w,1.24-u.fx.w,dissolve)*u.fx.w;
 let prev=samplePhoto(other,q+vec2f(.05*warp,-.03*warp),zoom+.05);
 col=mix(col,prev,mask);
 let edge=1.-smoothstep(.0,.027,abs(dissolve-(1.2-u.fx.w)));
 col+=vec3f(.7,.055,.025)*edge*u.fx.w;
 return vec4f(max(col,vec3f(0)),1);
}
`;
export const sortingShader=common+/* wgsl */`
@group(0) @binding(1) var src:texture_2d<f32>;
@group(0) @binding(2) var dst:texture_storage_2d<rgba8unorm,write>;
var<workgroup> values:array<vec4f,256>;
fn coords(i:u32, group:vec3u)->vec2u {
 let along=group.x*256u+i;return select(vec2u(along,group.y),vec2u(group.y,along),u.misc.x>.5);
}
@compute @workgroup_size(128) fn main(@builtin(local_invocation_id) tid:vec3u,@builtin(workgroup_id) gid:vec3u) {
 let dims=textureDimensions(src);
 for(var n=0u;n<2u;n++){
  let i=tid.x+n*128u;let p=coords(i,gid);
  let col=textureLoad(src,vec2i(min(p,dims-1u)),0).rgb;
  values[i]=vec4f(col,lum(col));
 }
 workgroupBarrier();
 for(var k=2u;k<=256u;k*=2u){
  for(var j=k/2u;j>0u;j/=2u){
   for(var n=0u;n<2u;n++){
    let i=tid.x+n*128u;let p=i^j;
    if(p>i){let a=values[i];let b=values[p];let asc=(i&k)==0u;
     if((a.w>b.w)==asc){values[i]=b;values[p]=a;}
    }
   }
   workgroupBarrier();
  }
 }
 for(var n=0u;n<2u;n++){
  let i=tid.x+n*128u;let p=coords(i,gid);
  if(all(p<dims)){
   let original=textureLoad(src,vec2i(p),0);
   let stripe=step(.35,noise(vec2f(f32(gid.y)*.035,u.size.z*3.)));
   let amt=u.fx.z*(.3+.7*stripe)*smoothstep(.03,.18,lum(original.rgb));
   textureStore(dst,p,vec4f(mix(original.rgb,values[i].rgb,amt),1));
  }
 }
}
`;
export const feedbackShader=common+/* wgsl */`
@group(0) @binding(1) var sm:sampler;
@group(0) @binding(2) var fresh:texture_2d<f32>;
@group(0) @binding(3) var history:texture_2d<f32>;
@group(0) @binding(4) var rd:texture_2d<f32>;
@fragment fn fragment(@builtin(position) pos:vec4f)->@location(0) vec4f {
 let uv=pos.xy/u.size.xy;let t=u.size.z;
 let tile=floor(uv*vec2f(47,80))/vec2f(47,80);
 let n=field(tile*7.+vec2f(t,-t*.6));
 let chem=textureSampleLevel(rd,sm,uv,0).g;
 let angle=n*16.+t*2.3;
 var flow=vec2f(cos(angle),sin(angle))*(.008+u.fx.x*.035);
 flow+=vec2f(sin(tile.y*23.+t*8.)*.02,-.012)*u.fx.x;
 let radial=uv-.5;flow+=radial*.035*sin(t*8.);
 let old=textureSampleLevel(history,sm,mirror(uv-flow),0).rgb;
 let now=textureSampleLevel(fresh,sm,uv,0).rgb;
 let weight=max(u.bridge.y,u.fx.y*(.65+.35*step(.25,chem+n*.5)));
 var col=mix(now,old,weight);
 // Incoming high-frequency edges cut through the held pixels.
 let neighbor=textureSampleLevel(fresh,sm,uv+vec2f(2.,0)/u.size.xy,0).rgb;
 col+=max(now-neighbor,vec3f(0))*weight*.9;
 if(u.size.w<.5){col=now;}
 return vec4f(clamp(col,vec3f(0),vec3f(1)),1);
}
`;
export const finalShader=common+/* wgsl */`
@group(0) @binding(1) var sm:sampler;
@group(0) @binding(2) var scene:texture_2d<f32>;
@group(0) @binding(3) var lettering:texture_2d<f32>;
@fragment fn fragment(@builtin(position) pos:vec4f)->@location(0) vec4f {
 let uv=pos.xy/u.size.xy;let t=u.size.z;let f=u.size.w;
 // Egregore is one passage of the score: sectional colour, timing errors,
 // thin intersecting filaments, and displaced scanning bands.
 let signal=max(max(1.-abs(f-38.)/8.,1.-abs(f-88.)/9.),1.-abs(f-130.)/10.);
 let transmission=max(0.,signal)*(1.-u.edit.w);
 var q=uv;
 let scanBand=floor(uv.y*13.);
 let badRow=step(.64,hash(vec2f(scanBand,floor(f/3.))));
 q.x+=badRow*sin(scanBand*2.4+t*12.)*.055*transmission;
 let stripe=floor(uv.y*170.);
 q.x+=(hash(vec2f(stripe,floor(f/2.)))-.5)*.05*u.look.x*step(.92,hash(vec2f(stripe,floor(f/4.))));
 var col=textureSampleLevel(scene,sm,mirror(q),0).rgb;
 col=pow(max(col,vec3f(0)),vec3f(.85));
 let y=lum(col);let red=vec3f(.95,.035,.015);let bone=vec3f(.94,.9,.8);
 let negativeBand=step(.78,hash(vec2f(scanBand,7.)))*transmission;
 col=mix(col,vec3f(1.)-col,negativeBand*.72);
 let coolBand=step(.83,hash(vec2f(scanBand,12.)))*transmission;
 col=mix(col,vec3f(y*.35,y*.75,y*1.2),coolBand*.8);
 var graded=col;
 if(u.look.y>.5 && u.look.y<1.5){graded=mix(vec3f(.015),bone,pow(y,.8));}
 if(u.look.y>1.5 && u.look.y<2.5){graded=mix(vec3f(.025,0,.005),red,smoothstep(.04,.68,y));}
 if(u.look.y>2.5){graded=mix(bone,vec3f(.02,.035,.035),smoothstep(.09,.75,y));}
 col=mix(col,graded,u.bridge.x);
 let pixel=floor(pos.xy/(2.+u.look.z*3.));
 let grain=hash(pixel+vec2f(f*13.,f*3.))-.5;
 let bw=step(.4+grain*.5,y);
 col=mix(col,mix(vec3f(.01),mix(bone,red,step(.5,sin(t*8.))),bw),u.look.z*.85);
 col+=grain*u.misc.y;
 let scanPhase=mix(f*.6,u.misc.w,u.edit.w);
 let scan=.90+.10*sin(pos.y*1.8+scanPhase);col*=scan;
 let rolling=1.-smoothstep(.0,.025,abs(uv.y-fract(t*.77)));
 col+=bone*rolling*transmission*.22;
 var filaments=0.;
 for(var i=0.;i<7.;i+=1.){
  let center=.46+sin(uv.y*(5.+i*.7)+t*2.5+i*1.8)*(.12+i*.012)
    +sin(uv.y*19.-t*3.+i)*.035;
  let distance=abs(uv.x-center);
  let lengthMask=smoothstep(.08,.25,uv.y)*(1.-smoothstep(.72,.95,uv.y));
  filaments+= (1.-smoothstep(.0004,.0014,distance))*lengthMask;
 }
 col=mix(col,bone,clamp(filaments*transmission*.85,0.,1.));
 // Sparse type travels on straight paths, independent of image distortion.
 let tx=textureSampleLevel(lettering,sm,uv,0);
 col=mix(col,tx.rgb,tx.a);
 col=mix(col,mix(vec3f(1)-col,red,.23),u.look.w);
 let vignette=1.-.18*pow(length((uv-.5)*vec2f(1,1)),1.5);
 return vec4f(clamp(col*vignette,vec3f(0),vec3f(1)),1);
}
`;
export const reactionShader=/* wgsl */`
@group(0) @binding(0) var src:texture_2d<f32>;
@group(0) @binding(1) var dst:texture_storage_2d<rgba16float,write>;
fn cell(p:vec2i)->vec2f {let d=vec2i(textureDimensions(src));return textureLoad(src,(p+d)%d,0).rg;}
@compute @workgroup_size(8,8) fn main(@builtin(global_invocation_id) id:vec3u){
 let dim=textureDimensions(src);if(any(id.xy>=dim)){return;}
 let p=vec2i(id.xy);let c=cell(p);
 let lap=(cell(p+vec2i(1,0))+cell(p+vec2i(-1,0))+cell(p+vec2i(0,1))+cell(p+vec2i(0,-1)))*.2
 +(cell(p+vec2i(1,1))+cell(p+vec2i(-1,1))+cell(p+vec2i(1,-1))+cell(p+vec2i(-1,-1)))*.05-c;
 let feed=.031+.012*f32(p.x)/f32(dim.x);let kill=.059;
 let reaction=c.x*c.y*c.y;
 let out=c+vec2f(lap.x-reaction+feed*(1.-c.x),.5*lap.y+reaction-(kill+feed)*c.y);
 textureStore(dst,p,vec4f(clamp(out,vec2f(0),vec2f(1)),0,1));
}
`;
