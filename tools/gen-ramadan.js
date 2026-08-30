#!/usr/bin/env node
/* Sirāj — build the /ramadan/ hub and the per-city Ramadan timetables.
 *
 *   node tools/gen-ramadan.js            # write hub + city pages (all languages)
 *   node tools/gen-ramadan.js --check    # every city has a page in every language
 *
 * "Ramadan timetable" is the single biggest seasonal query in this category,
 * and it is asked in the reader's own language: إمساكية رمضان, jadwal
 * imsakiyah, ramazan imsakiyesi, calendrier ramadan. So these pages exist per
 * language, not just per city.
 *
 * Unlike the monthly prayer-time pages these are NOT rebuilt monthly — the
 * Ramadan dates are fixed, so the tables are correct from the day they are
 * generated until the month itself passes.
 *
 * URLs mirror the prayer-times layout: English keeps the flat path, every
 * other language sits under a prefix.
 *
 *   /ramadan/                      /ramadan/ar/
 *   /ramadan/london.html           /ramadan/ar/london.html
 */
'use strict';

const fs = require('fs');
const path = require('path');
const PT = require('../assets/prayer-times.js');
const shared = require('./shared.js');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'ramadan');
const { cities } = require('./cities.json');
const I18N = require('./i18n.json');

const LANGS = shared.LANGS;
const DEFAULT_LANG = shared.DEFAULT_LANG;
const ORIGIN = shared.ORIGIN;

/* Ramadan 1448, from the Umm al-Qurā calendar: 1 Ramadan is 8 Feb 2027 and
 * the month runs 29 days to 8 Mar; Eid al-Fitr is 9 Mar. Verified against
 * ICU's islamic-umalqura calendar rather than counted by hand. */
const RAMADAN = { startUTC: Date.UTC(2027, 1, 8), days: 29, eidUTC: Date.UTC(2027, 2, 9) };

function dayOf(n) {                       // n = 1..29 → {y, m, d}
  const t = new Date(RAMADAN.startUTC + (n - 1) * 86400000);
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() };
}

function pageHref(lang, slug) {
  const base = lang === DEFAULT_LANG ? '/ramadan/' : `/ramadan/${lang}/`;
  return slug ? `${base}${slug}.html` : base;
}
function outPath(lang, name) {
  return lang === DEFAULT_LANG ? path.join(OUT, name) : path.join(OUT, lang, name);
}
function up(lang) { return lang === DEFAULT_LANG ? '../' : '../../'; }

/* ---- one city's Ramadan timetable ---------------------------------- */

