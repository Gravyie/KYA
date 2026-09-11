import {chromium} from 'playwright';
import {existsSync} from 'node:fs';
import {resolve, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const defaultStoragePath = resolve(__dirname, '.storage', 'x-session.json');

/**
 * Check if Chrome DevTools Protocol is available on a port
 */
async function checkCdpAvailable(port = 9222) {
  try {
    const res = await fetch(`http://127.0.0.1:${port}/json/version`, {
      signal: AbortSignal.timeout(800),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Mechanical wrapper around Playwright.
 * Connects to an already-running Chrome (via CDP port 9222) if available,
 * or launches a headless system Chrome loaded with the saved storageState.
 */
export class BrowserController {
  constructor({storagePath = defaultStoragePath, headless = true, cdpPort = 9222} = {}) {
    this.storagePath = storagePath;
    this.headless = headless;
    this.cdpPort = cdpPort;
    this.browser = null;
    this.context = null;
    this.page = null;
    this.isCdp = false;
  }

  async init() {
    // 1. Check if user has Chrome already running with remote debugging
    const cdpAvailable = await checkCdpAvailable(this.cdpPort);
    if (cdpAvailable) {
      console.log(`[BrowserController] Found running Chrome on port ${this.cdpPort}. Connecting via CDP...`);
      this.browser = await chromium.connectOverCDP(`http://127.0.0.1:${this.cdpPort}`);
      const contexts = this.browser.contexts();
      this.context = contexts[0] || (await this.browser.newContext());
      const pages = this.context.pages();
      // Reuse active X tab if present, else create new tab
      this.page = pages.find((p) => p.url().includes('x.com') || p.url().includes('twitter.com')) || (await this.context.newPage());
      this.isCdp = true;
      return this;
    }

    // 2. Otherwise launch system Chrome with saved storageState
    const launchOptions = {
      headless: this.headless,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--ignore-certificate-errors'],
    };

    try {
      this.browser = await chromium.launch({...launchOptions, channel: 'chrome'});
    } catch {
      this.browser = await chromium.launch(launchOptions);
    }

    const contextOptions = {
      viewport: {width: 1280, height: 800},
      ignoreHTTPSErrors: true,
      userAgent:
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    };

    if (!existsSync(this.storagePath)) {
      const extractorScript = resolve(__dirname, 'extract-chrome-session.py');
      if (existsSync(extractorScript)) {
        try {
          const {spawnSync} = await import('node:child_process');
          const proc = spawnSync('python3', [extractorScript, this.storagePath], {encoding: 'utf8'});
          if (proc.status === 0) {
            console.log('[BrowserController] Automatically extracted active X session from running Chrome profile.');
          }
        } catch {}
      }
    }

    if (existsSync(this.storagePath)) {
      contextOptions.storageState = this.storagePath;
    } else {
      console.warn(`[BrowserController] Notice: Storage state file not found at ${this.storagePath}. Starting unauthenticated.`);
    }

    this.context = await this.browser.newContext(contextOptions);
    this.page = await this.context.newPage();
    return this;
  }

  async navigate(url) {
    if (!this.page) throw new Error('BrowserController not initialized');
    const current = this.page.url();
    if (current && current.includes(url)) return;
    try {
      await this.page.goto(url, {waitUntil: 'domcontentloaded', timeout: 15000});
    } catch {
      if (!this.page.url().includes(url)) {
        await this.page.goto(url, {waitUntil: 'commit', timeout: 15000}).catch(() => {});
      }
    }
    await this.page.waitForTimeout(2000);
  }

  async screenshot(filePath = null) {
    if (!this.page) throw new Error('BrowserController not initialized');
    const options = {type: 'png'};
    if (filePath) options.path = filePath;
    const buffer = await this.page.screenshot(options);
    return {
      buffer,
      base64: buffer.toString('base64'),
      path: filePath,
    };
  }

  async click(target, options = {}) {
    if (!this.page) throw new Error('BrowserController not initialized');
    if (target && typeof target === 'object' && typeof target.x === 'number' && typeof target.y === 'number') {
      await this.page.mouse.click(target.x, target.y);
      await this.page.waitForTimeout(1000);
      return;
    }

    if (typeof target === 'string' && /^\d+,\s*\d+$/.test(target.trim())) {
      const [x, y] = target.split(',').map((n) => Number(n.trim()));
      await this.page.mouse.click(x, y);
      await this.page.waitForTimeout(1000);
      return;
    }

    if (typeof target === 'string') {
      // Ensure element exists in DOM before clicking
      await this.page.waitForSelector(target, {state: 'attached', timeout: 4000}).catch(() => null);

      // Tier 1: Clean standard click
      try {
        await this.page.click(target, {timeout: 3000, ...options});
        await this.page.waitForTimeout(1000);
        return;
      } catch (err) {
        console.warn(`[BrowserController] Standard click on "${target}" intercepted or timed out. Trying Tier 2 force click...`);
      }

      // Tier 2: Force click (bypasses pointer interception hit-tests)
      try {
        await this.page.click(target, {force: true, timeout: 3000});
        await this.page.waitForTimeout(1000);
        return;
      } catch (err) {
        console.warn(`[BrowserController] Force click on "${target}" failed. Attempting Tier 3 DOM dispatch...`);
      }

      // Tier 3: Direct DOM element.click() dispatch
      const domClicked = await this.page.evaluate((sel) => {
        const el = document.querySelector(sel);
        if (el) {
          el.scrollIntoView({block: 'center', inline: 'center'});
          el.click();
          return true;
        }
        return false;
      }, target).catch(() => false);

      if (domClicked) {
        console.log(`[BrowserController] DOM direct click on "${target}" succeeded.`);
        await this.page.waitForTimeout(1000);
        return;
      }

      // Tier 4: Native keyboard submit for post/tweet buttons
      if (target.includes('tweetButton') || target.toLowerCase().includes('post')) {
        console.log(`[BrowserController] Attempting Tier 4 native Control+Enter keyboard submission shortcut...`);
        await this.page.keyboard.press('Control+Enter');
        await this.page.waitForTimeout(2000);
        return;
      }

      throw new Error(`Could not click element "${target}" through any strategy`);
    }

    throw new Error(`Invalid click target: ${JSON.stringify(target)}`);
  }

  async type(text, target = null) {
    if (!this.page) throw new Error('BrowserController not initialized');
    if (target) {
      await this.page.waitForSelector(target, {state: 'visible', timeout: 6000}).catch(() => null);
      try {
        await this.page.focus(target);
      } catch {
        await this.click(target).catch(() => {});
      }
      await this.page.waitForTimeout(300);
    }
    try {
      await this.page.keyboard.insertText(text);
    } catch {
      await this.page.keyboard.type(text, {delay: 20});
    }
    await this.page.waitForTimeout(800);
  }

  async dismissDraftDialog() {
    if (!this.page) return;
    try {
      const discardBtn = await this.page.$('[data-testid="confirmationSheetConfirm"], button:has-text("Discard")');
      if (discardBtn) {
        console.log('[BrowserController] Dismissing draft dialog with Discard...');
        await discardBtn.click();
        await this.page.waitForTimeout(500);
      }
    } catch {}
  }

  async press(key) {
    if (!this.page) throw new Error('BrowserController not initialized');
    await this.page.keyboard.press(key);
    await this.page.waitForTimeout(1000);
  }

  async wait(ms = 1000) {
    if (!this.page) throw new Error('BrowserController not initialized');
    await this.page.waitForTimeout(ms);
  }

  async getUrl() {
    if (!this.page) return '';
    return this.page.url();
  }

  async waitForSelector(selector, timeout = 10000) {
    if (!this.page) throw new Error('BrowserController not initialized');
    return await this.page.waitForSelector(selector, {timeout}).catch(() => null);
  }

  async getAccessibilityTree() {
    if (!this.page) throw new Error('BrowserController not initialized');
    try {
      if (typeof this.page.locator === 'function') {
        const aria = await this.page.locator('body').ariaSnapshot().catch(() => null);
        if (aria) return aria;
      }
    } catch {}

    if (this.page.accessibility && typeof this.page.accessibility.snapshot === 'function') {
      const rawSnapshot = await this.page.accessibility.snapshot();
      return this._simplifyA11yTree(rawSnapshot);
    }

    // Fallback: extract interactive elements via evaluate
    return await this.page.evaluate(() => {
      const elements = Array.from(document.querySelectorAll('button, a, input, textarea, [role="button"]'));
      return elements.slice(0, 50).map((el) => ({
        tag: el.tagName.toLowerCase(),
        text: (el.innerText || el.value || el.getAttribute('aria-label') || '').slice(0, 100).trim(),
        role: el.getAttribute('role') || el.type || null,
      }));
    }).catch(() => 'Accessible tree unavailable');
  }

  _simplifyA11yTree(node, depth = 0) {
    if (!node || depth > 8) return null;
    const isInteractive = [
      'button',
      'textbox',
      'link',
      'checkbox',
      'combobox',
      'menuitem',
      'tab',
      'searchbox',
    ].includes(node.role);

    const hasContent = Boolean(node.name || node.value || isInteractive);
    const simplifiedChildren = (node.children || [])
      .map((c) => this._simplifyA11yTree(c, depth + 1))
      .filter(Boolean);

    if (!hasContent && simplifiedChildren.length === 0) {
      return null;
    }

    const res = {role: node.role};
    if (node.name) res.name = node.name.slice(0, 100);
    if (node.value) res.value = node.value.slice(0, 100);
    if (simplifiedChildren.length > 0) res.children = simplifiedChildren;

    return res;
  }

  async isComposerOpen() {
    if (!this.page) return false;
    return await this.page.evaluate(() => {
      const inModal = document.querySelector('[role="dialog"] [data-testid="tweetTextarea_0"], [role="dialog"] [data-testid="tweetButton"]');
      const isComposeUrl = window.location.pathname.includes('/compose/post') || window.location.href.includes('/compose/post');
      return Boolean(inModal || isComposeUrl);
    }).catch(() => false);
  }

  async waitForComposerClosed(timeoutMs = 6000) {
    if (!this.page) return true;
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const open = await this.isComposerOpen();
      if (!open) return true;
      await this.wait(500);
    }
    return false;
  }

  async close() {
    if (this.isCdp) {
      // In CDP mode, don't close the user's running Chrome window; just disconnect
      return;
    }
    if (this.context) await this.context.close().catch(() => {});
    if (this.browser) await this.browser.close().catch(() => {});
    this.page = null;
    this.context = null;
    this.browser = null;
  }
}

export async function createBrowserController(options) {
  const controller = new BrowserController(options);
  await controller.init();
  return controller;
}
