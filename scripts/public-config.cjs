const vm=require('node:vm');
module.exports=function validatePublicConfig(source){
 const context={window:{}};
 vm.runInNewContext(source,context,{timeout:1000});
 const config=context.window.LAUNCHPAD_AUTH_CONFIG;
 if(!config || Object.keys(config).sort().join(',')!=='publishableKey,supabaseUrl')throw new Error('auth-config.js must contain only the two public configuration fields.');
 const {supabaseUrl,publishableKey}=config;
 if(supabaseUrl==='' && publishableKey==='')return 'guest';
 let url;try{url=new URL(supabaseUrl);}catch{throw new Error('Set a valid public Supabase HTTPS URL, or leave both public fields empty for guest mode.');}
 if(url.protocol!=='https:' || url.username || url.password || url.pathname!=='/' || url.search || url.hash || typeof publishableKey!=='string' || !/^sb_publishable_[A-Za-z0-9_-]+$/.test(publishableKey))throw new Error('Production config requires an HTTPS project root and a public sb_publishable_ key. Never include secret/service-role credentials.');
 return 'configured';
};
