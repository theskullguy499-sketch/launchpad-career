const { test, expect } = require('@playwright/test');
const { configureCommercial } = require('./helpers/commercial-fixture.cjs');

test('official growth brand follows app theme, compact drawer and callback without missing assets', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('response', r => { if (r.url().startsWith('http://127.0.0.1:8000') && r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
  await page.goto('/#home');
  await expect(page.locator('.landing-brand .brand-on-light')).toBeVisible();
  await expect(page.locator('#brandLink .brand-on-light')).toBeVisible();
  await expect(page.locator('#brandLink .brand-on-dark')).toBeHidden();
  await page.click('#themeToggle');
  await expect(page.locator('.landing-brand .brand-on-dark')).toBeVisible();
  await expect(page.locator('#brandLink .brand-on-dark')).toBeVisible();
  await expect(page.locator('#brandLink .brand-on-light')).toBeHidden();
  await page.setViewportSize({ width: 375, height: 850 });
  await expect(page.locator('#mobileHeader .brand-on-dark')).toBeVisible();
  await page.click('#menuToggle');
  await expect(page.locator('#brandLink .brand-on-dark')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#menuToggle')).toBeFocused();
  // Selecting the new sidebar link must close even when its route is already active.
  for (let repeat = 0; repeat < 2; repeat++) {
    await page.click('#menuToggle');
    await page.locator('.sidebar-plan-link').click();
    await expect(page.locator('#billingView')).toBeVisible();
    await expect(page.locator('#mainNavigation')).toBeHidden();
    await expect(page.locator('#mainContent')).toBeFocused();
  }
  for (const path of ['assets/launchpad.svg' , 'assets/brand/launchpad-lockup-light.svg', 'assets/brand/launchpad-lockup-dark.svg', 'assets/brand/launchpad-lockup-light.png', 'assets/brand/launchpad-lockup-dark.png', 'assets/brand/launchpad-icon-180.png']) {
    const response = await page.request.get('/' + path);
    expect(response.ok(), path).toBeTruthy();
    if (path.endsWith('.svg')) expect(await response.text()).not.toContain('<script');
  }
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/auth/callback.html');
  await expect(page.locator('.brand-on-dark')).toBeVisible();
  await expect(page.locator('.brand-on-light')).toBeHidden();
  expect(errors).toEqual([]);
});

test('personal calendar shows only real active dates, supports month navigation and clears on account switch', async ({ page }) => {
  const { PLANS } = await import('../lib/plans.mjs');
  await configureCommercial(page, PLANS);
  const now = new Date(), y = now.getFullYear(), m = now.getMonth();
  const date = `${y}-${String(m + 1).padStart(2, '0')}-15`;
  await page.addInitScript(({ date }) => {
    localStorage.setItem('launchpad-opportunities-v1', JSON.stringify([
      { id: 'dated', company: '<Private employer>', role: 'Engineer', country: 'Other', status: 'Interview', deadline: date },
      { id: 'closed', company: 'Closed employer', role: 'Engineer', country: 'Other', status: 'Rejected', deadline: date }
    ]));
    localStorage.setItem('launchpad-workspace-v4', JSON.stringify({
      tasks: [{ id: 'open-task', title: 'Personal dated task', dueDate: date, completed: false }, { id: 'done-task', title: 'Completed task', dueDate: date, completed: true }],
      preferences: { onboarded: true }
    }));
  }, { date });
  await page.goto('/#dashboard');
  const calendar = page.locator('#careerCalendar');
  await expect(calendar.locator('time.has-career-event')).toHaveCount(1);
  await expect(calendar).toContainText('<Private employer>');
  await expect(calendar).toContainText('Personal dated task');
  await expect(calendar).not.toContainText('Closed employer');
  await expect(calendar).not.toContainText('Completed task');
  await expect(calendar.locator('employer')).toHaveCount(0);
  await calendar.getByRole('button', { name: 'Next month' }).focus();
  await page.keyboard.press('Enter');
  await expect(calendar.getByRole('button', { name: 'Next month' })).toBeFocused();
  await expect(calendar.locator('time.has-career-event')).toHaveCount(0);
  await calendar.getByRole('button', { name: 'Previous month' }).click();
  await expect(calendar.locator('time.has-career-event')).toHaveCount(1);
  await page.click('#accountBtn');
  await page.fill('#authEmail', 'buyer@example.com');
  await page.fill('#authPassword', 'test-password');
  await page.click('#authSubmit');
  await expect(page.locator('#workspaceLabel')).toContainText('Account workspace');
  await page.click('#closeAuthBtn');
  await expect(calendar).not.toContainText('<Private employer>');
  await expect(calendar).not.toContainText('Personal dated task');
  await expect(calendar.locator('time.has-career-event')).toHaveCount(0);
});


test('reference-inspired desktop rail remains readable and stacks complete cards', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/#dashboard');
  const calendar = await page.locator('#careerCalendar').boundingBox();
  const progress = await page.locator('#dashboardJourney').boundingBox();
  const schedule = await page.locator('#dashboardSchedule').boundingBox();
  const main = await page.locator('.studio-canvas').boundingBox();
  expect(calendar.width).toBeGreaterThanOrEqual(260);
  expect(calendar.x).toBeGreaterThanOrEqual(main.x + main.width);
  expect(progress.y).toBeGreaterThanOrEqual(calendar.y + calendar.height);
  expect(schedule.y).toBeGreaterThanOrEqual(progress.y + progress.height);
  expect(Math.abs(progress.width - calendar.width)).toBeLessThan(2);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
});


for (const width of [375, 768]) test(`personal calendar retains its seven-day table at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  await page.goto('/#dashboard');
  const calendar = page.locator('#careerCalendar');
  await expect(calendar.getByRole('columnheader')).toHaveCount(7);
  await expect(calendar.getByRole('columnheader').first()).toBeVisible();
  const columns = await calendar.getByRole('columnheader').evaluateAll(cells => cells.map(e => e.getBoundingClientRect().x));
  expect(columns.every((x, i) => !i || x > columns[i-1])).toBeTruthy();
  const days = await calendar.locator('tbody tr').first().locator('td').count();
  expect(days).toBe(7);
  const box = await calendar.boundingBox();
  expect(box.height).toBeLessThan(650);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
});
