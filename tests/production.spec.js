const {cloudFixture}=require('./helpers/cloud-fixture.cjs');
const {test,expect}=require('@playwright/test');
const fs=require('node:fs');
const {createHash}=require('node:crypto');
const base='/launchpad-career/';
const user={id:'00000000-0000-0000-0000-000000000001',email:'production-test@example.com',email_confirmed_at:'2026-01-01T00:00:00Z',aud:'authenticated',role:'authenticated'};
const tokens=()=>({access_token:'test-access-token',refresh_token:'test-refresh-token',token_type:'bearer',expires_in:3600,user});
async function configured(page,handler){
 await page.route('**/auth-config.js',r=>r.fulfill({contentType:'text/javascript',body:"window.LAUNCHPAD_AUTH_CONFIG={supabaseUrl:'https://production-test.supabase.co',publishableKey:'sb_publishable_testkey'};"}));
 const cloud=cloudFixture();await page.route('https://production-test.supabase.co/**',async r=>{if(new URL(r.request().url()).pathname.endsWith('/user'))return r.fulfill({json:user});if(await cloud(r))return;return handler(r);});
}
function audit(page){
 const failures=[];const loaded=new Set();
 page.on('pageerror',e=>failures.push(e.message));
 page.on('requestfailed',r=>{if(r.url().startsWith('http://127.0.0.1:8001'))failures.push(r.url());});
 page.on('response',r=>{if(r.url().startsWith('http://127.0.0.1:8001')){loaded.add(new URL(r.url()).pathname);if(r.status()>=400)failures.push(`${r.status()} ${r.url()}`);}});
 return {failures,loaded};
}
async function add(page){await page.click('#addApplicationBtn');await page.fill('#company','Visible Production Company');await page.fill('#role','Engineer');await page.selectOption('#country','Brazil');await page.fill('#notes','Preserve these notes');await page.click('#submitDialogBtn');}
test('production artifact has every browser asset, correct MIME types and matching hashes',async({request})=>{
 const manifest=await (await request.get(base+'build-manifest.json')).json();
 expect(manifest.supabase).toBe('2.118.0');expect(Object.keys(manifest.files)).toContain('vendor/supabase.js');
 for(const [file,hash] of Object.entries(manifest.files)){
  const response=await request.get(base+file);expect(response.status(),file).toBe(200);
  expect(createHash('sha256').update(await response.body()).digest('hex'),file).toBe(hash);
  if(file.endsWith('.js'))expect(response.headers()['content-type']).toContain('text/javascript');
 }
 // A broken absolute-root import must fail in this server, as on project Pages.
 expect((await request.get('/vendor/supabase.js')).status()).toBe(404);
});
test('built Pages artifact loads real SDK and complete mocked email/password flows without asset errors',async({page})=>{
 const checks=audit(page);const calls=[];let reject=false;
 await configured(page,r=>{
  const path=new URL(r.request().url()).pathname;calls.push(path);
  if(path.endsWith('/token') && reject)return r.fulfill({status:400,json:{code:'invalid_credentials',message:'Invalid credentials'}});
  return r.fulfill({json:path.endsWith('/signup')?{user:{...user,email_confirmed_at:null},session:null}:path.endsWith('/token')||path.endsWith('/verify')?tokens():{}});
 });
 await page.goto(base);await add(page);await page.click('#accountBtn');await page.click('#signUpMode');await page.selectOption('#signupAge','18+');await page.check('#signupTerms');await page.fill('#authEmail',user.email);await page.fill('#authPassword','a-secure-password-123');await page.fill('#authConfirmPassword','a-secure-password-123');await page.click('#authSubmit');await expect(page.locator('#authStatus')).toContainText('verification email');
 await page.click('#resendEmailBtn');await expect(page.locator('#authStatus')).toContainText('If verification is pending');
 await page.goto(base+'auth/callback.html#token_hash=mock-verification&type=email');await expect(page.locator('#accountBtn')).toHaveText('Account ✓');
 await page.reload();await page.click('#accountBtn');await expect(page.locator('#authStatus')).toContainText('Signed in as');await page.click('#signOutBtn');await expect(page.locator('#authStatus')).toContainText('Signed out');
 await page.fill('#authEmail',user.email);await page.fill('#authPassword','a-secure-password-123');await page.click('#authSubmit');await expect(page.locator('#authStatus')).toContainText('Signed in as');await page.click('#signOutBtn');
 reject=true;await page.fill('#authPassword','wrong-password');await page.click('#authSubmit');await expect(page.locator('#authStatus')).toContainText('Sign-in failed');await expect(page.locator('#authSubmit')).toBeEnabled();await page.click('#closeAuthBtn');await expect(page.locator('td strong')).toHaveText('Visible Production Company');
 expect(calls).toContain('/auth/v1/signup');expect(calls).toContain('/auth/v1/resend');expect(calls).toContain('/auth/v1/verify');expect(checks.loaded).toContain(base+'vendor/supabase.js');expect(checks.loaded).toContain(base+'auth/callback.js');expect(checks.failures).toEqual([]);
});
test('unconfigured built site preserves guest data and complete JSON backup/restore',async({page})=>{
 const checks=audit(page);
 await page.addInitScript(()=>{if(!localStorage.getItem('launchpad-opportunities-v1'))localStorage.setItem('launchpad-opportunities-v1',JSON.stringify([{id:'original',company:'Original Guest Company',role:'Engineer',country:'Brazil',status:'Saved',notes:'Original notes',deadline:'',url:'',createdAt:'2026-01-01T00:00:00Z'}]));});
 await page.goto(base);await expect(page.locator('.local-data-notice')).toContainText('not make them private per account');await expect(page.locator('td strong')).toHaveText('Original Guest Company');await page.click('#accountBtn');await expect(page.locator('#authStatus')).toContainText('not configured');await page.click('#closeAuthBtn');
 const download=page.waitForEvent('download');await page.click('#backupBtn');const file=await download;const bytes=fs.readFileSync(await file.path());expect(JSON.parse(bytes).applications[0].notes).toBe('Original notes');
 page.once('dialog',d=>d.accept());await page.locator('#restoreFile').setInputFiles({name:'backup.json',mimeType:'application/json',buffer:bytes});await expect(page.locator('#toast')).toContainText('restored successfully');await page.reload();await expect(page.locator('td strong')).toHaveText('Original Guest Company');expect(checks.failures).toEqual([]);
});
// Assert WCAG text contrast against actual painted field/option surfaces, not just unequal colors.
async function contrast(locator,pseudo=null){return locator.evaluate((el,pseudo)=>{
 const style=getComputedStyle(el,pseudo);const rgb=s=>(s.match(/[\d.]+/g)||[]).slice(0,3).map(Number);
 const luminance=s=>rgb(s).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;}).reduce((n,v,i)=>n+v*[.2126,.7152,.0722][i],0);
 let parent=el;let background=style.backgroundColor;
 while(background==='rgba(0, 0, 0, 0)' && parent.parentElement){parent=parent.parentElement;background=getComputedStyle(parent).backgroundColor;}
 const fg=luminance(style.webkitTextFillColor||style.color),bg=luminance(background);
 return (Math.max(fg,bg)+.05)/(Math.min(fg,bg)+.05);
},pseudo);}
for(const browserMode of ['light','dark'])for(const appMode of ['light','dark'])test(`painted fields readable: browser ${browserMode}, app ${appMode}`,async({page})=>{
 await page.emulateMedia({colorScheme:browserMode});await configured(page,r=>r.fulfill({json:{}}));await page.goto(base);
 if(appMode==='dark')await page.click('#themeToggle');
 for(const id of ['statusFilter','sortSelect','searchInput'])expect(await contrast(page.locator('#'+id)),id).toBeGreaterThanOrEqual(4.5);
 for(const id of ['statusFilter','sortSelect'])expect(await contrast(page.locator('#'+id+' option').first()),id+' option').toBeGreaterThanOrEqual(4.5);
 await page.fill('#searchInput','Company');await page.fill('#searchInput','');await page.click('#addApplicationBtn');
 for(const [id,value] of [['company','Visible Company'],['role','Engineer'],['notes','Visible notes'],['url','https://example.com']])await page.fill('#'+id,value);
 await page.selectOption('#country','Brazil');
 for(const id of ['company','role','country','status','deadline','url','notes'])expect(await contrast(page.locator('#'+id)),id).toBeGreaterThanOrEqual(4.5);
 expect(await contrast(page.locator('#country option').last())).toBeGreaterThanOrEqual(4.5);
 for(const id of ['company','role','url','notes'])expect(await contrast(page.locator('#'+id),'::placeholder'),id+' placeholder').toBeGreaterThanOrEqual(4.5);await page.screenshot({path:`test-results/production-fields-${browserMode}-${appMode}.png`,fullPage:true});
 await page.click('#submitDialogBtn');await expect(page.locator('td strong')).toHaveText('Visible Company');expect(await contrast(page.locator('td strong'))).toBeGreaterThanOrEqual(4.5);
 await page.click('#accountBtn');await page.click('#signUpMode');await page.selectOption('#signupAge','18+');await page.check('#signupTerms');for(const id of ['authEmail','authPassword','authConfirmPassword'])expect(await contrast(page.locator('#'+id)),id).toBeGreaterThanOrEqual(4.5);
});
test('storage failure never reports a successful save or loses previous records',async({page})=>{
 await page.goto(base);await add(page);
 await page.evaluate(()=>{const set=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key==='launchpad-opportunities-v1')throw new DOMException('Quota exceeded','QuotaExceededError');return set.call(this,key,value);};});
 await page.getByRole('button',{name:'Edit',exact:true}).click();await page.fill('#company','Must not replace original');await page.click('#submitDialogBtn');await expect(page.locator('#applicationDialog')).toBeVisible();await expect(page.locator('#toast')).toContainText('No changes were saved');await page.click('#cancelDialogBtn');await expect(page.locator('td strong')).toHaveText('Visible Production Company');
 page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'Delete',exact:true}).click();await expect(page.locator('td strong')).toHaveText('Visible Production Company');
 const dl=page.waitForEvent('download');await page.click('#backupBtn');const file=await dl;expect(JSON.parse(fs.readFileSync(await file.path(),'utf8')).applications[0].company).toBe('Visible Production Company');
 await page.reload();await expect(page.locator('td strong')).toHaveText('Visible Production Company');
});
test('JSON restore rolls back the first write if roadmap persistence fails',async({page})=>{
 await page.goto(base);await add(page);
 const original=await page.evaluate(()=>localStorage.getItem('launchpad-opportunities-v1'));
 await page.evaluate(()=>{const set=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key==='launchpad-roadmap-v1')throw new DOMException('Quota exceeded','QuotaExceededError');return set.call(this,key,value);};});
 const backup={app:'launchpad',formatVersion:1,applications:[{id:'new',company:'Replacement',role:'Engineer',country:'Brazil',status:'Saved'}],completed:[0]};
 page.once('dialog',d=>d.accept());await page.locator('#restoreFile').setInputFiles({name:'restore.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(backup))});await expect(page.locator('#toast')).toContainText('No changes were saved');await expect(page.locator('td strong')).toHaveText('Visible Production Company');expect(await page.evaluate(()=>localStorage.getItem('launchpad-opportunities-v1'))).toBe(original);
 await page.reload();await expect(page.locator('td strong')).toHaveText('Visible Production Company');
});
test('all v4 routes, static styles/modules/logo and legal pages load from the built Pages artifact',async({page,request})=>{
 const checks=audit(page);await page.goto(base);
 for(const view of ['home','dashboard','companies','jobs','roadmap','coach','analytics','settings','applications']){await page.locator(`.nav-list [data-view="${view}"]`).click();await expect(page.locator('#'+view+'View')).toBeVisible();}
 for(const file of ['tracker.js','platform.js','styles/platform.css','assets/launchpad.svg','lib/model.mjs','lib/workspace.mjs','data/companies.mjs','legal/privacy.html','legal/terms.html'])expect((await request.get(base+file)).status(),file).toBe(200);
 expect(checks.loaded).toContain(base+'styles/platform.css');expect(checks.loaded).toContain(base+'platform.js');expect(checks.failures).toEqual([]);
});

