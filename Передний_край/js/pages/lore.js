window.PK = window.PK || {};
PK.pages = PK.pages || {};

PK.pages.lore = (function () {
  const U = PK.utils;
  const M = PK.modal;
  const S = PK.storage;
  const LR = window.LoreRender;
  const STORE = 'lore';

  /* ============ МОДЕЛЬ ============ */

  function newLocation(name) {
    return {
      id: LR.uid('loc'),
      name: name || 'Новая локация',
      description: '',
      npcs: [],
      items: [],
      notes: '',
      gallery: [],
      _open: true
    };
  }

  function makeBlank(overrides) {
    const base = {
      id: U.uuid(),
      schemaVersion: 2,
      avatar: null,
      name: 'Новое место',
      subtitle: '',
      arc: '',
      events: '',
      notes: '',
      tags: [],
      locations: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    return Object.assign(base, overrides || {});
  }

  function normalizeLocation(raw) {
    raw = raw || {};
    return {
      id: raw.id || LR.uid('loc'),
      name: raw.name != null ? String(raw.name) : '',
      description: raw.description != null ? String(raw.description) : '',
      npcs: Array.isArray(raw.npcs) ? raw.npcs.map(function (n) {
        return {
          id: n.id || LR.uid('npc'),
          name: n.name != null ? String(n.name) : '',
          description: n.description != null ? String(n.description) : ''
        };
      }) : [],
      items: Array.isArray(raw.items) ? raw.items.map(function (i) {
        return {
          id: i.id || LR.uid('itm'),
          kind: i.kind === 'image' ? 'image' : 'text',
          name: i.name != null ? String(i.name) : '',
          description: i.description != null ? String(i.description) : '',
          image: i.image || null
        };
      }) : [],
      notes: raw.notes != null ? String(raw.notes) : '',
      gallery: Array.isArray(raw.gallery) ? raw.gallery.map(function (g) {
        return {
          id: g.id || LR.uid('img'),
          image: g.image || null,
          caption: g.caption != null ? String(g.caption) : ''
        };
      }) : [],
      _open: !!raw._open
    };
  }

  /* Миграция старого плоского формата (locations/npcs/items на уровне города). */
  function migrateLocations(old) {
    const oldLocs = Array.isArray(old.locations) ? old.locations : [];
    const oldNpcs = Array.isArray(old.npcs) ? old.npcs : [];
    const oldItems = Array.isArray(old.items) ? old.items : [];

    // Если уже новая схема — просто нормализуем.
    const looksNew = oldLocs.some(function (l) {
      return l && (Array.isArray(l.npcs) || Array.isArray(l.items) || Array.isArray(l.gallery));
    });

    const result = oldLocs.map(normalizeLocation);

    if (!looksNew && (oldNpcs.length || oldItems.length)) {
      // Старые плоские npcs/items переливаем в первую локацию или создаём "Общее".
      let target = result[0];
      if (!target) {
        target = newLocation('Общее');
        target._open = false;
        result.push(target);
      }
      target.npcs = target.npcs.concat(oldNpcs.map(function (n) {
        return {
          id: LR.uid('npc'),
          name: n && n.name != null ? String(n.name) : '',
          description: n && n.description != null ? String(n.description) : ''
        };
      }));
      target.items = target.items.concat(oldItems.map(function (i) {
        return {
          id: LR.uid('itm'),
          kind: 'text',
          name: i && i.name != null ? String(i.name) : '',
          description: i && i.description != null ? String(i.description) : '',
          image: null
        };
      }));
    }
    return result;
  }

  function normalize(old) {
    if (!old || typeof old !== 'object') return makeBlank();
    const fresh = makeBlank();
    Object.keys(fresh).forEach(function (k) {
      if (old[k] !== undefined && old[k] !== null) fresh[k] = old[k];
    });
    if (old.id) fresh.id = old.id;
    fresh.createdAt = old.createdAt || fresh.createdAt;
    fresh.updatedAt = old.updatedAt || fresh.updatedAt;
    fresh.tags = Array.isArray(fresh.tags)
      ? fresh.tags.filter(function (x) { return typeof x === 'string'; })
      : [];

    fresh.locations = migrateLocations(old);
    // Верхнеуровневые npcs/items больше не храним.
    delete fresh.npcs;
    delete fresh.items;
    fresh.schemaVersion = 2;
    return fresh;
  }

  /* ============ СПИСОК ============ */

  let all = [];
  let filterText = '';
  let editingId = null;

  function render(root) {
    return S.getAll(STORE).then(function (items) {
      const rawItems = items || [];
      all = rawItems.map(normalize);
      all.forEach(function (rec) {
        const orig = rawItems.find(function (x) { return x.id === rec.id; });
        if (!orig || orig.schemaVersion !== 2) S.put(STORE, rec);
      });
      all.sort(function (a, b) { return (a.name || '').localeCompare(b.name || '', 'ru'); });

      if (editingId) {
        const c = all.find(function (x) { return x.id === editingId; });
        if (c) return renderEditor(root, c);
        editingId = null;
      }
      renderList(root);
    });
  }

  function matchesFilter(c) {
    if (!filterText.trim()) return true;
    const q = filterText.trim().toLowerCase();
    const hay = [c.name, c.subtitle, (c.tags || []).join(' ')].filter(Boolean).join(' ').toLowerCase();
    return hay.indexOf(q) !== -1;
  }

  function cityTotals(c) {
    const locs = c.locations || [];
    let n = 0, i = 0, g = 0;
    locs.forEach(function (l) {
      n += (l.npcs || []).length;
      i += (l.items || []).length;
      g += (l.gallery || []).length;
    });
    return { locs: locs.length, npcs: n, items: i, gallery: g };
  }

  function renderList(root) {
    const filtered = all.filter(matchesFilter);

    root.innerHTML =
      '<div class="page-toolbar">' +
        '<button class="btn btn-primary" id="new-lore">+ Новое место</button>' +
        '<input class="input" id="lore-filter" type="search" placeholder="Фильтр: имя, тег..." value="' + U.escapeHtml(filterText) + '">' +
        '<span class="muted">' + filtered.length + ' из ' + all.length + '</span>' +
        '<div class="spacer"></div>' +
        '<button class="btn" id="lore-export">Экспорт</button>' +
        '<button class="btn" id="lore-import">Импорт</button>' +
      '</div>' +
      '<div class="lore-list" id="lore-cards">' +
        (filtered.length ? filtered.map(cardHtml).join('') : '<p class="empty">Пусто. Нажми «+ Новое место».</p>') +
      '</div>';

    root.querySelector('#new-lore').addEventListener('click', openNewDialog);

    const filterInput = root.querySelector('#lore-filter');
    filterInput.addEventListener('input', U.debounce(function () {
      filterText = filterInput.value;
      renderList(root);
      const ni = root.querySelector('#lore-filter');
      if (ni) { ni.focus(); ni.setSelectionRange(ni.value.length, ni.value.length); }
    }, 150));

    root.querySelector('#lore-cards').addEventListener('click', function (e) {
      const card = e.target.closest('.lore-card');
      if (!card) return;
      editingId = card.dataset.id;
      render(root);
    });

    root.querySelector('#lore-export').addEventListener('click', function () {
      S.exportAll().then(function (payload) {
        const name = 'peredniy-kray-' + new Date().toISOString().slice(0, 10) + '.json';
        U.download(name, JSON.stringify(payload, null, 2));
      });
    });
    root.querySelector('#lore-import').addEventListener('click', openImportDialog);
  }

  function cardHtml(c) {
    const initial = U.escapeHtml((c.name || '?').slice(0, 1));
    const avatarStyle = c.avatar ? ' style="background-image:url(' + c.avatar + ')"' : '';
    const t = cityTotals(c);
    const countParts = [];
    if (t.locs) countParts.push('<span><b>' + t.locs + '</b> локац.</span>');
    if (t.npcs) countParts.push('<span><b>' + t.npcs + '</b> НПС</span>');
    if (t.items) countParts.push('<span><b>' + t.items + '</b> предм.</span>');
    if (t.gallery) countParts.push('<span><b>' + t.gallery + '</b> фото</span>');
    return '<article class="lore-card" data-id="' + c.id + '">' +
      '<div class="lore-card-avatar"' + avatarStyle + '>' + (c.avatar ? '' : initial) + '</div>' +
      '<div class="lore-card-body">' +
        '<h3 class="lore-card-name">' + U.escapeHtml(c.name) + '</h3>' +
        (c.subtitle ? '<div class="lore-card-subtitle">' + U.escapeHtml(c.subtitle) + '</div>' : '') +
        (countParts.length ? '<div class="lore-card-counts">' + countParts.join('') + '</div>' : '') +
        ((c.tags && c.tags.length) ? '<div class="lore-card-tags">' + c.tags.map(function (t) { return '<span class="tag">' + U.escapeHtml(t) + '</span>'; }).join('') + '</div>' : '') +
      '</div>' +
    '</article>';
  }

  /* ============ СОЗДАНИЕ ============ */

  function openNewDialog() {
    M.openModal({
      title: 'Новое место',
      content:
        '<div class="grid" style="gap:14px">' +
          '<label class="field"><span class="field-label">Название</span>' +
            '<input class="input" id="new-lore-name" placeholder="Например: Ставрас" autofocus></label>' +
          '<label class="field"><span class="field-label">Подзаголовок (роль / тип)</span>' +
            '<input class="input" id="new-lore-sub" placeholder="Город, регион, особая локация..."></label>' +
          '<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:8px">' +
            '<button class="btn" data-cancel>Отмена</button>' +
            '<button class="btn btn-primary" data-create>Создать</button>' +
          '</div>' +
        '</div>',
      onMount: function (body, close) {
        const nameInput = body.querySelector('#new-lore-name');
        const subInput = body.querySelector('#new-lore-sub');
        setTimeout(function () { nameInput.focus(); }, 20);
        function create() {
          const name = nameInput.value.trim() || 'Без имени';
          const sub = subInput.value.trim();
          const obj = makeBlank({ name: name, subtitle: sub });
          S.put(STORE, obj).then(function () {
            all.push(obj);
            all.sort(function (a, b) { return (a.name || '').localeCompare(b.name || '', 'ru'); });
            editingId = obj.id;
            close();
            render(document.getElementById('page'));
          });
        }
        body.querySelector('[data-cancel]').addEventListener('click', close);
        body.querySelector('[data-create]').addEventListener('click', create);
        nameInput.addEventListener('keydown', function (e) {
          if (e.key === 'Enter') { e.preventDefault(); create(); }
        });
      }
    });
  }

  /* ============ ЧАСТИЧНЫЕ ОБНОВЛЕНИЯ DOM ============ */

  function locEl(locId) {
    return document.querySelector('.loc-item[data-loc-id="' + locId + '"]');
  }

  function listEl(locId, key) {
    var el = locEl(locId);
    return el ? el.querySelector('.sub-sec-body[data-list="' + key + '"]') : null;
  }

  function ensureNotEmpty(list, html) {
    var empty = list.querySelector('.sub-sec-empty');
    if (empty) empty.remove();
    return html;
  }

  function patchAddNpc(loc, npc) {
    var list = listEl(loc.id, 'npcs');
    if (!list) return;
    ensureNotEmpty(list);
    list.insertAdjacentHTML('beforeend', LR.renderNpc(npc, loc.id));
  }

  function patchDelNpc(loc, npcId) {
    var list = listEl(loc.id, 'npcs');
    if (!list) return;
    var row = list.querySelector('[data-npc-id="' + npcId + '"]');
    if (row) row.remove();
    if (!list.querySelector('.npc-row')) {
      list.innerHTML = '<div class="sub-sec-empty">Пока пусто</div>';
    }
  }

  function patchAddItem(loc, item) {
    var list = listEl(loc.id, 'items');
    if (!list) return;
    ensureNotEmpty(list);
    list.insertAdjacentHTML('beforeend', LR.renderItem(item, loc.id));
  }

  function patchReplaceItem(loc, itemId) {
    var list = listEl(loc.id, 'items');
    if (!list) return;
    var row = list.querySelector('[data-item-id="' + itemId + '"]');
    if (!row) return;
    var item = (loc.items || []).find(function (i) { return i.id === itemId; });
    if (!item) return;
    var tmp = document.createElement('div');
    tmp.innerHTML = LR.renderItem(item, loc.id);
    row.replaceWith(tmp.firstChild);
  }

  function patchDelItem(loc, itemId) {
    var list = listEl(loc.id, 'items');
    if (!list) return;
    var row = list.querySelector('[data-item-id="' + itemId + '"]');
    if (row) row.remove();
    if (!list.querySelector('.item-row')) {
      list.innerHTML = '<div class="sub-sec-empty">Пока пусто</div>';
    }
  }

  function patchAddGallery(loc, img) {
    var list = listEl(loc.id, 'gallery');
    if (!list) return;
    var addCell = list.querySelector('.gallery-cell.add');
    var tmp = document.createElement('div');
    tmp.innerHTML = LR.renderGalleryCell(img);
    if (addCell) addCell.before(tmp.firstChild);
    else list.appendChild(tmp.firstChild);
  }

  function patchReplaceGallery(loc, imgId) {
    var list = listEl(loc.id, 'gallery');
    if (!list) return;
    var cell = list.querySelector('[data-img-id="' + imgId + '"]');
    if (!cell) return;
    var img = (loc.gallery || []).find(function (g) { return g.id === imgId; });
    if (!img) return;
    var tmp = document.createElement('div');
    tmp.innerHTML = LR.renderGalleryCell(img);
    cell.replaceWith(tmp.firstChild);
  }

  function patchDelGallery(loc, imgId) {
    var list = listEl(loc.id, 'gallery');
    if (!list) return;
    var cell = list.querySelector('[data-img-id="' + imgId + '"]');
    if (cell) cell.remove();
  }

  function patchMeta(loc) {
    var el = locEl(loc.id);
    if (!el) return;
    var meta = el.querySelector('.loc-meta');
    if (meta) meta.textContent = LR.counts(loc);
  }

  /* ============ РЕДАКТОР ============ */

  function renderEditor(root, c) {
    root.innerHTML =
      '<div class="page-toolbar">' +
        '<button class="btn" id="back-list">← К списку</button>' +
        '<span class="muted" id="save-status"></span>' +
        '<div class="spacer"></div>' +
        '<button class="btn" id="dup-lore">Дублировать</button>' +
        '<button class="btn btn-danger" id="del-lore">Удалить</button>' +
      '</div>' +
      '<form class="lore-editor" id="lore-form" onsubmit="return false">' +
        '<div class="lore-top">' +
          '<div class="lore-left">' +
            '<div class="left-block">' +
              '<label class="avatar-wrap' + (c.avatar ? '' : ' avatar-empty') + '"' +
                (c.avatar ? ' style="background-image:url(' + c.avatar + ')"' : '') + '>' +
                '<button type="button" class="avatar-clear" title="Убрать">×</button>' +
              '</label>' +
              '<input class="left-name" type="text" data-field="name" value="' + U.escapeHtml(c.name) + '" placeholder="Название">' +
              '<input class="left-subtitle" type="text" data-field="subtitle" value="' + U.escapeHtml(c.subtitle) + '" placeholder="Подзаголовок">' +
            '</div>' +
            '<div class="left-block">' +
              '<label class="field"><span class="field-label">Теги (через запятую)</span>' +
                '<input class="input" type="text" data-tags value="' + U.escapeHtml((c.tags || []).join(', ')) + '"></label>' +
            '</div>' +
          '</div>' +
          '<div class="lore-right">' +
            '<section class="section"><h3>Основная арка</h3>' +
              '<textarea class="rich-input" data-rich="arc" rows="7" placeholder="Главная история региона: что здесь происходит, кто за этим стоит, куда всё ведёт.">' + U.escapeHtml(c.arc) + '</textarea>' +
            '</section>' +
            '<section class="section"><h3>События — что должно произойти</h3>' +
              '<textarea class="rich-input" data-rich="events" rows="6" placeholder="Список планируемых событий. Можно просто перечислением.">' + U.escapeHtml(c.events) + '</textarea>' +
            '</section>' +
            '<section class="section"><h3>Свободные заметки</h3>' +
              '<textarea class="rich-input" data-rich="notes" rows="5" placeholder="Всё остальное: атмосфера, слухи, погода, что угодно.">' + U.escapeHtml(c.notes) + '</textarea>' +
            '</section>' +
          '</div>' +
        '</div>' +
        locationsSectionHtml(c) +
      '</form>';

    const form = root.querySelector('#lore-form');
    const saveStatus = root.querySelector('#save-status');

    const doSave = U.debounce(function () {
      c.updatedAt = new Date().toISOString();
      S.put(STORE, c).then(function () {
        if (saveStatus) saveStatus.textContent = 'Сохранено ' + new Date().toLocaleTimeString('ru-RU');
      });
    }, 400);

    /* --- верхняя панель --- */
    root.querySelector('#back-list').addEventListener('click', function () {
      editingId = null; render(root);
    });

    root.querySelector('#del-lore').addEventListener('click', function () {
      M.confirmDialog('Удалить «' + U.escapeHtml(c.name) + '»?').then(function (ok) {
        if (!ok) return;
        S.remove(STORE, c.id).then(function () {
          all = all.filter(function (x) { return x.id !== c.id; });
          editingId = null; render(root);
        });
      });
    });

    root.querySelector('#dup-lore').addEventListener('click', function () {
      const copy = JSON.parse(JSON.stringify(c));
      copy.id = U.uuid();
      copy.name = c.name + ' (копия)';
      copy.createdAt = copy.updatedAt = new Date().toISOString();
      (copy.locations || []).forEach(function (l) {
        l.id = LR.uid('loc');
        (l.npcs || []).forEach(function (n) { n.id = LR.uid('npc'); });
        (l.items || []).forEach(function (i) { i.id = LR.uid('itm'); });
        (l.gallery || []).forEach(function (g) { g.id = LR.uid('img'); });
      });
      S.put(STORE, copy).then(function () { editingId = copy.id; render(root); });
    });

    /* --- аватар --- */
    const avatarWrap = root.querySelector('.avatar-wrap');
    if (avatarWrap) {
      avatarWrap.addEventListener('click', function (e) {
        if (e.target.classList.contains('avatar-clear')) return;
        pickImage(function (dataUrl) {
          c.avatar = dataUrl;
          avatarWrap.style.backgroundImage = 'url(' + dataUrl + ')';
          avatarWrap.classList.remove('avatar-empty');
          doSave();
        });
      });
      const clearBtn = avatarWrap.querySelector('.avatar-clear');
      if (clearBtn) clearBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        c.avatar = null;
        avatarWrap.style.backgroundImage = '';
        avatarWrap.classList.add('avatar-empty');
        doSave();
      });
    }

    /* --- основной обработчик ввода --- */
    form.addEventListener('input', function (e) {
      const t = e.target;

      if (t.matches('[data-field]')) { c[t.dataset.field] = t.value; doSave(); return; }
      if (t.matches('[data-rich]')) { c[t.dataset.rich] = t.value; doSave(); return; }
      if (t.matches('[data-tags]')) {
        c.tags = t.value.split(',').map(function (s) { return s.trim(); }).filter(Boolean);
        doSave(); return;
      }

      // поле локации
      const loc = findLoc(c, t);
      if (!loc) return;

      const lf = t.dataset.locField;
      if (lf === 'name' || lf === 'description' || lf === 'notes') {
        loc[lf] = t.value;
        // обновляем метрику в шапке локации (без перерисовки)
        if (lf === 'name') {
          const head = t.closest('.loc-item');
          if (head) {
            const meta = head.querySelector('.loc-meta');
            if (meta) meta.textContent = LR.counts(loc);
          }
        }
        doSave(); return;
      }

      // поле НПС
      const npcRow = t.closest('.npc-row');
      if (npcRow && t.dataset.npcField) {
        const npcId = npcRow.dataset.npcId;
        loc.npcs.forEach(function (n) { if (n.id === npcId) n[t.dataset.npcField] = t.value; });
        doSave(); return;
      }

      // поле предмета
      const itemRow = t.closest('.item-row');
      if (itemRow && t.dataset.itemField) {
        const itmId = itemRow.dataset.itemId;
        loc.items.forEach(function (i) { if (i.id === itmId) i[t.dataset.itemField] = t.value; });
        doSave(); return;
      }
    });

    /* --- кнопки (делегирование) --- */
    form.addEventListener('click', function (e) {
      const t = e.target.closest ? e.target.closest('[data-act]') : null;
      if (!t) return;
      const act = t.dataset.act;

      /* секция локаций */
      if (act === 'loc-add') {
        captureOpenStates(c);
        c.locations = c.locations || [];
        const loc = newLocation('Новая локация');
        loc._open = true;
        c.locations.push(loc);
        doSave();
        rerenderLocations(c);
        // фокус в имя новой локации
        const newHead = form.querySelector('.loc-item:last-child .loc-title-input');
        if (newHead) { newHead.focus(); newHead.select(); }
        return;
      }

      /* --- всё, что внутри локации --- */
      const loc = findLoc(c, t);
      if (!loc) return;

      if (act === 'loc-toggle') {
        const raw = e.target;
        if (!raw) return;
        if (raw.tagName === 'INPUT' || raw.tagName === 'TEXTAREA' || raw.tagName === 'BUTTON') return;
        const item = t.closest('.loc-item');
        if (item) item.classList.toggle('open');
        return;
      }
	  
      if (act === 'loc-del') {
        e.stopPropagation();
        if (!confirm('Удалить локацию «' + (loc.name || '') + '»?')) return;
        c.locations = c.locations.filter(function (l) { return l.id !== loc.id; });
        doSave();
        rerenderLocations(c);
        return;
      }

      if (act === 'npc-add') {
        var newNpc = { id: LR.uid('npc'), name: '', description: '' };
        loc.npcs.push(newNpc);
        patchAddNpc(loc, newNpc);
        patchMeta(loc);
        doSave();
        setTimeout(function () {
          var el = document.querySelector('.loc-item[data-loc-id="' + loc.id + '"] [data-npc-id="' + newNpc.id + '"] input');
          if (el) el.focus();
        }, 20);
        return;
      }
      if (act === 'npc-del') {
        const rowN = t.closest('.npc-row');
        const npcId = rowN.dataset.npcId;
        loc.npcs = loc.npcs.filter(function (n) { return n.id !== npcId; });
        patchDelNpc(loc, npcId);
        patchMeta(loc);
        doSave();
        return;
      }
      if (act === 'npc-quests') {
        e.stopPropagation();
        const rowQ = t.closest('.npc-row');
        const npcId = rowQ.dataset.npcId;
        const npc = loc.npcs.find(function (n) { return n.id === npcId; });
        if (!npc) return;
        if (PK.pages && PK.pages.quests && typeof PK.pages.quests.openNpcQuests === 'function') {
          PK.pages.quests.openNpcQuests(npc);
        } else {
          alert('Модуль квестов не загружен.');
        }
        return;
      }
      if (act === 'item-add') {
        M.openModal({
          title: 'Какой предмет добавить?',
          content:
            '<div style="display:flex;gap:12px">' +
              '<button class="btn" data-kind="text" style="flex:1;flex-direction:column;padding:20px 14px;height:auto;gap:8px">' +
                '<div style="font-size:34px;line-height:1">📝</div>' +
                '<div style="font-weight:700">Текст</div>' +
                '<div class="muted" style="font-size:11px;text-align:center">Название + описание</div>' +
              '</button>' +
              '<button class="btn" data-kind="image" style="flex:1;flex-direction:column;padding:20px 14px;height:auto;gap:8px">' +
                '<div style="font-size:34px;line-height:1">🖼</div>' +
                '<div style="font-weight:700">Картинка</div>' +
                '<div class="muted" style="font-size:11px;text-align:center">Готовый предмет<br>одним изображением</div>' +
              '</button>' +
            '</div>',
          onMount: function (body, close) {
            body.querySelectorAll('[data-kind]').forEach(function (btn) {
              btn.addEventListener('click', function () {
                var kind = btn.dataset.kind;
                close();
                var newItem = { id: LR.uid('itm'), kind: kind, name: '', description: '', image: null };
                loc.items.push(newItem);
                patchAddItem(loc, newItem);
                patchMeta(loc);
                doSave();
                if (kind === 'image') {
                  pickImage(function (dataUrl) {
                    loc.items.forEach(function (i) { if (i.id === newItem.id) i.image = dataUrl; });
                    doSave();
                    patchReplaceItem(loc, newItem.id);
                  }, { maxWidth: 2200, quality: 0.94 });
                } else {
                  setTimeout(function () {
                    var el = document.querySelector('[data-item-id="' + newItem.id + '"] [data-item-field="name"]');
                    if (el) el.focus();
                  }, 20);
                }
              });
            });
          }
        });
        return;
      }

      if (act === 'item-open') {
        var rowO = t.closest('.item-row');
        var idO = rowO.dataset.itemId;
        var itmO = loc.items.find(function (i) { return i.id === idO; });
        if (itmO && itmO.image) {
          LR.showImageModal(itmO.image, {
            title: itmO.name || 'Предмет',
            filename: 'item.' + LR.dataUrlExt(itmO.image)
          });
        }
        return;
      }
      if (act === 'item-give') {
        e.stopPropagation();
        const rowG = t.closest('.item-row');
        const itmIdG = rowG.dataset.itemId;
        const itm = loc.items.find(function (i) { return i.id === itmIdG; });
        if (!itm) return;
        if (PK.pages && PK.pages.players && typeof PK.pages.players.giveItemToPlayer === 'function') {
          PK.pages.players.giveItemToPlayer({
            kind: itm.kind === 'image' ? 'image' : 'text',
            name: itm.name || '',
            description: itm.description || '',
            image: itm.image || null,
            source: { loreId: c.id, locId: loc.id, itemId: itm.id }
          });
        } else {
          alert('Модуль игроков не загружен.');
        }
        return;
      }
      if (act === 'item-del') {
        const row = t.closest('.item-row');
        const itmId = row.dataset.itemId;
        loc.items = loc.items.filter(function (i) { return i.id !== itmId; });
        patchDelItem(loc, itmId);
        patchMeta(loc);
        doSave();
        return;
      }
      if (act === 'item-kind') {
        const row = t.closest('.item-row');
        const kind = t.dataset.kind;
        const itmId = row.dataset.itemId;
        loc.items.forEach(function (i) { if (i.id === itmId) i.kind = kind; });
        doSave();
        patchReplaceItem(loc, itmId);
        return;
      }
      if (act === 'item-img') {
        const row = t.closest('.item-row');
        const itmId = row.dataset.itemId;
        pickImage(function (dataUrl) {
          loc.items.forEach(function (i) {
            if (i.id === itmId) { i.image = dataUrl; i.kind = 'image'; }
          });
          doSave();
          patchReplaceItem(loc, itmId);
        }, { maxWidth: 2200, quality: 0.94 });
        return;
      }

      if (act === 'gallery-add') {
        const imgId = LR.uid('img');
        var newImg = { id: imgId, image: null, caption: '' };
        loc.gallery.push(newImg);
        doSave();
        pickImage(function (dataUrl) {
          loc.gallery.forEach(function (g) { if (g.id === imgId) g.image = dataUrl; });
          doSave();
          patchAddGallery(loc, newImg);
          patchMeta(loc);
        }, { maxWidth: 2000, quality: 0.92 });
        return;
      }
      if (act === 'gallery-img') {
        if (t.classList.contains('add')) return;
        const cell = t.closest('.gallery-cell');
        const imgId = cell.dataset.imgId;
        const g = loc.gallery.find(function (x) { return x.id === imgId; });
        if (g && g.image) {
          LR.showImageModal(g.image, {
            title: 'Фото',
            filename: 'photo.' + LR.dataUrlExt(g.image)
          });
        }
        return;
      }
      if (act === 'gallery-replace') {
        e.stopPropagation();
        const cell = t.closest('.gallery-cell');
        const imgId = cell.dataset.imgId;
        pickImage(function (dataUrl) {
          loc.gallery.forEach(function (g) { if (g.id === imgId) g.image = dataUrl; });
          doSave();
          patchReplaceGallery(loc, imgId);
        }, { maxWidth: 2000, quality: 0.92 });
        return;
      }
      if (act === 'gallery-del') {
        e.stopPropagation();
        const cell = t.closest('.gallery-cell');
        const imgId = cell.dataset.imgId;
        loc.gallery = loc.gallery.filter(function (g) { return g.id !== imgId; });
        doSave();
        patchDelGallery(loc, imgId);
        patchMeta(loc);
        return;
      }
    });
  }

  /* ============ СЕКЦИЯ ЛОКАЦИЙ ============ */

  function locationsSectionHtml(c) {
    return '<section class="section">' +
      '<h3>🏰 Локации<span class="spacer"></span>' +
        '<button type="button" class="btn btn-small" data-act="loc-add">+ Локация</button>' +
      '</h3>' +
      '<div class="loc-list" data-list="locations">' +
        LR.renderLocations(c.locations || []) +
      '</div>' +
    '</section>';
  }

  function rerenderLocations(c) {
    const list = document.querySelector('[data-list="locations"]');
    if (!list) return;
    list.innerHTML = LR.renderLocations(c.locations || []);
  }

  /* Перед перерисовкой сохраняем актуальное «открыто/закрыто» из DOM в модель. */
  function captureOpenStates(c) {
    document.querySelectorAll('.loc-item').forEach(function (el) {
      const locId = el.dataset.locId;
      const loc = (c.locations || []).find(function (l) { return l.id === locId; });
      if (loc) loc._open = el.classList.contains('open');
    });
  }

  function findLoc(c, el) {
    const node = el.closest ? el.closest('.loc-item') : null;
    if (!node) return null;
    const locId = node.dataset.locId;
    return (c.locations || []).find(function (l) { return l.id === locId; }) || null;
  }

  /* ============ ЗАГРУЗКА КАРТИНОК ============ */

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

  /* ============ ИМПОРТ ============ */

  function openImportDialog() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.addEventListener('change', function () {
      const file = input.files && input.files[0];
      if (!file) return;
      file.text().then(function (text) {
        const payload = JSON.parse(text);
        return S.importAll(payload);
      }).then(function () {
        editingId = null;
        filterText = '';
        render(document.getElementById('page'));
        alert('Импорт завершён.');
      }).catch(function (e) { alert('Ошибка импорта: ' + e.message); });
    });
    input.click();
  }

  return { render: render };
})();