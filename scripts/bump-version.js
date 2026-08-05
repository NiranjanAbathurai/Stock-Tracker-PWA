#!/usr/bin/env node
/**
 * Auto-increment patch version in package.json during Netlify builds.
 *
 * Strategy: Uses git commit count on the current branch as the patch number.
 * This ensures every deploy gets a unique, monotonically increasing version
 * without needing to manually bump or push version changes back to git.
 *
 * Example: If package.json has "1.0.0" and there are 47 commits → "1.0.47"
 *
 * The version is also written to .env.production.local so Vite picks it up
 * via import.meta.env.VITE_APP_VERSION (and __APP_VERSION__ via define).
 *
 * Usage: Called automatically during Netlify build (see netlify.toml)
 *        Can also run manually: node scripts/bump-version.js
 */

import { execSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PKG_PATH = resolve(__dirname, '..', 'package.json');

try {
  // Get total commit count on current branch
  const commitCount = execSync('git rev-list --count HEAD', { encoding: 'utf-8' }).trim();
  const patchVersion = parseInt(commitCount, 10);

  if (isNaN(patchVersion)) {
    console.warn('[bump-version] Could not determine commit count, skipping.');
    process.exit(0);
  }

  // Read current package.json
  const pkg = JSON.parse(readFileSync(PKG_PATH, 'utf-8'));
  const currentVersion = pkg.version || '1.0.0';

  // Parse major.minor from current version, replace patch with commit count
  const [major, minor] = currentVersion.split('.').map(Number);
  const newVersion = `${major || 1}.${minor || 0}.${patchVersion}`;

  // Update package.json in-place (only during build — not committed to git)
  pkg.version = newVersion;
  writeFileSync(PKG_PATH, JSON.stringify(pkg, null, 2) + '\n', 'utf-8');

  // Get short commit hash for display
  const commitHash = execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim();

  console.log(`[bump-version] ${currentVersion} → ${newVersion} (commit: ${commitHash})`);

  // Write .env.production.local for Vite to auto-load
  const envBuildPath = resolve(__dirname, '..', '.env.production.local');
  const envContent = `# Auto-generated during build\nVITE_APP_VERSION=${newVersion}\nVITE_COMMIT_HASH=${commitHash}\n`;
  writeFileSync(envBuildPath, envContent, 'utf-8');

} catch (error) {
  // Non-fatal — build continues with existing version
  console.warn('[bump-version] Skipping:', error.message);
  process.exit(0);
}
