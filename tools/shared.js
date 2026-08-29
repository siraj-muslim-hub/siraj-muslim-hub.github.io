/* Sirāj — helpers shared by every page generator.
 *
 * gen-cities.js and gen-ramadan.js both emit the same site chrome: the nav,
 * the footer, the hreflang cluster, the language switcher, the store badges.
 * That belongs in one place — two copies would drift, and a nav that differs
 * between two sections of the same site is the kind of bug nobody reports.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
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

/* Escapes the apostrophe too. Several data-* attributes carry JSON in
 * single quotes, and Turkish is full of apostrophes ("Ramazan'a {days} gün")
 * — an unescaped one closes the attribute early and the JSON silently fails
 * to parse. Cheap to escape everywhere; expensive to debug once shipped. */
function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/* Substitute {placeholders}. Throws on an unfilled one rather than shipping a
 * literal "{city}" to a reader — a missing key should break the build. */
function fill(template, values) {
  return String(template).replace(/\{(\w+)\}/g, (whole, key) => {
    if (!(key in values)) throw new Error(`unfilled placeholder {${key}} in: ${template}`);
    return values[key];
  });
}

/* ---- names, numbers, dates ------------------------------------------ */

function cityName(city, lang) {
  const entry = CITY_NAMES[city.slug];
  return (entry && entry[lang]) || city.name;
}

/* After a locative preposition. Only French needs work: "à" contracts with a
 * masculine article, so Le Caire becomes "au Caire" while La Mecque stays
 * "à La Mecque". Other languages keep the preposition in the template. */
function cityNameIn(city, lang) {
  const name = cityName(city, lang);
  if (lang !== 'fr') return name;
  if (/^Le /.test(name)) return 'au ' + name.slice(3);
  if (/^Les /.test(name)) return 'aux ' + name.slice(4);
  return 'à ' + name;
}

const REGION_NAMES = Object.fromEntries(LANGS.map(l =>
  [l, new Intl.DisplayNames([I18N[l].locale], { type: 'region', fallback: 'none' })]));

function countryName(city, lang) {
  try { return REGION_NAMES[lang].of(city.cc) || city.country; }
  catch (e) { return city.country; }
}

/* Digits are forced to Latin everywhere so a time reads the same in every
 * locale, and matches what the app shows. */
function loc(lang) { return I18N[lang].locale + '-u-nu-latn'; }
function num(lang, value) { return new Intl.NumberFormat(loc(lang)).format(value); }
function monthName(lang, y, m) {
  return new Intl.DateTimeFormat(loc(lang), { month: 'long', timeZone: 'UTC' })
    .format(new Date(Date.UTC(y, m - 1, 15)));
}
function longDate(lang, ymd) {
  return new Intl.DateTimeFormat(loc(lang), { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' })
    .format(new Date(Date.UTC(ymd.y, ymd.m - 1, ymd.d)));
}
function shortDate(lang, utcMillis) {
  return new Intl.DateTimeFormat(loc(lang), { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })
    .format(new Date(utcMillis));
}
/* "15h 12m" in English, "15 س 12 د" in Arabic — unit labels from ICU. */
function duration(lang, minutes) {
  const h = Math.floor(minutes / 60), m = minutes % 60;
  const unit = (v, u) => new Intl.NumberFormat(loc(lang),
    { style: 'unit', unit: u, unitDisplay: 'narrow' }).format(v);
  return (h ? unit(h, 'hour') + ' ' : '') + unit(m, 'minute');
}

/* ---- cross-section links -------------------------------------------- */

function prayerHref(lang, slug) {
  const base = lang === DEFAULT_LANG ? '/prayer-times/' : `/prayer-times/${lang}/`;
  return slug ? `${base}${slug}.html` : base;
}
function ramadanHref(lang, slug) {
  const base = lang === DEFAULT_LANG ? '/ramadan/' : `/ramadan/${lang}/`;
  return slug ? `${base}${slug}.html` : base;
}

/* ---- chrome ---------------------------------------------------------- */

function nav(lang, u) {
  const t = I18N[lang];
  return `<nav class="site-nav">
  <a href="${u}index.html" class="logo" aria-label="Sirāj">
    <img src="${u}assets/logo-mark.svg" alt="" width="34" height="34">
    <span class="wordmark">Sirāj<span class="ar"> سِراج</span></span>
  </a>
  <div class="nav-links">
    <a href="${prayerHref(lang, null)}">${esc(t.nav.prayerTimes)}</a>
    <a href="${ramadanHref(lang, null)}">${esc(t.ramadan.nav)}</a>
    <a href="${u}support.html">${esc(t.nav.support)}</a>
    <a href="${u}index.html#download" class="cta">${esc(t.nav.getApp)}</a>
  </div>
</nav>`;
}

function footer(lang, u) {
  const t = I18N[lang];
  return `<footer class="site-footer">
  <p class="legal">© <span id="year">2026</span> Sirāj. <a href="${u}privacy.html">${esc(t.footer.privacy)}</a> · <a href="${u}terms.html">${esc(t.footer.terms)}</a> · <a href="${u}support.html">${esc(t.footer.support)}</a></p>
</footer>
<script>document.getElementById('year').textContent = new Date().getFullYear();</script>
<script src="${u}analytics.js" defer></script>`;
}

/* A plain list of links — no JS, crawlable, and the human-visible counterpart
 * of the hreflang cluster. `hrefFor(lang)` returns the path for one language. */
function langSwitcher(lang, hrefFor, sectionLabel) {
  const t = I18N[lang];
  const links = LANGS.map(code => {
    const label = esc(I18N[code].name);
    return code === lang
      ? `<span class="lang-current" aria-current="true" lang="${code}">${label}</span>`
      : `<a href="${hrefFor(code)}" lang="${code}" hreflang="${code}">${label}</a>`;
  }).join('\n    ');
  return `<nav class="lang-switcher" aria-label="${esc(t.lang.switcher)}">
    <span class="lang-label">${esc(sectionLabel || t.lang.label)}</span>
    ${links}
  </nav>`;
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

/* `alternates(lang)` returns this page's path in another language. */
function head(opts) {
  const { lang, up: u, alternates } = opts;
  const alts = LANGS.map(code =>
    `<link rel="alternate" hreflang="${code}" href="${ORIGIN}${alternates(code)}">`).join('\n');

  return `<!doctype html>
<html lang="${lang}" dir="${I18N[lang].dir}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(opts.title)}</title>
<meta name="description" content="${esc(opts.description)}">
<link rel="canonical" href="${ORIGIN}${opts.pathname}">
${alts}
<link rel="alternate" hreflang="x-default" href="${ORIGIN}${alternates(DEFAULT_LANG)}">
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
`;
}

module.exports = {
  LANGS, DEFAULT_LANG, ORIGIN, I18N, APP_STORE, PLAY_STORE,
  esc, fill, cityName, cityNameIn, countryName,
  num, monthName, longDate, shortDate, duration,
  prayerHref, ramadanHref, nav, footer, langSwitcher, storeBadges, head
};
