window.PK = window.PK || {};
PK.pages = PK.pages || {};

PK.pages.dice = (function () {
  const U = PK.utils;
  const D = PK.dice;

  const HISTORY_KEY = 'pk-dice-history';
  const PRESETS_KEY = 'pk-dice-presets';

  const DICE_KEYS = ['d4', 'd6', 'd8', 'd10', 'd12', 'd20', 'd100'];

  let history = [];
  let presets = [];

  // Текущий конструктор
  let builder = {
    dice: { d4: 0, d6: 0, d8: 0, d10: 0, d12: 0, d20: 0, d100: 0 },
    modifier: 0,
    advMode: 0
  };

  let lastResult = null;

  function loadFromStorage() {
    try {
      const h = localStorage.getItem(HISTORY_KEY);
      if (h) history = JSON.parse(h) || [];
      const p = localStorage.getItem(PRESETS_KEY);
      if (p) presets = JSON.parse(p) || [];
    } catch (e) {}
    if (!presets.length) {
      presets = [
        { name: 'd20',         formula: '1d20' },
        { name: 'd20 + преим.', formula: '1d20 adv' },
        { name: 'd20 + помеха', formula: '1d20 dis' },
        { name: 'Атака +5',    formula: '1d20+5' },
        { name: 'Урон меч',    formula: '1d8+3' }
      ];
    }
  }

  function saveHistory() {
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, 50))); } catch (e) {}
  }
  function savePresets() {
    try { localStorage.setItem(PRESETS_KEY, JSON.stringify(presets)); } catch (e) {}
  }

  // ==== Сборка формулы из конструктора ====
  function buildFormula(b) {
    const parts = [];
    DICE_KEYS.forEach(function (k) {
      if (b.dice[k] > 0) parts.push(b.dice[k] + k);
    });
    let formula = parts.join('+') || '';
    if (b.modifier > 0) formula += '+' + b.modifier;
    else if (b.modifier < 0) formula += b.modifier;
    if (!formula && b.modifier === 0) return '';
    if (b.advMode === 1) formula += ' adv';
    else if (b.advMode === 2) formula += ' adv2';
    else if (b.advMode === -1) formula += ' dis';
    else if (b.advMode === -2) formula += ' dis2';
    return formula;
  }

  function canUseAdv(b) {
    // adv/dis доступен, если ровно 1 d20 и нет других кубиков
    let totalDice = 0;
    DICE_KEYS.forEach(function (k) { totalDice += b.dice[k] || 0; });
    return b.dice.d20 === 1 && totalDice === 1;
  }

  function clearBuilder() {
    builder.dice = { d4: 0, d6: 0, d8: 0, d10: 0, d12: 0, d20: 0, d100: 0 };
    builder.modifier = 0;
    builder.advMode = 0;
  }

  // ==== Рендер ====
  function render(root) {
    loadFromStorage();

    root.innerHTML =
      '<div class="dice-page">' +

        '<section class="section">' +
          '<h3>Кубики <span class="hint-inline">(клик — добавить; ПКМ или × — убрать)</span></h3>' +
          '<div class="dice-quick">' +
            DICE_KEYS.map(function (k) {
              return '<button class="btn dice-die-btn" data-die="' + k + '">' +
                '<span class="dice-die-label">' + k + '</span>' +
                '<span class="dice-die-count" data-die-count="' + k + '">0</span>' +
              '</button>';
            }).join('') +
          '</div>' +
        '</section>' +

        '<section class="section">' +
          '<h3>Конструктор</h3>' +
          '<div class="dice-builder" id="dice-builder"></div>' +
          '<div class="dice-builder-actions">' +
            '<button class="btn" id="dice-clear-builder">Очистить</button>' +
            '<button class="btn" id="dice-save-preset">Сохранить как пресет</button>' +
            '<div class="spacer"></div>' +
            '<button class="btn btn-primary" id="dice-roll">Бросить</button>' +
          '</div>' +
        '</section>' +

        '<section class="section" id="dice-adv-section">' +
          '<h3>Режим d20</h3>' +
          '<div class="dice-adv-row" id="dice-adv-row"></div>' +
          '<p class="muted" id="dice-adv-hint" style="margin:6px 0 0"></p>' +
        '</section>' +

        '<section class="section">' +
          '<h3>Результат</h3>' +
          '<div class="dice-result" id="dice-last"></div>' +
        '</section>' +

        '<section class="section">' +
          '<h3>Пресеты' +
            '<span class="spacer"></span>' +
            '<button class="btn btn-small" id="dice-preset-add">+ добавить</button>' +
          '</h3>' +
          '<div class="dice-presets" id="dice-presets"></div>' +
        '</section>' +

        '<section class="section">' +
          '<h3>История' +
            '<span class="spacer"></span>' +
            '<button class="btn btn-small" id="dice-clear">очистить</button>' +
          '</h3>' +
          '<div class="dice-history" id="dice-history"></div>' +
        '</section>' +

      '</div>';

    renderBuilder(root);
    renderAdvRow(root);
    renderPresets(root);
    renderHistory(root);
    renderLastResult(root);

    // ==== Кубики ====
    root.querySelectorAll('.dice-die-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const k = btn.dataset.die;
        builder.dice[k] = (builder.dice[k] || 0) + 1;
        if (k !== 'd20' && canUseAdv(builder) === false) { /* ничего */ }
        if (!canUseAdv(builder)) builder.advMode = 0;
        renderBuilder(root);
        renderAdvRow(root);
      });
      btn.addEventListener('contextmenu', function (e) {
        e.preventDefault();
        const k = btn.dataset.die;
        if ((builder.dice[k] || 0) > 0) {
          builder.dice[k] -= 1;
          if (!canUseAdv(builder)) builder.advMode = 0;
          renderBuilder(root);
          renderAdvRow(root);
        }
      });
    });

    // ==== Конструктор ====
    root.querySelector('#dice-clear-builder').addEventListener('click', function () {
      clearBuilder();
      renderBuilder(root);
      renderAdvRow(root);
    });

    root.querySelector('#dice-save-preset').addEventListener('click', function () {
      const f = buildFormula(builder);
      if (!f) { alert('Сначала собери формулу'); return; }
      openAddPresetDialog(root, f);
    });

    // Клики в конструкторе — удаление чипов
    root.querySelector('#dice-builder').addEventListener('click', function (e) {
      const chip = e.target.closest('[data-chip]');
      if (!chip) return;
      const kind = chip.dataset.chip;
      if (kind === 'dice') {
        const k = chip.dataset.die;
        if ((builder.dice[k] || 0) > 0) {
          builder.dice[k] -= 1;
          if (!canUseAdv(builder)) builder.advMode = 0;
        }
      } else if (kind === 'modifier') {
        builder.modifier = 0;
      }
      renderBuilder(root);
      renderAdvRow(root);
    });

    // Модификатор
    root.querySelector('#dice-builder').addEventListener('input', function (e) {
      if (!e.target.matches('[data-modifier-input]')) return;
      let v = Number(e.target.value) || 0;
      if (v < -100) v = -100;
      if (v > 100) v = 100;
      builder.modifier = v;
      // Обновляем только правую часть ввода — не перерисовываем всё поле
    });

    // Кнопки быстрого модификатора
    root.querySelector('#dice-builder').addEventListener('click', function (e) {
      const qb = e.target.closest('[data-mod-add]');
      if (!qb) return;
      builder.modifier = (builder.modifier || 0) + Number(qb.dataset.modAdd);
      if (builder.modifier < -100) builder.modifier = -100;
      if (builder.modifier > 100) builder.modifier = 100;
      const inp = root.querySelector('[data-modifier-input]');
      if (inp) inp.value = builder.modifier;
    });

    // ==== Режим d20 ====
    root.querySelector('#dice-adv-row').addEventListener('change', function (e) {
      if (!e.target.matches('[data-adv]')) return;
      builder.advMode = Number(e.target.dataset.adv);
      renderBuilder(root);
      renderAdvRow(root);
    });

    // ==== Бросок ====
    root.querySelector('#dice-roll').addEventListener('click', function () {
      doRoll();
    });

    function doRoll() {
      const f = buildFormula(builder);
      if (!f) { return; }
      const result = D.roll(f);
      if (!result) { alert('Не удалось бросить: ' + f); return; }
      lastResult = {
        at: new Date().toISOString(),
        formula: f,
        text: D.format(result),
        total: result.total
      };
      history.unshift(lastResult);
      if (history.length > 50) history.length = 50;
      saveHistory();
      renderLastResult(root);
      renderHistory(root);
    }

    // ==== Очистка истории ====
    root.querySelector('#dice-clear').addEventListener('click', function () {
      history = [];
      saveHistory();
      renderHistory(root);
    });

    // ==== Добавить пресет ====
    root.querySelector('#dice-preset-add').addEventListener('click', function () {
      openAddPresetDialog(root, '');
    });

    // ==== Клики по пресетам ====
    root.querySelector('#dice-presets').addEventListener('click', function (e) {
      const rb = e.target.closest('[data-preset-roll]');
      if (rb) {
        const idx = Number(rb.dataset.presetRoll);
        const p = presets[idx];
        if (p) {
          const result = D.roll(p.formula);
          if (!result) { alert('Формула пресета сломана: ' + p.formula); return; }
          lastResult = {
            at: new Date().toISOString(),
            formula: p.formula,
            label: p.name,
            text: D.format(result),
            total: result.total
          };
          history.unshift(lastResult);
          if (history.length > 50) history.length = 50;
          saveHistory();
          renderLastResult(root);
          renderHistory(root);
        }
        return;
      }
      const db = e.target.closest('[data-preset-del]');
      if (db) {
        const idx = Number(db.dataset.presetDel);
        presets.splice(idx, 1);
        savePresets();
        renderPresets(root);
        return;
      }
    });
  }

  // ==== Конструктор ====
  function renderBuilder(root) {
    const el = root.querySelector('#dice-builder');
    const chips = [];

    DICE_KEYS.forEach(function (k) {
      if (builder.dice[k] > 0) {
        chips.push(
          '<span class="dice-chip dice-chip-dice" data-chip="dice" data-die="' + k + '" title="Клик — убрать один кубик">' +
            builder.dice[k] + k +
            ' <span class="dice-chip-x">×</span>' +
          '</span>'
        );
      }
    });

    if (builder.modifier) {
      chips.push(
        '<span class="dice-chip dice-chip-mod" data-chip="modifier" title="Клик — сбросить модификатор">' +
          (builder.modifier > 0 ? '+' + builder.modifier : builder.modifier) +
          ' <span class="dice-chip-x">×</span>' +
        '</span>'
      );
    }

    // Модификатор всегда доступен через поле + кнопки
    const modInput =
      '<div class="dice-mod-input-wrap">' +
        '<button class="btn btn-small" data-mod-add="-5">−5</button>' +
        '<button class="btn btn-small" data-mod-add="-1">−1</button>' +
        '<input class="input dice-mod-input" type="number" data-modifier-input value="' + (builder.modifier || 0) + '" min="-100" max="100">' +
        '<button class="btn btn-small" data-mod-add="1">+1</button>' +
        '<button class="btn btn-small" data-mod-add="5">+5</button>' +
      '</div>';

    el.innerHTML =
      '<div class="dice-chips">' +
        (chips.length ? chips.join(' ') : '<span class="muted">Пусто. Кликни по кубикам выше.</span>') +
      '</div>' +
      '<div class="dice-modifier-row">' +
        '<span class="field-label">Модификатор</span>' +
        modInput +
      '</div>';

    // Обновляем счётчики у кнопок кубиков
    DICE_KEYS.forEach(function (k) {
      const c = root.querySelector('[data-die-count="' + k + '"]');
      if (c) {
        c.textContent = builder.dice[k] || 0;
        c.classList.toggle('active', (builder.dice[k] || 0) > 0);
      }
    });
  }

  function renderAdvRow(root) {
    const row = root.querySelector('#dice-adv-row');
    const hint = root.querySelector('#dice-adv-hint');
    const sec = root.querySelector('#dice-adv-section');
    const enabled = canUseAdv(builder);

    sec.classList.toggle('disabled', !enabled);

    const opts = [
      { v: 0,  label: 'Обычный',           short: '—' },
      { v: 1,  label: 'Преимущество',      short: 'adv' },
      { v: -1, label: 'Помеха',            short: 'dis' },
      { v: 2,  label: 'Двойное преим.',    short: 'adv2' },
      { v: -2, label: 'Двойная помеха',    short: 'dis2' }
    ];

    row.innerHTML = opts.map(function (o) {
      const checked = builder.advMode === o.v ? ' checked' : '';
      const dis = !enabled ? ' disabled' : '';
      return '<label class="dice-adv-btn' + (builder.advMode === o.v ? ' active' : '') + (enabled ? '' : ' disabled') + '">' +
        '<input type="radio" name="dice-adv" data-adv="' + o.v + '"' + checked + dis + '>' +
        '<span class="dice-adv-label">' + o.label + '</span>' +
      '</label>';
    }).join('');

    if (enabled) {
      hint.textContent = 'Работает только на одной d20. Применяется ко всем другим кубикам и модификатору после выбора.';
    } else {
      hint.textContent = 'Доступно, когда в конструкторе ровно 1 d20 и нет других кубиков.';
    }
  }

  function renderLastResult(root) {
    const el = root.querySelector('#dice-last');
    if (!lastResult) {
      el.innerHTML = '<p class="muted">Пока пусто. Собери формулу и нажми «Бросить».</p>';
      return;
    }
    el.innerHTML =
      '<div class="dice-last">' +
        '<div class="dice-last-total">' + lastResult.total + '</div>' +
        '<div class="dice-last-detail">' +
          (lastResult.label ? '<strong>' + U.escapeHtml(lastResult.label) + '</strong> · ' : '') +
          U.escapeHtml(lastResult.formula) + '<br>' +
          U.escapeHtml(lastResult.text) +
        '</div>' +
      '</div>';
  }

  function renderPresets(root) {
    const el = root.querySelector('#dice-presets');
    if (!presets.length) {
      el.innerHTML = '<p class="muted">Нет пресетов.</p>';
      return;
    }
    el.innerHTML = presets.map(function (p, i) {
      return '<div class="dice-preset">' +
        '<button class="btn dice-preset-btn" data-preset-roll="' + i + '">' +
          '<span class="dice-preset-name">' + U.escapeHtml(p.name) + '</span>' +
          '<span class="dice-preset-formula">' + U.escapeHtml(p.formula) + '</span>' +
        '</button>' +
        '<button class="btn btn-icon btn-small" data-preset-del="' + i + '" title="Удалить">×</button>' +
      '</div>';
    }).join('');
  }

  function renderHistory(root) {
    const el = root.querySelector('#dice-history');
    if (!history.length) {
      el.innerHTML = '<p class="muted">Пока пусто.</p>';
      return;
    }
    el.innerHTML = history.map(function (h) {
      const t = new Date(h.at);
      const time = ('0' + t.getHours()).slice(-2) + ':' + ('0' + t.getMinutes()).slice(-2);
      return '<div class="dice-history-row">' +
        '<span class="dice-history-time">' + time + '</span>' +
        '<span class="dice-history-label">' + U.escapeHtml(h.label || h.formula) + '</span>' +
        '<span class="dice-history-text">' + U.escapeHtml(h.text) + '</span>' +
        '<span class="dice-history-total">' + h.total + '</span>' +
      '</div>';
    }).join('');
  }

  function openAddPresetDialog(root, prefilledFormula) {
    PK.modal.openModal({
      title: 'Новый пресет',
      content:
        '<div class="grid" style="gap:14px">' +
          '<label class="field">' +
            '<span class="field-label">Название</span>' +
            '<input class="input" id="preset-name" placeholder="Атака мечом" autofocus>' +
          '</label>' +
          '<label class="field">' +
            '<span class="field-label">Формула</span>' +
            '<input class="input" id="preset-formula" value="' + U.escapeHtml(prefilledFormula || '') + '" placeholder="1d20+5">' +
          '</label>' +
          '<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:8px">' +
            '<button class="btn" data-cancel>Отмена</button>' +
            '<button class="btn btn-primary" data-save>Сохранить</button>' +
          '</div>' +
        '</div>',
      onMount: function (body, close) {
        const nameIn = body.querySelector('#preset-name');
        const fIn = body.querySelector('#preset-formula');
        setTimeout(function () { nameIn.focus(); }, 20);
        body.querySelector('[data-cancel]').addEventListener('click', close);
        body.querySelector('[data-save]').addEventListener('click', function () {
          const n = nameIn.value.trim();
          const f = fIn.value.trim();
          if (!n || !f) return;
          if (!PK.dice.parse(f)) { alert('Формула не распознана. Примеры: 1d20, 2d6+3, 4d6dl1, 1d20+5 adv'); return; }
          presets.push({ name: n, formula: f });
          savePresets();
          renderPresets(root);
          close();
        });
      }
    });
  }

  return { render: render };
})();