function cityPage(city, lang) {
  const t = I18N[lang];
  const r = t.ramadan;
  const method = PT.METHODS[city.method];
  const localName = shared.cityName(city, lang);
  const country = shared.countryName(city, lang);
  const u = up(lang);

  const alternatesFor = code => pageHref(code, city.slug);
  const rows = [];
  let longest = null, shortest = null;
  for (let n = 1; n <= RAMADAN.days; n++) {
    const date = dayOf(n);
    const noonUTC = new Date(Date.UTC(date.y, date.m - 1, date.d, 12));
    const offset = PT.tzOffset(city.tz, noonUTC);
    const times = new PT.Calculator({
      lat: city.lat, lng: city.lng, method: city.method, asrFactor: city.asr
    }).compute(date, offset);
    // Fasting runs Fajr → Maghrib. Both are finite for every city we ship.
    const mins = Math.round((((times.maghrib - times.fajr) % 24 + 24) % 24) * 60);
    if (!longest || mins > longest.mins) longest = { n, mins };
    if (!shortest || mins < shortest.mins) shortest = { n, mins };
    rows.push({ n, date, fajr: times.fajr, maghrib: times.maghrib, mins });
  }

  const startLabel = shared.longDate(lang, dayOf(1));
  const endLabel = shared.longDate(lang, dayOf(RAMADAN.days));
  const vars = {
    city: localName, country, method: method.name,
    days: shared.num(lang, RAMADAN.days), start: startLabel, end: endLabel
  };

  const body = `
<main class="doc city">
  <nav class="crumbs" aria-label="Breadcrumb">
    <a href="${u}index.html">Sirāj</a> › <a href="${pageHref(lang, null)}">${shared.esc(r.nav)}</a> › <span>${shared.esc(localName)}</span>
  </nav>

  <h1>${shared.esc(shared.fill(r.cityH1, vars))}</h1>
  <p class="updated">${shared.esc(country)} · ${shared.esc(shared.fill(r.range, vars))} · ${shared.esc(method.name)}</p>

  <p>${shared.esc(shared.fill(r.cityIntro, vars))}</p>

  <div class="facts">
    <div class="fact"><span class="k">${shared.esc(r.longest)}</span><span class="v">${shared.duration(lang, longest.mins)}</span><span class="s">${shared.esc(r.colDay)} ${shared.num(lang, longest.n)}</span></div>
    <div class="fact"><span class="k">${shared.esc(r.shortest)}</span><span class="v">${shared.duration(lang, shortest.mins)}</span><span class="s">${shared.esc(r.colDay)} ${shared.num(lang, shortest.n)}</span></div>
    <div class="fact"><span class="k">${shared.esc(r.eidHeading)}</span><span class="v">${shared.esc(shared.shortDate(lang, RAMADAN.eidUTC))}</span><span class="s">1 Shawwāl 1448</span></div>
  </div>

  <div class="table-wrap">
    <table class="timetable ramadan-table">
      <caption>${shared.esc(shared.fill(r.tableCaption, vars))}</caption>
      <thead><tr>
        <th scope="col">${shared.esc(r.colDay)}</th>
        <th scope="col">${shared.esc(r.colDate)}</th>
        <th scope="col">${shared.esc(r.colSuhoor)}</th>
        <th scope="col">${shared.esc(r.colIftar)}</th>
        <th scope="col">${shared.esc(r.colLength)}</th>
      </tr></thead>
      <tbody>
${rows.map(row => `<tr><th scope="row">${shared.num(lang, row.n)}</th><td>${shared.esc(shared.shortDate(lang, Date.UTC(row.date.y, row.date.m - 1, row.date.d)))}</td><td>${PT.formatTime(row.fajr, false)}</td><td>${PT.formatTime(row.maghrib, false)}</td><td>${shared.duration(lang, row.mins)}</td></tr>`).join('\n')}
      </tbody>
    </table>
  </div>

  <div class="callout"><p>${shared.esc(r.imsakNote)}</p></div>

  <section class="city-cta">
    <h2>${shared.esc(r.tool1t)}</h2>
    <p>${shared.esc(r.tool1b)}</p>
    ${shared.storeBadges(lang)}
  </section>

  <p style="margin-top:28px"><a href="${pageHref(lang, null)}">← ${shared.esc(r.allCities)}</a> · <a href="${shared.prayerHref(lang, city.slug)}">${shared.esc(t.nav.prayerTimes)}</a></p>
</main>`;

  const jsonld = {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: shared.fill(r.cityH1, vars),
    startDate: '2027-02-08', endDate: '2027-03-08',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    location: {
      '@type': 'Place', name: `${localName}, ${country}`,
      geo: { '@type': 'GeoCoordinates', latitude: city.lat, longitude: city.lng }
    },
    description: shared.fill(r.cityDescription, vars)
  };

  return shared.head({
    lang, title: shared.fill(r.cityTitle, vars),
    description: shared.fill(r.cityDescription, vars),
    pathname: pageHref(lang, city.slug),
    alternates: s => pageHref(s, city.slug),
    jsonld, up: u
  }) + shared.nav(lang, u, alternatesFor) + body + shared.footer(lang, u) + `
</body>
</html>
`;
}

/* ---- the hub -------------------------------------------------------- */

