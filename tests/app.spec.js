const {cloudFixture}=require('./helpers/cloud-fixture.cjs');
const { test, expect } = require('@playwright/test');
const company = 'International Technology and Career Development Company '.repeat(2).slice(0,80);
async function add(page, name = company) {
  await page.click('#addApplicationBtn');
  await page.fill('#company',name);await page.fill('#role','Senior software developer');
  await page.selectOption('#country','Brazil');await page.fill('#notes','Important notes');
  await page.click('#submitDialogBtn');
}
for(const width of [320,375,768,1024,1440]) {
  test(`content and fields remain visible at ${width}px`,async({page})=>{
    await page.setViewportSize({width,height:900});await page.goto('/');await add(page);
    await expect(page.locator('td strong')).toHaveText(company);
    const geometry = await page.locator('td strong').evaluate(el=>({fits:el.scrollWidth<=el.clientWidth, width:el.getBoundingClientRect().width}));
    expect(geometry.fits).toBe(true);expect(geometry.width).toBeGreaterThan(100);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.getByRole('button',{name:'Edit',exact:true}).click();
    for (const id of ['company','role','country','status','deadline','url','notes']) {
      const field=page.locator(`#${id}`);await expect(field).toBeVisible();
      expect(await field.evaluate(el=>el.getBoundingClientRect().right<=innerWidth)).toBe(true);
      expect(await field.evaluate(el=>getComputedStyle(el).color!==getComputedStyle(el).backgroundColor)).toBe(true);
    }
    await page.click('#cancelDialogBtn');
    await page.screenshot({path:`test-results/layout-${width}.png`,fullPage:true});
  });
}
test('existing local data survives account interactions, reload, edit, filters and theme',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{
    if(!localStorage.getItem('launchpad-opportunities-v1'))localStorage.setItem('launchpad-opportunities-v1',JSON.stringify([{id:'old',company:'Existing Company',role:'Engineer',country:'Japan',status:'Saved',deadline:'',notes:'Existing notes',url:'',createdAt:'2026-01-01T00:00:00Z'}]));
  });
  await page.goto('/');await expect(page.locator('td strong')).toHaveText('Existing Company');
  await page.click('#accountBtn');await expect(page.locator('#authStatus')).toContainText('not configured');await page.click('#closeAuthBtn');
  await page.getByRole('button',{name:'Edit',exact:true}).click();await expect(page.locator('#country')).toHaveValue('Japan');await page.selectOption('#status','Interview');await page.click('#submitDialogBtn');
  await page.fill('#searchInput','does not match');await expect(page.locator('#noMatches')).toBeVisible();await page.fill('#searchInput','Existing');
  await page.selectOption('#statusFilter','Interview');await expect(page.locator('#statInterviews')).toHaveText('1');
  await page.click('#themeToggle');await page.reload();await expect(page.locator('body')).toHaveClass('dark');
  await expect(page.locator('td strong')).toHaveText('Existing Company');
  await page.locator('[data-view="roadmap"]').click();await page.locator('#milestoneList input').first().check();await page.reload();await expect(page.locator('#milestoneList input').first()).toBeChecked();
  expect(errors).toEqual([]);
});
test('CSV, JSON backup/restore and delete keep working',async({page})=>{
  await page.goto('/');await add(page,'=SUM(1,2)');
  const csvPromise=page.waitForEvent('download');await page.click('#exportBtn');const csv=await csvPromise;
  const fs=require('node:fs');expect(fs.readFileSync(await csv.path(),'utf8')).toContain("'=SUM(1,2)");
  const backupPromise=page.waitForEvent('download');await page.click('#backupBtn');const backup=await backupPromise;
  const contents=fs.readFileSync(await backup.path());expect(JSON.parse(contents).applications[0].company).toBe('=SUM(1,2)');
  page.on('dialog',d=>d.accept());await page.getByRole('button',{name:'Delete',exact:true}).click();await expect(page.locator('#statTotal')).toHaveText('0');
  await page.locator('#restoreFile').setInputFiles({name:'backup.json',mimeType:'application/json',buffer:contents});
  await expect(page.locator('#statTotal')).toHaveText('1');await expect(page.locator('td strong')).toHaveText('=SUM(1,2)');
});
test('invalid form and unsafe links are rejected; HTML is rendered as text',async({page})=>{
  await page.goto('/');await page.click('#addApplicationBtn');await page.click('#submitDialogBtn');await expect(page.locator('#formError')).toBeVisible();
  await page.fill('#company','<img src=x onerror=alert(1)>');await page.fill('#role','Engineer');await page.selectOption('#country','Brazil');await page.fill('#url','javascript:alert(1)');await page.click('#submitDialogBtn');await expect(page.locator('#formError')).toContainText('http');
  await page.fill('#url','');await page.click('#submitDialogBtn');await expect(page.locator('td strong')).toHaveText('<img src=x onerror=alert(1)>');await expect(page.locator('td img')).toHaveCount(0);
});
async function configureAuth(page, handler, confirmed=true) {
  await page.route('**/auth-config.js',r=>r.fulfill({contentType:'text/javascript',body:`window.LAUNCHPAD_AUTH_CONFIG={supabaseUrl:'https://launchpad-test.supabase.co',publishableKey:'sb_publishable_testkey'};`}));
  const cloud=cloudFixture();
  await page.route('https://launchpad-test.supabase.co/**',async r=>{if(new URL(r.request().url()).pathname === '/auth/v1/user')return r.fulfill({json:{...user,email_confirmed_at:confirmed?user.email_confirmed_at:null}});if(await cloud(r))return;return handler(r);});
}
const user={id:'00000000-0000-0000-0000-000000000001',email:'person@example.com',email_confirmed_at:'2026-01-01T00:00:00Z',aud:'authenticated',role:'authenticated'};
function tokens(confirmed=true){return {access_token:'test-access-token',refresh_token:'test-refresh-token',token_type:'bearer',expires_in:3600,user:{...user,email_confirmed_at:confirmed?user.email_confirmed_at:null}};}
test('Supabase signup uses PKCE, requests verification, and resends without saving passwords',async({page})=>{
  const requests=[];
  await configureAuth(page,r=>{requests.push({url:r.request().url(),body:r.request().postDataJSON()});return r.fulfill({json:r.request().url().includes('/signup')?{user:{...user,email_confirmed_at:null},session:null}:{}});});
  await page.goto('/');await page.click('#accountBtn');await page.click('#signUpMode');await page.selectOption('#signupAge','18+');await page.check('#signupTerms');await page.fill('#authEmail',user.email);await page.fill('#authPassword','a-secure-password-123');await page.fill('#authConfirmPassword','a-secure-password-123');await page.click('#authSubmit');
  await expect(page.locator('#authStatus')).toContainText('verification email');
  const signup=requests.find(r=>r.url.includes('/signup'));expect(signup.body.code_challenge).toBeTruthy();expect(signup.body.code_challenge_method).toBe('s256');expect(signup.url).toContain('redirect_to=');
  await expect(page.locator('#authPassword')).toHaveValue('');
  await page.click('#resendEmailBtn');await expect(page.locator('#authStatus')).toContainText('If verification is pending');
  expect(await page.evaluate(()=>JSON.stringify(localStorage))).not.toContain('a-secure-password-123');
});
test('verified sign-in and sign-out preserve opportunities',async({page})=>{
  await configureAuth(page,r=>r.fulfill({json:r.request().url().includes('/token')?tokens():{}}));
  await page.goto('/');await add(page,'Keep this company');await page.click('#accountBtn');await page.fill('#authEmail',user.email);await page.fill('#authPassword','password');await page.click('#authSubmit');
  await expect(page.locator('#authStatus')).toContainText('Signed in as');await page.click('#signOutBtn');await expect(page.locator('#authStatus')).toContainText('local data is unchanged');await page.click('#closeAuthBtn');await page.reload();await expect(page.locator('td strong')).toHaveText('Keep this company');
});
test('unverified sign-in is rejected and network errors are recoverable',async({page})=>{
  let fail=false;await configureAuth(page,r=>fail?r.abort():r.fulfill({json:r.request().url().includes('/token')?tokens(false):{}}),false);
  await page.goto('/');await page.click('#accountBtn');await page.fill('#authEmail',user.email);await page.fill('#authPassword','password');await page.click('#authSubmit');await expect(page.locator('#authStatus')).toContainText('Verify your email');await expect(page.locator('#signOutBtn')).toBeHidden();
  fail=true;await page.fill('#authPassword','password');await page.click('#authSubmit');await expect(page.locator('#authStatus')).toContainText(/failed|Unable/);await expect(page.locator('#authSubmit')).toBeEnabled();
});

