const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { PGlite } = require("@electric-sql/pglite");
test("commercial RLS, direct paywall bypass, provider snapshots, monthly credits, legacy data and deletion", async () => {
  const db = new PGlite();
  const legacy = "00000000-0000-4000-8000-000000000001",
    free = "00000000-0000-4000-8000-000000000002";
  const role = async (id, r = "authenticated") => {
    await db.exec("reset role");
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
    await db.exec("set role " + r);
  };
  const load = async () =>
    (await db.query("select public.load_workspace() data")).rows[0].data;
  const access = async () =>
    (await db.query("select public.commercial_entitlement($1) data", [free]))
      .rows[0].data;
  let i = 0;
  const checkoutConsentId = "00000000-0000-4000-8000-000000000099";
  const apply = async (snapshot, type = "subscription.updated", eventId) =>
    db.query("select public.apply_paddle_snapshot($1,$2)", [
      {
        id: eventId || "evt_" + ++i,
        type,
        occurredAt: new Date().toISOString(),
        environment: "sandbox",
        transactionId: "txn_authorized",
        transactionStatus: "completed",
        operationId: checkoutConsentId,
        termsVersion: "test-approved",
      },
      snapshot,
    ]);
  try {
    await db.exec(
      `create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key,email_confirmed_at timestamptz);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;create function auth.role() returns text language sql stable as $$select current_setting('role')$$;grant usage on schema auth,public to authenticated,anon,service_role;insert into auth.users values('${legacy}',now());`,
    );
    for (const file of fs.readdirSync("supabase/migrations").sort())
      await db.exec(fs.readFileSync("supabase/migrations/" + file, "utf8"));
    await db.exec(fs.readFileSync("supabase/seed-plan-catalog.sql", "utf8"));
    await db.exec(
      `insert into auth.users values('${free}',now());update public.commercial_settings set enabled=true,plans=jsonb_set(plans,'{pro,aiMonthly}','2');`,
    );
    await role(free);
    let own = await load();
    own.profile = { display_name: "Free owner", age_band: "18+" };
    await db.query("select public.commit_workspace($1,$2,$3)", [
      own,
      own.revision,
      free,
    ]);
    assert.equal((await access()).plan, "free");
    await assert.rejects(
      db.query(
        "insert into public.job_applications(user_id,local_id,company,role,country,status) values($1,'bypass','Forbidden','Engineer','Brazil','Saved')",
        [free],
      ),
      /requires Pro/,
    );
    await assert.rejects(
      db.query(
        "insert into public.billing_subscriptions(subscription_id,user_id,customer_id,environment,plan,status,unit_amount,currency,provider_updated_at) values('sub_fake',$1,'ctm_fake','sandbox','premium','active',1900,'USD',now())",
        [free],
      ),
      /permission denied/,
    );
    await assert.rejects(
      db.query(
        "insert into public.commercial_grants(user_id,plan,reason) values($1,'premium','forged')",
        [free],
      ),
      /permission denied/,
    );
    await assert.rejects(
      db.query("select public.commercial_entitlement($1)", [legacy]),
      /owner/,
    );
    await assert.rejects(
      db.query("select public.commercial_metrics()"),
      /permission denied/,
    );
    await assert.rejects(
      db.query("select public.reserve_ai_usage_v4($1)", [free]),
      /permission denied/,
    );
    own = await load();
    await assert.rejects(
      db.query("select public.commit_workspace($1,$2,$3)", [
        { ...own, tasks: [{ id: "fake", title: "Not entitled" }] },
        own.revision,
        free,
      ]),
      /requires Pro/,
    );
    await role(legacy);
    assert.equal(
      (
        await db.query("select public.commercial_entitlement($1) data", [
          legacy,
        ])
      ).rows[0].data.legacy,
      true,
    );
    await db.query(
      "insert into public.job_applications(user_id,local_id,company,role,country,status) values($1,'legacy','Kept Company','Engineer','Brazil','Saved')",
      [legacy],
    );
    await role(free);
    assert.equal(
      (await db.query("select * from public.job_applications")).rows.length,
      0,
    );
    await role(free, "service_role");
    await db.query(
      "insert into public.billing_customers(user_id,customer_id,environment) values($1,'ctm_owner','sandbox')",
      [free],
    );
    await db.query(
      "insert into public.billing_operations(id,user_id,action,plan,state,created_at,result) values($1,$2,'checkout','pro','complete',now()-interval '2 minutes',$3)",
      [checkoutConsentId, free, { transactionId: "txn_authorized" }],
    );
    await db.query(
      "insert into public.contract_consents(user_id,operation_id,customer_id,version) values($1,$2,'ctm_owner','test-approved')",
      [free, checkoutConsentId],
    );
    assert.equal(
      (await db.query("select public.billing_deletion_status($1) data", [free]))
        .rows[0].data.blocked,
      true,
    );
    const now = Date.now(),
      snapshot = {
        id: "sub_owner",
        customerId: "ctm_owner",
        plan: "pro",
        status: "active",
        periodStart: new Date(now).toISOString(),
        periodEnd: new Date(now + 30 * 864e5).toISOString(),
        cancelAt: null,
        unitAmount: 900,
        currency: "USD",
        updatedAt: new Date(now).toISOString(),
      };
    await apply(snapshot, "subscription.activated", "evt_first");
    await apply(snapshot, "subscription.activated", "evt_first");
    assert.equal(
      (await db.query("select * from public.billing_events")).rows.length,
      1,
    );
    assert.equal((await access()).plan, "pro");
    await db.exec(
      "update public.commercial_settings set plans=jsonb_set(plans,'{pro,applications}','1')",
    );
    await role(free);
    await db.query(
      "insert into public.job_applications(user_id,local_id,company,role,country,status) values($1,'paid-one','Owned','Engineer','Brazil','Saved')",
      [free],
    );
    await assert.rejects(
      db.query(
        "insert into public.job_applications(user_id,local_id,company,role,country,status) values($1,'paid-two','Over cap','Engineer','Brazil','Saved')",
        [free],
      ),
      /plan limit/,
    );
    await db.query(
      "update public.job_applications set company='Still owned' where user_id=$1",
      [free],
    );
    await role(free, "service_role");
    await db.query("select public.reserve_ai_usage($1)", [free]);
    await db.query("select public.reserve_ai_usage($1)", [free]);
    await assert.rejects(
      db.query("select public.reserve_ai_usage($1)", [free]),
      /Monthly AI credit/,
    );
    await apply({
      ...snapshot,
      plan: "premium",
      unitAmount: 1900,
      updatedAt: new Date(now + 2000).toISOString(),
    });
    assert.equal((await access()).plan, "premium");
    await apply({ ...snapshot, updatedAt: new Date(now + 1000).toISOString() });
    assert.equal((await access()).plan, "premium");
    await db.exec("reset role");
    await assert.rejects(
      db.query("delete from auth.users where id=$1", [free]),
      /Cancel the subscription/,
    );
    await role(free, "service_role");
    const metrics = (await db.query("select public.commercial_metrics() data"))
      .rows[0].data;
    assert.equal(metrics.contractMrrCents, 1900);
    assert.equal(metrics.activeSubscribers, 1);
    assert.equal(metrics.churnPercent, null);
    assert.equal(metrics.usageContributionMarginPercent, null);
    const op = "00000000-0000-4000-8000-000000000010";
    await db.query(
      "select public.reserve_billing_operation($1,$2,'cancel',null)",
      [op, free],
    );
    await assert.rejects(
      db.query("select public.reserve_billing_operation($1,$2,'cancel',null)", [
        op,
        free,
      ]),
      /pending or uncertain/,
    );
    await db.query(
      "update public.billing_operations set state='complete',result='{}' where id=$1",
      [op],
    );
    assert.equal(
      (
        await db.query(
          "select public.reserve_billing_operation($1,$2,'cancel',null) data",
          [op, free],
        )
      ).rows[0].data.cached,
      true,
    );
    const checkoutOp = "00000000-0000-4000-8000-000000000020";
    await db.query(
      "insert into public.billing_operations(id,user_id,action,plan,state,result) values($1,$2,'checkout','pro','complete',$3)",
      [checkoutOp, free, { transactionId: "txn_owned" }],
    );
    await db.query("select public.apply_paddle_snapshot($1,$2)", [
      {
        id: "evt_stale_binding",
        type: "transaction.completed",
        occurredAt: new Date().toISOString(),
        environment: "sandbox",
        transactionId: "txn_owned",
      },
      snapshot,
    ]);
    assert.equal(
      (
        await db.query(
          "select result from public.billing_operations where id=$1",
          [checkoutOp],
        )
      ).rows[0].result.subscriptionId,
      "sub_owner",
    );
    await db.query("select public.complete_billing_operation($1,$2,$3)", [
      checkoutOp,
      free,
      { transactionId: "txn_owned", notice: "Transport complete" },
    ]);
    assert.equal(
      (
        await db.query(
          "select result from public.billing_operations where id=$1",
          [checkoutOp],
        )
      ).rows[0].result.subscriptionId,
      "sub_owner",
    );
    await apply(
      {
        ...snapshot,
        status: "past_due",
        updatedAt: new Date(now + 3000).toISOString(),
      },
      "transaction.payment_failed",
    );
    assert.equal((await access()).plan, "free");
    await apply(
      {
        ...snapshot,
        status: "active",
        updatedAt: new Date(now + 4000).toISOString(),
      },
      "subscription.resumed",
    );
    assert.equal((await access()).plan, "pro");
    await apply(
      {
        ...snapshot,
        periodEnd: new Date(now + 60 * 864e5).toISOString(),
        updatedAt: new Date(now + 4500).toISOString(),
      },
      "subscription.updated",
    );
    assert.equal(
      (
        await db.query(
          "select period_end from public.billing_subscriptions where subscription_id='sub_owner'",
        )
      ).rows[0].period_end.toISOString(),
      new Date(now + 60 * 864e5).toISOString(),
    );
    await apply({
      ...snapshot,
      periodEnd: new Date(now - 10000).toISOString(),
      updatedAt: new Date(now + 4800).toISOString(),
    });
    assert.equal((await access()).plan, "free");
    await apply(
      {
        ...snapshot,
        status: "canceled",
        updatedAt: new Date(now + 5000).toISOString(),
      },
      "subscription.canceled",
    );
    assert.equal((await access()).plan, "free");
    await role(free);
    own = await load();
    own.profile.display_name = "Still editable";
    await db.query("select public.commit_workspace($1,$2,$3)", [
      own,
      own.revision,
      free,
    ]);
    await db.exec("reset role");
    await db.query("delete from auth.users where id=$1", [free]);
    assert.equal(
      (
        await db.query(
          "select user_id from public.billing_customers where customer_id='ctm_owner'",
        )
      ).rows[0].user_id,
      null,
    );
  } finally {
    await db.close();
  }
});
