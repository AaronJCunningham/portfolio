import * as THREE from 'three';
import { OrbitControls } from './vendor/three/OrbitControls.js';
import { OceanSim, defaultOceanParams } from './vendor/ultra-water/water/OceanSim.js';

// The FFT simulation is upstream Ultra-Water. This finite, six-face surface and
// its shading are custom: each face has its own tangent space and local gravity.
const vertexShader = /* glsl */`
uniform sampler2D uD0, uD1, uD2;
uniform sampler2D uS0, uS1, uS2, uS3;
uniform vec2 uOffset;
uniform float uSwell;
varying vec3 vWorld, vNormal, vFaceNormal;
varying vec2 vSea;
varying float vFoam, vHeight, vEdge;
void main() {
  vec2 sea = uv * 48.0 + uOffset;
  vec4 d0 = texture2D(uD0, sea / 600.0);
  vec4 d1 = texture2D(uD1, sea / 85.0);
  vec4 d2 = texture2D(uD2, sea / 12.0);
  vec2 slopes = texture2D(uS0, sea / 600.0).xy
    + texture2D(uS1, sea / 85.0).xy
    + texture2D(uS2, sea / 12.0).xy;
  float edge = min(min(uv.x, 1.0-uv.x), min(uv.y, 1.0-uv.y));
  float seam = smoothstep(0.0, 0.055, edge);
  vec3 displacement = d0.xyz * 0.35 + d1.xyz + d2.xyz;
  vec3 p = position;
  p.xy += displacement.xz * 0.075 * uSwell * seam;
  p.z += displacement.y * 0.075 * uSwell * seam;
  vWorld = (modelMatrix * vec4(p, 1.0)).xyz;
  vNormal = normalize(mat3(modelMatrix) * vec3(-slopes * uSwell * seam, 1.0));
  vFaceNormal = normalize(mat3(modelMatrix) * vec3(0.0, 0.0, 1.0));
  vSea = sea;
  vFoam = min(d1.w, d2.w);
  vHeight = displacement.y;
  vEdge = edge;
  gl_Position = projectionMatrix * viewMatrix * vec4(vWorld, 1.0);
}`;