test('PKCE verification callback establishes a confirmed session without touching local records',async({page})=>{
  let exchange;
  await configureAuth(page,r=>{
    const url=r.request().url();
    if(url.includes('/token')) {exchange=r.request().postDataJSON();return r.fulfill({json:tokens()});}
    return r.fulfill({json:url.includes('/user')?user:{user:{...user,email_confirmed_at:null},session:null}});
  });
  await page.goto('/');await add(page,'Preserved through verification');await page.click('#accountBtn');await page.click('#signUpMode');await page.selectOption('#signupAge','18+');await page.check('#signupTerms');await page.fill('#authEmail',user.email);await page.fill('#authPassword','a-secure-password-123');await page.fill('#authConfirmPassword','a-secure-password-123');await page.click('#authSubmit');await expect(page.locator('#authStatus')).toContainText('verification email');
  await page.goto('/auth/callback.html?code=test-confirmation-code');
  await expect(page.locator('#authStatus')).toContainText(/verified|Signed in as/);expect(exchange.auth_code).toBe('test-confirmation-code');expect(exchange.code_verifier).toBeTruthy();if(await page.locator('#authDialog').isVisible()) await page.click('#closeAuthBtn');await page.click('#useGuestBtn');await expect(page.locator('td strong')).toHaveText('Preserved through verification');expect(page.url()).not.toContain('code=');
});
test('expired verification fragment is preserved for authentication and displays recovery guidance',async({page})=>{
  await configureAuth(page,r=>r.fulfill({json:{}}));
  await page.goto('/auth/callback.html#error=access_denied&error_code=otp_expired&error_description=Email+link+expired');
  await expect(page.locator('#callbackStatus')).toContainText('invalid, expired');expect(page.url()).not.toContain('error_description');await page.getByRole('link',{name:'Return to Launchpad'}).click();await page.click('#accountBtn');await expect(page.locator('#authSubmit')).toBeVisible();
});
test('registration rejects immediate sessions when server email confirmation is disabled',async({page})=>{
  await configureAuth(page,r=>r.fulfill({json:r.request().url().includes('/signup')?tokens():{}}));
  await page.goto('/');await page.click('#accountBtn');await page.click('#signUpMode');await page.selectOption('#signupAge','18+');await page.check('#signupTerms');await page.fill('#authEmail',user.email);await page.fill('#authPassword','a-secure-password-123');await page.fill('#authConfirmPassword','a-secure-password-123');await page.click('#authSubmit');await expect(page.locator('#authStatus')).toContainText('must be enabled');await expect(page.locator('#signOutBtn')).toBeHidden();
});

