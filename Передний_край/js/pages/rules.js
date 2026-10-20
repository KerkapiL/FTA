window.PK = window.PK || {};
PK.pages = PK.pages || {};

PK.pages.rules = (function () {
  const U = PK.utils;
  const M = PK.modal;
  const S = PK.storage;
  const STORE = 'rules';

  const TAGS = [
    { id: 'combat', label: 'Боевые' },
    { id: 'social', label: 'Социальные' },
    { id: 'other',  label: 'Прочее' }
  ];

  let rules = [];
  let loaded = false;
  let filter = 'all'; // 'all' | 'active' | 'inactive'
  const els = { root: null };

  /* ---------- модель ---------- */

  function normalize(raw) {
    raw = raw || {};
    const tag = TAGS.some(function (t) { return t.id === raw.tag; }) ? raw.tag : 'other';
    return {
      id: raw.id || U.uuid(),
      title: String(raw.title || ''),
      body: String(raw.body || ''),
      tag: tag,
      active: raw.active !== false,
      createdAt: raw.createdAt || new Date().toISOString()
    };
  }

  /* ---------- загрузка ---------- */

  function load() {
    return S.getAll(STORE).then(function (items) {
      rules = (items || []).map(normalize);
      sortRules();
      loaded = true;
    });
  }

  function sortRules() {
    rules.sort(function (a, b) {
      return (b.createdAt || '').localeCompare(a.createdAt || '');
    });
  }

  function saveOne(r) { return S.put(STORE, r); }
  function removeOne(id) { return S.remove(STORE, id); }

  /* ---------- рендер ---------- */

  function render(root) {
    els.root = root;
    if (!loaded) return load().then(paint);
    paint();
    return Promise.resolve();
  }

  function paint() {
    if (!els.root) return;

    const total = rules.length;
    const act = rules.filter(function (r) { return r.active; }).length;
    const inact = total - act;

    els.root.innerHTML =
      '<div class="page-toolbar">' +
        '<div class="rules-filters" id="rules-filters">' +
          filterBtn('all', 'Все', total) +
          filterBtn('active', 'Активные', act) +
          filterBtn('inactive', 'Неактивные', inact) +
        '</div>' +
        '<div class="spacer"></div>' +
        '<button class="btn btn-primary" id="rule-add">+ Правило</button>' +
      '</div>' +
      '<div class="rules-list" id="rules-list"></div>';

    els.root.querySelector('#rule-add').addEventListener('click', function () {
      openDialog(null);
    });

    els.root.querySelectorAll('.rules-filter').forEach(function (b) {
      b.addEventListener('click', function () {
        filter = b.dataset.filter;
        els.root.querySelectorAll('.rules-filter').forEach(function (x) {
          x.classList.toggle('active', x === b);
        });
        paintList();
      });
    });

    paintList();
  }

  function filterBtn(id, label, count) {
    const active = filter === id ? ' active' : '';
    return '<button type="button" class="rules-filter' + active + '" data-filter="' + id + '">' +
             label + '<span class="cnt">' + count + '</span>' +
           '</button>';
  }

  function paintList() {
    const list = els.root.querySelector('#rules-list');
    if (!list) return;

    const visible = rules.filter(function (r) {
      if (filter === 'active') return r.active;
      if (filter === 'inactive') return !r.active;
      return true;
    });

    if (!visible.length) {
      list.innerHTML = '<p class="empty">' +
        (rules.length ? 'В этом фильтре пусто.' : 'Пока нет правил. Нажми «+ Правило».') +
      '</p>';
      return;
    }

    list.innerHTML = visible.map(ruleCardHtml).join('');

    list.querySelectorAll('.rule-card').forEach(function (card) {
      card.addEventListener('click', function (e) {
        if (e.target.closest('.rule-del')) return;
        openDialog(card.dataset.id);
      });
    });

    list.querySelectorAll('.rule-del').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        const id = btn.dataset.id;
        const r = rules.find(function (x) { return x.id === id; });
        if (!r) return;
        M.confirmDialog('Удалить правило «' + U.escapeHtml(r.title || 'без названия') + '»?')
          .then(function (ok) {
            if (!ok) return;
            removeOne(r.id).then(function () {
              rules = rules.filter(function (x) { return x.id !== r.id; });
              paint();
            });
          });
      });
    });
  }

  function ruleCardHtml(r) {
    const cls = 'rule-card' + (r.active ? '' : ' inactive');
    return '' +
      '<div class="' + cls + '" data-id="' + U.escapeHtml(r.id) + '" data-tag="' + r.tag + '">' +
        '<div class="rule-title">' + U.escapeHtml(r.title || 'Без названия') + '</div>' +
        (r.body ? '<div class="rule-body">' + U.escapeHtml(r.body) + '</div>' : '') +
        '<span class="rule-status">неактивно</span>' +
        '<button class="rule-del" type="button" data-id="' + U.escapeHtml(r.id) + '" title="Удалить">✕</button>' +
      '</div>';
  }

  /* ---------- модалка ---------- */

  function openDialog(id) {
    const editing = id ? rules.find(function (r) { return r.id === id; }) : null;
    const curTag = editing ? editing.tag : 'other';
    const curActive = editing ? editing.active : true;

    M.openModal({
      title: editing ? 'Редактирование правила' : 'Новое правило',
      content:
        '<div class="grid" style="gap:14px">' +
          '<label class="field"><span class="field-label">Заголовок</span>' +
            '<input class="input" id="rule-title" type="text" value="' +
              U.escapeHtml(editing ? editing.title : '') +
            '" placeholder="Кратко, одной строкой"></label>' +

          '<label class="field"><span class="field-label">Текст правила</span>' +
            '<textarea class="input" id="rule-body" rows="6" placeholder="Опционально">' +
              U.escapeHtml(editing ? editing.body : '') +
            '</textarea></label>' +

          '<div class="field">' +
            '<span class="field-label">Категория</span>' +
            '<div class="rule-tag-picker">' +
              TAGS.map(function (t) {
                return '<label class="rule-tag-opt" data-tag="' + t.id + '">' +
                         '<input type="radio" name="rule-tag" value="' + t.id + '"' +
                           (curTag === t.id ? ' checked' : '') + '>' +
                         '<span>' + t.label + '</span>' +
                       '</label>';
              }).join('') +
            '</div>' +
          '</div>' +

          '<label class="rule-active-row">' +
            '<input type="checkbox" id="rule-active"' + (curActive ? ' checked' : '') + '>' +
            '<span class="toggle"></span>' +
            '<span>Активно</span>' +
          '</label>' +

          '<div style="display:flex;gap:8px;justify-content:flex-end">' +
            (editing ? '<button class="btn btn-danger" type="button" data-delete>Удалить</button>' : '') +
            '<button class="btn" type="button" data-cancel>Отмена</button>' +
            '<button class="btn btn-primary" type="button" data-save>' +
              (editing ? 'Сохранить' : 'Создать') +
            '</button>' +
          '</div>' +
        '</div>',

      onMount: function (body, close) {
        body.querySelector('[data-cancel]').addEventListener('click', close);

        body.querySelector('[data-save]').addEventListener('click', function () {
          const titleEl = body.querySelector('#rule-title');
          const title = titleEl.value.trim();
          if (!title) { titleEl.focus(); return; }

          const bodyVal = body.querySelector('#rule-body').value;
          const radio = body.querySelector('input[name="rule-tag"]:checked');
          const tagVal = radio ? radio.value : 'other';
          const isActive = body.querySelector('#rule-active').checked;

          if (editing) {
            editing.title = title;
            editing.body = bodyVal;
            editing.tag = tagVal;
            editing.active = isActive;
            saveOne(editing).then(function () { close(); paint(); });
          } else {
            const r = normalize({
              title: title,
              body: bodyVal,
              tag: tagVal,
              active: isActive,
              createdAt: new Date().toISOString()
            });
            saveOne(r).then(function () {
              rules.unshift(r);
              close();
              paint();
            });
          }
        });

        const del = body.querySelector('[data-delete]');
        if (del) del.addEventListener('click', function () {
          M.confirmDialog('Удалить правило «' + U.escapeHtml(editing.title || 'без названия') + '»?')
            .then(function (ok) {
              if (!ok) return;
              removeOne(editing.id).then(function () {
                rules = rules.filter(function (x) { return x.id !== editing.id; });
                close();
                paint();
              });
            });
        });
      }
    });
  }

  return { render: render };
})();