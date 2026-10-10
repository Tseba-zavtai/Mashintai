const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const id='00000000-0000-4000-8000-000000000001';
const key='00000000-0000-4000-8000-000000000002';
function load(state={}) {
  const writes=[],calls=[],filters=[];
  const order={id,callback_secret:key,amount:3000,invoice_id:'invoice-1',status:'PENDING',reserved:true,...state.order};
  const db={
    auth:{getUser:async token=>({data:{user:token==='valid'?{id}:null}})},
    from(table) {
      const chain={select(){return chain;},eq(field,value){filters.push({table,field,value});return chain;},
        update(value){writes.push(value);return chain;},
        async single(){return {data:state.noOrder?null:order,error:null};},
        async maybeSingle(){return {data:state.wrongOwner?null:{id},error:null};},
        then(resolve){resolve({error:state.saveFail?new Error('db'):null});}};
      return chain;
    },
    async rpc(name,args){calls.push({name,args});
      if(name==='cancel_qpay_service_order') return {data:state.cancelRace?{paid:true,cancelled:false}:{paid:false,cancelled:true},error:state.cancelSaveFail?new Error('db'):null};
      if(name==='reserve_qpay_listing_order') return {data:order,error:state.wrongOwner?{message:'NOT_YOUR_JOB'}:state.reserveError?{message:state.reserveError}:state.rateLimit?{message:'RATE_LIMITED'}:null};
      if(name==='claim_qpay_payment_check') return {data:!state.throttled,error:null};
      return {data:true,error:state.finalizeFail?new Error('db'):null};},
  };
  let handler;
  const source=fs.readFileSync('supabase/functions/qpay-service/index.ts','utf8').replace(/^import[^\n]*\n/,'');
  const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
  const requests=[];
  vm.runInNewContext(js,{createClient:()=>db,Deno:{serve:fn=>handler=fn,env:{get:name=>state.missingSecrets&&name.startsWith('QPAY')?undefined:name==='SUPABASE_URL'?'https://test.invalid':'test-only'}},
    fetch:async(url,options)=>{requests.push({url,options});
      if(options.method==='DELETE') return new Response(state.deleteFail?'failed':null,{status:state.deleteFail?500:204});
      if(url.endsWith('/auth/token'))return new Response(JSON.stringify({access_token:'fake-token',expires_in:Math.floor(Date.now()/1000)+3600}),{status:state.authFail?401:200});
      if(url.endsWith('/invoice'))return new Response(JSON.stringify({invoice_id:'invoice-1',qr_image:'fake-qr',urls:[{name:'bank',description:'Bank',link:'bank://pay',logo:'https://test.invalid/logo'}]}));
      return new Response(JSON.stringify({rows:state.rows??[{payment_status:'PAID',payment_currency:'MNT',payment_amount:'3000',payment_id:'payment-1'}]}));},
    Response,URL,AbortSignal,Date,btoa});
  return {writes,calls,requests,filters,async call(body={},token='valid'){
    const res=await handler(new Request('https://test.invalid',{method:'POST',headers:{Authorization:`Bearer ${token}`},body:JSON.stringify(body)}));return {status:res.status,body:await res.json()};},
    async callback(secret=key,method='GET'){
      const res=await handler(new Request(`https://test.invalid?order=${id}&key=${secret}`,{method}));return {status:res.status,body:await res.json()};}};
}
test('unauthorized invoice: no QPay/DB writes',async()=>{const f=load();assert.equal((await f.call({planId:'credit'},'bad')).status,401);assert.equal(f.requests.length,0);assert.equal(f.writes.length,0);});
test('wrong owner cannot buy a job service',async()=>{const f=load({wrongOwner:true});assert.equal((await f.call({planId:'bump',jobId:id})).status,403);assert.equal(f.requests.length,0);});
test('unknown plan is rejected',async()=>{assert.equal((await load().call({planId:'__proto__'})).status,400);});
test('invoice amount/user come from server, not request',async()=>{const f=load();const r=await f.call({planId:'credit',amount:1,userId:'other'});assert.equal(r.status,200);const payload=JSON.parse(f.requests.find(r=>r.url.endsWith('/invoice')).options.body);assert.equal(payload.amount,3000);assert.equal(payload.invoice_receiver_code,id);assert.ok(payload.callback_url.includes(`key=${key}`));assert.equal(r.body.urls[0].name,'Bank');});
test('pending invoice is reused without calling QPay',async()=>{const f=load({order:{reserved:false,qr_image:'saved',bank_urls:[]}});assert.equal((await f.call({planId:'credit'})).body.qr_image,'saved');assert.equal(f.requests.length,0);});
test('creating invoice is not duplicated',async()=>{const f=load({order:{reserved:false,invoice_id:null}});assert.equal((await f.call({planId:'credit'})).status,409);assert.equal(f.requests.length,0);});
test('missing secrets fail closed',async()=>{assert.equal((await load({missingSecrets:true}).call({planId:'credit'})).status,503);});
test('callback authenticates invoice payment; no callback amount trusted',async()=>{const f=load();assert.equal((await f.callback()).status,200);assert.equal(f.calls.filter(c=>c.name==='finalize_qpay_service_order').length,1);assert.ok(f.filters.some(x=>x.field==='callback_secret'&&x.value===key));});
for(const [name,rows]of [['unpaid',[]],['wrong amount',[{payment_status:'PAID',payment_currency:'MNT',payment_amount:1,payment_id:'p'}]],['wrong currency',[{payment_status:'PAID',payment_currency:'USD',payment_amount:3000,payment_id:'p'}]],['missing payment id',[{payment_status:'PAID',payment_currency:'MNT',payment_amount:3000}]]])
test(`${name} never grants rights`,async()=>{const f=load({rows});await f.callback();assert.equal(f.calls.filter(c=>c.name==='finalize_qpay_service_order').length,0);});
test('malformed callback secret rejected before network',async()=>{const f=load();assert.equal((await f.callback('bad')).status,400);assert.equal(f.requests.length,0);});
test('duplicate paid callback does not regrant',async()=>{const f=load({order:{status:'PAID'}});assert.equal((await f.callback()).status,200);assert.equal(f.requests.length,0);assert.equal(f.calls.length,0);});
test('throttled callback asks provider to retry, does not acknowledge lost check',async()=>{const f=load({throttled:true});assert.equal((await f.callback()).status,503);assert.equal(f.requests.length,0);});
test('database finalization failure is not a successful payment',async()=>{assert.equal((await load({finalizeFail:true}).callback()).status,502);});
test('mobile status only reads DB and checks owner',async()=>{const f=load();assert.equal((await f.call({action:'status',orderId:id})).body.paid,false);assert.equal(f.requests.length,0);assert.ok(f.filters.some(x=>x.field==='user_id'&&x.value===id));});
test('token remains cached until timestamp expiry',async()=>{const f=load();await f.callback();await f.callback(undefined,'POST');assert.equal(f.requests.filter(r=>r.url.endsWith('/auth/token')).length,1);});
for(const code of ['LISTING_EXPIRED','LISTING_INACTIVE','NO_AVAILABLE_QUANTITY','ALREADY_SPONSORED','PENDING_PAYMENT'])
test(`${code} never creates an invoice`,async()=>{const f=load({reserveError:code});const r=await f.call({planId:'bump',jobIds:[id]});assert.equal(r.status,409);assert.equal(r.body.error,code);assert.equal(f.requests.length,0);});
test('bulk payment uses server total and array, not caller amount',async()=>{const f=load({order:{amount:2000}});const second='00000000-0000-4000-8000-000000000003';const r=await f.call({planId:'bump',jobIds:[id,second],amount:1});assert.equal(r.status,200);assert.deepEqual(f.calls[0].args.p_job_ids,[id,second]);assert.equal(r.body.amount,2000);});
test('duplicate selected IDs are rejected before reservation',async()=>{const f=load();assert.equal((await f.call({planId:'bump',jobIds:[id,id]})).status,400);assert.equal(f.calls.length,0);});
for(const [planId,amount] of [['credit2',5000],['credit3',7000]])
test(`${planId} package supported`,async()=>{const f=load({order:{amount}});assert.equal((await f.call({planId})).body.amount,amount);});
test('unpaid invoice is cancelled remotely before DB confirmation',async()=>{const f=load({rows:[]});const r=await f.call({action:'cancel',orderId:id});assert.equal(r.body.cancelled,true);assert.equal(f.requests.at(-1).options.method,'DELETE');assert.ok(f.requests.at(-1).url.endsWith('/invoice/invoice-1'));assert.equal(f.calls.at(-1).name,'cancel_qpay_service_order');});
test('paid invoice grants rights instead of cancelling',async()=>{const f=load();const r=await f.call({action:'cancel',orderId:id});assert.equal(r.body.paid,true);assert.equal(f.requests.some(r=>r.options.method==='DELETE'),false);assert.equal(f.calls.at(-1).name,'finalize_qpay_service_order');});
test('provider cancellation failure never marks invoice cancelled',async()=>{const f=load({rows:[],deleteFail:true});assert.equal((await f.call({action:'cancel',orderId:id})).status,502);assert.equal(f.calls.some(c=>c.name==='cancel_qpay_service_order'),false);});
test('paid DB state avoids all provider cancellation calls',async()=>{const f=load({order:{status:'PAID'}});assert.equal((await f.call({action:'cancel',orderId:id})).body.paid,true);assert.equal(f.requests.length,0);});
test('already cancelled is idempotent',async()=>{const f=load({order:{status:'CANCELLED'}});assert.equal((await f.call({action:'cancel',orderId:id})).body.cancelled,true);assert.equal(f.requests.length,0);});
test('unknown/other-owner order cannot be cancelled',async()=>{const f=load({noOrder:true});assert.equal((await f.call({action:'cancel',orderId:id})).status,404);assert.equal(f.requests.length,0);assert.ok(f.filters.some(x=>x.field==='user_id'&&x.value===id));});
test('creating invoice cannot be silently discarded',async()=>{const f=load({order:{status:'CREATING',invoice_id:null}});assert.equal((await f.call({action:'cancel',orderId:id})).status,409);assert.equal(f.requests.length,0);});
test('payment racing with cancellation returns paid outcome',async()=>{const f=load({rows:[],cancelRace:true});assert.equal((await f.call({action:'cancel',orderId:id})).body.paid,true);});
test('late callback after cancellation still verifies and grants payment',async()=>{const f=load({order:{status:'CANCELLED'}});assert.equal((await f.callback()).status,200);assert.ok(f.calls.some(c=>c.name==='finalize_qpay_service_order'));});
