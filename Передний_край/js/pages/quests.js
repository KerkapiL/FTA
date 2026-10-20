window.PK = window.PK || {};
PK.pages = PK.pages || {};

PK.pages.quests = (function () {
  const U = PK.utils;
  const M = PK.modal;
  const S = PK.storage;
  const STORE = 'quests';

  const STATUSES = [
    { id: 'available', label: 'Не взят' },
    { id: 'active',    label: 'Активный' },
    { id: 'done',      label: 'Выполнен' },
    { id: 'failed',    label: 'Провален' },
    { id: 'skipped',   label: 'Пропущен' }
  ];
  const STATUS_ORDER = { active: 0, available: 1, done: 2, failed: 3, skipped: 4 };
  const NO_ASSIGNEE_STATUSES = { available: true, skipped: true };

  function statusLabel(id) {
    const s = STATUSES.find(function (x) { return x.id === id; });
    return s ? s.label : 'Не взят';
  }
  function nextStageState(s) {
    if (s === 'none') return 'done';
    if (s === 'done') return 'fail';
    return 'none';
  }
  function stageMark(s) {
    if (s === 'done') return '✓';
    if (s === 'fail') return '✕';
    return '';
  }

  let quests = [];
  let loaded = false;
  let filter = 'all';
  const els = { root: null };

  function isQuestPageActive() {
    return els.root && els.root === document.getElementById('page');
  }

  /* ---------- модель ---------- */

  function normalizeReward(r) {
    if (!r || typeof r !== 'object') return null;
    const kind = r.kind === 'image' ? 'image' : 'text';
    return {
      id: r.id || U.uuid(),
      kind: kind,
      text: kind === 'text' ? String(r.text || '') : '',
      image: kind === 'image' ? String(r.image || '') : ''
    };
  }

  function normalizeRewards(raw) {
    if (Array.isArray(raw.rewards)) {
      return raw.rewards.map(normalizeReward).filter(Boolean);
    }
    // миграция со старого поля reward
    if (raw.reward && (raw.reward.text || raw.reward.image)) {
      const r = normalizeReward(raw.reward);
      return r ? [r] : [];
    }
    return [];
  }

  function normalize(raw) {
    raw = raw || {};
    const st = STATUSES.some(function (s) { return s.id === raw.status; })
      ? raw.status : 'available';

    const stages = Array.isArray(raw.stages) ? raw.stages.map(function (s) {
      return {
        id: s.id || U.uuid(),
        text: String(s.text || ''),
        state: (s.state === 'done' || s.state === 'fail') ? s.state : 'none'
      };
    }) : [];

    return {
      id: raw.id || U.uuid(),
      title: String(raw.title || ''),
      body: String(raw.body || ''),
      status: st,
      giver: String(raw.giver || ''),
      giverNpcId: String(raw.giverNpcId || ''),
      assignee: String(raw.assignee || ''),
      assigneePlayerId: String(raw.assigneePlayerId || ''),
      stages: stages,
      rewards: normalizeRewards(raw),
      createdAt: raw.createdAt || new Date().toISOString(),
      updatedAt: raw.updatedAt || raw.createdAt || new Date().toISOString()
    };
  }

  /* ---------- загрузка / сохранение ---------- */

  function load() {
    return S.getAll(STORE).then(function (items) {
      quests = (items || []).map(normalize);
      sortQuests();
      loaded = true;
    });
  }
  function ensureLoaded() {
    return loaded ? Promise.resolve() : load();
  }
  function sortQuests() {
    quests.sort(function (a, b) {
      const oa = STATUS_ORDER[a.status] != null ? STATUS_ORDER[a.status] : 99;
      const ob = STATUS_ORDER[b.status] != null ? STATUS_ORDER[b.status] : 99;
      if (oa !== ob) return oa - ob;
      return (b.createdAt || '').localeCompare(a.createdAt || '');
    });
  }
  function saveOne(q) { return S.put(STORE, q); }
  function removeOne(id) { return S.remove(STORE, id); }

  /* ---------- рендер ---------- */

  function render(root) {
    els.root = root;
    return ensureLoaded().then(paint);
  }

  function paint() {
    if (!els.root) return;

    const counts = { all: quests.length };
    STATUSES.forEach(function (s) { counts[s.id] = 0; });
    quests.forEach(function (q) { counts[q.status] = (counts[q.status] || 0) + 1; });

    els.root.innerHTML =
      '<div class="page-toolbar">' +
        '<div class="quests-filters" id="quests-filters">' +
          filterBtn('all', 'Все', counts.all) +
          STATUSES.map(function (s) {
            return filterBtn(s.id, s.label, counts[s.id] || 0);
          }).join('') +
        '</div>' +
        '<div class="spacer"></div>' +
        '<button class="btn btn-primary" id="quest-add">+ Квест</button>' +
      '</div>' +
      '<div class="quests-list" id="quests-list"></div>';

    els.root.querySelector('#quest-add').addEventListener('click', function () {
      openDialog(null);
    });
    els.root.querySelectorAll('.quests-filter').forEach(function (b) {
      b.addEventListener('click', function () {
        filter = b.dataset.filter;
        els.root.querySelectorAll('.quests-filter').forEach(function (x) {
          x.classList.toggle('active', x === b);
        });
        paintList();
      });
    });

    paintList();
  }

  function filterBtn(id, label, count) {
    const active = filter === id ? ' active' : '';
    return '<button type="button" class="quests-filter' + active +
             '" data-filter="' + id + '">' + label +
             '<span class="cnt">' + count + '</span></button>';
  }

  function paintList() {
    const list = els.root.querySelector('#quests-list');
    if (!list) return;

    const visible = filter === 'all'
      ? quests
      : quests.filter(function (q) { return q.status === filter; });

    if (!visible.length) {
      list.innerHTML = '<p class="empty" style="grid-column:1/-1">' +
        (quests.length ? 'В этом фильтре пусто.' : 'Пока нет квестов. Нажми «+ Квест».') +
      '</p>';
      return;
    }

    list.innerHTML = visible.map(questCardHtml).join('');

    list.querySelectorAll('.quest-card').forEach(function (card) {
      card.addEventListener('click', function (e) {
        if (e.target.closest('.quest-del')) return;
        if (e.target.closest('.quest-stage')) return;
        if (e.target.closest('.quest-reward-img')) return;
        openDialog(card.dataset.id);
      });
    });

    list.querySelectorAll('.quest-stage').forEach(function (st) {
      st.addEventListener('click', function (e) {
        e.stopPropagation();
        const qid = st.dataset.qid;
        const sid = st.dataset.sid;
        const q = quests.find(function (x) { return x.id === qid; });
        if (!q) return;
        const s = (q.stages || []).find(function (x) { return x.id === sid; });
        if (!s) return;
        s.state = nextStageState(s.state);
        q.updatedAt = new Date().toISOString();
        saveOne(q).then(paintList);
      });
    });

    list.querySelectorAll('.quest-reward-img').forEach(function (img) {
      img.addEventListener('click', function (e) {
        e.stopPropagation();
        if (window.LoreRender && window.LoreRender.showImageModal) {
          window.LoreRender.showImageModal(img.src, { title: 'Награда' });
        } else {
          window.open(img.src, '_blank');
        }
      });
    });

    list.querySelectorAll('.quest-del').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        const id = btn.dataset.id;
        const q = quests.find(function (x) { return x.id === id; });
        if (!q) return;
        M.confirmDialog('Удалить квест «' + U.escapeHtml(q.title || 'без названия') + '»?')
          .then(function (ok) {
            if (!ok) return;
            removeOne(q.id).then(function () {
              quests = quests.filter(function (x) { return x.id !== q.id; });
              paint();
            });
          });
      });
    });
  }

  function rewardsCardHtml(q) {
    const rewards = q.rewards || [];
    if (!rewards.length) return '';
    const textR = rewards.filter(function (r) { return r.kind === 'text' && r.text; });
    const imgR = rewards.filter(function (r) { return r.kind === 'image' && r.image; });
    if (!textR.length && !imgR.length) return '';

    let html = '<div class="quest-rewards">' +
      '<div class="quest-reward-label">Награда</div>';

    textR.forEach(function (r) {
      html += '<div class="quest-reward-text">' + U.escapeHtml(r.text) + '</div>';
    });

    if (imgR.length) {
      html += '<div class="quest-reward-imgs">' +
        imgR.map(function (r) {
          return '<img class="quest-reward-img" src="' + r.image + '" alt="Награда">';
        }).join('') +
      '</div>';
    }

    html += '</div>';
    return html;
  }

  function questCardHtml(q) {
    const meta = [];
    if (q.giver) meta.push('<span><span class="quest-meta-label">Выдал:</span>' + U.escapeHtml(q.giver) + '</span>');
    if (q.assignee) meta.push('<span><span class="quest-meta-label">Взял:</span>' + U.escapeHtml(q.assignee) + '</span>');

    let stagesHtml = '';
    if (q.stages && q.stages.length) {
      stagesHtml = '<div class="quest-stages">' +
        q.stages.map(function (s) {
          return '<div class="quest-stage" data-state="' + s.state + '" ' +
                 'data-qid="' + U.escapeHtml(q.id) + '" data-sid="' + U.escapeHtml(s.id) + '" ' +
                 'title="Клик — отметить этап">' +
            '<span class="quest-stage-mark">' + stageMark(s.state) + '</span>' +
            '<span class="quest-stage-text">' + U.escapeHtml(s.text) + '</span>' +
          '</div>';
        }).join('') +
      '</div>';
    }

    return '' +
      '<div class="quest-card" data-id="' + U.escapeHtml(q.id) + '" data-status="' + q.status + '">' +
        '<div class="quest-head">' +
          '<h3 class="quest-title">' + U.escapeHtml(q.title || 'Без названия') + '</h3>' +
          '<span class="quest-badge">' + U.escapeHtml(statusLabel(q.status)) + '</span>' +
        '</div>' +
        (q.body ? '<div class="quest-body">' + U.escapeHtml(q.body) + '</div>' : '') +
        (meta.length ? '<div class="quest-meta">' + meta.join('') + '</div>' : '') +
        stagesHtml +
        rewardsCardHtml(q) +
        '<button class="quest-del" type="button" data-id="' + U.escapeHtml(q.id) + '" title="Удалить">✕</button>' +
      '</div>';
  }

  /* ---------- выбор НПС из Лора ---------- */

  function getAllNpcs() {
    return S.getAll('lore').then(function (items) {
      const npcs = [];
      (items || []).forEach(function (lore) {
        (lore.locations || []).forEach(function (loc) {
          (loc.npcs || []).forEach(function (npc) {
            if (npc && npc.id && npc.name) {
              npcs.push({ id: npc.id, name: npc.name, location: loc.name || '' });
            }
          });
        });
      });
      return npcs;
    });
  }

  function pickNpcFromLore(cb) {
    getAllNpcs().then(function (npcs) {
      if (!npcs.length) {
        M.openModal({
          title: 'НПС не найдены',
          content: '<p style="margin:0">В Лоре пока нет ни одного НПС. ' +
                   'Добавь локацию с НПС — и возвращайся.</p>'
        });
        return;
      }
      M.openModal({
        title: 'Выбрать НПС из Лора',
        content:
          '<div style="display:flex;flex-direction:column;gap:4px;max-height:60vh;overflow:auto">' +
            npcs.map(function (n) {
              return '<button type="button" class="btn" data-npc-id="' + U.escapeHtml(n.id) + '" ' +
                'style="justify-content:space-between;text-align:left">' +
                '<span>' + U.escapeHtml(n.name) + '</span>' +
                (n.location ? '<span class="muted" style="font-size:11px">' + U.escapeHtml(n.location) + '</span>' : '') +
              '</button>';
            }).join('') +
          '</div>',
        onMount: function (body, close) {
          body.querySelectorAll('[data-npc-id]').forEach(function (b) {
            b.addEventListener('click', function () {
              const npc = npcs.find(function (x) { return x.id === b.dataset.npcId; });
              if (npc) cb(npc);
              close();
            });
          });
        }
      });
    });
  }
  
  function pickPlayerFromList(cb) {
    S.getAll('players').then(function (items) {
      const list = (items || []).filter(function (p) { return p && p.id && p.name; });
      if (!list.length) {
        M.openModal({
          title: 'Игроков нет',
          content: '<p style="margin:0">Сначала создай игрока в разделе «Игроки».</p>'
        });
        return;
      }
      M.openModal({
        title: 'Выбрать игрока',
        content:
          '<div class="players-pick-grid">' +
            list.map(function (p) {
              const initial = U.escapeHtml((p.name || '?').slice(0, 1));
              const av = p.avatar ? ' style="background-image:url(' + p.avatar + ')"' : '';
              return '<button type="button" class="player-pick-card" data-pid="' + U.escapeHtml(p.id) + '">' +
                '<div class="player-pick-avatar"' + av + '>' + (p.avatar ? '' : initial) + '</div>' +
                '<div class="player-pick-name">' + U.escapeHtml(p.name) + '</div>' +
              '</button>';
            }).join('') +
          '</div>',
        onMount: function (body, close) {
          body.querySelectorAll('[data-pid]').forEach(function (b) {
            b.addEventListener('click', function () {
              const p = list.find(function (x) { return x.id === b.dataset.pid; });
              if (p) cb(p);
              close();
            });
          });
        }
      });
    });
  }

  function addQuestToPlayer(player, globalQuest) {
    if (!player || !globalQuest) return;
    player.quests = player.quests || [];
    if (player.quests.some(function (q) { return q.questId === globalQuest.id; })) return;
    const stages = Array.isArray(globalQuest.stages) ? globalQuest.stages.map(function (s) {
      return { id: s.id || U.uuid(), text: String(s.text || ''), state: 'none' };
    }) : [];
    player.quests.push({
      id: U.uuid(),
      questId: globalQuest.id,
      title: String(globalQuest.title || ''),
      status: 'active',
      stages: stages
    });
    player.updatedAt = new Date().toISOString();
    S.put('players', player);
  }

  /* ---------- модалка квеста ---------- */

  function openDialog(id, opts) {
    opts = opts || {};
    return ensureLoaded().then(function () {
      const editing = id ? quests.find(function (q) { return q.id === id; }) : null;
      const curStatus = editing ? editing.status : 'available';
      const rewardsDraft = (editing ? (editing.rewards || []) : []).map(function (r) {
        return Object.assign({}, r);
      });
      const stagesDraft = (editing ? (editing.stages || []) : []).map(function (s) {
        return Object.assign({}, s);
      });
      let giverNpcId = editing ? editing.giverNpcId : (opts.giverNpcId || '');
      let assigneePlayerId = editing ? (editing.assigneePlayerId || '') : '';
      const initialGiver = editing ? editing.giver : (opts.giver || '');
      const initialAssignee = editing ? editing.assignee : (opts.assignee || '');

      M.openModal({
        title: editing ? 'Редактирование квеста' : 'Новый квест',
        wide: true,
        content:
          '<div class="grid" style="gap:14px">' +

            '<label class="field"><span class="field-label">Название</span>' +
              '<input class="input" id="q-title" type="text" value="' +
                U.escapeHtml(editing ? editing.title : '') +
              '"></label>' +

            '<label class="field"><span class="field-label">Описание</span>' +
              '<textarea class="input" id="q-body" rows="5" placeholder="Сюжет, условия…">' +
                U.escapeHtml(editing ? editing.body : '') +
              '</textarea></label>' +

            '<div class="field">' +
              '<span class="field-label">Статус</span>' +
              '<div class="quest-status-picker">' +
                STATUSES.map(function (s) {
                  return '<label class="quest-status-opt" data-status="' + s.id + '">' +
                           '<input type="radio" name="q-status" value="' + s.id + '"' +
                             (curStatus === s.id ? ' checked' : '') + '>' +
                           '<span>' + s.label + '</span></label>';
                }).join('') +
              '</div>' +
            '</div>' +

            '<div class="row row-2">' +
              '<div class="field"><span class="field-label">Кто выдал ' +
                '<span class="muted" style="text-transform:none;letter-spacing:0;font-weight:400">— необязательно</span>' +
              '</span>' +
                '<div style="display:flex;gap:6px">' +
                  '<input class="input" id="q-giver" type="text" value="' +
                    U.escapeHtml(initialGiver) +
                  '" placeholder="Имя НПС или пусто">' +
                  '<button type="button" class="btn" id="q-giver-pick" title="Выбрать НПС из Лора">🔗</button>' +
                '</div>' +
              '</div>' +
              '<div class="field"><span class="field-label">Кому выдан</span>' +
                '<div style="display:flex;gap:6px">' +
                  '<input class="input" id="q-assignee" type="text" value="' +
                    U.escapeHtml(initialAssignee) +
                  '" placeholder="Имя игрока">' +
                  '<button type="button" class="btn" id="q-assignee-pick" title="Выбрать игрока">👤</button>' +
                '</div>' +
              '</div>' +
            '</div>' +

            '<div class="field">' +
              '<span class="field-label">Этапы ' +
                '<span class="muted" style="text-transform:none;letter-spacing:0;font-weight:400">' +
                '— клик по квадрату: ✓ / ✕ / пусто</span></span>' +
              '<div class="stage-list" id="stage-list"></div>' +
              '<button class="btn btn-small" type="button" id="stage-add" ' +
                'style="align-self:flex-start;margin-top:6px">+ Этап</button>' +
            '</div>' +

            '<div class="field">' +
              '<span class="field-label">Награды ' +
                '<span class="muted" style="text-transform:none;letter-spacing:0;font-weight:400">' +
                '— можно добавить несколько</span></span>' +
              '<div class="reward-list" id="reward-list"></div>' +
              '<button class="btn btn-small" type="button" id="reward-add" ' +
                'style="align-self:flex-start;margin-top:6px">+ Награда</button>' +
            '</div>' +

            '<div style="display:flex;gap:8px;justify-content:flex-end">' +
              (editing ? '<button class="btn btn-danger" type="button" data-delete>Удалить</button>' : '') +
              '<button class="btn" type="button" data-cancel>Отмена</button>' +
              '<button class="btn btn-primary" type="button" data-save>' +
                (editing ? 'Сохранить' : 'Создать') + '</button>' +
            '</div>' +
          '</div>',

        onMount: function (body, close) {
          const stageListEl = body.querySelector('#stage-list');
          const stageAddBtn = body.querySelector('#stage-add');
          const rewardListEl = body.querySelector('#reward-list');
          const rewardAddBtn = body.querySelector('#reward-add');
          const giverEl = body.querySelector('#q-giver');
          const assigneeEl = body.querySelector('#q-assignee');

          /* --- этапы --- */
          function paintStages() {
            if (!stagesDraft.length) {
              stageListEl.innerHTML =
                '<div class="muted" style="font-size:12px;font-style:italic;padding:4px 0">Этапов нет</div>';
              return;
            }
            stageListEl.innerHTML = stagesDraft.map(function (s, idx) {
              return '<div class="stage-row" data-state="' + s.state + '" data-idx="' + idx + '">' +
                '<button type="button" class="stage-mark-btn" data-state="' + s.state +
                  '" data-act="stage-toggle" title="Сменить состояние">' + stageMark(s.state) + '</button>' +
                '<input type="text" value="' + U.escapeHtml(s.text) +
                  '" data-act="stage-text" placeholder="Что нужно сделать">' +
                '<button type="button" class="btn btn-icon btn-danger" ' +
                  'data-act="stage-del" title="Удалить этап">✕</button>' +
              '</div>';
            }).join('');
          }

          function captureStageTexts() {
            stageListEl.querySelectorAll('.stage-row').forEach(function (row) {
              const idx = Number(row.dataset.idx);
              if (isNaN(idx) || !stagesDraft[idx]) return;
              const inp = row.querySelector('[data-act="stage-text"]');
              if (inp) stagesDraft[idx].text = inp.value;
            });
          }

          stageListEl.addEventListener('click', function (e) {
            const row = e.target.closest('.stage-row');
            if (!row) return;
            const idx = Number(row.dataset.idx);
            if (isNaN(idx) || !stagesDraft[idx]) return;

            if (e.target.closest('[data-act="stage-toggle"]')) {
              captureStageTexts();
              stagesDraft[idx].state = nextStageState(stagesDraft[idx].state);
              paintStages();
              return;
            }
            if (e.target.closest('[data-act="stage-del"]')) {
              captureStageTexts();
              stagesDraft.splice(idx, 1);
              paintStages();
            }
          });

          stageListEl.addEventListener('input', function (e) {
            if (!e.target.matches('[data-act="stage-text"]')) return;
            const row = e.target.closest('.stage-row');
            const idx = Number(row.dataset.idx);
            if (isNaN(idx) || !stagesDraft[idx]) return;
            stagesDraft[idx].text = e.target.value;
          });

          stageAddBtn.addEventListener('click', function () {
            captureStageTexts();
            stagesDraft.push({ id: U.uuid(), text: '', state: 'none' });
            paintStages();
            const rows = stageListEl.querySelectorAll('.stage-row');
            const last = rows[rows.length - 1];
            if (last) {
              const inp = last.querySelector('[data-act="stage-text"]');
              if (inp) inp.focus();
            }
          });

          paintStages();

          /* --- награды --- */
          function paintRewards() {
            if (!rewardsDraft.length) {
              rewardListEl.innerHTML =
                '<div class="muted" style="font-size:12px;font-style:italic;padding:4px 0">Наград нет</div>';
              return;
            }
            rewardListEl.innerHTML = rewardsDraft.map(function (r, idx) {
              const hasImg = r.kind === 'image' && !!r.image;
              let innerBody = '';
              if (r.kind === 'text') {
                innerBody =
                  '<textarea class="input" data-act="reward-text" rows="3" placeholder="Опиши награду">' +
                    U.escapeHtml(r.text) + '</textarea>';
              } else {
                innerBody =
                  '<div class="reward-img-wrap' + (hasImg ? '' : ' empty') + '" data-act="reward-img-wrap"' +
                    (hasImg ? ' style="background-image:url(\'' + r.image + '\')"' : '') + '>' +
                    (hasImg ? '' : '<span class="reward-img-hint">🖼 Нажми, чтобы выбрать картинку</span>') +
                  '</div>' +
                  '<input type="file" data-act="reward-file" accept="image/*" style="display:none">' +
                  (hasImg ? '<button type="button" class="btn btn-small" data-act="reward-img-clear" ' +
                            'style="margin-top:6px">Убрать картинку</button>' : '');
              }
              return '<div class="reward-block" data-idx="' + idx + '" data-kind="' + r.kind + '">' +
                '<div class="reward-block-head">' +
                  '<div class="reward-mode-row">' +
                    '<button type="button" class="reward-mode-btn' + (r.kind === 'text' ? ' active' : '') +
                      '" data-act="reward-mode" data-mode="text">Текст</button>' +
                    '<button type="button" class="reward-mode-btn' + (r.kind === 'image' ? ' active' : '') +
                      '" data-act="reward-mode" data-mode="image">Картинка</button>' +
                  '</div>' +
                  '<button type="button" class="btn btn-icon btn-danger" data-act="reward-del" ' +
                    'title="Удалить награду">✕</button>' +
                '</div>' +
                '<div class="reward-block-body">' + innerBody + '</div>' +
              '</div>';
            }).join('');
          }

          function captureRewardTexts() {
            rewardListEl.querySelectorAll('.reward-block').forEach(function (block) {
              const idx = Number(block.dataset.idx);
              if (isNaN(idx) || !rewardsDraft[idx]) return;
              const ta = block.querySelector('[data-act="reward-text"]');
              if (ta) rewardsDraft[idx].text = ta.value;
            });
          }

          rewardListEl.addEventListener('click', function (e) {
            const block = e.target.closest('.reward-block');
            if (!block) return;
            const idx = Number(block.dataset.idx);
            if (isNaN(idx) || !rewardsDraft[idx]) return;
            const r = rewardsDraft[idx];

            const modeBtn = e.target.closest('[data-act="reward-mode"]');
            if (modeBtn) {
              const newMode = modeBtn.dataset.mode;
              if (newMode === r.kind) return;
              captureRewardTexts();
              r.kind = newMode;
              paintRewards();
              return;
            }
            if (e.target.closest('[data-act="reward-del"]')) {
              captureRewardTexts();
              rewardsDraft.splice(idx, 1);
              paintRewards();
              return;
            }
            if (e.target.closest('[data-act="reward-img-clear"]')) {
              r.image = '';
              paintRewards();
              return;
            }
            if (e.target.closest('[data-act="reward-img-wrap"]')) {
              const fileInput = block.querySelector('[data-act="reward-file"]');
              if (fileInput) fileInput.click();
              return;
            }
          });

          rewardListEl.addEventListener('input', function (e) {
            const block = e.target.closest('.reward-block');
            if (!block) return;
            const idx = Number(block.dataset.idx);
            if (isNaN(idx) || !rewardsDraft[idx]) return;
            if (e.target.matches('[data-act="reward-text"]')) {
              rewardsDraft[idx].text = e.target.value;
            }
          });

          rewardListEl.addEventListener('change', function (e) {
            const block = e.target.closest('.reward-block');
            if (!block) return;
            const idx = Number(block.dataset.idx);
            if (isNaN(idx) || !rewardsDraft[idx]) return;
            if (e.target.matches('[data-act="reward-file"]')) {
              const f = e.target.files && e.target.files[0];
              if (!f) return;
              U.compressImage(f, 900, 0.85).then(function (dataUrl) {
                rewardsDraft[idx].image = dataUrl;
                paintRewards();
              }).catch(function (err) {
                alert('Не удалось загрузить картинку: ' + err.message);
              });
            }
          });

          rewardAddBtn.addEventListener('click', function () {
            captureRewardTexts();
            rewardsDraft.push({ id: U.uuid(), kind: 'text', text: '', image: '' });
            paintRewards();
            const blocks = rewardListEl.querySelectorAll('.reward-block');
            const last = blocks[blocks.length - 1];
            if (last) {
              const ta = last.querySelector('[data-act="reward-text"]');
              if (ta) ta.focus();
            }
          });

          paintRewards();

          /* --- статус/назначение --- */
          function updateAssigneeState() {
            const cur = body.querySelector('input[name="q-status"]:checked').value;
            const dis = !!NO_ASSIGNEE_STATUSES[cur];
            assigneeEl.disabled = dis;
            if (dis) assigneeEl.value = '';
          }
          body.querySelectorAll('input[name="q-status"]').forEach(function (r) {
            r.addEventListener('change', updateAssigneeState);
          });
          updateAssigneeState();

          /* --- выбор НПС из Лора --- */
          body.querySelector('#q-giver-pick').addEventListener('click', function () {
            pickNpcFromLore(function (npc) {
              giverEl.value = npc.name;
              giverNpcId = npc.id;
            });
          });

          // если поле имени опустошили руками — привязку сбрасываем
          giverEl.addEventListener('input', function () {
            if (!giverEl.value.trim()) giverNpcId = '';
          });

          /* --- выбор игрока (кому выдан) --- */
          body.querySelector('#q-assignee-pick').addEventListener('click', function () {
            pickPlayerFromList(function (player) {
              assigneeEl.value = player.name || '';
              assigneePlayerId = player.id;
              // сразу добавляем квест игроку, если его ещё нет
              if (player.quests && !player.quests.some(function (q) {
                return q.questId === (editing ? editing.id : '');
              })) {
                // если редактируем существующий квест — добавляем сразу
                if (editing) addQuestToPlayer(player, editing);
              }
            });
          });

          assigneeEl.addEventListener('input', function () {
            if (!assigneeEl.value.trim()) assigneePlayerId = '';
          });

          /* --- отмена --- */
          body.querySelector('[data-cancel]').addEventListener('click', close);

          /* --- сохранение --- */
          body.querySelector('[data-save]').addEventListener('click', function () {
            const titleEl = body.querySelector('#q-title');
            const title = titleEl.value.trim();
            if (!title) { titleEl.focus(); return; }

            const statusRadio = body.querySelector('input[name="q-status"]:checked');
            const statusVal = statusRadio ? statusRadio.value : 'available';

            captureStageTexts();
            captureRewardTexts();

            const cleanStages = stagesDraft
              .filter(function (s) { return (s.text || '').trim() || s.state !== 'none'; })
              .map(function (s) {
                return { id: s.id, text: (s.text || '').trim(), state: s.state };
              });

            const cleanRewards = rewardsDraft
              .filter(function (r) {
                return r.kind === 'text' ? (r.text || '').trim() : !!r.image;
              })
              .map(function (r) {
                return r.kind === 'text'
                  ? { id: r.id, kind: 'text', text: (r.text || '').trim(), image: '' }
                  : { id: r.id, kind: 'image', text: '', image: r.image };
              });

            const data = {
              title: title,
              body: body.querySelector('#q-body').value,
              status: statusVal,
              giver: giverEl.value.trim(),
              giverNpcId: giverNpcId || '',
              assignee: assigneeEl.disabled ? '' : assigneeEl.value.trim(),
              assigneePlayerId: assigneeEl.disabled ? '' : (assigneePlayerId || ''),
              stages: cleanStages,
              rewards: cleanRewards
            };

          if (editing) {
            Object.assign(editing, data);
            editing.updatedAt = new Date().toISOString();
            saveOne(editing).then(function () {
              // если выбран игрок — добавляем ему квест
              if (editing.assigneePlayerId) {
                S.getOne('players', editing.assigneePlayerId).then(function (pl) {
                  if (pl) addQuestToPlayer(pl, editing);
                });
              }
              sortQuests();
              close();
              if (isQuestPageActive()) paint();
              if (opts.onSave) opts.onSave(editing);
            });
          } else {
            const q = normalize(Object.assign({
              createdAt: new Date().toISOString()
            }, data));
            saveOne(q).then(function () {
              quests.unshift(q);
              // если выбран игрок — добавляем ему квест
              if (q.assigneePlayerId) {
                S.getOne('players', q.assigneePlayerId).then(function (pl) {
                  if (pl) addQuestToPlayer(pl, q);
                });
              }
              sortQuests();
              close();
              if (isQuestPageActive()) paint();
              if (opts.onSave) opts.onSave(q);
            });
          }
          });

          /* --- удаление --- */
          const del = body.querySelector('[data-delete]');
          if (del) del.addEventListener('click', function () {
            M.confirmDialog('Удалить квест «' + U.escapeHtml(editing.title || 'без названия') + '»?')
              .then(function (ok) {
                if (!ok) return;
                removeOne(editing.id).then(function () {
                  quests = quests.filter(function (x) { return x.id !== editing.id; });
                  close();
                  if (isQuestPageActive()) paint();
                  if (opts.onSave) opts.onSave(null);
                });
              });
          });
        }
      });
    });
  }

  /* ---------- модалка «квесты НПС» (для Лора) ---------- */

  function openNpcQuests(npc) {
    if (!npc || !npc.id) return Promise.resolve();
    return ensureLoaded().then(function () {
      let mode = 'list'; // 'list' | 'pick'

      function renderModal(body, close) {
        if (mode === 'list') {
          const own = quests.filter(function (q) { return q.giverNpcId === npc.id; });
          own.sort(function (a, b) {
            const oa = STATUS_ORDER[a.status] != null ? STATUS_ORDER[a.status] : 99;
            const ob = STATUS_ORDER[b.status] != null ? STATUS_ORDER[b.status] : 99;
            return oa - ob;
          });

          const listHtml = own.length
            ? own.map(function (q) {
                return '<div class="npc-quest-item-row">' +
                  '<button type="button" class="btn npc-quest-item" data-quest-id="' +
                    U.escapeHtml(q.id) + '">' +
                    '<span class="npc-quest-item-title">' + U.escapeHtml(q.title || 'Без названия') + '</span>' +
                    '<span class="npc-quest-item-status muted">' + U.escapeHtml(statusLabel(q.status)) + '</span>' +
                  '</button>' +
                  '<button type="button" class="btn btn-icon npc-quest-give" data-give-id="' +
                    U.escapeHtml(q.id) + '" title="Выдать игроку">👤</button>' +
                '</div>';
              }).join('')
            : '<p class="empty" style="padding:16px 0">У этого НПС пока нет квестов.</p>';

          body.innerHTML =
            '<div style="display:flex;flex-direction:column;gap:10px">' +
              '<div class="muted" style="font-size:12px">Квесты от ' +
                U.escapeHtml(npc.name) + '</div>' +
              '<div class="npc-quest-list">' + listHtml + '</div>' +
              '<div style="display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap">' +
                '<button class="btn" id="npc-attach-quest">📎 Прикрепить существующий</button>' +
                '<button class="btn btn-primary" id="npc-new-quest">+ Новый квест от ' +
                  U.escapeHtml(npc.name) + '</button>' +
              '</div>' +
            '</div>';

          body.querySelectorAll('[data-quest-id]').forEach(function (b) {
            b.addEventListener('click', function () {
              const qid = b.dataset.questId;
              close();
              openDialog(qid);
            });
          });
          body.querySelectorAll('[data-give-id]').forEach(function (b) {
            b.addEventListener('click', function (e) {
              e.stopPropagation();
              const qid = b.dataset.giveId;
              const q = quests.find(function (x) { return x.id === qid; });
              if (!q) return;
              if (PK.pages.players && typeof PK.pages.players.assignQuestToPlayer === 'function') {
                PK.pages.players.assignQuestToPlayer(q);
              } else {
                alert('Модуль игроков не загружен.');
              }
            });
          });

          body.querySelector('#npc-new-quest').addEventListener('click', function () {
            close();
            openDialog(null, { giver: npc.name, giverNpcId: npc.id });
          });

          body.querySelector('#npc-attach-quest').addEventListener('click', function () {
            mode = 'pick';
            renderModal(body, close);
          });
          return;
        }

        // mode === 'pick'
        const candidates = quests.slice().sort(function (a, b) {
          const oa = STATUS_ORDER[a.status] != null ? STATUS_ORDER[a.status] : 99;
          const ob = STATUS_ORDER[b.status] != null ? STATUS_ORDER[b.status] : 99;
          return oa - ob;
        });

        const pickHtml = candidates.length
          ? candidates.map(function (q) {
              const isOwn = q.giverNpcId === npc.id;
              let right = '';
              if (isOwn) right = 'уже у этого НПС';
              else if (q.giver) right = 'выдаёт: ' + q.giver;
              else right = 'без выдающего';
              return '<button type="button" class="btn npc-quest-item" data-pick-id="' +
                U.escapeHtml(q.id) + '"' + (isOwn ? ' disabled style="opacity:0.5"' : '') + '>' +
                '<span class="npc-quest-item-title">' + U.escapeHtml(q.title || 'Без названия') + '</span>' +
                '<span class="npc-quest-item-status muted">' + U.escapeHtml(right) + '</span>' +
              '</button>';
            }).join('')
          : '<p class="empty" style="padding:16px 0">Квестов пока нет. Создай хотя бы один на странице «Квесты».</p>';

        body.innerHTML =
          '<div style="display:flex;flex-direction:column;gap:10px">' +
            '<div class="muted" style="font-size:12px">Выбрать квест, который будет выдавать ' +
              U.escapeHtml(npc.name) + '</div>' +
            '<div class="npc-quest-list">' + pickHtml + '</div>' +
            '<div style="display:flex;gap:8px;justify-content:flex-end">' +
              '<button class="btn" id="npc-pick-cancel">← Назад</button>' +
            '</div>' +
          '</div>';

        body.querySelector('#npc-pick-cancel').addEventListener('click', function () {
          mode = 'list';
          renderModal(body, close);
        });

        body.querySelectorAll('[data-pick-id]').forEach(function (b) {
          if (b.disabled) return;
          b.addEventListener('click', function () {
            const qid = b.dataset.pickId;
            const q = quests.find(function (x) { return x.id === qid; });
            if (!q) return;
            q.giverNpcId = npc.id;
            if (!q.giver) q.giver = npc.name;
            q.updatedAt = new Date().toISOString();
            saveOne(q).then(function () {
              mode = 'list';
              renderModal(body, close);
            });
          });
        });
      }

      M.openModal({
        title: '📜 Квесты: ' + npc.name,
        wide: true,
        content: '',
        onMount: renderModal
      });
    });
  }

  return {
    render: render,
    openDialog: openDialog,
    openNpcQuests: openNpcQuests
  };
})();