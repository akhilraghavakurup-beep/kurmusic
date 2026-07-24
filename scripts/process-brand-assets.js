const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const rawLogoPath =
	'C:\\Users\\akhil\\.gemini\\antigravity\\brain\\15323128-592b-4f65-baca-353853e3c215\\kur_logo_transparent_1784908489581.jpg';
const rawAppIconPath =
	'C:\\Users\\akhil\\.gemini\\antigravity\\brain\\15323128-592b-4f65-baca-353853e3c215\\kur_app_icon_1784908505251.jpg';

const assetsDir = path.join(__dirname, '..', 'assets', 'images');

async function processLogo() {
	console.log('Processing transparent logo emblem...');
	const { data, info } = await sharp(rawLogoPath)
		.ensureAlpha()
		.raw()
		.toBuffer({ resolveWithObject: true });

	// Remove white/light background pixels to make transparent alpha channel
	for (let i = 0; i < data.length; i += 4) {
		const r = data[i];
		const g = data[i + 1];
		const b = data[i + 2];

		// If pixel is white or near-white (background)
		if (r > 215 && g > 215 && b > 215) {
			data[i + 3] = 0; // 100% Transparent
		} else {
			// Calculate smooth antialiasing alpha for edges
			const brightness = (r + g + b) / 3;
			if (brightness > 180) {
				const alphaFactor = (255 - brightness) / (255 - 180);
				data[i + 3] = Math.round(255 * Math.max(0, Math.min(1, alphaFactor)));
			}
		}
	}

	const processedLogoBuffer = await sharp(data, {
		raw: {
			width: info.width,
			height: info.height,
			channels: 4,
		},
	})
		.png()
		.toBuffer();

	// Output clean transparent PNGs for all app logo slots
	await sharp(processedLogoBuffer).resize(512, 512).toFile(path.join(assetsDir, 'kur-logo.png'));
	await sharp(processedLogoBuffer).resize(256, 256).toFile(path.join(assetsDir, 'kur-mark.png'));
	await sharp(processedLogoBuffer)
		.resize(512, 512)
		.toFile(path.join(assetsDir, 'splash-icon.png'));
	await sharp(processedLogoBuffer)
		.resize(512, 512)
		.toFile(path.join(assetsDir, 'android-icon-foreground.png'));
	await sharp(processedLogoBuffer).resize(64, 64).toFile(path.join(assetsDir, 'favicon.png'));

	console.log('Transparent logo suite generated successfully!');
}

async function processAppIcon() {
	console.log('Processing app launcher icons...');
	await sharp(rawAppIconPath).resize(1024, 1024).png().toFile(path.join(assetsDir, 'icon.png'));
	await sharp(rawAppIconPath)
		.resize(1024, 1024)
		.png()
		.toFile(path.join(assetsDir, 'icon-rounded.png'));
	await sharp(rawAppIconPath)
		.resize(512, 512)
		.png()
		.toFile(path.join(assetsDir, 'android-icon-background.png'));
	console.log('App launcher icons generated successfully!');
}

async function main() {
	try {
		await processLogo();
		await processAppIcon();
		console.log('ALL BRAND ASSETS GENERATED PERFECTLY!');
	} catch (err) {
		console.error('Asset processing failed:', err);
		process.exit(1);
	}
}

main();
