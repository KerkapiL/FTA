window.PK = window.PK || {};
PK.pages = PK.pages || {};

PK.pages.players = (function () {
  const U = PK.utils;
  const M = PK.modal;
  const S = PK.storage;
  const STORE = 'players';
  const EXP_MAX = 100;

  let players = [];
  let loaded = false;
  let editingId = null;
  let filterText = '';
  const els = { root: null };

  /* ============ МОДЕЛЬ ============ */

  function makeBlank(overrides) {
    const base = {
      id: U.uuid(),
      schemaVersion: 2,
      avatar: null,
      name: '',
      nickname: '',
      race: '',
      cls: '',
      level: 1,
      exp: 0,
      inspiration: 0,
      backstory: '',
      notes: [],
      attunement: { items: [], blessings: [], maxItems: 3, maxBlessings: 3 },
      inventory: [],
      quests: [],
      traits: [],
      tools: [],
      languages: [],
      proficiencies: [],
      gallery: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    return Object.assign(base, overrides || {});
  }

  function normalizeAttuneList(arr) {
    if (!Array.isArray(arr)) return [];
    return arr.map(function (x) {
      return {
        id: x.id || U.uuid(),
        name: String(x.name || ''),
        description: String(x.description || ''),
        attuned: !!x.attuned
      };
    });
  }

  function normalizeInventory(arr) {
    if (!Array.isArray(arr)) return [];
    return arr.map(function (x) {
      return {
        id: x.id || U.uuid(),
        kind: x.kind === 'image' ? 'image' : 'text',
        name: String(x.name || ''),
        description: String(x.description || ''),
        image: x.image || null,
        source: x.source || null
      };
    });
  }

  function normalizeQuests(arr) {
    if (!Array.isArray(arr)) return [];
    return arr.map(function (q) {
      const stages = Array.isArray(q.stages) ? q.stages.map(function (s) {
        return {
          id: s.id || U.uuid(),
          text: String(s.text || ''),
          state: (s.state === 'done' || s.state === 'fail') ? s.state : 'none'
        };
      }) : [];
      let st = q.status;
      if (st !== 'done' && st !== 'failed') st = 'active';
      return {
        id: q.id || U.uuid(),
        questId: String(q.questId || ''),
        title: String(q.title || ''),
        status: st,
        stages: stages
      };
    });
  }

  function normalizeGallery(arr) {
    if (!Array.isArray(arr)) return [];
    return arr.map(function (g) {
      return {
        id: g.id || U.uuid(),
        image: g.image || null,
        caption: String(g.caption || '')
      };
    });
  }

  function normalizeNotes(arr) {
    if (!Array.isArray(arr)) return [];
    return arr.map(function (n) {
      return {
        id: n.id || U.uuid(),
        text: String(n.text || '')
      };
    });
  }

  function normalizeChips(arr) {
    if (!Array.isArray(arr)) return [];
    return arr.filter(function (s) { return typeof s === 'string' && s.trim(); })
              .map(function (s) { return s.trim(); });
  }

  function normalize(raw) {
    if (!raw || typeof raw !== 'object') return makeBlank();
    const out = Object.assign({}, makeBlank(), raw);
    out.id = raw.id || U.uuid();
    out.name = String(raw.name || '');
    out.nickname = String(raw.nickname || '');
    out.race = String(raw.race || '');
    out.cls = String(raw.cls || '');
    out.level = Math.max(1, Number(raw.level) || 1);
    out.exp = Math.max(0, Math.min(EXP_MAX, Number(raw.exp) || 0));
    out.backstory = String(raw.backstory || '');
    out.avatar = raw.avatar || null;

    // вдохновение: раньше было массивом
    if (typeof raw.inspiration === 'number') {
      out.inspiration = Math.max(0, Math.floor(raw.inspiration));
    } else if (Array.isArray(raw.inspiration)) {
      out.inspiration = raw.inspiration.length;
    } else {
      out.inspiration = 0;
    }

    out.notes = normalizeNotes(raw.notes);

    const at = raw.attunement || {};
    out.attunement = {
      items: normalizeAttuneList(at.items),
      blessings: normalizeAttuneList(at.blessings),
      maxItems: Math.max(0, Number(at.maxItems) || 3),
      maxBlessings: Math.max(0, Number(at.maxBlessings) || 3)
    };

    out.inventory = normalizeInventory(raw.inventory);
    out.quests = normalizeQuests(raw.quests);
    out.traits = normalizeChips(raw.traits);
    out.tools = normalizeChips(raw.tools);
    out.languages = normalizeChips(raw.languages);
    out.proficiencies = normalizeChips(raw.proficiencies);
    out.gallery = normalizeGallery(raw.gallery);

    out.createdAt = raw.createdAt || out.createdAt || new Date().toISOString();
    out.updatedAt = raw.updatedAt || out.createdAt;
    out.schemaVersion = 2;
    return out;
  }

  /* ============ ХРАНЕНИЕ ============ */

  function load() {
    return S.getAll(STORE).then(function (items) {
      players = (items || []).map(normalize);
      sortPlayers();
      loaded = true;
    });
  }
  function ensureLoaded() { return loaded ? Promise.resolve() : load(); }
  function sortPlayers() {
    players.sort(function (a, b) { return (a.name || '').localeCompare(b.name || '', 'ru'); });
  }
  function saveOne(p) { return S.put(STORE, p); }
  function removeOne(id) { return S.remove(STORE, id); }

  /* ============ СПИСОК ============ */

  function render(root) {
    els.root = root;
    return ensureLoaded().then(function () {
      if (editingId) {
        const p = players.find(function (x) { return x.id === editingId; });
        if (p) return renderEditor(root, p);
        editingId = null;
      }
      renderList(root);
    });
  }

  function matchesFilter(p) {
    if (!filterText.trim()) return true;
    const q = filterText.trim().toLowerCase();
    const hay = [p.name, p.nickname, p.race, p.cls].filter(Boolean).join(' ').toLowerCase();
    return hay.indexOf(q) !== -1;
  }

  function renderList(root) {
    const filtered = players.filter(matchesFilter);

    root.innerHTML =
      '<div class="page-toolbar">' +
        '<button class="btn btn-primary" id="pl-add">+ Игрок</button>' +
        '<input class="input" id="pl-filter" type="search" placeholder="Фильтр: имя, класс, раса…" value="' + U.escapeHtml(filterText) + '">' +
        '<span class="muted">' + filtered.length + ' из ' + players.length + '</span>' +
      '</div>' +
      '<div class="players-list" id="pl-cards">' +
        (filtered.length ? filtered.map(playerCardHtml).join('')
          : '<p class="empty" style="grid-column:1/-1">Пусто. Нажми «+ Игрок».</p>') +
      '</div>';

    root.querySelector('#pl-add').addEventListener('click', openNewDialog);

    const filterInput = root.querySelector('#pl-filter');
    filterInput.addEventListener('input', U.debounce(function () {
      filterText = filterInput.value;
      renderList(root);
      const ni = root.querySelector('#pl-filter');
      if (ni) { ni.focus(); ni.setSelectionRange(ni.value.length, ni.value.length); }
    }, 150));

    root.querySelector('#pl-cards').addEventListener('click', function (e) {
      const card = e.target.closest('.player-card');
      if (!card) return;
      editingId = card.dataset.id;
      render(root);
    });
  }

  function playerCardHtml(p) {
    const initial = U.escapeHtml((p.name || '?').slice(0, 1));
    const avatarStyle = p.avatar ? ' style="background-image:url(' + p.avatar + ')"' : '';
    const subParts = [];
    if (p.race) subParts.push(p.race);
    if (p.cls) subParts.push(p.cls);
    const sub = subParts.join(' · ');
    const expPct = Math.max(0, Math.min(100, Math.round((p.exp / EXP_MAX) * 100)));

    return '<article class="player-card" data-id="' + p.id + '">' +
      '<div class="player-card-avatar"' + avatarStyle + '>' + (p.avatar ? '' : initial) + '</div>' +
      '<div class="player-card-body">' +
        '<h3 class="player-card-name">' + U.escapeHtml(p.name || 'Без имени') +
          (p.nickname ? ' <span class="player-card-nick">«' + U.escapeHtml(p.nickname) + '»</span>' : '') +
        '</h3>' +
        (sub ? '<div class="player-card-sub">' + U.escapeHtml(sub) + '</div>' : '') +
        '<div class="player-card-level">Уровень <b>' + p.level + '</b></div>' +
        '<div class="player-card-exp"><div class="player-card-exp-fill" style="width:' + expPct + '%"></div></div>' +
      '</div>' +
    '</article>';
  }

  /* ============ СОЗДАНИЕ ============ */

  function openNewDialog() {
    M.openModal({
      title: 'Новый игрок',
      content:
        '<div class="grid" style="gap:14px">' +
          '<label class="field"><span class="field-label">Имя</span>' +
            '<input class="input" id="new-pl-name" placeholder="Имя персонажа"></label>' +
          '<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:8px">' +
            '<button class="btn" data-cancel>Отмена</button>' +
            '<button class="btn btn-primary" data-create>Создать</button>' +
          '</div>' +
        '</div>',
      onMount: function (body, close) {
        const input = body.querySelector('#new-pl-name');
        setTimeout(function () { input.focus(); }, 20);
        function create() {
          const name = input.value.trim() || 'Без имени';
          const obj = makeBlank({ name: name });
          S.put(STORE, obj).then(function () {
            players.push(obj);
            sortPlayers();
            editingId = obj.id;
            close();
            render(els.root);
          });
        }
        body.querySelector('[data-cancel]').addEventListener('click', close);
        body.querySelector('[data-create]').addEventListener('click', create);
        input.addEventListener('keydown', function (e) {
          if (e.key === 'Enter') { e.preventDefault(); create(); }
        });
      }
    });
  }

  /* ============ РЕДАКТОР ============ */

  function renderEditor(root, p) {
    root.innerHTML =
      '<div class="page-toolbar">' +
        '<button class="btn" id="pl-back">← К списку</button>' +
        '<span class="muted" id="pl-save-status"></span>' +
        '<div class="spacer"></div>' +
        '<button class="btn btn-danger" id="pl-del">Удалить</button>' +
      '</div>' +

      '<form class="player-editor" id="pl-form" onsubmit="return false">' +

        '<div class="player-top">' +
          '<div class="player-left">' +
            '<label class="avatar-wrap' + (p.avatar ? '' : ' avatar-empty') + '"' +
              (p.avatar ? ' style="background-image:url(' + p.avatar + ')"' : '') + '>' +
              '<button type="button" class="avatar-clear" title="Убрать">×</button>' +
            '</label>' +
            '<input class="left-name" type="text" data-field="name" value="' + U.escapeHtml(p.name) + '" placeholder="Имя">' +
            '<input class="left-nick" type="text" data-field="nickname" value="' + U.escapeHtml(p.nickname) + '" placeholder="Прозвище">' +
            '<div class="left-row">' +
              '<input class="left-race" type="text" data-field="race" value="' + U.escapeHtml(p.race) + '" placeholder="Раса">' +
              '<input class="left-cls" type="text" data-field="cls" value="' + U.escapeHtml(p.cls) + '" placeholder="Класс">' +
            '</div>' +

            '<div class="level-block">' +
              '<div class="level-top">' +
                '<span class="level-label">Уровень</span>' +
                '<span class="level-value" id="pl-level-val">' + p.level + '</span>' +
              '</div>' +
              '<div class="exp-bar"><div class="exp-bar-fill" id="pl-exp-fill" style="width:' + Math.round(p.exp) + '%"></div></div>' +
              '<div class="exp-num" id="pl-exp-num">' + p.exp + ' / ' + EXP_MAX + '</div>' +
              '<div class="exp-controls">' +
                '<button type="button" class="exp-btn exp-btn-10" data-act="exp-minus10" title="−10 опыта">−10</button>' +
                '<button type="button" class="exp-btn" data-act="exp-minus" title="−1">−</button>' +
                '<button type="button" class="exp-btn" data-act="exp-plus" title="+1">+</button>' +
                '<button type="button" class="exp-btn exp-btn-10" data-act="exp-plus10" title="+10 опыта">+10</button>' +
                '<button type="button" class="exp-btn exp-btn-lvl" data-act="exp-levelup" title="+1 уровень">Ур.+</button>' +
              '</div>' +
            '</div>' +

            '<div class="inspiration-block">' +
              '<div class="inspiration-top">' +
                '<span class="inspiration-label">✨ Вдохновение</span>' +
              '</div>' +
              '<div class="inspiration-controls">' +
                '<button type="button" class="exp-btn" data-act="insp-minus" title="−1">−</button>' +
                '<span class="inspiration-value" id="pl-insp-val">' + p.inspiration + '</span>' +
                '<button type="button" class="exp-btn" data-act="insp-plus" title="+1">+</button>' +
              '</div>' +
            '</div>' +
          '</div>' +

          '<div class="player-right">' +
            sectionBackstory(p) +
          '</div>' +
        '</div>' +

        sectionNotes(p) +
        sectionAttunement(p) +
        sectionInventory(p) +
        sectionQuests(p) +
        sectionChips(p) +
        sectionGallery(p) +

      '</form>';

    bindEditor(root, p);
  }

  function sectionBackstory(p) {
    return '<details class="player-section" open>' +
      '<summary>🎭 Предыстория</summary>' +
      '<div class="section-body">' +
        '<textarea class="rich-input" data-field="backstory" rows="10" placeholder="Кто он, откуда пришёл, что его ведёт…">' +
          U.escapeHtml(p.backstory) + '</textarea>' +
      '</div>' +
    '</details>';
  }

  function sectionNotes(p) {
    return '<details class="player-section">' +
      '<summary>📝 Свободные заметки <span class="muted">(' + p.notes.length + ')</span></summary>' +
      '<div class="section-body">' +
        '<button type="button" class="btn btn-small" data-act="note-add" style="align-self:flex-start">+ Заметка</button>' +
        '<div class="notes-grid" data-list="notes">' +
          (p.notes.length ? p.notes.map(renderNote).join('')
            : '<div class="notes-empty">Пока пусто</div>') +
        '</div>' +
      '</div>' +
    '</details>';
  }

  function renderNote(n) {
    return '<div class="note-card" data-id="' + n.id + '">' +
      '<textarea data-act="note-text" placeholder="Заметка…">' + U.escapeHtml(n.text) + '</textarea>' +
      '<button type="button" class="note-del" data-act="note-del" title="Удалить">✕</button>' +
    '</div>';
  }

  function sectionAttunement(p) {
    return '<details class="player-section" open>' +
      '<summary>⚔ Предметы и благословения</summary>' +
      '<div class="section-body">' +
        '<div class="attune-sub">' +
          '<div class="attune-head">' +
            '<h4>Предметы</h4>' +
            '<span class="attune-counter" id="attune-items-counter">—</span>' +
            '<label class="attune-limit">Макс: <input type="number" min="0" max="20" ' +
              'data-atlimit="items" value="' + p.attunement.maxItems + '" class="attune-limit-input"></label>' +
            '<div class="spacer"></div>' +
            '<button type="button" class="btn btn-small" data-act="attune-add" data-kind="items">+ Предмет</button>' +
          '</div>' +
          '<div class="attune-list" data-list="items">' +
            renderAttuneList(p.attunement.items) +
          '</div>' +
        '</div>' +

        '<div class="attune-sub">' +
          '<div class="attune-head">' +
            '<h4>Благословения</h4>' +
            '<span class="attune-counter" id="attune-blessings-counter">—</span>' +
            '<label class="attune-limit">Макс: <input type="number" min="0" max="20" ' +
              'data-atlimit="blessings" value="' + p.attunement.maxBlessings + '" class="attune-limit-input"></label>' +
            '<div class="spacer"></div>' +
            '<button type="button" class="btn btn-small" data-act="attune-add" data-kind="blessings">+ Благословение</button>' +
          '</div>' +
          '<div class="attune-list" data-list="blessings">' +
            renderAttuneList(p.attunement.blessings) +
          '</div>' +
        '</div>' +
      '</div>' +
    '</details>';
  }

  function renderAttuneList(list) {
    if (!list.length) return '<div class="attune-empty">Пока пусто</div>';
    return list.map(function (it) {
      return '<div class="attune-item" data-id="' + it.id + '">' +
        '<label class="attune-check" title="Настроен">' +
          '<input type="checkbox" data-act="attune-toggle"' + (it.attuned ? ' checked' : '') + '>' +
          '<span class="attune-check-box"></span>' +
        '</label>' +
        '<input type="text" data-act="attune-name" value="' + U.escapeHtml(it.name) + '" placeholder="Название">' +
        '<input type="text" data-act="attune-desc" value="' + U.escapeHtml(it.description) + '" placeholder="Описание">' +
        '<button type="button" class="btn btn-icon btn-danger" data-act="attune-del" title="Удалить">✕</button>' +
      '</div>';
    }).join('');
  }

  function sectionInventory(p) {
    return '<details class="player-section">' +
      '<summary>🎒 Инвентарь <span class="muted">(' + p.inventory.length + ')</span></summary>' +
      '<div class="section-body">' +
        '<button type="button" class="btn btn-small" data-act="inv-add" style="align-self:flex-start">+ Добавить вручную</button>' +
        '<div class="inv-grid" data-list="inventory">' +
          (p.inventory.length ? p.inventory.map(renderInvItem).join('')
            : '<div class="inv-empty">Пока пусто. Предметы приходят из Лора или добавь вручную.</div>') +
        '</div>' +
      '</div>' +
    '</details>';
  }

  function renderInvItem(it) {
    if (it.kind === 'image' && it.image) {
      return '<div class="inv-item inv-item-img" data-id="' + it.id + '">' +
        '<div class="inv-img-wrap" style="background-image:url(' + it.image + ')" data-act="inv-img-open"></div>' +
        (it.name ? '<div class="inv-item-name">' + U.escapeHtml(it.name) + '</div>' : '') +
        '<button type="button" class="inv-del" data-act="inv-del" title="Удалить">✕</button>' +
      '</div>';
    }
    return '<div class="inv-item inv-item-text clickable" data-id="' + it.id + '" ' +
        'data-act="inv-open" title="Открыть описание">' +
      '<div class="inv-item-name">' + U.escapeHtml(it.name || 'Без названия') + '</div>' +
      (it.description ? '<div class="inv-item-desc">' + U.escapeHtml(it.description) + '</div>' : '') +
      '<button type="button" class="inv-del" data-act="inv-del" title="Удалить">✕</button>' +
    '</div>';
  }

  function sectionQuests(p) {
    return '<details class="player-section">' +
      '<summary>📜 Квесты <span class="muted">(' + p.quests.length + ')</span></summary>' +
      '<div class="section-body">' +
        '<button type="button" class="btn btn-small" data-act="pq-add" style="align-self:flex-start">+ Взять квест</button>' +
        '<div class="pq-grid" data-list="quests">' +
          (p.quests.length ? p.quests.map(renderPlayerQuest).join('')
            : '<div class="pq-empty">Квестов нет</div>') +
        '</div>' +
      '</div>' +
    '</details>';
  }

  function renderPlayerQuest(q) {
    const stages = q.stages || [];
    const doneCount = stages.filter(function (s) { return s.state === 'done'; }).length;
    return '<div class="pq-item" data-id="' + q.id + '" data-status="' + q.status + '">' +
      '<div class="pq-head">' +
        '<span class="pq-title" data-act="pq-open" title="Открыть квест">' + U.escapeHtml(q.title || 'Без названия') + '</span>' +
        '<span class="pq-badge">' +
          (q.status === 'done' ? 'выполнен' : (q.status === 'failed' ? 'провален' : 'активен')) +
        '</span>' +
        '<button type="button" class="btn btn-icon btn-danger" data-act="pq-del" title="Убрать">✕</button>' +
      '</div>' +
      (stages.length
        ? '<div class="pq-progress">' + doneCount + '/' + stages.length + '</div>'
        : '') +
    '</div>';
  }

  function sectionChips(p) {
    const subs = [
      { key: 'traits',        label: 'Черты' },
      { key: 'tools',         label: 'Инструменты' },
      { key: 'languages',     label: 'Языки' },
      { key: 'proficiencies', label: 'Владения' }
    ];
    return '<details class="player-section">' +
      '<summary>📋 Навыки и особенности</summary>' +
      '<div class="section-body">' +
        subs.map(function (s) {
          return '<div class="chips-block">' +
            '<div class="chips-head"><h4>' + s.label + '</h4></div>' +
            '<div class="chips-list" data-chips="' + s.key + '">' +
              (p[s.key] || []).map(function (v) {
                return '<span class="chip"><span>' + U.escapeHtml(v) + '</span>' +
                  '<button type="button" class="chip-x" data-act="chip-del" data-key="' + s.key + '" title="Удалить">×</button>' +
                '</span>';
              }).join('') +
            '</div>' +
            '<input type="text" class="chips-input" data-act="chip-input" data-key="' + s.key + '" placeholder="Введи и нажми Enter">' +
          '</div>';
        }).join('') +
      '</div>' +
    '</details>';
  }

  function sectionGallery(p) {
    return '<details class="player-section">' +
      '<summary>🖼 Галерея <span class="muted">(' + p.gallery.length + ')</span></summary>' +
      '<div class="section-body">' +
        '<div class="gallery-grid" data-list="gallery">' +
          p.gallery.map(renderGalleryItem).join('') +
          '<div class="gallery-cell add" data-act="gallery-add" title="Добавить фото">+</div>' +
        '</div>' +
      '</div>' +
    '</details>';
  }

  function renderGalleryItem(g) {
    const bg = g.image ? ' style="background-image:url(' + g.image + ')"' : '';
    return '<div class="gallery-item" data-id="' + g.id + '">' +
      '<div class="gallery-thumb" data-act="gallery-open"' + bg + '></div>' +
      '<input class="gallery-caption" data-act="gallery-caption" value="' + U.escapeHtml(g.caption) + '" placeholder="Подпись">' +
      '<button type="button" class="gallery-del" data-act="gallery-del" title="Удалить">✕</button>' +
    '</div>';
  }

  /* ============ BIND РЕДАКТОРА ============ */

  function bindEditor(root, p) {
    const form = root.querySelector('#pl-form');
    const status = root.querySelector('#pl-save-status');

    const doSave = U.debounce(function () {
      p.updatedAt = new Date().toISOString();
      S.put(STORE, p).then(function () {
        if (status) status.textContent = 'Сохранено ' + new Date().toLocaleTimeString('ru-RU');
      });
    }, 400);

    root.querySelector('#pl-back').addEventListener('click', function () {
      editingId = null;
      render(root);
    });

    root.querySelector('#pl-del').addEventListener('click', function () {
      M.confirmDialog('Удалить игрока «' + U.escapeHtml(p.name) + '»?').then(function (ok) {
        if (!ok) return;
        removeOne(p.id).then(function () {
          players = players.filter(function (x) { return x.id !== p.id; });
          editingId = null;
          render(root);
        });
      });
    });

    /* аватар */
    const avatarWrap = root.querySelector('.avatar-wrap');
    if (avatarWrap) {
      avatarWrap.addEventListener('click', function (e) {
        if (e.target.classList.contains('avatar-clear')) return;
        pickImage(function (dataUrl) {
          p.avatar = dataUrl;
          avatarWrap.style.backgroundImage = 'url(' + dataUrl + ')';
          avatarWrap.classList.remove('avatar-empty');
          doSave();
        });
      });
      avatarWrap.querySelector('.avatar-clear').addEventListener('click', function (e) {
        e.stopPropagation();
        p.avatar = null;
        avatarWrap.style.backgroundImage = '';
        avatarWrap.classList.add('avatar-empty');
        doSave();
      });
    }

    /* ввод */
    form.addEventListener('input', function (e) {
      const t = e.target;

      if (t.matches('[data-field]')) {
        p[t.dataset.field] = t.value;
        doSave();
        return;
      }

      const attuneItem = t.closest ? t.closest('.attune-item') : null;
      if (attuneItem && (t.matches('[data-act="attune-name"]') || t.matches('[data-act="attune-desc"]'))) {
        const id = attuneItem.dataset.id;
        const kind = attuneItem.closest('.attune-list').dataset.list;
        const item = p.attunement[kind].find(function (x) { return x.id === id; });
        if (!item) return;
        if (t.matches('[data-act="attune-name"]')) item.name = t.value;
        else item.description = t.value;
        doSave();
        return;
      }

      if (t.matches('[data-atlimit]')) {
        const k = t.dataset.atlimit === 'items' ? 'maxItems' : 'maxBlessings';
        p.attunement[k] = Math.max(0, Number(t.value) || 0);
        doSave();
        updateAttuneCounters(root, p);
        return;
      }

      if (t.matches('[data-act="note-text"]')) {
        const card = t.closest('.note-card');
        const n = p.notes.find(function (x) { return x.id === card.dataset.id; });
        if (n) { n.text = t.value; doSave(); }
        return;
      }

      const gal = t.closest ? t.closest('.gallery-item') : null;
      if (gal && t.matches('[data-act="gallery-caption"]')) {
        const g = p.gallery.find(function (x) { return x.id === gal.dataset.id; });
        if (g) { g.caption = t.value; doSave(); }
        return;
      }
    });

    /* Enter в chips */
    form.addEventListener('keydown', function (e) {
      const t = e.target;
      if (t.matches('[data-act="chip-input"]') && e.key === 'Enter') {
        e.preventDefault();
        const key = t.dataset.key;
        const val = t.value.trim();
        if (!val) return;
        p[key].push(val);
        t.value = '';
        doSave();
        const list = root.querySelector('[data-chips="' + key + '"]');
        if (list) {
          const chip = document.createElement('span');
          chip.className = 'chip';
          chip.innerHTML = '<span>' + U.escapeHtml(val) + '</span>' +
            '<button type="button" class="chip-x" data-act="chip-del" data-key="' + key + '" title="Удалить">×</button>';
          list.appendChild(chip);
        }
      }
    });

    /* клики */
    form.addEventListener('click', function (e) {
      const t = e.target.closest ? e.target.closest('[data-act]') : null;
      if (!t) return;
      const act = t.dataset.act;

      /* опыт */
      if (act === 'exp-plus')       { addExp(p, 1);  updateExpUI(root, p); doSave(); return; }
      if (act === 'exp-minus')      { addExp(p, -1); updateExpUI(root, p); doSave(); return; }
      if (act === 'exp-plus10')     { addExp(p, 10); updateExpUI(root, p); doSave(); return; }
      if (act === 'exp-minus10')    { addExp(p, -10); updateExpUI(root, p); doSave(); return; }
      if (act === 'exp-levelup')    { addExp(p, EXP_MAX - p.exp); updateExpUI(root, p); doSave(); return; }

      /* вдохновение */
      if (act === 'insp-plus') {
        p.inspiration = (Number(p.inspiration) || 0) + 1;
        updateInspUI(root, p); doSave(); return;
      }
      if (act === 'insp-minus') {
        p.inspiration = Math.max(0, (Number(p.inspiration) || 0) - 1);
        updateInspUI(root, p); doSave(); return;
      }

      /* заметки */
      if (act === 'note-add') {
        const n = { id: U.uuid(), text: '' };
        p.notes.push(n);
        doSave();
        const grid = root.querySelector('[data-list="notes"]');
        if (grid) {
          const empty = grid.querySelector('.notes-empty');
          if (empty) empty.remove();
          const tmp = document.createElement('div');
          tmp.innerHTML = renderNote(n);
          const card = tmp.firstChild;
          grid.appendChild(card);
          const ta = card.querySelector('textarea');
          if (ta) ta.focus();
        }
        return;
      }
      if (act === 'note-del') {
        const card = t.closest('.note-card');
        const id = card.dataset.id;
        p.notes = p.notes.filter(function (x) { return x.id !== id; });
        card.remove();
        const grid = root.querySelector('[data-list="notes"]');
        if (grid && !grid.querySelector('.note-card')) {
          grid.innerHTML = '<div class="notes-empty">Пока пусто</div>';
        }
        doSave();
        return;
      }

      /* attunement */
      if (act === 'attune-add') {
        const kind = t.dataset.kind;
        p.attunement[kind].push({ id: U.uuid(), name: '', description: '', attuned: false });
        doSave();
        const list = root.querySelector('.attune-list[data-list="' + kind + '"]');
        if (list) list.innerHTML = renderAttuneList(p.attunement[kind]);
        updateAttuneCounters(root, p);
        const rows = root.querySelectorAll('.attune-list[data-list="' + kind + '"] .attune-item');
        const last = rows[rows.length - 1];
        if (last) last.querySelector('[data-act="attune-name"]').focus();
        return;
      }
      if (act === 'attune-del') {
        const row = t.closest('.attune-item');
        const id = row.dataset.id;
        const kind = row.closest('.attune-list').dataset.list;
        p.attunement[kind] = p.attunement[kind].filter(function (x) { return x.id !== id; });
        row.remove();
        const list = root.querySelector('.attune-list[data-list="' + kind + '"]');
        if (list && !list.querySelector('.attune-item')) list.innerHTML = renderAttuneList([]);
        doSave();
        updateAttuneCounters(root, p);
        return;
      }

      /* inventory */
      if (act === 'inv-add') {
        openAddInventoryDialog(p, function () {
          const grid = root.querySelector('[data-list="inventory"]');
          if (grid) grid.innerHTML = p.inventory.length
            ? p.inventory.map(renderInvItem).join('')
            : '<div class="inv-empty">Пока пусто.</div>';
        });
        return;
      }
      if (act === 'inv-del') {
        const row = t.closest('.inv-item');
        const id = row.dataset.id;
        p.inventory = p.inventory.filter(function (x) { return x.id !== id; });
        row.remove();
        const grid = root.querySelector('[data-list="inventory"]');
        if (grid && !grid.querySelector('.inv-item')) grid.innerHTML = '<div class="inv-empty">Пока пусто.</div>';
        doSave();
        return;
      }
      if (act === 'inv-img-open') {
        const row = t.closest('.inv-item');
        const id = row.dataset.id;
        const it = p.inventory.find(function (x) { return x.id === id; });
        if (it && it.image && window.LoreRender && window.LoreRender.showImageModal) {
          window.LoreRender.showImageModal(it.image, { title: it.name || 'Предмет' });
        }
        return;
      }
      if (act === 'inv-open') {
        const row = t.closest('.inv-item');
        if (!row) return;
        const id = row.dataset.id;
        const it = p.inventory.find(function (x) { return x.id === id; });
        if (it) openItemModal(it);
        return;
      }

      /* quests */
      if (act === 'pq-add') {
        openQuestPicker(p, function () {
          const grid = root.querySelector('[data-list="quests"]');
          if (grid) grid.innerHTML = p.quests.length
            ? p.quests.map(renderPlayerQuest).join('')
            : '<div class="pq-empty">Квестов нет</div>';
        });
        return;
      }
      if (act === 'pq-del') {
        e.stopPropagation();
        const row = t.closest('.pq-item');
        const id = row.dataset.id;
        p.quests = p.quests.filter(function (x) { return x.id !== id; });
        row.remove();
        const grid = root.querySelector('[data-list="quests"]');
        if (grid && !grid.querySelector('.pq-item')) grid.innerHTML = '<div class="pq-empty">Квестов нет</div>';
        doSave();
        return;
      }
      if (act === 'pq-open') {
        const row = t.closest('.pq-item');
        const id = row.dataset.id;
        const q = p.quests.find(function (x) { return x.id === id; });
        if (!q) return;
        openPlayerQuestModal(p, q, function () {
          const grid = root.querySelector('[data-list="quests"]');
          if (grid) grid.innerHTML = p.quests.map(renderPlayerQuest).join('');
        });
        return;
      }

      /* chips */
      if (act === 'chip-del') {
        const key = t.dataset.key;
        const chip = t.closest('.chip');
        const val = chip.querySelector('span').textContent;
        p[key] = p[key].filter(function (x) { return x !== val; });
        chip.remove();
        doSave();
        return;
      }

      /* gallery */
      if (act === 'gallery-add') {
        const newImg = { id: U.uuid(), image: null, caption: '' };
        p.gallery.push(newImg);
        doSave();
        pickImage(function (dataUrl) {
          newImg.image = dataUrl;
          doSave();
          const grid = root.querySelector('[data-list="gallery"]');
          if (grid) {
            const addCell = grid.querySelector('.gallery-cell.add');
            const tmp = document.createElement('div');
            tmp.innerHTML = renderGalleryItem(newImg);
            addCell.before(tmp.firstChild);
          }
        }, { maxWidth: 2000, quality: 0.92 });
        return;
      }
      if (act === 'gallery-del') {
        const item = t.closest('.gallery-item');
        const id = item.dataset.id;
        p.gallery = p.gallery.filter(function (x) { return x.id !== id; });
        item.remove();
        doSave();
        return;
      }
      if (act === 'gallery-open') {
        const item = t.closest('.gallery-item');
        const id = item.dataset.id;
        const g = p.gallery.find(function (x) { return x.id === id; });
        if (g && g.image && window.LoreRender && window.LoreRender.showImageModal) {
          window.LoreRender.showImageModal(g.image, { title: g.caption || 'Фото' });
        }
        return;
      }
    });

    /* change */
    form.addEventListener('change', function (e) {
      const t = e.target;

      if (t.matches('[data-act="attune-toggle"]')) {
        const row = t.closest('.attune-item');
        const kind = row.closest('.attune-list').dataset.list;
        const id = row.dataset.id;
        const item = p.attunement[kind].find(function (x) { return x.id === id; });
        if (!item) return;
        const max = kind === 'items' ? p.attunement.maxItems : p.attunement.maxBlessings;
        const count = p.attunement[kind].filter(function (x) { return x.attuned; }).length;
        if (t.checked && count >= max) {
          t.checked = false;
          alert('Достигнут лимит настроек: ' + max + '. Снимите одну или увеличьте лимит.');
          return;
        }
        item.attuned = t.checked;
        doSave();
        updateAttuneCounters(root, p);
        return;
      }
    });

    updateAttuneCounters(root, p);
  }

  /* ============ ХЕЛПЕРЫ ============ */

  function addExp(p, delta) {
    let cur = Number(p.exp) || 0;
    let lvl = Number(p.level) || 1;
    cur += delta;
    while (cur >= EXP_MAX) { cur -= EXP_MAX; lvl++; }
    while (cur < 0) {
      if (lvl > 1) { lvl--; cur += EXP_MAX; }
      else { cur = 0; break; }
    }
    p.exp = cur;
    p.level = lvl;
  }

  function updateExpUI(root, p) {
    const fill = root.querySelector('#pl-exp-fill');
    const num = root.querySelector('#pl-exp-num');
    const lvl = root.querySelector('#pl-level-val');
    if (fill) fill.style.width = Math.round(p.exp) + '%';
    if (num) num.textContent = p.exp + ' / ' + EXP_MAX;
    if (lvl) lvl.textContent = p.level;
  }

  function updateInspUI(root, p) {
    const el = root.querySelector('#pl-insp-val');
    if (el) el.textContent = p.inspiration;
  }

  function updateAttuneCounters(root, p) {
    ['items', 'blessings'].forEach(function (kind) {
      const list = p.attunement[kind];
      const max = kind === 'items' ? p.attunement.maxItems : p.attunement.maxBlessings;
      const count = list.filter(function (x) { return x.attuned; }).length;
      const counter = root.querySelector('#attune-' + kind + '-counter');
      if (counter) {
        counter.textContent = count + ' / ' + max;
        counter.classList.toggle('over', count > max);
      }
      root.querySelectorAll('.attune-list[data-list="' + kind + '"] .attune-item').forEach(function (row) {
        const id = row.dataset.id;
        const item = list.find(function (x) { return x.id === id; });
        if (!item) return;
        const cb = row.querySelector('[data-act="attune-toggle"]');
        if (!cb) return;
        cb.disabled = !item.attuned && count >= max;
      });
    });
  }

  /* ============ ДОБАВЛЕНИЕ В ИНВЕНТАРЬ ============ */

  function openAddInventoryDialog(p, onDone) {
    let kind = 'text';
    let imageData = '';

    M.openModal({
      title: 'Новый предмет',
      content:
        '<div class="grid" style="gap:12px">' +
          '<div class="reward-mode-row" id="inv-mode-row">' +
            '<button type="button" class="reward-mode-btn active" data-mode="text">Текст</button>' +
            '<button type="button" class="reward-mode-btn" data-mode="image">Картинка</button>' +
          '</div>' +
          '<label class="field"><span class="field-label">Название</span>' +
            '<input class="input" id="inv-name" placeholder="Название предмета"></label>' +
          '<label class="field" id="inv-desc-wrap"><span class="field-label">Описание</span>' +
            '<textarea class="input" id="inv-desc" rows="4" placeholder="Описание"></textarea></label>' +
          '<div id="inv-img-wrap-holder"></div>' +
          '<div style="display:flex;gap:8px;justify-content:flex-end">' +
            '<button class="btn" data-cancel>Отмена</button>' +
            '<button class="btn btn-primary" data-save>Добавить</button>' +
          '</div>' +
        '</div>',
      onMount: function (body, close) {
        const modeRow = body.querySelector('#inv-mode-row');
        const descWrap = body.querySelector('#inv-desc-wrap');
        const imgHolder = body.querySelector('#inv-img-wrap-holder');

        function paint() {
          modeRow.querySelectorAll('.reward-mode-btn').forEach(function (b) {
            b.classList.toggle('active', b.dataset.mode === kind);
          });
          descWrap.style.display = kind === 'text' ? '' : 'none';
          if (kind === 'image') {
            const has = !!imageData;
            imgHolder.innerHTML =
              '<div class="reward-img-wrap' + (has ? '' : ' empty') + '" id="inv-img-wrap"' +
                (has ? ' style="background-image:url(\'' + imageData + '\')"' : '') + '>' +
                (has ? '' : '<span class="reward-img-hint">🖼 Нажми, чтобы выбрать картинку</span>') +
              '</div>' +
              '<input type="file" id="inv-img-file" accept="image/*" style="display:none">' +
              (has ? '<button class="btn btn-small" type="button" id="inv-img-clear" ' +
                     'style="margin-top:6px">Убрать картинку</button>' : '');
            const wrap = imgHolder.querySelector('#inv-img-wrap');
            const fileInput = imgHolder.querySelector('#inv-img-file');
            wrap.addEventListener('click', function () { fileInput.click(); });
            fileInput.addEventListener('change', function () {
              const f = fileInput.files && fileInput.files[0];
              if (!f) return;
              U.compressImage(f, 900, 0.85).then(function (dataUrl) {
                imageData = dataUrl; paint();
              }).catch(function (err) { alert('Не удалось загрузить: ' + err.message); });
            });
            const clr = imgHolder.querySelector('#inv-img-clear');
            if (clr) clr.addEventListener('click', function () { imageData = ''; paint(); });
          } else {
            imgHolder.innerHTML = '';
          }
        }

        modeRow.querySelectorAll('.reward-mode-btn').forEach(function (b) {
          b.addEventListener('click', function () {
            kind = b.dataset.mode;
            paint();
          });
        });
        paint();

        body.querySelector('[data-cancel]').addEventListener('click', close);
        body.querySelector('[data-save]').addEventListener('click', function () {
          const name = body.querySelector('#inv-name').value.trim();
          if (!name) { body.querySelector('#inv-name').focus(); return; }
          const item = {
            id: U.uuid(),
            kind: kind,
            name: name,
            description: kind === 'text' ? body.querySelector('#inv-desc').value : '',
            image: kind === 'image' ? imageData : null,
            source: null
          };
          p.inventory.push(item);
          p.updatedAt = new Date().toISOString();
          S.put(STORE, p).then(function () {
            close();
            if (onDone) onDone();
          });
        });
      }
    });
  }
  
  function openItemModal(it) {
    M.openModal({
      title: it.name || 'Предмет',
      wide: false,
      content:
        '<div class="inv-modal">' +
          (it.image ? '<div class="inv-modal-img" style="background-image:url(' + it.image + ')"></div>' : '') +
          (it.description
            ? '<div class="inv-modal-desc rich">' + U.renderRichText(it.description) + '</div>'
            : '<div class="inv-modal-desc muted">Описание пустое.</div>') +
          '<div style="display:flex;justify-content:flex-end">' +
            '<button class="btn" data-close>Закрыть</button>' +
          '</div>' +
        '</div>',
      onMount: function (body, close) {
        body.querySelector('[data-close]').addEventListener('click', close);
      }
    });
  }

  /* ============ МОДАЛКА КВЕСТА ИГРОКА ============ */

  function openPlayerQuestModal(p, pq, onChange) {
    S.getOne('quests', pq.questId).then(function (gq) {
      const desc = gq && gq.body ? gq.body : '';
      const descHtml = desc
        ? '<div class="pq-modal-desc rich">' + U.renderRichText(desc) + '</div>'
        : '<div class="pq-modal-desc muted">Описание недоступно (квест удалён из общего списка).</div>';

      M.openModal({
        title: (pq.title || (gq && gq.title) || 'Квест'),
        wide: true,
        content:
          '<div class="pq-modal">' +
            '<div class="pq-modal-row">' +
              '<label class="field" style="max-width:220px"><span class="field-label">Статус</span>' +
                '<select class="input" id="pq-modal-status">' +
                  '<option value="active"' + (pq.status === 'active' ? ' selected' : '') + '>Активен</option>' +
                  '<option value="done"' + (pq.status === 'done' ? ' selected' : '') + '>Выполнен</option>' +
                  '<option value="failed"' + (pq.status === 'failed' ? ' selected' : '') + '>Провален</option>' +
                '</select>' +
              '</label>' +
            '</div>' +
            descHtml +
            '<div class="field"><span class="field-label">Этапы</span>' +
              '<div class="pq-modal-stages" id="pq-modal-stages">' +
                renderModalStages(pq.stages) +
              '</div>' +
            '</div>' +
            '<div style="display:flex;gap:8px;justify-content:flex-end">' +
              '<button class="btn" data-close>Закрыть</button>' +
            '</div>' +
          '</div>',
        onMount: function (body, close) {
          const stagesEl = body.querySelector('#pq-modal-stages');
          const statusSel = body.querySelector('#pq-modal-status');

          stagesEl.addEventListener('click', function (e) {
            const row = e.target.closest('.pq-modal-stage');
            if (!row) return;
            const sid = row.dataset.sid;
            const st = (pq.stages || []).find(function (x) { return x.id === sid; });
            if (!st) return;
            st.state = st.state === 'none' ? 'done' : (st.state === 'done' ? 'fail' : 'none');
            stagesEl.innerHTML = renderModalStages(pq.stages);
            p.updatedAt = new Date().toISOString();
            S.put(STORE, p).then(function () {
              if (onChange) onChange();
            });
          });

          statusSel.addEventListener('change', function () {
            pq.status = statusSel.value;
            p.updatedAt = new Date().toISOString();
            S.put(STORE, p).then(function () {
              if (onChange) onChange();
            });
          });

          body.querySelector('[data-close]').addEventListener('click', close);
        }
      });
    });
  }

  function renderModalStages(stages) {
    if (!stages || !stages.length) {
      return '<div class="muted" style="font-size:12px;font-style:italic;padding:6px 0">Этапов нет</div>';
    }
    return stages.map(function (s) {
      const mark = s.state === 'done' ? '✓' : (s.state === 'fail' ? '✕' : '');
      return '<div class="pq-modal-stage" data-state="' + s.state + '" data-sid="' + s.id + '" title="Клик — отметить">' +
        '<span class="pq-modal-stage-mark">' + mark + '</span>' +
        '<span class="pq-modal-stage-text">' + U.escapeHtml(s.text) + '</span>' +
      '</div>';
    }).join('');
  }

  /* ============ ВЫБОР КВЕСТА ============ */

  function openQuestPicker(p, onDone) {
    S.getAll('quests').then(function (items) {
      const globalQuests = (items || []).filter(function (q) { return q && q.id; });
      if (!globalQuests.length) {
        M.openModal({
          title: 'Квестов нет',
          content: '<p style="margin:0">Сначала создай квесты в разделе «Квесты».</p>'
        });
        return;
      }
      const already = {};
      p.quests.forEach(function (q) { already[q.questId] = true; });
      const available = globalQuests.filter(function (q) { return !already[q.id]; });

      if (!available.length) {
        M.openModal({
          title: 'Все квесты уже назначены',
          content: '<p style="margin:0">У этого игрока уже есть все существующие квесты.</p>'
        });
        return;
      }

      M.openModal({
        title: 'Выбрать квест',
        wide: true,
        content:
          '<div style="display:flex;flex-direction:column;gap:4px;max-height:60vh;overflow:auto">' +
            available.map(function (q) {
              return '<button type="button" class="btn" data-qid="' + U.escapeHtml(q.id) + '" ' +
                'style="justify-content:space-between;text-align:left">' +
                '<span>' + U.escapeHtml(q.title || 'Без названия') + '</span>' +
                (q.giver ? '<span class="muted" style="font-size:11px">от ' + U.escapeHtml(q.giver) + '</span>' : '') +
              '</button>';
            }).join('') +
          '</div>',
        onMount: function (body, close) {
          body.querySelectorAll('[data-qid]').forEach(function (b) {
            b.addEventListener('click', function () {
              const qid = b.dataset.qid;
              const g = globalQuests.find(function (x) { return x.id === qid; });
              if (!g) return;
              const stages = Array.isArray(g.stages) ? g.stages.map(function (s) {
                return { id: s.id || U.uuid(), text: String(s.text || ''), state: 'none' };
              }) : [];
              p.quests.push({
                id: U.uuid(),
                questId: g.id,
                title: String(g.title || ''),
                status: 'active',
                stages: stages
              });
              p.updatedAt = new Date().toISOString();
              S.put(STORE, p).then(function () {
                close();
                if (onDone) onDone();
              });
            });
          });
        }
      });
    });
  }

  /* ============ ВЫБОР КАРТИНКИ ============ */

  function pickImage(cb, opts) {
    opts = opts || {};
    const maxW = opts.maxWidth || 2000;
    const quality = opts.quality || 0.92;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.addEventListener('change', function () {
      const f = input.files && input.files[0];
      if (!f) return;
      U.compressImage(f, maxW, quality).then(cb).catch(function (err) {
        alert('Не получилось загрузить: ' + err.message);
      });
    });
    input.click();
  }

  /* ============ API ДЛЯ ЛОРА ============ */

  function giveItemToPlayer(item) {
    return ensureLoaded().then(function () {
      if (!players.length) {
        M.openModal({
          title: 'Нет игроков',
          content: '<p style="margin:0">Сначала создай игрока в разделе «Игроки».</p>'
        });
        return;
      }
      M.openModal({
        title: 'Кому передать предмет?',
        content:
          '<div class="players-pick-grid">' +
            players.map(function (p) {
              const initial = U.escapeHtml((p.name || '?').slice(0, 1));
              const av = p.avatar ? ' style="background-image:url(' + p.avatar + ')"' : '';
              return '<button type="button" class="player-pick-card" data-pid="' + p.id + '">' +
                '<div class="player-pick-avatar"' + av + '>' + (p.avatar ? '' : initial) + '</div>' +
                '<div class="player-pick-name">' + U.escapeHtml(p.name || 'Без имени') + '</div>' +
              '</button>';
            }).join('') +
          '</div>',
        onMount: function (body, close) {
          body.querySelectorAll('[data-pid]').forEach(function (b) {
            b.addEventListener('click', function () {
              const pid = b.dataset.pid;
              const target = players.find(function (x) { return x.id === pid; });
              if (!target) return;
              const itemCopy = {
                id: U.uuid(),
                kind: item.kind === 'image' ? 'image' : 'text',
                name: String(item.name || ''),
                description: String(item.description || ''),
                image: item.image || null,
                source: item.source || null
              };
              target.inventory = target.inventory || [];
              target.inventory.push(itemCopy);
              target.updatedAt = new Date().toISOString();
              saveOne(target).then(function () {
                close();
                alert('Предмет «' + (item.name || 'без названия') + '» добавлен в инвентарь игрока ' + target.name);
              });
            });
          });
        }
      });
    });
  }

  function assignQuestToPlayer(globalQuest, onDone) {
    return ensureLoaded().then(function () {
      if (!players.length) {
        M.openModal({
          title: 'Нет игроков',
          content: '<p style="margin:0">Сначала создай игрока в разделе «Игроки».</p>'
        });
        return;
      }
      M.openModal({
        title: 'Выдать квест игроку',
        content:
          '<div class="players-pick-grid">' +
            players.map(function (p) {
              const initial = U.escapeHtml((p.name || '?').slice(0, 1));
              const av = p.avatar ? ' style="background-image:url(' + p.avatar + ')"' : '';
              const has = (p.quests || []).some(function (q) { return q.questId === globalQuest.id; });
              return '<button type="button" class="player-pick-card" data-pid="' + p.id + '"' +
                  (has ? ' disabled' : '') + '>' +
                '<div class="player-pick-avatar"' + av + '>' + (p.avatar ? '' : initial) + '</div>' +
                '<div class="player-pick-name">' + U.escapeHtml(p.name || 'Без имени') + '</div>' +
                (has ? '<div class="muted" style="font-size:10px">уже взят</div>' : '') +
              '</button>';
            }).join('') +
          '</div>',
        onMount: function (body, close) {
          body.querySelectorAll('[data-pid]:not([disabled])').forEach(function (b) {
            b.addEventListener('click', function () {
              const pid = b.dataset.pid;
              const target = players.find(function (x) { return x.id === pid; });
              if (!target) return;
              const stages = Array.isArray(globalQuest.stages) ? globalQuest.stages.map(function (s) {
                return { id: s.id || U.uuid(), text: String(s.text || ''), state: 'none' };
              }) : [];
              target.quests = target.quests || [];
              target.quests.push({
                id: U.uuid(),
                questId: globalQuest.id,
                title: String(globalQuest.title || ''),
                status: 'active',
                stages: stages
              });
              target.updatedAt = new Date().toISOString();
              saveOne(target).then(function () {
                if (!globalQuest.assignee) {
                  globalQuest.assignee = target.name;
                  globalQuest.assigneePlayerId = target.id;
                  S.put('quests', globalQuest);
                }
                close();
                if (onDone) onDone(target);
              });
            });
          });
        }
      });
    });
  }

  return {
    render: render,
    giveItemToPlayer: giveItemToPlayer,
    assignQuestToPlayer: assignQuestToPlayer
  };
})();