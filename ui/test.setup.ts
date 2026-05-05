function createMemoryStorage(): Storage {
  const entries = new Map<string, string>();
  return {
    get length() {
      return entries.size;
    },
    clear() {
      entries.clear();
    },
    getItem(key: string) {
      return entries.has(key) ? entries.get(key)! : null;
    },
    key(index: number) {
      return Array.from(entries.keys())[index] ?? null;
    },
    removeItem(key: string) {
      entries.delete(key);
    },
    setItem(key: string, value: string) {
      entries.set(key, String(value));
    },
  };
}

function installLocalStorage(target: typeof globalThis | Window, storage: Storage) {
  Object.defineProperty(target, "localStorage", {
    value: storage,
    configurable: true,
  });
}

const currentStorage = globalThis.localStorage as Storage | undefined;
if (!currentStorage || typeof currentStorage.clear !== "function") {
  const storage = createMemoryStorage();
  installLocalStorage(globalThis, storage);
  if (typeof window !== "undefined") {
    installLocalStorage(window, storage);
  }
}
