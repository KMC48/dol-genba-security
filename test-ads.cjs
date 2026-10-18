// Interstitial ad schedule: real game.js with a small DOM, storage and AdMob plugin double.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'index.html'),'utf8');
const source=fs.readFileSync(path.join(__dirname,'game.js'),'utf8');
const PLAY_KEY='dolgenba-completed-plays-v1';
const flush=()=>new Promise(r=>setImmediate(r));

function fakeAdMob({tracking='authorized',loadFails=false,showFails=false}={}){
 const calls=[],listeners={};
 const plugin={calls,listeners,
  async requestTrackingAuthorization(){calls.push('att')},
  async trackingAuthorizationStatus(){return {status:tracking}},
  async initialize(o){calls.push(['init',o])},
  async prepareInterstitial(o){calls.push(['prepare',o]);if(loadFails)throw new Error('no fill');return {adUnitId:o.adId}},
  async showInterstitial(){calls.push('show');if(showFails){(listeners.interstitialAdFailedToShow||[]).forEach(f=>f({code:1}));return}},
  async addListener(name,fn){(listeners[name]??=[]).push(fn);return {remove(){listeners[name]=listeners[name].filter(f=>f!==fn)}}},
  dismiss(){(listeners.interstitialAdDismissed||[]).slice().forEach(f=>f())},
 };
 return plugin;
}
function load({native=true,platform='ios',admob=fakeAdMob(),storage=new Map()}={}){
 const ids=new Set([...html.matchAll(/id="([^"]+)"/g)].map(m=>m[1])),els=new Map();
 const element=()=>({textContent:'',value:'',hidden:false,disabled:false,dataset:{},style:{},classList:{add(){},remove(){},toggle(){},contains(){return false}},setAttribute(){},addEventListener(){},querySelector(){return null},insertAdjacentHTML(){},focus(){},select(){},showModal(){this.open=true},close(){this.open=false},getContext(){return new Proxy({},{get:()=>()=>{}})}});
 const el=id=>{assert(ids.has(id),`actual HTML contains #${id}`);if(!els.has(id)){const node=element();node.parentElement=node;node.querySelector=()=>node;els.set(id,node)}return els.get(id)};
 const writes=[];
 const Capacitor=native?{isNativePlatform:()=>true,getPlatform:()=>platform,Plugins:{AdMob:admob,Share:{share:async()=>{}}}}:undefined;
 const sandbox=vm.createContext({console,URLSearchParams,setImmediate,window:{navigator:{},Capacitor,matchMedia:()=>({matches:false}),scrollTo(){},addEventListener(){}},document:{getElementById:el,querySelectorAll:()=>[],addEventListener(){},body:element()},Image:class{constructor(){this.complete=true;this.naturalWidth=1536}},localStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>{writes.push(k);storage.set(k,v)}},performance:{now:()=>0},requestAnimationFrame(){}});
 vm.runInContext(source+'\nglobalThis.qa={resetGame,beginPlay,finish,shareResult,leaveResult,adDueAfterPlay,getMode:()=>mode,getState:()=>state};',sandbox);
 const qa=sandbox.qa;
 // One finished mission, ending on the result screen.
 const play=()=>{qa.resetGame();qa.beginPlay();Object.assign(qa.getState(),{fans:[],count:40,score:12000,missed:0,mistakes:0});qa.finish();assert.equal(qa.getMode(),'result')};
 return {qa,el,admob,storage,writes,play};
}
const shows=a=>a.calls.filter(c=>c==='show').length;
const prepares=a=>a.calls.filter(c=>Array.isArray(c)&&c[0]==='prepare');

test('schedule: first 3 missions ad-free, then one ad every 3 missions',()=>{
 const {qa}=load();
 const due=[...Array(15)].map((_,i)=>i+1).filter(n=>qa.adDueAfterPlay(n));
 assert.deepEqual([...due],[6,9,12,15]);
});

test('web version never asks for tracking, never loads ads and writes no play counter',async()=>{
 const g=load({native:false});
 for(let i=0;i<9;i++){g.play();await g.qa.leaveResult(()=>{});}
 assert.equal(g.admob.calls.length,0);assert(!g.writes.includes(PLAY_KEY));
});

