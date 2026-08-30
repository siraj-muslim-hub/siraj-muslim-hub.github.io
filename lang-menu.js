/* Close the nav language picker on an outside click or Escape.
 *
 * The picker is a <details> element, so it opens, closes and navigates with
 * no JavaScript at all — this only adds the dismissal behaviour people
 * expect from a menu. Everything here is optional polish; nothing breaks
 * without it.
 */
(function () {
  'use strict';

  var menu = document.querySelector('.lang-menu');
  if (!menu) return;

  document.addEventListener('click', function (e) {
    if (menu.open && !menu.contains(e.target)) menu.open = false;
  });

  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape' || !menu.open) return;
    menu.open = false;
    var summary = menu.querySelector('summary');
    if (summary) summary.focus();   // don't strand focus inside a closed menu
  });
})();
