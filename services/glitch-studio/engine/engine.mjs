import {createFrameState} from './recipe.mjs';
import {baseShader,sortingShader,feedbackShader,finalShader,reactionShader} from './shaders.mjs';

export async function createFilm(canvas,width,height,recipe) {
 const frameState=createFrameState(recipe);
 const adapter=await navigator.gpu?.requestAdapter({powerPreference:'high-performance'});
 if(!adapter)throw new Error('WebGPU adapter unavailable.');
 const device=await adapter.requestDevice();
 const errors=[];device.addEventListener('uncapturederror',e=>errors.push(e.error.message));
 device.lost.then(info=>errors.push('GPU device lost: '+info.message));
 canvas.width=width;canvas.height=height;
 const context=canvas.getContext('webgpu');
 const format=navigator.gpu.getPreferredCanvasFormat();
 context.configure({device,format,alphaMode:'opaque',usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.COPY_SRC});
 const sampler=device.createSampler({magFilter:'linear',minFilter:'linear',addressModeU:'clamp-to-edge',addressModeV:'clamp-to-edge'});
 const uniform=device.createBuffer({size:112,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});
 const texture=(w,h,fmt='rgba8unorm')=>device.createTexture({size:[w,h],format:fmt,usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.STORAGE_BINDING|GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.COPY_DST|GPUTextureUsage.COPY_SRC});
 const module=async(code,label)=>{const m=device.createShaderModule({code,label});const info=await m.getCompilationInfo();const bad=info.messages.filter(m=>m.type==='error');if(bad.length)throw new Error(label+': '+bad.map(m=>`${m.lineNum}:${m.linePos} ${m.message}`).join('\n'));return m;};
 const renderPipeline=async(code,label,target='rgba8unorm')=>{
  const m=await module(code,label);return device.createRenderPipelineAsync({layout:'auto',vertex:{module:m,entryPoint:'vertex'},fragment:{module:m,entryPoint:'fragment',targets:[{format:target}]},primitive:{topology:'triangle-list'}});
 };
 const [base,feedback,final,sorting,reaction]=await Promise.all([
  renderPipeline(baseShader,'image warping'),renderPipeline(feedbackShader,'accumulated motion'),renderPipeline(finalShader,'print and typography',format),
  module(sortingShader,'bitonic pixel sort').then(m=>device.createComputePipelineAsync({layout:'auto',compute:{module:m,entryPoint:'main'}})),
  module(reactionShader,'Gray-Scott reaction diffusion').then(m=>device.createComputePipelineAsync({layout:'auto',compute:{module:m,entryPoint:'main'}}))
 ]);
 const bind=(p,resources)=>device.createBindGroup({layout:p.getBindGroupLayout(0),entries:resources.map((resource,binding)=>({binding,resource:resource===uniform?{buffer:uniform}:resource}))});
 const raw=texture(width,height),sorted=texture(width,height),history=[texture(width,height),texture(width,height)];
 const rw=256,rh=448,chem=[texture(rw,rh,'rgba16float'),texture(rw,rh,'rgba16float')];
 const seed=new Uint16Array(rw*rh*4);
 for(let y=0;y<rh;y++)for(let x=0;x<rw;x++){
  const i=(y*rw+x)*4;const s=Math.sin(x*127.1+y*311.7)*43758.5453;const n=s-Math.floor(s);
  const dot=n>.987 || ((x%31<4)&&(y%29<4));
  seed[i]=dot?0x3800:0x3c00;seed[i+1]=dot?0x3800:0;seed[i+3]=0x3c00;
 }
 const resetChem=()=>chem.forEach(t=>device.queue.writeTexture({texture:t},seed,{bytesPerRow:rw*8},{width:rw,height:rh}));
 resetChem();
 const rdBinds=[bind(reaction,[chem[0].createView(),chem[1].createView()]),bind(reaction,[chem[1].createView(),chem[0].createView()])];
 let chemIndex=0,historyIndex=0,lastFrame=-1;
 function evolve(encoder,count){for(let n=0;n<count;n++){const pass=encoder.beginComputePass();pass.setPipeline(reaction);pass.setBindGroup(0,rdBinds[chemIndex]);pass.dispatchWorkgroups(rw/8,rh/8);pass.end();chemIndex=1-chemIndex;}}
 let warm=device.createCommandEncoder();evolve(warm,180);device.queue.submit([warm.finish()]);
 const manifest={assets:recipe.assets};
 const assets=new Map();
 await Promise.all([...new Set(recipe.shots.map(s=>s[1]))].map(async name=>{
  const asset=manifest.assets.find(a=>a.name===name);if(!asset)throw new Error('Missing image '+name);
  const blob=await fetch('/'+asset.src).then(r=>r.blob());const bitmap=await createImageBitmap(blob);
  const tex=texture(bitmap.width,bitmap.height);device.queue.copyExternalImageToTexture({source:bitmap},{texture:tex},{width:bitmap.width,height:bitmap.height});assets.set(name,tex);bitmap.close();
 }));
 const font=new FontFace('LVXMono','url(/engine/mono.woff2)');await font.load();document.fonts.add(font);
 const textCanvas=new OffscreenCanvas(width,height);const ctx=textCanvas.getContext('2d');const textTexture=texture(width,height);
 const sortBinding=bind(sorting,[uniform,raw.createView(),sorted.createView()]);
 const draw=(encoder,pipeline,binding,target)=>{const pass=encoder.beginRenderPass({colorAttachments:[{view:target,clearValue:{r:0,g:0,b:0,a:1},loadOp:'clear',storeOp:'store'}]});pass.setPipeline(pipeline);pass.setBindGroup(0,binding);pass.draw(3);pass.end();};
 function lettering(f,s){
  ctx.clearRect(0,0,width,height);
  const cue=recipe.typography.cues.find(c=>f>=c.start&&f<c.end);
  if(cue){
   const local=f-cue.start,remaining=cue.end-1-f;
   ctx.save();ctx.scale(width/1080,width/1080);
   ctx.font=`${recipe.typography.maxFontSize}px LVXMono`;
   ctx.fillStyle='#ddd8cb';
   ctx.globalAlpha=.65*Math.min(1,(local+1)/4,(remaining+1)/4);
   ctx.fillText(cue.text,cue.x+local*cue.vx,cue.y*height/width*1080/1920);
   ctx.restore();
  }
  device.queue.copyExternalImageToTexture({source:textCanvas},{texture:textTexture},{width,height});
 }
 async function frame(f){
  if(f!==lastFrame+1)throw new Error(`Feedback rendering must be sequential: expected ${lastFrame+1}, got ${f}`);
  const s=frameState(f);lettering(f,s);
  const focus=width/height>.7?[s.layout.focus[0],recipe.instagramFocusY?.[s.shot[1]]??s.layout.focus[1]]:s.layout.focus;
  const zoom=width/height>.7?Math.min(s.shot[2],recipe.instagramMaxZoom?.[s.shot[1]]??Infinity):s.shot[2];
  const direction=(s.index>=17?s.index%2:[1,3,4,7,9,12,15].includes(s.index))?1:0;
  const values=new Float32Array([width,height,s.sourceFrame/30,s.sourceFrame,s.index,s.p,zoom,s.quietness,s.warp,s.feedback,s.sort,s.erosion,s.slice,s.palette,s.dither,s.flash,direction,s.grain,s.attack,s.scanPhase,s.layout.mirror,s.layout.mirrorAmount,focus[0],focus[1],s.gradeBlend,s.carry,0,0]);
  device.queue.writeBuffer(uniform,0,values);
  const encoder=device.createCommandEncoder();evolve(encoder,s.holding?(s.quietness<1?2:0):10);
  const photo=assets.get(s.shot[1]);const previous=assets.get(recipe.shots[Math.max(0,s.index-1)][1]);
  draw(encoder,base,bind(base,[uniform,sampler,photo.createView(),previous.createView(),chem[chemIndex].createView()]),raw.createView());
  const sortPass=encoder.beginComputePass();sortPass.setPipeline(sorting);sortPass.setBindGroup(0,sortBinding);sortPass.dispatchWorkgroups(Math.ceil((direction?height:width)/256),direction?width:height);sortPass.end();
  draw(encoder,feedback,bind(feedback,[uniform,sampler,sorted.createView(),history[historyIndex].createView(),chem[chemIndex].createView()]),history[1-historyIndex].createView());historyIndex=1-historyIndex;
  draw(encoder,final,bind(final,[uniform,sampler,history[historyIndex].createView(),textTexture.createView()]),context.getCurrentTexture().createView());
  device.queue.submit([encoder.finish()]);await device.queue.onSubmittedWorkDone();lastFrame=f;
  if(errors.length)throw new Error(errors.join('\n'));
 }
 async function reset(){resetChem();chemIndex=0;historyIndex=0;lastFrame=-1;const en=device.createCommandEncoder();evolve(en,180);device.queue.submit([en.finish()]);await device.queue.onSubmittedWorkDone();}
 return {frame,reset,device,errors,adapterInfo:{vendor:adapter.info.vendor,architecture:adapter.info.architecture,description:adapter.info.description},recipe};
}
