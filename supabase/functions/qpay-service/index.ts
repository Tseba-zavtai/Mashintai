import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const headers = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info", "Content-Type": "application/json" };
const plans: Record<string, number> = { credit: 3000, bump: 1000, daily: 4500, weekly: 21000, monthly: 45000 };
let token = ""; let expires = 0;
let authenticating: Promise<void> | null = null;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
async function qpay(path: string, body: unknown) {
 const base = "https://merchant.qpay.mn/v2";
 if (!token || Date.now() >= expires) {
  if (!authenticating) authenticating = (async () => {
  const username = Deno.env.get("QPAY_USERNAME"), password = Deno.env.get("QPAY_PASSWORD");
  if (!username || !password) throw new Error("QPAY_NOT_CONFIGURED");
  const response = await fetch(`${base}/auth/token`, { method: "POST", headers: { Authorization: `Basic ${btoa(`${username}:${password}`)}` }, signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error("QPAY_AUTH_FAILED");
  const data = await response.json(); token = data.access_token;
  if (!token) throw new Error("QPAY_AUTH_FAILED");
  const expiry = Number(data.expires_in);
  // QPay uses a Unix timestamp; tolerate duration-based test responses too.
  const end = expiry > 1_000_000_000 ? expiry * 1000 : Date.now() + expiry * 1000;
  expires = Number.isFinite(end) && end > Date.now() ? end - 30000 : Date.now() + 300000;
  })().finally(() => { authenticating = null; });
  await authenticating;
 }
 const response = await fetch(`${base}/${path}`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(15000) });
 if (!response.ok) { if (response.status === 401) expires=0; throw new Error("QPAY_REQUEST_FAILED"); }
 return await response.json();
}
Deno.serve(async req => {
 const reply = (data: unknown, status=200) => new Response(JSON.stringify(data), {status,headers});
 if(req.method === "OPTIONS") return reply({});
 const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
 try {
  const url = new URL(req.url);
  // The callback is untrusted. Only QPay's authenticated payment/check response can grant a service.
  if(url.searchParams.has("order")) {
   if(!['GET','POST'].includes(req.method)) return reply({error:"METHOD_NOT_ALLOWED"},405);
   const id=url.searchParams.get("order");
   const key=url.searchParams.get("key");
   if(!id || !key || !uuid.test(id) || !uuid.test(key)) return reply({error:"INVALID_CALLBACK"},400);
   const {data:order,error}=await db.from("qpay_service_orders").select("*").eq("id",id).eq("callback_secret",key).single();
   if(error || !order?.invoice_id) return reply({error:"ORDER_NOT_FOUND"},404);
   if(order.status === "PAID") return reply({success:true});
   const claim=await db.rpc("claim_qpay_payment_check",{p_order_id:id});
   if(claim.error) throw new Error("PAYMENT_CHECK_FAILED");
   if(!claim.data) return reply({error:'CHECK_IN_PROGRESS'},503);
   const check=await qpay("payment/check", {object_type:"INVOICE",object_id:order.invoice_id,offset:{page_number:1,page_limit:100}});
   if(!Array.isArray(check.rows)) throw new Error("INVALID_PAYMENT_RESPONSE");
   const rows=check.rows.filter((p: any)=>p.payment_status === "PAID");
   const amount=rows.reduce((sum:number,p:any)=>sum+Number(p.payment_amount),0);
   if(amount !== Number(order.amount) || rows.length !== 1 || rows[0].payment_currency !== "MNT" || !rows[0].payment_id) return reply({success:true,paid:false},200);
   const result=await db.rpc("finalize_qpay_service_order",{p_order_id:id,p_payment_id:rows[0].payment_id,p_paid_amount:amount});
   if(result.error) throw new Error("PAYMENT_FINALIZATION_FAILED");
   return reply({success:true});
  }
  if(req.method !== "POST") return reply({error:"METHOD_NOT_ALLOWED"},405);
  const bearer=req.headers.get("Authorization")?.replace(/^Bearer\s+/i,"") ?? "";
  if(!bearer) return reply({error:"UNAUTHORIZED"},401);
  const {data:{user}}=await db.auth.getUser(bearer);
  if(!user) return reply({error:"UNAUTHORIZED"},401);
  let body;
  try { body=await req.json(); } catch { return reply({error:"INVALID_REQUEST"},400); }
  if(!body || typeof body !== 'object') return reply({error:"INVALID_REQUEST"},400);
  if(body.action === "status") {
   if(typeof body.orderId !== 'string' || !uuid.test(body.orderId)) return reply({error:"INVALID_ORDER"},400);
   const {data,error}=await db.from("qpay_service_orders").select("status").eq("id",body.orderId).eq("user_id",user.id).single();
   if(error) return reply({error:"ORDER_NOT_FOUND"},404);
   return reply({paid:data.status === "PAID"});
  }
  if(body.action && body.action !== 'create') return reply({error:"INVALID_REQUEST"},400);
  if(typeof body.planId !== 'string' || !Object.hasOwn(plans,body.planId)) return reply({error:"INVALID_PLAN"},400);
  if(body.planId !== "credit") {
   if(typeof body.jobId !== 'string' || !uuid.test(body.jobId)) return reply({error:"INVALID_JOB"},400);
   const {data}=await db.from("jobs").select("id").eq("id",body.jobId).eq("posted_by_id",user.id).maybeSingle();
   if(!data) return reply({error:"NOT_YOUR_JOB"},403);
  }
  const code=Deno.env.get("QPAY_INVOICE_CODE");
  if(!code || !Deno.env.get('QPAY_USERNAME') || !Deno.env.get('QPAY_PASSWORD')) return reply({error:"QPAY_NOT_CONFIGURED"},503);
  const {data:order,error}=await db.rpc('reserve_qpay_service_order',{p_user_id:user.id,p_job_id:body.planId === 'credit' ? null:body.jobId,p_plan_id:body.planId});
  if(error) {
   if(error.message?.includes('NOT_YOUR_JOB')) return reply({error:'NOT_YOUR_JOB'},403);
   if(error.message?.includes('RATE_LIMITED')) return reply({error:'RATE_LIMITED'},429);
   throw new Error("ORDER_CREATE_FAILED");
  }
  if(!order?.id) throw new Error('ORDER_CREATE_FAILED');
  if(!order.reserved) {
   if(order.invoice_id && order.qr_image) return reply({orderId:order.id,amount:Number(order.amount),qr_image:order.qr_image,urls:order.bank_urls});
   return reply({error:'INVOICE_CREATING'},409);
  }
  let invoice;
  try {
   invoice=await qpay("invoice",{invoice_code:code,sender_invoice_no:order.id,invoice_receiver_code:user.id,invoice_description:`Tureesly ${body.planId}`,amount:Number(order.amount),callback_url:`${Deno.env.get("SUPABASE_URL")}/functions/v1/qpay-service?order=${order.id}&key=${order.callback_secret}`,allow_partial:false,allow_exceed:false});
  } catch(error) {
   // A timeout may have created an invoice: don't silently create a second one.
   if(error instanceof Error && error.message === 'QPAY_AUTH_FAILED') await db.from('qpay_service_orders').update({status:'FAILED'}).eq('id',order.id);
   throw error;
  }
  if(typeof invoice.invoice_id !== 'string' || typeof invoice.qr_image !== 'string' || !invoice.qr_image) throw new Error("INVALID_INVOICE");
  const urls=(Array.isArray(invoice.urls) ? invoice.urls:[]).filter((b:any)=>typeof b.name === 'string' && typeof b.link === 'string' && /^[a-z][a-z0-9+.-]*:\/\//i.test(b.link) && !/^(javascript|data|file):/i.test(b.link)).map((b:any)=>({name:b.description || b.name,logo:typeof b.logo === 'string' ? b.logo:'',link:b.link}));
  const saved=await db.from("qpay_service_orders").update({invoice_id:invoice.invoice_id,qr_image:invoice.qr_image,bank_urls:urls,status:'PENDING'}).eq("id",order.id);
  if(saved.error) throw new Error("INVOICE_SAVE_FAILED");
  return reply({orderId:order.id,amount:Number(order.amount),qr_image:invoice.qr_image,urls});
 } catch(error) {
  // Never log tokens, credentials or bank payloads.
  const known=['QPAY_NOT_CONFIGURED','QPAY_AUTH_FAILED','QPAY_REQUEST_FAILED','ORDER_CREATE_FAILED','INVALID_INVOICE','INVOICE_SAVE_FAILED','PAYMENT_CHECK_FAILED','INVALID_PAYMENT_RESPONSE','PAYMENT_FINALIZATION_FAILED'];
  return reply({error:error instanceof Error && known.includes(error.message) ? error.message:"PAYMENT_ERROR"},502);
 }
});
