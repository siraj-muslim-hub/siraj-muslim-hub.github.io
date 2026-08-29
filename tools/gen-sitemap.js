#!/usr/bin/env node
/* Sirāj — build sitemap.xml across every generated section.
 *
 * Lives on its own rather than inside one generator, because the sitemap is
 * the one file that has to know about all of them at once. A section whose
 * URLs are missing here is a section Google will find slowly or not at all.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const shared = require('./shared.js');

const ROOT = path.join(__dirname, '..');
const { cities } = require('./cities.json');
const { LANGS, DEFAULT_LANG, ORIGIN, prayerHref, ramadanHref } = shared;

const NS = 'xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" ' +
           'xmlns:xhtml="http://www.w3.org/1999/xhtml"';

/* The alternate cluster for one logical page, repeated inside every <url>
 * that belongs to it — hreflang has to be reciprocal or Google ignores it. */
function alternates(hrefFor) {
  return LANGS.map(code =>
    `    <xhtml:link rel="alternate" hreflang="${code}" href="${ORIGIN}${hrefFor(code)}"/>`
  ).join('\n') +
  `\n    <xhtml:link rel="alternate" hreflang="x-default" href="${ORIGIN}${hrefFor(DEFAULT_LANG)}"/>`;
}

function url(loc, hrefFor, opts) {
  const extra = opts.lastmod ? `\n    <lastmod>${opts.lastmod}</lastmod>` : '';
  return `  <url>\n    <loc>${ORIGIN}${loc}</loc>\n${alternates(hrefFor)}${extra}` +
         `\n    <changefreq>${opts.freq}</changefreq>\n    <priority>${opts.priority}</priority>\n  </url>`;
}

function build() {
  const now = new Date();
  const stamp = now.toISOString().slice(0, 10);

  // The four hand-written pages, localised under a language prefix.
  const PAGES = [['index.html', 'weekly', '1.0'], ['support.html', 'monthly', '0.6'],
                 ['privacy.html', 'monthly', '0.5'], ['terms.html', 'monthly', '0.5']];
  const core = [];
  for (const [file, freq, priority] of PAGES) {
    const hrefFor = code => code === DEFAULT_LANG ? `/${file}` : `/${code}/${file}`;
    for (const code of LANGS) core.push(url(hrefFor(code), hrefFor, { freq, priority }));
  }

  const sections = [];
  for (const code of LANGS) {
    sections.push(url(prayerHref(code, null), c => prayerHref(c, null), { freq: 'weekly', priority: '0.9' }));
    sections.push(url(ramadanHref(code, null), c => ramadanHref(c, null), { freq: 'weekly', priority: '0.9' }));
  }

  const pages = [];
  for (const city of cities) {
    for (const code of LANGS) {
      // Prayer pages carry a lastmod because they are rebuilt monthly; the
      // Ramadan tables are fixed for the year, so they do not.
      pages.push(url(prayerHref(code, city.slug), c => prayerHref(c, city.slug),
        { freq: 'daily', priority: '0.7', lastmod: stamp }));
      pages.push(url(ramadanHref(code, city.slug), c => ramadanHref(c, city.slug),
        { freq: 'monthly', priority: '0.8' }));
    }
  }

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset ${NS}>\n` +
         [...core, ...sections, ...pages].join('\n') + '\n</urlset>\n';
}

const xml = build();
fs.writeFileSync(path.join(ROOT, 'sitemap.xml'), xml, 'utf8');
console.log(`wrote sitemap.xml — ${(xml.match(/<url>/g) || []).length} urls`);
