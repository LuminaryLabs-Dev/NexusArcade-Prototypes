import { cluster, hash32, line, polygon, rng, surface } from './raster.js';

const P = Object.freeze({
  ink:'#101116', shadow:'rgba(3,4,5,.62)', skin:'#8d5b45', skinHi:'#c28a63', cloth:'#5a2636', clothHi:'#9b4050',
  leather:'#5d422c', leatherHi:'#96704a', iron:'#465257', ironHi:'#91a29d', edge:'#d2d9c4', rust:'#8a442a',
  bark:'#3d4a27', barkHi:'#6e7540', vine:'#344b27', moss:'#667c3b', leaf:'#91a84b', bone:'#9c8c69', boneHi:'#dfd3a2',
  blood:'#7b1f32', bloodHi:'#d44b58', flesh:'#9d4650', wet:'#ed7a72', fungus:'#76598a', fungusHi:'#c18ac0', spore:'#d9d078',
  gold:'#b28a3b', goldHi:'#e1c26d', flame:'#7363a5', flameHi:'#bcb5e6'
});

function shadow(c,x,y,rx){c.fillStyle=P.shadow;for(let r=-2;r<=2;r++){const n=Math.abs(r)*3;c.fillRect(x-rx+n,y+r,rx*2-n*2,1);}}
function human(c, q, frame){shadow(c,31,70,17);const bob=frame%2;
  polygon(c,[[34,50-bob],[41,52-bob],[39,65],[35,68],[31,65],[32,54]],'#261821',P.ink);polygon(c,[[25,49-bob],[33,51-bob],[30,65],[25,69],[21,66],[23,54]],P.cloth,P.ink);
  polygon(c,[[21,34-bob],[40,35-bob],[42,51],[37,58],[31,54],[27,59],[20,52]],'#261821',P.ink);polygon(c,[[23,33-bob],[39,35-bob],[38,49],[31,53],[22,48]],P.cloth,P.ink);
  polygon(c,[[27,35-bob],[37,36-bob],[35,46],[29,49],[25,44]],P.leather,'#2d211b');line(c,[38,37-bob],[44,49],4,'#261821');
  polygon(c,[[42,43],[49,45],[51,53],[47,58],[40,54],[39,47]],P.iron,'#222a2d');cluster(c,42,47,[[0,0,6,2],[2,3,5,1]],P.ironHi);
  line(c,[21,38-bob],[16,52],4,P.cloth);line(c,[16,51],[9,25-frame%2],2,P.leatherHi);polygon(c,[[8,27],[10,9-frame%2],[13,7-frame%2],[14,10],[11,28]],P.ironHi,'#222a2d');c.fillStyle=P.gold;c.fillRect(12,27,7,2);
  polygon(c,[[22,22-bob],[25,15-bob],[31,12-bob],[38,15-bob],[40,22-bob],[37,30-bob],[29,32-bob],[23,28-bob]],P.skin,P.ink);polygon(c,[[23,22-bob],[25,15-bob],[31,11-bob],[38,14-bob],[39,20-bob],[35,18-bob],[31,21-bob],[27,18-bob]],'#2d211b');
  c.fillStyle=P.skinHi;c.fillRect(25,23-bob,4,1);c.fillStyle=P.ink;c.fillRect(28,27-bob,3,1);c.fillRect(36,25-bob,2,2);cluster(c,23,42,[[0,0,3,2],[5,4,2,1],[11,0,2,2]],P.clothHi);
}
function rotwood(c,q,frame){shadow(c,33,70,19);const sway=frame%2;
  line(c,[29,49],[23-sway,65],5,P.bark,'#202519');line(c,[37,49],[40+sway,65],4,P.bark,'#202519');for(const [x,y,d] of [[23,65,-9],[23,65,5],[40,65,-4],[40,65,10]])line(c,[x,y],[x+d,70],2,'#202519',P.ink);
  polygon(c,[[20,31],[33,25],[45,31],[43,48],[35,56],[25,51],[18,42]],P.bark,'#202519');polygon(c,[[21,32],[31,27],[35,45],[26,49],[19,42]],P.barkHi);
  cluster(c,24,31,[[0,0,2,9],[4,-2,2,13],[9,2,2,8],[14,-1,2,11]],'#202519');line(c,[20,34],[11-sway,51],4,P.bark,'#202519');line(c,[11-sway,51],[7-sway,61],3,P.vine,P.ink);
  line(c,[42,33],[48,43],3,P.bark,'#202519');polygon(c,[[24,27],[25,17],[31,12],[39,16],[42,23],[38,32],[30,33]],P.bark,'#202519');polygon(c,[[27,19],[31,14],[39,17],[37,24],[29,25]],P.barkHi);
  c.fillStyle=P.spore;c.fillRect(30,25,3,2);line(c,[48,42],[55,18],2,P.barkHi);line(c,[55,18],[59,47],2,P.barkHi);c.strokeStyle=P.boneHi;c.lineWidth=1;c.beginPath();c.moveTo(55,18);c.lineTo(48,42);c.lineTo(59,47);c.stroke();
  polygon(c,[[23,18],[20,13],[25,12],[23,8],[29,10],[32,6],[36,11],[42,9],[40,16],[35,17],[29,16]],P.fungus,'#373040');cluster(c,22,11,[[0,0,5,2],[8,-2,6,3],[15,1,5,2]],P.fungusHi);
}
function bone(c,q,frame){shadow(c,32,69,15);const bob=frame%2;
  polygon(c,[[20,31-bob],[43,30-bob],[45,52],[40,64],[36,60],[31,70],[27,61],[20,66],[18,50]],'#261821',P.ink);polygon(c,[[22,32-bob],[41,32-bob],[39,49],[34,56],[29,51],[23,56],[20,48]],'#18191d');
  c.strokeStyle=P.bone;c.lineWidth=2;c.beginPath();c.moveTo(31,30-bob);c.lineTo(31,52);c.stroke();for(let y=34;y<=47;y+=4){c.beginPath();c.moveTo(31,y-bob);c.lineTo(23,y+3-bob);c.moveTo(31,y-bob);c.lineTo(40,y+2-bob);c.stroke();}
  line(c,[23,33-bob],[13,45],2,P.bone,'#3b3429');line(c,[40,33-bob],[48,43],2,P.bone,'#3b3429');polygon(c,[[22,21-bob],[25,13-bob],[32,9-bob],[40,14-bob],[42,22-bob],[38,30-bob],[29,31-bob],[23,27-bob]],P.cloth,P.ink);
  polygon(c,[[25,20-bob],[27,15-bob],[33,12-bob],[39,16-bob],[38,24-bob],[34,28-bob],[28,25-bob]],P.bone,'#3b3429');c.fillStyle='#08090b';c.fillRect(28,20-bob,3,3);c.fillRect(35,19-bob,3,3);
  line(c,[50,51],[55,15-frame%2],2,P.bone,'#3b3429');polygon(c,[[52,17],[55,10-frame%2],[58,16],[56,21]],P.flame,'#3d315d');cluster(c,54,11-frame%2,[[0,0,2,4],[2,2,2,3],[1,-2,1,3]],P.flameHi);
}
function bloodfen(c,q,frame){shadow(c,32,70,23);const pulse=frame%2;
  polygon(c,[[10,41],[17,28],[34,24-pulse],[48,30],[55,44],[50,59],[39,67],[20,64],[11,55]],P.flesh,'#35121b');polygon(c,[[14,39],[21,29],[35,28-pulse],[43,34],[40,50],[30,57],[17,53]],P.blood,'#35121b');
  polygon(c,[[22,29],[24,19-pulse],[32,15-pulse],[40,20],[42,30],[36,36],[27,34]],'#4b2d28',P.ink);polygon(c,[[27,29],[34,36],[40,29],[35,40]],P.bloodHi,'#35121b');
  line(c,[18,37],[8,54],7,P.blood,'#35121b');line(c,[44,33],[53,49],7,P.flesh,'#35121b');line(c,[52,49],[57,29],3,'#3b3429',P.ink);polygon(c,[[53,32],[54,15],[60,10],[62,24],[58,35]],P.bone,'#3b3429');
  polygon(c,[[19,57],[30,58],[27,69],[18,71],[14,67]],'#35121b',P.ink);polygon(c,[[36,57],[48,54],[51,66],[46,71],[37,68]],P.flesh,'#35121b');cluster(c,17,39,[[0,0,5,2],[9,-5,4,3],[15,7,5,2],[24,-2,4,3]],P.wet);
}
function knight(c,q,frame){shadow(c,32,70,18);const sway=frame%2;
  polygon(c,[[22,51],[31,52],[29,67],[23,71],[18,68],[20,57]],'#222a2d',P.ink);polygon(c,[[33,51],[42,49],[45,66],[40,71],[33,68]],P.iron,'#222a2d');
  polygon(c,[[19,30],[31,25-sway],[45,31],[44,50],[37,57],[28,55],[19,48]],P.iron,'#222a2d');polygon(c,[[22,31],[31,28-sway],[38,30],[35,48],[28,52],[22,46]],P.ironHi);
  polygon(c,[[17,31],[20,25],[29,27],[27,35],[21,39]],P.gold,'#5b4521');polygon(c,[[41,29],[49,31],[51,39],[45,42],[39,36]],P.fungus,'#373040');
  polygon(c,[[23,24-sway],[25,13-sway],[32,9-sway],[41,14-sway],[43,24-sway],[39,31],[29,31]],P.iron,'#222a2d');polygon(c,[[26,16-sway],[32,12-sway],[40,15-sway],[38,20-sway],[28,21-sway]],P.ironHi);c.fillStyle='#08090b';c.fillRect(27,22-sway,12,3);c.fillStyle=P.fungusHi;c.fillRect(35,22-sway,3,1);
  polygon(c,[[47,42],[56,39],[61,46],[58,59],[50,62],[44,54]],P.bark,'#202519');cluster(c,48,44,[[0,0,5,2],[5,3,4,2],[1,8,5,2]],P.moss);line(c,[13,49],[8,24-frame%2],2,P.ironHi,'#222a2d');polygon(c,[[7,26],[7,9-frame%2],[11,7-frame%2],[12,11],[10,27]],P.iron,'#222a2d');
  polygon(c,[[37,15],[40,9],[44,12],[46,7],[51,11],[49,17],[43,19]],P.fungus,'#373040');cluster(c,40,10,[[0,0,5,2],[7,-2,4,3]],P.fungusHi);
}

