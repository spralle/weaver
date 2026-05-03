/**
 * Minimal logger interface for storage providers.
 * Avoids depending on weaver-server (wrong dependency direction).
 */
export interface WeaverLogger {
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
}

export const consoleLogger: WeaverLogger = {
  warn(message: string, ...args: unknown[]): void {
    console.warn(message, ...args);
  },
  error(message: string, ...args: unknown[]): void {
    console.error(message, ...args);
  },
};
