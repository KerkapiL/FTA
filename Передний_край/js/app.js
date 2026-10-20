(function () {
  const ROUTES = [
    { id: 'bestiary',   label: 'Бестиарий', icon: '🐾' },
    { id: 'combat',     label: 'Бой',       icon: '⚔' },
    { id: 'lore',       label: 'Лор',       icon: '📖' },
    { id: 'quests',     label: 'Квесты',    icon: '📜' },
    { id: 'timeline',   label: 'Таймлайн',  icon: '⏳' },
    { id: 'sessions',   label: 'Сессии',    icon: '🕮' },
    { id: 'players',    label: 'Игроки',    icon: '👥' },
    { id: 'rules',      label: 'Правила',   icon: '📕' },
    { id: 'dice',       label: 'Кубики',    icon: '🎲' },
    { id: 'generators', label: 'Генераторы', icon: '🛠' },
    { id: 'settings',   label: 'Настройки', icon: '⚙' }
  ];

  function makeStub(title) {
    return {
      render: function (root) {
        root.innerHTML =
          '<p class="empty">' +
            'Раздел «' + title + '» пока в разработке.<br>' +
            '<span class="muted">Начни с Бестиария — он полностью рабочий.</span>' +
          '</p>';
      }
    };
  }

  const PAGES = {
    bestiary: PK.pages.bestiary,
    combat: PK.pages.combat,
    lore: PK.pages.lore,
    quests: PK.pages.quests,
    timeline: PK.pages.timeline,
    sessions: makeStub('Сессии'),
    players: PK.pages.players,
    rules: PK.pages.rules,
    dice: PK.pages.dice,
    generators: makeStub('Генераторы'),
    settings: makeStub('Настройки')
  };

  function applyTheme() {
    const t = localStorage.getItem('pk-theme') || 'light';
    document.documentElement.setAttribute('data-theme', t);
  }
  function toggleTheme() {
    const cur = localStorage.getItem('pk-theme') || 'light';
    const next = cur === 'light' ? 'dark' : 'light';
    localStorage.setItem('pk-theme', next);
    applyTheme();
  }

  function route() {
    const id = PK.sidebar.currentRouteId();
    const page = PAGES[id] || PAGES.bestiary;
    const meta = ROUTES.find(function (r) { return r.id === id; }) || ROUTES[0];
    document.getElementById('page-title').textContent = meta.label;
    const root = document.getElementById('page');
    root.innerHTML = '';
    try {
      Promise.resolve(page.render(root)).catch(function (e) {
        console.error(e);
        root.innerHTML = '<p class="empty">Ошибка: ' + e.message + '</p>';
      });
    } catch (e) {
      console.error(e);
      root.innerHTML = '<p class="empty">Ошибка: ' + e.message + '</p>';
    }
  }

  function bindHotkeys() {
    document.addEventListener('keydown', function (e) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        const s = document.getElementById('global-search');
        if (s) s.focus();
      }
    });
  }

  function boot() {
    console.log('[Передний край] Запуск. Протокол: ' + location.protocol);

    if (!PK || !PK.pages || !PK.pages.bestiary) {
      document.getElementById('page').innerHTML =
        '<p class="empty">Скрипты не загрузились. Проверь пути в index.html (папки js/ и подпапки).</p>';
      return;
    }

    applyTheme();
    PK.sidebar.render(ROUTES);
    bindHotkeys();

    document.getElementById('theme-toggle').addEventListener('click', toggleTheme);

    window.addEventListener('hashchange', route);
    if (!location.hash) location.hash = '#/bestiary';
    route();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();