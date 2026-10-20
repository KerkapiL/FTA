/* ============================================================
   LORE RENDER — рендер редактора города (локации/НПС/предметы)
   ============================================================ */
(function () {
  'use strict';

  function esc(s) {
    if (window.U && U.escapeHtml) return U.escapeHtml(s == null ? '' : s);
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function uid(prefix) {
    return (prefix || 'id') + '-' + Math.random().toString(36).slice(2, 10);
  }

  function counts(loc) {
    var n = (loc.npcs || []).length;
    var i = (loc.items || []).length;
    var g = (loc.gallery || []).length;
    var parts = [];
    if (n) parts.push(n + ' НПС');
    if (i) parts.push(i + ' предм.');
    if (g) parts.push(g + ' фото');
    return parts.join(' · ') || 'пусто';
  }

  /* ---------- НПС ---------- */
  function renderNpc(npc, locId) {
    npc = npc || {};
    return '' +
      '<div class="npc-row" data-npc-id="' + esc(npc.id || '') + '" data-loc-id="' + esc(locId) + '">' +
        '<input type="text" data-npc-field="name" value="' + esc(npc.name || '') + '" placeholder="Имя НПС">' +
        '<textarea data-npc-field="description" placeholder="Описание">' + esc(npc.description || '') + '</textarea>' +
        '<button class="btn btn-icon npc-quests-btn" type="button" data-act="npc-quests" title="Квесты НПС">📜</button>' +
        '<button class="btn btn-icon btn-danger" type="button" data-act="npc-del" title="Удалить">✕</button>' +
      '</div>';
  }

  /* ---------- ПРЕДМЕТ ---------- */
  function renderItem(item, locId) {
    item = item || {};
    var kind = item.kind === 'image' ? 'image' : 'text';
    var id = item.id || '';

    if (kind === 'image') {
      var hasImg = !!item.image;
      var bg = hasImg ? ' style="background-image:url(\'' + item.image + '\')"' : '';
      return '' +
        '<div class="item-row item-row-img" data-item-id="' + esc(id) + '" data-loc-id="' + esc(locId) + '" data-kind="image">' +
          '<div class="item-preview' + (hasImg ? '' : ' empty') + '" data-act="' + (hasImg ? 'item-open' : 'item-img') + '"' + bg + '>' +
            (hasImg ? '' : '<span class="item-preview-hint">🖼 Нажми, чтобы выбрать картинку</span>') +
            (hasImg ? '<button class="item-preview-btn edit" type="button" data-act="item-img" title="Заменить">✎</button>' : '') +
            '<button class="item-preview-btn give" type="button" data-act="item-give" title="Выдать игроку">+</button>' +
            '<button class="item-preview-btn del" type="button" data-act="item-del" title="Удалить">✕</button>' +
          '</div>' +
        '</div>';
    }

    return '' +
      '<div class="item-row item-row-text" data-item-id="' + esc(id) + '" data-loc-id="' + esc(locId) + '" data-kind="text">' +
        '<div class="item-row-head">' +
          '<input class="item-name-input" type="text" data-item-field="name" value="' + esc(item.name || '') + '" placeholder="Название предмета">' +
          '<button class="item-give-btn" type="button" data-act="item-give" title="Выдать игроку">+</button>' +
          '<button class="item-del-btn" type="button" data-act="item-del" title="Удалить">✕</button>' +
        '</div>' +
        '<textarea data-item-field="description" placeholder="Описание">' + esc(item.description || '') + '</textarea>' +
      '</div>';
  }

  /* ---------- ГАЛЕРЕЯ ---------- */
  function renderGalleryCell(img) {
    img = img || {};
    var hasImg = !!img.image;
    return '' +
      '<div class="gallery-cell' + (hasImg ? '' : ' add') + '" data-img-id="' + esc(img.id || '') + '"' +
           (hasImg ? ' style="background-image:url(\'' + img.image + '\')"' : '') +
           ' data-act="gallery-img">' +
        (hasImg ? '' : '+') +
        (hasImg ? '<button class="gallery-edit" type="button" data-act="gallery-replace" title="Заменить">✎</button>' : '') +
        (hasImg ? '<button class="gallery-x" type="button" data-act="gallery-del" title="Удалить">✕</button>' : '') +
      '</div>';
  }

  /* ---------- ТЕЛО ЛОКАЦИИ ---------- */
  function renderLocationBody(loc) {
    loc = loc || {};
    var locId = loc.id || '';

    var npcHtml = (loc.npcs || []).map(function (n) { return renderNpc(n, locId); }).join('');
    if (!npcHtml) npcHtml = '<div class="sub-sec-empty">Пока пусто</div>';

    var itemHtml = (loc.items || []).map(function (i) { return renderItem(i, locId); }).join('');
    if (!itemHtml) itemHtml = '<div class="sub-sec-empty">Пока пусто</div>';

    var galHtml = (loc.gallery || []).map(renderGalleryCell).join('');
    galHtml += '<div class="gallery-cell add" data-act="gallery-add" title="Добавить фото">+</div>';

    return '' +
      '<textarea class="loc-desc" data-loc-field="description" placeholder="Описание локации">' + esc(loc.description || '') + '</textarea>' +

      '<div class="sub-sec">' +
        '<div class="sub-sec-head">🧙 НПС <span class="spacer"></span>' +
          '<button class="btn btn-small" type="button" data-act="npc-add">+ НПС</button>' +
        '</div>' +
        '<div class="sub-sec-body" data-list="npcs">' + npcHtml + '</div>' +
      '</div>' +

      '<div class="sub-sec">' +
        '<div class="sub-sec-head">🎒 Предметы <span class="spacer"></span>' +
          '<button class="btn btn-small" type="button" data-act="item-add">+ Предмет</button>' +
        '</div>' +
        '<div class="sub-sec-body" data-list="items">' + itemHtml + '</div>' +
      '</div>' +

      '<div class="sub-sec">' +
        '<div class="sub-sec-head">📝 Заметки</div>' +
        '<div class="sub-sec-body">' +
          '<textarea class="notes-area" data-loc-field="notes" placeholder="Свободный текст: слухи, атмосфера, сюжетные заметки…">' + esc(loc.notes || '') + '</textarea>' +
        '</div>' +
      '</div>' +

      '<div class="sub-sec">' +
        '<div class="sub-sec-head">🖼 Галерея</div>' +
        '<div class="sub-sec-body">' +
          '<div class="gallery-grid" data-list="gallery">' + galHtml + '</div>' +
        '</div>' +
      '</div>';
  }

  /* ---------- ЛОКАЦИЯ ---------- */
  function renderLocation(loc, index) {
    loc = loc || {};
    var isOpen = !!loc._open;
    return '' +
      '<div class="loc-item' + (isOpen ? ' open' : '') + '" data-loc-id="' + esc(loc.id || '') + '">' +
        '<div class="loc-head" data-act="loc-toggle">' +
          '<span class="loc-arrow" data-act="loc-toggle">▶</span>' +
          '<input class="loc-title-input" type="text" data-loc-field="name" value="' + esc(loc.name || ('Локация ' + (index + 1))) + '" placeholder="Название локации">' +
          '<span class="loc-meta">' + esc(counts(loc)) + '</span>' +
          '<button class="btn btn-icon btn-danger" type="button" data-act="loc-del" title="Удалить локацию">✕</button>' +
        '</div>' +
        '<div class="loc-body">' + renderLocationBody(loc) + '</div>' +
      '</div>';
  }

  function renderLocations(locations) {
    locations = locations || [];
    if (!locations.length) {
      return '<div class="loc-empty">Пока нет локаций. Нажми «+ Локация».</div>';
    }
    return locations.map(renderLocation).join('');
  }

  /* ---------- МОДАЛКА ПРОСМОТРА КАРТИНКИ ---------- */
  function dataUrlExt(dataUrl) {
    var m = /^data:image\/([a-z0-9]+)/i.exec(dataUrl || '');
    return m ? m[1].toLowerCase() : 'png';
  }

  function downloadDataUrl(dataUrl, filename) {
    var a = document.createElement('a');
    a.href = dataUrl;
    a.download = filename || ('image.' + dataUrlExt(dataUrl));
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  function showImageModal(src, opts) {
    opts = opts || {};
    if (!src || !window.PK || !window.PK.modal) return;

    var content =
      '<div class="img-viewer">' +
        '<div class="img-viewer-canvas" id="iv-canvas">' +
          '<img id="iv-img" src="' + src + '" alt="" draggable="false">' +
        '</div>' +
        '<div class="img-viewer-actions">' +
          '<button class="btn btn-icon" id="iv-zoom-out" title="Уменьшить (−)">−</button>' +
          '<button class="btn btn-icon" id="iv-zoom-reset" title="Сбросить (0)">⟲</button>' +
          '<span class="img-viewer-zoom-pct" id="iv-zoom-pct">100%</span>' +
          '<button class="btn btn-icon" id="iv-zoom-in" title="Увеличить (+)">+</button>' +
          '<span class="img-viewer-divider"></span>' +
          '<button class="btn btn-primary" id="img-dl">⬇ Скачать</button>' +
        '</div>' +
      '</div>';

    PK.modal.openModal({
      title: opts.title || 'Изображение',
      wide: true,
      content: content,
      onMount: function (body) {
        var canvas = body.querySelector('#iv-canvas');
        var img = body.querySelector('#iv-img');
        var pct = body.querySelector('#iv-zoom-pct');
        var scale = 1, tx = 0, ty = 0;
        var MIN_S = 0.2, MAX_S = 15;
        var drag = false, sx = 0, sy = 0, stx = 0, sty = 0;

        function apply() {
          img.style.transform = 'translate(' + tx + 'px,' + ty + 'px) scale(' + scale + ')';
          pct.textContent = Math.round(scale * 100) + '%';
        }
        function zoomAt(factor, cx, cy) {
          var ns = Math.max(MIN_S, Math.min(MAX_S, scale * factor));
          if (ns === scale) return;
          var rect = canvas.getBoundingClientRect();
          var px = (cx != null ? cx : rect.width / 2) - rect.width / 2;
          var py = (cy != null ? cy : rect.height / 2) - rect.height / 2;
          tx = px - (px - tx) * (ns / scale);
          ty = py - (py - ty) * (ns / scale);
          scale = ns;
          apply();
        }
        function reset() { scale = 1; tx = 0; ty = 0; apply(); }

        body.querySelector('#iv-zoom-in').addEventListener('click', function () { zoomAt(1.25); });
        body.querySelector('#iv-zoom-out').addEventListener('click', function () { zoomAt(0.8); });
        body.querySelector('#iv-zoom-reset').addEventListener('click', reset);

        var dl = body.querySelector('#img-dl');
        if (dl) dl.addEventListener('click', function () {
          downloadDataUrl(src, opts.filename);
        });

        canvas.addEventListener('wheel', function (e) {
          e.preventDefault();
          var rect = canvas.getBoundingClientRect();
          zoomAt(e.deltaY < 0 ? 1.15 : 0.87, e.clientX - rect.left, e.clientY - rect.top);
        }, { passive: false });

        canvas.addEventListener('mousedown', function (e) {
          if (e.button !== 0) return;
          drag = true;
          sx = e.clientX; sy = e.clientY;
          stx = tx; sty = ty;
          canvas.classList.add('dragging');
        });
        window.addEventListener('mousemove', function (e) {
          if (!drag) return;
          tx = stx + (e.clientX - sx);
          ty = sty + (e.clientY - sy);
          apply();
        });
        window.addEventListener('mouseup', function () {
          if (!drag) return;
          drag = false;
          canvas.classList.remove('dragging');
        });

        canvas.addEventListener('dblclick', function (e) {
          e.preventDefault();
          if (Math.abs(scale - 1) > 0.01 || tx !== 0 || ty !== 0) { reset(); return; }
          var rect = canvas.getBoundingClientRect();
          zoomAt(2.2, e.clientX - rect.left, e.clientY - rect.top);
        });

        function onKey(e) {
          if (!document.body.contains(canvas)) { window.removeEventListener('keydown', onKey); return; }
          if (e.key === '+' || e.key === '=') zoomAt(1.25);
          else if (e.key === '-' || e.key === '_') zoomAt(0.8);
          else if (e.key === '0') reset();
        }
        window.addEventListener('keydown', onKey);

        apply();
      }
    });
  }

  window.LoreRender = {
    uid: uid,
    esc: esc,
    renderNpc: renderNpc,
    renderItem: renderItem,
    renderGalleryCell: renderGalleryCell,
    renderLocation: renderLocation,
    renderLocations: renderLocations,
    renderLocationBody: renderLocationBody,
    counts: counts,
    showImageModal: showImageModal,
    downloadDataUrl: downloadDataUrl,
    dataUrlExt: dataUrlExt
  };
})();