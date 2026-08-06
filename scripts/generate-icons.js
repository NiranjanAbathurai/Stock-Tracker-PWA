#!/usr/bin/env node
/**
 * Generate PNG icons from SVG sources.
 * Run: node scripts/generate-icons.js
 * Requires: npm install -D sharp
 */

const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const ICONS_DIR = path.join(__dirname, '..', 'public', 'icons');

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

  console.log('\nDone! PNG icons are in public/icons/');
}

generateIcons().catch((err) => {
  console.error('Failed to generate icons:', err.message);
  console.log('\nHint: Run "npm install -D sharp" first.');
  process.exit(1);
});
