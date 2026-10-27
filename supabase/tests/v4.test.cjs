const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const {PGlite}=require('@electric-sql/pglite');
test('v4 private workspaces, CAS conflicts, non-destructive migration, owned tables and server budgets',async()=>{
 const db=new PGlite();const a='00000000-0000-0000-0000-000000000001',b='00000000-0000-0000-0000-000000000002',pending='00000000-0000-0000-0000-000000000003';
 try{
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key,email_confirmed_at timestamptz);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth,public to authenticated,anon,service_role;grant execute on function auth.uid() to authenticated,anon,service_role;insert into auth.users values('${a}',now()),('${b}',now()),('${pending}',null);`);
 for(const file of fs.readdirSync('supabase/migrations').sort())await db.exec(fs.readFileSync('supabase/migrations/'+file,'utf8'));
 let activeUser;const role=async(id,r='authenticated')=>{activeUser=id;await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);await db.exec('set role '+r);};
 const load=async()=>JSON.parse(JSON.stringify((await db.query('select public.load_workspace() data')).rows[0].data));
 const commit=async(payload,revision)=>db.query('select public.commit_workspace($1::jsonb,$2,$3) revision',[JSON.stringify(payload),revision,activeUser]);
 await role(a);let own=await load();assert.deepEqual(own.applications,[]);assert.equal(own.revision,0);
 own.profile={display_name:'Alice',title:'Engineer',age_band:'18+'};own.applications=[{id:'guest-original',company:'Alice Company',role:'Engineer',country:'Brazil',status:'Hired',notes:'Keep me',arrangement:'Remote',salaryMin:'50000',salaryMax:'70000'}];
 own.tasks=[{id:'task-one',title:'Practice interview',dueDate:'2027-01-01',completed:false}];own.companies=[{id:'google',name:'Google',favorite:true}];own.goals=[{id:'goal-one',title:'My goal',targetRole:'Engineer'}];own.milestones=[{id:'milestone-one',title:'My project',completed:false}];
 await assert.rejects(db.query('select public.commit_workspace($1::jsonb,0,$2)',[JSON.stringify(own),b]),/Account changed/);
 await commit(own,0);own=await load();assert.equal(own.revision,1);assert.equal(own.applications[0].salaryMin,'50000');
 await assert.rejects(commit({...own,applications:[]},0),/changed in another tab/);assert.equal((await load()).applications.length,1);
 const guest={...own,applications:[{...own.applications[0],company:'Must not overwrite'},{id:'new-guest',company:'New import',role:'Developer',country:'Brazil',status:'Saved'}],completed:[0]};
 for(let i=0;i<2;i++)await db.query('select public.import_guest_workspace($1::jsonb,$2)',[JSON.stringify(guest),a]);
 own=await load();assert.equal(own.applications.length,2);assert.equal(own.applications.find(x=>x.id==='guest-original').company,'Alice Company');assert.equal(own.tasks.length,1);
 await assert.rejects(db.query('select public.import_guest_workspace($1::jsonb,$2)',[JSON.stringify(guest),b]),/Account changed/);
 for(const [table,data]of [['ai_planning_history',{prompt:'Private',response:'Private'}],['notifications',{title:'Private'}],['feedback',{message:'Private'}]])await db.query(`insert into public.${table}(client_id,data) values('private',$1::jsonb)`,[JSON.stringify(data)]);
 await role(b);let other=await load();assert.equal(other.applications.length,0);assert.equal(other.companies.length,0);
 for(const table of ['favorite_companies','career_goals','roadmap_milestones','ai_planning_history','notifications','feedback']){
  const valid=table==='favorite_companies'?{name:'Other'}:table==='feedback'?{message:'Other'}:{title:'Other'};
  await assert.rejects(db.query(`insert into public.${table}(user_id,client_id,data) values($1,'stolen',$2::jsonb)`,[a,JSON.stringify(valid)]),/row-level security/);
  assert.equal((await db.query(`select * from public.${table} where user_id=$1`,[a])).rows.length,0);
  assert.equal((await db.query(`delete from public.${table} where user_id=$1 returning *`,[a])).rows.length,0);
 }
 await assert.rejects(db.query('select public.reserve_ai_usage($1)',[a]));await assert.rejects(db.query('select public.reserve_job_refresh()'));
 await assert.rejects(db.query('select * from public.provider_cache'));await assert.rejects(db.query('select * from public.service_usage'));await assert.rejects(db.query('select * from public.ai_global_usage'));await assert.rejects(db.query('select * from public.reminder_outbox'));await assert.rejects(db.query('select public.claim_reminder_emails()'));
 await role(pending);await assert.rejects(load());await role('','anon');await assert.rejects(load());
 await role('','service_role');for(let i=1;i<=10;i++)assert.equal((await db.query('select public.reserve_ai_usage($1) n',[a])).rows[0].n,i);await assert.rejects(db.query('select public.reserve_ai_usage($1)',[a]),/Daily AI limit/);
 await db.query('update public.ai_global_usage set requests=100');await assert.rejects(db.query('select public.reserve_ai_usage($1)',[a]),/platform AI capacity/);
 await db.query("insert into public.reminder_outbox(user_id,payload) values($1,'[]')",[a]);assert.equal((await db.query('select * from public.claim_reminder_emails()')).rows.length,1);assert.equal((await db.query('select * from public.claim_reminder_emails()')).rows.length,0);
 for(let i=0;i<2;i++){await db.query("update public.reminder_outbox set next_attempt_at=now()-interval '1 minute'");assert.equal((await db.query('select * from public.claim_reminder_emails()')).rows.length,1);}
 await db.query("update public.reminder_outbox set next_attempt_at=now()-interval '1 minute'");assert.equal((await db.query('select * from public.claim_reminder_emails()')).rows.length,0);
 assert.equal((await db.query('select public.reserve_job_refresh() allowed')).rows[0].allowed,true);assert.equal((await db.query('select public.reserve_job_refresh() allowed')).rows[0].allowed,false);
 await role(a);own=await load();await commit({...own,applications:[],tasks:[],companies:[],goals:[],milestones:[]},own.revision);assert.equal((await load()).applications.length,0);
 await role('','service_role');await db.exec('reset role');await db.query('delete from auth.users where id=$1',[a]);assert.equal((await db.query('select count(*)::int n from public.job_applications where user_id=$1',[a])).rows[0].n,0);
 }finally{await db.close();}
});
