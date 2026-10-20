window.PK = window.PK || {};
PK.pages = PK.pages || {};

PK.pages.settings = (function () {
  const U = PK.utils;
  const M = PK.modal;
  const S = PK.storage;
  const STORE = 'settings';
  const BUGS_ID = 'bugs';

  let bugs = [];
  let loaded = false;

  /* ============ ТЕМА ============ */

  function getTheme() {
    return localStorage.getItem('pk-theme') || 'light';
  }
  function applyTheme(t) {
    localStorage.setItem('pk-theme', t);
    document.documentElement.setAttribute('data-theme', t);
  }

  /* ============ СПИСОК ПРАВОК ============ */

  function loadBugs() {
    return S.getOne(STORE, BUGS_ID).then(function (rec) {
      bugs = (rec && Array.isArray(rec.items)) ? rec.items.map(function (x) {
        return {
          id: x.id || U.uuid(),
          text: String(x.text || ''),
          done: !!x.done
        };
      }) : [];
      loaded = true;
    }).catch(function () {
      bugs = [];
      loaded = true;
    });
  }

  function saveBugs() {
    return S.put(STORE, { id: BUGS_ID, items: bugs });
  }

  /* ============ РЕНДЕР ============ */

  function render(root) {
    const p = loaded ? Promise.resolve() : loadBugs();
    return p.then(function () {
      root.innerHTML = layout();
      bind(root);
    });
  }

  function layout() {
    return '<div class="settings-page">' +
      themeCard() +
      dataCard() +
      bugsCard() +
    '</div>';
  }

  function themeCard() {
    const theme = getTheme();
    return '<section class="settings-card">' +
      '<div class="settings-card-head">🎨 Тема оформления</div>' +
      '<div class="settings-card-body">' +
        '<div class="theme-row">' +
          '<button type="button" class="theme-opt' + (theme === 'light' ? ' active' : '') + '" data-theme-opt="light">' +
            '<div class="theme-opt-preview light"></div>' +
            '<div class="theme-opt-label">Светлая</div>' +
          '</button>' +
          '<button type="button" class="theme-opt' + (theme === 'dark' ? ' active' : '') + '" data-theme-opt="dark">' +
            '<div class="theme-opt-preview dark"></div>' +
            '<div class="theme-opt-label">Тёмная</div>' +
          '</button>' +
        '</div>' +
        '<div class="muted">Тема также переключается кнопкой ◐ в шапке.</div>' +
      '</div>' +
    '</section>';
  }

  function dataCard() {
    return '<section class="settings-card">' +
      '<div class="settings-card-head">💾 Данные</div>' +
      '<div class="settings-card-body">' +
        '<div class="muted">Экспорт сохраняет все разделы (бестиарий, лор, квесты, игроки, правила, таймлайн, настройки) в один JSON-файл. Импорт <b>полностью заменяет</b> данные текущей базы.</div>' +
        '<div class="settings-actions">' +
          '<button type="button" class="btn btn-primary" id="set-export">⬇ Экспорт в файл</button>' +
          '<button type="button" class="btn" id="set-import">⬆ Импорт из файла</button>' +
          '<input type="file" id="set-import-file" accept="application/json,.json" style="display:none">' +
        '</div>' +
      '</div>' +
    '</section>';
  }

  function bugsCard() {
    return '<section class="settings-card">' +
      '<div class="settings-card-head">' +
        '🐞 Список правок и ошибок' +
        '<div class="spacer"></div>' +
        '<button type="button" class="btn btn-small" id="bug-add">+ Добавить</button>' +
      '</div>' +
      '<div class="settings-card-body">' +
        '<div class="bugs-list" id="bugs-list">' + bugsListHtml() + '</div>' +
      '</div>' +
    '</section>';
  }

  function bugsListHtml() {
    if (!bugs.length) {
      return '<div class="bugs-empty">Пока пусто. Записывай сюда баги и хотелки — они сохраняются вместе с проектом.</div>';
    }
    return bugs.map(function (b) {
      return '<div class="bug-row" data-id="' + b.id + '">' +
        '<label class="bug-check" title="Готово">' +
          '<input type="checkbox" data-act="bug-done"' + (b.done ? ' checked' : '') + '>' +
          '<span class="bug-check-box"></span>' +
        '</label>' +
        '<input type="text" data-act="bug-text" value="' + U.escapeHtml(b.text) + '" placeholder="Что не так / что хочется">' +
        '<button type="button" class="bug-del" data-act="bug-del" title="Удалить">✕</button>' +
      '</div>';
    }).join('');
  }

  function rerenderBugs(root) {
    const list = root.querySelector('#bugs-list');
    if (list) list.innerHTML = bugsListHtml();
  }

  /* ============ BIND ============ */

  function bind(root) {
    /* Тема */
    root.querySelectorAll('[data-theme-opt]').forEach(function (b) {
      b.addEventListener('click', function () {
        const t = b.dataset.themeOpt;
        applyTheme(t);
        root.querySelectorAll('[data-theme-opt]').forEach(function (x) {
          x.classList.toggle('active', x.dataset.themeOpt === t);
        });
      });
    });

    /* Экспорт */
    root.querySelector('#set-export').addEventListener('click', function () {
      S.exportAll().then(function (payload) {
        const name = 'peredniy-kray-' + new Date().toISOString().slice(0, 10) + '.json';
        U.download(name, JSON.stringify(payload, null, 2));
      }).catch(function (e) {
        alert('Не удалось экспортировать: ' + e.message);
      });
    });

    /* Импорт */
    const fileInput = root.querySelector('#set-import-file');
    root.querySelector('#set-import').addEventListener('click', function () {
      fileInput.click();
    });
    fileInput.addEventListener('change', function () {
      const f = fileInput.files && fileInput.files[0];
      if (!f) return;
      const reader = new FileReader();
      reader.onerror = function () {
        alert('Не удалось прочитать файл');
        fileInput.value = '';
      };
      reader.onload = function () {
        let payload;
        try {
          payload = JSON.parse(reader.result);
        } catch (err) {
          alert('Файл не является JSON');
          fileInput.value = '';
          return;
        }
        M.confirmDialog('Импорт полностью <b>заменит</b> все текущие данные. Продолжить?').then(function (ok) {
          if (!ok) { fileInput.value = ''; return; }
          S.importAll(payload).then(function () {
            alert('Импорт завершён. Страница будет перезагружена.');
            location.reload();
          }).catch(function (e) {
            alert('Ошибка импорта: ' + e.message);
            fileInput.value = '';
          });
        });
      };
      reader.readAsText(f);
    });

    /* Список правок — добавление */
    root.querySelector('#bug-add').addEventListener('click', function () {
      bugs.push({ id: U.uuid(), text: '', done: false });
      saveBugs().then(function () {
        rerenderBugs(root);
        const list = root.querySelector('#bugs-list');
        const last = list && list.querySelector('.bug-row:last-child input[data-act="bug-text"]');
        if (last) last.focus();
      });
    });

    /* Список правок — ввод текста */
    root.querySelector('#bugs-list').addEventListener('input', U.debounce(function (e) {
      const t = e.target;
      if (!t.matches('[data-act="bug-text"]')) return;
      const row = t.closest('.bug-row');
      const b = bugs.find(function (x) { return x.id === row.dataset.id; });
      if (!b) return;
      b.text = t.value;
      saveBugs();
    }, 400));

    /* Список правок — отметка «готово» */
    root.querySelector('#bugs-list').addEventListener('change', function (e) {
      const t = e.target;
      if (!t.matches('[data-act="bug-done"]')) return;
      const row = t.closest('.bug-row');
      const b = bugs.find(function (x) { return x.id === row.dataset.id; });
      if (!b) return;
      b.done = t.checked;
      saveBugs();
    });

    /* Список правок — удаление */
    root.querySelector('#bugs-list').addEventListener('click', function (e) {
      const t = e.target.closest('[data-act="bug-del"]');
      if (!t) return;
      const row = t.closest('.bug-row');
      const id = row.dataset.id;
      bugs = bugs.filter(function (x) { return x.id !== id; });
      saveBugs().then(function () { rerenderBugs(root); });
    });
  }

  return { render: render };
})();