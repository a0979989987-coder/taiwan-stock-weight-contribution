// Invoked by the user's Codex schedule. No market polling or perpetual process.
import {readFileSync} from 'node:fs';
const origin='https://taiwan-weight-points-k928.btcfly.chatgpt.site';
const bypass=process.env.SITE_BYPASS_TOKEN;
const key=readFileSync(new URL('../.env.local',import.meta.url),'utf8').match(/^AFTER_CLOSE_KEY=(.+)$/m)?.[1]?.trim();
if(!bypass||!key)throw new Error('Missing scheduled-update credentials');
const headers={'OAI-Sites-Authorization':'Bearer '+bypass,'X-After-Close-Key':key};
const response=await fetch(origin+'/api/market',{method:'POST',headers,redirect:'error',signal:AbortSignal.timeout(120000)});
if(!response.ok)throw new Error('Scheduled update HTTP '+response.status);
const result=await response.json();
const verification=await fetch(origin+'/api/market',{headers,redirect:'error',signal:AbortSignal.timeout(20000)});
if(!verification.ok)throw new Error('History readback HTTP '+verification.status);
const state=await verification.json();
if(result.status==='complete'&&(state.report?.date!==state.today||state.report?.stocks?.length!==12))throw new Error('Stored daily report failed verification');
console.log(JSON.stringify({status:result.status,message:result.message,latestDate:state.latestDate,stockCount:state.report?.stocks?.length??0,historyCount:state.dates?.length??0}));
