# 🎵 Kur Music Changelog

All notable changes to this project will be documented in this file.

---

## [1.1.1] - 2026-07-22 ("New Road to Dreams")

### 🚀 Auto-Update & System Features
- **In-App Auto-Update System**: Added background version checking via GitHub Releases API, live download progress bar, formatted release notes viewer, and 1-tap APK installation (`AutoUpdateDialog`).
- **Engine Build Tag**: Updated build tag across settings, version dialog, and badges to **New Road to Dreams**.

### 🎨 Visual & Branding Overhaul
- **8K High-Res Vector Logos**: Generated a new crisp, vector soundwave and musical note squircle logo for Kur Music.
- **Home Header Branding**: Expanded Home screen header logo badge to **42x42px** with glassmorphism surface container backdrop (`surfaceContainerHigh`) and `contentFit="cover"`.
- **AAPT2 Binary PNG Fix**: Converted all 9 image assets (`kur-logo.png`, `icon.png`, `splash-icon.png`, `android-icon-foreground.png`, etc.) to authentic 8-bit RGBA PNG headers (`0x89504E47`), resolving AAPT2 compilation failures.

### 📱 UI & Layout Polish
- **Main Player Track Title Scaling**: Implemented adaptive font scaling (`numberOfLines={2}`, `adjustsFontSizeToFit={true}`, `minimumFontScale={0.75}`) so long song titles display fully without cutoffs.
- **Main Player Artwork Constraints**: Constrained artwork dimensions (`maxWidth: 320`, `maxHeight: 44%`) for balanced proportions on all screen sizes.
- **Splash Screen Polygon Masking**: Rounded splash logo container (`borderRadius: 28px`) to align seamlessly inside the morphing SVG polygon backdrop.

### 🛠️ Bug Fixes & Code Quality
- **Settings Screen Crash**: Fixed React Error Boundary crash caused by importing an undefined icon (`BroomIcon`). Replaced with `SparklesIcon` for the Clear Cache quick action.
- **ESLint Clean-up**: Fixed JSX unescaped single quote rules (`What&apos;s New in v`) and pruned unused imports across 7 core components.

### ⚙️ CI/CD & Build Workflows
- **Targeted ARM64-v8a Architecture**: Configured release workflows to build lightweight `arm64-v8a` APKs for faster builds and smaller downloads.
- **Detached HEAD Git Push Fix**: Added `--force` flag to `git push origin HEAD:main` in GitHub Actions workflows to resolve detached HEAD push rejections.
- **Build Test Workflow**: Added `.github/workflows/build.yml` for manual (`workflow_dispatch`) and push testing.

---

## [1.1.0] - 2026-07-20 ("Initial Release")
- Initial release with plugin-based streaming, library management, offline downloads, synced lyrics, equalizer, and sleep timer.
