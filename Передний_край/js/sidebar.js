window.PK = window.PK || {};

PK.sidebar = (function () {
  function render(routes) {
    const el = document.getElementById('sidebar');
    el.innerHTML =
      '<div class="brand">Передний край</div>' +
      '<nav>' +
        routes.map(function (r) {
          return '<a href="#/' + r.id + '" data-route="' + r.id + '" class="nav-item" title="' + r.label + '">' +
                   '<span class="nav-icon">' + r.icon + '</span>' +
                   '<span class="nav-label">' + r.label + '</span>' +
                 '</a>';
        }).join('') +
      '</nav>';
    updateActive();
    window.addEventListener('hashchange', updateActive);
  }

  function updateActive() {
    const id = currentRouteId();
    document.querySelectorAll('.nav-item').forEach(function (a) {
      a.classList.toggle('active', a.dataset.route === id);
    });
  }

  function currentRouteId() {
    const h = location.hash.replace(/^#\/?/, '');
    return (h.split('/')[0] || 'bestiary');
  }

  return { render: render, currentRouteId: currentRouteId };
})();