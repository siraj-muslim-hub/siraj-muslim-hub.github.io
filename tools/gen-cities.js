#!/usr/bin/env node
/* Sirāj — build the /prayer-times/ landing pages.
 *
 *   node tools/gen-cities.js            # write pages + index + sitemap
 *   node tools/gen-cities.js --check    # every city in the dataset has a page,
 *                                       # and no page outlives its city
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
 */
'use strict';

const fs = require('fs');
const path = require('path');
const PT = require('../assets/prayer-times.js');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'prayer-times');
const { cities } = require('./cities.json');

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
const LABELS = { fajr: 'Fajr', sunrise: 'Sunrise', dhuhr: 'Dhuhr', asr: 'ʿAsr', maghrib: 'Maghrib', isha: 'ʿIshāʾ' };
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
                'July', 'August', 'September', 'October', 'November', 'December'];

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

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

const NAV = `<nav class="site-nav">
  <a href="../index.html" class="logo" aria-label="Sirāj home">
    <img src="../assets/logo-mark.svg" alt="" width="34" height="34">
    <span class="wordmark">Sirāj<span class="ar"> سِراج</span></span>
  </a>
  <div class="nav-links">
    <a href="../index.html#features">Features</a>
    <a href="index.html">Prayer times</a>
    <a href="../support.html">Support</a>
    <a href="../index.html#download" class="cta">Get Sirāj</a>
  </div>
</nav>`;

const FOOTER = `<footer class="site-footer">
  <p class="legal">© <span id="year">2026</span> Sirāj. <a href="../privacy.html">Privacy</a> · <a href="../terms.html">Terms</a> · <a href="../support.html">Support</a></p>
</footer>
<script>document.getElementById('year').textContent = new Date().getFullYear();</script>
<script src="../analytics.js" defer></script>`;

