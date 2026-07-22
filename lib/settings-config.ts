import {
	NewspaperIcon,
	MusicIcon,
	SearchIcon,
	DownloadIcon,
	ListMusicIcon,
	UsersIcon,
	DiscIcon,
	MonitorSmartphoneIcon,
	SunIcon,
	MoonIcon,
	ImageIcon,
	PaletteIcon,
	SwatchBookIcon,
	type LucideIcon,
} from 'lucide-react-native';
import type {
	ThemePreference,
	DefaultTab,
	HomeContentPreference,
	LibraryTabId,
	PlayerBackground,
	UIStyle,
} from '@/src/application/state/settings-store';
import type { StreamQuality } from '@/src/domain/value-objects/audio-source';

export const THEME_OPTIONS: { value: ThemePreference; label: string; icon: LucideIcon }[] = [
	{ value: 'system', label: 'System', icon: MonitorSmartphoneIcon },
	{ value: 'light', label: 'Light', icon: SunIcon },
	{ value: 'dark', label: 'Dark', icon: MoonIcon },
];

export const DEFAULT_TAB_OPTIONS: { value: DefaultTab; label: string; icon: LucideIcon }[] = [
	{ value: 'feed', label: 'Home', icon: NewspaperIcon },
	{ value: 'library', label: 'Library', icon: MusicIcon },
	{ value: 'search', label: 'Search', icon: SearchIcon },
	{ value: 'downloads', label: 'Downloads', icon: DownloadIcon },
];

export const HOME_CONTENT_PREFERENCE_OPTIONS: {
	value: HomeContentPreference;
	label: string;
	icon: LucideIcon;
}[] = [
	{ value: 'Hindi', label: 'Hindi', icon: MusicIcon },
	{ value: 'English', label: 'English', icon: MusicIcon },
	{ value: 'Punjabi', label: 'Punjabi', icon: MusicIcon },
	{ value: 'Tamil', label: 'Tamil', icon: MusicIcon },
	{ value: 'Telugu', label: 'Telugu', icon: MusicIcon },
	{ value: 'Marathi', label: 'Marathi', icon: MusicIcon },
	{ value: 'Gujarati', label: 'Gujarati', icon: MusicIcon },
	{ value: 'Bengali', label: 'Bengali', icon: MusicIcon },
	{ value: 'Kannada', label: 'Kannada', icon: MusicIcon },
	{ value: 'Bhojpuri', label: 'Bhojpuri', icon: MusicIcon },
	{ value: 'Malayalam', label: 'Malayalam', icon: MusicIcon },
	{ value: 'Urdu', label: 'Urdu', icon: MusicIcon },
	{ value: 'Haryanvi', label: 'Haryanvi', icon: MusicIcon },
	{ value: 'Rajasthani', label: 'Rajasthani', icon: MusicIcon },
	{ value: 'Odia', label: 'Odia', icon: MusicIcon },
	{ value: 'Assamese', label: 'Assamese', icon: MusicIcon },
];

export const LIBRARY_TAB_OPTIONS: { value: LibraryTabId; label: string; icon: LucideIcon }[] = [
	{ value: 'songs', label: 'Songs', icon: MusicIcon },
	{ value: 'playlists', label: 'Playlists', icon: ListMusicIcon },
	{ value: 'artists', label: 'Artists', icon: UsersIcon },
	{ value: 'albums', label: 'Albums', icon: DiscIcon },
];

export const TAB_INDEX_MAP: Record<LibraryTabId, number> = {
	songs: 0,
	playlists: 1,
	artists: 2,
	albums: 3,
};

export const PLAYER_BACKGROUND_OPTIONS: {
	value: PlayerBackground;
	label: string;
	icon: LucideIcon;
}[] = [
	{ value: 'artwork-blur', label: 'Blurred', icon: ImageIcon },
	{ value: 'artwork-solid', label: 'Solid', icon: PaletteIcon },
	{ value: 'theme-color', label: 'Themed', icon: SwatchBookIcon },
];

export const UI_STYLE_OPTIONS: { value: UIStyle; label: string; icon: LucideIcon }[] = [
	{ value: 'clean', label: 'Clean', icon: MonitorSmartphoneIcon },
	{ value: 'glow-flow', label: 'Glow Flow', icon: SwatchBookIcon },
	{ value: 'glass', label: 'Glass', icon: ImageIcon },
	{ value: 'bold', label: 'Bold', icon: PaletteIcon },
	{ value: 'neo', label: 'Neo', icon: SunIcon },
];

export const STREAM_QUALITY_OPTIONS: {
	value: StreamQuality;
	label: string;
	icon: LucideIcon;
}[] = [
	{ value: 'low', label: 'Low', icon: DownloadIcon },
	{ value: 'medium', label: 'Medium', icon: DownloadIcon },
	{ value: 'high', label: 'High', icon: DownloadIcon },
];
