#!/usr/bin/env node
import { startWeaverServer } from "./server";

type ShutdownSignal = "SIGINT" | "SIGTERM";

async function main(): Promise<void> {
  const server = await startWeaverServer();

  console.log(`Weaver server listening on port ${server.port}`);
  registerShutdownHandlers(async (signal) => {
    console.log(`Received ${signal}; shutting down Weaver server`);
    await server.close();
  });
}

function registerShutdownHandlers(
  shutdown: (signal: ShutdownSignal) => Promise<void>,
): void {
  let isShuttingDown = false;

  const handleSignal = (signal: ShutdownSignal) => {
    if (isShuttingDown) return;
    isShuttingDown = true;

    void shutdown(signal).then(
      () => process.exit(0),
      (err: unknown) => {
        console.error("Failed to shut down Weaver server", err);
        process.exit(1);
      },
    );
  };

  process.on("SIGINT", handleSignal);
  process.on("SIGTERM", handleSignal);
}

main().catch((err: unknown) => {
  console.error("Failed to start Weaver server", err);
  process.exitCode = 1;
});
