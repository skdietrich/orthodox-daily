(() => {
  "use strict";

  const APP_VERSION = "2.1.0";
  const MIN_DATE = "2026-01-01";
  const MAX_DATE = "2030-12-31";
  const DAY_MS = 86400000;
  const $ = selector => document.querySelector(selector);
  const $$ = selector => Array.from(document.querySelectorAll(selector));

  const state = {
    selectedDate: null,
    calendarMonth: null,
    fixed: {},
    history: {},
    prayers: [],
    practices: [],
    images: [],
    icons: [],
    martyrProfiles: [],
    churches: [],
    churchEvents: [],
    followToday: true,
    lastClockDay: null,
    years: {},
    favorites: new Set(),
    settings: {
      calendarMode: "revised",
      location: "chicago",
      use24Hour: false,
      reduceMotion: false
    },
    deferredInstall: null,
    timer: {
      selectedSeconds: 300,
      remainingSeconds: 300,
      interval: null,
      running: false
    }
  };

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
    })[char]);
  }

  function parseISO(value) {
    const [year, month, day] = value.split("-").map(Number);
    return new Date(year, month - 1, day, 12, 0, 0);
  }

  function dateToISO(date) {
    return [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, "0"),
      String(date.getDate()).padStart(2, "0")
    ].join("-");
  }

  function fixedKey(date) {
    return `${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }

  function addDays(date, amount) {
    const result = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12);
    result.setDate(result.getDate() + amount);
    return result;
  }

  function inRange(date) {
    const iso = dateToISO(date);
    return iso >= MIN_DATE && iso <= MAX_DATE;
  }

  function getSupportedToday() {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12);
    const iso = dateToISO(today);
    if (iso < MIN_DATE) return parseISO(MIN_DATE);
    if (iso > MAX_DATE) return parseISO(MAX_DATE);
    return today;
  }

  function getFixedDate(civilDate) {
    return state.settings.calendarMode === "old" ? addDays(civilDate, -13) : civilDate;
  }

  function formatLongDate(date) {
    return new Intl.DateTimeFormat(undefined, {
      weekday: "long", month: "long", day: "numeric", year: "numeric"
    }).format(date);
  }

  function formatShortDate(date) {
    return new Intl.DateTimeFormat(undefined, {
      month: "short", day: "numeric", year: "numeric"
    }).format(date);
  }

  function formatMonthDayFromKey(key) {
    const [month, day] = key.split("-").map(Number);
    return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" })
      .format(new Date(2028, month - 1, day, 12));
  }

  function dayDifference(a, b) {
    const aUtc = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
    const bUtc = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
    return Math.round((aUtc - bUtc) / DAY_MS);
  }

  function loadLocalState() {
    try {
      const storedSettings = JSON.parse(localStorage.getItem("orthodoxDailySettings") || "{}");
      state.settings = { ...state.settings, ...storedSettings };
      state.favorites = new Set(JSON.parse(localStorage.getItem("orthodoxDailyFavorites") || "[]"));
      state.churches = JSON.parse(localStorage.getItem("orthodoxDailyChurches") || "[]");
      state.churchEvents = JSON.parse(localStorage.getItem("orthodoxDailyChurchEvents") || "[]");
      if (!Array.isArray(state.churches)) state.churches = [];
      if (!Array.isArray(state.churchEvents)) state.churchEvents = [];
    } catch (error) {
      console.warn("Could not restore local preferences.", error);
    }
  }

  function saveSettings() {
    localStorage.setItem("orthodoxDailySettings", JSON.stringify(state.settings));
  }

  async function fetchJson(path) {
    const response = await fetch(path, { cache: "no-cache" });
    if (!response.ok) throw new Error(`Could not load ${path} (${response.status})`);
    return response.json();
  }

  async function loadData() {
    const [fixed, history, prayers, practices, images, icons, martyrs, ...yearFiles] = await Promise.all([
      fetchJson("data/fixed-calendar.json"),
      fetchJson("data/history.json"),
      fetchJson("data/prayers.json"),
      fetchJson("data/practices.json"),
      fetchJson("data/images.json"),
      fetchJson("data/icons.json"),
      fetchJson("data/martyrs.json"),
      ...[2026, 2027, 2028, 2029, 2030].map(year => fetchJson(`data/years/${year}.json`))
    ]);
    state.fixed = fixed.entries || {};
    state.history = history.spotlights || {};
    state.prayers = prayers.prayers || [];
    state.practices = practices.practices || [];
    state.images = images.images || [];
    state.icons = icons.icons || [];
    state.martyrProfiles = martyrs.martyrs || [];
    yearFiles.forEach(file => { state.years[file.year] = file; });
  }



  function getMartyrProfile(dateKey, name) {
    return state.martyrProfiles.find(item => item.feastDate === dateKey && item.name === name) || null;
  }

  function martyrProfileHtml(profile, name, dateKey) {
    const displayName = profile?.name || name;
    const lifeDates = profile?.lifeDates || "Date uncertain";
    const place = profile?.place || "Orthodox tradition";
    const about = profile?.about || "Remembered for steadfast Christian witness; surviving biographical details are limited.";
    return `<article class="martyr-mini-profile">
      <div class="martyr-mini-heading"><strong>${escapeHtml(displayName)}</strong><span>${escapeHtml(formatMonthDayFromKey(dateKey))}</span></div>
      <p class="martyr-dates">${escapeHtml(lifeDates)} · ${escapeHtml(place)}</p>
      <p class="martyr-about">${escapeHtml(about)}</p>
    </article>`;
  }

  function imageById(id) {
    return state.images.find(image => image.id === id) || null;
  }

  function normalizeText(value) {
    return String(value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  }

  function iconById(id) {
    return state.icons.find(icon => icon.id === id) || null;
  }

  function iconForText(value, preferredCategory = null) {
    const text = normalizeText(value);
    if (!text) return null;
    const matches = state.icons.filter(icon => {
      if (preferredCategory && icon.category !== preferredCategory) return false;
      return (icon.aliases || []).some(alias => text.includes(normalizeText(alias)));
    });
    return matches.sort((a, b) => (b.priority || 0) - (a.priority || 0))[0] || null;
  }

  function iconsForDay(date, record, fixed) {
    const fixedDate = getFixedDate(date);
    const textParts = [
      ...(movableTitles(record) || []),
      fixed?.display || "",
      ...(fixed?.martyrs || []),
      formatMonthDayFromKey(fixedKey(fixedDate))
    ];
    const text = textParts.join(" • ");
    const found = [];
    const add = icon => {
      if (icon && !found.some(item => item.id === icon.id)) found.push(icon);
    };

    const normalized = normalizeText(text);
    if (/theotokos|mother of god|virgin mary|dormition|annunciation|protection|nativity of the theotokos|meeting of/.test(normalized)) {
      if (normalized.includes("dormition")) add(iconById("theotokos-dormition"));
      if (normalized.includes("nativity of the theotokos")) add(iconById("theotokos-nativity"));
      if (normalized.includes("annunciation")) add(iconById("archangel-gabriel"));
      add(iconForText(text, "theotokos") || iconById("theotokos-vladimir"));
    }
    if (/archangel|bodiless powers|heavenly hosts|michael|gabriel/.test(normalized)) {
      add(iconForText(text, "archangels"));
      add(iconById("archangel-michael"));
      add(iconById("archangel-gabriel"));
    }
    (fixed?.martyrs || []).forEach(name => add(iconForText(name)));
    add(iconForText(text));

    if (!found.length) {
      const monthFallbacks = [
        "theotokos-vladimir", "theotokos-hodegetria", "theotokos-passion", "archangel-gabriel",
        "saint-nicholas", "saint-john-baptist", "saint-george", "theotokos-dormition",
        "theotokos-nativity", "archangel-michael", "saint-catherine", "theotokos-vladimir"
      ];
      add(iconById(monthFallbacks[date.getMonth()]));
    }
    if (found.length < 2) add(iconById("theotokos-vladimir"));
    return found.slice(0, 4);
  }

  function iconCardHtml(icon, compact = false) {
    if (!icon) return "";
    return `<figure class="icon-card ${compact ? "compact" : ""}">
      <div class="icon-frame"><img src="${escapeHtml(icon.src)}" alt="${escapeHtml(icon.alt)}" loading="lazy"></div>
      <figcaption>
        <strong>${escapeHtml(icon.title)}</strong>
        <span>${escapeHtml(icon.caption)}</span>
        <small>${escapeHtml(icon.era)} · ${escapeHtml(icon.license)}</small>
      </figcaption>
    </figure>`;
  }

  function renderTodayIcons(date, record, fixed) {
    const icons = iconsForDay(date, record, fixed);
    $("#todayIconGallery").innerHTML = icons.map(icon => iconCardHtml(icon, true)).join("");
    const primary = icons[0];
    if (primary) {
      $("#dailyHeroImage").src = primary.src;
      $("#dailyHeroImage").alt = primary.alt;
      $("#dailyHeroImage").classList.add("icon-mode");
      $("#dailyHeroTitle").textContent = primary.title;
      $("#dailyHeroCaption").textContent = `${primary.caption} • genuine icon image stored locally`;
    }
    const martyrIcon = (fixed?.martyrs || []).map(name => iconForText(name, "martyrs")).find(Boolean);
    if (martyrIcon) {
      $("#todayMartyrImage").src = martyrIcon.src;
      $("#todayMartyrImage").alt = martyrIcon.alt;
      $("#todayMartyrImage").classList.add("icon-card-image");
    } else {
      $("#todayMartyrImage").classList.remove("icon-card-image");
    }
  }

  function renderIcons() {
    const search = normalizeText($("#iconSearch").value.trim());
    const category = $("#iconCategory").value;
    const icons = state.icons
      .filter(icon => category === "all" || icon.category === category)
      .filter(icon => !search || normalizeText(`${icon.title} ${icon.subject} ${icon.caption} ${icon.era} ${(icon.aliases || []).join(" ")}`).includes(search))
      .sort((a, b) => (b.priority || 0) - (a.priority || 0) || a.title.localeCompare(b.title));
    $("#iconCount").textContent = `${icons.length} of ${state.icons.length} icons`;
    $("#iconGallery").innerHTML = icons.length
      ? icons.map(iconCardHtml).join("")
      : `<div class="empty">No holy icons match this search.</div>`;

    const priority = state.icons
      .filter(icon => ["theotokos", "archangels"].includes(icon.category))
      .sort((a, b) => (b.priority || 0) - (a.priority || 0))
      .slice(0, 7);
    $("#priorityIconStrip").innerHTML = priority.map(icon => iconCardHtml(icon, true)).join("");
  }

  function imageForDate(date, record, fixed) {
    const text = `${movableTitles(record).join(" ")} ${fixed?.display || ""}`.toLowerCase();
    const rules = [
      [/nativity|christmas/, "month-12"],
      [/theophany|baptism of (our lord|christ)/, "month-01"],
      [/meeting of (our lord|christ)|presentation/, "month-02"],
      [/great lent|clean monday|sunday of orthodoxy|great canon/, "month-03"],
      [/pascha|holy week|palm sunday|bright week|resurrection/, "month-04"],
      [/ascension/, "month-05"],
      [/pentecost|holy spirit/, "month-06"],
      [/apostle|peter and paul/, "month-07"],
      [/transfiguration|dormition/, "month-08"],
      [/cross/, "month-09"],
      [/protection|intercession of the theotokos/, "month-10"],
      [/archangel|bodiless powers|angel/, "month-11"]
    ];
    const matched = rules.find(([pattern]) => pattern.test(text));
    return imageById(matched ? matched[1] : `month-${String(date.getMonth() + 1).padStart(2, "0")}`)
      || state.images[0];
  }

  function imageForWitness(key) {
    const numeric = [...String(key)].reduce((sum, char) => sum + char.charCodeAt(0), 0);
    return imageById(numeric % 2 ? "witness-01" : "witness-02");
  }

  function imageForHistory(key) {
    const numeric = [...String(key)].reduce((sum, char) => sum + char.charCodeAt(0), 0);
    return imageById(`history-0${(numeric % 4) + 1}`);
  }

  function imageFigure(image) {
    if (!image) return "";
    return `<figure class="visual-card"><img src="${escapeHtml(image.src)}" alt="${escapeHtml(image.alt)}" loading="lazy"><figcaption><strong>${escapeHtml(image.title)}</strong><span>${escapeHtml(image.caption)}</span></figcaption></figure>`;
  }

  function renderVisualLibraries() {
    const martyrIcons = state.icons
      .filter(icon => icon.category === "martyrs")
      .sort((a, b) => (b.priority || 0) - (a.priority || 0))
      .slice(0, 6);
    const witnessImages = [imageById("witness-01"), imageById("witness-02")].filter(Boolean);
    const historyImages = [1, 2, 3, 4].map(index => imageById(`history-0${index}`)).filter(Boolean);
    $("#martyrVisuals").innerHTML = martyrIcons.length
      ? martyrIcons.map(icon => iconCardHtml(icon, true)).join("")
      : witnessImages.map(imageFigure).join("");
    $("#historyVisuals").innerHTML = historyImages.map(imageFigure).join("");
  }

  function getDayRecord(date) {
    const year = state.years[date.getFullYear()];
    return year?.days?.[dateToISO(date)] || null;
  }

  function getFixedEntry(date) {
    return state.fixed[fixedKey(getFixedDate(date))] || {
      display: "Consult the calendar of your Orthodox jurisdiction for today’s complete commemorations.",
      martyrs: [],
      status: "jurisdictional"
    };
  }

  function getHistoryEntry(date) {
    return state.history[fixedKey(getFixedDate(date))] || null;
  }

  function movableTitles(record) {
    return (record?.movable || []).map(item => item.title);
  }

  function primaryTitle(date) {
    const record = getDayRecord(date);
    const fixed = getFixedEntry(date);
    const movable = movableTitles(record);
    return [...movable, fixed.display].filter(Boolean).join(" • ");
  }

  function renderToday() {
    const date = state.selectedDate;
    const record = getDayRecord(date);
    const fixedDate = getFixedDate(date);
    const fixed = getFixedEntry(date);
    const history = getHistoryEntry(date);

    $("#heroDate").textContent = formatLongDate(date);
    $("#calendarModeLabel").textContent = state.settings.calendarMode === "old"
      ? `Old Calendar commemorations • ${formatShortDate(fixedDate)}`
      : "Revised / New Calendar";
    $("#heroFeast").textContent = primaryTitle(date);
    $("#datePicker").value = dateToISO(date);
    $("#entryStatus").textContent = fixed.status === "curated" ? "Curated principal entry" : "Jurisdictional notice";

    const heroImage = imageForDate(date, record, fixed);
    $("#dailyHeroImage").classList.remove("icon-mode");
    if (heroImage) {
      $("#dailyHeroImage").src = heroImage.src;
      $("#dailyHeroImage").alt = heroImage.alt;
      $("#dailyHeroTitle").textContent = heroImage.title;
      $("#dailyHeroCaption").textContent = `${heroImage.caption} • original local artwork`;
    }
    const witnessImage = imageForWitness(fixedKey(fixedDate));
    $("#todayMartyrImage").classList.remove("icon-card-image");
    if (witnessImage) {
      $("#todayMartyrImage").src = witnessImage.src;
      $("#todayMartyrImage").alt = witnessImage.alt;
    }
    const historyImage = imageForHistory(fixedKey(fixedDate));
    if (historyImage) {
      $("#todayHistoryImage").src = historyImage.src;
      $("#todayHistoryImage").alt = historyImage.alt;
    }
    renderTodayIcons(date, record, fixed);
    renderTodayChurches();

    const movable = record?.movable || [];
    const movableHtml = movable.length
      ? `<div class="movable-list">${movable.map(item =>
          `<p><strong>${escapeHtml(item.title)}</strong><br><span class="muted">${escapeHtml(item.description)}</span></p>`
        ).join("")}</div>`
      : "";
    $("#saintsContent").innerHTML =
      `${movableHtml}<p class="primary-line">${escapeHtml(fixed.display)}</p>` +
      (fixed.status === "jurisdictional"
        ? `<p class="fine-print">The app does not invent a complete list where Orthodox jurisdictions differ. Add or revise this date in <code>data/fixed-calendar.json</code>.</p>`
        : "");

    const todayMartyrKey = fixedKey(fixedDate);
    $("#martyrsContent").innerHTML = fixed.martyrs?.length
      ? `<div class="martyr-mini-list">${fixed.martyrs.map(name => martyrProfileHtml(getMartyrProfile(todayMartyrKey, name), name, todayMartyrKey)).join("")}</div>
         <p class="fine-print">Concise educational summaries; consult an official synaxarion for complete lives.</p>`
      : `<p>No principal martyr is listed in this curated entry.</p>
         <p class="fine-print">Your parish or jurisdictional calendar may include additional witnesses.</p>`;

    $("#historyContent").innerHTML = history
      ? `<p class="primary-line">${escapeHtml(history.title)}</p><p>${escapeHtml(history.text)}</p>`
      : `<p>No dedicated historical spotlight is attached to this date.</p>
         <p class="fine-print">The daily feast and martyr data remain available above.</p>`;

    const fast = record?.fasting || { level: "Consult your parish calendar", reason: "Local practice and pastoral direction govern." };
    $("#fastingContent").innerHTML =
      `<p class="primary-line">${escapeHtml(fast.level)}</p><p>${escapeHtml(fast.reason)}</p>
       <p class="fine-print">Broad guidance only. Follow your priest’s direction and any necessary medical advice.</p>`;

    renderPascha(date, record);
    renderAstronomy(date);

    const practice = state.practices[record?.practiceIndex ?? 0] || "Pray with attention and act with mercy.";
    $("#practiceContent").innerHTML = `<p class="primary-line">${escapeHtml(practice)}</p>`;

    const prayer = state.prayers[Math.abs(dayDifference(date, parseISO(MIN_DATE))) % Math.max(state.prayers.length, 1)];
    if (prayer) {
      $("#dailyPrayerTitle").textContent = prayer.title;
      $("#dailyPrayerText").textContent = prayer.text;
      $("#favoriteDailyPrayer").dataset.prayerId = prayer.id;
      $("#favoriteDailyPrayer").textContent = state.favorites.has(prayer.id) ? "★" : "☆";
      $("#favoriteDailyPrayer").setAttribute("aria-label",
        state.favorites.has(prayer.id) ? "Remove this prayer from favorites" : "Favorite this prayer");
    }

    $("#journalDateLabel").textContent = `Reflection for ${formatLongDate(date)}`;
    $("#journalText").value = getJournal()[dateToISO(date)] || "";
    $("#previousDay").disabled = dateToISO(date) <= MIN_DATE;
    $("#nextDay").disabled = dateToISO(date) >= MAX_DATE;
    const currentIso = dateToISO(new Date());
    const outsideRange = currentIso < MIN_DATE || currentIso > MAX_DATE;
    $("#rangeNotice").classList.toggle("hidden", !outsideRange);
    if (currentIso < MIN_DATE) {
      $("#rangeNotice").textContent = `The local calendar begins ${MIN_DATE}. The first supported day is being shown.`;
    } else if (currentIso > MAX_DATE) {
      $("#rangeNotice").textContent = `The local calendar ends ${MAX_DATE}. The last stored day is shown; publish a newer data package for dates after 2030.`;
    }
  }

  function renderPascha(date, record) {
    if (!record) {
      $("#paschaContent").innerHTML = "<p>Paschal cycle data unavailable for this date.</p>";
      return;
    }
    const pascha = parseISO(record.pascha);
    const difference = dayDifference(pascha, date);
    let main;
    if (difference > 0) main = `${difference} day${difference === 1 ? "" : "s"} until Pascha`;
    else if (difference === 0) main = "Holy Pascha — the Feast of Feasts";
    else {
      const nextYear = state.years[date.getFullYear() + 1];
      if (nextYear) {
        const nextPascha = parseISO(nextYear.pascha);
        const untilNext = dayDifference(nextPascha, date);
        main = `${untilNext} days until Pascha ${nextYear.year}`;
      } else {
        main = `${Math.abs(difference)} days since Pascha`;
      }
    }
    $("#paschaContent").innerHTML =
      `<p class="primary-line">${escapeHtml(main)}</p>
       <p>Pascha ${date.getFullYear()}: ${escapeHtml(formatLongDate(pascha))}</p>`;
  }

  function renderAstronomy(date) {
    const details = window.OrthodoxAstronomy.getAstronomy(
      date, state.settings.location, state.settings.use24Hour
    );
    $("#astronomyContent").innerHTML =
      `<p class="primary-line">${escapeHtml(details.location)}</p>
       <p>Approx. sunrise: <strong>${escapeHtml(details.sunrise)}</strong><br>
       Approx. sunset: <strong>${escapeHtml(details.sunset)}</strong></p>
       <p>${details.moon.symbol} ${escapeHtml(details.moon.name)} • ${details.moon.illumination}% illuminated</p>
       <p class="fine-print">Solar times are offline estimates using a longitude-based solar zone, not a live weather service.</p>`;
  }

  function selectDate(date, switchToToday = false) {
    if (!inRange(date)) {
      showToast(`Choose a date between ${MIN_DATE} and ${MAX_DATE}.`);
      return;
    }
    state.selectedDate = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12);
    state.calendarMonth = new Date(date.getFullYear(), date.getMonth(), 1, 12);
    state.followToday = dateToISO(state.selectedDate) === dateToISO(getSupportedToday());
    $("#eventDate").value = dateToISO(state.selectedDate);
    renderToday();
    renderCalendar();
    if (switchToToday) switchView("today");
  }

  function renderCalendar() {
    const monthDate = state.calendarMonth;
    const year = monthDate.getFullYear();
    const month = monthDate.getMonth();
    $("#calendarMonthLabel").textContent = new Intl.DateTimeFormat(undefined, {
      month: "long", year: "numeric"
    }).format(monthDate);

    const first = new Date(year, month, 1, 12);
    const gridStart = addDays(first, -first.getDay());
    const todayIso = dateToISO(new Date());
    const selectedIso = dateToISO(state.selectedDate);
    let html = "";
    for (let index = 0; index < 42; index += 1) {
      const date = addDays(gridStart, index);
      const iso = dateToISO(date);
      const outsideMonth = date.getMonth() !== month;
      const supported = inRange(date);
      const record = supported ? getDayRecord(date) : null;
      const fixed = supported ? getFixedEntry(date) : null;
      const localEvents = state.churchEvents.filter(event => event.date === iso);
      const summary = record?.movable?.[0]?.title || (fixed?.status === "curated" ? fixed.display : "") || localEvents[0]?.title || "";
      const classes = [
        "calendar-day",
        outsideMonth ? "outside" : "",
        iso === selectedIso ? "selected" : "",
        iso === todayIso ? "today" : ""
      ].filter(Boolean).join(" ");
      const hasMarker = Boolean(record?.movable?.length || fixed?.status === "curated");
      const hasLocalEvent = localEvents.length > 0;
      const localLabel = hasLocalEvent ? `; ${localEvents.length} local church event${localEvents.length === 1 ? "" : "s"}` : "";
      html += `<button class="${classes}" data-date="${iso}" ${supported ? "" : "disabled"} aria-label="${escapeHtml(formatLongDate(date) + localLabel)}">
        <span class="calendar-number">${date.getDate()}</span>
        <span class="calendar-summary">${escapeHtml(summary)}</span>
        <span class="calendar-markers">
          ${hasMarker ? '<span class="calendar-dot" title="Liturgical commemoration"></span>' : ""}
          ${hasLocalEvent ? `<span class="calendar-local-dot" title="${localEvents.length} local church event${localEvents.length === 1 ? "" : "s"}"></span>` : ""}
        </span>
      </button>`;
    }
    $("#calendarGrid").innerHTML = html;
    $$("#calendarGrid .calendar-day[data-date]").forEach(button => {
      button.addEventListener("click", () => selectDate(parseISO(button.dataset.date), true));
    });

    const previous = new Date(year, month - 1, 1, 12);
    const next = new Date(year, month + 1, 1, 12);
    $("#previousMonth").disabled = previous < new Date(2026, 0, 1, 12);
    $("#nextMonth").disabled = next > new Date(2030, 11, 1, 12);
  }

  function renderPrayerFilters() {
    const categories = [...new Set(state.prayers.map(prayer => prayer.category))].sort();
    $("#prayerCategory").innerHTML = `<option value="all">All categories</option>` +
      categories.map(category => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`).join("");
  }

  function renderPrayers() {
    const search = $("#prayerSearch").value.trim().toLowerCase();
    const category = $("#prayerCategory").value;
    const favoritesOnly = $("#favoritesOnly").checked;
    const filtered = state.prayers.filter(prayer => {
      const matchesSearch = !search || `${prayer.title} ${prayer.text} ${prayer.category}`.toLowerCase().includes(search);
      const matchesCategory = category === "all" || prayer.category === category;
      const matchesFavorite = !favoritesOnly || state.favorites.has(prayer.id);
      return matchesSearch && matchesCategory && matchesFavorite;
    });
    $("#prayerLibrary").innerHTML = filtered.length ? filtered.map(prayer => `
      <article class="card prayer-item">
        <div class="item-meta">
          <span class="badge">${escapeHtml(prayer.category)}</span>
          <button class="favorite-button" data-favorite="${escapeHtml(prayer.id)}" aria-label="${state.favorites.has(prayer.id) ? "Remove from favorites" : "Add to favorites"}">${state.favorites.has(prayer.id) ? "★" : "☆"}</button>
        </div>
        <h3>${escapeHtml(prayer.title)}</h3>
        <div class="prayer-copy">${escapeHtml(prayer.text)}</div>
        <p class="fine-print">${escapeHtml(prayer.origin || "Original devotional prayer")}</p>
        <button class="button quiet" data-session="${escapeHtml(prayer.id)}">Open prayer session ↗</button>
      </article>
    `).join("") : `<div class="empty">No prayers match this filter.</div>`;
    $$("[data-favorite]").forEach(button => button.addEventListener("click", () => toggleFavorite(button.dataset.favorite)));
  }

  function toggleFavorite(id) {
    if (!id) return;
    if (state.favorites.has(id)) state.favorites.delete(id);
    else state.favorites.add(id);
    localStorage.setItem("orthodoxDailyFavorites", JSON.stringify([...state.favorites]));
    renderPrayers();
    renderToday();
  }

  function buildMartyrIndex() {
    if (state.martyrProfiles.length) {
      return state.martyrProfiles
        .map(profile => ({ ...profile }))
        .sort((a, b) => a.feastDate.localeCompare(b.feastDate) || a.name.localeCompare(b.name));
    }
    return Object.entries(state.fixed).flatMap(([date, entry]) =>
      (entry.martyrs || []).map(name => ({
        feastDate: date, name, commemoration: entry.display, lifeDates: "Date uncertain",
        place: "Orthodox tradition",
        about: "Remembered for steadfast Christian witness; surviving biographical details are limited."
      }))
    ).sort((a, b) => a.feastDate.localeCompare(b.feastDate) || a.name.localeCompare(b.name));
  }

  function renderMartyrs() {
    const search = $("#martyrSearch").value.trim().toLowerCase();
    const allItems = buildMartyrIndex();
    const items = allItems.filter(item =>
      !search || `${item.name} ${item.commemoration || ""} ${item.feastDate} ${item.lifeDates || ""} ${item.place || ""} ${item.about || ""}`.toLowerCase().includes(search)
    );
    $("#martyrCount").textContent = `${items.length} of ${allItems.length} profiles`;
    $("#martyrArchive").innerHTML = items.length ? items.map(item => {
      const icon = iconForText(item.name, "martyrs") || iconForText(item.name);
      const image = icon || imageForWitness(item.feastDate);
      return `<article class="archive-item martyr-profile-card with-image">
        <div class="archive-date">${escapeHtml(formatMonthDayFromKey(item.feastDate))}</div>
        ${image ? `<img class="archive-thumb ${icon ? "icon-thumb" : ""}" src="${escapeHtml(image.src)}" alt="${escapeHtml(icon?.alt || "Devotional artwork honoring Christian martyrs")}" loading="lazy">` : ""}
        <div class="martyr-profile-copy">
          <h3>${escapeHtml(item.name)}</h3>
          <p class="martyr-dates"><strong>${escapeHtml(item.lifeDates || "Date uncertain")}</strong> · ${escapeHtml(item.place || "Orthodox tradition")}</p>
          <p class="martyr-about">${escapeHtml(item.about || "")}</p>
          <p class="fine-print">Commemoration: ${escapeHtml(item.commemoration || formatMonthDayFromKey(item.feastDate))}</p>
        </div>
      </article>`;
    }).join("") : `<div class="empty">No martyr profiles match this search.</div>`;
  }

  function renderHistory() {
    const search = $("#historySearch").value.trim().toLowerCase();
    const items = Object.entries(state.history)
      .map(([date, item]) => ({ date, ...item }))
      .filter(item => !search || `${item.date} ${item.title} ${item.text}`.toLowerCase().includes(search))
      .sort((a, b) => a.date.localeCompare(b.date));
    $("#historyTimeline").innerHTML = items.length ? items.map(item => {
      const image = imageForHistory(item.date);
      return `<article class="timeline-item with-image">
        ${image ? `<img class="timeline-thumb" src="${escapeHtml(image.src)}" alt="${escapeHtml(image.alt)}" loading="lazy">` : ""}
        <div class="timeline-copy">
          <span class="badge">${escapeHtml(formatMonthDayFromKey(item.date))}</span>
          <h3>${escapeHtml(item.title)}</h3>
          <p>${escapeHtml(item.text)}</p>
          <p class="art-note">Visual: ${escapeHtml(image?.title || "Orthodox Daily")} — original local illustration.</p>
        </div>
      </article>`;
    }).join("") : `<div class="empty">No historical entries match this search.</div>`;
  }

  function switchView(name) {
    const navName = ["home", "prayers", "reflect", "rule"].includes(name) ? name : "explore";
    $$(".tab").forEach(tab => {tab.classList.toggle("active", tab.dataset.view === navName); if(tab.dataset.view === navName)tab.setAttribute("aria-current","page");else tab.removeAttribute("aria-current");});
    $$("[data-view-panel]").forEach(panel => panel.classList.toggle("active", panel.dataset.viewPanel === name));
    if (name === "calendar") renderCalendar();
    if (name === "churches") renderChurches();
    if (name === "prayers") renderPrayers();
    if (name === "icons") renderIcons();
    if (name === "martyrs") renderMartyrs();
    if (name === "history") renderHistory();
    document.dispatchEvent(new CustomEvent("orthodox:view", { detail: name }));
    window.scrollTo({ top: 0, behavior: state.settings.reduceMotion ? "auto" : "smooth" });
  }

  function updateClock() {
    const now = new Date();
    const clockDay = dateToISO(now);
    $("#liveTime").textContent = new Intl.DateTimeFormat(undefined, {
      hour: "numeric", minute: "2-digit", second: "2-digit",
      hour12: !state.settings.use24Hour
    }).format(now);
    $("#liveDate").textContent = new Intl.DateTimeFormat(undefined, {
      weekday: "short", month: "short", day: "numeric"
    }).format(now);

    if (state.lastClockDay && state.lastClockDay !== clockDay && state.followToday) {
      state.selectedDate = getSupportedToday();
      state.calendarMonth = new Date(state.selectedDate.getFullYear(), state.selectedDate.getMonth(), 1, 12);
      $("#eventDate").value = dateToISO(state.selectedDate);
      if (Object.keys(state.years).length) {
        renderToday();
        renderCalendar();
        renderChurches();
        showToast("The daily calendar has advanced to the new day.");
      }
    }
    state.lastClockDay = clockDay;
  }

  function openSettings() {
    $("#settingsDrawer").classList.add("open");
    $("#settingsDrawer").setAttribute("aria-hidden", "false");
    $("#scrim").classList.remove("hidden");
    $("#closeSettings").focus();
  }

  function closeSettings() {
    $("#settingsDrawer").classList.remove("open");
    $("#settingsDrawer").setAttribute("aria-hidden", "true");
    $("#scrim").classList.add("hidden");
    $("#settingsButton").focus();
  }

  function applySettingsToControls() {
    $("#calendarMode").value = state.settings.calendarMode;
    $("#locationSelect").value = state.settings.location;
    $("#use24Hour").checked = state.settings.use24Hour;
    $("#reduceMotion").checked = state.settings.reduceMotion;
    document.body.classList.toggle("reduce-motion", state.settings.reduceMotion);
  }

  function updateSetting(key, value) {
    state.settings[key] = value;
    saveSettings();
    applySettingsToControls();
    updateClock();
    renderToday();
    renderCalendar();
  }

  function getJournal() {
    try { return JSON.parse(localStorage.getItem("orthodoxDailyJournal") || "{}"); }
    catch { return {}; }
  }

  function saveJournalEntry() {
    const journal = getJournal();
    const key = dateToISO(state.selectedDate);
    const value = $("#journalText").value.trim();
    if (value) journal[key] = value;
    else delete journal[key];
    localStorage.setItem("orthodoxDailyJournal", JSON.stringify(journal));
    showToast(value ? "Journal entry saved on this device." : "Empty journal entry removed.");
  }

  function deleteJournalEntry() {
    const journal = getJournal();
    delete journal[dateToISO(state.selectedDate)];
    localStorage.setItem("orthodoxDailyJournal", JSON.stringify(journal));
    $("#journalText").value = "";
    showToast("Journal entry deleted.");
  }

  function exportLocalData() {
    const payload = {
      app: "Orthodox Daily",
      version: APP_VERSION,
      exportedAt: new Date().toISOString(),
      settings: state.settings,
      favorites: [...state.favorites],
      journal: getJournal(),
      churches: state.churches,
      churchEvents: state.churchEvents,
      companion: window.OrthodoxStore.snapshot()
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `orthodox-daily-backup-${dateToISO(new Date())}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  }

  async function importLocalData(file) {
    if (!file) return;
    try {
      const payload = JSON.parse(await file.text());
      if (payload.app !== "Orthodox Daily") throw new Error("This is not an Orthodox Daily export.");
      if (payload.companion) window.OrthodoxStore.validate(payload.companion);
      if (payload.settings && typeof payload.settings === "object") {
        state.settings = { ...state.settings, ...payload.settings };
        saveSettings();
      }
      if (Array.isArray(payload.favorites)) {
        state.favorites = new Set(payload.favorites.filter(id => typeof id === "string"));
        localStorage.setItem("orthodoxDailyFavorites", JSON.stringify([...state.favorites]));
      }
      if (payload.journal && typeof payload.journal === "object") {
        localStorage.setItem("orthodoxDailyJournal", JSON.stringify(payload.journal));
      }
      if (Array.isArray(payload.churches)) state.churches = payload.churches;
      if (Array.isArray(payload.churchEvents)) state.churchEvents = payload.churchEvents;
      saveChurchData();
      if (payload.companion) window.OrthodoxStore.replace(payload.companion);
      applySettingsToControls();
      renderAll();
      showToast("Local data restored.");
    } catch (error) {
      showToast(error.message || "Could not import this file.");
    } finally {
      $("#importData").value = "";
    }
  }

  function makeId(prefix) {
    if (window.crypto?.randomUUID) return `${prefix}-${window.crypto.randomUUID()}`;
    return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function saveChurchData() {
    localStorage.setItem("orthodoxDailyChurches", JSON.stringify(state.churches));
    localStorage.setItem("orthodoxDailyChurchEvents", JSON.stringify(state.churchEvents));
  }

  function churchById(id) {
    return state.churches.find(church => church.id === id) || null;
  }

  function normalizedUrl(value) {
    const trimmed = String(value || "").trim();
    if (!trimmed) return "";
    const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    try {
      const parsed = new URL(candidate);
      return ["http:", "https:"].includes(parsed.protocol) ? parsed.href : "";
    } catch {
      return "";
    }
  }

  function formatEventTime(event) {
    if (!event.start) return "Time not entered";
    const [hour, minute] = event.start.split(":").map(Number);
    const sample = new Date(2028, 0, 1, hour, minute || 0);
    const start = new Intl.DateTimeFormat(undefined, {
      hour: "numeric", minute: "2-digit", hour12: !state.settings.use24Hour
    }).format(sample);
    if (!event.end) return start;
    const [endHour, endMinute] = event.end.split(":").map(Number);
    const endSample = new Date(2028, 0, 1, endHour, endMinute || 0);
    const end = new Intl.DateTimeFormat(undefined, {
      hour: "numeric", minute: "2-digit", hour12: !state.settings.use24Hour
    }).format(endSample);
    return `${start}–${end}`;
  }

  function sortedChurchEvents() {
    return [...state.churchEvents].sort((a, b) =>
      `${a.date}T${a.start || "00:00"}`.localeCompare(`${b.date}T${b.start || "00:00"}`)
    );
  }

  function renderChurchSelects() {
    const options = state.churches.length
      ? state.churches.map(church => `<option value="${escapeHtml(church.id)}">${escapeHtml(church.name)}</option>`).join("")
      : `<option value="">Add a church first</option>`;
    ["#eventChurch", "#icsChurchSelect"].forEach(selector => {
      const select = $(selector);
      const previous = select.value;
      select.innerHTML = options;
      if (state.churches.some(church => church.id === previous)) select.value = previous;
      const primary = state.churches.find(church => church.primary) || state.churches[0];
      if (!select.value && primary) select.value = primary.id;
      select.disabled = !state.churches.length;
    });
    $("#eventTitle").disabled = !state.churches.length;
    $("#eventDate").disabled = !state.churches.length;
    $("#eventStart").disabled = !state.churches.length;
    $("#eventEnd").disabled = !state.churches.length;
    $("#eventNotes").disabled = !state.churches.length;
    $("#churchEventForm button[type='submit']").disabled = !state.churches.length;
    $("#icsImport").disabled = !state.churches.length;
  }

  function churchCardHtml(church) {
    const website = normalizedUrl(church.website);
    const calendarUrl = normalizedUrl(church.calendarUrl);
    return `<article class="church-item ${church.primary ? "primary" : ""}">
      <div class="church-item-heading">
        <div>
          <h4>${escapeHtml(church.name)}</h4>
          <p>${escapeHtml([church.jurisdiction, church.city].filter(Boolean).join(" · ") || "Local Orthodox church")}</p>
        </div>
        ${church.primary ? '<span class="badge">Primary church</span>' : ""}
      </div>
      ${church.notes ? `<p class="church-notes">${escapeHtml(church.notes)}</p>` : ""}
      <div class="church-links">
        ${website ? `<a class="text-link" href="${escapeHtml(website)}" target="_blank" rel="noopener">Website</a>` : ""}
        ${calendarUrl ? `<a class="text-link" href="${escapeHtml(calendarUrl)}" target="_blank" rel="noopener">Published calendar</a>` : ""}
      </div>
      <div class="church-actions">
        ${church.primary ? "" : `<button class="button quiet small" data-church-action="primary" data-church-id="${escapeHtml(church.id)}" type="button">Make primary</button>`}
        <button class="button quiet small danger" data-church-action="delete" data-church-id="${escapeHtml(church.id)}" type="button">Remove</button>
      </div>
    </article>`;
  }

  function eventCardHtml(event, compact = false) {
    const church = churchById(event.churchId);
    const date = parseISO(event.date);
    return `<article class="church-event-item ${compact ? "compact" : ""}">
      <div class="event-date-block"><strong>${date.getDate()}</strong><span>${new Intl.DateTimeFormat(undefined, { month: "short" }).format(date)}</span></div>
      <div class="event-copy">
        <h4>${escapeHtml(event.title)}</h4>
        <p><strong>${escapeHtml(formatEventTime(event))}</strong>${church ? ` · ${escapeHtml(church.name)}` : ""}</p>
        ${event.notes ? `<p class="event-notes">${escapeHtml(event.notes)}</p>` : ""}
      </div>
      ${compact ? "" : `<button class="icon-button event-delete" data-event-id="${escapeHtml(event.id)}" type="button" aria-label="Delete ${escapeHtml(event.title)}">×</button>`}
    </article>`;
  }

  function renderChurches() {
    renderChurchSelects();
    $("#churchCount").textContent = `${state.churches.length} church${state.churches.length === 1 ? "" : "es"}`;
    $("#churchList").innerHTML = state.churches.length
      ? [...state.churches].sort((a, b) => Number(b.primary) - Number(a.primary) || a.name.localeCompare(b.name)).map(churchCardHtml).join("")
      : `<div class="empty"><strong>No local churches saved yet.</strong><p>Add your parish or another Orthodox church using the form. Its information remains in this browser.</p></div>`;

    const events = sortedChurchEvents();
    $("#churchEventCount").textContent = `${events.length} event${events.length === 1 ? "" : "s"}`;
    $("#churchEventList").innerHTML = events.length
      ? events.map(event => eventCardHtml(event)).join("")
      : `<div class="empty"><strong>No services or parish events entered.</strong><p>Add them manually or import an .ics calendar after saving a church.</p></div>`;
    renderTodayChurches();
  }

  function renderTodayChurches() {
    const container = $("#todayChurchSummary");
    if (!container) return;
    if (!state.churches.length) {
      container.innerHTML = `<p class="primary-line">No local parish has been saved.</p><p>Add a church and its service calendar; the information stays on this device and appears here each day.</p>`;
      return;
    }
    const primary = state.churches.find(church => church.primary) || state.churches[0];
    const selectedIso = dateToISO(state.selectedDate);
    const sameDay = sortedChurchEvents().filter(event => event.date === selectedIso).slice(0, 3);
    const nextEvents = sameDay.length ? sameDay : sortedChurchEvents().filter(event => event.date >= selectedIso).slice(0, 3);
    const website = normalizedUrl(primary.website);
    const calendarUrl = normalizedUrl(primary.calendarUrl);
    container.innerHTML = `<p class="primary-line">${escapeHtml(primary.name)}</p>
      <p>${escapeHtml([primary.jurisdiction, primary.city].filter(Boolean).join(" · ") || "Primary local church")}</p>
      <div class="inline-links">
        ${website ? `<a class="text-link" href="${escapeHtml(website)}" target="_blank" rel="noopener">Church website</a>` : ""}
        ${calendarUrl ? `<a class="text-link" href="${escapeHtml(calendarUrl)}" target="_blank" rel="noopener">Published calendar</a>` : ""}
      </div>
      <div class="today-church-events">
        ${nextEvents.length ? nextEvents.map(event => eventCardHtml(event, true)).join("") : `<p class="fine-print">No local service has been entered for or after this date.</p>`}
      </div>`;
  }

  function handleChurchSubmit(event) {
    event.preventDefault();
    const name = $("#churchName").value.trim();
    if (!name) return;
    const makePrimary = $("#churchPrimary").checked || !state.churches.length;
    if (makePrimary) state.churches.forEach(church => { church.primary = false; });
    state.churches.push({
      id: makeId("church"), name,
      jurisdiction: $("#churchJurisdiction").value.trim(),
      city: $("#churchCity").value.trim(),
      website: normalizedUrl($("#churchWebsite").value),
      calendarUrl: normalizedUrl($("#churchCalendarUrl").value),
      notes: $("#churchNotes").value.trim(),
      primary: makePrimary,
      createdAt: new Date().toISOString()
    });
    saveChurchData();
    event.currentTarget.reset();
    renderChurches();
    showToast("Local church saved on this device.");
  }

  function handleChurchListClick(event) {
    const button = event.target.closest("[data-church-action]");
    if (!button) return;
    const church = churchById(button.dataset.churchId);
    if (!church) return;
    if (button.dataset.churchAction === "primary") {
      state.churches.forEach(item => { item.primary = item.id === church.id; });
      saveChurchData();
      renderChurches();
      showToast(`${church.name} is now your primary church.`);
      return;
    }
    if (button.dataset.churchAction === "delete") {
      if (!window.confirm(`Remove ${church.name} and its locally saved events?`)) return;
      state.churches = state.churches.filter(item => item.id !== church.id);
      state.churchEvents = state.churchEvents.filter(item => item.churchId !== church.id);
      if (state.churches.length && !state.churches.some(item => item.primary)) state.churches[0].primary = true;
      saveChurchData();
      renderChurches();
      renderCalendar();
      showToast("Church and its local events removed.");
    }
  }

  function handleChurchEventSubmit(event) {
    event.preventDefault();
    const churchId = $("#eventChurch").value;
    const title = $("#eventTitle").value.trim();
    const date = $("#eventDate").value;
    if (!churchById(churchId) || !title || !date) return;
    state.churchEvents.push({
      id: makeId("event"), churchId, title, date,
      start: $("#eventStart").value,
      end: $("#eventEnd").value,
      notes: $("#eventNotes").value.trim(),
      source: "manual"
    });
    saveChurchData();
    event.currentTarget.reset();
    $("#eventDate").value = dateToISO(state.selectedDate);
    renderChurches();
    renderCalendar();
    showToast("Local church event added.");
  }

  function handleChurchEventClick(event) {
    const button = event.target.closest("[data-event-id]");
    if (!button) return;
    state.churchEvents = state.churchEvents.filter(item => item.id !== button.dataset.eventId);
    saveChurchData();
    renderChurches();
    renderCalendar();
    showToast("Local calendar event deleted.");
  }

  function parseIcsDate(value) {
    const clean = String(value || "").trim();
    if (!clean) return null;
    if (/^\d{8}$/.test(clean)) {
      return { date: `${clean.slice(0, 4)}-${clean.slice(4, 6)}-${clean.slice(6, 8)}`, time: "" };
    }
    const match = clean.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?(Z)?$/);
    if (!match) return null;
    if (match[7]) {
      const utc = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), Number(match[4]), Number(match[5]), Number(match[6] || 0)));
      return { date: dateToISO(utc), time: `${String(utc.getHours()).padStart(2, "0")}:${String(utc.getMinutes()).padStart(2, "0")}` };
    }
    return { date: `${match[1]}-${match[2]}-${match[3]}`, time: `${match[4]}:${match[5]}` };
  }

  function unescapeIcs(value) {
    return String(value || "").replace(/\\n/gi, "\n").replace(/\\,/g, ",").replace(/\\;/g, ";").replace(/\\\\/g, "\\");
  }

  function parseIcs(text, churchId) {
    const unfolded = String(text).replace(/\r?\n[ \t]/g, "");
    const events = [];
    let current = null;
    unfolded.split(/\r?\n/).forEach(line => {
      if (line === "BEGIN:VEVENT") { current = {}; return; }
      if (line === "END:VEVENT") {
        if (current?.SUMMARY && current?.DTSTART) {
          const start = parseIcsDate(current.DTSTART);
          const end = parseIcsDate(current.DTEND);
          if (start) events.push({
            id: makeId("event"), churchId,
            title: unescapeIcs(current.SUMMARY).slice(0, 120),
            date: start.date, start: start.time,
            end: end?.time || "",
            notes: [current.LOCATION, current.DESCRIPTION].filter(Boolean).map(unescapeIcs).join(" · ").slice(0, 500),
            source: "ics"
          });
        }
        current = null;
        return;
      }
      if (!current) return;
      const separator = line.indexOf(":");
      if (separator < 0) return;
      const rawName = line.slice(0, separator).split(";")[0].toUpperCase();
      current[rawName] = line.slice(separator + 1);
    });
    return events;
  }

  async function importIcsFile(file) {
    if (!file) return;
    const churchId = $("#icsChurchSelect").value;
    if (!churchById(churchId)) {
      showToast("Choose or add a church before importing a calendar.");
      return;
    }
    try {
      const events = parseIcs(await file.text(), churchId);
      if (!events.length) throw new Error("No readable VEVENT entries were found.");
      state.churchEvents.push(...events);
      saveChurchData();
      renderChurches();
      renderCalendar();
      showToast(`${events.length} calendar event${events.length === 1 ? "" : "s"} imported.`);
    } catch (error) {
      showToast(error.message || "Could not import this .ics file.");
    } finally {
      $("#icsImport").value = "";
    }
  }

  function escapeIcs(value) {
    return String(value || "").replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
  }

  function exportIcsCalendar() {
    if (!state.churchEvents.length) {
      showToast("There are no local church events to export.");
      return;
    }
    const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
    const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Orthodox Daily//Local Churches//EN", "CALSCALE:GREGORIAN"];
    sortedChurchEvents().forEach(event => {
      const church = churchById(event.churchId);
      const compactDate = event.date.replace(/-/g, "");
      const start = event.start ? `${compactDate}T${event.start.replace(":", "")}00` : compactDate;
      const end = event.end ? `${compactDate}T${event.end.replace(":", "")}00` : "";
      lines.push("BEGIN:VEVENT", `UID:${escapeIcs(event.id)}@orthodox-daily`, `DTSTAMP:${stamp}`,
        `${event.start ? "DTSTART" : "DTSTART;VALUE=DATE"}:${start}`);
      if (end) lines.push(`DTEND:${end}`);
      lines.push(`SUMMARY:${escapeIcs(event.title)}`);
      if (church) lines.push(`LOCATION:${escapeIcs([church.name, church.city].filter(Boolean).join(", "))}`);
      if (event.notes) lines.push(`DESCRIPTION:${escapeIcs(event.notes)}`);
      lines.push("END:VEVENT");
    });
    lines.push("END:VCALENDAR");
    const blob = new Blob([lines.join("\r\n")], { type: "text/calendar;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `orthodox-daily-local-churches-${dateToISO(new Date())}.ics`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  }

  function setTimerMinutes(minutes) {
    if (state.timer.running) return;
    state.timer.selectedSeconds = Number(minutes) * 60;
    state.timer.remainingSeconds = state.timer.selectedSeconds;
    $$(".chip[data-minutes]").forEach(chip =>
      chip.classList.toggle("active", Number(chip.dataset.minutes) === Number(minutes))
    );
    renderTimer();
  }

  function renderTimer() {
    const minutes = Math.floor(state.timer.remainingSeconds / 60);
    const seconds = state.timer.remainingSeconds % 60;
    $("#timerDisplay").textContent = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
    $("#timerStart").textContent = state.timer.running ? "Pause" :
      (state.timer.remainingSeconds < state.timer.selectedSeconds ? "Continue" : "Begin");
  }

  function toggleTimer() {
    if (state.timer.running) {
      clearInterval(state.timer.interval);
      state.timer.interval = null;
      state.timer.running = false;
      renderTimer();
      return;
    }
    if (state.timer.remainingSeconds <= 0) state.timer.remainingSeconds = state.timer.selectedSeconds;
    state.timer.running = true;
    state.timer.interval = setInterval(() => {
      state.timer.remainingSeconds -= 1;
      if (state.timer.remainingSeconds <= 0) {
        state.timer.remainingSeconds = 0;
        clearInterval(state.timer.interval);
        state.timer.interval = null;
        state.timer.running = false;
        playChime();
        showToast("The prayer timer is complete.");
      }
      renderTimer();
    }, 1000);
    renderTimer();
  }

  function resetTimer() {
    clearInterval(state.timer.interval);
    state.timer.interval = null;
    state.timer.running = false;
    state.timer.remainingSeconds = state.timer.selectedSeconds;
    renderTimer();
  }

  function playChime() {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      const context = new AudioContext();
      const gain = context.createGain();
      const oscillator = context.createOscillator();
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(528, context.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(396, context.currentTime + 1.8);
      gain.gain.setValueAtTime(0.0001, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.15, context.currentTime + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 2.2);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + 2.25);
    } catch (error) {
      console.warn("Audio chime unavailable.", error);
    }
  }

  let toastTimeout;
  function showToast(message) {
    clearTimeout(toastTimeout);
    const toast = $("#toast");
    toast.textContent = message;
    toast.classList.add("show");
    toastTimeout = setTimeout(() => toast.classList.remove("show"), 3200);
  }

  async function registerServiceWorker() {
    if (!("serviceWorker" in navigator)) return;
    try {
      const registration = await navigator.serviceWorker.register("service-worker.js");
      registration.update();
      setInterval(() => registration.update(), 60 * 60 * 1000);
      registration.addEventListener("updatefound", () => {
        const worker = registration.installing;
        worker?.addEventListener("statechange", () => {
          if (worker.state === "installed" && navigator.serviceWorker.controller) {
            showToast("A new version is ready. It will load on your next visit.");
            worker.postMessage({ type: "SKIP_WAITING" });
          }
        });
      });
      let refreshing = false;
      const wasControlled = !!navigator.serviceWorker.controller;
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (refreshing || !wasControlled) return;
        refreshing = true;
        showToast("New version installed. Reload when you have saved your work.");
      });
      $("#checkUpdate").addEventListener("click", async () => {
        await registration.update();
        showToast("Update check complete.");
      });
    } catch (error) {
      console.warn("Service worker registration failed.", error);
    }
  }

  function setupInstallPrompt() {
    window.addEventListener("beforeinstallprompt", event => {
      event.preventDefault();
      state.deferredInstall = event;
      $("#installButton").classList.remove("hidden");
    });
    $("#installButton").addEventListener("click", async () => {
      if (!state.deferredInstall) return;
      state.deferredInstall.prompt();
      await state.deferredInstall.userChoice;
      state.deferredInstall = null;
      $("#installButton").classList.add("hidden");
    });
    window.addEventListener("appinstalled", () => {
      state.deferredInstall = null;
      $("#installButton").classList.add("hidden");
      showToast("Orthodox Daily installed.");
    });
  }

  function bindEvents() {
    $$(".tab").forEach(tab => tab.addEventListener("click", () => switchView(tab.dataset.view)));
    $$("[data-open-view]").forEach(button => button.addEventListener("click", () => switchView(button.dataset.openView)));
    $("#previousDay").addEventListener("click", () => selectDate(addDays(state.selectedDate, -1)));
    $("#nextDay").addEventListener("click", () => selectDate(addDays(state.selectedDate, 1)));
    $("#todayButton").addEventListener("click", () => selectDate(getSupportedToday()));
    $("#datePicker").addEventListener("change", event => selectDate(parseISO(event.target.value)));

    $("#previousMonth").addEventListener("click", () => {
      const candidate = new Date(state.calendarMonth.getFullYear(), state.calendarMonth.getMonth() - 1, 1, 12);
      if (candidate >= new Date(2026, 0, 1, 12)) { state.calendarMonth = candidate; renderCalendar(); }
    });
    $("#nextMonth").addEventListener("click", () => {
      const candidate = new Date(state.calendarMonth.getFullYear(), state.calendarMonth.getMonth() + 1, 1, 12);
      if (candidate <= new Date(2030, 11, 1, 12)) { state.calendarMonth = candidate; renderCalendar(); }
    });

    $("#prayerSearch").addEventListener("input", renderPrayers);
    $("#prayerCategory").addEventListener("change", renderPrayers);
    $("#favoritesOnly").addEventListener("change", renderPrayers);
    $("#iconSearch").addEventListener("input", renderIcons);
    $("#iconCategory").addEventListener("change", renderIcons);
    $("#martyrSearch").addEventListener("input", renderMartyrs);
    $("#historySearch").addEventListener("input", renderHistory);
    $("#favoriteDailyPrayer").addEventListener("click", event => toggleFavorite(event.currentTarget.dataset.prayerId));

    $("#churchForm").addEventListener("submit", handleChurchSubmit);
    $("#churchList").addEventListener("click", handleChurchListClick);
    $("#churchEventForm").addEventListener("submit", handleChurchEventSubmit);
    $("#churchEventList").addEventListener("click", handleChurchEventClick);
    $("#icsImport").addEventListener("change", event => importIcsFile(event.target.files[0]));
    $("#exportIcs").addEventListener("click", exportIcsCalendar);

    $("#settingsButton").addEventListener("click", openSettings);
    $("#closeSettings").addEventListener("click", closeSettings);
    $("#scrim").addEventListener("click", closeSettings);
    document.addEventListener("keydown", event => { if (event.key === "Escape") closeSettings(); });
    $("#calendarMode").addEventListener("change", event => updateSetting("calendarMode", event.target.value));
    $("#locationSelect").addEventListener("change", event => updateSetting("location", event.target.value));
    $("#use24Hour").addEventListener("change", event => updateSetting("use24Hour", event.target.checked));
    $("#reduceMotion").addEventListener("change", event => updateSetting("reduceMotion", event.target.checked));

    $("#saveJournal").addEventListener("click", saveJournalEntry);
    $("#deleteJournal").addEventListener("click", deleteJournalEntry);
    $("#exportData").addEventListener("click", exportLocalData);
    $("#importData").addEventListener("change", event => importLocalData(event.target.files[0]));

    $$(".chip[data-minutes]").forEach(chip =>
      chip.addEventListener("click", () => setTimerMinutes(chip.dataset.minutes))
    );
    $("#timerStart").addEventListener("click", toggleTimer);
    $("#timerReset").addEventListener("click", resetTimer);
  }

  function renderAll() {
    renderToday();
    renderCalendar();
    renderChurches();
    renderPrayerFilters();
    renderPrayers();
    renderIcons();
    renderMartyrs();
    renderHistory();
    renderVisualLibraries();
    renderTimer();
  }

  async function init() {
    loadLocalState();
    applySettingsToControls();
    state.selectedDate = getSupportedToday();
    state.calendarMonth = new Date(state.selectedDate.getFullYear(), state.selectedDate.getMonth(), 1, 12);
    state.lastClockDay = dateToISO(new Date());
    state.followToday = true;
    $("#eventDate").value = dateToISO(state.selectedDate);
    bindEvents();
    setupInstallPrompt();
    updateClock();
    setInterval(updateClock, 1000);
    $("#appVersion").textContent = APP_VERSION;
    try {
      await loadData();
      renderAll();
      document.dispatchEvent(new CustomEvent("orthodox:ready", { detail: { prayers: state.prayers } }));
      registerServiceWorker();
    } catch (error) {
      console.error(error);
      $("#heroFeast").textContent = "The local data files could not be loaded.";
      $("#saintsContent").innerHTML = `<p>${escapeHtml(error.message)}</p>
        <p class="fine-print">Open this project through a web server or GitHub Pages rather than by double-clicking index.html.</p>`;
      showToast("Local calendar data failed to load.");
    }
  }

  document.addEventListener("orthodox:navigate", event => switchView(event.detail));
  document.addEventListener("DOMContentLoaded", init);
})();
