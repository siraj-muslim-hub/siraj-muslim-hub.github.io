/* Live countdown on the Ramadan hub.
 *
 * The page ships with a figure baked in at build time, which is only right on
 * the day it was generated — and unlike the prayer tables these pages are not
 * rebuilt monthly, because the Ramadan dates are fixed. So the number has to
 * be recomputed in the browser or it is wrong within a day.
 *
 * Every string comes from the page's own data-ramadan blob, filled from
 * tools/i18n.json, so one copy of this file serves all seven languages.
 */
(function () {
  'use strict';

  var host = document.querySelector('.ramadan-countdown');
  var out = document.getElementById('ramadan-countdown');
  if (!host || !out) return;

  var cfg;
  try { cfg = JSON.parse(host.getAttribute('data-ramadan')); }
  catch (e) { return; }   // keep the baked figure rather than showing nothing

  var parts = cfg.start.split('-');
  var startUTC = Date.UTC(+parts[0], +parts[1] - 1, +parts[2]);
  var DAY = 86400000;

  // Compare whole days in UTC, so the figure does not flicker by one across
  // timezones or during a local daylight-saving change.
  var now = new Date();
  var todayUTC = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  var delta = Math.round((startUTC - todayUTC) / DAY);

  function fmt(n) {
    try { return new Intl.NumberFormat(cfg.locale + '-u-nu-latn').format(n); }
    catch (e) { return String(n); }
  }

  var text;
  if (delta > 0) text = cfg.before.replace('{days}', fmt(delta));
  else if (delta > -cfg.days) text = cfg.during.replace('{day}', fmt(1 - delta));
  else text = cfg.after;

  out.textContent = text;
})();