const fragmentShader = /* glsl */`
uniform sampler2D uS1, uS2, uS3;
uniform float uTime, uSwell;
varying vec3 vWorld, vNormal, vFaceNormal;
varying vec2 vSea;
varying float vFoam, vHeight, vEdge;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
  return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);
}
vec3 sky(vec3 r) {
  float h = smoothstep(-0.35, 0.85, r.y);
  vec3 c = mix(vec3(0.32,0.48,0.49), vec3(0.78,0.88,0.91), h);
  float cloud = pow(noise(r.xz * 4.0 / (abs(r.y) + 0.4)), 2.0);
  c += cloud * 0.22 * smoothstep(0.0, 0.55, r.y);
  // Broad studio sky reflection, broken into wavelets by the FFT normals.
  float softbox = pow(max(dot(r,normalize(vec3(-0.6,1.0,0.9))),0.0),18.0);
  return c + vec3(1.0,0.97,0.84) * softbox * 1.2;
}
void main() {
  vec3 n = normalize(vNormal);
  vec2 detail = texture2D(uS2,vSea/12.0).xy * 0.25 + texture2D(uS3,vSea/2.1).xy * 0.32;
  vec3 tangent = normalize(dFdx(vWorld));
  vec3 bitangent = normalize(cross(n,tangent));
  n = normalize(n + (tangent * detail.x + bitangent * detail.y) * smoothstep(0.0,0.025,vEdge));
  vec3 v = normalize(cameraPosition-vWorld);
  vec3 light = normalize(vec3(-3.0,6.0,4.0));
  float fresnel = 0.025 + 0.975 * pow(1.0-max(dot(n,v),0.0),5.0);
  float illumination = 0.46 + 0.54 * max(dot(n,light),0.0);
  float thickness = smoothstep(-0.65,1.1,vHeight);
  vec3 body = mix(vec3(0.008,0.105,0.16),vec3(0.025,0.40,0.43),thickness);
  body *= illumination;
  float scatter = pow(max(dot(v,-light),0.0),3.0) * max(vHeight+0.2,0.0);
  body += vec3(0.02,0.22,0.18)*scatter;
  vec3 color = mix(body,sky(reflect(-v,n)),0.23+fresnel*0.72);
  vec3 halfDir=normalize(light+v);
  float spec = pow(max(dot(n,halfDir),0.0),180.0);
  color += vec3(1.0,0.94,0.79) * spec * 1.8;
  vec2 flow = vSea * 3.0 + vec2(uTime*0.12,-uTime*0.17);
  float lace = noise(flow) * 0.55 + noise(flow*3.7) * 0.3 + noise(flow*11.0)*0.15;
  float foam = 1.0-smoothstep(0.14,0.62 + 0.1*(uSwell-1.0),vFoam);
  foam *= smoothstep(0.28,0.64,lace) * smoothstep(0.0,0.025,vEdge);
  // A very fine rim makes the impossible boundary legible without a wireframe.
  float rim = (1.0-smoothstep(0.0,0.004,vEdge))*0.14;
  color = mix(color,vec3(0.80,0.91,0.88)*illumination,clamp(foam*0.88+rim,0.0,0.95));
  gl_FragColor=vec4(color,1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

const mount = document.getElementById('scene');
const loading = document.getElementById('loading');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  if (!renderer.extensions.has('EXT_color_buffer_float')) throw new Error('Floating-point WebGL2 render targets are unavailable.');
} catch (error) {
  loading.classList.add('error');
  loading.textContent = 'This ocean needs WebGL2. Please try a browser with hardware acceleration enabled.';
  console.error(error);
}

if (renderer) start();

function start() {
  renderer.setPixelRatio(Math.min(devicePixelRatio, matchMedia('(pointer: coarse)').matches ? 1.5 : 2));
  renderer.setClearColor(0xe9eeed, 1);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  mount.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xe9eeed);
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 80);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.enablePan = false;
  controls.minDistance = 7.5;
  controls.maxDistance = 22;
  controls.minPolarAngle = 0.3;
  controls.maxPolarAngle = Math.PI-0.3;
  controls.rotateSpeed = 0.6;

  const params = defaultOceanParams();
  params.windSpeed = 11;
  params.waveScale = 1.15;
  params.choppiness = 1.1;
  params.foamRecovery = 0.38;
  const ocean = new OceanSim(renderer, params);
  // Prime the spectrum so the first frame already has developed water.
  ocean.time = 40;
  ocean.update(1/60);

  const spin = new THREE.Group();
  const cube = new THREE.Group();
  // The (1,1,1) body diagonal is exactly vertical, not just a screen-space tilt.
  cube.quaternion.setFromUnitVectors(new THREE.Vector3(1,1,1).normalize(),new THREE.Vector3(0,1,0));
  spin.add(cube);
  scene.add(spin);
  spin.rotation.y = 0.35;
  const faceGeometry = new THREE.PlaneGeometry(3.6,3.6,160,160);
  const materials = [];
  const directions = [[0,0,1],[0,0,-1],[1,0,0],[-1,0,0],[0,1,0],[0,-1,0]];
  directions.forEach((direction,i) => {
    const normal = new THREE.Vector3(...direction);
    const uniforms = {
      uD0:{value:ocean.displacement[0]},uD1:{value:ocean.displacement[1]},uD2:{value:ocean.displacement[2]},
      uS0:{value:ocean.slope[0]},uS1:{value:ocean.slope[1]},uS2:{value:ocean.slope[2]},uS3:{value:ocean.slope[3]},
      uOffset:{value:new THREE.Vector2(i*37.3,i*23.7)},uTime:{value:0},uSwell:{value:1},
    };
    const material = new THREE.ShaderMaterial({vertexShader,fragmentShader,uniforms});
    materials.push(material);
    const face = new THREE.Mesh(faceGeometry,material);
    face.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),normal);
    face.position.copy(normal).multiplyScalar(1.8);
    cube.add(face);
  });

  // Soft gallery shadow underneath the suspended lower corner.
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(8,8),new THREE.ShaderMaterial({
    transparent:true,depthWrite:false,
    vertexShader:'varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader:'varying vec2 vUv; void main(){float d=length((vUv-.5)*2.0);float a=exp(-d*d*9.0)*.17;gl_FragColor=vec4(.12,.25,.26,a);}',
  }));
  shadow.rotation.x=-Math.PI/2;
  shadow.position.y=-3.65;
  scene.add(shadow);

  let rotating=!reducedMotion, swell=1, last=performance.now(), elapsed=0, dragging=false;
  const rotationButton=document.getElementById('rotate');
  const slider=document.getElementById('swell');
  const updateButton=()=>{
    rotationButton.setAttribute('aria-pressed',String(rotating));
    document.getElementById('rotate-icon').textContent=rotating?'Ⅱ':'▷';
    document.getElementById('rotate-label').textContent=rotating?'Pause rotation':'Resume rotation';
  };
  updateButton();
  rotationButton.addEventListener('click',()=>{rotating=!rotating;updateButton();});
  slider.addEventListener('input',()=>{
    swell=Number(slider.value);
    document.getElementById('swell-value').value=swell.toFixed(1);
  });
  const setCamera=()=>{
    const mobile=innerWidth<760;
    camera.position.set(0,1.0,mobile?16.8:14.5);
    controls.target.set(0,0,0);
    controls.update();
  };
  document.getElementById('reset').addEventListener('click',()=>{
    spin.rotation.y=0.35;swell=1;slider.value='1';document.getElementById('swell-value').value='1.0';
    rotating=!reducedMotion;updateButton();setCamera();
  });
  controls.addEventListener('start',()=>{dragging=true;});
  controls.addEventListener('end',()=>{dragging=false;});
  const resize=()=>{
    const width=mount.clientWidth,height=mount.clientHeight;
    renderer.setSize(width,height);
    camera.aspect=width/height;
    camera.clearViewOffset();
    // Keep the sculpture on the right on desktop, centered on smaller screens.
    if(width>=760) camera.setViewOffset(width,height,-width*0.12,0,width,height);
    else camera.setViewOffset(width,height,0,-height*0.045,width,height);
    camera.updateProjectionMatrix();
  };
  setCamera();resize();
  window.addEventListener('resize',resize);
  renderer.domElement.addEventListener('webglcontextlost',event=>{
    event.preventDefault();renderer.setAnimationLoop(null);loading.hidden=false;loading.classList.add('error');
    loading.textContent='The graphics context was interrupted. Reload to return to the ocean.';
  });
  let shaderFailed=false;
  renderer.debug.onShaderError=(gl,program,vertex,fragment)=>{
    shaderFailed=true;
    console.error('Ocean shader',gl.getProgramInfoLog(program),gl.getShaderInfoLog(vertex),gl.getShaderInfoLog(fragment));
    loading.hidden=false;loading.classList.add('error');loading.textContent='The ocean shader could not start on this device.';
  };
  renderer.setAnimationLoop(now=>{
    const dt=Math.min((now-last)/1000,0.05);last=now;
    if(document.hidden) return;
    elapsed+=dt;
    if(rotating&&!dragging)spin.rotation.y+=dt*0.095;
    if(!reducedMotion) ocean.update(dt*0.65);
    for(const material of materials){
      const u=material.uniforms;
      for(let i=0;i<3;i++)u['uD'+i].value=ocean.displacement[i];
      for(let i=0;i<4;i++)u['uS'+i].value=ocean.slope[i];
      u.uTime.value=ocean.time;u.uSwell.value=swell;
    }
    if(!reducedMotion)spin.position.y=Math.sin(elapsed*0.38)*0.065;
    controls.update();
    renderer.setRenderTarget(null);
    renderer.render(scene,camera);
    if(!shaderFailed)loading.hidden=true;
  });
  // Read-only diagnostics for the local preview and performance checks.
  window.oceanCube={renderer,scene,camera,ocean,spin,materials};
}
