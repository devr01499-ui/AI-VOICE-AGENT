import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

console.log('🚀 [BUILD_ALL] Starting unified build for Claritiy Voice...');

// 1. Build Frontend
console.log('📦 [BUILD_ALL] Building customer Frontend SPA...');
execSync('npm run --prefix Frontend build', { stdio: 'inherit', cwd: rootDir });

// 2. Build Admin Console
console.log('🛠️ [BUILD_ALL] Building Admin Console SPA...');
// Served under /admin on the main site, so its assets must load from /admin/assets/... (a relative
// base broke every deep link such as /admin/customers/<id>: the page came up blank).
// The owner access key (VITE_ADMIN_ACCESS_KEY) belongs ONLY to the admin console's own Vercel
// project. This copy is public on the main site, so the key is always blanked here (an existing,
// even empty, variable wins over Admin/.env files in Vite), and the result is checked below.
const leakedKey = String(process.env.VITE_ADMIN_ACCESS_KEY || '').trim();
execSync('npm run --prefix Admin build', { stdio: 'inherit', cwd: rootDir, env: { ...process.env, ADMIN_BASE: '/admin/', VITE_ADMIN_ACCESS_KEY: '' } });
if (leakedKey) {
  const assetsDir = path.join(rootDir, 'Admin', 'dist', 'assets');
  for (const f of fs.readdirSync(assetsDir)) {
    if (fs.readFileSync(path.join(assetsDir, f), 'utf8').includes(leakedKey)) {
      throw new Error('[BUILD_ALL] The admin access key ended up in the main-site admin bundle; refusing to publish it.');
    }
  }
  console.warn('[BUILD_ALL] VITE_ADMIN_ACCESS_KEY is set in this (main site) build environment: ignored. Remove it from the main Vercel project.');
}

// 3. Copy Admin/dist into Frontend/dist/admin for single-domain routing
const adminDist = path.join(rootDir, 'Admin', 'dist');
const targetAdminDist = path.join(rootDir, 'Frontend', 'dist', 'admin');

if (fs.existsSync(adminDist)) {
  console.log(`📋 [BUILD_ALL] Copying Admin dist to ${targetAdminDist}...`);
  fs.mkdirSync(targetAdminDist, { recursive: true });
  fs.cpSync(adminDist, targetAdminDist, { recursive: true });
  console.log('✅ [BUILD_ALL] Admin Console successfully bundled into /admin!');
} else {
  console.error('❌ [BUILD_ALL] Admin/dist not found after build!');
  process.exit(1);
}

console.log('🎉 [BUILD_ALL] Unified deployment bundle ready.');
