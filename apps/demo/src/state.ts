type Callback<T> = (value: T) => void;

let selectedKey: string | null = null;
const keyListeners: Callback<string | null>[] = [];

export interface LogEntry {
  timestamp: Date;
  message: string;
}

const activityLog: LogEntry[] = [];
const logListeners: Callback<LogEntry[]>[] = [];

const MAX_LOG_ENTRIES = 50;

export function getSelectedKey(): string | null {
  return selectedKey;
}

export function setSelectedKey(key: string | null): void {
  selectedKey = key;
  for (const cb of keyListeners) cb(key);
}

export function onSelectedKeyChange(cb: Callback<string | null>): () => void {
  keyListeners.push(cb);
  return () => {
    const idx = keyListeners.indexOf(cb);
    if (idx >= 0) keyListeners.splice(idx, 1);
  };
}

export function addLogEntry(message: string): void {
  activityLog.unshift({ timestamp: new Date(), message });
  if (activityLog.length > MAX_LOG_ENTRIES) activityLog.length = MAX_LOG_ENTRIES;
  for (const cb of logListeners) cb([...activityLog]);
}

export function getLog(): LogEntry[] {
  return [...activityLog];
}

export function onLogChange(cb: Callback<LogEntry[]>): () => void {
  logListeners.push(cb);
  return () => {
    const idx = logListeners.indexOf(cb);
    if (idx >= 0) logListeners.splice(idx, 1);
  };
}

let sessionActive = false;
const sessionListeners: Callback<boolean>[] = [];

export function isSessionActive(): boolean {
  return sessionActive;
}

export function setSessionActive(active: boolean): void {
  sessionActive = active;
  for (const cb of sessionListeners) cb(active);
}

export function onSessionActiveChange(cb: Callback<boolean>): () => void {
  sessionListeners.push(cb);
  return () => {
    const idx = sessionListeners.indexOf(cb);
    if (idx >= 0) sessionListeners.splice(idx, 1);
  };
}
