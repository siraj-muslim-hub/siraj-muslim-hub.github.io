/* Sirāj — website analytics.
 *
 * Cloudflare Web Analytics: cookieless, no fingerprinting, no cross-site
 * tracking, and nothing that needs a consent banner. It measures this
 * marketing site only — it is not in the app.
 *
 * SETUP (about two minutes, no DNS change and no Cloudflare-proxied domain
 * required — the "Add a site" flow accepts a plain hostname):
 *
 *   1. dash.cloudflare.com → Analytics & Logs → Web Analytics → Add a site
 *   2. Hostname: siraj-muslim-hub.github.io  (or the custom domain, once live)
 *   3. Copy the `token` value out of the snippet it shows you
 *   4. Paste it below and commit. That's the only edit needed — every page
 *      on the site loads this one file.
 *
 * Until the token is filled in this script does nothing at all: no request is
 * made, so shipping it un-configured is harmless.
 */
var SIRAJ_ANALYTICS_TOKEN = '82f7fb17b8fc4b26998093b91e551325';

(function () {
  if (!SIRAJ_ANALYTICS_TOKEN) return;

  // Honour Do Not Track / Global Privacy Control. Cloudflare collects no
  // personal data either way, but the app's whole promise is restraint and
  // the site should hold the same line.
  var nav = window.navigator || {};
  if (nav.doNotTrack === '1' || nav.globalPrivacyControl === true) return;

  var s = document.createElement('script');
  s.src = 'https://static.cloudflareinsights.com/beacon.min.js';
  s.defer = true;
  s.setAttribute('data-cf-beacon', JSON.stringify({ token: SIRAJ_ANALYTICS_TOKEN }));
  document.head.appendChild(s);
})();
