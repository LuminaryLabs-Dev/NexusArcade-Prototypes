import { cluster, hash32, line, polygon, rng, surface } from './raster.js';

const P = Object.freeze({
  ink:'#101116', shadow:'rgba(3,4,5,.62)', skin:'#8d5b45', skinHi:'#c28a63', cloth:'#5a2636', clothHi:'#9b4050',
  leather:'#5d422c', leatherHi:'#96704a', iron:'#465257', ironHi:'#91a29d', edge:'#d2d9c4', rust:'#8a442a',
  bark:'#3d4a27', barkHi:'#6e7540', vine:'#344b27', moss:'#667c3b', leaf:'#91a84b', bone:'#9c8c69', boneHi:'#dfd3a2',
  blood:'#7b1f32', bloodHi:'#d44b58', flesh:'#9d4650', wet:'#ed7a72', fungus:'#76598a', fungusHi:'#c18ac0', spore:'#d9d078',
  gold:'#b28a3b', goldHi:'#e1c26d', flame:'#7363a5', flameHi:'#bcb5e6'
});

function shadow(c,x,y,rx){c.fillStyle=P.shadow;for(let r=-2;r<=2;r++){const n=Math.abs(r)*3;c.fillRect(x-rx+n,y+r,rx*2-n*2,1);}}
function joint(c,x,y,fill,r=2){c.fillStyle=P.ink;c.fillRect(x-r-1,y-r-1,r*2+3,r*2+3);c.fillStyle=fill;c.fillRect(x-r,y-r,r*2+1,r*2+1);}
function boot(c,x,y,flip=false,fill=P.leather){polygon(c,flip?[[x+3,y-6],[x+5,y],[x+3,y+4],[x-4,y+3],[x-3,y-1]]:[[x-3,y-6],[x-5,y],[x-3,y+4],[x+4,y+3],[x+3,y-1]],fill,P.ink);c.fillStyle=P.leatherHi;c.fillRect(x-2,y+1,4,1);}
function sword(c,hand,tip){line(c,hand,tip,2,P.ironHi,'#222a2d');const dx=tip[0]-hand[0],dy=tip[1]-hand[1],l=Math.hypot(dx,dy)||1,nx=-dy/l,ny=dx/l;c.fillStyle=P.gold;c.fillRect(Math.round(hand[0]+nx*3)-1,Math.round(hand[1]+ny*3)-1,3,3);line(c,[hand[0]-nx*4,hand[1]-ny*4],[hand[0]+nx*4,hand[1]+ny*4],1,P.gold,'#3a2a18');}
function human(c,q,frame){const bob=frame%2,step=frame?2:-2;shadow(c,31,72,14);
  // Back cloak and separated legs establish a narrow, human silhouette.
  polygon(c,[[22,31-bob],[38,32-bob],[41,55],[35,61],[31,56],[26,62],[19,56]],'#241923',P.ink);cluster(c,23,39-bob,[[0,0,2,15],[6,2,1,16],[12,-1,2,17]],P.cloth);
  line(c,[27,49-bob],[25+step,59],4,P.cloth,'#17161b');line(c,[25+step,59],[23+step,68],3,P.leather,'#17161b');boot(c,23+step,69,false);
  line(c,[35,49-bob],[36-step,59],4,P.cloth,'#17161b');line(c,[36-step,59],[39-step,68],3,P.leather,'#17161b');boot(c,39-step,69,true);
  // Tapered torso, asymmetrical shoulders, fitted armor and belt.
  polygon(c,[[21,30-bob],[27,26-bob],[35,27-bob],[41,34-bob],[39,49-bob],[33,53-bob],[25,50-bob],[20,40-bob]],P.cloth,P.ink);
  polygon(c,[[25,31-bob],[34,30-bob],[38,35-bob],[36,45-bob],[31,48-bob],[24,44-bob]],P.iron,'#222a2d');polygon(c,[[25,31-bob],[34,30-bob],[36,34-bob],[28,35-bob]],P.ironHi);
  c.fillStyle=P.leather;c.fillRect(24,46-bob,14,3);c.fillStyle=P.gold;c.fillRect(31,46-bob,3,3);cluster(c,23,37-bob,[[0,0,2,6],[13,-1,2,5]],P.clothHi);
  // Bent upper and lower arms with visible elbows and attached hands.
  line(c,[21,33-bob],[16,43-bob],4,P.cloth);joint(c,16,43-bob,P.iron,2);line(c,[16,43-bob],[18,53-bob],3,P.iron);joint(c,18,53-bob,P.skin,1);
  line(c,[39,34-bob],[45,40-bob],4,P.cloth);joint(c,45,40-bob,P.iron,2);line(c,[45,40-bob],[44,50-bob],3,P.iron);joint(c,44,50-bob,P.skin,1);sword(c,[44,50-bob],[50,68-bob]);
  // Smaller hooded head with an offset three-quarter face and visible neck.
  c.fillStyle=P.skin;c.fillRect(28,23-bob,6,7);polygon(c,[[22,17-bob],[25,10-bob],[31,7-bob],[38,11-bob],[40,18-bob],[36,27-bob],[28,29-bob],[23,24-bob]],'#29222c',P.ink);
  polygon(c,[[25,17-bob],[27,12-bob],[32,10-bob],[37,13-bob],[37,20-bob],[34,25-bob],[28,24-bob],[25,21-bob]],P.skin,'#3f2b27');
  c.fillStyle=P.skinHi;c.fillRect(27,15-bob,4,1);c.fillRect(35,17-bob,2,2);c.fillStyle=P.ink;c.fillRect(29,20-bob,2,1);c.fillRect(35,20-bob,2,1);c.fillStyle=P.clothHi;c.fillRect(23,15-bob,2,6);
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
function knight(c,q,frame){const bob=frame%2,step=frame?1:-1;shadow(c,32,72,17);
  polygon(c,[[21,31-bob],[42,33-bob],[44,57],[37,63],[31,58],[24,63],[18,56]],'#1b2023',P.ink);cluster(c,22,38-bob,[[0,0,2,17],[7,2,2,17],[15,-1,2,17]],P.iron);
  line(c,[27,50-bob],[25+step,59],5,P.iron,'#20272a');line(c,[25+step,59],[23+step,68],4,P.ironHi,'#20272a');boot(c,23+step,69,false,P.iron);
  line(c,[36,50-bob],[37-step,59],5,P.iron,'#20272a');line(c,[37-step,59],[40-step,68],4,P.ironHi,'#20272a');boot(c,40-step,69,true,P.iron);
  polygon(c,[[19,31-bob],[27,26-bob],[37,28-bob],[45,35-bob],[42,50-bob],[35,55-bob],[25,52-bob],[18,42-bob]],P.iron,'#20272a');
  polygon(c,[[23,31-bob],[35,29-bob],[41,35-bob],[37,46-bob],[30,50-bob],[22,44-bob]],P.ironHi);c.fillStyle='#273033';c.fillRect(26,35-bob,13,3);c.fillRect(25,41-bob,12,3);c.fillStyle=P.gold;c.fillRect(30,47-bob,5,3);
  polygon(c,[[17,30-bob],[20,25-bob],[28,27-bob],[27,36-bob],[21,40-bob]],P.gold,'#5b4521');cluster(c,18,29-bob,[[0,0,2,7],[4,-2,3,8]],P.goldHi);
  line(c,[20,35-bob],[15,45-bob],5,P.iron);joint(c,15,45-bob,P.ironHi,2);line(c,[15,45-bob],[14,54-bob],3,P.ironHi);joint(c,14,54-bob,P.iron,1);sword(c,[14,54-bob],[9,69-bob]);
  line(c,[42,35-bob],[48,42-bob],5,P.iron);joint(c,48,42-bob,P.fungus,2);line(c,[48,42-bob],[49,52-bob],4,P.bark);joint(c,49,52-bob,P.barkHi,2);
  polygon(c,[[45,48-bob],[54,44-bob],[60,50-bob],[57,61-bob],[49,64-bob],[43,57-bob]],P.bark,'#202519');cluster(c,47,49-bob,[[0,0,5,2],[5,3,4,2],[1,8,5,2]],P.moss);
  // Helmet and fungus remain severe, but are anchored to a smaller human skull.
  c.fillStyle=P.iron;c.fillRect(29,23-bob,7,7);polygon(c,[[23,18-bob],[26,10-bob],[32,7-bob],[40,12-bob],[42,20-bob],[38,29-bob],[29,30-bob],[24,26-bob]],P.iron,'#20272a');polygon(c,[[27,12-bob],[33,9-bob],[39,13-bob],[38,18-bob],[28,19-bob]],P.ironHi);c.fillStyle='#07090a';c.fillRect(27,21-bob,11,3);c.fillStyle=P.fungusHi;c.fillRect(34,21-bob,3,1);
  polygon(c,[[36,12-bob],[39,7-bob],[43,10-bob],[46,5-bob],[51,10-bob],[48,17-bob],[42,19-bob]],P.fungus,'#373040');cluster(c,39,8-bob,[[0,0,5,2],[7,-2,4,3]],P.fungusHi);
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
