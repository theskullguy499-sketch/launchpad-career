const fs=require('node:fs');const esbuild=require('esbuild');
const sdk=JSON.parse(fs.readFileSync('package.json','utf8')).dependencies['@supabase/supabase-js'];
const entries=['ai-coach','job-explorer','delete-account','reminder-worker','billing','paddle-webhook'].map(name=>`supabase/functions/${name}/index.ts`);
for(const file of entries)if(!fs.readFileSync(file,'utf8').includes(`npm:@supabase/supabase-js@${sdk}`))throw new Error('Server SDK pin differs from the reviewed browser SDK pin.');
esbuild.buildSync({entryPoints:entries,outdir:'unused',bundle:true,write:false,platform:'neutral',format:'esm',external:['npm:*'],logLevel:'warning'});
console.log('Validated all six Edge Function bundles and pinned SDK imports (not a live Deno deployment).');
