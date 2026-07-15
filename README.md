# Orthodox Daily

A fully static, installable Orthodox prayer, parish-calendar, holy-icon, and historical calendar app designed for GitHub Pages.

## What is included

- Local daily calendar data from **January 1, 2026 through December 31, 2030**
- Automatic date and time display, with a full daily-content rollover shortly after local midnight when the app is following Today
- Precomputed Paschal-cycle dates and movable commemorations for all five years
- 115 curated principal fixed-date entries
- 70 indexed martyr profiles with commemoration date, life/martyrdom dates, place, and a biography capped at 149 characters
- 41 “On This Date” historical spotlights
- 14 traditional or clearly labeled original devotional prayers
- Revised/New Calendar and Old/Julian fixed-commemoration display
- Broad fasting guidance with pastoral and medical cautions
- **Visible Local Churches Calendar** on the Today dashboard and in its own navigation section
- Browser-local church directory, primary-parish selection, service/event entry, published-calendar links, and `.ics` import/export
- **19 genuine local Orthodox icon images**, with the Theotokos and Archangels given the highest priority
- Searchable Holy Icons library plus icon-backed daily and martyr displays
- Offline moon phase and approximate sunrise/sunset calculations
- Pascha countdown
- Searchable prayer, expanded martyr-profile, icon, and history archives
- Private browser-local journal
- Candle prayer timer with an optional completion chime
- Export/import for settings, favorites, journal entries, churches, and local church events
- Responsive layouts for iPhone/iPad, Android phones/tablets, Windows and Mac laptops, desktop, ultrawide, and 4K displays
- Progressive Web App installation and offline operation
- Automatic service-worker refresh when updated files are published

There are no CDNs, analytics scripts, advertisements, accounts, remote databases, cloud APIs, or required external data feeds. Links to a parish website or published parish calendar open only when the user selects them.

## Important editorial scope

Orthodox jurisdictions do not always publish identical daily commemoration lists or fasting rubrics. This edition does **not** fill gaps with invented certainty. It provides curated principal entries on 115 fixed dates and an explicit jurisdictional notice on other dates. The JSON structure is intentionally easy to extend with the calendar of a specific archdiocese, metropolis, diocese, monastery, or parish.

Fasting text is general information, not a substitute for the direction of a priest or physician.

## Local Churches Calendar

The Local Churches tab is visible in the primary navigation. A summary for the selected day is also visible on the Today dashboard.

Users can:

- Save one or more Orthodox churches locally
- Mark a primary parish
- Store website and published-calendar links
- Enter Divine Liturgies, Vespers, feast services, confessions, and parish events
- Import standard `VEVENT` entries from an `.ics` file
- Export the locally entered events as an `.ics` calendar
- Back up and restore church data through the app’s JSON export

Church information and events use browser `localStorage`; they are not uploaded by the app.

## Holy Icons

`data/icons.json` controls the local icon library. The current edition contains 19 real icon images stored under `assets/icons/`. The app prioritizes the Theotokos, including the Vladimir, Hodegetria, Passion, Dormition, and Nativity icons, followed by Archangels Michael and Gabriel, saints, and martyrs.

See `ICON_INVENTORY.md` and `THIRD_PARTY_NOTICES.md` for source pages, dimensions, and reuse status.

## Deploy to GitHub Pages

1. Create a new GitHub repository and place all project files in the repository root.
2. Push the project to the `main` branch.
3. In **Settings → Pages**, select **GitHub Actions** as the source.

The included workflow at `.github/workflows/pages.yml` verifies the data and file-size limit before deploying.


## Install on iPhone, iPad, and Android

After the GitHub Pages site is published:

- **iPhone/iPad:** open the site in Safari, use **Share → Add to Home Screen**, and confirm.
- **Android:** open the site in Chrome or Edge and choose **Install app** or **Add to Home screen**.
- **Windows/macOS:** supported Chromium browsers can install the site from the browser’s install control; Safari on macOS can also save the site as a web app where supported.

The first visit needs a network connection so the service worker can cache the application. After that first successful load, the calendar, prayers, local icon library, and locally saved church schedule remain available offline.

## Test locally

Python:

```bash
python -m http.server 8080
```

Then open `http://localhost:8080`.

Do not test by double-clicking `index.html`; browsers block local JSON requests from `file://` pages.

## Verify the build

```bash
python tools/verify_project.py
```

The verifier checks required files, JSON validity, calendar completeness, Pascha dates, martyr-profile coverage, the 149-character biography limit, genuine local icon metadata and dimensions, Local Churches interface controls, JavaScript-to-HTML bindings, install icons, service-worker assets, and the rule that every individual file remains below 23 MiB.

## Editing content

- `data/fixed-calendar.json` — fixed-date feasts, saints, and martyrs
- `data/history.json` — historical daily spotlights
- `data/martyrs.json` — expanded martyr profiles and concise biographies
- `data/icons.json` — holy icon metadata, priority, aliases, source, and local file path
- `data/prayers.json` — prayer library
- `data/practices.json` — short daily practices
- `data/years/*.json` — generated daily records, movable feasts, fasting, and Pascha

After changing files, change `CACHE_NAME` in `service-worker.js` for an immediate clean cache migration. The network-first service worker will also refresh changed files when the published site is revisited.

## Date rollover and data window

While the app is displaying Today, it advances the complete daily page after the device’s local calendar date changes. If a user deliberately browses to another date, the app preserves that selected date rather than interrupting the reading.

After December 31, 2030, the app clearly displays the final stored date and states that a newer data package is needed; it does not silently return to 2026.

## Old Calendar behavior

For the supported period, the app shifts fixed commemorations by 13 civil days when Old/Julian mode is selected. Movable Paschal observances remain attached to their precomputed civil dates. Jurisdiction-specific fasting details should still be checked against the user’s parish calendar.

## Privacy

Journal entries, favorites, preferences, local churches, and parish events use browser `localStorage`. They never leave the device through this app. Clearing browser site data removes them unless the user first creates an export.

## License and sources

Code is released under the MIT License. See `SOURCES.md`, `THIRD_PARTY_NOTICES.md`, `CONTENT_NOTES.md`, `IMAGE_INVENTORY.md`, and `ICON_INVENTORY.md` for editorial scope and reference notes.
