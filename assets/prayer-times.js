/* Sirāj — prayer time & Qibla calculation.
 *
 * One implementation, used in two places: tools/gen-cities.js bakes the
 * static timetables into the city pages at build time, and the same file is
 * shipped to the browser so those pages can recompute today's times live.
 * Keeping it single-source is the point — two copies of this arithmetic
 * would drift, and a page that disagrees with itself is worse than no page.
 *
 * The astronomy follows the standard low-precision solar position model
 * (Meeus, "Astronomical Algorithms") as popularised by PrayTimes.org.
 * Accurate to well under a minute, which is finer than the differences
 * between the calculation conventions themselves.
 *
 * NOTE: these pages are a marketing surface. The app computes times on the
 * device with the user's own method, madhhab and manual offsets; a visitor
 * praying by this table is trusting a default we picked for their city.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.PrayerTimes = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var DEG = Math.PI / 180;
  var KAABA = { lat: 21.4224779, lng: 39.8251832 };

  function sin(d) { return Math.sin(d * DEG); }
  function cos(d) { return Math.cos(d * DEG); }
  function tan(d) { return Math.tan(d * DEG); }
  function arcsin(x) { return Math.asin(x) / DEG; }
  function arccos(x) { return Math.acos(x) / DEG; }
  function arctan2(y, x) { return Math.atan2(y, x) / DEG; }
  function arccot(x) { return Math.atan(1 / x) / DEG; }
  function fix(a, b) { a = a - b * Math.floor(a / b); return a < 0 ? a + b : a; }
  function fixAngle(a) { return fix(a, 360); }
  function fixHour(a) { return fix(a, 24); }

  /* Calculation conventions. `fajr`/`isha` are degrees below the horizon;
   * an isha given as {minutes:n} is a fixed interval after maghrib instead. */
  var METHODS = {
    MWL:      { name: 'Muslim World League',            fajr: 18,   isha: 17 },
    ISNA:     { name: 'Islamic Society of North America', fajr: 15, isha: 15 },
    Egypt:    { name: 'Egyptian General Authority of Survey', fajr: 19.5, isha: 17.5 },
    Makkah:   { name: 'Umm al-Qurā University, Makkah', fajr: 18.5, isha: { minutes: 90 } },
    Karachi:  { name: 'University of Islamic Sciences, Karachi', fajr: 18, isha: 18 },
    Tehran:   { name: 'Institute of Geophysics, University of Tehran', fajr: 17.7, isha: 14, maghrib: 4.5 },
    Singapore:{ name: 'Majlis Ugama Islam Singapura',   fajr: 20,   isha: 18 },
    Turkey:   { name: 'Diyanet İşleri Başkanlığı',      fajr: 18,   isha: 17 },
    France:   { name: 'Union des Organisations Islamiques de France', fajr: 12, isha: 12 },
    Russia:   { name: 'Spiritual Administration of Muslims of Russia', fajr: 16, isha: 15 },
    Kemenag:  { name: 'Kementerian Agama Republik Indonesia', fajr: 20, isha: 18 },
    JAKIM:    { name: 'Jabatan Kemajuan Islam Malaysia', fajr: 20,  isha: 18 },
    Dubai:    { name: 'Ministry of Awqaf, UAE',          fajr: 18.2, isha: 18.2 }
  };

  /* ---- solar position ---------------------------------------------- */

  function julian(y, m, d) {
    if (m <= 2) { y -= 1; m += 12; }
    var a = Math.floor(y / 100);
    var b = 2 - a + Math.floor(a / 4);
    return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + d + b - 1524.5;
  }

  function sunPosition(jd) {
    var d = jd - 2451545.0;
    var g = fixAngle(357.529 + 0.98560028 * d);
    var q = fixAngle(280.459 + 0.98564736 * d);
    var l = fixAngle(q + 1.915 * sin(g) + 0.020 * sin(2 * g));
    var e = 23.439 - 0.00000036 * d;
    var ra = arctan2(cos(e) * sin(l), cos(l)) / 15;
    return { declination: arcsin(sin(e) * sin(l)), equation: q / 15 - fixHour(ra) };
  }

  /* ---- the engine --------------------------------------------------- */

  function Calculator(opts) {
    this.lat = opts.lat;
    this.lng = opts.lng;
    this.elevation = opts.elevation || 0;
    this.method = METHODS[opts.method] ? opts.method : 'MWL';
    this.params = METHODS[this.method];
    // Shadow length factor: 1 = Shāfiʿī/Mālikī/Ḥanbalī, 2 = Ḥanafī.
    this.asrFactor = opts.asrFactor === 2 ? 2 : 1;
  }

  Calculator.prototype._midDay = function (t) {
    return fixHour(12 - sunPosition(this.jDate + t).equation);
  };

  Calculator.prototype._sunAngleTime = function (angle, t, ccw) {
    var decl = sunPosition(this.jDate + t).declination;
    var noon = this._midDay(t);
    var arg = (-sin(angle) - sin(decl) * sin(this.lat)) / (cos(decl) * cos(this.lat));
    // |arg| > 1 means the sun never reaches that angle — polar summer/winter.
    // Return NaN and let the high-latitude adjustment supply a rule.
    if (arg > 1 || arg < -1) return NaN;
    var span = arccos(arg) / 15;
    return noon + (ccw ? -span : span);
  };

  Calculator.prototype._asrTime = function (t) {
    var decl = sunPosition(this.jDate + t).declination;
    var angle = -arccot(this.asrFactor + tan(Math.abs(this.lat - decl)));
    return this._sunAngleTime(angle, t);
  };

  function timeDiff(a, b) { return fixHour(b - a); }

  Calculator.prototype._adjustHighLats = function (t) {
    // Above roughly 48° the sun can stay too shallow for a true Fajr or
    // ʿIshāʾ angle in summer. Fall back to the angle-based portion of the
    // night, the most widely accepted of the several conventions.
    var night = timeDiff(t.sunset, t.sunrise);
    t.fajr = this._portion(t.fajr, t.sunrise, this.params.fajr, night, true);
    t.isha = this._portion(t.isha, t.sunset,
      typeof this.params.isha === 'number' ? this.params.isha : 18, night, false);
    return t;
  };

  Calculator.prototype._portion = function (time, base, angle, night, ccw) {
    var portion = angle / 60 * night;
    var diff = ccw ? timeDiff(time, base) : timeDiff(base, time);
    if (isNaN(time) || diff > portion) time = base + (ccw ? -portion : portion);
    return time;
  };

  /* Times for one calendar day, as fractional local hours.
   * `date` is a plain {y, m, d} in the city's own local calendar. */
  Calculator.prototype.compute = function (date, tzOffsetHours) {
    this.jDate = julian(date.y, date.m, date.d) - this.lng / (15 * 24);

    var guess = { fajr: 5, sunrise: 6, dhuhr: 12, asr: 13, sunset: 18, isha: 18 };
    var t = guess;
    // Each time depends on the sun's position at that time, so iterate.
    for (var i = 0; i < 3; i++) {
      var h = {};
      for (var k in t) h[k] = t[k] / 24;
      // 0.833° covers refraction and the solar disc; elevation adds dip.
      var horizon = 0.833 + 0.0347 * Math.sqrt(Math.max(this.elevation, 0));
      t = {
        fajr:    this._sunAngleTime(this.params.fajr, h.fajr, true),
        sunrise: this._sunAngleTime(horizon, h.sunrise, true),
        dhuhr:   this._midDay(h.dhuhr),
        asr:     this._asrTime(h.asr),
        sunset:  this._sunAngleTime(horizon, h.sunset),
        isha:    typeof this.params.isha === 'number'
                   ? this._sunAngleTime(this.params.isha, h.isha)
                   : NaN
      };
      // Seed the next pass with something finite where the angle failed.
      for (var key in t) if (isNaN(t[key])) t[key] = guess[key];
      if (typeof this.params.isha !== 'number') t.isha = NaN;
    }

    var maghrib = typeof this.params.maghrib === 'number'
      ? this._sunAngleTime(this.params.maghrib, t.sunset / 24)
      : t.sunset;
    if (isNaN(maghrib)) maghrib = t.sunset;
    if (typeof this.params.isha !== 'number') t.isha = maghrib + this.params.isha.minutes / 60;

    t = this._adjustHighLats(t);

    // Sunnah: a small delay after astronomical sunset before Maghrib is called.
    if (typeof this.params.maghrib !== 'number') maghrib = t.sunset + 1 / 60;

    var shift = tzOffsetHours - this.lng / 15;
    return {
      fajr: t.fajr + shift,
      sunrise: t.sunrise + shift,
      dhuhr: t.dhuhr + shift + 1 / 60,
      asr: t.asr + shift,
      maghrib: maghrib + shift,
      isha: t.isha + shift
    };
  };

  /* ---- helpers shared by the generator and the page ------------------ */

  /* A city's UTC offset on a given instant, DST included, straight from the
   * platform's IANA database — no timezone table to go stale in this repo. */
  function tzOffset(zone, when) {
    var dtf = new Intl.DateTimeFormat('en-US', {
      timeZone: zone, hour12: false,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
    var p = {};
    dtf.formatToParts(when).forEach(function (part) { p[part.type] = part.value; });
    // formatToParts renders midnight as hour 24 in some engines.
    var hour = p.hour === '24' ? 0 : Number(p.hour);
    var asUTC = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day),
                         hour, Number(p.minute), Number(p.second));
    return (asUTC - Math.floor(when.getTime() / 1000) * 1000) / 3600000;
  }

  /* The calendar date it is right now in a given city. */
  function localDate(zone, when) {
    var dtf = new Intl.DateTimeFormat('en-CA', {
      timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit'
    });
    var parts = dtf.format(when).split('-');
    return { y: Number(parts[0]), m: Number(parts[1]), d: Number(parts[2]) };
  }

  function formatTime(hours, hour12) {
    if (isNaN(hours)) return '—';
    var total = Math.round(fixHour(hours) * 60);
    var h = Math.floor(total / 60) % 24;
    var m = total % 60;
    var mm = (m < 10 ? '0' : '') + m;
    if (!hour12) return (h < 10 ? '0' : '') + h + ':' + mm;
    var suffix = h < 12 ? 'am' : 'pm';
    var h12 = h % 12 === 0 ? 12 : h % 12;
    return h12 + ':' + mm + ' ' + suffix;
  }

  /* Initial great-circle bearing to the Kaaba, in degrees clockwise from
   * true north. This is the number a compass needs, and it is a fixed
   * property of the city — the most genuinely useful thing on the page. */
  function qiblaBearing(lat, lng) {
    var dLng = KAABA.lng - lng;
    var y = sin(dLng);
    var x = cos(lat) * tan(KAABA.lat) - sin(lat) * cos(dLng);
    return fixAngle(arctan2(y, x));
  }

  function compassPoint(bearing) {
    var names = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
                 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    return names[Math.round(bearing / 22.5) % 16];
  }

  /* Great-circle distance to Makkah in kilometres. */
  function distanceToMakkah(lat, lng) {
    var R = 6371;
    var dLat = (KAABA.lat - lat) * DEG;
    var dLng = (KAABA.lng - lng) * DEG;
    var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            cos(lat) * cos(KAABA.lat) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return Math.round(2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
  }

  return {
    Calculator: Calculator,
    METHODS: METHODS,
    KAABA: KAABA,
    tzOffset: tzOffset,
    localDate: localDate,
    formatTime: formatTime,
    qiblaBearing: qiblaBearing,
    compassPoint: compassPoint,
    distanceToMakkah: distanceToMakkah
  };
}));
