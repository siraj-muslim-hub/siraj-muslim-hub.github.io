#!/usr/bin/env node
/* Sirāj — build the /prayer-times/ landing pages, in every supported language.
 *
 *   node tools/gen-cities.js            # write pages + indexes + sitemap
 *   node tools/gen-cities.js --check    # every city has a page in every
 *                                       # language, and no page is orphaned
 *
 * Each page carries something real and specific to its city: the Qibla
 * bearing, the distance to Makkah, the local calculation convention, and a
 * full month of times. That is the difference between a landing page and a
 * doorway page — the content has to be worth the visit on its own, or it
 * deserves to rank nowhere.
 *
 * The month table is baked at build time so crawlers (and anyone with JS
 * off) get real content; the page then recomputes today's times in the
 * browser from the very same module, so a stale build is never shown as
 * today's times. The GitHub Action in .github/workflows refreshes it monthly.
 *
 * URL layout — English keeps the paths it was first published at, because
 * those are already live and indexed; other languages sit under a prefix:
 *
 *   /prayer-times/london.html          en
 *   /prayer-times/ar/london.html       ar, ur, tr, id, fr, de
 *
 * Every page declares hreflang alternates for all seven plus x-default.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const PT = require('../assets/prayer-times.js');
const shared = require('./shared.js');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'prayer-times');
const { cities } = require('./cities.json');
const I18N = require('./i18n.json');

/* Chrome, names, dates and number formatting all come from tools/shared.js so
 * this generator and gen-ramadan.js cannot drift apart. */
const { LANGS, DEFAULT_LANG, ORIGIN, esc, fill, cityName, cityNameIn,
        countryName, num, monthName, longDate, prayerHref, ramadanHref } = shared;

const PRAYERS = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'];

function daysInMonth(y, m) { return new Date(Date.UTC(y, m, 0)).getUTCDate(); }

/* Times for one city on one local calendar date. */
function timesFor(city, date) {
  const noonUTC = new Date(Date.UTC(date.y, date.m - 1, date.d, 12));
  const offset = PT.tzOffset(city.tz, noonUTC);
  const calc = new PT.Calculator({
    lat: city.lat, lng: city.lng, method: city.method, asrFactor: city.asr
  });
  return { times: calc.compute(date, offset), offset };
}

function offsetLabel(offset) {
  const sign = offset < 0 ? '-' : '+';
  const abs = Math.abs(offset);
  const h = Math.floor(abs);
  const m = Math.round((abs - h) * 60);
  return 'UTC' + sign + h + (m ? ':' + String(m).padStart(2, '0') : '');
}

/* ---- paths ---------------------------------------------------------- */

const pageHref = (lang, slug) => prayerHref(lang, slug);
const indexHref = (lang) => prayerHref(lang, null);

function outPath(lang, name) {
  return lang === DEFAULT_LANG ? path.join(OUT, name) : path.join(OUT, lang, name);
}
function up(lang) { return lang === DEFAULT_LANG ? '../' : '../../'; }

const nav = (lang) => shared.nav(lang, up(lang));
const footer = (lang) => shared.footer(lang, up(lang));
const storeBadges = (lang) => shared.storeBadges(lang);
const langSwitcher = (lang, slug) =>
  shared.langSwitcher(lang, code => pageHref(code, slug), I18N[lang].nav.prayerTimes);

function head(opts) {
  return shared.head({
    lang: opts.lang, title: opts.title, description: opts.description,
    pathname: opts.pathname, jsonld: opts.jsonld, up: up(opts.lang),
    alternates: code => opts.slug ? pageHref(code, opts.slug) : indexHref(code)
  }) + nav(opts.lang);
}


/* ---- one city page ------------------------------------------------- */

