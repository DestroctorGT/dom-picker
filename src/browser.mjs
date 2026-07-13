import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PICKER_SCRIPT = readFileSync(path.join(__dirname, 'picker.js'), 'utf-8');

/**
 * Launch a headed Chromium instance, navigate to the given URL,
 * and inject the picker script. Returns a handle with event callbacks.
 *
 * @param {string} url - The URL to navigate to
 * @param {function} onElementSelected - Callback receiving the captured element data
 * @returns {{ close: () => Promise<void> }}
 */
export async function launchBrowser(url, onElementSelected) {
  const browser = await chromium.launch({
    headless: false,
    args: ['--no-first-run', '--no-default-browser-check', '--window-size=1280,720'],
  });

  const context = await browser.newContext({
    viewport: null,
  });

  const page = await context.newPage();

  // Expose a function that the injected picker script can call
  // to send element data back to the Node process.
  await page.exposeFunction('__notifyElementSelected', (data) => {
    onElementSelected(data);
  });

  // Inject the picker script before every page load.
  // addInitScript runs before any page JS executes, ensuring
  // the picker is active from the very start.
  await page.addInitScript(PICKER_SCRIPT);

  // Navigate to the target URL
  await page.goto(url, { waitUntil: 'domcontentloaded' });

  console.log(`  Browser opened: ${url}`);
  console.log('  Press Ctrl+Shift+C to activate the picker');
  console.log('  Press Escape to exit picker mode\n');

  return {
    async close() {
      await browser.close();
    },
  };
}
