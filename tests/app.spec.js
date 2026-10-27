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
async function configureAuth(page, handler) {
  await page.route('**/auth-config.js',r=>r.fulfill({contentType:'text/javascript',body:`window.LAUNCHPAD_AUTH_CONFIG={supabaseUrl:'https://launchpad-test.supabase.co',publishableKey:'sb_publishable_testkey'};`}));
  await page.route('https://launchpad-test.supabase.co/**',handler);
}
const user={id:'00000000-0000-0000-0000-000000000001',email:'person@example.com',email_confirmed_at:'2026-01-01T00:00:00Z',aud:'authenticated',role:'authenticated'};
function tokens(confirmed=true){return {access_token:'test-access-token',refresh_token:'test-refresh-token',token_type:'bearer',expires_in:3600,user:{...user,email_confirmed_at:confirmed?user.email_confirmed_at:null}};}
test('Supabase signup uses PKCE, requests verification, and resends without saving passwords',async({page})=>{
  const requests=[];
  await configureAuth(page,r=>{requests.push({url:r.request().url(),body:r.request().postDataJSON()});return r.fulfill({json:r.request().url().includes('/signup')?{user:{...user,email_confirmed_at:null},session:null}:{}});});
  await page.goto('/');await page.click('#accountBtn');await page.click('#signUpMode');await page.fill('#authEmail',user.email);await page.fill('#authPassword','a-secure-password-123');await page.click('#authSubmit');
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
  let fail=false;await configureAuth(page,r=>fail?r.abort():r.fulfill({json:r.request().url().includes('/token')?tokens(false):{}}));
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
  await page.goto('/');await add(page,'Preserved through verification');await page.click('#accountBtn');await page.click('#signUpMode');await page.fill('#authEmail',user.email);await page.fill('#authPassword','a-secure-password-123');await page.click('#authSubmit');await expect(page.locator('#authStatus')).toContainText('verification email');
  await page.goto('/?code=test-confirmation-code');
  await expect(page.locator('#authStatus')).toContainText('Signed in as');expect(exchange.auth_code).toBe('test-confirmation-code');expect(exchange.code_verifier).toBeTruthy();await page.click('#closeAuthBtn');await expect(page.locator('td strong')).toHaveText('Preserved through verification');expect(page.url()).not.toContain('code=');
});
test('expired verification fragment is preserved for authentication and displays recovery guidance',async({page})=>{
  await configureAuth(page,r=>r.fulfill({json:{}}));
  await page.goto('/#error=access_denied&error_code=otp_expired&error_description=Email+link+expired');
  await expect(page.locator('#authDialog')).toBeVisible();await expect(page.locator('#authStatus')).toContainText('failed or expired');await expect(page.locator('#authSubmit')).toBeVisible();
});
test('registration rejects immediate sessions when server email confirmation is disabled',async({page})=>{
  await configureAuth(page,r=>r.fulfill({json:r.request().url().includes('/signup')?tokens():{}}));
  await page.goto('/');await page.click('#accountBtn');await page.click('#signUpMode');await page.fill('#authEmail',user.email);await page.fill('#authPassword','a-secure-password-123');await page.click('#authSubmit');await expect(page.locator('#authStatus')).toContainText('must be enabled');await expect(page.locator('#signOutBtn')).toBeHidden();
});
