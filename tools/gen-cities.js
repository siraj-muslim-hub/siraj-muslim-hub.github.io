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

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'prayer-times');
const { cities } = require('./cities.json');
const I18N = require('./i18n.json');
const CITY_NAMES = require('./city-names.json');

const LANGS = Object.keys(I18N).filter(k => !k.startsWith('_'));
const DEFAULT_LANG = 'en';

/* The canonical host, read from the site itself so tools/set-domain.py stays
 * the single place a domain change happens. */
const ORIGIN = (function () {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const m = html.match(/<link rel="canonical" href="https:\/\/([^/"]+)/);
  if (!m) throw new Error('cannot find canonical host in index.html');
  return 'https://' + m[1];
})();

const APP_STORE = 'https://apps.apple.com/app/id6780613457';
const PLAY_STORE = 'https://play.google.com/store/apps/details?id=com.novasoft.siraj';
const PRAYERS = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'];

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/* Substitute {placeholders}. Throws on an unfilled one rather than shipping
 * a literal "{city}" to a reader — a missing translation key should break
 * the build, not the page. */
function fill(template, values) {
  return String(template).replace(/\{(\w+)\}/g, (whole, key) => {
    if (!(key in values)) throw new Error(`unfilled placeholder {${key}} in: ${template}`);
    return values[key];
  });
}

function daysInMonth(y, m) { return new Date(Date.UTC(y, m, 0)).getUTCDate(); }

/* Month names and number grouping come from ICU, per language — no table of
 * translated month names to drift out of step. Digits are forced to Latin so
 * a time reads the same in every locale (and matches the app). */
