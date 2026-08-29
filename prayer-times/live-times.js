/* Recompute today's times in the visitor's browser.
 *
 * The page ships with times baked in at build time, so it is useful to a
 * crawler and to anyone with JS off. But a build is only correct on the day
 * it ran, and these are prayer times — showing yesterday's is not a cosmetic
 * bug. So we recalculate on load from the same module the generator used,
 * and mark which waqt is next.
 *
 * Every string this script writes comes from the page's own data-city blob,
 * which the generator fills from tools/i18n.json. Nothing user-visible is
 * hard-coded here, so one copy of the file serves all seven languages.
 */
(function () {
  'use strict';

  var host = document.querySelector('.today');
  if (!host || !window.PrayerTimes) return;

  var PT = window.PrayerTimes;
  var city;
  try {
    city = JSON.parse(host.getAttribute('data-city'));
  } catch (e) {
    return; // keep the baked times rather than showing nothing
  }

  var locale = city.locale || undefined;
  var now = new Date();
  var date = PT.localDate(city.tz, now);
  var offset = PT.tzOffset(city.tz, now);
  var times = new PT.Calculator({
    lat: city.lat, lng: city.lng, method: city.method, asrFactor: city.asr
  }).compute(date, offset);

  host.querySelectorAll('.time').forEach(function (el) {
    var value = times[el.getAttribute('data-prayer')];
    if (value != null && !isNaN(value)) {
      el.querySelector('.val').textContent = PT.formatTime(value, true);
    }
  });

  var dateEl = document.getElementById('today-date');
  if (dateEl) {
    try {
      dateEl.textContent = new Intl.DateTimeFormat(locale, {
        timeZone: city.tz, year: 'numeric', month: 'long', day: 'numeric'
      }).format(now);
    } catch (e) { /* leave the baked date */ }
  }

  // Which waqt is next, in the city's own local hours.
  var localHours = ((now.getTime() / 3600000) % 24 + offset + 24) % 24;
  var order = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'];
  var next = null;
  for (var i = 0; i < order.length; i++) {
    var t = times[order[i]];
    if (!isNaN(t) && t > localHours) { next = order[i]; break; }
  }
  if (!next) next = 'fajr'; // past ʿIshāʾ — the next one is tomorrow's Fajr

  var active = host.querySelector('.time[data-prayer="' + next + '"]');
  if (active) active.classList.add('is-next');

  var pill = document.getElementById('next-prayer');
  if (pill && city.nextIn && city.prayers) {
    var mins = Math.round((((times[next] - localHours) % 24 + 24) % 24) * 60);
    var h = Math.floor(mins / 60);
    var m = mins % 60;
    pill.textContent = city.nextIn
      .replace('{prayer}', city.prayers[next])
      .replace('{duration}', (h ? unit(h, 'hour') + ' ' : '') + unit(m, 'minute'));
    pill.hidden = false;
  }

  /* "2h 48m" in English, "2 س 48 د" in Arabic, "2s 48d" in Turkish — the
     unit labels come from ICU rather than a table in this file. Digits are
     forced to Latin so the pill matches the times above it. */
  function unit(value, name) {
    try {
      return new Intl.NumberFormat(locale ? locale + '-u-nu-latn' : undefined,
        { style: 'unit', unit: name, unitDisplay: 'narrow' }).format(value);
    } catch (e) {
      return value + (name === 'hour' ? 'h' : 'm');
    }
  }

  var note = document.getElementById('recalc-note');
  if (note && city.liveNote) {
    note.textContent = city.liveNote.replace('{tz}', city.tz.replace(/_/g, ' '));
  }

  // Highlight today in the month table, which is only right on build day.
  var rows = document.querySelectorAll('.timetable tbody tr');
  rows.forEach(function (row) { row.classList.remove('is-today'); });
  var table = document.querySelector('.timetable');
  if (table && rows[date.d - 1]) {
    // Only mark it if the baked table is actually for the current month.
    var caption = table.querySelector('caption');
    var monthName = '';
    try {
      monthName = new Intl.DateTimeFormat(locale, { timeZone: city.tz, month: 'long' }).format(now);
    } catch (e) { /* fall through */ }
    if (caption && monthName && caption.textContent.indexOf(monthName) !== -1) {
      rows[date.d - 1].classList.add('is-today');
    }
  }
})();
