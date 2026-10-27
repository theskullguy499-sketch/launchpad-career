const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {PGlite}=require('@electric-sql/pglite');
// Real PostgreSQL engine in WASM; only Supabase's auth schema/JWT context is emulated.
test('migration enforces ownership, verified users, atomic imports and cross-user foreign keys',async()=>{
 const db=new PGlite();
 const alice='00000000-0000-0000-0000-000000000001';
 const bob='00000000-0000-0000-0000-000000000002';
 const pending='00000000-0000-0000-0000-000000000003';
 try {
 await db.exec(`create role anon;create role authenticated;create schema auth;create function auth.role() returns text language sql stable as $$select current_setting('role')$$;
 create table auth.users(id uuid primary key,email_confirmed_at timestamptz);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth,public to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;
 insert into auth.users values('${alice}',now()),('${bob}',now());`);
 await db.exec(fs.readFileSync('supabase/migrations/202610270001_launchpad.sql','utf8'));
 await db.exec(`insert into auth.users values('${pending}',null)`);
 assert.equal((await db.query('select count(*)::int as n from public.user_profiles')).rows[0].n,3);
 const policies=await db.query("select relname,relrowsecurity,relforcerowsecurity from pg_class where relname in ('user_profiles','job_applications','tasks','roadmap_progress')");
 assert.equal(policies.rows.length,4);assert.ok(policies.rows.every(r=>r.relrowsecurity && r.relforcerowsecurity));
 async function as(id,role='authenticated'){await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);await db.exec(`set role ${role}`);}
 await as(alice);
 const backup={app:'launchpad',formatVersion:1,applications:[{id:'guest-one',company:'Alice Co',role:'Engineer',country:'Brazil',status:'Saved',deadline:'',url:'',notes:'Keep me'}],completed:[0,2]};
 await db.query('select public.import_guest_backup($1::jsonb)',[JSON.stringify(backup)]);
 await db.query('select public.import_guest_backup($1::jsonb)',[JSON.stringify({...backup,applications:[{...backup.applications[0],company:'Do not overwrite'}]})]);
 assert.equal((await db.query('select company from public.job_applications')).rows[0].company,'Alice Co');
 assert.equal((await db.query('select count(*)::int n from public.job_applications')).rows[0].n,1);
 const app=(await db.query('select id from public.job_applications')).rows[0].id;
 await db.query("insert into public.tasks(title,application_id) values('My task',$1)",[app]);
 await db.query("update public.user_profiles set display_name='Alice' where id=$1",[alice]);
 for(const table of ['user_profiles','job_applications','tasks','roadmap_progress']) {
   const result=await db.query(`select * from public.${table}`);assert.ok(result.rows.length>0);
 }
 // One invalid row aborts the whole import, preserving local and cloud records.
 const invalid={...backup,applications:[{...backup.applications[0],id:'partial'}, {...backup.applications[0],id:'invalid',company:''}]};
 await assert.rejects(db.query('select public.import_guest_backup($1::jsonb)',[JSON.stringify(invalid)]));
 assert.equal((await db.query('select count(*)::int n from public.job_applications')).rows[0].n,1);
 await as(bob);
 for(const table of ['job_applications','tasks','roadmap_progress']) {
   assert.equal((await db.query(`select * from public.${table}`)).rows.length,0);
   assert.equal((await db.query(`delete from public.${table} returning *`)).rows.length,0);
 }
 assert.equal((await db.query('select * from public.user_profiles')).rows[0].id,bob);
 assert.equal((await db.query("update public.job_applications set company='stolen' returning *")).rows.length,0);
 assert.equal((await db.query("update public.tasks set title='stolen' returning *")).rows.length,0);
 assert.equal((await db.query("update public.roadmap_progress set completed=false returning *")).rows.length,0);
 assert.equal((await db.query("update public.user_profiles set display_name='stolen' where id=$1 returning *",[alice])).rows.length,0);
 await assert.rejects(db.query("insert into public.job_applications(user_id,company,role,country) values($1,'Bad','Bad','Bad')",[alice]));
 await assert.rejects(db.query("insert into public.tasks(user_id,title) values($1,'Bad')",[alice]));
 await assert.rejects(db.query("insert into public.roadmap_progress(user_id,milestone_key) values($1,'bad')",[alice]));
 await assert.rejects(db.query('insert into public.user_profiles(id) values($1)',[alice]));
 await assert.rejects(db.query("insert into public.tasks(title,application_id) values('Cross-user link',$1)",[app]));
 await db.query('select public.import_guest_backup($1::jsonb)',[JSON.stringify(backup)]);
 const own=(await db.query('select id from public.job_applications')).rows[0].id;
 await assert.rejects(db.query('update public.job_applications set user_id=$1 where id=$2',[alice,own]));
 await as(pending);
 for(const table of ['user_profiles','job_applications','tasks','roadmap_progress']) assert.equal((await db.query(`select * from public.${table}`)).rows.length,0);
 await assert.rejects(db.query("insert into public.tasks(title) values('Unverified')"));
 await assert.rejects(db.query('select public.import_guest_backup($1::jsonb)',[JSON.stringify(backup)]));
 await as('', 'anon');
 for(const table of ['user_profiles','job_applications','tasks','roadmap_progress']) await assert.rejects(db.query(`select * from public.${table}`));
 await assert.rejects(db.query('select public.import_guest_backup($1::jsonb)',[JSON.stringify(backup)]));
 await as(alice);
 assert.equal((await db.query("select company from public.job_applications")).rows[0].company,'Alice Co');
 await db.query("update public.tasks set completed=true");
 assert.equal((await db.query('select completed from public.tasks')).rows[0].completed,true);
 await db.query("update public.roadmap_progress set completed=false where milestone_key='0'");
 assert.equal((await db.query("select completed from public.roadmap_progress where milestone_key='0'")).rows[0].completed,false);
 assert.equal((await db.query('delete from public.tasks returning *')).rows.length,1);
 assert.equal((await db.query('delete from public.roadmap_progress returning *')).rows.length,2);
 assert.equal((await db.query('delete from public.job_applications returning *')).rows.length,1);

 } finally {await db.close();}
});