test('forgot password and emailed recovery link reset password without changing guest records',async({page})=>{
  const requests=[];
  await configureAuth(page,r=>{
    requests.push({url:r.request().url(),body:r.request().postDataJSON()});
    return r.fulfill({json:r.request().url().includes('/verify')?tokens():{}});
  });
  // Capture PUT while continuing to use the actual SDK.
  await page.route('https://launchpad-test.supabase.co/auth/v1/user',r=>{
    if(r.request().method()==='PUT') requests.push({url:r.request().url(),body:r.request().postDataJSON()});
    return r.fulfill({json:user});
  });
  await page.goto('/');await add(page,'Keep guest data');await page.click('#accountBtn');await page.click('#forgotPasswordBtn');
  await page.fill('#authEmail',user.email);await page.click('#authSubmit');await expect(page.locator('#authStatus')).toContainText('If an account exists');
  expect(requests.find(r=>r.url.includes('/recover')).url).toContain(encodeURIComponent('/auth/callback.html'));
  await page.goto('/auth/callback.html#token_hash=one-time-recovery-hash&type=recovery');
  await expect(page.locator('#authTitle')).toHaveText('Reset your password');await expect(page.locator('#authDialog')).toBeVisible();
  expect(requests.find(r=>r.url.includes('/verify')).body).toMatchObject({token_hash:'one-time-recovery-hash',type:'recovery'});
  expect(page.url()).not.toContain('token_hash');
  await page.fill('#authPassword','new-secure-password-456');await page.fill('#authConfirmPassword','different-password');await page.click('#authSubmit');await expect(page.locator('#authStatus')).toContainText('passwords do not match');
  await page.fill('#authConfirmPassword','new-secure-password-456');await page.click('#authSubmit');await expect(page.locator('#authStatus')).toContainText('password was updated');
  expect(requests.find(r=>r.body?.password).body.password).toBe('new-secure-password-456');
  expect(await page.evaluate(()=>JSON.stringify(localStorage))).not.toContain('new-secure-password');
  await expect(page.locator('#authPassword')).toHaveValue('');await page.click('#closeAuthBtn');await expect(page.locator('td strong')).toHaveText('Keep guest data');
});
test('email-token confirmation works on a new browser context without a PKCE verifier',async({page})=>{
  let verify;
  await configureAuth(page,r=>{verify=r.request().postDataJSON();return r.fulfill({json:tokens()});});
  await page.goto('/auth/callback.html#token_hash=one-time-confirmation&type=email');
  await expect(page.locator('#accountBtn')).toHaveText('Account ✓');expect(verify).toMatchObject({token_hash:'one-time-confirmation',type:'email'});expect(page.url()).not.toContain('token_hash');
  await page.reload();await page.click('#accountBtn');await expect(page.locator('#authStatus')).toContainText('Signed in as');
});
test('expired email tokens and fabricated reset query never allow password update',async({page})=>{
  await configureAuth(page,r=>r.fulfill({status:403,json:{code:'otp_expired',message:'Token has expired'}}));
  await page.goto('/auth/callback.html#token_hash=expired&type=recovery');await expect(page.locator('#callbackStatus')).toContainText('invalid, expired');
  await page.goto('/?auth=recovery');await expect(page.locator('#authTitle')).not.toHaveText('Reset your password');await expect(page.locator('#authSubmit')).toHaveText('Sign in');
});
test('friendly validation rejects invalid email, weak passwords and mismatched confirmation',async({page})=>{
  let requests=0;await configureAuth(page,r=>{requests++;return r.fulfill({json:{}});});
  await page.goto('/');await page.click('#accountBtn');await page.click('#signUpMode');await page.selectOption('#signupAge','18+');await page.check('#signupTerms');await page.fill('#authEmail','not-an-email');await page.click('#authSubmit');await expect(page.locator('#authStatus')).toContainText('valid email');
  await page.fill('#authEmail',user.email);await page.fill('#authPassword','short');await page.click('#authSubmit');await expect(page.locator('#authStatus')).toContainText('at least 12');
  await page.fill('#authPassword','a-secure-password-123');await page.fill('#authConfirmPassword','different-password');await page.click('#authSubmit');await expect(page.locator('#authStatus')).toContainText('passwords do not match');expect(requests).toBe(0);
});
test('rate limits produce friendly guidance and allow retry',async({page})=>{
  await configureAuth(page,r=>r.fulfill({status:429,json:{code:'over_email_send_rate_limit',message:'rate limit'}}));
  await page.goto('/');await page.click('#accountBtn');await page.fill('#authEmail',user.email);await page.click('#resendEmailBtn');await expect(page.locator('#authStatus')).toContainText('Too many attempts');await expect(page.locator('#resendEmailBtn')).toBeEnabled();
});
test('cloud copy is explicit, additive, and keeps guest data separate',async({page})=>{
 const imports=[];page.on('request',r=>{if(r.url().includes('/rpc/import_guest_workspace'))imports.push(r.postDataJSON());});
 await configureAuth(page,r=>r.fulfill({json:r.request().url().includes('/token')?tokens():{}}));
 await page.goto('/');await add(page,'Local Company');await page.click('#accountBtn');await page.fill('#authEmail',user.email);await page.fill('#authPassword','password');await page.click('#authSubmit');await expect(page.locator('#syncStatus')).toContainText('Cloud workspace loaded');expect(imports).toHaveLength(0);
 page.once('dialog',d=>d.dismiss());await page.click('#saveCloudBtn');expect(imports).toHaveLength(0);
 page.once('dialog',d=>d.accept());await page.click('#saveCloudBtn');await expect.poll(()=>imports.length).toBe(1);await expect(page.locator('#syncStatus')).toContainText('Cloud workspace loaded');expect(imports[0].guest.applications[0].company).toBe('Local Company');
 const dl=page.waitForEvent('download');await page.click('#downloadCloudBtn');const file=await dl;const backup=JSON.parse(require('node:fs').readFileSync(await file.path(),'utf8'));expect(backup.applications[0].company).toBe('Local Company');
 await page.click('#closeAuthBtn');await page.click('#useGuestBtn');await expect(page.locator('td strong')).toHaveText('Local Company');
});
test('GitHub Pages subpath uses a real static callback and fixed return path',async({page})=>{
  const path=require('node:path');
  await page.route('http://127.0.0.1:8000/launchpad-career/**',r=>{
    const relative=new URL(r.request().url()).pathname.slice('/launchpad-career/'.length)||'index.html';
    return r.fulfill({path:path.join(process.cwd(),relative)});
  });
  let signup;
  await configureAuth(page,r=>{
    if(r.request().url().includes('/signup')) {signup=r.request().url();return r.fulfill({json:{user:{...user,email_confirmed_at:null},session:null}});}
    return r.fulfill({json:tokens()});
  });
  await page.goto('/launchpad-career/');await page.click('#accountBtn');await page.click('#signUpMode');await page.selectOption('#signupAge','18+');await page.check('#signupTerms');await page.fill('#authEmail',user.email);await page.fill('#authPassword','a-secure-password-123');await page.fill('#authConfirmPassword','a-secure-password-123');await page.click('#authSubmit');await expect(page.locator('#authStatus')).toContainText('verification email');
  expect(new URL(signup).searchParams.get('redirect_to')).toBe('http://127.0.0.1:8000/launchpad-career/auth/callback.html');
  await page.goto('/launchpad-career/auth/callback.html#token_hash=confirmation&type=email&next=https://attacker.example');
  await expect(page.locator('#accountBtn')).toHaveText('Account ✓');await expect(page).toHaveURL(/127\.0\.0\.1:8000\/launchpad-career\//);
});
test('client rejects service-role keys and keeps guest mode available',async({page})=>{
  await page.route('**/auth-config.js',r=>r.fulfill({contentType:'text/javascript',body:`window.LAUNCHPAD_AUTH_CONFIG={supabaseUrl:'https://launchpad-test.supabase.co',publishableKey:'sb_secret_DO_NOT_USE'};`}));
  await page.goto('/');await page.click('#accountBtn');await expect(page.locator('#authStatus')).toContainText('not configured');await page.click('#closeAuthBtn');await add(page,'Still a guest');await expect(page.locator('td strong')).toHaveText('Still a guest');
});
test('account form remains readable on a narrow screen',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.setViewportSize({width:320,height:900});await configureAuth(page,r=>r.fulfill({json:{}}));
  await page.goto('/');await page.click('#accountBtn');await page.click('#signUpMode');await page.selectOption('#signupAge','18+');await page.check('#signupTerms');
  for(const field of ['authEmail','authPassword','authConfirmPassword']) await expect(page.locator(`#${field}`)).toBeVisible();
  expect(await page.locator('#authDialog').evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
  await page.screenshot({path:'test-results/account-320.png',fullPage:true});
  await page.click('#forgotPasswordBtn');await expect(page.locator('#authEmail')).toBeVisible();await expect(page.locator('#authPasswordLabel')).toBeHidden();expect(errors).toEqual([]);
});