function monthName(lang, y, m) {
  return new Intl.DateTimeFormat(I18N[lang].locale + '-u-nu-latn',
    { month: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, 15)));
}
function longDate(lang, y, m, d) {
  return new Intl.DateTimeFormat(I18N[lang].locale + '-u-nu-latn',
    { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' })
    .format(new Date(Date.UTC(y, m - 1, d)));
}
function num(lang, value) {
  return new Intl.NumberFormat(I18N[lang].locale + '-u-nu-latn').format(value);
}

/* The city's name in a given language, falling back to the default Latin
 * form when no localised name is recorded — 'Paris' needs no French row. */
function cityName(city, lang) {
  const entry = CITY_NAMES[city.slug];
  return (entry && entry[lang]) || city.name;
}

/* The city name as it appears after a locative preposition. Only French
 * needs work: "à" contracts with a masculine article, so Le Caire becomes
 * "au Caire" while La Mecque stays "à La Mecque". Every other language
 * keeps its preposition inside the template and just takes the name. */
function cityNameIn(city, lang) {
  const name = cityName(city, lang);
  if (lang !== 'fr') return name;
  if (/^Le /.test(name)) return 'au ' + name.slice(3);
  if (/^Les /.test(name)) return 'aux ' + name.slice(4);
  return 'à ' + name;
}

/* Country names come from ICU via the ISO code on each city, so there is no
 * table of 63 countries × 7 languages to maintain or let drift. Falls back to
 * the dataset's English name if a code has no localised form. */
const REGION_NAMES = Object.fromEntries(LANGS.map(l =>
  [l, new Intl.DisplayNames([I18N[l].locale], { type: 'region', fallback: 'none' })]));

function countryName(city, lang) {
  try { return REGION_NAMES[lang].of(city.cc) || city.country; }
  catch (e) { return city.country; }
}

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

/* English keeps the flat paths it was published at; others get a prefix. */
function pageHref(lang, slug) {
  return lang === DEFAULT_LANG ? `/prayer-times/${slug}.html`
                               : `/prayer-times/${lang}/${slug}.html`;
}
function indexHref(lang) {
  return lang === DEFAULT_LANG ? '/prayer-times/' : `/prayer-times/${lang}/`;
}
function outPath(lang, name) {
  return lang === DEFAULT_LANG ? path.join(OUT, name) : path.join(OUT, lang, name);
}
/* Depth from a page back to the site root. */
function up(lang) { return lang === DEFAULT_LANG ? '../' : '../../'; }

/* ---- shared chrome --------------------------------------------------- */

function nav(lang) {
  const t = I18N[lang], u = up(lang);
  return `<nav class="site-nav">
  <a href="${u}index.html" class="logo" aria-label="Sirāj">
    <img src="${u}assets/logo-mark.svg" alt="" width="34" height="34">
    <span class="wordmark">Sirāj<span class="ar"> سِراج</span></span>
  </a>
  <div class="nav-links">
    <a href="${u}index.html#features">${esc(t.nav.features)}</a>
    <a href="${indexHref(lang)}">${esc(t.nav.prayerTimes)}</a>
    <a href="${u}support.html">${esc(t.nav.support)}</a>
    <a href="${u}index.html#download" class="cta">${esc(t.nav.getApp)}</a>
  </div>
</nav>`;
}

/* A plain list of links — no JS, crawlable, and it doubles as the hreflang
 * cluster's human-visible counterpart. */
function langSwitcher(lang, slug) {
  const t = I18N[lang];
  const links = LANGS.map(code => {
    const href = slug ? pageHref(code, slug) : indexHref(code);
    const label = esc(I18N[code].name);
    return code === lang
      ? `<span class="lang-current" aria-current="true" lang="${code}">${label}</span>`
      : `<a href="${href}" lang="${code}" hreflang="${code}">${label}</a>`;
  }).join('\n    ');
  return `<nav class="lang-switcher" aria-label="${esc(t.lang.switcher)}">
    <span class="lang-label">${esc(t.lang.label)}</span>
    ${links}
  </nav>`;
}

function footer(lang) {
  const t = I18N[lang], u = up(lang);
  return `<footer class="site-footer">
  <p class="legal">© <span id="year">2026</span> Sirāj. <a href="${u}privacy.html">${esc(t.footer.privacy)}</a> · <a href="${u}terms.html">${esc(t.footer.terms)}</a> · <a href="${u}support.html">${esc(t.footer.support)}</a></p>
</footer>
<script>document.getElementById('year').textContent = new Date().getFullYear();</script>
<script src="${u}analytics.js" defer></script>`;
}

function storeBadges(lang) {
  const t = I18N[lang].store;
  return `<div class="badges">
      <a class="badge" href="${APP_STORE}" target="_blank" rel="noopener">
        <svg viewBox="0 0 24 24"><path d="M16.5 2c.1 1.2-.4 2.4-1.1 3.3-.8.9-2 1.6-3.1 1.5-.1-1.2.4-2.4 1.1-3.2C14.2 2.7 15.4 2.1 16.5 2zm3.4 16.1c-.5 1.2-.8 1.8-1.5 2.9-1 1.5-2.4 3.4-4.1 3.4-1.5 0-1.9-1-4-1-2 0-2.5 1-4 1-1.7 0-3-1.7-4-3.2-2.8-4.3-3.1-9.4-1.4-12.1 1.2-1.9 3.1-3 4.9-3 1.8 0 3 1 4.5 1 1.5 0 2.3-1 4.5-1 1.6 0 3.3.9 4.5 2.4-4 2.2-3.3 7.9.1 9.6z"/></svg>
        <span class="t"><small>${esc(t.appleSmall)}</small><b>${esc(t.appleBig)}</b></span>
      </a>
      <a class="badge" href="${PLAY_STORE}" target="_blank" rel="noopener">
        <svg viewBox="0 0 24 24"><path d="M3.6 2.3c-.3.3-.5.7-.5 1.3v16.8c0 .6.2 1 .5 1.3l.1.1L13 12.1v-.2L3.7 2.2zM16.4 15.5l-3.1-3.1v-.2l3.1-3.1 3.6 2c1 .6 1 1.6 0 2.2zM15.8 8.4 12.4 12l-9-9c.4-.2.9-.1 1.5.2zM4 21.5l8.4-8.4 3.4 3.4-9.7 5.5c-.7.4-1.4.3-1.9-.1z"/></svg>
        <span class="t"><small>${esc(t.playSmall)}</small><b>${esc(t.playBig)}</b></span>
      </a>
    </div>`;
}

function head(opts) {
  const { lang, slug } = opts;
  const dir = I18N[lang].dir;
  const u = up(lang);
  // hreflang cluster: every language, plus x-default pointing at English.
  const alts = LANGS.map(code => {
    const href = ORIGIN + (slug ? pageHref(code, slug) : indexHref(code));
    return `<link rel="alternate" hreflang="${code}" href="${href}">`;
  }).join('\n');
  const xDefault = ORIGIN + (slug ? pageHref(DEFAULT_LANG, slug) : indexHref(DEFAULT_LANG));

  return `<!doctype html>
<html lang="${lang}" dir="${dir}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(opts.title)}</title>
<meta name="description" content="${esc(opts.description)}">
<link rel="canonical" href="${ORIGIN}${opts.pathname}">
${alts}
<link rel="alternate" hreflang="x-default" href="${xDefault}">
<meta name="robots" content="index, follow, max-image-preview:large">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Sirāj">
<meta property="og:locale" content="${I18N[lang].locale.replace('-', '_')}">
<meta property="og:title" content="${esc(opts.title)}">
<meta property="og:description" content="${esc(opts.description)}">
<meta property="og:url" content="${ORIGIN}${opts.pathname}">
<meta property="og:image" content="${ORIGIN}/assets/banners/siraj-og-1200x630.png">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${ORIGIN}/assets/banners/siraj-og-1200x630.png">
<meta name="theme-color" content="#06120D">
<link rel="icon" type="image/png" sizes="256x256" href="${u}assets/app-icon-256.png">
<link rel="apple-touch-icon" href="${u}assets/app-icon-256.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700;800&family=Noto+Naskh+Arabic:wght@500;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="${u}styles.css">
${opts.jsonld ? '<script type="application/ld+json">\n' + JSON.stringify(opts.jsonld, null, 2) + '\n</script>' : ''}
</head>
<body>
${nav(lang)}`;
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
      <h2>${esc(c.today)} <span class="dim" id="today-date">${esc(longDate(lang, today.y, today.m, today.d))}</span></h2>
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

/* ---- sitemap -------------------------------------------------------- */

function sitemap(today) {
  const stamp = `${today.y}-${String(today.m).padStart(2, '0')}-${String(today.d).padStart(2, '0')}`;
  const NS = 'xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml"';

  // Alternate links for one logical page, repeated inside every <url> for it.
  const alts = slug => LANGS.map(code =>
    `    <xhtml:link rel="alternate" hreflang="${code}" href="${ORIGIN}${slug ? pageHref(code, slug) : indexHref(code)}"/>`)
    .join('\n') +
    `\n    <xhtml:link rel="alternate" hreflang="x-default" href="${ORIGIN}${slug ? pageHref(DEFAULT_LANG, slug) : indexHref(DEFAULT_LANG)}"/>`;

  const core = [
    ['/', 'weekly', '1.0'],
    ['/support.html', 'monthly', '0.6'],
    ['/privacy.html', 'monthly', '0.5'],
    ['/terms.html', 'monthly', '0.5']
  ].map(([p, f, pr]) =>
    `  <url><loc>${ORIGIN}${p}</loc><changefreq>${f}</changefreq><priority>${pr}</priority></url>`);

  const indexes = LANGS.map(code =>
    `  <url>\n    <loc>${ORIGIN}${indexHref(code)}</loc>\n${alts(null)}\n    <changefreq>weekly</changefreq>\n    <priority>0.9</priority>\n  </url>`);

  const cityUrls = [];
  for (const c of cities) {
    for (const code of LANGS) {
      cityUrls.push(`  <url>\n    <loc>${ORIGIN}${pageHref(code, c.slug)}</loc>\n${alts(c.slug)}\n    <lastmod>${stamp}</lastmod>\n    <changefreq>daily</changefreq>\n    <priority>0.7</priority>\n  </url>`);
    }
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset ${NS}>
${core.join('\n')}
${indexes.join('\n')}
${cityUrls.join('\n')}
</urlset>
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
  files.set(path.join(ROOT, 'sitemap.xml'), sitemap(today));
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
  console.log(`wrote ${cities.length} cities × ${LANGS.length} languages (${cities.length * LANGS.length} pages) + ${LANGS.length} indexes + sitemap`);
}

main();
