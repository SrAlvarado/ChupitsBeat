// captura la landing por secciones: node snap.mjs [selector] → /tmp/snap_*.png
import { chromium } from 'playwright';
const b = await chromium.launch({ args: ['--use-gl=swiftshader'] });
const p = await b.newPage({ viewport: { width: 1366, height: 850 } });
await p.goto('http://localhost:5180/ChupitsBeat/', { waitUntil: 'networkidle' });
await p.waitForTimeout(2000);
const sections = ['.land-hero', '.land-feat', '.land-gallery', '.land-steps', '.land-cta'];
for (const sel of (process.argv[2] ? [process.argv[2]] : sections)) {
  const y = await p.evaluate(s => (document.querySelector(s)?.getBoundingClientRect().top ?? 0) + window.scrollY, sel);
  await p.evaluate(v => window.scrollTo(0, Math.max(0, v - 60)), y);
  await p.waitForTimeout(900);
  await p.screenshot({ path: `/tmp/snap_${sel.replace(/\W/g, '')}.png` });
}
await b.close();
console.log('capturas en /tmp/snap_*.png');
