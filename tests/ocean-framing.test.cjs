const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const ts=require('typescript');
const THREE=require('three');
const source=fs.readFileSync(path.join(__dirname,'../public/experiments/ocean-cube/framing.js'),'utf8');
const moduleExports={};
new Function('exports',ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(moduleExports);
const {getFittedDistance}=moduleExports;

test('the cube and wave allowance stay inside phone scenes through rotation and orbit, even at the closest mobile zoom',()=>{
  const tilt=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1,1,1).normalize(),new THREE.Vector3(0,1,0));
  for(const [width,height] of [[284,280],[354,410],[394,505],[450,210],[784,610]]){
    const camera=new THREE.PerspectiveCamera(34,width/height,.1,80);
    const distance=getFittedDistance(width,height)*.9;
    for(const polar of [.3,1,Math.PI/2,2.5,Math.PI-.3]){
      for(let azimuth=0;azimuth<Math.PI*2;azimuth+=Math.PI/4){
        camera.position.setFromSphericalCoords(distance,polar,azimuth);camera.lookAt(0,0,0);camera.updateMatrixWorld();
        for(let angle=0;angle<Math.PI*2;angle+=Math.PI/6){
          const spin=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),angle);
          for(const x of [-2.05,2.05])for(const y of [-2.05,2.05])for(const z of [-2.05,2.05]){
            const vertex=new THREE.Vector3(x,y,z).applyQuaternion(tilt).applyQuaternion(spin);
            vertex.y+=.065;vertex.project(camera);
            assert.ok(Math.abs(vertex.x)<1&&Math.abs(vertex.y)<1,`clipped at ${width}×${height}`);
          }
        }
      }
    }
  }
});

test('narrower scenes move the camera back and degenerate resize values remain finite',()=>{
  assert.ok(getFittedDistance(280,600)>getFittedDistance(400,600));
  assert.ok(getFittedDistance(400,600)>getFittedDistance(400,300));
  assert.ok(Number.isFinite(getFittedDistance(0,0)));
});
