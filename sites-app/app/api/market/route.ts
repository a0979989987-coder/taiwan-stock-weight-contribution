import {view,updateToday} from '@/lib/market/store';
import {getChatGPTUser} from '@/app/chatgpt-auth';
import {env} from 'cloudflare:workers';
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
export async function GET(request:Request){
 try{
  const date=new URL(request.url).searchParams.get('date')??undefined;
  if(date&&!/^\d{4}-\d{2}-\d{2}$/.test(date))return json({error:'日期格式錯誤'},400);
  return json(await view(date));
 }catch(e){console.error('History read failed',e);return json({error:'盤後歷史資料暫時無法讀取，請稍後重試'},503);}
}
export async function POST(request:Request){
 try{
  const key=env.AFTER_CLOSE_KEY;
  const automated=Boolean(key&&request.headers.get('X-After-Close-Key')===key);
  if(!automated&&!await getChatGPTUser())return json({error:'請先登入後再更新'},401);
  const origin=request.headers.get('origin');
  if(origin&&origin!==new URL(request.url).origin)return json({error:'不允許跨網站更新'},403);
  let force=false;
  if(request.headers.get('content-type')?.includes('application/json')){
   const body=await request.json() as {force?:unknown};
   force=!automated&&body.force===true;
  }
  return json(await updateToday({force}));
 }catch(e){console.error('Daily update failed',e);return json({error:'更新失敗，已保留先前資料'},503);}
}
