# Orthodox Daily

A fully static, installable Orthodox prayer and historical calendar app designed for GitHub Pages.

## What is included

- Local daily calendar data from **January 1, 2026 through December 31, 2030**
- Precomputed Paschal-cycle dates and movable commemorations for all five years
- 115 curated principal fixed-date entries
- 70 indexed martyr profiles with commemoration date, life/martyrdom dates, place, and a biography capped at 149 characters
- 41 “On This Date” historical spotlights
- 14 traditional or clearly labeled original devotional prayers
- Revised/New Calendar and Old/Julian fixed-commemoration display
- Broad fasting guidance with pastoral and medical cautions
- Live clock and date controls
- Offline moon phase and approximate sunrise/sunset calculations
- Pascha countdown
- Searchable prayer, expanded martyr-profile, and history archives
- Private browser-local journal
- Candle prayer timer with an optional completion chime
- Export/import for settings, favorites, and journal entries
- Responsive layouts for iPhone/iPad, Android phones/tablets, Windows and Mac laptops, desktop, ultrawide, and 4K displays
- Progressive Web App installation and offline operation
- Automatic service-worker refresh when updated files are published

There are no CDNs, analytics scripts, advertisements, accounts, remote databases, cloud APIs, or required external data feeds.

## Important editorial scope

Orthodox jurisdictions do not always publish identical daily commemoration lists or fasting rubrics. This edition does **not** fill gaps with invented certainty. It provides curated principal entries on 115 fixed dates and an explicit jurisdictional notice on other dates. The JSON structure is intentionally easy to extend with the calendar of a specific archdiocese, metropolis, diocese, monastery, or parish.

Fasting text is general information, not a substitute for the direction of a priest or physician.

## Deploy to GitHub Pages

1. Create a new GitHub repository and place all project files in the repository root.
2. Push the project to the `main` branch.
3. In **Settings → Pages**, select **GitHub Actions** as the source.

The included workflow at `.github/workflows/pages.yml` verifies the data and file-size limit before deploying.

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

The verifier checks required files, JSON validity, calendar completeness, Pascha dates, martyr-profile coverage, the 149-character biography limit, DOM bindings, icon dimensions, service-worker assets, and the rule that every individual file remains below 23 MiB.

## Editing content

- `data/fixed-calendar.json` — fixed-date feasts, saints, and martyrs
- `data/history.json` — historical daily spotlights
- `data/martyrs.json` — expanded martyr profiles and concise biographies
- `data/prayers.json` — prayer library
- `data/practices.json` — short daily practices
- `data/years/*.json` — generated daily records, movable feasts, fasting, and Pascha

After changing files, change `CACHE_NAME` in `service-worker.js` for an immediate clean cache migration. The network-first service worker will also refresh changed files when the published site is revisited.

## Old Calendar behavior

For the supported period, the app shifts fixed commemorations by 13 civil days when Old/Julian mode is selected. Movable Paschal observances remain attached to their precomputed civil dates. Jurisdiction-specific fasting details should still be checked against the user’s parish calendar.

## Privacy

Journal entries, favorites, and preferences use browser `localStorage`. They never leave the device through this app. Clearing browser site data removes them unless the user first creates an export.

## License and sources

Code is released under the MIT License. See `SOURCES.md` and `CONTENT_NOTES.md` for editorial scope and reference notes.
