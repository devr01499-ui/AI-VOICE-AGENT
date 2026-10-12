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
execSync('npm run --prefix Admin build', { stdio: 'inherit', cwd: rootDir });

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
