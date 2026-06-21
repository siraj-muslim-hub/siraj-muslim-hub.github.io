/* Sirāj screenshot carousels — dependency-free, auto-advancing, dot-navigable.
   Initialises every `.shots-carousel` on the page (phone + tablet), each with
   its own `.carousel` viewport, `.carousel-track` and `.carousel-dots`. */
(function () {
  function initCarousel(root) {
    var viewport = root.querySelector('.carousel');
    var track = root.querySelector('.carousel-track');
    var dotsWrap = root.querySelector('.carousel-dots');
    if (!viewport || !track || !dotsWrap) return;

    var shots = Array.prototype.slice.call(track.children);
    if (shots.length === 0) return;

    var index = 0;
    var timer = null;

    function shotStep() {
      if (shots.length < 2) return 0;
      var a = shots[0].getBoundingClientRect();
      var b = shots[1].getBoundingClientRect();
      return b.left - a.left; // width + gap
    }

    // How many "pages" fit — stop scrolling once the last shot is flush right.
    function maxIndex() {
      var step = shotStep();
      if (step <= 0) return shots.length - 1;
      var visible = Math.max(1, Math.round(viewport.clientWidth / step));
      return Math.max(0, shots.length - visible);
    }

    function go(i) {
      var max = maxIndex();
      index = i > max ? 0 : i < 0 ? max : i;
      track.style.transform = 'translateX(' + -(index * shotStep()) + 'px)';
      updateDots();
    }

    function updateDots() {
      var count = maxIndex() + 1;
      if (dotsWrap.children.length !== count) {
        dotsWrap.innerHTML = '';
        for (var d = 0; d < count; d++) {
          (function (di) {
            var b = document.createElement('button');
            b.setAttribute('aria-label', 'Go to slide ' + (di + 1));
            b.addEventListener('click', function () { go(di); restart(); });
            dotsWrap.appendChild(b);
          })(d);
        }
      }
      Array.prototype.forEach.call(dotsWrap.children, function (b, di) {
        b.className = di === index ? 'active' : '';
      });
    }

    function restart() {
      if (timer) clearInterval(timer);
      timer = setInterval(function () { go(index + 1); }, 4000);
    }

    viewport.addEventListener('mouseenter', function () { if (timer) clearInterval(timer); });
    viewport.addEventListener('mouseleave', restart);
    window.addEventListener('resize', function () { go(index); });

    go(0);
    restart();
  }

  Array.prototype.forEach.call(document.querySelectorAll('.shots-carousel'), initCarousel);
})();
