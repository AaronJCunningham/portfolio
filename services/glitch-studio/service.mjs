import express from 'express';
import sharp from 'sharp';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomBytes} from 'node:crypto';
import {createServer} from 'node:http';
import {makeSequence} from './sequence.mjs';
import {createRecipe} from './engine/recipe.mjs';
import {readUpload,RequestError,LIMITS} from './upload.mjs';
import {renderVideo,checkRenderer} from './renderer.mjs';

const root=path.dirname(fileURLToPath(import.meta.url));
const HOUR=60*60*1000, MAX_PENDING=5;
const activeStates=new Set(['uploading','queued','rendering']);
const unavailable='Video creation is temporarily unavailable. Please try again later.';
const listen=(server,port,host)=>new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,host,()=>{server.removeListener('error',reject);resolve();});});

export async function createService({
  dataDir=path.resolve(process.env.GLITCH_DATA_DIR||path.join(root,'.data')),
  origins=(process.env.GLITCH_ALLOWED_ORIGINS||'http://localhost:3000,http://localhost:3001').split(',').map(s=>s.trim()).filter(Boolean),
  render=renderVideo, probe=checkRenderer, now=()=>Date.now(),
}={}) {
  await fs.mkdir(dataDir,{recursive:true,mode:0o700});
  sharp.cache(false);
  sharp.concurrency(2);
  const jobs=new Map(),queue=[],rates=new Map();
  let running=false,closing=false,health={available:false},checkPromise,drainPromise;
  const persist=job=>fs.writeFile(path.join(dataDir,job.id,'job.json'),JSON.stringify(job));
  // A restart cannot resume stateful GPU work. Keep completed downloads until expiry.
  for (const entry of await fs.readdir(dataDir,{withFileTypes:true})) {
    if (!entry.isDirectory() || !/^[a-f0-9]{48}$/.test(entry.name)) continue;
    const dir=path.join(dataDir,entry.name);
    try {
      const job=JSON.parse(await fs.readFile(path.join(dir,'job.json'),'utf8'));
      if (job.expiresAt<=now()) { await fs.rm(dir,{recursive:true,force:true}); continue; }
      if (activeStates.has(job.status)) {
        job.status='failed';job.error='Rendering was interrupted. Please create the video again.';
        await fs.rm(path.join(dir,'images'),{recursive:true,force:true});
        await fs.rm(path.join(dir,'video.mp4'),{force:true});
        await persist(job);
      }
      jobs.set(job.id,job);
    } catch { await fs.rm(dir,{recursive:true,force:true}); }
  }

  // Source files and image bytes are served only on this private loopback listener.
  const internal=express();
  internal.disable('x-powered-by');
  internal.use('/engine',express.static(path.join(root,'engine')));
  const configs=new Map();
  internal.get('/jobs/:id/config',(req,res)=>{
    const config=configs.get(req.params.id);
    if(!config)return res.sendStatus(404);
    res.json(config);
  });
  internal.get('/jobs/:id/render',(req,res)=>configs.has(req.params.id)?res.sendFile(path.join(root,'engine','render.html')):res.sendStatus(404));
  internal.get('/jobs/:id/images/:index',(req,res)=>{
    const config=configs.get(req.params.id);
    if (!config || !/^\d+\.jpg$/.test(req.params.index)) return res.sendStatus(404);
    const index=Number(req.params.index.split('.')[0]);
    if(index>=config.recipe.assets.length)return res.sendStatus(404);
    res.sendFile(path.join(config.imageDir,req.params.index),{dotfiles:'allow'});
  });
  const internalServer=createServer(internal);
  await listen(internalServer,0,'127.0.0.1');
  const origin=`http://127.0.0.1:${internalServer.address().port}`;
  function configuration(job,imageDir) {
    const assets=Array.from({length:job.imageCount},(_,i)=>({name:`photo-${i}`,src:`jobs/${job.id}/images/${i}.jpg`}));
    return {width:job.width,height:job.height,imageDir,recipe:createRecipe(job.sequence,assets,job.title)};
  }
  async function check() {
    if (running || closing) return health;
    if (checkPromise) return checkPromise;
    checkPromise=(async()=>{
      const directory=await fs.mkdtemp(path.join(dataDir,'probe-'));
      const job={id:randomBytes(24).toString('hex'),width:720,height:1280,imageCount:1,sequence:Array(32).fill(0),title:''};
      try {
        await sharp({create:{width:64,height:64,channels:3,background:'#ba3046'}}).jpeg().toFile(path.join(directory,'0.jpg'));
        configs.set(job.id,configuration(job,directory));
        health=await probe({origin,job,directory});
        if(!health.available)console.error('Glitch Studio renderer unavailable:',health.detail);
      } catch(error) { health={available:false,detail:error.message}; }
      finally { configs.delete(job.id); await fs.rm(directory,{recursive:true,force:true}); }
      if(health.available && queue.length)startDrain();
      return health;
    })().finally(()=>{checkPromise=undefined;});
    return checkPromise;
  }
  function startDrain() {
    if(running || closing)return;
    drainPromise=drain().catch(error=>{health={available:false};console.error('Glitch Studio queue error:',error.message);});
  }
  async function drain() {
    running=true;
    try {
      while(queue.length && !closing && health.available) {
        const job=jobs.get(queue.shift());
        if(!job || job.status!=='queued')continue;
        const directory=path.join(dataDir,job.id), imageDir=path.join(directory,'images');
        job.status='rendering';job.progress=0;
        try {
          await persist(job);
          configs.set(job.id,configuration(job,imageDir));
          const result=await render({origin,job,output:path.join(directory,'video.mp4'),onProgress:value=>{job.progress=value;}});
          job.status='complete';job.progress=100;job.bytes=result.bytes;job.expiresAt=now()+HOUR;
          job.render={...result,sequence:job.sequence};
        } catch(error) {
          console.error('Glitch Studio render failed:',error.message);
          health={available:false};
          job.status='failed';job.error='This video could not be created. Please try again.';job.expiresAt=now()+HOUR;
          await fs.rm(path.join(directory,'video.mp4'),{force:true});
        } finally {
          configs.delete(job.id);
          await fs.rm(imageDir,{recursive:true,force:true});
          await persist(job);
        }
      }
    } finally { running=false; }
  }
  async function cleanup() {
    for(const [id,job] of jobs) {
      if(job.expiresAt<=now() && job.status==='queued') {
        const index=queue.indexOf(id);if(index>=0)queue.splice(index,1);
        job.status='failed';job.error='The studio could not start your video in time. Please try again.';
        job.expiresAt=now()+HOUR;
        await fs.rm(path.join(dataDir,id,'images'),{recursive:true,force:true});await persist(job);
      }
      if(job.expiresAt<=now() && !activeStates.has(job.status)) {
        jobs.delete(id);await fs.rm(path.join(dataDir,id),{recursive:true,force:true});
      }
    }
    for(const [ip,rate] of rates)if(rate.reset<=now())rates.delete(ip);
  }
  const app=express();
  app.disable('x-powered-by');
  app.set('trust proxy',Number(process.env.GLITCH_TRUST_PROXY||0));
  app.use((req,res,next)=>{
    res.set({'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'});
    const requestOrigin=req.headers.origin;
    if(requestOrigin && !origins.includes(requestOrigin))return res.status(403).json({error:'This origin is not allowed.'});
    if(requestOrigin)res.set({'Access-Control-Allow-Origin':requestOrigin,'Vary':'Origin','Access-Control-Allow-Methods':'GET,POST,DELETE,OPTIONS','Access-Control-Allow-Headers':'Content-Type','Access-Control-Expose-Headers':'Retry-After'});
    if(req.method==='OPTIONS')return res.sendStatus(204);
    next();
  });
  app.get('/health',(_req,res)=>res.json({available:health.available && !closing,limits:LIMITS,queued:queue.length,message:health.available?undefined:unavailable}));
  app.post('/jobs',async(req,res)=>{
    let job,directory;
    try {
      if(!health.available||closing)throw new RequestError(unavailable,503);
      // Browser POSTs must originate from the configured website. Rate and queue limits also apply to API callers.
      if(!req.headers.origin || !origins.includes(req.headers.origin))throw new RequestError('Open Glitch Studio on the website to create a video.',403);
      if([...jobs.values()].filter(j=>activeStates.has(j.status)).length>=MAX_PENDING)throw new RequestError('The studio is busy. Please try again in a few minutes.',429);
      const ip=req.ip||'unknown',rate=rates.get(ip);
      if(rate && rate.reset>now() && rate.count>=3) {
        res.set('Retry-After',String(Math.ceil((rate.reset-now())/1000)));
        throw new RequestError('You can create three videos per hour. Please come back shortly.',429);
      }
      if(!rate || rate.reset<=now()) {
        if(rates.size>=10000)await cleanup();
        if(rates.size>=10000)throw new RequestError('The studio is busy. Please try again later.',429);
        rates.set(ip,{count:1,reset:now()+HOUR});
      } else rate.count++;
      const id=randomBytes(24).toString('hex');
      job={id,status:'uploading',progress:0,createdAt:now(),expiresAt:now()+HOUR};
      jobs.set(id,job);
      directory=path.join(dataDir,id);
      const imageDir=path.join(directory,'images');
      await fs.mkdir(imageDir,{recursive:true,mode:0o700});
      const upload=await readUpload(req,imageDir);
      Object.assign(job,{imageCount:upload.images.length,title:upload.title,format:upload.format,width:720,height:upload.format==='portrait'?900:1280,
        sequence:makeSequence(upload.images.length,32,randomBytes(4).readUInt32LE()),status:'queued'});
      await persist(job);queue.push(id);
      res.status(202).json({id,status:'queued'});
      startDrain();
    } catch(error) {
      if(job)jobs.delete(job.id);
      if(directory)await fs.rm(directory,{recursive:true,force:true});
      if(!res.destroyed && !res.headersSent)res.status(error.status||500).json({error:error instanceof RequestError?error.message:'The upload could not be processed. Please try again.'});
    }
  });
  app.use('/jobs/:id',(req,res,next)=>{
    const job=jobs.get(req.params.id);
    if(!job)return res.status(404).json({error:'This video is no longer available. Please create another.'});
    if(job.expiresAt<=now() && !activeStates.has(job.status))return res.status(410).json({error:'This video has expired. Please create another.'});
    res.locals.job=job;next();
  });
  app.get('/jobs/:id',(_req,res)=>{
    const job=res.locals.job;
    res.json({id:job.id,status:job.status,progress:job.progress,position:job.status==='queued'?queue.indexOf(job.id)+1:undefined,
      error:job.error,expiresAt:job.expiresAt,width:job.width,height:job.height,bytes:job.bytes});
  });
  app.get('/jobs/:id/video', (req,res)=>{
    const job=res.locals.job;
    if(job.status!=='complete')return res.status(409).json({error:'Your video is not ready yet.'});
    res.set('Content-Type','video/mp4');
    if(req.query.download==='1')res.set('Content-Disposition','attachment; filename="glitch-studio.mp4"');
    res.sendFile(path.join(dataDir,job.id,'video.mp4'),{dotfiles:'allow'});
  });
  app.delete('/jobs/:id',async(_req,res)=>{
    const job=res.locals.job;
    if(job.status==='rendering'||job.status==='uploading')return res.status(409).json({error:'Please wait for processing to finish.'});
    const index=queue.indexOf(job.id);if(index>=0)queue.splice(index,1);
    jobs.delete(job.id);await fs.rm(path.join(dataDir,job.id),{recursive:true,force:true});
    res.sendStatus(204);
  });
  const server=createServer(app);
  server.requestTimeout=120000;
  const interval=setInterval(()=>{void cleanup().catch(console.error);if(!health.available)void check();},60000);
  interval.unref();
  return {app,check,cleanup,jobs,
    async start(port=Number(process.env.GLITCH_PORT||4319),host=process.env.GLITCH_HOST||'127.0.0.1') {
      await listen(server,port,host);return `http://${host}:${server.address().port}`;
    },
    async stop() {
      closing=true;clearInterval(interval);
      if(server.listening) {server.closeIdleConnections();await new Promise(resolve=>server.close(resolve));}
      await checkPromise;await drainPromise;
      internalServer.closeIdleConnections();await new Promise(resolve=>internalServer.close(resolve));
    },
  };
}
