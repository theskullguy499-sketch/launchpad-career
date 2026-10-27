// Official Paddle Billing REST endpoints; WebCrypto verifies the exact signed bytes.
const PRODUCTION_DEMO = 'https://theskullguy499-sketch.github.io';
const uuid = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const checked = async query => { const r=await query;if(r.error)throw new Error(r.error.message || 'Database operation failed');return r.data; };
export async function verifyPaddleSignature(raw, header, secret, now=Date.now()) {
 if (!secret || secret.length<32 || !header || raw.length>256000) return false;
 const parts=header.split(';').map(part=>part.trim().split('='));
 const timestamps=parts.filter(([key])=>key==='ts');
 if(timestamps.length!==1 || !/^\d{10}$/.test(timestamps[0][1]))return false;
 const ts=Number(timestamps[0][1]);if(Math.abs(now/1000-ts)>300)return false;
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['verify']);
 for(const [name,value] of parts)if(name==='h1' && /^[0-9a-f]{64}$/i.test(value)) {
  const signature=Uint8Array.from(value.match(/../g),x=>parseInt(x,16));
  if(await crypto.subtle.verify('HMAC',key,signature,new TextEncoder().encode(`${ts}:${raw}`)))return true;
 }
 return false;
}
export function paddleSnapshot(data, mapping, catalog) {
 if(!data || !/^sub_[a-z0-9]+$/i.test(data.id) || !/^ctm_[a-z0-9]+$/i.test(data.customer_id) || !['active','trialing','past_due','paused','canceled'].includes(data.status) || !Array.isArray(data.items) || data.items.length!==1)throw new Error('Unsupported subscription snapshot');
 const item=data.items[0], plan=Object.keys(mapping).find(key=>mapping[key]===item.price?.id);
 const config=catalog[plan];
 if(!config || item.quantity!==1 || item.price.unit_price?.currency_code!=='USD' || Number(item.price.unit_price?.amount)!==config.monthlyCents || item.price.billing_cycle?.interval!=='month' || item.price.billing_cycle?.frequency!==1)throw new Error('Subscription price does not match the reviewed catalog');
 const date=(value,required=false)=>{if(!value&&!required)return null;if(!value||!Number.isFinite(Date.parse(value)))throw new Error('Invalid provider date');return new Date(value).toISOString();};
 return {id:data.id,customerId:data.customer_id,plan,status:data.status,periodStart:date(data.current_billing_period?.starts_at),periodEnd:date(data.current_billing_period?.ends_at,data.status==='active'),cancelAt:date(data.scheduled_change?.action==='cancel'?data.scheduled_change.effective_at:null),unitAmount:config.monthlyCents,currency:'USD',updatedAt:date(data.updated_at,true)};
}
export function makeBillingHandler(kind,{env,createClient,fetch:request=globalThis.fetch,now=()=>new Date()}) {
 const environment=env('PADDLE_ENVIRONMENT') || 'sandbox';
 const mapping={pro:env('PADDLE_PRICE_PRO'),premium:env('PADDLE_PRICE_PREMIUM')};
 const site=env('PUBLIC_SITE_URL');
 const origins=new Set((env('ALLOWED_ORIGINS') || PRODUCTION_DEMO).split(',').map(s=>s.trim()));
 async function provider(path,method='GET',body) {
  if(!env('PADDLE_API_KEY') || !['sandbox','live'].includes(environment))throw new Error('Paddle sandbox is not configured');
  if(environment==='live' && env('ALLOW_LIVE_BILLING')!=='true' && method!=='GET' && !path.endsWith('/cancel') && !path.endsWith('/portal-sessions') && !path.endsWith('/preview'))throw new Error('Live charges are disabled');
  const response=await request(`https://${environment==='sandbox'?'sandbox-api':'api'}.paddle.com${path}`,{method,headers:{Authorization:`Bearer ${env('PADDLE_API_KEY')}`,'Content-Type':'application/json','Paddle-Version':'1'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(20000)});
  if(!response.ok)throw new Error('Paddle could not complete the operation. Check the portal before retrying.');
  const result=await response.json();if(!result.data)throw new Error('Paddle returned no usable data');return result.data;
 }
 return async req=>{
  const headers={'Content-Type':'application/json','Cache-Control':'no-store',Vary:'Origin'};
  const origin=req.headers.get('Origin');
  if(origin&&origins.has(origin))Object.assign(headers,{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info','Access-Control-Allow-Methods':'POST,OPTIONS'});
  const respond=(data,status=200)=>new Response(JSON.stringify(data),{status,headers});
  if(kind!=='paddle-webhook'&&origin&&!origins.has(origin))return respond({error:'This origin is not allowed.'},403);
  if(req.method==='OPTIONS'&&kind!=='paddle-webhook')return new Response(null,{status:204,headers});
  if(req.method!=='POST')return respond({error:'Use POST.'},405);
  try{
   if(Number(req.headers.get('content-length')||0)>256000)return respond({error:'Request too large.'},413);
   const chunks=[];let size=0;const reader=req.body?.getReader();
   if(reader)while(true){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;if(size>256000){await reader.cancel();return respond({error:'Request too large.'},413);}chunks.push(part.value);}
   const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
   let raw;try{raw=new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch{return respond({error:'Invalid UTF-8.'},400);}
   if(kind==='paddle-webhook' && !await verifyPaddleSignature(raw,req.headers.get('Paddle-Signature'),env('PADDLE_WEBHOOK_SECRET'),now().getTime()))return respond({error:'Invalid webhook signature.'},401);
   let body;try{body=JSON.parse(raw||'{}');}catch{return respond({error:'Invalid JSON.'},400);}
   const url=env('SUPABASE_URL'),key=env('SUPABASE_PUBLISHABLE_KEY')||env('SUPABASE_ANON_KEY'),secret=env('SUPABASE_SERVICE_ROLE_KEY');
   if(!url||!key||!secret)return respond({error:'The secure backend is not configured.'},503);
   const admin=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
   const settings=await checked(admin.from('commercial_settings').select('*').eq('id',true).single());
   if(kind==='paddle-webhook'){
    if(!/^evt_[a-z0-9]+$/i.test(body.event_id)||!Number.isFinite(Date.parse(body.occurred_at))||typeof body.event_type!=='string')return respond({error:'Invalid event.'},400);
    const event={id:body.event_id,type:body.event_type,occurredAt:body.occurred_at,environment};
    const previous=await checked(admin.from('billing_events').select('event_id').eq('event_id',body.event_id).maybeSingle());
    if(previous)return respond({received:true,duplicate:true});
    if(settings.environment!==environment)throw new Error('Billing environment mismatch');
    const subscriptionId=body.event_type.startsWith('subscription.')?body.data?.id:body.data?.subscription_id;
    let snapshot=null;
    if(subscriptionId){if(!/^sub_[a-z0-9]+$/i.test(subscriptionId))throw new Error('Invalid subscription ID');snapshot=paddleSnapshot(await provider(`/subscriptions/${subscriptionId}`),mapping,settings.plans);}
    await checked(admin.rpc('apply_paddle_snapshot',{event,snapshot}));
    return respond({received:true});
   }
   if(body.action==='catalog')return respond({enabled:settings.enabled,environment:settings.environment,catalog:settings.plans,supportEmail:env('PUBLIC_SUPPORT_EMAIL')||'',businessName:env('BUSINESS_NAME')||'',legalApproved:env('BILLING_LEGAL_APPROVED')==='true'});
   const authorization=req.headers.get('Authorization')||'';
   if(!authorization.startsWith('Bearer '))return respond({error:'Sign in to a verified account first.'},401);
   const client=createClient(url,key,{global:{headers:{Authorization:authorization}},auth:{persistSession:false,autoRefreshToken:false}});
   const {data,error}=await client.auth.getUser();const user=data?.user;
   if(error||!user?.email_confirmed_at)return respond({error:'Confirm your email before opening Billing.'},401);
   if(body.expected_user!==user.id)return respond({error:'Your account changed. Reload before continuing.'},409);
   const entitlement=await checked(admin.rpc('commercial_entitlement',{owner_id:user.id}));
   const subs=await checked(admin.from('billing_subscriptions').select('*').eq('user_id',user.id).eq('environment',environment));
   if(body.action==='status'){
    await checked(admin.from('commercial_activity').upsert({user_id:user.id,last_seen_at:now().toISOString()}));
    const usage=await checked(admin.from('ai_token_usage').select('input_tokens,output_tokens,estimated_usd,model,created_at').eq('user_id',user.id).order('created_at',{ascending:false}).limit(20));
    const profile=await checked(admin.from('user_profiles').select('age_band').eq('id',user.id).single());
    return respond({ageBand:profile.age_band,entitlement,subscriptions:subs,usage,configured:!!env('PADDLE_API_KEY'),isAdmin:!!await checked(admin.from('business_admins').select('user_id').eq('user_id',user.id).maybeSingle())});
   }
   if(body.action==='export'){
    const result={exportedAt:now().toISOString()};
    for(const table of ['billing_customers','billing_subscriptions','billing_operations','ai_monthly_usage','ai_token_usage','early_access','conversion_events']){
     result[table]=[];
     for(let offset=0;offset<100000;offset+=500){const rows=await checked(admin.from(table).select('*').eq('user_id',user.id).range(offset,offset+499));result[table].push(...rows);if(rows.length<500)break;if(offset===99500)throw new Error('Request the full archive from support; automatic export is too large.');}
    }
    return respond(result);
   }
   if(body.action==='early_access'){
    if(body.consent===true)await checked(admin.from('early_access').upsert({user_id:user.id,consent_version:'launchpad-5-early-access-v1'}));
    else await checked(admin.from('early_access').delete().eq('user_id',user.id));
    return respond({saved:true,consent:body.consent===true});
   }
   if(body.action==='pricing_viewed'){
    if(body.consent!==true)return respond({error:'Analytics consent is required.'},400);
    await checked(admin.from('conversion_events').upsert({user_id:user.id,day:now().toISOString().slice(0,10),event:'pricing_viewed'},{onConflict:'user_id,day,event'}));return respond({recorded:true});
   }
   if(body.action==='admin'){
    const allowed=await checked(admin.from('business_admins').select('user_id').eq('user_id',user.id).maybeSingle());
    if(!allowed)return respond({error:'Administrator access required.'},403);
    return respond(await checked(admin.rpc('commercial_metrics')));
   }
   if(!['checkout','portal','cancel','cancel_now','change_plan','preview_plan'].includes(body.action))return respond({error:'Unknown billing action.'},400);
   if((!settings.enabled && !['portal','cancel','cancel_now'].includes(body.action)) || settings.environment!==environment)return respond({error:'Commercial billing is not activated. No payment was started.'},503);
   let website;try{website=new URL(site);}catch{return respond({error:'The commercial domain is not configured.'},503);}
   const local=environment==='sandbox'&&['127.0.0.1','localhost'].includes(website.hostname);
   if((website.protocol!=='https:'&&!local)||website.hostname.endsWith('github.io')||origin!==website.origin)return respond({error:'Checkout is available only on the configured commercial site.'},403);
   const customer=await checked(admin.from('billing_customers').select('*').eq('user_id',user.id).maybeSingle());
   if(customer&&customer.environment!==environment)throw new Error('Use a separate project for sandbox and production');
   const active=subs.filter(s=>['active','trialing','past_due','paused'].includes(s.status)).sort((a,b)=>b.provider_updated_at.localeCompare(a.provider_updated_at))[0];
   if(body.action==='portal'){
    if(!customer)return respond({error:'No billing customer exists yet.'},404);
    const portal=await provider(`/customers/${customer.customer_id}/portal-sessions`,'POST',{});
    const portalUrl=portal.urls?.general?.overview;
    if(!portalUrl || new URL(portalUrl).protocol!=='https:' || !['customer-portal.paddle.com','sandbox-customer-portal.paddle.com'].includes(new URL(portalUrl).hostname))throw new Error('Invalid provider portal URL');
    return respond({url:portalUrl});
   }
   const plan=body.plan;
   if(['checkout','change_plan','preview_plan'].includes(body.action)){
    if(!['pro','premium'].includes(plan)||!mapping[plan])return respond({error:'Choose a configured paid plan.'},400);
    const profile=await checked(admin.from('user_profiles').select('age_band').eq('id',user.id).single());
    if(profile.age_band!=='18+'||body.contractConsent!==true)return respond({error:'Paid subscriptions require age 18 or older and explicit agreement to billing terms. No payment was started.'},403);
    const price=await provider(`/prices/${mapping[plan]}`);
    if(price.status!=='active'||Number(price.unit_price?.amount)!==settings.plans[plan]?.monthlyCents||price.unit_price?.currency_code!=='USD'||price.billing_cycle?.interval!=='month'||price.billing_cycle?.frequency!==1)throw new Error('Paddle price differs from the reviewed catalog. Checkout is disabled.');
   }
   if(['checkout','change_plan'].includes(body.action) && (env('BILLING_LEGAL_APPROVED')!=='true' || !env('PUBLIC_SUPPORT_EMAIL') || !env('BUSINESS_NAME')))return respond({error:'The operator must configure support and approve billing/legal terms before checkout.'},503);
   const change={items:[{price_id:mapping[plan],quantity:1}],proration_billing_mode:'prorated_immediately',on_payment_failure:'prevent_change'};
   if(body.action==='preview_plan'){
    if(!active)return respond({error:'No subscription is available to change.'},404);
    const preview=await provider(`/subscriptions/${active.subscription_id}/preview`,'PATCH',change);
    return respond({preview:{immediate:preview.immediate_transaction?.details?.totals||null,next:preview.next_transaction?.details?.totals||null,currency:preview.currency_code||'USD'},notice:'The plan changes immediately; Paddle calculates proration. Review the amount before confirming.'});
   }
   if(body.action==='checkout' && customer && !active){
    const last=await checked(admin.from('billing_operations').select('*').eq('user_id',user.id).eq('action','checkout').eq('state','complete').order('created_at',{ascending:false}).limit(1).maybeSingle());
    if(last?.result?.transactionId){
     const old=await provider(`/transactions/${last.result.transactionId}`);
     if(['draft','ready','billed','paid'].includes(old.status)){
      if(last.plan!==plan)throw new Error('Finish or reconcile your existing checkout before choosing another plan.');
      return respond(last.result);
     }
     if(old.status==='completed' && !subs.some(s=>s.subscription_id===old.subscription_id && s.status==='canceled'))throw new Error('Your purchase is awaiting verified reconciliation. Refresh status before retrying.');
    }
   }
   if(body.action==='checkout'&&active)return respond({error:'Manage your existing subscription instead of starting another checkout.'},409);
   if(body.action!=='checkout'&&!active)return respond({error:'No subscription is available to change.'},404);
   if(body.action==='checkout'&&(!env('PADDLE_CLIENT_TOKEN')||!env('PADDLE_CLIENT_TOKEN').startsWith(environment==='sandbox'?'test_':'live_')))return respond({error:'The Paddle public client token is not configured.'},503);
   if(!uuid(body.requestId))return respond({error:'A valid operation ID is required.'},400);
   const reserved=await checked(admin.rpc('reserve_billing_operation',{operation_id:body.requestId,owner_id:user.id,operation:body.action,target_plan:plan||null}));
   if(reserved.cached)return respond(reserved.result);
   try{
    let result;
    if(body.action==='checkout'){
     if(active)throw new Error('Use the billing portal or plan change for your existing subscription.');
     let owner=customer;
     if(!owner){const created=await provider('/customers','POST',{email:user.email,custom_data:{launchpad_user_id:user.id}});if(!/^ctm_[a-z0-9]+$/i.test(created.id))throw new Error('Invalid customer response');owner={customer_id:created.id,user_id:user.id,environment};await checked(admin.from('billing_customers').insert(owner));}
     const transaction=await provider('/transactions','POST',{items:[{price_id:mapping[plan],quantity:1}],customer_id:owner.customer_id,collection_mode:'automatic',currency_code:'USD',custom_data:{launchpad_user_id:user.id},checkout:{url:website.href}});
     if(!/^txn_[a-z0-9]+$/i.test(transaction.id))throw new Error('Invalid transaction response');
     const clientToken=env('PADDLE_CLIENT_TOKEN');if(!clientToken||!clientToken.startsWith(environment==='sandbox'?'test_':'live_'))throw new Error('Paddle public client token is not configured');
     result={transactionId:transaction.id,clientToken,environment,notice:'Access is activated only after a verified provider webhook. Closing checkout does not confirm payment.'};
    }else{
     if(!active)throw new Error('No subscription is available to change.');
     if(body.action==='change_plan')await provider(`/subscriptions/${active.subscription_id}`,'PATCH',change);
     else await provider(`/subscriptions/${active.subscription_id}/cancel`,'POST',{effective_from:body.action==='cancel_now'?'immediately':'next_billing_period'});
     result={pending:true,notice:'Request sent to Paddle. Access and billing status update only after the verified webhook. Refresh status before retrying.'};
    }
    await checked(admin.from('billing_operations').update({state:'complete',result}).eq('id',body.requestId).eq('user_id',user.id));
    return respond(result);
   }catch(error){await admin.from('billing_operations').update({state:'uncertain',result:{notice:'Reconciliation required; do not repeat the operation blindly.'}}).eq('id',body.requestId).eq('user_id',user.id);throw error;}
  }catch(error){return respond({error:error.message || 'Billing is unavailable. No success is claimed.'},503);}
 };
}
