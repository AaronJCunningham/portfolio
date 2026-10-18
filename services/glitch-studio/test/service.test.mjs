import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import sharp from 'sharp';
import {createService} from '../service.mjs';
import {browserOptions,renderVideo} from '../renderer.mjs';

const origin='http://studio.test';
const photo=await sharp({create:{width:64,height:80,channels:3,background:'#ad2940'}}).jpeg().toBuffer();
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function fixture(t,options={}) {
  const parent=await fs.mkdtemp(path.join(os.tmpdir(),'glitch-test-'));
  const dataDir=path.join(parent,'.data');
  const service=await createService({dataDir,origins:[origin],probe:async()=>({available:true}),render:async({output,onProgress})=>{
    onProgress(50);await fs.writeFile(output,'test-video');return {bytes:10,frames:1114};
  },...options});
  const url=await service.start(0);
  await service.check();
  t.after(async()=>{await service.stop();await fs.rm(parent,{recursive:true,force:true});});
  return {...service,url,dataDir};
}
function upload(format='vertical',image=photo,type='image/jpeg') {
  const form=new FormData();
  form.append('images',new Blob([image],{type}),'photo.jpg');
  form.append('format',format);form.append('title','AFTER HOURS');return form;
}
const submit=(url,form=upload())=>fetch(`${url}/jobs`,{method:'POST',headers:{Origin:origin},body:form});
async function terminal(url,id) {
  for(let attempt=0;attempt<100;attempt++) {
    const job=await fetch(`${url}/jobs/${id}`).then(r=>r.json());
    if(['complete','failed'].includes(job.status))return job;
    await sleep(20);
  }
  throw new Error('Job did not finish');
}

test('missing Chrome is detected on the server',async()=>{
  const previous=process.env.GLITCH_BROWSER_PATH;
  process.env.GLITCH_BROWSER_PATH='/missing/glitch-studio/chrome';
  try {await assert.rejects(renderVideo({origin:'http://127.0.0.1',job:{id:'x',width:720,height:1280},output:'/unused'}),/executable|launch|exist/i);}
  finally {if(previous===undefined)delete process.env.GLITCH_BROWSER_PATH;else process.env.GLITCH_BROWSER_PATH=previous;}
  assert.deepEqual(browserOptions({},'darwin').args,['--use-angle=metal']);
  assert.equal(browserOptions({GLITCH_BROWSER_PATH:'/custom/chromium'},'linux').executablePath,'/custom/chromium');
});
test('failed compatibility check disables uploads without blaming the visitor browser',async t=>{
  const service=await fixture(t,{probe:async()=>({available:false,detail:'No GPU'})});
  const health=await fetch(`${service.url}/health`).then(r=>r.json());
  assert.equal(health.available,false);assert.equal(health.detail,undefined);
  const response=await submit(service.url);
  assert.equal(response.status,503);
  assert.match((await response.json()).error,/temporarily unavailable/);
  assert.equal(service.jobs.size,0);
});
test('upload, progress, download, range requests, deletion and expiry',async t=>{
  let clock=Date.now();
  const service=await fixture(t,{now:()=>clock});
  const response=await submit(service.url,upload('portrait'));
  assert.equal(response.status,202);
  assert.equal(response.headers.get('access-control-allow-origin'),origin);
  const {id}=await response.json();assert.match(id,/^[a-f0-9]{48}$/);
  const done=await terminal(service.url,id);
  assert.equal(done.status,'complete');assert.equal(done.progress,100);assert.equal(done.height,900);
  await assert.rejects(fs.access(path.join(service.dataDir,id,'images')));
  const video=await fetch(`${service.url}/jobs/${id}/video?download=1`);
  assert.equal(video.status,200);assert.match(video.headers.get('content-disposition'),/attachment/);
  assert.equal(await video.text(),'test-video');
  const range=await fetch(`${service.url}/jobs/${id}/video`,{headers:{Range:'bytes=0-3'}});
  assert.equal(range.status,206);assert.equal(await range.text(),'test');
  const second=await submit(service.url).then(r=>r.json());await terminal(service.url,second.id);
  assert.equal((await fetch(`${service.url}/jobs/${second.id}`,{method:'DELETE',headers:{Origin:origin}})).status,204);
  await assert.rejects(fs.access(path.join(service.dataDir,second.id)));
  clock+=3600001;await service.cleanup();
  assert.equal((await fetch(`${service.url}/jobs/${id}`)).status,404);
  await assert.rejects(fs.access(path.join(service.dataDir,id)));
});
test('rejects unsupported origins, malformed images and invalid options',async t=>{
  const service=await fixture(t);
  const denied=await fetch(`${service.url}/jobs`,{method:'POST',headers:{Origin:'https://unrelated.test'},body:upload()});
  assert.equal(denied.status,403);
  const forged=await submit(service.url,upload('vertical',Buffer.from('<svg/>'),'image/jpeg'));
  assert.equal(forged.status,400);assert.match((await forged.json()).error,/could not be read/);
  assert.equal((await submit(service.url,upload('landscape'))).status,400);
  const oversized=await submit(service.url,upload('vertical',Buffer.alloc(8*1024*1024+1)));
  assert.equal(oversized.status,400);assert.match((await oversized.json()).error,/8 MB/);
  assert.equal(service.jobs.size,0);
});
test('one render at a time and three attempts per hour',async t=>{
  let active=0,peak=0;
  const service=await fixture(t,{render:async({output})=>{
    active++;peak=Math.max(peak,active);await sleep(100);await fs.writeFile(output,'test-video');active--;return {bytes:10};
  }});
  const ids=[];
  for(let i=0;i<3;i++){const response=await submit(service.url);assert.equal(response.status,202);ids.push((await response.json()).id);}
  const rateLimited=await submit(service.url);
  assert.equal(rateLimited.status,429);assert.ok(Number(rateLimited.headers.get('retry-after'))>0);
  for(const id of ids)assert.equal((await terminal(service.url,id)).status,'complete');
  assert.equal(peak,1);
});
test('render failure removes images and partial output',async t=>{
  const service=await fixture(t,{render:async({output})=>{await fs.writeFile(output,'partial');throw new Error('GPU device lost');}});
  const {id}=await submit(service.url).then(r=>r.json());
  assert.equal((await terminal(service.url,id)).status,'failed');
  assert.equal((await fetch(`${service.url}/jobs/${id}/video`)).status,409);
  await assert.rejects(fs.access(path.join(service.dataDir,id,'images')));
  await assert.rejects(fs.access(path.join(service.dataDir,id,'video.mp4')));
});
