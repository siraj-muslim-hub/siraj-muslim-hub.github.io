# Sirāj — Marketing Website

The marketing, privacy, terms, and support pages for **Sirāj**, a private, beautiful
Muslim companion app (prayer times, Qur'an, Qibla, Ḥadīth, Duʿāʾ & Adhkār, the 99 Names,
Hijri calendar, tasbīḥ, Zakat and Ramadan).

Served via **GitHub Pages** at **https://siraj-muslim-hub.github.io/**.

## Structure

```
index.html      Landing page (hero, features, why, screenshots, FAQ, download)
privacy.html    Privacy Policy
terms.html      Terms of Service
support.html    Help & contact + FAQ
styles.css      Shared emerald + gold "glowing dome" design system
carousel.js     Screenshot carousel (dependency-free)
analytics.js    Cloudflare Web Analytics loader (one token, see below)
robots.txt      Crawl directives
sitemap.xml     Sitemap — generated, do not hand-edit
assets/         App icon, brand mark, OG banner, screenshots
  prayer-times.js  Prayer time + Qibla maths, shared by the generator and the browser
prayer-times/   Generated per-city landing pages — do not hand-edit
tools/
  cities.json      The city list (edit this)
  gen-cities.js    Builds prayer-times/ and sitemap.xml
  set-domain.py    Moves the site to a custom domain in one command
```

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

## Prayer-time landing pages

`prayer-times/` holds a page per city: today's ṣalāh times, the Qibla bearing and distance
to Makkah, a full month's timetable, and the local calculation convention. This is the
organic-search surface — "prayer times in \<city\>" is how this category is searched.

```bash
node tools/gen-cities.js          # rebuild every page + sitemap.xml
node tools/gen-cities.js --check  # every city has a page, no page outlives its city
```

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
