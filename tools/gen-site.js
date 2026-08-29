#!/usr/bin/env node
/* Sirāj — build the four hand-written pages in every language.
 *
 *   node tools/gen-site.js            # landing, support, privacy, terms × 7
 *   node tools/gen-site.js --check    # every page exists in every language
 *
 * English keeps the paths it was published at (/index.html, /privacy.html …)
 * because they are live and indexed; the other six sit under a prefix:
 *
 *   /index.html          /ar/index.html
 *   /privacy.html        /ar/privacy.html
 *
 * The brand mark and the screenshot lists are lifted out of the existing
 * English index.html at build time rather than copied into this file — they
 * are markup with no translatable text, and duplicating them here would mean
 * a second copy to update whenever a screenshot changes.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const shared = require('./shared.js');

const ROOT = path.join(__dirname, '..');
const I18N = require('./i18n.json');
const { LANGS, DEFAULT_LANG, ORIGIN, esc, fill } = shared;

/* The support address lives in one place so tools/set-domain.py can switch it
 * along with the host. Read from privacy.html, which set-domain.py rewrites
 * and this generator also emits — the regex matches either form. */
const SUPPORT_EMAIL = (function () {
  const m = fs.readFileSync(path.join(ROOT, 'privacy.html'), 'utf8').match(/mailto:([^"?]+)/);
  if (!m) throw new Error('cannot find the support address in privacy.html');
  return m[1];
})();

/* Screenshot sets, with the i18n key whose text describes each one — so the
 * alt text is translated without inventing a second set of strings. */
const PHONE_SHOTS = [
  ['01-home', 'heroEyebrow'], ['02-prayer', 'f1t'], ['03-qibla', 'f2t'],
  ['04-quran', 'f3t'], ['05-reading', 'f3t'], ['06-hadith', 'f4t'],
  ['07-names', 'f6t'], ['08-duas', 'f5t'], ['09-calendar', 'f7t'],
  ['10-themes', 'sTitle'], ['11-more', 'fTitle']
];
const TABLET_SHOTS = [
  ['01-home', 'heroEyebrow'], ['02-prayer', 'f1t'], ['03-reading', 'f3t'],
  ['04-hadith', 'f4t'], ['05-names', 'f6t'], ['06-duas', 'f5t'],
  ['07-calendar', 'f7t'], ['08-more', 'fTitle']
];

/* The inline <svg> defs block that carries the brand mark. Kept in its own
 * partial rather than read back out of index.html, which this generator
 * overwrites — a generator that reads its own output is one bad run away
 * from losing the thing it was reading. */
const SVG_DEFS = fs.readFileSync(path.join(__dirname, 'partials', 'brand-mark.html'), 'utf8').trim();

/* ---- paths ----------------------------------------------------------- */

function pageHref(lang, file) {
  return lang === DEFAULT_LANG ? `/${file}` : `/${lang}/${file}`;
}
function outPath(lang, file) {
  return lang === DEFAULT_LANG ? path.join(ROOT, file) : path.join(ROOT, lang, file);
}
function up(lang) { return lang === DEFAULT_LANG ? '' : '../'; }

function head(lang, file, opts) {
  return shared.head({
    lang, title: opts.title, description: opts.description,
    pathname: pageHref(lang, file), jsonld: opts.jsonld, up: up(lang),
    alternates: code => pageHref(code, file)
  });
}

/* The site nav, with the landing-page anchors that only exist on index. */
function siteNav(lang, onIndex) {
  const t = I18N[lang];
  const u = up(lang);
  const home = u + 'index.html';
  return `<nav class="site-nav">
  <a href="${home}" class="logo" aria-label="Sirāj">
    <svg viewBox="0 0 120 120" aria-hidden="true"><use href="#siraj-mark"/></svg>
    <span class="wordmark">Sirāj<span class="ar"> سِراج</span></span>
  </a>
  <div class="nav-links">
    <a href="${onIndex ? '#features' : home + '#features'}">${esc(t.nav.features)}</a>
    <a href="${shared.prayerHref(lang, null)}">${esc(t.nav.prayerTimes)}</a>
    <a href="${shared.ramadanHref(lang, null)}">${esc(t.ramadan.nav)}</a>
    <a href="${u}support.html">${esc(t.nav.support)}</a>
    <a href="${onIndex ? '#download' : home + '#download'}" class="cta">${esc(t.nav.getApp)}</a>
  </div>
</nav>`;
}

function footer(lang) {
  const u = up(lang);
  const t = I18N[lang];
  return `<footer class="site-footer">
  <div class="inner">
    <div>
      <div class="logo"><svg viewBox="0 0 120 120" aria-hidden="true"><use href="#siraj-mark"/></svg> Sirāj <span class="ar" style="color:var(--accent)">سِراج</span></div>
      <p style="color:var(--text-3);font-size:13px;margin-top:10px;max-width:280px">${esc(t.site.heroH1)}</p>
    </div>
    <div class="cols">
      <div class="col">
        <h4>${esc(t.nav.features)}</h4>
        <a href="${u}index.html#features">${esc(t.site.fTitle)}</a>
        <a href="${shared.prayerHref(lang, null)}">${esc(t.nav.prayerTimes)}</a>
        <a href="${shared.ramadanHref(lang, null)}">${esc(t.ramadan.nav)}</a>
      </div>
      <div class="col">
        <h4>${esc(t.nav.support)}</h4>
        <a href="${u}support.html">${esc(t.site.supH1)}</a>
        <a href="${u}index.html#faq">${esc(t.site.qTitle)}</a>
      </div>
      <div class="col">
        <h4>${esc(t.footer.terms)}</h4>
        <a href="${u}privacy.html">${esc(t.footer.privacy)}</a>
        <a href="${u}terms.html">${esc(t.footer.terms)}</a>
      </div>
    </div>
  </div>
  ${shared.langSwitcher(lang, code => pageHref(code, 'index.html'))}
  <p class="legal">© <span id="year">2026</span> Sirāj. <span class="ar">وَبِاللَّهِ التَّوْفِيق</span></p>
</footer>
<script>document.getElementById('year').textContent = new Date().getFullYear();</script>
<script src="${u}analytics.js" defer></script>`;
}

/* ---- the landing page ------------------------------------------------ */

function indexPage(lang) {
  const t = I18N[lang];
  const s = t.site;
  const u = up(lang);

  const shots = (list, dir, w, h) => list.map(([file, key]) =>
    `<div class="shot"><img src="${u}assets/screenshots/${dir}/${file}.webp" width="${w}" height="${h}" loading="lazy" alt="Sirāj — ${esc(s[key])}"></div>`
  ).join('\n        ');

  const features = [1,2,3,4,5,6,7,8,9].map(i =>
    `<div class="feature"><h3>${esc(s['f'+i+'t'])}</h3><p>${esc(s['f'+i+'b'])}</p></div>`).join('\n    ');

  const values = [1,2,3].map(i =>
    `<div class="value"><h3><span class="num">0${i}</span>${esc(s['w'+i+'t'])}</h3><p>${esc(s['w'+i+'b'])}</p></div>`).join('\n    ');

  const faq = [1,2,3,4,5].map(i =>
    `<details><summary>${esc(s['q'+i])}</summary><p>${esc(s['a'+i])}</p></details>`).join('\n    ');

  const jsonld = {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'WebSite', '@id': ORIGIN + '/#website', url: ORIGIN + '/', name: 'Sirāj', inLanguage: lang },
      { '@type': 'Organization', '@id': ORIGIN + '/#org', name: 'Sirāj', url: ORIGIN + '/',
        logo: ORIGIN + '/assets/app-icon-1024.png' },
      { '@type': 'MobileApplication', '@id': ORIGIN + '/#app', name: 'Sirāj',
        operatingSystem: 'iOS, iPadOS, Android', applicationCategory: 'LifestyleApplication',
        url: ORIGIN + pageHref(lang, 'index.html'), downloadUrl: shared.APP_STORE,
        image: ORIGIN + '/assets/banners/siraj-og-1200x630.png',
        description: s.heroLead, inLanguage: lang,
        author: { '@type': 'Organization', name: 'NovaSoft' },
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' } },
      { '@type': 'FAQPage', '@id': ORIGIN + pageHref(lang, 'index.html') + '#faq',
        mainEntity: [1,2,3,4,5].map(i => ({
          '@type': 'Question', name: s['q'+i],
          acceptedAnswer: { '@type': 'Answer', text: s['a'+i] } })) }
    ]
  };

  return head(lang, 'index.html', { title: `Sirāj — ${s.heroEyebrow}`, description: s.heroLead, jsonld })
    + siteNav(lang, true) + '\n' + SVG_DEFS + `

<header class="hero">
  <div class="hero-grid">
    <div>
      <p class="ar-bismillah ar">بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</p>
      <span class="eyebrow">${esc(s.heroEyebrow)}</span>
      <h1>${esc(s.heroH1)}</h1>
      <p class="lead">${esc(s.heroLead)}</p>
      <div class="actions">
        <a href="#download" class="btn primary">${esc(s.heroCta1)}</a>
        <a href="#features" class="btn secondary">${esc(s.heroCta2)}</a>
      </div>
    </div>
    <div class="hero-shot">
      <img src="${u}assets/screenshots/phone/01-home.webp" width="750" height="1626" alt="Sirāj — ${esc(s.heroEyebrow)}">
    </div>
  </div>
</header>

<section class="section" id="features">
  <div class="center">
    <span class="eyebrow">${esc(s.fEyebrow)}</span>
    <h2 class="section-title">${esc(s.fTitle)}</h2>
    <p class="section-sub center">${esc(s.fSub)}</p>
  </div>
  <div class="features">
    ${features}
  </div>
</section>

<section class="strip" id="why">
  <div class="center">
    <span class="eyebrow">${esc(s.wEyebrow)}</span>
    <h2 class="section-title">${esc(s.wTitle)}</h2>
  </div>
  <div class="values">
    ${values}
  </div>
</section>

<section class="section" id="screens">
  <div class="center">
    <span class="eyebrow">${esc(s.sEyebrow)}</span>
    <h2 class="section-title">${esc(s.sTitle)}</h2>
    <p class="section-sub center">${esc(s.sSub)}</p>
  </div>
  <div class="shots-carousel">
    <div class="carousel">
      <div class="carousel-track">
        ${shots(PHONE_SHOTS, 'phone', 750, 1626)}
      </div>
    </div>
    <div class="carousel-dots"></div>
  </div>
  <div class="center ipad-intro">
    <p class="ipad-title">${esc(s.sIpad)}</p>
  </div>
  <div class="shots-carousel">
    <div class="carousel tablet">
      <div class="carousel-track">
        ${shots(TABLET_SHOTS, 'tablet', 1640, 2160)}
      </div>
    </div>
    <div class="carousel-dots"></div>
  </div>
</section>

<section class="section" id="faq">
  <div class="center">
    <span class="eyebrow">${esc(s.qEyebrow)}</span>
    <h2 class="section-title">${esc(s.qTitle)}</h2>
  </div>
  <div class="faq">
    ${faq}
  </div>
</section>

<section class="section download" id="download">
  <span class="eyebrow">${esc(s.dEyebrow)}</span>
  <h2 class="section-title">${esc(s.dTitle)}</h2>
  <p class="section-sub center">${esc(s.dSub)}</p>
  ${shared.storeBadges(lang)}
</section>

${footer(lang)}
<script src="${u}carousel.js" defer></script>
</body>
</html>
`;
}

/* ---- support --------------------------------------------------------- */

function supportPage(lang) {
  const t = I18N[lang];
  const s = t.site;
  const faq = [1,2,3,4].map(i =>
    `<h3>${esc(s['sq'+i])}</h3>\n  <p>${esc(s['sa'+i])}</p>`).join('\n\n  ');

  return head(lang, 'support.html', { title: s.supTitle, description: s.supLead })
    + siteNav(lang, false) + '\n' + SVG_DEFS + `

<main class="doc">
  <h1>${esc(s.supH1)}</h1>
  <p class="updated">${esc(s.supLead)}</p>

  <div class="callout">
    <p><strong>${esc(s.supEmail)}:</strong> <a href="mailto:${SUPPORT_EMAIL}?subject=Sir%C4%81j%20Support">${SUPPORT_EMAIL}</a></p>
    <p>${esc(s.supEmailNote)}</p>
  </div>

  <h2>${esc(s.supCommon)}</h2>

  ${faq}

  ${shared.langSwitcher(lang, code => pageHref(code, 'support.html'))}

  <p style="margin-top:28px"><a href="${up(lang)}index.html">← ${esc(s.backHome)}</a></p>
</main>
${footer(lang)}
</body>
</html>
`;
}

/* ---- privacy & terms -------------------------------------------------- */

function legalPage(lang, which) {
  const t = I18N[lang];
  const L = t.legal;
  const doc = L[which];
  const file = which === 'privacy' ? 'privacy.html' : 'terms.html';

  const sections = doc.sections.map(sec => {
    const paras = (sec.p || []).map(p =>
      `  <p>${fill(p, { email: `<a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a>` })}</p>`).join('\n');
    const items = (sec.li || []).length
      ? '  <ul>\n' + sec.li.map(li => `    <li>${li}</li>`).join('\n') + '\n  </ul>'
      : '';
    return `  <h2>${esc(sec.h)}</h2>\n${paras}${paras && items ? '\n' : ''}${items}`;
  }).join('\n\n');

  // A translated legal text is a convenience, not the binding instrument —
  // say so on every translated page, and not on the English original.
  const governs = lang === DEFAULT_LANG ? ''
    : `\n  <div class="callout governs"><p>${esc(L.governs)} <a href="/${file}">English</a></p></div>\n`;

  const short = which === 'privacy'
    ? `\n  <div class="callout"><p><strong>${esc(doc.shortLabel)}</strong> ${esc(doc.short)}</p></div>\n`
    : '';

  return head(lang, file, { title: doc.title, description: doc.intro })
    + siteNav(lang, false) + '\n' + SVG_DEFS + `

<main class="doc">
  <h1>${esc(doc.h1)}</h1>
  <p class="updated">${esc(L.updatedLabel)}: ${esc(doc.date)}</p>
${governs}
  <p>${esc(doc.intro)}</p>
${short}
${sections}

  ${shared.langSwitcher(lang, code => pageHref(code, file))}

  <p style="margin-top:28px"><a href="${up(lang)}index.html">← ${esc(L.backHome)}</a></p>
</main>
${footer(lang)}
</body>
</html>
`;
}

/* ---- drive ------------------------------------------------------------ */

const FILES = ['index.html', 'support.html', 'privacy.html', 'terms.html'];

function build() {
  const out = new Map();
  for (const lang of LANGS) {
    out.set(outPath(lang, 'index.html'), indexPage(lang));
    out.set(outPath(lang, 'support.html'), supportPage(lang));
    out.set(outPath(lang, 'privacy.html'), legalPage(lang, 'privacy'));
    out.set(outPath(lang, 'terms.html'), legalPage(lang, 'terms'));
  }
  return out;
}

function main() {
  const check = process.argv.includes('--check');

  if (check) {
    let problems = 0;
    for (const lang of LANGS) {
      for (const f of FILES) {
        if (!fs.existsSync(outPath(lang, f))) { console.error(`  ${lang}: missing ${f}`); problems++; }
      }
    }
    if (problems) { console.error('\nRun: node tools/gen-site.js'); process.exit(1); }
    console.log(`ok — ${FILES.length} pages × ${LANGS.length} languages = ${FILES.length * LANGS.length} site pages`);
    return;
  }

  for (const lang of LANGS) {
    if (lang !== DEFAULT_LANG) fs.mkdirSync(path.join(ROOT, lang), { recursive: true });
  }
  const files = build();
  for (const [f, content] of files) fs.writeFileSync(f, content, 'utf8');
  console.log(`wrote ${FILES.length} pages × ${LANGS.length} languages (${files.size} site pages)`);
}

if (require.main === module) main();