function cityPage(city, today, lang) {
  const t = I18N[lang];
  const c = t.city;
  const { times, offset } = timesFor(city, today);
  const bearing = PT.qiblaBearing(city.lat, city.lng);
  const distance = PT.distanceToMakkah(city.lat, city.lng);
  const method = PT.METHODS[city.method];
  const madhhab = city.asr === 2 ? t.madhhab.hanafi : t.madhhab.standard;
  const month = monthName(lang, today.y, today.m);
  const u = up(lang);

  const localName = cityName(city, lang);
  const vars = {
    city: localName, cityIn: cityNameIn(city, lang),
    country: countryName(city, lang), method: method.name,
    month, year: today.y, tz: city.tz, madhhab,
    lat: city.lat.toFixed(4), lng: city.lng.toFixed(4),
    qibla: bearing.toFixed(1),
    fajr: PT.formatTime(times.fajr, true), dhuhr: PT.formatTime(times.dhuhr, true),
    asr: PT.formatTime(times.asr, true), maghrib: PT.formatTime(times.maghrib, true),
    isha: PT.formatTime(times.isha, true)
  };

  const title = fill(c.title, vars);
  const description = fill(c.description, vars);
  const angleSentence = typeof method.isha === 'number'
    ? fill(c.angleNote, { fajr: method.fajr, isha: method.isha })
    : fill(c.intervalNote, { fajr: method.fajr, minutes: method.isha.minutes });

  // A month of times, baked so the page has real content without JS.
  const dim = daysInMonth(today.y, today.m);
  let rows = '';
  for (let d = 1; d <= dim; d++) {
    const dayTimes = timesFor(city, { y: today.y, m: today.m, d }).times;
    rows += `<tr${d === today.d ? ' class="is-today"' : ''}><th scope="row">${num(lang, d)}</th>` +
      PRAYERS.map(p => `<td>${PT.formatTime(dayTimes[p], false)}</td>`).join('') + '</tr>\n';
  }

  const jsonld = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Sirāj', item: ORIGIN + '/' },
          { '@type': 'ListItem', position: 2, name: t.nav.prayerTimes, item: ORIGIN + indexHref(lang) },
          { '@type': 'ListItem', position: 3, name: fill(c.h1, vars) }
        ]
      },
      {
        '@type': 'Place',
        name: `${localName}, ${countryName(city, lang)}`,
        alternateName: city.name,
        geo: { '@type': 'GeoCoordinates', latitude: city.lat, longitude: city.lng }
      }
    ]
  };

  return head({ lang, slug: city.slug, title, description, pathname: pageHref(lang, city.slug), jsonld }) + `
<main class="doc city">
  <nav class="crumbs" aria-label="Breadcrumb">
    <a href="${u}index.html">Sirāj</a> › <a href="${indexHref(lang)}">${esc(t.nav.prayerTimes)}</a> › <span>${esc(localName)}</span>
  </nav>

  <h1>${esc(fill(c.h1, vars))}</h1>
  <p class="updated">${esc(countryName(city, lang))} · ${city.lat.toFixed(4)}°, ${city.lng.toFixed(4)}° · ${esc(offsetLabel(offset))} · ${esc(method.name)}</p>

  <div class="today" data-city='${esc(JSON.stringify({ lat: city.lat, lng: city.lng, tz: city.tz, method: city.method, asr: city.asr, lang, locale: t.locale, nextIn: c.nextIn, liveNote: c.liveNote, prayers: t.prayers }))}'>
    <div class="today-head">
      <h2>${esc(c.today)} <span class="dim" id="today-date">${esc(longDate(lang, today))}</span></h2>
      <span class="next-pill" id="next-prayer" hidden></span>
    </div>
    <div class="times">
      ${PRAYERS.map(p => `<div class="time${p === 'sunrise' ? ' muted' : ''}" data-prayer="${p}">
        <span class="lbl">${esc(t.prayers[p])}</span>
        <span class="val">${PT.formatTime(times[p], true)}</span>
      </div>`).join('\n      ')}
    </div>
    <p class="recalc" id="recalc-note">${esc(c.staticNote)}</p>
  </div>

  <h2>${esc(fill(c.qiblaHeading, vars))}</h2>
  <div class="facts">
    <div class="fact"><span class="k">${esc(c.direction)}</span><span class="v">${bearing.toFixed(1)}°</span><span class="s">${esc(c.directionSub)}</span></div>
    <div class="fact"><span class="k">${esc(c.compass)}</span><span class="v">${PT.compassPoint(bearing)}</span><span class="s">${esc(c.compassSub)}</span></div>
    <div class="fact"><span class="k">${esc(c.distance)}</span><span class="v">${num(lang, distance)} km</span><span class="s">${esc(c.distanceSub)}</span></div>
  </div>
  <p>${esc(c.magneticNote)}</p>

  <h2>${esc(fill(c.timetableHeading, vars))}</h2>
  <div class="table-wrap">
    <table class="timetable">
      <caption>${esc(fill(c.tableCaption, vars))}</caption>
      <thead><tr><th scope="col">${esc(c.day)}</th>${PRAYERS.map(p => `<th scope="col">${esc(t.prayers[p])}</th>`).join('')}</tr></thead>
      <tbody>
${rows}      </tbody>
    </table>
  </div>

  <h2>${esc(c.howHeading)}</h2>
  <p>${esc(fill(c.howBody, vars))} ${esc(angleSentence)}</p>
  <div class="callout"><p>${esc(c.callout)}</p></div>

  <section class="city-cta">
    <h2>${esc(c.ctaHeading)}</h2>
    <p>${esc(c.ctaBody)}</p>
    ${storeBadges(lang)}
  </section>

  ${langSwitcher(lang, city.slug)}

  <p style="margin-top:28px"><a href="${indexHref(lang)}">← ${esc(c.allCities)}</a></p>
</main>
${footer(lang)}
<script src="${u}assets/prayer-times.js"></script>
<script src="${u}prayer-times/live-times.js"></script>
</body>
</html>
`;
}

