#!/usr/bin/env node
/**
 * Ensure PNG icons are properly sized for PWA requirements.
 * Resizes existing PNGs to their target dimensions if they're too large.
 * Run: node scripts/generate-icons.js
 * Requires: npm install -D sharp
 */

import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ICONS_DIR = path.join(__dirname, '..', 'public', 'icons');
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

// Max acceptable file size for icons (500KB should be more than enough for a PNG icon)
const MAX_ICON_SIZE = 500 * 1024;

const sizes = [192, 512];

async function generateIcons() {
  for (const size of sizes) {
    const pngPath = path.join(ICONS_DIR, `icon-${size}x${size}.png`);

    if (!fs.existsSync(pngPath)) {
      console.log(`⚠️  Missing: icon-${size}x${size}.png`);
      continue;
    }

    const stats = fs.statSync(pngPath);

    if (stats.size > MAX_ICON_SIZE) {
      // Icon is too large — resize it to the correct dimensions
      const tmpPath = pngPath + '.tmp';
      await sharp(pngPath)
        .resize(size, size)
        .png({ quality: 90, compressionLevel: 9 })
        .toFile(tmpPath);
      fs.renameSync(tmpPath, pngPath);
      const newStats = fs.statSync(pngPath);
      console.log(`✅ Resized: icon-${size}x${size}.png (${(stats.size / 1024).toFixed(0)}KB → ${(newStats.size / 1024).toFixed(0)}KB)`);
    } else {
      console.log(`⏭️  OK: icon-${size}x${size}.png (${(stats.size / 1024).toFixed(1)}KB)`);
    }
  }

  // Ensure favicon.png is properly sized (should be 64x64 or smaller)
  const faviconPng = path.join(PUBLIC_DIR, 'favicon.png');

  if (fs.existsSync(faviconPng)) {
    const stats = fs.statSync(faviconPng);
    if (stats.size > MAX_ICON_SIZE) {
      // Favicon is too large — resize from the 512 icon (best quality source)
      const icon512Png = path.join(ICONS_DIR, 'icon-512x512.png');
      const source = fs.existsSync(icon512Png) ? icon512Png : faviconPng;
      const tmpPath = faviconPng + '.tmp';
      await sharp(source)
        .resize(64, 64)
        .png({ quality: 90, compressionLevel: 9 })
        .toFile(tmpPath);
      fs.renameSync(tmpPath, faviconPng);
      const newStats = fs.statSync(faviconPng);
      console.log(`✅ Resized: favicon.png (${(stats.size / 1024).toFixed(0)}KB → ${(newStats.size / 1024).toFixed(0)}KB)`);
    } else {
      console.log(`⏭️  OK: favicon.png (${(stats.size / 1024).toFixed(1)}KB)`);
    }
  }

  console.log('\nDone! Icons are in public/icons/');
}

generateIcons().catch((err) => {
  console.error('Failed to process icons:', err.message);
  console.log('\nHint: Run "npm install -D sharp" first.');
  process.exit(1);
});
