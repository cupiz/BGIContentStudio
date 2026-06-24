/**
 * BGI Content Studio - Icon Generator
 * Generates icon.ico from SVG with multiple sizes for Windows
 */
const sharp = require('sharp');
const pngToIco = require('png-to-ico').default;
const path = require('path');
const fs = require('fs');

// Professional icon design - BGI Content Studio
// Dark gradient background with stylized "BGI" text and content creation elements
const svgIcon = `
<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#1e1b4b;stop-opacity:1" />
      <stop offset="50%" style="stop-color:#312e81;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#1e1b4b;stop-opacity:1" />
    </linearGradient>
    <linearGradient id="accentGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#818cf8;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#a78bfa;stop-opacity:1" />
    </linearGradient>
    <linearGradient id="sparkleGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#c7d2fe;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#e0e7ff;stop-opacity:1" />
    </linearGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#000" flood-opacity="0.3"/>
    </filter>
  </defs>
  
  <!-- Background - Rounded square -->
  <rect x="8" y="8" width="240" height="240" rx="48" ry="48" fill="url(#bgGrad)" filter="url(#shadow)"/>
  
  <!-- Subtle border -->
  <rect x="12" y="12" width="232" height="232" rx="44" ry="44" fill="none" stroke="url(#accentGrad)" stroke-width="2" opacity="0.4"/>
  
  <!-- Content creation element - Play button / Video frame -->
  <rect x="40" y="60" width="80" height="56" rx="8" fill="url(#accentGrad)" opacity="0.3"/>
  <polygon points="62,70 62,106 92,88" fill="url(#sparkleGrad)"/>
  
  <!-- Text lines representing content -->
  <rect x="40" y="130" width="100" height="8" rx="4" fill="url(#accentGrad)" opacity="0.5"/>
  <rect x="40" y="148" width="70" height="8" rx="4" fill="url(#accentGrad)" opacity="0.3"/>
  <rect x="40" y="166" width="85" height="8" rx="4" fill="url(#accentGrad)" opacity="0.4"/>
  
  <!-- BGI Text -->
  <text x="170" y="120" font-family="Arial, Helvetica, sans-serif" font-size="52" font-weight="bold" fill="url(#sparkleGrad)" text-anchor="middle" filter="url(#shadow)">BGI</text>
  
  <!-- Studio subtitle -->
  <text x="170" y="145" font-family="Arial, Helvetica, sans-serif" font-size="16" fill="url(#accentGrad)" text-anchor="middle" opacity="0.8">STUDIO</text>
  
  <!-- Sparkle decorations -->
  <circle cx="195" cy="75" r="4" fill="url(#sparkleGrad)" opacity="0.8"/>
  <circle cx="210" cy="90" r="2.5" fill="url(#sparkleGrad)" opacity="0.6"/>
  <circle cx="180" cy="65" r="2" fill="url(#sparkleGrad)" opacity="0.5"/>
  
  <!-- AI sparkle icon -->
  <path d="M215,65 L218,60 L221,65 L226,62 L221,65 L224,70 L221,65 L216,68 L221,65 Z" fill="url(#sparkleGrad)" opacity="0.7"/>
</svg>`;

const OUTPUT_DIR = path.join(__dirname, '..', 'public');
const TEMP_DIR = path.join(__dirname, '..', 'temp-icons');

async function generateIcon() {
  console.log('🎨 Generating BGI Content Studio icon...\n');

  // Create temp directory
  if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
  }

  // Save SVG
  const svgPath = path.join(TEMP_DIR, 'icon.svg');
  fs.writeFileSync(svgPath, svgIcon);
  console.log('✅ SVG design created');

  // Generate PNGs at different sizes
  const sizes = [16, 24, 32, 48, 64, 128, 256];
  const pngPaths = [];

  for (const size of sizes) {
    const pngPath = path.join(TEMP_DIR, `icon-${size}.png`);
    await sharp(Buffer.from(svgIcon))
      .resize(size, size)
      .png()
      .toFile(pngPath);
    pngPaths.push(pngPath);
    console.log(`✅ Generated ${size}x${size} PNG`);
  }

  // Convert to ICO
  const icoPath = path.join(OUTPUT_DIR, 'icon.ico');
  const icoBuffer = await pngToIco(pngPaths);
  fs.writeFileSync(icoPath, icoBuffer);
  console.log(`\n✅ icon.ico created: ${icoPath}`);

  // Also save a high-res PNG for reference
  const pngRefPath = path.join(OUTPUT_DIR, 'icon.png');
  await sharp(Buffer.from(svgIcon))
    .resize(512, 512)
    .png()
    .toFile(pngRefPath);
  console.log(`✅ Reference PNG saved: ${pngRefPath}`);

  // Clean up temp files
  fs.rmSync(TEMP_DIR, { recursive: true, force: true });
  console.log('✅ Temp files cleaned up');

  // Show file sizes
  const icoStats = fs.statSync(icoPath);
  const pngStats = fs.statSync(pngRefPath);
  console.log(`\n📊 File sizes:`);
  console.log(`   icon.ico: ${(icoStats.size / 1024).toFixed(1)} KB`);
  console.log(`   icon.png: ${(pngStats.size / 1024).toFixed(1)} KB`);
}

generateIcon().catch(err => {
  console.error('❌ Error generating icon:', err);
  process.exit(1);
});