function head(opts) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(opts.title)}</title>
<meta name="description" content="${esc(opts.description)}">
<link rel="canonical" href="${ORIGIN}${opts.pathname}">
<meta name="robots" content="index, follow, max-image-preview:large">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Sirāj">
<meta property="og:title" content="${esc(opts.title)}">
<meta property="og:description" content="${esc(opts.description)}">
<meta property="og:url" content="${ORIGIN}${opts.pathname}">
<meta property="og:image" content="${ORIGIN}/assets/banners/siraj-og-1200x630.png">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${ORIGIN}/assets/banners/siraj-og-1200x630.png">
<meta name="theme-color" content="#06120D">
<link rel="icon" type="image/png" sizes="256x256" href="../assets/app-icon-256.png">
<link rel="apple-touch-icon" href="../assets/app-icon-256.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700;800&family=Noto+Naskh+Arabic:wght@500;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="../styles.css">
${opts.jsonld ? '<script type="application/ld+json">\n' + JSON.stringify(opts.jsonld, null, 2) + '\n</script>' : ''}
</head>
<body>
${NAV}`;
}

/* ---- one city page ------------------------------------------------- */

function cityPage(city, today) {
  const { times, offset } = timesFor(city, today);
  const bearing = PT.qiblaBearing(city.lat, city.lng);
  const distance = PT.distanceToMakkah(city.lat, city.lng);
  const method = PT.METHODS[city.method];
  const where = `${city.name}, ${city.country}`;
  const madhhab = city.asr === 2 ? 'Ḥanafī' : 'Shāfiʿī / Mālikī / Ḥanbalī';

  const title = `Prayer Times in ${city.name} — Today's Salah Times & Qibla · Sirāj`;
  const description = `Today's prayer times for ${where}: Fajr ${PT.formatTime(times.fajr, true)}, Dhuhr ${PT.formatTime(times.dhuhr, true)}, ʿAsr ${PT.formatTime(times.asr, true)}, Maghrib ${PT.formatTime(times.maghrib, true)}, ʿIshāʾ ${PT.formatTime(times.isha, true)}. Qibla ${bearing.toFixed(1)}° from north. Calculated with ${method.name}.`;

  // A month of times, baked so the page has real content without JS.
  const dim = daysInMonth(today.y, today.m);
  let rows = '';
  for (let d = 1; d <= dim; d++) {
    const day = { y: today.y, m: today.m, d };
    const t = timesFor(city, day).times;
    const isToday = d === today.d;
    rows += `<tr${isToday ? ' class="is-today"' : ''}><th scope="row">${d}</th>` +
      PRAYERS.map(p => `<td>${PT.formatTime(t[p], false)}</td>`).join('') + '</tr>\n';
  }

  const jsonld = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Sirāj', item: ORIGIN + '/' },
          { '@type': 'ListItem', position: 2, name: 'Prayer times', item: ORIGIN + '/prayer-times/' },
          { '@type': 'ListItem', position: 3, name: `${city.name} prayer times` }
        ]
      },
      {
        '@type': 'Place',
        name: where,
        geo: { '@type': 'GeoCoordinates', latitude: city.lat, longitude: city.lng }
      },
      {
        '@type': 'FAQPage',
        mainEntity: [
          {
            '@type': 'Question',
            name: `What time is Fajr in ${city.name} today?`,
            acceptedAnswer: { '@type': 'Answer', text: `Fajr in ${where} is at ${PT.formatTime(times.fajr, true)} local time today, calculated with the ${method.name} convention. Sunrise, which ends the time for Fajr, is at ${PT.formatTime(times.sunrise, true)}.` }
          },
          {
            '@type': 'Question',
            name: `Which direction is the Qibla from ${city.name}?`,
            acceptedAnswer: { '@type': 'Answer', text: `From ${where} the Qibla is ${bearing.toFixed(1)}° clockwise from true north (${PT.compassPoint(bearing)}). The Kaaba is about ${distance.toLocaleString('en-US')} km away.` }
          },
          {
            '@type': 'Question',
            name: `Which calculation method is used for ${city.name}?`,
            acceptedAnswer: { '@type': 'Answer', text: `These times use ${method.name}, the convention most widely followed in ${city.country}, with the ${madhhab} ʿAsr. Sirāj lets you change both.` }
          }
        ]
      }
    ]
  };

  return head({ title, description, pathname: `/prayer-times/${city.slug}.html`, jsonld }) + `
<main class="doc city">
  <nav class="crumbs" aria-label="Breadcrumb">
    <a href="../index.html">Sirāj</a> › <a href="index.html">Prayer times</a> › <span>${esc(city.name)}</span>
  </nav>

  <h1>Prayer times in ${esc(city.name)}</h1>
  <p class="updated">${esc(city.country)} · ${city.lat.toFixed(4)}°, ${city.lng.toFixed(4)}° · ${esc(offsetLabel(offset))} · ${esc(method.name)}</p>

  <div class="today" data-city='${esc(JSON.stringify({ lat: city.lat, lng: city.lng, tz: city.tz, method: city.method, asr: city.asr }))}'>
    <div class="today-head">
      <h2>Today <span class="dim" id="today-date">${MONTHS[today.m - 1]} ${today.d}, ${today.y}</span></h2>
      <span class="next-pill" id="next-prayer" hidden></span>
    </div>
    <div class="times">
      ${PRAYERS.map(p => `<div class="time${p === 'sunrise' ? ' muted' : ''}" data-prayer="${p}">
        <span class="lbl">${LABELS[p]}</span>
        <span class="val">${PT.formatTime(times[p], true)}</span>
      </div>`).join('\n      ')}
    </div>
    <p class="recalc" id="recalc-note">Showing the times generated for ${MONTHS[today.m - 1]} ${today.d}. Enable JavaScript to see today's.</p>
  </div>

  <h2>Qibla from ${esc(city.name)}</h2>
  <div class="facts">
    <div class="fact"><span class="k">Direction</span><span class="v">${bearing.toFixed(1)}°</span><span class="s">clockwise from true north</span></div>
    <div class="fact"><span class="k">Compass point</span><span class="v">${PT.compassPoint(bearing)}</span><span class="s">approximate heading</span></div>
    <div class="fact"><span class="k">Distance to Makkah</span><span class="v">${distance.toLocaleString('en-US')} km</span><span class="s">great-circle</span></div>
  </div>
  <p>A magnetic compass points to magnetic north, not true north, and the difference varies by location and drifts year to year. Sirāj's Qibla compass corrects for it automatically using your device's sensors.</p>

  <h2>${MONTHS[today.m - 1]} ${today.y} timetable</h2>
  <div class="table-wrap">
    <table class="timetable">
      <caption>Prayer times for ${esc(where)} — ${MONTHS[today.m - 1]} ${today.y}, local time (24-hour)</caption>
      <thead><tr><th scope="col">Day</th>${PRAYERS.map(p => `<th scope="col">${LABELS[p]}</th>`).join('')}</tr></thead>
      <tbody>
${rows}      </tbody>
    </table>
  </div>

  <h2>How these times are calculated</h2>
  <p>Times are computed from the sun's position at ${city.lat.toFixed(4)}°, ${city.lng.toFixed(4)}° using <strong>${esc(method.name)}</strong>${typeof method.fajr === 'number' ? `, which places Fajr at ${method.fajr}° below the horizon` : ''}${typeof method.isha === 'number' ? ` and ʿIshāʾ at ${method.isha}°` : ` and ʿIshāʾ ${method.isha.minutes} minutes after Maghrib`}. ʿAsr uses the <strong>${madhhab}</strong> shadow length. Daylight saving is applied automatically from the ${esc(city.tz)} timezone.</p>
  <div class="callout">
    <p>Conventions differ, and a mosque near you may publish times a few minutes either side of these — follow your local masjid where they differ. In the app you can choose the method, the ʿAsr madhhab, and per-prayer manual adjustments so the times match your community exactly.</p>
  </div>

  <section class="city-cta">
    <h2>Get these times on your phone</h2>
    <p>Sirāj computes prayer times on your device — no account, no ads, and it works offline. Adhān notifications, a Qibla compass, the Qur'an with recitation, Ḥadīth, Duʿāʾ &amp; Adhkār, the 99 Names, a Hijri calendar and tasbīḥ.</p>
    <div class="badges">
      <a class="badge" href="${APP_STORE}" target="_blank" rel="noopener" aria-label="Download Sirāj on the App Store">
        <svg viewBox="0 0 24 24"><path d="M16.5 2c.1 1.2-.4 2.4-1.1 3.3-.8.9-2 1.6-3.1 1.5-.1-1.2.4-2.4 1.1-3.2C14.2 2.7 15.4 2.1 16.5 2zm3.4 16.1c-.5 1.2-.8 1.8-1.5 2.9-1 1.5-2.4 3.4-4.1 3.4-1.5 0-1.9-1-4-1-2 0-2.5 1-4 1-1.7 0-3-1.7-4-3.2-2.8-4.3-3.1-9.4-1.4-12.1 1.2-1.9 3.1-3 4.9-3 1.8 0 3 1 4.5 1 1.5 0 2.3-1 4.5-1 1.6 0 3.3.9 4.5 2.4-4 2.2-3.3 7.9.1 9.6z"/></svg>
        <span class="t"><small>Download on the</small><b>App Store</b></span>
      </a>
      <a class="badge" href="${PLAY_STORE}" target="_blank" rel="noopener" aria-label="Get Sirāj on Google Play">
        <svg viewBox="0 0 24 24"><path d="M3.6 2.3c-.3.3-.5.7-.5 1.3v16.8c0 .6.2 1 .5 1.3l.1.1L13 12.1v-.2L3.7 2.2zM16.4 15.5l-3.1-3.1v-.2l3.1-3.1 3.6 2c1 .6 1 1.6 0 2.2zM15.8 8.4 12.4 12l-9-9c.4-.2.9-.1 1.5.2zM4 21.5l8.4-8.4 3.4 3.4-9.7 5.5c-.7.4-1.4.3-1.9-.1z"/></svg>
        <span class="t"><small>Get it on</small><b>Google Play</b></span>
      </a>
    </div>
  </section>

  <p style="margin-top:36px"><a href="index.html">← All cities</a></p>
</main>
${FOOTER}
<script src="../assets/prayer-times.js"></script>
<script src="live-times.js"></script>
</body>
</html>
`;
}

