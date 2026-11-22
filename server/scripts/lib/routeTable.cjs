/**
 * The API's route table, read from the compiled routers exactly as server/src/index.ts mounts them
 * (no server is started, no database is touched). Used by the API contract test.
 */
const fs = require('fs');
const path = require('path');
const d = (p) => require(path.join(__dirname, '../../dist', p));

/** [{ method, path }] for every route the API serves under /api and /api/v2. */
function buildRouteTable() {
  const out = [];
  const add = (prefix, router) => {
    if (!router || !router.stack) return;
    for (const l of router.stack) {
      if (l.route) {
        for (const m of Object.keys(l.route.methods)) for (const p of [].concat(l.route.path)) out.push({ method: m.toUpperCase(), path: (prefix + p).replace(/\/+$/, '') || '/' });
      } else if (l.handle && l.handle.stack && l.regexp) {
        // nested router mounted with router.use('/x', sub)
        const m = String(l.regexp).match(/\^\\\/([^\\?(]+)/);
        add(prefix + (m ? '/' + m[1].replace(/\\\//g, '/') : ''), l.handle);
      }
    }
  };
  const src = fs.readFileSync(path.join(__dirname, '../../src/index.ts'), 'utf8');
  // app.use('/api/v2/x', ..., someRouter) mounts: resolve the router variable to its import.
  const imports = {};
  for (const m of src.matchAll(/import\s+(\w+)\s*(?:,\s*\{[^}]*\})?\s+from\s+'\.\/routes\/(\w+)'/g)) imports[m[1]] = { file: m[2], named: null };
  for (const m of src.matchAll(/import\s+(?:\w+\s*,\s*)?\{([^}]+)\}\s+from\s+'\.\/routes\/(\w+)'/g)) for (const n of m[1].split(',')) { const name = n.trim().split(/\s+as\s+/).pop(); if (name) imports[name] = { file: m[2], named: n.trim().split(/\s+as\s+/)[0] }; }
  // app.use('/api...', a, b, (req, res, next) => {...}, router): split the top-level arguments.
  for (const m of src.matchAll(/app\.use\(\s*'(\/api[^']*)'\s*,/g)) {
    const prefix = m[1].replace(/\/+$/, '');
    let depth = 1, i = m.index + m[0].length, cur = '', args = [];
    for (; i < src.length && depth > 0; i++) {
      const ch = src[i];
      if ('([{'.includes(ch)) depth++;
      else if (')]}'.includes(ch)) { depth--; if (depth === 0) break; }
      if (ch === ',' && depth === 1) { args.push(cur.trim()); cur = ''; } else cur += ch;
    }
    args.push(cur.trim());
    for (const v of args) {
      const imp = imports[v];
      if (!imp) continue;
      const mod = d(`routes/${imp.file}`);
      add(prefix, imp.named ? mod[imp.named] : mod.default);
    }
  }
  // Direct app.get/post/... routes.
  for (const m of src.matchAll(/app\.(get|post|put|patch|delete)\(\s*'(\/api[^']*)'/g)) out.push({ method: m[1].toUpperCase(), path: m[2].replace(/\/+$/, '') });
  // User routes are mounted by a helper.
  const fakeApp = { use: (p, ...rs) => { for (const r of rs) add(typeof p === 'string' ? p.replace(/\/+$/, '') : '', r); } };
  d('routes/user').mountUserRoutes(fakeApp, (q, s, n) => n());
  const seen = new Set();
  return out.filter((r) => { const k = r.method + ' ' + r.path; if (seen.has(k)) return false; seen.add(k); return true; });
}

/** Does a concrete request path match an Express route path (with :params)? */
function routeMatches(routePath, reqPath) {
  const re = new RegExp('^' + routePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\?\/:[A-Za-z_]+\\?\??/g, '/[^/]+').replace(/:[A-Za-z_]+/g, '[^/]+') + '$');
  return re.test(reqPath);
}

module.exports = { buildRouteTable, routeMatches };
