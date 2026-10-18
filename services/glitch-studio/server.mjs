import {createService} from './service.mjs';

const service=await createService();
const url=await service.start();
console.log(`Glitch Studio renderer: ${url}`);
const health=await service.check();
console.log(health.available?'Browser, WebGPU shaders and MP4 encoding passed.':'Renderer unavailable; see the diagnostic above.');
for(const signal of ['SIGINT','SIGTERM'])process.once(signal,async()=>{await service.stop();process.exit(0);});
