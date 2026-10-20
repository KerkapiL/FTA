window.PK = window.PK || {};
PK.pages = PK.pages || {};

PK.pages.timeline = (function () {
  const U = PK.utils;
  const M = PK.modal;
  const S = PK.storage;
  const R = window.TLRender;
  const STORE = 'timelines';

  /* ============ МОДЕЛЬ ============ */

  function makeWorld() {
    return { id: 'world', kind: 'world', events: [], createdAt: new Date().toISOString() };
  }
  function makeCampaign() {
    return {
      id: 'campaign', kind: 'campaign',
      startDate: '2025-07-13',
      endDate:   '2026-07-13',
      currentDay: '2025-09-25',
      events: [],
      createdAt: new Date().toISOString()
    };
  }

  function normalizeWorld(raw) {
    raw = raw || {};
    return {
      id: 'world', kind: 'world',
      events: (Array.isArray(raw.events) ? raw.events : []).map(function (e) {
        return {
          id: e.id || R.uid('wev'),
          year: typeof e.year === 'number' ? e.year : (Number(e.year) || 0),
          title: String(e.title || ''),
          description: String(e.description || ''),
          category: R.catById(e.category).id
        };
      }),
      createdAt: raw.createdAt || new Date().toISOString()
    };
  }

  function normalizeCampaign(raw) {
    raw = raw || {};
    return {
      id: 'campaign', kind: 'campaign',
      startDate: raw.startDate || '2025-07-13',
      endDate:   raw.endDate   || '2026-07-13',
      currentDay: raw.currentDay || '2025-09-25',
      events: (Array.isArray(raw.events) ? raw.events : []).map(function (e) {
        return {
          id: e.id || R.uid('cev'),
          date: e.date || '2025-07-13',
          title: String(e.title || ''),
          description: String(e.description || ''),
          category: R.catById(e.category).id
        };
      }),
      createdAt: raw.createdAt || new Date().toISOString()
    };
  }

  /* ============ СОСТОЯНИЕ ============ */

  let world = null;
  let campaign = null;
  let loaded = false;
  let viewMode = null; // 'pick' | 'world' | 'campaign'
  let state = null;    // { centerValue, visibleSpan }
  const els = { root: null };

  /* ============ ЗАГРУЗКА ============ */

  function loadAll() {
    return S.getAll(STORE).then(function (items) {
      items = items || [];
      var w = items.find(function (x) { return x.id === 'world'; });
      var c = items.find(function (x) { return x.id === 'campaign'; });
      world = normalizeWorld(w);
      campaign = normalizeCampaign(c);
      var puts = [];
      if (!w) puts.push(S.put(STORE, world));
      if (!c) puts.push(S.put(STORE, campaign));
      return Promise.all(puts);
    }).then(function () { loaded = true; });
  }

  function saveWorld()    { return S.put(STORE, world); }
  function saveCampaign() { return S.put(STORE, campaign); }

  /* ============ РЕНДЕР ============ */

  function render(root) {
    els.root = root;
    if (!loaded) {
      return loadAll().then(function () { paint(); });
    }
    paint();
    return Promise.resolve();
  }

  function paint() {
    if (!viewMode) viewMode = 'pick';
    if (viewMode === 'pick')     return renderPicker();
    if (viewMode === 'world')    return renderWorld();
    if (viewMode === 'campaign') return renderCampaign();
  }

  function renderPicker() {
    var root = els.root;
    root.innerHTML =
      '<div class="tl-picker">' +
        '<button class="tl-picker-card" data-mode="world">' +
          '<div class="tl-picker-icon">🌍</div>' +
          '<h2>Мировой таймлайн</h2>' +
          '<div class="muted">7000 до н.э. — 2026 н.э.</div>' +
          '<div class="muted" style="font-size:11px">' + world.events.length + ' событий</div>' +
        '</button>' +
        '<button class="tl-picker-card" data-mode="campaign">' +
          '<div class="tl-picker-icon">⚔</div>' +
          '<h2>Кампания</h2>' +
          '<div class="muted">' + R.formatCampaignDate(campaign.startDate) + ' — ' + R.formatCampaignDate(campaign.endDate) + '</div>' +
          '<div class="muted" style="font-size:11px">' + campaign.events.length + ' событий</div>' +
        '</button>' +
      '</div>';
    root.querySelectorAll('.tl-picker-card').forEach(function (btn) {
      btn.addEventListener('click', function () {
        viewMode = btn.dataset.mode;
        if (viewMode === 'world') {
          state = { centerValue: -3000, visibleSpan: 1000 };
        } else {
          state = { centerValue: 150, visibleSpan: 90 };
        }
        paint();
      });
    });
  }

  function basePageHtml(opts) {
    return '' +
      '<div class="page-toolbar">' +
        '<button class="btn" id="tl-back">← К выбору</button>' +
        '<h2 style="margin:0;font-size:15px">' + opts.title + '</h2>' +
        '<div class="spacer"></div>' +
        '<span class="tl-zoom-label" id="tl-zoom-label"></span>' +
        '<input type="range" class="tl-zoom" id="tl-zoom" min="0" max="100" value="50">' +
        '<button class="btn btn-primary" id="tl-add">+ Событие</button>' +
      '</div>' +
      '<div class="tl-page" id="tl-page"' + (opts.season ? ' data-season="' + opts.season + '"' : '') + '>' +
        '<div class="tl-viewport">' +
          '<div class="tl-era-label" id="tl-era"></div>' +
          '<div class="tl-strip-wrap">' +
            '<button class="tl-nav" data-nav="fast-back" title="Далеко назад">⇐</button>' +
            '<button class="tl-nav" data-nav="back" title="Назад">←</button>' +
            '<div class="tl-strip" id="tl-strip">' +
              '<div class="tl-fade tl-fade-left"></div>' +
              '<div class="tl-fade tl-fade-right"></div>' +
              '<div class="tl-track" id="tl-track"></div>' +
            '</div>' +
            '<button class="tl-nav" data-nav="fwd" title="Вперёд">→</button>' +
            '<button class="tl-nav" data-nav="fast-fwd" title="Далеко вперёд">⇒</button>' +
          '</div>' +
          '<div class="tl-date" id="tl-date"></div>' +
        '</div>' +
        (opts.extraHtml || '') +
        '<div class="tl-events" id="tl-events"></div>' +
      '</div>';
  }

  function renderWorld() {
    els.root.innerHTML = basePageHtml({ title: '🌍 Мировой таймлайн' });
    bindCommon();
    updateWorld(true);
  }

  function renderCampaign() {
    var month = new Date(campaign.currentDay + 'T00:00:00').getMonth() + 1;
    var season = R.seasonFor(month);
    var totalDays = R.daysBetween(campaign.startDate, campaign.endDate);
    var currentIdx = R.daysBetween(campaign.startDate, campaign.currentDay);

    els.root.innerHTML = basePageHtml({
      title: '⚔ Кампания',
      season: season,
      extraHtml:
        '<div class="tl-today-row">' +
          '<span>📅 Текущий игровой день:</span>' +
          '<span class="tl-today-date" id="tl-today-date">' + R.formatCampaignDate(campaign.currentDay) + '</span>' +
          '<input type="range" class="tl-zoom tl-today-slider" id="tl-today-slider" min="0" max="' + totalDays + '" value="' + currentIdx + '">' +
          '<button class="btn btn-small" id="tl-today-btn">Сегодня</button>' +
        '</div>'
    });
    bindCommon();
    bindCampaignControls();
    updateCampaign(true);
  }

  function bindCommon() {
    els.root.querySelector('#tl-back').addEventListener('click', function () {
      viewMode = 'pick'; state = null; paint();
    });
    els.root.querySelector('#tl-add').addEventListener('click', function () {
      if (viewMode === 'world') openWorldEventDialog();
      else openCampaignEventDialog();
    });
    els.root.querySelectorAll('.tl-nav').forEach(function (b) {
      b.addEventListener('click', function () { nav(b.dataset.nav); });
    });
    var strip = els.root.querySelector('#tl-strip');
    strip.addEventListener('mousedown', startDrag);
    strip.addEventListener('touchstart', startDrag, { passive: true });

    var zoom = els.root.querySelector('#tl-zoom');
    zoom.addEventListener('input', function () {
      var v = Number(zoom.value) / 100;
      if (viewMode === 'world') {
        state.visibleSpan = Math.round(9000 - v * (9000 - 50));
      } else {
        state.visibleSpan = Math.round(365 - v * (365 - 14));
      }
      state.centerValue = clampCenter(state.centerValue);
      updateView(false);
    });
  }

  function bindCampaignControls() {
    var slider = els.root.querySelector('#tl-today-slider');
    if (slider) slider.addEventListener('input', function () {
      var d = R.addDays(campaign.startDate, Number(slider.value));
      campaign.currentDay = d;
      els.root.querySelector('#tl-today-date').textContent = R.formatCampaignDate(d);
      saveCampaign();
      updateView(false);
    });
    var btn = els.root.querySelector('#tl-today-btn');
    if (btn) btn.addEventListener('click', function () {
      centerOn(R.daysBetween(campaign.startDate, campaign.currentDay));
    });
  }

  /* ============ ОБНОВЛЕНИЕ ============ */

  function updateView(resetZoom) {
    if (viewMode === 'world') updateWorld(resetZoom);
    else updateCampaign(resetZoom);
  }

  function updateWorld(resetZoom) {
    var root = els.root;
    var centerYear = Math.round(state.centerValue);
    var era = R.eraForYear(centerYear);

    root.querySelector('#tl-era').textContent = era.name;
    root.querySelector('#tl-era').style.color = era.color;

    if (resetZoom !== false) syncZoomSlider();

    renderWorldStrip();
    renderWorldEvents();
  }

  function updateCampaign(resetZoom) {
    var root = els.root;
    var centerIdx = Math.round(state.centerValue);
    var currentIdx = R.daysBetween(campaign.startDate, campaign.currentDay);
    var totalDays = R.daysBetween(campaign.startDate, campaign.endDate);
    var centerDate = R.addDays(campaign.startDate, centerIdx);
    var season = R.seasonFor(new Date(centerDate + 'T00:00:00').getMonth() + 1);

    root.querySelector('#tl-era').textContent = R.seasonLabel(season);

    // Красим вкладку и ленту в цвет текущего сезона на экране.
    var pageEl = root.querySelector('#tl-page');
    if (pageEl) pageEl.dataset.season = season;

    var stripEl = root.querySelector('#tl-strip');
    if (stripEl) {
      var sc = { winter: '#6dc6f0', spring: '#6ec27e', summer: '#e8b830', autumn: '#e8874a' }[season] || '#909090';
      stripEl.style.background =
        'linear-gradient(180deg, ' + hexA(sc, 0.12) + ', ' + hexA(sc, 0.03) + '), var(--panel-2)';
    }

    if (resetZoom !== false) syncZoomSlider();

    renderCampaignStrip(currentIdx, totalDays);
    renderCampaignEvents(currentIdx);
  }

  function syncZoomSlider() {
    var z = els.root.querySelector('#tl-zoom');
    if (!z) return;
    var v;
    if (viewMode === 'world') {
      v = (9000 - state.visibleSpan) / (9000 - 50);
      els.root.querySelector('#tl-zoom-label').textContent = state.visibleSpan + ' лет';
    } else {
      v = (365 - state.visibleSpan) / (365 - 14);
      els.root.querySelector('#tl-zoom-label').textContent = state.visibleSpan + ' дн.';
    }
    z.value = Math.round(v * 100);
  }

  /* ============ ЛЕНТА ============ */

  function renderWorldStrip() {
    var track = els.root.querySelector('#tl-track');
    var span = state.visibleSpan;
    var b = rangeBounds();
    var left = Math.max(b.min, state.centerValue - span / 2);
    var right = Math.min(b.max, state.centerValue + span / 2);

    var html = '';

    var b = rangeBounds();
    var step = pickTick(span, [10, 25, 50, 100, 250, 500, 1000]);
    var first = Math.ceil(left / step) * step;
    for (var y = first; y <= right; y += step) {
      if (y < b.min || y > b.max) continue;
      var pos = ((y - left) / span) * 100;
      html += '<div class="tl-tick-line" style="left:' + pos + '%"></div>';
      html += '<div class="tl-tick" style="left:' + pos + '%">' + R.formatWorldDate(y) + '</div>';
    }

    var era = R.eraForYear(Math.round(state.centerValue));
    var stripEl = els.root.querySelector('#tl-strip');
    stripEl.style.background =
      'linear-gradient(180deg, ' + hexA(era.color, 0.18) + ', ' + hexA(era.color, 0.05) + '), var(--panel-2)';

    // Группируем события по году
    var byYear = {};
    world.events.forEach(function (e) {
      if (e.year < left - 5 || e.year > right + 5) return;
      if (!byYear[e.year]) byYear[e.year] = [];
      byYear[e.year].push(e);
    });

    Object.keys(byYear).forEach(function (yearKey) {
      var year = Number(yearKey);
      var pos = ((year - left) / span) * 100;
      var group = byYear[year].slice(0, 3);
      var colors = group.map(function (e) { return R.catById(e.category).color; });
      var titles = group.map(function (e) { return e.title; }).join(' · ');
      var cls = 'tl-marker' + (colors.length > 1 ? ' tl-marker-count-' + colors.length : '');
      html += '<div class="' + cls + '" data-ev-id="' + group[0].id + '" data-year="' + year + '" ' +
              'style="left:' + pos + '%;' + markerBg(colors) + '" ' +
              'title="' + R.esc(titles) + '"></div>';
    });

    track.innerHTML = html;
    track.querySelectorAll('.tl-marker').forEach(function (m) {
      m.addEventListener('click', function (e) {
        e.stopPropagation();
        centerOn(Number(m.dataset.year));
      });
    });
  }

  function renderCampaignStrip(currentIdx, totalDays) {
    var track = els.root.querySelector('#tl-track');
    var span = state.visibleSpan;
    var b = rangeBounds();
	var left = Math.max(b.min, state.centerValue - span / 2);
	var right = Math.min(b.max, state.centerValue + span / 2);

    var html = '';
    var step = pickTick(span, [1, 2, 3, 7, 14, 30, 60, 90]);
    var first = Math.ceil(left / step) * step;
    for (var i = first; i <= right; i += step) {
      if (i < 0 || i > totalDays) continue;
      var pos = ((i - left) / span) * 100;
      var d = R.addDays(campaign.startDate, i);
      html += '<div class="tl-tick-line" style="left:' + pos + '%"></div>';
      html += '<div class="tl-tick" style="left:' + pos + '%">' + R.shortDate(d, span) + '</div>';
    }

    if (currentIdx >= left && currentIdx <= right) {
      var posT = ((currentIdx - left) / span) * 100;
      html += '<div class="tl-today-line" style="left:' + posT + '%"></div>';
      html += '<div class="tl-today-label" style="left:' + posT + '%">сегодня</div>';
    }

    var byDay = {};
    campaign.events.forEach(function (e) {
      var idx = R.daysBetween(campaign.startDate, e.date);
      if (idx < left - 3 || idx > right + 3) return;
      if (!byDay[idx]) byDay[idx] = [];
      byDay[idx].push(e);
    });
    Object.keys(byDay).forEach(function (idxKey) {
      var idx = Number(idxKey);
      var pos = ((idx - left) / span) * 100;
      var future = idx > currentIdx;
      var group = byDay[idx].slice(0, 3);
      var colors = group.map(function (e) { return R.catById(e.category).color; });
      var titles = group.map(function (e) { return e.title; }).join(' · ');
      var cls = 'tl-marker' + (future ? ' future' : '') +
                (colors.length > 1 ? ' tl-marker-count-' + colors.length : '');
      html += '<div class="' + cls + '" data-ev-id="' + group[0].id + '" data-idx="' + idx + '" ' +
              'style="left:' + pos + '%;' + markerBg(colors) + '" ' +
              'title="' + R.esc(titles) + '"></div>';
    });

    track.innerHTML = html;
    track.querySelectorAll('.tl-marker').forEach(function (m) {
      m.addEventListener('click', function (e) {
        e.stopPropagation();
        centerOn(Number(m.dataset.idx));
      });
    });
  }

  /* ============ ТРИ КОЛОНКИ ============ */

  function renderWorldEvents() {
    var root = els.root;
    var container = root.querySelector('#tl-events');
    var dateEl = root.querySelector('#tl-date');
    var centerYear = Math.round(state.centerValue);

    if (!world.events.length) {
      dateEl.textContent = R.formatWorldDate(centerYear);
      container.innerHTML = '<div class="tl-events-empty">Нет событий. Нажми «+ Событие».</div>';
      return;
    }

    var years = [...new Set(world.events.map(function (e) { return e.year; }))];
    var closest = years.reduce(function (a, b) {
      return Math.abs(b - centerYear) < Math.abs(a - centerYear) ? b : a;
    });
    var dist = Math.abs(closest - centerYear);
    var opacity = Math.max(0, 1 - dist / (state.visibleSpan * 0.35));

    var events = world.events.filter(function (e) { return e.year === closest; }).slice(0, 3);

    dateEl.innerHTML =
      R.formatWorldDate(centerYear) +
      (closest !== centerYear ? '<span class="tl-date-small">→ ' + R.formatWorldDate(closest) + '</span>' : '');

    container.innerHTML = events.map(function (e) {
      return eventColHtml(e, R.formatWorldDate(e.year));
    }).join('');
    container.style.opacity = opacity;
  }

  function renderCampaignEvents(currentIdx) {
    var root = els.root;
    var container = root.querySelector('#tl-events');
    var dateEl = root.querySelector('#tl-date');

    var events = campaign.events.slice();
    var centerDate = R.addDays(campaign.startDate, Math.round(state.centerValue));

    if (!events.length) {
      dateEl.textContent = R.formatCampaignDate(centerDate);
      container.innerHTML = '<div class="tl-events-empty">Нет событий. Нажми «+ Событие».</div>';
      return;
    }

    var byDay = {};
    events.forEach(function (e) {
      var idx = R.daysBetween(campaign.startDate, e.date);
      if (!byDay[idx]) byDay[idx] = [];
      byDay[idx].push(e);
    });
    var keys = Object.keys(byDay).map(Number);
    var centerIdx = Math.round(state.centerValue);
    var closest = keys.reduce(function (a, b) {
      return Math.abs(b - centerIdx) < Math.abs(a - centerIdx) ? b : a;
    });
    var dist = Math.abs(closest - centerIdx);
    var opacity = Math.max(0, 1 - dist / (state.visibleSpan * 0.35));

    var dayEvents = byDay[closest].slice(0, 3);
    var closestDate = R.addDays(campaign.startDate, closest);

    dateEl.innerHTML =
      R.formatCampaignDate(centerDate) +
      (closest !== centerIdx ? '<span class="tl-date-small">→ ' + R.formatCampaignDate(closestDate) + '</span>' : '') +
      '<span class="tl-date-small">день ' + centerIdx + '</span>';

    container.innerHTML = dayEvents.map(function (e) {
      return eventColHtml(e, R.formatCampaignDate(e.date));
    }).join('');
    container.style.opacity = opacity;
  }

  function eventColHtml(e, dateLabel) {
    var cat = R.catById(e.category);
    return '' +
      '<div class="tl-event-col" style="--tl-cat:' + cat.color + '" data-ev-id="' + e.id + '">' +
        '<div class="tl-event-cat">' + R.esc(cat.label) + ' · ' + R.esc(dateLabel) + '</div>' +
        '<div class="tl-event-title">' + R.esc(e.title || 'Без названия') + '</div>' +
        '<div class="tl-event-desc">' + R.esc(e.description || '') + '</div>' +
      '</div>';
  }

  // Делегированный клик по колонке → редактирование события
  document.addEventListener('click', function (ev) {
    var col = ev.target.closest && ev.target.closest('.tl-event-col');
    if (!col || !els.root || !els.root.contains(col)) return;
    var id = col.dataset.evId;
    if (!id) return;
    if (viewMode === 'world') openWorldEventDialog(id);
    else if (viewMode === 'campaign') openCampaignEventDialog(id);
  });

  /* ============ НАВИГАЦИЯ ============ */

  function nav(kind) {
    var step = state.visibleSpan;
    var delta = 0;
    if (kind === 'back')      delta = -step * 0.3;
    if (kind === 'fast-back') delta = -step * 0.9;
    if (kind === 'fwd')       delta =  step * 0.3;
    if (kind === 'fast-fwd')  delta =  step * 0.9;
    centerOn(state.centerValue + delta);
  }

  function centerOn(target) {
    animateTo(clampCenter(target));
  }
  
  function animateTo(target) {
    target = clampCenter(target);
    var from = state.centerValue;
    if (Math.abs(target - from) < 0.5) { state.centerValue = target; updateView(false); return; }
    var start = performance.now();
    var dur = 260;
    function stepFn(t) {
      var p = Math.min(1, (t - start) / dur);
      var e = 1 - Math.pow(1 - p, 3);
      state.centerValue = from + (target - from) * e;
      updateView(false);
      if (p < 1) requestAnimationFrame(stepFn);
    }
    requestAnimationFrame(stepFn);
  }

  /* ============ DRAG ============ */

  function startDrag(e) {
    var strip = els.root.querySelector('#tl-strip');
    if (!strip) return;
    if (e.target.closest('.tl-marker')) return;
    if (e.preventDefault) e.preventDefault();
    var startX = (e.touches ? e.touches[0].clientX : e.clientX);
    var startCenter = state.centerValue;
    var width = strip.clientWidth || 1;
    strip.classList.add('dragging');

    function move(ev) {
      var x = (ev.touches ? ev.touches[0].clientX : ev.clientX);
      var dx = startX - x;
      var delta = (dx / width) * state.visibleSpan;
      state.centerValue = clampCenter(startCenter + delta);
      updateView(false);
    }
    function up() {
      strip.classList.remove('dragging');
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
      window.removeEventListener('touchmove', move);
      window.removeEventListener('touchend', up);
    }
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    window.addEventListener('touchmove', move, { passive: false });
    window.addEventListener('touchend', up);
  }

  /* ============ ХЕЛПЕРЫ ============ */

  function pickTick(span, arr) {
    for (var i = 0; i < arr.length; i++) {
      if (span / arr[i] <= 8) return arr[i];
    }
    return arr[arr.length - 1];
  }

  function rangeBounds() {
    if (viewMode === 'world') return { min: -7000, max: 2026 };
    return { min: 0, max: R.daysBetween(campaign.startDate, campaign.endDate) };
  }

  function clampCenter(v) {
    var b = rangeBounds();
    // Разрешаем центру доходить до самых краёв
    return Math.max(b.min, Math.min(b.max, v));
}

  function markerBg(colors) {
    if (colors.length === 1) return 'background:' + colors[0] + ';';
    var n = colors.length;
    var step = 100 / n;
    var stops = colors.map(function (c, i) {
      return c + ' ' + Math.round(step * i) + '% ' + Math.round(step * (i + 1)) + '%';
    });
    return 'background: linear-gradient(to right, ' + stops.join(', ') + ');';
  }

  function hexA(hex, a) {
    var m = /^#([a-f0-9]{2})([a-f0-9]{2})([a-f0-9]{2})$/i.exec(hex);
    if (!m) return hex;
    var r = parseInt(m[1], 16), g = parseInt(m[2], 16), b = parseInt(m[3], 16);
    return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
  }

  /* ============ ДИАЛОГ СОБЫТИЯ (create / edit) ============ */

  function openWorldEventDialog(editId) {
    var editing = null;
    if (editId) editing = world.events.find(function (e) { return e.id === editId; });
    var presetYear = editing ? editing.year : Math.round(state.centerValue);

    M.openModal({
      title: editing ? 'Редактирование события' : 'Новое событие (мир)',
      content:
        '<div class="grid" style="gap:12px">' +
          '<div class="row row-2">' +
            '<label class="field"><span class="field-label">Год (минус = до н.э.)</span>' +
              '<input class="input" id="wev-year" type="number" value="' + presetYear + '"></label>' +
            '<label class="field"><span class="field-label">Категория</span>' +
              '<select class="input" id="wev-cat">' +
                R.CATEGORIES.map(function (c) {
                  var sel = editing && editing.category === c.id ? ' selected' : '';
                  return '<option value="' + c.id + '"' + sel + '>' + c.label + '</option>';
                }).join('') +
              '</select></label>' +
          '</div>' +
          '<label class="field"><span class="field-label">Заголовок</span>' +
            '<input class="input" id="wev-title" value="' + R.esc(editing ? editing.title : '') + '"></label>' +
          '<label class="field"><span class="field-label">Описание</span>' +
            '<textarea class="input" id="wev-desc" rows="5">' + R.esc(editing ? editing.description : '') + '</textarea></label>' +
          '<div style="display:flex;gap:8px;justify-content:flex-end">' +
            (editing ? '<button class="btn btn-danger" data-delete>Удалить</button>' : '') +
            '<button class="btn" data-cancel>Отмена</button>' +
            '<button class="btn btn-primary" data-save>' + (editing ? 'Сохранить' : 'Создать') + '</button>' +
          '</div>' +
        '</div>',
      onMount: function (body, close) {
        body.querySelector('[data-cancel]').addEventListener('click', close);
        body.querySelector('[data-save]').addEventListener('click', function () {
          var data = {
            year: Number(body.querySelector('#wev-year').value) || 0,
            category: body.querySelector('#wev-cat').value,
            title: body.querySelector('#wev-title').value.trim() || 'Без названия',
            description: body.querySelector('#wev-desc').value.trim()
          };
          if (editing) {
            Object.assign(editing, data);
          } else {
            world.events.push(Object.assign({ id: R.uid('wev') }, data));
          }
          saveWorld();
          close();
          updateWorld(false);
        });
        var del = body.querySelector('[data-delete]');
        if (del) del.addEventListener('click', function () {
          M.confirmDialog('Удалить событие «' + R.esc(editing.title) + '»?').then(function (ok) {
            if (!ok) return;
            world.events = world.events.filter(function (e) { return e.id !== editing.id; });
            saveWorld();
            close();
            updateWorld(false);
          });
        });
      }
    });
  }

  function openCampaignEventDialog(editId) {
    var editing = null;
    if (editId) editing = campaign.events.find(function (e) { return e.id === editId; });
    var presetDate = editing ? editing.date : R.addDays(campaign.startDate, Math.round(state.centerValue));

    M.openModal({
      title: editing ? 'Редактирование события' : 'Новое событие (кампания)',
      content:
        '<div class="grid" style="gap:12px">' +
          '<div class="row row-2">' +
            '<label class="field"><span class="field-label">Дата</span>' +
              '<input class="input" id="cev-date" type="date" value="' + presetDate + '"></label>' +
            '<label class="field"><span class="field-label">Категория</span>' +
              '<select class="input" id="cev-cat">' +
                R.CATEGORIES.map(function (c) {
                  var sel = editing && editing.category === c.id ? ' selected' : '';
                  return '<option value="' + c.id + '"' + sel + '>' + c.label + '</option>';
                }).join('') +
              '</select></label>' +
          '</div>' +
          '<label class="field"><span class="field-label">Заголовок</span>' +
            '<input class="input" id="cev-title" value="' + R.esc(editing ? editing.title : '') + '"></label>' +
          '<label class="field"><span class="field-label">Описание</span>' +
            '<textarea class="input" id="cev-desc" rows="5">' + R.esc(editing ? editing.description : '') + '</textarea></label>' +
          '<div style="display:flex;gap:8px;justify-content:flex-end">' +
            (editing ? '<button class="btn btn-danger" data-delete>Удалить</button>' : '') +
            '<button class="btn" data-cancel>Отмена</button>' +
            '<button class="btn btn-primary" data-save>' + (editing ? 'Сохранить' : 'Создать') + '</button>' +
          '</div>' +
        '</div>',
      onMount: function (body, close) {
        body.querySelector('[data-cancel]').addEventListener('click', close);
        body.querySelector('[data-save]').addEventListener('click', function () {
          var data = {
            date: body.querySelector('#cev-date').value,
            category: body.querySelector('#cev-cat').value,
            title: body.querySelector('#cev-title').value.trim() || 'Без названия',
            description: body.querySelector('#cev-desc').value.trim()
          };
          if (editing) {
            Object.assign(editing, data);
          } else {
            campaign.events.push(Object.assign({ id: R.uid('cev') }, data));
          }
          saveCampaign();
          close();
          updateCampaign(false);
        });
        var del = body.querySelector('[data-delete]');
        if (del) del.addEventListener('click', function () {
          M.confirmDialog('Удалить событие «' + R.esc(editing.title) + '»?').then(function (ok) {
            if (!ok) return;
            campaign.events = campaign.events.filter(function (e) { return e.id !== editing.id; });
            saveCampaign();
            close();
            updateCampaign(false);
          });
        });
      }
    });
  }

  return { render: render };
})();