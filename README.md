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
robots.txt      Crawl directives
sitemap.xml     Sitemap
assets/         App icon, brand mark, OG banner, screenshots
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

## Going live (store badges)

The App Store / Google Play badges are styled "Coming soon" (non-clickable). When the app
ships, swap each `<span class="badge soon">…</span>` for an `<a class="badge" href="…">`
pointing at the store listing, and drop the "Soon" pill.

## Deploy

This repo is the GitHub Pages site for the `siraj-muslim-hub` organization (`siraj-muslim-hub.github.io`).
Pushing to the default branch publishes automatically — enable Pages under
**Settings → Pages → Deploy from branch** if it isn't already on.
