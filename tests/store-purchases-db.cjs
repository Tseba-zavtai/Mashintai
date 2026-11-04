const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { PGlite } = require('@electric-sql/pglite');
const uid = '00000000-0000-4000-8000-000000000001', other = '00000000-0000-4000-8000-000000000002';
const job = '00000000-0000-4000-8000-000000000003';
test('real PostgreSQL: grants, replay protection, ownership checks, rollback and least privilege', async t => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      grant usage on schema public to anon,authenticated,service_role;
      create table users(id uuid primary key,paid_post_credits integer default 0,free_post_credits integer default 2,available_post_credits integer default 2);
      create table jobs(id uuid primary key,posted_by_id uuid,deleted_at timestamptz,listing_expires_at timestamptz,is_active boolean,
        available_quantity integer,sponsored_until timestamptz,published_at timestamptz,updated_at timestamptz,bumped_at timestamptz,
        last_bumped_at timestamptz,bump_count integer default 0,is_sponsored boolean default false);
      create table qpay_service_orders(user_id uuid,status text,job_id uuid,job_ids uuid[]);
      insert into users(id) values('${uid}'),('${other}');
      insert into jobs(id,posted_by_id,listing_expires_at,is_active,available_quantity) values('${job}','${uid}',now()+interval '10 days',true,1);`);
    await db.exec(fs.readFileSync('supabase/migrations/20261030000000_store_purchases.sql', 'utf8'));
    await db.exec(fs.readFileSync('supabase/migrations/20261102000000_store_refund_inbox.sql', 'utf8'));
    await db.exec(fs.readFileSync('supabase/migrations/20261102000100_store_refund_entitlements.sql', 'utf8'));
    const prepare = async (sku, user = uid, target = null) => (await db.query('select prepare_store_purchase($1,$2,$3,$4) id', [user, 'ios', sku, target])).rows[0].id;
    const grant = async (intent, sku, tx, user = uid) => (await db.query('select grant_verified_store_purchase($1,$2,$3,$4,$5,$6,now()) result', [user, intent, 'ios', sku, tx, 'Production'])).rows[0].result;
    const credit = 'mn.tureestei.app.credit2', bump = 'mn.tureestei.app.Pump';
    const intent = await prepare(credit);
    await t.test('credit pack granted exactly once on replay', async () => {
      assert.equal((await grant(intent, credit, 'tx1')).alreadyGranted, false);
      assert.equal((await grant(intent, credit, 'tx1')).alreadyGranted, true);
      assert.equal((await db.query('select paid_post_credits from users where id=$1', [uid])).rows[0].paid_post_credits, 2);
    });
    await t.test('different transaction cannot reuse an intent', async () => { await assert.rejects(grant(intent, credit, 'tx2')); });
    await t.test('receipt cannot be redirected to another intent', async () => {
      const second = await prepare(credit); await assert.rejects(grant(second, credit, 'tx1'));
      assert.equal((await db.query('select count(*)::int n from store_purchase_receipts')).rows[0].n, 1);
    });
    await t.test('receipt cannot be claimed by another account or SKU', async () => {
      await assert.rejects(grant(intent, credit, 'tx1', other));
      await assert.rejects(grant(intent, bump, 'tx1'));
      await assert.rejects(prepare(bump, other, job));
    });
    const bumpIntent = await prepare(bump, uid, job);
    await t.test('bump granted once and listing renewed', async () => {
      await grant(bumpIntent, bump, 'tx3'); await grant(bumpIntent, bump, 'tx3');
      const j = (await db.query('select bump_count,listing_expires_at>now()+interval \'29 days\' renewed from jobs')).rows[0];
      assert.equal(j.bump_count, 1); assert.equal(j.renewed, true);
    });
    const sponsor = 'mn.tureestei.app.sponsor2', sponsorIntent = await prepare(sponsor, uid, job);
    await t.test('failed entitlement rolls back receipt, then can safely retry', async () => {
      await db.query('update jobs set deleted_at=now() where id=$1', [job]);
      await assert.rejects(grant(sponsorIntent, sponsor, 'tx4'));
      assert.equal((await db.query('select count(*)::int n from store_purchase_receipts where transaction_id=\'tx4\'')).rows[0].n, 0);
      await db.query('update jobs set deleted_at=null where id=$1', [job]);
      await grant(sponsorIntent, sponsor, 'tx4');
      assert.equal((await db.query('select is_sponsored from jobs')).rows[0].is_sponsored, true);
    });
    await t.test('client roles cannot read or forge payment records or invoke grant RPCs', async () => {
      for (const role of ['anon', 'authenticated']) {
        await db.exec(`set role ${role}`);
        try {
          await assert.rejects(db.query('select * from store_purchase_intents'));
          await assert.rejects(db.query('select * from store_purchase_receipts'));
          await assert.rejects(prepare(credit));
          await assert.rejects(grant(intent, credit, 'forged'));
          await assert.rejects(db.query('select * from store_credit_lots'));
          await assert.rejects(db.query("select reconcile_store_refund('00000000-0000-4000-8000-000000000001')"));
          await assert.rejects(db.query('select grant_verified_store_purchase_internal($1,$2,$3,$4,$5,$6,now())',[uid,intent,'ios',credit,'tx1','Production']));
        } finally { await db.exec('reset role'); }
      }
    });
    const refund = async (tx, eventId, full=true, type='REFUND') => {
      const event=(await db.query(`insert into store_refund_events(platform,event_id,transaction_id,environment,event_type,occurred_at,full_refund)
        values('ios',$1,$2,'Production',$3,now(),$4) returning id`,[eventId,tx,type,full])).rows[0].id;
      return { event, result:(await db.query('select reconcile_store_refund($1) result',[event])).rows[0].result };
    };
    await t.test('unused refunded credits removed exactly once, preserving free and other paid credits', async () => {
      await db.query('update users set paid_post_credits=10,available_post_credits=12 where id=$1',[other]); // existing QPay balance
      const target=await prepare(credit,other); await grant(target,credit,'refund-unused',other);
      const {event,result}=await refund('refund-unused','refund-event1');
      assert.equal(result.removedCredits,2); assert.equal(result.needsReview,false);
      await db.query('select reconcile_store_refund($1)',[event]);
      await refund('refund-unused','refund-event1-duplicate');
      const balance=(await db.query('select * from users where id=$1',[other])).rows[0];
      assert.equal(balance.paid_post_credits,10); assert.equal(balance.free_post_credits,2); assert.equal(balance.available_post_credits,12);
      await assert.rejects(grant(target,credit,'refund-unused',other),/PURCHASE_REFUNDED/);
    });
    await t.test('partly consumed pack removes only its remaining credits, with no debt or future deduction',async()=>{
      const target=await prepare(credit,other); await grant(target,credit,'refund-used',other);
      await db.query('update users set paid_post_credits=paid_post_credits-1,available_post_credits=available_post_credits-1 where id=$1',[other]);
      const {result}=await refund('refund-used','refund-event2');
      assert.equal(result.removedCredits,1); assert.equal(result.needsReview,true);
      assert.equal((await db.query('select paid_post_credits from users where id=$1',[other])).rows[0].paid_post_credits,10);
    });
    await t.test('partial and reversed refunds require review without automatic balance changes',async()=>{
      const target=await prepare(credit,other); await grant(target,credit,'refund-partial',other);
      assert.equal((await refund('refund-partial','partial-event',false)).result.needsReview,true);
      assert.equal((await refund('refund-partial','reverse-event',false,'REFUND_REVERSED')).result.needsReview,true);
      assert.equal((await db.query('select paid_post_credits from users where id=$1',[other])).rows[0].paid_post_credits,12);
    });
    await t.test('refund before delivery prevents a later grant; delivered promotions remain for manual review',async()=>{
      const target=await prepare(credit,other);
      await refund('refund-before','early-event');
      await assert.rejects(grant(target,credit,'refund-before',other),/PURCHASE_REFUNDED/);
      const {result}=await refund('tx4','promotion-event');
      assert.equal(result.needsReview,true);
      assert.equal((await db.query('select is_sponsored from jobs')).rows[0].is_sponsored,true);
    });
    await t.test('Android bump is lowercase; Apple Pump is case-sensitive',async()=>{
      await db.exec("update store_purchase_intents set created_at=now()-interval '1 hour'");
      await assert.rejects(db.query('select prepare_store_purchase($1,$2,$3,$4)',[uid,'android','mn.tureestei.app.Pump',job]),/INVALID_SELECTION/);
      await assert.rejects(db.query('select prepare_store_purchase($1,$2,$3,$4)',[uid,'ios','mn.tureestei.app.bump',job]),/INVALID_SELECTION/);
      assert.ok((await db.query('select prepare_store_purchase($1,$2,$3,$4) id',[uid,'android','mn.tureestei.app.bump',job])).rows[0].id);
    });
  } finally { await db.close(); }
});
