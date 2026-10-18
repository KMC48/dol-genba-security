const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'index.html'),'utf8');
const source=fs.readFileSync(path.join(__dirname,'game.js'),'utf8');
function load(navigator={},Capacitor){
 const ids=new Set([...html.matchAll(/id="([^"]+)"/g)].map(m=>m[1])),els=new Map();
 const element=()=>({textContent:'',value:'',hidden:false,disabled:false,dataset:{},style:{},classList:{add(){},remove(){},toggle(){}},setAttribute(){},addEventListener(){},querySelector(){return null},insertAdjacentHTML(){},focus(){},select(){this.selected=true},showModal(){this.open=true},close(){this.open=false},getContext(){return new Proxy({},{get:()=>()=>{}})}});
 const el=id=>{assert(ids.has(id),`actual HTML contains #${id}`);if(!els.has(id)){const node=element();node.parentElement=node;node.querySelector=()=>node;els.set(id,node)}return els.get(id)};
 const sandbox=vm.createContext({console,URLSearchParams,window:{navigator,Capacitor,matchMedia:()=>({matches:false}),scrollTo(){},addEventListener(){}},document:{getElementById:el,querySelectorAll:()=>[],addEventListener(){},body:element()},Image:class{constructor(){this.complete=true;this.naturalWidth=1536}},localStorage:{getItem(){return null},setItem(){}},performance:{now:()=>0},requestAnimationFrame(){}});
 vm.runInContext(source+'\nglobalThis.qa={shareResult,copyResultText,resultShareData,resetGame,beginPlay,finish,goMenu,eject,spawnFan,getState:()=>state,setConfig:(v,g)=>{chosenVenue=v;chosenGroup=g}};',sandbox);
 const qa=sandbox.qa;
 const finish=(count=66,score=19800)=>{qa.resetGame();qa.beginPlay();Object.assign(qa.getState(),{fans:[],count,score,missed:0,mistakes:1});qa.finish()};
 finish();return {qa,el,finish,navigator};
}
test('share button is between the ejected count and roster, with pixel font and selectable fallback',()=>{
 assert.match(html,/id="resultCount"[\s\S]*id="shareResultBtn"[\s\S]*結果を報告\(シェア\)[\s\S]*class="result-roster"/);
 const css=fs.readFileSync(path.join(__dirname,'style.css'),'utf8');
 assert.match(css,/\.result-share-button\{[^}]*var\(--pixel\)/);
 assert.match(css,/\.share-fallback textarea\{[^}]*user-select:text/);
});
test('web share uses the displayed result and canonical URL; no automatic share on finish',async()=>{
 const calls=[];const {qa,el}=load({share:async d=>calls.push(d)});
 assert.equal(calls.length,0);await el('shareResultBtn').onclick();
 assert.equal(calls.length,1);assert.equal(calls[0].url,'https://kmc48.github.io/dol-genba-security/');
 assert.match(calls[0].text,/^厄介オタクを66人退場させた！/);assert.match(calls[0].text,/地下ライブハウス × 彗星ピクセルズ/);
 assert.match(calls[0].text,/A評価「頼れる現場リーダー」 \/ 19,800点/);assert.match(calls[0].text,/#ドル現場防衛戦/);
 assert(!calls[0].text.includes('undefined'));assert.equal(qa.getState().count,66);assert.equal(el('shareResultBtn').disabled,false);
});
test('native Share bridge takes precedence over browser APIs on iOS and Android',async()=>{
 for(const platform of ['ios','android']){
  const calls=[];const {qa}=load({share:()=>assert.fail('must use native')},{isNativePlatform:()=>true,getPlatform:()=>platform,Plugins:{Share:{share:async data=>calls.push(data)}}});
  await qa.shareResult();assert.equal(calls.length,1);assert.equal(calls[0].dialogTitle,'現場の結果を報告');assert.match(calls[0].text,/66人/);
 }
});
test('web and native cancellation do not copy, show error or alter the result',async()=>{
 for(const error of [Object.assign(new Error('Canceled'),{name:'AbortError'}),new Error('Share canceled')]){
  const {qa,el}=load({share:async()=>{throw error},clipboard:{writeText:()=>assert.fail('cancel must not copy')}});
  const before=JSON.stringify(qa.getState());await qa.shareResult();assert.equal(JSON.stringify(qa.getState()),before);
  assert.equal(el('shareStatus').textContent,'');assert.equal(el('shareFallback').hidden,true);assert.equal(el('shareResultBtn').disabled,false);
 }
});
test('unsupported sharing copies text and URL, including zero/negative/hidden-group results',async()=>{
 const texts=[];const h=load({share:()=>assert.fail('canShare=false'),canShare:()=>false,clipboard:{writeText:async t=>texts.push(t)}});
 h.qa.setConfig(3,4);h.finish(0,-1000);await h.qa.shareResult();
 assert.match(texts[0],/^厄介オタクを0人退場させた！/);assert.match(texts[0],/超満員スタジアム × アニマルプラネット/);assert.match(texts[0],/-1,000点/);
 assert(texts[0].endsWith('https://kmc48.github.io/dol-genba-security/'));assert.match(h.el('shareStatus').textContent,/コピーしました/);
});
test('missing or rejected clipboard reveals a manually selectable report',async()=>{
 for(const nav of [{},{clipboard:{writeText:async()=>{throw new Error('denied')}}}]){
  const h=load(nav);await h.qa.shareResult();assert.equal(h.el('shareFallback').hidden,false);assert(h.el('shareText').selected);assert.match(h.el('shareText').value,/66人/);
  const copies=[];nav.clipboard={writeText:async text=>copies.push(text)};await h.el('copyResultBtn').onclick();assert.equal(copies.length,1);
 }
});
test('non-cancel errors offer fallback, without automatically copying after failure',async()=>{
 const h=load({share:async()=>{throw new Error('denied')},clipboard:{writeText:()=>assert.fail('explicit copy only')}});
 await h.qa.shareResult();assert.equal(h.el('shareFallback').hidden,false);assert.match(h.el('shareStatus').textContent,/開けませんでした/);
});
test('double taps share once; retry resets feedback and next run shares fresh numbers',async()=>{
 let resolve;const calls=[];const h=load({share:data=>{calls.push(data);return new Promise(r=>resolve=r)}});
 const pending=h.qa.shareResult();assert(h.el('shareResultBtn').disabled);await h.qa.shareResult();assert.equal(calls.length,1);resolve();await pending;
 h.finish(12,1200);assert.equal(h.el('shareStatus').textContent,'');assert.equal(h.el('shareFallback').hidden,true);
 const next=h.qa.shareResult();assert.match(calls[1].text,/12人/);resolve();await next;
 h.qa.goMenu();await h.qa.shareResult();assert.equal(calls.length,2);
});
test('late share completion cannot write a stale message into a later result',async()=>{
 let reject;const h=load({share:()=>new Promise((_,r)=>reject=r)});const pending=h.qa.shareResult();h.finish(9,900);reject(new Error('failed'));await pending;
 assert.equal(h.el('shareStatus').textContent,'');assert.equal(h.el('shareFallback').hidden,true);
});
