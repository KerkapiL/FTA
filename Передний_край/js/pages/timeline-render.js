/* ============================================================
   TIMELINE RENDER — общие данные и утилиты для таймлайнов
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

  function uid(p) { return (p || 'id') + '-' + Math.random().toString(36).slice(2, 10); }

  var WORLD_ERAS = [
    { from: -7000, to: -6001, name: 'Эпоха Старейших богов',          color: '#b02020' },
    { from: -6000, to: -2001, name: 'Эпоха Старых богов',             color: '#d07020' },
    { from: -2000, to:    -1, name: 'Эпоха Прошлых поколений богов',  color: '#c0a020' },
    { from:     0, to:  2026, name: 'Эпоха Нынешних богов',           color: '#4a8f4a' }
  ];

  var CATEGORIES = [
    { id: 'military',   label: 'Военное',      color: '#c05050' },
    { id: 'political',  label: 'Политическое', color: '#4a75d0' },
    { id: 'cult',       label: 'Культовое',    color: '#8a4ad0' },
    { id: 'world',      label: 'Мировое',      color: '#c8a020' },
    { id: 'personal',   label: 'Личное',       color: '#c050a0' },
    { id: 'historical', label: 'Историческое', color: '#8a6a4a' }
  ];

  function catById(id) {
    for (var i = 0; i < CATEGORIES.length; i++) if (CATEGORIES[i].id === id) return CATEGORIES[i];
    return CATEGORIES[5];
  }

  function eraForYear(year) {
    for (var i = 0; i < WORLD_ERAS.length; i++) {
      var e = WORLD_ERAS[i];
      if (year >= e.from && year <= e.to) return e;
    }
    return WORLD_ERAS[WORLD_ERAS.length - 1];
  }

  function formatWorldDate(year) {
    year = Math.round(year);
    if (year < 0) return Math.abs(year) + ' до н.э.';
    if (year === 0) return '0';
    return year + ' н.э.';
  }

  var MONTHS_GEN = ['января','февраля','марта','апреля','мая','июня',
                    'июля','августа','сентября','октября','ноября','декабря'];
  var MONTHS_SHORT = ['янв','фев','мар','апр','май','июн',
                      'июл','авг','сен','окт','ноя','дек'];

  function formatCampaignDate(dateStr) {
    var d = new Date(dateStr + 'T00:00:00');
    if (isNaN(d.getTime())) return dateStr;
    return d.getDate() + ' ' + MONTHS_GEN[d.getMonth()] + ' ' + d.getFullYear();
  }

  function shortDate(dateStr, span) {
    var d = new Date(dateStr + 'T00:00:00');
    if (isNaN(d.getTime())) return dateStr;
    if (span > 200) return MONTHS_SHORT[d.getMonth()] + ' ' + d.getFullYear();
    return d.getDate() + ' ' + MONTHS_SHORT[d.getMonth()];
  }

  function seasonFor(month) {
    if (month >= 12 || month <= 2) return 'winter';
    if (month >= 3 && month <= 5) return 'spring';
    if (month >= 6 && month <= 8) return 'summer';
    return 'autumn';
  }
  function seasonLabel(s) {
    return ({ winter: 'Зима', spring: 'Весна', summer: 'Лето', autumn: 'Осень' })[s] || '';
  }

  function daysBetween(a, b) {
    var da = new Date(a + 'T00:00:00');
    var db = new Date(b + 'T00:00:00');
    return Math.round((db - da) / 86400000);
  }
  function addDays(dateStr, days) {
    var d = new Date(dateStr + 'T00:00:00');
    d.setDate(d.getDate() + days);
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var dd = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + dd;
  }

  function dataUrlExt(u) {
    var m = /^data:image\/([a-z0-9]+)/i.exec(u || '');
    return m ? m[1].toLowerCase() : 'png';
  }

  window.TLRender = {
    esc: esc,
    uid: uid,
    WORLD_ERAS: WORLD_ERAS,
    CATEGORIES: CATEGORIES,
    catById: catById,
    eraForYear: eraForYear,
    formatWorldDate: formatWorldDate,
    formatCampaignDate: formatCampaignDate,
    shortDate: shortDate,
    seasonFor: seasonFor,
    seasonLabel: seasonLabel,
    daysBetween: daysBetween,
    addDays: addDays,
    dataUrlExt: dataUrlExt
  };
})();