/* ---- the index ------------------------------------------------------ */

function indexPage(today, lang) {
  const t = I18N[lang];
  const x = t.index;
  const u = up(lang);

  const byCountry = new Map();
  for (const c of cities) {
    const label = countryName(c, lang);
    if (!byCountry.has(label)) byCountry.set(label, []);
    byCountry.get(label).push(c);
  }
  const countries = [...byCountry.keys()].sort((a, b) => a.localeCompare(b, t.locale));
  const vars = {
    cities: num(lang, cities.length), countries: num(lang, countries.length),
    month: monthName(lang, today.y, today.m), year: today.y
  };

  const title = fill(x.title, vars);
  const description = fill(x.description, vars);

  const list = countries.map(country => {
    const items = byCountry.get(country).slice()
      .map(c => ({ city: c, label: cityName(c, lang) }))
      .sort((a, b) => a.label.localeCompare(b.label, t.locale))
      .map(({ city, label }) => {
        // Keep the Latin name searchable too: someone on the Arabic index may
        // still type "Cairo", and the slug is the one spelling every reader
        // shares.
        const alias = label === city.name ? '' : ` data-alias="${esc(city.name)}"`;
        return `<li${alias}><a href="${city.slug}.html">${esc(label)}</a></li>`;
      })
      .join('\n        ');
    return `    <section class="country">
      <h3>${esc(country)}</h3>
      <ul>
        ${items}
      </ul>
    </section>`;
  }).join('\n');

  const intro = fill(x.intro, {
    link: `<a href="${u}index.html#download">${esc(x.introLink)}</a>`
  });
  const callout = fill(x.callout, {
    link: `<a href="${u}support.html">${esc(x.calloutLink)}</a>`
  });

  const jsonld = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: x.h1, description, inLanguage: lang,
    url: ORIGIN + indexHref(lang),
    isPartOf: { '@type': 'WebSite', url: ORIGIN + '/' }
  };

  return head({ lang, slug: null, title, description, pathname: indexHref(lang), jsonld }) + `
<main class="doc city-index">
  <nav class="crumbs" aria-label="Breadcrumb">
    <a href="${u}index.html">Sirāj</a> › <span>${esc(t.nav.prayerTimes)}</span>
  </nav>

  <h1>${esc(x.h1)}</h1>
  <p class="updated">${esc(fill(x.meta, vars))}</p>

  <p>${intro}</p>

  ${langSwitcher(lang, null)}

  <div class="city-filter">
    <label for="city-search" class="sr-only">${esc(x.searchLabel)}</label>
    <input type="search" id="city-search" placeholder="${esc(x.searchPlaceholder)}" autocomplete="off">
    <p id="filter-empty" hidden>${esc(x.noMatch)} <a href="${u}support.html">${esc(x.noMatchLink)}</a></p>
  </div>

  <div class="country-grid">
${list}
  </div>

  <div class="callout" style="margin-top:32px"><p>${callout}</p></div>
</main>
${footer(lang)}
<script src="${u}prayer-times/filter.js" defer></script>
</body>
</html>
`;
}

