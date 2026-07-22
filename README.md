<p align="center">
  <img src="assets/images/kur-logo.png" alt="Kur Music Logo" width="128" height="128" style="border-radius: 28px;" />
</p>

<h1 align="center">Kur Music</h1>

<p align="center">
  <strong>Next-Generation Open-Source Music Player for Android</strong>
</p>

<p align="center">
  <a href="https://github.com/akhilraghavakurup-beep/kur3.0/releases">
    <img src="https://img.shields.io/github/v/release/akhilraghavakurup-beep/kur3.0?color=7C3AED&label=Version" alt="Version 1.1" />
  </a>
  <img src="https://img.shields.io/badge/Platform-Android%20arm64--v8a-blue" alt="Android ARM64" />
  <img src="https://img.shields.io/badge/Engine-New%20Road%20to%20Dreams-purple" alt="Engine" />
  <img src="https://img.shields.io/badge/License-MIT-green" alt="MIT License" />
</p>

---

## 🌟 About Kur Music

**Kur Music** is a state-of-the-art, plugin-powered open-source music streaming and offline player built with **React Native**, **Expo**, and **React Native Track Player**. Designed with modern Material 3 and Glassmorphism aesthetics, Kur Music delivers a fast, ad-free, and immersive audio experience.

---

## ✨ Features

- ⚡ **Plugin-Powered Streaming** — Unified music discovery and metadata streaming powered by extensible plugins (JioSaavn, Local Library, Core Library).
- 🎨 **M3 & Glassmorphism UI** — Adaptive dark/light themes, dynamic accent color pickers, ambient artwork blur, and customizable progress bar styles (Waveform, Expressive, Glow Line, Pulse).
- 🎧 **10-Band Equalizer** — Native 10-band audio equalizer with 10 custom presets (*Deep Bass, Bass Boost, Treble Boost, Pop, Dance, Party, Rock, Classical, Jazz, Lounge*).
- 🔄 **In-App Auto Updates** — Built-in background update checker with release changelogs, live download progress bar, and 1-tap installation.
- 💾 **Smart Cache & Maintenance** — 1-tap image and temporary data memory cache cleaner to keep the app ultra-fast and lightweight.
- ⏱️ **Bedtime Sleep Timer** — Quick timer preset shortcuts (*15m, 30m, 45m, 60m*) for seamless nighttime listening.
- 📜 **Smart Queue Management** — Drag-to-reorder playback queue with real-time total queue duration calculation and 1-tap queue clearing.
- 📱 **Lightweight ARM64 Build** — Optimized `arm64-v8a` binary target for up to 50% smaller APK footprint.

---

## 📥 Download & Installation

Get the latest release APK from the official **[Releases Page](https://github.com/akhilraghavakurup-beep/kur3.0/releases)**.

```bash
# Download kurmusic-1.1.0-release.apk and install on any Android 8.0+ 64-bit device
```

---

## 🛠️ Quick Setup for Developers

```bash
# Clone the repository
git clone https://github.com/akhilraghavakurup-beep/kur3.0.git
cd kur3.0

# Install dependencies
npm install

# Start local Expo server
npx expo start
```

Press `a` to launch on Android emulator/device.

---

## 📦 Building Production APK

```bash
# Build standalone release APK locally (Outputs to out/kurmusic.apk)
npm run build:android
```

---

## 👑 Team Credits & Acknowledgments

- 🎧 **Kurup** — Lead Developer & Creator
- 🧪 **Nemo** — Lead QA & Testing
- ⚡ **KurMon** — Core Audio Engine & Architectural Logic

---

## 📂 Project Architecture

```
app/                   # Navigation routes & screens (Expo Router)
assets/                # Brand logos, icons, and animations
src/
├── application/       # State management (Zustand) & core services
├── components/        # Glassmorphism UI & M3 components
├── domain/            # Entities, value objects & contracts
├── hooks/             # Custom React hooks
├── infrastructure/    # Storage repositories & DI
├── plugins/           # JioSaavn, Local Library & Playback modules
└── shared/            # Utility helpers & loggers
```

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
