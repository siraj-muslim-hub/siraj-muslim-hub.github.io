# Sirāj — Marketing Website

The marketing, privacy, terms, and support pages for **Sirāj**, a private, beautiful
Muslim companion app (prayer times, Qur'an, Qibla, Ḥadīth, Duʿāʾ & Adhkār, the 99 Names,
Hijri calendar, tasbīḥ, Zakat and Ramadan).

Served via **GitHub Pages** at **https://siraj-muslim-hub.github.io/**.

## Structure

```
index.html      Landing page          GENERATED — edit tools/i18n.json
privacy.html    Privacy Policy        GENERATED
terms.html      Terms of Service      GENERATED
support.html    Help & contact        GENERATED
ar/ ur/ tr/ id/ fr/ de/               GENERATED — the same four pages, localised
prayer-times/   Per-city prayer times GENERATED
ramadan/        Ramadan hub + timetables  GENERATED
styles.css      Shared emerald + gold "glowing dome" design system
carousel.js     Screenshot carousel (dependency-free)
analytics.js    Cloudflare Web Analytics loader
robots.txt      Crawl directives
sitemap.xml     GENERATED
assets/
  prayer-times.js   Prayer time + Qibla maths, shared by generators and browser
tools/
  build.js          Runs every generator, in order
  shared.js         Chrome, hreflang, names, dates — used by all generators
  i18n.json         Every UI string, in all seven languages
  city-names.json   Localised city names
  cities.json       The city list
  gen-site.js       index / privacy / terms / support × 7
  gen-cities.js     prayer-times/ × 7
  gen-ramadan.js    ramadan/ × 7
  gen-sitemap.js    sitemap.xml across every section
  set-domain.py     Moves the site to a custom domain in one command
  partials/         Markup fragments with no translatable text
```

> **Almost every HTML file in this repo is generated.** Editing `index.html`,
> `privacy.html` or anything under `prayer-times/`, `ramadan/` or a language
> directory will be overwritten on the next build. Change `tools/i18n.json`
> and run `node tools/build.js`.

## Local preview

It's a static site — no build step.

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

## Adding real screenshots

Drop device screenshots into `assets/screenshots/` (PNG, 9:19.5 portrait), then in
`index.html` replace each `<div class="shot placeholder">…</div>` with:

```html
<div class="shot"><img src="assets/screenshots/01.png" alt="Home & next prayer"></div>
```

## Analytics

The site uses **Cloudflare Web Analytics** — cookieless, no fingerprinting, nothing that
needs a consent banner. It is disabled until you add a token, and ships that way safely:
with no token, `analytics.js` makes no request at all.

1. dash.cloudflare.com → Analytics & Logs → Web Analytics → **Add a site**
2. Hostname: `siraj-muslim-hub.github.io` (no DNS change needed, and the domain does not
   have to be on Cloudflare)
3. Copy the `token` from the snippet it shows you
4. Paste it into `SIRAJ_ANALYTICS_TOKEN` at the top of `analytics.js` and commit

That one constant covers every page on the site. `Do Not Track` and Global Privacy Control
are honoured — if either is set, the script is never loaded.

## Ramadan

`ramadan/` holds a hub per language plus a Ramadan timetable per city: when suhoor ends,
when to break the fast, and the length of each day's fast for all 29 days of Ramadan 1448
(**8 February – 8 March 2027**, Eid on 9 March, per the Umm al-Qurā calendar).

These are the biggest seasonal queries in the category, and they are asked in the reader's
own language — إمساكية رمضان, jadwal imsakiyah, ramazan imsakiyesi, calendrier ramadan — so
each has its own localised page and title.

Unlike the prayer-time pages these are **not** rebuilt monthly: the Ramadan dates are fixed,
so the tables stay correct until the month passes. The countdown on the hub recomputes in
the browser, because a baked figure is wrong the day after it is generated.

When Ramadan 1449 comes round, update `RAMADAN` at the top of `tools/gen-ramadan.js` and
rebuild.

## Prayer-time landing pages

`prayer-times/` holds a page per city: today's ṣalāh times, the Qibla bearing and distance
to Makkah, a full month's timetable, and the local calculation convention. This is the
organic-search surface — "prayer times in \<city\>" is how this category is searched.

Pages are generated in **seven languages** — English, Arabic, Urdu, Turkish, Indonesian,
French and German — which is 157 × 7 = 1,099 city pages plus seven indexes.

```bash
node tools/build.js          # rebuild the entire site, every language
node tools/build.js --check  # verify nothing is missing or orphaned
```

Individual generators (`gen-site.js`, `gen-cities.js`, `gen-ramadan.js`,
`gen-sitemap.js`) can be run alone; `build.js` just runs them in order, with the
sitemap last because it enumerates what the others produced.

