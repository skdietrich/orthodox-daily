(() => {
  "use strict";

  const LOCATIONS = {
    "chicago": { label: "Chicago", lat: 41.8781, lon: -87.6298 },
    "new-york": { label: "New York", lat: 40.7128, lon: -74.0060 },
    "athens": { label: "Athens", lat: 37.9838, lon: 23.7275 },
    "constantinople": { label: "Constantinople / Istanbul", lat: 41.0082, lon: 28.9784 },
    "jerusalem": { label: "Jerusalem", lat: 31.7683, lon: 35.2137 },
    "mount-athos": { label: "Mount Athos", lat: 40.1585, lon: 24.3284 }
  };

  const rad = value => value * Math.PI / 180;
  const deg = value => value * 180 / Math.PI;
  const normalize = value => ((value % 360) + 360) % 360;

  function dayOfYear(date) {
    const start = new Date(Date.UTC(date.getUTCFullYear(), 0, 0));
    return Math.floor((date - start) / 86400000);
  }

  function calculateSolarEvent(date, lat, lon, sunrise) {
    const n = dayOfYear(new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())));
    const lngHour = lon / 15;
    const t = n + ((sunrise ? 6 : 18) - lngHour) / 24;
    const m = (0.9856 * t) - 3.289;
    let l = m + 1.916 * Math.sin(rad(m)) + 0.020 * Math.sin(rad(2 * m)) + 282.634;
    l = normalize(l);
    let ra = deg(Math.atan(0.91764 * Math.tan(rad(l))));
    ra = normalize(ra);
    const lQuadrant = Math.floor(l / 90) * 90;
    const raQuadrant = Math.floor(ra / 90) * 90;
    ra = (ra + lQuadrant - raQuadrant) / 15;
    const sinDec = 0.39782 * Math.sin(rad(l));
    const cosDec = Math.cos(Math.asin(sinDec));
    const cosH = (Math.cos(rad(90.833)) - sinDec * Math.sin(rad(lat))) /
      (cosDec * Math.cos(rad(lat)));
    if (cosH > 1 || cosH < -1) return null;
    let h = sunrise ? 360 - deg(Math.acos(cosH)) : deg(Math.acos(cosH));
    h /= 15;
    const localMeanTime = h + ra - 0.06571 * t - 6.622;
    let utcHours = localMeanTime - lngHour;
    utcHours = ((utcHours % 24) + 24) % 24;
    return utcHours;
  }

  function formatSolarHours(hours, lon, use24Hour) {
    if (hours === null) return "Unavailable";
    // Approximate civil local time using a longitude-derived solar zone.
    const solarZone = Math.round(lon / 15);
    let local = ((hours + solarZone) % 24 + 24) % 24;
    let hour = Math.floor(local);
    let minute = Math.round((local - hour) * 60);
    if (minute === 60) { hour = (hour + 1) % 24; minute = 0; }
    if (use24Hour) return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
    const suffix = hour >= 12 ? "PM" : "AM";
    const twelve = hour % 12 || 12;
    return `${twelve}:${String(minute).padStart(2, "0")} ${suffix}`;
  }

  function moonPhase(date) {
    const knownNewMoon = Date.UTC(2000, 0, 6, 18, 14);
    const synodicMonth = 29.530588853;
    const days = (Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), 12) - knownNewMoon) / 86400000;
    const age = ((days % synodicMonth) + synodicMonth) % synodicMonth;
    const fraction = age / synodicMonth;
    const illumination = (1 - Math.cos(2 * Math.PI * fraction)) / 2;
    let name;
    let symbol;
    if (fraction < 0.03 || fraction >= 0.97) { name = "New Moon"; symbol = "●"; }
    else if (fraction < 0.22) { name = "Waxing Crescent"; symbol = "◔"; }
    else if (fraction < 0.28) { name = "First Quarter"; symbol = "◐"; }
    else if (fraction < 0.47) { name = "Waxing Gibbous"; symbol = "◕"; }
    else if (fraction < 0.53) { name = "Full Moon"; symbol = "○"; }
    else if (fraction < 0.72) { name = "Waning Gibbous"; symbol = "◕"; }
    else if (fraction < 0.78) { name = "Last Quarter"; symbol = "◑"; }
    else { name = "Waning Crescent"; symbol = "◔"; }
    return { name, symbol, age: Math.round(age * 10) / 10, illumination: Math.round(illumination * 100) };
  }

  function getAstronomy(date, locationKey, use24Hour) {
    const location = LOCATIONS[locationKey] || LOCATIONS.chicago;
    const sunrise = calculateSolarEvent(date, location.lat, location.lon, true);
    const sunset = calculateSolarEvent(date, location.lat, location.lon, false);
    return {
      location: location.label,
      sunrise: formatSolarHours(sunrise, location.lon, use24Hour),
      sunset: formatSolarHours(sunset, location.lon, use24Hour),
      moon: moonPhase(date)
    };
  }

  window.OrthodoxAstronomy = { LOCATIONS, getAstronomy };
})();
