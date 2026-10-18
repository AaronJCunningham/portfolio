export const FORMATS = {
  vertical: {width:720, height:1280, label:'Social media', ratio:'9:16'},
  portrait: {width:720, height:900, label:'Instagram posts', ratio:'4:5'},
};
export const LIMITS = {images:32, fileBytes:8*1024*1024, totalBytes:64*1024*1024, pixels:24_000_000};
export const BROWSER_HELP = 'Use an up-to-date Chrome-compatible browser, such as Chrome or Edge, with graphics acceleration enabled. If you opened this inside another app, open the link in your browser.';

/** @param {Array<{size:number, type:string}>} files */
export function validateFiles(files) {
  if(!files.length)throw new Error('Choose at least one photo.');
  if(files.length>LIMITS.images)throw new Error('Choose up to 32 photos. Remove a few before adding more.');
  if(files.some(file=>!['image/jpeg','image/png','image/webp'].includes(file.type)))throw new Error('Use JPG, PNG or WebP images.');
  if(files.some(file=>file.size>LIMITS.fileBytes))throw new Error('Each image must be 8 MB or smaller.');
  if(files.reduce((total,file)=>total+file.size,0)>LIMITS.totalBytes)throw new Error('Keep your selected images under 64 MB in total.');
}

/** Capability checks, not browser-name detection. Injected probes also allow unsupported cases to be tested. */
export async function probeSupport({secure, gpu, videoEncoder, probeGpu, probeEncoding}) {
  const unsupported=reason=>({supported:false, reason, formats:[]});
  if(!secure)return unsupported('Open this page using HTTPS.');
  if(!gpu)return unsupported('This browser cannot run the video effects. '+BROWSER_HELP);
  if(!videoEncoder)return unsupported('This browser cannot export MP4 videos. '+BROWSER_HELP);
  try {await probeGpu();}
  catch {return unsupported('Graphics acceleration is unavailable on this device. '+BROWSER_HELP);}
  const formats=[];
  for(const [key,dimensions] of Object.entries(FORMATS)) {
    try {if(await probeEncoding(dimensions))formats.push(key);} catch { /* A failed encoder probe is unsupported. */ }
  }
  if(!formats.length)return unsupported('This device cannot export either MP4 size. '+BROWSER_HELP);
  return {supported:true, reason:'', formats};
}
