window.PK = window.PK || {};

PK.dice = (function () {

  // advMode: 0 = обычный, 1 = преимущество, 2 = двойное преимущество,
  //          -1 = помеха, -2 = двойная помеха
  function parse(formula) {
    if (!formula) return null;
    let s = String(formula).trim().toLowerCase();

    let advMode = 0;
    if (/dis2|disadvantage2/.test(s)) { advMode = -2; s = s.replace(/dis2|disadvantage2/, ''); }
    else if (/adv2|advantage2/.test(s)) { advMode = 2; s = s.replace(/adv2|advantage2/, ''); }
    else if (/(^|[^a-z])dis([^a-z]|$)|disadvantage/.test(s)) { advMode = -1; s = s.replace(/disadvantage|dis/, ''); }
    else if (/(^|[^a-z])adv([^a-z]|$)|advantage/.test(s)) { advMode = 1; s = s.replace(/advantage|adv/, ''); }

    let dropLowest = 0;
    const dlMatch = s.match(/dl(\d*)/);
    if (dlMatch) {
      dropLowest = dlMatch[1] ? Number(dlMatch[1]) : 1;
      s = s.replace(/dl\d*/, '');
    }

    s = s.replace(/\s+/g, '');

    // Поддержка нескольких кубиков через "+", например 2d6+1d8+3
    const tokens = s.split('+').filter(Boolean);
    if (!tokens.length) return null;

    const parts = [];
    let modifier = 0;

    for (const tok of tokens) {
      const dm = tok.match(/^(\d*)d(\d+)$/);
      if (dm) {
        const c = dm[1] ? Number(dm[1]) : 1;
        const d = Number(dm[2]);
        if (c < 1 || c > 100 || d < 2 || d > 1000) return null;
        parts.push({ count: c, die: d });
        continue;
      }
      const mm = tok.match(/^([+\-]?\d+)$/);
      if (mm) { modifier += Number(mm[1]); continue; }
      return null;
    }

    if (!parts.length && !modifier) return null;

    // adv/dis применяется только если ровно одна d20 во всей формуле
    const d20Parts = parts.filter(function (p) { return p.die === 20; });
    const canAdv = d20Parts.length === 1 && d20Parts[0].count === 1 && parts.length === 1;
    if (!canAdv) advMode = 0;

    return {
      parts: parts,
      modifier: modifier,
      advMode: advMode,
      dropLowest: dropLowest
    };
  }

  function rollParsed(p) {
    if (!p) return null;

    const detail = [];
    let sum = 0;
    let advRolls = null;

    for (const part of p.parts) {
      if (part.die === 20 && part.count === 1 && p.advMode !== 0) {
        const n = Math.abs(p.advMode) + 1; // 1 → 2 кубика, 2 → 3 кубика
        const rolls = [];
        for (let i = 0; i < n; i++) rolls.push(1 + Math.floor(Math.random() * 20));
        const picked = p.advMode > 0 ? Math.max.apply(null, rolls) : Math.min.apply(null, rolls);
        advRolls = { rolls: rolls, picked: picked, mode: p.advMode };
        detail.push({
          count: 1, die: 20,
          rolls: [picked],
          kept: [picked],
          dropped: rolls.filter(function (r) { return r !== picked; }),
          adv: true
        });
        sum += picked;
        continue;
      }

      let rolls = [];
      for (let i = 0; i < part.count; i++) rolls.push(1 + Math.floor(Math.random() * part.die));
      let kept = rolls.slice();
      let dropped = [];
      if (p.dropLowest > 0 && kept.length > p.dropLowest) {
        const sorted = kept.slice().sort(function (a, b) { return a - b; });
        const toDrop = sorted.slice(0, p.dropLowest);
        dropped = toDrop.slice();
        toDrop.forEach(function (val) {
          const idx = kept.indexOf(val);
          if (idx !== -1) kept.splice(idx, 1);
        });
      }
      detail.push({
        count: part.count, die: part.die,
        rolls: rolls, kept: kept, dropped: dropped
      });
      sum += kept.reduce(function (a, b) { return a + b; }, 0);
    }

    const total = sum + p.modifier;

    return {
      parts: detail,
      advRolls: advRolls,
      modifier: p.modifier,
      sum: sum,
      total: total
    };
  }

  function roll(formula) {
    const p = parse(formula);
    if (!p) return null;
    return rollParsed(p);
  }

  function rollOne(die) {
    return 1 + Math.floor(Math.random() * die);
  }

  // Отображение результата
  function format(result) {
    if (!result) return '';
    const chunks = [];

    result.parts.forEach(function (pt) {
      let chunk = '';
      if (pt.adv) {
        chunk = 'd20[' + pt.rolls.join('→') + ']';
      } else {
        chunk = pt.count + 'd' + pt.die + '[' + pt.rolls.join(', ') + ']';
        if (pt.dropped && pt.dropped.length) chunk += ' (−' + pt.dropped.join(', ') + ')';
      }
      chunks.push(chunk);
    });

    let s = chunks.join(' + ');
    if (result.modifier > 0) s += ' + ' + result.modifier;
    else if (result.modifier < 0) s += ' − ' + Math.abs(result.modifier);
    s += ' = ' + result.total;
    return s;
  }

  return {
    parse: parse,
    roll: roll,
    rollOne: rollOne,
    format: format
  };
})();