const { withAndroidManifest, withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Expo Config Plugin to enable Android Auto support for Kur Music.
 * This adds the necessary meta-data to AndroidManifest.xml and creates the
 * automotive_app_desc.xml resource file required for Android Auto media apps.
 */
const withAndroidAuto = (config) => {
	// 1. Add meta-data to AndroidManifest.xml
	config = withAndroidManifest(config, (config) => {
		const mainApplication = config.modResults.manifest.application[0];

		if (!mainApplication['meta-data']) {
			mainApplication['meta-data'] = [];
		}

		const hasAndroidAutoMetadata = mainApplication['meta-data'].some(
			(meta) => meta.$['android:name'] === 'com.google.android.gms.car.application'
		);

		if (!hasAndroidAutoMetadata) {
			mainApplication['meta-data'].push({
				$: {
					'android:name': 'com.google.android.gms.car.application',
					'android:resource': '@xml/automotive_app_desc',
				},
			});
		}

		// 2. Ensure MusicService has the MediaBrowserService intent-filter
		if (!mainApplication['service']) {
			mainApplication['service'] = [];
		}

		let musicService = mainApplication['service'].find(
			(s) => s.$['android:name'] === 'com.doublesymmetry.trackplayer.service.MusicService'
		);

		if (!musicService) {
			musicService = {
				$: {
					'android:name': 'com.doublesymmetry.trackplayer.service.MusicService',
					'android:enabled': 'true',
					'android:exported': 'true',
					'android:foregroundServiceType': 'mediaPlayback',
				},
				'intent-filter': [],
			};
			mainApplication['service'].push(musicService);
		}

		if (!musicService['intent-filter']) {
			musicService['intent-filter'] = [];
		}

		const hasMediaBrowserAction = musicService['intent-filter'].some((filter) =>
			filter.action?.some((action) => action.$['android:name'] === 'android.media.browse.MediaBrowserService')
		);

		if (!hasMediaBrowserAction) {
			musicService['intent-filter'].push({
				action: [
					{
						$: { 'android:name': 'android.media.browse.MediaBrowserService' },
					},
				],
			});
		}

		// 3. Add required permissions
		if (!config.modResults.manifest['uses-permission']) {
			config.modResults.manifest['uses-permission'] = [];
		}

		const permissions = [
			'android.permission.FOREGROUND_SERVICE',
			'android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK',
		];

		permissions.forEach((perm) => {
			const hasPerm = config.modResults.manifest['uses-permission'].some(
				(p) => p.$['android:name'] === perm
			);
			if (!hasPerm) {
				config.modResults.manifest['uses-permission'].push({
					$: { 'android:name': perm },
				});
			}
		});

		return config;
	});

	// 4. Add automotive_app_desc.xml resource file
	config = withDangerousMod(config, [
		'android',
		async (config) => {
			const resXmlDir = path.join(
				config.modRequest.platformProjectRoot,
				'app/src/main/res/xml'
			);

			if (!fs.existsSync(resXmlDir)) {
				fs.mkdirSync(resXmlDir, { recursive: true });
			}

			const automotiveAppDescContent = `<?xml version="1.0" encoding="utf-8"?>
<automotiveApp>
    <uses name="media"/>
</automotiveApp>`;

			fs.writeFileSync(path.join(resXmlDir, 'automotive_app_desc.xml'), automotiveAppDescContent);

			// 5. Correct JitPack repository URL in root android/build.gradle (replace www.jitpack.io with jitpack.io)
			const buildGradlePath = path.join(
				config.modRequest.platformProjectRoot,
				'build.gradle'
			);

			if (fs.existsSync(buildGradlePath)) {
				let content = fs.readFileSync(buildGradlePath, 'utf8');
				if (content.includes('https://www.jitpack.io')) {
					content = content.replace(/https:\/\/www\.jitpack\.io/g, 'https://jitpack.io');
					fs.writeFileSync(buildGradlePath, content, 'utf8');
				}
			}

			return config;
		},
	]);

	return config;
};

module.exports = withAndroidAuto;
