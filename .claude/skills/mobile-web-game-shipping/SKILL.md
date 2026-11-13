---
name: mobile-web-game-shipping
description: >
  Ship an HTML5/JS game as a real phone app: PWA (manifest, service worker, offline, install),
  then a native Android/iOS app via Capacitor, with safe saves, touch input, back button, safe
  areas, haptics and performance on mid-range phones. Use for anything about running the game on
  the owner's phone, installing it, app icons, offline play, APK/IPA builds, or saves lost on mobile.
---

# Shipping a web game to phones

Facts last checked 2026-11-13 (re-verify before relying on versions):
- Capacitor 8 is the active major (8.0: Dec 2025; 8.5: Jul 2026, adds UIScene support needed for
  iOS 27). v7 support ends 2026-12-08. A Capacitor 9 roadmap exists (Aug 2026).
- CocoaPods trunk becomes read-only 2026-12-02: prefer Swift Package Manager for iOS deps.
- iOS Safari can evict script-written storage (localStorage/IndexedDB) after ~7 days without
  use when not installed; reports of loss even for Home-Screen apps exist. **Never rely on
  localStorage alone for saves on iOS.**

## Path (in order)

1. **PWA** (fastest, works on Android and iOS):
   - `manifest.webmanifest`: `name`, `short_name`, `lang:"ar"`, `dir:"rtl"`, `display:"standalone"`,
     `orientation:"portrait"`, `background_color`/`theme_color` from the CSS tokens, icons 192/512
     + a maskable 512.
   - Service worker: precache the app shell (HTML/JS/CSS/fonts) with a versioned cache name;
     bump it every release; `skipWaiting` only after the player confirms "update available".
   - Self-host the fonts (Google Fonts breaks offline).
   - Request `navigator.storage.persist()` after the first save (Android/Chrome honours it).
   - Host on GitHub Pages (HTTPS is required for a service worker).
2. **Native via Capacitor** (when the owner wants a real installable app / store build):
   - `npm i @capacitor/core @capacitor/cli` → `npx cap init` → `npx cap add android` (and `ios`
     on a Mac). Web assets come from the build output folder.
   - Saves: `@capacitor/preferences` or `@capacitor/filesystem` (native storage, not evicted),
     behind one `storage` adapter so the web build keeps using IndexedDB/localStorage.
   - Android back button: `@capacitor/app` `backButton` → close the top sheet/screen, never exit
     mid-game without confirmation.
   - Haptics (`@capacitor/haptics`) for decisive actions only (declare war, battle result).
   - Status bar/safe areas: keep `viewport-fit=cover` + `env(safe-area-inset-*)`.
   - Android APK: build with Gradle (`./gradlew assembleDebug`) in CI (GitHub Actions) so the
     owner can download the APK from the Actions artifacts without installing Android Studio.
   - iOS needs a Mac + Xcode + an Apple developer account for device installs beyond 7 days.

## Save safety (all platforms)

- Versioned JSON save (`save-systems` skill): `SAVE_VERSION` + migrations, never discard old saves.
- Two slots + autosave ring; write new → verify parse → then replace.
- **Export/import save as a file** (share sheet / download): the only save that survives app
  deletion, phone change and iOS eviction. Offer it in settings.

## Phone UX rules

- One-handed portrait; primary actions in the bottom third; touch targets ≥ 44×44 CSS px.
- No hover-only information; long-press or tap-to-reveal for tooltips.
- Respect `prefers-reduced-motion`; battle speed/skip always available.
- Canvas: cap devicePixelRatio at 2; redraw only on change (not every frame) for the map;
  cache layer canvases; avoid `getComputedStyle` inside draw loops.
- Audio starts only after a user gesture; resume `AudioContext` on visibility change.
- Test on a mid-range Android (e.g. 4 GB RAM) for 15 minutes for thermal throttling.

## Verify

- Lighthouse PWA/installability checks pass (Chromium is preinstalled here: `/opt/pw-browsers/chromium`).
- Airplane-mode test: open the installed app offline, play a month, save, reopen.
- Save survives: update the app version → old save loads.
- The owner confirms on their actual phone (state which phone/OS was tested in the changelog).
