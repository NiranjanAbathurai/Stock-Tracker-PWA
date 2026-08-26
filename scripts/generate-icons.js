#!/usr/bin/env node
/**
 * Ensure PNG icons exist and favicon is properly sized.
 * If custom PNG icons already exist, they are preserved (not overwritten from SVG).
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

const sizes = [192, 512];

async function generateIcons() {
  for (const size of sizes) {
    const pngPath = path.join(ICONS_DIR, `icon-${size}x${size}.png`);
    const svgPath = path.join(ICONS_DIR, `icon-${size}x${size}.svg`);

    // Skip if PNG already exists (custom icon committed to repo)
    if (fs.existsSync(pngPath)) {
      const stats = fs.statSync(pngPath);
      if (stats.size > 1024) { // > 1KB means it's a real image, not a placeholder
        console.log(`⏭️  Skipped: icon-${size}x${size}.png (already exists, ${(stats.size / 1024).toFixed(1)}KB)`);
        continue;
      }
    }

    // Only generate from SVG if PNG doesn't exist
    if (!fs.existsSync(svgPath)) {
      console.error(`⚠️  No PNG or SVG found for icon-${size}x${size}`);
      continue;
    }

    const svgBuffer = fs.readFileSync(svgPath);
    await sharp(svgBuffer)
      .resize(size, size)
      .png()
      .toFile(pngPath);

    console.log(`✅ Generated: icon-${size}x${size}.png (from SVG)`);
  }

  // Ensure favicon.png exists and is properly sized (< 100KB)
  const faviconPng = path.join(PUBLIC_DIR, 'favicon.png');
  const icon512Png = path.join(ICONS_DIR, 'icon-512x512.png');

  if (fs.existsSync(faviconPng)) {
    const stats = fs.statSync(faviconPng);
    if (stats.size > 100 * 1024) {
      // Favicon is too large (> 100KB), resize it from the 512 icon
      if (fs.existsSync(icon512Png)) {
        await sharp(icon512Png)
          .resize(64, 64)
          .png()
          .toFile(faviconPng + '.tmp');
        fs.renameSync(faviconPng + '.tmp', faviconPng);
        console.log(`✅ Compressed: favicon.png (resized to 64x64 from icon-512x512.png)`);
      } else {
        // Resize the existing favicon in place
        const tmpPath = faviconPng + '.tmp';
        await sharp(faviconPng)
          .resize(64, 64)
          .png()
          .toFile(tmpPath);
        fs.renameSync(tmpPath, faviconPng);
        console.log(`✅ Compressed: favicon.png (resized to 64x64)`);
      }
    } else {
      console.log(`⏭️  Skipped: favicon.png (already exists, ${(stats.size / 1024).toFixed(1)}KB)`);
    }
  } else if (fs.existsSync(icon512Png)) {
    // No favicon exists, generate from 512 icon
    await sharp(icon512Png)
      .resize(64, 64)
      .png()
      .toFile(faviconPng);
    console.log(`✅ Generated: favicon.png (64x64 from icon-512x512.png)`);
  }

  console.log('\nDone! Icons are in public/icons/');
}

generateIcons().catch((err) => {
  console.error('Failed to process icons:', err.message);
  console.log('\nHint: Run "npm install -D sharp" first.');
  process.exit(1);
});
