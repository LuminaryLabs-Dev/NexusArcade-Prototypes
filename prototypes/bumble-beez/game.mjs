const canvas = document.querySelector('#game');
const ctx = canvas.getContext('2d', { alpha: false });
const statusNode = document.querySelector('#status');
ctx.imageSmoothingEnabled = false;

const VIEW_W = 320;
const VIEW_H = 180;
const SCALE = 2;
const query = new URLSearchParams(location.search);
const autoplay = query.get('autoplay') === '1';
const keys = new Set();
const C = {
  sky:'#24233d', dusk:'#5b4666', dusk2:'#6f4c68', ink:'#181425', cream:'#fff0a8',
  honey:'#ffbe39', honeyLight:'#ffed82', greenDark:'#224e3c', green:'#3e894c',
  greenLight:'#82be5c', danger:'#f54443', warning:'#ffab51', white:'#eef9e8',
  stone:'#60617a', stoneLight:'#9993a5', blue:'#89d4df', purple:'#b86b9e'
};

const FONT = {
  A:['010','101','111','101','101'],B:['110','101','110','101','110'],C:['111','100','100','100','111'],D:['110','101','101','101','110'],
  E:['111','100','110','100','111'],F:['111','100','110','100','100'],G:['111','100','101','101','111'],H:['101','101','111','101','101'],
  I:['111','010','010','010','111'],L:['100','100','100','100','111'],M:['101','111','111','101','101'],N:['101','111','111','111','101'],
  O:['111','101','101','101','111'],P:['110','101','110','100','100'],R:['110','101','110','101','101'],S:['111','100','111','001','111'],
  T:['111','010','010','010','010'],U:['101','101','101','101','111'],V:['101','101','101','101','010'],W:['101','101','111','111','101'],
  Y:['101','101','010','010','010'],Z:['111','001','010','100','111'],0:['111','101','101','101','111'],1:['010','110','010','010','111'],2:['111','001','111','100','111'],
  3:['111','001','111','001','111'],4:['101','101','111','001','001'],5:['111','100','111','001','111'],6:['111','100','111','101','111'],
  7:['111','001','010','010','010'],8:['111','101','111','101','111'],9:['111','101','111','001','111'],'/':['001','001','010','100','100'],
  '>':['100','010','001','010','100'],'<':['001','010','100','010','001'],'!':['010','010','010','000','010'],'.':['000','000','000','000','010'],
  '-':['000','000','111','000','000'],' ':['000','000','000','000','000']
};

function pixelText(value,x,y,color=C.cream,scale=1,align='left'){
  const width=String(value).length*4*scale-scale;
  if(align==='center')x-=Math.floor(width/2);if(align==='right')x-=width;
  ctx.fillStyle=color;
  for(const ch of String(value).toUpperCase()){
    const glyph=FONT[ch]??FONT[' '];
    glyph.forEach((row,yy)=>[...row].forEach((cell,xx)=>{if(cell==='1')ctx.fillRect(Math.round(x+xx*scale),Math.round(y+yy*scale),scale,scale);}));
    x+=4*scale;
  }
}

const world = await fetch('./generated/world.json').then(r=>r.json());
const images={};
async function load(id,url){const image=new Image();image.src=url;await image.decode();images[id]=image;}
await Promise.all([load('bee','./generated/bee-sheet.png'),load('sniper','./generated/sniper-sheet.png')]);

const state={
  mode:autoplay?'playing':'menu', screen:'main', menuIndex:0, time:0, menuTime:0, cameraX:0, score:0, lives:3,
  player:{x:world.start.x,y:world.start.y,vx:0,vy:0,facing:1,dash:1,dashTime:0,invulnerable:0},
  pollen:world.pollen.map(p=>({...p,collected:false})),
  snipers:world.snipers.map(s=>({...s,state:'track',previous:'track',lockX:world.start.x,lockY:world.start.y,blocked:false,flash:0})),
  particles:[],shots:[],message:'',messageUntil:0,waypoint:0,shake:0,reducedFlash:false
};

