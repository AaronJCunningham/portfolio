import {frameState as approvedFrameState} from './approved-score.mjs';

// Timing, zooms and effect score from the approved Motion Studio v007 film.
// Photo identity and optional lettering are supplied independently for each job.
const passages = [
  [0,8,1.15,0], [8,7,1.08,0], [15,9,1.02,0], [24,7,1.22,0],
  [31,12,1.04,0], [43,6,1.02,0], [49,8,1.3,0], [57,10,1,0],
  [67,5,1.15,0], [72,12,1.1,0], [84,12,1.05,0], [96,9,1,0],
  [105,6,1.1,0], [111,8,1.12,0], [119,13,1.01,0], [132,8,1.05,0],
  [140,10,1,0], [84,8,1.18,1], [7,10,1.06,0], [125,7,1,2],
  [25,12,1.02,0], [97,6,1,3], [59,10,1.12,1], [132,8,1.04,0],
  [37,11,1.1,2], [77,7,1.05,0], [20,9,1.15,1], [95,8,1.05,3],
  [64,10,1.14,0], [112,7,1,2], [128,9,1.08,1], [140,10,1.02,0],
];

export function createRecipe(sequence, assets, title = '') {
  if (sequence.length !== 32 || sequence.some(i => !Number.isInteger(i) || !assets[i])) throw new Error('Invalid image sequence.');
  let cursor = 0;
  const clips = passages.map(([source,effects,zoom,mirror], i) => {
    const clip = {source,effects,zoom,mirror,image:assets[sequence[i]].name,focus:[.5,.5],start:cursor};
    cursor += 26 + effects;
    return clip;
  });
  const cues = title ? [
    {start:72,end:100,x:970,y:1200,vx:-30},
    {start:239,end:267,x:-170,y:550,vx:30},
    {start:434,end:465,x:930,y:1530,vx:-24},
    {start:629,end:658,x:960,y:940,vx:-30},
    {start:817,end:845,x:40,y:450,vx:29},
    {start:1025,end:1054,x:1020,y:1400,vx:-35},
  ].map(cue => ({...cue,text:title})) : [];
  return {fps:30,frames:cursor,holdFrames:26,clips,shots:clips.map(c=>[c.start,c.image,c.zoom]),assets,typography:{maxFontSize:22,cues}};
}

export function createFrameState(recipe) {
  const {clips,holdFrames} = recipe;
  return function frameState(frame) {
    const index = recipe.shots.findLastIndex(shot => shot[0] <= frame);
    const shot = recipe.shots[index], clip = clips[index], local = frame - shot[0];
    const holding = local < holdFrames;
    let sourceFrame = clip.source + Math.max(0,local-holdFrames);
    const original = approvedFrameState(sourceFrame);
    const layout = {mirror:holding?0:clip.mirror,mirrorAmount:holding?0:Math.sin((local-holdFrames+1)/(clip.effects+1)*Math.PI),focus:clip.focus};
    if (!holding) return {...original,shot,index,clip,layout,holding:false,sourceFrame,quietness:0,gradeBlend:1,carry:0,scanPhase:sourceFrame*.6};
    const smooth = t => { const x=Math.max(0,Math.min(1,t)); return x*x*(3-2*x); };
    const incoming = index===0?0:1-smooth((local+.5)/6), outgoing=smooth((local+.5-(holdFrames-6))/6);
    const edge=Math.max(incoming,outgoing), prev=clips[Math.max(0,index-1)], prevFrame=prev.source+prev.effects-1;
    const from=approvedFrameState(prevFrame), to=approvedFrameState(clip.source);
    const between=(key,center=0)=>center*(1-edge)+from[key]*incoming+to[key]*outgoing;
    const tint=incoming>outgoing?from:to;
    sourceFrame=incoming>0?clip.source+(prevFrame-clip.source)*incoming:clip.source+local*.04;
    const mirrorClip=incoming>outgoing?prev:clip;
    const mirrorEdge=incoming>outgoing?Math.sin(prev.effects/(prev.effects+1)*Math.PI):Math.sin(Math.PI/(clip.effects+1));
    return {...original,shot,index,clip,holding:true,sourceFrame,
      layout:{...layout,mirror:mirrorClip.mirror,mirrorAmount:mirrorEdge*edge},p:to.p*outgoing,
      warp:between('warp',.008),feedback:between('feedback',.025),sort:between('sort'),erosion:between('erosion'),slice:between('slice'),
      palette:edge>0?tint.palette:0,flash:tint.flash*edge,dither:between('dither'),grain:between('grain',.075),attack:between('attack'),
      quietness:1-edge,gradeBlend:edge,carry:incoming*.95,scanPhase:clip.source*.6+local*.03};
  };
}
