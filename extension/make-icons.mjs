import { chromium } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'icons');
const SIZES = [16, 32, 48, 128];
const svg = fs.readFileSync(path.join(dir, 'logo.svg'), 'utf-8');

const browser = await chromium.launch();
const page = await browser.newPage();
await page.setContent(`<body style="margin:0;background:transparent">${svg}</body>`);
const icon = page.locator('svg');

const render = async (size) => {
  await page.setViewportSize({ width: size, height: size });
  await icon.evaluate((el, s) => { el.setAttribute('width', String(s)); el.setAttribute('height', String(s)); }, size);
  await icon.screenshot({ path: path.join(dir, `icon-${size}.png`), omitBackground: true });
};

await SIZES.reduce((chain, size) => chain.then(() => render(size)), Promise.resolve());
await browser.close();
console.log(`icons written: ${SIZES.map((s) => `icon-${s}.png`).join(', ')}`);
