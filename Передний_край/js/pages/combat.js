window.PK = window.PK || {};
PK.pages = PK.pages || {};

PK.pages.combat = (function () {
  const U = PK.utils;
  const M = PK.modal;
  const S = PK.storage;
  const E = PK.combatEngine;

  let rootEl = null;
  let currentRenderId = 0;
  let unsub = null;
  let targeting = null;
  let events = [];
  let toastTimer = null;

  const DAMAGE_LABELS = {
    bludgeoning: 'Дробящий', piercing: 'Колющий', slashing: 'Рубящий',
    acid: 'Кислота', cold: 'Холод', fire: 'Огонь', lightning: 'Электричество',
    poison: 'Яд', necrotic: 'Некротический', radiant: 'Излучение',
    psychic: 'Психический', force: 'Силовой', thunder: 'Звук', pure: 'Чистый'
  };
  const DAMAGE_SHORT = {
    bludgeoning: 'дроб.', piercing: 'кол.', slashing: 'руб.', acid: 'кисл.',
    cold: 'хол.', fire: 'огн.', lightning: 'элек.', poison: 'яд',
    necrotic: 'некр.', radiant: 'изл.', psychic: 'псих.', force: 'сил.',
    thunder: 'звук', pure: 'чист.'
  };
  const TYPE_LABELS = {
    npc: 'НПС', player: 'Игрок', enemy: 'Противник',
    aberration: 'Аберрация', beast: 'Зверь', celestial: 'Небожитель',
    construct: 'Конструкт', dragon: 'Дракон', elemental: 'Элементаль',
    fey: 'Фея', fiend: 'Фиенд', giant: 'Великан', humanoid: 'Гуманоид',
    monstrosity: 'Монстр', ooze: 'Ослизень', plant: 'Растение', undead: 'Нежить'
  };
  const CONDITIONS_LIST = [
    { id: 'blinded', label: 'Ослеплён' },
    { id: 'charmed', label: 'Очарован' },
    { id: 'deafened', label: 'Оглох' },
    { id: 'frightened', label: 'Испуган' },
    { id: 'grappled', label: 'Схвачен' },
    { id: 'incapacitated', label: 'Недееспособен' },
    { id: 'invisible', label: 'Невидим' },
    { id: 'paralyzed', label: 'Парализован' },
    { id: 'petrified', label: 'Окаменел' },
    { id: 'poisoned', label: 'Отравлен' },
    { id: 'prone', label: 'Сбит с ног' },
    { id: 'restrained', label: 'Опутан' },
    { id: 'stunned', label: 'Ошеломлён' },
    { id: 'unconscious', label: 'Без сознания' },
    { id: 'exhausted', label: 'Истощён' }
  ];
  const ABILITY_LABELS = { str:'СИЛ', dex:'ЛОВ', con:'ТЕЛ', int:'ИНТ', mdr:'МДР', cha:'ХАР' };

  const CONDITION_ICONS = {
    blinded: '🕶', charmed: '💗', deafened: '🔇', frightened: '😱',
    grappled: '🤜', incapacitated: '💤', invisible: '👻', paralyzed: '🥶',
    petrified: '🗿', poisoned: '🤢', prone: '🔻', restrained: '⛓',
    stunned: '💫', unconscious: '😵', exhausted: '🥵'
  };
  function condIcon(id) { return CONDITION_ICONS[id] || '●'; }

  function rollD20() { return 1 + Math.floor(Math.random() * 20); }
  function rollDie(die) { return 1 + Math.floor(Math.random() * die); }
  function toNum(v) { const n = Number(String(v).replace(/[^\-\d.]/g, '')); return isNaN(n) ? 0 : n; }

  function rollD20Adv(mode) {
    const n = (mode === 'adv2' || mode === 'dis2') ? 3 : ((mode === 'adv' || mode === 'dis') ? 2 : 1);
    const rolls = [];
    for (let i = 0; i < n; i++) rolls.push(rollD20());
    let value;
    if (mode === 'adv' || mode === 'adv2') value = Math.max.apply(null, rolls);
    else if (mode === 'dis' || mode === 'dis2') value = Math.min.apply(null, rolls);
    else value = rolls[0];
    return { value: value, rolls: rolls, mode: mode };
  }

  function advRowHtml(groupName, current) {
    current = current || 'normal';
    const opts = [
      { v: 'normal', l: 'Обычный' },
      { v: 'adv', l: 'Преим.' },
      { v: 'dis', l: 'Помеха' },
      { v: 'adv2', l: '2× преим.' },
      { v: 'dis2', l: '2× помеха' }
    ];
    return '<div class="adv-row">' + opts.map(function (o) {
      return '<label class="adv-btn"><input type="radio" name="' + groupName + '" data-adv-mode value="' + o.v + '"' + (current === o.v ? ' checked' : '') + '><span>' + o.l + '</span></label>';
    }).join('') + '</div>';
  }

  function advRollsLine(r) {
    if (!r || !r.rolls || r.rolls.length <= 1) return '';
    let hint = '';
    if (r.mode === 'adv') hint = ' — преим.';
    else if (r.mode === 'dis') hint = ' — помеха';
    else if (r.mode === 'adv2') hint = ' — 2× преим.';
    else if (r.mode === 'dis2') hint = ' — 2× помеха';
    return '<div class="rolls-line muted">Броски: [' + r.rolls.join(', ') + '] → ' + r.value + hint + '</div>';
  }

  function rollDamagePieces(damages) {
    return (damages || []).map(function (d) {
      const cnt = Number(d.count) || 1;
      const die = Number(d.die) || 6;
      const mod = Number(d.modifier) || 0;
      const rolls = [];
      for (let i = 0; i < cnt; i++) rolls.push(rollDie(die));
      const sum = rolls.reduce(function (a, b) { return a + b; }, 0) + mod;
      return { type: d.type, rolls: rolls, count: cnt, die: die, modifier: mod, sum: sum };
    });
  }
  function totalDamagePieces(pieces) {
    return (pieces || []).reduce(function (a, p) { return a + (Number(p.sum) || 0); }, 0);
  }
  function applyResistances(target, damagePieces) {
    const notes = [];
    let final = 0;
    (damagePieces || []).forEach(function (dp) {
      const def = (target.damageDefenses && target.damageDefenses[dp.type]) || { mode: 'none', count: 0 };
      let dmg = Number(dp.sum) || 0;
      let line = DAMAGE_LABELS[dp.type] || dp.type;
      let lineDmg = dmg;
      if (def.mode === 'immunity') { lineDmg = 0; line += ': иммунитет'; }
      else if (def.mode === 'resistance') {
        const cnt = Number(def.count) || 0;
        if (cnt >= 2) {
          const half = Math.floor(dmg / 2);
          const after = Math.max(0, half - 4 * (cnt - 1));
          lineDmg = after;
          line += ': сопр.×' + cnt + ' (' + dmg + '→' + after + ')';
        } else { lineDmg = Math.floor(dmg / 2); line += ': сопр. (' + dmg + '→' + lineDmg + ')'; }
      } else if (def.mode === 'vulnerability') {
        lineDmg = Math.floor(dmg * 1.5);
        line += ': уязв. (' + dmg + '→' + lineDmg + ')';
      }
      notes.push(line); final += lineDmg;
    });
    return { final: Math.max(0, final), notes: notes };
  }
  function saveStr(p, ability) {
    const v = (p.stats && p.stats[ability]) || 10;
    const prof = p.saveProf && p.saveProf[ability];
    const pb = prof ? (Number(p.profBonus) || 0) : 0;
    const total = U.modNumber(v) + pb;
    return (total >= 0 ? '+' : '') + total;
  }
  function typeLabel(p) {
    if (!p.type) return p.isPlayer ? 'Игрок' : 'НПС';
    return TYPE_LABELS[p.type] || p.type;
  }

  function showToast(html, opts) {
    opts = opts || {};
    let el = document.getElementById('pk-toast');
    if (!el) { el = document.createElement('div'); el.id = 'pk-toast'; document.body.appendChild(el); }
    el.innerHTML = html;
    el.className = 'pk-toast show' + (opts.kind ? ' ' + opts.kind : '');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.className = 'pk-toast'; }, opts.duration || 3500);
  }

  function render(root) {
    rootEl = root;
    const rid = ++currentRenderId;
    if (unsub) unsub();
    unsub = E.subscribe(function () {
      if (rid === currentRenderId && rootEl && document.body.contains(rootEl)) renderMain();
    });
    E.loadLatest().then(function (existing) {
      if (rid !== currentRenderId) return;
      if (!existing) renderWelcome(); else renderMain();
    });
  }

  function renderWelcome() {
    rootEl.innerHTML =
      '<div class="combat-welcome">' +
        '<h2>Бой ещё не начат</h2>' +
        '<p class="muted">Создай новый бой, добавь участников, брось инициативу и жми «Начать бой».</p>' +
        '<button class="btn btn-primary" id="combat-new">Начать новый бой</button>' +
      '</div>';
    rootEl.querySelector('#combat-new').addEventListener('click', function () {
      E.createCombat().then(renderMain);
    });
  }

  function renderMain() {
    const c = E.get();
    if (!c) return renderWelcome();
    if (!c.started) renderDraft(c); else renderCombat(c);
  }

  function renderDraft(c) {
    const allHaveInit = c.participants.length > 0 && c.participants.every(function (p) { return p.initiative != null; });
    rootEl.innerHTML =
      '<div class="combat-page">' +
        '<div class="combat-toolbar">' +
          '<h2 style="margin:0;font-size:15px">Подготовка боя</h2>' +
          '<div class="spacer"></div>' +
          '<button class="btn" id="add-creature">+ Из бестиария</button>' +
          '<button class="btn" id="add-player">+ Игрок</button>' +
          '<button class="btn" id="roll-all">🎲 Бросить всем</button>' +
          '<button class="btn btn-primary" id="start-combat"' + (allHaveInit ? '' : ' disabled') + '>Начать бой</button>' +
          '<button class="btn btn-danger" id="cancel-combat">Отмена</button>' +
        '</div>' +
        '<div class="draft-participants">' +
          (c.participants.length ? c.participants.map(draftRowHtml).join('') : '<p class="empty">Пусто. Добавь бойцов из бестиария или игроков.</p>') +
        '</div>' +
      '</div>';
    rootEl.querySelector('#add-creature').addEventListener('click', openBestiaryPicker);
    rootEl.querySelector('#add-player').addEventListener('click', openAddPlayerDialog);
    rootEl.querySelector('#roll-all').addEventListener('click', function () { E.rollInitiativeAll(); });
    rootEl.querySelector('#start-combat').addEventListener('click', function () {
      const r = E.startCombat(); if (r && r.error) alert(r.error);
    });
    rootEl.querySelector('#cancel-combat').addEventListener('click', function () {
      if (confirm('Отменить бой и удалить всех участников?')) E.clear().then(renderWelcome);
    });
    rootEl.querySelector('.draft-participants').addEventListener('input', function (e) {
      if (e.target.matches('[data-init-input]')) E.setInitiative(e.target.dataset.initInput, e.target.value);
    });
    rootEl.querySelector('.draft-participants').addEventListener('click', function (e) {
      const rb = e.target.closest('[data-roll-init]');
      if (rb) { E.rollInitiativeOne(rb.dataset.rollInit); return; }
      const db = e.target.closest('[data-del-p]');
      if (db && confirm('Удалить из боя?')) E.removeParticipant(db.dataset.delP);
    });
  }

  function draftRowHtml(p) {
    const init = p.initiative != null ? p.initiative : '';
    return '<div class="draft-row' + (p.isPlayer ? ' player' : '') + '">' +
      '<div class="draft-avatar" style="' + (p.avatar ? 'background-image:url(' + p.avatar + ')' : '') + '">' +
        (p.avatar ? '' : U.escapeHtml((p.name || '?').slice(0, 1))) + '</div>' +
      '<div class="draft-name">' + U.escapeHtml(p.name) + (p.isPlayer ? ' <span class="badge">Игрок</span>' : '') + '</div>' +
      '<div class="draft-meta">КД ' + p.ac + ' · HP ' + p.hpCurrent + '/' + p.hpMax + '</div>' +
      '<div class="draft-init">' +
        (p.isPlayer
          ? '<input class="input" type="number" data-init-input="' + p.id + '" value="' + init + '" placeholder="Иниц.">'
          : (p.initiative != null
            ? '<span class="draft-init-val">' + p.initiative + '</span>'
            : '<button class="btn btn-small" data-roll-init="' + p.id + '">🎲</button>')) +
      '</div>' +
      '<button class="btn btn-icon btn-small" data-del-p="' + p.id + '" title="Удалить">×</button>' +
    '</div>';
  }

  function renderCombat(c) {
    const active = c.participants[c.activeIdx];
    if (!active) return renderWelcome();
    const viewing = c.participants[c.viewingIdx] || active;

    rootEl.innerHTML =
      '<div class="combat-page">' +
        '<div class="combat-toolbar">' +
          '<span class="combat-round">Раунд ' + c.round + '</span>' +
          '<button class="btn" id="prev-turn">← Назад</button>' +
          '<button class="btn btn-primary" id="next-turn">Следующий ход →</button>' +
          '<div class="spacer"></div>' +
          (targeting
            ? '<span class="targeting-hint">Выбери цель: <b>' + targetingHint() + '</b></span>' +
              (targeting.canApply ? '<button class="btn btn-primary" id="target-apply">Применить</button>' : '') +
              '<button class="btn" id="target-cancel">Отмена</button>'
            : '<button class="btn" id="add-creature-live">+ Боец</button>' +
              '<button class="btn" id="undo-btn">↶ Откат</button>' +
              '<button class="btn btn-danger" id="end-combat">Завершить</button>'
          ) +
        '</div>' +
        '<div class="init-strip-wrap">' +
          '<div class="initiative-strip" id="init-strip">' +
            c.participants.map(function (p, i) { return initCardHtml(p, i, c); }).join('') +
          '</div>' +
        '</div>' +
        '<div class="combat-body">' +
          '<div class="selected-panel" id="selected-panel">' + selectedPanelHtml(viewing, active, c) + '</div>' +
          '<div class="events-panel">' +
            '<div class="events-header">' +
              '<span>📋 Что произошло</span>' +
              '<div class="spacer"></div>' +
              '<button class="btn btn-small" id="clear-events">Очистить</button>' +
            '</div>' +
            '<div class="events-list" id="events-list">' + eventsListHtml() + '</div>' +
            '<div class="log-toggle" id="log-toggle">▸ Показать полный лог</div>' +
            '<div class="log-full hidden" id="log-full">' + logFullHtml(c) + '</div>' +
          '</div>' +
        '</div>' +
      '</div>';

    bindCombatEvents(c, viewing, active);
  }

  function initCardHtml(p, i, c) {
    const isActive = i === c.activeIdx;
    const isViewing = i === c.viewingIdx;
    const isTarget = targeting && targeting.selected.indexOf(p.id) !== -1;
	const hpPct = p.hpMax > 0 ? Math.max(0, Math.min(100, Math.round(p.hpCurrent / p.hpMax * 100))) : 0;
	const hpCls = hpPct > 50 ? 'high' : hpPct > 25 ? 'mid' : 'low';
	const hasTempHp = p.tempHp > 0;
    const initials = p.avatar ? '' : U.escapeHtml((p.name || '?').slice(0, 1));
    const isDying = p.isPlayer && p.hpCurrent <= 0 && p.alive && !(p.deathSaves && p.deathSaves.stable);
    const isDeadPlayer = p.isPlayer && !p.alive;
    const skipsNow = p.skipsThisRound && p.joinedAtRound === c.round && p.alive;
    return '<div class="init-card' +
        (p.isPlayer ? ' player' : '') +
        (isActive ? ' active' : '') +
        (isViewing && !isActive ? ' viewing' : '') +
        (isTarget ? ' target' : '') +
        (p.alive ? '' : ' dead') +
        (isDying ? ' dying' : '') +
        (isDeadPlayer ? ' dead-player' : '') +
        (skipsNow ? ' skipping' : '') +
        '" data-pid="' + p.id + '" title="' + U.escapeHtml(p.name) + '">' +
      (isActive ? '<div class="init-crown">★</div>' : '') +
      (skipsNow ? '<div class="init-skip" title="Пропуск хода">⏭</div>' : '') +
      (isDeadPlayer ? '<div class="init-dead-mark" title="Погиб">☠</div>' : '') +
      '<div class="init-avatar" style="' + (p.avatar ? 'background-image:url(' + p.avatar + ')' : '') + '">' + initials + '</div>' +
      '<div class="init-name">' + U.escapeHtml(p.name) + '</div>' +
      '<div class="init-hp"><div class="init-hp-fill ' + hpCls + '" style="width:' + hpPct + '%"></div></div>' +
      '<div class="init-hp-text">' + p.hpCurrent + '/' + p.hpMax +
	    (hasTempHp ? ' <span class="temp-hp-badge" title="Временные HP">+' + p.tempHp + '</span>' : '') +
	  '</div>' +
      (p.initiative != null ? '<div class="init-init">Иниц. ' + p.initiative + '</div>' : '') +
      initConditionsHtml(p) +
      (isDying ? '<div class="init-dying" title="На грани смерти">⚠</div>' : '') +
    '</div>';
  }

  function initConditionsHtml(p) {
    const conds = p.conditions || [];
    if (!conds.length) return '';
    const shown = conds.slice(0, 3);
    const more = conds.length - shown.length;
    const tooltip = conds.map(function (c) { return c.name; }).join(', ');
    return '<div class="init-conditions" title="' + U.escapeHtml(tooltip) + '">' +
      shown.map(function (c) { return '<span class="init-cond">' + condIcon(c.id) + '</span>'; }).join('') +
      (more > 0 ? '<span class="init-cond-more">+' + more + '</span>' : '') +
    '</div>';
  }

  function targetingHint() {
    if (!targeting) return '';
    const max = targeting.action.targets;
    const cnt = targeting.selected.length;
    if (cnt === 0) {
      const m = max === 'self' ? 'на себя' : max === 'unlimited' ? 'без ограничений' : 'до ' + max;
      return 'выбери ' + m;
    }
    return 'выбрано ' + cnt + (max === 'unlimited' ? ' (∞)' : ' / до ' + max);
  }

  function selectedPanelHtml(p, active, c) {
    if (!p) return '<p class="empty">Никто не выбран.</p>';
    const isActive = p.id === active.id;
    const hpPct = p.hpMax > 0 ? Math.max(0, Math.min(100, Math.round(p.hpCurrent / p.hpMax * 100))) : 0;
    const hpCls = hpPct > 50 ? 'high' : hpPct > 25 ? 'mid' : 'low';
    const isDying = p.isPlayer && p.hpCurrent <= 0 && p.alive && !(p.deathSaves && p.deathSaves.stable);
    const isDeadPlayer = p.isPlayer && !p.alive;

    const savesHtml = ['str','dex','con','int','mdr','cha'].map(function (k) {
      const s = saveStr(p, k);
      return '<button class="stat-action" data-save-stat="' + k + '" title="Бросить спасбросок">' +
        ABILITY_LABELS[k] + ' <b>' + s + '</b></button>';
    }).join('');

    const speedParts = [];
    if (p.speeds) {
      if (p.speeds.walk) speedParts.push('Ход ' + p.speeds.walk);
      if (p.speeds.fly) speedParts.push('Полёт ' + p.speeds.fly);
      if (p.speeds.swim) speedParts.push('Плав. ' + p.speeds.swim);
      if (p.speeds.climb) speedParts.push('Лаз. ' + p.speeds.climb);
      if (p.speeds.hover) speedParts.push('Парение ' + p.speeds.hover);
      if (p.speeds.note) speedParts.push(p.speeds.note);
    }
    const speedHtml = speedParts.length ? '<div class="speed-line muted">Скорости: ' + U.escapeHtml(speedParts.join(' · ')) + '</div>' : '';

    return '' +
      (isDying ? '<div class="dying-banner"><span class="dying-icon">⚠</span>НА ГРАНИ СМЕРТИ</div>' : '') +
      (isDeadPlayer ? '<div class="dead-banner"><span>☠</span>Погиб. Можно воскресить.</div>' : '') +

      '<div class="sel-head">' +
        '<div class="sel-avatar" style="' + (p.avatar ? 'background-image:url(' + p.avatar + ')' : '') + '">' +
          (p.avatar ? '' : U.escapeHtml((p.name || '?').slice(0, 1))) +
        '</div>' +
        '<div class="sel-info">' +
          '<h2>' + U.escapeHtml(p.name) + (isActive ? ' <span class="active-pill">★ ходит</span>' : '') + '</h2>' +
          '<div class="muted">Ур. ' + p.level + ' · ' + typeLabel(p) + '</div>' +
        '</div>' +
      '</div>' +

      (isDeadPlayer ?
        '<div class="revive-block"><button class="btn btn-primary" id="revive-player">✨ Воскресить (1 HP)</button></div>'
        : '') +

      '<div class="hp-block">' +
        '<div class="hp-bar"><div class="hp-fill ' + hpCls + '" style="width:' + hpPct + '%"></div></div>' +
        '<div class="hp-row">' +
          '<span class="hp-current">' + p.hpCurrent + '</span>' +
          '<span class="hp-sep">/</span>' +
          '<span class="hp-max">' + p.hpMax + '</span>' +
          (p.tempHp ? '<span class="temp-hp">+' + p.tempHp + ' врем.</span>' : '') +
          '<div class="spacer"></div>' +
          '<button class="btn btn-small" data-quick-hp="5">+5</button>' +
          '<button class="btn btn-small" data-quick-hp="1">+1</button>' +
          '<button class="btn btn-small btn-danger" data-quick-hp="-1">−1</button>' +
          '<button class="btn btn-small btn-danger" data-quick-hp="-5">−5</button>' +
          '<button class="btn btn-small" id="custom-hp">своё…</button>' +
		  '<button class="btn btn-small" id="temp-hp-btn" title="Временные HP">🛡</button>' +
        '</div>' +
      '</div>' +

      speedHtml +

      '<div class="stat-actions">' +
        '<button class="stat-action stat-ac" data-ac-roll="' + p.ac + '" title="Бросок d20 против КД">КД <b>' + p.ac + '</b></button>' +
        '<span class="stat-sep"></span>' +
        savesHtml +
      '</div>' +

      '<section class="sel-section">' +
        '<h3>Состояния<span class="spacer"></span>' +
          '<button class="btn btn-small" id="add-condition">+ добавить</button>' +
        '</h3>' +
        '<div class="active-conditions">' +
          ((p.conditions && p.conditions.length)
            ? p.conditions.map(function (cc) {
                return '<span class="cond-chip" data-cond-id="' + cc.id + '">' +
                  U.escapeHtml(cc.name) + ' <span class="cond-x">×</span></span>';
              }).join('')
            : '<span class="muted">Нет состояний</span>') +
        '</div>' +
      '</section>' +

      (p.isPlayer ?
        '<section class="sel-section">' +
          '<h3>Смертельные спасброски</h3>' +
          '<div class="death-saves-row">' +
            '<span>Успехи: <b>' + (p.deathSaves.successes || 0) + '</b>/3</span>' +
            '<span>Провалы: <b>' + (p.deathSaves.failures || 0) + '</b>/3</span>' +
            (p.deathSaves.stable ? '<span class="muted">(стабилизирован)</span>' : '') +
          '</div>' +
          '<div class="death-buttons">' +
            '<button class="btn btn-small" data-add-fail="1">+1 провал</button>' +
            '<button class="btn btn-small" data-add-fail="2">+2 провала (в упор)</button>' +
            '<button class="btn btn-small" data-add-success="1">+1 успех</button>' +
          '</div>' +
        '</section>'
        : '') +

      ((p.actions && p.actions.length) ?
        '<section class="sel-section">' +
          '<h3>Действия</h3>' +
          '<div class="actions-grid">' +
            p.actions.map(function (a, i) { return actionButtonHtml(a, i, false); }).join('') +
          '</div>' +
        '</section>'
        : '') +

      legendarySectionHtml(p) +

      ((p.reactions) ?
        '<section class="sel-section">' +
          '<details><summary>Реакции</summary><div class="rich">' + richRender(p.reactions) + '</div></details>' +
        '</section>' : '') +

      ((p.features) ?
        '<section class="sel-section">' +
          '<details><summary>Особенности</summary><div class="rich">' + richRender(p.features) + '</div></details>' +
        '</section>' : '');
  }

  function dmgShortHtml(d) {
    let s = d.count + 'd' + d.die;
    const m = Number(d.modifier) || 0;
    if (m > 0) s += '+' + m; else if (m < 0) s += m;
    return s + ' ' + (DAMAGE_SHORT[d.type] || d.type);
  }

  function actionButtonHtml(a, idx, isLegendary) {
    const kindClass = a.kind === 'spell' ? 'spell' : a.kind === 'attack' ? 'attack' : 'special';
    const kindIcon = a.kind === 'spell' ? '✨' : a.kind === 'attack' ? '⚔' : '◆';
    const hitDamages = (a.damages || []).map(dmgShortHtml).join(', ');
    const saveGroups = a.saveGroups || [];
    let saveInfo = '';
    if (saveGroups.length) {
      saveInfo = saveGroups.map(function (sg) {
        const ab = sg.ability ? ABILITY_LABELS[sg.ability] : '—';
        const dc = sg.dc ? ' DC ' + sg.dc : '';
        const dm = (sg.damages || []).map(dmgShortHtml).join(', ');
        return ab + dc + (dm ? ' → ' + dm : '');
      }).join(' · ');
    }
    const attacksInfo = (a.attacks && a.attacks > 1) ? '<span class="ab-attacks">×' + a.attacks + ' атак</span>' : '';
    const costBadge = isLegendary
      ? '<span class="ab-cost">' + (a.legendCost || 1) + ' ЛД</span>'
      : '';
    return '<button class="action-btn ' + kindClass + (isLegendary ? ' legendary' : '') + '" data-action-idx="' + idx + '"' + (isLegendary ? ' data-legendary="1"' : '') + '>' +
      '<div class="ab-name">' + kindIcon + ' ' + U.escapeHtml(a.name || '(без названия)') + costBadge + '</div>' +
      '<div class="ab-info">' +
        (a.toHit ? '<span>' + U.escapeHtml(a.toHit) + '</span>' : '') +
        attacksInfo +
        (hitDamages ? '<span>' + hitDamages + '</span>' : '') +
        (saveInfo ? '<span class="ab-save">' + saveInfo + '</span>' : '') +
      '</div>' +
    '</button>';
  }

  function legendarySectionHtml(p) {
    const list = p.legendaryActions || [];
    if (!list.length) return '';
    const max = p.legendaryMax || 0;
    const cur = p.legendaryRemaining != null ? p.legendaryRemaining : max;
    return '<section class="sel-section legendary-section">' +
      '<h3>Легендарные действия<span class="spacer"></span>' +
        '<span class="legendary-counter" title="Текущий/максимальный ресурс">ЛД: <b>' + cur + '</b> / ' + max + '</span>' +
        '<button class="btn btn-small" data-legend-add="-1" title="Отнять 1 ЛД">−1</button>' +
        '<button class="btn btn-small" data-legend-add="1" title="Восстановить 1 ЛД">+1</button>' +
      '</h3>' +
      '<div class="actions-grid">' +
        list.map(function (a, i) { return actionButtonHtml(a, i, true); }).join('') +
      '</div>' +
    '</section>';
  }

  function richRender(text) {
    if (!text) return '';
    return String(text).split(/\n\s*\n/).map(function (para) {
      const m = para.match(/^([^.!?]+[.!?])([\s\S]*)$/);
      if (m) return '<p><strong>' + U.escapeHtml(m[1]) + '</strong>' + U.escapeHtml(m[2]) + '</p>';
      return '<p>' + U.escapeHtml(para) + '</p>';
    }).join('');
  }

  function eventsListHtml() {
    if (!events.length) return '<p class="muted events-empty">Пока ничего не произошло.</p>';
    return events.map(function (ev) {
      return '<div class="event-row ' + (ev.kind || '') + '">' +
        '<div class="event-head">' + U.escapeHtml(ev.head) + '</div>' +
        (ev.body ? '<div class="event-body">' + ev.body + '</div>' : '') +
      '</div>';
    }).join('');
  }
  function addEvent(ev) { events.unshift(ev); if (events.length > 5) events.length = 5; }

  function logFullHtml(c) {
    const log = (c.log || []).slice().reverse();
    if (!log.length) return '<p class="muted" style="padding:8px">Пусто.</p>';
    return '<div class="log-list-full">' + log.map(function (l) {
      const t = new Date(l.at);
      const time = ('0' + t.getHours()).slice(-2) + ':' + ('0' + t.getMinutes()).slice(-2) + ':' + ('0' + t.getSeconds()).slice(-2);
      return '<div class="log-row"><span class="log-time">' + time + '</span><span class="log-text">' + U.escapeHtml(l.text) + '</span></div>';
    }).join('') + '</div>';
  }

  function bindCombatEvents(c, viewing, active) {
    const strip = rootEl.querySelector('#init-strip');
    strip.addEventListener('click', function (e) {
      const card = e.target.closest('.init-card');
      if (!card) return;
      const pid = card.dataset.pid;
      if (targeting) toggleTarget(pid); else E.setViewing(pid);
    });

    const safe = function (sel, ev, fn) {
      const el = rootEl.querySelector(sel);
      if (el) el.addEventListener(ev, fn);
    };

    safe('#next-turn', 'click', function () { E.nextTurn(); });
    safe('#prev-turn', 'click', function () { E.prevTurn(); });
    safe('#undo-btn', 'click', function () { if (!E.undo()) alert('Нечего откатывать'); });
    safe('#end-combat', 'click', function () {
      if (confirm('Завершить бой? Все данные будут удалены.')) { E.endCombat(); E.clear().then(renderWelcome); }
    });
    safe('#add-creature-live', 'click', openBestiaryPicker);
    safe('#target-cancel', 'click', function () { targeting = null; renderMain(); });
    safe('#target-apply', 'click', function () { openAttackModal(); });
    safe('#clear-events', 'click', function () {
      events = [];
      const el = rootEl.querySelector('#events-list');
      if (el) el.innerHTML = eventsListHtml();
    });
    safe('#log-toggle', 'click', function () {
      const log = rootEl.querySelector('#log-full');
      const toggle = rootEl.querySelector('#log-toggle');
      if (!log) return;
      log.classList.toggle('hidden');
      toggle.textContent = log.classList.contains('hidden') ? '▸ Показать полный лог' : '▾ Скрыть полный лог';
    });

    function onKey(e) {
      if (e.key === 'Enter' && targeting && targeting.canApply) {
        e.preventDefault(); openAttackModal();
      } else if (e.key === 'Escape' && targeting) {
        targeting = null; renderMain();
      }
    }
    if (window._pkCombatKeyHandler) document.removeEventListener('keydown', window._pkCombatKeyHandler);
    window._pkCombatKeyHandler = onKey;
    document.addEventListener('keydown', onKey);

    const panel = rootEl.querySelector('#selected-panel');
    if (!panel) return;

    panel.addEventListener('click', function (e) {
      const chip = e.target.closest('.cond-chip');
      if (chip) { E.removeCondition(viewing.id, chip.dataset.condId); return; }

      const hpb = e.target.closest('[data-quick-hp]');
      if (hpb) {
        const v = Number(hpb.dataset.quickHp);
        if (v >= 0) E.applyHeal(viewing.id, v);
        else E.applyDamage(viewing.id, Math.abs(v), { source: 'ручная правка' });
        return;
      }

      if (e.target.id === 'custom-hp') { openCustomHpDialog(viewing.id); return; }
	  if (e.target.id === 'temp-hp-btn') { openTempHpDialog(viewing.id); return; }
      if (e.target.id === 'add-condition') { openAddConditionDialog(viewing.id); return; }
      if (e.target.id === 'revive-player') {
        if (!viewing.isPlayer) return;
        E.setHp(viewing.id, 1);
        E.pushLog(viewing.name + ' воскрешён (1 HP)');
        addEvent({ kind: 'info', head: '✨ ' + viewing.name + ' воскрешён', body: 'Возвращается в бой с 1 HP.' });
        return;
      }

      const saveBtn = e.target.closest('[data-save-stat]');
      if (saveBtn) { openSaveRollDialog(saveBtn.dataset.saveStat, viewing); return; }

      const acBtn = e.target.closest('[data-ac-roll]');
      if (acBtn) { openAcRollDialog(Number(acBtn.dataset.acRoll)); return; }

      const addLd = e.target.closest('[data-legend-add]');
      if (addLd) {
        E.addLegendary(viewing.id, Number(addLd.dataset.legendAdd) || 0);
        return;
      }

      const actBtn = e.target.closest('[data-action-idx]');
      if (actBtn) {
        const idx = Number(actBtn.dataset.actionIdx);
        const isLegendary = actBtn.dataset.legendary === '1';
        if (isLegendary) {
          const act = (viewing.legendaryActions || [])[idx];
          if (!act) return;
          const cost = Number(act.legendCost) || 1;
          const cur = viewing.legendaryRemaining != null ? viewing.legendaryRemaining : (viewing.legendaryMax || 0);
          if (cur < cost) {
            alert('Недостаточно ЛД: нужно ' + cost + ', осталось ' + cur);
            return;
          }
          startTargeting(viewing, act, { legendary: { isLegendary: true, cost: cost } });
        } else {
          startTargeting(viewing, viewing.actions[idx]);
        }
        return;
      }

      const dfb = e.target.closest('[data-add-fail]');
      if (dfb) { E.addDeathFailure(viewing.id, Number(dfb.dataset.addFail)); return; }
      const dsb = e.target.closest('[data-add-success]');
      if (dsb) { E.addDeathSuccess(viewing.id, Number(dsb.dataset.addSuccess)); return; }
    });
  }

  function toggleTarget(pid) {
    const t = targeting;
    if (!t) return;
    const idx = t.selected.indexOf(pid);
    const max = t.action.targets;
    if (idx === -1) {
      if (max !== 'unlimited' && max !== 'self') {
        const maxN = Number(max);
        if (t.selected.length >= maxN) { alert('Максимум ' + maxN + ' целей'); return; }
      }
      t.selected.push(pid);
    } else {
      t.selected.splice(idx, 1);
    }
    t.canApply = t.selected.length > 0;
    renderMain();
  }

  function startTargeting(source, action, opts) {
    opts = opts || {};
    if (action.targets === 'self') {
      targeting = { source: source, action: action, selected: [source.id], canApply: true, legendary: opts.legendary };
      openAttackModal();
      return;
    }
    targeting = { source: source, action: action, selected: [], canApply: false, legendary: opts.legendary };
    renderMain();
  }

  // ============ ХЕЛПЕРЫ УРОНА (отдельные кости) ============
  function makeDamagePiece(data) {
    const count = Math.max(1, Number(data.count) || 1);
    const die = Number(data.die) || 6;
    const modifier = Number(data.modifier) || 0;
    const dice = [];
    for (let i = 0; i < count; i++) dice.push(1 + Math.floor(Math.random() * die));
    return { data: data, count: count, die: die, modifier: modifier, dice: dice };
  }
  function rerollDamagePiece(piece) {
    for (let i = 0; i < piece.dice.length; i++) {
      piece.dice[i] = 1 + Math.floor(Math.random() * piece.die);
    }
  }
  function damagePieceSum(piece) {
    return piece.dice.reduce(function (a, b) { return a + b; }, 0) + piece.modifier;
  }
  function damagePiecesTotal(pieces) {
    return (pieces || []).reduce(function (a, p) { return a + damagePieceSum(p); }, 0);
  }
  function damagePieceHtml(piece, key) {
    const modStr = piece.modifier > 0 ? '+' + piece.modifier : (piece.modifier < 0 ? String(piece.modifier) : '');
    const typeLabel = DAMAGE_LABELS[piece.data.type] || piece.data.type;
    return '<div class="dmg-piece">' +
      '<span class="dmg-piece-formula">' + piece.count + 'd' + piece.die + modStr + '</span>' +
      '<span class="dmg-piece-rolls">[' + piece.dice.join(', ') + ']</span>' +
      '<span class="dmg-piece-total">' + damagePieceSum(piece) + '</span>' +
      '<span class="dmg-piece-type">' + U.escapeHtml(typeLabel) + '</span>' +
      '<button type="button" class="btn btn-icon btn-small" data-piece-reroll="' + key + '" title="Перекинуть">🎲</button>' +
    '</div>';
  }

  // ============ ГЛАВНАЯ МОДАЛКА РАЗРЕШЕНИЯ ============
  function openAttackModal() {
    const t = targeting;
    if (!t || !t.selected.length) { alert('Выбери хотя бы одну цель'); return; }
    const c = E.get();
    const source = t.source;
    const action = t.action;
    const targets = t.selected.map(function (pid) {
      return c.participants.find(function (p) { return p.id === pid; });
    }).filter(Boolean);
    if (!targets.length) { alert('Цели не найдены'); targeting = null; renderMain(); return; }
    openResolveModal(source, action, targets, t.legendary);
  }

  function openResolveModal(source, action, targets, legendary) {
    const hasAttack = !!(action.toHit && action.toHit.length);
    const attackCount = Math.max(1, Math.min(10, Number(action.attacks) || 1));
    const saveGroups = action.saveGroups || [];
    const hasSave = saveGroups.length > 0;
    const conditionGroups = action.conditionGroups || [];
    const hasConditions = conditionGroups.length > 0;

    const hitPieces = (action.damages || []).map(makeDamagePiece);
    const sgPieces = saveGroups.map(function (sg) {
      return (sg.damages || []).map(makeDamagePiece);
    });

    // Состояние по каждой цели
    const st = targets.map(function (target) {
      return {
        target: target,
        ac: Number(target.ac) || 10,
        attacks: hasAttack ? new Array(attackCount).fill(0).map(function () {
          const r = rollD20Adv('normal');
          return { d20: r.value, rolls: r.rolls, bonus: toNum(action.toHit) };
        }) : [],
        saves: saveGroups.map(function (sg) {
          if (target.isPlayer) {
            return { manual: true, value: '' };
          }
          const bonus = toNum(saveStr(target, sg.ability));
          const r = rollD20Adv('normal');
          return { manual: false, d20: r.value, rolls: r.rolls, bonus: bonus };
        }),
        conditions: conditionGroups.map(function (cg) {
          let def = 'none';
          if (cg.conditionId && cg.conditionId !== 'custom' && target.conditionDefenses) {
            def = target.conditionDefenses[cg.conditionId] || 'none';
          }
          if (def === 'immunity') {
            return { manual: false, d20: 0, rolls: [], bonus: 0, def: def, immune: true };
          }
          if (target.isPlayer) {
            return { manual: true, value: '', def: def };
          }
          const bonus = toNum(saveStr(target, cg.ability));
          let mode = 'normal';
          if (def === 'resistance') mode = 'adv';
          else if (def === 'vulnerability') mode = 'dis';
          const r = rollD20Adv(mode);
          return { manual: false, d20: r.value, rolls: r.rolls, bonus: bonus, def: def };
        })
      };
    });

	function totalHits(s) {
	  let h = 0;
	  s.attacks.forEach(function (a) {
		const isCrit = a.d20 === 20;
		const isCritFail = a.d20 === 1;
		if (isCrit || (!isCritFail && a.d20 + a.bonus >= s.ac)) h++;
	  });
	  return h;
	}
    function saveVal(s, gi) {
      const sv = s.saves[gi];
      if (sv.manual) return sv.value === '' ? null : Number(sv.value);
      return sv.d20 + sv.bonus;
    }

    function buildHtml() {
      let html = '';

      // Секции по целям
      st.forEach(function (s, si) {
        html += '<div class="roll-section roll-target">';
        html += '<div class="roll-title">🎯 ' + U.escapeHtml(s.target.name) + ' — КД ' + s.ac +
          (s.target.isPlayer ? ' <span class="badge">Игрок</span>' : '') + '</div>';

		if (hasAttack) {
		  html += '<div class="attack-list">';
		  s.attacks.forEach(function (a, ai) {
			const total = a.d20 + a.bonus;
			const isCrit = a.d20 === 20;
			const isCritFail = a.d20 === 1;
			const hit = isCrit || (!isCritFail && total >= s.ac);
			let statusText = '', statusCls = '';
			if (isCrit) { statusText = '💥 КРИТ!'; statusCls = 'crit'; }
			else if (isCritFail) { statusText = '💀 КР.ПРОМАХ'; statusCls = 'crit-fail'; }
			else if (hit) { statusText = '✓'; statusCls = 'hit'; }
			else { statusText = '✗'; statusCls = 'miss'; }
			html += '<div class="attack-row">' +
			  '<span class="attack-num">#' + (ai + 1) + '</span>' +
			  '<div class="attack-main">' +
				'<input class="input roll-input-sm" type="number" data-atk-d20="' + si + '-' + ai + '" value="' + a.d20 + '" style="width:60px">' +
				'<span class="roll-op">+</span>' +
				'<input class="input roll-input-sm" type="number" data-atk-bonus="' + si + '-' + ai + '" value="' + a.bonus + '" style="width:60px">' +
				'<span class="roll-op">=</span>' +
				'<span class="attack-total" data-atk-total="' + si + '-' + ai + '">' + total + '</span>' +
			  '</div>' +
			  '<span class="attack-status ' + statusCls + '" data-atk-status="' + si + '-' + ai + '">' + statusText + '</span>' +
			  '<button type="button" class="btn btn-icon btn-small" data-atk-reroll="' + si + '-' + ai + '" title="Перебросить">🎲</button>' +
			'</div>';
		  });
		  html += '</div>';
		  html += '<div class="dmg-total-row">Попало: <span class="dmg-total" data-hits="' + si + '">' + totalHits(s) + '</span> / ' + attackCount + '</div>';
		}

        if (hasSave) {
          saveGroups.forEach(function (sg, gi) {
            const dc = Number(sg.dc) || 10;
            const abLabel = sg.ability ? ABILITY_LABELS[sg.ability] : '—';
            const sv = s.saves[gi];
            const val = saveVal(s, gi);
            let status = '', statusCls = '';
            if (val !== null) {
              const passed = val >= dc;
              status = passed ? '✓' : '✗';
              statusCls = passed ? 'pass' : 'fail';
            }
            const bonusHint = !sv.manual
              ? ' <span class="muted" style="font-size:11px">(' + (sv.bonus >= 0 ? '+' : '') + sv.bonus + ')</span>'
              : ' <span class="muted" style="font-size:11px">(игрок)</span>';
            html += '<div class="save-row">' +
              '<span class="save-lbl">Спас ' + abLabel + ' DC ' + dc + '</span>' +
              '<input class="input roll-input-sm" type="number" data-save-val="' + si + '-' + gi + '" value="' + (val === null ? '' : val) + '" style="width:70px">' +
              bonusHint +
              '<span class="save-status ' + statusCls + '" data-save-status="' + si + '-' + gi + '">' + status + '</span>' +
              '<button type="button" class="btn btn-icon btn-small" data-save-reroll="' + si + '-' + gi + '" title="Перебросить">🎲</button>' +
            '</div>';
          });
        }

        html += '</div>';
      });

      // Урон при попадании (общий пул для всех целей)
      if (hasAttack && hitPieces.length) {
        html += '<div class="roll-section">';
        html += '<div class="roll-title">💥 Урон при попадании (за каждое попадание)</div>';
        html += '<div class="dmg-piece-list">';
        hitPieces.forEach(function (p, pi) { html += damagePieceHtml(p, 'atk-' + pi); });
        html += '</div>';
        html += '<div class="dmg-total-row">Итого за одно попадание: <span class="dmg-total" data-hit-total>' + damagePiecesTotal(hitPieces) + '</span></div>';
        html += '</div>';
      }

      // Урон по save-группам
      if (hasSave) {
        saveGroups.forEach(function (sg, gi) {
          if (!sg.damages || !sg.damages.length) return;
          const abLabel = sg.ability ? ABILITY_LABELS[sg.ability] : '—';
          const dc = Number(sg.dc) || 10;
          const effLbl = sg.saveEffect === 'half' ? '½ при успехе'
                       : sg.saveEffect === 'none' ? 'ничего при успехе' : 'особое';
          html += '<div class="roll-section">';
          html += '<div class="roll-title">💥 Урон группы ' + (gi + 1) + ' — Спас ' + abLabel + ' DC ' + dc + ', ' + effLbl + '</div>';
          html += '<div class="dmg-piece-list">';
          sgPieces[gi].forEach(function (p, pi) { html += damagePieceHtml(p, 'sg-' + gi + '-' + pi); });
          html += '</div>';
          html += '<div class="dmg-total-row">Итого по группе: <span class="dmg-total" data-sg-total="' + gi + '">' + damagePiecesTotal(sgPieces[gi]) + '</span></div>';
          html += '</div>';
        });
      }

      // Секции условий (состояний)
      if (hasConditions) {
        st.forEach(function (s, si) {
          const rows = conditionGroups.map(function (cg, gi) {
            const sv = s.conditions[gi];
            if (sv.immune) {
              return '<div class="save-row cond-row-immune">' +
                '<span class="save-lbl">' + U.escapeHtml(condLabel(cg)) + '</span>' +
                '<span class="muted" style="font-size:11px">🛡 иммунитет</span>' +
              '</div>';
            }
            const dc = Number(cg.dc) || 10;
            const abLabel = cg.ability ? ABILITY_LABELS[cg.ability] : '—';
            const val = saveVal2(s, gi);
            let status = '', statusCls = '';
            if (val !== null) {
              const passed = val >= dc;
              status = passed ? '✓' : '✗';
              statusCls = passed ? 'pass' : 'fail';
            }
            const bonusHint = !sv.manual
              ? ' <span class="muted" style="font-size:11px">(' + (sv.bonus >= 0 ? '+' : '') + sv.bonus + ')</span>'
              : ' <span class="muted" style="font-size:11px">(игрок)</span>';
            return '<div class="save-row">' +
              '<span class="save-lbl">' + U.escapeHtml(condLabel(cg)) + ' — спас ' + abLabel + ' DC ' + dc + '</span>' +
              '<input class="input roll-input-sm" type="number" data-cond-val="' + si + '-' + gi + '" value="' + (val === null ? '' : val) + '" style="width:70px">' +
              bonusHint +
              '<span class="save-status ' + statusCls + '" data-cond-status="' + si + '-' + gi + '">' + status + '</span>' +
              '<button type="button" class="btn btn-icon btn-small" data-cond-reroll="' + si + '-' + gi + '" title="Перекинуть">🎲</button>' +
            '</div>';
          }).join('');
          html += '<div class="roll-section roll-target">' +
            '<div class="roll-title">🎭 Состояния — ' + U.escapeHtml(s.target.name) + '</div>' +
            rows +
          '</div>';
        });
      }

      // Сводка
      html += '<div class="roll-section roll-summary">';
      html += '<div class="roll-title">📊 Итог</div>';
      st.forEach(function (s, si) {
        html += '<div class="roll-summary-line" data-summary="' + si + '">' + summaryLine(s) + '</div>';
      });
      html += '</div>';

      html += '<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px">' +
        '<button class="btn" data-cancel>Отмена</button>' +
        '<button class="btn btn-primary" data-apply>Применить</button>' +
      '</div>';
      return html;
    }

    function condLabel(cg) {
      if (cg.conditionId === 'custom') return cg.conditionCustom || 'Своё';
      const found = CONDITIONS_LIST.find(function (c) { return c.id === cg.conditionId; });
      return found ? found.label : (cg.conditionId || '—');
    }
    function saveVal2(s, gi) {
      const sv = s.conditions[gi];
      if (sv.immune) return null;
      if (sv.manual) return sv.value === '' ? null : Number(sv.value);
      return sv.d20 + sv.bonus;
    }

    function summaryLine(s) {
      const parts = [];
	  if (hasAttack) {
	    const hits = totalHits(s);
	    const hasCrit = s.attacks.some(function (a) { return a.d20 === 20; });
	    const perHit = damagePiecesTotal(hitPieces);
	    let hitStr = hits + ' попад.';
	    if (hasCrit) hitStr += ' 💥КРИТ!';
	    hitStr += ' × ' + perHit + ' = ' + (hits * perHit);
	    parts.push(hitStr);
	  }
      if (hasSave) {
        saveGroups.forEach(function (sg, gi) {
          if (!sg.damages || !sg.damages.length) return;
          const val = saveVal(s, gi);
          if (val === null) { parts.push('Спас ' + (gi + 1) + ': ?'); return; }
          const dc = Number(sg.dc) || 10;
          const passed = val >= dc;
          let dmg = damagePiecesTotal(sgPieces[gi]);
          if (passed && sg.saveEffect === 'half') dmg = Math.floor(dmg / 2);
          else if (passed && sg.saveEffect === 'none') dmg = 0;
          parts.push('Спас ' + (gi + 1) + ': ' + (passed ? '✓' : '✗') + ' → ' + dmg);
        });
      }
      if (hasConditions) {
        const conds = [];
        conditionGroups.forEach(function (cg, gi) {
          const sv = s.conditions[gi];
          if (sv.immune) { conds.push(condLabel(cg) + ': 🛡'); return; }
          const val = saveVal2(s, gi);
          if (val === null) { conds.push(condLabel(cg) + ': ?'); return; }
          const dc = Number(cg.dc) || 10;
          const passed = val >= dc;
          conds.push(condLabel(cg) + ': ' + (passed ? '✓' : '✗ накладывается'));
        });
        if (conds.length) parts.push(conds.join(', '));
      }
      return U.escapeHtml(s.target.name) + ': ' + parts.join(' · ');
    }

    function refresh() {
      // Обновить атаки
      st.forEach(function (s, si) {
		if (hasAttack) {
		  s.attacks.forEach(function (a, ai) {
			const dEl = document.querySelector('[data-atk-total="' + si + '-' + ai + '"]');
			if (dEl) dEl.textContent = a.d20 + a.bonus;
			const stEl = document.querySelector('[data-atk-status="' + si + '-' + ai + '"]');
			if (stEl) {
			  const isCrit = a.d20 === 20;
			  const isCritFail = a.d20 === 1;
			  const hit = isCrit || (!isCritFail && (a.d20 + a.bonus) >= s.ac);
			  let statusText = '', statusCls = '';
			  if (isCrit) { statusText = '💥 КРИТ!'; statusCls = 'crit'; }
			  else if (isCritFail) { statusText = '💀 КР.ПРОМАХ'; statusCls = 'crit-fail'; }
			  else if (hit) { statusText = '✓'; statusCls = 'hit'; }
			  else { statusText = '✗'; statusCls = 'miss'; }
			  stEl.textContent = statusText;
			  stEl.className = 'attack-status ' + statusCls;
			}
		  });
		  const hEl = document.querySelector('[data-hits="' + si + '"]');
		  if (hEl) hEl.textContent = totalHits(s);
		}
        if (hasSave) {
          saveGroups.forEach(function (sg, gi) {
            const el = document.querySelector('[data-save-status="' + si + '-' + gi + '"]');
            if (!el) return;
            const val = saveVal(s, gi);
            const dc = Number(sg.dc) || 10;
            if (val === null) { el.textContent = ''; el.className = 'save-status'; return; }
            const passed = val >= dc;
            el.textContent = passed ? '✓' : '✗';
            el.className = 'save-status ' + (passed ? 'pass' : 'fail');
          });
        }
        if (hasConditions) {
          conditionGroups.forEach(function (cg, gi) {
            const sv = s.conditions[gi];
            if (sv.immune) return;
            const el = document.querySelector('[data-cond-status="' + si + '-' + gi + '"]');
            if (!el) return;
            const val = saveVal2(s, gi);
            const dc = Number(cg.dc) || 10;
            if (val === null) { el.textContent = ''; el.className = 'save-status'; return; }
            const passed = val >= dc;
            el.textContent = passed ? '✓' : '✗';
            el.className = 'save-status ' + (passed ? 'pass' : 'fail');
          });
        }
        const sumEl = document.querySelector('[data-summary="' + si + '"]');
        if (sumEl) sumEl.innerHTML = summaryLine(s);
      });
    }

    // Открытие
    const wrap = document.createElement('div');
    wrap.className = 'roll-modal';
    wrap.innerHTML = buildHtml();

    M.openModal({
      title: (action.kind === 'spell' ? '✨ ' : action.kind === 'attack' ? '⚔ ' : '◆ ') +
             (action.name || 'Действие') + ': ' + source.name,
      content: wrap,
      sideContent: action.note
        ? '<div class="roll-note-title">📝 Заметка</div>' +
          '<div class="roll-note-body">' + U.escapeHtml(action.note) + '</div>'
        : null,
      onMount: function (body, close) {
        body.addEventListener('input', function (e) {
          const t = e.target;
          if (t.matches('[data-atk-d20]')) {
            const parts = t.dataset.atkD20.split('-').map(Number);
            st[parts[0]].attacks[parts[1]].d20 = Number(t.value) || 0;
            refresh();
          } else if (t.matches('[data-atk-bonus]')) {
            const parts = t.dataset.atkBonus.split('-').map(Number);
            st[parts[0]].attacks[parts[1]].bonus = Number(t.value) || 0;
            refresh();
          } else if (t.matches('[data-save-val]')) {
            const parts = t.dataset.saveVal.split('-').map(Number);
            const s = st[parts[0]];
            const sv = s.saves[parts[1]];
            if (sv.manual) sv.value = t.value;
            else sv.d20 = Number(t.value) || 0;
            refresh();
          } else if (t.matches('[data-cond-val]')) {
            const parts = t.dataset.condVal.split('-').map(Number);
            const s = st[parts[0]];
            const sv = s.conditions[parts[1]];
            if (!sv || sv.immune) return;
            if (sv.manual) sv.value = t.value;
            else sv.d20 = Number(t.value) || 0;
            refresh();
          }
        });

        body.addEventListener('click', function (e) {
          const btn = e.target.closest('button');
          if (!btn) return;

          if (btn.matches('[data-atk-reroll]')) {
            const parts = btn.dataset.atkReroll.split('-').map(Number);
            const r = rollD20Adv('normal');
            st[parts[0]].attacks[parts[1]].d20 = r.value;
            st[parts[0]].attacks[parts[1]].rolls = r.rolls;
            const inp = body.querySelector('[data-atk-d20="' + parts[0] + '-' + parts[1] + '"]');
            if (inp) inp.value = r.value;
            refresh();
            return;
          }
          if (btn.matches('[data-save-reroll]')) {
            const parts = btn.dataset.saveReroll.split('-').map(Number);
            const s = st[parts[0]];
            const sv = s.saves[parts[1]];
            const r = rollD20Adv('normal');
            if (sv.manual) {
              sv.value = r.value;
              const inp = body.querySelector('[data-save-val="' + parts[0] + '-' + parts[1] + '"]');
              if (inp) inp.value = r.value;
            } else {
              sv.d20 = r.value;
              sv.rolls = r.rolls;
              const inp = body.querySelector('[data-save-val="' + parts[0] + '-' + parts[1] + '"]');
              if (inp) inp.value = r.value + sv.bonus;
            }
            refresh();
            return;
          }
          if (btn.matches('[data-cond-reroll]')) {
            const parts = btn.dataset.condReroll.split('-').map(Number);
            const s = st[parts[0]];
            const sv = s.conditions[parts[1]];
            if (!sv || sv.immune) return;
            const cg = conditionGroups[parts[1]];
            let mode = 'normal';
            if (sv.def === 'resistance') mode = 'adv';
            else if (sv.def === 'vulnerability') mode = 'dis';
            const r = rollD20Adv(mode);
            if (sv.manual) {
              sv.value = r.value;
              const inp = body.querySelector('[data-cond-val="' + parts[0] + '-' + parts[1] + '"]');
              if (inp) inp.value = r.value;
            } else {
              sv.d20 = r.value;
              sv.rolls = r.rolls;
              const inp = body.querySelector('[data-cond-val="' + parts[0] + '-' + parts[1] + '"]');
              if (inp) inp.value = r.value + sv.bonus;
            }
            refresh();
            return;
          }
          if (btn.matches('[data-piece-reroll]')) {
            const key = btn.dataset.pieceReroll;
            if (key.indexOf('atk-') === 0) {
              const pi = Number(key.slice(4));
              rerollDamagePiece(hitPieces[pi]);
            } else if (key.indexOf('sg-') === 0) {
              const parts = key.slice(3).split('-').map(Number);
              rerollDamagePiece(sgPieces[parts[0]][parts[1]]);
            }
            body.innerHTML = buildHtml();
            refresh();
            return;
          }
          if (btn.matches('[data-cancel]')) {
            targeting = null; close(); renderMain(); return;
          }
          if (btn.matches('[data-apply]')) {
            applyAll(close); return;
          }
        });

        function applyAll(close) {
          if (legendary && legendary.isLegendary) {
            const cur = source.legendaryRemaining != null ? source.legendaryRemaining : (source.legendaryMax || 0);
            if (cur < legendary.cost) {
              alert('Недостаточно ЛД: нужно ' + legendary.cost + ', осталось ' + cur);
              return;
            }
          }
          const results = [];

          st.forEach(function (s) {
            const target = s.target;
            const hpBefore = target.hpCurrent;
            const pieces = [];

			if (hasAttack) {
			  // Проверяем есть ли крит среди атак
			  const hasCrit = s.attacks.some(function (a) { return a.d20 === 20; });
			  const hits = totalHits(s);
			  if (hits > 0 && hitPieces.length) {
				hitPieces.forEach(function (p) {
				  let dmg = damagePieceSum(p);
				  // При крите: удваиваем кости (пересчитываем с двойным количеством)
				  if (hasCrit) {
					const critRolls = [];
					for (let i = 0; i < p.count * 2; i++) critRolls.push(1 + Math.floor(Math.random() * p.die));
					dmg = critRolls.reduce(function (a, b) { return a + b; }, 0) + p.modifier;
				  }
				  pieces.push({ type: p.data.type, sum: dmg * hits });
				});
			  }
			}

            if (hasSave) {
              saveGroups.forEach(function (sg, gi) {
                if (!sg.damages || !sg.damages.length) return;
                const val = saveVal(s, gi);
                if (val === null) return;
                const dc = Number(sg.dc) || 10;
                const passed = val >= dc;
                let scale = 1;
                if (passed && sg.saveEffect === 'half') scale = 0.5;
                else if (passed && sg.saveEffect === 'none') scale = 0;
                sgPieces[gi].forEach(function (p) {
                  pieces.push({ type: p.data.type, sum: damagePieceSum(p) * scale });
                });
              });
            }

            // Наложение состояний
            const appliedConds = [];
            if (hasConditions) {
              conditionGroups.forEach(function (cg, gi) {
                const sv = s.conditions[gi];
                if (sv.immune) return;
                const val = saveVal2(s, gi);
                if (val === null) return;
                const dc = Number(cg.dc) || 10;
                if (val < dc) {
                  const condId = cg.conditionId === 'custom'
                    ? ('custom-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6))
                    : cg.conditionId;
                  const condName = condLabel(cg);
                  E.addCondition(target.id, condId, condName);
                  appliedConds.push(condName);
                }
              });
            }

            let finalDmg = 0;
            if (pieces.length) {
              const res = applyResistances(target, pieces);
              finalDmg = res.final;
            }

            if (finalDmg > 0) {
              E.applyDamage(target.id, finalDmg, { source: source.name + ' (' + action.name + ')' });
            }

            // Лог
            const logParts = [];
            if (hasAttack) {
              logParts.push(totalHits(s) + '/' + attackCount + ' попад.');
            }
            if (hasSave) {
              saveGroups.forEach(function (sg, gi) {
                const val = saveVal(s, gi);
                if (val === null) return;
                const dc = Number(sg.dc) || 10;
                logParts.push('спас ' + (val >= dc ? '✓' : '✗') + ' (' + val + ' vs ' + dc + ')');
              });
            }
            if (appliedConds.length) logParts.push('наложено: ' + appliedConds.join(', '));
            E.pushLog(source.name + ' → ' + target.name + ': ' + logParts.join(', ') + ', урон ' + finalDmg);

            results.push({
              name: target.name,
              hits: hasAttack ? totalHits(s) : null,
              damage: finalDmg,
              conditions: appliedConds,
              hpBefore: hpBefore,
              hpAfter: target.hpCurrent
            });
          });

          const bodyHtml = results.map(function (r) {
            return '<div>' + U.escapeHtml(r.name) + ': ' +
              (r.hits !== null ? r.hits + ' попад. · ' : '') +
              'урон ' + r.damage +
              (r.conditions && r.conditions.length ? ' · состояния: ' + r.conditions.map(U.escapeHtml).join(', ') : '') +
              ' · ' + r.hpBefore + '→' + r.hpAfter + ' HP</div>';
          }).join('');

          addEvent({
            kind: hasSave ? 'aoe' : 'hit',
            head: (action.kind === 'spell' ? '✨ ' : action.kind === 'attack' ? '⚔ ' : '◆ ') +
                  source.name + ' — ' + action.name +
                  (legendary && legendary.isLegendary ? ' [ЛД −' + legendary.cost + ']' : ''),
            body: bodyHtml
          });

          if (legendary && legendary.isLegendary) {
            E.useLegendary(source.id, legendary.cost);
          }

          targeting = null;
          close();
          renderMain();
        }
      }
    });
  }

  // ============ МОДАЛКИ ДЛЯ СТАТ-ЭКШЕНОВ ============
  function openSaveRollDialog(ability, target) {
    const bonus = toNum(saveStr(target, ability));
    const initRoll = rollD20Adv('normal');
    const total = initRoll.value + bonus;

    M.openModal({
      title: '🎲 Спасбросок ' + ABILITY_LABELS[ability] + ' — ' + target.name,
      content:
        '<div class="roll-modal">' +
          advRowHtml('save-stat-adv', 'normal') +
          '<div class="roll-section">' +
            '<div class="roll-row">' +
              '<input class="input roll-input" type="number" id="ssr-d20" value="' + initRoll.value + '">' +
              '<span class="roll-op">+</span>' +
              '<input class="input roll-input" type="number" id="ssr-bonus" value="' + bonus + '">' +
              '<span class="roll-op">=</span>' +
              '<span class="roll-total" id="ssr-total">' + total + '</span>' +
              '<button class="btn btn-small" id="ssr-reroll">🎲</button>' +
            '</div>' +
            '<div id="ssr-rolls-line">' + advRollsLine(initRoll) + '</div>' +
          '</div>' +
          '<div style="display:flex;justify-content:flex-end;margin-top:8px">' +
            '<button class="btn" data-close>Закрыть</button>' +
          '</div>' +
        '</div>',
      onMount: function (body, close) {
        const d20In = body.querySelector('#ssr-d20');
        const bonusIn = body.querySelector('#ssr-bonus');
        const line = body.querySelector('#ssr-rolls-line');
        function refresh() {
          const total = (Number(d20In.value) || 0) + (Number(bonusIn.value) || 0);
          body.querySelector('#ssr-total').textContent = total;
        }
        d20In.addEventListener('input', refresh);
        bonusIn.addEventListener('input', refresh);
        body.querySelector('#ssr-reroll').addEventListener('click', function () {
          const r = rollD20Adv(body.querySelector('input[name="save-stat-adv"]:checked').value);
          d20In.value = r.value;
          line.innerHTML = advRollsLine(r);
          refresh();
        });
        body.querySelector('[data-close]').addEventListener('click', close);
      }
    });
  }

  function openAcRollDialog(ac) {
    const initRoll = rollD20Adv('normal');
    M.openModal({
      title: '🎲 Бросок против КД ' + ac,
      content:
        '<div class="roll-modal">' +
          advRowHtml('ac-adv', 'normal') +
          '<div class="roll-section">' +
            '<div class="roll-row">' +
              '<input class="input roll-input" type="number" id="ac-d20" value="' + initRoll.value + '">' +
              '<span class="roll-op">+</span>' +
              '<input class="input roll-input" type="number" id="ac-bonus" value="0">' +
              '<span class="roll-op">=</span>' +
              '<span class="roll-total" id="ac-total">' + initRoll.value + '</span>' +
              '<button class="btn btn-small" id="ac-reroll">🎲</button>' +
            '</div>' +
            '<div id="ac-rolls-line">' + advRollsLine(initRoll) + '</div>' +
            '<div class="roll-vs">против КД <b>' + ac + '</b> <span class="hit-status" id="ac-status">—</span></div>' +
          '</div>' +
          '<div style="display:flex;justify-content:flex-end;margin-top:8px">' +
            '<button class="btn" data-close>Закрыть</button>' +
          '</div>' +
        '</div>',
      onMount: function (body, close) {
        const d20In = body.querySelector('#ac-d20');
        const bonusIn = body.querySelector('#ac-bonus');
        const line = body.querySelector('#ac-rolls-line');
        function refresh() {
          const total = (Number(d20In.value) || 0) + (Number(bonusIn.value) || 0);
          body.querySelector('#ac-total').textContent = total;
          const hits = total >= ac;
          const st = body.querySelector('#ac-status');
          st.textContent = hits ? 'ПОПАДАНИЕ' : 'промах';
          st.className = 'hit-status ' + (hits ? 'hit' : 'miss');
        }
        d20In.addEventListener('input', refresh);
        bonusIn.addEventListener('input', refresh);
        body.querySelector('#ac-reroll').addEventListener('click', function () {
          const r = rollD20Adv(body.querySelector('input[name="ac-adv"]:checked').value);
          d20In.value = r.value;
          line.innerHTML = advRollsLine(r);
          refresh();
        });
        body.querySelector('[data-close]').addEventListener('click', close);
        refresh();
      }
    });
  }

  function openAddConditionDialog(pid) {
    const c = E.get();
    const target = c.participants.find(function (x) { return x.id === pid; });
    if (!target) return;
    const defenses = target.conditionDefenses || {};

    M.openModal({
      title: 'Состояния — ' + target.name,
      content:
        '<div>' +
          '<div class="cond-mode-row">' +
            '<label class="adv-btn"><input type="radio" name="cond-mode" value="add" checked><span>Просто добавить</span></label>' +
            '<label class="adv-btn"><input type="radio" name="cond-mode" value="check"><span>Бросок спасброска</span></label>' +
          '</div>' +
          '<div class="cond-check-panel hidden" id="cond-check-panel">' +
            '<div class="row row-3">' +
              '<label class="field"><span class="field-label">Спас</span>' +
                '<select class="input" id="cond-save-ability">' +
                  ['str','dex','con','int','mdr','cha'].map(function (k) {
                    return '<option value="' + k + '">' + ABILITY_LABELS[k] + ' (' + saveStr(target, k) + ')</option>';
                  }).join('') +
                '</select>' +
              '</label>' +
              '<label class="field"><span class="field-label">DC</span>' +
                '<input class="input" type="number" id="cond-save-dc" value="15">' +
              '</label>' +
              '<label class="field"><span class="field-label">—</span>' +
                '<span class="muted" style="font-size:11px;padding-top:8px;display:block">клик по состоянию ↓</span>' +
              '</label>' +
            '</div>' +
            '<p class="muted" style="font-size:11px;margin-top:6px">' +
              'Иммунитет — блок. Сопротивление — преимущество. Уязвимость — помеха.' +
            '</p>' +
          '</div>' +
          '<div class="cond-picker" style="margin-top:12px">' +
            CONDITIONS_LIST.map(function (cc) {
              const def = defenses[cc.id] || 'none';
              return '<button class="btn btn-small cond-pick" data-cond-id="' + cc.id + '" data-cond-name="' + U.escapeHtml(cc.label) + '" data-cond-def="' + def + '">' +
                cc.label + (def === 'immunity' ? ' 🛡' : def === 'resistance' ? ' ▲' : def === 'vulnerability' ? ' ▼' : '') +
              '</button>';
            }).join('') +
          '</div>' +
          '<div style="margin-top:12px">' +
            '<label class="field"><span class="field-label">Своё состояние</span>' +
              '<div style="display:flex;gap:6px">' +
                '<input class="input" id="custom-cond" placeholder="Название">' +
                '<button class="btn" data-add-custom>Добавить</button>' +
              '</div>' +
            '</label>' +
          '</div>' +
        '</div>',
      onMount: function (body, close) {
        const modeRadios = body.querySelectorAll('input[name="cond-mode"]');
        const checkPanel = body.querySelector('#cond-check-panel');
        modeRadios.forEach(function (r) {
          r.addEventListener('change', function () {
            const check = body.querySelector('input[name="cond-mode"]:checked').value === 'check';
            checkPanel.classList.toggle('hidden', !check);
          });
        });

        body.addEventListener('click', function (e) {
          const btn = e.target.closest('.cond-pick');
          if (btn) {
            const condId = btn.dataset.condId;
            const condName = btn.dataset.condName;
            const def = btn.dataset.condDef || 'none';
            const isCheck = body.querySelector('input[name="cond-mode"]:checked').value === 'check';
            if (!isCheck) {
              E.addCondition(target.id, condId, condName);
              close();
              return;
            }
            if (def === 'immunity') {
              showToast('<div class="toast-title">🛡 Иммунитет</div><div class="toast-body">' + target.name + ' не может получить «' + condName + '»</div>', { kind: 'miss' });
              return;
            }
            const ability = body.querySelector('#cond-save-ability').value;
            const dc = Number(body.querySelector('#cond-save-dc').value) || 10;
            const advMode = def === 'resistance' ? 'adv' : def === 'vulnerability' ? 'dis' : 'normal';
            const bonus = toNum(saveStr(target, ability));
            const r = rollD20Adv(advMode);
            const total = r.value + bonus;
            const passed = total >= dc;
            showToast(
              '<div class="toast-title">🎲 Спас ' + ABILITY_LABELS[ability] + ' (' + condName + ')</div>' +
              '<div class="toast-body">d20 = ' + r.value + ' + ' + bonus + ' = <b>' + total + '</b> против DC ' + dc +
                '<br>' + (passed ? '<span style="color:#4caf50">УСПЕХ — состояние не получено</span>' :
                  '<span style="color:#e53935">ПРОВАЛ — состояние наложено</span>') +
              '</div>',
              { kind: 'roll', duration: 5000 }
            );
            if (!passed) E.addCondition(target.id, condId, condName);
          }
          if (e.target.matches('[data-add-custom]')) {
            const name = body.querySelector('#custom-cond').value.trim();
            if (name) { E.addCondition(pid, 'custom-' + Date.now(), name); close(); }
          }
        });
      }
    });
  }

  function openCustomHpDialog(pid) {
    const c = E.get();
    const p = c.participants.find(function (x) { return x.id === pid; });
    if (!p) return;
    M.openModal({
      title: 'Изменить HP — ' + p.name,
      content:
        '<div>' +
          '<label class="field"><span class="field-label">Сколько (положительное = урон, отрицательное = лечение)</span>' +
            '<input class="input" type="number" id="hpd" value="0" autofocus></label>' +
          '<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px">' +
            '<button class="btn" data-cancel>Отмена</button>' +
            '<button class="btn btn-primary" data-apply>Применить</button>' +
          '</div>' +
        '</div>',
      onMount: function (body, close) {
        body.querySelector('[data-cancel]').addEventListener('click', close);
        body.querySelector('[data-apply]').addEventListener('click', function () {
          const v = Number(body.querySelector('#hpd').value) || 0;
          if (v > 0) E.applyDamage(pid, v, { source: 'ручная правка' });
          else if (v < 0) E.applyHeal(pid, -v);
          close();
        });
      }
    });
  }
  
  function openTempHpDialog(pid) {
    const c = E.get();
    const p = c.participants.find(function (x) { return x.id === pid; });
    if (!p) return;
    M.openModal({
      title: 'Временные HP — ' + p.name,
      content:
        '<div>' +
          '<label class="field"><span class="field-label">Сколько временных HP (0 — убрать)</span>' +
            '<input class="input" type="number" id="thpd" value="' + (p.tempHp || 0) + '" min="0" autofocus></label>' +
          '<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px">' +
            '<button class="btn" data-cancel>Отмена</button>' +
            '<button class="btn btn-primary" data-apply>Применить</button>' +
          '</div>' +
        '</div>',
      onMount: function (body, close) {
        body.querySelector('[data-cancel]').addEventListener('click', close);
        body.querySelector('[data-apply]').addEventListener('click', function () {
          const v = Math.max(0, Number(body.querySelector('#thpd').value) || 0);
          E.setTempHp(pid, v);
          close();
        });
      }
    });
  }

  function openBestiaryPicker() {
    S.getAll('creatures').then(function (items) {
      const list = (items || []).slice().sort(function (a, b) {
        return (a.name || '').localeCompare(b.name || '', 'ru');
      });
      M.openModal({
        title: 'Добавить бойцов',
        content:
          '<div class="picker">' +
            '<input class="input" id="picker-search" placeholder="Поиск...">' +
            '<div class="picker-list" id="picker-list"></div>' +
            '<div class="picker-added" id="picker-added"><span class="muted">Ничего не выбрано</span></div>' +
            '<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px">' +
              '<button class="btn" data-cancel>Отмена</button>' +
              '<button class="btn btn-primary" data-add>Добавить</button>' +
            '</div>' +
          '</div>',
        onMount: function (body, close) {
          const selected = {};
          const search = body.querySelector('#picker-search');
          const listEl = body.querySelector('#picker-list');
          const addedEl = body.querySelector('#picker-added');
          function renderList() {
            const q = (search.value || '').toLowerCase();
            const filtered = list.filter(function (x) { return !q || (x.name || '').toLowerCase().indexOf(q) !== -1; });
            listEl.innerHTML = filtered.map(function (cr) {
              const sel = selected[cr.id] || 0;
              return '<div class="picker-item' + (sel ? ' selected' : '') + '" data-cid="' + cr.id + '">' +
                '<span class="picker-item-name">' + U.escapeHtml(cr.name) + '</span>' +
                '<span class="picker-item-meta">' + (cr.hpMax || '?') + ' HP · КД ' + (cr.ac || '?') + '</span>' +
                (sel ? '<span class="picker-item-count">×' + sel + '</span>' : '<span></span>') +
              '</div>';
            }).join('') || '<p class="muted" style="padding:12px">Ничего не найдено</p>';
          }
          function renderAdded() {
            const ids = Object.keys(selected).filter(function (k) { return selected[k] > 0; });
            if (!ids.length) { addedEl.innerHTML = '<span class="muted">Ничего не выбрано</span>'; return; }
            addedEl.innerHTML = ids.map(function (id) {
              const cr = list.find(function (x) { return x.id === id; });
              return '<span class="added-chip">' + U.escapeHtml(cr.name) + ' ×' + selected[id] + '</span>';
            }).join(' ');
          }
          listEl.addEventListener('click', function (e) {
            const item = e.target.closest('.picker-item');
            if (!item) return;
            const cid = item.dataset.cid;
            selected[cid] = (selected[cid] || 0) + (e.shiftKey ? 3 : 1);
            renderList(); renderAdded();
          });
          listEl.addEventListener('contextmenu', function (e) {
            const item = e.target.closest('.picker-item');
            if (!item) return;
            e.preventDefault();
            const cid = item.dataset.cid;
            if (selected[cid] > 0) { selected[cid] -= 1; renderList(); renderAdded(); }
          });
          search.addEventListener('input', renderList);
          body.querySelector('[data-cancel]').addEventListener('click', close);
          body.querySelector('[data-add]').addEventListener('click', function () {
            Object.keys(selected).forEach(function (cid) {
              const cr = list.find(function (x) { return x.id === cid; });
              if (cr && selected[cid] > 0) E.addCreature(cr, selected[cid]);
            });
            close();
          });
          renderList(); renderAdded();
        }
      });
    });
  }

  function openAddPlayerDialog() {
    M.openModal({
      title: 'Новый игрок',
      content:
        '<div class="grid" style="gap:14px">' +
          '<label class="field"><span class="field-label">Имя</span><input class="input" id="p-name" autofocus></label>' +
          '<div class="row row-2">' +
            '<label class="field"><span class="field-label">HP макс.</span><input class="input" type="number" id="p-hp" value="20"></label>' +
            '<label class="field"><span class="field-label">КД</span><input class="input" type="number" id="p-ac" value="12"></label>' +
          '</div>' +
          '<label class="field"><span class="field-label">Инициатива (мод)</span><input class="input" type="number" id="p-init" value="0"></label>' +
          '<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:8px">' +
            '<button class="btn" data-cancel>Отмена</button>' +
            '<button class="btn btn-primary" data-create>Создать</button>' +
          '</div>' +
        '</div>',
      onMount: function (body, close) {
        body.querySelector('[data-cancel]').addEventListener('click', close);
        body.querySelector('[data-create]').addEventListener('click', function () {
          const name = body.querySelector('#p-name').value.trim();
          if (!name) return;
          E.addPlayer(name,
            Number(body.querySelector('#p-hp').value) || 1,
            Number(body.querySelector('#p-ac').value) || 10,
            Number(body.querySelector('#p-init').value) || 0);
          close();
        });
      }
    });
  }

  return { render: render };
})();