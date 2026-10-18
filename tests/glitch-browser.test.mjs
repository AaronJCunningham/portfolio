import test from 'node:test';
import assert from 'node:assert/strict';
import {probeSupport,validateFiles,LIMITS} from '../src/lib/glitch-studio/support.mjs';

const supported={secure:true,gpu:true,videoEncoder:true,probeGpu:async()=>{},probeEncoding:async()=>true};
test('missing graphics or encoding shows actionable Chrome-compatible browser guidance',async()=>{
  for(const key of ['gpu','videoEncoder']) {
    const result=await probeSupport({...supported,[key]:false});
    assert.equal(result.supported,false);
    assert.match(result.reason,/Chrome-compatible browser/);
    assert.deepEqual(result.formats,[]);
  }
});
test('HTTP, unavailable GPU and unsupported MP4 are blocked before choosing photos',async()=>{
  const insecure=await probeSupport({...supported,secure:false});
  assert.match(insecure.reason,/HTTPS/);
  const gpuFailure=await probeSupport({...supported,probeGpu:async()=>{throw Error('adapter failed');}});
  assert.equal(gpuFailure.supported,false);
  const noCodec=await probeSupport({...supported,probeEncoding:async()=>false});
  assert.match(noCodec.reason,/cannot export either MP4 size/);
});
test('only sizes with a working encoder are offered, regardless of browser brand',async()=>{
  const partial=await probeSupport({...supported,probeEncoding:async({height})=>height===1350});
  assert.equal(partial.supported,true);
  assert.deepEqual(partial.formats,['portrait']);
  assert.deepEqual((await probeSupport(supported)).formats,['vertical','portrait']);
});
test('local file validation enforces image count, MIME, individual and total memory budget',()=>{
  const image={size:1024,type:'image/jpeg'};
  validateFiles([image]);validateFiles(Array(32).fill(image));
  assert.throws(()=>validateFiles([]),/at least one/);
  assert.throws(()=>validateFiles(Array(33).fill(image)),/up to 32/);
  assert.throws(()=>validateFiles([{...image,type:'image/svg+xml'}]),/JPG, PNG or WebP/);
  assert.throws(()=>validateFiles([{...image,size:LIMITS.fileBytes+1}]),/8 MB/);
  assert.throws(()=>validateFiles(Array(9).fill({...image,size:LIMITS.fileBytes})),/64 MB/);
});
