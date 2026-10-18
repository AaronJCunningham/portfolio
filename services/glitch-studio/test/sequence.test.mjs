import test from 'node:test';
import assert from 'node:assert/strict';
import {makeSequence} from '../sequence.mjs';
import {createRecipe,createFrameState} from '../engine/recipe.mjs';

test('every upload count uses every photo, balances repeats and avoids adjacent duplicates',()=>{
  for(let count=1;count<=32;count++)for(let seed=1;seed<=20;seed++) {
    const sequence=makeSequence(count,32,seed);
    assert.equal(sequence.length,32);
    const counts=Array(count).fill(0);
    sequence.forEach((value,index)=>{
      assert.ok(value>=0&&value<count);
      counts[value]++;
      if(count>1&&index)assert.notEqual(value,sequence[index-1]);
    });
    assert.ok(counts.every(value=>value>=1));
    assert.ok(Math.max(...counts)-Math.min(...counts)<=1);
  }
});
test('six photos fill the film without replaying an identical full loop',()=>{
  const sequence=makeSequence(6,32,42);
  for(let start=6;start+6<=32;start+=6)assert.notDeepEqual(sequence.slice(start,start+6),sequence.slice(start-6,start));
  assert.deepEqual(sequence,makeSequence(6,32,42));
  assert.notDeepEqual(sequence,makeSequence(6,32,43));
  assert.throws(()=>makeSequence(0));assert.throws(()=>makeSequence(33));
});
test('the approved timing and effect windows survive arbitrary image counts',()=>{
  const assets=Array.from({length:6},(_,i)=>({name:`photo-${i}`,src:`${i}.jpg`}));
  const recipe=createRecipe(makeSequence(6),assets,'AFTER HOURS');
  assert.equal(recipe.frames,1114);
  assert.equal(recipe.fps,30);
  assert.equal(recipe.clips.length,32);
  assert.equal(recipe.clips.reduce((sum,clip)=>sum+clip.effects,0),282);
  assert.equal(recipe.holdFrames,26);
  const state=createFrameState(recipe);
  let effectFrames=0;
  for(let frame=0;frame<1114;frame++) {
    const value=state(frame);
    assert.ok(assets.some(asset=>asset.name===value.shot[1]));
    for(const key of ['warp','sort','feedback','scanPhase','quietness'])assert.ok(Number.isFinite(value[key]),`${key} at ${frame}`);
    if(!value.holding)effectFrames++;
  }
  assert.equal(effectFrames,282);
  assert.equal(recipe.typography.cues.length,6);
  assert.ok(recipe.typography.cues.every(c=>c.text==='AFTER HOURS'));
  assert.equal(createRecipe(makeSequence(6),assets).typography.cues.length,0);
});