function resetRun(){state.mode='playing';state.time=0;state.cameraX=0;state.score=0;state.lives=3;state.waypoint=0;Object.assign(state.player,{x:world.start.x,y:world.start.y,vx:0,vy:0,facing:1,dash:1,dashTime:0,invulnerable:0});state.pollen=world.pollen.map(p=>({...p,collected:false}));}
function burst(x,y,color,count=8,speed=25,type='spark'){for(let i=0;i<count;i++){const a=i/count*Math.PI*2+state.time*.4;state.particles.push({x,y,vx:Math.cos(a)*(speed+(i%4)*3),vy:Math.sin(a)*(speed+(i%4)*3),life:.5+(i%3)*.08,color,type});}}

window.addEventListener('keydown',e=>{
  if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code))e.preventDefault();keys.add(e.code);
  if(state.mode==='menu'){
    if(e.code==='ArrowUp'||e.code==='KeyW')state.menuIndex=(state.menuIndex+2)%3;
    if(e.code==='ArrowDown'||e.code==='KeyS')state.menuIndex=(state.menuIndex+1)%3;
    if(e.code==='Enter'||e.code==='Space')activateMenu();
    if(e.code==='Escape'&&state.screen!=='main')state.screen='main';
  }else if(state.mode==='playing'){
    if(e.code==='Space')dash();if(e.code==='Escape')state.mode='paused';
  }else if(state.mode==='paused'){
    if(e.code==='Escape'||e.code==='Enter')state.mode='playing';if(e.code==='KeyQ'){state.mode='menu';state.screen='main';}
  }else if((state.mode==='won'||state.mode==='lost')&&(e.code==='Enter'||e.code==='Space'))resetRun();
});
window.addEventListener('keyup',e=>keys.delete(e.code));
canvas.addEventListener('pointerdown',e=>{canvas.focus();if(state.mode==='menu'){const r=canvas.getBoundingClientRect(),y=(e.clientY-r.top)/r.height*VIEW_H;state.menuIndex=Math.max(0,Math.min(2,Math.floor((y-97)/17)));activateMenu();}});
function activateMenu(){if(state.menuIndex===0)resetRun();else if(state.menuIndex===1)state.screen='guide';else{state.reducedFlash=!state.reducedFlash;state.message=`FLASH ${state.reducedFlash?'LOW':'FULL'}`;state.messageUntil=state.menuTime+1;}}
function dash(){if(state.player.dash<1||state.player.dashTime>0)return;state.player.dash=0;state.player.dashTime=.24;burst(state.player.x,state.player.y,C.blue,12,34,'trail');}
function inCover(x,y,m=0){return world.covers.some(c=>x>=c.x-m&&x<=c.x+c.w+m&&y>=c.y-m&&y<=c.y+c.h+m);}
function blocked(ax,ay,bx,by){const n=Math.max(10,Math.ceil(Math.hypot(bx-ax,by-ay)/2));for(let i=1;i<n;i++){const t=i/n;if(inCover(ax+(bx-ax)*t,ay+(by-ay)*t,1))return true;}return false;}

