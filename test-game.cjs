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
for(const p of ['characters.png','venues.png']){const im=await loadImage(base+p);Object.defineProperty(im,'src',{set(){}});images.push(im)}
vm.createContext(context);
vm.runInContext(fs.readFileSync(base+'game.js','utf8')+'\nglobalThis.test={startGame,resetGame,beginPlay,update,chooseFan,eject,special,pause,resume,goMenu,spawnFan,drawGame,drawPreview,moshPose,spawnScheduledFans,getState:()=>state,getMode:()=>mode,setConfig:(v,g)=>{chosenVenue=v;chosenGroup=g},setReady:()=>assetReady=true,venues:VENUES,groups:GROUPS};',context);

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
 assert.equal(t.getMode(),'result');assert.equal(rareIds.size,1,'exactly one rare per mission');assert.equal(s.breakdown[6],1);assert(s.rarePoints>=1000&&s.rarePoints<=3000);assert(s.breakdown[5]>0);assert(s.count>25);assert.equal(s.mistakes,0);assert.equal(s.breakdown.reduce((a,b)=>a+b,0),s.count);assert(s.queue.length===0);runs.push({venue,group,ejected:s.count,score:s.score,missed:s.missed,maxLive});t.goMenu();
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
// Render actual gameplay code at contact and approach phases.
s.fans=[];s.spawnClock=100;const mm=t.spawnFan(false,1);mm.x=170;mm.y=475;mm.phase=0;const rr=t.spawnFan(false,6);const vv=t.spawnFan(false,5);vv.x=490;vv.y=345;
s.anim=.35;t.drawGame();
s.anim=0;t.drawGame();
console.log(JSON.stringify({checks:'PASS',missions:runs,note:'Logic checks only; not browser or native-device validation'},null,2));

})().catch(e=>{console.error(e);process.exit(1)});
