const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const id = '11111111-1111-4111-8111-111111111111';
async function run({token='valid',target=id, adminFlag=false, blocker=null, cleanupFails=false}={}) {
 let handler; const calls=[];
 const client = {
  auth:{getUser: async()=>({data:{user:token==='valid'?{id}:null},error:null})},
  from:()=>({select(){return this},eq(){return this},maybeSingle:async()=>({data:{is_super_admin:adminFlag}})}),
  rpc:async(name,args)=>{ calls.push({name,args}); return {error:blocker?{message:blocker}:null}; },
 };
 const code=ts.transpileModule(fs.readFileSync('supabase/functions/delete-user/index.ts','utf8').replace(/^import.*;\r?\n/gm,''),{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
 vm.runInNewContext(code,{serve:fn=>handler=fn,createClient:()=>client,cleanDeletedAccountFiles:async()=>{if(cleanupFails)throw Error('storage')},Deno:{env:{get:()=>''}},Response,console:{error(){}}});
 const res=await handler(new Request('https://test.invalid',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({userId:target})}));
 return {status:res.status,body:await res.json(),calls};
}
test('anonymous cannot delete',async()=>{const r=await run({token:'bad'}); assert.equal(r.status,401);assert.equal(r.calls.length,0)});
test('another user cannot delete',async()=>{const r=await run({target:'22222222-2222-4222-8222-222222222222'});assert.equal(r.status,403);assert.equal(r.calls.length,0)});
test('self deletion calls one atomic RPC',async()=>{const r=await run();assert.equal(r.status,200);assert.equal(r.calls[0].name,'delete_account_atomic');assert.equal(r.calls[0].args.p_user_id,id)});
for(const blocker of ['ACTIVE_RENTAL','PENDING_PAYMENT','OPEN_DISPUTE','ADMIN_ACCOUNT_PROTECTED'])test(blocker+' returns actionable conflict',async()=>{const r=await run({blocker});assert.equal(r.status,409);assert.ok(r.body.error);});
test('unexpected database errors do not leak details',async()=>{const r=await run({blocker:'internal secret details'});assert.equal(r.status,500);assert.ok(!r.body.error.includes('secret'))});
test('Storage retry failure does not turn completed deletion into error',async()=>{assert.equal((await run({cleanupFails:true})).status,200)});