export async function generateCharacter(recipe, frame = 0, variant = 0) {
  const { canvas, ctx } = surface();
  const q = rng(hash32(`${recipe.id}/${recipe.seed}/${variant}`));
  if(recipe.family==='human')human(ctx,q,frame);else if(recipe.family==='rotwood')rotwood(ctx,q,frame);else if(recipe.family==='bone')bone(ctx,q,frame);else if(recipe.family==='bloodfen')bloodfen(ctx,q,frame);else knight(ctx,q,frame);
  return createImageBitmap(canvas);
}

export async function buildSpriteCache(recipes, frames = 2) {
  const cache = new Map();
  for (const [key, recipe] of Object.entries(recipes)) for (let frame = 0; frame < frames; frame++) cache.set(`${key}:${frame}`, await generateCharacter(recipe, frame));
  return cache;
}

export async function generatorSignatures(recipes) {
  const signatures = {};
  for (const [key, recipe] of Object.entries(recipes)) {
    const a = await generateCharacter(recipe, 0), b = await generateCharacter(recipe, 0);
    const c = document.createElement('canvas'); c.width=64;c.height=80;const x=c.getContext('2d');x.drawImage(a,0,0);const first=c.toDataURL();x.clearRect(0,0,64,80);x.drawImage(b,0,0);signatures[key]=first===c.toDataURL();a.close();b.close();
  }
  return signatures;
}
