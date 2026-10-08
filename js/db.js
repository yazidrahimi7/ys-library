/*
  ============================================================
  DB — saves links and screenshots in the browser (IndexedDB).
  ============================================================

  Each saved item looks like:
  {
    id:          "k3j2h1",          // unique id
    url:         "https://...",
    title:       "Stripe",
    description: "Clean payments landing page",
    category:    "web",             // matches an `id` in config.js
    image:       Blob | null,       // the screenshot file
    createdAt:   1728370000000      // timestamp (ms)
  }

  Data lives in this browser only. Use Export / Import in the app
  to back it up or move it to another computer.
*/

const DB = (() => {
  const DB_NAME = "library";
  const STORE = "items";
  let dbPromise = null;

  function open() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        req.result.createObjectStore(STORE, { keyPath: "id" });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return dbPromise;
  }

  // Runs one request inside a transaction and resolves with its result.
  async function run(mode, fn) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const req = fn(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(req ? req.result : undefined);
      tx.onerror = () => reject(tx.error);
    });
  }

  return {
    getAll: () => run("readonly", (s) => s.getAll()),
    save: (item) => run("readwrite", (s) => s.put(item)),
    remove: (id) => run("readwrite", (s) => s.delete(id)),
    clear: () => run("readwrite", (s) => s.clear()),
  };
})();
