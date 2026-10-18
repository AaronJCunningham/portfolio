import {createService} from './service.mjs';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

// A diagnostic must not touch or recover jobs owned by the running service.
const dataDir=await fs.mkdtemp(path.join(os.tmpdir(),'glitch-check-'));
const service=await createService({dataDir});
try {
  const health=await service.check();
  console.log(health.available?'PASS: Chrome/Chromium, WebGPU shaders and MP4 encoding.':'FAIL: '+health.detail);
  process.exitCode=health.available?0:1;
} finally {await service.stop();await fs.rm(dataDir,{recursive:true,force:true});}