test('mobile Pages drawer works with touch and deploys its navigation module', async ({ browser, request }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
  try {
    const page = await context.newPage();
    const checks = audit(page);
    await page.goto(base + '#home');
    for (const view of ['applications', 'companies', 'jobs', 'roadmap', 'coach', 'settings']) {
      await page.locator('#menuToggle').tap();
      await page.locator(`.nav-list [data-view="${view}"]`).tap();
      await expect(page.locator(`#${view}View`)).toBeVisible();
      await expect(page.locator('#menuToggle')).toHaveAttribute('aria-expanded', 'false');
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
    expect((await request.get(base + 'navigation.js')).status()).toBe(200);
    expect(checks.loaded).toContain(base + 'navigation.js');
    expect(checks.failures).toEqual([]);
  } finally { await context.close(); }
});
test('commercial RC routes and assets load under the Pages prefix without activating billing',async({page,request})=>{
 const checks=audit(page);await page.goto(base+'#billing');await expect(page.locator('#pricingCards .pricing-card')).toHaveCount(3);await expect(page.locator('#billingMode')).toContainText('not activated');
 for(const file of ['commerce.js','lib/plans.mjs','legal/billing.html','assets/dashboard-preview.jpg','_headers'])expect((await request.get(base+file)).status(),file).toBe(200);
 await page.evaluate(()=>window.launchpadData.navigate('business'));await expect(page.locator('#businessMetrics .metric-card')).toHaveCount(0);expect(checks.failures).toEqual([]);
});
