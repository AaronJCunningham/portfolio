import {chromium} from 'playwright-core';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import fs from 'node:fs/promises';
import path from 'node:path';

export function browserOptions(env = process.env, platform = process.platform) {
  const args = platform === 'darwin' ? ['--use-angle=metal'] : platform === 'linux'
    ? ['--enable-unsafe-webgpu','--enable-features=Vulkan','--use-angle=vulkan','--disable-vulkan-surface'] : [];
  // Optional deployment-specific switches are configured by the operator, never users.
  if (env.GLITCH_BROWSER_ARGS) args.push(...JSON.parse(env.GLITCH_BROWSER_ARGS));
  return {headless:true,timeout:30000,chromiumSandbox:true,args,
    ...(env.GLITCH_BROWSER_PATH ? {executablePath:env.GLITCH_BROWSER_PATH} : {channel:env.GLITCH_BROWSER_CHANNEL||'chrome'})};
}

export async function renderVideo({origin,job,output,frames=1114,onProgress=()=>{},timeoutMs=20*60*1000}) {
  const browser = await chromium.launch(browserOptions());
  let encoder, timer, timedOut = false;
  try {
    timer = setTimeout(() => { timedOut=true; encoder?.kill('SIGKILL'); void browser.close(); }, timeoutMs);
    const page = await browser.newPage({viewport:{width:job.width,height:job.height},deviceScaleFactor:1});
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    // Only our loopback renderer and sanitized local images may be loaded.
    await page.route('**/*', route => route.request().url().startsWith(origin + '/') ? route.continue() : route.abort());
    await page.goto(`${origin}/jobs/${job.id}/render`,{timeout:30000});
    await page.evaluate(() => window.filmReady);
    const adapter = await page.evaluate(() => window.film.adapterInfo);
    const ffmpeg=process.env.GLITCH_FFMPEG_PATH || 'ffmpeg';
    const encoderEnv={...process.env};
    if(process.platform==='darwin' && path.isAbsolute(ffmpeg))encoderEnv.DYLD_LIBRARY_PATH=path.dirname(ffmpeg);
    encoder = spawn(ffmpeg, [
      '-hide_banner','-loglevel','error','-n','-f','image2pipe','-framerate','30','-vcodec','png','-i','pipe:0',
      '-an','-c:v','libx264','-preset','fast','-crf','23','-pix_fmt','yuv420p',
      '-vf','scale=in_range=full:out_range=tv:out_color_matrix=bt709',
      '-colorspace','bt709','-color_primaries','bt709','-color_trc','bt709','-movflags','+faststart',output,
    ],{env:encoderEnv,stdio:['pipe','ignore','pipe']});
    let encoderError, stderr = '';
    encoder.stderr.on('data',data => { stderr=(stderr+data.toString()).slice(-4000); });
    encoder.stdin.on('error',error => { encoderError=error; });
    const done = new Promise((resolve,reject) => {
      encoder.on('error',reject);
      encoder.on('close',code => code === 0 ? resolve() : reject(new Error(`Encoder failed (${code}): ${stderr}`)));
    });
    // Attach immediately: spawn errors can occur before the first frame is ready.
    done.catch(error => { encoderError=error; });
    for (let frame=0; frame<frames; frame++) {
      if (timedOut) throw new Error('Rendering timed out.');
      const encoded = await page.evaluate(async frame => {
        await window.film.frame(frame);
        return document.querySelector('canvas').toDataURL('image/png').split(',')[1];
      },frame);
      if (errors.length) throw new Error(errors.join('\n'));
      if (encoderError) throw encoderError;
      if (!encoder.stdin.write(Buffer.from(encoded,'base64'))) await once(encoder.stdin,'drain');
      if (frame % 15 === 0) onProgress(Math.floor((frame+1)/frames*95));
    }
    onProgress(97);
    encoder.stdin.end();
    await done;
    const stat = await fs.stat(output);
    if (stat.size < 100) throw new Error('Encoder produced an empty file.');
    return {adapter,bytes:stat.size,frames,fps:30,width:job.width,height:job.height};
  } finally {
    clearTimeout(timer);
    if (encoder && encoder.exitCode === null) encoder.kill('SIGKILL');
    await browser.close();
  }
}

export async function checkRenderer({origin,job,directory}) {
  const output=path.join(directory,'check.mp4');
  try {
    await fs.rm(output,{force:true});
    const result=await renderVideo({origin,job,output,frames:2,timeoutMs:60000});
    return {available:true,adapter:result.adapter};
  } catch (error) {
    return {available:false,detail:error.message};
  } finally { await fs.rm(output,{force:true}); }
}
