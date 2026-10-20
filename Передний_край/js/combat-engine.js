window.PK = window.PK || {};

PK.combatEngine = (function () {
  const S = PK.storage;
  const D = PK.dice;
  const STORE = 'combats';

  let combat = null;
  let snapshots = [];
  let listeners = [];

  const DIVINITY_LEGEND = {
    none: 0, spark: 1, demigod: 2, god: 3, oldgod: 4, elder: 5, other: 0
  };
  function computeLegendaryMax(divinity, divinityCustom) {
    if (Object.prototype.hasOwnProperty.call(DIVINITY_LEGEND, divinity)) {
      return DIVINITY_LEGEND[divinity];
    }
    // Кастом или неизвестное — читаем из divinityCustom
    const n = Number(divinityCustom);
    return isNaN(n) ? 0 : Math.max(0, n);
  }
  function notify() {
    listeners.forEach(function (fn) { try { fn(); } catch (e) {} });
  }
  function subscribe(fn) {
    listeners.push(fn);
    return function () { listeners = listeners.filter(function (x) { return x !== fn; }); };
  }

  function createCombat() {
    combat = {
      id: 'combat-' + Date.now().toString(36),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      schemaVersion: 2,
      round: 0,
      started: false,
      activeIdx: -1,
      viewingIdx: -1,
      participants: [],
      log: []
    };
    snapshots = [];
    return save();
  }

  function save() {
    if (!combat) return Promise.resolve();
    combat.updatedAt = new Date().toISOString();
    return S.put(STORE, combat);
  }

  function loadLatest() {
    return S.getAll(STORE).then(function (all) {
      if (!all.length) return null;
      all.sort(function (a, b) { return (b.updatedAt || '').localeCompare(a.updatedAt || ''); });
      combat = all[0];
      // Совместимость: если старая схема без viewingIdx — ставим на активного
      if (combat.viewingIdx == null) combat.viewingIdx = combat.activeIdx;
      // Совместимость: легендарные ресурсы
      (combat.participants || []).forEach(function (p) {
        if (p.legendaryMax == null) {
          p.legendaryMax = computeLegendaryMax(p.divinity || 'none', p.divinityCustom || '');
        }
        if (p.legendaryRemaining == null) p.legendaryRemaining = p.legendaryMax;
      });
      snapshots = [];
      return combat;
    });
  }

  function get() { return combat; }
  function clear() {
    if (!combat) return Promise.resolve();
    const id = combat.id;
    combat = null;
    snapshots = [];
    return S.remove(STORE, id);
  }

  // ==== Снапшоты ====
  function takeSnapshot() {
    if (!combat) return;
    snapshots.push(JSON.stringify({
      round: combat.round,
      activeIdx: combat.activeIdx,
      viewingIdx: combat.viewingIdx,
      participants: combat.participants,
      log: combat.log
    }));
    if (snapshots.length > 100) snapshots.shift();
  }
  function undo() {
    if (!snapshots.length) return false;
    const prev = JSON.parse(snapshots.pop());
    combat.round = prev.round;
    combat.activeIdx = prev.activeIdx;
    combat.viewingIdx = prev.viewingIdx;
    combat.participants = prev.participants;
    combat.log = prev.log;
    save(); notify();
    return true;
  }

  // ==== Участники ====
  function makeParticipantFromCreature(creature, suffix) {
    return {
      id: 'p-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6),
      creatureId: creature.id,
      name: creature.name + (suffix ? ' ' + suffix : ''),
      avatar: creature.avatar || null,
      type: creature.type,
      isPlayer: creature.type === 'player',
      level: creature.level || 1,
      divinity: creature.divinity || 'none',
      divinityCustom: creature.divinityCustom || '',
      legendaryMax: computeLegendaryMax(creature.divinity || 'none', creature.divinityCustom || ''),
      legendaryRemaining: computeLegendaryMax(creature.divinity || 'none', creature.divinityCustom || ''),
      ac: creature.ac || 10,
      hpMax: creature.hpMax || 1,
      hpCurrent: creature.hpCurrent != null ? creature.hpCurrent : creature.hpMax,
      initiativeMod: creature.initiative || 0,
      initiative: null,
      stats: JSON.parse(JSON.stringify(creature.stats || {})),
      saveProf: JSON.parse(JSON.stringify(creature.saveProf || {})),
      profBonus: creature.profBonus || 2,
      damageDefenses: JSON.parse(JSON.stringify(creature.damageDefenses || {})),
      conditionDefenses: JSON.parse(JSON.stringify(creature.conditionDefenses || {})),
      speeds: JSON.parse(JSON.stringify(creature.speeds || {})),
      features: creature.features || '',
      reactions: creature.reactions || '',
      actions: JSON.parse(JSON.stringify(creature.actions || [])),
      legendaryActions: JSON.parse(JSON.stringify(creature.legendaryActions || [])),
      conditions: [],
      tempHp: 0,
      deathSaves: { successes: 0, failures: 0, stable: false },
      joinedAtRound: 0,
      skipsThisRound: false,
      alive: true,
      hidden: false
    };
  }

  function addCreature(creature, count) {
    count = count || 1;
    if (!combat) return;
    const startIdx = combat.participants.length;
    for (let i = 0; i < count; i++) {
      const suffix = count > 1 ? String(i + 1) : '';
      const p = makeParticipantFromCreature(creature, suffix);
      if (combat.started) {
        // Автоброс инициативы + пропуск текущего раунда
        p.initiative = D.rollOne(20) + (p.initiativeMod || 0);
        p.joinedAtRound = combat.round;
        p.skipsThisRound = true;
      } else {
        p.initiative = null;
        p.joinedAtRound = 0;
      }
      combat.participants.push(p);
    }
    if (combat.started) {
      // Запоминаем активного, чтобы после сортировки встать туда же
      const activeP = combat.participants[combat.activeIdx];
      sortByInitiative();
      if (activeP) combat.activeIdx = combat.participants.indexOf(activeP);
      combat.participants.slice(startIdx).forEach(function (p) {
        addLog(p.name + ' присоединяется (иниц. ' + p.initiative + '), пропустит этот раунд');
      });
    }
    save(); notify();
  }

  function addPlayer(name, hp, ac, initiativeMod) {
    if (!combat) return;
    const p = {
      id: 'p-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6),
      creatureId: null, name: name, avatar: null,
      type: 'player', isPlayer: true, level: 1,
      divinity: 'none', divinityCustom: '', legendaryMax: 0, legendaryRemaining: 0,
      ac: Number(ac) || 10,
      hpMax: Number(hp) || 1,
      hpCurrent: Number(hp) || 1,
      initiativeMod: Number(initiativeMod) || 0,
      initiative: null,
      stats: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
      saveProf: {}, profBonus: 2,
      damageDefenses: {}, conditionDefenses: {}, speeds: {},
      features: '', reactions: '',
      actions: [], legendaryActions: [],
      conditions: [], tempHp: 0,
      deathSaves: { successes: 0, failures: 0, stable: false },
      joinedAtRound: combat.started ? combat.round : 0,
      skipsThisRound: combat.started,
      alive: true, hidden: false
    };
    combat.participants.push(p);
    save(); notify();
  }

  function removeParticipant(id) {
    if (!combat) return;
    takeSnapshot();
    const active = combat.participants[combat.activeIdx];
    const viewing = combat.participants[combat.viewingIdx];
    combat.participants = combat.participants.filter(function (p) { return p.id !== id; });
    combat.activeIdx = active ? combat.participants.indexOf(active) : Math.min(combat.activeIdx, combat.participants.length - 1);
    combat.viewingIdx = viewing ? combat.participants.indexOf(viewing) : Math.min(combat.viewingIdx, combat.participants.length - 1);
    save(); notify();
  }

  // ==== Инициатива ====
  function rollInitiativeAll() {
    if (!combat) return;
    takeSnapshot();
    const active = combat.participants[combat.activeIdx];
    combat.participants.forEach(function (p) {
      if (p.isPlayer && p.initiative != null) return; // игрока не перетираем
      if (p.isPlayer) return;
      p.initiative = D.rollOne(20) + (p.initiativeMod || 0);
    });
    sortByInitiative();
    if (active) combat.activeIdx = combat.participants.indexOf(active);
    save(); notify();
  }

  function rollInitiativeOne(id) {
    if (!combat) return;
    const p = combat.participants.find(function (x) { return x.id === id; });
    if (!p || p.isPlayer) return;
    takeSnapshot();
    const active = combat.participants[combat.activeIdx];
    p.initiative = D.rollOne(20) + (p.initiativeMod || 0);
    sortByInitiative();
    if (active) combat.activeIdx = combat.participants.indexOf(active);
    save(); notify();
  }

  function setInitiative(id, value) {
    if (!combat) return;
    const p = combat.participants.find(function (x) { return x.id === id; });
    if (!p) return;
    p.initiative = value === '' || value == null ? null : Number(value);
    sortByInitiative();
    save(); notify();
  }

  function sortByInitiative() {
    if (!combat) return;
    combat.participants.sort(function (a, b) {
      const ai = a.initiative == null ? -1000 : a.initiative;
      const bi = b.initiative == null ? -1000 : b.initiative;
      if (bi !== ai) return bi - ai;
      const adx = (a.stats && a.stats.dex) || 10;
      const bdx = (b.stats && b.stats.dex) || 10;
      return bdx - adx;
    });
  }

  // ==== Переключение просмотра ====
  function setViewing(id) {
    if (!combat) return;
    const idx = combat.participants.findIndex(function (p) { return p.id === id; });
    if (idx === -1) return;
    combat.viewingIdx = idx;
    save(); notify();
  }
  function viewing() {
    if (!combat) return null;
    return combat.participants[combat.viewingIdx] || null;
  }
  function active() {
    if (!combat) return null;
    return combat.participants[combat.activeIdx] || null;
  }

  // ==== Бой ====
  function startCombat() {
    if (!combat) return { error: 'Нет боя' };
    const noInit = combat.participants.filter(function (p) { return p.initiative == null; });
    if (noInit.length) return { error: 'У бойцов нет инициативы: ' + noInit.map(function (p) { return p.name; }).join(', ') };
    takeSnapshot();
    combat.started = true;
    combat.round = 1;
    combat.activeIdx = 0;
    combat.viewingIdx = 0;
    combat.participants.forEach(function (p) {
      p.skipsThisRound = false;
      p.legendaryRemaining = p.legendaryMax || 0;
    });
    combat.log = [];
    addLog('— Раунд 1 —');
    const first = combat.participants[0];
    if (first) {
      addLog('Ход: ' + first.name);
      maybeDeathSave(first);
    }
    save(); notify();
    return { ok: true };
  }

  // Перейти к следующему активному существу, пропуская мёртвых и «присоединившихся»
  function advanceNext() {
    let next = combat.activeIdx + 1;
    let safety = 0;
    while (next < combat.participants.length && safety < 1000) {
      safety++;
      const p = combat.participants[next];
      if (!p.alive) { next++; continue; }
      if (p.skipsThisRound && p.joinedAtRound === combat.round) {
        addLog(p.name + ' пропускает ход (присоединился в этом раунде)');
        next++;
        continue;
      }
      break;
    }
    return next;
  }

  function nextTurn() {
    if (!combat || !combat.started) return;
    takeSnapshot();
    let next = advanceNext();

    if (next >= combat.participants.length) {
      combat.round += 1;
      combat.participants.forEach(function (p) {
        if (p.joinedAtRound < combat.round) p.skipsThisRound = false;
      });
      next = 0;
      while (next < combat.participants.length && !combat.participants[next].alive) next++;
      if (next >= combat.participants.length) next = 0;
      addLog('— Раунд ' + combat.round + ' —');
    }

    combat.activeIdx = next;
    combat.viewingIdx = next;
    const active = combat.participants[next];
    if (active) {
      addLog('Ход: ' + active.name);
      maybeDeathSave(active);
    }
    save(); notify();
  }

  function prevTurn() {
    if (!combat || !combat.started) return;
    takeSnapshot();
    let prev = combat.activeIdx - 1;
    if (prev < 0) {
      if (combat.round > 1) { combat.round -= 1; prev = combat.participants.length - 1; }
      else prev = 0;
    }
    // Пропускаем мёртвых
    let safety = 0;
    while (prev >= 0 && !combat.participants[prev].alive && safety < 1000) { prev--; safety++; }
    if (prev < 0) prev = 0;
    combat.activeIdx = prev;
    combat.viewingIdx = prev;
    save(); notify();
  }

  function endCombat() {
    if (!combat) return;
    takeSnapshot();
    combat.started = false;
    combat.round = 0;
    combat.activeIdx = -1;
    combat.viewingIdx = -1;
    save(); notify();
  }

  function maybeDeathSave(p) {
    if (!p || !p.isPlayer) return;
    if (p.hpCurrent > 0) return;
    if (!p.alive) return;
    if (p.deathSaves && p.deathSaves.stable) {
      addLog(p.name + ' стабилизирован, ход пропущен.');
      return;
    }
    rollDeathSave(p);
  }

  // ==== Урон / лечение ====
  function applyDamage(participantId, amount, opts) {
    opts = opts || {};
    if (!combat) return;
    const p = combat.participants.find(function (x) { return x.id === participantId; });
    if (!p) return;
    takeSnapshot();
    let dmg = Math.max(0, Math.floor(amount));
    if (p.tempHp > 0) {
      const absorbed = Math.min(p.tempHp, dmg);
      p.tempHp -= absorbed;
      dmg -= absorbed;
    }
    const before = p.hpCurrent;
    p.hpCurrent = Math.max(0, p.hpCurrent - dmg);
    addLog(p.name + ' получил ' + amount + ' урона (' + before + ' → ' + p.hpCurrent + ' HP)' +
      (opts.source ? ' от ' + opts.source : ''));
    if (p.hpCurrent <= 0 && p.alive && !p.isPlayer) {
      p.alive = false;
      addLog(p.name + ' повержен.');
    }
    save(); notify();
  }

  function applyHeal(participantId, amount) {
    if (!combat) return;
    const p = combat.participants.find(function (x) { return x.id === participantId; });
    if (!p) return;
    takeSnapshot();
    const before = p.hpCurrent;
    p.hpCurrent = Math.min(p.hpMax, p.hpCurrent + Math.floor(amount));
    addLog(p.name + ' вылечен на ' + amount + ' (' + before + ' → ' + p.hpCurrent + ' HP)');
    if (p.hpCurrent > 0 && p.isPlayer) {
      p.alive = true;
      p.deathSaves = { successes: 0, failures: 0, stable: false };
    }
    save(); notify();
  }

  function setHp(participantId, newHp) {
    if (!combat) return;
    const p = combat.participants.find(function (x) { return x.id === participantId; });
    if (!p) return;
    takeSnapshot();
    const before = p.hpCurrent;
    p.hpCurrent = Math.max(0, Number(newHp));
    addLog(p.name + ': HP ' + before + ' → ' + p.hpCurrent);
    if (p.hpCurrent > 0 && p.isPlayer) {
      p.alive = true;
      p.deathSaves = { successes: 0, failures: 0, stable: false };
    }
    save(); notify();
  }

  function setTempHp(participantId, value) {
    if (!combat) return;
    const p = combat.participants.find(function (x) { return x.id === participantId; });
    if (!p) return;
    p.tempHp = Math.max(0, Number(value) || 0);
    save(); notify();
  }

  // ==== Состояния ====
  function addCondition(participantId, condId, condName) {
    if (!combat) return;
    const p = combat.participants.find(function (x) { return x.id === participantId; });
    if (!p) return;
    takeSnapshot();
    p.conditions = p.conditions || [];
    if (!p.conditions.find(function (c) { return c.id === condId; })) {
      p.conditions.push({ id: condId, name: condName });
      addLog(p.name + ': ' + condName);
    }
    save(); notify();
  }

  function removeCondition(participantId, condId) {
    if (!combat) return;
    const p = combat.participants.find(function (x) { return x.id === participantId; });
    if (!p) return;
    takeSnapshot();
    p.conditions = (p.conditions || []).filter(function (c) { return c.id !== condId; });
    save(); notify();
  }

  // ==== Смертельные спасброски ====
  function rollDeathSave(p) {
    const r = D.rollOne(20);
    p.deathSaves = p.deathSaves || { successes: 0, failures: 0, stable: false };
    if (r === 20) {
      p.deathSaves.successes += 2;
      addLog(p.name + ' — спасбросок от смерти: 20 (2 успеха)');
    } else if (r === 1) {
      p.deathSaves.failures += 2;
      addLog(p.name + ' — спасбросок от смерти: 1 (2 провала)');
    } else if (r >= 10) {
      p.deathSaves.successes += 1;
      addLog(p.name + ' — спасбросок от смерти: ' + r + ' (успех)');
    } else {
      p.deathSaves.failures += 1;
      addLog(p.name + ' — спасбросок от смерти: ' + r + ' (провал)');
    }
    if (p.deathSaves.successes >= 3) {
      p.deathSaves.stable = true;
      addLog(p.name + ' стабилизирован.');
    }
    if (p.deathSaves.failures >= 3) {
      p.alive = false;
      addLog(p.name + ' погиб.');
    }
  }

  function addDeathFailure(participantId, count) {
    if (!combat) return;
    const p = combat.participants.find(function (x) { return x.id === participantId; });
    if (!p || !p.isPlayer) return;
    takeSnapshot();
    p.deathSaves = p.deathSaves || { successes: 0, failures: 0, stable: false };
    p.deathSaves.failures += count;
    addLog(p.name + ': +' + count + ' провал(а) спасброска от смерти');
    if (p.deathSaves.failures >= 3) { p.alive = false; addLog(p.name + ' погиб.'); }
    save(); notify();
  }

  function addDeathSuccess(participantId, count) {
    if (!combat) return;
    const p = combat.participants.find(function (x) { return x.id === participantId; });
    if (!p || !p.isPlayer) return;
    takeSnapshot();
    p.deathSaves = p.deathSaves || { successes: 0, failures: 0, stable: false };
    p.deathSaves.successes += count;
    if (p.deathSaves.successes >= 3) p.deathSaves.stable = true;
    save(); notify();
  }

  // ==== Лог ====
  function addLog(text) {
    if (!combat) return;
    combat.log = combat.log || [];
    combat.log.push({ at: new Date().toISOString(), text: text, round: combat.round });
    if (combat.log.length > 500) combat.log.shift();
  }
  function pushLog(text) { addLog(text); save(); notify(); }

  function useLegendary(participantId, cost) {
    if (!combat) return { error: 'Нет боя' };
    const p = combat.participants.find(function (x) { return x.id === participantId; });
    if (!p) return { error: 'Не найден' };
    cost = Math.max(0, Number(cost) || 0);
    const cur = p.legendaryRemaining != null ? p.legendaryRemaining : (p.legendaryMax || 0);
    if (cost > cur) return { error: 'Недостаточно ЛД' };
    takeSnapshot();
    p.legendaryRemaining = Math.max(0, cur - cost);
    addLog(p.name + ': −' + cost + ' ЛД (' + p.legendaryRemaining + '/' + (p.legendaryMax || 0) + ')');
    save(); notify();
    return { ok: true };
  }

  function addLegendary(participantId, amount) {
    if (!combat) return;
    const p = combat.participants.find(function (x) { return x.id === participantId; });
    if (!p) return;
    takeSnapshot();
    const n = Number(amount) || 0;
    const max = p.legendaryMax || 0;
    const cur = p.legendaryRemaining != null ? p.legendaryRemaining : max;
    p.legendaryRemaining = Math.max(0, Math.min(max, cur + n));
    addLog(p.name + ': ' + (n >= 0 ? '+' : '') + n + ' ЛД (' + p.legendaryRemaining + '/' + max + ')');
    save(); notify();
  }

  function setLegendaryMax(participantId, max) {
    if (!combat) return;
    const p = combat.participants.find(function (x) { return x.id === participantId; });
    if (!p) return;
    takeSnapshot();
    p.legendaryMax = Math.max(0, Number(max) || 0);
    if (p.legendaryRemaining == null || p.legendaryRemaining > p.legendaryMax) {
      p.legendaryRemaining = p.legendaryMax;
    }
    save(); notify();
  }

  return {
    createCombat: createCombat,
    loadLatest: loadLatest,
    get: get, clear: clear,
    subscribe: subscribe, save: save,
    addCreature: addCreature, addPlayer: addPlayer, removeParticipant: removeParticipant,
    rollInitiativeAll: rollInitiativeAll, rollInitiativeOne: rollInitiativeOne, setInitiative: setInitiative,
    startCombat: startCombat, nextTurn: nextTurn, prevTurn: prevTurn, endCombat: endCombat,
    setViewing: setViewing, viewing: viewing, active: active,
    applyDamage: applyDamage, applyHeal: applyHeal, setHp: setHp, setTempHp: setTempHp,
    addCondition: addCondition, removeCondition: removeCondition,
    addDeathFailure: addDeathFailure, addDeathSuccess: addDeathSuccess,
    useLegendary: useLegendary, addLegendary: addLegendary, setLegendaryMax: setLegendaryMax,
    pushLog: pushLog, undo: undo
  };
})();