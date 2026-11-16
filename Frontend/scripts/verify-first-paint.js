/**
 * Build gate for issue F1 (another page flashing before the real one).
 *
 * Runs after prerender-seo.js. Every HTML file in dist that the SPA can be
 * served from must start its #root with the first-paint splash, and any
 * crawlable fallback content must come after it inside .cv-prerender.
 * If a page would paint anything else first, the build fails.
 *
 * Run: node scripts/verify-first-paint.js   (also runs automatically in "postbuild")
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const distDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist');

function htmlFiles(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      // The admin console is a separate app copied into dist/admin by the root build.
      if (path.relative(distDir, full).split(path.sep)[0] === 'admin') continue;
      htmlFiles(full, out);
    } else if (entry.name.endsWith('.html')) {
      out.push(full);
    }
  }
  return out;
}

if (!fs.existsSync(distDir)) {
  console.error('verify-first-paint: dist/ not found. Run the build first.');
  process.exit(1);
}

const failures = [];
const files = htmlFiles(distDir);

for (const file of files) {
  const rel = path.relative(distDir, file);
  const html = fs.readFileSync(file, 'utf8');
  const rootStart = html.indexOf('<div id="root">');
  if (rootStart === -1) continue; // not an SPA entry document

  const afterRoot = html.slice(rootStart + '<div id="root">'.length);
  const problems = [];

  if (!/^\s*<div class="cv-splash"/.test(afterRoot)) {
    problems.push('#root does not start with the .cv-splash first-paint splash');
  }
  if (!/\.cv-splash\s*\{[^}]*position:\s*fixed/.test(html)) {
    problems.push('inline .cv-splash style (position: fixed overlay) is missing from <head>');
  }
  if (!/<noscript>\s*<style>\s*\.cv-splash\s*\{\s*display:\s*none/.test(html)) {
    problems.push('<noscript> rule that hides the splash without JavaScript is missing');
  }
  if (html.includes('<!--cv-prerender-->') === false) {
    // Marker was replaced by prerender content: it must be wrapped and placed after the splash.
    const splashAt = afterRoot.indexOf('class="cv-splash"');
    const prerenderAt = afterRoot.indexOf('<div class="cv-prerender">');
    if (prerenderAt === -1) problems.push('prerender content is not wrapped in .cv-prerender');
    else if (prerenderAt < splashAt) problems.push('prerender content comes before the splash');
  }
  if (problems.length) failures.push(`${rel}: ${problems.join('; ')}`);
}

if (failures.length) {
  console.error(`❌ verify-first-paint: ${failures.length} of ${files.length} HTML files would flash the wrong content:`);
  for (const f of failures.slice(0, 20)) console.error('   - ' + f);
  process.exit(1);
}
console.log(`✅ verify-first-paint: PASS — ${files.length} HTML files start with the first-paint splash`);