test('tracking is asked once after the 3rd result; ads appear only when leaving the 6th and 9th results',async()=>{
 const g=load();let left=0;const leave=async()=>{const p=g.qa.leaveResult(()=>left++);await flush();if(g.admob.calls.at(-1)==='show')g.admob.dismiss();await p};
 for(let n=1;n<=2;n++){g.play();await leave();}
 assert.equal(g.admob.calls.length,0,'no SDK or tracking prompt during the first two missions');
 g.play();await leave();
 assert.equal(g.admob.calls.filter(c=>c==='att').length,1);assert.equal(shows(g.admob),0);
 for(let n=4;n<=5;n++){g.play();await leave();}
 assert.equal(shows(g.admob),0);assert(prepares(g.admob).length>=1,'ad is loaded one mission ahead');
 g.play();await flush();
 assert.equal(shows(g.admob),0,'finishing the 6th mission does not cover the result');
 await g.qa.shareResult();assert.equal(shows(g.admob),0,'sharing never triggers an ad');
 await leave();assert.equal(shows(g.admob),1);
 for(let n=7;n<=8;n++){g.play();await leave();}
 assert.equal(shows(g.admob),1);
 g.play();await leave();assert.equal(shows(g.admob),2);
 assert.equal(left,9,'every leave action still ran');
 assert.equal(g.admob.calls.filter(c=>c==='att').length,1,'tracking prompt is not repeated');
 assert.equal(g.storage.get(PLAY_KEY),'9');
});

test('the next action waits for the ad to be dismissed',async()=>{
 const storage=new Map([[PLAY_KEY,'5']]);const g=load({storage});
 g.play();await g.qa.leaveResult(()=>{});         // 6th: SDK was not started in this session yet
 for(let n=7;n<=9;n++){g.play();await flush()}     // 7th..9th, loading in between
 let left=false;const p=g.qa.leaveResult(()=>{left=true});await flush();
 assert.equal(g.admob.calls.at(-1),'show');assert.equal(left,false,'menu/retry stays behind the ad');
 g.admob.dismiss();await p;assert.equal(left,true);
});

test('ads never block play: no fill, show failure and double taps',async()=>{
 const noFill=load({storage:new Map([[PLAY_KEY,'2']]),admob:fakeAdMob({loadFails:true})});
 for(let n=3;n<=6;n++){noFill.play();await noFill.qa.leaveResult(()=>{});}
 assert.equal(shows(noFill.admob),0);
 const failing=load({storage:new Map([[PLAY_KEY,'2']]),admob:fakeAdMob({showFails:true})});let left=0;
 for(let n=3;n<=6;n++){failing.play();await failing.qa.leaveResult(()=>left++);}
 assert.equal(shows(failing.admob),1);assert.equal(left,4,'failed show still continues');
 const g=load({storage:new Map([[PLAY_KEY,'2']])});let runs=0;
 for(let n=3;n<=5;n++){g.play();await g.qa.leaveResult(()=>{});}
 g.play();const first=g.qa.leaveResult(()=>runs++);const second=g.qa.leaveResult(()=>runs++);await flush();g.admob.dismiss();await first;await second;
 assert.equal(runs,1,'second tap while the ad is open is ignored');assert.equal(shows(g.admob),1);
});

test('non-personalized ads when tracking is not authorized; Android uses its own unit',async()=>{
 const ios=load({storage:new Map([[PLAY_KEY,'2']]),admob:fakeAdMob({tracking:'denied'})});
 for(let n=3;n<=5;n++){ios.play();await ios.qa.leaveResult(()=>{});}
 const opts=prepares(ios.admob)[0][1];assert.equal(opts.npa,true);assert.match(opts.adId,/^ca-app-pub-\d+\/\d+$/);
 const android=load({platform:'android',storage:new Map([[PLAY_KEY,'2']])});
 for(let n=3;n<=5;n++){android.play();await android.qa.leaveResult(()=>{});}
 assert.notEqual(prepares(android.admob)[0][1].adId,opts.adId);
});

test('players who removed ads get no tracking prompt and no ads',async()=>{
 const g=load({storage:new Map([['dolgenba-ads-removed-v1','1'],[PLAY_KEY,'8']])});
 for(let n=0;n<6;n++){g.play();await g.qa.leaveResult(()=>{});}
 assert.equal(g.admob.calls.length,0);
});
