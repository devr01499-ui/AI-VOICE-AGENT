require('./lib/testDbGuard.cjs'); // MUST stay first: blocks any non-test database
/**
 * API contract: every /api/v2 call in the customer dashboard, the website and the admin app must
 * reach a route the server really serves, with the same HTTP method. A renamed or removed route
 * otherwise shows up only as a 404 in a customer's browser.
 * The route table is read from the compiled routers exactly as src/index.ts mounts them; no server
 * is started and no database is used.
 * Run: npm run test:api-contract   (part of npm run test:security)
 */
const fs = require('fs');
const path = require('path');
const { buildRouteTable } = require('./lib/routeTable.cjs');

const ROOT = path.join(__dirname, '../..');
const routes = buildRouteTable();

/** Segment-wise match: a client segment X (a variable) or a route :param matches anything. */
function samePath(routePath, clientPath) {
  const a = routePath.split('/');
  const b = clientPath.split('/');
  if (a.length !== b.length) return false;
  return a.every((seg, i) => seg === b[i] || seg.startsWith(':') || b[i] === 'X');
}

function clientCalls() {
  const calls = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) { if (!/^(node_modules|dist)$/.test(e.name)) walk(p); continue; }
      if (!/\.(tsx?|jsx?)$/.test(e.name)) continue;
      const src = fs.readFileSync(p, 'utf8');
      const re = /(['"`])(\/api\/v2\/[^'"`\s]*)/g;
      let m;
      while ((m = re.exec(src))) {
        const before = src.slice(Math.max(0, m.index - 80), m.index);
        if (/startsWith\(\s*$|includes\(\s*$|===\s*$/.test(before)) continue; // a path check, not a call
        let raw;
        if (m[1] === '`') raw = src.slice(m.index + 1, src.indexOf('`', m.index + 1));
        else {
          raw = m[2];
          // '/api/v2/team/' + memberId + '/role'  →  /api/v2/team/X/role
          const tail = src.slice(m.index + 1 + raw.length + 1, m.index + raw.length + 120);
          const concat = tail.match(/^\s*\+\s*[\w.()]+(?:\s*\+\s*(['"])([^'"]*)\1)?/);
          if (concat) raw += 'X' + (concat[2] || '');
        }
        // A nested template (`/api/v2/agents${qs ? `?${qs}` : ""}`) ends the scan early: drop the open ${.
        const norm = raw.replace(/\$\{[^}]*$/, '').replace(/\$\{[^}]*\}/g, 'X').split('?')[0].replace(/X(?=[^/]|$)(?!$)/g, 'X').replace(/\/+$/, '');
        if (/[^/]X$|X[^/]/.test(norm.split('/').pop())) continue; // a query-string or suffix template, e.g. /calls${qs}
        let fwd = src.slice(m.index + 1, m.index + raw.length + 260);
        const stop = fwd.slice(raw.length).search(/\/api\/v2\/|\nexport |\n\s*(async )?function |\n\s*const \w+ = (async )?\(/);
        if (stop >= 0) fwd = fwd.slice(0, raw.length + stop);
        const mm = fwd.match(/method:\s*['"`](POST|PUT|PATCH|DELETE)['"`]/i) || before.match(/\.(post|put|patch|delete)\s*(<[^>]*>)?\s*\(\s*$/i);
        calls.push({ where: `${path.relative(ROOT, p)}:${src.slice(0, m.index).split('\n').length}`, method: mm ? mm[1].toUpperCase() : 'GET', path: norm });
      }
    }
  };
  for (const dir of ['Frontend/src', 'Admin/src']) if (fs.existsSync(path.join(ROOT, dir))) walk(path.join(ROOT, dir));
  return calls;
}

const calls = clientCalls();
const problems = [];
for (const c of calls) {
  const sameUrl = routes.filter((r) => samePath(r.path, c.path));
  if (!sameUrl.length) problems.push(`no route for ${c.method} ${c.path}  (${c.where})`);
  else if (!sameUrl.some((r) => r.method === c.method)) problems.push(`${c.method} ${c.path} but the server only has ${[...new Set(sameUrl.map((r) => r.method))].join('/')}  (${c.where})`);
}

console.log('\n--- API CONTRACT ---');
console.log(`  ${calls.length} client calls checked against ${routes.length} server routes`);
if (calls.length < 120 || routes.length < 120) problems.push(`suspiciously few calls (${calls.length}) or routes (${routes.length}): the scanner is broken`);
for (const p of problems) console.error(`  ✗ ${p}`);
console.log(problems.length ? `\nAPI CONTRACT: FAIL — ${problems.length} problem(s)` : '\nAPI CONTRACT: PASS — every client call reaches a server route with the same method');
process.exit(problems.length ? 1 : 0);
