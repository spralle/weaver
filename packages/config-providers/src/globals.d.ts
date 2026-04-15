// Ambient type declarations for browser/Node cross-environment globals
// config-providers operates in both browser and Node.js environments

// Timer functions (available in both environments)
declare function setTimeout(callback: () => void, ms: number): unknown;
declare function clearTimeout(id: unknown): void;

// Console (available in both environments)
declare var console: {
  log(...args: unknown[]): void;
  warn(...args: unknown[]): void;
  error(...args: unknown[]): void;
  info(...args: unknown[]): void;
};

// structuredClone (ES2024+ / Node 17+ / modern browsers)
declare function structuredClone<T>(value: T): T;

// Browser Storage API (used by LocalStorageProvider)
interface Storage {
  readonly length: number;
  clear(): void;
  getItem(key: string): string | null;
  key(index: number): string | null;
  removeItem(key: string): void;
  setItem(key: string, value: string): void;
}

interface StorageEvent {
  readonly key: string | null;
  readonly newValue: string | null;
  readonly oldValue: string | null;
  readonly storageArea: Storage | null;
  readonly url: string;
}

// Minimal EventListener type for addEventListener/removeEventListener
type EventListener = (event: unknown) => void;

// Augment globalThis with browser APIs used at runtime (feature-detected)
declare var localStorage: Storage;
declare function addEventListener(type: string, listener: EventListener): void;
declare function removeEventListener(type: string, listener: EventListener): void;
