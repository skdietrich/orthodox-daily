(() => {
  "use strict";

  const APP_VERSION = "1.2.0";
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
    martyrProfiles: [],
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
    if (inRange(today)) return today;
    return parseISO(MIN_DATE);
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
    const [fixed, history, prayers, practices, images, martyrs, ...yearFiles] = await Promise.all([
      fetchJson("data/fixed-calendar.json"),
      fetchJson("data/history.json"),
      fetchJson("data/prayers.json"),
      fetchJson("data/practices.json"),
      fetchJson("data/images.json"),
      fetchJson("data/martyrs.json"),
      ...[2026, 2027, 2028, 2029, 2030].map(year => fetchJson(`data/years/${year}.json`))
    ]);
    state.fixed = fixed.entries || {};
    state.history = history.spotlights || {};
    state.prayers = prayers.prayers || [];
    state.practices = practices.practices || [];
    state.images = images.images || [];
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
    const witnessImages = [imageById("witness-01"), imageById("witness-02")].filter(Boolean);
    const historyImages = [1, 2, 3, 4].map(index => imageById(`history-0${index}`)).filter(Boolean);
    $("#martyrVisuals").innerHTML = witnessImages.map(imageFigure).join("");
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
    if (heroImage) {
      $("#dailyHeroImage").src = heroImage.src;
      $("#dailyHeroImage").alt = heroImage.alt;
      $("#dailyHeroTitle").textContent = heroImage.title;
      $("#dailyHeroCaption").textContent = `${heroImage.caption} • original local artwork`;
    }
    const witnessImage = imageForWitness(fixedKey(fixedDate));
    if (witnessImage) {
      $("#todayMartyrImage").src = witnessImage.src;
      $("#todayMartyrImage").alt = witnessImage.alt;
    }
    const historyImage = imageForHistory(fixedKey(fixedDate));
    if (historyImage) {
      $("#todayHistoryImage").src = historyImage.src;
      $("#todayHistoryImage").alt = historyImage.alt;
    }

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
    $("#rangeNotice").classList.toggle("hidden", inRange(new Date()));
    if (!inRange(new Date())) {
      $("#rangeNotice").textContent = `The app’s local data window is ${MIN_DATE} through ${MAX_DATE}. It opened at the first supported date.`;
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
      const summary = record?.movable?.[0]?.title || (fixed?.status === "curated" ? fixed.display : "");
      const classes = [
        "calendar-day",
        outsideMonth ? "outside" : "",
        iso === selectedIso ? "selected" : "",
        iso === todayIso ? "today" : ""
      ].filter(Boolean).join(" ");
      const hasMarker = Boolean(record?.movable?.length || fixed?.status === "curated");
      html += `<button class="${classes}" data-date="${iso}" ${supported ? "" : "disabled"} aria-label="${escapeHtml(formatLongDate(date))}">
        <span class="calendar-number">${date.getDate()}</span>
        <span class="calendar-summary">${escapeHtml(summary)}</span>
        ${hasMarker ? '<span class="calendar-dot"></span>' : ""}
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
      const image = imageForWitness(item.feastDate);
      return `<article class="archive-item martyr-profile-card with-image">
        <div class="archive-date">${escapeHtml(formatMonthDayFromKey(item.feastDate))}</div>
        ${image ? `<img class="archive-thumb" src="${escapeHtml(image.src)}" alt="" loading="lazy">` : ""}
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
    $$(".tab").forEach(tab => tab.classList.toggle("active", tab.dataset.view === name));
    $$("[data-view-panel]").forEach(panel => panel.classList.toggle("active", panel.dataset.viewPanel === name));
    if (name === "calendar") renderCalendar();
    if (name === "prayers") renderPrayers();
    if (name === "martyrs") renderMartyrs();
    if (name === "history") renderHistory();
    window.scrollTo({ top: 0, behavior: state.settings.reduceMotion ? "auto" : "smooth" });
  }

  function updateClock() {
    const now = new Date();
    $("#liveTime").textContent = new Intl.DateTimeFormat(undefined, {
      hour: "numeric", minute: "2-digit", second: "2-digit",
      hour12: !state.settings.use24Hour
    }).format(now);
    $("#liveDate").textContent = new Intl.DateTimeFormat(undefined, {
      weekday: "short", month: "short", day: "numeric"
    }).format(now);
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
      journal: getJournal()
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
      applySettingsToControls();
      renderAll();
      showToast("Local data restored.");
    } catch (error) {
      showToast(error.message || "Could not import this file.");
    } finally {
      $("#importData").value = "";
    }
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
            showToast("A new version is ready. Refreshing…");
            worker.postMessage({ type: "SKIP_WAITING" });
          }
        });
      });
      let refreshing = false;
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (refreshing) return;
        refreshing = true;
        window.location.reload();
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
    $("#martyrSearch").addEventListener("input", renderMartyrs);
    $("#historySearch").addEventListener("input", renderHistory);
    $("#favoriteDailyPrayer").addEventListener("click", event => toggleFavorite(event.currentTarget.dataset.prayerId));

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
    renderPrayerFilters();
    renderPrayers();
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
    bindEvents();
    setupInstallPrompt();
    updateClock();
    setInterval(updateClock, 1000);
    $("#appVersion").textContent = APP_VERSION;
    try {
      await loadData();
      renderAll();
      registerServiceWorker();
    } catch (error) {
      console.error(error);
      $("#heroFeast").textContent = "The local data files could not be loaded.";
      $("#saintsContent").innerHTML = `<p>${escapeHtml(error.message)}</p>
        <p class="fine-print">Open this project through a web server or GitHub Pages rather than by double-clicking index.html.</p>`;
      showToast("Local calendar data failed to load.");
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