/* ---- drive ---------------------------------------------------------- */

function build() {
  // "Today" in Makkah — one reference day for the whole build, so a run that
  // straddles midnight cannot emit pages dated inconsistently.
  const today = PT.localDate('Asia/Riyadh', new Date());
  const files = new Map();
  for (const lang of LANGS) {
    for (const c of cities) files.set(outPath(lang, c.slug + '.html'), cityPage(c, today, lang));
    files.set(outPath(lang, 'index.html'), indexPage(today, lang));
  }
  return files;
}

function htmlUnder(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(n => n.endsWith('.html'));
}

function main() {
  const check = process.argv.includes('--check');
  for (const lang of LANGS) {
    fs.mkdirSync(lang === DEFAULT_LANG ? OUT : path.join(OUT, lang), { recursive: true });
  }
  const files = build();

  if (check) {
    // Deliberately a file-set check, not a content diff: every page embeds
    // the date it was built, so a content comparison would report drift
    // every single day and quickly be ignored. What can actually go wrong
    // and stay hidden is a dataset or language edit that was never
    // regenerated, and that shows up as a missing or orphaned file.
    let problems = 0;
    for (const lang of LANGS) {
      const dir = lang === DEFAULT_LANG ? OUT : path.join(OUT, lang);
      const expected = new Set(cities.map(c => c.slug + '.html').concat('index.html'));
      const actual = new Set(htmlUnder(dir));
      for (const n of expected) if (!actual.has(n)) { console.error(`  ${lang}: missing ${n}`); problems++; }
      for (const n of actual) if (!expected.has(n)) { console.error(`  ${lang}: orphaned ${n}`); problems++; }
    }
    // A language folder left behind after a language is dropped from i18n.json.
    for (const entry of fs.readdirSync(OUT, { withFileTypes: true })) {
      if (entry.isDirectory() && !LANGS.includes(entry.name)) {
        console.error(`  orphaned language directory: ${entry.name}`); problems++;
      }
    }
    if (problems) { console.error('\nRun: node tools/gen-cities.js'); process.exit(1); }
    console.log(`ok — ${cities.length} cities × ${LANGS.length} languages = ${cities.length * LANGS.length} pages, plus ${LANGS.length} indexes, none orphaned`);
    return;
  }

  // Drop pages for cities removed from the dataset, and whole language
  // directories for languages removed from i18n.json.
  for (const entry of fs.readdirSync(OUT, { withFileTypes: true })) {
    if (entry.isDirectory() && !LANGS.includes(entry.name)) {
      fs.rmSync(path.join(OUT, entry.name), { recursive: true, force: true });
      console.log('removed language directory ' + entry.name);
    }
  }
  const keep = new Set([...files.keys()]);
  for (const lang of LANGS) {
    const dir = lang === DEFAULT_LANG ? OUT : path.join(OUT, lang);
    for (const name of htmlUnder(dir)) {
      const full = path.join(dir, name);
      if (!keep.has(full)) { fs.unlinkSync(full); console.log('removed ' + path.relative(ROOT, full)); }
    }
  }
  for (const [f, content] of files) fs.writeFileSync(f, content, 'utf8');
  console.log(`wrote ${cities.length} cities × ${LANGS.length} languages (${cities.length * LANGS.length} pages) + ${LANGS.length} indexes`);
}

main();
