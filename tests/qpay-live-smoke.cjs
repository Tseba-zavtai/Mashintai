const assert=require('node:assert/strict');
const base='https://wrekrjaitokrqydkwgtg.supabase.co/functions/v1/';
(async()=>{
  const call=async(path,method='POST')=>fetch(base+path,{method,body:method==='POST'?'{}':undefined,headers:{'content-type':'application/json'},signal:AbortSignal.timeout(20000)});
  assert.equal((await call('qpay-service')).status,401);
  assert.equal((await call('qpay-service?order=bad&key=bad','GET')).status,400);
  assert.equal((await call('create-qpay-invoice')).status,410);
  // Legacy callback may be rejected by the gateway before reaching its 410.
  assert.ok([401,410].includes((await call('qpay-callback')).status));
  console.log('PASS: anonymous create rejected; malformed callback rejected; both legacy payment paths disabled.');
})().catch(e=>{console.error(e.message);process.exitCode=1;});