function update(dt){
  state.menuTime+=dt;
  if(state.mode==='menu'){if(Math.floor(state.menuTime*4)%3===0&&state.particles.length<35)burst(80+(state.menuTime*37)%200,55,C.honeyLight,2,5,'dust');updateFx(dt);return;}
  if(state.mode!=='playing'){updateFx(dt);return;}
  state.time+=dt;
  let dx=0,dy=0;
  if(autoplay){const target=world.capturePath[Math.min(state.waypoint,world.capturePath.length-1)];dx=target[0]-state.player.x;dy=target[1]-state.player.y;const d=Math.hypot(dx,dy)||1;if(d<5&&state.waypoint<world.capturePath.length-1)state.waypoint++;dx/=d;dy/=d;if(state.snipers.some(s=>s.state==='warning'&&!s.blocked)&&state.player.dash>=1&&state.waypoint%2===0)dash();}
  else{dx=Number(keys.has('ArrowRight')||keys.has('KeyD'))-Number(keys.has('ArrowLeft')||keys.has('KeyA'));dy=Number(keys.has('ArrowDown')||keys.has('KeyS'))-Number(keys.has('ArrowUp')||keys.has('KeyW'));const d=Math.hypot(dx,dy)||1;dx/=d;dy/=d;}
  const speed=state.player.dashTime>0?105:56;state.player.vx+=(dx*speed-state.player.vx)*Math.min(1,dt*11);state.player.vy+=(dy*speed-state.player.vy)*Math.min(1,dt*11);
  state.player.x=Math.max(7,Math.min(world.bounds.width-7,state.player.x+state.player.vx*dt));state.player.y=Math.max(20,Math.min(VIEW_H-8,state.player.y+state.player.vy*dt));
  if(Math.abs(state.player.vx)>1)state.player.facing=Math.sign(state.player.vx);state.player.dashTime=Math.max(0,state.player.dashTime-dt);state.player.dash=Math.min(1,state.player.dash+dt/2);state.player.invulnerable=Math.max(0,state.player.invulnerable-dt);
  const targetCamera=Math.max(0,Math.min(world.bounds.width-VIEW_W,state.player.x-95));state.cameraX+=(targetCamera-state.cameraX)*Math.min(1,dt*4.5);
  if(Math.abs(state.player.vx)>20&&Math.floor(state.time*18)%2===0)state.particles.push({x:state.player.x-state.player.facing*7,y:state.player.y+3,vx:-state.player.vx*.18,vy:Math.sin(state.time*8)*4,life:.35,color:C.honeyLight,type:'trail'});
  for(const p of state.pollen)if(!p.collected&&Math.hypot(state.player.x-p.x,state.player.y-p.y)<10){p.collected=true;state.score++;state.message=`POLLEN ${state.score}/5`;state.messageUntil=state.time+.8;burst(p.x,p.y,C.honeyLight,16,32);}
  for(const s of state.snipers){s.previous=s.state;const cycle=(state.time+s.phase)%s.cadence,a=s.cadence-s.warning-s.hot,b=s.cadence-s.hot;s.state=cycle<a?'track':cycle<b?'warning':'hot';if(s.state==='track'){s.lockX+=(state.player.x-s.lockX)*Math.min(1,dt*6);s.lockY+=(state.player.y-s.lockY)*Math.min(1,dt*6);}if(s.state==='warning'&&s.previous==='track'){s.lockX=state.player.x;s.lockY=state.player.y;}s.blocked=blocked(s.x,s.y,s.lockX,s.lockY);if(s.state==='hot'&&s.previous==='warning'){s.flash=.16;state.shots.push({x1:s.x,y1:s.y,x2:s.lockX,y2:s.lockY,life:.16,blocked:s.blocked});if(!s.blocked&&Math.hypot(state.player.x-s.lockX,state.player.y-s.lockY)<7&&state.player.invulnerable<=0&&state.player.dashTime<=0){state.lives--;state.player.invulnerable=1.1;state.shake=.3;state.message='STUNG!';state.messageUntil=state.time+.8;burst(state.player.x,state.player.y,C.danger,18,42);if(state.lives<=0)state.mode='lost';}}s.flash=Math.max(0,s.flash-dt);}
  if(state.score===5&&Math.hypot(state.player.x-world.hive.x,state.player.y-world.hive.y)<18){state.mode='won';state.message='HIVE SAFE!';burst(world.hive.x,world.hive.y,C.honey,40,48);}
  updateFx(dt);
}
function updateFx(dt){for(const p of state.particles){p.x+=p.vx*dt;p.y+=p.vy*dt;p.vx*=.96;p.vy*=.96;p.life-=dt;}state.particles=state.particles.filter(p=>p.life>0);for(const s of state.shots)s.life-=dt;state.shots=state.shots.filter(s=>s.life>0);state.shake=Math.max(0,state.shake-dt);}

