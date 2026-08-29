/* Client-side filter for the city index. 157 links is a lot to scan. */
(function () {
  'use strict';

  var input = document.getElementById('city-search');
  var empty = document.getElementById('filter-empty');
  if (!input) return;

  var sections = [].slice.call(document.querySelectorAll('.country'));
  var entries = sections.map(function (section) {
    return {
      section: section,
      country: section.querySelector('h3').textContent.toLowerCase(),
      items: [].slice.call(section.querySelectorAll('li')).map(function (li) {
        return { li: li, name: li.textContent.toLowerCase() };
      })
    };
  });

  function apply() {
    var q = input.value.trim().toLowerCase();
    var anyVisible = false;

    entries.forEach(function (entry) {
      var countryMatches = q && entry.country.indexOf(q) !== -1;
      var shown = 0;
      entry.items.forEach(function (item) {
        var visible = !q || countryMatches || item.name.indexOf(q) !== -1;
        item.li.hidden = !visible;
        if (visible) shown++;
      });
      entry.section.hidden = shown === 0;
      if (shown) anyVisible = true;
    });

    if (empty) empty.hidden = anyVisible;
  }

  input.addEventListener('input', apply);
  apply();
})();
