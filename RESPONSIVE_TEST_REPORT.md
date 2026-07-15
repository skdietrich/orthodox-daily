# Responsive and Functional Test Report

Build **1.3.0** was exercised in headless Chromium using the packaged local HTML, CSS, JavaScript, JSON, artwork, and holy-icon files. Production assets were loaded from the project; the test harness substituted browser storage only so repeatable local church workflows could be tested without altering a real browser profile.

| Device class | Viewport | Horizontal overflow | Result |
|---|---:|---:|---|
| Compact iPhone | 375 × 667 | None | Passed |
| Large iPhone | 430 × 932 | None | Passed |
| Android phone | 412 × 915 | None | Passed |
| iPad / Android tablet | 820 × 1180 | None | Passed |
| Mac laptop | 1440 × 900 | None | Passed |
| Windows FHD laptop/desktop | 1920 × 1080 | None | Passed |
| 4K monitor | 3840 × 2160 | None | Passed |

Checks performed:

- The Local Churches tab remained visible and usable.
- A church could be added, marked primary, and displayed on the Today dashboard.
- A Divine Liturgy/service event could be added and marked on the month calendar.
- `.ics` event import and export passed.
- The Holy Icons view loaded all 19 genuine local icon images.
- Theotokos and Archangel priority presentation rendered correctly.
- Icon search, category filtering, daily icon matching, and martyr-icon matching passed.
- The Martyrs view rendered all 70 profiles, and no “About the Martyr” text reached 150 characters.
- The Today view advanced after simulated local midnight only when it was following Today.
- No JavaScript console errors or missing production assets were detected in the tested workflows.

The CSS includes Apple safe-area padding, touch-sized controls, fluid images, `object-fit: contain` for uncropped sacred icons, coarse-pointer support, reduced-motion handling, portrait/landscape adjustments, mobile navigation scrolling, laptop width constraints, and restrained ultrawide/4K content widths.