function pr(x){return Math.round(x-state.cameraX);}
function rect(x,y,w,h,color){ctx.fillStyle=color;ctx.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h));}
function drawSky(camera=state.cameraX){rect(0,0,VIEW_W,VIEW_H,C.sky);rect(0,55,VIEW_W,125,C.dusk);rect(0,83,VIEW_W,97,C.dusk2);const sunX=255-camera*.08;rect(sunX,21,30,29,'#e8895b');rect(sunX+5,16,20,38,'#e8895b');rect(sunX+9,13,12,44,'#f3b45e');for(let i=0;i<15;i++){const x=((i*47-camera*.14)%390+390)%390-35;rect(x,33+i%3*17,25+i%4*8,3,i%2?'#443753':'#51405c');}for(let i=0;i<22;i++){const x=((i*83-camera*.25)%900+900)%900-20,y=42+(i*29)%100,pulse=((state.menuTime*3+i)%4)<1.8;rect(x,y,pulse?2:1,pulse?2:1,pulse?C.honeyLight:'#8f8756');}for(let x=-40;x<VIEW_W+50;x+=31){const wx=x-((camera*.38)%31);const top=92+((Math.floor((x+camera*.38)/31)*17)%28);rect(wx,top,4,88,C.greenDark);rect(wx-8,top+5,15,6,'#2a6544');rect(wx+1,top-6,13,6,'#34734b');}rect(0,143,VIEW_W,37,'#183c35');}
function flower(wx,y,color,layer=1){const x=Math.round(wx-state.cameraX*layer);rect(x,y,2,180-y,C.green);rect(x-6,y+8,7,3,C.greenLight);rect(x+1,y+15,7,3,C.greenLight);rect(x-5,y-5,5,5,color);rect(x+2,y-5,5,5,color);rect(x-2,y-8,5,5,color);rect(x-2,y+1,5,5,color);rect(x-1,y-3,3,3,C.honey);}
function drawWorld(){for(let x=30;x<world.bounds.width;x+=73)flower(x,125+(x*7)%29,x%2?C.purple:'#df735d',.72);for(const c of world.covers){const x=pr(c.x);if(x>VIEW_W+40||x+c.w<-40)continue;if(c.type==='stone'){rect(x+3,c.y,c.w-6,3,C.stoneLight);rect(x,c.y+3,c.w,c.h-6,C.stone);rect(x+4,c.y+c.h-3,c.w-7,3,'#3c425a');rect(x+5,c.y+5,4,3,'#aaa1ae');}else{rect(x+7,c.y,4,c.h,'#2c6342');for(let y=c.y+3;y<c.y+c.h-4;y+=11){rect(x,y,9,7,C.green);rect(x+9,y+4,9,7,C.greenLight);rect(x+3,y+2,4,2,'#9ac96b');}}}for(let x=15;x<world.bounds.width;x+=29){const sx=pr(x);if(sx>-10&&sx<VIEW_W+10){rect(sx,150+(x%11),2,30,C.greenDark);rect(sx-3,151+(x%11),5,3,C.green);}}}
function drawHazards(){ctx.save();ctx.lineCap='butt';let coverLabeled=false,hotLabeled=false;for(const s of state.snipers){const sx=pr(s.x),tx=pr(s.lockX);ctx.beginPath();ctx.moveTo(sx,s.y);ctx.lineTo(tx,s.lockY);ctx.setLineDash(s.state==='track'?[2,4]:s.state==='warning'?[4,2]:[]);ctx.lineWidth=s.state==='hot'?3:1;ctx.strokeStyle=s.blocked?'#75b884cc':s.state==='hot'?C.danger:s.state==='warning'?C.warning:'#f5f1dc55';if(s.state==='hot'&&!s.blocked){ctx.strokeStyle=C.ink;ctx.lineWidth=5;ctx.stroke();ctx.beginPath();ctx.moveTo(sx,s.y);ctx.lineTo(tx,s.lockY);ctx.strokeStyle=C.danger;ctx.lineWidth=3;}ctx.stroke();if(s.state==='hot'&&s.blocked&&!coverLabeled){pixelText('COVER',tx,s.lockY-15,C.greenLight,1,'center');coverLabeled=true;}if(s.state==='hot'&&!s.blocked&&!hotLabeled){pixelText('HOT',tx,s.lockY-15-(coverLabeled?7:0),C.cream,1,'center');hotLabeled=true;}}ctx.restore();}
function drawActors(){for(const p of state.pollen){if(p.collected)continue;const x=pr(p.x),y=p.y+Math.sin(state.time*5+p.x)*1.5;if(x>-10&&x<VIEW_W+10){rect(x-4,y-1,9,3,'#8d6a38');rect(x-1,y-4,3,9,'#8d6a38');rect(x-3,y,7,1,C.honeyLight);rect(x,y-3,1,7,C.honeyLight);rect(x-1,y-1,3,3,C.white);}}const hx=pr(world.hive.x),hy=world.hive.y,open=state.score===5;if(hx>-30&&hx<VIEW_W+30){rect(hx-12,hy-13,20,4,'#c26536');rect(hx-15,hy-9,26,5,C.honey);rect(hx-17,hy-4,30,6,'#d98932');rect(hx-15,hy+2,26,6,C.honey);rect(hx-11,hy+8,18,5,'#c26536');rect(hx-4,hy+2,8,11,open?C.ink:'#6e3a34');}
  for(let i=0;i<state.snipers.length;i++){const s=state.snipers[i],x=pr(s.x);if(x<-30||x>VIEW_W+30)continue;const f=s.state==='hot'?2:s.state==='warning'?1:Math.floor(state.time*2+i)%4;ctx.drawImage(images.sniper,f*24,0,24,24,Math.round(x-12),Math.round(s.y-12),24,24);if(s.flash>0){rect(x+10,s.y-2,5,4,C.cream);rect(x+15,s.y-1,4,2,C.warning);}}
  if(!(state.player.invulnerable>0&&Math.floor(state.time*15)%2===0)){const f=Math.floor(state.time*15)%6,x=pr(state.player.x);ctx.save();ctx.translate(Math.round(x),Math.round(state.player.y));ctx.scale(state.player.facing,1);if(state.player.dashTime>0){rect(-18,-1,11,2,'#b9f0f5aa');rect(-14,3,8,1,'#fff0a899');}ctx.drawImage(images.bee,f*16,0,16,16,-8,-8,16,16);ctx.restore();}}