/* ---- the index ------------------------------------------------------ */

function indexPage(today) {
  const byCountry = new Map();
  for (const c of cities) {
    if (!byCountry.has(c.country)) byCountry.set(c.country, []);
    byCountry.get(c.country).push(c);
  }
  const countries = [...byCountry.keys()].sort((a, b) => a.localeCompare(b));

  const title = 'Prayer Times by City — Salah Times & Qibla Direction · Sirāj';
  const description = `Accurate prayer times and Qibla direction for ${cities.length} cities across ${countries.length} countries, calculated with the convention followed locally. Free, no ads.`;

  const list = countries.map(country => {
    const items = byCountry.get(country)
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(c => `<li><a href="${c.slug}.html">${esc(c.name)}</a></li>`)
      .join('\n        ');
    return `    <section class="country">
      <h3>${esc(country)}</h3>
      <ul>
        ${items}
      </ul>
    </section>`;
  }).join('\n');

  const jsonld = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Prayer times by city',
    description,
    url: ORIGIN + '/prayer-times/',
    isPartOf: { '@type': 'WebSite', url: ORIGIN + '/' }
  };

  return head({ title, description, pathname: '/prayer-times/', jsonld }) + `
<main class="doc city-index">
  <nav class="crumbs" aria-label="Breadcrumb">
    <a href="../index.html">Sirāj</a> › <span>Prayer times</span>
  </nav>

  <h1>Prayer times by city</h1>
  <p class="updated">${cities.length} cities · ${countries.length} countries · updated ${MONTHS[today.m - 1]} ${today.y}</p>

  <p>Each page gives today's ṣalāh times, the Qibla bearing from that city, and a full month's timetable — calculated with the convention most widely followed there. For times that follow you wherever you are, and adhān notifications at each waqt, <a href="../index.html#download">get Sirāj</a>.</p>

  <div class="city-filter">
    <label for="city-search" class="sr-only">Search cities</label>
    <input type="search" id="city-search" placeholder="Search for a city or country…" autocomplete="off">
    <p id="filter-empty" hidden>No city matches that. <a href="../support.html">Ask us to add it →</a></p>
  </div>

  <div class="country-grid">
${list}
  </div>

  <div class="callout" style="margin-top:32px">
    <p>Don't see your city? Sirāj computes times for <em>any</em> location on device, from GPS or a city you set by hand — these pages are just the most-searched ones. <a href="../support.html">Tell us which to add.</a></p>
  </div>
</main>
${FOOTER}
<script src="filter.js" defer></script>
</body>
</html>
`;
}

