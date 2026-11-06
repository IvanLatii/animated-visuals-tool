// Автозбереження проєкту в IndexedDB браузера: після оновлення сторінки робота відновлюється.
// Файл проєкту (⌘S) лишається головним способом зберегти; це лише страховка. localStorage не годиться: 5 МБ мало для вбудованих зображень.
const DB = 'av-autosave', STORE = 'kv', KEY = 'project';

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveAutosave(text: string): Promise<void> {
  const db = await open();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(text, KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function loadAutosave(): Promise<string | null> {
  const db = await open();
  const text = await new Promise<string | null>((resolve, reject) => {
    const req = db.transaction(STORE).objectStore(STORE).get(KEY);
    req.onsuccess = () => resolve(typeof req.result === 'string' ? req.result : null);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return text;
}
