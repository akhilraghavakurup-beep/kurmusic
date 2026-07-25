# Changelog - Kur Music

All notable changes to the Kur Music application are documented in this file.

## [1.2.0] - 2026-07-25

### 📻 Radio Feature Overhaul & Language-Tuned Featured Stations
- **Language-Tuned Featured Radio Shelf**: Added a dedicated **Featured Radio Stations** section on the Home Feed. Dynamically displays ~28 live radio stations tailored to your selected content languages in Settings (Malayalam, Hindi, Tamil, English, Telugu, Punjabi).
- **Featured Radio API Integration**: Added `createFeaturedStation` endpoint support in `JioSaavnClient` (`webradio.createFeaturedStation`).
- **Radio Playback Resolution & Fallback**: Updated `JioSaavnProvider.getArtistStationTracks` to automatically resolve both **Featured Radio** stations and **Artist Radio** stations, eliminating playback failures when tapping radio cards.

### 🎨 Brand Identity & Splash Animation Redesign
- **100% Alpha Transparent Brand Suite**: Regenerated all app logo and launcher icon PNG assets with crisp alpha channel transparency (zero dark/white bounding box backgrounds).
- **Reworked Startup Equalizer Visualizer**: Added an expanding glowing aura ring and a 5-bar animated audio equalizer visualizer on the startup splash screen (`AnimatedSplash`).

### 📦 OTA & Android Package Installer Reliability
- **Document Directory Storage**: Updated `update-service.ts` to download OTA APK files to `FileSystem.documentDirectory` (`/data/user/0/com.kurmusic.app/files/`) for 100% file permission compatibility across Samsung, Xiaomi, Vivo, and Oppo Android package installers.
- **Strict versionCode Increment**: Bumped `versionCode` to `16` to prevent Android `INSTALL_FAILED_VERSION_DOWNGRADE` errors during OTA updates.
