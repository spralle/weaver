// Scope resolution benchmark — A/B comparison: no cache vs LRU cache
// Run: node packages/config-providers/bench/scope-resolution.bench.mjs

import { performance } from "node:perf_hooks";
import { defineWeaver, Layers } from "../../config-types/dist/index.js";
import {
  InMemoryStorageProvider,
  StaticJsonStorageProvider,
  createConfigurationService,
  createScopeResolutionCache,
} from "../dist/index.js";

// --- Setup ---

const NUM_SCOPE_KEYS = 20;
const NUM_BASE_KEYS = 200;
const NUM_COUNTRIES = 50;
const NUM_LOCATIONS = 50;
const NUM_SCOPE_PATHS = 100;
const WARMUP_CALLS = 1_000;
const MEASURE_CALLS = 100_000;

// Build base key data
function makeBaseEntries(count) {
  const entries = {};
  for (let i = 0; i < count; i++) {
    entries[`app.feature.key${String(i).padStart(3, "0")}`] = `value-${i}`;
  }
  return entries;
}

// Build scope entries (subset of base keys with scope-specific values)
function makeScopeEntries(scopeId, count) {
  const entries = {};
  for (let i = 0; i < count; i++) {
    entries[`app.feature.key${String(i).padStart(3, "0")}`] = `${scopeId}-override-${i}`;
  }
  return entries;
}

const weaverConfig = defineWeaver([
  Layers.Static("core"),
  Layers.Static("app"),
  Layers.Dynamic("tenant"),
  Layers.Personal("user"),
  Layers.Ephemeral("session"),
]);

const baseEntries = makeBaseEntries(NUM_BASE_KEYS);

// Base providers
const coreProvider = new StaticJsonStorageProvider({
  id: "core",
  layer: "core",
  data: { ...baseEntries },
});

const appProvider = new StaticJsonStorageProvider({
  id: "app",
  layer: "app",
  data: { ...baseEntries },
});

const tenantProvider = new InMemoryStorageProvider({
  id: "tenant",
  layer: "tenant",
});

const userProvider = new InMemoryStorageProvider({
  id: "user",
  layer: "user",
});

// Scope providers
const scopeProviders = [];

for (let i = 0; i < NUM_COUNTRIES; i++) {
  const id = `C${String(i).padStart(2, "0")}`;
  scopeProviders.push(
    new InMemoryStorageProvider({
      id: `country:${id}`,
      layer: `country:${id}`,
      initialEntries: makeScopeEntries(`country:${id}`, NUM_SCOPE_KEYS),
    }),
  );
}

for (let i = 0; i < NUM_LOCATIONS; i++) {
  const id = `L${String(i).padStart(2, "0")}`;
  scopeProviders.push(
    new InMemoryStorageProvider({
      id: `location:${id}`,
      layer: `location:${id}`,
      initialEntries: makeScopeEntries(`location:${id}`, NUM_SCOPE_KEYS),
    }),
  );
}

// Build scope paths
const scopePaths = [];
for (let i = 0; i < NUM_SCOPE_PATHS; i++) {
  const countryIdx = Math.floor(Math.random() * NUM_COUNTRIES);
  const locationIdx = Math.floor(Math.random() * NUM_LOCATIONS);
  scopePaths.push([
    { scopeId: "country", value: `C${String(countryIdx).padStart(2, "0")}` },
    { scopeId: "location", value: `L${String(locationIdx).padStart(2, "0")}` },
  ]);
}

const testKey = "app.feature.key005";
const allProviders = [coreProvider, appProvider, tenantProvider, userProvider, ...scopeProviders];

// --- Benchmark runner ---

function runBenchmark(service, label) {
  // Warmup
  for (let i = 0; i < WARMUP_CALLS; i++) {
    service.getForScope(testKey, scopePaths[i % NUM_SCOPE_PATHS]);
  }

  // Measure
  const start = performance.now();
  for (let i = 0; i < MEASURE_CALLS; i++) {
    service.getForScope(testKey, scopePaths[i % NUM_SCOPE_PATHS]);
  }
  const elapsed = performance.now() - start;

  const opsPerSec = Math.round(MEASURE_CALLS / (elapsed / 1000));
  const meanLatencyNs = Math.round((elapsed / MEASURE_CALLS) * 1_000_000);

  return { label, elapsed, opsPerSec, meanLatencyNs };
}

function formatNumber(n) {
  return n.toLocaleString("en-US");
}

// --- Main ---

async function main() {
  // Test A: no cache
  const serviceA = await createConfigurationService({
    providers: [...allProviders],
    weaverConfig,
  });

  // Test B: LRU cache
  const serviceB = await createConfigurationService({
    providers: [...allProviders],
    weaverConfig,
    scopeCache: createScopeResolutionCache(200),
  });

  const resultA = runBenchmark(serviceA, "No Cache");
  const resultB = runBenchmark(serviceB, "LRU Cache");

  const speedup = resultA.elapsed / resultB.elapsed;

  console.log("");
  console.log("Scope Resolution Benchmark");
  console.log("═══════════════════════════════════════════════════");
  console.log(`Setup: 5 base layers, ${NUM_COUNTRIES + NUM_LOCATIONS} scope providers, ${NUM_BASE_KEYS} keys`);
  console.log(`Workload: ${formatNumber(MEASURE_CALLS)} getForScope() calls across ${NUM_SCOPE_PATHS} scope paths`);
  console.log("");
  console.log("                    No Cache        LRU Cache       Speedup");
  console.log("─────────────────────────────────────────────────");
  console.log(
    `Total (ms)          ${resultA.elapsed.toFixed(1).padEnd(16)}${resultB.elapsed.toFixed(1).padEnd(16)}${speedup.toFixed(1)}x`,
  );
  console.log(
    `Ops/sec             ${formatNumber(resultA.opsPerSec).padEnd(16)}${formatNumber(resultB.opsPerSec).padEnd(16)}`,
  );
  console.log(
    `Mean latency (ns)   ${formatNumber(resultA.meanLatencyNs).padEnd(16)}${formatNumber(resultB.meanLatencyNs).padEnd(16)}`,
  );
  console.log("═══════════════════════════════════════════════════");
  console.log("");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