function drawFx(){for(const p of state.particles){const x=pr(p.x);rect(x,p.y,p.life>.25?2:1,p.life>.25?2:1,p.color);}for(const s of state.shots){ctx.strokeStyle=s.blocked?C.greenLight:C.white;ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(pr(s.x1),s.y1);ctx.lineTo(pr(s.x2),s.y2);ctx.stroke();}}
function drawUI(){rect(0,0,VIEW_W,17,'#181425ee');pixelText(`LIVES ${state.lives}`,5,6,C.cream);pixelText(`POLLEN ${state.score}/5`,65,6,C.cream);rect(145,6,42,5,'#403e59');rect(146,7,Math.floor(40*state.player.dash),3,state.player.dash>=1?C.honeyLight:'#8bc0a6');pixelText('DASH',192,6,C.cream);pixelText(state.score===5?'HIVE OPEN >':'GATHER POLLEN',315,6,state.score===5?C.honeyLight:'#aaa5bd',1,'right');if(state.time<state.messageUntil){const w=state.message.length*4+8;rect(160-w/2,23,w,11,'#181425ee');pixelText(state.message,160,26,state.message.includes('STUNG')?C.danger:C.cream,1,'center');}}
function drawMenu(){drawSky(state.menuTime*8);for(const p of state.particles)rect((p.x%VIEW_W+VIEW_W)%VIEW_W,p.y,p.life>.25?2:1,p.life>.25?2:1,p.color);rect(37,25,246,132,'#181425dd');rect(40,28,240,126,'#2a2744dd');rect(44,32,232,118,'#18142599');pixelText('BUMBLE',160,42,C.honeyLight,4,'center');pixelText('BEEZ',160,66,C.cream,4,'center');ctx.drawImage(images.bee,0,0,16,16,64,47,48,48);ctx.drawImage(images.sniper,24,0,24,24,218,51,48,48);pixelText('HOT GARDEN',160,88,C.greenLight,1,'center');const labels=['FLY THE FIELD','FIELD GUIDE',`FLASH ${state.reducedFlash?'LOW':'FULL'}`];labels.forEach((label,i)=>{const y=100+i*16;if(i===state.menuIndex){rect(91,y-4,138,13,C.honey);pixelText('>',97,y,C.ink);pixelText(label,160,y,C.ink,1,'center');}else{rect(91,y-4,138,13,'#35314f');pixelText(label,160,y,C.cream,1,'center');}});pixelText('ARROWS + ENTER',160,151,'#aaa5bd',1,'center');if(state.screen==='guide'){rect(55,37,210,108,'#181425f5');pixelText('FIELD GUIDE',160,47,C.honeyLight,2,'center');pixelText('COLLECT 5 POLLEN',73,75,C.cream);pixelText('BREAK RED SIGHT',73,89,C.warning);pixelText('LEAVES GIVE COVER',73,103,C.greenLight);pixelText('SPACE TO DASH',73,117,C.blue);pixelText('ESC TO RETURN',160,135,'#aaa5bd',1,'center');}}
function drawOverlay(title,subtitle){rect(55,50,210,80,'#181425ee');rect(60,55,200,70,'#2a2744ee');pixelText(title,160,68,title==='PAUSED'?C.cream:C.honeyLight,3,'center');pixelText(subtitle,160,101,'#aaa5bd',1,'center');}
function render(){ctx.setTransform(SCALE,0,0,SCALE,0,0);const sx=state.shake>0?Math.round(Math.sin(state.time*90)*2):0,sy=state.shake>0?Math.round(Math.cos(state.time*70)):0;ctx.save();ctx.translate(sx,sy);if(state.mode==='menu')drawMenu();else{drawSky();drawHazards();drawWorld();drawActors();drawFx();drawUI();if(state.mode==='paused')drawOverlay('PAUSED','ENTER TO RESUME - Q FOR MENU');if(state.mode==='won')drawOverlay('HIVE SAFE','ENTER TO FLY AGAIN');if(state.mode==='lost')drawOverlay('FIELD LOST','ENTER TO RETRY');}ctx.restore();ctx.setTransform(1,0,0,1,0,0);}

let last=performance.now();function loop(now){const dt=Math.min(.05,(now-last)/1000);last=now;update(dt);render();window.__BUMBLE_STATE__={mode:state.mode,screen:state.screen,time:Number(state.time.toFixed(3)),score:state.score,lives:state.lives,cameraX:Number(state.cameraX.toFixed(2)),player:{x:Number(state.player.x.toFixed(2)),y:Number(state.player.y.toFixed(2))},hazards:state.snipers.map(s=>({id:s.id,state:s.state,blocked:s.blocked}))};requestAnimationFrame(loop);}requestAnimationFrame(loop);canvas.focus();statusNode.textContent='Bumble Beez ready';