/* ---- sitemap -------------------------------------------------------- */

function sitemap(today) {
  const stamp = `${today.y}-${String(today.m).padStart(2, '0')}-${String(today.d).padStart(2, '0')}`;
  const core = [
    ['/', 'weekly', '1.0'],
    ['/prayer-times/', 'weekly', '0.9'],
    ['/support.html', 'monthly', '0.6'],
    ['/privacy.html', 'monthly', '0.5'],
    ['/terms.html', 'monthly', '0.5']
  ].map(([p, f, pr]) =>
    `  <url><loc>${ORIGIN}${p}</loc><changefreq>${f}</changefreq><priority>${pr}</priority></url>`);

  const city = cities.map(c =>
    `  <url><loc>${ORIGIN}/prayer-times/${c.slug}.html</loc><lastmod>${stamp}</lastmod><changefreq>daily</changefreq><priority>0.7</priority></url>`);

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${core.join('\n')}
${city.join('\n')}
</urlset>
`;
}

/* ---- drive ---------------------------------------------------------- */

function build() {
  // "Today" in Makkah — one reference day for the whole build, so a run that
  // straddles midnight cannot emit pages dated inconsistently.
  const today = PT.localDate('Asia/Riyadh', new Date());
  const files = new Map();
  for (const c of cities) files.set(path.join(OUT, c.slug + '.html'), cityPage(c, today));
  files.set(path.join(OUT, 'index.html'), indexPage(today));
  files.set(path.join(ROOT, 'sitemap.xml'), sitemap(today));
  return files;
}

function main() {
  const check = process.argv.includes('--check');
  fs.mkdirSync(OUT, { recursive: true });
  const files = build();

  if (check) {
    // Deliberately a file-set check, not a content diff: every page embeds
    // the date it was built, so a content comparison would report drift
    // every single day and quickly be ignored. What can actually go wrong
    // and stay hidden is a dataset edit that was never regenerated, and
    // that shows up as a missing or orphaned file.
    const expected = new Set([...files.keys()].map(f => path.basename(f))
      .filter(n => n.endsWith('.html')));
    const actual = new Set(fs.readdirSync(OUT).filter(n => n.endsWith('.html')));
    const missing = [...expected].filter(n => !actual.has(n));
    const orphaned = [...actual].filter(n => !expected.has(n));
    if (missing.length || orphaned.length) {
      missing.forEach(n => console.error('  missing page for city: ' + n));
      orphaned.forEach(n => console.error('  page with no city in dataset: ' + n));
      console.error('\nRun: node tools/gen-cities.js');
      process.exit(1);
    }
    console.log(`ok — ${cities.length} cities, ${expected.size} pages (incl. index), none orphaned`);
    return;
  }

  // Drop pages for cities removed from the dataset.
  const keep = new Set([...files.keys()].map(f => path.basename(f)));
  for (const name of fs.readdirSync(OUT)) {
    if (name.endsWith('.html') && !keep.has(name)) {
      fs.unlinkSync(path.join(OUT, name));
      console.log('removed ' + name);
    }
  }
  for (const [f, content] of files) fs.writeFileSync(f, content, 'utf8');
  console.log(`wrote ${cities.length} city pages + index + sitemap → ${ORIGIN}/prayer-times/`);
}

main();
