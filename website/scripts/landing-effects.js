(function () {
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  document.querySelectorAll('.reveal').forEach(function (el) {
    if (prefersReduced) {
      el.classList.add('is-visible');
      return;
    }
    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
    );
    observer.observe(el);
  });

  if (!prefersReduced) {
    var phone = document.querySelector('.phone-mock');
    if (phone) {
      window.addEventListener(
        'mousemove',
        function (e) {
          var rect = phone.getBoundingClientRect();
          var cx = rect.left + rect.width / 2;
          var cy = rect.top + rect.height / 2;
          var dx = (e.clientX - cx) / rect.width;
          var dy = (e.clientY - cy) / rect.height;
          phone.style.setProperty('--tilt-x', (dy * -4).toFixed(2) + 'deg');
          phone.style.setProperty('--tilt-y', (dx * 6).toFixed(2) + 'deg');
        },
        { passive: true }
      );
    }
  }
})();
