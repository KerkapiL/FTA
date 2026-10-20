window.PK = window.PK || {};

PK.utils = (function () {
  function uuid() {
    return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 9);
  }

  function escapeHtml(s) {
    if (s == null) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function mod(score) {
    const m = Math.floor((Number(score || 10) - 10) / 2);
    return (m >= 0 ? '+' : '') + m;
  }

  function modNumber(score) {
    return Math.floor((Number(score || 10) - 10) / 2);
  }

  function download(filename, text) {
    const blob = new Blob([text], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function debounce(fn, ms) {
    ms = ms || 300;
    let t = null;
    return function () {
      const args = arguments, ctx = this;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(ctx, args); }, ms);
    };
  }

  // Простой рендер текста: **жирный**, пустая строка = новый абзац, \n внутри абзаца = <br>.
  function renderRichText(text) {
    if (!text) return '';
    let safe = escapeHtml(text);
    safe = safe.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    const paras = safe.split(/\n\s*\n/).map(function (p) {
      return '<p>' + p.replace(/\n/g, '<br>') + '</p>';
    }).join('');
    return paras;
  }

  // Сжать картинку до max по длинной стороне, вернуть dataURL.
  function compressImage(file, maxSize, quality) {
    maxSize = maxSize || 800;
    quality = quality || 0.85;
    return new Promise(function (resolve, reject) {
      const reader = new FileReader();
      reader.onerror = function () { reject(new Error('Не удалось прочитать файл')); };
      reader.onload = function (e) {
        const img = new Image();
        img.onerror = function () { reject(new Error('Не картинка')); };
        img.onload = function () {
          let w = img.naturalWidth, h = img.naturalHeight;
          if (w > maxSize || h > maxSize) {
            if (w >= h) { h = Math.round(h * maxSize / w); w = maxSize; }
            else { w = Math.round(w * maxSize / h); h = maxSize; }
          }
          const canvas = document.createElement('canvas');
          canvas.width = w; canvas.height = h;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });
  }

  return {
    uuid: uuid,
    escapeHtml: escapeHtml,
    mod: mod,
    modNumber: modNumber,
    download: download,
    debounce: debounce,
    renderRichText: renderRichText,
    compressImage: compressImage
  };
})();