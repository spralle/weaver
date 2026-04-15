// Ambient type declarations for browser/Node cross-environment globals
// config-sessions operates in both browser and Node.js environments

// Timer functions (available in both environments)
declare function setTimeout(callback: () => void, ms: number): unknown;
declare function clearTimeout(id: unknown): void;
