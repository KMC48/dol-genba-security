// Pre-play video ad: 2nd and later plays per app launch, native app only, never blocks play.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'index.html'),'utf8');
const source=fs.readFileSync(path.join(__dirname,'game.js'),'utf8');
function load(Capacitor,{patch=s=>s}={}){
 const ids=new Set([...html.matchAll(/id="([^"]+)"/g)].map(m=>m[1])),els=new Map();
 const element=()=>({textContent:'',value:'',hidden:false,disabled:false,dataset:{},style:{},classList:{add(){},remove(){},toggle(){}},setAttribute(){},addEventListener(){},querySelector(){return null},insertAdjacentHTML(){},focus(){},select(){},showModal(){this.open=true},close(){this.open=false},getContext(){return new Proxy({},{get:()=>()=>{}})}});
 const el=id=>{assert(ids.has(id),`actual HTML contains #${id}`);if(!els.has(id)){const node=element();node.parentElement=node;node.querySelector=()=>node;els.set(id,node)}return els.get(id)};
 // The safety timer is never fired here: the gate must finish through the plugin's own answer.
 const sandbox=vm.createContext({console,URLSearchParams,setTimeout:()=>0,window:{navigator:{},Capacitor,matchMedia:()=>({matches:false}),scrollTo(){},addEventListener(){}},document:{getElementById:el,querySelectorAll:()=>[],addEventListener(){},body:element()},Image:class{constructor(){this.complete=true;this.naturalWidth=1536}},localStorage:{getItem(){return null},setItem(){}},performance:{now:()=>0},requestAnimationFrame(){}});
 vm.runInContext(patch(source)+'\nglobalThis.qa={startGame,goMenu,setReady:()=>assetReady=true,getMode:()=>mode,setMode:v=>mode=v};',sandbox);
 sandbox.qa.setReady();return {qa:sandbox.qa,el};
}
const flush=()=>new Promise(r=>setImmediate(r));
function nativeWith(showInterstitial){const calls=[];return {calls,cap:{isNativePlatform:()=>true,Plugins:{UnityAdsBridge:{showInterstitial:()=>{calls.push(1);return showInterstitial()}}}}}}

test('web (no Capacitor): every play starts immediately, no ad',()=>{
 const {qa}=load(undefined);
 qa.startGame();assert.equal(qa.getMode(),'countdown');qa.goMenu();
 qa.startGame();assert.equal(qa.getMode(),'countdown','2nd play starts synchronously on the web');
});
test('native: 1st play is free, 2nd waits for the ad, then starts',async()=>{
 let finishAd;const {calls,cap}=nativeWith(()=>new Promise(r=>finishAd=r));const {qa,el}=load(cap);
 qa.startGame();assert.equal(calls.length,0,'no ad before the first play');assert.equal(qa.getMode(),'countdown');
 qa.goMenu();qa.startGame();await flush();
 assert.equal(calls.length,1,'ad requested before the second play');assert.equal(qa.getMode(),'menu','play waits while the ad shows');
 assert.equal(el('startBtn').disabled,true);assert.equal(el('retryBtn').disabled,true);
 qa.startGame();await flush();assert.equal(calls.length,1,'double tap during the ad does not stack ads');
 finishAd({shown:true,reason:'completed'});await flush();
 assert.equal(qa.getMode(),'countdown','play starts after the ad');assert.equal(el('startBtn').disabled,false);
 qa.goMenu();qa.startGame();await flush();assert.equal(calls.length,2,'third play also shows the ad');
});
test('native: a not-ready or failed ad never blocks play',async()=>{
 for(const answer of [()=>Promise.resolve({shown:false,reason:'not_ready'}),()=>Promise.reject(new Error('bridge')),()=>{throw new Error('sync')}]){
  const {cap}=nativeWith(answer);const {qa,el}=load(cap);
  qa.startGame();qa.goMenu();qa.startGame();await flush();
  assert.equal(qa.getMode(),'countdown');assert.equal(el('startBtn').disabled,false);
 }
});
test('native: leaving the screen during the ad does not start a play behind it',async()=>{
 let finishAd;const {cap}=nativeWith(()=>new Promise(r=>finishAd=r));const {qa}=load(cap);
 qa.startGame();qa.goMenu();qa.startGame();await flush();
 qa.setMode('title');finishAd({shown:true});await flush();
 assert.equal(qa.getMode(),'title');
});
test('iOS (native, plugin not available): no ad, original behavior',async()=>{
 const {calls,cap}=nativeWith(()=>Promise.resolve({shown:true}));cap.isPluginAvailable=()=>false;const {qa}=load(cap);
 qa.startGame();qa.goMenu();qa.startGame();await flush();
 assert.equal(calls.length,0);assert.equal(qa.getMode(),'countdown');
});
test('switch off restores the original no-ad behavior',async()=>{
 const {calls,cap}=nativeWith(()=>Promise.resolve({shown:true}));
 const {qa}=load(cap,{patch:s=>s.replace('PRE_PLAY_AD_ENABLED=true','PRE_PLAY_AD_ENABLED=false')});
 qa.startGame();qa.goMenu();qa.startGame();await flush();
 assert.equal(calls.length,0);assert.equal(qa.getMode(),'countdown');
});
