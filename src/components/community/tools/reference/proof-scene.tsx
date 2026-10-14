"use client";
import { Canvas, useFrame, useLoader, useThree, type ThreeEvent } from "@react-three/fiber";
import { Suspense, useEffect, useMemo, type MutableRefObject as RefObject } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import type { PerformanceState } from "./proof-of-belief";
import { treePartId } from "../TreeInfoPanel";
import StudyFilm from "./study-film";
type Props = {performance: RefObject<PerformanceState>; paused: boolean; reducedMotion: boolean; hoveredId: string | null; selectedId: string | null; onReady: () => void; onInspect: (id: string | null) => void; onSelect: (id: string | null) => void};
function weatheredMaterial() {
 const mat = new THREE.MeshStandardMaterial({color: "#c4b59c", roughness: .82, metalness: .12, side: THREE.DoubleSide});
 mat.onBeforeCompile = shader => {
  shader.vertexShader = "varying vec3 vStone;\n" + shader.vertexShader;
  shader.vertexShader = shader.vertexShader.replace("#include <begin_vertex>", "#include <begin_vertex>\nvStone = position;");
  shader.fragmentShader = `varying vec3 vStone;
float hash3(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
float stoneNoise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(mix(hash3(i),hash3(i+vec3(1,0,0)),f.x),mix(hash3(i+vec3(0,1,0)),hash3(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash3(i+vec3(0,0,1)),hash3(i+vec3(1,0,1)),f.x),mix(hash3(i+vec3(0,1,1)),hash3(i+vec3(1,1,1)),f.x),f.y),f.z);}
` + shader.fragmentShader;
  shader.fragmentShader = shader.fragmentShader.replace("#include <color_fragment>", `#include <color_fragment>
float stain = stoneNoise(vStone*5.0)*.65+stoneNoise(vStone*17.0)*.35;
float dust = hash3(floor(vStone*260.0));
diffuseColor.rgb *= mix(vec3(.19,.16,.12),vec3(1.0),smoothstep(.27,.64,stain));
diffuseColor.rgb *= .77 + .3*dust;`);
  shader.fragmentShader = shader.fragmentShader.replace("#include <dithering_fragment>", `#include <dithering_fragment>
float grain=hash3(vec3(floor(gl_FragCoord.xy),1.0));
gl_FragColor.rgb=floor(gl_FragColor.rgb*38.0+grain)/38.0;`);
 };
 mat.customProgramCacheKey = () => "proof-weathered-1";
 return mat;
}
function Sculpture({performance,paused,onReady,onInspect,onSelect}: Props) {
 const gltf = useLoader(GLTFLoader, "/tools/tree-of-life/tree-of-life-reference.glb?v=paths-11-32");
 const {camera,size,gl} = useThree();
 const sculpture = useMemo(() => {
  const group = new THREE.Group();
  group.name = "tree-of-life-display";
  const material = weatheredMaterial();
  const ribs: {mesh: THREE.Mesh; rest: THREE.Vector3}[] = [];
  gltf.scene.updateMatrixWorld(true);
  gltf.scene.traverse(obj => {
   if (!(obj instanceof THREE.Mesh)) return;
   const geo = obj.geometry.clone().applyMatrix4(obj.matrixWorld);
   geo.computeBoundingBox();
   const rest = geo.boundingBox!.getCenter(new THREE.Vector3());
   geo.translate(-rest.x,-rest.y,-rest.z);
   const mesh = new THREE.Mesh(geo,material); mesh.position.copy(rest);
   mesh.name=obj.name;mesh.userData={...obj.userData,detailId:treePartId(obj.userData)};
   group.add(mesh);
   ribs.push({mesh,rest});
  });
  const bounds = new THREE.Box3().setFromObject(group);
  return {group,ribs,material,bounds};
 },[gltf]);
 const dust = useMemo(()=>{
  const positions:number[]=[], seeds:number[]=[];
  let seed=17; const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
  sculpture.ribs.forEach(r=>{const a=r.mesh.geometry.attributes.position;for(let i=0;i<240;i++){const j=Math.floor(random()*a.count);positions.push(a.getX(j)+r.rest.x,a.getY(j)+r.rest.y,a.getZ(j)+r.rest.z);seeds.push(random());}});
  const geometry=new THREE.BufferGeometry();geometry.setAttribute("position",new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute("aSeed",new THREE.Float32BufferAttribute(seeds,1));
  const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{uTime:{value:0},uSpread:{value:0},uDrift:{value:0},uOpacity:{value:0},uPixel:{value:1}},vertexShader:`attribute float aSeed; uniform float uTime,uSpread,uDrift,uPixel; varying float vSeed;
void main(){vSeed=aSeed;vec3 p=position;float a=aSeed*62.83+uTime*(.12+uDrift*.24); p.y+=uDrift*sin(uTime*.65+aSeed*31.4)*.65; p+=uSpread*vec3(cos(a)*(1.+aSeed*3.),sin(a*.73)*2.5,sin(a)*(1.+aSeed*2.));vec4 mv=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;gl_PointSize=(1.2+aSeed*1.8)*uPixel;}`,fragmentShader:`uniform float uOpacity; varying float vSeed;void main(){if(length(gl_PointCoord-.5)>.5)discard;gl_FragColor=vec4(vec3(.7,.62,.48),uOpacity*(.25+vSeed*.65));}`});
  const points=new THREE.Points(geometry,material);
  // The surrounding dust must never intercept a sephirah or path hover.
  points.raycast=()=>{};
  sculpture.group.add(points);return {geometry,material};
 },[sculpture]);
 useEffect(()=>{gl.domElement.dataset.ribs=String(sculpture.ribs.length);onReady();},[gl,sculpture,onReady]);
 useEffect(()=>()=>{sculpture.ribs.forEach(r=>r.mesh.geometry.dispose());sculpture.material.dispose();dust.geometry.dispose();dust.material.dispose();},[sculpture,dust]);
 // Keep every sephirah and path at its exported position. Only the particle field moves.
 useEffect(()=>{
  const aspect=size.width/size.height;
  const tangent=Math.tan(THREE.MathUtils.degToRad(20));
  const wide=size.width>900;
  if(!wide){
   // The canvas fills the screen; frame the tree above the peeking drawer.
   const top=82;
   const bottom=Math.max(112,Math.min(size.height*.22,142))+36;
   const available=Math.max(100,size.height-top-bottom);
   const bounds=sculpture.bounds.getSize(new THREE.Vector3());
   const center=sculpture.bounds.getCenter(new THREE.Vector3());
   const distance=Math.max(bounds.y/(2*tangent*available/size.height),bounds.x/(2*tangent*aspect*.84))+bounds.z/2;
   camera.position.set(0,0,distance);camera.lookAt(0,0,0);
   const offset=(.5-(top+available/2)/size.height)*2*distance*tangent;
   sculpture.group.position.set(-center.x,offset-center.y,-center.z);
   return;
  }
  const distance=Math.max(12.4,6.9/(2*tangent*aspect));
  camera.position.set(0,.15,distance);camera.lookAt(0,0,0);
  // Centre the desktop tree at 70% of the viewport, aligned with the HTML veils.
  sculpture.group.position.set(wide?distance*Math.tan(THREE.MathUtils.degToRad(20))*aspect*.4:0,wide?.1:0,0);
 },[camera,size,sculpture]);
 useFrame((_,delta)=>{
  if(!paused)performance.current.time+=Math.min(delta,.05);
  dust.material.uniforms.uTime.value=performance.current.time;
  dust.material.uniforms.uSpread.value=.7;
  dust.material.uniforms.uDrift.value=1;
  dust.material.uniforms.uOpacity.value=.43;
  dust.material.uniforms.uPixel.value=gl.getPixelRatio();
 });
 function inspect(event: ThreeEvent<PointerEvent | MouseEvent>) {
  event.stopPropagation();
  onInspect(event.object.userData.detailId ?? null);
 }
 return <primitive object={sculpture.group} dispose={null} onPointerOver={inspect} onPointerMove={inspect} onClick={(event: ThreeEvent<MouseEvent>)=>{event.stopPropagation();onSelect(event.object.userData.detailId??null);}} onPointerOut={(event: ThreeEvent<PointerEvent>)=>{onInspect(null);}}/>;
}
export default function ProofScene(props: Props) {
 return <Canvas onPointerMissed={()=>{props.onInspect(null);props.onSelect(null);}} camera={{position:[0,0,13],fov:40,near:.1,far:80}} dpr={[1,1.5]} gl={{antialias:false,alpha:false,powerPreference:"high-performance"}} onCreated={({gl})=>{gl.setClearColor("#000000");gl.toneMapping=THREE.ACESFilmicToneMapping;gl.toneMappingExposure=1.35;}}>
  <ambientLight intensity={.22} color="#b7ad98"/><directionalLight position={[-4,5,6]} intensity={3.6} color="#ffe6c5"/><directionalLight position={[4,2,-3]} intensity={5} color="#c8b899"/><directionalLight position={[2,-2,5]} intensity={.35} color="#b2b9c5"/>
  <Suspense fallback={null}><Sculpture {...props}/></Suspense><StudyFilm performance={props.performance} paused={props.paused} reducedMotion={props.reducedMotion} hoveredId={props.hoveredId} selectedId={props.selectedId}/>
 </Canvas>;
}
