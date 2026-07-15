# Content Notes

## Calendar coverage

The app contains one daily record for every civil date from 2026-01-01 through 2030-12-31. Each daily record supplies:

- the fixed calendar key;
- any locally stored movable feast;
- a broad fasting classification;
- that year’s Pascha date;
- the number of days before or after Pascha;
- a rotating daily-practice index.

The fixed calendar contains all 366 possible month/day keys, including February 29. Of those entries, 115 contain a curated principal commemoration. The remainder deliberately say that the full list varies by Orthodox jurisdiction.

## Fasting

Fasting discipline varies with jurisdiction, local typikon, pastoral economy, health, age, pregnancy, occupation, and other circumstances. The app therefore presents broad seasonal guidance only.

## Historical entries

The “On This Date” section contains concise educational spotlights linked to selected dates. It is not intended to imply that an event occurred in the modern Gregorian calendar on precisely that date when the underlying historical record used another calendar. Entries are framed around the Church’s annual remembrance.

## Astronomy

Moon phase and solar times are calculated locally. Sunrise and sunset are approximate and use a longitude-derived solar time zone, so they should not be treated as official civil-time astronomical data.

## Prayer texts

The library combines widely used traditional prayer forms and original devotional material. It is a portable aid, not a replacement for an Orthodox prayer book blessed or recommended by one’s priest.

## Data expansion

To create a jurisdiction-specific edition, replace the jurisdictional notices in `data/fixed-calendar.json` with entries checked against the official calendar of that Church body. Preserve the `display`, `martyrs`, and `status` fields so the interface continues to work.

## Visual artwork

The app includes eighteen original 1600×900 JPEG illustrations created specifically for the application. They are labeled as original devotional artwork in the interface and in `data/images.json`. They should not be represented as canonical Orthodox icons, historical photographs, or documentary evidence.


## Genuine icon library

Version 1.3 adds nineteen locally stored derivatives of genuine Orthodox icon images. Five Theotokos icons and the Archangels Michael and Gabriel receive the highest display priorities. These files remain distinct from the app’s original atmospheric artwork, and each icon retains a Wikimedia Commons source page and reuse-status note in `data/icons.json` and `ICON_INVENTORY.md`.

## Local Churches calendar

The Local Churches section is an offline personal parish directory and event calendar. It stores churches, primary-parish selection, services, parish events, and imported standard `VEVENT` data in the browser. It does not silently fetch or republish a parish’s remote calendar; published website and calendar links open only when selected by the user.
