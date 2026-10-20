window.PK = window.PK || {};
PK.pages = PK.pages || {};

PK.pages.bestiary = (function () {
  const U = PK.utils;
  const M = PK.modal;
  const S = PK.storage;

  const STORE = 'creatures';

  const DAMAGE_TYPES = [
    { id: 'bludgeoning', label: 'Дробящий' },
    { id: 'piercing',    label: 'Колющий' },
    { id: 'slashing',    label: 'Рубящий' },
    { id: 'acid',        label: 'Кислота' },
    { id: 'cold',        label: 'Холод' },
    { id: 'fire',        label: 'Огонь' },
    { id: 'lightning',   label: 'Электричество' },
    { id: 'poison',      label: 'Яд' },
    { id: 'necrotic',    label: 'Некротический' },
    { id: 'radiant',     label: 'Излучение' },
    { id: 'psychic',     label: 'Психический' },
    { id: 'force',       label: 'Силовой' },
    { id: 'thunder',     label: 'Звук' },
    { id: 'pure',        label: 'Чистый', custom: true }
  ];

  const CONDITIONS = [
    { id: 'blinded', label: 'Ослеплён' }, { id: 'charmed', label: 'Очарован' },
    { id: 'deafened', label: 'Оглох' }, { id: 'frightened', label: 'Испуган' },
    { id: 'grappled', label: 'Схвачен' }, { id: 'incapacitated', label: 'Недееспособен' },
    { id: 'invisible', label: 'Невидим' }, { id: 'paralyzed', label: 'Парализован' },
    { id: 'petrified', label: 'Окаменел' }, { id: 'poisoned', label: 'Отравлен' },
    { id: 'prone', label: 'Сбит с ног' }, { id: 'restrained', label: 'Опутан' },
    { id: 'stunned', label: 'Ошеломлён' }, { id: 'unconscious', label: 'Без сознания' },
    { id: 'exhausted', label: 'Истощён' }
  ];

  const TYPES = [
    { id: 'npc', label: 'НПС' }, { id: 'player', label: 'Игрок' },
    { id: 'enemy', label: 'Противник' }, { id: 'aberration', label: 'Аберрация' },
    { id: 'beast', label: 'Зверь' }, { id: 'celestial', label: 'Небожитель' },
    { id: 'construct', label: 'Конструкт' }, { id: 'dragon', label: 'Дракон' },
    { id: 'elemental', label: 'Элементаль' }, { id: 'fey', label: 'Фея' },
    { id: 'fiend', label: 'Фиенд' }, { id: 'giant', label: 'Великан' },
    { id: 'humanoid', label: 'Гуманоид' }, { id: 'monstrosity', label: 'Монстр' },
    { id: 'ooze', label: 'Ослизень' }, { id: 'plant', label: 'Растение' },
    { id: 'undead', label: 'Нежить' }
  ];

  const ALIGNMENTS = [
    { id: 'lg', label: 'Законно-добрый' }, { id: 'ng', label: 'Нейтрально-добрый' },
    { id: 'cg', label: 'Хаотично-добрый' }, { id: 'ln', label: 'Законно-нейтральный' },
    { id: 'n', label: 'Нейтральный' }, { id: 'cn', label: 'Хаотично-нейтральный' },
    { id: 'le', label: 'Законно-злой' }, { id: 'ne', label: 'Нейтрально-злой' },
    { id: 'ce', label: 'Хаотично-злой' }
  ];

  const DIVINITIES = [
    { id: 'none', label: 'Отсутствует', legend: 0 },
    { id: 'spark', label: 'Божественная искра', legend: 1 },
    { id: 'demigod', label: 'Полубог', legend: 2 },
    { id: 'god', label: 'Бог', legend: 3 },
    { id: 'oldgod', label: 'Старый бог', legend: 4 },
    { id: 'elder', label: 'Старейший бог', legend: 5 },
    { id: 'other', label: 'Подчиняется иной системе сил', legend: 0 }
  ];

  const CLASSES = [
    { id: 'barbarian', label: 'Варвар' }, { id: 'bard', label: 'Бард' },
    { id: 'fighter', label: 'Воин' }, { id: 'wizard', label: 'Волшебник' },
    { id: 'druid', label: 'Друид' }, { id: 'cleric', label: 'Жрец' },
    { id: 'artificer', label: 'Изобретатель' }, { id: 'warlock', label: 'Колдун' },
    { id: 'monk', label: 'Монах' }, { id: 'paladin', label: 'Паладин' },
    { id: 'rogue', label: 'Плут' }, { id: 'sorcerer', label: 'Чародей' }
  ];

  const XP_TABLE = {
    1:0, 2:300, 3:900, 4:2700, 5:6500, 6:14000, 7:23000, 8:34000, 9:48000, 10:64000,
    11:85000, 12:100000, 13:120000, 14:140000, 15:165000, 16:195000, 17:225000,
    18:265000, 19:305000, 20:355000, 21:410000, 22:470000, 23:540000, 24:620000,
    25:710000, 26:810000, 27:920000, 28:1050000, 29:1200000, 30:1400000
  };

  const ACTION_KINDS = [
    { id: 'attack', label: 'Атака' },
    { id: 'spell', label: 'Заклинание' },
    { id: 'special', label: 'Особое' }
  ];
  const ACTION_COSTS = [
    { id: 'main', label: 'Основное' }, { id: 'bonus', label: 'Бонусное' },
    { id: 'minor', label: 'Малое' }, { id: 'free', label: 'Бесплатное' }
  ];
  const TARGETS = [
    { id: '1', label: '1 цель' }, { id: '2', label: '2 цели' },
    { id: '3', label: '3 цели' }, { id: '5', label: '5 целей' },
    { id: 'unlimited', label: 'Без огр.' }, { id: 'self', label: 'На себя' }
  ];
  const SAVE_EFFECTS = [
    { id: 'half', label: '½ урона' },
    { id: 'none', label: 'Ничего' },
    { id: 'other', label: 'Другое' }
  ];
  const ABILITIES = [
    { id: '', label: '—' }, { id: 'str', label: 'СИЛ' }, { id: 'dex', label: 'ЛОВ' },
    { id: 'con', label: 'ТЕЛ' }, { id: 'int', label: 'ИНТ' }, { id: 'mdr', label: 'МДР' },
    { id: 'cha', label: 'ХАР' }
  ];
  const DICE_SIDES = [4, 6, 8, 10, 12, 20, 100];

  function makeBlankDefenses() {
    const d = {};
    DAMAGE_TYPES.forEach(function (t) { d[t.id] = { mode: 'none', count: 0 }; });
    return d;
  }
  function makeBlankConditions() {
    const c = {};
    CONDITIONS.forEach(function (t) { c[t.id] = 'none'; });
    return c;
  }
  function makeBlank(overrides) {
    const base = {
      id: U.uuid(), schemaVersion: 4,
      avatar: null, name: 'Без имени', subtitle: '',
      type: 'npc', typeCustom: '',
      alignment: '', alignmentCustom: '',
      divinity: 'none', divinityCustom: '',
      klass: '', klassCustom: '',
      level: 1, ac: 10, hpMax: 10, hpCurrent: 10, initiative: 0,
      speeds: { walk: '30 фт.', fly: '', swim: '', climb: '', hover: '', note: '' },
      profBonus: 2, faction: '',
      stats: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
      saveProf: { str: false, dex: false, con: false, int: false, wis: false, cha: false },
      saveOverride: { str: '', dex: '', con: '', int: '', wis: '', cha: '' },
      damageDefenses: makeBlankDefenses(),
      conditionDefenses: makeBlankConditions(),
      conditionsCustom: [],
      features: '', reactions: '',
      actions: [], legendaryActions: [],
      lore: '', tags: [],
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
    };
    return Object.assign(base, overrides || {});
  }

  function parseDiceString(str) {
    if (!str) return { count: 1, die: 6, modifier: 0 };
    const m = String(str).match(/^\s*(\d+)\s*d\s*(\d+)\s*([+\-]\s*\d+)?/i);
    if (!m) return { count: 1, die: 6, modifier: 0 };
    return {
      count: Number(m[1]) || 1,
      die: Number(m[2]) || 6,
      modifier: m[3] ? Number(m[3].replace(/\s/g, '')) : 0
    };
  }
  function normalizeDamage(d) {
    if (!d) return { count: 1, die: 6, modifier: 0, type: 'bludgeoning' };
    if (typeof d.dice === 'string') {
      const p = parseDiceString(d.dice);
      return { count: p.count, die: p.die, modifier: p.modifier, type: d.type || 'bludgeoning' };
    }
    return {
      count: Number(d.count) || 1, die: Number(d.die) || 6,
      modifier: Number(d.modifier) || 0, type: d.type || 'bludgeoning'
    };
  }
  function normalizeSaveGroup(sg) {
    if (!sg || typeof sg !== 'object') sg = {};
    const eff = ['half','none','other'].indexOf(sg.saveEffect) !== -1 ? sg.saveEffect : 'half';
    return {
      ability: sg.ability || '', dc: sg.dc || '', saveEffect: eff,
      damages: Array.isArray(sg.damages) ? sg.damages.map(normalizeDamage) : []
    };
  }
  function normalizeAction(a) {
    if (!a || typeof a !== 'object') a = {};
    let kind = a.kind || 'attack';
    if (['attack','spell','special'].indexOf(kind) === -1) kind = 'attack';

    let saveGroups = [];
    let hitDamages = [];

    if (Array.isArray(a.saveGroups) && a.saveGroups.length) {
      saveGroups = a.saveGroups.map(normalizeSaveGroup);
      hitDamages = Array.isArray(a.damages) ? a.damages.map(normalizeDamage) : [];
    } else {
      const oldSaves = Array.isArray(a.saves) ? a.saves : [];
      const oldDamages = Array.isArray(a.damages) ? a.damages : [];
      if (oldSaves.length) {
        const failDmgs = oldDamages.filter(function (d) { return d.when === 'fail' || d.when === 'always'; });
        const hitDmgs = oldDamages.filter(function (d) { return d.when === 'hit' || !d.when; });
        saveGroups = oldSaves.map(function (sv, i) {
          return {
            ability: sv.ability || '', dc: sv.dc || '',
            saveEffect: sv.saveEffect || 'half',
            damages: i === 0 ? failDmgs.map(normalizeDamage) : []
          };
        });
        hitDamages = hitDmgs.map(normalizeDamage);
      } else {
        hitDamages = oldDamages.map(normalizeDamage);
      }
    }
    if (kind === 'spell' && !saveGroups.length) {
      saveGroups = [{ ability: '', dc: '', saveEffect: 'half', damages: [] }];
    }
    if (kind === 'spell') hitDamages = [];

    let cost = 'main';
    if (typeof a.cost === 'string' && ['main','bonus','minor','free'].indexOf(a.cost) !== -1) cost = a.cost;
    const legendCost = Number(a.legendCost) || (typeof a.cost === 'number' ? a.cost : 1) || 1;

    let targets = a.targets || '1';
    if (['1','2','3','5','unlimited','self'].indexOf(targets) === -1) targets = '1';

    let conditionGroups = [];
    if (Array.isArray(a.conditionGroups)) {
      conditionGroups = a.conditionGroups.map(function (cg) {
        if (!cg || typeof cg !== 'object') cg = {};
        return {
          conditionId: cg.conditionId || '',
          conditionCustom: cg.conditionCustom || '',
          ability: cg.ability || '',
          dc: cg.dc || ''
        };
      });
    }

    return {
      name: a.name || '', kind: kind,
      toHit: a.toHit || '', range: a.range || '',
      targets: targets,
      attacks: Math.max(1, Math.min(10, Number(a.attacks) || 1)),
      damages: hitDamages,
      saveGroups: saveGroups,
      conditionGroups: conditionGroups,
      note: a.note || '', cost: cost, legendCost: legendCost
    };
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

    if (!fresh.level || fresh.level === 1) {
      const oldCr = old.cr;
      if (typeof oldCr === 'string') {
        let lv = null;
        if (oldCr.indexOf('/') !== -1) {
          const p = oldCr.split('/');
          const v = Number(p[0]) / Number(p[1]);
          if (!isNaN(v)) lv = Math.max(1, Math.round(v * 4));
        } else if (!isNaN(Number(oldCr))) lv = Number(oldCr);
        if (lv && lv >= 1 && lv <= 30) fresh.level = lv;
      }
    }
    if (old.hpCurrent === undefined) fresh.hpCurrent = fresh.hpMax;

    fresh.stats = Object.assign({ str:10,dex:10,con:10,int:10,wis:10,cha:10 }, fresh.stats || {});
    fresh.saveProf = Object.assign({ str:false,dex:false,con:false,int:false,wis:false,cha:false }, fresh.saveProf || {});
    fresh.saveOverride = Object.assign({ str:'',dex:'',con:'',int:'',wis:'',cha:'' }, fresh.saveOverride || {});
    fresh.speeds = Object.assign({ walk:'',fly:'',swim:'',climb:'',hover:'',note:'' }, fresh.speeds || {});

    if (old.initiative === undefined || old.initiative === null || old.initiative === '') {
      fresh.initiative = U.modNumber(fresh.stats.dex || 10);
    } else {
      fresh.initiative = Number(old.initiative) || 0;
    }

    const dd = {};
    DAMAGE_TYPES.forEach(function (t) {
      const cur = (fresh.damageDefenses && fresh.damageDefenses[t.id]) || {};
      dd[t.id] = { mode: cur.mode || 'none', count: Number(cur.count) || 0 };
    });
    fresh.damageDefenses = dd;

    const cd = {};
    CONDITIONS.forEach(function (t) {
      const v = (fresh.conditionDefenses && fresh.conditionDefenses[t.id]) || 'none';
      cd[t.id] = v;
    });
    fresh.conditionDefenses = cd;

    fresh.conditionsCustom = Array.isArray(fresh.conditionsCustom) ? fresh.conditionsCustom : [];
    fresh.actions = Array.isArray(fresh.actions) ? fresh.actions.map(normalizeAction) : [];
    fresh.legendaryActions = Array.isArray(fresh.legendaryActions) ? fresh.legendaryActions.map(normalizeAction) : [];

    if ((!fresh.features || fresh.features === '') && Array.isArray(old.traits) && old.traits.length) {
      fresh.features = old.traits.map(function (t) { return (t.name || 'Черта') + '. ' + (t.desc || ''); }).join('\n\n');
    }

    fresh.schemaVersion = 4;
    return fresh;
  }

  let all = [];
  let filterText = '';
  let editingId = null;

  function render(root) {
    return S.getAll(STORE).then(function (items) {
      const rawItems = items || [];
      all = rawItems.map(normalize);
      all.forEach(function (rec) {
        const orig = rawItems.find(function (x) { return x.id === rec.id; });
        if (!orig || orig.schemaVersion !== 4) S.put(STORE, rec);
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

  function renderList(root) {
    const filtered = all.filter(matchesFilter);

    root.innerHTML =
      '<div class="page-toolbar">' +
        '<button class="btn btn-primary" id="new-creature">+ Новый персонаж</button>' +
        '<input class="input" id="beast-filter" type="search" placeholder="Фильтр: имя, тег, фракция..." value="' + U.escapeHtml(filterText) + '">' +
        '<span class="muted">' + filtered.length + ' из ' + all.length + '</span>' +
        '<div class="spacer"></div>' +
        '<button class="btn" id="beast-export">Экспорт</button>' +
        '<button class="btn" id="beast-import">Импорт</button>' +
      '</div>' +
      '<div class="cards" id="beast-cards">' +
        (filtered.length ? filtered.map(cardHtml).join('') : '<p class="empty">Пусто. Нажми «+ Новый персонаж».</p>') +
      '</div>';

    root.querySelector('#new-creature').addEventListener('click', openNewDialog);
    const filterInput = root.querySelector('#beast-filter');
    filterInput.addEventListener('input', U.debounce(function () {
      filterText = filterInput.value;
      renderList(root);
      const ni = root.querySelector('#beast-filter');
      if (ni) { ni.focus(); ni.setSelectionRange(ni.value.length, ni.value.length); }
    }, 150));

    root.querySelector('#beast-cards').addEventListener('click', function (e) {
      const card = e.target.closest('.creature-card');
      if (!card) return;
      editingId = card.dataset.id;
      render(root);
    });

    root.querySelector('#beast-export').addEventListener('click', function () {
      S.exportAll().then(function (payload) {
        const name = 'peredniy-kray-' + new Date().toISOString().slice(0, 10) + '.json';
        U.download(name, JSON.stringify(payload, null, 2));
      });
    });
    root.querySelector('#beast-import').addEventListener('click', openImportDialog);
  }

  function matchesFilter(c) {
    if (!filterText.trim()) return true;
    const q = filterText.trim().toLowerCase();
    const hay = [c.name, c.subtitle, c.faction, (c.tags || []).join(' ')].filter(Boolean).join(' ').toLowerCase();
    return hay.indexOf(q) !== -1;
  }

  function labelOf(list, id) {
    const found = list.find(function (x) { return x.id === id; });
    return found ? found.label : id;
  }
  function pickDisplayValue(c, key) {
    if (c[key] === 'custom' || !c[key]) return c[key + 'Custom'] || '';
    const lists = { type: TYPES, alignment: ALIGNMENTS, divinity: DIVINITIES, klass: CLASSES };
    const list = lists[key] || [];
    return labelOf(list, c[key]);
  }
  function pickSaveValue(c, key, text) {
    const lists = { type: TYPES, alignment: ALIGNMENTS, divinity: DIVINITIES, klass: CLASSES };
    const list = lists[key] || [];
    const found = list.find(function (x) { return x.label === text; });
    if (found) { c[key] = found.id; c[key + 'Custom'] = ''; }
    else if (text.trim() === '') { c[key] = ''; c[key + 'Custom'] = ''; }
    else { c[key] = 'custom'; c[key + 'Custom'] = text; }
  }

  function cardHtml(c) {
    const stats = c.stats || {};
    const typeLabel = c.type === 'custom' ? (c.typeCustom || 'Свой') : labelOf(TYPES, c.type);
    const initStr = (Number(c.initiative) >= 0 ? '+' : '') + (Number(c.initiative) || 0);
    return '<article class="card creature-card" data-id="' + c.id + '">' +
      '<header class="card-head"><h3>' + U.escapeHtml(c.name) + '</h3>' +
        '<span class="badge">' + U.escapeHtml(typeLabel) + '</span></header>' +
      (c.subtitle ? '<div class="muted">' + U.escapeHtml(c.subtitle) + '</div>' : '') +
      '<div class="statline">' +
        '<span>Ур. ' + (c.level || '—') + '</span>' +
        '<span>КД ' + (c.ac != null ? c.ac : '—') + '</span>' +
        '<span>Иниц. ' + initStr + '</span>' +
        '<span>ХП ' + (c.hpCurrent != null ? c.hpCurrent : '?') + '/' + (c.hpMax != null ? c.hpMax : '?') + '</span>' +
      '</div>' +
      '<div class="card-stats-mini">' +
        ['str','dex','con','int','wis','cha'].map(function (k) {
          const v = stats[k] != null ? stats[k] : 10;
          return '<div class="stat"><div class="stat-label">' + k.toUpperCase() + '</div>' +
            '<div class="stat-val">' + v + '</div><div class="stat-mod">' + U.mod(v) + '</div></div>';
        }).join('') +
      '</div>' +
      ((c.tags && c.tags.length) ? '<div class="tags">' + c.tags.map(function (t) { return '<span class="tag">' + U.escapeHtml(t) + '</span>'; }).join('') + '</div>' : '') +
    '</article>';
  }

  function openNewDialog() {
    M.openModal({
      title: 'Новый персонаж',
      content:
        '<div class="grid" style="gap:14px">' +
          '<label class="field"><span class="field-label">Имя</span>' +
            '<input class="input" id="new-name" placeholder="Например: Старик Крэйг" autofocus></label>' +
          '<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:8px">' +
            '<button class="btn" data-cancel>Отмена</button>' +
            '<button class="btn btn-primary" data-create>Создать</button>' +
          '</div>' +
        '</div>',
      onMount: function (body, close) {
        const nameInput = body.querySelector('#new-name');
        setTimeout(function () { nameInput.focus(); }, 20);
        function create() {
          const name = nameInput.value.trim() || 'Без имени';
          const obj = makeBlank({ name: name });
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

  function renderEditor(root, c) {
    const dlPrefix = 'dl-' + (c.id || 'x').replace(/[^a-zA-Z0-9]/g, '') + '-';

    root.innerHTML =
      '<div class="page-toolbar">' +
        '<button class="btn" id="back-list">← К списку</button>' +
        '<span class="muted" id="save-status"></span>' +
        '<div class="spacer"></div>' +
        '<button class="btn" id="dup-creature">Дублировать</button>' +
        '<button class="btn btn-danger" id="del-creature">Удалить</button>' +
      '</div>' +
      datalistsHtml(dlPrefix) +
      '<form class="creature-editor" id="creature-form" onsubmit="return false">' +
        '<div class="editor-top">' +
          editorLeftHtml(c) +
          editorRightTopHtml(c, dlPrefix) +
        '</div>' +
        '<div class="editor-full">' +
          featuresSectionHtml(c) +
          reactionsSectionHtml(c) +
          actionsSectionHtml(c, 'actions', 'Действия', false) +
          actionsSectionHtml(c, 'legendaryActions', 'Легендарные действия', true) +
          loreSectionHtml(c) +
        '</div>' +
      '</form>';

    root.querySelector('#back-list').addEventListener('click', function () { editingId = null; render(root); });

    root.querySelector('#del-creature').addEventListener('click', function () {
      M.confirmDialog('Удалить «' + U.escapeHtml(c.name) + '»?').then(function (ok) {
        if (!ok) return;
        S.remove(STORE, c.id).then(function () {
          all = all.filter(function (x) { return x.id !== c.id; });
          editingId = null; render(root);
        });
      });
    });

    root.querySelector('#dup-creature').addEventListener('click', function () {
      const copy = JSON.parse(JSON.stringify(c));
      copy.id = U.uuid();
      copy.name = c.name + ' (копия)';
      copy.createdAt = copy.updatedAt = new Date().toISOString();
      S.put(STORE, copy).then(function () { editingId = copy.id; render(root); });
    });

    const saveStatus = root.querySelector('#save-status');
    const doSave = U.debounce(function () {
      c.updatedAt = new Date().toISOString();
      S.put(STORE, c).then(function () {
        if (saveStatus) saveStatus.textContent = 'Сохранено ' + new Date().toLocaleTimeString('ru-RU');
      });
    }, 400);

    const avatarWrap = root.querySelector('.avatar-wrap');
    if (avatarWrap) {
      avatarWrap.addEventListener('click', function (e) {
        if (e.target.classList.contains('avatar-clear')) return;
        const input = document.createElement('input');
        input.type = 'file'; input.accept = 'image/*';
        input.addEventListener('change', function () {
          const f = input.files && input.files[0];
          if (!f) return;
          U.compressImage(f, 800, 0.85).then(function (dataUrl) {
            c.avatar = dataUrl;
            avatarWrap.style.backgroundImage = 'url(' + dataUrl + ')';
            avatarWrap.classList.remove('avatar-empty');
            doSave();
          }).catch(function (err) { alert('Не получилось загрузить: ' + err.message); });
        });
        input.click();
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

    const form = root.querySelector('#creature-form');
    form.addEventListener('input', handleInput);
    form.addEventListener('change', handleInput);
    form.addEventListener('click', handleClick);

    function handleInput(e) {
      const t = e.target;

      if (t.matches('[data-field-pick]')) {
        const key = t.dataset.fieldPick;
        pickSaveValue(c, key, t.value);
        if (key === 'divinity') updateLegendResource(root, c);
        doSave(); return;
      }

      if (t.matches('[data-field]')) {
        const f = t.dataset.field;
        let v = t.value;
        if (t.type === 'number') v = v === '' ? '' : Number(v);
        c[f] = v;
        if (f === 'profBonus') {
          ['str','dex','con','int','wis','cha'].forEach(function (k) { refreshStatBox(root, c, k); });
        }
        doSave(); return;
      }

      if (t.matches('[data-speed]')) { c.speeds[t.dataset.speed] = t.value; doSave(); return; }

      if (t.matches('[data-stat]')) {
        const k = t.dataset.stat;
        c.stats[k] = Number(t.value) || 10;
        refreshStatBox(root, c, k); doSave(); return;
      }

      if (t.matches('[data-saveprof]')) {
        const k = t.dataset.saveprof;
        c.saveProf[k] = t.checked;
        refreshStatBox(root, c, k); doSave(); return;
      }

      if (t.matches('[data-dmg-mode]')) {
        const id = t.dataset.dmgMode;
        c.damageDefenses[id].mode = t.value;
        refreshDamageRow(root, c, id); doSave(); return;
      }
      if (t.matches('[data-dmg-count]')) {
        const id = t.dataset.dmgCount;
        c.damageDefenses[id].count = Math.max(0, Number(t.value) || 0);
        doSave(); return;
      }

      if (t.matches('[data-cond]')) { c.conditionDefenses[t.dataset.cond] = t.value; doSave(); return; }
      if (t.matches('[data-condcustom-name]')) {
        const idx = Number(t.dataset.condcustomName);
        if (c.conditionsCustom[idx]) c.conditionsCustom[idx].name = t.value;
        doSave(); return;
      }
      if (t.matches('[data-condcustom-mode]')) {
        const idx = Number(t.dataset.condcustomMode);
        if (c.conditionsCustom[idx]) c.conditionsCustom[idx].mode = t.value;
        doSave(); return;
      }

      if (t.matches('[data-rich]')) { c[t.dataset.rich] = t.value; doSave(); return; }
      if (t.matches('[data-tags]')) {
        c.tags = t.value.split(',').map(function (s) { return s.trim(); }).filter(Boolean);
        doSave(); return;
      }

      if (t.matches('[data-action-list]')) {
        const listKey = t.dataset.actionList;
        const idx = Number(t.dataset.actionIdx);
        const field = t.dataset.actionField;
        if (c[listKey][idx]) {
          let v = t.value;
          if (t.type === 'number') v = v === '' ? '' : Number(v);
          c[listKey][idx][field] = v;
          if (field === 'kind') {
            doSave();
            setTimeout(function () { renderEditor(root, c); }, 0);
            return;
          }
          doSave();
        }
        return;
      }

      if (t.matches('[data-hitdmg-field]')) {
        const listKey = t.dataset.hitdmgList;
        const aIdx = Number(t.dataset.hitdmgAction);
        const dIdx = Number(t.dataset.hitdmgIdx);
        const field = t.dataset.hitdmgField;
        const act = c[listKey][aIdx];
        if (act && act.damages[dIdx]) {
          let v = t.value;
          if (field === 'count' || field === 'die' || field === 'modifier') v = v === '' ? '' : Number(v);
          act.damages[dIdx][field] = v;
          if (field === 'count' || field === 'die' || field === 'modifier') {
            const prev = root.querySelector('[data-hitdmg-preview="' + aIdx + '-' + dIdx + '"]');
            if (prev) prev.textContent = formatDamagePreview(act.damages[dIdx]);
          }
          doSave();
        }
        return;
      }

      if (t.matches('[data-savedmg-field]')) {
        const listKey = t.dataset.savedmgList;
        const aIdx = Number(t.dataset.savedmgAction);
        const gIdx = Number(t.dataset.savedmgGidx);
        const dIdx = Number(t.dataset.savedmgIdx);
        const field = t.dataset.savedmgField;
        const act = c[listKey][aIdx];
        if (act && act.saveGroups[gIdx] && act.saveGroups[gIdx].damages[dIdx]) {
          let v = t.value;
          if (field === 'count' || field === 'die' || field === 'modifier') v = v === '' ? '' : Number(v);
          act.saveGroups[gIdx].damages[dIdx][field] = v;
          if (field === 'count' || field === 'die' || field === 'modifier') {
            const prev = root.querySelector('[data-savedmg-preview="' + aIdx + '-' + gIdx + '-' + dIdx + '"]');
            if (prev) prev.textContent = formatDamagePreview(act.saveGroups[gIdx].damages[dIdx]);
          }
          doSave();
        }
        return;
      }

      if (t.matches('[data-sg-field]')) {
        const listKey = t.dataset.sgList;
        const aIdx = Number(t.dataset.sgAction);
        const gIdx = Number(t.dataset.sgGidx);
        const field = t.dataset.sgField;
        const act = c[listKey][aIdx];
        if (act && act.saveGroups[gIdx]) {
          let v = t.value;
          if (t.type === 'number') v = v === '' ? '' : Number(v);
          act.saveGroups[gIdx][field] = v;
          doSave();
        }
        return;
      }

      if (t.matches('[data-cg-field]')) {
        const listKey = t.dataset.cgList;
        const aIdx = Number(t.dataset.cgAction);
        const gIdx = Number(t.dataset.cgGidx);
        const field = t.dataset.cgField;
        const act = c[listKey][aIdx];
        if (act && act.conditionGroups && act.conditionGroups[gIdx]) {
          let v = t.value;
          if (t.type === 'number') v = v === '' ? '' : Number(v);
          act.conditionGroups[gIdx][field] = v;
          if (field === 'conditionId') {
            // Перерисовать блок, чтобы показать/скрыть поле "Своё"
            doSave();
            setTimeout(function () { renderEditor(root, c); }, 0);
            return;
          }
          doSave();
        }
        return;
      }
    }

    function handleClick(e) {
      if (e.target.matches('[data-add-action]')) {
        const listKey = e.target.dataset.addAction;
        c[listKey].push(normalizeAction({}));
        doSave(); renderEditor(root, c); return;
      }
      if (e.target.matches('[data-del-action]')) {
        const listKey = e.target.dataset.delAction;
        const idx = Number(e.target.dataset.actionIdx);
        c[listKey].splice(idx, 1);
        doSave(); renderEditor(root, c); return;
      }
      if (e.target.matches('[data-add-hitdmg]')) {
        const listKey = e.target.dataset.addHitdmg;
        const idx = Number(e.target.dataset.actionIdx);
        c[listKey][idx].damages.push({ count: 1, die: 6, modifier: 0, type: 'bludgeoning' });
        doSave(); renderEditor(root, c); return;
      }
      if (e.target.matches('[data-del-hitdmg]')) {
        const listKey = e.target.dataset.delHitdmg;
        const aIdx = Number(e.target.dataset.actionIdx);
        const dIdx = Number(e.target.dataset.dmgIdx);
        c[listKey][aIdx].damages.splice(dIdx, 1);
        doSave(); renderEditor(root, c); return;
      }
      if (e.target.matches('[data-add-sg]')) {
        const listKey = e.target.dataset.addSg;
        const idx = Number(e.target.dataset.actionIdx);
        c[listKey][idx].saveGroups.push({ ability: '', dc: '', saveEffect: 'half', damages: [] });
        doSave(); renderEditor(root, c); return;
      }
      if (e.target.matches('[data-del-sg]')) {
        const listKey = e.target.dataset.delSg;
        const aIdx = Number(e.target.dataset.actionIdx);
        const gIdx = Number(e.target.dataset.gIdx);
        c[listKey][aIdx].saveGroups.splice(gIdx, 1);
        doSave(); renderEditor(root, c); return;
      }
      if (e.target.matches('[data-add-cg]')) {
        const listKey = e.target.dataset.addCg;
        const idx = Number(e.target.dataset.actionIdx);
        c[listKey][idx].conditionGroups = c[listKey][idx].conditionGroups || [];
        c[listKey][idx].conditionGroups.push({ conditionId: '', conditionCustom: '', ability: '', dc: '' });
        doSave(); renderEditor(root, c); return;
      }
      if (e.target.matches('[data-del-cg]')) {
        const listKey = e.target.dataset.delCg;
        const aIdx = Number(e.target.dataset.actionIdx);
        const gIdx = Number(e.target.dataset.gIdx);
        c[listKey][aIdx].conditionGroups.splice(gIdx, 1);
        doSave(); renderEditor(root, c); return;
      }
      if (e.target.matches('[data-add-savedmg]')) {
        const listKey = e.target.dataset.addSavedmg;
        const aIdx = Number(e.target.dataset.actionIdx);
        const gIdx = Number(e.target.dataset.gIdx);
        c[listKey][aIdx].saveGroups[gIdx].damages.push({ count: 1, die: 6, modifier: 0, type: 'bludgeoning' });
        doSave(); renderEditor(root, c); return;
      }
      if (e.target.matches('[data-del-savedmg]')) {
        const listKey = e.target.dataset.delSavedmg;
        const aIdx = Number(e.target.dataset.actionIdx);
        const gIdx = Number(e.target.dataset.gIdx);
        const dIdx = Number(e.target.dataset.dmgIdx);
        c[listKey][aIdx].saveGroups[gIdx].damages.splice(dIdx, 1);
        doSave(); renderEditor(root, c); return;
      }
      if (e.target.matches('[data-add-condcustom]')) {
        c.conditionsCustom.push({ name: '', mode: 'none' });
        doSave(); renderEditor(root, c); return;
      }
      if (e.target.matches('[data-del-condcustom]')) {
        const idx = Number(e.target.dataset.delCondcustom);
        c.conditionsCustom.splice(idx, 1);
        doSave(); renderEditor(root, c); return;
      }
    }
  }

  function actionsSectionHtml(c, key, title, isLegendary) {
    const list = c[key] || [];
    return '<section class="section">' +
      '<h3>' + title + '<span class="spacer"></span>' +
        '<button type="button" class="btn btn-small" data-add-action="' + key + '">+ добавить</button>' +
      '</h3>' +
      (isLegendary ? legendaryResourceHtml(c) : '') +
      '<div class="action-list">' +
        (list.length ? list.map(function (a, i) { return actionCardHtml(a, key, i, isLegendary, c); }).join('') : '<p class="muted">Пока пусто.</p>') +
      '</div>' +
    '</section>';
  }

  function actionCardHtml(a, listKey, idx, isLegendary, c) {
    const kindOptions = ACTION_KINDS.map(function (k) {
      return '<option value="' + k.id + '"' + (k.id === a.kind ? ' selected' : '') + '>' + k.label + '</option>';
    }).join('');
    const costOptions = ACTION_COSTS.map(function (cs) {
      return '<option value="' + cs.id + '"' + (cs.id === a.cost ? ' selected' : '') + '>' + cs.label + '</option>';
    }).join('');

    const costBlock = isLegendary
      ? '<div class="ac-fld ac-fld-narrow"><span class="ac-lbl">Ст. ЛД</span>' +
        '<input class="action-mini-input" type="number" min="0" data-action-list="' + listKey + '" data-action-idx="' + idx + '" data-action-field="legendCost" value="' + (a.legendCost || 1) + '"></div>'
      : '<div class="ac-fld ac-fld-cost"><span class="ac-lbl">Тип действия</span>' +
        '<select class="action-mini-input" data-action-list="' + listKey + '" data-action-idx="' + idx + '" data-action-field="cost">' + costOptions + '</select></div>';

    const head =
      '<div class="ac-head">' +
        '<input class="action-mini-input ac-name" type="text" data-action-list="' + listKey + '" data-action-idx="' + idx + '" data-action-field="name" value="' + U.escapeHtml(a.name) + '" placeholder="Название действия">' +
        '<select class="action-mini-input ac-kind" data-action-list="' + listKey + '" data-action-idx="' + idx + '" data-action-field="kind">' + kindOptions + '</select>' +
        costBlock +
        '<button type="button" class="btn btn-icon btn-small" data-del-action="' + listKey + '" data-action-idx="' + idx + '" title="Удалить">×</button>' +
      '</div>';

    let body = '';
    if (a.kind === 'attack') body = renderAttackBody(a, listKey, idx);
    else if (a.kind === 'spell') body = renderSpellBody(a, listKey, idx);
    else body = renderSpecialBody(a, listKey, idx);

    body += renderConditionGroupsBlock(a, listKey, idx);

    const noteRow =
      '<textarea class="action-mini-input ac-note" data-action-list="' + listKey + '" data-action-idx="' + idx + '" data-action-field="note" placeholder="Заметка (эффекты, условия)">' + U.escapeHtml(a.note) + '</textarea>';

    return '<div class="action-card kind-' + (a.kind || 'attack') + '">' + head + body + noteRow + '</div>';
  }

  // ---- Атака: общая строка + урон отдельной строкой ----
  function renderAttackBody(a, listKey, idx) {
    const targetOptions = TARGETS.map(function (tg) {
      return '<option value="' + tg.id + '"' + (tg.id === a.targets ? ' selected' : '') + '>' + tg.label + '</option>';
    }).join('');

    let toHitOptions = '<option value=""' + (!a.toHit ? ' selected' : '') + '>—</option>';
    for (let v = -5; v <= 30; v++) {
      const label = v >= 0 ? '+' + v : String(v);
      toHitOptions += '<option value="' + label + '"' + (String(a.toHit) === label ? ' selected' : '') + '>' + label + '</option>';
    }

    return '<div class="ac-save-groups">' +
      '<div class="ac-line ac-line-common">' +
        '<div class="ac-fld ac-fld-xs"><span class="ac-lbl">К попад.</span>' +
          '<select class="action-mini-input" data-action-list="' + listKey + '" data-action-idx="' + idx + '" data-action-field="toHit">' + toHitOptions + '</select></div>' +
        '<div class="ac-fld ac-fld-sm"><span class="ac-lbl">Дальность</span>' +
          '<input class="action-mini-input" type="text" data-action-list="' + listKey + '" data-action-idx="' + idx + '" data-action-field="range" value="' + U.escapeHtml(a.range) + '" placeholder="100"></div>' +
        '<div class="ac-fld ac-fld-sm"><span class="ac-lbl">Цели</span>' +
          '<select class="action-mini-input" data-action-list="' + listKey + '" data-action-idx="' + idx + '" data-action-field="targets">' + targetOptions + '</select></div>' +
        '<div class="ac-fld ac-fld-xs"><span class="ac-lbl">Атак</span>' +
          '<input class="action-mini-input" type="number" min="1" max="10" data-action-list="' + listKey + '" data-action-idx="' + idx + '" data-action-field="attacks" value="' + (a.attacks || 1) + '"></div>' +
      '</div>' +
      '<div class="ac-line ac-line-dmg">' +
        '<div class="ac-fld ac-fld-grow"><span class="ac-lbl">Урон при попадании</span>' +
          renderDmgList(a.damages, listKey, idx, 'hitdmg') +
        '</div>' +
      '</div>' +
    '</div>';
  }

  // ---- Заклинание: общая строка + строки спасбросков ----
  function renderSpellBody(a, listKey, idx) {
    const targetOptions = TARGETS.map(function (tg) {
      return '<option value="' + tg.id + '"' + (tg.id === a.targets ? ' selected' : '') + '>' + tg.label + '</option>';
    }).join('');

    const common =
      '<div class="ac-line ac-line-common">' +
        '<div class="ac-fld ac-fld-sm"><span class="ac-lbl">Дальность</span>' +
          '<input class="action-mini-input" type="text" data-action-list="' + listKey + '" data-action-idx="' + idx + '" data-action-field="range" value="' + U.escapeHtml(a.range) + '" placeholder="60"></div>' +
        '<div class="ac-fld ac-fld-sm"><span class="ac-lbl">Цели</span>' +
          '<select class="action-mini-input" data-action-list="' + listKey + '" data-action-idx="' + idx + '" data-action-field="targets">' + targetOptions + '</select></div>' +
        '<div class="ac-fld ac-fld-btn">' +
          '<button type="button" class="btn btn-small" data-add-sg="' + listKey + '" data-action-idx="' + idx + '">+ спасбросок</button>' +
        '</div>' +
      '</div>';

    const sgRows = a.saveGroups.map(function (sg, gi) {
      return renderSaveGroupRow(sg, gi, listKey, idx);
    }).join('');

    return '<div class="ac-save-groups">' + common + sgRows + '</div>';
  }

  // ---- Особое: атака-строка + урон + saveGroups ----
  function renderSpecialBody(a, listKey, idx) {
    const targetOptions = TARGETS.map(function (tg) {
      return '<option value="' + tg.id + '"' + (tg.id === a.targets ? ' selected' : '') + '>' + tg.label + '</option>';
    }).join('');

    let toHitOptions = '<option value=""' + (!a.toHit ? ' selected' : '') + '>—</option>';
    for (let v = -5; v <= 30; v++) {
      const label = v >= 0 ? '+' + v : String(v);
      toHitOptions += '<option value="' + label + '"' + (String(a.toHit) === label ? ' selected' : '') + '>' + label + '</option>';
    }

    const atkRow =
      '<div class="ac-line ac-line-common">' +
        '<div class="ac-fld ac-fld-xs"><span class="ac-lbl">К попад.</span>' +
          '<select class="action-mini-input" data-action-list="' + listKey + '" data-action-idx="' + idx + '" data-action-field="toHit">' + toHitOptions + '</select></div>' +
        '<div class="ac-fld ac-fld-sm"><span class="ac-lbl">Дальность</span>' +
          '<input class="action-mini-input" type="text" data-action-list="' + listKey + '" data-action-idx="' + idx + '" data-action-field="range" value="' + U.escapeHtml(a.range) + '" placeholder="100"></div>' +
        '<div class="ac-fld ac-fld-sm"><span class="ac-lbl">Цели</span>' +
          '<select class="action-mini-input" data-action-list="' + listKey + '" data-action-idx="' + idx + '" data-action-field="targets">' + targetOptions + '</select></div>' +
        '<div class="ac-fld ac-fld-xs"><span class="ac-lbl">Атак</span>' +
          '<input class="action-mini-input" type="number" min="1" max="10" data-action-list="' + listKey + '" data-action-idx="' + idx + '" data-action-field="attacks" value="' + (a.attacks || 1) + '"></div>' +
      '</div>';

    const dmgRow =
      '<div class="ac-line ac-line-dmg">' +
        '<div class="ac-fld ac-fld-grow"><span class="ac-lbl">Урон при попадании</span>' +
          renderDmgList(a.damages, listKey, idx, 'hitdmg') +
        '</div>' +
      '</div>';

    const sgRows = a.saveGroups.map(function (sg, gi) {
      return renderSaveGroupRow(sg, gi, listKey, idx);
    }).join('');

    const addSaveBtn =
      '<div class="ac-line ac-line-add">' +
        '<button type="button" class="btn btn-small" data-add-sg="' + listKey + '" data-action-idx="' + idx + '">+ спасбросок</button>' +
      '</div>';

    return '<div class="ac-save-groups">' + atkRow + dmgRow + sgRows + addSaveBtn + '</div>';
  }

  // ---- Строка saveGroup ----
  function renderSaveGroupRow(sg, gi, listKey, idx) {
    const abilityOpts = ABILITIES.map(function (ab) {
      return '<option value="' + ab.id + '"' + (ab.id === sg.ability ? ' selected' : '') + '>' + ab.label + '</option>';
    }).join('');
    const effOpts = SAVE_EFFECTS.map(function (ef) {
      return '<option value="' + ef.id + '"' + (ef.id === sg.saveEffect ? ' selected' : '') + '>' + ef.label + '</option>';
    }).join('');

    return '<div class="ac-line ac-line-sg">' +
      // Левая группа: спас, DC, эффект (по центру относительно урона)
      '<div class="ac-sg-left">' +
        '<div class="ac-fld ac-fld-xs"><span class="ac-lbl">Спас</span>' +
          '<select class="action-mini-input" data-sg-list="' + listKey + '" data-sg-action="' + idx + '" data-sg-gidx="' + gi + '" data-sg-field="ability">' + abilityOpts + '</select></div>' +
        '<div class="ac-fld ac-fld-xs"><span class="ac-lbl">DC</span>' +
          '<input class="action-mini-input" type="number" data-sg-list="' + listKey + '" data-sg-action="' + idx + '" data-sg-gidx="' + gi + '" data-sg-field="dc" value="' + U.escapeHtml(sg.dc) + '"></div>' +
        '<div class="ac-fld"><span class="ac-lbl">При успехе</span>' +
          '<select class="action-mini-input" data-sg-list="' + listKey + '" data-sg-action="' + idx + '" data-sg-gidx="' + gi + '" data-sg-field="saveEffect">' + effOpts + '</select></div>' +
      '</div>' +
      // Правая группа: урон при провале (стек)
      '<div class="ac-sg-right">' +
        '<span class="ac-lbl">Урон при провале</span>' +
        renderDmgList(sg.damages, listKey, idx, 'savedmg', gi) +
      '</div>' +
      '<button type="button" class="btn btn-icon btn-small ac-del-sg" data-del-sg="' + listKey + '" data-action-idx="' + idx + '" data-g-idx="' + gi + '" title="Удалить спасбросок">×</button>' +
    '</div>';
  }

  // ---- Список урона ----
  function renderDmgList(damages, listKey, idx, scope, gIdx) {
    const rows = (damages || []).map(function (d, i) {
      return renderDmgRow(d, i, listKey, idx, scope, gIdx);
    }).join('');
    const addAttr = scope === 'hitdmg'
      ? 'data-add-hitdmg="' + listKey + '" data-action-idx="' + idx + '"'
      : 'data-add-savedmg="' + listKey + '" data-action-idx="' + idx + '" data-g-idx="' + gIdx + '"';
    return '<div class="ac-dmg-list">' + rows +
      '<button type="button" class="btn btn-small ac-add-dmg" ' + addAttr + '>+ урон</button>' +
    '</div>';
  }

  // ---- Блок состояний действия ----
  function renderConditionGroupsBlock(a, listKey, idx) {
    const groups = a.conditionGroups || [];
    const rows = groups.map(function (cg, gi) {
      return renderConditionGroupRow(cg, gi, listKey, idx);
    }).join('');
    return '<div class="ac-cg-wrap">' +
      '<div class="ac-cg-title">Состояния<span class="ac-cg-hint">накладываются при провале спасброска</span></div>' +
      '<div class="ac-cg-list">' + rows + '</div>' +
      '<div><button type="button" class="btn btn-small" data-add-cg="' + listKey + '" data-action-idx="' + idx + '">+ состояние</button></div>' +
    '</div>';
  }

  function renderConditionGroupRow(cg, gi, listKey, idx) {
    const condOptions = CONDITIONS.map(function (c) {
      return '<option value="' + c.id + '"' + (c.id === cg.conditionId ? ' selected' : '') + '>' + c.label + '</option>';
    }).join('') +
    '<option value="custom"' + (cg.conditionId === 'custom' ? ' selected' : '') + '>— своё —</option>';

    const abilityOpts = ABILITIES.map(function (ab) {
      return '<option value="' + ab.id + '"' + (ab.id === cg.ability ? ' selected' : '') + '>' + ab.label + '</option>';
    }).join('');

    const customInputVisible = cg.conditionId === 'custom';

    return '<div class="ac-cg-row">' +
      '<div class="ac-fld"><span class="ac-lbl">Состояние</span>' +
        '<select class="action-mini-input" data-cg-list="' + listKey + '" data-cg-action="' + idx + '" data-cg-gidx="' + gi + '" data-cg-field="conditionId">' + condOptions + '</select></div>' +
      '<div class="ac-fld' + (customInputVisible ? '' : ' hidden') + '" data-cg-custom-wrap="' + idx + '-' + gi + '"><span class="ac-lbl">Своё</span>' +
        '<input class="action-mini-input" type="text" data-cg-list="' + listKey + '" data-cg-action="' + idx + '" data-cg-gidx="' + gi + '" data-cg-field="conditionCustom" value="' + U.escapeHtml(cg.conditionCustom) + '" placeholder="Название"></div>' +
      '<div class="ac-fld ac-fld-xs"><span class="ac-lbl">Спас</span>' +
        '<select class="action-mini-input" data-cg-list="' + listKey + '" data-cg-action="' + idx + '" data-cg-gidx="' + gi + '" data-cg-field="ability">' + abilityOpts + '</select></div>' +
      '<div class="ac-fld ac-fld-xs"><span class="ac-lbl">DC</span>' +
        '<input class="action-mini-input" type="number" data-cg-list="' + listKey + '" data-cg-action="' + idx + '" data-cg-gidx="' + gi + '" data-cg-field="dc" value="' + U.escapeHtml(cg.dc) + '"></div>' +
      '<button type="button" class="btn btn-icon btn-small" data-del-cg="' + listKey + '" data-action-idx="' + idx + '" data-g-idx="' + gi + '" title="Удалить">×</button>' +
    '</div>';
  }

  function renderDmgRow(d, i, listKey, idx, scope, gIdx) {
    const typeOptions = DAMAGE_TYPES.map(function (t) {
      return '<option value="' + t.id + '"' + (t.id === d.type ? ' selected' : '') + '>' + t.label + '</option>';
    }).join('');
    const dieOptions = DICE_SIDES.map(function (s) {
      return '<option value="' + s + '"' + (Number(d.die) === s ? ' selected' : '') + '>d' + s + '</option>';
    }).join('');

    let attrs, previewAttr, delAttr, fieldAttr;
    if (scope === 'hitdmg') {
      attrs = 'data-hitdmg-list="' + listKey + '" data-hitdmg-action="' + idx + '" data-hitdmg-idx="' + i + '"';
      previewAttr = 'data-hitdmg-preview="' + idx + '-' + i + '"';
      delAttr = 'data-del-hitdmg="' + listKey + '" data-action-idx="' + idx + '" data-dmg-idx="' + i + '"';
      fieldAttr = 'data-hitdmg-field';
    } else {
      attrs = 'data-savedmg-list="' + listKey + '" data-savedmg-action="' + idx + '" data-savedmg-gidx="' + gIdx + '" data-savedmg-idx="' + i + '"';
      previewAttr = 'data-savedmg-preview="' + idx + '-' + gIdx + '-' + i + '"';
      delAttr = 'data-del-savedmg="' + listKey + '" data-action-idx="' + idx + '" data-g-idx="' + gIdx + '" data-dmg-idx="' + i + '"';
      fieldAttr = 'data-savedmg-field';
    }

    return '<div class="ac-dmg-row">' +
      '<input class="action-mini-input ac-dmg-num" type="number" min="1" max="20" ' + attrs + ' ' + fieldAttr + '="count" value="' + (d.count != null ? d.count : 1) + '">' +
      '<select class="action-mini-input ac-dmg-die" ' + attrs + ' ' + fieldAttr + '="die">' + dieOptions + '</select>' +
      '<input class="action-mini-input ac-dmg-mod" type="number" ' + attrs + ' ' + fieldAttr + '="modifier" value="' + (d.modifier != null ? d.modifier : 0) + '">' +
      '<select class="action-mini-input ac-dmg-type" ' + attrs + ' ' + fieldAttr + '="type">' + typeOptions + '</select>' +
      '<span class="ac-dmg-preview" ' + previewAttr + '>' + formatDamagePreview(d) + '</span>' +
      '<button type="button" class="btn btn-icon btn-small" ' + delAttr + ' title="Удалить">×</button>' +
    '</div>';
  }

  function formatDamagePreview(d) {
    if (!d || !d.count || !d.die) return '';
    let s = d.count + 'd' + d.die;
    const m = Number(d.modifier) || 0;
    if (m > 0) s += '+' + m;
    else if (m < 0) s += m;
    return s;
  }

  function datalistsHtml(prefix) {
    function opts(list) {
      return list.map(function (x) { return '<option value="' + U.escapeHtml(x.label) + '"></option>'; }).join('');
    }
    return '<datalist id="' + prefix + 'type">' + opts(TYPES) + '</datalist>' +
           '<datalist id="' + prefix + 'alignment">' + opts(ALIGNMENTS) + '</datalist>' +
           '<datalist id="' + prefix + 'divinity">' + opts(DIVINITIES) + '</datalist>' +
           '<datalist id="' + prefix + 'klass">' + opts(CLASSES) + '</datalist>';
  }

  function editorLeftHtml(c) {
    const avatarStyle = c.avatar ? ' style="background-image:url(' + c.avatar + ')"' : '';
    const avatarClass = 'avatar-wrap' + (c.avatar ? '' : ' avatar-empty');

    let levelOptions = '';
    for (let i = 1; i <= 30; i++) {
      const xp = XP_TABLE[i] || 0;
      const sel = (i === Number(c.level)) ? ' selected' : '';
      levelOptions += '<option value="' + i + '"' + sel + '>' + i + ' (' + xp + ')</option>';
    }
    let profOptions = '';
    for (let i = -5; i <= 12; i++) {
      const sel = (i === Number(c.profBonus)) ? ' selected' : '';
      profOptions += '<option value="' + i + '"' + sel + '>' + (i >= 0 ? '+' + i : i) + '</option>';
    }

    return '<div class="editor-left">' +
      '<div class="left-block">' +
        '<label class="' + avatarClass + '"' + avatarStyle + '><button type="button" class="avatar-clear" title="Убрать">×</button></label>' +
        '<input class="left-name" type="text" data-field="name" value="' + U.escapeHtml(c.name) + '" placeholder="Имя">' +
        '<input class="left-subtitle" type="text" data-field="subtitle" value="' + U.escapeHtml(c.subtitle) + '" placeholder="Роль / подзаголовок">' +
      '</div>' +
      '<div class="left-block">' +
        '<div class="row row-2">' +
          '<label class="field"><span class="field-label">Уровень (опыт)</span>' +
            '<select class="input" data-field="level">' + levelOptions + '</select></label>' +
          '<label class="field"><span class="field-label">Бонус мастерства</span>' +
            '<select class="input" data-field="profBonus">' + profOptions + '</select></label>' +
        '</div>' +
        '<div class="row row-2">' +
          '<label class="field"><span class="field-label">КД</span>' +
            '<input class="input" type="number" data-field="ac" value="' + (c.ac != null ? c.ac : '') + '"></label>' +
          '<label class="field"><span class="field-label">Хиты тек./макс.</span>' +
            '<div style="display:flex;gap:4px">' +
              '<input class="input" type="number" data-field="hpCurrent" value="' + (c.hpCurrent != null ? c.hpCurrent : '') + '" placeholder="тек.">' +
              '<input class="input" type="number" data-field="hpMax" value="' + (c.hpMax != null ? c.hpMax : '') + '" placeholder="макс.">' +
            '</div></label>' +
        '</div>' +
      '</div>' +
      '<div class="left-block">' +
        '<div class="field-label" style="margin-bottom:6px">Скорости и инициатива</div>' +
        '<div class="speeds-left">' +
          '<label class="field"><span class="field-label">Ходьба</span><input class="input" type="text" data-speed="walk" value="' + U.escapeHtml(c.speeds.walk) + '" placeholder="30 фт."></label>' +
          '<label class="field"><span class="field-label">Полёт</span><input class="input" type="text" data-speed="fly" value="' + U.escapeHtml(c.speeds.fly) + '" placeholder="60 фт."></label>' +
          '<label class="field"><span class="field-label">Плавание</span><input class="input" type="text" data-speed="swim" value="' + U.escapeHtml(c.speeds.swim) + '" placeholder="40 фт."></label>' +
          '<label class="field"><span class="field-label">Лазание</span><input class="input" type="text" data-speed="climb" value="' + U.escapeHtml(c.speeds.climb) + '" placeholder="20 фт."></label>' +
          '<label class="field"><span class="field-label">Инициатива</span><input class="input" type="number" data-field="initiative" value="' + (c.initiative != null ? c.initiative : 0) + '" placeholder="0"></label>' +
          '<label class="field"><span class="field-label">Заметка</span><input class="input" type="text" data-speed="note" value="' + U.escapeHtml(c.speeds.note) + '" placeholder="игнор"></label>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  function editorRightTopHtml(c, dlPrefix) {
    return '<div class="editor-right-top">' +
      statsSectionHtml(c) +
      infoSectionHtml(c, dlPrefix) +
      '<div class="top-row">' + damageSectionHtml(c) + conditionsSectionHtml(c) + '</div>' +
    '</div>';
  }

  function statsSectionHtml(c) {
    const keys = [
      { k:'str',label:'СИЛ' }, { k:'dex',label:'ЛОВ' }, { k:'con',label:'ТЕЛ' },
      { k:'int',label:'ИНТ' }, { k:'wis',label:'МДР' }, { k:'cha',label:'ХАР' }
    ];
    return '<section class="section"><h3>Характеристики</h3>' +
      '<div class="stats-grid">' + keys.map(function (it) { return statBoxHtml(c, it.k, it.label); }).join('') + '</div>' +
    '</section>';
  }
  function statBoxHtml(c, k, label) {
    const v = c.stats[k] != null ? c.stats[k] : 10;
    const prof = !!c.saveProf[k];
    const pb = Number(c.profBonus) || 0;
    const total = U.modNumber(v) + (prof ? pb : 0);
    const totalStr = (total >= 0 ? '+' : '') + total;
    return '<div class="stat-box' + (prof ? ' prof' : '') + '" data-statbox="' + k + '">' +
      '<span class="stat-box-label">' + label + '</span>' +
      '<input class="stat-box-score" type="number" data-stat="' + k + '" value="' + v + '">' +
      '<span class="stat-box-mod">' + U.mod(v) + '</span>' +
      '<label class="stat-box-save' + (prof ? ' owned' : '') + '">' +
        '<input type="checkbox" data-saveprof="' + k + '"' + (prof ? ' checked' : '') + '>' +
        '<span class="save-dot"></span>' +
        '<span class="save-val">' + totalStr + '</span>' +
      '</label></div>';
  }
  function refreshStatBox(root, c, k) {
    const box = root.querySelector('[data-statbox="' + k + '"]');
    if (!box) return;
    const v = c.stats[k] != null ? c.stats[k] : 10;
    const prof = !!c.saveProf[k];
    const pb = Number(c.profBonus) || 0;
    const total = U.modNumber(v) + (prof ? pb : 0);
    const totalStr = (total >= 0 ? '+' : '') + total;
    box.querySelector('.stat-box-mod').textContent = U.mod(v);
    const saveVal = box.querySelector('.save-val');
    if (saveVal) saveVal.textContent = totalStr;
    box.classList.toggle('prof', prof);
    const lbl = box.querySelector('.stat-box-save');
    if (lbl) lbl.classList.toggle('owned', prof);
  }

  function infoSectionHtml(c, dlPrefix) {
    return '<section class="section"><h3>Основное</h3>' +
      '<div class="info-grid">' +
        '<label class="field"><span class="field-label">Тип</span>' +
          '<input class="input" type="text" list="' + dlPrefix + 'type" data-field-pick="type" value="' + U.escapeHtml(pickDisplayValue(c, 'type')) + '" placeholder="Начни вводить..."></label>' +
        '<label class="field"><span class="field-label">Мировоззрение</span>' +
          '<input class="input" type="text" list="' + dlPrefix + 'alignment" data-field-pick="alignment" value="' + U.escapeHtml(pickDisplayValue(c, 'alignment')) + '" placeholder="Начни вводить..."></label>' +
        '<label class="field"><span class="field-label">Божественность</span>' +
          '<input class="input" type="text" list="' + dlPrefix + 'divinity" data-field-pick="divinity" value="' + U.escapeHtml(pickDisplayValue(c, 'divinity')) + '" placeholder="Начни вводить..."></label>' +
        '<label class="field"><span class="field-label">Класс</span>' +
          '<input class="input" type="text" list="' + dlPrefix + 'klass" data-field-pick="klass" value="' + U.escapeHtml(pickDisplayValue(c, 'klass')) + '" placeholder="Начни вводить..."></label>' +
        '<label class="field"><span class="field-label">Фракция</span>' +
          '<input class="input" type="text" data-field="faction" value="' + U.escapeHtml(c.faction) + '"></label>' +
      '</div></section>';
  }

  function damageSectionHtml(c) {
    return '<section class="section"><h3>Защиты от урона</h3>' +
      '<div class="dmg-grid">' + DAMAGE_TYPES.map(function (t) { return damageRowHtml(c, t); }).join('') + '</div>' +
    '</section>';
  }
  function damageRowHtml(c, t) {
    const d = c.damageDefenses[t.id] || { mode: 'none', count: 0 };
    return '<div class="dmg-row" data-mode="' + d.mode + '" data-dtype="' + t.id + '" data-dmgrow="' + t.id + '">' +
      '<div class="dmg-name">' + t.label + (t.custom ? '<span class="dmg-hint">(свой)</span>' : '') + '</div>' +
      '<div class="dmg-controls">' +
        '<select class="dmg-select" data-dmg-mode="' + t.id + '">' +
          '<option value="none"' + (d.mode === 'none' ? ' selected' : '') + '>—</option>' +
          '<option value="resistance"' + (d.mode === 'resistance' ? ' selected' : '') + '>Сопр.</option>' +
          '<option value="vulnerability"' + (d.mode === 'vulnerability' ? ' selected' : '') + '>Уязв.</option>' +
          '<option value="immunity"' + (d.mode === 'immunity' ? ' selected' : '') + '>Иммун.</option>' +
        '</select>' +
        '<input class="dmg-count" type="number" min="0" max="20" data-dmg-count="' + t.id + '" value="' + (d.count || 0) + '">' +
      '</div></div>';
  }
  function refreshDamageRow(root, c, id) {
    const row = root.querySelector('[data-dmgrow="' + id + '"]');
    if (!row) return;
    row.dataset.mode = c.damageDefenses[id].mode;
  }

  function conditionsSectionHtml(c) {
    return '<section class="section"><h3>Состояния<span class="spacer"></span>' +
        '<button type="button" class="btn btn-small" data-add-condcustom>+ своё состояние</button>' +
      '</h3>' +
      '<div class="cond-grid">' +
        CONDITIONS.map(function (t) {
          const v = c.conditionDefenses[t.id] || 'none';
          return '<div class="cond-row">' +
            '<span class="cond-name">' + t.label + '</span>' +
            '<select class="cond-select" data-cond="' + t.id + '">' +
              '<option value="none"' + (v === 'none' ? ' selected' : '') + '>—</option>' +
              '<option value="resistance"' + (v === 'resistance' ? ' selected' : '') + '>Сопр.</option>' +
              '<option value="vulnerability"' + (v === 'vulnerability' ? ' selected' : '') + '>Уязв.</option>' +
              '<option value="immunity"' + (v === 'immunity' ? ' selected' : '') + '>Иммун.</option>' +
            '</select></div>';
        }).join('') +
        (c.conditionsCustom || []).map(function (cc, i) {
          return '<div class="cond-custom">' +
            '<input class="input" type="text" data-condcustom-name="' + i + '" value="' + U.escapeHtml(cc.name || '') + '" placeholder="Название">' +
            '<select class="cond-select" data-condcustom-mode="' + i + '">' +
              '<option value="none"' + (cc.mode === 'none' ? ' selected' : '') + '>—</option>' +
              '<option value="resistance"' + (cc.mode === 'resistance' ? ' selected' : '') + '>Сопр.</option>' +
              '<option value="vulnerability"' + (cc.mode === 'vulnerability' ? ' selected' : '') + '>Уязв.</option>' +
              '<option value="immunity"' + (cc.mode === 'immunity' ? ' selected' : '') + '>Иммун.</option>' +
            '</select>' +
            '<button type="button" class="btn btn-icon btn-small" data-del-condcustom="' + i + '">×</button>' +
          '</div>';
        }).join('') +
      '</div></section>';
  }

  function featuresSectionHtml(c) {
    return '<section class="section"><h3>Особенности<span class="spacer"></span>' +
        '<span class="hint-inline">Пустая строка — новая способность. Первое предложение до точки автоматически станет жирным в бою.</span>' +
      '</h3>' +
      '<textarea class="rich-input" data-rich="features" rows="6">' + U.escapeHtml(c.features) + '</textarea>' +
    '</section>';
  }
  function reactionsSectionHtml(c) {
    return '<section class="section"><h3>Реакции<span class="spacer"></span>' +
        '<span class="hint-inline">Тот же формат, что и у особенностей.</span>' +
      '</h3>' +
      '<textarea class="rich-input" data-rich="reactions" rows="5">' + U.escapeHtml(c.reactions) + '</textarea>' +
    '</section>';
  }

  function legendaryResourceHtml(c) {
    const div = DIVINITIES.find(function (d) { return d.id === c.divinity; }) || DIVINITIES[0];
    const isCustom = div.legend === null;
    const val = isCustom
      ? '<input class="action-mini-input" type="number" min="0" max="99" data-field="divinityCustom" value="' + U.escapeHtml(c.divinityCustom || '0') + '" style="width:70px">'
      : '<span class="legend-res-val">' + div.legend + '</span>';
    return '<div class="legend-res" id="legend-res-block">' +
      '<span class="legend-res-label">Ресурс ЛД</span>' + val +
      '<span class="legend-res-hint">Восстанавливается на рассвете.</span>' +
    '</div>';
  }
  function updateLegendResource(root, c) {
    const block = root.querySelector('#legend-res-block');
    if (!block) return;
    const div = DIVINITIES.find(function (d) { return d.id === c.divinity; }) || DIVINITIES[0];
    if (div.legend === null) {
      block.innerHTML = '<span class="legend-res-label">Ресурс ЛД</span>' +
        '<input class="action-mini-input" type="number" min="0" max="99" data-field="divinityCustom" value="' + U.escapeHtml(c.divinityCustom || '0') + '" style="width:70px">' +
        '<span class="legend-res-hint">Восстанавливается на рассвете.</span>';
    } else {
      block.innerHTML = '<span class="legend-res-label">Ресурс ЛД</span>' +
        '<span class="legend-res-val">' + div.legend + '</span>' +
        '<span class="legend-res-hint">Восстанавливается на рассвете.</span>';
    }
  }

  function loreSectionHtml(c) {
    return '<section class="section"><h3>Лор и заметки</h3>' +
      '<textarea class="rich-input" data-rich="lore" rows="6" placeholder="Описание, история, мотивация...">' + U.escapeHtml(c.lore) + '</textarea>' +
      '<label class="field" style="margin-top:10px"><span class="field-label">Теги (через запятую)</span>' +
        '<input class="input" type="text" data-tags value="' + U.escapeHtml((c.tags || []).join(', ')) + '"></label>' +
    '</section>';
  }

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