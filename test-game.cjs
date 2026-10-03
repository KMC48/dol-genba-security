const fs=require('fs');
const vm=require('vm');
const assert=require('assert');
const createCanvas=()=>({getContext:()=>new Proxy({}, {get:()=>()=>{}})});
const loadImage=async()=>({complete:true,naturalWidth:1254,width:1254,height:1254});
const images=[];
const base=__dirname+'/';
const canvas=createCanvas(640,720),preview=createCanvas(640,430);
class El{constructor(id){this.id=id;this.style={};this.dataset={};this.textContent='';this.innerHTML='';this.open=false;this.disabled=false;this.listeners={};this.classList={add(){},remove(){},toggle(){}};this.parentElement=this;this.child=null}addEventListener(k,f){this.listeners[k]=f}setAttribute(){}querySelector(){return this.child??=new El('child')}insertAdjacentHTML(){}showModal(){this.open=true}close(){const was=this.open;this.open=false;if(was&&this.listeners.close)this.listeners.close()}focus(){}getBoundingClientRect(){return{x:0,y:0,left:0,top:0,width:640,height:720}}}
const els={};const getEl=id=>els[id]??=new El(id);getEl('game').getContext=()=>canvas.getContext('2d');getEl('preview').getContext=()=>preview.getContext('2d');
const registry={};const storage={};
const context={console,Math,Number,JSON,Error,Promise,AbortController,performance:{now:()=>0},Image:function(){return images.shift()},document:{getElementById:getEl,querySelectorAll:()=>[],addEventListener(){},body:new El('body'),modelContext:{registerTool(t){registry[t.name]=t}}},window:{matchMedia:()=>({matches:false}),scrollTo(){},addEventListener(){}},localStorage:{getItem:k=>storage[k]??null,setItem:(k,v)=>storage[k]=v},requestAnimationFrame(){}};
(async()=>{
for(const p of ['characters.png','venues.png','security-sprites.png','blond-fans.png','black-shirt-fan.png','black-shirt-throw.png','black-shirt-mosh.png','black-shirt-invasion.png']){const im=await loadImage(base+p);Object.defineProperty(im,'src',{set(){}});images.push(im)}
vm.createContext(context);
vm.runInContext(fs.readFileSync(base+'game.js','utf8')+'\nglobalThis.test={startGame,resetGame,beginPlay,update,chooseFan,eject,special,pause,resume,goMenu,spawnFan,drawGame,drawPreview,moshPose,spawnScheduledFans,frontRowY,stageY,idolPose,idolPresence,missConnection,missFan,evaluateRank,finish,getState:()=>state,getMode:()=>mode,setConfig:(v,g)=>{chosenVenue=v;chosenGroup=g},setReady:()=>assetReady=true,venues:VENUES,groups:GROUPS};',context);

const t=context.test;t.setReady();
assert.equal(Object.keys(registry).length,2);
assert.equal(registry.configure_mission.execute({venue:2,lineup:1}).venue,'ドーム公演');
assert.throws(()=>registry.configure_mission.execute({venue:4,lineup:1}));
assert.equal(registry.get_mission_status.execute().venue,2);
t.startGame();assert.equal(t.getMode(),'countdown');assert.throws(()=>registry.configure_mission.execute({venue:1,lineup:1}));
for(let i=0;i<66;i++)t.update(.05);assert.equal(t.getMode(),'playing');
let s=t.getState();const target=s.fans.find(f=>!f.normal);t.chooseFan(target);for(let i=0;i<30;i++)t.update(.05);assert(s.count>=1,'tap queues and moves guard to eject');
const good=s.fans.find(f=>f.normal);s.score=500;const combo=s.combo;t.chooseFan(good);assert.equal(s.score,350);assert.equal(s.mistakes,1);assert.equal(s.combo,0);
t.pause();const elapsed=s.elapsed;t.update(2);assert.equal(s.elapsed,elapsed);t.resume();assert.equal(t.getMode(),'playing');
s.charge=100;for(let i=0;i<4;i++)t.spawnFan(false);const before=s.count,targets=s.fans.filter(f=>!f.normal&&f.status==='active').reduce((n,f)=>n+(f.type===1?2:1),0),normals=s.fans.filter(f=>f.normal).length;t.special();assert.equal(s.count,before+targets);assert.equal(s.charge,0);assert.equal(s.fans.filter(f=>f.normal&&f.status==='active').length,normals);
for(let i=0;i<1200&&t.getMode()==='playing';i++)t.update(.05);assert.equal(t.getMode(),'result');assert.equal(s.remaining,0);assert(getEl('resultDialog').open);assert(storage['nexus-genba-records-v1']);
t.startGame();assert.equal(t.getState().count,0);assert.equal(t.getState().remaining,60);t.goMenu();assert.equal(t.getMode(),'menu');
const runs=[];
for(let venue=0;venue<4;venue++){for(let group=0;group<4;group++){
 t.setConfig(venue,group);t.resetGame();t.beginPlay();s=t.getState();let maxLive=0;const rareIds=new Set();
 for(let i=0;i<1220&&t.getMode()==='playing';i++){for(const f of s.fans)if(!f.normal&&f.status==='active')t.chooseFan(f);if(s.charge>=100)t.special();t.update(.05);s.fans.filter(f=>!f.normal&&f.type===6).forEach(f=>rareIds.add(f.id));maxLive=Math.max(maxLive,s.fans.filter(f=>!f.normal&&f.status==='active').length)}
 assert.equal(t.getMode(),'result');assert.equal(rareIds.size,1,'exactly one rare per mission');assert.equal(s.breakdown[6],1);assert(s.rarePoints>=1000&&s.rarePoints<=3000);assert(s.breakdown[5]>0);assert(s.count>25);assert.equal(s.mistakes,0);assert.equal(s.missed,0);assert.equal(s.rank,'S','perfect play can earn S in all 16 missions');assert.equal(s.breakdown.reduce((a,b)=>a+b,0),s.count);assert(s.queue.length===0);runs.push({venue,group,ejected:s.count,score:s.score,missed:s.missed,maxLive});t.goMenu();
}}
// Targeted regression checks for collision, moving invaders and once-only rare lifecycle.
t.setConfig(0,0);t.resetGame();t.beginPlay();s=t.getState();s.fans=[];s.spawnClock=100;
const m=t.spawnFan(false,1);m.x=240;m.y=460;m.phase=0;
assert(t.moshPose(m,0).gap>t.moshPose(m,.35).gap,'participants approach actual body contact');assert(t.moshPose(m,.35).impact);assert(t.moshPose(m,.7).gap>t.moshPose(m,.35).gap,'participants recoil');
getEl('game').listeners.pointerdown({clientX:m.x+65,clientY:m.y-40,preventDefault(){}});assert(s.queue.includes(m.id),'either mosh participant is tappable');
for(let i=0;i<25;i++)t.update(.05);assert.equal(s.count,2);assert.equal(s.breakdown[1],2);assert.equal(s.score,210);assert.equal(s.charge,25);
const runner=t.spawnFan(false,5),fromY=runner.y;t.update(1);assert(runner.y<fromY,'invader runs toward stage');t.chooseFan(runner);for(let i=0;i<30;i++)t.update(.05);assert.equal(s.breakdown[5],1,'moving target can be intercepted');
const rare=t.spawnFan(false,6);assert(rare);assert.equal(t.spawnFan(false,6),null);s.combo=0;s.lastEject=-100;const scoreBefore=s.score;t.eject(rare);assert.equal(s.score-scoreBefore,1000);assert.equal(s.rarePoints,1000);s.elapsed=35;t.spawnScheduledFans();assert.equal(s.fans.filter(f=>f.type===6).length,1,'no respawn after capture');
t.resetGame();t.beginPlay();s=t.getState();s.fans=[];s.spawnClock=100;
const r=t.spawnFan(false,6);s.combo=20;s.lastEject=s.elapsed;t.eject(r);assert.equal(s.rarePoints,3000,'rare receives maximum combo bonus');
// Even a saturated arena must still emit its one reserved rare target, then never repeat after escape.
t.resetGame();t.beginPlay();s=t.getState();s.fans=[];while(t.spawnFan(true)){};s.elapsed=37;t.spawnScheduledFans();assert(s.rareSpawned);assert.equal(s.fans.filter(f=>f.type===6&&!f.normal).length,1);const rare2=s.fans.find(f=>f.type===6&&!f.normal);rare2.age=rare2.life;t.update(.05);assert.equal(rare2.status,'gone');s.elapsed=49;t.spawnScheduledFans();assert.equal(s.fans.filter(f=>f.type===6&&!f.normal).length,0,'escaped rare does not respawn');
t.resetGame();t.beginPlay();s=t.getState();assert.equal(s.rareSpawned,false,'retry resets rare schedule');
// A missed connection removes only its idol and deducts exactly 1,000 once.
t.setConfig(0,0);t.resetGame();t.beginPlay();s=t.getState();s.fans=[];s.spawnClock=100;
const escaped=t.spawnFan(false,6);assert.equal(escaped.life,4);assert(escaped.life<Math.min(...t.venues.map(v=>v.life)));s.score=200;t.update(3.95);assert.equal(s.rarePenalty,0);assert.equal(escaped.status,'active');t.update(.1);
assert.equal(s.score,-800);assert.equal(s.rarePenalty,1000);assert.equal(s.idolDeparture.index,2);assert.equal(s.missed,1);
assert.equal(getEl('score').textContent,'−00800','negative HUD sign precedes zero padding');
t.missConnection();assert.equal(s.score,-800,'departure penalty applies only once');
t.pause();const departureTime=s.elapsed;t.update(2);assert.equal(s.elapsed,departureTime);t.resume();
t.update(1.7);assert(!t.idolPresence(2).visible);assert.equal([0,1,2,3,4].filter(i=>t.idolPresence(i).visible).length,4);
const ordinary=t.spawnFan(true);t.chooseFan(ordinary);assert.equal(s.score,-950,'misidentification cannot increase a negative score');
t.finish();assert(getEl('resultRare').textContent.includes('1人脱退'));assert(getEl('resultRare').textContent.includes('1,000'));assert.equal(getEl('resultScore').textContent,'-950');
t.resetGame();t.beginPlay();s=t.getState();s.fans=[];s.spawnClock=100;assert.equal(s.idolDeparture,null);assert.equal(s.rarePenalty,0);assert([0,1,2,3,4].every(i=>t.idolPresence(i).visible));
const captured=t.spawnFan(false,6);t.eject(captured,true);t.update(11);assert.equal(s.idolDeparture,null);assert.equal(s.rarePenalty,0);assert.equal(s.rarePoints,1000,'special capture protects the idol');
// Ordinary missed offenses do not remove an idol or apply the connection penalty.
t.resetGame();t.beginPlay();s=t.getState();s.fans=[];s.spawnClock=100;const ordinaryMiss=t.spawnFan(false,4);ordinaryMiss.age=ordinaryMiss.life;t.update(.05);assert.equal(s.rarePenalty,0);assert.equal(s.idolDeparture,null);
// Front-row occupancy must never fall back to a rear-row slot, in any venue.
for(let v=0;v<4;v++){
 t.setConfig(v,3);t.resetGame();s=t.getState();s.fans=[];
 for(let i=0;i<4;i++){const f=t.spawnFan(false,4);assert(f&&f.slot<4);assert(Math.abs(f.y-t.frontRowY())<=3)}
 assert.equal(t.spawnFan(false,4),null,'full front row defers spawn, even with empty rear rows');
 const freedSlot=s.fans[1].slot;s.fans[1].status='gone';const replacement=t.spawnFan(false,4);assert.equal(replacement.slot,freedSlot);
 const pose=t.idolPose(v);assert.equal(pose.y,t.stageY(v));assert(pose.height>43);assert(pose.y<t.frontRowY(v)-84,'idols remain on stage above the audience');
}
t.setConfig(0,0);t.resetGame();t.beginPlay();s=t.getState();
// Rank boundary cases and result-image mapping, independent of venue spawn volume.
const rankCases=[
 [1,0,0,false,'S'],[89,1,0,false,'A'],[90,10,2,false,'A'],[89,11,0,false,'B'],
 [90,10,3,false,'B'],[100,0,1,false,'A'],[90,10,0,true,'B'],
 [70,30,5,false,'B'],[69,31,0,false,'C'],[80,20,6,false,'C'],
 [40,60,9,false,'C'],[39,61,0,false,'D'],[100,0,10,false,'D'],[0,0,0,false,'D']
];
for(const [count,missed,mistakes,idolDeparture,rank] of rankCases){
 assert.equal(t.evaluateRank({count,missed,mistakes,idolDeparture}).rank,rank);
 t.resetGame();t.beginPlay();s=t.getState();Object.assign(s,{fans:[],count,missed,mistakes,idolDeparture});t.finish();
 assert.equal(getEl('rank').textContent,rank);assert.equal(getEl('resultImage').src,`rank-${rank.toLowerCase()}.png`);assert(getEl('resultImage').alt.length>0);
}
// Final unresolved targets count as misses, including two mosh participants and the rare penalty.
t.resetGame();t.beginPlay();s=t.getState();s.fans=[];s.count=100;
t.spawnFan(false,1);t.spawnFan(false,6);t.finish();assert.equal(s.missed,3);assert.equal(s.rarePenalty,1000);assert.equal(s.rank,'B');
t.finish();assert.equal(s.missed,3);assert.equal(s.rarePenalty,1000,'finish is idempotent');
// No target is spawned without its full response window; the exact boundary remains playable.
for(let v=0;v<4;v++){
 t.setConfig(v,0);t.resetGame();t.beginPlay();s=t.getState();s.fans=[];
 for(const type of [0,1,2,3,4,5,6]){
  s.rareSpawned=false;const life=type===6?4:type===5?7:t.venues[v].life;
  s.remaining=life+.49;assert.equal(t.spawnFan(false,type),null);
  s.remaining=life+.5;const f=t.spawnFan(false,type);assert(f);assert.equal(f.life,life);s.fans=[];
 }
}
// Additional black T-shirt appearance coexists with every eligible original; blond roles and good fans stay distinct.
t.setConfig(0,0);t.resetGame();t.beginPlay();s=t.getState();
for(const type of [0,1,2,3,4,5,6]){
 const appearances=new Set();
 for(let i=0;i<120;i++){s.fans=[];s.rareSpawned=false;appearances.add(t.spawnFan(false,type).sprite)}
 if(type===4||type===6){assert.equal(appearances.size,1);assert(appearances.has(type===4?8:9))}
 else {assert(appearances.has(({1:12,3:11,5:13}[type]??10)));assert.equal(appearances.size,2,'original and new fan both remain')}
}
s.fans=[];for(let i=0;i<8;i++){const f=t.spawnFan(true);assert(f.sprite===2||f.sprite===3)}
t.resetGame();t.beginPlay();s=t.getState();
// Render actual gameplay code at contact and approach phases.
s.fans=[];s.spawnClock=100;const mm=t.spawnFan(false,1);mm.x=170;mm.y=475;mm.phase=0;const rr=t.spawnFan(false,6);const vv=t.spawnFan(false,5);vv.x=490;vv.y=345;
s.anim=.35;t.drawGame();
s.anim=0;t.drawGame();
console.log(JSON.stringify({checks:'PASS',missions:runs,note:'Logic checks only; not browser or native-device validation'},null,2));

})().catch(e=>{console.error(e);process.exit(1)});
