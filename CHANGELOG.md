# Changelog - Kur Music

All notable changes to the Kur Music application are documented in this file.
## [1.2.2] - 2026-08-22

### 📻 Radio Station Track Accuracy Fix
- **Artist Radio Resolution**: Updated `JioSaavnProvider.getArtistStationTracks` to prioritize `createArtistStation` over generic featured stations. Now tapping artist radio stations accurately resolves tracks by the target artist and similar artist recommendations.

### ⚡ Seamless Queue Transition & Suppressed Error Popups
- **Queue Stream Pre-caching**: Updated `playback-operations.ts` to utilize pre-cached stream URLs and headers for upcoming queue tracks directly in the native player queue.
- **Transient Error Suppression**: Updated `event-handler.ts` and `playback-service.ts` to filter out placeholder 404/dummy URL transition error events, eliminating false-alarm `"Unable to fetch song"` / `"Playback failed"` toast popups.

### 📚 Home Feed Album-wise Listings Scope
- **Expanded Album Matching**: Updated home feed section definition matchers to include `'new albums'`, `'latest albums'`, `'albums'`, and `'top albums'`, ensuring full shelf prominence for new and trending album releases.

## [1.2.1] - 2026-07-25

### 📊 "Kur Rewind" & Local Listening Statistics Dashboard
- **Personalized Listening Analytics**: Added a visual **"Kur Rewind"** dashboard in the Library tab displaying total minutes listened, top played artists carousel, and most played songs ranking.
- **"Your Daily Mix" Generator**: Added a one-tap action to queue up your top played tracks into a fresh live mix.

### 🌊 Soundwave Spectrum Visualizer & Glassmorphism Aesthetics
- **Animated Audio Visualizer**: Added an animated 9-bar soundwave visualizer directly beneath the album cover on the Now Playing screen (`SoundwaveVisualizer`).
- **Dynamic Artwork Palette Extraction**: Updated player theme context to smoothly adapt primary accents and background gradient tints to the active track's artwork colors.

### 📻 Universal Radio Resolution & Automated Changelogs
- **Featured & Artist Radio Resolution**: Fixed radio track fetching so tapping any Featured Radio station or Artist Radio card resolves all 25 live streaming tracks.
- **Automated OTA Release Notes**: Configured GitHub Actions to automatically extract version release notes from `CHANGELOG.md` and display them inside the app's OTA update dialog.

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
