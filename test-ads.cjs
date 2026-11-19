// Pre-play video ad: plays 3, 6, 9… per app launch with ≥3 min between ads, native app only, never blocks play.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'index.html'),'utf8');
const source=fs.readFileSync(path.join(__dirname,'game.js'),'utf8');
function load(Capacitor,{patch=s=>s,expose=''}={}){
 const ids=new Set([...html.matchAll(/id="([^"]+)"/g)].map(m=>m[1])),els=new Map();
 const element=()=>({textContent:'',value:'',hidden:false,disabled:false,dataset:{},style:{},classList:{add(){},remove(){},toggle(){}},setAttribute(){},addEventListener(){},querySelector(){return null},insertAdjacentHTML(){},focus(){},select(){},showModal(){this.open=true},close(){this.open=false},getContext(){return new Proxy({},{get:()=>()=>{}})}});
 const el=id=>{assert(ids.has(id),`actual HTML contains #${id}`);if(!els.has(id)){const node=element();node.parentElement=node;node.querySelector=()=>node;els.set(id,node)}return els.get(id)};
 // Page visibility is controllable: setHidden(true/false) fires visibilitychange like the WebView does.
 const listeners=[],doc={hidden:false,getElementById:el,querySelectorAll:()=>[],body:element(),addEventListener(t,f){if(t==='visibilitychange')listeners.push(f)},removeEventListener(t,f){const i=listeners.indexOf(f);if(i>=0)listeners.splice(i,1)}};
 const setHidden=v=>{doc.hidden=v;for(const f of [...listeners])f()};
 // The safety timer is never fired here: the gate must finish through the plugin's own answer.
 const sandbox=vm.createContext({console,URLSearchParams,setTimeout:()=>0,window:{navigator:{},Capacitor,matchMedia:()=>({matches:false}),scrollTo(){},addEventListener(){}},document:doc,Image:class{constructor(){this.complete=true;this.naturalWidth=1536}},localStorage:{getItem(){return null},setItem(){}},performance:{now:()=>clock.now},clock:{now:0},requestAnimationFrame(){}});
 const clock=sandbox.clock;
 vm.runInContext(patch(source)+'\nglobalThis.qa={startGame,goMenu,setReady:()=>assetReady=true,getMode:()=>mode,setMode:v=>mode=v'+(expose?','+expose:'')+'};',sandbox);
 sandbox.qa.setReady();return {qa:sandbox.qa,el,sandbox,setHidden};
}
const flush=()=>new Promise(r=>setImmediate(r));
function nativeWith(showInterstitial){const calls=[];return {calls,cap:{isNativePlatform:()=>true,Plugins:{UnityAdsBridge:{showInterstitial:()=>{calls.push(1);return showInterstitial()}}}}}}

test('web (no Capacitor): every play starts immediately, no ad',()=>{
 const {qa}=load(undefined);
 qa.startGame();assert.equal(qa.getMode(),'countdown');qa.goMenu();
 qa.startGame();assert.equal(qa.getMode(),'countdown','2nd play starts synchronously on the web');
});
test('native: plays 1–2 are free, the 3rd waits for the ad, then starts',async()=>{
 let finishAd;const {calls,cap}=nativeWith(()=>new Promise(r=>finishAd=r));const {qa,el}=load(cap);
 qa.startGame();qa.goMenu();qa.startGame();await flush();assert.equal(calls.length,0,'no ad before the first two plays');assert.equal(qa.getMode(),'countdown');
 qa.goMenu();qa.startGame();await flush();
 assert.equal(calls.length,1,'ad requested before the third play');assert.equal(qa.getMode(),'menu','play waits while the ad shows');
 assert.equal(el('startBtn').disabled,true);assert.equal(el('retryBtn').disabled,true);
 qa.startGame();await flush();assert.equal(calls.length,1,'double tap during the ad does not stack ads');
 finishAd({shown:true,reason:'completed'});await flush();
 assert.equal(qa.getMode(),'countdown','play starts after the ad');assert.equal(el('startBtn').disabled,false);
});
test('native: after an ad, the next one waits 3 plays AND 3 minutes',async()=>{
 const {calls,cap}=nativeWith(()=>Promise.resolve({shown:true,reason:'completed'}));
 const {qa}=load(cap,{expose:'setNow:v=>clock.now=v'});
 const play=async()=>{qa.goMenu();qa.startGame();await flush()};
 qa.startGame();await play();qa.setNow(100000);await play();assert.equal(calls.length,1,'ad before play 3 (t=100 s)');
 qa.setNow(170000);await play();await play();assert.equal(calls.length,1,'plays 4–5 are free');
 qa.setNow(260000);await play();assert.equal(calls.length,1,'play 6 but only 160 s since the ad: skipped');
 await play();assert.equal(calls.length,1,'still under 3 min');
 qa.setNow(280000);await play();assert.equal(calls.length,2,'3+ plays and 180 s since the ad: shown');
 qa.setNow(900000);await play();assert.equal(calls.length,2,'long break alone is not enough, plays count too');
 await play();await play();assert.equal(calls.length,3);
});
test('native: an ad that was not shown does not count, the next play tries again',async()=>{
 const answers=[{shown:false,reason:'not_ready'},{shown:true,reason:'completed'}];
 const {calls,cap}=nativeWith(()=>Promise.resolve(answers.shift()));const {qa}=load(cap);
 qa.startGame();qa.goMenu();qa.startGame();qa.goMenu();qa.startGame();await flush();
 assert.equal(calls.length,1);assert.equal(qa.getMode(),'countdown','not-ready ad: play starts at once');
 qa.goMenu();qa.startGame();await flush();assert.equal(calls.length,2,'retried on the next play');
 qa.goMenu();qa.startGame();await flush();assert.equal(calls.length,2,'shown ad resets the interval');
});
test('native: a not-ready or failed ad never blocks play',async()=>{
 for(const answer of [()=>Promise.resolve({shown:false,reason:'not_ready'}),()=>Promise.reject(new Error('bridge')),()=>{throw new Error('sync')}]){
  const {cap}=nativeWith(answer);const {qa,el}=load(cap);
  qa.startGame();qa.goMenu();qa.startGame();qa.goMenu();qa.startGame();await flush();
  assert.equal(qa.getMode(),'countdown');assert.equal(el('startBtn').disabled,false);
 }
});
test('native: leaving the screen during the ad does not start a play behind it',async()=>{
 let finishAd;const {cap}=nativeWith(()=>new Promise(r=>finishAd=r));const {qa}=load(cap);
 qa.startGame();qa.goMenu();qa.startGame();qa.goMenu();qa.startGame();await flush();
 qa.setMode('title');finishAd({shown:true});await flush();
 assert.equal(qa.getMode(),'title');
});
test('native: time spent in the ad is not consumed by the first frame after it',async()=>{
 // Emulator QA 2026-11-14: the 60 s play ran out instantly after an 80 s ad (stale frame clock).
 let finishAd;const {cap}=nativeWith(()=>new Promise(r=>finishAd=r));
 const {qa,sandbox}=load(cap,{expose:'frame,getRemaining:()=>state.remaining,setNow:v=>clock.now=v'});
 qa.startGame();qa.goMenu();qa.startGame();qa.goMenu();qa.frame(1000);qa.startGame();await flush();
 qa.setNow(90000);finishAd({shown:true});await flush();
 assert.equal(qa.getMode(),'countdown');
 qa.frame(90016);
 assert.equal(qa.getMode(),'countdown','still counting down after one frame');
 assert.equal(qa.getRemaining(),60,'play time untouched');
});
test('native: the play waits until the app is visible again after the ad',async()=>{
 // Emulator QA 2026-11-14: the safety timeout fired while the end card was still open and the play ran behind it.
 let finishAd;const {cap}=nativeWith(()=>new Promise(r=>finishAd=r));const {qa,setHidden}=load(cap);
 qa.startGame();qa.goMenu();qa.startGame();qa.goMenu();qa.startGame();await flush();
 setHidden(true);finishAd({shown:true});await flush();
 assert.equal(qa.getMode(),'menu','not started while the page is hidden');
 setHidden(false);await flush();
 assert.equal(qa.getMode(),'countdown','starts once visible');
});
test('iOS (native, plugin not available): no ad, original behavior',async()=>{
 const {calls,cap}=nativeWith(()=>Promise.resolve({shown:true}));cap.isPluginAvailable=()=>false;const {qa}=load(cap);
 qa.startGame();qa.goMenu();qa.startGame();qa.goMenu();qa.startGame();await flush();
 assert.equal(calls.length,0);assert.equal(qa.getMode(),'countdown');
});
test('switch off restores the original no-ad behavior',async()=>{
 const {calls,cap}=nativeWith(()=>Promise.resolve({shown:true}));
 const {qa}=load(cap,{patch:s=>s.replace('PRE_PLAY_AD_ENABLED=true','PRE_PLAY_AD_ENABLED=false')});
 qa.startGame();qa.goMenu();qa.startGame();qa.goMenu();qa.startGame();await flush();
 assert.equal(calls.length,0);assert.equal(qa.getMode(),'countdown');
});
