# Version 2.0 validation

Tested 30 September 2026, America/Chicago.

## Automated checks that passed

The Python project verifier passed with 1,826 daily records, 115 curated fixed-date entries, 70 martyr profiles, 41 historical spotlights, 18 prayers, 19 original icon assets, and 66 offline shell resources. JavaScript syntax checks passed for the app, companion, storage repository, and service worker.

The Chromium browser suite passed these twelve groups:

1. All eighteen prayers and calendar content load from a project subdirectory, as on GitHub Pages.
2. The prayer timer starts, pauses, resumes, reaches zero, and records completion once. Background return is simulated by advancing the browser clock and firing a visibility event.
3. Reflections and intentions save and edit; intentions can be checked off. A markup-like reflection remains escaped text.
4. The local display name, reading size, prayer rule, reflection, intentions, and original journal survive reloads.
5. The seven-practice introduction records completion. Escape closes the native prayer dialog.
6. Prayer search works and existing favorites remain available.
7. A complete backup includes old and new data and restores it. An unsupported companion backup is rejected before the original journal can be overwritten.
8. The reminder download contains a daily recurrence and display alarm.
9. The original parish form saves a church.
10. All thirteen views fit 390, 430, 768, and 1440 pixel viewport widths without horizontal page overflow.
11. After the service worker installs, an offline reload retains the prayer library, a loaded monastery photograph, and saved reflections.
12. No uncaught JavaScript errors occurred during the browser suite.

## Visual inspection

The desktop and phone home pages, mobile prayer dialog, reflection form, and existing daily calendar were rendered and inspected. A closed settings-drawer shadow and low-contrast calendar navigation buttons were corrected. The main phone navigation sits at the bottom with safe-area spacing. The prayer dialog uses native modal focus behavior.

## Limits of this validation

These are Chromium tests at representative phone and desktop dimensions, not tests on a physical iPhone or Android device. Safari installation, device-specific speech quality, locked-screen playback, and calendar import behavior need a real-device check. No human-recorded narration or push-notification service is included.

The existing calendar dataset was checked for its original structural invariants, not newly audited for every jurisdiction’s observances. New original prayer texts and practice prompts have not received formal ecclesiastical review.

The code has not been published to the live GitHub Pages site. Live deployment verification remains the repository owner’s final check after upload.

## Repeat the browser checks

Install Playwright in a development environment. Run a web server from the directory above the project folder:

```sh
python -m http.server 8080
```

Then run:

```sh
node orthodox-daily-main/tools/browser-tests.cjs
```

Set `BASE_URL` if your directory or port differs. Set `BROWSER_EXECUTABLE` to use an existing Chromium binary; otherwise Playwright uses its installed browser. `NODE_PATH` can identify an existing Playwright installation. The suite uses a fresh browser profile and illustrative test entries, never your normal browser data.