**To add a city**, append a row to `tools/cities.json` and re-run the generator:

```json
{"slug":"sarajevo","name":"Sarajevo","country":"Bosnia and Herzegovina",
 "lat":43.8563,"lng":18.4131,"tz":"Europe/Sarajevo","method":"MWL","asr":1}
```

`tz` is an IANA zone (DST is handled from it automatically). `method` is one of the keys in
`METHODS` in `assets/prayer-times.js`. `asr` is the shadow factor: `1` for Shāfiʿī/Mālikī/
Ḥanbalī, `2` for Ḥanafī. Pick whichever the local community actually publishes.

Never edit files in `prayer-times/` by hand — the generator overwrites them, and removing a
city from `cities.json` deletes its page on the next run.

### Languages

| File | Holds |
|---|---|
| `tools/i18n.json` | Every UI string, one block per language |
| `tools/city-names.json` | Localised city names, keyed by slug |
| `cc` field in `cities.json` | ISO country code — country names come from ICU |

URLs: English keeps the flat paths it was first published at (`/prayer-times/london.html`)
because those are already live and indexed; every other language sits under a prefix
(`/prayer-times/ar/london.html`). Each page declares `hreflang` alternates for all seven plus
`x-default`, and the sitemap repeats the cluster on every URL.

Three rules when editing translations:

1. **Keep every `{placeholder}`.** The generator throws rather than shipping a literal
   `{city}` to a reader, so a dropped one fails the build — but only for the page that uses
   it, so run the generator after any edit.
2. **Keep the key sets identical.** Every language must carry exactly the same keys as `en`.
3. **Don't add month names, country names or number formats.** Those come from ICU at build
   time via the `locale` field, so they cannot drift.

Anything ICU can derive is derived: month names, country names (from `cc`), collation order
on the index, and the duration units in the "next prayer" pill (`2h 48m` / `2 س 48 د` /
`2s 48d`). `city-names.json` only lists names that actually differ from the default, so
`Paris` needs no French row.

To add a language: add a block to `tools/i18n.json` with `name`, `dir`, `locale` and the same
keys as `en`, then re-run the generator. RTL is handled by the shared stylesheet through CSS
logical properties — no separate RTL sheet.

**These translations have not been reviewed by native speakers.** They are careful, but
before spending money driving traffic to a language, get a fluent reader to check its index
page and one city page — particularly the Urdu and Indonesian religious vocabulary.

The maths lives in `assets/prayer-times.js` and is used in **both** places: the generator
bakes the month table with it at build time, and the browser loads the same file to
recompute today's times live. Keep it that way — two copies would drift, and the page would
end up disagreeing with itself. Sunrise and sunset match published almanac values to the
minute; Qibla bearings match published figures (London 119.0°, New York 58.5°, Sydney
277.5°).

Because the baked month goes stale, `.github/workflows/refresh-prayer-times.yml` regenerates
and commits on the 1st of each month. Anyone with JavaScript sees live times regardless, so
a missed run costs SEO freshness, not correctness.

## Moving to a custom domain

The current host is `siraj-muslim-hub.github.io`. A custom domain is worth it for
credibility, and it is one command — but **do the DNS first**. A `CNAME` file naming a
domain you do not control takes the live site down, because GitHub starts redirecting the
github.io address to a host that will not answer.

1. Buy the domain, then at your DNS provider add either
   - apex (`siraj.app`): four `A` records → `185.199.108.153`, `185.199.109.153`,
     `185.199.110.153`, `185.199.111.153`, or
   - subdomain (`www.siraj.app`): one `CNAME` → `siraj-muslim-hub.github.io`
2. Wait for it to resolve (`dig +short siraj.app`)
3. Then run:

```bash
python3 tools/set-domain.py siraj.app --email support@siraj.app --dry-run   # preview
python3 tools/set-domain.py siraj.app --email support@siraj.app --write-cname
node tools/gen-cities.js      # regenerate city pages + sitemap on the new host
```

4. GitHub → Settings → Pages → Custom domain, then tick **Enforce HTTPS** once the
   certificate is issued (can take up to an hour)
5. Add the new hostname in Cloudflare Web Analytics, and re-submit the sitemap in Google
   Search Console

To go back: `python3 tools/set-domain.py siraj-muslim-hub.github.io --remove-cname`.

The support address is currently a personal Gmail, which reads as untrustworthy in press and
mosque outreach; `--email` switches it everywhere in the same pass.

## Deploy

This repo is the GitHub Pages site for the `siraj-muslim-hub` organization (`siraj-muslim-hub.github.io`).
Pushing to the default branch publishes automatically — enable Pages under
**Settings → Pages → Deploy from branch** if it isn't already on.
