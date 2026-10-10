const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const ts=require('typescript');
function load(){
 const calls=[];const context={exports:{},supabase:{rpc:async(name,args)=>{calls.push({name,args});return {data:true,error:null};}},console};
 const source=fs.readFileSync('lib/promotionMetrics.ts','utf8').replace(/^import[^\n]*\n/,'');
 vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,context);
 return {api:context.exports,calls};
}
test('announcement views use announcement RPC',async()=>{const f=load();assert.equal(await f.api.recordPromotionMetric('announcement','a','impression'),true);assert.equal(f.calls[0].name,'record_announcement_view');assert.equal(f.calls[0].args.p_target_id,'a');});
test('announcement close is not a click',async()=>{const f=load();assert.equal(await f.api.recordPromotionMetric('announcement','a','click'),false);assert.equal(f.calls.length,0);});
test('banner views and clicks retain existing RPC',async()=>{const f=load();await f.api.recordPromotionMetric('banner','b','impression');await f.api.recordPromotionMetric('banner','b','click');assert.equal(f.calls.length,2);assert.equal(f.calls[1].args.p_event_type,'click');assert.equal(f.calls[0].name,'record_promotion_metric');});
test('empty target is ignored',async()=>{const f=load();assert.equal(await f.api.recordPromotionMetric('announcement','','impression'),false);assert.equal(f.calls.length,0);});
test('announcement onShow counts once for the same mounted screen',()=>{
 const source=fs.readFileSync('app/(tabs)/index.tsx','utf8');
 const body=source.match(/const onAnnouncementShown = \(\) => \{([\s\S]*?)\n  \};/)[1];
 const calls=[];const context={announcement:{id:'a'},viewedAnnouncements:{current:new Set()},recordPromotionMetric:(...args)=>calls.push(args)};
 vm.runInNewContext(`function show(){${body}};show();show();`,context);
 assert.equal(calls.length,1);assert.equal(calls[0][0],'announcement');
});