function hubPage(lang) {
  const t = I18N[lang];
  const r = t.ramadan;
  const u = up(lang);

  const alternatesFor = code => pageHref(code, null);
  const byCountry = new Map();
  for (const c of cities) {
    const label = shared.countryName(c, lang);
    if (!byCountry.has(label)) byCountry.set(label, []);
    byCountry.get(label).push(c);
  }
  const countries = [...byCountry.keys()].sort((a, b) => a.localeCompare(b, t.locale));

  const vars = {
    days: shared.num(lang, RAMADAN.days),
    start: shared.longDate(lang, dayOf(1)),
    end: shared.longDate(lang, dayOf(RAMADAN.days)),
    eid: shared.longDate(lang, { y: 2027, m: 3, d: 9 }),
    cities: shared.num(lang, cities.length),
    countries: shared.num(lang, countries.length)
  };

  const list = countries.map(country => {
    const items = byCountry.get(country).slice()
      .map(c => ({ city: c, label: shared.cityName(c, lang) }))
      .sort((a, b) => a.label.localeCompare(b.label, t.locale))
      .map(({ city, label }) => {
        const alias = label === city.name ? '' : ` data-alias="${shared.esc(city.name)}"`;
        return `<li${alias}><a href="${city.slug}.html">${shared.esc(label)}</a></li>`;
      }).join('\n        ');
    return `    <section class="country">\n      <h3>${shared.esc(country)}</h3>\n      <ul>\n        ${items}\n      </ul>\n    </section>`;
  }).join('\n');

  const tools = [1, 2, 3, 4].map(i =>
    `<div class="rtool"><h3>${shared.esc(r['tool' + i + 't'])}</h3><p>${shared.esc(r['tool' + i + 'b'])}</p></div>`).join('\n      ');

  const body = `
<main class="doc city-index">
  <nav class="crumbs" aria-label="Breadcrumb">
    <a href="${u}index.html">Sirāj</a> › <span>${shared.esc(r.nav)}</span>
  </nav>

  <h1>${shared.esc(r.hubH1)}</h1>
  <p class="updated">${shared.esc(shared.fill(r.range, vars))}</p>

  <div class="today ramadan-countdown" data-ramadan='${shared.esc(JSON.stringify({
    start: '2027-02-08', days: RAMADAN.days, locale: t.locale,
    before: r.before, during: r.during, after: r.after
  }))}'>
    <div class="today-head">
      <h2 id="ramadan-countdown">${shared.esc(shared.fill(r.before, { days: shared.num(lang, Math.max(0, Math.ceil((RAMADAN.startUTC - Date.now()) / 86400000))) }))}</h2>
    </div>
    <p class="recalc">${shared.esc(r.standfirst)}</p>
  </div>

  <h2>${shared.esc(r.toolsHeading)}</h2>
  <div class="rtools">
      ${tools}
  </div>

  <h2>${shared.esc(r.eidHeading)}</h2>
  <p>${shared.esc(shared.fill(r.eidBody, vars))}</p>

  <h2>${shared.esc(r.citiesHeading)}</h2>
  <p>${shared.esc(r.citiesIntro)}</p>

  <div class="city-filter">
    <label for="city-search" class="sr-only">${shared.esc(t.index.searchLabel)}</label>
    <input type="search" id="city-search" placeholder="${shared.esc(t.index.searchPlaceholder)}" autocomplete="off">
    <p id="filter-empty" hidden>${shared.esc(t.index.noMatch)} <a href="${u}support.html">${shared.esc(t.index.noMatchLink)}</a></p>
  </div>

  <div class="country-grid">
${list}
  </div>

  <p style="margin-top:28px"><a href="${shared.prayerHref(lang, null)}">← ${shared.esc(t.nav.prayerTimes)}</a></p>
</main>`;

  const jsonld = {
    '@context': 'https://schema.org', '@type': 'CollectionPage',
    name: r.hubH1, description: shared.fill(r.hubDescription, vars),
    inLanguage: lang, url: ORIGIN + pageHref(lang, null)
  };

  return shared.head({
    lang, title: shared.fill(r.hubTitle, vars),
    description: shared.fill(r.hubDescription, vars),
    pathname: pageHref(lang, null),
    alternates: s => pageHref(s, null),
    jsonld, up: u
  }) + shared.nav(lang, u, alternatesFor) + body + shared.footer(lang, u) + `
<script src="${u}prayer-times/filter.js" defer></script>
<script src="${u}ramadan/countdown.js" defer></script>
</body>
</html>
`;
}

/* ---- drive ---------------------------------------------------------- */

function build() {
  const files = new Map();
  for (const lang of LANGS) {
    for (const c of cities) files.set(outPath(lang, c.slug + '.html'), cityPage(c, lang));
    files.set(outPath(lang, 'index.html'), hubPage(lang));
  }
  return files;
}

function main() {
  const check = process.argv.includes('--check');
  for (const lang of LANGS) {
    fs.mkdirSync(lang === DEFAULT_LANG ? OUT : path.join(OUT, lang), { recursive: true });
  }
  const files = build();

  if (check) {
    let problems = 0;
    for (const lang of LANGS) {
      const dir = lang === DEFAULT_LANG ? OUT : path.join(OUT, lang);
      const expected = new Set(cities.map(c => c.slug + '.html').concat('index.html'));
      const actual = new Set(fs.existsSync(dir) ? fs.readdirSync(dir).filter(n => n.endsWith('.html')) : []);
      for (const n of expected) if (!actual.has(n)) { console.error(`  ${lang}: missing ${n}`); problems++; }
      for (const n of actual) if (!expected.has(n)) { console.error(`  ${lang}: orphaned ${n}`); problems++; }
    }
    if (problems) { console.error('\nRun: node tools/gen-ramadan.js'); process.exit(1); }
    console.log(`ok — ${cities.length} cities × ${LANGS.length} languages = ${cities.length * LANGS.length} Ramadan pages, plus ${LANGS.length} hubs`);
    return;
  }

  for (const entry of fs.readdirSync(OUT, { withFileTypes: true })) {
    if (entry.isDirectory() && !LANGS.includes(entry.name)) {
      fs.rmSync(path.join(OUT, entry.name), { recursive: true, force: true });
    }
  }
  const keep = new Set(files.keys());
  for (const lang of LANGS) {
    const dir = lang === DEFAULT_LANG ? OUT : path.join(OUT, lang);
    for (const name of fs.readdirSync(dir).filter(n => n.endsWith('.html'))) {
      const full = path.join(dir, name);
      if (!keep.has(full)) fs.unlinkSync(full);
    }
  }
  for (const [f, content] of files) fs.writeFileSync(f, content, 'utf8');
  console.log(`wrote ${cities.length} × ${LANGS.length} Ramadan timetables + ${LANGS.length} hubs`);
}

if (require.main === module) main();
module.exports = { RAMADAN, pageHref, dayOf };
