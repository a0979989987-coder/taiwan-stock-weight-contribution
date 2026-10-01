const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const nodes=new Map();const node=id=>{if(!nodes.has(id))nodes.set(id,{hidden:false,value:'',innerHTML:'',textContent:'',disabled:false,events:{},classList:{toggle(){}},setAttribute(){},addEventListener(event,fn){this.events[event]=fn;}});return nodes.get(id);};
const data=JSON.parse(fs.readFileSync(__dirname+'/../data/morning.json','utf8'));
let failure=false;const sandbox={document:{getElementById:node},Intl,Date,Number,AbortSignal,fetch:async()=>{if(failure)throw new Error('網路中斷');return {ok:true,json:async()=>data};}};
vm.runInNewContext(fs.readFileSync(__dirname+'/../morning.js','utf8'),sandbox);
node('tab-morning').events.click();
setImmediate(async()=>{
 assert.equal(node('close-view').hidden,true);assert.equal(node('morning-view').hidden,false);
 assert.match(node('morning-cards').innerHTML,/美國股市/);assert.match(node('morning-cards').innerHTML,/美國公債殖利率/);
 assert.match(node('morning-title').textContent,/金融日報/);
 const before=node('morning-cards').innerHTML;failure=true;await node('morning-reload').events.click();
 assert.equal(node('morning-cards').innerHTML,before);assert.match(node('morning-notice').textContent,/保留目前資料/);
 node('tab-close').events.click();assert.equal(node('close-view').hidden,false);assert.equal(node('morning-view').hidden,true);
 console.log('PASS: morning tab renders snapshots, preserves data on failure, returns to calculator');
});
