/**
 * Plugin Index
 *
 * Central registry of all available plugins in the application.
 * This is the single source of truth for plugin discovery.
 */

import type { PluginManifestEntry } from './core/interfaces/plugin-module';

import { PLUGIN_MANIFEST as CORE_LIBRARY_MANIFEST } from './library/core-library/config';
import { PLUGIN_MANIFEST as JIOSAAVN_MANIFEST } from './metadata/jiosaavn/config';
import { PLUGIN_MANIFEST as RNTP_MANIFEST } from './playback/react-native-track-player/config';
import { PLUGIN_MANIFEST as LOCAL_LIBRARY_MANIFEST } from './metadata/local-library/config';

export const PLUGIN_ENTRIES: PluginManifestEntry[] = [
	{
		manifest: CORE_LIBRARY_MANIFEST,
		load: async () => {
			const { CoreLibraryPluginModule } =
				await import('./library/core-library/plugin-module');
			return CoreLibraryPluginModule;
		},
		isBuiltIn: true,
	},
	{
		manifest: JIOSAAVN_MANIFEST,
		load: async () => {
			const { JioSaavnPluginModule } = await import('./metadata/jiosaavn/plugin-module');
			return JioSaavnPluginModule;
		},
		isBuiltIn: true,
	},
	{
		manifest: LOCAL_LIBRARY_MANIFEST,
		load: async () => {
			const { LocalLibraryPluginModule } = await import('./metadata/local-library/plugin-module');
			return LocalLibraryPluginModule;
		},
		isBuiltIn: true,
	},
	{
		manifest: RNTP_MANIFEST,
		load: async () => {
			const { RNTPPluginModule } =
				await import('./playback/react-native-track-player/plugin-module');
			return RNTPPluginModule;
		},
		isBuiltIn: true,
	},
];

export function getAllPluginManifests() {
	return PLUGIN_ENTRIES.map((entry) => entry.manifest);
}

export function getPluginManifestsByCategory(category: string) {
	return PLUGIN_ENTRIES.filter((entry) => entry.manifest.category === category).map(
		(entry) => entry.manifest
	);
}

export function getBuiltInPluginManifests() {
	return PLUGIN_ENTRIES.filter((entry) => entry.isBuiltIn).map((entry) => entry.manifest);
}