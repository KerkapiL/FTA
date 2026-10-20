window.PK = window.PK || {};

PK.modal = (function () {
  function openModal(opts) {
    const root = document.getElementById('modal-root');
    root.innerHTML =
      '<div class="modal-backdrop' + (opts.sideContent ? ' has-side' : '') + '">' +
        (opts.sideContent ? '<aside class="modal-side"></aside>' : '') +
        '<div class="modal' + (opts.wide ? ' modal-wide' : '') + '" role="dialog" aria-modal="true">' +
          '<header class="modal-head">' +
            '<h2>' + (opts.title || '') + '</h2>' +
            '<button class="modal-close" type="button" title="Закрыть">✕</button>' +
          '</header>' +
          '<div class="modal-body"></div>' +
        '</div>' +
      '</div>';

    if (opts.sideContent) {
      const sideEl = root.querySelector('.modal-side');
      if (typeof opts.sideContent === 'string') sideEl.innerHTML = opts.sideContent;
      else if (opts.sideContent instanceof HTMLElement) sideEl.appendChild(opts.sideContent);
    }

    const body = root.querySelector('.modal-body');
    if (typeof opts.content === 'string') body.innerHTML = opts.content;
    else if (opts.content instanceof HTMLElement) body.appendChild(opts.content);

    function close() {
      root.innerHTML = '';
      document.removeEventListener('keydown', onKey);
    }
    function onKey(e) { if (e.key === 'Escape') close(); }

    root.querySelector('.modal-close').addEventListener('click', close);
    root.querySelector('.modal-backdrop').addEventListener('click', function (e) {
      if (e.target.classList.contains('modal-backdrop')) close();
    });
    document.addEventListener('keydown', onKey);

    if (opts.onMount) opts.onMount(body, close);
    return close;
  }

  function confirmDialog(message) {
    return new Promise(function (resolve) {
      openModal({
        title: 'Подтверждение',
        content:
          '<p style="margin:0 0 16px">' + message + '</p>' +
          '<div style="display:flex;gap:8px;justify-content:flex-end">' +
            '<button class="btn" data-no>Отмена</button>' +
            '<button class="btn btn-danger" data-yes>Да</button>' +
          '</div>',
        onMount: function (body, close) {
          body.querySelector('[data-no]').addEventListener('click', function () { close(); resolve(false); });
          body.querySelector('[data-yes]').addEventListener('click', function () { close(); resolve(true); });
        }
      });
    });
  }

  return { openModal: openModal, confirmDialog: confirmDialog };
})();