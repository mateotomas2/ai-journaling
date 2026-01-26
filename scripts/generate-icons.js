import sharp from 'sharp';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync, existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PROJECT_ROOT = join(__dirname, '..');
const SOURCE_SVG = join(PROJECT_ROOT, 'public', 'icon-source.svg');
const OUTPUT_DIR = join(PROJECT_ROOT, 'public', 'icons');

// Standard PWA icon sizes
const ICON_SIZES = [16, 32, 72, 96, 128, 144, 152, 192, 384, 512];

async function generateIcons() {
  if (!existsSync(SOURCE_SVG)) {
    console.error(`❌ Source icon not found: ${SOURCE_SVG}`);
    console.error('Please create public/icon-source.svg first');
    process.exit(1);
  }

  console.log('📱 Generating PWA icons from SVG source...\n');

  const svgBuffer = readFileSync(SOURCE_SVG);

  for (const size of ICON_SIZES) {
    try {
      // Standard icon
      await sharp(svgBuffer)
        .resize(size, size)
        .png()
        .toFile(join(OUTPUT_DIR, `icon-${size}x${size}.png`));

      console.log(`✓ Generated icon-${size}x${size}.png`);

      // Maskable icon (for adaptive icons on Android)
      // Only generate maskable for larger sizes that Android uses
      if (size >= 192) {
        await sharp(svgBuffer)
          .resize(size, size)
          .png()
          .toFile(join(OUTPUT_DIR, `icon-${size}x${size}-maskable.png`));

        console.log(`✓ Generated icon-${size}x${size}-maskable.png`);
      }
    } catch (error) {
      console.error(`❌ Failed to generate ${size}x${size} icon:`, error.message);
      process.exit(1);
    }
  }

  // Generate apple-touch-icon
  try {
    await sharp(svgBuffer)
      .resize(180, 180)
      .png()
      .toFile(join(OUTPUT_DIR, 'apple-touch-icon.png'));

    console.log('✓ Generated apple-touch-icon.png (180x180)');
  } catch (error) {
    console.error('❌ Failed to generate apple-touch-icon:', error.message);
    process.exit(1);
  }

  console.log('\n✅ All icons generated successfully!');
}

generateIcons().catch(error => {
  console.error('❌ Icon generation failed:', error);
  process.exit(1);
});
