(function () {
  const ROUTES = [
    { id: 'bestiary',   label: 'Бестиарий', icon: '🐾' },
    { id: 'combat',     label: 'Бой',       icon: '⚔' },
    { id: 'lore',       label: 'Лор',       icon: '📖' },
    { id: 'quests',     label: 'Квесты',    icon: '📜' },
    { id: 'timeline',   label: 'Таймлайн',  icon: '⏳' },
    { id: 'players',    label: 'Игроки',    icon: '👥' },
    { id: 'rules',      label: 'Правила',   icon: '📕' },
    { id: 'dice',       label: 'Кубики',    icon: '🎲' },
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
    players: PK.pages.players,
    rules: PK.pages.rules,
    dice: PK.pages.dice,
    settings: PK.pages.settings
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
	initGlobalSearch();

    document.getElementById('theme-toggle').addEventListener('click', toggleTheme);

    window.addEventListener('hashchange', route);
    if (!location.hash) location.hash = '#/bestiary';
    route();
  }

function initGlobalSearch() {
  const input = document.getElementById('global-search');
  if (!input) return;
  
  // Оборачиваем input в контейнер
  const wrap = document.createElement('div');
  wrap.className = 'global-search-wrap';
  input.parentNode.insertBefore(wrap, input);
  wrap.appendChild(input);
  
  // Создаём контейнер результатов
  const results = document.createElement('div');
  results.className = 'global-search-results';
  wrap.appendChild(results);
  
  let debounceTimer;
  
  input.addEventListener('input', function() {
    clearTimeout(debounceTimer);
    const q = input.value.trim();
    
    if (!q) {
      results.classList.remove('show');
      return;
    }
    
    debounceTimer = setTimeout(function() {
      PK.utils.globalSearch(q).then(function(matches) {
        if (!matches.length) {
          results.innerHTML = '<div class="search-result-empty">Ничего не найдено</div>';
          results.classList.add('show');
          return;
        }
        
        results.innerHTML = matches.map(function(m) {
          const item = m.item;
          const title = item.name || item.title || 'Без названия';
          let meta = '';
          
          if (m.store === 'creatures') meta = '🐾 Бестиарий';
          else if (m.store === 'lore') meta = '📖 Лор';
          else if (m.store === 'quests') meta = '📜 Квесты';
          else if (m.store === 'players') meta = '👥 Игроки';
          
          return '<div class="search-result-item" data-store="' + m.store + '" data-id="' + item.id + '">' +
            '<div class="search-result-title">' + PK.utils.escapeHtml(title) + '</div>' +
            '<div class="search-result-meta">' + meta + '</div>' +
          '</div>';
        }).join('');
        
        results.classList.add('show');
      });
    }, 300);
  });
  
  // Клик по результату
  results.addEventListener('click', function(e) {
    const item = e.target.closest('.search-result-item');
    if (!item) return;
    
    const store = item.dataset.store;
    const id = item.dataset.id;
    
    // Переходим к нужному разделу
    let route = '';
    if (store === 'creatures') route = '#/bestiary';
    else if (store === 'lore') route = '#/lore';
    else if (store === 'quests') route = '#/quests';
    else if (store === 'players') route = '#/players';
    
    if (route) {
      location.hash = route;
      // TODO: Открыть нужную карточку (нужно передать ID в страницу)
    }
    
    results.classList.remove('show');
    input.value = '';
    input.blur();
  });
  
  // Закрытие при клике вне
  document.addEventListener('click', function(e) {
    if (!wrap.contains(e.target)) {
      results.classList.remove('show');
    }
  });
  
  // Закрытие при Escape
  input.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      results.classList.remove('show');
      input.blur();
    }
  });
}

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();