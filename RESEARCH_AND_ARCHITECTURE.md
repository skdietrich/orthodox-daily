# Research and architecture

Reviewed 30 September 2026 (America/Chicago).

## What carries over from Hallow

Hallow’s published feature descriptions include guided prayer, different session lengths, journals, reminders, downloadable listening, and community features. Orthodox Daily adopts the practical ideas that fit a static app, using its own interface and content.

| Experience | This release | Boundary |
| --- | --- | --- |
| Daily prayer home | Photographic home screen and prayer suggestions | Locally selected content, not server recommendations |
| Guided sessions | Prayer text, original practice prompts, selectable timer | Not a clergy-recorded audio library |
| Listening | Browser voice selection and reading pace | Voices and offline availability depend on the device |
| Reflection | Gratitude, burdens, kindness, mood, dated entry history | Local browser storage, not encrypted cloud storage |
| Personal routine | Customizable rule, daily completion, seven-practice introduction | No competitive streaks or claims of spiritual achievement |
| Reminder | Recurring calendar file with an alarm | Requires calendar import; no push service |
| Saved content | Existing favorites and a cached prayer library | Browser storage can be evicted |
| Profile | Local display name and reading size | No authentication or reserved usernames |
| Community | Existing personal parish and service tools retained | No shared feed, messaging, or multiuser prayer wall |

Primary references:

- [Hallow features](https://hallow.com/features/)
- [Hallow mobile app overview](https://help.hallow.com/en/articles/9650908-overview-of-the-mobile-app)
- [Hallow on the App Store](https://apps.apple.com/us/app/hallow-prayer-meditation/id1405323394)
- [Hallow on Google Play](https://play.google.com/store/apps/details?id=app.hallow.android)
- [GitHub Pages overview](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages)
- [GitHub Pages HTTPS](https://docs.github.com/en/pages/getting-started-with-github-pages/securing-your-github-pages-site-with-https)

The research used two available web search systems and retrieved primary source pages. Direct queries were also attempted through Google, DuckDuckGo, Yandex, Bing, Baidu, Yahoo, and Ecosia. Several returned throttling, challenges, empty results, or timeouts. Those attempts were not treated as independent factual verification.

## Application structure

- `index.html`: original reference views plus the new home, reflection, rule, and exploration views; native prayer-session dialog.
- `css/styles.css`: retained base and archive styles.
- `css/companion.css`: responsive companion design, phone navigation, readable sessions, and integration fixes.
- `js/app.js`: existing calendar and archive logic, navigation, parish tools, favorites, journal, and expanded backup payload.
- `js/storage.js`: versioned local repository for personal data. Validates imports, limits field sizes, rejects malformed records, and commits each companion state in one localStorage write.
- `js/companion.js`: prayer sessions, text-to-speech, reflections, intentions, routine, local profile, and reminders. User-entered text is escaped or assigned through text/value properties.
- `data/*.json`: public content. Prayer records now include a visible origin label.
- `service-worker.js`: complete, versioned static bundle with cache-first reads after installation. It never stores personal records in the public cache.
- `.github/workflows/pages.yml`: verification and GitHub Pages deployment.

The timer uses a deadline and elapsed wall-clock time, so a throttled background interval does not have to fire once for every second. It refreshes on visibility changes. An uncompleted session is not restored across a full page reload; completed practices are saved.

Backup import retains support for older exports without a companion field. Importing a backup replaces the included data categories; it is not a conflict-resolving cloud synchronization system.

## A later hosted backend

A future hosted service can keep GitHub Pages as the front end. It would need an authentication provider and private tables keyed to authenticated user IDs. Access control must be enforced at the database or API, never by a username supplied by the browser.

Suggested records are profiles, dated reflections, intentions, selected rule practices, and dated completions. A service implementation should expose operations through the same repository boundary, with explicit synchronization states, conflict handling, export, and account deletion. Migration should ask the user before uploading previously local reflections.

No backend credentials, external service configuration, unfinished login form, or pretend cloud connection is included in this release.
