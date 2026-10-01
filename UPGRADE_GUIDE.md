# Orthodox Daily 2.0

This release adds a daily prayer companion to your existing Orthodox calendar app. It runs on the same free GitHub Pages site, without a build service, API key, subscription, or server.

## Publish the upgrade

1. In the current live app, open **Tools → Export my data**. Keep that backup somewhere private.
2. Extract `orthodox-daily-v2.zip` on your computer.
3. Open the extracted `orthodox-daily-main` folder. Copy its **contents** into the root of your existing `orthodox-daily` repository, replacing matching files. Do not upload the ZIP itself or nest a second project folder inside the repository. Keep the `.github` folder and `.nojekyll` file.
4. Commit and push to the existing `main` branch. If you use GitHub Desktop, review the changed files, commit, then choose **Push origin**.
5. In GitHub **Settings → Pages**, keep or select **GitHub Actions** as the source. The included workflow checks the project and deploys it.
6. Wait for the **Deploy Orthodox Daily to GitHub Pages** workflow to finish successfully. Visit `https://skdietrich.github.io/orthodox-daily/` and reload. If an installed copy still shows the previous interface, close it and reopen it after visiting the site online. Avoid clearing site data; that deletes local entries.
7. Confirm **Explore → About & sources → Build** shows **2.0.0**.

The package is ready to upload. It has not been pushed to your GitHub account or published on the live site.

## What changed

- A new home screen with real, locally stored photographs of Meteora and Mount Athos.
- Five main destinations: Today, Pray, Reflect, My rule, and Explore.
- Eighteen searchable prayers, with traditional and original devotional wording identified.
- Prayer sessions with a choice of one, three, five, or ten minutes, pause/resume, and manual completion.
- Optional device read-aloud with voice and pace controls. This is browser text-to-speech, not studio narration. Voice quality, network requirements, and screen-lock behavior vary by device.
- Dated gratitude reflections, space to name a burden, and a small act of kindness to consider.
- Editable saved reflections, an entry history, and private local prayer intentions that can be checked off or deleted.
- A configurable daily prayer rule and a seven-day record without competitive streaks.
- Seven introductory prayer practices, saved as you complete them. These are app-written prompts, not an official catechetical course.
- A local display name and larger prayer text.
- A downloadable daily calendar reminder. Import the `.ics` event into your calendar and allow calendar alerts. This does not create app push notifications.
- Backup exports now include the new personal data alongside the original journal, parish calendar, favorites, and settings.

All existing calendar, icon, martyr, history, fasting, astronomy, parish, timer, and journal features remain accessible through Explore. The original journal is separate from the new structured reflections; its entries have not been moved or overwritten.

## Hosting and the backend

Your `github.io` address already has HTTPS. You do not need to buy an SSL certificate for it. GitHub Pages serves static files; it does not run a private application server or database.

This release therefore has a front end and a local data layer, **not a hosted backend**. Public content lives in version-controlled JSON. A separate `js/storage.js` repository validates and saves the new personal records. Its single-record writes avoid partially saved personal records when storage is full. The original storage keys remain in place.

Accounts, cloud sync, a shared prayer wall, subscriptions, and server notifications are not enabled. A future version would need an external authentication and database service with per-user access rules. HTTPS alone does not provide authentication. Do not put passwords, private journal exports, service credentials, or database administrator keys into this public repository.

Before adding accounts, decide whether personal reflections should be synchronized at all. A hosted version also needs account deletion, backup and recovery, a privacy policy, and testing that one user cannot read another user’s entries. The local display name in this release is not a registered username.

## Privacy and offline use

Personal records are stored in this browser profile, without app-level encryption. They are not sent to a server by the app, but someone with access to the browser profile can read them. Clearing site data or losing the device can remove them. Export backups periodically and keep them out of the public repository.

The app caches its public interface, content, icons, and photographs after a successful first online load. Browser storage may be evicted; offline access is not a substitute for a backup. Read-aloud depends on the voices available on the device. No private reflection or intention is sent to the speech engine by the app.

A new release installs a complete offline bundle. Save your work and reload to use the new version. When changing public content in future, also change `CACHE_NAME` in `service-worker.js`.

## Editorial scope

The calendar remains the original 2026–2030 dataset, with its existing jurisdictional qualifications. This upgrade does not claim a newly verified universal calendar or daily lectionary. Original devotional prayers are labeled in the prayer book and sessions. They should be reviewed by an Orthodox priest before institutional endorsement.

Hallow informed the choice of features, not the wording, branding, recordings, or artwork. No Hallow content has been copied into the app.

Photo sources and license links appear in the app and in `THIRD_PARTY_NOTICES.md`. The photo licenses are separate from the MIT code license.

## Run locally

From the repository root:

```sh
python -m http.server 8080
```

Open `http://localhost:8080`. Double-clicking `index.html` will not work because the browser must fetch local JSON through a web server.

Verify data and project structure:

```sh
python tools/verify_project.py
```

See `TEST_REPORT.md` for the checks performed on this release and their limits.
