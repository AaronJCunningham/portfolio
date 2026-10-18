import Busboy from 'busboy';
import sharp from 'sharp';
import fs from 'node:fs/promises';
import {createWriteStream} from 'node:fs';
import path from 'node:path';
import {Transform} from 'node:stream';
import {pipeline} from 'node:stream/promises';

export const LIMITS = {images:32,fileBytes:8*1024*1024,totalBytes:64*1024*1024};
export class RequestError extends Error {
  constructor(message,status=400) { super(message); this.status=status; }
}

export async function readUpload(req,directory) {
  if (Number(req.headers['content-length'])>LIMITS.totalBytes) throw new RequestError('Keep the total upload under 64 MB.',413);
  let parser;
  try { parser=Busboy({headers:req.headers,limits:{files:32,fields:2,parts:34,fileSize:LIMITS.fileBytes,fieldSize:256}}); }
  catch { throw new RequestError('Send images using the upload form.'); }
  const files=[],writes=[],fields={};
  let failure,bytes=0;
  const reject=message=>{ failure ??= new RequestError(message); };
  parser.on('file',(field,stream,info)=>{
    if (field!=='images' || !['image/jpeg','image/png','image/webp'].includes(info.mimeType)) {
      reject('Use JPG, PNG or WebP images.'); stream.resume(); return;
    }
    const file=path.join(directory,`upload-${files.length}`);
    files.push(file);
    stream.on('limit',()=>reject('Each image must be 8 MB or smaller.'));
    const write=pipeline(stream,createWriteStream(file,{flags:'wx'}));
    write.catch(error=>{ failure ??= error; });
    writes.push(write);
  });
  parser.on('field',(name,value,info)=>{
    if (!['format','title'].includes(name) || Object.hasOwn(fields,name) || info.valueTruncated) reject('Invalid video options.');
    else fields[name]=value;
  });
  for (const event of ['filesLimit','fieldsLimit','partsLimit']) parser.on(event,()=>reject('Upload up to 32 images and use the video options shown.'));
  const counter=new Transform({transform(chunk,encoding,callback){
    bytes+=chunk.length;
    callback(bytes>LIMITS.totalBytes?new RequestError('Keep the total upload under 64 MB.',413):null,chunk);
  }});
  try { await pipeline(req,counter,parser); }
  catch(error) { failure ??= error instanceof RequestError ? error : new RequestError('The upload was interrupted. Please try again.'); }
  await Promise.allSettled(writes);
  if (failure) throw failure;
  if (!files.length) throw new RequestError('Choose at least one image.');
  if (!['vertical','portrait'].includes(fields.format)) throw new RequestError('Choose a video format.');
  const title=(fields.title||'').trim();
  if (title.length>36 || /[\u0000-\u001f\u007f]/u.test(title)) throw new RequestError('Use a title of 36 characters or fewer.');
  const images=[];
  for (const [index,file] of files.entries()) {
    try {
      const photo=sharp(file,{limitInputPixels:24_000_000,failOn:'error'});
      const info=await photo.metadata();
      if (!['jpeg','png','webp'].includes(info.format) || (info.pages??1)>1) throw new Error('Unsupported image');
      const target=path.join(directory,`${index}.jpg`);
      await photo.rotate().resize({width:1080,height:1440,fit:'inside',withoutEnlargement:true})
        .flatten({background:'#080808'}).jpeg({quality:90}).toFile(target);
      images.push(target);
    } catch { throw new RequestError(`Image ${index+1} could not be read. Use a still JPG, PNG or WebP under 24 megapixels.`); }
    finally { await fs.rm(file,{force:true}); }
  }
  return {images,title,format:fields.format};
}
