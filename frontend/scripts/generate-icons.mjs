/**
 * Generate high-resolution PNG icons from SVG source.
 * Uses the vectorized korex-isotipo.svg as the single source of truth.
 *
 * Generates:
 *  - PWA app icons (192, 512, 1024)
 *  - Android ic_launcher at all mipmap densities
 *  - Android ic_launcher_foreground at all mipmap densities
 *  - Android splash screens (portrait + landscape) at all densities
 */
import sharp from 'sharp';
import { readFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const PUBLIC = join(ROOT, 'public');
const ANDROID_RES = join(ROOT, 'android', 'app', 'src', 'main', 'res');

const svgBuffer = readFileSync(join(PUBLIC, 'korex-isotipo.svg'));

// Dark background color matching the app theme
const BG_COLOR = { r: 2, g: 6, b: 23, alpha: 1 }; // #020617

function ensureDir(dir) {
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

// ------------------------------------------------------------------
// 1. PWA / Web app icons (square, logo centered on dark bg)
// ------------------------------------------------------------------
async function generateAppIcon(size, filename) {
    const logoSize = Math.round(size * 0.7);
    const logo = await sharp(svgBuffer).resize(logoSize, logoSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();

    await sharp({
        create: { width: size, height: size, channels: 4, background: BG_COLOR }
    })
        .composite([{ input: logo, gravity: 'centre' }])
        .png()
        .toFile(join(PUBLIC, filename));

    console.log(`  ✓ ${filename} (${size}x${size})`);
}

// Maskable icon needs safe zone (logo at 60% to fit inside the safe circle)
async function generateMaskableIcon(size, filename) {
    const logoSize = Math.round(size * 0.55);
    const logo = await sharp(svgBuffer).resize(logoSize, logoSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();

    await sharp({
        create: { width: size, height: size, channels: 4, background: BG_COLOR }
    })
        .composite([{ input: logo, gravity: 'centre' }])
        .png()
        .toFile(join(PUBLIC, filename));

    console.log(`  ✓ ${filename} (${size}x${size} maskable)`);
}

// ------------------------------------------------------------------
// 2. Android Launcher Icons
// ------------------------------------------------------------------
const MIPMAP_SIZES = {
    'mipmap-mdpi': 48,
    'mipmap-hdpi': 72,
    'mipmap-xhdpi': 96,
    'mipmap-xxhdpi': 144,
    'mipmap-xxxhdpi': 192,
};

async function generateLauncherIcons() {
    for (const [folder, size] of Object.entries(MIPMAP_SIZES)) {
        const dir = join(ANDROID_RES, folder);
        ensureDir(dir);

        // ic_launcher.png — full icon with background
        const logoSize = Math.round(size * 0.65);
        const logo = await sharp(svgBuffer).resize(logoSize, logoSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();

        await sharp({
            create: { width: size, height: size, channels: 4, background: BG_COLOR }
        })
            .composite([{ input: logo, gravity: 'centre' }])
            .png()
            .toFile(join(dir, 'ic_launcher.png'));

        // ic_launcher_round.png — same but will be masked by Android
        await sharp({
            create: { width: size, height: size, channels: 4, background: BG_COLOR }
        })
            .composite([{ input: logo, gravity: 'centre' }])
            .png()
            .toFile(join(dir, 'ic_launcher_round.png'));

        // ic_launcher_foreground.png — adaptive icon foreground (108dp base, logo centered)
        const fgSize = Math.round(size * (108 / 48)); // adaptive icon uses 108dp canvas
        const fgLogoSize = Math.round(fgSize * 0.45);
        const fgLogo = await sharp(svgBuffer).resize(fgLogoSize, fgLogoSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();

        await sharp({
            create: { width: fgSize, height: fgSize, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } }
        })
            .composite([{ input: fgLogo, gravity: 'centre' }])
            .png()
            .toFile(join(dir, 'ic_launcher_foreground.png'));

        console.log(`  ✓ ${folder} (${size}px launcher + ${fgSize}px foreground)`);
    }
}

// ------------------------------------------------------------------
// 3. Android Splash Screens — logo occupying ~50% of width
// ------------------------------------------------------------------
const SPLASH_PORTRAIT = {
    'drawable-port-mdpi': [320, 480],
    'drawable-port-hdpi': [480, 800],
    'drawable-port-xhdpi': [720, 1280],
    'drawable-port-xxhdpi': [1080, 1920],
    'drawable-port-xxxhdpi': [1440, 2560],
};

const SPLASH_LANDSCAPE = {
    'drawable-land-mdpi': [480, 320],
    'drawable-land-hdpi': [800, 480],
    'drawable-land-xhdpi': [1280, 720],
    'drawable-land-xxhdpi': [1920, 1080],
    'drawable-land-xxxhdpi': [2560, 1440],
};

async function generateSplash(configs) {
    for (const [folder, [w, h]] of Object.entries(configs)) {
        const dir = join(ANDROID_RES, folder);
        ensureDir(dir);

        // Logo takes ~50% of the shorter dimension
        const shortSide = Math.min(w, h);
        const logoSize = Math.round(shortSide * 0.50);
        const logo = await sharp(svgBuffer).resize(logoSize, logoSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();

        await sharp({
            create: { width: w, height: h, channels: 4, background: BG_COLOR }
        })
            .composite([{ input: logo, gravity: 'centre' }])
            .png()
            .toFile(join(dir, 'splash.png'));

        console.log(`  ✓ ${folder}/splash.png (${w}x${h})`);
    }

    // Default drawable/splash.png
    const defDir = join(ANDROID_RES, 'drawable');
    ensureDir(defDir);
    const defLogo = await sharp(svgBuffer).resize(240, 240, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
    await sharp({
        create: { width: 480, height: 800, channels: 4, background: BG_COLOR }
    })
        .composite([{ input: defLogo, gravity: 'centre' }])
        .png()
        .toFile(join(defDir, 'splash.png'));
    console.log(`  ✓ drawable/splash.png (480x800 default)`);
}

// ------------------------------------------------------------------
// Run all
// ------------------------------------------------------------------
async function main() {
    console.log('\n🎨 Generating PWA app icons...');
    await generateAppIcon(192, 'korex-app-icon.png');
    await generateAppIcon(512, 'korex-app-icon-512.png');
    await generateMaskableIcon(512, 'korex-app-icon-maskable.png');

    console.log('\n📱 Generating Android launcher icons...');
    await generateLauncherIcons();

    console.log('\n🖼️  Generating Android splash screens...');
    await generateSplash(SPLASH_PORTRAIT);
    await generateSplash(SPLASH_LANDSCAPE);

    console.log('\n✅ All icons generated successfully!\n');
}

main().catch(console.error);
