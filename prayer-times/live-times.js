/* Recompute today's times in the visitor's browser.
 *
 * The page ships with times baked in at build time, so it is useful to a
 * crawler and to anyone with JS off. But a build is only correct on the day
 * it ran, and these are prayer times — showing yesterday's is not a cosmetic
 * bug. So we recalculate on load from the same module the generator used,
 * and mark which waqt is next.
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
    dateEl.textContent = new Intl.DateTimeFormat(undefined, {
      timeZone: city.tz, year: 'numeric', month: 'long', day: 'numeric'
    }).format(now);
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
  if (pill) {
    var labels = { fajr: 'Fajr', sunrise: 'Sunrise', dhuhr: 'Dhuhr',
                   asr: 'ʿAsr', maghrib: 'Maghrib', isha: 'ʿIshāʾ' };
    var mins = Math.round((((times[next] - localHours) % 24 + 24) % 24) * 60);
    var h = Math.floor(mins / 60);
    var m = mins % 60;
    pill.textContent = labels[next] + ' in ' + (h ? h + 'h ' : '') + m + 'm';
    pill.hidden = false;
  }

  var note = document.getElementById('recalc-note');
  if (note) {
    note.textContent = 'Calculated in your browser for ' + city.tz.replace(/_/g, ' ') +
      ' — these are live, not the times this page was built with.';
  }

  // Highlight today in the month table, which is only right on build day.
  var rows = document.querySelectorAll('.timetable tbody tr');
  rows.forEach(function (row) { row.classList.remove('is-today'); });
  var built = document.querySelector('.timetable');
  if (built && rows[date.d - 1]) {
    // Only mark it if the table is actually this month.
    var caption = built.querySelector('caption');
    var monthName = new Intl.DateTimeFormat('en-US', { timeZone: city.tz, month: 'long' }).format(now);
    if (caption && caption.textContent.indexOf(monthName + ' ' + date.y) !== -1) {
      rows[date.d - 1].classList.add('is-today');
    }
  }
})();
