import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(await readFile(path.join(repoRoot, 'package.json'), 'utf8'));

const portsByRepo = {
  'upi-flowpilot': 5101,
  'bharat-upi-interdict': 5102,
  'cashflow-memory-for-bharat': 5103,
  'upi-guardian-mode': 5104,
  'upi-social-proof-ledger': 5105,
  'upi-cognitive-spend-brake': 5106
};

const frontendUrl = process.env.E2E_URL ?? `http://127.0.0.1:${portsByRepo[pkg.name] ?? 5101}`;

function chromeExecutable() {
  if (process.env.CHROME_PATH) {
    return process.env.CHROME_PATH;
  }
  const candidates = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser'
  ];
  return candidates.find((candidate) => existsSync(candidate));
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function waitForNotice(page, text) {
  await page.locator('.notice').filter({ hasText: text }).waitFor({ timeout: 10000 });
}

async function clickAction(page, index, name) {
  const action = page.locator('.simulator-row button').nth(index);
  await action.waitFor({ state: 'visible', timeout: 10000 });
  await action.click();
  return name;
}

const executablePath = chromeExecutable();
assert(executablePath, 'Chrome executable not found. Set CHROME_PATH to run local E2E.');

const browser = await chromium.launch({ executablePath, headless: process.env.HEADED !== '1' });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const consoleIssues = [];

page.on('console', (message) => {
  const text = message.text();
  const expectedNetworkNoise = /Failed to load resource: the server responded with a status of (403|404)/.test(text);
  if (['error', 'warning'].includes(message.type()) && !expectedNetworkNoise) {
    consoleIssues.push(`${message.type()}: ${message.text()}`);
  }
});
page.on('pageerror', (error) => consoleIssues.push(`pageerror: ${error.message}`));

try {
  await page.goto(frontendUrl, { waitUntil: 'networkidle' });

  const title = await page.title();
  const h1 = await page.locator('h1').innerText();
  assert(h1.length > 0, 'App shell did not render a heading.');
  assert(!/vite|webpack|runtime error/i.test(await page.locator('body').innerText()), 'Framework error overlay detected.');

  const navItems = page.locator('.nav-item');
  const navCount = await navItems.count();
  assert(navCount >= 4, 'Expected sidebar tabs to render.');
  for (let index = 0; index < navCount; index += 1) {
    const tab = navItems.nth(index);
    await tab.click();
    await page.waitForTimeout(80);
    assert(await tab.getAttribute('aria-pressed') === 'true', `Sidebar tab ${index + 1} did not become active.`);
  }

  await page.getByLabel('RBAC role').selectOption('ADMIN');
  await page.getByRole('button', { name: 'Refresh' }).click();
  await waitForNotice(page, 'Loaded live synthetic API data');

  await clickAction(page, 0, 'domain decision');
  await page.waitForFunction(() => {
    const result = document.querySelector('.recommendation-card strong');
    return result && result.textContent && !result.textContent.includes('Run model');
  }, { timeout: 10000 });

  await clickAction(page, 1, 'mock UPI');
  await page.locator('.mock-card').filter({ hasText: 'RRN:' }).waitFor({ timeout: 10000 });

  await clickAction(page, 2, 'create');
  await waitForNotice(page, 'Created test record');
  await clickAction(page, 3, 'patch');
  await waitForNotice(page, 'Patched drill-down record');
  await clickAction(page, 4, 'delete');
  await waitForNotice(page, 'Deleted');

  await page.getByLabel('RBAC role').selectOption('VIEWER');
  await waitForNotice(page, 'Loaded live synthetic API data');
  await clickAction(page, 2, 'viewer create denial');
  await waitForNotice(page, 'Create failed');
  await clickAction(page, 4, 'viewer delete denial');
  await waitForNotice(page, 'Delete failed');

  await page.setViewportSize({ width: 390, height: 860 });
  await page.reload({ waitUntil: 'networkidle' });
  assert(await page.locator('h1').isVisible(), 'Mobile viewport did not render the app heading.');

  assert(consoleIssues.length === 0, `Console issues detected: ${consoleIssues.join('; ')}`);

  console.log(JSON.stringify({
    repo: pkg.name,
    url: frontendUrl,
    title,
    checks: {
      pageIdentity: true,
      notBlank: true,
      frameworkOverlay: false,
      sidebarTabs: navCount,
      domainDecision: true,
      mockUpi: true,
      crud: true,
      viewerRbacDenial: true,
      mobileSmoke: true,
      consoleIssues: 0
    }
  }, null, 2));
} finally {
  await browser.close();
}
