export interface StorageService {
  get<T>(key: string): T | null;
  set<T>(key: string, value: T): void;
  remove(key: string): void;
  clear(): void;
}

class BrowserLocalStorageService implements StorageService {
  get<T>(key: string): T | null {
    if (typeof window === "undefined") {
      return null;
    }

    const raw = window.localStorage.getItem(key);
    if (raw === null) {
      return null;
    }

    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  set<T>(key: string, value: T): void {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(key, JSON.stringify(value));
  }

  remove(key: string): void {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.removeItem(key);
  }

  clear(): void {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.clear();
  }
}

export const localStorageService: StorageService = new BrowserLocalStorageService();
