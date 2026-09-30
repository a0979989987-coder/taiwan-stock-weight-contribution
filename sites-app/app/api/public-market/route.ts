import {view,updateToday} from '@/lib/market/store';

const githubOrigin='https://a0979989987-coder.github.io';
function json(request:Request,data:unknown,status=200){
 const headers:Record<string,string>={'Cache-Control':'no-store','Vary':'Origin'};
 if(request.headers.get('origin')===githubOrigin)headers['Access-Control-Allow-Origin']=githubOrigin;
 return Response.json(data,{status,headers});
}
export async function OPTIONS(request:Request){
 if(request.headers.get('origin')!==githubOrigin)return json(request,{error:'不允許此來源'},403);
 return new Response(null,{status:204,headers:{'Access-Control-Allow-Origin':githubOrigin,'Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type','Access-Control-Max-Age':'600','Vary':'Origin'}});
}
export async function GET(request:Request){
 try{return json(request,await view());}
 catch(e){console.error('Public market read failed',e);return json(request,{error:'資料暫時無法讀取'},503);}
}
export async function POST(request:Request){
 // This public operation can only refresh validated official closing data for today.
 // It accepts no user-supplied prices, dates, URLs or credentials. D1 serializes refreshes.
 if(request.headers.get('origin')!==githubOrigin)return json(request,{error:'不允許此來源'},403);
 if(!request.headers.get('content-type')?.includes('application/json'))return json(request,{error:'請使用 JSON 請求'},415);
 try{
  const result=await updateToday({force:true,minIntervalMs:60000});
  return json(request,{...result,...await view()});
 }catch(e){console.error('Public refresh failed',e);return json(request,{error:'更新失敗，已保留先前資料'},503);}
}
