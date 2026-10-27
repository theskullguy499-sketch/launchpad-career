const {test}=require('node:test');const assert=require('node:assert/strict');
const validate=require('./public-config.cjs');
const source=config=>`window.LAUNCHPAD_AUTH_CONFIG=Object.freeze(${JSON.stringify(config)});`;
test('blank public configuration supports guest deployment',()=>assert.equal(validate(source({supabaseUrl:'',publishableKey:''})),'guest'));
test('only HTTPS URL and public publishable keys are accepted',()=>{
 assert.equal(validate(source({supabaseUrl:'https://example.supabase.co',publishableKey:'sb_publishable_PUBLIC_EXAMPLE'})),'configured');
 for(const config of [
  {supabaseUrl:'https://example.supabase.co',publishableKey:'sb_secret_NOT_A_REAL_KEY'},
  {supabaseUrl:'https://example.supabase.co',publishableKey:'legacy-service-role-jwt'},
  {supabaseUrl:'https://example.supabase.co',publishableKey:'sb_publishable_EXAMPLE',smtpPassword:'DO_NOT_DEPLOY'},
  {supabaseUrl:'https://user:password@example.supabase.co',publishableKey:'sb_publishable_EXAMPLE'},
  {supabaseUrl:'http://example.supabase.co',publishableKey:'sb_publishable_EXAMPLE'}
 ])assert.throws(()=>validate(source(config)));
});
