// A five-second sketch. Times are frames at 30fps; images can be replaced by name.
export const recipe = {
  title: 'LVX / Invocation of fire — motion study 01', fps: 30, frames: 150,
  width: 1080, height: 1920, seed: 666,
  shots: [
    [0,'nice_sweater.jpg',1.15], [8,'P1012305.jpg',1.08],
    [15,'perfect.jpg',1.02], [24,'P1012286.jpg',1.22],
    [31,'nicefirst.jpg',1.04], [43,'firstdoortwo.jpg',1.02],
    [49,'sweater_001.jpg',1.3], [57,'both corner.jpg',1.0],
    [67,'polothroughleaves01.jpg',1.15], [72,'perfect.jpg',1.1],
    [84,'sittingcool.jpg',1.05], [96,'nice_sweater.jpg',1.0],
    [105,'polofirst.jpg',1.1], [111,'nicefirst.jpg',1.12],
    [119,'perfect.jpg',1.01], [132,'P1022362.jpg',1.05],
    [140,'perfect.jpg',1.0]
  ],
};
const bump=(f,c,w)=>Math.max(0,1-Math.abs(f-c)/w);
export function frameState(f) {
  const index=recipe.shots.findLastIndex(s=>s[0]<=f);
  const shot=recipe.shots[index], end=recipe.shots[index+1]?.[0]??150;
  const p=(f-shot[0])/(end-shot[0]);
  const a=bump(f,10,6), b=bump(f,26,7), c=bump(f,45,7), d=bump(f,65,8);
  const e=bump(f,79,9), g=bump(f,102,8), h=bump(f,116,8), j=bump(f,135,9);
  const attack=Math.max(a,b,c,d,e,g,h,j);
  return {index,shot,p,
    warp: .035 + a*.9+b*.6+c*.15+d*.85+e*.45+g*.8+h*.7+j*.45,
    feedback: Math.min(.94,a*.9+b*.58+c*.8+d*.92+e*.75+g*.93+h*.65+j*.7),
    sort: Math.min(1,a*.35+b*.9+c*.7+d*.25+e*.95+g*.3+h*.8+j*.85),
    erosion: Math.min(.98,b*.9+d*.55+e*.8+h*.6+j*.95),
    grain: .075+attack*.4+bump(f,54,3)*.5+bump(f,109,3)*.5,
    slice: Math.max(b*.85,c*.95,e*.45,h*.9,j*.7),
    palette: f<24?0:f<31?2:f<43?0:f<49?3:f<57?1:f<72?0:f<84?2:f<96?0:f<105?1:f<119?3:0,
    flash: [7,30,56,95,118,139].includes(f) ? 1 : 0,
    dither: Math.max(bump(f,29,4),bump(f,54,6),bump(f,100,5),bump(f,113,5)),
    attack,
  };
}
