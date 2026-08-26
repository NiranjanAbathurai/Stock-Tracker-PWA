#!/usr/bin/env node
/**
 * Generate PNG icons from SVG sources and compress favicon.
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
    const svgPath = path.join(ICONS_DIR, `icon-${size}x${size}.svg`);
    const pngPath = path.join(ICONS_DIR, `icon-${size}x${size}.png`);

    if (!fs.existsSync(svgPath)) {
      console.error(`SVG not found: ${svgPath}`);
      continue;
    }

    const svgBuffer = fs.readFileSync(svgPath);

    await sharp(svgBuffer)
      .resize(size, size)
      .png()
      .toFile(pngPath);

    console.log(`✅ Generated: icon-${size}x${size}.png`);
  }

  // Generate favicon.png (64x64) from favicon.svg or icon-512x512 source
  const faviconPng = path.join(PUBLIC_DIR, 'favicon.png');
  const faviconSvg = path.join(PUBLIC_DIR, 'favicon.svg');
  const icon512Svg = path.join(ICONS_DIR, 'icon-512x512.svg');
  const icon512Png = path.join(ICONS_DIR, 'icon-512x512.png');

  if (fs.existsSync(faviconSvg)) {
    // Prefer SVG source if available
    const svgBuffer = fs.readFileSync(faviconSvg);
    await sharp(svgBuffer)
      .resize(64, 64)
      .png()
      .toFile(faviconPng);
    console.log(`✅ Generated: favicon.png (64x64 from favicon.svg)`);
  } else if (fs.existsSync(icon512Svg)) {
    // Use the 512x512 SVG as source for favicon
    const svgBuffer = fs.readFileSync(icon512Svg);
    await sharp(svgBuffer)
      .resize(64, 64)
      .png()
      .toFile(faviconPng);
    console.log(`✅ Generated: favicon.png (64x64 from icon-512x512.svg)`);
  } else if (fs.existsSync(icon512Png)) {
    // Fallback: resize the 512x512 PNG icon to favicon size
    await sharp(icon512Png)
      .resize(64, 64)
      .png()
      .toFile(faviconPng);
    console.log(`✅ Generated: favicon.png (64x64 from icon-512x512.png)`);
  } else if (fs.existsSync(faviconPng)) {
    // Last resort: compress existing favicon if it's too large
    const stats = fs.statSync(faviconPng);
    if (stats.size > 100 * 1024) { // > 100KB is too large for a favicon
      const tmpPath = faviconPng + '.tmp';
      await sharp(faviconPng)
        .resize(64, 64)
        .png()
        .toFile(tmpPath);
      fs.renameSync(tmpPath, faviconPng);
      console.log(`✅ Compressed: favicon.png (resized to 64x64)`);
    }
  }

  console.log('\nDone! PNG icons are in public/icons/');
}

generateIcons().catch((err) => {
  console.error('Failed to generate icons:', err.message);
  console.log('\nHint: Run "npm install -D sharp" first.');
  process.exit(1);
});
