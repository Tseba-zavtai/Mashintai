const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const ts=require('typescript');
const exportsObject={};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/homeFeed.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{
  exports:exportsObject,require:()=>({BUMP_PRIORITY_DURATION_HOURS:3}),Date,Set,
});
const now=Date.now();
const old={id:'paid-bump',created_at:now-12*86400000,bumped_at:new Date(now-1000).toISOString()};
const newest={id:'new',created_at:now-10000};
test('paid bump precedes newer listings in Home rail',()=>{
  const result=exportsObject.buildHomeFeed([newest,old]);
  assert.equal(result.newest.items[0].id,'paid-bump');
});
test('bump applies before preview limit, not after slicing',()=>{
  const result=exportsObject.buildHomeFeed([newest,{id:'another',created_at:now-2000},old],{limit:1});
  assert.equal(result.newest.items[0].id,'paid-bump');
});
test('most recently bumped listing comes first',()=>{
  const result=exportsObject.buildHomeFeed([old,{id:'later',created_at:0,bumpedAt:new Date(now)}]);
  assert.equal(result.newest.items[0].id,'later');
});
test('new listing after bump takes first place immediately',()=>{
  const result=exportsObject.buildHomeFeed([old,{id:'after-bump',created_at:now}]);
  assert.equal(result.newest.items[0].id,'after-bump');
});
test('bump timestamp still ranks normally after three hours',()=>{
  const result=exportsObject.buildHomeFeed([{id:'older',created_at:now-5*3600000},{...old,bumped_at:now-4*3600000}]);
  assert.equal(result.newest.items[0].id,'paid-bump');
});
test('ordinary edit does not become a paid bump',()=>{
  const result=exportsObject.buildHomeFeed([newest,{id:'edited',created_at:0,updated_at:now}]);
  assert.equal(result.newest.items[0].id,'new');
});
test('full listing rail uses same ordering',()=>{
  assert.equal(exportsObject.getAllHomeFeedItems([newest,old],'newest')[0].id,'paid-bump');
});
test('inactive bump stays hidden; source list unchanged',()=>{
  const items=[newest,{...old,is_active:false}];
  const result=exportsObject.buildHomeFeed(items);
  assert.equal(result.newest.items.length,1);assert.equal(items[0].id,'new');
});
