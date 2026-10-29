// Local export UI. Render the actual WebGL scene at a fixed simulation step;
// the MP4 contains only the 1080×1920 canvas, never the page or export controls.
import {Output, Mp4OutputFormat, BufferTarget, CanvasSource} from '/__mediabunny.mjs';

const width=1080, height=1920, fps=60, duration=20;
const style=document.createElement('style');
style.textContent=`
  header,footer,.caption,.controls{display:none!important}
  #scene{display:flex;justify-content:center;align-items:center}
  #scene canvas{width:auto!important;height:94svh!important;max-width:95vw;object-fit:contain}
  #portrait-export{position:fixed;top:24px;left:24px;max-width:280px;padding:20px;background:#fff;
    color:#173c43;font:14px/1.6 Arial;border-radius:8px;z-index:100;box-shadow:0 8px 40px #173c4310}
  #portrait-export button{margin-top:8px;border:1px solid #b9ccca;border-radius:5px;padding:12px}
`;
document.head.append(style);
const panel=document.createElement('aside');panel.id='portrait-export';
const status=document.createElement('div');status.setAttribute('role','status');status.textContent='Preparing portrait composition…';
const button=document.createElement('button');button.textContent='Render portrait MP4';button.disabled=true;
panel.append(status,button);document.body.append(panel);

try {
  const deadline=performance.now()+15000;
  while(!window.oceanCube){
    if(performance.now()>deadline)throw new Error('The ocean could not start.');
    await new Promise(resolve=>setTimeout(resolve,50));
  }
  const {renderer,scene,camera,ocean,spin,materials}=window.oceanCube;
  window.oceanCube.suspendResponsiveLayout?.();
  renderer.setAnimationLoop(null);
  renderer.setPixelRatio(1);
  renderer.setSize(width,height,false);
  camera.clearViewOffset();
  camera.aspect=width/height;
  camera.position.set(0,1,21.8);
  camera.lookAt(0,-0.1,0);
  camera.updateProjectionMatrix();
  ocean.time=40;
  // Allow the foam history to settle before the first exported frame.
  for(let i=0;i<90;i++)ocean.update(1/60);
  function renderFrame(time,dt){
    ocean.update(dt*0.65);
    spin.rotation.y=0.35+time*0.095;
    spin.position.y=Math.sin(time*0.38)*0.065;
    for(const material of materials){
      const uniforms=material.uniforms;
      for(let i=0;i<3;i++)uniforms['uD'+i].value=ocean.displacement[i];
      for(let i=0;i<4;i++)uniforms['uS'+i].value=ocean.slope[i];
      uniforms.uTime.value=ocean.time;
      uniforms.uSwell.value=1;
    }
    renderer.setRenderTarget(null);
    renderer.render(scene,camera);
  }
  renderFrame(0,0);
  document.getElementById('loading').hidden=true;
  status.textContent='1080 × 1920 · 20 seconds · 60 fps · cube only';
  button.disabled=false;
  button.addEventListener('click',async()=>{
    button.disabled=true;
    const target=new BufferTarget();
    const output=new Output({format:new Mp4OutputFormat({fastStart:'in-memory'}),target});
    const source=new CanvasSource(renderer.domElement,{codec:'avc',bitrate:12_000_000,keyFrameInterval:2});
    output.addVideoTrack(source,{frameRate:fps});
    try{
      await output.start();
      for(let frame=0;frame<duration*fps;frame++){
        renderFrame(frame/fps,frame===0?0:1/fps);
        if(frame===0){
          // toBlob snapshots synchronously, before the WebGL buffer is cleared.
          renderer.domElement.toBlob(async blob=>{
            if(blob)await fetch('/__portrait.jpg',{method:'POST',body:blob});
          },'image/jpeg',0.95);
        }
        await source.add(frame/fps,1/fps);
        if(frame%30===0){
          status.textContent=`Rendering ${Math.round(frame/(duration*fps)*100)}% — ${frame} / ${duration*fps} frames`;
          await new Promise(resolve=>setTimeout(resolve,0));
        }
      }
      source.close();
      await output.finalize();
      const blob=new Blob([target.buffer],{type:'video/mp4'});
      const response=await fetch('/__portrait.mp4',{method:'POST',body:blob});
      if(!response.ok)throw new Error('The local export could not be saved.');
      status.textContent=`Saved portrait MP4 · 1080 × 1920 · 60 fps · ${(blob.size/1e6).toFixed(1)} MB`;
      button.textContent='Render complete';
      renderFrame(0,0);
    }catch(error){
      status.textContent='Export failed: '+error.message;
      console.error(error);
      await output.cancel();
      button.textContent='Reload to retry';
    }
  },{once:true});
}catch(error){status.textContent=error.message;console.error(error);}
