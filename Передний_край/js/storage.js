window.PK = window.PK || {};

PK.storage = (function () {
  const DB_NAME = 'peredniy-kray';
  const DB_VERSION = 3;

  const STORES = [
    'creatures', 'lore', 'quests', 'sessions',
    'timeline', 'timelines', 'rules', 'players', 'settings', 'combats'
  ];

  let dbPromise = null;

  function openDB() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise(function (resolve, reject) {
      if (!('indexedDB' in window)) {
        return reject(new Error('IndexedDB не поддерживается браузером'));
      }
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = function (e) {
        const db = e.target.result;
        for (const name of STORES) {
          if (!db.objectStoreNames.contains(name)) {
            db.createObjectStore(name, { keyPath: 'id' });
          }
        }
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
      req.onblocked = function () { reject(new Error('База заблокирована другим окном. Закрой все вкладки с приложением и попробуй снова.')); };
    });
    return dbPromise;
  }

  function getAll(store) {
    return openDB().then(function (db) {
      return new Promise(function (resolve, reject) {
        const tx = db.transaction(store, 'readonly');
        const req = tx.objectStore(store).getAll();
        req.onsuccess = function () { resolve(req.result || []); };
        req.onerror = function () { reject(req.error); };
      });
    });
  }

  function getOne(store, id) {
    return openDB().then(function (db) {
      return new Promise(function (resolve, reject) {
        const tx = db.transaction(store, 'readonly');
        const req = tx.objectStore(store).get(id);
        req.onsuccess = function () { resolve(req.result); };
        req.onerror = function () { reject(req.error); };
      });
    });
  }

  function put(store, obj) {
    return openDB().then(function (db) {
      return new Promise(function (resolve, reject) {
        const tx = db.transaction(store, 'readwrite');
        tx.objectStore(store).put(obj);
        tx.oncomplete = function () { resolve(obj); };
        tx.onerror = function () { reject(tx.error); };
      });
    });
  }

  function remove(store, id) {
    return openDB().then(function (db) {
      return new Promise(function (resolve, reject) {
        const tx = db.transaction(store, 'readwrite');
        tx.objectStore(store).delete(id);
        tx.oncomplete = function () { resolve(); };
        tx.onerror = function () { reject(tx.error); };
      });
    });
  }

  function exportAll() {
    const data = {};
    return STORES.reduce(function (p, s) {
      return p.then(function () {
        return getAll(s).then(function (items) { data[s] = items; });
      });
    }, Promise.resolve()).then(function () {
      return {
        app: 'peredniy-kray',
        version: 1,
        exportedAt: new Date().toISOString(),
        data: data
      };
    });
  }

  function importAll(payload) {
    if (!payload || payload.app !== 'peredniy-kray') {
      return Promise.reject(new Error('Это не файл "Передний край"'));
    }
    return openDB().then(function (db) {
      return STORES.reduce(function (p, s) {
        return p.then(function () {
          const items = (payload.data && payload.data[s]) || [];
          return new Promise(function (resolve, reject) {
            const tx = db.transaction(s, 'readwrite');
            const store = tx.objectStore(s);
            store.clear();
            for (const it of items) store.put(it);
            tx.oncomplete = resolve;
            tx.onerror = function () { reject(tx.error); };
          });
        });
      }, Promise.resolve());
    });
  }

  return {
    STORES: STORES,
    getAll: getAll, getOne: getOne, put: put, remove: remove,
    exportAll: exportAll, importAll: importAll
  };
})();