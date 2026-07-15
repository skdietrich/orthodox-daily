# Responsive Test Report

Build 1.2.0 was exercised in a headless Chromium browser with local assets and JSON requests intercepted from the packaged project.

Tested viewport classes:

- 375 × 667 — compact iPhone-class display
- 430 × 932 — large iPhone-class display
- 412 × 915 — Android phone-class display
- 820 × 1180 — iPad/tablet-class display
- 1440 × 900 — Mac laptop-class display
- 1920 × 1080 — Windows desktop/laptop display
- 3840 × 2160 — 4K monitor

Checks performed at every size:

- Application initialized without JavaScript console errors
- Today view rendered local data
- Martyrs view rendered all 70 profiles
- No “About the Martyr” text reached 150 characters
- No horizontal page overflow on Today or Martyrs views
- Images, search controls, navigation, and cards remained within the viewport

The CSS also includes safe-area padding for notched Apple devices, coarse-pointer touch targets, reduced-motion handling, portrait/landscape adjustments, fluid images, and large-display width caps.
